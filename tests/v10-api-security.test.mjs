import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every browser mutation is same-origin and size bounded", async () => {
  const routes = await Promise.all([
    "app/api/auth/request/route.ts",
    "app/api/auth/verify/route.ts",
    "app/api/feedback/route.ts",
    "app/api/diagnostics/route.ts",
    "app/api/training/route.ts",
  ].map(read));
  routes.forEach((route) => {
    assert.match(route, /requireSameOrigin\(request\)/);
    assert.match(route, /readJsonBody\(request,\s*[\d_]+\)/);
    assert.match(route, /securityErrorResponse/);
  });

  const noBodyRoutes = await Promise.all(["app/api/account/route.ts", "app/api/auth/signout/route.ts"].map(read));
  noBodyRoutes.forEach((route) => assert.match(route, /requireSameOrigin\(request\)/));

  const requestSecurity = await read("lib/request-security.ts");
  assert.match(requestSecurity, /sec-fetch-site/);
  assert.match(requestSecurity, /x-reparc-request/);
  assert.match(requestSecurity, /TextEncoder\(\)\.encode\(text\)\.byteLength/);
  assert.match(requestSecurity, /Retry-After/);
});

test("authenticated writes surface durable database limit responses", async () => {
  const routes = await Promise.all([
    "app/api/training/route.ts",
    "app/api/feedback/route.ts",
    "app/api/diagnostics/route.ts",
    "app/api/account/route.ts",
  ].map(read));
  routes.forEach((route) => assert.match(route, /databaseRateLimitResponse/));
  const clients = await Promise.all(["lib/account-client.ts", "lib/training-storage.ts", "lib/diagnostics.ts"].map(read));
  clients.forEach((client) => assert.match(client, /X-RepArc-Request/));
});

test("database limiter is private, atomic, fixed-policy, and automatically purged", async () => {
  const sql = await read("supabase/v9-api-security.sql");
  assert.match(sql, /api_rate_limits enable row level security/i);
  assert.match(sql, /revoke all on table public\.api_rate_limits from public, anon, authenticated/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /on conflict \(user_id, action\) do update/i);
  assert.match(sql, /when 'training_write' then 240/);
  assert.match(sql, /grant execute on function public\.consume_api_rate_limit\(text\) to authenticated/i);
  assert.match(sql, /create trigger training_profiles_rate_limit[\s\S]*training_write/i);
  assert.match(sql, /create trigger beta_feedback_rate_limit[\s\S]*feedback_write/i);
  assert.match(sql, /create trigger diagnostic_events_rate_limit[\s\S]*diagnostics_write/i);
  assert.match(sql, /delete_current_user[\s\S]*consume_api_rate_limit\('account_delete'\)/i);
  assert.match(sql, /training_profiles_value_size/);
  assert.match(sql, /api_rate_limits[\s\S]*interval '2 days'/);
});

test("repository security automation and hardened headers are configured", async () => {
  const [verify, securityWorkflow, dependabot, config, operations, liveTest, staticScan] = await Promise.all([
    read(".github/workflows/verify.yml"),
    read(".github/workflows/security.yml"),
    read(".github/dependabot.yml"),
    read("next.config.ts"),
    read("OPERATIONS.md"),
    read("scripts/verify-supabase-security.mjs"),
    read("scripts/security-static-check.mjs"),
  ]);
  assert.doesNotMatch(verify, /actions\/checkout@v4/);
  assert.match(securityWorkflow, /npm run security:static/);
  assert.match(securityWorkflow, /npm audit --omit=dev --audit-level=high/);
  assert.match(dependabot, /package-ecosystem: npm/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /Cross-Origin-Opener-Policy/);
  assert.match(config, /script-src-attr 'none'/);
  assert.match(operations, /quarterly restore result/);
  assert.match(liveTest, /another account must not see the row/);
  assert.match(staticScan, /PRIVATE KEY/);
});

test("training sync uses atomic server revisions to reject stale device writes", async () => {
  const [route, storage, sql] = await Promise.all([
    read("app/api/training/route.ts"),
    read("lib/training-storage.ts"),
    read("supabase/v10-training-conflict-protection.sql"),
  ]);
  assert.match(route, /baseRevision/);
  assert.match(route, /status:\s*409/);
  assert.match(route, /write_training_profile/);
  assert.match(storage, /serverRevision/);
  assert.match(storage, /remote\.conflict/);
  assert.match(sql, /for update/i);
  assert.match(sql, /expected_revision[\s\S]*current_row\.revision/i);
  assert.match(sql, /grant execute on function public\.write_training_profile\(bigint, jsonb\) to authenticated/i);
});
