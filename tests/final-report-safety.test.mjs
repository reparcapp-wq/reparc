import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
});
after(() => vite.close());

const training = await vite.ssrLoadModule("/lib/training.ts");
const reports = await vite.ssrLoadModule("/lib/daily-report.ts");
const analysis = await vite.ssrLoadModule("/lib/progress-analysis.ts");
const scores = await vite.ssrLoadModule("/lib/performance-score.ts");
const { weeklyMuscleVolume } = await vite.ssrLoadModule("/lib/muscle-volume.ts");
const { improvementSample } = await vite.ssrLoadModule("/lib/improvement.ts");

function fixture() {
  const data = training.emptyData();
  data.profile = {
    displayName: "Synthetic report fixture", bodyweight: 75, unit: "kg",
    level: "experienced", gender: "man", programTrack: "current",
    goal: "balanced", equipment: "full", weightGoal: "maintain",
    weightTrackingEnabled: true,
  };
  data.setupCompletedAt = "2026-08-01T08:00:00.000Z";
  data.program.frequency = 3;
  data.program.preferredWeekdays = [1, 3, 5];
  data.planHistory = [{
    id: "setup", effectiveAt: data.setupCompletedAt, kind: "setup",
    programId: "phase1", week: 1, frequency: 3,
    preferredWeekdays: [1, 3, 5], track: "current", goal: "balanced",
    equipment: "full", status: "active",
  }];
  return data;
}

function addSession(data, date, options = {}) {
  const phase = options.phase ?? "phase1";
  const day = training.programDays(phase, 5, "current")[0];
  const snapshot = training.buildSessionPlanSnapshot(data, {
    ...day,
    exercises: [{ ...day.exercises[0], sets: 2 }],
  }, phase, 1, 5);
  const exercise = snapshot.exercises[0];
  const key = exercise.key;
  const id = options.id ?? date + ":" + data.sessions.length;
  const completedAt = date + "T10:00:00.000Z";
  const session = {
    id, logicalKey: options.logicalKey ?? id, date,
    scheduledDate: options.scheduledDate ?? date,
    dayId: day.id, unit: "kg", programId: phase,
    programWeek: phase === "phase2" ? 1 : undefined,
    programFrequency: 5, planSnapshot: snapshot,
    exerciseExposures: { [key]: {
      policyVersion: 1, identity: training.loadProfileId(exercise),
      stateAtStart: "calibrated", noveltyRisk: "moderate",
      prescribedSets: 2, originalSets: 2, targetRir: 3,
      targetRepLow: exercise.repLow, targetRepHigh: exercise.repHigh,
      relatedHistory: false, startingLoadSource: "guided",
      progressionEligible: true, suggestedLoad: options.load ?? 20,
    } },
    entries: { [key]: Array.from({ length: 2 }, () => ({
      w: String(options.load ?? 20),
      r: String(options.reps ?? exercise.repLow),
      rir: options.rir ?? "3",
    })) },
    readiness: options.readiness ?? "normal",
    completionStatus: "completed", affectsProgression: true,
    durationSeconds: 1200, startedAt: date + "T09:40:00.000Z",
    completedAt, createdAt: completedAt, updatedAt: completedAt,
    revision: 1, recommendationVersion: "synthetic-saved-policy",
  };
  data.sessions.push(session);
  if (options.recovery !== null) {
    const at = new Date(Date.parse(completedAt) + 72 * 3_600_000).toISOString();
    data.exerciseRecovery.push({
      id: "recovery:" + id, sessionId: id,
      exerciseIdentity: training.loadProfileId(exercise),
      status: options.recovery ?? "recovered", createdAt: at, updatedAt: at,
    });
  }
  return { session, exercise, key };
}

function absence(id, dates, resolution = "trained-elsewhere", reason = "busy") {
  const at = dates.at(-1) + "T12:00:00.000Z";
  return {
    id, startDate: dates[0], endDate: dates.at(-1), missedDates: dates,
    reason, resolution, programId: "phase1", frequency: 3,
    resolvedDayIds: dates.map((_, index) => "D" + (index % 3 + 1)),
    createdAt: at, updatedAt: at,
  };
}

