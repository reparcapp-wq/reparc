import { activeSessions, exerciseFromKey, isFilledSet, programDays, resolveExerciseVariant, type TrainingData } from "./training";
import { exerciseMetadata, MUSCLES, type Muscle } from "./exercise-metadata";

export function weeklyMuscleVolume(data: TrainingData, start: string, end: string) {
  const rows = MUSCLES.map((muscle) => ({ muscle, direct: 0, indirect: 0, plannedDirect: 0, plannedIndirect: 0 }));
  const lookup = new Map(rows.map((row) => [row.muscle, row]));
  let unclassifiedSets = 0, inferredSets = 0, loggedSessions = 0;
  const seen = new Set<string>();
  for (const session of activeSessions(data).filter((item) => item.date >= start && item.date <= end)) {
    const id = session.logicalKey ?? session.id; if (seen.has(id)) continue; seen.add(id); loggedSessions += 1;
    for (const [key, entries] of Object.entries(session.entries)) {
      const snapshot = session.planSnapshot?.exercises.find((item) => item.key === key);
      const exercise = snapshot ? { ...snapshot, alternatives: [] } : exerciseFromKey(key);
      const count = entries.filter((set) => isFilledSet(set, exercise)).length;
      const metadata = exercise && exerciseMetadata(exercise.name);
      if (!metadata && !snapshot?.primaryMuscles?.length) { unclassifiedSets += count; continue; }
      if (!snapshot?.metadataVersion) inferredSets += count;
      const primary = snapshot?.primaryMuscles ?? metadata?.primary ?? [];
      const secondary = snapshot?.secondaryMuscles ?? metadata?.secondary ?? [];
      for (const muscle of new Set(primary)) { const row = lookup.get(muscle); if (row) row.direct += count; }
      for (const muscle of new Set(secondary.filter((m) => !primary.includes(m)))) { const row = lookup.get(muscle); if (row) row.indirect += count; }
    }
  }
  if (data.profile) for (const day of programDays(data.program.activeId, data.program.frequency, data.profile.programTrack, data.profile.goal, data.profile.equipment)) {
    for (const exercise of day.exercises) {
      const resolved = resolveExerciseVariant(exercise, data.swaps[exercise.id] ?? exercise.defaultVariant ?? exercise.name);
      for (const muscle of new Set(resolved.primaryMuscles ?? [])) lookup.get(muscle)!.plannedDirect += exercise.sets;
      for (const muscle of new Set(resolved.secondaryMuscles ?? [])) if (!(resolved.primaryMuscles ?? []).includes(muscle)) lookup.get(muscle)!.plannedIndirect += exercise.sets;
    }
  }
  return { start, end, rows, unclassifiedSets, inferredSets, loggedSessions };
}
export const MUSCLE_LABELS: Record<Muscle, string> = { chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves", trunk: "Core" };
