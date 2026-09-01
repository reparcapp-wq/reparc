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
const offline = await vite.ssrLoadModule("/lib/offline-store.ts");

const session = (id, updatedAt) => ({
  id,
  date: updatedAt.slice(0, 10),
  dayId: "UA",
  unit: "kg",
  entries: {},
  revision: 1,
  createdAt: updatedAt,
  updatedAt,
});

test("a matching upload revision clears the pending marker", () => {
  const data = { ...training.emptyData(), sessions: [session("local", "2026-08-28T10:00:00.000Z")] };
  const current = {
    key: "franz",
    data,
    revision: 7,
    dirty: true,
    pendingSince: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:00:00.000Z",
  };
  const committed = offline.resolveOfflineSyncCommit("franz", current, 7, data, "2026-08-28T10:01:00.000Z");
  assert.equal(committed.dirty, false);
  assert.equal(committed.pendingSince, undefined);
  assert.equal(committed.lastSyncedAt, "2026-08-28T10:01:00.000Z");
});

test("a newer local edit stays pending and is merged after an older upload completes", () => {
  const local = { ...training.emptyData(), sessions: [session("new-local", "2026-08-28T10:02:00.000Z")] };
  const remote = { ...training.emptyData(), sessions: [session("uploaded", "2026-08-28T10:00:00.000Z")] };
  const current = {
    key: "franz",
    data: local,
    revision: 8,
    dirty: true,
    pendingSince: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-08-28T10:02:00.000Z",
  };
  const committed = offline.resolveOfflineSyncCommit("franz", current, 7, remote, "2026-08-28T10:03:00.000Z");
  assert.equal(committed.dirty, true);
  assert.equal(committed.revision, 8);
  assert.equal(committed.pendingSince, current.pendingSince);
  assert.deepEqual(committed.data.sessions.map((item) => item.id), ["uploaded", "new-local"]);
});

test("server revisions survive local edits and advance only after a confirmed cloud write", () => {
  const data = training.emptyData();
  const clean = { key: "franz", data, revision: 4, serverRevision: 12, dirty: false, updatedAt: "2026-09-02T10:00:00.000Z" };
  const pending = offline.nextPendingOfflineRecord("franz", clean, { ...data, updatedAt: "2026-09-02T10:01:00.000Z" }, "merge", "2026-09-02T10:01:00.000Z");
  assert.equal(pending.serverRevision, 12);
  const committed = offline.resolveOfflineSyncCommit("franz", pending, pending.revision, pending.data, "2026-09-02T10:02:00.000Z", 13);
  assert.equal(committed.serverRevision, 13);
  assert.equal(committed.dirty, false);
});

test("the service worker caches the app shell but never intercepts the training API", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /request\.mode === "navigate"/);
  assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(source, /url\.pathname\.startsWith\("\/_next\/static\/"\)/);
  assert.doesNotMatch(source, /method !== "GET"\)\s*event\.respondWith/);
});
