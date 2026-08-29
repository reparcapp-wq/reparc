import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, finalize } = createRouteSupabase(request);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return finalize(NextResponse.json({ error: "Sign in before deleting this account." }, { status: 401 }));
    }

    const { error } = await supabase.rpc("delete_current_user");
    if (error) throw error;

    const response = finalize(NextResponse.json({ deleted: true }));
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith("sb-") || name.startsWith("supabase-")) response.cookies.delete(name);
    });
    return response;
  } catch {
    return NextResponse.json(
      { error: "Account deletion is temporarily unavailable. Your data was not changed." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
