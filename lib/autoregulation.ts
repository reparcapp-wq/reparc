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
  targetRir?: number;
  allowIncrease?: boolean;
  bodyweight?: number;
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

export function nextSetAdjustment(input: AdjustmentInput): LoadAdjustment | null {
  const { exercise, entries, unit, readiness, availableLoads, targetRir = 2, allowIncrease = true } = input;
  if (exercise.loadingType === "assisted-bodyweight") return assistedAdjustment(input, false);
  if (exercise.loadingType === "unloaded") return null;
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
  const evidence = [`${reps} reps`, rir === null ? "reps left not recorded" : `${rir} reps left`, availableLoads?.length ? "equipment weights saved" : "equipment weights not saved"];

  if (readiness === "pain" || readiness === "severe-soreness") {
    return {
      action: "stop",
      nextLoad: null,
      confidence: "high",
      reason: readiness === "severe-soreness" ? "Do not train while soreness limits normal movement or walking." : "Stop this exercise. Do not increase weight while pain is present.",
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

  if (targetRir >= 3 && rir !== null && rir <= targetRir - 2) {
    return { action: "decrease", nextLoad: exercise.bodyweight ? null : lowerLoad, confidence: "moderate",
      reason: `This set was harder than today's target of at least ${targetRir} good reps left. ${lowerLoad === null || exercise.bodyweight ? "Choose an easier weight or variation." : "Use the next lower available weight."} Stop earlier if needed.`,
      evidence: [...evidence, `${targetRir} good reps left targeted`] };
  }
  if (!allowIncrease) {
    return { action: "hold", nextLoad: exercise.bodyweight && load === 0 ? null : load, confidence: rir === null ? "low" : "moderate",
      reason: `Keep this weight or reduce it during return and calibration. Aim for the displayed reps with at least ${targetRir} good reps left; stop earlier if needed. No automatic increase is suggested.`,
      evidence: [...evidence, `${targetRir} good reps left targeted`] };
  }

  if (rir !== null && rir >= 4 && reps >= exercise.repLow && !conservativeReadiness(readiness)
    && completed.every((entry) => entry.rir !== "" && numeric(entry.rir) >= 1)) {
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
      ? "Keep the weight the same because you reported low energy, unusual soreness, or symptoms today."
      : rir === null
        ? "Keep the weight the same. If you can, record how many good reps were left so the next suggestion has more information."
        : "Your reps and effort were close to the target. Keep the weight the same.",
    evidence,
  };
}

export function nextSessionAdjustment(input: AdjustmentInput): LoadAdjustment | null {
  const { exercise, entries, unit, readiness, availableLoads } = input;
  if (exercise.loadingType === "assisted-bodyweight") return assistedAdjustment(input, true);
  if (exercise.loadingType === "unloaded") return null;
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
    averageRir === null ? "reps left not recorded" : `${averageRir.toFixed(1)} average reps left`,
    ...(loadSpread > comparisonIncrement ? ["loads varied by more than one increment"] : []),
    availableLoads?.length ? "equipment weights saved" : "equipment weights not saved",
  ];

  if (readiness === "pain" || readiness === "severe-soreness") {
    return {
      action: "stop",
      nextLoad: null,
      confidence: "high",
      reason: readiness === "severe-soreness" ? "Do not increase this exercise while soreness limits normal movement or walking." : "Do not increase this exercise until the pain concern has been resolved.",
      evidence: [...evidence, readiness === "severe-soreness" ? "movement-limiting soreness selected" : "pain / unsafe selected"],
    };
  }

  if (completed.some((entry) => numeric(entry.r) < exercise.repLow && entry.rir !== "" && numeric(entry.rir) <= 1)) {
    const failedLoad = Math.min(...completed.filter((entry) => numeric(entry.r) < exercise.repLow && entry.rir !== "" && numeric(entry.rir) <= 1).map((entry) => loadFrom(entry, exercise)));
    const failedLower = availableLoads?.length ? resolveAvailableLoad(failedLoad, availableLoads, "lower") : null;
    return {
      action: "decrease",
      nextLoad: exercise.bodyweight ? null : failedLower,
      confidence,
      reason: exercise.bodyweight ? "Use assistance or an easier variation next time." : failedLower === null ? hasAvailableLoads ? "At least one set missed the range at high effort at the lowest configured load. Use an easier variation or update the equipment list." : "At least one set missed the range at high effort. Use the next lower available load; configure this exercise’s equipment loads for an exact value." : "At least one set missed the range at high effort. Use a lower weight than that failed set, not the median of the other sets.",
      evidence,
    };
  }

  if (loadSpread > .0001 && !exercise.bodyweight) return {
    action: "hold", nextLoad: null, confidence: "low",
    reason: "Your sets used different weights. Keep each set's own comfortable weight and meet the rep and effort targets before using one fixed recommendation; the heavier sets do not establish a weight for the lighter sets.", evidence,
  };

  if (anyBelow || !allPlannedSets) {
    return {
      action: "hold",
      nextLoad: exercise.bodyweight ? null : representativeLoad,
      confidence,
      reason: !allPlannedSets ? "Not all planned sets were completed, so keep the weight the same next time." : "Bring every set into the target rep range before increasing the weight.",
      evidence,
    };
  }

  if (conservativeReadiness(readiness)) {
    return {
      action: "hold",
      nextLoad: exercise.bodyweight ? null : representativeLoad,
      confidence,
      reason: "Your performance was on target, but you reported low energy, unusual soreness, or symptoms. Keep the weight the same next time.",
      evidence,
    };
  }

  // Averages must never conceal failure or treat missing effort as successful work.
  if (rirValues.length !== completed.length || rirValues.some((value) => value < 1)) {
    return {
      action: "hold",
      nextLoad: exercise.bodyweight ? null : representativeLoad,
      confidence: rirValues.length !== completed.length ? "low" : confidence,
      reason: rirValues.some((value) => value < 1)
        ? "At least one set had fewer than one good rep left. Do not increase the weight; leave the prescribed reps left next time. Reduce it if needed."
        : "Reps left were not recorded for every set. Keep the weight the same until the effort of all planned sets is known.",
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

  if (rirValues.length === completed.length && rirValues.every((value) => value >= 4) && loadSpread <= comparisonIncrement) {
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
      ? "You completed the target reps too close to failure. Repeat the same weight next time."
      : "Repeat the same weight and build reps while keeping about one to three good reps left.",
    evidence,
  };
}

/** Assistance runs in the opposite direction to external load. A reduction of
 * assistance is only offered when its estimated resistance increase is bounded. */
function assistedAdjustment({ exercise, entries, readiness, availableLoads = [], targetRir = 2, allowIncrease = true, bodyweight }: AdjustmentInput, nextSession: boolean): LoadAdjustment | null {
  const completed = completedEntries(exercise, entries);
  if (!completed.length || (!nextSession && completed.length >= exercise.sets)) return null;
  const latest = completed.at(-1)!;
  const assistance = numeric(latest.w);
  const validLoads = availableLoads.filter((load) => load > 0 && (bodyweight === undefined || load < bodyweight));
  const harder = resolveAvailableLoad(assistance, validLoads, "lower");
  const effort = completed.map((entry) => entry.rir === "" ? null : numeric(entry.rir));
  const lastEffort = effort.at(-1)!;
  const evidence = [`${completed.length}/${exercise.sets} sets`, `${latest.r} reps`, lastEffort === null ? "reps left not recorded" : `${lastEffort} reps left`, `${targetRir} good reps left targeted`];
  if (readiness === "pain" || readiness === "severe-soreness") return { action: "stop", nextLoad: null, confidence: "high", reason: "Stop while pain or soreness limits normal movement.", evidence };
  const failedEntries = (nextSession ? completed : [latest]).filter((entry) => entry.rir !== "" && (numeric(entry.rir) === 0
    || (numeric(entry.r) < exercise.repLow && numeric(entry.rir) <= 1)
    || (!nextSession && targetRir >= 3 && numeric(entry.rir) <= targetRir - 2)));
  const tooHard = failedEntries.length > 0;
  const easier = resolveAvailableLoad(Math.max(assistance, ...failedEntries.map((entry) => numeric(entry.w))), validLoads, "higher");
  if (tooHard) return { action: "decrease", nextLoad: easier, confidence: "moderate",
    reason: easier === null ? "Use more assistance or an easier variation. No higher assistance setting is saved; update the equipment choices for an exact number."
      : `Use more assistance to make the next ${nextSession ? "workout" : "set"} easier. Leave at least ${targetRir} good reps.`, evidence };
  const ready = !conservativeReadiness(readiness);
  const complete = completed.length >= exercise.sets;
  const equalAssistance = completed.every((entry) => numeric(entry.w) === assistance);
  const allEffortKnown = effort.every((value) => value !== null && value >= 1);
  const shouldProgress = nextSession ? complete && equalAssistance && allEffortKnown && completed.every((entry) => numeric(entry.r) >= exercise.repLow)
    && (completed.every((entry) => numeric(entry.r) >= exercise.repHigh) || effort.every((value) => value !== null && value >= 4))
    : lastEffort !== null && lastEffort >= 4 && numeric(latest.r) >= exercise.repLow && allEffortKnown;
  const resistance = bodyweight === undefined ? null : bodyweight - assistance;
  const bounded = harder !== null && resistance !== null && resistance > 0 && (assistance - harder) / resistance <= 0.1;
  if (allowIncrease && ready && shouldProgress && bounded) return { action: "increase", nextLoad: harder, confidence: "moderate",
    reason: "The work was comfortably within target. The next lower assistance setting makes the exercise harder without exceeding the estimated 10% resistance-step limit.", evidence };
  return { action: "hold", nextLoad: assistance, confidence: allEffortKnown ? "moderate" : "low",
    reason: !allowIncrease ? `Keep this assistance or use more during return and calibration. Leave at least ${targetRir} good reps; no automatic increase in difficulty.`
      : shouldProgress && !bounded ? "Keep this assistance. A smaller assistance step and a usable bodyweight record are needed before suggesting more difficulty."
      : "Keep the same assistance and build repetitions while leaving the displayed number of good reps.", evidence };
}
