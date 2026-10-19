import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ configFile: false, appType: "custom", root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const r = await vite.ssrLoadModule("/lib/return-check-in.ts");
const c = await vite.ssrLoadModule("/lib/exercise-calibration.ts");
const backup = await vite.ssrLoadModule("/lib/backup.ts");
const date = "2026-10-19";
const now = `${date}T02:00:00.000Z`;
const answer = (patch = {}) => ({ version: 1, activity: "stopped", lastLiftDate: "2026-09-19", approximate: false, readiness: "normal", weightGoal: "bulk", ...patch });
function fixture(programId = "phase1", track = "current") {
  const data = { ...t.emptyData(), setupCompletedAt: "2026-08-01T02:00:00.000Z", profile: { displayName: "Synthetic", bodyweight: 70, unit: "kg", level: "experienced", gender: track === "women" ? "woman" : "man", programTrack: track, goal: "balanced", equipment: "full", weightGoal: "cut", weightTrackingEnabled: true } };
  data.program.activeId = programId;
  data.program.week = 3;
  data.program.preferredWeekdays = [1, 2, 3, 4, 5];
  const day = t.programDays(programId, 5, track)[0];
  const snapshot = t.buildSessionPlanSnapshot(data, day, programId, 3, 5);
  const session = (dayDate, id = dayDate) => ({ id, date: dayDate, dayId: day.id, programId, programWeek: 3, programFrequency: 5, unit: "kg", planSnapshot: snapshot,
    entries: Object.fromEntries(snapshot.exercises.map((exercise) => [exercise.key, Array.from({ length: exercise.sets }, () => ({ w: "20", r: String(exercise.repLow), rir: "4" }))])),
    completionStatus: "completed", affectsProgression: false, revision: 1, createdAt: `${dayDate}T02:00:00.000Z`, updatedAt: `${dayDate}T02:00:00.000Z` });
  data.sessions = [session("2026-09-19")];
  return { data, day, snapshot, session };
}

