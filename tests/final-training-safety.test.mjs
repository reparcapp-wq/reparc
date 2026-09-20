import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const c = await vite.ssrLoadModule("/lib/exercise-calibration.ts");
const a = await vite.ssrLoadModule("/lib/autoregulation.ts");
const sync = await vite.ssrLoadModule("/lib/sync-merge.ts");
const profile = { bodyweight: 75, unit: "kg", level: "experienced", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, `${actual} should equal ${expected}`);

function fixture(unit = "kg") {
  const data = { ...t.emptyData(), profile: { ...profile, unit } };
  data.program.activeId = "phase2";
  data.program.frequency = 5;
  const day = t.programDays("phase2", 5, "current")[0];
  const exercise = day.exercises.find((item) => item.sbsRole === "main");
  const planSnapshot = t.buildSessionPlanSnapshot(data, { ...day, exercises: [exercise] }, "phase2", 1, 5);
  const key = planSnapshot.exercises[0].key;
  const p = t.sbsPrescription(exercise.sbsRole, 1);
  const make = (date, base = 100, at = `${date}T10:00:00.000Z`) => ({
    id: date, logicalKey: `phase2:${date}`, date, dayId: day.id, unit,
    programId: "phase2", programWeek: 1, programFrequency: 5, planSnapshot,
    entries: { [key]: Array.from({ length: exercise.sets }, (_, i) => ({ w: String(base * p.intensity), r: String(i === exercise.sets - 1 ? p.repOutTarget + 5 : p.normalReps), rir: "0" })) },
    trainingMaxesBefore: { [key]: base }, trainingMaxesAfter: { [key]: base },
    exerciseExposures: { [key]: { policyVersion: 1, identity: t.loadProfileId(exercise), stateAtStart: "calibrated", noveltyRisk: "high", prescribedSets: exercise.sets, originalSets: exercise.sets, targetRir: 2, targetRepLow: exercise.repLow, targetRepHigh: exercise.repHigh, suggestedLoad: base * p.intensity, progressionEligible: true, startingLoadSource: "guided", relatedHistory: false } },
    completionStatus: "completed", affectsProgression: true, readiness: "normal", revision: 1, createdAt: at, startedAt: at, completedAt: at, updatedAt: at,
  });
  data.program.trainingMaxes = { [key]: 100 };
  data.sessions = [make("2026-09-01")];
  const review = (date, value, at = `${date}T09:00:00.000Z`) => ({ id: `review:${date}`, date, at, unit, values: { [key]: value } });
  return { data, key, exercise, make, review };
}

test("Phase 2 progresses only complete prescribed work at the captured load", () => {
  const { data, key } = fixture();
  near(t.recalculatePhase2Progression(data).program.trainingMaxes[key], 103);
  for (const change of [
    (s) => s.entries[key].forEach((entry) => { entry.w = "35"; }),
    (s) => { s.entries[key][0].r = "1"; },
    (s) => { s.entries[key][0].w = ""; },
    (s) => { s.entries[key].pop(); },
    (s) => { s.exerciseExposures[key].suggestedLoad = null; },
    (s) => { s.exerciseExposures[key].progressionEligible = false; },
    (s) => { s.readiness = "pain"; },
  ]) {
    const changed = structuredClone(data); change(changed.sessions[0]);
    near(t.recalculatePhase2Progression(changed).program.trainingMaxes[key], 100);
  }
  const legacy = structuredClone(data); delete legacy.sessions[0].exerciseExposures;
  near(t.recalculatePhase2Progression(legacy).program.trainingMaxes[key], 103);
});

test("Phase 2 severe linked recovery holds progression without changing logged sets", () => {
  const { data, key, exercise } = fixture();
  const original = structuredClone(data.sessions[0].entries);
  data.exerciseRecovery.push({ id: "severe", sessionId: data.sessions[0].id, exerciseIdentity: t.loadProfileId(exercise), status: "severe", createdAt: "2026-09-03T10:00:00Z", updatedAt: "2026-09-03T10:00:00Z" });
  const result = t.recalculatePhase2Progression(data);
  near(result.program.trainingMaxes[key], 100);
  assert.deepEqual(result.sessions[0].entries, original);
});

