import { NextRequest, NextResponse } from "next/server";
import { normalizeTrainingData, trainingDataBytes, trainingDataValidationIssues, type TrainingData } from "@/lib/training";
import { joinArchive, validArchive, type ArchiveManifest } from "@/lib/cloud-archive";
import { improvementSample, IMPROVEMENT_NOTICE_VERSION } from "@/lib/improvement";
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
  const archive = (row.value as { archiveManifest?: unknown })?.archiveManifest;
  if (validArchive(archive)) return { archive, updatedAt: row.updated_at, revision: row.revision };
  const data = normalizeTrainingData(row.value, row.updated_at);
  return { data, updatedAt: row.updated_at, revision: row.revision };
};

async function collectImprovement(supabase: ReturnType<typeof createRouteSupabase>["supabase"], userId: string, data: TrainingData) {
  // Optional collection can never make a successful workout save fail.
  try {
    const deleted = data.sessions.filter((session) => session.deletedAt).map((session) => session.id);
    if (deleted.length) await supabase.rpc("delete_improvement_samples", { deleted_session_ids: deleted });
    const consent = await supabase.from("improvement_consent").select("enabled,notice_version,granted_at,expires_at").eq("user_id", userId).maybeSingle();
    const permission = consent.data;
    if (!permission?.enabled || permission.notice_version !== IMPROVEMENT_NOTICE_VERSION || Date.parse(permission.expires_at) <= Date.now()) return;
    const candidates = data.sessions.filter((session) => session.startedAt && Date.parse(session.startedAt) >= Date.parse(permission.granted_at)).slice(-5);
    for (const session of candidates) {
      const sample = improvementSample(session, data); if (!sample) continue;
      await supabase.rpc("record_improvement_sample", { sample_session_id: session.id, sample, session_started_at: session.startedAt });
    }
  } catch { /* The ordinary workout record remains authoritative. */ }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, finalize, user } = await authenticated(request);
    if (!user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const row = await readProfile(supabase, user.id);
    if (!row) return finalize(NextResponse.json({ error: "No saved data." }, { status: 404 }));
    if (validArchive((row.value as { archiveManifest?: unknown })?.archiveManifest) && request.headers.get("x-reparc-history") !== "11") return finalize(NextResponse.json({ error: "Update RepArc to read this archived history." }, { status: 426 }));
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
    const body = rawBody as { data?: unknown; archive?: ArchiveManifest; mode?: unknown; baseRevision?: unknown };
    if (body.archive !== undefined) {
      if (!validArchive(body.archive)) return finalize(NextResponse.json({ error: "Invalid history archive." }, { status: 422 }));
      body.data = await joinArchive(body.archive, async (id) => {
        const chunk = await supabase.from("training_archive_chunks").select("content").eq("user_id", user.id).eq("digest", id).single();
        if (chunk.error) throw chunk.error;
        return chunk.data.content;
      });
    }
    if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) return finalize(NextResponse.json({ error: "Training data is required." }, { status: 400 }));
    const issues = trainingDataValidationIssues(body.data);
    if (issues.length) return finalize(NextResponse.json({ error: issues[0] }, { status: 422 }));
    const incoming = normalizeTrainingData(body.data);
    if (!body.archive && trainingDataBytes(incoming) > 900_000) return finalize(NextResponse.json({ error: "Use the history archive upload for this record." }, { status: 413 }));

    const baseRevision = Math.max(0, Math.trunc(Number(body.baseRevision) || 0));
    const existing = await readProfile(supabase, user.id);
    if (validArchive((existing?.value as { archiveManifest?: unknown })?.archiveManifest) && request.headers.get("x-reparc-history") !== "11") return finalize(NextResponse.json({ error: "Update RepArc before syncing this archived history." }, { status: 426 }));
    if (existing && existing.revision > 0 && baseRevision !== existing.revision) return finalize(NextResponse.json(responseForRow(existing), { status: 409 }));
    // A matching server revision means the client already reconciled against this
    // exact cloud state. A timestamp merge here would reintroduce clock dominance.
    const next = { ...incoming, updatedAt: new Date().toISOString() };
    if (body.archive) {
      const result = await supabase.rpc("commit_training_archive", { expected_revision: baseRevision, profile_metadata: {}, archive_manifest: body.archive });
      if (result.error) throw result.error;
      const row = result.data?.[0] as ProfileRow & { conflict?: boolean };
      if (!row?.value) throw new Error("Archive commit returned no data");
      if (!row.conflict) await collectImprovement(supabase, user.id, next);
      return finalize(NextResponse.json(responseForRow(row), { status: row.conflict ? 409 : 200 }));
    }

    const rpc = await supabase.rpc("write_training_profile", { expected_revision: baseRevision, incoming_value: next });
    if (!rpc.error) {
      const result = (Array.isArray(rpc.data) ? rpc.data[0] : rpc.data) as { value?: unknown; updated_at?: string; revision?: number; conflict?: boolean } | null;
      if (!result?.value || !result.updated_at) throw new Error("Cloud write returned no data");
      const row: ProfileRow = { value: result.value, updated_at: result.updated_at, revision: Math.max(1, Number(result.revision) || 1) };
      if (result.conflict) return finalize(NextResponse.json(responseForRow(row), { status: 409 }));
      await collectImprovement(supabase, user.id, next);
      return finalize(NextResponse.json(responseForRow(row)));
    }

    if (rpc.error.code !== "PGRST202" && rpc.error.code !== "42883") {
      const limited = databaseRateLimitResponse(rpc.error);
      if (limited) return finalize(limited);
      throw rpc.error;
    }
    return finalize(NextResponse.json({ error: "Cloud revision protection needs updating. Your changes remain saved on this device." }, { status: 503 }));
  } catch (error) {
    const protectedResponse = securityErrorResponse(error);
    if (protectedResponse) return protectedResponse;
    return NextResponse.json({ error: "Cloud save failed." }, { status: 502 });
  }
}
