import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { supabase, finalize } = createRouteSupabase(request);
    await supabase.auth.signOut({ scope: "local" });
    return finalize(NextResponse.json({ signedOut: true }));
  } catch {
    return NextResponse.json({ error: "Sign out is temporarily unavailable." }, { status: 503 });
  }
}
