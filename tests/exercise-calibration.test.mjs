import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const c = await vite.ssrLoadModule("/lib/exercise-calibration.ts");
const reports = await vite.ssrLoadModule("/lib/daily-report.ts");
const backup = await vite.ssrLoadModule("/lib/backup.ts");
const fixture = () => ({ ...t.emptyData(), profile: { displayName: "Test", bodyweight: 75, unit: "kg", level: "experienced", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true } });
const baseDay = t.programDays("phase1", 5)[0];
const press = baseDay.exercises[0];
const resolve = (exercise) => t.resolveExerciseVariant(exercise, exercise.defaultVariant ?? exercise.name);
function addExposure(data, date, exercise = press, { legacy = false, recovery, rir = "4", reps, full = true, override = false } = {}) {
  const base = { ...baseDay, exercises: [exercise] };
  const plan = c.buildExposurePlan(data, base, date, resolve);
  const day = legacy ? base : plan.day;
  const snapshot = t.buildSessionPlanSnapshot(data, day);
  const key = snapshot.exercises[0].key;
  const id = `${date}:${exercise.id}`;
  const at = `${date}T10:00:00.000Z`;
  const exposure = legacy ? undefined : { [key]: { ...plan.exposures[exercise.id], startingLoadSource: override ? "user" : "guided" } };
  const session = { id, date, dayId: day.id, unit: "kg", programId: "phase1", planSnapshot: snapshot, exerciseExposures: exposure,
    entries: { [key]: Array.from({ length: full ? snapshot.exercises[0].sets : 1 }, () => ({ w: "20", r: String(reps ?? exercise.repLow), rir })) },
    completionStatus: "completed", affectsProgression: true, revision: 1, createdAt: at, updatedAt: at, completedAt: at };
  data.sessions.push(session);
  if (recovery) addRecovery(data, session, resolve(exercise), recovery);
  return session;
}
function addRecovery(data, session, exercise, status = "recovered", hours = 72) {
  const at = new Date(Date.parse(session.completedAt) + hours * 3_600_000).toISOString();
  data.exerciseRecovery.push({ id: `r:${data.exerciseRecovery.length}`, sessionId: session.id, exerciseIdentity: t.loadProfileId(exercise), status, createdAt: at, updatedAt: at });
}

test("every track and experience starts unfamiliar exercises with reduced volume", () => {
  for (const track of ["current", "women"]) for (const frequency of [3, 4, 5]) for (const level of ["new", "experienced"]) {
    const data = fixture(); data.profile.level = level;
    for (const day of t.programDays("phase1", frequency, track)) {
      const plan = c.buildExposurePlan(data, day, "2026-09-06", resolve);
      assert.ok(plan.day.exercises.length > 0);
      assert.ok(plan.day.exercises.every((item) => item.sets === 1));
      const snapshot = t.buildSessionPlanSnapshot(data, plan.day);
      assert.ok(snapshot.exercises.every((item) => item.sets === 1), "snapshot/restore must not reinstate the catalog's full set count");
      assert.ok(t.trainingDayFromSnapshot(snapshot).exercises.every((item) => item.sets === 1));
      assert.ok(plan.noveltyUnits <= 6);
      assert.ok(Object.values(plan.exposures).every((item) => item.targetRir === 4 && !item.progressionEligible));
    }
  }
});

test("three full legacy exposures preserve established history; partial and failed logs do not", () => {
  const data = fixture();
  for (const date of ["2026-08-01", "2026-08-05", "2026-08-09"]) addExposure(data, date, press, { legacy: true });
  assert.equal(c.exerciseCalibration(data, press, "2026-08-12").state, "calibrated");
  const partial = fixture();
  for (const date of ["2026-08-01", "2026-08-05", "2026-08-09"]) addExposure(partial, date, press, { legacy: true, full: false });
  assert.notEqual(c.exerciseCalibration(partial, press, "2026-08-12").state, "calibrated");
  addExposure(data, "2026-08-11", press, { legacy: true, rir: "0" });
  assert.equal(c.exerciseCalibration(data, press, "2026-08-12").state, "recalibration");
});

test("three comparable green exposures promote per exercise, with missing feedback holding", () => {
  const data = fixture();
  addExposure(data, "2026-08-01", press, { recovery: "recovered" });
  assert.equal(c.exerciseCalibration(data, press, "2026-08-05").state, "preliminary");
  addExposure(data, "2026-08-05", press, { recovery: "mild" });
  assert.equal(c.exerciseCalibration(data, press, "2026-08-09").state, "developing");
  const third = addExposure(data, "2026-08-09");
  assert.equal(c.exerciseCalibration(data, press, "2026-08-13").state, "developing");
  addRecovery(data, third, press);
  assert.equal(c.exerciseCalibration(data, press, "2026-08-13").state, "calibrated");
});

