import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
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
const adjustment = await vite.ssrLoadModule("/lib/autoregulation.ts");
const reports = await vite.ssrLoadModule("/lib/daily-report.ts");

const exercise = training.programDays("phase1", 5, "current")[0].exercises[0];
const filled = (weight, reps, rir = "2") => ({ w: String(weight), r: String(reps), rir: String(rir) });

test("next-set advice reduces one practical increment after a high-effort miss", () => {
  const result = adjustment.nextSetAdjustment({ exercise, entries: [filled(100, exercise.repLow - 1, 0)], unit: "kg", readiness: "normal" });
  assert.equal(result.action, "decrease");
  assert.ok(result.nextLoad < 100);
  assert.match(result.reason, /reduce|back off/i);
});

test("next-set advice holds instead of increasing when readiness is reduced", () => {
  const easy = filled(100, exercise.repHigh, 5);
  assert.equal(adjustment.nextSetAdjustment({ exercise, entries: [easy], unit: "kg", readiness: "normal" }).action, "increase");
  assert.equal(adjustment.nextSetAdjustment({ exercise, entries: [easy], unit: "kg", readiness: "low" }).action, "hold");
});

test("load advice does not force a standard increment larger than ten percent", () => {
  const small = { ...exercise, perSide: true, sets: 3, repLow: 10, repHigh: 12 };
  const entries = Array.from({ length: small.sets }, () => filled(5, small.repHigh, 3));
  const result = adjustment.nextSessionAdjustment({ exercise: small, entries, unit: "kg", readiness: "normal" });
  assert.equal(result.action, "hold");
  assert.equal(result.nextLoad, 5);
  assert.match(result.reason, /exceed 10%/i);
});

test("next-session advice does not progress incomplete or inconsistent work", () => {
  const incomplete = adjustment.nextSessionAdjustment({ exercise, entries: [filled(100, exercise.repHigh, 2)], unit: "kg", readiness: "normal" });
  assert.equal(incomplete.action, "hold");
  assert.equal(incomplete.confidence, "low");

  const varied = Array.from({ length: exercise.sets }, (_, index) => filled(100 + index * 10, exercise.repHigh, 3));
  const inconsistent = adjustment.nextSessionAdjustment({ exercise, entries: varied, unit: "kg", readiness: "normal" });
  assert.equal(inconsistent.action, "hold");
  assert.match(inconsistent.evidence.join(" "), /loads varied/i);
});

test("pain always overrides progression", () => {
  const result = adjustment.nextSessionAdjustment({ exercise, entries: Array.from({ length: exercise.sets }, () => filled(100, exercise.repHigh, 3)), unit: "kg", readiness: "pain" });
  assert.equal(result.action, "stop");
  assert.equal(result.nextLoad, null);
  assert.equal(result.confidence, "high");
});

