import {
  activeSessions, buildSessionPlanSnapshot, comparableExerciseHistory, exerciseFromKey, exerciseKey, isFilledSet,
  loadProfileId, numeric, programDays, resolveExerciseVariant, returnPlanSetCount, slugify,
  type Exercise, type ExerciseCalibrationState, type ExerciseExposureSnapshot,
  type ExerciseNoveltyRisk, type ExerciseRecoveryStatus, type Readiness, type SetEntry, type TrainingData, type TrainingDay,
} from "./training";
import type { LoadAdjustment } from "./autoregulation";

// Versioned product guardrails. These exact thresholds are not validated clinical cutoffs.
export const EXPOSURE_POLICY = { version: 1, sessionNoveltyUnits: 6, muscleNoveltyUnits: 4, recoveryHours: 48 } as const;
export const CALIBRATION_LABELS: Record<ExerciseCalibrationState, string> = {
  uncalibrated: "New exercise", preliminary: "Getting familiar", developing: "Building consistency",
  calibrated: "Established history", recalibration: "Rebuild gradually",
};

// Familiarity is deliberately separate from loadProfileId: it NEVER transfers kilograms.
// Unknown movements get no family credit. The registry uses exact names, not name inference.
const families: Array<[string, string, ExerciseNoveltyRisk, string[]]> = [
  ["chest-press", "chest", "moderate", ["Incline dumbbell press", "Incline barbell press", "Incline machine press", "Barbell bench press", "Flat dumbbell press", "Machine chest press", "Dumbbell floor press", "Smith machine bench press", "Push-up", "Incline push-up"]],
  ["chest-fly", "chest", "moderate", ["Pec deck", "Cable fly", "Cable crossover", "Dumbbell fly"]],
  ["overhead-press", "shoulders", "moderate", ["Dumbbell overhead press", "Seated dumbbell press", "Seated dumbbell shoulder press", "Standing dumbbell press", "Machine shoulder press", "Barbell overhead press", "Pike push-up"]],
  ["row", "back", "moderate", ["Chest-supported row", "Chest-supported dumbbell row", "Seated cable row", "Cable row", "One-arm dumbbell row", "Dumbbell row", "Machine row", "T-bar row", "Barbell row", "Band row"]],
  ["vertical-pull", "back", "moderate", ["Lat pulldown", "Neutral-grip pulldown", "Single-arm pulldown", "Pull-up", "Assisted pull-up", "Chin-up", "Band pulldown"]],
  ["knee-dominant", "quads", "moderate", ["Barbell squat", "High-bar squat", "Front squat", "Safety-bar squat", "Goblet squat", "Hack squat", "Pendulum squat", "Leg press", "Smith machine squat"]],
  ["unilateral-knee", "quads", "high", ["Bulgarian split squat", "Split squat", "Dumbbell split squat", "Walking lunge", "Reverse lunge", "Step-up"]],
  ["hinge", "hamstrings", "high", ["Romanian deadlift", "Dumbbell RDL", "Kickstand RDL", "Good morning", "Deadlift", "Trap-bar deadlift", "Block pull", "Rack pull"]],
  ["knee-flexion", "hamstrings", "moderate", ["Seated leg curl", "Lying leg curl", "Leg curl", "Slider leg curl"]],
  ["eccentric-knee-flexion", "hamstrings", "high", ["Nordic curl", "Nordic hamstring curl"]],
  ["knee-extension", "quads", "moderate", ["Leg extension", "Spanish squat", "Sissy squat", "Wall sit"]],
  ["hip-extension", "glutes", "moderate", ["Hip thrust", "Barbell hip thrust", "Machine hip thrust", "Glute bridge", "Dumbbell glute bridge", "Cable pull-through", "Reverse hyper", "Quadruped hip extension", "Cable kickback", "Band kickback"]],
  ["hip-abduction", "glutes", "low", ["Hip abduction", "Machine hip abduction", "Cable abduction", "Band hip abduction", "Side-lying leg raise"]],
  ["calves", "calves", "moderate", ["Standing calf raise", "Seated calf raise", "Leg press calf raise", "Single-leg calf raise"]],
  ["elbow-flexion", "biceps", "low", ["Dumbbell curl", "Barbell curl", "EZ-bar curl", "Cable curl", "Band curl", "Hammer curl", "Preacher curl", "Concentration curl", "Incline dumbbell curl"]],
  ["elbow-extension", "triceps", "low", ["Triceps pushdown", "Rope pushdown", "Straight-bar pushdown", "Band pushdown", "Overhead triceps extension", "Dumbbell overhead extension", "Cable overhead extension"]],
  ["lateral-raise", "shoulders", "low", ["Lateral raise", "Dumbbell lateral raise", "Cable lateral raise", "Machine lateral raise", "Band lateral raise"]],
  ["rear-delt", "shoulders", "low", ["Reverse pec deck", "Dumbbell reverse fly", "Dumbbell rear-delt fly", "Cable rear-delt fly", "Face pull", "Band pull-apart"]],
  ["trunk", "trunk", "low", ["Cable crunch", "Machine crunch", "Reverse crunch", "Dead bug", "Hanging leg raise", "Hanging knee raise", "Captain's chair leg raise"]],
];
const registry = new Map(families.flatMap(([family, muscle, risk, names]) => names.map((name) => [slugify(name), { family, muscle, risk }] as const)));
export const exerciseFamiliarity = (exercise: Exercise) => registry.get(slugify(exercise.name))
  ?? { family: `unknown:${loadProfileId(exercise)}`, muscle: "other", risk: "high" as const };