test("Phase 2 replay preserves physical loads after kg/lb display changes and repeated normalization", () => {
  for (const [from, to] of [["lb", "kg"], ["kg", "lb"]]) {
    const { data, key } = fixture(from);
    data.profile.unit = to;
    data.program.trainingMaxes[key] = t.convertWeight(100, from, to);
    data.weighIns = [{ id: "weigh-in", date: "2026-09-01", weight: 75, unit: from, createdAt: "2026-09-01T10:00:00Z", updatedAt: "2026-09-01T10:00:00Z" }];
    const normalized = t.normalizeTrainingData(data);
    assert.equal(normalized.sessions[0].unit, from);
    assert.equal(normalized.weighIns[0].unit, from);
    near(normalized.program.trainingMaxes[key], t.convertWeight(103, from, to));
    near(t.normalizeTrainingData(normalized).program.trainingMaxes[key], normalized.program.trainingMaxes[key]);
    assert.equal(normalized.sessions[0].entries[key][0].w, "70");
  }
});

test("historical editing converts all load metadata together and keeps valid rounded entries", () => {
  const { data, key } = fixture("lb");
  const original = data.sessions[0]; original.bodyweightAtSession = 180;
  const converted = t.sessionInUnit(original, "kg");
  assert.equal(original.unit, "lb");
  assert.equal(original.entries[key][0].w, "70");
  assert.equal(converted.unit, "kg");
  near(converted.trainingMaxesBefore[key], t.convertWeight(100, "lb", "kg"));
  near(converted.exerciseExposures[key].suggestedLoad, t.convertWeight(70, "lb", "kg"));
  near(converted.bodyweightAtSession, t.convertWeight(180, "lb", "kg"));
  const normalized = t.normalizeTrainingData({ ...data, sessions: [converted] });
  assert.notEqual(normalized.sessions[0].entries[key][0].w, "");
  assert.ok(Math.abs(Number(converted.entries[key][0].w) - t.convertWeight(70, "lb", "kg")) <= .005);
});

test("manual Phase 2 reviews survive replay, deletion and historical edits", () => {
  const { data, key, make, review } = fixture();
  data.program.trainingMaxReviews = [review("2026-09-02", 50)];
  near(t.recalculatePhase2Progression(data).program.trainingMaxes[key], 50);
  data.sessions[0].updatedAt = "2026-09-06T10:00:00Z";
  near(t.recalculatePhase2Progression(data).program.trainingMaxes[key], 50);
  const later = make("2026-09-03", 50); data.sessions.push(later);
  const progressed = t.recalculatePhase2Progression(data);
  near(progressed.program.trainingMaxes[key], 51.5);
  near(progressed.sessions[1].trainingMaxesBefore[key], 50);
  near(t.normalizeTrainingData(progressed).program.trainingMaxes[key], 51.5);
  later.deletedAt = "2026-09-05T10:00:00Z";
  near(t.recalculatePhase2Progression(data).program.trainingMaxes[key], 50);
});

test("multiple reviews retain intermediate review boundaries and physical local dates", () => {
  const { data, key, make, review } = fixture();
  data.program.trainingMaxReviews = [review("2026-09-02", 50), review("2026-09-04", 60)];
  data.sessions.push(make("2026-09-03", 50), make("2026-09-05", 60));
  const result = t.recalculatePhase2Progression(data);
  near(result.sessions[1].trainingMaxesBefore[key], 50);
  near(result.sessions[1].trainingMaxesAfter[key], 51.5);
  near(result.sessions[2].trainingMaxesBefore[key], 60);
  near(result.program.trainingMaxes[key], 61.8);
  near(t.normalizeTrainingData(result).sessions[1].trainingMaxesBefore[key], 50);
  const local = fixture();
  local.data.program.trainingMaxReviews = [local.review("2026-09-13", 50, "2026-09-14T01:00:00.000Z")];
  local.data.sessions.push(local.make("2026-09-13", 50, "2026-09-14T02:00:00.000Z"));
  near(t.recalculatePhase2Progression(local.data).program.trainingMaxes[local.key], 51.5);
});