const review = (data, date = "2026-09-08") =>
  analysis.buildProgressAnalysis(data, "day", date, "2026-09-22");

test("missing or previously fabricated exposure ranges stay unknown in reports and telemetry", () => {
  for (const targets of [
    { targetRepLow: undefined, targetRepHigh: undefined },
    { targetRepLow: undefined, targetRepHigh: 10 },
    { targetRepLow: 6, targetRepHigh: undefined },
    { targetRepLow: 1, targetRepHigh: 100 },
    { targetRepLow: 10, targetRepHigh: 6 },
  ]) {
    const data = fixture();
    const { session, key } = addSession(data, "2026-09-08", { reps: 1 });
    Object.assign(session.exerciseExposures[key], targets);
    const normalized = training.normalizeTrainingData(data);
    const saved = normalized.sessions[0];
    assert.equal(saved.exerciseExposures[key].targetRepLow, undefined);
    assert.equal(saved.exerciseExposures[key].targetRepHigh, undefined);

    const result = review(normalized);
    assert.equal(result.counts.sets, 2, "the performed work remains recorded");
    assert.equal(result.counts.repKnown, 0, "unknown targets are not replaced by 1-100 or catalog defaults");
    assert.notEqual(result.exercises[0].status, "on-track");
    assert.equal(result.evaluation.eligible, 0);
    const sample = improvementSample(saved, normalized).exercises[0];
    assert.equal(sample.repLow, null);
    assert.equal(sample.repHigh, null);
  }
});

test("missing historical effort targets never become a fabricated three-reps-left target", () => {
  const data = fixture();
  const { session, key } = addSession(data, "2026-09-08");
  delete session.exerciseExposures[key].targetRir;
  const normalized = training.normalizeTrainingData(data);
  assert.equal(normalized.sessions[0].exerciseExposures[key].targetRir, undefined);
  const result = review(normalized);
  assert.equal(result.counts.repKnown, 2);
  assert.equal(result.counts.rirKnown, 2);
  assert.equal(result.counts.rirTargetKnown, 0);
  assert.notEqual(result.exercises[0].status, "on-track");
  assert.equal(result.evaluation.eligible, 0);
  assert.equal(improvementSample(normalized.sessions[0], normalized).exercises[0].targetRir, null);
});

test("daily adverse recovery stops legacy and saved exposures even after a later green answer", () => {
  for (const status of ["limiting", "severe"]) for (const legacy of [false, true]) {
    const data = fixture();
    const { session, exercise } = addSession(data, "2026-09-08", { recovery: status, reps: 10 });
    if (legacy) delete session.exerciseExposures;
    data.exerciseRecovery.push({
      id: "later-green", sessionId: session.id,
      exerciseIdentity: training.loadProfileId(exercise), status: "recovered",
      createdAt: "2026-09-15T10:00:00.000Z", updatedAt: "2026-09-15T10:00:00.000Z",
    });
    const recommendation = reports.buildDailyReport(data, session.date).exercises[0].recommendation;
    assert.equal(recommendation.action, "stop", JSON.stringify({ status, legacy }));
    assert.equal(recommendation.nextLoad, null);
    assert.match(recommendation.reason, /do not train/i);
  }
});

test("daily pain and severe soreness take priority over skipped and Phase 2 guidance", () => {
  for (const phase of ["phase1", "phase2"]) for (const readiness of ["pain", "severe-soreness"]) {
    const data = fixture();
    const { session, key } = addSession(data, "2026-09-08", { phase, readiness, recovery: null });
    session.skippedExerciseKeys = [key];
    session.completionStatus = "partial";
    session.entries[key] = [];
    const recommendation = reports.buildDailyReport(data, session.date).exercises[0].recommendation;
    assert.equal(recommendation.action, "stop", JSON.stringify({ phase, readiness }));
    assert.equal(recommendation.nextLoad, null);
  }
});

