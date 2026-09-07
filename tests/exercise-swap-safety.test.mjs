import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const t = await vite.ssrLoadModule("/lib/training.ts");
const swaps = await vite.ssrLoadModule("/lib/exercise-swaps.ts");
const nav = await vite.ssrLoadModule("/lib/training-navigation.ts");
const metadata = await vite.ssrLoadModule("/lib/exercise-metadata.ts");
const calibration = await vite.ssrLoadModule("/lib/exercise-calibration.ts");
const fixture = () => ({ ...t.emptyData(), profile: { displayName: "Test", bodyweight: 75, unit: "kg", level: "experienced", gender: "man", programTrack: "current", goal: "balanced", equipment: "full", weightGoal: "maintain", weightTrackingEnabled: true } });

test("all offered swaps preserve programming role across both tracks, phases, schedules and equipment", () => {
  let checked = 0;
  for (const phase of ["phase1", "phase2"]) for (const track of ["current", "women"]) for (const frequency of [3,4,5]) for (const equipment of ["home", "limited", "full"]) for (const goal of ["balanced", "strength", "upper", "lower"]) {
    for (const day of t.programDays(phase, frequency, track, goal, equipment)) for (const exercise of day.exercises) {
      assert.ok(metadata.exerciseMetadata(exercise.name), exercise.name);
      assert.ok(exercise.alternatives.length > 0, `No alternative for ${exercise.name}`);
      for (const name of exercise.alternatives) {
        assert.ok(metadata.exerciseMetadata(name), name);
        assert.ok(swaps.isDirectSwap(exercise.name, name), `${exercise.name} -> ${name}`);
        assert.ok(!["Nordic curl", "Good morning", "Sissy squat", "Wall sit"].includes(name));
        checked++;
      }
      if (exercise.defaultVariant) assert.ok(swaps.isDirectSwap(exercise.name, exercise.defaultVariant));
    }
  }
  assert.ok(checked > 1000);
});

test("different emphasis, static holds and separately dosed exercises cannot masquerade as direct swaps", () => {
  for (const [base, candidate] of [["Seated cable row", "Lat pulldown"], ["Leg extension", "Goblet squat"], ["Leg extension", "Wall sit"], ["Lateral raise", "Reverse pec deck"], ["Hip abduction", "Cable kickback"], ["Hip thrust", "Cable kickback"], ["Seated leg curl", "Nordic curl"], ["Romanian deadlift", "Good morning"], ["Cable crunch", "Dead bug"], ["Unknown", "Unknown"]]) assert.equal(swaps.isDirectSwap(base, candidate), false, `${base} -> ${candidate}`);
  assert.equal(swaps.isDirectSwap("Seated cable row", "Chest-supported row"), true);
  assert.equal(swaps.isDirectSwap("Seated leg curl", "Slider leg curl"), true);
});

test("new equipment fallbacks use repetitions and retain rear-delt/hip-extension roles", () => {
  assert.ok(swaps.exerciseSwapOptions("Leg extension", [], "home").includes("Spanish squat"));
  assert.deepEqual(swaps.exerciseSwapOptions("Cable rear-delt fly", [], "home"), ["Dumbbell rear-delt fly"]);
  assert.deepEqual(swaps.exerciseSwapOptions("Cable kickback", [], "home"), ["Band kickback"]);
  // Removed menu choices still resolve old history with the original identity.
  assert.equal(t.exerciseFromKey("la3:Nordic curl").name, "Nordic curl");
  assert.equal(t.exerciseFromKey("uc2:Lat pulldown").name, "Lat pulldown");
});

test("navigation skip is separate from completion, supports undo and never mutates entries", () => {
  const keys = ["a", "b", "c"], complete = [false, false, false];
  assert.equal(nav.lastAccessibleExercise(keys, complete, []), 0);
  assert.equal(nav.lastAccessibleExercise(keys, complete, ["a"]), 1);
  assert.equal(nav.lastAccessibleExercise(keys, complete, ["a", "b", "c"]), 2);
  assert.equal(nav.lastAccessibleExercise(keys, complete, ["wrong-key"]), 0);
  assert.deepEqual(complete, [false, false, false]);
  assert.deepEqual(nav.normalizeSkippedExercises(["a", "a", null, {}, "", "b"]), ["a", "b"]);
});

test("skipped SBS lifts cannot advance maxes, completion or calibration even with full entered sets", () => {
  const data = fixture(); data.program.activeId = "phase2";
  const day = t.programDays("phase2")[0], exercise = day.exercises[0];
  const planSnapshot = t.buildSessionPlanSnapshot(data, day, "phase2", 1, 5);
  const key = planSnapshot.exercises[0].key;
  data.program.trainingMaxes[key] = 100;
  for (const date of ["2026-08-01", "2026-08-05", "2026-08-09"]) data.sessions.push({ id: date, date, dayId: day.id, unit: "kg", programId: "phase2", programWeek: 1, planSnapshot, trainingMaxesBefore: {[key]:100}, entries: {[key]: Array.from({length:4},()=>({w:"60",r:"20",rir:"4"}))}, completionStatus:"completed", affectsProgression:true, skippedExerciseKeys:[key], revision:1, createdAt:`${date}T10:00:00Z`,updatedAt:`${date}T10:00:00Z` });
  const normalized = t.normalizeTrainingData(data);
  assert.deepEqual(normalized.sessions[0].skippedExerciseKeys,[key]);
  assert.deepEqual(normalized.sessions[0].entries,data.sessions[0].entries);
  assert.equal(t.sessionCountsAsCompletedDay(normalized.sessions[0], normalized),false);
  assert.equal(t.recalculatePhase2Progression(normalized).program.trainingMaxes[key],100);
  assert.notEqual(calibration.exerciseCalibration(normalized,exercise,"2026-08-12").state,"calibrated");
});

test("UI wires skip separately from save completion and retains fixed SBS guards", async () => {
  const app = await readFile(new URL("../components/training-app.tsx", import.meta.url), "utf8");
  assert.match(app, /Skip \/ stop exercise/);
  assert.match(app, /!skippedExerciseKeys.length && completedSetCount >= plannedSets/);
  assert.match(app, /skippedExerciseKeys: \[\.\.\.skippedExerciseKeys\]/);
  assert.match(app, /key.startsWith\("_skip:"\)/);
  assert.match(app, /workingProgramId === "phase2" && exercise.sbsRole/);
});
