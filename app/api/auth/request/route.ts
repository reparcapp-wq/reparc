import { NextRequest, NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/server";

const validEmail = (value: unknown) => typeof value === "string"
  && value.length <= 254
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: unknown; website?: unknown };
    if (body.website) return NextResponse.json({ sent: true });
    if (!validEmail(body.email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

    const { supabase, finalize } = createRouteSupabase(request);
    const { error } = await supabase.auth.signInWithOtp({
      email: (body.email as string).trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
      },
    });
    if (error) {
      const status = error.status === 429 ? 429 : 502;
      return finalize(NextResponse.json({ error: status === 429 ? "Please wait before requesting another code." : "The sign-in email could not be sent." }, { status }));
    }
    return finalize(NextResponse.json({ sent: true }));
  } catch {
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
  }
}
