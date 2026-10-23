import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ configFile: false, appType: "custom", root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const c = await vite.ssrLoadModule("/lib/exercise-calibration.ts");
const h = await vite.ssrLoadModule("/lib/history-start.ts");
const a = await vite.ssrLoadModule("/lib/autoregulation.ts");
const { ExerciseActionCard } = await vite.ssrLoadModule("/components/exercise-action-card.tsx");
const date = "2026-10-20";
const now = `${date}T02:00:00Z`;
const row = { id: "row", name: "Seated cable row", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, loadingType: "external", alternatives: [] };
function fixture(exercise = row, { sourceDate = "2026-09-20", load = "40", reps = "10", rir = "4", unit = "kg", bodyweight = 70, count = 3 } = {}) {
  const data = { ...t.emptyData(), profile: { displayName: "Synthetic", bodyweight: 70, unit: "kg", level: "experienced", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "bulk", weightTrackingEnabled: true } };
  data.program.calibrationRequired = true;
  data.program.returnPlan = t.buildReturnPlan(30, "planned", now);
  const day = { id: "D1", name: "Synthetic", focus: "Test", weekday: 1, lower: false, exercises: [exercise] };
  // Build directly: synthetic IDs intentionally do not need catalog fallbacks.
  const snapshot = { ...t.buildSessionPlanSnapshot(data, day), exercises: [{ ...exercise, key: exercise.id }] };
  data.sessions = [{ id: "prior", date: sourceDate, dayId: "D1", unit, entries: { [exercise.id]: Array.from({ length: count }, () => ({ w: load, r: reps, rir })) },
    planSnapshot: snapshot, bodyweightAtSession: bodyweight, readiness: "normal", completionStatus: "completed", revision: 1, createdAt: `${sourceDate}T02:00:00Z`, updatedAt: `${sourceDate}T02:00:00Z` }];
  return { data, exercise };
}
function recommend(f, patch = {}) {
  return h.historyStartingSuggestion({ data: f.data, exercise: f.exercise, date, unit: "kg", calibration: c.exerciseCalibration(f.data, f.exercise, date),
    targetReps: f.exercise.repLow, targetRir: 4, availableLoads: [10, 20, 25, 30, 35, 40, 45, 50], readiness: "normal", ...patch });
}
function card(f, suggestion, extra = {}) {
  return renderToStaticMarkup(React.createElement(ExerciseActionCard, { exercise: f.exercise, entries: [], unit: "kg", adjustment: null, suggestion,
    targetRir: 4, readiness: "normal", skipped: false, recoveryPending: true, recovering: true, onApply() {}, ...extra }));
}

test("month-return load comes from the matching record and applies the stricter factor exactly once", () => {
  const f = fixture();
  const before = JSON.stringify(f.data);
  const suggestion = recommend(f);
  assert.equal(suggestion.value, 30, "40 × .85 = 34, rounded down to 30, not multiplied by .85 again");
  assert.equal(suggestion.startReps, 8);
  assert.match(suggestion.historyReference, /40 kg × 10 reps/);
  assert.match(suggestion.reason, /stop earlier/);
  assert.equal(c.returnWorkoutSuggestion(suggestion, f.data.program.returnPlan, undefined, [10, 20, 25, 30, 35, 40], false), suggestion);
  assert.equal(JSON.stringify(f.data), before);
  assert.match(card(f, suggestion), /Try 30 kg × 8 reps/);
  assert.match(card(f, suggestion), /Previous first set/);
  assert.match(card(f, suggestion), /Fill first set/);
});

test("a low-rep record supplies a warm-up rehearsal, never a fabricated higher-rep working prescription", () => {
  const squat = { ...row, id: "squat", name: "Barbell squat", sbsRole: "main", repLow: 10, repHigh: 10 };
  const f = fixture(squat, { load: "50", reps: "5" });
  const suggestion = recommend(f);
  assert.equal(suggestion.value, null);
  assert.equal(suggestion.rehearsal.value, 40);
  assert.equal(suggestion.rehearsal.reps, 5);
  const html = card(f, suggestion, { prescribed: true });
  assert.match(html, /First working set/);
  assert.match(html, /10 reps · 4\+ reps left/);
  assert.match(html, /Weight not yet established/);
  assert.match(html, /Optional warm-up/);
  assert.match(html, /Warm-up reference: 40 kg/);
  assert.match(html, /Up to 5 easy reps · not a working set/);
  assert.match(html, /today calls for 10/);
  assert.doesNotMatch(html, /Fill first set|Try 40 kg × 10/);
});

