import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ configFile: false, appType: "custom", root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const a = await vite.ssrLoadModule("/lib/autoregulation.ts");
const h = await vite.ssrLoadModule("/lib/history-start.ts");
const c = await vite.ssrLoadModule("/lib/exercise-calibration.ts");
const daily = await vite.ssrLoadModule("/lib/daily-report.ts");
const analysis = await vite.ssrLoadModule("/lib/progress-analysis.ts");
const muscles = await vite.ssrLoadModule("/lib/muscle-volume.ts");
const timing = await vite.ssrLoadModule("/lib/session-duration.ts");
const close = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const date = "2026-10-20";
const ex = { id: "row", name: "Seated cable row", sets: 3, repLow: 8, repHigh: 12, loadingType: "external", restSeconds: 120, alternatives: [], primaryMuscles: ["back"], secondaryMuscles: ["biceps"], metadataVersion: 1 };
const filled = (w = 40, r = 12, rir = 4) => ({ w: String(w), r: String(r), rir: String(rir) });
function fixture(exercise = ex, sourceDate = "2026-09-20") {
  const data = { ...t.emptyData(), profile: { displayName: "Synthetic", bodyweight: 70, unit: "kg", level: "experienced", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "bulk", weightTrackingEnabled: true } };
  const day = { id: "TEST", name: "Synthetic", focus: "Test", weekday: 2, lower: false, exercises: [exercise] };
  const planSnapshot = { ...t.buildSessionPlanSnapshot(data, day), exercises: [{ ...exercise, key: exercise.id }] };
  const at = `${sourceDate}T10:00:00Z`;
  data.sessions = [{ id: "source", date: sourceDate, scheduledDate: sourceDate, dayId: day.id, unit: "kg", planSnapshot,
    entries: { [exercise.id]: Array.from({ length: exercise.sets }, () => filled()) }, readiness: "normal", bodyweightAtSession: 70,
    completionStatus: "completed", revision: 1, createdAt: at, updatedAt: at }];
  return data;
}
function start(data, exercise = ex, availableLoads = Array.from({ length: 200 }, (_, i) => (i + 1) / 2)) {
  return h.historyStartingSuggestion({ data, exercise, date, unit: data.profile.unit, calibration: { state: "developing", recoveryPending: false },
    targetReps: 8, targetRir: 4, availableLoads, readiness: "normal" });
}

test("math oracle: exact pound definition, 500 unit round trips and load-volume unit scaling", () => {
  close(t.convertWeight(100, "lb", "kg"), 45.359237);
  for (let i = 1; i <= 500; i++) {
    const kg = i * .37;
    close(t.convertWeight(t.convertWeight(kg, "kg", "lb"), "lb", "kg"), kg);
    close(t.externalLoadVolume({ ...ex, perSide: true }, t.convertWeight(kg, "kg", "lb"), 8) * .45359237, kg * 8 * 2);
  }
});

test("math oracle: equipment rounding is a saved choice, never heavier than the target", () => {
  const ladder = [2.5, 5, 7.5, 10, 12.5, 20, 40];
  for (let target = .1; target <= 50; target += .13) {
    const expected = ladder.filter((w) => w <= target).at(-1) ?? null;
    assert.equal(c.loadAtOrBelow(target, ladder), expected);
    assert.equal(t.resolveAvailableLoad(target, ladder, "higher"), ladder.find((w) => w > target + .0001) ?? null);
  }
});

test("math oracle: return age boundaries use one factor and stale records do not create a working weight", () => {
  for (const [age, factor] of [[7, .9], [13, .9], [14, .9], [27, .9], [28, .85], [55, .85], [56, .8], [180, .8]]) {
    const source = new Date(Date.parse(`${date}T12:00:00Z`) - age * 86400000).toISOString().slice(0, 10);
    const data = fixture(ex, source);
    assert.equal(start(data).value, 40 * factor, `gap ${age}`);
    data.program.returnPlan = t.buildReturnPlan(Math.max(28, age), "planned", `${date}T01:00:00Z`);
    assert.equal(start(data).value, 40 * Math.min(factor, age >= 56 ? .8 : .85));
  }
  assert.equal(start(fixture(ex, "2026-04-21")).value, null);
});

