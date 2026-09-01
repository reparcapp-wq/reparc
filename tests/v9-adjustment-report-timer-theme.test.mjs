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
  assert.ok(report.performanceImprovements >= 1);
  assert.equal(report.exercises[0].recommendation.confidence, "low");
});

test("daily report treats a day without a session as recovery rather than failure", () => {
  const data = training.emptyData();
  data.profile = { bodyweight: 80, unit: "kg", level: "intermediate", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true };
  const report = reports.buildDailyReport(data, "2026-09-01");
  assert.equal(report.status, "recovery");
  assert.equal(report.completionPercent, 0);
  assert.match(report.summary, /does not grade rest/i);
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

test("progress uses progressive disclosure and the light theme covers custom controls", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /visibleBuckets/);
  assert.match(source, /Analysis and next-session guidance/);
  assert.match(source, /Show older/);
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
});
