import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { requireSameOrigin, securityErrorResponse } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const { supabase, finalize } = createRouteSupabase(request);
    await supabase.auth.signOut({ scope: "local" });
    return finalize(NextResponse.json({ signedOut: true }));
  } catch (error) {
    const protectedResponse = securityErrorResponse(error);
    if (protectedResponse) return protectedResponse;
    return NextResponse.json({ error: "Sign out is temporarily unavailable." }, { status: 503 });
  }
}
