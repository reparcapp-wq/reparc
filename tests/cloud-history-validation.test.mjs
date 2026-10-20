import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ configFile: false, appType: "custom", root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const backup = await vite.ssrLoadModule("/lib/backup.ts");
const daily = await vite.ssrLoadModule("/lib/daily-report.ts");
const filled = () => ({ w: "20", r: "10", rir: "3" });

function fixture() {
  const data = { ...t.emptyData(), profile: { displayName: "Synthetic", bodyweight: 70, unit: "kg", gender: "man", programTrack: "current", level: "experienced", goal: "balanced", equipment: "full", weightGoal: "bulk", weightTrackingEnabled: true } };
  const day = t.programDays("phase1", 5, "current")[0];
  const planSnapshot = t.buildSessionPlanSnapshot(data, day);
  const make = (date) => ({ id: `synthetic-${date}`, date, scheduledDate: date, dayId: day.id, programId: "phase1", unit: "kg", planSnapshot: structuredClone(planSnapshot), completionStatus: "completed", revision: 1,
    createdAt: `${date}T02:00:00.000Z`, updatedAt: `${date}T02:00:00.000Z`,
    entries: Object.fromEntries(planSnapshot.exercises.map((exercise) => [exercise.key, Array.from({ length: exercise.sets }, filled)])) });
  data.sessions = [make("2026-09-01"), make("2026-09-02")];
  return data;
}

test("an old completed label on incomplete Session 2 cannot block the whole profile upload", () => {
  const data = fixture();
  const session = data.sessions[1];
  const missing = session.planSnapshot.exercises.at(-1);
  delete session.entries[missing.key];
  const before = JSON.stringify(data);
  assert.deepEqual(t.trainingDataValidationIssues(data), []);
  assert.equal(JSON.stringify(data), before, "Validation must not edit historical records");
  assert.equal(t.sessionCountsAsCompletedDay(session, data), false);
  const normalized = t.normalizeTrainingData(data);
  assert.deepEqual(normalized.sessions[1].entries, session.entries);
  assert.equal(normalized.sessions[1].completionStatus, "completed", "Preserve the historical label rather than silently rewriting the record");
  const report = daily.buildDailyReport(normalized, session.date);
  assert.ok(report.completionPercent < 100);
  assert.notEqual(report.status, "completed", "Reports must compute completion from actual prescribed positions, not trust the label");
});

test("a completed deletion tombstone syncs without resurrection or loss of its recorded sets", () => {
  const data = fixture();
  data.sessions[1].deletedAt = "2026-10-21T02:00:00.000Z";
  const before = JSON.stringify(data.sessions[1]);
  assert.deepEqual(t.trainingDataValidationIssues(data), []);
  const normalized = t.normalizeTrainingData(data);
  assert.equal(JSON.stringify(normalized.sessions[1].entries), JSON.stringify(data.sessions[1].entries));
  assert.equal(normalized.sessions[1].deletedAt, data.sessions[1].deletedAt);
  assert.equal(JSON.stringify(data.sessions[1]), before);
  assert.equal(t.sessionCountsAsCompletedDay(normalized.sessions[1], normalized), false);
  assert.equal(t.activeSessions(normalized).length, 1);
  assert.equal(daily.buildDailyReport(normalized, "2026-09-02").completedSets, 0);
});

test("legacy snapshots and partial/skipped sessions remain valid saved history, not fake completed days", () => {
  for (const variant of ["legacy", "partial", "skipped"]) {
    const data = fixture();
    const session = data.sessions[1];
    const first = session.planSnapshot.exercises[0];
    session.entries = { [first.key]: [filled()] };
    if (variant === "legacy") delete session.planSnapshot;
    else {
      session.completionStatus = variant;
      if (variant === "skipped") session.skippedExerciseKeys = [first.key];
    }
    assert.deepEqual(t.trainingDataValidationIssues(data), [], variant);
    assert.equal(t.sessionCountsAsCompletedDay(session, data), false, variant);
    assert.deepEqual(t.normalizeTrainingData(data).sessions[1].entries, session.entries, variant);
  }
});

test("backups containing older completion labels or tombstones restore without discarding history", () => {
  const data = fixture();
  const missing = data.sessions[1].planSnapshot.exercises.at(-1);
  delete data.sessions[1].entries[missing.key];
  data.sessions[0].deletedAt = "2026-10-21T02:00:00.000Z";
  const result = backup.parseTrainingBackup(JSON.stringify(backup.createTrainingBackup(data)));
  assert.equal(result.data.sessions.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(result.data.sessions[i].entries, data.sessions[i].entries);
    assert.equal(result.data.sessions[i].deletedAt, data.sessions[i].deletedAt);
  }
  assert.equal(t.sessionCountsAsCompletedDay(result.data.sessions[1], result.data), false);
});

test("real invalid data is still rejected even when its completion flag is completed", () => {
  const data = fixture();
  assert.deepEqual(t.trainingDataValidationIssues(data), []);
  assert.equal(t.sessionCountsAsCompletedDay(data.sessions[0], data), true);
  const firstKey = data.sessions[1].planSnapshot.exercises[0].key;
  for (const edit of [
    (session) => { session.entries[firstKey][0].w = "-1"; },
    (session) => { session.entries[firstKey][0].r = "oops"; },
    (session) => { session.unit = "invalid"; },
    (session) => { session.date = "invalid"; },
    (session) => { session.entries = []; },
  ]) {
    const changed = structuredClone(data);
    edit(changed.sessions[1]);
    assert.ok(t.trainingDataValidationIssues(changed).length > 0);
    assert.throws(() => backup.parseTrainingBackup(JSON.stringify(backup.createTrainingBackup(changed))));
  }
});

test("an old completed label cannot make missing SBS working sets advance a training max", () => {
  const data = fixture();
  data.program.activeId = "phase2";
  const day = t.programDays("phase2", 5, "current")[0];
  const snapshot = t.buildSessionPlanSnapshot(data, day, "phase2", 1, 5);
  const exercise = snapshot.exercises.find((item) => item.sbsRole && item.sbsRole !== "accessory");
  const prescription = t.sbsPrescription(exercise.sbsRole, 1);
  snapshot.exercises = [exercise];
  const load = 100 * prescription.intensity;
  const session = { ...data.sessions[1], dayId: day.id, programId: "phase2", programWeek: 1, programFrequency: 5, planSnapshot: snapshot, affectsProgression: true, readiness: "normal",
    trainingMaxesBefore: { [exercise.key]: 100 }, trainingMaxesAfter: { [exercise.key]: 100 },
    entries: { [exercise.key]: Array.from({ length: exercise.sets - 1 }, () => ({ w: String(load), r: String(prescription.normalReps), rir: "3" })) } };
  data.sessions = [session];
  data.program.trainingMaxes = { [exercise.key]: 100 };
  assert.deepEqual(t.trainingDataValidationIssues(data), []);
  assert.equal(t.sessionCountsAsCompletedDay(session, data), false);
  assert.equal(t.recalculatePhase2Progression(data).program.trainingMaxes[exercise.key], 100);
  assert.deepEqual(t.recalculatePhase2Progression(data).sessions[0].entries, session.entries);
});
