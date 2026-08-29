export type Unit = "kg" | "lb";
export type Level = "new" | "beginner" | "intermediate" | "experienced" | "returning";
export type Gender = "man" | "woman";
export type ProgramTrack = "current" | "women";
export type TrainingGoal = "balanced" | "strength" | "upper" | "lower";
export type Equipment = "full" | "limited" | "home";
export type ProgramId = "phase1" | "phase2";
export type SbsRole = "main" | "auxiliary";
export type TrainingFrequency = 3 | 4 | 5;
export type WeightGoal = "cut" | "maintain" | "bulk";
export type ProgramStatus = "active" | "paused" | "completed";

export type SetEntry = {
  w: string;
  r: string;
  rir: string;
};

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  repLow: number;
  repHigh: number;
  restSeconds: 90 | 120 | 180;
  ratio?: number;
  perSide?: boolean;
  bodyweight?: boolean;
  note?: string;
  sbsRole?: SbsRole;
  historyIds?: string[];
  alternatives: string[];
};

export type TrainingDay = {
  id: string;
  name: string;
  focus: string;
  weekday: number;
  lower: boolean;
  exercises: Exercise[];
};

export type Profile = {
  bodyweight: number;
  unit: Unit;
  level: Level;
  gender: Gender;
  programTrack: ProgramTrack;
  goal: TrainingGoal;
  equipment: Equipment;
  weightGoal: WeightGoal;
  weightTrackingEnabled: boolean;
};

