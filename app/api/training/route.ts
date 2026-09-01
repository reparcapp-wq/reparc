import { NextRequest, NextResponse } from "next/server";
import { mergeTrainingData, normalizeTrainingData, trainingDataBytes, trainingDataValidationIssues } from "@/lib/training";
import { createRouteSupabase } from "@/lib/supabase/server";
import { databaseRateLimitResponse, readJsonBody, requireSameOrigin, securityErrorResponse } from "@/lib/request-security";

type ProfileRow = { value: unknown; updated_at: string; revision: number };

async function authenticated(request: NextRequest) {
  const route = createRouteSupabase(request);
  const { data, error } = await route.supabase.auth.getUser();
  return { ...route, user: error ? null : data.user };
}

async function readProfile(supabase: ReturnType<typeof createRouteSupabase>["supabase"], userId: string) {
  const versioned = await supabase.from("training_profiles").select("value,updated_at,revision").eq("user_id", userId).maybeSingle();
  if (!versioned.error) return versioned.data ? { ...versioned.data, revision: Math.max(0, Number(versioned.data.revision) || 0) } as ProfileRow : null;
  if (versioned.error.code !== "42703" && versioned.error.code !== "PGRST204") throw versioned.error;
  const legacy = await supabase.from("training_profiles").select("value,updated_at").eq("user_id", userId).maybeSingle();
  if (legacy.error) throw legacy.error;
  return legacy.data ? { ...legacy.data, revision: 0 } as ProfileRow : null;
}

const responseForRow = (row: ProfileRow) => {
  const data = normalizeTrainingData(row.value, row.updated_at);
  return { data, updatedAt: row.updated_at, revision: row.revision };
};

export async function GET(request: NextRequest) {
  try {
    const { supabase, finalize, user } = await authenticated(request);
    if (!user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const row = await readProfile(supabase, user.id);
    if (!row) return finalize(NextResponse.json({ error: "No saved data." }, { status: 404 }));
    return finalize(NextResponse.json(responseForRow(row)));
  } catch {
    return NextResponse.json({ error: "Cloud sync is temporarily unavailable." }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const rawBody = await readJsonBody(request, 1_000_000);
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) return NextResponse.json({ error: "The request body is invalid." }, { status: 400 });
    const { supabase, finalize, user } = await authenticated(request);
    if (!user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const body = rawBody as { data?: unknown; mode?: unknown; baseRevision?: unknown };
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) return finalize(NextResponse.json({ error: "Training data is required." }, { status: 400 }));
    const issues = trainingDataValidationIssues(body.data);
    if (issues.length) return finalize(NextResponse.json({ error: issues[0] }, { status: 422 }));
    const incoming = normalizeTrainingData(body.data);
    if (trainingDataBytes(incoming) > 900_000) return finalize(NextResponse.json({ error: "Training history is too large." }, { status: 413 }));

    const baseRevision = Math.max(0, Math.trunc(Number(body.baseRevision) || 0));
    const existing = await readProfile(supabase, user.id);
    if (existing && existing.revision > 0 && baseRevision !== existing.revision) return finalize(NextResponse.json(responseForRow(existing), { status: 409 }));
    const next = body.mode === "replace" || !existing ? incoming : mergeTrainingData(incoming, normalizeTrainingData(existing.value, existing.updated_at));
    if (trainingDataBytes(next) > 900_000) return finalize(NextResponse.json({ error: "Merged training history is too large. Export a backup before adding more records." }, { status: 413 }));

    const rpc = await supabase.rpc("write_training_profile", { expected_revision: baseRevision, incoming_value: next });
    if (!rpc.error) {
      const result = (Array.isArray(rpc.data) ? rpc.data[0] : rpc.data) as { value?: unknown; updated_at?: string; revision?: number; conflict?: boolean } | null;
      if (!result?.value || !result.updated_at) throw new Error("Cloud write returned no data");
      const row: ProfileRow = { value: result.value, updated_at: result.updated_at, revision: Math.max(1, Number(result.revision) || 1) };
      if (result.conflict) return finalize(NextResponse.json(responseForRow(row), { status: 409 }));
      return finalize(NextResponse.json(responseForRow(row)));
    }

    if (rpc.error.code !== "PGRST202" && rpc.error.code !== "42883") {
      const limited = databaseRateLimitResponse(rpc.error);
      if (limited) return finalize(limited);
      throw rpc.error;
    }
    const { error: writeError } = await supabase.from("training_profiles").upsert({ user_id: user.id, value: next, updated_at: next.updatedAt }, { onConflict: "user_id" });
    if (writeError) {
      const limited = databaseRateLimitResponse(writeError);
      if (limited) return finalize(limited);
      throw writeError;
    }
    return finalize(NextResponse.json({ data: next, updatedAt: next.updatedAt, revision: 0 }));
  } catch (error) {
    const protectedResponse = securityErrorResponse(error);
    if (protectedResponse) return protectedResponse;
    return NextResponse.json({ error: "Cloud save failed." }, { status: 502 });
  }
}
