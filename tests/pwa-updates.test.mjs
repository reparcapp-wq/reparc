import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production builds stamp a source-derived service-worker release", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const script = await readFile(new URL("../scripts/prepare-service-worker.mjs", import.meta.url), "utf8");
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

  assert.match(packageJson.scripts.prebuild, /prepare:pwa/);
  assert.match(packageJson.scripts["prebuild:netlify"], /prepare:pwa/);
  assert.match(script, /createHash\("sha256"\)/);
  assert.doesNotMatch(worker, /BUILD_ID = "pending"/);
  assert.match(worker, /CACHE_NAME = `reparc-shell-\$\{BUILD_ID\}`/);
});

test("the app rechecks for a release without requiring sign-out", async () => {
  const hook = await readFile(new URL("../hooks/use-pwa.ts", import.meta.url), "utf8");
  const gate = await readFile(new URL("../components/account-gate.tsx", import.meta.url), "utf8");

  assert.match(hook, /window\.addEventListener\("focus", checkWhenActive\)/);
  assert.match(hook, /document\.addEventListener\("visibilitychange", checkWhenActive\)/);
  assert.match(hook, /window\.addEventListener\("online", checkWhenOnline\)/);
  assert.match(hook, /setInterval\(checkForUpdate, UPDATE_CHECK_INTERVAL_MS\)/);
  assert.match(hook, /registration\.update\(\)/);
  assert.match(hook, /updateViaCache: "none"/);
  assert.match(gate, /No sign-out needed/);
  assert.match(gate, /Update now/);
});