export type Session = {
  id: string;
  date: string;
  dayId: string;
  unit: Unit;
  entries: Record<string, SetEntry[]>;
  programId?: ProgramId;
  programWeek?: number;
  programFrequency?: TrainingFrequency;
  trainingMaxesBefore?: Record<string, number>;
  trainingMaxesAfter?: Record<string, number>;
  revision: number;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionRevision = {
  id: string;
  sessionId: string;
  action: "edited" | "deleted" | "restored";
  at: string;
  note: string;
  previous: Session;
};

export type WeighIn = {
  id: string;
  date: string;
  weight: number;
  unit: Unit;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

export type WeekRecord = {
  programId: ProgramId;
  week: number;
  frequency: TrainingFrequency;
  status: "completed" | "extended" | "skipped";
  completedDayIds: string[];
  skippedDayIds: string[];
  at: string;
};

export type ProgramState = {
  activeId: ProgramId;
  week: number;
  frequency: TrainingFrequency;
  preferredWeekdays: number[];
  status: ProgramStatus;
  pausedAt?: string;
  calibrationRequired: boolean;
  phase1CompletedAt?: string;
  phase2UnlockedAt?: string;
  weekRecords: WeekRecord[];
  trainingMaxes: Record<string, number>;
};

export type TrainingData = {
  version: 5;
  updatedAt: string;
  setupVersion: number;
  setupCompletedAt?: string;
  profile: Profile | null;
  sessions: Session[];
  sessionRevisions: SessionRevision[];
  weighIns: WeighIn[];
  swaps: Record<string, string>;
  program: ProgramState;
};

export const LEVELS: Array<{ id: Level; label: string; factor: number }> = [
  { id: "new", label: "Under 6 months", factor: 0.6 },
  { id: "beginner", label: "6–18 months", factor: 0.7 },
  { id: "intermediate", label: "18 months–3 years", factor: 0.8 },
  { id: "experienced", label: "3+ years", factor: 1 },
  { id: "returning", label: "Returning after a break", factor: 0.65 },
];

export const trainingTrack = (gender: Gender): ProgramTrack => gender === "woman" ? "women" : "current";

export const PHASE_ONE_PROGRAM: TrainingDay[] = [
  {
    id: "UA",
    name: "Upper A",
    focus: "Push emphasis",
    weekday: 1,
    lower: false,
    exercises: [
      { id: "ua1", name: "Incline dumbbell press", sets: 3, repLow: 6, repHigh: 10, restSeconds: 180, ratio: 0.32, perSide: true, alternatives: ["Incline barbell press", "Incline machine press"] },
      { id: "ua2", name: "Chest-supported row", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.7, alternatives: ["Seated cable row", "T-bar row"] },
      { id: "ua3", name: "Seated dumbbell shoulder press", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.24, perSide: true, alternatives: ["Machine shoulder press", "Standing overhead press"] },
      { id: "ua4", name: "Lat pulldown", sets: 2, repLow: 10, repHigh: 12, restSeconds: 120, ratio: 0.85, alternatives: ["Assisted pull-up", "Neutral-grip pulldown"] },
      { id: "ua5", name: "Cable fly", sets: 2, repLow: 12, repHigh: 15, restSeconds: 90, ratio: 0.16, perSide: true, alternatives: ["Pec deck", "Dumbbell fly"] },
      { id: "ua6", name: "Lateral raise", sets: 3, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.13, perSide: true, alternatives: ["Cable lateral raise", "Machine lateral raise"] },
      { id: "ua7", name: "Face pull", sets: 2, repLow: 15, repHigh: 20, restSeconds: 90, ratio: 0.32, alternatives: ["Reverse pec deck", "Band pull-apart"] },
      { id: "ua8", name: "Triceps rope pushdown", sets: 2, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.42, alternatives: ["Straight-bar pushdown", "Overhead rope extension"] },
    ],
  },
  {
    id: "LA",
    name: "Lower A",
    focus: "Hinge emphasis",
    weekday: 2,
    lower: true,
    exercises: [
      { id: "la1", name: "Romanian deadlift", sets: 3, repLow: 6, repHigh: 10, restSeconds: 180, ratio: 1.3, alternatives: ["Dumbbell RDL", "Good morning"] },
      { id: "la2", name: "Leg press", sets: 3, repLow: 10, repHigh: 15, restSeconds: 180, ratio: 2.2, alternatives: ["Hack squat", "Goblet squat"] },
      { id: "la3", name: "Seated leg curl", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.6, alternatives: ["Lying leg curl", "Nordic curl"] },
      { id: "la4", name: "Hip thrust", sets: 2, repLow: 10, repHigh: 15, restSeconds: 180, ratio: 1.4, alternatives: ["Glute bridge", "Cable kickback"] },
      { id: "la5", name: "Standing calf raise", sets: 3, repLow: 8, repHigh: 12, restSeconds: 90, ratio: 1.1, alternatives: ["Leg press calf raise", "Smith calf raise"] },
      { id: "la6", name: "Hanging leg raise", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, bodyweight: true, alternatives: ["Captain's chair raise", "Reverse crunch"] },
    ],
  },
  {
    id: "UB",
    name: "Upper B",
    focus: "Pull emphasis",
    weekday: 4,
    lower: false,
    exercises: [
      { id: "ub1", name: "Pull-up", sets: 3, repLow: 6, repHigh: 10, restSeconds: 180, bodyweight: true, alternatives: ["Lat pulldown", "Assisted pull-up"] },
      { id: "ub2", name: "Machine chest press", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.9, alternatives: ["Flat dumbbell press", "Barbell bench press"] },
      { id: "ub3", name: "Single-arm dumbbell row", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.32, perSide: true, alternatives: ["Chest-supported row", "Seated cable row"] },
      { id: "ub4", name: "Reverse pec deck", sets: 3, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.32, alternatives: ["Cable rear-delt fly", "Face pull"] },
      { id: "ub5", name: "Lateral raise", sets: 2, repLow: 15, repHigh: 20, restSeconds: 90, ratio: 0.13, perSide: true, alternatives: ["Cable lateral raise", "Machine lateral raise"] },
      { id: "ub6", name: "Incline dumbbell curl", sets: 3, repLow: 8, repHigh: 12, restSeconds: 90, ratio: 0.15, perSide: true, alternatives: ["Dumbbell curl", "Cable curl"] },
      { id: "ub7", name: "Overhead cable triceps extension", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.32, alternatives: ["Skull crusher", "Dumbbell overhead extension"] },
    ],
  },
  {
    id: "LB",
    name: "Lower B",
    focus: "Quad emphasis",
    weekday: 5,
    lower: true,
    exercises: [
      { id: "lb1", name: "Barbell squat", sets: 3, repLow: 5, repHigh: 8, restSeconds: 180, ratio: 1.45, note: "First, while fresh", alternatives: ["Hack squat", "Smith squat"] },
      { id: "lb2", name: "Bulgarian split squat", sets: 2, repLow: 8, repHigh: 12, restSeconds: 180, ratio: 0.22, perSide: true, note: "Per leg", alternatives: ["Walking lunge", "Step-up"] },
      { id: "lb3", name: "Leg extension", sets: 3, repLow: 12, repHigh: 15, restSeconds: 90, ratio: 0.8, alternatives: ["Sissy squat", "Goblet squat"] },
      { id: "lb4", name: "Lying leg curl", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.55, alternatives: ["Seated leg curl", "Nordic curl"] },
      { id: "lb5", name: "Seated calf raise", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.7, alternatives: ["Standing calf raise", "Leg press calf raise"] },
      { id: "lb6", name: "Cable crunch", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.5, alternatives: ["Hanging leg raise", "Machine crunch"] },
    ],
  },
  {
    id: "UC",
    name: "Upper C",
    focus: "Delts, arms, chest",
    weekday: 6,
    lower: false,
    exercises: [
      { id: "uc1", name: "Pec deck", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.55, alternatives: ["Cable crossover", "Dumbbell fly"] },
      { id: "uc2", name: "Seated cable row", sets: 3, repLow: 10, repHigh: 12, restSeconds: 120, ratio: 0.8, alternatives: ["Chest-supported row", "Lat pulldown"] },
      { id: "uc3", name: "Cable lateral raise", sets: 4, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.11, perSide: true, alternatives: ["Dumbbell lateral raise", "Machine lateral raise"] },
      { id: "uc4", name: "EZ-bar curl", sets: 3, repLow: 8, repHigh: 12, restSeconds: 90, ratio: 0.42, alternatives: ["Barbell curl", "Dumbbell curl"] },
      { id: "uc5", name: "Cable curl", sets: 2, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.32, alternatives: ["Preacher curl", "Concentration curl"] },
      { id: "uc6", name: "Dips", sets: 3, repLow: 8, repHigh: 12, restSeconds: 180, bodyweight: true, alternatives: ["Close-grip bench press", "Assisted dip"] },
      { id: "uc7", name: "Triceps pushdown", sets: 2, repLow: 12, repHigh: 15, restSeconds: 90, ratio: 0.42, alternatives: ["Rope pushdown", "Overhead extension"] },
    ],
  },
];

export type SbsPrescription = {
  intensity: number;
  normalReps: number;
  repOutTarget: number;
  sets: number;
  deload: boolean;
};

const SBS_MAIN_WEEKS = [
  [0.7, 10, 12], [0.725, 9, 11], [0.75, 8, 10], [0.725, 9, 11], [0.75, 8, 10], [0.775, 7, 9], [0.6, 14, 18],
  [0.725, 9, 11], [0.75, 8, 10], [0.775, 7, 9], [0.75, 8, 10], [0.775, 7, 9], [0.8, 6, 8], [0.6, 14, 18],
  [0.75, 8, 10], [0.775, 7, 9], [0.8, 6, 8], [0.775, 7, 9], [0.8, 6, 8], [0.825, 5, 6], [0.6, 14, 18],
] as const;

const SBS_AUXILIARY_WEEKS = [
  [0.65, 12, 15], [0.675, 11, 13], [0.7, 10, 12], [0.675, 11, 13], [0.7, 10, 12], [0.725, 9, 11], [0.55, 17, 21],
  [0.675, 11, 13], [0.7, 10, 12], [0.725, 9, 11], [0.7, 10, 12], [0.725, 9, 11], [0.75, 8, 10], [0.55, 17, 21],
  [0.7, 10, 12], [0.725, 9, 11], [0.75, 8, 10], [0.725, 9, 11], [0.75, 8, 10], [0.775, 7, 9], [0.55, 17, 21],
] as const;

export const sbsPrescription = (role: SbsRole, week: number): SbsPrescription => {
  const index = Math.max(0, Math.min(20, Math.trunc(week) - 1));
  const [intensity, normalReps, repOutTarget] = role === "main" ? SBS_MAIN_WEEKS[index] : SBS_AUXILIARY_WEEKS[index];
  return { intensity, normalReps, repOutTarget, sets: 4, deload: [7, 14, 21].includes(index + 1) };
};

export const sbsTrainingMaxChange = (actualReps: number, targetReps: number) => {
  const difference = actualReps - targetReps;
  if (difference <= -2) return -0.05;
  if (difference === -1) return -0.02;
  if (difference === 0) return 0;
  if (difference === 1) return 0.005;
  if (difference === 2) return 0.01;
  if (difference === 3) return 0.015;
  if (difference === 4) return 0.02;
  return 0.03;
};

const PHASE_TWO_EXERCISE_SOURCE: TrainingDay[] = [
  {
    id: "P2D1",
    name: "Phase 2 · Day 1",
    focus: "Squat and shoulder strength",
    weekday: 1,
    lower: false,
    exercises: [
      { id: "p2-squat", name: "Barbell squat", sets: 4, repLow: 10, repHigh: 12, restSeconds: 180, ratio: 1.45, sbsRole: "main", historyIds: ["lb1"], note: "Last set AMRAP", alternatives: ["High-bar squat", "Safety-bar squat"] },
      { id: "p2-db-ohp", name: "Seated dumbbell shoulder press", sets: 4, repLow: 12, repHigh: 15, restSeconds: 180, ratio: 0.24, perSide: true, sbsRole: "auxiliary", historyIds: ["ua3"], note: "Last set AMRAP", alternatives: ["Machine shoulder press", "Standing dumbbell press"] },
      { id: "p2-d1-row", name: "Chest-supported row", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.7, historyIds: ["ua2", "ub3", "uc2"], alternatives: ["Seated cable row", "T-bar row"] },
      { id: "p2-d1-lateral", name: "Lateral raise", sets: 3, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.13, perSide: true, historyIds: ["ua6", "ub5", "uc3"], alternatives: ["Cable lateral raise", "Machine lateral raise"] },
      { id: "p2-d1-triceps", name: "Triceps rope pushdown", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.42, historyIds: ["ua8", "uc7"], alternatives: ["Straight-bar pushdown", "Overhead rope extension"] },
    ],
  },
  {
    id: "P2D2",
    name: "Phase 2 · Day 2",
    focus: "Bench and quad volume",
    weekday: 2,
    lower: false,
    exercises: [
      { id: "p2-bench", name: "Barbell bench press", sets: 4, repLow: 10, repHigh: 12, restSeconds: 180, ratio: 1, sbsRole: "main", historyIds: ["ub2"], note: "Last set AMRAP", alternatives: ["Machine chest press", "Flat dumbbell press"] },
      { id: "p2-leg-press", name: "Leg press", sets: 4, repLow: 12, repHigh: 15, restSeconds: 180, ratio: 2.2, sbsRole: "auxiliary", historyIds: ["la2"], note: "Last set AMRAP", alternatives: ["Hack squat", "Pendulum squat"] },
      { id: "p2-d2-pulldown", name: "Lat pulldown", sets: 3, repLow: 10, repHigh: 15, restSeconds: 120, ratio: 0.85, historyIds: ["ua4", "ub1"], alternatives: ["Assisted pull-up", "Neutral-grip pulldown"] },
      { id: "p2-d2-leg-curl", name: "Seated leg curl", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.6, historyIds: ["la3", "lb4"], alternatives: ["Lying leg curl", "Nordic curl"] },
      { id: "p2-d2-calves", name: "Standing calf raise", sets: 3, repLow: 8, repHigh: 12, restSeconds: 90, ratio: 1.1, historyIds: ["la5", "lb5"], alternatives: ["Leg press calf raise", "Smith calf raise"] },
    ],
  },
  {
    id: "P2D3",
    name: "Phase 2 · Day 3",
    focus: "Posterior chain and upper chest",
    weekday: 4,
    lower: false,
    exercises: [
      { id: "p2-block-pull", name: "Block pull", sets: 4, repLow: 10, repHigh: 12, restSeconds: 180, ratio: 1.55, sbsRole: "main", historyIds: ["la1"], note: "Last set AMRAP", alternatives: ["Rack pull", "Trap-bar deadlift"] },
      { id: "p2-incline", name: "Incline dumbbell press", sets: 4, repLow: 12, repHigh: 15, restSeconds: 180, ratio: 0.32, perSide: true, sbsRole: "auxiliary", historyIds: ["ua1"], note: "Last set AMRAP", alternatives: ["Incline barbell press", "Incline machine press"] },
      { id: "p2-d3-row", name: "Seated cable row", sets: 3, repLow: 10, repHigh: 12, restSeconds: 120, ratio: 0.8, historyIds: ["uc2", "ua2"], alternatives: ["Chest-supported row", "T-bar row"] },
      { id: "p2-d3-rear-delt", name: "Reverse pec deck", sets: 3, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.32, historyIds: ["ub4", "ua7"], alternatives: ["Cable rear-delt fly", "Face pull"] },
      { id: "p2-d3-curl", name: "Incline dumbbell curl", sets: 3, repLow: 8, repHigh: 12, restSeconds: 90, ratio: 0.15, perSide: true, historyIds: ["ub6", "uc4"], alternatives: ["Dumbbell curl", "Cable curl"] },
    ],
  },
  {
    id: "P2D4",
    name: "Phase 2 · Day 4",
    focus: "Overhead press and squat volume",
    weekday: 5,
    lower: false,
    exercises: [
      { id: "p2-ohp", name: "Standing overhead press", sets: 4, repLow: 10, repHigh: 12, restSeconds: 180, ratio: 0.55, sbsRole: "main", historyIds: ["ua3"], note: "Last set AMRAP", alternatives: ["Seated barbell press", "Machine shoulder press"] },
      { id: "p2-hack-squat", name: "Hack squat", sets: 4, repLow: 12, repHigh: 15, restSeconds: 180, ratio: 1.7, sbsRole: "auxiliary", historyIds: ["lb1", "la2"], note: "Last set AMRAP", alternatives: ["Pendulum squat", "Smith squat"] },
      { id: "p2-d4-pullup", name: "Pull-up", sets: 3, repLow: 6, repHigh: 10, restSeconds: 120, bodyweight: true, historyIds: ["ub1"], alternatives: ["Lat pulldown", "Assisted pull-up"] },
      { id: "p2-d4-leg-curl", name: "Lying leg curl", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.55, historyIds: ["lb4", "la3"], alternatives: ["Seated leg curl", "Nordic curl"] },
      { id: "p2-d4-abs", name: "Cable crunch", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.5, historyIds: ["lb6", "la6"], alternatives: ["Hanging leg raise", "Machine crunch"] },
    ],
  },
  {
    id: "P2D5",
    name: "Phase 2 · Day 5",
    focus: "Chest and posterior-chain volume",
    weekday: 6,
    lower: false,
    exercises: [
      { id: "p2-db-bench", name: "Flat dumbbell press", sets: 4, repLow: 12, repHigh: 15, restSeconds: 180, ratio: 0.36, perSide: true, sbsRole: "auxiliary", historyIds: ["ub2", "ua1"], note: "Last set AMRAP", alternatives: ["Machine chest press", "Barbell bench press"] },
      { id: "p2-rdl", name: "Romanian deadlift", sets: 4, repLow: 12, repHigh: 15, restSeconds: 180, ratio: 1.3, sbsRole: "auxiliary", historyIds: ["la1"], note: "Last set AMRAP", alternatives: ["Dumbbell RDL", "Good morning"] },
      { id: "p2-d5-fly", name: "Cable fly", sets: 3, repLow: 12, repHigh: 15, restSeconds: 90, ratio: 0.16, perSide: true, historyIds: ["ua5", "uc1"], alternatives: ["Pec deck", "Dumbbell fly"] },
      { id: "p2-d5-curl", name: "EZ-bar curl", sets: 3, repLow: 8, repHigh: 12, restSeconds: 90, ratio: 0.42, historyIds: ["uc4", "ub6"], alternatives: ["Barbell curl", "Cable curl"] },
      { id: "p2-d5-triceps", name: "Overhead cable triceps extension", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.32, historyIds: ["ub7", "ua8"], alternatives: ["Skull crusher", "Dumbbell overhead extension"] },
    ],
  },
];

const phaseTwoExercise = (id: string) => {
  const exercise = PHASE_TWO_EXERCISE_SOURCE.flatMap((day) => day.exercises).find((item) => item.id === id);
  if (!exercise) throw new Error(`Unknown Phase 2 exercise: ${id}`);
  return { ...exercise, alternatives: [...exercise.alternatives] };
};

const phaseTwoDay = (
  id: string,
  name: string,
  focus: string,
  weekday: number,
  programmed: string[],
  accessories: string[],
): TrainingDay => ({
  id,
  name,
  focus,
  weekday,
  lower: false,
  exercises: [...programmed, ...accessories].map(phaseTwoExercise),
});

// Exercise ordering follows the supplied official SBS Hypertrophy lower-frequency workbook.
export const PHASE_TWO_PROGRAM_3: TrainingDay[] = [
  phaseTwoDay("P2F3D1", "Phase 2 · Day 1", "Squat, pull and quad strength", 1,
    ["p2-squat", "p2-block-pull", "p2-leg-press"], ["p2-d1-row", "p2-d1-lateral"]),
  phaseTwoDay("P2F3D2", "Phase 2 · Day 2", "Bench, overhead and upper-chest strength", 3,
    ["p2-bench", "p2-ohp", "p2-incline"], ["p2-d2-pulldown", "p2-d1-triceps"]),
  phaseTwoDay("P2F3D3", "Phase 2 · Day 3", "Auxiliary full-body volume", 5,
    ["p2-db-ohp", "p2-hack-squat", "p2-db-bench", "p2-rdl"], ["p2-d3-row", "p2-d2-leg-curl"]),
];

export const PHASE_TWO_PROGRAM_4: TrainingDay[] = [
  phaseTwoDay("P2F4D1", "Phase 2 · Day 1", "Squat and posterior-chain volume", 1,
    ["p2-squat", "p2-rdl", "p2-hack-squat"], ["p2-d1-row", "p2-d1-lateral"]),
  phaseTwoDay("P2F4D2", "Phase 2 · Day 2", "Bench and shoulder volume", 2,
    ["p2-bench", "p2-db-ohp", "p2-db-bench"], ["p2-d2-pulldown", "p2-d1-triceps"]),
  phaseTwoDay("P2F4D3", "Phase 2 · Day 3", "Pull and quad strength", 4,
    ["p2-block-pull", "p2-leg-press"], ["p2-d3-row", "p2-d2-leg-curl", "p2-d2-calves"]),
  phaseTwoDay("P2F4D4", "Phase 2 · Day 4", "Overhead and upper-chest strength", 5,
    ["p2-ohp", "p2-incline"], ["p2-d4-pullup", "p2-d3-rear-delt", "p2-d4-abs"]),
];

export const PHASE_TWO_PROGRAM: TrainingDay[] = [
  phaseTwoDay("P2D1", "Phase 2 · Day 1", "Squat and quad strength", 1,
    ["p2-squat", "p2-hack-squat"], ["p2-d1-row", "p2-d1-lateral", "p2-d1-triceps"]),
  phaseTwoDay("P2D2", "Phase 2 · Day 2", "Bench and shoulder volume", 2,
    ["p2-bench", "p2-db-ohp", "p2-db-bench"], ["p2-d2-pulldown", "p2-d3-rear-delt"]),
  phaseTwoDay("P2D3", "Phase 2 · Day 3", "Posterior-chain strength", 4,
    ["p2-block-pull"], ["p2-d3-row", "p2-d2-leg-curl", "p2-d2-calves"]),
  phaseTwoDay("P2D4", "Phase 2 · Day 4", "Overhead and upper-chest strength", 5,
    ["p2-ohp", "p2-incline"], ["p2-d4-pullup", "p2-d3-rear-delt", "p2-d4-abs"]),
  phaseTwoDay("P2D5", "Phase 2 · Day 5", "Quad and posterior-chain volume", 6,
    ["p2-leg-press", "p2-rdl"], ["p2-d5-fly", "p2-d5-curl", "p2-d5-triceps"]),
];

export const PHASE_TWO_PROGRAMS: Record<TrainingFrequency, TrainingDay[]> = {
  3: PHASE_TWO_PROGRAM_3,
  4: PHASE_TWO_PROGRAM_4,
  5: PHASE_TWO_PROGRAM,
};

// The women's track uses the same evidence-based progression rules as the current
// track, with balanced upper-body work, lower-body exposure spread across the week,
// and user-selected emphasis rather than sex-based strength assumptions.
const WOMENS_PHASE_ONE_SOURCE: TrainingDay[] = [
  { id: "W1D1", name: "Lower A", focus: "Squat and glute strength", weekday: 1, lower: true, exercises: [
    { id: "w1-squat", name: "High-bar squat", sets: 3, repLow: 6, repHigh: 10, restSeconds: 180, ratio: 1.05, alternatives: ["Goblet squat", "Hack squat", "Smith squat"] },
    { id: "w1-hip-thrust", name: "Hip thrust", sets: 3, repLow: 8, repHigh: 12, restSeconds: 180, ratio: 1.15, alternatives: ["Glute bridge", "Dumbbell hip thrust", "Cable pull-through"] },
    { id: "w1-leg-curl", name: "Seated leg curl", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.45, alternatives: ["Lying leg curl", "Slider leg curl", "Nordic curl"] },
    { id: "w1-calf", name: "Standing calf raise", sets: 3, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.8, alternatives: ["Single-leg calf raise", "Leg press calf raise", "Seated calf raise"] },
    { id: "w1-crunch", name: "Cable crunch", sets: 2, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.4, alternatives: ["Reverse crunch", "Dead bug", "Hanging knee raise"] },
  ] },
  { id: "W1D2", name: "Upper A", focus: "Pull, press and shoulders", weekday: 2, lower: false, exercises: [
    { id: "w1-pulldown", name: "Lat pulldown", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.65, alternatives: ["Band pulldown", "Assisted pull-up", "Single-arm pulldown"] },
    { id: "w1-incline", name: "Incline dumbbell press", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.22, perSide: true, alternatives: ["Incline push-up", "Incline machine press", "Incline barbell press"] },
    { id: "w1-row", name: "Chest-supported row", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.55, alternatives: ["One-arm dumbbell row", "Seated cable row", "Band row"] },
    { id: "w1-db-ohp", name: "Seated dumbbell shoulder press", sets: 2, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.16, perSide: true, alternatives: ["Standing dumbbell press", "Machine shoulder press", "Pike push-up"] },
    { id: "w1-lateral", name: "Lateral raise", sets: 3, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.08, perSide: true, alternatives: ["Band lateral raise", "Cable lateral raise", "Machine lateral raise"] },
    { id: "w1-triceps", name: "Triceps rope pushdown", sets: 2, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.3, alternatives: ["Band pushdown", "Dumbbell overhead extension", "Close-grip push-up"] },
  ] },
  { id: "W1D3", name: "Lower B", focus: "Hinge and unilateral strength", weekday: 4, lower: true, exercises: [
    { id: "w1-rdl", name: "Romanian deadlift", sets: 3, repLow: 6, repHigh: 10, restSeconds: 180, ratio: 1, alternatives: ["Dumbbell RDL", "Kickstand RDL", "Good morning"] },
    { id: "w1-leg-press", name: "Leg press", sets: 3, repLow: 10, repHigh: 15, restSeconds: 180, ratio: 1.7, alternatives: ["Goblet squat", "Hack squat", "Step-up"] },
    { id: "w1-split-squat", name: "Bulgarian split squat", sets: 2, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.16, perSide: true, alternatives: ["Reverse lunge", "Step-up", "Split squat"] },
    { id: "w1-lying-curl", name: "Lying leg curl", sets: 2, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.42, alternatives: ["Slider leg curl", "Seated leg curl", "Nordic curl"] },
    { id: "w1-abduction", name: "Hip abduction", sets: 3, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.35, alternatives: ["Band hip abduction", "Side-lying leg raise", "Cable abduction"] },
  ] },
  { id: "W1D4", name: "Upper B", focus: "Upper-body strength and posture", weekday: 5, lower: false, exercises: [
    { id: "w1-chest-press", name: "Machine chest press", sets: 3, repLow: 6, repHigh: 10, restSeconds: 180, ratio: 0.65, alternatives: ["Dumbbell floor press", "Push-up", "Barbell bench press"] },
    { id: "w1-cable-row", name: "Seated cable row", sets: 3, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.6, alternatives: ["One-arm dumbbell row", "Band row", "Chest-supported row"] },
    { id: "w1-neutral-pulldown", name: "Neutral-grip pulldown", sets: 2, repLow: 10, repHigh: 15, restSeconds: 120, ratio: 0.6, alternatives: ["Band pulldown", "Assisted pull-up", "Lat pulldown"] },
    { id: "w1-rear-delt", name: "Reverse pec deck", sets: 3, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.25, alternatives: ["Band pull-apart", "Dumbbell rear-delt fly", "Face pull"] },
    { id: "w1-curl", name: "Dumbbell curl", sets: 2, repLow: 10, repHigh: 15, restSeconds: 90, ratio: 0.1, perSide: true, alternatives: ["Band curl", "Cable curl", "Hammer curl"] },
  ] },
  { id: "W1D5", name: "Lower C", focus: "Quad and glute volume", weekday: 6, lower: true, exercises: [
    { id: "w1-hack", name: "Hack squat", sets: 3, repLow: 8, repHigh: 12, restSeconds: 180, ratio: 1.25, alternatives: ["Goblet squat", "Smith squat", "Front squat"] },
    { id: "w1-glute-bridge", name: "Glute bridge", sets: 3, repLow: 10, repHigh: 15, restSeconds: 120, ratio: 0.9, alternatives: ["Dumbbell glute bridge", "Hip thrust", "Cable pull-through"] },
    { id: "w1-step-up", name: "Step-up", sets: 2, repLow: 8, repHigh: 12, restSeconds: 120, ratio: 0.14, perSide: true, alternatives: ["Reverse lunge", "Walking lunge", "Split squat"] },
    { id: "w1-extension", name: "Leg extension", sets: 3, repLow: 12, repHigh: 15, restSeconds: 90, ratio: 0.55, alternatives: ["Spanish squat", "Sissy squat", "Wall sit"] },
    { id: "w1-kickback", name: "Cable kickback", sets: 2, repLow: 12, repHigh: 20, restSeconds: 90, ratio: 0.15, perSide: true, alternatives: ["Band kickback", "Quadruped hip extension", "Reverse hyperextension"] },
  ] },
];

const exerciseFromSource = (source: TrainingDay[], id: string) => {
  const exercise = source.flatMap((day) => day.exercises).find((item) => item.id === id);
  if (!exercise) throw new Error(`Unknown exercise: ${id}`);
  return { ...exercise, alternatives: [...exercise.alternatives] };
};

const assembledDay = (source: TrainingDay[], id: string, name: string, focus: string, weekday: number, ids: string[]): TrainingDay => ({
  id, name, focus, weekday, lower: ids.filter((item) => /squat|thrust|curl|rdl|press|split|abduction|hack|bridge|step|extension|kickback/.test(item)).length >= Math.ceil(ids.length / 2),
  exercises: ids.map((item) => exerciseFromSource(source, item)),
});

export const WOMENS_PHASE_ONE_PROGRAMS: Record<TrainingFrequency, TrainingDay[]> = {
  3: [
    assembledDay(WOMENS_PHASE_ONE_SOURCE, "W1F3D1", "Full Body A", "Squat, glutes, press and pull", 1, ["w1-squat", "w1-hip-thrust", "w1-incline", "w1-row", "w1-lateral"]),
    assembledDay(WOMENS_PHASE_ONE_SOURCE, "W1F3D2", "Full Body B", "Hinge, quads and upper strength", 3, ["w1-rdl", "w1-leg-press", "w1-pulldown", "w1-db-ohp", "w1-leg-curl"]),
    assembledDay(WOMENS_PHASE_ONE_SOURCE, "W1F3D3", "Full Body C", "Unilateral legs, glutes and posture", 5, ["w1-hack", "w1-split-squat", "w1-glute-bridge", "w1-chest-press", "w1-cable-row", "w1-crunch"]),
  ],
  4: [
    assembledDay(WOMENS_PHASE_ONE_SOURCE, "W1F4D1", "Lower A", "Squat and glute strength", 1, ["w1-squat", "w1-hip-thrust", "w1-leg-curl", "w1-calf", "w1-crunch"]),
    assembledDay(WOMENS_PHASE_ONE_SOURCE, "W1F4D2", "Upper A", "Pull, press and shoulders", 2, ["w1-pulldown", "w1-incline", "w1-row", "w1-lateral", "w1-triceps"]),
    assembledDay(WOMENS_PHASE_ONE_SOURCE, "W1F4D3", "Lower B", "Hinge, unilateral legs and glutes", 4, ["w1-rdl", "w1-leg-press", "w1-split-squat", "w1-lying-curl", "w1-abduction"]),
    assembledDay(WOMENS_PHASE_ONE_SOURCE, "W1F4D4", "Upper B", "Upper-body strength and posture", 5, ["w1-chest-press", "w1-cable-row", "w1-neutral-pulldown", "w1-db-ohp", "w1-rear-delt", "w1-curl"]),
  ],
  5: WOMENS_PHASE_ONE_SOURCE,
};

const WOMENS_PHASE_TWO_SOURCE: TrainingDay[] = WOMENS_PHASE_ONE_SOURCE.map((day) => ({
  ...day,
  exercises: day.exercises.map((exercise) => ({ ...exercise, alternatives: [...exercise.alternatives] })),
}));

const WOMENS_PROGRAMMED_IDS = new Set(["w1-squat", "w1-hip-thrust", "w1-chest-press", "w1-leg-press", "w1-rdl", "w1-incline", "w1-db-ohp", "w1-split-squat"]);
WOMENS_PHASE_TWO_SOURCE.forEach((day) => day.exercises.forEach((exercise) => {
  if (!WOMENS_PROGRAMMED_IDS.has(exercise.id)) return;
  const historyId = exercise.id;
  exercise.id = exercise.id.replace("w1-", "w2-");
  exercise.sbsRole = ["w1-squat", "w1-hip-thrust", "w1-chest-press", "w1-rdl"].includes(historyId) ? "main" : "auxiliary";
  exercise.sets = 4;
  exercise.note = "Last set AMRAP";
  exercise.historyIds = [historyId];
}));

const womenPhaseTwoDay = (id: string, name: string, focus: string, weekday: number, ids: string[]) =>
  assembledDay(WOMENS_PHASE_TWO_SOURCE, id, name, focus, weekday, ids);

export const WOMENS_PHASE_TWO_PROGRAMS: Record<TrainingFrequency, TrainingDay[]> = {
  3: [
    womenPhaseTwoDay("W2F3D1", "Phase 2 · Day 1", "Squat, glutes and chest strength", 1, ["w2-squat", "w2-hip-thrust", "w2-chest-press", "w1-row", "w1-lateral"]),
    womenPhaseTwoDay("W2F3D2", "Phase 2 · Day 2", "Hinge, quads and upper-chest strength", 3, ["w2-rdl", "w2-leg-press", "w2-incline", "w1-pulldown", "w1-leg-curl"]),
    womenPhaseTwoDay("W2F3D3", "Phase 2 · Day 3", "Shoulders, unilateral legs and balanced volume", 5, ["w2-db-ohp", "w2-split-squat", "w1-glute-bridge", "w1-hack", "w1-cable-row", "w1-crunch"]),
  ],
  4: [
    womenPhaseTwoDay("W2F4D1", "Phase 2 · Day 1", "Squat and glute strength", 1, ["w2-squat", "w2-hip-thrust", "w1-leg-curl", "w1-crunch"]),
    womenPhaseTwoDay("W2F4D2", "Phase 2 · Day 2", "Bench and upper-chest strength", 2, ["w2-chest-press", "w2-incline", "w1-row", "w1-lateral"]),
    womenPhaseTwoDay("W2F4D3", "Phase 2 · Day 3", "Hinge and quad strength", 4, ["w2-rdl", "w2-leg-press", "w1-leg-curl", "w1-abduction"]),
    womenPhaseTwoDay("W2F4D4", "Phase 2 · Day 4", "Shoulders and unilateral legs", 5, ["w2-db-ohp", "w2-split-squat", "w1-pulldown", "w1-cable-row", "w1-triceps"]),
  ],
  5: [
    womenPhaseTwoDay("W2F5D1", "Phase 2 · Day 1", "Squat and glute strength", 1, ["w2-squat", "w2-hip-thrust", "w1-row", "w1-lateral"]),
    womenPhaseTwoDay("W2F5D2", "Phase 2 · Day 2", "Bench and quad strength", 2, ["w2-chest-press", "w2-leg-press", "w1-pulldown", "w1-leg-curl"]),
    womenPhaseTwoDay("W2F5D3", "Phase 2 · Day 3", "Hinge and upper chest", 3, ["w2-rdl", "w2-incline", "w1-cable-row", "w1-rear-delt"]),
    womenPhaseTwoDay("W2F5D4", "Phase 2 · Day 4", "Shoulders and unilateral legs", 5, ["w2-db-ohp", "w2-split-squat", "w1-neutral-pulldown", "w1-abduction"]),
    womenPhaseTwoDay("W2F5D5", "Phase 2 · Day 5", "Balanced accessory volume", 6, ["w1-glute-bridge", "w1-hack", "w1-row", "w1-kickback", "w1-curl", "w1-triceps"]),
  ],
};

export const CURRENT_PHASE_ONE_PROGRAMS: Record<TrainingFrequency, TrainingDay[]> = {
  3: [
    assembledDay(PHASE_ONE_PROGRAM, "C1F3D1", "Full Body A", "Squat, hinge, push and pull", 1, ["lb1", "la1", "ua1", "ua2", "ua6", "la6"]),
    assembledDay(PHASE_ONE_PROGRAM, "C1F3D2", "Full Body B", "Quads, chest and back", 3, ["la2", "lb2", "ub2", "ub1", "ub4", "lb5"]),
    assembledDay(PHASE_ONE_PROGRAM, "C1F3D3", "Full Body C", "Posterior chain, shoulders and arms", 5, ["la4", "lb4", "ua3", "uc2", "uc4", "uc7"]),
  ],
  4: [
    assembledDay(PHASE_ONE_PROGRAM, "C1F4D1", "Upper A", "Push emphasis", 1, ["ua1", "ua2", "ua3", "ua4", "ua6", "ua8"]),
    assembledDay(PHASE_ONE_PROGRAM, "C1F4D2", "Lower A", "Hinge emphasis", 2, ["la1", "la2", "la3", "la4", "la5", "la6"]),
    assembledDay(PHASE_ONE_PROGRAM, "C1F4D3", "Upper B", "Pull, delts and arms", 4, ["ub1", "ub2", "ub3", "ub4", "ub6", "ub7"]),
    assembledDay(PHASE_ONE_PROGRAM, "C1F4D4", "Lower B", "Quad emphasis", 5, ["lb1", "lb2", "lb3", "lb4", "lb5", "lb6"]),
  ],
  5: PHASE_ONE_PROGRAM,
};

export const PROGRAMS: Record<ProgramId, { name: string; description: string; days: TrainingDay[] }> = {
  phase1: { name: "Foundation", description: "Original five-day progression", days: PHASE_ONE_PROGRAM },
  phase2: { name: "SBS Hypertrophy", description: "21 weeks · three autoregulated blocks", days: PHASE_TWO_PROGRAM },
};

const homeKeywords = /band|bodyweight|push-up|dumbbell|goblet|split squat|step-up|glute bridge|floor press|single-leg|reverse crunch|dead bug|wall sit|slider/i;
const limitedKeywords = /dumbbell|barbell|band|bodyweight|goblet|split squat|step-up|push-up|glute bridge|floor press/i;
const upperKeywords = /press|row|pulldown|pull-up|delt|lateral|curl|triceps|fly|pec/i;
const lowerKeywords = /squat|deadlift|leg|hip|glute|lunge|step-up|calf|abduction|kickback/i;
export const isLowerBodyExercise = (exercise: Pick<Exercise, "name">) => lowerKeywords.test(exercise.name);

const personalizeDays = (days: TrainingDay[], goal: TrainingGoal, equipment: Equipment) => days.map((day) => {
  let emphasized = false;
  return {
    ...day,
    exercises: day.exercises.map((exercise) => {
      const alternatives = [...exercise.alternatives].sort((left, right) => {
        const matcher = equipment === "home" ? homeKeywords : equipment === "limited" ? limitedKeywords : null;
        return matcher ? Number(matcher.test(right)) - Number(matcher.test(left)) : 0;
      });
      const goalMatcher = goal === "upper" ? upperKeywords : goal === "lower" ? lowerKeywords : null;
      const addSet = Boolean(goalMatcher && !emphasized && !exercise.sbsRole && goalMatcher.test(exercise.name));
      if (addSet) emphasized = true;
      return { ...exercise, sets: addSet ? Math.min(5, exercise.sets + 1) : exercise.sets, alternatives };
    }),
  };
});

export const programDays = (
  programId: ProgramId,
  frequency: TrainingFrequency = 5,
  track: ProgramTrack = "current",
  goal: TrainingGoal = "balanced",
  equipment: Equipment = "full",
) => {
  const days = track === "women"
    ? programId === "phase2" ? WOMENS_PHASE_TWO_PROGRAMS[frequency] : WOMENS_PHASE_ONE_PROGRAMS[frequency]
    : programId === "phase2" ? PHASE_TWO_PROGRAMS[frequency] : CURRENT_PHASE_ONE_PROGRAMS[frequency];
  return personalizeDays(days, goal, equipment);
};
export const PROGRAM = PHASE_TWO_PROGRAM;
const ALL_EXERCISES = [...PHASE_ONE_PROGRAM, ...PHASE_TWO_EXERCISE_SOURCE, ...WOMENS_PHASE_ONE_SOURCE, ...WOMENS_PHASE_TWO_SOURCE].flatMap((day) => day.exercises);

export const emptyData = (): TrainingData => ({
  version: 5,
  updatedAt: new Date(0).toISOString(),
  setupVersion: 0,
  profile: null,
  sessions: [],
  sessionRevisions: [],
  weighIns: [],
  swaps: {},
  program: {
    activeId: "phase1",
    week: 1,
    frequency: 5,
    preferredWeekdays: [1, 2, 4, 5, 6],
    status: "active",
    calibrationRequired: false,
    weekRecords: [],
    trainingMaxes: {},
  },
});

export const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const isoDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const prettyDate = (value: string, options?: Intl.DateTimeFormatOptions) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(
    undefined,
    options ?? { day: "numeric", month: "short" },
  );
};

export const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const convertWeight = (value: number, from: Unit, to: Unit) => {
  if (from === to) return value;
  return from === "kg" ? value / 0.45359237 : value * 0.45359237;
};

export const roundLoad = (value: number, unit: Unit) => {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const step = unit === "kg" ? (value < 20 ? 1 : 2.5) : value < 45 ? 2.5 : 5;
  return Math.round(value / step) * step;
};

export const bumpBy = (lower: boolean, unit: Unit) =>
  unit === "kg" ? (lower ? 5 : 2.5) : lower ? 10 : 5;

export const estimatedOneRepMax = (weight: number, reps: number) =>
  weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;

export const exerciseKey = (exercise: Exercise, swaps: Record<string, string>) =>
  swaps[exercise.id] ? `${exercise.id}:${swaps[exercise.id]}` : exercise.id;

export const exerciseName = (key: string) => {
  const [, ...swapName] = key.split(":");
  if (swapName.length) return swapName.join(":");
  return ALL_EXERCISES.find((exercise) => exercise.id === key)?.name ?? key;
};

export const exerciseFromKey = (key: string) => {
  const id = key.split(":")[0];
  return ALL_EXERCISES.find((exercise) => exercise.id === id) ?? null;
};

export const blankEntries = (day: TrainingDay, swaps: Record<string, string>) =>
  Object.fromEntries(
    day.exercises.map((exercise) => [
      exerciseKey(exercise, swaps),
      Array.from({ length: exercise.sets }, () => ({ w: "", r: "", rir: "" })),
    ]),
  );

export const isFilledSet = (entry: SetEntry, exercise?: Exercise | null) =>
  entry.r !== "" && (entry.w !== "" || Boolean(exercise?.bodyweight));

const validIso = (value: unknown, fallback: string) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;

const validFrequency = (value: unknown): TrainingFrequency => value === 3 || value === 4 ? value : 5;
const defaultWeekdays = (frequency: TrainingFrequency) =>
  frequency === 3 ? [1, 3, 5] : frequency === 4 ? [1, 2, 4, 5] : [1, 2, 4, 5, 6];

export const isActiveSession = (session: Session) => !session.deletedAt;
export const activeSessions = (data: Pick<TrainingData, "sessions">) => data.sessions.filter(isActiveSession);
export const activeWeighIns = (data: Pick<TrainingData, "weighIns">) => data.weighIns.filter((entry) => !entry.deletedAt);

export const PHASE_TWO_PROGRAMMED_EXERCISES = [...new Map(
  PHASE_TWO_EXERCISE_SOURCE.flatMap((day) => day.exercises).filter((exercise) => exercise.sbsRole).map((exercise) => [exercise.id, exercise]),
).values()];

export const WOMENS_PHASE_TWO_PROGRAMMED_EXERCISES = [...new Map(
  WOMENS_PHASE_TWO_SOURCE.flatMap((day) => day.exercises).filter((exercise) => exercise.sbsRole).map((exercise) => [exercise.id, exercise]),
).values()];

export const phaseTwoProgrammedExercises = (track: ProgramTrack = "current") =>
  track === "women" ? WOMENS_PHASE_TWO_PROGRAMMED_EXERCISES : PHASE_TWO_PROGRAMMED_EXERCISES;

export const suggestedTrainingMax = (data: TrainingData, exercise: Exercise, unit: Unit) => {
  const ids = new Set([exercise.id, ...(exercise.historyIds ?? [])]);
  return activeSessions(data).reduce((best, session) => {
    return Object.entries(session.entries).reduce((innerBest, [key, entries]) => {
      if (!ids.has(key.split(":")[0]) || key.includes(":")) return innerBest;
      return entries.reduce((setBest, entry) => {
        const reps = numeric(entry.r);
        const weight = convertWeight(numeric(entry.w), session.unit, unit);
        if (reps < 1 || reps > 12 || weight <= 0) return setBest;
        return Math.max(setBest, estimatedOneRepMax(weight, reps) * 0.9);
      }, innerBest);
    }, best);
  }, 0);
};

export const phase2DataConfidence = (data: TrainingData, track: ProgramTrack = data.profile?.programTrack ?? trainingTrack(data.profile?.gender ?? "man")) => {
  const unit = data.profile?.unit ?? "kg";
  const exercises = phaseTwoProgrammedExercises(track);
  const covered = exercises.filter((exercise) => suggestedTrainingMax(data, exercise, unit) > 0).length;
  const total = exercises.length;
  return {
    covered,
    total,
    level: covered >= Math.ceil(total * 0.7) ? "high" : covered >= Math.ceil(total * 0.3) ? "medium" : "low",
  } as const;
};

export const weightTrend = (data: TrainingData, unit: Unit) => {
  const entries = activeWeighIns(data)
    .map((entry) => ({ ...entry, weight: convertWeight(entry.weight, entry.unit, unit) }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestDate = entries.at(-1)?.date;
  if (!latestDate) return { entries, latestAverage: 0, previousAverage: 0, weeklyChangePercent: 0, recentCount: 0 };
  const latest = new Date(`${latestDate}T12:00:00Z`).valueOf();
  const recent = entries.filter((entry) => {
    const age = latest - new Date(`${entry.date}T12:00:00Z`).valueOf();
    return age >= 0 && age < 7 * 86_400_000;
  });
  const previous = entries.filter((entry) => {
    const age = latest - new Date(`${entry.date}T12:00:00Z`).valueOf();
    return age >= 7 * 86_400_000 && age < 14 * 86_400_000;
  });
  const average = (values: typeof entries) => values.length ? values.reduce((sum, entry) => sum + entry.weight, 0) / values.length : 0;
  const latestAverage = average(recent);
  const previousAverage = average(previous);
  return {
    entries,
    latestAverage,
    previousAverage,
    weeklyChangePercent: latestAverage && previousAverage ? ((latestAverage - previousAverage) / previousAverage) * 100 : 0,
    recentCount: recent.length,
  };
};

const normalizeSession = (item: unknown, index: number, fallbackUnit: Unit): Session | null => {
  if (!item || typeof item !== "object") return null;
  const session = item as Record<string, unknown>;
  if (typeof session.date !== "string" || typeof session.dayId !== "string") return null;
  const fallbackTime = `${session.date}T12:00:00.000Z`;
  const entriesSource = session.entries && typeof session.entries === "object"
    ? (session.entries as Record<string, unknown>)
    : {};
  const entries = Object.fromEntries(
    Object.entries(entriesSource).flatMap(([key, sets]) => {
      if (!Array.isArray(sets)) return [];
      return [[key, sets.map((set) => {
        const entry = set && typeof set === "object" ? (set as Record<string, unknown>) : {};
        return {
          w: entry.w === undefined || entry.w === null ? "" : String(entry.w),
          r: entry.r === undefined || entry.r === null ? "" : String(entry.r),
          rir: entry.rir === undefined || entry.rir === null ? "" : String(entry.rir),
        };
      })]];
    }),
  );
  return {
    id: typeof session.id === "string" ? session.id : `${session.date}-${session.dayId}-${index}`,
    date: session.date,
    dayId: session.dayId,
    unit: session.unit === "lb" ? "lb" : fallbackUnit,
    entries,
    programId: session.programId === "phase1" || session.programId === "phase2" ? session.programId : undefined,
    programWeek: typeof session.programWeek === "number" && session.programWeek >= 1 && session.programWeek <= 21
      ? Math.trunc(session.programWeek)
      : undefined,
    programFrequency: session.programFrequency === 3 || session.programFrequency === 4 || session.programFrequency === 5
      ? session.programFrequency
      : undefined,
    trainingMaxesBefore: session.trainingMaxesBefore && typeof session.trainingMaxesBefore === "object"
      ? Object.fromEntries(Object.entries(session.trainingMaxesBefore as Record<string, unknown>).flatMap(([key, value]) => Number.isFinite(Number(value)) ? [[key, Number(value)]] : []))
      : undefined,
    trainingMaxesAfter: session.trainingMaxesAfter && typeof session.trainingMaxesAfter === "object"
      ? Object.fromEntries(Object.entries(session.trainingMaxesAfter as Record<string, unknown>).flatMap(([key, value]) => Number.isFinite(Number(value)) ? [[key, Number(value)]] : []))
      : undefined,
    revision: Math.max(1, Math.trunc(numeric(session.revision) || 1)),
    deletedAt: typeof session.deletedAt === "string" ? validIso(session.deletedAt, fallbackTime) : undefined,
    createdAt: validIso(session.createdAt, fallbackTime),
    updatedAt: validIso(session.updatedAt, fallbackTime),
  };
};

export function normalizeTrainingData(raw: unknown, remoteUpdatedAt?: string): TrainingData {
  if (!raw || typeof raw !== "object") return emptyData();
  const source = raw as Record<string, unknown>;
  const rawProfile = source.profile as Record<string, unknown> | null;
  const normalizedLevel: Level = rawProfile?.level === "new"
    ? "new"
    : rawProfile?.level === "beginner"
      ? "beginner"
      : rawProfile?.level === "experienced" || rawProfile?.level === "exp"
        ? "experienced"
        : rawProfile?.level === "returning"
          ? "returning"
          : "intermediate";
  const profile: Profile | null = rawProfile
    ? {
        bodyweight: numeric(rawProfile.bodyweight ?? rawProfile.bw),
        unit: rawProfile.unit === "lb" ? "lb" : "kg",
        level: normalizedLevel,
        gender: rawProfile.gender === "woman" ? "woman" : "man",
        programTrack: rawProfile.programTrack === "women" || rawProfile.programTrack === "current"
          ? rawProfile.programTrack
          : trainingTrack(rawProfile.gender === "woman" ? "woman" : "man"),
        goal: rawProfile.goal === "strength" || rawProfile.goal === "upper" || rawProfile.goal === "lower" ? rawProfile.goal : "balanced",
        equipment: rawProfile.equipment === "limited" || rawProfile.equipment === "home" ? rawProfile.equipment : "full",
        weightGoal: rawProfile.weightGoal === "cut" || rawProfile.weightGoal === "bulk" ? rawProfile.weightGoal : "maintain",
        weightTrackingEnabled: rawProfile.weightTrackingEnabled !== false,
      }
    : null;
  const fallbackUnit: Unit = profile?.unit ?? "kg";
  const rawSessions = Array.isArray(source.sessions) ? source.sessions : [];
  const sessions = rawSessions.flatMap((item, index) => normalizeSession(item, index, fallbackUnit) ?? []);
  const updatedAt = validIso(source.updatedAt, remoteUpdatedAt ?? new Date(0).toISOString());
  const swaps = source.swaps && typeof source.swaps === "object"
    ? Object.fromEntries(Object.entries(source.swaps as Record<string, unknown>).filter(([, value]) => typeof value === "string")) as Record<string, string>
    : {};
  const rawProgram = source.program && typeof source.program === "object"
    ? source.program as Record<string, unknown>
    : {};
  const activeId: ProgramId = rawProgram.activeId === "phase2" ? "phase2" : "phase1";
  const week = Math.max(1, Math.min(21, Math.trunc(numeric(rawProgram.week) || 1)));
  const frequency = validFrequency(rawProgram.frequency);
  const preferredWeekdaysSource = Array.isArray(rawProgram.preferredWeekdays)
    ? [...new Set(rawProgram.preferredWeekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [];
  const preferredWeekdays = preferredWeekdaysSource.length === frequency ? preferredWeekdaysSource : defaultWeekdays(frequency);
  const trainingMaxes = rawProgram.trainingMaxes && typeof rawProgram.trainingMaxes === "object"
    ? Object.fromEntries(Object.entries(rawProgram.trainingMaxes as Record<string, unknown>).flatMap(([key, value]) => Number(value) > 0 ? [[key, Number(value)]] : []))
    : {};
  const rawWeighIns = Array.isArray(source.weighIns) ? source.weighIns : [];
  const weighIns: WeighIn[] = rawWeighIns.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const weight = numeric(entry.weight);
    if (typeof entry.date !== "string" || weight <= 0) return [];
    const fallbackTime = `${entry.date}T08:00:00.000Z`;
    return [{
      id: typeof entry.id === "string" ? entry.id : `weight-${entry.date}-${index}`,
      date: entry.date,
      weight,
      unit: entry.unit === "lb" ? "lb" : fallbackUnit,
      createdAt: validIso(entry.createdAt, fallbackTime),
      updatedAt: validIso(entry.updatedAt, fallbackTime),
      deletedAt: typeof entry.deletedAt === "string" ? validIso(entry.deletedAt, fallbackTime) : undefined,
    }];
  });
  const rawRevisions = Array.isArray(source.sessionRevisions) ? source.sessionRevisions : [];
  const sessionRevisions: SessionRevision[] = rawRevisions.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const revision = item as Record<string, unknown>;
    const previous = normalizeSession(revision.previous, index, fallbackUnit);
    if (!previous || typeof revision.sessionId !== "string") return [];
    const action = revision.action === "deleted" || revision.action === "restored" ? revision.action : "edited";
    return [{
      id: typeof revision.id === "string" ? revision.id : `${revision.sessionId}-${index}`,
      sessionId: revision.sessionId,
      action,
      at: validIso(revision.at, previous.updatedAt),
      note: typeof revision.note === "string" ? revision.note : "Session changed",
      previous,
    }];
  });
  const weekRecords: WeekRecord[] = Array.isArray(rawProgram.weekRecords)
    ? rawProgram.weekRecords.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const recordWeek = Math.trunc(numeric(record.week));
        if (recordWeek < 1 || recordWeek > 21) return [];
        return [{
          programId: record.programId === "phase1" ? "phase1" as const : "phase2" as const,
          week: recordWeek,
          frequency: validFrequency(record.frequency),
          status: record.status === "extended" || record.status === "skipped" ? record.status : "completed",
          completedDayIds: Array.isArray(record.completedDayIds) ? record.completedDayIds.filter((id): id is string => typeof id === "string") : [],
          skippedDayIds: Array.isArray(record.skippedDayIds) ? record.skippedDayIds.filter((id): id is string => typeof id === "string") : [],
          at: validIso(record.at, updatedAt),
        }];
      })
    : [];
  const phase1CompletedAt = typeof rawProgram.phase1CompletedAt === "string"
    ? validIso(rawProgram.phase1CompletedAt, updatedAt)
    : activeId === "phase2" ? updatedAt : undefined;
  const phase2UnlockedAt = typeof rawProgram.phase2UnlockedAt === "string"
    ? validIso(rawProgram.phase2UnlockedAt, updatedAt)
    : activeId === "phase2" ? updatedAt : undefined;
  return {
    version: 5,
    updatedAt,
    setupVersion: profile ? Math.max(2, Math.trunc(numeric(source.setupVersion) || 2)) : 0,
    setupCompletedAt: profile ? validIso(source.setupCompletedAt, updatedAt) : undefined,
    profile,
    sessions,
    sessionRevisions,
    weighIns,
    swaps,
    program: {
      activeId,
      week,
      frequency,
      preferredWeekdays,
      status: rawProgram.status === "paused" || rawProgram.status === "completed" ? rawProgram.status : "active",
      pausedAt: typeof rawProgram.pausedAt === "string" ? validIso(rawProgram.pausedAt, updatedAt) : undefined,
      calibrationRequired: rawProgram.calibrationRequired === true,
      phase1CompletedAt,
      phase2UnlockedAt,
      weekRecords,
      trainingMaxes,
    },
  };
}