test("screenshot case: 25 per side at six reps after 38 days yields only a separate 20-per-side rehearsal", () => {
  const press = { ...row, id: "press", name: "Incline dumbbell press", perSide: true, sets: 1, repLow: 12, repHigh: 12 };
  const f = fixture(press, { sourceDate: "2026-09-15", load: "25", reps: "6", rir: "2" });
  f.data.program.returnPlan = t.buildReturnPlan(38, "planned", "2026-10-23T01:00:00Z");
  const before = JSON.stringify(f.data);
  const suggestion = recommend(f, { date: "2026-10-23", targetReps: 12, availableLoads: [10, 15, 20, 22.5, 25] });
  assert.equal(suggestion.value, null, "Six reps cannot establish a twelve-rep working weight");
  assert.equal(suggestion.startReps, 12);
  assert.equal(suggestion.rehearsal.value, 20, "25 × .85 = 21.25, rounded down once to 20 per side");
  assert.equal(suggestion.rehearsal.reps, 5, "min(5, 6, 12), not today's working reps");
  assert.match(suggestion.historyReference, /38 days ago/);
  const html = card(f, suggestion, { prescribed: true });
  const [working, warmup] = html.split('</section>');
  assert.match(working, /12 reps · 4\+ reps left/);
  assert.match(working, /Weight not yet established/);
  assert.doesNotMatch(working, /20 kg|5 easy reps|Fill first set/);
  assert.match(warmup, /Warm-up reference: 20 kg per side/);
  assert.match(warmup, /Up to 5 easy reps/);
  assert.doesNotMatch(warmup, /<details[^>]*\sopen(?:\s|=|>)/);
  assert.equal(JSON.stringify(f.data), before);
});

test("successive comfortable protected sessions do not repeatedly discount an already reduced weight", () => {
  const f = fixture(row, { sourceDate: "2026-10-19", load: "30", reps: "8", rir: "4", count: 2 });
  f.data.program.returnPlan.startedAt = "2026-10-18T02:00:00Z";
  f.data.sessions[0].exerciseExposures = { row: { identity: t.loadProfileId(row), prescribedSets: 2, targetRir: 4, progressionEligible: false, stateAtStart: "developing", policyVersion: 1 } };
  assert.equal(recommend(f).value, 30, "Repeat the comfortable return weight rather than 30 × .85 again");
  assert.match(recommend(f).reason, /repeat the recent comfortable/);
  f.data.sessions[0].entries.row[0].rir = "2";
  assert.equal(recommend(f).value, 25, "A set harder than today's target does not earn the comfortable-repeat exception");
  f.data.sessions[0].entries.row[0].rir = "4";
  f.data.program.returnPlan.startedAt = "2026-10-20T02:00:00Z";
  assert.equal(recommend(f).value, 25, "A separately started return plan does not reuse a pre-plan protected weight unchanged");
});

test("missing effort, partial exposure and near-failure history cannot become a working-load suggestion", () => {
  for (const options of [{ rir: "" }, { count: 1 }, { rir: "0" }, { rir: "1" }]) {
    const f = fixture(row, options);
    const suggestion = recommend(f);
    assert.equal(suggestion.value, null);
    assert.ok(suggestion.rehearsal);
    assert.doesNotMatch(card(f, suggestion), /Fill first set/);
  }
});

test("adverse or stopped history blocks automatic weights even after a later green answer", () => {
  for (const flag of ["recovery", "pain", "severe-soreness", "skipped"]) {
    const f = fixture();
    if (flag === "recovery") f.data.exerciseRecovery = ["severe", "recovered"].map((status, i) => ({ id: String(i), sessionId: "prior", exerciseIdentity: t.loadProfileId(row), status, createdAt: now, updatedAt: now }));
    else if (flag === "skipped") f.data.sessions[0].skippedExerciseKeys = [row.id];
    else f.data.sessions[0].readiness = flag;
    const suggestion = recommend(f);
    assert.equal(suggestion.value, null);
    assert.equal(suggestion.blocked, true);
    assert.match(card(f, suggestion), /Stop this exercise/);
    assert.doesNotMatch(card(f, suggestion), /Fill first set|Warm-up rehearsal/);
  }
});