test("math oracle: assistance/bodyweight algebra and rounding preserve the reduced resistance ceiling", () => {
  const assisted = { ...ex, name: "Assisted pull-up", loadingType: "assisted-bodyweight", bodyweight: true };
  const weighted = { ...ex, name: "Pull-up", loadingType: "bodyweight", bodyweight: true };
  const ladder = Array.from({ length: 300 }, (_, i) => (i + 1) / 2);
  for (const oldBw of [60, 70, 90, 110]) for (const currentBw of [60, 70, 90, 110]) {
    const data = fixture(assisted); data.profile.bodyweight = currentBw; data.sessions[0].bodyweightAtSession = oldBw;
    data.sessions[0].entries.row = Array.from({ length: 3 }, () => filled(20));
    const result = start(data, assisted, ladder);
    if (result.value !== null) {
      assert.ok(result.value >= 20 && result.value < currentBw);
      assert.ok(currentBw - result.value <= (oldBw - 20) * .85 + 1e-8);
    }
    const added = fixture(weighted); added.profile.bodyweight = currentBw; added.sessions[0].bodyweightAtSession = oldBw;
    added.sessions[0].entries.row = Array.from({ length: 3 }, () => filled(30));
    const target = start(added, weighted, ladder);
    if (target.value !== null) assert.ok(currentBw + target.value <= (oldBw + 30) * .85 + 1e-8);
  }
});

test("first time in a program can use the identical exercise, never another exercise's kg", () => {
  for (const track of ["current", "women"]) for (const phase of ["phase1", "phase2"]) {
    const data = fixture(); data.profile.programTrack = track; data.program.activeId = phase;
    assert.equal(start(data, { ...ex, id: "new-slot" }).value, 34);
    assert.equal(start(data, { ...ex, id: "new-slot", name: "Machine chest press" }), null);
    data.sessions = []; assert.equal(start(data), null);
  }
});

test("missing an exercise cannot be cancelled out by extra sets of a different exercise", () => {
  const data = fixture(); const session = data.sessions[0];
  session.planSnapshot.exercises.push({ ...ex, id: "curl", key: "curl", name: "Dumbbell curl" });
  session.entries.row = Array.from({ length: 6 }, () => filled());
  assert.equal(t.sessionCompletedSets(session), 6, "Actual performed sets remain six");
  assert.equal(t.sessionCountsAsCompletedDay(session, data), false);
  const report = daily.buildDailyReport(data, session.date);
  assert.equal(report.completedSets, 6);
  assert.equal(report.completionPercent, 50, "Only three of six prescribed positions were filled");
  assert.notEqual(report.status, "completed");
});

test("external-load volume excludes counterweight assistance and unloaded movement", () => {
  assert.equal(t.externalLoadVolume(ex, 40, 10), 400);
  assert.equal(t.externalLoadVolume({ ...ex, perSide: true }, 10, 12), 240);
  assert.equal(t.externalLoadVolume({ ...ex, loadingType: "bodyweight" }, 10, 8), 80, "Added weight only, not guessed bodyweight");
  assert.equal(t.externalLoadVolume({ ...ex, loadingType: "assisted-bodyweight" }, 30, 10), 0);
  assert.equal(t.externalLoadVolume({ ...ex, loadingType: "unloaded" }, 30, 10), 0);
});

test("assisted progression cannot increase difficulty when repetitions miss the lower target", () => {
  const exercise = { ...ex, name: "Assisted pull-up", loadingType: "assisted-bodyweight", bodyweight: true };
  const input = { exercise, unit: "kg", bodyweight: 70, readiness: "normal", availableLoads: [27.5, 30, 35, 80] };
  const entries = Array.from({ length: 3 }, () => filled(30, 5, 4));
  assert.equal(a.nextSessionAdjustment({ ...input, entries }).action, "hold");
  const failed = [filled(35, 5, 0)];
  assert.equal(a.nextSetAdjustment({ ...input, entries: failed }).nextLoad, null, "Do not prescribe assistance >= recorded bodyweight");
});

test("varying external set weights do not establish a single increased next-session working weight", () => {
  const result = a.nextSessionAdjustment({ exercise: ex, entries: [filled(40), filled(40), filled(35)], unit: "kg", readiness: "normal", availableLoads: [30, 35, 40, 42.5] });
  assert.notEqual(result.action, "increase");
  assert.equal(result.nextLoad, null, "Do not turn a lighter back-off set into a heavier fixed prescription");
});