test("a successful daily report delegates the next prescription to Train", () => {
  const data = fixture();
  const { session, exercise } = addSession(data, "2026-09-08", { load: 20, reps: 10 });
  data.loadProfiles[training.loadProfileId(exercise)] = {
    unit: "kg", values: [18, 20, 22], updatedAt: session.createdAt,
  };
  const recommendation = reports.buildDailyReport(data, session.date).exercises[0].recommendation;
  assert.equal(recommendation.action, "hold");
  assert.equal(recommendation.nextLoad, null);
  assert.match(recommendation.reason, /open train/i);
});

test("daily comparable first-set scores remain descriptive at identical reported effort", () => {
  const data = fixture();
  const baseline = addSession(data, "2026-08-20", { load: 70, reps: 8 });
  addSession(data, "2026-08-27", { load: 75, reps: 8 });
  const latest = addSession(data, "2026-09-02", { load: 75, reps: 8 });
  assert.equal(scores.comparablePerformanceScore(
    scores.performanceScorePoint(baseline.session, baseline.key, "kg"),
    scores.performanceScorePoint(latest.session, latest.key, "kg"),
  ), true);
  const result = reports.buildDailyReport(data, latest.session.date);
  assert.equal(result.performanceImprovements, 1);
  assert.match(result.headline, /first-set load.rep score at the same reported effort/i);
  assert.match(result.headline, /not measured strength gain/i);
  assert.equal(result.exercises[0].recommendation.nextLoad, null);
});

test("missing or changed first-set RIR cannot establish a daily score improvement", () => {
  for (const rirs of [["", "", ""], ["3", "3", ""], ["3", "3", "2"]]) {
    const data = fixture();
    const baseline = addSession(data, "2026-08-20", { load: 70, reps: 8, rir: rirs[0] });
    addSession(data, "2026-08-27", { load: 75, reps: 8, rir: rirs[1] });
    const latest = addSession(data, "2026-09-02", { load: 75, reps: 8, rir: rirs[2] });
    assert.equal(scores.comparablePerformanceScore(
      scores.performanceScorePoint(baseline.session, baseline.key, "kg"),
      scores.performanceScorePoint(latest.session, latest.key, "kg"),
    ), false, JSON.stringify(rirs));
    const result = reports.buildDailyReport(data, latest.session.date);
    assert.equal(result.performanceImprovements, 0);
    assert.equal(result.possiblePerformanceImprovements, 0);
    assert.equal(result.exercises[0].changePercent, null);
    assert.doesNotMatch(result.headline, /higher first-set|positive performance trend/);
  }
});

test("changed saved protocols and protected exposures cannot establish a daily score improvement", () => {
  const changes = [
    ({ session }) => { session.planSnapshot.exercises[0].repLow += 1; },
    ({ session }) => { session.planSnapshot.exercises[0].perSide = false; },
    ({ session }) => { session.programId = "phase2"; session.planSnapshot.programId = "phase2"; },
    ({ session }) => { session.affectsProgression = false; },
    ({ session, key }) => { session.exerciseExposures[key].progressionEligible = false; },
    ({ session }) => { session.readiness = "low"; },
    ({ session }) => { delete session.planSnapshot; },
  ];
  for (const change of changes) {
    const data = fixture();
    const baseline = addSession(data, "2026-08-20", { load: 70, reps: 8 });
    addSession(data, "2026-08-27", { load: 75, reps: 8 });
    const latest = addSession(data, "2026-09-02", { load: 75, reps: 8 });
    change(latest);
    assert.equal(scores.comparablePerformanceScore(
      scores.performanceScorePoint(baseline.session, baseline.key, "kg"),
      scores.performanceScorePoint(latest.session, latest.key, "kg"),
    ), false);
    const result = reports.buildDailyReport(data, latest.session.date);
    assert.equal(result.performanceImprovements, 0);
    assert.equal(result.possiblePerformanceImprovements, 0);
    assert.equal(result.exercises[0].changePercent, null);
  }
});

