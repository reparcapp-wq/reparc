import {
  bumpBy,
  isFilledSet,
  isLowerBodyExercise,
  numeric,
  type Exercise,
  type Readiness,
  type SetEntry,
  type Unit,
} from "@/lib/training";

export type AdjustmentAction = "increase" | "hold" | "decrease" | "stop";
export type AdjustmentConfidence = "high" | "moderate" | "low";

export type LoadAdjustment = {
  action: AdjustmentAction;
  nextLoad: number | null;
  confidence: AdjustmentConfidence;
  reason: string;
  evidence: string[];
};

type AdjustmentInput = {
  exercise: Exercise;
  entries: SetEntry[];
  unit: Unit;
  readiness?: Readiness | null;
};

const completedEntries = (exercise: Exercise, entries: SetEntry[]) =>
  entries.filter((entry) => isFilledSet(entry, exercise));

const average = (values: number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

const loadFrom = (entry: SetEntry, exercise: Exercise) =>
  exercise.bodyweight && entry.w === "" ? 0 : numeric(entry.w);

const confidenceFor = (exercise: Exercise, completed: SetEntry[]): AdjustmentConfidence => {
  const rirCoverage = completed.filter((entry) => entry.rir !== "").length / Math.max(1, completed.length);
  if (completed.length >= exercise.sets && rirCoverage >= 0.75) return "high";
  if (completed.length >= Math.ceil(exercise.sets / 2) && rirCoverage >= 0.5) return "moderate";
  return "low";
};

const conservativeReadiness = (readiness?: Readiness | null) =>
  readiness === "low" || readiness === "sore" || readiness === "symptoms";

export function nextSetAdjustment({ exercise, entries, unit, readiness }: AdjustmentInput): LoadAdjustment | null {
  const completed = completedEntries(exercise, entries);
  if (!completed.length || completed.length >= exercise.sets) return null;
  const latest = completed.at(-1)!;
  const load = loadFrom(latest, exercise);
  const reps = numeric(latest.r);
  const rir = latest.rir === "" ? null : numeric(latest.rir);
  const increment = bumpBy(isLowerBodyExercise(exercise), unit);
  const evidence = [`${reps} reps`, rir === null ? "RIR not recorded" : `${rir} RIR`];

  if (readiness === "pain") {
    return { action: "stop", nextLoad: null, confidence: "high", reason: "Stop this exercise. Pain overrides load progression.", evidence: [...evidence, "pain / unsafe selected"] };
  }

  if (reps < exercise.repLow && (rir === null || rir <= 1)) {
    return {
      action: "decrease",
      nextLoad: exercise.bodyweight ? null : Math.max(0, load - increment),
      confidence: rir === null ? "low" : "moderate",
      reason: exercise.bodyweight ? "Use an easier variation or assistance for the next set." : "The lower rep target was missed at high effort. Reduce one practical increment.",
      evidence,
    };
  }

  if (rir !== null && rir === 0) {
    return {
      action: "decrease",
      nextLoad: exercise.bodyweight ? null : Math.max(0, load - increment),
      confidence: "moderate",
      reason: exercise.bodyweight ? "Use an easier variation so the next set finishes with a repetition in reserve." : "The set reached failure. Back off one practical increment to preserve the remaining work.",
      evidence,
    };
  }

  if (rir !== null && rir >= 4 && reps >= exercise.repLow && !conservativeReadiness(readiness)) {
    return {
      action: "increase",
      nextLoad: exercise.bodyweight ? null : load + increment,
      confidence: "moderate",
      reason: exercise.bodyweight ? "Keep the variation and add controlled repetitions." : "The set was clearly easier than the target. Add one practical increment, not a percentage jump.",
      evidence,
    };
  }

  return {
    action: "hold",
    nextLoad: exercise.bodyweight ? null : load,
    confidence: rir === null ? "low" : "moderate",
    reason: conservativeReadiness(readiness)
      ? "Keep the load stable while readiness is reduced. Do not chase an increase today."
      : rir === null
        ? "Keep the load stable. Record RIR if you want a higher-confidence adjustment."
        : "Effort and repetitions are close enough to target. Keep the load stable.",
    evidence,
  };
}

export function nextSessionAdjustment({ exercise, entries, unit, readiness }: AdjustmentInput): LoadAdjustment | null {
  const completed = completedEntries(exercise, entries);
  if (!completed.length) return null;
  const loads = completed.map((entry) => loadFrom(entry, exercise));
  const sortedLoads = [...loads].sort((left, right) => left - right);
  const representativeLoad = sortedLoads[Math.floor((sortedLoads.length - 1) / 2)] ?? 0;
  const reps = completed.map((entry) => numeric(entry.r));
  const rirValues = completed.filter((entry) => entry.rir !== "").map((entry) => numeric(entry.rir));
  const averageRir = average(rirValues);
  const increment = bumpBy(isLowerBodyExercise(exercise), unit);
  const allPlannedSets = completed.length >= exercise.sets;
  const allAtTop = allPlannedSets && reps.every((value) => value >= exercise.repHigh);
  const anyBelow = reps.some((value) => value < exercise.repLow);
  const loadSpread = Math.max(...loads) - Math.min(...loads);
  const baseConfidence = confidenceFor(exercise, completed);
  const confidence: AdjustmentConfidence = loadSpread > increment && baseConfidence === "high" ? "moderate" : baseConfidence;
  const evidence = [
    `${completed.length}/${exercise.sets} sets`,
    `${Math.min(...reps)}–${Math.max(...reps)} reps`,
    averageRir === null ? "RIR not recorded" : `${averageRir.toFixed(1)} average RIR`,
    ...(loadSpread > increment ? ["loads varied by more than one increment"] : []),
  ];

  if (readiness === "pain") {
    return { action: "stop", nextLoad: null, confidence: "high", reason: "Do not progress this exercise until the pain concern has been resolved.", evidence: [...evidence, "pain / unsafe selected"] };
  }

  if (anyBelow && averageRir !== null && averageRir <= 1) {
    return {
      action: "decrease",
      nextLoad: exercise.bodyweight ? null : Math.max(0, representativeLoad - increment),
      confidence,
      reason: exercise.bodyweight ? "Use assistance or an easier variation next time." : "At least one set missed the range at high effort. Reduce one practical increment next time.",
      evidence,
    };
  }

  if (anyBelow || !allPlannedSets) {
    return {
      action: "hold",
      nextLoad: exercise.bodyweight ? null : representativeLoad,
      confidence,
      reason: !allPlannedSets ? "The session was incomplete, so there is not enough evidence to progress the load." : "Build all sets into the target range before increasing the load.",
      evidence,
    };
  }

  if (conservativeReadiness(readiness)) {
    return {
      action: "hold",
      nextLoad: exercise.bodyweight ? null : representativeLoad,
      confidence,
      reason: "Performance was adequate, but reduced readiness makes holding the load the conservative next step.",
      evidence,
    };
  }

  if (allAtTop && loadSpread <= increment && (averageRir === null || averageRir >= 1)) {
    return {
      action: "increase",
      nextLoad: exercise.bodyweight ? null : representativeLoad + increment,
      confidence,
      reason: exercise.bodyweight ? "All planned sets reached the top of the range. Progress the variation or add a small external load." : "All planned sets reached the top of the range without recorded failure. Add one practical increment next time.",
      evidence,
    };
  }

  if (averageRir !== null && averageRir >= 4 && loadSpread <= increment) {
    return {
      action: "increase",
      nextLoad: exercise.bodyweight ? null : representativeLoad + increment,
      confidence,
      reason: exercise.bodyweight ? "The completed work was well below the intended effort. Progress the variation slightly." : "The completed work was consistently easier than the target. Add one practical increment next time.",
      evidence,
    };
  }

  return {
    action: "hold",
    nextLoad: exercise.bodyweight ? null : representativeLoad,
    confidence,
    reason: averageRir !== null && averageRir < 1
      ? "The target repetitions were completed too close to failure. Repeat the load before progressing."
      : "Repeat the load and build repetitions while staying near one to three RIR.",
    evidence,
  };
}
