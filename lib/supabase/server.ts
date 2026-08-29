import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type CookieUpdate = { name: string; value: string; options?: CookieOptions };

function configuration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase authentication is not configured");
  return { url, key };
}

export function createRouteSupabase(request: NextRequest) {
  const config = configuration();
  let pendingCookies: CookieUpdate[] = [];
  const supabase = createServerClient(config.url, config.key, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        pendingCookies = cookiesToSet;
      },
    },
  });

  const finalize = <T extends NextResponse>(response: T) => {
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, {
        ...options,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      });
    });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
    return response;
  };

  return { supabase, finalize };
}

export function trustedAppOrigin(request: NextRequest) {
  const configured = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  if (configured && /^https:\/\//i.test(configured)) return configured.replace(/\/$/, "");
  return request.nextUrl.origin;
}
