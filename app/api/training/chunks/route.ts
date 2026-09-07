import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { readJsonBody, requireSameOrigin, securityErrorResponse } from "@/lib/request-security";

export async function GET(request: NextRequest) {
  try {
    const { supabase, finalize } = createRouteSupabase(request);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!/^[a-f0-9]{64}$/.test(id)) return finalize(NextResponse.json({ error: "Invalid archive reference." }, { status: 422 }));
    const result = await supabase.from("training_archive_chunks").select("content").eq("user_id", data.user.id).eq("digest", id).single();
    if (result.error) throw result.error;
    return finalize(NextResponse.json({ text: result.data.content }));
  } catch { return NextResponse.json({ error: "History chunk unavailable. Your local records remain available." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
export async function PUT(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const { supabase, finalize } = createRouteSupabase(request);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const body = await readJsonBody(request, 800_000) as { id?: unknown; text?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.id !== "string" || !/^[a-f0-9]{64}$/.test(body.id) || typeof body.text !== "string") return finalize(NextResponse.json({ error: "Invalid history chunk." }, { status: 422 }));
    const result = await supabase.rpc("stage_training_chunk", { chunk_digest: body.id, chunk_content: body.text });
    if (result.error) throw result.error;
    return finalize(NextResponse.json({ saved: true }));
  } catch (error) { return securityErrorResponse(error) ?? NextResponse.json({ error: "History upload unavailable. Your changes remain queued on this device." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