test("a stronger later set does not replace the fixed first set in daily comparisons", () => {
  const data = fixture();
  addSession(data, "2026-08-27", { load: 70, reps: 8 });
  const { session, key } = addSession(data, "2026-09-02", { load: 70, reps: 8 });
  session.entries[key][1] = { w: "100", r: "10", rir: "3" };
  const result = reports.buildDailyReport(data, session.date);
  assert.equal(result.exercises[0].changePercent, 0);
  assert.equal(result.possiblePerformanceImprovements, 0);
});

test("two prior records on one date do not establish a repeated daily improvement", () => {
  const data = fixture();
  addSession(data, "2026-08-27", { load: 70, reps: 8 });
  addSession(data, "2026-08-27", { load: 75, reps: 8 });
  addSession(data, "2026-09-02", { load: 75, reps: 8 });
  const result = reports.buildDailyReport(data, "2026-09-02");
  assert.equal(result.performanceImprovements, 0);
  assert.doesNotMatch(result.headline, /repeated a higher/);
});

test("adherence credits a due date once across multiple workouts and external records", () => {
  const data = fixture();
  addSession(data, "2026-08-31");
  addSession(data, "2026-08-31");
  data.absences = [
    absence("external-one", ["2026-08-31"]),
    absence("external-two", ["2026-08-31"]),
  ];
  const result = reports.buildScheduleAdherence(data, "2026-08-31", "2026-09-02", "2026-09-02");
  assert.equal(result.expectedSessions, 2);
  assert.equal(result.loggedSessions, 2, "separate recorded workouts remain visible");
  assert.equal(result.completedSessions, 1, "both workouts fulfilled the same calendar slot");
  assert.equal(result.externalSessions, 0);
  assert.equal(result.adherencePercent, 50);

  data.absences.push(absence("wednesday-one", ["2026-09-02"]), absence("wednesday-two", ["2026-09-02"]));
  const completed = reports.buildScheduleAdherence(data, "2026-08-31", "2026-09-02", "2026-09-02");
  assert.equal(completed.externalSessions, 1);
  assert.equal(completed.completedSessions, 2);
  assert.equal(completed.adherencePercent, 100);
});

test("adherence does not credit a catch-up performed after the as-of date", () => {
  const data = fixture();
  addSession(data, "2026-09-04", { scheduledDate: "2026-08-31" });
  const result = reports.buildScheduleAdherence(data, "2026-08-31", "2026-09-02", "2026-09-02");
  assert.equal(result.expectedSessions, 2);
  assert.equal(result.completedSessions, 0);
  assert.equal(result.loggedSessions, 0);
  assert.equal(result.adherencePercent, 0);
});

test("cross-week absences contribute only the skipped and planned dates inside the review", () => {
  const dates = ["2026-08-31", "2026-09-02", "2026-09-04", "2026-09-07", "2026-09-09", "2026-09-11"];
  const data = fixture();
  data.absences = [absence("soreness", dates, "skip", "soreness")];
  const skipped = reports.buildScheduleAdherence(data, "2026-09-07", "2026-09-13", "2026-09-13");
  assert.equal(skipped.expectedSessions, 3);
  assert.equal(skipped.skippedSessions, 3);
  assert.equal(skipped.sorenessRecoverySessions, 3);

  data.absences = [absence("planned", dates, "pause", "planned")];
  const planned = reports.buildScheduleAdherence(data, "2026-09-07", "2026-09-13", "2026-09-13");
  assert.equal(planned.expectedSessions, 0);
  assert.equal(planned.plannedBreakDays, 3);
  assert.equal(planned.adherencePercent, null);
});

