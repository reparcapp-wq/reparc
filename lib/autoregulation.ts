import {
  isFilledSet,
  numeric,
  practicalLoadIncrement,
  resolveAvailableLoad,
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
  availableLoads?: number[];
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

export function nextSetAdjustment({ exercise, entries, unit, readiness, availableLoads }: AdjustmentInput): LoadAdjustment | null {
  const completed = completedEntries(exercise, entries);
  if (!completed.length || completed.length >= exercise.sets) return null;
  const latest = completed.at(-1)!;
  const load = loadFrom(latest, exercise);
  const reps = numeric(latest.r);
  const rir = latest.rir === "" ? null : numeric(latest.rir);
  const increment = practicalLoadIncrement(exercise, load, unit);
  const hasAvailableLoads = Boolean(availableLoads?.length);
  const lowerLoad = availableLoads?.length ? resolveAvailableLoad(load, availableLoads, "lower") : null;
  const higherLoad = availableLoads?.length ? resolveAvailableLoad(load, availableLoads, "higher") : null;
  const practicalIncrease = load > 0 && (higherLoad !== null ? higherLoad / load <= 1.1 : !hasAvailableLoads && (load + increment) / load <= 1.1);
  const evidence = [`${reps} reps`, rir === null ? "RIR not recorded" : `${rir} RIR`, availableLoads?.length ? "equipment loads configured" : "equipment loads not configured"];

  if (readiness === "pain" || readiness === "severe-soreness") {
    return {
      action: "stop",
      nextLoad: null,
      confidence: "high",
      reason: readiness === "severe-soreness" ? "Do not train while soreness limits normal movement or walking." : "Stop this exercise. Pain overrides load progression.",
      evidence: [...evidence, readiness === "severe-soreness" ? "movement-limiting soreness selected" : "pain / unsafe selected"],
    };
  }

  if (reps < exercise.repLow && rir !== null && rir <= 1) {
    return {
      action: "decrease",
      nextLoad: exercise.bodyweight ? null : lowerLoad,
      confidence: "moderate",
      reason: exercise.bodyweight ? "Use an easier variation or assistance for the next set." : lowerLoad === null ? hasAvailableLoads ? "The lower rep target was missed at high effort, but this is already the lowest configured load. Use an easier variation or update the equipment list." : "The lower rep target was missed at high effort. Use the next lower available load; configure this exercise’s equipment loads for an exact value." : "The lower rep target was missed at high effort. Use the next lower load available on this equipment.",
      evidence,
    };
  }

  if (rir !== null && rir === 0) {
    return {
      action: "decrease",
      nextLoad: exercise.bodyweight ? null : lowerLoad,
      confidence: "moderate",
      reason: exercise.bodyweight ? "Use an easier variation so the next set finishes with a repetition in reserve." : lowerLoad === null ? hasAvailableLoads ? "The set reached failure at the lowest configured load. Use an easier variation or update the equipment list." : "The set reached failure. Use the next lower available load; configure this exercise’s equipment loads for an exact value." : "The set reached failure. Use the next lower load available on this equipment.",
      evidence,
    };
  }

  if (rir !== null && rir >= 4 && reps >= exercise.repLow && !conservativeReadiness(readiness)) {
    if (!exercise.bodyweight && !practicalIncrease) {
      return {
        action: "hold",
        nextLoad: load,
        confidence: "moderate",
        reason: hasAvailableLoads && higherLoad === null ? "This is the highest configured load. Build repetitions or update the equipment list before increasing." : "The smallest available increase would exceed 10% of this load. Add repetitions or use a smaller microload instead.",
        evidence,
      };
    }
    return {
      action: "increase",
      nextLoad: exercise.bodyweight ? null : higherLoad,
      confidence: "moderate",
      reason: exercise.bodyweight ? "Keep the variation and add controlled repetitions." : higherLoad === null ? "The set was clearly easier than the target. Use the next higher available load; configure this exercise’s equipment loads for an exact value." : "The set was clearly easier than the target. Use the next higher load available on this equipment.",
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

export function nextSessionAdjustment({ exercise, entries, unit, readiness, availableLoads }: AdjustmentInput): LoadAdjustment | null {
  const completed = completedEntries(exercise, entries);
  if (!completed.length) return null;
  const loads = completed.map((entry) => loadFrom(entry, exercise));
  const sortedLoads = [...loads].sort((left, right) => left - right);
  const representativeLoad = sortedLoads[Math.floor((sortedLoads.length - 1) / 2)] ?? 0;
  const reps = completed.map((entry) => numeric(entry.r));
  const rirValues = completed.filter((entry) => entry.rir !== "").map((entry) => numeric(entry.rir));
  const averageRir = average(rirValues);
  const increment = practicalLoadIncrement(exercise, representativeLoad, unit);
  const hasAvailableLoads = Boolean(availableLoads?.length);
  const lowerLoad = availableLoads?.length ? resolveAvailableLoad(representativeLoad, availableLoads, "lower") : null;
  const higherLoad = availableLoads?.length ? resolveAvailableLoad(representativeLoad, availableLoads, "higher") : null;
  const comparisonIncrement = higherLoad !== null ? higherLoad - representativeLoad : lowerLoad !== null ? representativeLoad - lowerLoad : increment;
  const practicalIncrease = representativeLoad > 0 && (higherLoad !== null ? higherLoad / representativeLoad <= 1.1 : !hasAvailableLoads && (representativeLoad + increment) / representativeLoad <= 1.1);
  const allPlannedSets = completed.length >= exercise.sets;
  const allAtTop = allPlannedSets && reps.every((value) => value >= exercise.repHigh);
  const anyBelow = reps.some((value) => value < exercise.repLow);
  const loadSpread = Math.max(...loads) - Math.min(...loads);
  const baseConfidence = confidenceFor(exercise, completed);
  const confidence: AdjustmentConfidence = loadSpread > comparisonIncrement && baseConfidence === "high" ? "moderate" : baseConfidence;
  const evidence = [
    `${completed.length}/${exercise.sets} sets`,
    `${Math.min(...reps)}–${Math.max(...reps)} reps`,
    averageRir === null ? "RIR not recorded" : `${averageRir.toFixed(1)} average RIR`,
    ...(loadSpread > comparisonIncrement ? ["loads varied by more than one increment"] : []),
    availableLoads?.length ? "equipment loads configured" : "equipment loads not configured",
  ];

  if (readiness === "pain" || readiness === "severe-soreness") {
    return {
      action: "stop",
      nextLoad: null,
      confidence: "high",
      reason: readiness === "severe-soreness" ? "Do not prescribe a next-session increase while soreness limits normal movement or walking." : "Do not progress this exercise until the pain concern has been resolved.",
      evidence: [...evidence, readiness === "severe-soreness" ? "movement-limiting soreness selected" : "pain / unsafe selected"],
    };
  }

  if (anyBelow && averageRir !== null && averageRir <= 1) {
    return {
      action: "decrease",
      nextLoad: exercise.bodyweight ? null : lowerLoad,
      confidence,
      reason: exercise.bodyweight ? "Use assistance or an easier variation next time." : lowerLoad === null ? hasAvailableLoads ? "At least one set missed the range at high effort at the lowest configured load. Use an easier variation or update the equipment list." : "At least one set missed the range at high effort. Use the next lower available load; configure this exercise’s equipment loads for an exact value." : "At least one set missed the range at high effort. Use the next lower load available on this equipment.",
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

  if (allAtTop && loadSpread <= comparisonIncrement && averageRir !== null && averageRir >= 1) {
    if (!exercise.bodyweight && !practicalIncrease) {
      return {
        action: "hold",
        nextLoad: representativeLoad,
        confidence,
        reason: hasAvailableLoads && higherLoad === null ? "This is the highest configured load. Build repetitions or update the equipment list before increasing." : "The smallest available increase would exceed 10% of this load. Add repetitions or use a smaller microload instead.",
        evidence,
      };
    }
    return {
      action: "increase",
      nextLoad: exercise.bodyweight ? null : higherLoad,
      confidence,
      reason: exercise.bodyweight ? "All planned sets reached the top of the range. Progress the variation or add a small external load." : higherLoad === null ? "All planned sets reached the top of the range without recorded failure. Use the next higher available load; configure this exercise’s equipment loads for an exact value." : "All planned sets reached the top of the range without recorded failure. Use the next higher load available on this equipment.",
      evidence,
    };
  }

  if (averageRir !== null && averageRir >= 4 && loadSpread <= comparisonIncrement) {
    if (!exercise.bodyweight && !practicalIncrease) {
      return {
        action: "hold",
        nextLoad: representativeLoad,
        confidence,
        reason: hasAvailableLoads && higherLoad === null ? "This is the highest configured load. Build repetitions or update the equipment list before increasing." : "The smallest available increase would exceed 10% of this load. Add repetitions or use a smaller microload instead.",
        evidence,
      };
    }
    return {
      action: "increase",
      nextLoad: exercise.bodyweight ? null : higherLoad,
      confidence,
      reason: exercise.bodyweight ? "The completed work was well below the intended effort. Progress the variation slightly." : higherLoad === null ? "The completed work was consistently easier than the target. Use the next higher available load; configure this exercise’s equipment loads for an exact value." : "The completed work was consistently easier than the target. Use the next higher load available on this equipment.",
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
