import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("account deletion is authenticated, narrowly scoped, and clears the current device", async () => {
  const [route, sql, account, storage, settings] = await Promise.all([
    read("app/api/account/route.ts"), read("supabase/v7-account-lifecycle.sql"), read("components/account-gate.tsx"), read("lib/training-storage.ts"), read("components/settings-tools.tsx"),
  ]);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /supabase\.rpc\("delete_current_user"\)/);
  assert.match(sql, /security definer/i);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /revoke all[\s\S]*public, anon/i);
  assert.match(sql, /grant execute[\s\S]*authenticated/i);
  assert.match(account, /clearAccountDeviceData\(accountId\)/);
  assert.match(storage, /deleteOfflineAccount\(key\)/);
  assert.match(settings, /deleteConfirmation !== "DELETE"/);
});

test("legal controls, release source, and technique guidance ship with the app", async () => {
  const [privacy, terms, telemetry, nextConfig, packageJson, app, guidance] = await Promise.all([
    read("app/privacy/page.tsx"), read("app/terms/page.tsx"), read("lib/telemetry-shared.ts"), read("next.config.ts"), read("package.json"), read("components/training-app.tsx"), read("lib/exercise-guidance.ts"),
  ]);
  assert.match(privacy, /Delete account/);
  assert.match(terms, /at least 18/);
  assert.match(telemetry, /NEXT_PUBLIC_APP_RELEASE/);
  assert.match(nextConfig, /packageMetadata\.version/);
  assert.equal(JSON.parse(packageJson).version, "9.0.0");
  assert.match(app, /Technique guide/);
  assert.match(guidance, /sharp, sudden or worsening pain/i);
});

test("onboarding presents weighted mandatory controls and stores an overridable program track", async () => {
  const [app, training, css] = await Promise.all([read("components/training-app.tsx"), read("lib/training.ts"), read("app/globals.css")]);
  assert.match(app, /aria-required="true"/);
  assert.match(app, /Mars/);
  assert.match(app, /Venus/);
  assert.match(training, /programTrack: ProgramTrack/);
  assert.match(training, /rawProfile\.programTrack/);
  assert.match(css, /\.onboarding-choice/);
  assert.doesNotMatch(css.match(/\.onboarding-shell[\s\S]*?\}/)?.[0] ?? "", /linear-gradient/);
});
