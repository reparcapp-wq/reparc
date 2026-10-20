import {
  buildReturnPlan, comparableExerciseHistory, convertWeight, isBodyweightInRange, isFilledSet, loadProfileId, numeric, prettyDate,
  type Exercise, type Readiness, type TrainingData, type Unit,
} from "./training";
import { loadAtOrBelow, type Calibration } from "./exercise-calibration";

// Data-freshness and rehearsal limits are explicit product guardrails, not
// validated strength-loss curves. Existing return factors are reused once.
export const HISTORY_START_POLICY = { version: 1, maxAgeDays: 180, rehearsalReps: 5, consistencyRatio: 1.5 } as const;
export type HistoryStartSuggestion = {
  value: number | null;
  tag: "estimate";
  reason: string;
  confidence: "low";
  returnAdjusted: true;
  startReps: number;
  historyReference: string;
  blocked?: boolean;
  rehearsal?: { value: number | null; reps: number; bound: string };
  loadBound?: string;
};
type Input = {
  data: TrainingData; exercise: Exercise; date: string; unit: Unit; calibration: Calibration;
  targetReps: number; targetRir: number; availableLoads: number[]; readiness?: Readiness | null;
};

export function historyStartingSuggestion({ data, exercise, date, unit, calibration, targetReps, targetRir, availableLoads, readiness }: Input): HistoryStartSuggestion | null {
  const history = comparableExerciseHistory(data, exercise).filter(({ session }) => session.date < date);
  const source = history.at(-1);
  if (!source) return null;
  const completed = source.entries.filter((entry) => isFilledSet(entry, source.exercise));
  const first = completed[0];
  if (!first) return null;
  const age = Math.max(0, Math.floor((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${source.session.date}T12:00:00Z`)) / 86_400_000));
  const sourceLoad = convertWeight(numeric(first.w), source.session.unit, unit);
  const sourceReps = numeric(first.r);
  const kind = exercise.loadingType ?? (exercise.bodyweight ? "bodyweight" : "external");
  const loadLabel = kind === "unloaded" ? "no external load" : kind === "assisted-bodyweight" ? `${format(sourceLoad)} ${unit} assistance`
    : kind === "bodyweight" ? `${format(sourceLoad)} ${unit} added` : `${format(sourceLoad)} ${unit}${exercise.perSide ? " per side" : ""}`;
  const reference = `${prettyDate(source.session.date, { month: "short", day: "numeric" })} · ${loadLabel} × ${sourceReps} reps${first.rir === "" ? " · reps left not recorded" : ` · ${first.rir} good reps left`} · ${age} days ago`;
  const base: HistoryStartSuggestion = { value: null, tag: "estimate", reason: "", confidence: "low", returnAdjusted: true,
    startReps: targetReps, historyReference: reference };
  const adverse = data.exerciseRecovery.some((check) => check.sessionId === source.session.id && check.exerciseIdentity === loadProfileId(exercise)
    && (check.status === "limiting" || check.status === "severe"));
  if (readiness === "pain" || readiness === "severe-soreness" || adverse || source.session.readiness === "pain"
    || source.session.readiness === "severe-soreness" || source.session.skippedExerciseKeys?.includes(source.key)) {
    return { ...base, blocked: true, reason: "The latest record includes a stopped exercise, pain or recovery that affected normal movement. Review that concern before choosing a working weight; the old number is a reference only." };
  }
  if (age > HISTORY_START_POLICY.maxAgeDays || sourceReps > 30 || !Number.isFinite(targetReps) || targetReps < 1) {
    return { ...base, reason: "This record is too old or uses an unsuitable repetition count for an automatic starting weight. Rehearse comfortably and record a fresh starting level; the old result remains visible as a reference." };
  }
  const priorByDate = new Map(history.filter((item) => item.session.date < source.session.date).map((item) => [item.session.date, item]));
  const previousLoads = [...priorByDate.values()].slice(-3).flatMap((item) => {
    const entry = item.entries.find((value) => isFilledSet(value, item.exercise));
    return entry ? [convertWeight(numeric(entry.w), item.session.unit, unit)] : [];
  }).filter((load) => load > 0).sort((a, b) => a - b);
  if (kind === "external" && previousLoads.length >= 2) {
    const median = previousLoads[Math.floor((previousLoads.length - 1) / 2)];
    if (sourceLoad / median > HISTORY_START_POLICY.consistencyRatio || sourceLoad / median < 1 / HISTORY_START_POLICY.consistencyRatio) {
      return { ...base, reason: "The latest weight differs substantially from earlier matching records. Check units, per-side entries and whether the machine or setup changed before using an automatic weight. Start comfortably and record a fresh comparison." };
    }
  }
  const protectedWorkout = calibration.state !== "calibrated" || calibration.recoveryPending || data.program.calibrationRequired || Boolean(data.program.returnPlan);
  const gapFactor = buildReturnPlan(age, "planned")?.loadFactor ?? 1;
  const previousExposure = source.session.exerciseExposures?.[source.key];
  const fullSource = completed.length >= (previousExposure?.prescribedSets ?? source.exercise.sets);
  const effortKnown = completed.every((entry) => entry.rir !== "" && numeric(entry.rir) >= 2);
  const suitableRepRecord = sourceReps >= targetReps;
  const sourceReadiness = !source.session.readiness || source.session.readiness === "normal";
  // Do not ratchet down an already protected, successfully tolerated starting
  // weight on every return workout. A new break or harder effort still reduces it.
  const repeatRecentProtected = age < 14 && previousExposure?.progressionEligible === false
    && (!data.program.returnPlan || source.session.date >= data.program.returnPlan.startedAt.slice(0, 10))
    && fullSource && suitableRepRecord && sourceReadiness && (!readiness || readiness === "normal")
    && completed.every((entry) => entry.rir !== "" && numeric(entry.rir) >= targetRir);
  const factor = repeatRecentProtected ? 1 : Math.min(data.program.returnPlan?.loadFactor ?? 1, gapFactor, protectedWorkout ? 0.9 : 1);
  const sourceBodyweight = source.session.bodyweightAtSession === undefined ? null : convertWeight(source.session.bodyweightAtSession, source.session.unit, unit);
  const currentBodyweight = data.profile ? convertWeight(data.profile.bodyweight, data.profile.unit, unit) : null;
  let bound: number;
  let value: number | null;
  let boundLabel: string;
  if (kind === "unloaded") {
    return { ...base, reason: `No external weight is needed. Start at ${targetReps} reps and stop with at least ${targetRir} good reps left. Use an easier variation if needed.` };
  }
  if (kind === "bodyweight" || kind === "assisted-bodyweight") {
    if (sourceBodyweight === null || currentBodyweight === null || !isBodyweightInRange(sourceBodyweight, unit) || !isBodyweightInRange(currentBodyweight, unit)) {
      return { ...base, reason: `Start at ${targetReps} controlled reps with an easier variation or comfortable assistance. The old workout has no usable bodyweight record, so RepArc will not guess an added-weight or assistance target.` };
    }
    if (kind === "assisted-bodyweight") {
      const priorResistance = sourceBodyweight - sourceLoad;
      if (priorResistance <= 0) return { ...base, reason: "The old assistance/bodyweight combination cannot support a useful resistance estimate. Choose comfortable assistance and record a fresh starting level." };
      bound = Math.max(sourceLoad, currentBodyweight - priorResistance * factor);
      value = availableLoads.filter((load) => load > 0 && load >= bound - 0.000001 && load < currentBodyweight).sort((a, b) => a - b)[0] ?? null;
      boundLabel = `at least ${format(Math.ceil(bound * 10) / 10)} ${unit} assistance`;
    } else {
      bound = Math.min(sourceLoad, (sourceBodyweight + sourceLoad) * factor - currentBodyweight);
      if (bound < 0) return { ...base, reason: `Even bodyweight alone may exceed the reduced starting estimate. Use an easier variation or assistance for ${targetReps} controlled reps; no added weight is suggested.` };
      value = bound === 0 ? 0 : loadAtOrBelow(bound, availableLoads);
      boundLabel = `at most ${format(Math.floor(bound * 10) / 10)} ${unit} added`;
    }
  } else {
    bound = sourceLoad * factor;
    value = loadAtOrBelow(bound, availableLoads.filter((load) => load > 0));
    boundLabel = `at most ${format(Math.floor(bound * 10) / 10)} ${unit}${exercise.perSide ? " per side" : ""}`;
  }
  // A low-rep record does not establish a higher-rep working weight. Unknown
  // effort and incomplete exposures remain rehearsal references, not prescriptions.
  if (!fullSource || !effortKnown || !suitableRepRecord || !sourceReadiness) {
    const reps = Math.min(HISTORY_START_POLICY.rehearsalReps, sourceReps, targetReps);
    return { ...base, rehearsal: { value, reps, bound: boundLabel },
      reason: !suitableRepRecord ? `The old record used ${sourceReps} reps; today calls for ${targetReps}. Use this only as an easy warm-up rehearsal, not the working-set target. Then choose a comfortable working weight and leave at least ${targetRir} good reps.`
        : `The old exposure has incomplete sets, uncertain or high effort, or reduced readiness. Rehearse easily first; then choose a comfortable working weight for ${targetReps} reps with at least ${targetRir} good reps left. Warm-ups are not logged as working sets.` };
  }
  return { ...base, value, loadBound: value === null ? boundLabel : undefined,
    reason: `Starting estimate from your latest matching exercise record${factor < 1 ? ", reduced for return or calibration" : repeatRecentProtected ? "; repeat the recent comfortable starting weight" : ""}. Try ${targetReps} reps, but stop earlier if fewer than ${targetRir} good reps remain. This is a starting check, not a measured loss of strength.${value === null ? " Save this equipment’s weight choices to get a selectable weight." : ""}` };
}

const format = (value: number) => String(Math.round(value * 10) / 10);
