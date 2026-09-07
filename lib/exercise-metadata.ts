import type { Equipment, LoadingType } from "./training";

export type Muscle = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "quads" | "hamstrings" | "glutes" | "calves" | "trunk";
export type ExerciseMetadata = {
  version: 1; loadingType: LoadingType; perSide: boolean; equipment: Equipment[];
  region: "upper" | "lower" | "trunk"; primary: Muscle[]; secondary: Muscle[];
  family: string; homeAlternative?: string; estimatedMax: boolean;
  // Historical identity flags preserve saved keys when display/volume semantics are corrected.
  identityPerSide?: boolean; identityLoadingType?: LoadingType;
};
const registry = new Map<string, ExerciseMetadata>();
const normalize = (name: string) => name.trim().toLowerCase().replace(/[’]/g, "'");
const full: Equipment[] = ["full"], gym: Equipment[] = ["limited", "full"], home: Equipment[] = ["home", "limited", "full"];
type Options = Partial<Omit<ExerciseMetadata, "version" | "primary" | "secondary" | "family" | "region">>;
function group(names: string[], family: string, region: ExerciseMetadata["region"], primary: Muscle[], secondary: Muscle[], equipment: Equipment[], options: Options = {}) {
  for (const name of names) {
    if (registry.has(normalize(name))) throw new Error(`Duplicate exercise metadata: ${name}`);
    registry.set(normalize(name), { version: 1, family, region, primary, secondary, equipment, loadingType: "external", perSide: false, estimatedMax: true, ...options });
  }
}
group(["Incline dumbbell press","Flat dumbbell press"], "chest-press", "upper", ["chest"], ["shoulders","triceps"], home, { perSide: true, identityPerSide: true });
group(["Dumbbell floor press"], "chest-press", "upper", ["chest"], ["shoulders","triceps"], home, { perSide: true, identityPerSide: false });
group(["Incline barbell press","Barbell bench press","Smith machine bench press"], "chest-press", "upper", ["chest"], ["shoulders","triceps"], gym, { homeAlternative: "Dumbbell floor press" });
group(["Incline machine press","Machine chest press"], "chest-press", "upper", ["chest"], ["shoulders","triceps"], full, { homeAlternative: "Dumbbell floor press" });
group(["Push-up","Incline push-up"], "chest-press", "upper", ["chest"], ["shoulders","triceps"], home, { loadingType: "bodyweight", estimatedMax: false });
group(["Close-grip bench press"], "close-press", "upper", ["triceps"], ["chest","shoulders"], gym, { homeAlternative: "Close-grip push-up" });
group(["Close-grip push-up"], "close-press", "upper", ["triceps"], ["chest","shoulders"], home, { loadingType: "bodyweight", estimatedMax: false });
group(["Dips"], "dip", "upper", ["chest","triceps"], ["shoulders"], home, { loadingType: "bodyweight" });
group(["Assisted dip"], "dip", "upper", ["chest","triceps"], ["shoulders"], full, { loadingType: "assisted-bodyweight" });
group(["Cable fly","Cable crossover"], "chest-fly", "upper", ["chest"], [], full, { perSide: true, identityPerSide: false, homeAlternative: "Dumbbell fly" });
group(["Pec deck"], "chest-fly", "upper", ["chest"], [], full, { homeAlternative: "Dumbbell fly" });
group(["Dumbbell fly"], "chest-fly", "upper", ["chest"], [], home, { perSide: true });
group(["Seated dumbbell shoulder press","Dumbbell overhead press","Seated dumbbell press","Standing dumbbell press"], "overhead-press", "upper", ["shoulders"], ["triceps"], home, { perSide: true });
group(["Seated barbell press","Standing overhead press","Barbell overhead press"], "overhead-press", "upper", ["shoulders"], ["triceps"], gym, { homeAlternative: "Dumbbell overhead press" });
group(["Machine shoulder press"], "overhead-press", "upper", ["shoulders"], ["triceps"], full, { homeAlternative: "Dumbbell overhead press" });
group(["Pike push-up"], "overhead-press", "upper", ["shoulders"], ["triceps"], home, { loadingType: "bodyweight", estimatedMax: false });
group(["Chest-supported row","T-bar row","Seated cable row","Cable row","Machine row"], "row", "upper", ["back"], ["biceps","shoulders"], full, { homeAlternative: "One-arm dumbbell row" });
group(["Barbell row"], "row", "upper", ["back"], ["biceps","shoulders"], gym, { homeAlternative: "One-arm dumbbell row" });
group(["One-arm dumbbell row","Single-arm dumbbell row","Chest-supported dumbbell row","Dumbbell row"], "row", "upper", ["back"], ["biceps","shoulders"], home, { perSide: true });
group(["Band row"], "row", "upper", ["back"], ["biceps","shoulders"], home, { loadingType: "unloaded", estimatedMax: false });
group(["Lat pulldown","Neutral-grip pulldown"], "vertical-pull", "upper", ["back"], ["biceps"], full, { homeAlternative: "Band pulldown" });
group(["Single-arm pulldown"], "vertical-pull", "upper", ["back"], ["biceps"], full, { perSide: true, homeAlternative: "Band pulldown" });
group(["Pull-up","Chin-up"], "vertical-pull", "upper", ["back"], ["biceps"], home, { loadingType: "bodyweight" });
group(["Assisted pull-up"], "vertical-pull", "upper", ["back"], ["biceps"], full, { loadingType: "assisted-bodyweight" });
group(["Band pulldown"], "vertical-pull", "upper", ["back"], ["biceps"], home, { loadingType: "unloaded", estimatedMax: false });
group(["Barbell squat","Front squat","High-bar squat","Safety-bar squat"], "knee-dominant", "lower", ["quads","glutes"], [], gym, { homeAlternative: "Goblet squat" });
group(["Hack squat","Pendulum squat","Smith squat","Smith machine squat","Leg press"], "knee-dominant", "lower", ["quads","glutes"], [], full, { homeAlternative: "Goblet squat" });
group(["Goblet squat"], "knee-dominant", "lower", ["quads","glutes"], [], home);
group(["Bulgarian split squat","Split squat","Dumbbell split squat","Walking lunge","Reverse lunge","Step-up"], "unilateral-knee", "lower", ["quads","glutes"], [], home, { perSide: true });
group(["Romanian deadlift","Good morning","Trap-bar deadlift","Deadlift","Block pull","Rack pull"], "hinge", "lower", ["hamstrings","glutes"], ["back"], gym, { homeAlternative: "Dumbbell RDL" });
group(["Dumbbell RDL"], "hinge", "lower", ["hamstrings","glutes"], ["back"], home, { perSide: true });
group(["Kickstand RDL"], "hinge", "lower", ["hamstrings","glutes"], ["back"], home, { perSide: true, identityPerSide: false });
group(["Seated leg curl","Lying leg curl","Leg curl"], "knee-flexion", "lower", ["hamstrings"], [], full, { homeAlternative: "Slider leg curl" });
group(["Slider leg curl"], "knee-flexion", "lower", ["hamstrings"], [], home, { loadingType: "unloaded", estimatedMax: false });
group(["Nordic curl","Nordic hamstring curl"], "eccentric-knee-flexion", "lower", ["hamstrings"], [], home, { loadingType: "bodyweight", estimatedMax: false });
group(["Leg extension"], "knee-extension", "lower", ["quads"], [], full, { homeAlternative: "Wall sit" });
group(["Spanish squat","Sissy squat"], "knee-extension", "lower", ["quads"], [], home, { loadingType: "bodyweight", identityLoadingType: "external", estimatedMax: false });
group(["Wall sit"], "knee-extension", "lower", ["quads"], [], home, { loadingType: "unloaded", estimatedMax: false });
group(["Hip thrust","Barbell hip thrust"], "hip-extension", "lower", ["glutes"], [], gym, { homeAlternative: "Dumbbell glute bridge" });
group(["Dumbbell hip thrust","Dumbbell glute bridge"], "hip-extension", "lower", ["glutes"], [], home);
group(["Glute bridge","Quadruped hip extension"], "hip-extension", "lower", ["glutes"], [], home, { loadingType: "bodyweight", identityLoadingType: "external", estimatedMax: false });
group(["Machine hip thrust","Cable pull-through","Reverse hyperextension","Reverse hyper"], "hip-extension", "lower", ["glutes"], ["hamstrings"], full, { homeAlternative: "Dumbbell glute bridge" });
group(["Cable kickback","Cable abduction"], "hip-isolation", "lower", ["glutes"], [], full, { perSide: true, homeAlternative: "Side-lying leg raise" });
group(["Hip abduction","Machine hip abduction"], "hip-isolation", "lower", ["glutes"], [], full, { identityPerSide: true, homeAlternative: "Band hip abduction" });
group(["Band hip abduction","Band kickback"], "hip-isolation", "lower", ["glutes"], [], home, { perSide: true, loadingType: "unloaded", identityLoadingType: "external", estimatedMax: false });
group(["Side-lying leg raise"], "hip-isolation", "lower", ["glutes"], [], home, { loadingType: "bodyweight", estimatedMax: false });
group(["Standing calf raise","Seated calf raise","Leg press calf raise","Smith calf raise"], "calves", "lower", ["calves"], [], full, { homeAlternative: "Single-leg calf raise" });
group(["Single-leg calf raise"], "calves", "lower", ["calves"], [], home, { perSide: true });
group(["Dumbbell curl","Incline dumbbell curl","Hammer curl","Concentration curl"], "elbow-flexion", "upper", ["biceps"], [], home, { perSide: true });
group(["Barbell curl","EZ-bar curl"], "elbow-flexion", "upper", ["biceps"], [], gym, { homeAlternative: "Dumbbell curl" });
group(["Cable curl","Preacher curl"], "elbow-flexion", "upper", ["biceps"], [], full, { homeAlternative: "Dumbbell curl" });
group(["Band curl"], "elbow-flexion", "upper", ["biceps"], [], home, { loadingType: "unloaded", estimatedMax: false });
group(["Triceps pushdown","Triceps rope pushdown","Rope pushdown","Straight-bar pushdown","Overhead cable triceps extension","Overhead rope extension","Cable overhead extension","Overhead extension","Overhead triceps extension"], "elbow-extension", "upper", ["triceps"], [], full, { homeAlternative: "Band pushdown" });
group(["Skull crusher"], "elbow-extension", "upper", ["triceps"], [], gym, { homeAlternative: "Band pushdown" });
group(["Dumbbell overhead extension"], "elbow-extension", "upper", ["triceps"], [], home, { identityPerSide: true });
group(["Band pushdown"], "elbow-extension", "upper", ["triceps"], [], home, { loadingType: "unloaded", estimatedMax: false });
group(["Lateral raise","Dumbbell lateral raise","Dumbbell reverse fly","Dumbbell rear-delt fly"], "shoulder-isolation", "upper", ["shoulders"], [], home, { perSide: true });
group(["Cable lateral raise","Cable rear-delt fly"], "shoulder-isolation", "upper", ["shoulders"], [], full, { perSide: true, identityPerSide: false, homeAlternative: "Dumbbell lateral raise" });
group(["Machine lateral raise"], "shoulder-isolation", "upper", ["shoulders"], [], full, { homeAlternative: "Dumbbell lateral raise" });
group(["Reverse pec deck","Face pull"], "shoulder-isolation", "upper", ["shoulders"], ["back"], full, { homeAlternative: "Dumbbell reverse fly" });
group(["Band pull-apart","Band lateral raise"], "shoulder-isolation", "upper", ["shoulders"], [], home, { loadingType: "unloaded", identityLoadingType: "unloaded", estimatedMax: false });
group(["Cable crunch","Machine crunch"], "trunk", "trunk", ["trunk"], [], full, { homeAlternative: "Reverse crunch", estimatedMax: false });
group(["Hanging leg raise","Hanging knee raise","Captain's chair raise","Captain's chair leg raise","Reverse crunch"], "trunk", "trunk", ["trunk"], [], home, { loadingType: "bodyweight", estimatedMax: false });
group(["Dead bug"], "trunk", "trunk", ["trunk"], [], home, { loadingType: "unloaded", estimatedMax: false });

// Old resolver omissions affected only unit/volume labels. Keep their history keys
// stable while correcting how future entries describe one dumbbell versus a total.
for (const name of ["Hammer curl","Concentration curl","Lateral raise","Dumbbell reverse fly","Dumbbell rear-delt fly"]) registry.get(normalize(name))!.identityPerSide = false;
registry.get(normalize("Band lateral raise"))!.identityLoadingType = "external";
export const exerciseMetadata = (name: string) => registry.get(normalize(name));
export const EXERCISE_METADATA_VERSION = 1;
export const MUSCLES: Muscle[] = ["chest","back","shoulders","biceps","triceps","quads","hamstrings","glutes","calves","trunk"];
