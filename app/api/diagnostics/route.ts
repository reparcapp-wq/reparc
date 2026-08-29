import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { APP_RELEASE, sanitizeAppContext, sanitizeDiagnosticMessage } from "@/lib/telemetry-shared";

const kinds = new Set(["render", "runtime", "promise", "sync", "pwa"]);

export async function POST(request: NextRequest) {
  try {
    const { supabase, finalize } = createRouteSupabase(request);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const body = await request.json() as { kind?: unknown; message?: unknown; context?: unknown };
    const kind = typeof body.kind === "string" && kinds.has(body.kind) ? body.kind : "runtime";
    const message = sanitizeDiagnosticMessage(body.message);
    if (!message) return finalize(NextResponse.json({ error: "A diagnostic message is required." }, { status: 400 }));
    const { error } = await supabase.from("diagnostic_events").insert({
      user_id: auth.user.id,
      release: APP_RELEASE,
      kind,
      message,
      app_context: sanitizeAppContext(body.context),
    });
    if (error) throw error;
    return finalize(NextResponse.json({ accepted: true }, { status: 202 }));
  } catch {
    return NextResponse.json({ error: "Diagnostics are temporarily unavailable." }, { status: 503 });
  }
}