test("daily report measures adherence and reduces confidence when effort data is missing", () => {
  const base = training.emptyData();
  const profile = { bodyweight: 80, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  const day = training.programDays("phase1", 5, "current")[0];
  const first = day.exercises[0];
  const key = training.exerciseKey(first, {});
  const priorEntries = Array.from({ length: first.sets }, () => filled(80, first.repLow, 2));
  const currentEntries = Array.from({ length: first.sets }, () => filled(85, first.repHigh, ""));
  const session = (id, date, entries, extra = {}) => ({ id, date, dayId: day.id, unit: "kg", entries: { [key]: entries }, programId: "phase1", revision: 1, createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T11:00:00.000Z`, ...extra });
  const data = { ...base, profile, setupVersion: 2, sessions: [session("prior", "2026-08-31", priorEntries), session("today", "2026-09-01", currentEntries, { sessionRpe: 7, durationSeconds: 3600 })] };
  const report = reports.buildDailyReport(data, "2026-09-01");
  assert.equal(report.sessions, 1);
  assert.equal(report.completedSets, first.sets);
  assert.ok(report.plannedSets > report.completedSets);
  assert.equal(report.rirCoveragePercent, 0);
  assert.equal(report.averageSessionRpe, 7);
  assert.equal(report.totalDurationSeconds, 3600);
  assert.equal(report.confidence, "low");
  assert.equal(report.performanceImprovements, 0);
  assert.ok(report.possiblePerformanceImprovements >= 1);
  assert.equal(report.exercises[0].recommendation.confidence, "low");
});

test("daily report distinguishes a recovery day from a scheduled workout without a log", () => {
  const data = training.emptyData();
  data.profile = { bodyweight: 80, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  const recovery = reports.buildDailyReport(data, "2026-09-06");
  assert.equal(recovery.status, "recovery");
  assert.equal(recovery.completionPercent, 0);
  assert.match(recovery.summary, /does not grade rest/i);
  const missed = reports.buildDailyReport(data, "2026-09-01");
  assert.equal(missed.status, "missed");
  assert.match(missed.summary, /saved training schedule/i);
});

test("schedule adherence counts due days without inventing reports for missing workouts", () => {
  const data = training.emptyData();
  data.profile = { bodyweight: 80, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  data.setupCompletedAt = "2026-08-31T08:00:00.000Z";
  data.program.frequency = 3;
  data.program.preferredWeekdays = [1, 3, 5];
  data.planHistory = [{ id: "setup", effectiveAt: data.setupCompletedAt, kind: "setup", programId: "phase1", week: 1, frequency: 3, preferredWeekdays: [1, 3, 5], track: "current", goal: "balanced", equipment: "full", status: "active" }];
  const day = training.programDays("phase1", 3, "current")[0];
  const snapshot = training.buildSessionPlanSnapshot(data, day, "phase1", 1, 3);
  const entries = Object.fromEntries(snapshot.exercises.map((exercise) => [exercise.key, Array.from({ length: exercise.sets }, () => ({ w: exercise.loadingType === "external" || exercise.loadingType === "assisted-bodyweight" ? "20" : "", r: String(exercise.repLow), rir: "2" }))]));
  data.sessions = [{ id: "monday", logicalKey: "monday", date: "2026-08-31", dayId: day.id, unit: "kg", entries, planSnapshot: snapshot, completionStatus: "completed", revision: 1, createdAt: "2026-08-31T10:00:00.000Z", updatedAt: "2026-08-31T11:00:00.000Z" }];
  const adherence = reports.buildScheduleAdherence(data, "2026-08-31", "2026-09-06", "2026-09-02");
  assert.deepEqual(adherence, { available: true, expectedSessions: 2, completedSessions: 1, loggedSessions: 1, adherencePercent: 50, movedSessions: 0, skippedSessions: 0, externalSessions: 0, plannedBreakDays: 0 });
});

test("training elsewhere fulfills schedule adherence without creating performance data", () => {
  const data = training.emptyData();
  data.profile = { bodyweight: 80, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  data.setupCompletedAt = "2026-08-31T08:00:00.000Z";
  data.program.frequency = 3;
  data.program.preferredWeekdays = [1, 3, 5];
  data.planHistory = [{ id: "setup", effectiveAt: data.setupCompletedAt, kind: "setup", programId: "phase1", week: 1, frequency: 3, preferredWeekdays: [1, 3, 5], track: "current", goal: "balanced", equipment: "full", status: "active" }];
  data.absences = [{ id: "external", startDate: "2026-09-02", endDate: "2026-09-02", missedDates: ["2026-09-02"], reason: "busy", resolution: "trained-elsewhere", programId: "phase1", frequency: 3, resolvedDayIds: ["D1"], createdAt: "2026-09-02T12:00:00.000Z", updatedAt: "2026-09-02T12:00:00.000Z" }];
  const adherence = reports.buildScheduleAdherence(data, "2026-08-31", "2026-09-02", "2026-09-02");
  assert.equal(adherence.expectedSessions, 2);
  assert.equal(adherence.loggedSessions, 0);
  assert.equal(adherence.externalSessions, 1);
  assert.equal(adherence.completedSessions, 1);
  assert.equal(adherence.adherencePercent, 50);
});

test("external-load volume counts both sides and excludes pseudo-strength estimates", () => {
  const perSide = { ...exercise, perSide: true };
  assert.equal(training.externalLoadVolume(perSide, 20, 10), 400);
  assert.equal(training.externalLoadVolume({ ...exercise, perSide: false }, 20, 10), 200);
  assert.equal(training.supportsEstimatedMax({ ...exercise, name: "Push-up", bodyweight: true, loadingType: "bodyweight" }), false);
  assert.equal(training.supportsEstimatedMax({ ...exercise, name: "Pull-up", bodyweight: true, loadingType: "bodyweight" }), true);
});

test("a performance improvement becomes established only after it repeats", () => {
  const base = training.emptyData();
  base.profile = { bodyweight: 80, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  const day = training.programDays("phase1", 5, "current")[0];
  const exercise = day.exercises[0];
  const key = training.exerciseKey(exercise, {});
  const makeSession = (id, date, load) => ({ id, date, dayId: day.id, unit: "kg", entries: { [key]: Array.from({ length: exercise.sets }, () => filled(load, Math.min(10, exercise.repHigh), 2)) }, programId: "phase1", revision: 1, createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T11:00:00.000Z` });
  base.sessions = [makeSession("baseline", "2026-08-20", 70), makeSession("first-signal", "2026-08-27", 75), makeSession("repeat", "2026-09-02", 75)];
  const report = reports.buildDailyReport(base, "2026-09-02");
  assert.equal(report.performanceImprovements, 1);
  assert.match(report.headline, /repeated a positive performance trend/i);
});

test("new session context fields survive validation while invalid values are discarded", () => {
  const migrated = training.normalizeTrainingData({
    profile: { bw: 80, unit: "kg", level: "some" },
    sessions: [{ id: "valid", date: "2026-09-01", dayId: "UA", unit: "kg", entries: {}, readiness: "sore", sessionRpe: 8, startedAt: "2026-09-01T10:00:00.000Z", completedAt: "2026-09-01T11:00:00.000Z", durationSeconds: 3600 }],
  });
  assert.equal(migrated.sessions[0].readiness, "sore");
  assert.equal(migrated.sessions[0].sessionRpe, 8);
  assert.equal(migrated.sessions[0].durationSeconds, 3600);
});

test("timer and theme integration use persistent, non-blocking platform behavior", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(source, /reparc-rest-timer:/);
  assert.match(source, /serviceWorker\.ready/);
  assert.match(source, /showNotification/);
  assert.doesNotMatch(source, /new Notification\(/);
  assert.match(source, /scroll-mt-24 lg:hidden/);
  assert.match(source, /hidden w-\[22rem\] lg:block/);
  assert.match(serviceWorker, /notificationclick/);
  assert.match(layout, /ThemeProvider/);
  assert.match(source, /System.*Light.*Dark/s);
});

test("focused training locks forward navigation and keeps secondary controls compact", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(source, /lastAccessibleExerciseIndex/);
  assert.match(source, /Complete every kg and reps field/);
  assert.match(source, /disabled=\{activeExerciseIndex === day\.exercises\.length - 1 \|\| !exerciseIsComplete/);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /reparc-session-start:/);
  assert.match(source, /<details className="mt-4 rounded-2xl[^>]+aria-label="Session effort"/);
  assert.doesNotMatch(source, /<Scale className=/);
});

test("progress shows one navigable report and the light theme covers custom controls", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /selectedBuckets/);
  assert.match(source, /selectedWeekDates/);
  assert.match(source, /Jump to date/);
  assert.match(source, /Analysis and next-session guidance/);
  assert.doesNotMatch(source, /Show older/);
  assert.match(source, /Under 1 min/);
  assert.match(source, /In progress/);
  assert.match(source, /Final report/);
  assert.match(source, /No workouts logged this \{range\}/);
  assert.match(source, /Exercises &amp; progression/);
  assert.match(source, /reportGroups/);
  assert.match(css, /html\.light \.set-input/);
  assert.match(css, /html\.light \.selection-button\[data-selected="true"\]/);
  assert.match(css, /html\.light \.target-panel/);
});

