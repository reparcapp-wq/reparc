import { exerciseMetadata } from "./exercise-metadata";
import type { Equipment } from "./training";

// Programming categories, not claims of identical stimulus or clinical safety.
// Keep old names in the catalog so historical logs and saved selections still resolve.
const roles: Record<string, string> = {};
for (const [role, names] of Object.entries({
  "lateral-raise": ["Lateral raise", "Dumbbell lateral raise", "Cable lateral raise", "Machine lateral raise", "Band lateral raise"],
  "rear-delt": ["Reverse pec deck", "Face pull", "Band pull-apart", "Dumbbell reverse fly", "Dumbbell rear-delt fly", "Cable rear-delt fly"],
  "hip-abduction": ["Hip abduction", "Machine hip abduction", "Cable abduction", "Band hip abduction", "Side-lying leg raise"],
  "hip-kickback": ["Cable kickback", "Band kickback", "Quadruped hip extension"],
  "hip-hinge": ["Cable pull-through", "Reverse hyperextension", "Reverse hyper"],
  "trunk-flexion": ["Cable crunch", "Machine crunch", "Reverse crunch", "Hanging leg raise", "Hanging knee raise", "Captain's chair raise", "Captain's chair leg raise"],
  "trunk-stability": ["Dead bug"],
  "isometric-knee": ["Wall sit"],
})) for (const name of names) roles[name.toLowerCase()] = role;

export const swapRole = (name: string) => roles[name.trim().toLowerCase()] ?? exerciseMetadata(name)?.family;

// These remain valid exercises/history. Do not offer them as automatic drop-in
// replacements with inherited repetitions: assistance/technique/dosing need review.
const reviewedSeparately = new Set(["Nordic curl", "Nordic hamstring curl", "Good morning", "Sissy squat", "Wall sit"].map(name => name.toLowerCase()));
const normalize = (name: string) => name.trim().toLowerCase();
export const isDirectSwap = (base: string, candidate: string) => Boolean(
  swapRole(base) && swapRole(base) === swapRole(candidate) && !reviewedSeparately.has(normalize(candidate)),
);

export function exerciseSwapOptions(base: string, candidates: string[], equipment: Equipment = "full") {
  const fallback = exerciseMetadata(base)?.homeAlternative;
  return [...new Set([...candidates, ...(fallback ? [fallback] : [])])]
    .filter(name => normalize(name) !== normalize(base) && isDirectSwap(base, name))
    .sort((a, b) => Number(exerciseMetadata(b)?.equipment.includes(equipment)) - Number(exerciseMetadata(a)?.equipment.includes(equipment)));
}

export function swapExplanation(base: string, candidate: string) {
  if (normalize(base) === normalize(candidate)) return "Program exercise";
  if (!isDirectSwap(base, candidate)) return "Previously selected variation; changes the program's movement or needs separate dosing review.";
  return "Similar training role, not identical: setup, range of motion and muscle emphasis may differ. Use this exercise's own history or calibrate a comfortable load.";
}