const daysBetween = (earlier: string, later: string) => Math.max(0, Math.floor((Date.parse(`${later.slice(0, 10)}T12:00:00Z`) - Date.parse(`${earlier.slice(0, 10)}T12:00:00Z`)) / 86_400_000));
const goodRecovery = (status?: ExerciseRecoveryStatus) => status === "recovered" || status === "mild";

export function exerciseCalibration(data: TrainingData, exercise: Exercise, date: string) {
  const identity = loadProfileId(exercise);
  const history = comparableExerciseHistory(data, exercise).filter(({ session }) => session.date < date);
  const unique = [...new Map(history.map((item) => [item.session.date, item])).values()];
  const recent = unique.filter(({ session }) => daysBetween(session.date, date) < 56);
  let state: ExerciseCalibrationState = "uncalibrated";
  let goodDates: string[] = [];
  let lastSets = 0;
  let priorDate: string | undefined;
  let reset = false;
  for (const item of recent) {
    const gap = priorDate ? daysBetween(priorDate, item.session.date) : 0;
    if (gap >= 56) { state = "recalibration"; goodDates = []; reset = true; }
    else if (gap >= 28) { if (state === "calibrated") state = "developing"; goodDates = []; }
    priorDate = item.session.date;
    const exposure = item.session.exerciseExposures?.[item.key];
    const checks = data.exerciseRecovery.filter((check) => check.sessionId === item.session.id && check.exerciseIdentity === identity).sort((a,b) => a.updatedAt.localeCompare(b.updatedAt));
    const recovery = checks.at(-1);
    const filled = item.entries.filter((entry) => isFilledSet(entry, item.exercise));
    const unsafe = ["pain", "severe-soreness", "symptoms"].includes(item.session.readiness ?? "") || checks.some((check) => check.status === "limiting" || check.status === "severe");
    lastSets = filled.length;
    if (unsafe) { state = "recalibration"; goodDates = []; reset = true; continue; }
    if (!exposure) {
      // Legacy history is credited as history, without inventing a recovery response.
      const knownFailure = !item.exercise.sbsRole && filled.some((entry) => entry.rir !== "" && numeric(entry.rir) < 1);
      if (knownFailure) { state = "recalibration"; goodDates = []; reset = true; continue; }
      if (filled.length < item.exercise.sets) { goodDates = []; if (state === "uncalibrated") state = "preliminary"; continue; }
      goodDates.push(item.session.date);
      state = goodDates.length >= 3 ? "calibrated" : goodDates.length === 2 ? "developing" : "preliminary";
      continue;
    }
    const failed = exposure.stateAtStart !== "calibrated" && filled.some((entry) => entry.rir !== "" && numeric(entry.rir) < 2);
    if (failed) { state = "recalibration"; goodDates = []; reset = true; continue; }
    if (state === "uncalibrated" && !reset && exposure.stateAtStart !== "uncalibrated") state = exposure.stateAtStart;
    const qualifies = filled.length >= exposure.prescribedSets
      && filled.every((entry) => entry.rir !== "" && numeric(entry.rir) >= Math.max(2, exposure.targetRir - 2) && numeric(entry.rir) <= exposure.targetRir + 2 && numeric(entry.r) >= item.exercise.repLow && numeric(entry.r) <= item.exercise.repHigh)
      && goodRecovery(recovery?.status)
      && Date.parse(recovery!.createdAt) - Date.parse(item.session.completedAt ?? item.session.createdAt) >= EXPOSURE_POLICY.recoveryHours * 3_600_000;
    if (!qualifies) {
      // Persist the established floor across rolling windows, but missing recovery cannot promote it.
      if (exposure.startingLoadSource === "user" && state === "uncalibrated") state = "preliminary";
      goodDates = [];
      continue;
    }
    goodDates = goodDates.filter((value) => daysBetween(value, item.session.date) <= 42);
    goodDates.push(item.session.date);
    if (state !== "calibrated") state = goodDates.length >= 3 ? "calibrated" : goodDates.length >= 2 || state === "developing" ? "developing" : "preliminary";
    reset = false;
  }
  const latest = unique.at(-1);
  const gapDays = latest ? daysBetween(latest.session.date, date) : null;
  if (gapDays !== null && gapDays >= 56) state = "recalibration";
  else if (gapDays !== null && gapDays >= 28 && state === "calibrated") state = "developing";
  const latestRecovery = latest ? data.exerciseRecovery.filter((check) => check.sessionId === latest.session.id && check.exerciseIdentity === identity).sort((a,b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1) : undefined;
  const recoveryPending = Boolean(latest?.session.exerciseExposures?.[latest.key] && (!latestRecovery || (goodRecovery(latestRecovery.status) && Date.parse(latestRecovery.createdAt) - Date.parse(latest.session.completedAt ?? latest.session.createdAt) < EXPOSURE_POLICY.recoveryHours * 3_600_000)));
  const familiarity = exerciseFamiliarity(exercise);
  const relatedDates = new Set<string>();
  for (const session of state === "uncalibrated" || state === "recalibration" ? activeSessions(data) : []) {
    if (session.date >= date || daysBetween(session.date, date) > 42 || ["pain", "severe-soreness", "symptoms"].includes(session.readiness ?? "")) continue;
    for (const [key, entries] of Object.entries(session.entries)) {
      const snapshot = session.planSnapshot?.exercises.find((value) => value.key === key);
      const other = snapshot ? { ...snapshot, alternatives: [] } : exerciseFromKey(key);
      if (!other || loadProfileId(other) === identity || exerciseFamiliarity(other).family !== familiarity.family || !entries.some((entry) => isFilledSet(entry, other))) continue;
      const checks = data.exerciseRecovery.filter((check) => check.sessionId === session.id && check.exerciseIdentity === loadProfileId(other));
      if (!checks.some((check) => check.status === "limiting" || check.status === "severe") && (!session.exerciseExposures?.[key] || goodRecovery(checks.sort((a,b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1)?.status))) relatedDates.add(session.date);
    }
  }
  const relatedHistory = relatedDates.size >= 2;
  const targetRir = state === "uncalibrated" || state === "recalibration" ? relatedHistory && familiarity.risk !== "high" ? 3 : 4 : state === "preliminary" ? 3 : 2;
  return { identity, state, targetRir, ...familiarity, relatedHistory, recoveryPending, latest, latestRecovery, gapDays, lastSets, exposureCount: unique.length };
}

export type Calibration = ReturnType<typeof exerciseCalibration>;
export function calibrationSetCount(sets: number, calibration: Calibration) {
  let cap = calibration.state === "calibrated" ? sets
    : calibration.state === "developing" ? Math.max(1, Math.ceil(sets * .75))
    : calibration.state === "preliminary" ? 2
    : calibration.relatedHistory && calibration.risk !== "high" ? 2 : 1;
  if (calibration.recoveryPending && calibration.lastSets) cap = Math.min(cap, calibration.lastSets);
  return Math.max(1, Math.min(sets, cap));
}

export function buildExposurePlan(data: TrainingData, day: TrainingDay, date: string, resolve: (exercise: Exercise) => Exercise, includeDeferred = false) {
  let noveltyUnits = 0;
  const muscleUnits = new Map<string, number>();
  const deferred: string[] = [];
  const exposures: Record<string, ExerciseExposureSnapshot> = {};
  const candidates = day.exercises.map((base, index) => {
    const exercise = resolve(base);
    const calibration = exerciseCalibration(data, exercise, date);
    const sets = Math.min(calibrationSetCount(base.sets, calibration), data.program.returnPlan ? returnPlanSetCount(base.sets, data.program.returnPlan.volumeFactor) : base.sets);
    return { base, exercise, calibration, sets, index };
  });
  const allowed = new Set<number>();
  // Allocate unfamiliar work to least-exposed movements first to avoid starving later slots.
  [...candidates].sort((a,b) => a.calibration.exposureCount - b.calibration.exposureCount || a.index - b.index).forEach(({ base, exercise, calibration, sets, index }) => {
    const novel = ["uncalibrated", "preliminary", "recalibration"].includes(calibration.state);
    const units = novel ? sets * (calibration.relatedHistory && calibration.risk !== "high" ? .5 : 1) : 0;
    const nextMuscleUnits = (muscleUnits.get(calibration.muscle) ?? 0) + units;
    if (novel && (noveltyUnits + units > EXPOSURE_POLICY.sessionNoveltyUnits || nextMuscleUnits > EXPOSURE_POLICY.muscleNoveltyUnits)) {
      deferred.push(exercise.name);
      if (!includeDeferred) return;
    }
    noveltyUnits += units;
    muscleUnits.set(calibration.muscle, nextMuscleUnits);
    exposures[base.id] = {
      policyVersion: 1, identity: calibration.identity, stateAtStart: calibration.state, noveltyRisk: calibration.risk,
      prescribedSets: sets, originalSets: base.sets, targetRir: Math.max(calibration.targetRir, data.program.returnPlan?.targetRir ?? 0),
      relatedHistory: calibration.relatedHistory, startingLoadSource: "guided",
      progressionEligible: calibration.state === "calibrated" && !calibration.recoveryPending && !data.program.calibrationRequired && !data.program.returnPlan,
    };
    allowed.add(index);
  });
  const exercises = candidates.filter((item) => allowed.has(item.index)).map(({ base, sets }) => ({ ...base, sets }));
  return { day: { ...day, exercises }, exposures, deferred, noveltyUnits };
}

export const loadAtOrBelow = (target: number, available: number[]) => available.filter((value) => value <= target).sort((a,b) => a-b).at(-1) ?? null;
export const exposureAllowsProgression = (exposure?: ExerciseExposureSnapshot) => !exposure || exposure.progressionEligible;

export function restrictActiveExposure(exposure: ExerciseExposureSnapshot | undefined, currentState: ExerciseCalibrationState, readiness?: Readiness | null) {
  return exposure && (currentState === "recalibration" || Boolean(readiness && readiness !== "normal"))
    ? { ...exposure, progressionEligible: false } : exposure;
}

export function constrainCalibrationAdjustment(adjustment: LoadAdjustment | null, calibration: Calibration): LoadAdjustment | null {
  if (!adjustment || adjustment.action === "stop") return adjustment;
  if (calibration.state === "calibrated" && !calibration.recoveryPending) return adjustment;
  if (adjustment.action === "decrease") return { ...adjustment, reason: `${adjustment.reason} Keep at least ${calibration.targetRir} good reps in reserve.` };
  return { ...adjustment, action: "hold", nextLoad: null, confidence: "low", reason: calibration.recoveryPending
    ? "Recovery feedback is still needed. Repeat a comfortable load or reduce it; increases are on hold."
    : `Build familiarity at ${calibration.targetRir} RIR with a comfortable load. Automatic increases wait until this exercise has established history.` };
}

// Upgrade an unfinished pre-policy draft without discarding any entered set.
export function preserveLegacyDraft(data: TrainingData, draftKey: string, entries: Record<string, SetEntry[]>) {
  const [program, week, date, dayId] = draftKey.split(":");
  if (!data.profile || !["phase1", "phase2"].includes(program) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !Object.values(entries).some((sets) => Array.isArray(sets) && sets.some((set) => set.w !== "" || set.r !== "" || set.rir !== ""))) return null;
  const programId = program === "phase2" ? "phase2" : "phase1";
  const base = programDays(programId, data.program.frequency, data.profile.programTrack, data.profile.goal, data.profile.equipment).find((day) => day.id === dayId);
  if (!base) return null;
  const swaps = { ...data.swaps };
  const resolve = (exercise: Exercise) => {
    const enteredKey = Object.keys(entries).find((key) => key.split(":")[0] === exercise.id && entries[key].some((set) => set.w !== "" || set.r !== "" || set.rir !== ""));
    if (enteredKey?.includes(":")) swaps[exercise.id] = enteredKey.slice(enteredKey.indexOf(":") + 1);
    else if (enteredKey) delete swaps[exercise.id];
    return enteredKey ? exerciseFromKey(enteredKey) ?? exercise : resolveExerciseVariant(exercise, swaps[exercise.id] ?? exercise.defaultVariant ?? exercise.name);
  };
  const plan = buildExposurePlan(data, base, date, resolve);
  const exercises = base.exercises.flatMap((exercise) => {
    const resolved = resolve(exercise);
    const key = exerciseKey(exercise, swaps);
    const touched = (entries[key] ?? []).reduce((count, set, index) => set.w !== "" || set.r !== "" || set.rir !== "" ? index + 1 : count, 0);
    const planned = plan.day.exercises.find((item) => item.id === exercise.id);
    if (!planned && !touched) return [];
    const sets = Math.max(planned?.sets ?? 0, touched);
    if (!plan.exposures[exercise.id]) plan.exposures[exercise.id] = buildExposurePlan(data, { ...base, exercises: [exercise] }, date, resolve, true).exposures[exercise.id];
    plan.exposures[exercise.id] = { ...plan.exposures[exercise.id], prescribedSets: sets, originalSets: Math.max(exercise.sets, sets) };
    return [{ ...resolved, sets }];
  });
  const snapshot = buildSessionPlanSnapshot({ ...data, swaps }, { ...base, exercises }, programId, Number(week) || 1);
  return { snapshot, exposures: Object.fromEntries(snapshot.exercises.map((exercise) => [exercise.key, plan.exposures[exercise.id]])) };
}