test("old, future and deleted records do not invent fresh confidence or resurrect deleted history", () => {
  const old = fixture(row, { sourceDate: "2026-01-01" });
  assert.equal(recommend(old).value, null);
  assert.equal(recommend(old).rehearsal, undefined);
  assert.match(recommend(old).reason, /too old/);
  const future = fixture(row, { sourceDate: "2026-10-21" });
  assert.equal(recommend(future), null);
  const deleted = fixture(); deleted.data.sessions[0].deletedAt = now;
  assert.equal(recommend(deleted), null);
  const empty = fixture(); empty.data.sessions = [];
  assert.equal(recommend(empty), null);
});

test("kg/lb conversion and per-side display never double the recommended dumbbell weight", () => {
  const f = fixture();
  const pounds = recommend(f, { unit: "lb", availableLoads: [50, 60, 70, 75, 80] });
  assert.equal(pounds.value, 70);
  assert.match(pounds.historyReference, /88.2 lb/);
  const db = fixture({ ...row, name: "Incline dumbbell press", perSide: true, repLow: 6 }, { load: "10" });
  const suggestion = recommend(db, { availableLoads: [5, 7.5, 8, 10] });
  assert.equal(suggestion.value, 8);
  assert.match(card(db, suggestion), /8 kg per side/);
});

test("unknown equipment gives a clearly labelled ceiling and no invented selectable weight", () => {
  const f = fixture();
  const suggestion = recommend(f, { availableLoads: [] });
  assert.equal(suggestion.value, null);
  assert.equal(suggestion.loadBound, "at most 34 kg");
  assert.match(card(f, suggestion), /Starting limit: at most 34 kg/);
  assert.doesNotMatch(card(f, suggestion), /Fill first set/);
  assert.equal(recommend(f, { availableLoads: [0] }).value, null, "External-load zero cannot create an invalid set");
});

test("assisted exercise return targets add assistance and round in the easier direction", () => {
  const assisted = { ...row, name: "Assisted pull-up", loadingType: "assisted-bodyweight" };
  const f = fixture(assisted, { load: "20", bodyweight: 70 });
  const suggestion = recommend(f, { availableLoads: [10, 20, 25, 30, 35, 40] });
  // 70 - (70 - 20) × .85 = at least 27.5 assistance, rounded UP to 30.
  assert.equal(suggestion.value, 30);
  assert.match(card(f, suggestion), /30 kg assistance/);
  assert.equal(recommend(f, { availableLoads: [] }).loadBound, "at least 27.5 kg assistance");
  delete f.data.sessions[0].bodyweightAtSession;
  assert.equal(recommend(f).value, null);
  assert.match(recommend(f).reason, /no usable bodyweight/);
});

test("weighted bodyweight suggestions use stored session bodyweight, never today's bodyweight as the past", () => {
  const pullup = { ...row, name: "Pull-up", loadingType: "bodyweight", bodyweight: true };
  const f = fixture(pullup, { load: "30", bodyweight: 70 });
  const suggestion = recommend(f, { availableLoads: [5, 10, 15, 20, 30] });
  assert.equal(suggestion.value, 15, "(70+30) × .85 - 70 = 15 added");
  f.data.profile.bodyweight = 90;
  assert.equal(recommend(f).value, null, "Bodyweight alone can exceed the reduced target");
  assert.match(recommend(f).reason, /bodyweight alone/);
});

test("canonical matching follows prior swaps but never transfers weights between different exercises", () => {
  const pec = { ...row, id: "old-pec-slot", name: "Pec deck" };
  const f = fixture(pec);
  const equivalent = recommend(f, { exercise: { ...pec, id: "new-pec-slot" } });
  assert.equal(equivalent.value, 30);
  assert.equal(recommend(f, { exercise: { ...row, name: "Machine chest press" } }), null);
});

