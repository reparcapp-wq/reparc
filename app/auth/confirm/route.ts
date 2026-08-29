import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase, trustedAppOrigin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const destination = new URL("/", trustedAppOrigin(request));
  try {
    const { supabase, finalize } = createRouteSupabase(request);
    const tokenHash = request.nextUrl.searchParams.get("token_hash");
    const code = request.nextUrl.searchParams.get("code");
    if (!tokenHash && !code) throw new Error("Missing token");
    const { error } = tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
      : await supabase.auth.exchangeCodeForSession(code!);
    if (error) throw error;
    destination.searchParams.set("auth", "success");
    return finalize(NextResponse.redirect(destination));
  } catch {
    destination.searchParams.set("auth", "error");
    return NextResponse.redirect(destination);
  }
}
