import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { readJsonBody, requireSameOrigin, securityErrorResponse, databaseRateLimitResponse } from "@/lib/request-security";
import { IMPROVEMENT_NOTICE_VERSION } from "@/lib/improvement";

export async function GET(request: NextRequest) {
  try {
    const { supabase, finalize } = createRouteSupabase(request);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const result = await supabase.from("improvement_consent").select("enabled,notice_version,granted_at,expires_at").eq("user_id", auth.user.id).maybeSingle();
    if (result.error) return finalize(NextResponse.json({ available: false, enabled: false }));
    const row = result.data;
    return finalize(NextResponse.json({ available: true, enabled: Boolean(row?.enabled && row.notice_version === IMPROVEMENT_NOTICE_VERSION && Date.parse(row.expires_at) > Date.now()), noticeVersion: row?.notice_version, grantedAt: row?.granted_at, expiresAt: row?.expires_at }));
  } catch { return NextResponse.json({ error: "Privacy settings are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}

async function change(request: NextRequest, withdraw = false) {
  try {
    requireSameOrigin(request);
    const body = withdraw ? { enabled: false, noticeVersion: IMPROVEMENT_NOTICE_VERSION } : await readJsonBody(request, 1_024) as { enabled?: unknown; noticeVersion?: unknown; action?: unknown };
    const { supabase, finalize } = createRouteSupabase(request);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    if (!body || typeof body !== "object" || Array.isArray(body)) return finalize(NextResponse.json({ error: "Invalid privacy choice." }, { status: 422 }));
    if ("action" in body && body.action === "export") {
      const result = await supabase.rpc("export_improvement_data");
      if (result.error) throw result.error;
      return finalize(NextResponse.json(result.data));
    }
    if (typeof body.enabled !== "boolean" || body.noticeVersion !== IMPROVEMENT_NOTICE_VERSION) return finalize(NextResponse.json({ error: "Review the current privacy choice." }, { status: 422 }));
    const result = await supabase.rpc("set_improvement_consent", { participate: body.enabled, accepted_version: IMPROVEMENT_NOTICE_VERSION });
    if (result.error) {
      const limited = databaseRateLimitResponse(result.error);
      if (limited) return finalize(limited);
      throw result.error;
    }
    return finalize(NextResponse.json({ saved: true, enabled: body.enabled }));
  } catch (error) { return securityErrorResponse(error) ?? NextResponse.json({ error: "Could not save this privacy choice. Reconnect and ensure your setup is synced, then try again." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
export const POST = (request: NextRequest) => change(request);
export const DELETE = (request: NextRequest) => change(request, true);
