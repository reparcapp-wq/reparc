import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

after(async () => vite.close());

const training = await vite.ssrLoadModule("/lib/training.ts");
const backup = await vite.ssrLoadModule("/lib/backup.ts");
const telemetry = await vite.ssrLoadModule("/lib/telemetry-shared.ts");
const offline = await vite.ssrLoadModule("/lib/offline-store.ts");

test("round-trips a versioned backup envelope without losing training history", () => {
  const data = {
    ...training.emptyData(),
    sessions: [{
      id: "session-one",
      date: "2026-08-28",
      dayId: "UA",
      unit: "kg",
      entries: {},
      revision: 1,
      createdAt: "2026-08-28T10:00:00.000Z",
      updatedAt: "2026-08-28T10:00:00.000Z",
    }],
  };
  const envelope = backup.createTrainingBackup(data, "2026-08-29T00:00:00.000Z");
  const parsed = backup.parseTrainingBackup(JSON.stringify(envelope));
  assert.equal(parsed.sessions, 1);
  assert.equal(parsed.firstDate, "2026-08-28");
  assert.equal(parsed.exportedAt, "2026-08-29T00:00:00.000Z");
  assert.equal(parsed.data.sessions[0].id, "session-one");
});

test("rejects arbitrary JSON and unsupported future backup formats", () => {
  assert.throws(() => backup.parseTrainingBackup('{"hello":"world"}'), /not supported|required training data/i);
  assert.throws(() => backup.parseTrainingBackup(JSON.stringify({ format: "my-progress-backup", formatVersion: 2, data: training.emptyData() })), /newer/i);
});

test("restores a legacy backup whose sessions predate per-session units", () => {
  const legacy = {
    version: 5,
    updatedAt: "2026-08-29T00:00:00.000Z",
    profile: { bodyweight: 75, unit: "kg", level: "intermediate" },
    program: { activeId: "phase1", week: 1, frequency: 5 },
    sessions: [{
      id: "legacy-session",
      date: "2026-08-28",
      dayId: "UA",
      entries: { ua1: [{ w: "20", r: "10", rir: "2" }] },
      createdAt: "2026-08-28T12:00:00.000Z",
      updatedAt: "2026-08-28T12:00:00.000Z",
    }],
  };
  const restored = backup.parseTrainingBackup(JSON.stringify(legacy));
  assert.equal(restored.data.sessions[0].unit, "kg");
});

test("replace remains authoritative if another local edit lands before its upload", () => {
  const original = training.emptyData();
  const first = offline.nextPendingOfflineRecord("account", undefined, original, "replace", "2026-08-29T01:00:00.000Z");
  const edited = { ...original, updatedAt: "2026-08-29T01:01:00.000Z" };
  const second = offline.nextPendingOfflineRecord("account", first, edited, "merge", "2026-08-29T01:01:00.000Z");
  assert.equal(second.revision, 2);
  assert.equal(second.syncMode, "replace");
  assert.equal(second.pendingSince, first.pendingSince);
});

test("diagnostic sanitization removes direct identifiers, URLs, and token-shaped secrets", () => {
  const sanitized = telemetry.sanitizeDiagnosticMessage("Failed for person@example.com at https://example.com/path token eyJabcdefghijklmnopqrstuvwxyz1234567890");
  assert.doesNotMatch(sanitized, /person@example\.com|https:\/\/|eyJabcdefghijklmnopqrstuvwxyz/);
  assert.match(sanitized, /\[email\].*\[url\].*\[token\]/);
});

test("cloud routes derive ownership from the verified auth user", async () => {
  const source = await readFile(new URL("../app/api/training/route.ts", import.meta.url), "utf8");
  assert.match(source, /supabase\.auth\.getUser\(\)/);
  assert.match(source, /user_id:\s*user\.id/);
  assert.doesNotMatch(source, /body\.name|searchParams\.get\("name"\)|TRAINING_SYNC_KEY/);
});

test("the database migration revokes anonymous access and enforces account ownership", async () => {
  const sql = await readFile(new URL("../supabase/v6-account-security.sql", import.meta.url), "utf8");
  assert.match(sql, /revoke all[\s\S]*from anon/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(sql, /references auth\.users\(id\) on delete cascade/i);
});

test("auth cookies are HTTP-only and the browser cache never stores session tokens", async () => {
  const serverSource = await readFile(new URL("../lib/supabase/server.ts", import.meta.url), "utf8");
  const accountSource = await readFile(new URL("../lib/account-client.ts", import.meta.url), "utf8");
  assert.match(serverSource, /httpOnly:\s*true/);
  assert.doesNotMatch(accountSource, /access_token|refresh_token/);
});

test("deployment headers prevent framing and keep every API response out of shared caches", async () => {
  const source = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(source, /frame-ancestors 'none'/);
  assert.match(source, /X-Frame-Options[\s\S]*DENY/);
  assert.match(source, /Permissions-Policy/);
  assert.match(source, /source:\s*"\/api\/:path\*"[\s\S]*private, no-store/);
});

test("service-worker updates wait for explicit user approval", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const installHandler = source.match(/self\.addEventListener\("install"[\s\S]*?\n\}\);/)?.[0] ?? "";
  assert.doesNotMatch(installHandler, /skipWaiting/);
  assert.match(source, /event\.data === "SKIP_WAITING"/);
});

test("signed-out and signed-in shells expose keyboard and landmark protections", async () => {
  const gate = await readFile(new URL("../components/account-gate.tsx", import.meta.url), "utf8");
  const requestRoute = await readFile(new URL("../app/api/auth/request/route.ts", import.meta.url), "utf8");
  const app = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(gate, /href="#main-content"/);
  assert.match(gate, /id="account-website"[\s\S]*aria-hidden="true"/);
  assert.match(gate, /Enter your email code/);
  assert.match(gate, /6–8 digit one-time code/);
  assert.match(gate, /One-time code/);
  assert.match(gate, /confirms new accounts/);
  assert.doesNotMatch(gate, /sign-in link|secure link|if provided/i);
  assert.match(requestRoute, /shouldCreateUser:\s*true/);
  assert.doesNotMatch(requestRoute, /emailRedirectTo|trustedAppOrigin/);
  assert.match(app, /id="main-content"/);
  assert.match(app, /aria-label={`Bodyweight in \$\{profile\.unit\}`}/);
});