test("return prompt detects actual recorded activity, not time since an absence decision", () => {
  const { data } = fixture();
  data.absences = [{ id: "skip", startDate: "2026-10-18", endDate: "2026-10-18", missedDates: [], resolution: "skip", reason: "busy", resolvedDayIds: [], createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z", frequency: 5, programId: "phase1" }];
  const context = r.returnCheckInContext(data, date);
  assert.equal(context.due, true);
  assert.equal(context.gapDays, 30);
  assert.equal(context.lastRecorded, "2026-09-19");
  assert.equal(r.returnCheckInContext({ ...data, program: { ...data.program, status: "paused" } }, date).due, false, "Paused users resume explicitly");
  assert.equal(r.returnCheckInContext({ ...data, sessions: [] }, date).due, false, "Do not assume a new user's pre-app inactivity");
});

test("one missed day and a completed recent workout do not trigger a long-break check-in", () => {
  const { data, session } = fixture();
  data.sessions.push(session("2026-10-18"));
  assert.equal(r.returnCheckInContext(data, date).due, false);
  data.sessions[1].deletedAt = now;
  assert.equal(r.returnCheckInContext(data, date).due, true);
});

test("month off creates exactly the existing return rule, and continued lifting creates no false workouts", () => {
  const { data } = fixture();
  const stopped = r.assessReturnCheckIn(data, answer(), date, now);
  assert.deepEqual(stopped.plan, t.buildReturnPlan(30, "planned", now));
  const continued = r.applyReturnCheckIn(data, answer({ activity: "continued", lastLiftDate: "2026-10-18" }), date, now, "check");
  assert.equal(continued.program.returnPlan, undefined);
  assert.equal(continued.program.calibrationRequired, false);
  assert.deepEqual(continued.sessions, data.sessions);
  assert.deepEqual(continued.absences.at(-1).resolvedDayIds, []);
  assert.equal(continued.absences.at(-1).resolution, "continue");
  assert.equal(continued.profile.weightGoal, "bulk");
  assert.equal(r.returnCheckInContext(continued, date).due, false);
});

test("reduced training, fatigue and short breaks reuse the existing conservative short-return plan", () => {
  const { data } = fixture();
  for (const patch of [{ activity: "reduced" }, { readiness: "low" }, { readiness: "sore" }]) {
    const result = r.assessReturnCheckIn(data, answer({ lastLiftDate: "2026-10-18", ...patch }), date, now);
    assert.equal(result.plan.totalSessions, 1);
    assert.equal(result.plan.targetRir, 3);
  }
  assert.equal(r.assessReturnCheckIn(data, answer({ lastLiftDate: "2026-10-18" }), date, now).plan, undefined);
  assert.equal(r.assessReturnCheckIn(data, answer({ activity: "continued" }), date, now).plan.totalSessions, 2, "An old actual lifting date still calls for return mode");
});

test("underway return counts and unrelated calibration are preserved without multiplying reductions", () => {
  const { data, session } = fixture("phase2");
  data.program.returnPlan = { ...t.buildReturnPlan(35, "planned", "2026-10-10T00:00:00Z"), sessionsRemaining: 1 };
  data.sessions.push(session("2026-10-11", "completed-return"));
  data.program.calibrationRequired = true;
  const next = r.applyReturnCheckIn(data, answer({ activity: "continued", lastLiftDate: "2026-10-18" }), date, now, "check");
  assert.deepEqual(next.program.returnPlan, data.program.returnPlan);
  const repeated = r.applyReturnCheckIn(next, answer(), date, now, "same-break");
  assert.equal(repeated.program.returnPlan.sessionsRemaining, 1, "Reviewing the same break must not reset completed return workouts");
  const again = r.applyReturnCheckIn(next, answer({ activity: "reduced", lastLiftDate: "2026-10-18" }), date, now, "check2");
  assert.equal(again.program.returnPlan.sessionsRemaining, 1);
  assert.equal(again.program.returnPlan.loadFactor, 0.85);
  assert.equal(again.program.returnPlan.volumeFactor, 0.67);
  assert.equal(again.program.returnPlan.targetRir, 4);
  assert.equal(again.program.week, 3);
  assert.equal(again.program.calibrationRequired, true);
  assert.deepEqual(again.program.trainingMaxes, data.program.trainingMaxes);
  data.program.returnPlan = undefined;
  const independent = r.applyReturnCheckIn(data, answer({ activity: "continued", lastLiftDate: "2026-10-18" }), date, now, "entry");
  assert.equal(independent.program.calibrationRequired, true, "Phase 2 entry calibration cannot be cleared by a logging-gap answer");
});

test("pain and limiting soreness pause rather than authorize training, and do not erase prior return progress", () => {
  for (const readiness of ["pain", "severe-soreness"]) {
    const { data } = fixture();
    data.program.returnPlan = t.buildReturnPlan(30, "planned", now);
    const next = r.applyReturnCheckIn(data, answer({ readiness }), date, now, readiness);
    assert.equal(next.program.status, "paused");
    assert.deepEqual(next.program.returnPlan, data.program.returnPlan);
    assert.equal(next.program.pausedAt, now);
    assert.deepEqual(next.sessions, data.sessions);
  }
});

test("answers survive normalization, backup restore and merge; malformed and future dates are rejected", () => {
  const { data } = fixture();
  const next = r.applyReturnCheckIn(data, answer({ approximate: true }), date, now, "check");
  assert.deepEqual(t.trainingDataValidationIssues(next), []);
  const normalized = t.normalizeTrainingData(next);
  assert.deepEqual(normalized.absences.at(-1).checkIn, answer({ approximate: true }));
  const restored = backup.parseTrainingBackup(JSON.stringify(backup.createTrainingBackup(next))).data;
  assert.deepEqual(restored.absences.at(-1).checkIn, normalized.absences.at(-1).checkIn);
  const merged = t.mergeTrainingData(data, restored);
  assert.deepEqual(merged.absences.at(-1).checkIn, normalized.absences.at(-1).checkIn);
  assert.equal(r.returnCheckInContext(merged, date).due, false);
  assert.equal(r.returnCheckInContext(merged, "2026-11-03").due, true, "A new extended gap can trigger another check-in");
  for (const patch of [{ lastLiftDate: "2026-10-20" }, { lastLiftDate: "2026-02-30" }, { activity: "anything" }, { activity: ["stopped"] }, { readiness: "anything" }, { weightGoal: "anything" }]) {
    assert.throws(() => r.applyReturnCheckIn(data, answer(patch), date, now, "invalid"));
  }
  data.program.status = "completed";
  assert.throws(() => r.applyReturnCheckIn(data, answer(), date, now, "completed"), /active program/);
});

test("paused date is not mistaken for last lifting date, and legacy return plans request clarification only once", () => {
  const { data } = fixture();
  data.program.pausedAt = "2026-10-17T00:00:00Z";
  data.program.status = "paused";
  assert.equal(r.returnCheckInContext(data, date).fallbackDate, "2026-09-19");
  const resumed = r.applyReturnCheckIn(data, answer(), date, now, "resume");
  assert.equal(resumed.program.status, "active");
  assert.equal(resumed.program.pausedAt, undefined);
  assert.equal(resumed.program.returnPlan.gapDays, 30);
  assert.equal(resumed.planHistory.at(-1).kind, "resume");
  assert.equal(r.returnCheckInContext(resumed, date).due, false);
  const legacy = fixture().data;
  legacy.program.returnPlan = t.buildReturnPlan(30, "planned", now);
  legacy.program.calibrationRequired = true;
  assert.equal(r.returnCheckInContext(legacy, date).due, true);
  const corrected = r.applyReturnCheckIn(legacy, answer({ activity: "continued", lastLiftDate: "2026-10-18" }), date, now, "legacy-correction");
  assert.equal(corrected.program.returnPlan, undefined, "A confirmed recent lifting date corrects an unused pre-check-in plan based on the wrong assumption");
  assert.equal(corrected.program.calibrationRequired, true, "Independent calibration remains intact");
});

test("both tracks and phases combine calibration and return set limits once, with stricter effort and progression freeze", () => {
  for (const program of ["phase1", "phase2"]) for (const track of ["current", "women"]) {
    const { data, day } = fixture(program, track);
    const before = JSON.stringify(data);
    const next = r.applyReturnCheckIn(data, answer(), date, now, `${program}-${track}`);
    const plan = c.buildExposurePlan(next, day, date, (exercise) => exercise);
    for (const exercise of plan.day.exercises) {
      const base = day.exercises.find((item) => item.id === exercise.id);
      const calibration = c.exerciseCalibration(next, exercise, date);
      assert.equal(exercise.sets, Math.min(c.calibrationSetCount(base.sets, calibration), t.returnPlanSetCount(base.sets, next.program.returnPlan.volumeFactor)));
      assert.equal(plan.exposures[exercise.id].progressionEligible, false);
      assert.ok(plan.exposures[exercise.id].targetRir >= 4);
    }
    assert.equal(JSON.stringify(data), before);
  }
});

test("draft reduction uses original counts, keeps entered rows, and cannot double-scale captured load predictions", () => {
  const { snapshot } = fixture();
  const exercise = { ...snapshot.exercises[0], sets: 4 };
  const draft = { snapshot: { ...snapshot, exercises: [exercise] }, exposures: { [exercise.key]: { policyVersion: 1, prescribedSets: 4, originalSets: 4, targetRir: 2, progressionEligible: true, suggestedLoad: 50 } } };
  const plan = t.buildReturnPlan(30, "planned", now);
  const once = r.restrictReturnDraft(draft, {}, plan);
  const twice = r.restrictReturnDraft(once, {}, plan);
  assert.equal(once.snapshot.exercises[0].sets, 3);
  assert.equal(twice.snapshot.exercises[0].sets, 3);
  assert.equal(once.exposures[exercise.key].suggestedLoad, null);
  assert.equal(once.exposures[exercise.key].targetRir, 4);
  assert.equal(once.exposures[exercise.key].progressionEligible, false);
  const entries = { [exercise.key]: Array.from({ length: 4 }, () => ({ w: "20", r: "5", rir: "4" })) };
  assert.equal(r.restrictReturnDraft(draft, entries, plan).snapshot.exercises[0].sets, 4);
  assert.equal(draft.exposures[exercise.key].suggestedLoad, 50);
  const legacyPartial = r.restrictReturnDraft({ snapshot: draft.snapshot, exposures: {} }, entries, plan);
  assert.equal(legacyPartial.exposures[exercise.key].targetRir, 4);
  assert.equal(legacyPartial.exposures[exercise.key].progressionEligible, false);
  assert.equal(legacyPartial.snapshot.exercises[0].sets, 4);
});