export function mergeTrainingData(left: TrainingData, right: TrainingData): TrainingData {
  const newer = Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left : right;
  const sessions = new Map<string, Session>();
  [...left.sessions, ...right.sessions].forEach((session) => {
    const existing = sessions.get(session.id);
    if (!existing || Date.parse(session.updatedAt) >= Date.parse(existing.updatedAt)) {
      sessions.set(session.id, session);
    }
  });
  const weighIns = new Map<string, WeighIn>();
  [...left.weighIns, ...right.weighIns].forEach((entry) => {
    const existing = weighIns.get(entry.id);
    if (!existing || Date.parse(entry.updatedAt) >= Date.parse(existing.updatedAt)) weighIns.set(entry.id, entry);
  });
  const revisions = new Map<string, SessionRevision>();
  [...left.sessionRevisions, ...right.sessionRevisions].forEach((revision) => revisions.set(revision.id, revision));
  return {
    version: 5,
    updatedAt: new Date(Math.max(Date.parse(left.updatedAt), Date.parse(right.updatedAt))).toISOString(),
    setupVersion: newer.setupVersion,
    setupCompletedAt: newer.setupCompletedAt,
    profile: newer.profile,
    swaps: newer.swaps,
    program: newer.program,
    sessions: [...sessions.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    sessionRevisions: [...revisions.values()].sort((a, b) => a.at.localeCompare(b.at)),
    weighIns: [...weighIns.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
