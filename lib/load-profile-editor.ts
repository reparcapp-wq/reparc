import { activeSessions, exerciseFromKey, exerciseNeedsLoad, loadProfileId, loadProfileValues, normalizeLoadValues, programDays, resolveExerciseVariant, type Exercise, type TrainingData } from "./training";

export function parseAvailableLoads(input: string) {
  const tokens = input.trim().split(/[,\s]+/).filter(Boolean);
  if (tokens.length > 100) return { values: [], error: "Use at most 100 available loads." };
  if (tokens.some((token) => !/^\d+(?:\.\d{1,2})?$/.test(token) || Number(token) <= 0 || Number(token) > 2_000)) {
    return { values: [], error: "Use positive numbers up to 2,000, with at most two decimal places. Separate loads with commas." };
  }
  const values = normalizeLoadValues(tokens);
  return { values, error: values.length < 2 ? "Enter at least two different available loads." : null };
}

export function loadEntryHint(exercise: Pick<Exercise, "loadingType" | "perSide" | "name">) {
  if (exercise.loadingType === "assisted-bodyweight") return "Enter the machine's assistance values, not your bodyweight. More assistance makes the exercise easier.";
  if (exercise.loadingType === "bodyweight") return "Enter added external weight only, not your bodyweight.";
  if (exercise.perSide) return "Use the load for one side or one dumbbell, matching the workout's each-side label. Do not add both sides together.";
  return "Use the same total external load or machine-stack label you record in Train. For a barbell, include the bar and plates.";
}

export function equipmentChoices(data: TrainingData) {
  const profile = data.profile;
  if (!profile) return [];
  const choices = new Map<string, { key: string; name: string; hint: string; values: number[] }>();
  const add = (exercise: Exercise, legacyKey?: string) => {
    if (!exerciseNeedsLoad(exercise)) return;
    const key = loadProfileId(exercise);
    choices.set(key, { key, name: exercise.name, hint: loadEntryHint(exercise), values: loadProfileValues(data.loadProfiles[key], profile.unit) });
    if (legacyKey && data.loadProfiles[legacyKey] && !data.loadProfiles[legacyKey].deletedAt && !data.loadProfiles[key]) {
      // Keep conflicting legacy slot profiles separate. Editing one must not
      // silently canonicalize another slot's values across the whole program.
      choices.set(legacyKey, { key: legacyKey, name: `${exercise.name} · saved slot ${legacyKey.split(":")[0]}`, hint: loadEntryHint(exercise), values: loadProfileValues(data.loadProfiles[legacyKey], profile.unit) });
    }
  };
  for (const day of programDays(data.program.activeId, data.program.frequency, profile.programTrack, profile.goal, profile.equipment)) {
    for (const exercise of day.exercises) {
      for (const name of new Set([exercise.name, ...exercise.alternatives, exercise.defaultVariant, data.swaps[exercise.id]].filter((value): value is string => Boolean(value)))) add(resolveExerciseVariant(exercise, name));
    }
  }
  for (const session of activeSessions(data)) {
    for (const [key] of Object.entries(session.entries)) {
      const exercise = session.planSnapshot?.exercises.find((item) => item.key === key) ?? exerciseFromKey(key);
      if (exercise) add({ ...exercise, alternatives: "alternatives" in exercise ? exercise.alternatives : [] }, key);
    }
  }
  for (const [key, saved] of Object.entries(data.loadProfiles)) {
    if (choices.has(key) || saved.deletedAt) continue;
    const exercise = key.startsWith("equipment:") ? null : exerciseFromKey(key);
    if (exercise) { add(exercise, key); continue; }
    choices.set(key, { key, name: key.split(":").at(-1)!.replaceAll("-", " "), hint: "Use the same loading convention as the original exercise. This is a saved equipment profile.", values: loadProfileValues(saved, profile.unit) });
  }
  return [...choices.values()].sort((a, b) => Number(b.values.length > 0) - Number(a.values.length > 0) || a.name.localeCompare(b.name));
}