test("early green reports remain pending and adverse recovery cannot be erased by a later green response", () => {
  const data = fixture(); const session = addExposure(data, "2026-08-01");
  addRecovery(data, session, press, "recovered", 12);
  assert.equal(c.exerciseCalibration(data, press, "2026-08-05").recoveryPending, true);
  addRecovery(data, session, press, "limiting", 48);
  addRecovery(data, session, press, "recovered", 96);
  assert.equal(c.exerciseCalibration(data, press, "2026-08-06").state, "recalibration");
});

test("an unsuccessful exposure breaks the promotion streak", () => {
  const data = fixture();
  addExposure(data, "2026-08-01", press, { recovery: "recovered" });
  addExposure(data, "2026-08-05", press, { recovery: "recovered", reps: 1 });
  addExposure(data, "2026-08-09", press, { recovery: "recovered" });
  assert.equal(c.exerciseCalibration(data, press, "2026-08-13").state, "preliminary");
});

test("a 30-day gap cannot regain established status after one unchecked session; 56 days recalibrates", () => {
  const data = fixture();
  for (const date of ["2026-01-01", "2026-01-05", "2026-01-10"]) addExposure(data, date, press, { legacy: true });
  assert.equal(c.exerciseCalibration(data, press, "2026-02-09").state, "developing");
  addExposure(data, "2026-02-09");
  assert.equal(c.exerciseCalibration(data, press, "2026-02-10").state, "developing");
  assert.equal(c.exerciseCalibration(data, press, "2026-04-06").state, "recalibration");
});

test("same exercise across a swap shares confidence, while related lifts never transfer load history", () => {
  const data = fixture();
  for (const date of ["2026-08-01", "2026-08-05", "2026-08-09"]) addExposure(data, date, press, { legacy: true });
  const same = { ...press, id: "different-slot" };
  assert.equal(c.exerciseCalibration(data, same, "2026-08-13").state, "calibrated");
  const machine = t.resolveExerciseVariant(press, "Machine chest press");
  const calibration = c.exerciseCalibration(data, machine, "2026-08-13");
  assert.equal(calibration.state, "uncalibrated");
  assert.equal(calibration.relatedHistory, true);
  assert.equal(t.comparableExerciseHistory(data, machine).length, 0);
  assert.equal(c.calibrationSetCount(3, calibration), 2);
});

test("return and novelty volume restrictions apply once, with downward equipment rounding", () => {
  const data = fixture();
  data.program.returnPlan = t.buildReturnPlan(40, "planned", "2026-08-01T00:00:00Z");
  const day = { ...baseDay, exercises: [press] };
  const plan = c.buildExposurePlan(data, day, "2026-08-05", resolve);
  assert.equal(plan.day.exercises[0].sets, 1);
  assert.equal(plan.exposures[press.id].targetRir, 4);
  assert.equal(c.loadAtOrBelow(8.5, [5, 10]), 5);
  assert.equal(c.loadAtOrBelow(2, [5, 10]), null);
});

test("novelty budget visibly defers work; override keeps reduced sets; unseen movements get a turn", () => {
  const data = fixture();
  const day = { ...baseDay, exercises: Array.from({ length: 8 }, (_, index) => ({ ...press, id: `x${index}`, name: `Unknown movement ${index}`, sets: 3 })) };
  const plan = c.buildExposurePlan(data, day, "2026-08-05", resolve);
  assert.ok(plan.deferred.length > 0);
  const override = c.buildExposurePlan(data, day, "2026-08-05", resolve, true);
  assert.equal(override.day.exercises.length, 8);
  assert.ok(override.day.exercises.every((item) => item.sets === 1));
  assert.ok(override.deferred.length > 0);
  for (const exercise of plan.day.exercises) addExposure(data, "2026-08-05", exercise);
  const next = c.buildExposurePlan(data, day, "2026-08-09", resolve);
  assert.ok(next.day.exercises.some((exercise) => plan.deferred.includes(exercise.name)), "previously deferred unfamiliar movements must receive priority");
});

