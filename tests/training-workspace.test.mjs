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
const editor = await vite.ssrLoadModule("/lib/load-profile-editor.ts");
const fixture = () => ({ ...t.emptyData(), profile: { displayName: "Test", bodyweight: 75, unit: "kg", level: "experienced", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true } });
const press = t.programDays("phase1", 5)[0].exercises[0];

test("equipment input sorts and deduplicates without inventing increments", () => {
  assert.deepEqual(editor.parseAvailableLoads("10, 2.5, 5, 5"), { values: [2.5, 5, 10], error: null });
  for (const input of ["", "5", "5,5", "5,-10", "5,NaN", "5,2001", "5,1.555", "5,1e2", "5,Infinity", "5,0"]) assert.ok(editor.parseAvailableLoads(input).error, input);
  assert.ok(editor.parseAvailableLoads(Array.from({ length: 101 }, (_, i) => i + 1).join(",")).error);
});

test("equipment labels distinguish assistance, bodyweight and each-side loads", () => {
  assert.match(editor.loadEntryHint({ name: "Pull-up", loadingType: "assisted-bodyweight" }), /assistance.*not your bodyweight/);
  assert.match(editor.loadEntryHint({ name: "Pull-up", loadingType: "bodyweight" }), /added external weight only/);
  assert.match(editor.loadEntryHint({ name: "Press", perSide: true }), /one side or one dumbbell/);
  assert.match(editor.loadEntryHint({ name: "Barbell press" }), /include the bar and plates/);
});

test("equipment settings include current variants and canonical saved values", () => {
  const data = fixture(); const key = t.loadProfileId(press);
  data.loadProfiles[key] = { unit: "kg", values: [5, 7.5, 10], updatedAt: "2026-09-06T00:00:00Z" };
  const choices = editor.equipmentChoices(data);
  assert.deepEqual(choices.find((item) => item.key === key).values, [5, 7.5, 10]);
  assert.equal(choices.filter((item) => item.key === key).length, 1);
  for (const name of press.alternatives) assert.ok(choices.some((item) => item.name === name), name);
});

test("canonical tombstones prevent legacy loads resurfacing in settings", () => {
  const data = fixture(); const key = t.loadProfileId(press);
  data.loadProfiles[press.id] = { unit: "kg", values: [5, 10], updatedAt: "2026-09-01T00:00:00Z" };
  data.loadProfiles[key] = { unit: "kg", values: [], updatedAt: "2026-09-06T00:00:00Z", deletedAt: "2026-09-06T00:00:00Z" };
  const choices = editor.equipmentChoices(data);
  assert.deepEqual(choices.find((item) => item.key === key).values, []);
  assert.equal(choices.some((item) => item.key === press.id), false);
});

test("conflicting legacy slot profiles stay separate, independent of property order", () => {
  const pairs = [["ua1", { unit: "kg", values: [5, 10], updatedAt: "2026-09-06T00:00:00Z" }], ["p2-incline", { unit: "kg", values: [10, 20], updatedAt: "2026-08-01T00:00:00Z" }]];
  for (const entries of [pairs, [...pairs].reverse()]) {
    const data = fixture(); data.loadProfiles = Object.fromEntries(entries);
    const choices = editor.equipmentChoices(data);
    assert.deepEqual(choices.find((item) => item.key === "ua1").values, [5, 10]);
    assert.deepEqual(choices.find((item) => item.key === "p2-incline").values, [10, 20]);
  }
});

test("load-settings display converts units without mutating stored data", () => {
  const data = fixture(); data.profile.unit = "lb"; const key = t.loadProfileId(press);
  data.loadProfiles[key] = { unit: "kg", values: [5, 10], updatedAt: "2026-09-06T00:00:00Z" };
  const before = JSON.stringify(data);
  assert.deepEqual(editor.equipmentChoices(data).find((item) => item.key === key).values, t.loadProfileValues(data.loadProfiles[key], "lb"));
  assert.equal(JSON.stringify(data), before);
});

test("swap alternatives render in the heading region with selection semantics", async () => {
  const { ExerciseSwap } = await vite.ssrLoadModule("/components/training-tools.tsx");
  const html = renderToStaticMarkup(React.createElement(ExerciseSwap, { id: "press", name: "Incline dumbbell press", options: ["Incline dumbbell press", "Machine press"], open: true, disabled: false, onToggle() {}, onSelect() {} }));
  assert.match(html, /Choose an exercise/);
  assert.match(html, /id="swap-options-press"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Machine press/);
});

test("collapsed swap retains the full exercise title and fixed-lift lock", async () => {
  const { ExerciseSwap } = await vite.ssrLoadModule("/components/training-tools.tsx");
  const html = renderToStaticMarkup(React.createElement(ExerciseSwap, { id: "press", name: "Incline dumbbell press", options: ["Machine press"], open: false, disabled: true, lockedLabel: "Fixed lift", onToggle() {}, onSelect() {} }));
  assert.match(html, /Incline dumbbell press/);
  assert.match(html, /disabled/);
  assert.doesNotMatch(html, /Machine press|swap-options-press/);
});

test("training notice closure is independent of readiness and load persistence waits for success", async () => {
  const app = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(app, /open=\{noticesOpen && view === "train"\} onOpenChange=\{setNoticesOpen\}/);
  assert.match(app, /if \(optimistic \|\| result.saved\) setData\(result.data\)/);
  assert.match(app, /"Available loads saved", "merge", false/);
  assert.match(app, /onEquipmentUpdate=\{\(next, message\) => persist\(next, message, "merge", false\)\}/);
  assert.match(app, /opener\?\.isConnected/);
  assert.match(app, /role="alert" className="train-safety/);
  assert.doesNotMatch(app, /one fewer accessory set, two to three RIR/);
});

test("new motion and fields retain accessible text sizing and reduced-motion support", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const tools = await readFile(new URL("../components/training-tools.tsx", import.meta.url), "utf8");
  assert.match(css, /@keyframes swap-reveal/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.field-label[^{]*\{[^}]*font-size: 0\.875rem/s);
  assert.match(tools, /!text-base/);
  assert.match(tools, /triggerRef\.current\?\.focus/);
  assert.match(tools, /\$\{item.key\}:\$\{unit\}/);
});