test("cloud reconciliation retains independently appended review events", () => {
  const { data, key, review } = fixture();
  const local = structuredClone(data), remote = structuredClone(data);
  local.program.trainingMaxReviews = [review("2026-09-02", 50)];
  remote.program.trainingMaxReviews = [review("2026-09-04", 60)];
  const result = sync.reconcileTrainingData(local, remote, data);
  assert.equal(result.data.program.trainingMaxReviews.length, 2);
  near(result.data.program.trainingMaxes[key], 60);
  const twoWay = t.mergeTrainingData(local, remote);
  assert.equal(twoWay.program.trainingMaxReviews.length, 2);
  near(twoWay.program.trainingMaxes[key], 60);
  remote.updatedAt = "2026-09-20T10:00:00Z";
  remote.program.activeId = "phase1"; remote.program.phase2UnlockedAt = undefined; remote.program.trainingMaxReviews = undefined;
  assert.equal(t.mergeTrainingData(local, remote).program.trainingMaxReviews, undefined, "a deliberate track reset stays cleared");
});

test("Phase 2 duplicate revisions count once and never resurrect a newer deletion", () => {
  const { data, key } = fixture();
  const original = structuredClone(data.sessions[0]);
  data.sessions.push({ ...structuredClone(original), revision: 2, updatedAt: "2026-09-02T10:00:00Z" });
  const once = t.recalculatePhase2Progression(data);
  near(once.program.trainingMaxes[key], 103);
  near(t.normalizeTrainingData(once).program.trainingMaxes[key], 103);
  data.sessions[1].deletedAt = "2026-09-02T10:00:00Z";
  const deleted = t.recalculatePhase2Progression(data);
  near(deleted.program.trainingMaxes[key], 100);
  assert.equal(t.activeSessions(deleted).length, 0);
  assert.equal(deleted.sessions[1].deletedAt, "2026-09-02T10:00:00Z");
  assert.deepEqual(deleted.sessions[0], original, "obsolete raw record is not rewritten or used for progression");
  near(t.normalizeTrainingData(deleted).program.trainingMaxes[key], 100);
});

test("missing or near-failure effort cannot be hidden by the average effort", () => {
  const exercise = { ...t.programDays("phase1", 5, "current")[0].exercises[0], sets: 3 };
  for (const rirs of [[0, 3, 3], [.5, 3, 3], ["", "", 3], ["", 4, 4]]) {
    const entries = rirs.map((rir) => ({ w: "40", r: String(exercise.repHigh), rir: String(rir) }));
    const adjustment = a.nextSessionAdjustment({ exercise, entries, unit: "kg", readiness: "normal", availableLoads: [38, 40, 42] });
    assert.notEqual(adjustment.action, "increase", rirs.join(","));
    assert.notEqual(a.nextSetAdjustment({ exercise, entries, unit: "kg", readiness: "normal", availableLoads: [38, 40, 42] })?.action, "increase");
  }
});

test("ordinary symptoms hold familiarity instead of resetting an established exercise", () => {
  const data = { ...t.emptyData(), profile: { ...profile } };
  const day = t.programDays("phase1", 5, "current")[0];
  const exercise = day.exercises[0];
  const planSnapshot = t.buildSessionPlanSnapshot(data, { ...day, exercises: [exercise] });
  const key = planSnapshot.exercises[0].key;
  for (const date of ["2026-09-01", "2026-09-05", "2026-09-09", "2026-09-13"]) {
    data.sessions.push({ id: date, date, dayId: day.id, unit: "kg", programId: "phase1", planSnapshot, entries: { [key]: Array.from({ length: exercise.sets }, () => ({ w: "20", r: String(exercise.repHigh), rir: "3" })) }, completionStatus: "completed", affectsProgression: true, readiness: date === "2026-09-13" ? "symptoms" : "normal", revision: 1, createdAt: `${date}T10:00:00Z`, updatedAt: `${date}T10:00:00Z` });
  }
  assert.equal(c.exerciseCalibration(data, exercise, "2026-09-14").state, "calibrated");
  assert.equal(a.nextSessionAdjustment({ exercise, entries: data.sessions[3].entries[key], unit: "kg", readiness: "symptoms", availableLoads: [20, 21] }).action, "hold");
  // Symptoms must not hide independently recorded failure during familiarization.
  data.sessions = [data.sessions[3]];
  data.sessions[0].exerciseExposures = { [key]: { stateAtStart: "preliminary", prescribedSets: 2, targetRir: 3, progressionEligible: false } };
  data.sessions[0].entries[key][0].rir = "0";
  assert.equal(c.exerciseCalibration(data, exercise, "2026-09-14").state, "recalibration");
});

test("Phase 2 rounds downward rather than above a target on a sparse equipment ladder", () => {
  assert.equal(c.loadAtOrBelow(70, [20, 100]), 20);
  assert.equal(c.loadAtOrBelow(70, [100]), null);
});
