import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ configFile: false, appType: "custom", root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const { ProgressView } = await vite.ssrLoadModule("/components/training-app.tsx");

test("Progress selects the local current date, not an older workout, including month/year boundaries", context => {
  for (const current of [new Date(2026, 8, 8, 0, 5), new Date(2026, 9, 1, 0, 5), new Date(2027, 0, 1, 0, 5)]) {
    context.mock.timers.enable({ apis: ["Date"], now: current });
    try {
      for (const withHistory of [false, true]) {
        const data = t.emptyData();
        data.profile = { displayName: "Test", bodyweight: 75, unit: "kg", level: "new", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: false };
        if (withHistory) data.sessions = [{ id: "old", date: "2026-08-01", dayId: "UA", unit: "kg", entries: {ua1:[{w:"5",r:"8",rir:"4"}]}, programId:"phase1",revision:1,createdAt:"2026-08-01T10:00:00Z",updatedAt:"2026-08-01T10:00:00Z" }];
        const before = JSON.stringify(data);
        const html = renderToStaticMarkup(React.createElement(ProgressView, { data, onUpdate: async () => true, onEditSession() {} }));
        const dateField = html.match(/<input[^>]*type="date"[^>]*>/)?.[0];
        assert.ok(dateField);
        assert.ok(dateField.includes(`value="${t.isoDate(current)}"`), dateField);
        assert.equal(JSON.stringify(data), before, "Calendar selection must not modify logs");
      }
    } finally { context.mock.timers.reset(); }
  }
});

test("manual history selection takes precedence, with a Today reset and background-date refresh", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("selectedBuckets[range] ?? currentBucketKey"));
  assert.ok(!source.includes("selectedBuckets[range] ?? reportGroups[0]"));
  assert.ok(source.includes('document.addEventListener("visibilitychange", refreshDate)'));
  assert.ok(source.includes('window.addEventListener("focus", refreshDate)'));
  assert.ok(source.includes("delete next[range]"));
});
