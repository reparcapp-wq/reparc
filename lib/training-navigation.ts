// Skipping unlocks navigation only. It never fills sets or completes a workout.
export function lastAccessibleExercise(keys: string[], completed: boolean[], skipped: string[]) {
  const firstPending = keys.findIndex((key, index) => !completed[index] && !skipped.includes(key));
  return firstPending < 0 ? keys.length - 1 : firstPending;
}

export function normalizeSkippedExercises(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === "string" && key.length > 0 && key.length <= 200))].slice(0, 50) : [];
}
