import assert from "node:assert/strict";
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

test("migrates the original profile and stamps legacy session units", () => {
  const migrated = training.normalizeTrainingData({
    profile: { bw: 75, unit: "kg", level: "some" },
    sessions: [{
      date: "2026-08-27",
      dayId: "UA",
      entries: { ua1: [{ w: "20", r: "10", rir: "2" }] },
    }],
    swaps: {},
  }, "2026-08-27T12:00:00.000Z");

  assert.equal(migrated.version, 7);
  assert.equal(migrated.setupVersion, 2);
  assert.equal(migrated.setupCompletedAt, "2026-08-27T12:00:00.000Z");
  assert.equal(migrated.program.activeId, "phase1");
  assert.equal(migrated.program.week, 1);
  assert.equal(migrated.profile.bodyweight, 75);
  assert.equal(migrated.profile.gender, "man");
  assert.equal(migrated.profile.level, "intermediate");
  assert.equal(migrated.profile.goal, "balanced");
  assert.equal(migrated.profile.equipment, "full");
  assert.equal(migrated.profile.weightGoal, "maintain");
  assert.equal(migrated.profile.weightTrackingEnabled, true);
  assert.equal(migrated.sessions[0].unit, "kg");
  assert.equal(migrated.sessions[0].revision, 1);
  assert.equal(migrated.sessions[0].entries.ua1[0].r, "10");
});

test("keeps a brand-new profile behind required setup", () => {
  const fresh = training.emptyData();
  assert.equal(fresh.profile, null);
  assert.equal(fresh.setupVersion, 0);
  assert.equal(fresh.setupCompletedAt, undefined);
});

test("merges sessions from two devices without dropping either one", () => {
  const base = training.emptyData();
  const left = {
    ...base,
    updatedAt: "2026-08-26T10:00:00.000Z",
    sessions: [{
      id: "one",
      date: "2026-08-25",
      dayId: "UA",
      unit: "kg",
      entries: {},
      revision: 1,
      createdAt: "2026-08-25T10:00:00.000Z",
      updatedAt: "2026-08-25T10:00:00.000Z",
    }],
  };
  const right = {
    ...base,
    updatedAt: "2026-08-27T10:00:00.000Z",
    sessions: [{
      id: "two",
      date: "2026-08-27",
      dayId: "LB",
      unit: "lb",
      entries: {},
      revision: 1,
      createdAt: "2026-08-27T10:00:00.000Z",
      updatedAt: "2026-08-27T10:00:00.000Z",
    }],
  };

  const merged = training.mergeTrainingData(left, right);
  assert.deepEqual(merged.sessions.map((session) => session.id), ["one", "two"]);
  assert.equal(merged.updatedAt, right.updatedAt);
});

test("converts old session loads without changing their meaning", () => {
  const pounds = training.convertWeight(100, "kg", "lb");
  const kilograms = training.convertWeight(pounds, "lb", "kg");
  assert.ok(Math.abs(kilograms - 100) < 0.0001);
});

test("counts reps-only bodyweight entries as complete", () => {
  assert.equal(training.isFilledSet({ w: "", r: "8", rir: "2" }, { bodyweight: true }), true);
  assert.equal(training.isFilledSet({ w: "", r: "8", rir: "2" }, { bodyweight: false }), false);
});

test("assigns every official Phase 2 exercise one of the supported rest periods", () => {
  const exercises = Object.values(training.PHASE_TWO_PROGRAMS).flatMap((days) => days).flatMap((day) => day.exercises);
  assert.ok(exercises.length > 0);
  assert.equal(exercises.every((exercise) => [90, 120, 180].includes(exercise.restSeconds)), true);
  assert.equal(exercises.find((exercise) => exercise.name === "Barbell squat").restSeconds, 180);
});

test("matches the official SBS hypertrophy week structure", () => {
  assert.deepEqual(training.sbsPrescription("main", 1), {
    intensity: 0.7,
    normalReps: 10,
    repOutTarget: 12,
    sets: 4,
    deload: false,
  });
  assert.deepEqual(training.sbsPrescription("auxiliary", 13), {
    intensity: 0.75,
    normalReps: 8,
    repOutTarget: 10,
    sets: 4,
    deload: false,
  });
  assert.equal(training.sbsPrescription("main", 7).deload, true);
  assert.equal(training.sbsPrescription("main", 20).intensity, 0.825);
});