test("muscle volume uses the latest logical revision regardless of input order and respects tombstones", () => {
  for (const sameId of [false, true]) for (const reversed of [false, true]) {
    const data = fixture();
    const { session, key } = addSession(data, "2026-09-08", { logicalKey: "one-workout" });
    const latest = structuredClone(session);
    latest.id = sameId ? session.id : "newer-copy";
    latest.revision = 2;
    latest.updatedAt = "2026-09-09T10:00:00.000Z";
    latest.entries[key].pop();
    latest.completionStatus = "partial";
    data.sessions = reversed ? [latest, session] : [session, latest];
    const volume = weeklyMuscleVolume(data, "2026-09-07", "2026-09-13");
    assert.equal(volume.loggedSessions, 1);
    assert.equal(volume.rows.find((row) => row.muscle === "chest").direct, 1);
    assert.equal(volume.rows.find((row) => row.muscle === "triceps").indirect, 1);

    const tombstone = { ...structuredClone(latest), revision: 3, deletedAt: "2026-09-15T10:00:00.000Z", updatedAt: "2026-09-15T10:00:00.000Z" };
    if (reversed) data.sessions.unshift(tombstone); else data.sessions.push(tombstone);
    const deleted = weeklyMuscleVolume(data, "2026-09-07", "2026-09-13");
    assert.equal(deleted.loggedSessions, 0);
    assert.ok(deleted.rows.every((row) => row.direct === 0 && row.indirect === 0));
  }
});

test("moving the current revision out of the week does not resurrect its older date", () => {
  const data = fixture();
  const { session } = addSession(data, "2026-09-08");
  data.sessions.push({
    ...structuredClone(session), revision: 2,
    date: "2026-09-15", scheduledDate: "2026-09-15",
    updatedAt: "2026-09-15T10:00:00.000Z",
  });
  const volume = weeklyMuscleVolume(data, "2026-09-07", "2026-09-13");
  assert.equal(volume.loggedSessions, 0);
  assert.ok(volume.rows.every((row) => row.direct === 0 && row.indirect === 0));
});

test("later adverse workouts and the current return plan do not rewrite an older successful review", () => {
  const data = fixture();
  for (const date of ["2026-08-27", "2026-09-01", "2026-09-04", "2026-09-08"]) addSession(data, date);
  const before = review(data);
  assert.equal(before.exercises[0].status, "on-track");
  addSession(data, "2026-09-18", { recovery: "severe" });
  data.program.returnPlan = {
    startedAt: "2026-09-18T10:00:00.000Z", gapDays: 28, reason: "soreness",
    totalSessions: 2, sessionsRemaining: 2, loadFactor: 0.9,
    volumeFactor: 0.75, targetRir: 3,
  };
  const after = review(data);
  assert.deepEqual(after.exercises, before.exercises);
  assert.deepEqual(after.muscles, before.muscles);
  assert.equal(after.counts.sets, before.counts.sets);
});

test("telemetry preserves recovery just below the 48-hour boundary instead of rounding it up", () => {
  const data = fixture();
  const { session } = addSession(data, "2026-09-08");
  for (const hours of [47.5, 48, 48.25]) {
    data.exerciseRecovery[0].createdAt = new Date(Date.parse(session.completedAt) + hours * 3_600_000).toISOString();
    const recorded = improvementSample(session, data).exercises[0].recovery[0].hoursAfter;
    assert.equal(recorded, hours);
    assert.equal(recorded >= 48, hours >= 48);
  }
});

test("telemetry does not turn invalid, absent, or negative recovery timing into zero hours", () => {
  const scenarios = [
    { completedAt: undefined, recoveryAt: "2026-09-11T10:00:00.000Z" },
    { completedAt: "invalid", recoveryAt: "2026-09-11T10:00:00.000Z" },
    { completedAt: "2026-09-08T10:00:00.000Z", recoveryAt: "invalid" },
    { completedAt: "2026-09-08T10:00:00.000Z", recoveryAt: "2026-09-08T09:59:59.999Z" },
  ];
  for (const { completedAt, recoveryAt } of scenarios) {
    const data = fixture();
    const { session } = addSession(data, "2026-09-08");
    session.completedAt = completedAt;
    data.exerciseRecovery[0].createdAt = recoveryAt;
    assert.equal(improvementSample(session, data).exercises[0].recovery[0].hoursAfter, null);
  }
});