test("foreground rest completion runs a ten-second alert pattern", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(source, /playChime\(testOnly \? 2 : 10\)/);
  assert.match(source, /length: 13/);
  assert.match(source, /setAppBadge/);
  assert.match(source, /silent: false/);
  assert.match(source, /restAlertLevel === "maximum"/);
  assert.match(source, /peak = maximum \? 0\.92/);
  assert.match(source, /createDynamicsCompressor/);
  assert.match(source, /oscillator\.type = maximum \? "square"/);
});

test("workout alarm mode keeps visible sessions awake and recovers overdue timers", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(source, /wakeLock\.request\("screen"\)/);
  assert.match(source, /shouldKeepScreenAwake/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /Math\.max\(-599, Math\.ceil/);
  assert.match(source, /Rest completed \$\{displaySeconds\} seconds ago/);
  assert.match(source, /Alarm readiness/);
  assert.match(source, /Exact offline alarm/);
  assert.match(source, /Native app only/);
  assert.match(source, /Run alert test/);
});

test("setup uses compact drill-down navigation without a sideways category strip", async () => {
  const app = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  const tools = await readFile(new URL("../components/settings-tools.tsx", import.meta.url), "utf8");
  assert.match(app, /Training plan/);
  assert.match(app, /App preferences/);
  assert.match(app, /Back to Setup/);
  assert.match(app, /profileSection/);
  assert.match(app, /aria-expanded=\{profileSection === value\}/);
  assert.match(app, /profileSection === "identity" &&\s*<article style=\{\{ order: 1 \}\}/);
  assert.match(app, /profileSection === "measurements" && <div style=\{\{ order: 3 \}\}/);
  assert.match(app, /profileSection === "experience" &&\s*<article style=\{\{ order: 5 \}\}/);
  assert.doesNotMatch(app, /aria-label="Setup sections"/);
  assert.match(tools, /toolSection/);
  assert.match(tools, /Data and account tools/);
  assert.match(tools, /aria-expanded=\{toolSection === value\}/);
  assert.match(tools, /style=\{\{ order: index \* 2 \}\}/);
  assert.match(tools, /toolSection === "account" && <article style=\{\{ order: 1 \}\}/);
});
