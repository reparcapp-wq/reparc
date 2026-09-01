import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { APP_RELEASE, sanitizeAppContext, sanitizeDiagnosticMessage } from "@/lib/telemetry-shared";
import { databaseRateLimitResponse, readJsonBody, requireSameOrigin, securityErrorResponse } from "@/lib/request-security";

const kinds = new Set(["render", "runtime", "promise", "sync", "pwa"]);

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const rawBody = await readJsonBody(request, 16_384);
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "The request body is invalid." }, { status: 400 });
    }
    const { supabase, finalize } = createRouteSupabase(request);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const body = rawBody as { kind?: unknown; message?: unknown; context?: unknown };
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
    if (error) {
      const limited = databaseRateLimitResponse(error);
      if (limited) return finalize(limited);
      throw error;
    }
    return finalize(NextResponse.json({ accepted: true }, { status: 202 }));
  } catch (error) {
    const protectedResponse = securityErrorResponse(error);
    if (protectedResponse) return protectedResponse;
    return NextResponse.json({ error: "Diagnostics are temporarily unavailable." }, { status: 503 });
  }
}
