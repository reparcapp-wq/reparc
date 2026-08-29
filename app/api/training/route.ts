import { NextRequest, NextResponse } from "next/server";
import { mergeTrainingData, normalizeTrainingData } from "@/lib/training";
import { createRouteSupabase } from "@/lib/supabase/server";

async function authenticated(request: NextRequest) {
  const route = createRouteSupabase(request);
  const { data, error } = await route.supabase.auth.getUser();
  return { ...route, user: error ? null : data.user };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, finalize, user } = await authenticated(request);
    if (!user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const { data: row, error } = await supabase
      .from("training_profiles")
      .select("value,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return finalize(NextResponse.json({ error: "No saved data." }, { status: 404 }));
    const data = normalizeTrainingData(row.value, row.updated_at);
    return finalize(NextResponse.json({ data, updatedAt: data.updatedAt }));
  } catch {
    return NextResponse.json({ error: "Cloud sync is temporarily unavailable." }, { status: 502 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { supabase, finalize, user } = await authenticated(request);
    if (!user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const body = await request.json() as { data?: unknown; mode?: unknown };
    const incoming = normalizeTrainingData(body.data);
    if (JSON.stringify(incoming).length > 900_000) {
      return finalize(NextResponse.json({ error: "Training history is too large." }, { status: 413 }));
    }
    const mode = body.mode === "replace" ? "replace" : "merge";
    let next = incoming;
    if (mode === "merge") {
      const { data: existing, error: readError } = await supabase
        .from("training_profiles")
        .select("value,updated_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (readError) throw readError;
      if (existing) next = mergeTrainingData(incoming, normalizeTrainingData(existing.value, existing.updated_at));
    }
    const { error: writeError } = await supabase.from("training_profiles").upsert({
      user_id: user.id,
      value: next,
      updated_at: next.updatedAt,
    }, { onConflict: "user_id" });
    if (writeError) throw writeError;
    return finalize(NextResponse.json({ data: next, updatedAt: next.updatedAt }));
  } catch {
    return NextResponse.json({ error: "Cloud save failed." }, { status: 502 });
  }
}
