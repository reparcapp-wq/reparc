import { convertWeight, estimatedOneRepMax, isFilledSet, loadProfileId, numeric, supportsEstimatedMax, type Session, type Unit } from "./training";

/** A descriptive first-set load/repetition score, not a measured strength maximum. */
export function performanceScorePoint(session: Session, key: string, unit: Unit) {
  const saved = session.planSnapshot?.exercises.find((exercise) => exercise.key === key);
  if (!saved) return null;
  const exercise = { ...saved, alternatives: [] };
  const entry = session.entries[key]?.[0];
  const exposure = session.exerciseExposures?.[key];
  if (!entry || !isFilledSet(entry, exercise) || entry.rir === "" || !supportsEstimatedMax(exercise)
    || exercise.loadingType !== "external" || exercise.sbsRole || session.skippedExerciseKeys?.includes(key)
    || session.affectsProgression === false || (exposure && !exposure.progressionEligible)
    || (session.readiness && session.readiness !== "normal")) return null;
  const reps = numeric(entry.r);
  if (reps < 4 || reps > 10) return null;
  return {
    date: session.date, value: estimatedOneRepMax(convertWeight(numeric(entry.w), session.unit, unit), reps), rir: numeric(entry.rir),
    protocol: JSON.stringify([loadProfileId(exercise), exercise.loadingType, !!exercise.perSide, exercise.repLow, exercise.repHigh, session.programId ?? session.planSnapshot?.programId]),
  };
}

export function comparablePerformanceScore(a: ReturnType<typeof performanceScorePoint>, b: ReturnType<typeof performanceScorePoint>) {
  return !!a && !!b && a.protocol === b.protocol && a.rir === b.rir;
}
