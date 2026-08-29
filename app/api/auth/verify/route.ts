import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: unknown; token?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const token = typeof body.token === "string" ? body.token.replace(/\s/g, "") : "";
    if (!email || !/^\d{6,8}$/.test(token)) {
      return NextResponse.json({ error: "Enter the code from your email." }, { status: 400 });
    }
    const { supabase, finalize } = createRouteSupabase(request);
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error || !data.user) return finalize(NextResponse.json({ error: "That code is invalid or has expired." }, { status: 401 }));
    return finalize(NextResponse.json({ account: { id: data.user.id, email: data.user.email ?? email } }));
  } catch {
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
  }
}