test("a large unexplained jump in recent external loads is reference-only, not an automatic heavy target", () => {
  const f = fixture(row, { load: "100" });
  for (const priorDate of ["2026-09-10", "2026-09-15"]) f.data.sessions.push({ ...f.data.sessions[0], id: priorDate, date: priorDate,
    createdAt: `${priorDate}T02:00:00Z`, updatedAt: `${priorDate}T02:00:00Z`, entries: { row: Array.from({ length: 3 }, () => ({ w: "40", r: "10", rir: "4" })) } });
  const suggestion = recommend(f);
  assert.equal(suggestion.value, null);
  assert.equal(suggestion.rehearsal, undefined);
  assert.match(suggestion.reason, /Check units/);
});

test("both tracks and phases retain prescribed sets, history, maxes and return counters", () => {
  for (const programId of ["phase1", "phase2"]) for (const track of ["current", "women"]) {
    const f = fixture();
    f.data.profile.programTrack = track;
    f.data.program.activeId = programId;
    f.data.program.trainingMaxes = { main: 100 };
    const before = JSON.stringify(f.data);
    assert.equal(recommend(f).value, 30);
    assert.equal(JSON.stringify(f.data), before);
  }
});

test("protected next sets keep the observed load, do not increase at 4 RIR, and reduce excessive effort", () => {
  const input = { exercise: row, unit: "kg", readiness: "normal", availableLoads: [20, 25, 30, 35, 40], targetRir: 4, allowIncrease: false };
  assert.equal(a.nextSetAdjustment({ ...input, entries: [{ w: "30", r: "8", rir: "4" }] }).nextLoad, 30);
  assert.equal(a.nextSetAdjustment({ ...input, entries: [{ w: "30", r: "8", rir: "4" }] }).action, "hold");
  const harder = a.nextSetAdjustment({ ...input, entries: [{ w: "30", r: "8", rir: "1" }] });
  assert.equal(harder.action, "decrease");
  assert.equal(harder.nextLoad, 25);
  const unknown = a.nextSetAdjustment({ ...input, entries: [{ w: "30", r: "8", rir: "" }] });
  assert.equal(unknown.action, "hold");
  assert.equal(unknown.confidence, "low");
});

test("assisted next-set and next-session direction and resistance-step limits are correct", () => {
  const exercise = { ...row, loadingType: "assisted-bodyweight" };
  const input = { exercise, unit: "kg", readiness: "normal", availableLoads: [10, 20, 25, 30, 35, 40], bodyweight: 70 };
  assert.equal(a.nextSetAdjustment({ ...input, entries: [{ w: "30", r: "5", rir: "0" }] }).nextLoad, 35);
  const protectedSet = a.nextSetAdjustment({ ...input, entries: [{ w: "30", r: "8", rir: "5" }], targetRir: 4, allowIncrease: false });
  assert.equal(protectedSet.nextLoad, 30);
  assert.equal(protectedSet.action, "hold");
  const full = Array.from({ length: 3 }, () => ({ w: "30", r: "12", rir: "3" }));
  assert.equal(a.nextSessionAdjustment({ ...input, entries: full }).action, "hold", "5 kg step on 40 kg effective resistance exceeds 10%");
  assert.equal(a.nextSessionAdjustment({ ...input, availableLoads: [27.5, 30, 35], entries: full }).nextLoad, 27.5);
  assert.equal(a.nextSessionAdjustment({ ...input, bodyweight: undefined, entries: full }).action, "hold");
  const failed = full.map((entry) => ({ ...entry, r: "5", rir: "0" }));
  assert.equal(a.nextSessionAdjustment({ ...input, entries: failed }).nextLoad, 35);
});

test("capture and UI share the finalized suggestion and do not automatically fill actual reps or effort", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(source, /const suggested = finalSuggestionFor\(resolved, item.key\)/);
  assert.match(source, /finalSuggestionFor\(resolved, key\)/);
  assert.match(source, /const suggestion = finalSuggestionFor\(exercise, key\)/);
  assert.doesNotMatch(source, /suggested \* data.program.returnPlan.loadFactor/);
  assert.match(source, /if \(!editingSession && \(prescription\?\.calibration/);
  assert.match(source, /onApply=\{\(load\) => \{ if \(nextSetIndex >= 0\) setField\(key, nextSetIndex, "w"/);
});