test("new Phase 2 lifts cannot update a training max, while established lifts in the same session can", () => {
  const data = fixture(); data.program.activeId = "phase2";
  const lifts = t.programDays("phase2", 5)[0].exercises.filter((item) => item.sbsRole).slice(0, 2);
  assert.equal(lifts.length, 2);
  const day = { ...baseDay, exercises: lifts };
  const snapshot = t.buildSessionPlanSnapshot(data, day, "phase2", 1, 5);
  const keys = snapshot.exercises.map((item) => item.key);
  const session = { id: "sbs", date: "2026-08-05", dayId: day.id, unit: "kg", programId: "phase2", programWeek: 1, affectsProgression: true, completionStatus: "completed", planSnapshot: snapshot, revision: 1, createdAt: "2026-08-05T10:00:00Z", updatedAt: "2026-08-05T10:00:00Z", trainingMaxesBefore: Object.fromEntries(keys.map((key) => [key, 100])),
    entries: Object.fromEntries(lifts.map((lift, index) => [keys[index], Array.from({length: 4}, () => ({ w: "70", r: String(t.sbsPrescription(lift.sbsRole, 1).repOutTarget + 3), rir: "0" }))])),
    exerciseExposures: Object.fromEntries(keys.map((key, index) => [key, { stateAtStart: index ? "calibrated" : "uncalibrated", progressionEligible: Boolean(index) }])) };
  data.sessions = [session]; data.program.trainingMaxes = session.trainingMaxesBefore;
  const result = t.recalculatePhase2Progression(data);
  assert.equal(result.program.trainingMaxes[keys[0]], 100);
  assert.ok(result.program.trainingMaxes[keys[1]] > 100);
});

test("backup normalization and merge retain recovery, prescription metadata and raw recorded sets", () => {
  const data = fixture(); addExposure(data, "2026-08-01", press, { recovery: "recovered", override: true });
  const originalEntries = structuredClone(data.sessions[0].entries);
  const normalized = t.normalizeTrainingData(JSON.parse(JSON.stringify(data)));
  assert.equal(normalized.version, 9);
  assert.deepEqual(normalized.sessions[0].entries, originalEntries);
  assert.equal(normalized.exerciseRecovery.length, 1);
  assert.equal(backup.parseTrainingBackup(JSON.stringify(backup.createTrainingBackup(normalized))).data.version, 9);
  const key = Object.keys(data.sessions[0].entries)[0];
  assert.equal(normalized.sessions[0].exerciseExposures[key].startingLoadSource, "user");
  assert.equal(t.mergeTrainingData(normalized, normalized).exerciseRecovery.length, 1);
  assert.equal(c.exerciseCalibration(normalized, press, "2026-08-05").state, "preliminary");
});

test("an existing unfinished draft preserves a third entered set across the reduced-volume upgrade", () => {
  const data = fixture();
  const entries = { [press.id]: [{w:"20",r:"8",rir:"3"},{w:"20",r:"8",rir:"3"},{w:"20",r:"7",rir:"2"}] };
  const copy = structuredClone(entries);
  const plan = c.preserveLegacyDraft(data, "phase1:1:2026-08-01:UA", entries);
  assert.ok(plan);
  assert.equal(plan.snapshot.exercises.find((item) => item.key === press.id).sets, 3);
  assert.deepEqual(entries, copy);
  assert.equal(plan.exposures[press.id].progressionEligible, false);
});

test("snapshot hydration preserves all four recorded sets and its original variant key", () => {
  const data = fixture(); data.swaps[press.id] = "Incline machine press";
  const snapshot = t.buildSessionPlanSnapshot(data, { ...baseDay, exercises: [{ ...press, sets: 4 }] });
  const key = snapshot.exercises[0].key;
  const entries = { [key]: Array.from({length:4}, (_, index) => ({w:"20",r:String(10-index),rir:"3"})) };
  data.swaps[press.id] = "Incline barbell press";
  const restored = t.sessionEntriesForDay(t.trainingDayFromSnapshot(snapshot), {}, entries, "kg", "kg");
  assert.equal(Object.keys(restored)[0], key);
  assert.deepEqual(restored[key], entries[key]);
});

test("new adverse recovery revokes a frozen draft's eligibility without changing its recorded prescription", () => {
  const original = { policyVersion: 1, identity: "test", stateAtStart: "calibrated", prescribedSets: 4, originalSets: 4, targetRir: 2, progressionEligible: true };
  const restricted = c.restrictActiveExposure(original, "recalibration", "normal");
  assert.equal(restricted.progressionEligible, false);
  assert.equal(restricted.prescribedSets, 4);
  assert.equal(original.progressionEligible, true);
  assert.equal(c.restrictActiveExposure(original, "calibrated", "sore").progressionEligible, false);
});

test("daily report cannot recommend an increase from an unreviewed first exposure", () => {
  const data = fixture(); addExposure(data, "2026-08-01", press, { reps: press.repHigh });
  data.loadProfiles[t.loadProfileId(press)] = { unit: "kg", values: [20, 21, 22], updatedAt: "2026-08-01T00:00:00Z" };
  const report = reports.buildDailyReport(data, "2026-08-01");
  assert.equal(report.exercises[0].recommendation.action, "hold");
  assert.equal(report.exercises[0].recommendation.nextLoad, null);
});
