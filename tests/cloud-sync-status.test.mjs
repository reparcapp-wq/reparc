import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ configFile: false, appType: "custom", root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
const training = await vite.ssrLoadModule("/lib/training.ts");
// Preload the shared diamond dependencies before the client storage entrypoint.
await vite.ssrLoadModule("/lib/sync-merge.ts");
await vite.ssrLoadModule("/lib/offline-store.ts");
await vite.ssrLoadModule("/lib/cloud-archive.ts");
await vite.ssrLoadModule("/lib/cloud-sync-status.ts");
const storage = await vite.ssrLoadModule("/lib/training-storage.ts");
const status = await vite.ssrLoadModule("/lib/cloud-sync-status.ts");
const { MakeupWorkoutNotice } = await vite.ssrLoadModule("/components/makeup-workout-notice.tsx");
const original = Object.fromEntries(["window", "navigator", "fetch"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let values;
let events;
let sequence = 0;
beforeEach(() => {
  values = new Map();
  events = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) },
    setTimeout, clearTimeout, dispatchEvent: (event) => events.push(event.type),
  } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
});
after(async () => {
  for (const [key, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  await vite.close();
});
const id = () => `synthetic-cloud-test-${++sequence}`;
const data = () => ({ ...training.emptyData(), weighIns: [{ id: "synthetic-weigh-in", date: "2026-10-21", weight: 72.3, unit: "kg", createdAt: "2026-10-21T02:00:00.000Z", updatedAt: "2026-10-21T02:00:00.000Z" }] });
const json = (body, code = 200, headers = {}) => new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json", ...headers } });
const local = (identity) => JSON.parse(values.get(`training-sync-meta-v1:${training.slugify(identity)}`));

test("a stale browser offline flag does not block a real successful upload or download", async () => {
  navigator.onLine = false;
  const identity = id();
  let cloud;
  let puts = 0;
  globalThis.fetch = async (_url, init) => {
    if (init?.method === "PUT") { puts++; cloud = JSON.parse(init.body).data; }
    return json({ data: cloud, revision: 1 });
  };
  const result = await storage.saveTrainingData(identity, data());
  assert.equal(result.synced, true);
  assert.equal(result.issue, undefined);
  assert.equal(puts, 1);
  assert.equal(local(identity).dirty, false);
  const loaded = await storage.loadTrainingData(identity);
  assert.equal(loaded.cloudAvailable, true);
  assert.equal(loaded.pending, false);
  assert.equal(loaded.data.weighIns[0].weight, 72.3);
});

test("validation rejection preserves the full pending record and exposes the actual reason", async () => {
  const identity = id();
  globalThis.fetch = async () => json({ error: "A load profile contains invalid values." }, 422);
  const result = await storage.saveTrainingData(identity, data());
  assert.equal(result.saved, true);
  assert.equal(result.pending, true);
  assert.equal(result.synced, false);
  assert.equal(result.issue.kind, "validation");
  assert.match(result.issue.message, /load profile/);
  assert.doesNotMatch(result.issue.message, /offline/i);
  assert.equal(local(identity).dirty, true);
  assert.equal(local(identity).data.weighIns[0].weight, 72.3);
  const loaded = await storage.loadTrainingData(identity);
  assert.equal(loaded.issue.status, 422);
  assert.equal(loaded.pending, true);
});

test("a retry uploads the existing queued data and clears pending only after confirmation", async () => {
  const identity = id();
  globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };
  const first = await storage.saveTrainingData(identity, data());
  assert.equal(first.issue.kind, "network");
  const pending = local(identity);
  globalThis.fetch = async (_url, init) => json({ data: JSON.parse(init.body).data, revision: 4 });
  const retried = await storage.syncTrainingData(identity);
  assert.equal(retried.synced, true);
  assert.equal(retried.pending, false);
  assert.equal(retried.issue, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(retried.data.weighIns)), pending.data.weighIns);
  assert.equal(local(identity).dirty, false);
  assert.equal(local(identity).serverRevision, 4);
});

test("auth, rate-limit and server failures are distinct and never falsely marked saved to cloud", async () => {
  for (const [code, kind] of [[401, "auth"], [403, "blocked"], [429, "rate-limit"], [502, "server"], [426, "update"], [413, "archive"]]) {
    const identity = id();
    globalThis.fetch = async () => json({ error: "Unavailable" }, code, { "Retry-After": "120" });
    const result = await storage.saveTrainingData(identity, data());
    assert.equal(result.issue.kind, kind);
    assert.equal(result.issue.status, code);
    assert.equal(result.pending, true);
    assert.equal(result.synced, false);
    assert.equal(local(identity).dirty, true);
    if (code === 429) assert.equal(result.issue.retryAfterSeconds, 120);
  }
  assert.ok(events.includes("my-progress-auth-required"));
});

test("a missing database migration is reported as an update, not an internet problem", async () => {
  const error = await status.cloudResponseError(json({ error: "Cloud revision protection needs updating. Your changes remain saved on this device." }, 503));
  assert.equal(error.issue.kind, "update");
  assert.match(error.issue.message, /database needs an update/);
});

test("invalid JSON errors, timeouts and unsafe detail cannot leak a raw HTML error page", async () => {
  const issue = await status.cloudResponseError(new Response("<html>private diagnostic data</html>", { status: 502 }));
  assert.doesNotMatch(issue.message, /html|private diagnostic/);
  assert.equal(status.syncIssueFromError(new DOMException("timeout", "AbortError")).kind, "network");
  assert.match(status.syncIssueFromError(new DOMException("timeout", "AbortError")).message, /timed out/);
});

