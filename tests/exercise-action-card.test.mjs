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
const { ExerciseActionCard } = await vite.ssrLoadModule("/components/exercise-action-card.tsx");
const exercise = { id: "row", name: "Seated cable row", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, loadingType: "external", alternatives: [] };
const entry = (w = "43", r = "8", rir = "3") => ({ w, r, rir });
const base = { exercise, entries: [], unit: "kg", adjustment: null, suggestion: { value: null, reason: "Recovery feedback is still needed.", confidence: "low" }, targetRir: 2, readiness: "normal", skipped: false, recoveryPending: true, recovering: false, onApply() {} };
function render(extra) {
  const props = { ...base, ...extra };
  const before = JSON.stringify(props);
  const html = renderToStaticMarkup(React.createElement(ExerciseActionCard, props));
  assert.equal(JSON.stringify(props), before, "Presentation must not mutate inputs");
  assert.equal((html.match(/aria-label="Exercise guidance"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /Choose load|Next session target|Next-set adjustment/);
  return html;
}

test("one actionable next-set card replaces a null session target", () => {
  const html = render({ entries: [entry(), entry(), entry("", "8", "2")], adjustment: { action: "hold", nextLoad: 43, confidence: "moderate", reason: "Keep the load stable.", evidence: ["8 reps", "3 RIR"] } });
  assert.match(html, /Next set/);
  assert.match(html, /Keep 43 kg/);
  assert.match(html, /Fill next set/);
  assert.doesNotMatch(html, /Recovery feedback is still needed/);
});

test("completion replaces advice with logged results, never relabels an old target as next workout", () => {
  const html = render({ exercise: { ...exercise, sets: 2, perSide: true }, entries: [entry("22.5", "6", "4"), entry("22.5", "6")], suggestion: { value: 99, reason: "Old target" } });
  assert.match(html, /Exercise complete/);
  assert.match(html, /Recovery check pending/);
  assert.match(html, /22.5 kg per side × 6 reps/);
  assert.match(html, /48 hours/);
  assert.doesNotMatch(html, /99|Old target|Fill next|Next set/);
});

test("first-set fallback explains absence of a number without inventing one", () => {
  assert.match(render({ suggestion: null }), /numerical starting load is not available/);
  assert.match(render({ recovering: true }), /Rebuild with a comfortable load/);
  assert.match(render({ suggestion: { value: 20, reason: "Existing recommendation" } }), /Start with 20 kg/);
});

test("safety and skipped states suppress actionable loads even when all sets are filled", () => {
  const complete = [entry(), entry(), entry()];
  const html = render({ entries: complete, readiness: "pain", suggestion: { value: 40, reason: "Target" } });
  assert.match(html, /Stop this exercise/);
  assert.doesNotMatch(html, /Exercise complete|Fill|Start with/);
  assert.match(render({ skipped: true, entries: [entry()] }), /No further sets planned/);
  assert.doesNotMatch(render({ skipped: true }), /Start light|Fill first/);
});

test("null calibration holds and decreases do not fabricate an actionable weight", () => {
  for (const action of ["hold", "decrease"]) {
    const html = render({ entries: [entry()], adjustment: { action, nextLoad: null, reason: "Keep effort comfortable.", confidence: "low", evidence: [] } });
    assert.match(html, action === "hold" ? /No automatic increase/ : /Reduce difficulty/);
    assert.doesNotMatch(html, /Fill next set/);
  }
});

test("bodyweight, assistance, units and Phase 2 retain their distinct meaning", () => {
  assert.match(render({ exercise: { ...exercise, loadingType: "assisted-bodyweight" }, unit: "lb", suggestion: { value: 30, reason: "Existing guidance" } }), /30 lb assistance/);
  assert.match(render({ exercise: { ...exercise, bodyweight: true, loadingType: "bodyweight" }, suggestion: { value: 0, reason: "Existing guidance" } }), /bodyweight only/);
  assert.match(render({ exercise: { ...exercise, loadingType: "unloaded" } }), /No external load required/);
  const html = render({ prescribed: true, entries: [entry()] });
  assert.match(html, /set-specific reps and AMRAP/);
  assert.doesNotMatch(html, /Aim for 8–12/);
});

test("recovery already checked is not called pending and missing RIR is explained", () => {
  const html = render({ recoveryPending: false, entries: [entry(), entry(), entry("43", "8", "")] });
  assert.match(html, /All working sets logged/);
  assert.match(html, /Some RIR values are missing/);
  assert.doesNotMatch(html, /Recovery check pending/);
});

test("Train uses only one guidance component and guards the fill action", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/<ExerciseActionCard /g) ?? []).length, 1);
  assert.doesNotMatch(source, /Choose load|Next session target|Next-set adjustment/);
  assert.match(source, /if \(nextSetIndex >= 0\) setField\(key, nextSetIndex/);
});