test("bodyweight trend counts distinct days and excludes future records and superseded deletions", () => {
  const data = fixture();
  const weigh = (id, day, weight, updatedAt = `${day}T10:00:00Z`) => ({ id, date: day, weight, unit: "kg", createdAt: updatedAt, updatedAt });
  data.weighIns = [weigh("a", "2026-10-19", 60), weigh("b", "2026-10-19", 80, "2026-10-19T11:00:00Z"), weigh("future", "2026-10-21", 100),
    weigh("deleted", "2026-10-18", 200), { ...weigh("deleted", "2026-10-18", 200, "2026-10-18T11:00:00Z"), deletedAt: "2026-10-18T11:00:00Z" }];
  const trend = t.weightTrend(data, "kg", date);
  assert.equal(trend.recentCount, 1); assert.equal(trend.latestAverage, 80);
  assert.equal(trend.entries.length, 1);
  assert.equal(trend.weeklyChangePercent, null, "Unknown comparison must not be reported as zero change");
});

test("bodyweight percent comparison needs three distinct days in BOTH weekly windows", () => {
  const data = fixture();
  data.weighIns = ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-12"].map((day, i) => ({ id: day, date: day, weight: i === 3 ? 70 : 77, unit: "kg", createdAt: day, updatedAt: day }));
  assert.equal(t.weightTrend(data, "kg", date).weeklyChangePercent, null);
  for (const day of ["2026-10-11", "2026-10-13"]) data.weighIns.push({ id: day, date: day, weight: 70, unit: "kg", createdAt: day, updatedAt: day });
  close(t.weightTrend(data, "kg", date).weeklyChangePercent, 10);
});

test("hand-calculated report totals, effort missingness, duration and muscle attribution agree", () => {
  const data = fixture({ ...ex, perSide: true }, "2026-10-19"); const session = data.sessions[0];
  session.entries.row = [filled(10, 8, 2), filled(10, 10, 4), { w: "10", r: "12", rir: "" }];
  session.durationSeconds = 1200; session.startedAt = "2026-10-19T09:40:00Z"; session.completedAt = "2026-10-19T10:00:00Z";
  const before = JSON.stringify(data);
  const report = daily.buildDailyReport(data, "2026-10-19");
  assert.equal(report.loadedVolume, 600); assert.equal(report.totalReps, 30); assert.equal(report.averageRir, 3);
  assert.equal(report.rirCoveragePercent, 67); assert.equal(report.totalDurationSeconds, 1200);
  const review = analysis.buildProgressAnalysis(data, "day", "2026-10-19", date);
  assert.equal(review.counts.sets, 3); assert.equal(review.counts.rirCoverage, 67); assert.equal(review.measuredDurationSeconds, 1200);
  const volume = muscles.weeklyMuscleVolume(data, "2026-10-19", "2026-10-25");
  assert.equal(volume.rows.find((row) => row.muscle === "back").direct, 3);
  assert.equal(volume.rows.find((row) => row.muscle === "biceps").indirect, 3);
  assert.equal(JSON.stringify(data), before, "Reports must be read-only");
  assert.equal(timing.measuredSessionDuration({ ...session, durationSeconds: 59 }), null);
  assert.equal(timing.measuredSessionDuration({ ...session, durationSeconds: 43201 }), null);
});

test("backdated weigh-ins do not replace current recommendation bodyweight and today's entry converts units", () => {
  const data = fixture();
  const entry = { id: "backdated", date: "2026-09-10", weight: 60, unit: "kg", createdAt: date, updatedAt: date };
  const backdated = t.applyWeighIn(data, entry, date);
  assert.equal(backdated.profile.bodyweight, 70); assert.equal(backdated.weighIns.length, 1);
  const current = t.applyWeighIn(backdated, { ...entry, date, unit: "lb", weight: 154.3235835294143 }, date);
  close(current.profile.bodyweight, 70); assert.equal(current.weighIns.length, 1);
  assert.throws(() => t.applyWeighIn(data, { ...entry, date: "2026-10-21" }, date));
  assert.equal(data.weighIns.length, 0);
});

test("mixed-load failures reduce below the failed set rather than the unrelated median", () => {
  const result = a.nextSessionAdjustment({ exercise: ex, entries: [filled(40), filled(40), filled(30, 5, 0)], unit: "kg", readiness: "normal", availableLoads: [25, 30, 35, 40, 42.5] });
  assert.equal(result.action, "decrease"); assert.equal(result.nextLoad, 25);
  const exercise = { ...ex, loadingType: "assisted-bodyweight", bodyweight: true };
  const assisted = a.nextSessionAdjustment({ exercise, entries: [filled(35, 5, 0), filled(30), filled(30)], unit: "kg", bodyweight: 70, readiness: "normal", availableLoads: [25, 30, 35, 40] });
  assert.equal(assisted.action, "decrease"); assert.equal(assisted.nextLoad, 40);
});

