import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("support data has fixed retention and an automatic cleanup job", async () => {
  const [sql, privacy, operations] = await Promise.all([
    read("supabase/v8-production-hardening.sql"), read("app/privacy/page.tsx"), read("OPERATIONS.md"),
  ]);
  assert.match(sql, /beta_feedback[\s\S]*interval '180 days'/);
  assert.match(sql, /diagnostic_events[\s\S]*interval '30 days'/);
  assert.match(sql, /cron\.schedule[\s\S]*reparc-support-data-retention/);
  assert.match(sql, /revoke all[\s\S]*public, anon, authenticated/i);
  assert.match(privacy, /feedback is automatically deleted after 180 days/);
  assert.match(privacy, /diagnostics after 30 days/);
  assert.match(operations, /cron\.job_run_details/);
});

test("email OTP flow is ready for optional Turnstile enforcement", async () => {
  const [route, gate, challenge, config] = await Promise.all([
    read("app/api/auth/request/route.ts"), read("components/account-gate.tsx"), read("components/turnstile-challenge.tsx"), read("next.config.ts"),
  ]);
  assert.match(route, /captchaToken/);
  assert.match(route, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(gate, /TurnstileChallenge/);
  assert.match(challenge, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(config, /frame-src https:\/\/challenges\.cloudflare\.com/);
});

test("the guide attributes the adapted program without claiming endorsement", async () => {
  const guide = await read("components/training-guide.tsx");
  assert.match(guide, /Stronger by Science Program Bundle/);
  assert.match(guide, /not affiliated with, reviewed by or endorsed by Stronger by Science/);
  assert.match(guide, /does not redistribute the original spreadsheets/);
});
