import { isDirectSwap } from "./exercise-swaps";
import { loadProfileId, type Session, type SetEntry, type TrainingData, type ExerciseSnapshot, type ExerciseExposureSnapshot } from "./training";

export const hasExerciseEntries = (entries: SetEntry[] = []) => entries.some(entry => [entry.w, entry.r, entry.rir].some(value => String(value ?? "").trim() !== ""));

/** Never reinterpret performed sets as a different machine/exercise. */
export function exerciseSwapScope(session: Session | undefined, entries: SetEntry[], historical = false): "current" | "next" {
  return historical || hasExerciseEntries(entries) || (session && session.completionStatus !== "partial") ? "next" : "current";
}

/** Revise only an untouched slot in a partially saved workout. */
export function swapUnloggedSavedExercise(data: TrainingData, sessionId: string, oldKey: string, replacement: ExerciseSnapshot, exposure: ExerciseExposureSnapshot, at: string): TrainingData {
  const session = data.sessions.find(item => item.id === sessionId && !item.deletedAt);
  const original = session?.planSnapshot?.exercises.find(item => item.key === oldKey);
  if (!session || !original || exerciseSwapScope(session, session.entries[oldKey] ?? []) !== "current") throw new Error("Recorded exercises cannot be replaced. Choose a next-time preference instead.");
  if (replacement.id !== original.id || replacement.sets > original.sets || replacement.sets < 1 || hasExerciseEntries(session.entries[replacement.key])) throw new Error("Invalid replacement slot.");
  const previousExposure = session.exerciseExposures?.[oldKey];
  if (!isDirectSwap(original.name, replacement.name) || exposure.identity !== loadProfileId(replacement) || exposure.prescribedSets !== replacement.sets || (previousExposure?.targetRir !== undefined && (exposure.targetRir ?? 0) < previousExposure.targetRir)) throw new Error("Replacement must preserve the training role and recovery limits.");
  const entries = { ...session.entries }; delete entries[oldKey];
  entries[replacement.key] = Array.from({length: replacement.sets}, () => ({w:"",r:"",rir:""}));
  const exposures = {...session.exerciseExposures}; delete exposures[oldKey]; exposures[replacement.key] = exposure;
  const revised: Session = {...session, entries, exerciseExposures:exposures,
    planSnapshot:{...session.planSnapshot!,exercises:session.planSnapshot!.exercises.map(item=>item.key===oldKey?replacement:item)},
    skippedExerciseKeys:session.skippedExerciseKeys?.filter(key=>key!==oldKey&&key!==replacement.key),
    revision:(session.revision??1)+1,updatedAt:at};
  return {...data,updatedAt:at,sessions:data.sessions.map(item=>item.id===sessionId?revised:item),sessionRevisions:[...data.sessionRevisions,{id:crypto.randomUUID(),sessionId,action:"edited",at,note:`Changed unlogged ${original.name} to ${replacement.name} for available equipment. Recorded sets are unchanged.`,previous:session}]};
}