test("simultaneous callers share a failed upload instead of hammering the cloud", async () => {
  const identity = id();
  globalThis.fetch = async () => json({ error: "temporarily unavailable" }, 502);
  await storage.saveTrainingData(identity, data());
  let calls = 0;
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = async () => { calls++; await blocked; return json({ error: "temporarily unavailable" }, 502); };
  const one = storage.syncTrainingData(identity);
  const two = storage.syncTrainingData(identity);
  const three = storage.syncTrainingData(identity);
  release();
  const results = await Promise.all([one, two, three]);
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result.pending && result.issue.status === 502));
  assert.equal(local(identity).data.weighIns[0].weight, 72.3);
});

test("a concurrent edit remains present after a failed in-flight upload and the next retry", async () => {
  const identity = id();
  globalThis.fetch = async () => json({}, 502);
  await storage.saveTrainingData(identity, data());
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  globalThis.fetch = async () => { await blocked; return json({}, 502); };
  const one = storage.syncTrainingData(identity);
  const modified = { ...data(), updatedAt: new Date().toISOString(), weighIns: [...data().weighIns, { id: "second-synthetic-weigh-in", date: "2026-10-22", weight: 72.4, unit: "kg", createdAt: "2026-10-22T02:00:00.000Z", updatedAt: "2026-10-22T02:00:00.000Z" }] };
  const two = storage.saveTrainingData(identity, modified);
  // Let the durable local write join the outstanding cloud attempt.
  await new Promise((resolve) => setImmediate(resolve));
  release();
  await Promise.all([one, two]);
  assert.equal(local(identity).data.weighIns.length, 2);
  globalThis.fetch = async (_url, init) => json({ data: JSON.parse(init.body).data, revision: 1 });
  const result = await storage.syncTrainingData(identity);
  assert.equal(result.data.weighIns.length, 2);
  assert.equal(result.pending, false);
});

test("make-up notice stacks on phones and keeps report date distinct from performed date", () => {
  const html = renderToStaticMarkup(React.createElement(MakeupWorkoutNotice, { scheduledDate: "Sep 2", performedDate: "Oct 21", onTrainToday() {} }));
  assert.match(html, /Make-up workout · Sep 2/);
  assert.match(html, /Report: Sep 2 · Trained: Oct 21/);
  assert.match(html, /flex-col/);
  assert.match(html, /sm:flex-row/);
  assert.match(html, /Train today instead/);
  assert.doesNotMatch(html, /privately|full report will appear/);
});

test("pending UI does not claim an offline connection or invent a count", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(source, /label: "Sync pending"/);
  assert.match(source, /Cloud sync needs attention/);
  assert.doesNotMatch(source, /Saved offline · 1 change pending|Still offline/);
  assert.match(source, /setSyncIssue\(result.issue\)/);
  assert.match(source, /setSyncIssue\(loaded.issue\)/);
});

test("an archive download rejection preserves pending local history and the server reason", async () => {
  const identity = id();
  globalThis.fetch = async () => json({}, 502);
  await storage.saveTrainingData(identity, data());
  const manifest = { format: "reparc-chunks-v1", chunks: ["a".repeat(64)], bytes: 100 };
  globalThis.fetch = async (url) => String(url).includes("/chunks") ? json({}, 429, { "Retry-After": "90" }) : json({ archive: manifest, revision: 1 });
  const loaded = await storage.loadTrainingData(identity);
  assert.equal(loaded.issue.kind, "rate-limit");
  assert.equal(loaded.issue.retryAfterSeconds, 90);
  assert.equal(loaded.pending, true);
  assert.equal(loaded.data.weighIns[0].weight, 72.3);
});

test("a cloud conflict merges both devices before retrying with the current server revision", async () => {
  const identity = id();
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const body = JSON.parse(init.body);
    if (calls === 1) return json({ data: { ...data(), weighIns: [{ ...data().weighIns[0], id: "other-device", date: "2026-10-20" }] }, revision: 7 }, 409);
    assert.equal(body.baseRevision, 7);
    return json({ data: body.data, revision: 8 });
  };
  const result = await storage.saveTrainingData(identity, data());
  assert.equal(calls, 2);
  assert.equal(result.synced, true);
  assert.deepEqual(result.data.weighIns.map((entry) => entry.id).sort(), ["other-device", "synthetic-weigh-in"]);
});

test("a failed durable local save never uploads or reports the data as saved", async () => {
  window.localStorage.setItem = () => { throw new Error("Quota exceeded"); };
  let requests = 0;
  globalThis.fetch = async () => { requests++; return json({}); };
  const result = await storage.saveTrainingData(id(), data());
  assert.equal(result.saved, false);
  assert.equal(result.synced, false);
  assert.equal(requests, 0);
});

test("a 200 response without a confirmed cloud record cannot clear the pending queue", async () => {
  const identity = id();
  globalThis.fetch = async () => json({});
  const result = await storage.saveTrainingData(identity, data());
  assert.equal(result.pending, true);
  assert.equal(result.issue.kind, "server");
  assert.match(result.issue.message, /incomplete response/);
  assert.equal(local(identity).dirty, true);
  assert.equal(local(identity).data.weighIns[0].weight, 72.3);
  const loaded = await storage.loadTrainingData(identity);
  assert.equal(loaded.pending, true);
  assert.equal(loaded.data.weighIns[0].weight, 72.3);
});

test("a write acknowledgement must advance the server revision before clearing pending", async () => {
  const identity = id();
  globalThis.fetch = async (_url, init) => json({ data: JSON.parse(init.body).data, revision: 0 });
  const result = await storage.saveTrainingData(identity, data());
  assert.equal(result.pending, true);
  assert.equal(result.synced, false);
  assert.equal(result.issue.kind, "server");
  assert.match(result.issue.message, /newer saved revision/);
  assert.equal(local(identity).dirty, true);
});