test("adjusts SBS training maxes from final-set performance", () => {
  assert.equal(training.sbsTrainingMaxChange(9, 12), -0.05);
  assert.equal(training.sbsTrainingMaxChange(11, 12), -0.02);
  assert.equal(training.sbsTrainingMaxChange(12, 12), 0);
  assert.equal(training.sbsTrainingMaxChange(14, 12), 0.01);
  assert.equal(training.sbsTrainingMaxChange(17, 12), 0.03);
});

test("provides the official lower-frequency Phase 2 layouts", () => {
  assert.equal(training.programDays("phase2", 3).length, 3);
  assert.equal(training.programDays("phase2", 4).length, 4);
  assert.equal(training.programDays("phase2", 5).length, 5);
  for (const frequency of [3, 4, 5]) {
    const lifts = training.programDays("phase2", frequency).flatMap((day) => day.exercises).filter((exercise) => exercise.sbsRole);
    assert.equal(lifts.length, 10);
    assert.equal(new Set(lifts.map((exercise) => exercise.id)).size, 10);
  }
});

test("assigns tracks from gender while preserving the current program as the default", () => {
  assert.equal(training.trainingTrack("man"), "current");
  assert.equal(training.trainingTrack("woman"), "women");
  assert.equal(training.programDays("phase1", 5, "current")[0].id, "UA");
});

test("provides complete women’s Foundation and Phase 2 layouts at every frequency", () => {
  for (const frequency of [3, 4, 5]) {
    assert.equal(training.programDays("phase1", frequency, "women").length, frequency);
    assert.equal(training.programDays("phase2", frequency, "women").length, frequency);
    const lifts = training.programDays("phase2", frequency, "women").flatMap((day) => day.exercises).filter((exercise) => exercise.sbsRole);
    assert.equal(lifts.length, 8);
    assert.equal(new Set(lifts.map((exercise) => exercise.id)).size, 8);
    assert.equal(lifts.every((exercise) => exercise.id.startsWith("w2-") && exercise.historyIds?.[0]?.startsWith("w1-")), true);
  }
});

test("personalization changes accessory exposure without rewriting programmed lifts", () => {
  const balanced = training.programDays("phase1", 3, "women", "balanced", "full");
  const lower = training.programDays("phase1", 3, "women", "lower", "home");
  assert.equal(lower[0].exercises.reduce((sum, exercise) => sum + exercise.sets, 0), balanced[0].exercises.reduce((sum, exercise) => sum + exercise.sets, 0) + 1);
  assert.match(lower[0].exercises[0].alternatives[0], /goblet|dumbbell|bodyweight|band|split|step|glute|push-up|floor|single-leg|reverse|dead bug|wall|slider/i);
});

test("soft deletion wins a cloud merge when it is the newest revision", () => {
  const base = training.emptyData();
  const original = { id: "session", date: "2026-08-25", dayId: "D1", unit: "kg", entries: {}, revision: 1, createdAt: "2026-08-25T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z" };
  const left = { ...base, sessions: [original], updatedAt: original.updatedAt };
  const rightSession = { ...original, revision: 2, deletedAt: "2026-08-26T10:00:00.000Z", updatedAt: "2026-08-26T10:00:00.000Z" };
  const right = { ...base, sessions: [rightSession], updatedAt: rightSession.updatedAt };
  const merged = training.mergeTrainingData(left, right);
  assert.equal(training.activeSessions(merged).length, 0);
  assert.equal(merged.sessions[0].revision, 2);
});

test("bodyweight trends use seven-day averages and ignore deleted entries", () => {
  const base = training.emptyData();
  const data = { ...base, weighIns: [
    { id: "old", date: "2026-08-15", weight: 80, unit: "kg", createdAt: "a", updatedAt: "a" },
    { id: "previous", date: "2026-08-21", weight: 79, unit: "kg", createdAt: "b", updatedAt: "b" },
    { id: "recent-1", date: "2026-08-27", weight: 78, unit: "kg", createdAt: "c", updatedAt: "c" },
    { id: "recent-2", date: "2026-08-28", weight: 77.8, unit: "kg", createdAt: "d", updatedAt: "d" },
    { id: "deleted", date: "2026-08-28", weight: 120, unit: "kg", createdAt: "e", updatedAt: "e", deletedAt: "e" },
  ] };
  const trend = training.weightTrend(data, "kg");
  assert.equal(trend.recentCount, 2);
  assert.equal(trend.latestAverage, 77.9);
  assert.equal(trend.previousAverage, 79.5);
});

