import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";
import { APP_RELEASE, sanitizeAppContext } from "@/lib/telemetry-shared";

const categories = new Set(["bug", "confusing", "idea", "other"]);

export async function POST(request: NextRequest) {
  try {
    const { supabase, finalize } = createRouteSupabase(request);
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return finalize(NextResponse.json({ error: "Sign in required." }, { status: 401 }));
    const body = await request.json() as { category?: unknown; message?: unknown; includeContext?: unknown; context?: unknown };
    const category = typeof body.category === "string" && categories.has(body.category) ? body.category : "other";
    const message = typeof body.message === "string" ? body.message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, 2000) : "";
    if (message.length < 3) return finalize(NextResponse.json({ error: "Write at least a few words." }, { status: 400 }));
    const includeContext = body.includeContext === true;
    const appContext = includeContext ? { ...sanitizeAppContext(body.context), release: APP_RELEASE } : {};
    const { error } = await supabase.from("beta_feedback").insert({
      user_id: auth.user.id,
      category,
      message,
      include_context: includeContext,
      app_context: appContext,
    });
    if (error) throw error;
    return finalize(NextResponse.json({ accepted: true }, { status: 202 }));
  } catch {
    return NextResponse.json({ error: "Feedback is temporarily unavailable." }, { status: 503 });
  }
}
