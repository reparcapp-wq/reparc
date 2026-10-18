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
const c = await vite.ssrLoadModule("/lib/exercise-calibration.ts");
const { ExerciseActionCard } = await vite.ssrLoadModule("/components/exercise-action-card.tsx");
const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");

function fixture() {
  const data = { ...t.emptyData(), profile: { displayName: "Synthetic", bodyweight: 75, unit: "kg", level: "experienced", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "bulk", weightTrackingEnabled: true } };
  data.program.activeId = "phase2";
  data.program.week = 3;
  const originalDay = t.programDays("phase2", 5)[0];
  const exercise = originalDay.exercises.find((item) => item.sbsRole === "main");
  const day = { ...originalDay, exercises: [exercise] };
  const snapshot = t.buildSessionPlanSnapshot(data, day, "phase2", 3, 5);
  const key = snapshot.exercises[0].key;
  data.sessions = ["2026-09-07", "2026-09-11", "2026-09-15"].map((date) => ({
    id: date, date, dayId: day.id, programId: "phase2", programWeek: 3, unit: "kg", planSnapshot: snapshot,
    entries: { [key]: Array.from({ length: exercise.sets }, () => ({ w: "50", r: String(exercise.repLow), rir: "4" })) },
    completionStatus: "completed", affectsProgression: true, revision: 1,
    createdAt: `${date}T02:00:00Z`, updatedAt: `${date}T02:00:00Z`, completedAt: `${date}T02:00:00Z`,
  }));
  data.program.calibrationRequired = true;
  data.program.returnPlan = t.buildReturnPlan(34, "planned", "2026-10-19T02:00:00Z");
  const calibration = c.exerciseCalibration(data, exercise, "2026-10-19");
  const plan = c.buildExposurePlan(data, day, "2026-10-19", (item) => item);
  const exposure = plan.exposures[exercise.id];
  return { data, exercise, key, calibration, exposure, plan };
}

test("month-return Phase 2 first-set text matches the effective four-reps-left target", () => {
  const f = fixture();
  const before = JSON.stringify(f.data);
  assert.equal(f.calibration.targetRir, 2);
  assert.equal(f.exposure.targetRir, 4);
  assert.equal(f.exposure.progressionEligible, false);
  assert.equal(f.plan.day.exercises[0].sets, 3);
  const guidance = c.calibrationForGuidance(f.calibration, f.exposure);
  assert.equal(guidance.targetRir, 4);
  // Read the actual presentation template; no dynamic code execution in tests.
  const template = source.match(/if \(prescription.calibration\) return \{ value: null, tag: "estimate", reason: `([^`]+)`/);
  assert.ok(template, "Phase 2 calibration must not invent a numeric starting load");
  const suggestion = { value: null, reason: template[1].replace("${calibration.targetRir}", String(guidance.targetRir)) };
  const html = renderToStaticMarkup(React.createElement(ExerciseActionCard, {
    exercise: f.plan.day.exercises[0], entries: [], unit: "kg", adjustment: null, suggestion,
    targetRir: f.exposure.targetRir, readiness: "normal", skipped: false, recoveryPending: true,
    recovering: true, prescribed: true, onApply() {},
  }));
  assert.match(html, /at least 4 good reps left/);
  assert.doesNotMatch(html, /at least 2 good reps|Fill first set/);
  assert.equal(JSON.stringify(f.data), before, "Rendering guidance must preserve history and program state");
  assert.equal(f.calibration.targetRir, 2, "Do not mutate calibration or its rules");
});

test("Train wires every starting-effort message to effective guidance and preserves recalibration priority", () => {
  const f = fixture();
  const suggestionSource = source.slice(source.indexOf("const suggestionFor ="), source.indexOf("const startRestTimer ="));
  assert.match(suggestionSource, /const calibration = calibrationForGuidance\(currentCalibration, capturedExposure\)/);
  assert.equal((suggestionSource.match(/\$\{calibration.targetRir\}/g) ?? []).length, 4, "Phase 2, recalibration, bodyweight and first-exposure wording share the effective target");
  assert.doesNotMatch(suggestionSource, /\$\{currentCalibration.targetRir\}/);
  assert.match(source, /returnWorkoutSuggestion\(baseSuggestion, data.program.returnPlan, exposure, availableLoads, Boolean\(editingSession\)\)/);
  assert.match(source, /or more if the exercise shows a higher target/, "The general return notice must not override stricter exercise targets");
  const calibration = { ...f.calibration, state: "recalibration", targetRir: 3 };
  const guidance = c.calibrationForGuidance(calibration, f.exposure);
  assert.equal(guidance.targetRir, 4);
  assert.equal(guidance.state, "recalibration");
  assert.equal(guidance.recoveryPending, true);
  assert.equal(calibration.targetRir, 3);
});

test("calibration decrease text changes effort wording without changing the load calculation", () => {
  const f = fixture();
  const adjustment = { action: "decrease", nextLoad: 40, reason: "Reduce the load.", confidence: "moderate", evidence: [] };
  const result = c.constrainCalibrationAdjustment(adjustment, c.calibrationForGuidance(f.calibration, f.exposure));
  assert.equal(result.nextLoad, 40);
  assert.match(result.reason, /at least 4 good reps left/);
  assert.equal(adjustment.reason, "Reduce the load.");
});

test("missing exposure falls back as before and historical targets do not borrow today's return target", () => {
  const f = fixture();
  for (const [exposure, expected] of [[undefined, 2], [{ progressionEligible: false, stateAtStart: "developing" }, 2], [{ ...f.exposure, targetRir: 3 }, 3]]) {
    const guidance = c.calibrationForGuidance(f.calibration, exposure);
    assert.equal(guidance.targetRir, expected);
  }
});

test("numeric return guidance keeps the stricter exercise target and identical downward load rounding", () => {
  const f = fixture();
  f.data.program.returnPlan = t.buildReturnPlan(20, "planned", "2026-10-19T02:00:00Z");
  assert.equal(f.data.program.returnPlan.targetRir, 3);
  const baseSuggestion = { value: 50, tag: "hold", reason: "Starting weight" };
  const suggestion = c.returnWorkoutSuggestion(baseSuggestion, f.data.program.returnPlan, f.exposure, [20, 40, 50], false);
  assert.equal(suggestion.value, 40);
  assert.match(suggestion.reason, /about 4 good reps left/);
  const fallback = c.returnWorkoutSuggestion(baseSuggestion, f.data.program.returnPlan, undefined, [20, 40, 50], false);
  assert.match(fallback.reason, /about 3 good reps left/);
  const historical = c.returnWorkoutSuggestion(baseSuggestion, f.data.program.returnPlan, f.exposure, [20, 40, 50], true);
  assert.equal(historical, baseSuggestion);
  assert.equal(c.returnWorkoutSuggestion(baseSuggestion, undefined, f.exposure, [], false), baseSuggestion);
  assert.equal(c.returnWorkoutSuggestion(null, f.data.program.returnPlan, f.exposure, [], false), null);
  const bodyweight = { ...baseSuggestion, value: 0 };
  assert.equal(c.returnWorkoutSuggestion(bodyweight, f.data.program.returnPlan, f.exposure, [], false), bodyweight);
});