test("a protected developing exposure is calibration, not a comparable performance gain", () => {
  const data = fixture(); const prior = data.sessions[0];
  prior.exerciseExposures = { row: { policyVersion: 1, identity: t.loadProfileId(ex), stateAtStart: "developing", prescribedSets: 3, targetRir: 4, progressionEligible: true } };
  const next = structuredClone(prior); next.id = "next"; next.date = "2026-10-19"; next.scheduledDate = next.date; next.createdAt = "2026-10-19T10:00:00Z";
  next.entries.row = Array.from({ length: 3 }, () => filled(50)); next.exerciseExposures.row.progressionEligible = false;
  data.sessions.push(next);
  const review = analysis.buildProgressAnalysis(data, "day", next.date, date);
  assert.equal(review.exercises[0].trend, "calibration");
});

test("all SBS weeks and TM change bands remain finite, bounded and match the documented piecewise rule", () => {
  for (const role of ["main", "auxiliary"]) for (let week = 1; week <= 21; week++) {
    const p = t.sbsPrescription(role, week);
    assert.ok(p.intensity > 0 && p.intensity < 1 && p.normalReps >= 1);
    assert.equal(p.deload, [7, 14, 21].includes(week));
  }
  for (let difference = -20; difference <= 30; difference++) {
    const expected = difference <= -2 ? -.05 : difference === -1 ? -.02 : difference === 0 ? 0 : difference <= 4 ? difference * .005 : .03;
    close(t.sbsTrainingMaxChange(20 + difference, 20), expected);
  }
});

test("bodyweight upper-limit conversion survives profile, session and weigh-in normalization", () => {
  const data = fixture(); data.profile.bodyweight = 300;
  data.sessions[0].bodyweightAtSession = 300;
  data.weighIns = [{ id: "max", date: "2026-09-20", weight: 300, unit: "kg", createdAt: "2026-09-20T10:00:00Z", updatedAt: "2026-09-20T10:00:00Z" }];
  data.profile.unit = "lb"; data.profile.bodyweight = 300 / .45359237;
  data.sessions[0] = t.sessionInUnit(data.sessions[0], "lb");
  data.weighIns[0] = { ...data.weighIns[0], unit: "lb", weight: 300 / .45359237 };
  const normalized = t.normalizeTrainingData(data);
  close(normalized.profile.bodyweight * .45359237, 300);
  close(normalized.sessions[0].bodyweightAtSession * .45359237, 300);
  close(normalized.weighIns[0].weight * .45359237, 300);
  assert.equal(t.isBodyweightInRange(25 / .45359237, "lb"), true);
  assert.equal(t.isBodyweightInRange(300 / .45359237, "lb"), true);
  assert.equal(t.isBodyweightInRange(300.1 / .45359237, "lb"), false);
  assert.deepEqual(t.bodyweightInputRange("lb"), { minimum: 55.12, maximum: 661.38 });
});

test("dashboard and analysis use the same distinct-day averages and deterministic duplicate tie", () => {
  const data = fixture();
  for (const day of ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-18", "2026-10-19", "2026-10-20"]) data.weighIns.push({ id: day,
    date: day, unit: "kg", weight: day < "2026-10-14" ? 70 : 80, createdAt: day, updatedAt: day });
  data.weighIns.push({ ...data.weighIns.at(-1), id: "a", weight: 60 }, { ...data.weighIns.at(-1), id: "z", weight: 80 });
  const trend = t.weightTrend(data, "kg", date);
  const review = analysis.buildProgressAnalysis(data, "day", date, date);
  assert.equal(trend.latestAverage, review.weight.current);
  assert.equal(trend.previousAverage, review.weight.prior);
  close(trend.weeklyChangePercent, (review.weight.current - review.weight.prior) / review.weight.prior * 100);
  assert.equal(trend.recentCount, 3); assert.equal(trend.previousCount, 3);
});

test("save and period-summary UI use prescribed positions, not raw extra-set totals", async () => {
  const source = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(source, /const completedSetCount = completedPlanSets\(planSnapshot, entries\)/);
  assert.match(source, /report\.completedPlannedSets/);
  assert.match(source, /applyWeighIn\(data, entry, today\(\)\)/);
});