test("strict validation rejects corrupt dates and numeric set values without rejecting partial drafts", () => {
  const valid = training.emptyData();
  valid.sessions = [{ id: "partial", date: "2026-09-02", dayId: "UA", unit: "kg", entries: { ua1: [{ w: "", r: "", rir: "" }] }, revision: 1, createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T10:00:00.000Z" }];
  assert.deepEqual(training.trainingDataValidationIssues(valid), []);
  const invalid = structuredClone(valid);
  invalid.sessions[0].date = "2026-02-30";
  invalid.sessions[0].entries.ua1[0] = { w: "-1", r: "101", rir: "11" };
  const issues = training.trainingDataValidationIssues(invalid).join(" ");
  assert.match(issues, /invalid date/i);
  assert.match(issues, /invalid load/i);
  assert.match(issues, /invalid reps/i);
  assert.match(issues, /invalid RIR/i);
});

test("logical workout identity prevents duplicate offline creations", () => {
  const base = training.emptyData();
  const logicalKey = training.sessionLogicalKey("2026-09-02", "phase1", undefined, 5, "UA");
  const session = (id, updatedAt) => ({ id, logicalKey, date: "2026-09-02", dayId: "UA", unit: "kg", entries: {}, revision: 1, createdAt: updatedAt, updatedAt });
  const merged = training.mergeTrainingData(
    { ...base, sessions: [session("device-a", "2026-09-02T10:00:00.000Z")] },
    { ...base, sessions: [session("device-b", "2026-09-02T10:05:00.000Z")] },
  );
  assert.equal(merged.sessions.length, 1);
  assert.equal(merged.sessions[0].id, "device-b");
});

test("saved plan snapshots preserve compatible variants and completion semantics", () => {
  const data = training.emptyData();
  data.profile = { bodyweight: 75, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "home", weightGoal: "maintain", weightTrackingEnabled: true };
  data.program.frequency = 3;
  data.program.preferredWeekdays = [1, 3, 5];
  const day = training.programDays("phase1", 3, "current", "balanced", "home")[0];
  const snapshot = training.buildSessionPlanSnapshot(data, day, "phase1", 1, 3);
  assert.equal(snapshot.exercises.length, day.exercises.length);
  assert.equal(snapshot.exercises.every((exercise) => exercise.equipment?.includes("home")), true);
  const entries = Object.fromEntries(snapshot.exercises.map((exercise) => [exercise.key, Array.from({ length: exercise.sets }, () => ({ w: exercise.loadingType === "external" || exercise.loadingType === "assisted-bodyweight" ? "10" : "", r: String(exercise.repLow), rir: "2" }))]));
  const session = { id: "complete", logicalKey: "logical", date: "2026-09-02", dayId: day.id, unit: "kg", entries, planSnapshot: snapshot, completionStatus: "completed", revision: 1, createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T11:00:00.000Z" };
  assert.equal(training.sessionCompletedSets(session), training.sessionPlannedSets(session, data));
  assert.equal(training.sessionCountsAsCompletedDay(session, data), true);
  assert.equal(training.sessionCountsAsCompletedDay({ ...session, completionStatus: "partial" }, data), false);
});

test("calibration and deleted sessions cannot advance a Phase 2 training max", () => {
  const data = training.emptyData();
  data.profile = { bodyweight: 80, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  data.program.activeId = "phase2";
  const day = training.programDays("phase2", 5, "current")[0];
  const exercise = day.exercises.find((item) => item.sbsRole);
  const key = training.exerciseKey(exercise, {});
  data.program.trainingMaxes = { [key]: 100 };
  const snapshot = training.buildSessionPlanSnapshot(data, { ...day, exercises: [exercise] }, "phase2", 1, 5);
  const target = training.sbsPrescription(exercise.sbsRole, 1).repOutTarget;
  const session = { id: "phase2-session", logicalKey: "phase2-logical", date: "2026-09-02", dayId: day.id, unit: "kg", entries: { [key]: Array.from({ length: exercise.sets }, (_, index) => ({ w: "70", r: String(index === exercise.sets - 1 ? target + 5 : exercise.repLow), rir: "2" })) }, programId: "phase2", programWeek: 1, programFrequency: 5, trainingMaxesBefore: { [key]: 100 }, trainingMaxesAfter: { [key]: 100 }, planSnapshot: snapshot, completionStatus: "completed", affectsProgression: false, revision: 1, createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T11:00:00.000Z" };
  data.sessions = [session];
  assert.equal(training.recalculatePhase2Progression(data).program.trainingMaxes[key], 100);
  const progressed = training.recalculatePhase2Progression({ ...data, sessions: [{ ...session, affectsProgression: true }] });
  assert.ok(progressed.program.trainingMaxes[key] > 100);
  const deleted = training.recalculatePhase2Progression({ ...progressed, sessions: [{ ...progressed.sessions[0], deletedAt: "2026-09-03T00:00:00.000Z" }] });
  assert.equal(deleted.program.trainingMaxes[key], 100);
});

test("missed training detection credits moved workouts without inventing performance", () => {
  const data = training.emptyData();
  data.profile = { bodyweight: 75, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  data.program.frequency = 3;
  data.program.preferredWeekdays = [1, 3, 5];
  data.setupCompletedAt = "2026-08-01T10:00:00.000Z";
  data.planHistory = [{ id: "setup", effectiveAt: data.setupCompletedAt, kind: "setup", programId: "phase1", week: 1, frequency: 3, preferredWeekdays: [1, 3, 5], track: "current", goal: "balanced", equipment: "full", status: "active" }];
  const day = training.programDays("phase1", 3, "current")[0];
  const snapshot = training.buildSessionPlanSnapshot(data, day, "phase1", 1, 3);
  const entries = Object.fromEntries(snapshot.exercises.map((exercise) => [exercise.key, Array.from({ length: exercise.sets }, () => ({ w: exercise.loadingType === "external" || exercise.loadingType === "assisted-bodyweight" ? "10" : "", r: String(exercise.repLow), rir: "2" }))]));
  const session = (id, date) => ({ id, date, dayId: day.id, unit: "kg", entries, programId: "phase1", programFrequency: 3, planSnapshot: snapshot, completionStatus: "completed", affectsProgression: true, revision: 1, createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T11:00:00.000Z` });
  data.sessions = [session("baseline", "2026-08-21"), session("moved", "2026-08-25")];
  const missed = training.detectMissedTraining(data, "2026-08-29");
  assert.equal(missed.expectedSessions, 2);
  assert.equal(missed.completedSessions, 0);
  assert.deepEqual(missed.missedDates, ["2026-08-26", "2026-08-28"]);
});

test("return plans scale conservatively with time away and end after bounded sessions", () => {
  assert.equal(training.buildReturnPlan(13, "busy"), undefined);
  assert.deepEqual(training.buildReturnPlan(14, "busy", "now"), { startedAt: "now", gapDays: 14, reason: "busy", totalSessions: 1, sessionsRemaining: 1, loadFactor: 0.9, volumeFactor: 0.75, targetRir: 3 });
  assert.equal(training.buildReturnPlan(35, "travel").totalSessions, 2);
  assert.equal(training.buildReturnPlan(70, "illness").totalSessions, 3);
});

test("next workout follows the program sequence and merged absence decisions survive sync", () => {
  const data = training.emptyData();
  data.profile = { bodyweight: 75, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  data.program.frequency = 3;
  data.program.preferredWeekdays = [1, 3, 5];
  const days = training.programDays("phase1", 3, "current");
  data.absences = [{ id: "away", startDate: "2026-08-24", endDate: "2026-08-24", missedDates: ["2026-08-24"], reason: "busy", resolution: "skip", programId: "phase1", frequency: 3, resolvedDayIds: [days[0].id], createdAt: "2026-08-25T10:00:00.000Z", updatedAt: "2026-08-25T10:00:00.000Z" }];
  assert.equal(training.nextUnfinishedProgramDay(data).id, days[1].id);
  const remote = structuredClone(data);
  remote.updatedAt = "2026-08-26T10:00:00.000Z";
  remote.absences[0].updatedAt = "2026-08-26T10:00:00.000Z";
  remote.absences[0].reason = "travel";
  assert.equal(training.mergeTrainingData(data, remote).absences[0].reason, "travel");
});
