import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { readJsonBody, requireSameOrigin, securityErrorResponse } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const rawBody = await readJsonBody(request, 8_192);
    if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
      return NextResponse.json({ error: "The request body is invalid." }, { status: 400 });
    }
    const body = rawBody as { email?: unknown; token?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const token = typeof body.token === "string" ? body.token.replace(/\s/g, "") : "";
    if (!email || !/^\d{6,8}$/.test(token)) {
      return NextResponse.json({ error: "Enter the code from your email." }, { status: 400 });
    }
    const { supabase, finalize } = createRouteSupabase(request);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.user) return finalize(NextResponse.json({ error: "That code is invalid or has expired." }, { status: 401 }));
    return finalize(NextResponse.json({ account: { id: data.user.id, email: data.user.email ?? email } }));
  } catch (error) {
    const protectedResponse = securityErrorResponse(error);
    if (protectedResponse) return protectedResponse;
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
  }
}
