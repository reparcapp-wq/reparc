import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { supabase, finalize } = createRouteSupabase(request);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    return finalize(NextResponse.json({ account: { id: data.user.id, email: data.user.email ?? "" } }));
  } catch {
    return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  }
}
