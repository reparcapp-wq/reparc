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
export type Readiness = "normal" | "low" | "sore" | "severe-soreness" | "symptoms" | "pain";
export type SessionCompletionStatus = "completed" | "partial" | "adjusted" | "skipped";
export type LoadingType = "external" | "bodyweight" | "assisted-bodyweight" | "unloaded";
export type AbsenceReason = "busy" | "travel" | "illness" | "injury" | "soreness" | "planned" | "other";
export type AbsenceResolution = "continue" | "trained-elsewhere" | "skip" | "pause";

export type ReturnPlan = {
  startedAt: string;
  gapDays: number;
  reason: AbsenceReason;
  totalSessions: number;
  sessionsRemaining: number;
  loadFactor: number;
  volumeFactor: number;
  targetRir: number;
};

export type AbsenceRecord = {
  id: string;
  startDate: string;
  endDate: string;
  missedDates: string[];
  reason: AbsenceReason;
  resolution: AbsenceResolution;
  programId: ProgramId;
  programWeek?: number;
  frequency: TrainingFrequency;
  resolvedDayIds: string[];
  createdAt: string;
  updatedAt: string;
};

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
  loadingType?: LoadingType;
  equipment?: Equipment[];
  defaultVariant?: string;
};

export type ExerciseSnapshot = Pick<Exercise,
  "id" | "name" | "sets" | "repLow" | "repHigh" | "restSeconds" | "ratio" | "perSide" | "bodyweight" | "note" | "sbsRole" | "historyIds" | "loadingType" | "equipment"
> & { key: string };

export type SessionPlanSnapshot = {
  programId: ProgramId;
  programWeek?: number;
  frequency: TrainingFrequency;
  preferredWeekdays: number[];
  track: ProgramTrack;
  goal: TrainingGoal;
  equipment: Equipment;
  dayId: string;
  dayName: string;
  focus: string;
  exercises: ExerciseSnapshot[];
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
  displayName?: string;
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

export type CardioMode = "walk" | "bike" | "stairs" | "other";
export type ConditioningIntensity = "easy" | "moderate" | "vigorous";
export type ConditioningLog = {
  mode: CardioMode;
  durationMinutes: number;
  intensity: ConditioningIntensity;
};

export type LoadProfile = {
  unit: Unit;
  values: number[];
  updatedAt: string;
  deletedAt?: string;
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
  readiness?: Readiness;
  sessionRpe?: number;
  warmup?: ConditioningLog;
  postCardio?: ConditioningLog;
  startedAt?: string;
  completedAt?: string;
  durationSeconds?: number;
  completionStatus?: SessionCompletionStatus;
  affectsProgression?: boolean;
  bodyweightAtSession?: number;
  planSnapshot?: SessionPlanSnapshot;
  logicalKey?: string;
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
  returnPlan?: ReturnPlan;
};

export type PlanChange = {
  id: string;
  effectiveAt: string;
  kind: "setup" | "schedule" | "program" | "profile" | "pause" | "resume";
  programId: ProgramId;
  week: number;
  frequency: TrainingFrequency;
  preferredWeekdays: number[];
  track: ProgramTrack;
  goal: TrainingGoal;
  equipment: Equipment;
  status: ProgramStatus;
};

export type ConsentRecord = {
  termsVersion: string;
  adultConfirmedAt: string;
  safetyAcceptedAt: string;
};

export type TrainingData = {
  version: 8;
  updatedAt: string;
  setupVersion: number;
  setupCompletedAt?: string;
  profile: Profile | null;
  sessions: Session[];
  sessionRevisions: SessionRevision[];
  weighIns: WeighIn[];
  swaps: Record<string, string>;
  loadProfiles: Record<string, LoadProfile>;
  program: ProgramState;
  planHistory: PlanChange[];
  absences: AbsenceRecord[];
  consent?: ConsentRecord;
};

export const CURRENT_TERMS_VERSION = "2026-09-02";

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
  [0.7, 10, 12], [0.725, 9, 11], [0.75, 8, 10], [0.725, 9, 11], [0.75, 8, 10], [0.775, 7, 9], [0.6, 5, 0],
  [0.725, 9, 11], [0.75, 8, 10], [0.775, 7, 9], [0.75, 8, 10], [0.775, 7, 9], [0.8, 6, 8], [0.6, 5, 0],
  [0.75, 8, 10], [0.775, 7, 9], [0.8, 6, 8], [0.775, 7, 9], [0.8, 6, 8], [0.825, 5, 6], [0.6, 5, 0],
] as const;

const SBS_AUXILIARY_WEEKS = [
  [0.65, 12, 15], [0.675, 11, 13], [0.7, 10, 12], [0.675, 11, 13], [0.7, 10, 12], [0.725, 9, 11], [0.55, 5, 0],
  [0.675, 11, 13], [0.7, 10, 12], [0.725, 9, 11], [0.7, 10, 12], [0.725, 9, 11], [0.75, 8, 10], [0.55, 5, 0],
  [0.7, 10, 12], [0.725, 9, 11], [0.75, 8, 10], [0.725, 9, 11], [0.75, 8, 10], [0.775, 7, 9], [0.55, 5, 0],
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

const homeKeywords = /band|bodyweight|push-up|pull-up|chin-up|dumbbell|goblet|split squat|step-up|glute bridge|floor press|single-leg|reverse crunch|dead bug|wall sit|slider|nordic|pike/i;
const limitedKeywords = /dumbbell|barbell|ez-bar|band|bodyweight|goblet|split squat|step-up|push-up|pull-up|chin-up|glute bridge|floor press|lunge|nordic|pike/i;
const upperKeywords = /press|row|pulldown|pull-up|delt|lateral|curl|triceps|fly|pec/i;
const lowerKeywords = /squat|deadlift|leg|hip|glute|lunge|step-up|calf|abduction|kickback/i;
export const isLowerBodyExercise = (exercise: Pick<Exercise, "name">) => lowerKeywords.test(exercise.name);

const bodyweightKeywords = /pull-up|chin-up|push-up|\bdips?\b|hanging|captain'?s chair|reverse crunch|dead bug|wall sit|nordic|pike push-up|bodyweight|side-lying leg raise/i;
const assistedKeywords = /assisted/i;
const unloadedKeywords = /band pull-apart|band row|band pulldown|band pushdown|band curl|dead bug|wall sit|slider leg curl/i;
const perSideKeywords = /single-arm|one-arm|single-leg|split squat|lunge|step-up|kickback|abduction|dumbbell (press|curl|fly|row|rdl)|dumbbell lateral|dumbbell overhead|incline dumbbell|flat dumbbell|seated dumbbell|standing dumbbell/i;

const homeAlternativeFor = (name: string) => {
  if (/squat|leg press/i.test(name)) return "Goblet squat";
  if (/block pull|deadlift/i.test(name)) return "Dumbbell RDL";
  if (/row/i.test(name)) return "One-arm dumbbell row";
  if (/lateral raise/i.test(name)) return "Dumbbell lateral raise";
  if (/reverse pec|rear delt/i.test(name)) return "Dumbbell reverse fly";
  if (/calf/i.test(name)) return "Single-leg calf raise";
  if (/triceps|pushdown/i.test(name)) return "Band pushdown";
  if (/curl/i.test(name)) return "Dumbbell curl";
  if (/overhead press/i.test(name)) return "Dumbbell overhead press";
  return undefined;
};

export const equipmentForExerciseName = (name: string): Equipment[] => {
  if (homeKeywords.test(name) || bodyweightKeywords.test(name) || unloadedKeywords.test(name)) return ["home", "limited", "full"];
  if (limitedKeywords.test(name)) return ["limited", "full"];
  return ["full"];
};

export const resolveExerciseVariant = (exercise: Exercise, variantName = exercise.name): Exercise => {
  const loadingType: LoadingType = unloadedKeywords.test(variantName)
    ? "unloaded"
    : assistedKeywords.test(variantName) && bodyweightKeywords.test(variantName)
      ? "assisted-bodyweight"
      : bodyweightKeywords.test(variantName)
        ? "bodyweight"
        : "external";
  return {
    ...exercise,
    name: variantName,
    ratio: variantName === exercise.name ? exercise.ratio : undefined,
    bodyweight: loadingType === "bodyweight" || loadingType === "assisted-bodyweight",
    loadingType,
    perSide: perSideKeywords.test(variantName),
    equipment: equipmentForExerciseName(variantName),
  };
};

export const effectiveExerciseLoad = (exercise: Exercise, externalLoad: number, bodyweight: number) => {
  const loadingType = exercise.loadingType ?? (exercise.bodyweight ? "bodyweight" : "external");
  if (loadingType === "assisted-bodyweight") return Math.max(0, bodyweight - externalLoad);
  if (loadingType === "bodyweight") return bodyweight + externalLoad;
  if (loadingType === "unloaded") return 0;
  return externalLoad;
};

const bodyweightEstimatedMaxPattern = /\b(pull-?up|chin-?up|dip)s?\b/i;

export const supportsEstimatedMax = (exercise?: Exercise | null) => {
  if (!exercise) return false;
  const loadingType = exercise.loadingType ?? (exercise.bodyweight ? "bodyweight" : "external");
  if (loadingType === "external") return true;
  return (loadingType === "bodyweight" || loadingType === "assisted-bodyweight")
    && bodyweightEstimatedMaxPattern.test(exercise.name);
};

export const externalLoadVolume = (exercise: Exercise | null | undefined, externalLoad: number, reps: number) =>
  Math.max(0, externalLoad) * Math.max(0, reps) * (exercise?.perSide ? 2 : 1);

export const exerciseNeedsLoad = (exercise?: Exercise | null) => {
  const loadingType = exercise?.loadingType ?? (exercise?.bodyweight ? "bodyweight" : "external");
  return loadingType === "external" || loadingType === "assisted-bodyweight";
};

const personalizeDays = (days: TrainingDay[], goal: TrainingGoal, equipment: Equipment) => days.map((day) => {
  let emphasized = false;
  return {
    ...day,
    exercises: day.exercises.map((exercise) => {
      const homeFallback = homeAlternativeFor(exercise.name);
      const expandedAlternatives = homeFallback && !exercise.alternatives.some((alternative) => equipmentForExerciseName(alternative).includes("home"))
        ? [...exercise.alternatives, homeFallback]
        : [...exercise.alternatives];
      const alternatives = expandedAlternatives.sort((left, right) => {
        const matcher = equipment === "home" ? homeKeywords : equipment === "limited" ? limitedKeywords : null;
        return matcher ? Number(matcher.test(right)) - Number(matcher.test(left)) : 0;
      });
      const baseEquipment = exercise.equipment ?? equipmentForExerciseName(exercise.name);
      const compatibleDefault = equipment === "full" || baseEquipment.includes(equipment)
        ? undefined
        : alternatives.find((alternative) => equipmentForExerciseName(alternative).includes(equipment));
      const goalMatcher = goal === "upper" ? upperKeywords : goal === "lower" ? lowerKeywords : null;
      const addSet = Boolean(goalMatcher && !emphasized && !exercise.sbsRole && goalMatcher.test(exercise.name));
      if (addSet) emphasized = true;
      return {
        ...resolveExerciseVariant(exercise),
        sets: addSet ? Math.min(5, exercise.sets + 1) : exercise.sets,
        alternatives,
        defaultVariant: compatibleDefault,
      };
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
  version: 8,
  updatedAt: new Date(0).toISOString(),
  setupVersion: 0,
  profile: null,
  sessions: [],
  sessionRevisions: [],
  weighIns: [],
  swaps: {},
  loadProfiles: {},
  planHistory: [],
  absences: [],
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

export const normalizeLoadValues = (values: unknown[], limit = 100) => [...new Set(values
  .map(Number)
  .filter((value) => Number.isFinite(value) && value > 0 && value <= 2_000)
  .map((value) => Math.round(value * 100) / 100))]
  .sort((left, right) => left - right)
  .slice(0, limit);

export const loadProfileValues = (profile: LoadProfile | undefined, targetUnit: Unit) => profile && !profile.deletedAt
  ? normalizeLoadValues(profile.values.map((value) => profile.unit === targetUnit ? value : convertWeight(value, profile.unit, targetUnit)))
  : [];

export const resolveAvailableLoad = (value: number, availableLoads: number[], direction: "nearest" | "higher" | "lower") => {
  const values = normalizeLoadValues(availableLoads);
  if (!values.length || !Number.isFinite(value)) return null;
  if (direction === "higher") return values.find((candidate) => candidate > value + 0.0001) ?? null;
  if (direction === "lower") return [...values].reverse().find((candidate) => candidate < value - 0.0001) ?? null;
  return values.reduce((best, candidate) => {
    const candidateDistance = Math.abs(candidate - value);
    const bestDistance = Math.abs(best - value);
    return candidateDistance < bestDistance || (candidateDistance === bestDistance && candidate < best) ? candidate : best;
  });
};

export const bumpBy = (lower: boolean, unit: Unit) =>
  unit === "kg" ? (lower ? 5 : 2.5) : lower ? 10 : 5;

export const practicalLoadIncrement = (exercise: Pick<Exercise, "perSide">, currentLoad: number, unit: Unit) => {
  const smallImplement = exercise.perSide || currentLoad < (unit === "kg" ? 20 : 45);
  return unit === "kg" ? (smallImplement ? 1 : 2.5) : smallImplement ? 2.5 : 5;
};

export const estimatedOneRepMax = (weight: number, reps: number) =>
  weight > 0 && reps > 0 ? weight * (1 + reps / 30) : 0;

export const exerciseKey = (exercise: Exercise, swaps: Record<string, string>) =>
  swaps[exercise.id] || exercise.defaultVariant
    ? `${exercise.id}:${swaps[exercise.id] ?? exercise.defaultVariant}`
    : exercise.id;

export const exerciseName = (key: string) => {
  const [, ...swapName] = key.split(":");
  if (swapName.length) return swapName.join(":");
  return ALL_EXERCISES.find((exercise) => exercise.id === key)?.name ?? key;
};

export const loadProfileId = (exercise: Pick<Exercise, "name" | "loadingType" | "perSide">) =>
  `equipment:${exercise.loadingType ?? "external"}:${exercise.perSide ? "per-side" : "total"}:${slugify(exercise.name)}`;

export const exerciseFromKey = (key: string) => {
  const id = key.split(":")[0];
  const base = ALL_EXERCISES.find((exercise) => exercise.id === id);
  if (!base) return null;
  const [, ...variantParts] = key.split(":");
  return resolveExerciseVariant(base, variantParts.length ? variantParts.join(":") : base.name);
};

export const blankEntries = (day: TrainingDay, swaps: Record<string, string>) =>
  Object.fromEntries(
    day.exercises.map((exercise) => [
      exerciseKey(exercise, swaps),
      Array.from({ length: exercise.sets }, () => ({ w: "", r: "", rir: "" })),
    ]),
  );

export const sessionLogicalKey = (date: string, programId: ProgramId, week: number | undefined, frequency: TrainingFrequency, dayId: string) =>
  `${date}:${programId}:${programId === "phase2" ? week ?? 1 : 0}:${frequency}:${dayId}`;

export const buildSessionPlanSnapshot = (data: TrainingData, day: TrainingDay, programId = data.program.activeId, week = data.program.week, frequency = data.program.frequency): SessionPlanSnapshot => {
  const profile = data.profile!;
  return {
    programId,
    programWeek: programId === "phase2" ? week : undefined,
    frequency,
    preferredWeekdays: [...data.program.preferredWeekdays],
    track: profile.programTrack,
    goal: profile.goal,
    equipment: profile.equipment,
    dayId: day.id,
    dayName: day.name,
    focus: day.focus,
    exercises: day.exercises.map((exercise) => {
      const key = exerciseKey(exercise, data.swaps);
      const resolved = exerciseFromKey(key) ?? resolveExerciseVariant(exercise, data.swaps[exercise.id] ?? exercise.defaultVariant ?? exercise.name);
      return {
        id: resolved.id,
        key,
        name: resolved.name,
        sets: resolved.sets,
        repLow: resolved.repLow,
        repHigh: resolved.repHigh,
        restSeconds: resolved.restSeconds,
        ratio: resolved.ratio,
        perSide: resolved.perSide,
        bodyweight: resolved.bodyweight,
        note: resolved.note,
        sbsRole: resolved.sbsRole,
        historyIds: resolved.historyIds ? [...resolved.historyIds] : undefined,
        loadingType: resolved.loadingType,
        equipment: resolved.equipment ? [...resolved.equipment] : undefined,
      };
    }),
  };
};

export const trainingDayFromSnapshot = (snapshot: SessionPlanSnapshot): TrainingDay => ({
  id: snapshot.dayId,
  name: snapshot.dayName,
  focus: snapshot.focus,
  weekday: snapshot.preferredWeekdays[0] ?? 1,
  lower: snapshot.exercises.some((exercise) => isLowerBodyExercise(exercise)),
  exercises: snapshot.exercises.map((exercise) => ({
    ...exercise,
    alternatives: [],
    defaultVariant: exercise.key.includes(":") ? exercise.key.split(":").slice(1).join(":") : undefined,
  })),
});

export const sessionPlannedSets = (session: Session, data?: TrainingData) => {
  if (session.planSnapshot) return session.planSnapshot.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  if (!data?.profile) return 0;
  return programDays(
    session.programId ?? data.program.activeId,
    session.programFrequency ?? data.program.frequency,
    data.profile.programTrack,
    data.profile.goal,
    data.profile.equipment,
  ).find((day) => day.id === session.dayId)?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
};

export const sessionCompletedSets = (session: Session) => Object.entries(session.entries).reduce((sum, [key, entries]) => {
  const snapshot = session.planSnapshot?.exercises.find((exercise) => exercise.key === key);
  const exercise = snapshot ? { ...snapshot, alternatives: [] } as Exercise : exerciseFromKey(key);
  return sum + entries.filter((entry) => isFilledSet(entry, exercise)).length;
}, 0);

export const sessionCountsAsCompletedDay = (session: Session, data?: TrainingData) => {
  if (session.deletedAt || session.completionStatus === "partial" || session.completionStatus === "skipped") return false;
  const planned = sessionPlannedSets(session, data);
  return planned > 0 && sessionCompletedSets(session) >= planned;
};

const dateValue = (value: string) => new Date(`${value}T12:00:00.000Z`).valueOf();
export const daysBetweenDates = (startDate: string, endDate: string) =>
  Math.max(0, Math.round((dateValue(endDate) - dateValue(startDate)) / 86_400_000));

const datesThrough = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  for (let cursor = new Date(`${startDate}T12:00:00.000Z`), end = new Date(`${endDate}T12:00:00.000Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
};

const planOnDate = (data: TrainingData, date: string) => {
  const history = data.planHistory
    .filter((change) => change.effectiveAt.slice(0, 10) <= date)
    .sort((left, right) => left.effectiveAt.localeCompare(right.effectiveAt));
  return history.at(-1);
};

export const isScheduledTrainingDate = (data: TrainingData, date: string) => {
  if (!data.profile || (data.setupCompletedAt && date < data.setupCompletedAt.slice(0, 10))) return false;
  const plan = planOnDate(data, date);
  const status = plan?.status ?? data.program.status;
  const weekdays = plan?.preferredWeekdays ?? data.program.preferredWeekdays;
  const plannedAway = data.absences.some((record) =>
    record.missedDates.includes(date) && (record.reason === "planned" || record.resolution === "pause"));
  return status === "active"
    && weekdays.includes(new Date(`${date}T12:00:00.000Z`).getUTCDay())
    && !plannedAway;
};

export type MissedTraining = {
  missedDates: string[];
  gapDays: number;
  expectedSessions: number;
  completedSessions: number;
};

export const detectMissedTraining = (data: TrainingData, asOfDate = isoDate()): MissedTraining | null => {
  if (!data.profile || data.program.status !== "active") return null;
  const completed = activeSessions(data)
    .filter((session) => sessionCountsAsCompletedDay(session, data))
    .sort((left, right) => left.date.localeCompare(right.date) || left.updatedAt.localeCompare(right.updatedAt));
  const lastCompleted = completed.at(-1);
  if (!lastCompleted) return null;
  const handledEnd = data.absences.map((record) => record.endDate).sort().at(-1);
  const scanFloor = new Date(`${asOfDate}T12:00:00.000Z`);
  scanFloor.setUTCDate(scanFloor.getUTCDate() - 366);
  const startDate = [lastCompleted.date, handledEnd, scanFloor.toISOString().slice(0, 10)].filter((value): value is string => Boolean(value)).sort().at(-1)!;
  const yesterday = new Date(`${asOfDate}T12:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const endDate = yesterday.toISOString().slice(0, 10);
  if (startDate >= endDate) return null;
  const coveredDates = new Set(data.absences.flatMap((record) => record.missedDates));
  const dueDates = datesThrough(startDate, endDate).filter((date) => {
    if (date <= startDate || coveredDates.has(date)) return false;
    const plan = planOnDate(data, date);
    const weekdays = plan?.preferredWeekdays ?? data.program.preferredWeekdays;
    const status = plan?.status ?? data.program.status;
    return status === "active" && weekdays.includes(new Date(`${date}T12:00:00.000Z`).getUTCDay());
  });
  const completedAfter = completed.filter((session) => session.date > startDate && session.date <= endDate).length;
  const missingCount = Math.max(0, dueDates.length - completedAfter);
  if (!missingCount) return null;
  return {
    missedDates: dueDates.slice(-missingCount),
    gapDays: daysBetweenDates(lastCompleted.date, asOfDate),
    expectedSessions: dueDates.length,
    completedSessions: completedAfter,
  };
};

export const buildReturnPlan = (gapDays: number, reason: AbsenceReason, startedAt = new Date().toISOString()): ReturnPlan | undefined => {
  if (reason === "soreness" && gapDays < 14) return { startedAt, gapDays, reason, totalSessions: 1, sessionsRemaining: 1, loadFactor: 0.9, volumeFactor: 0.67, targetRir: 3 };
  if (gapDays < 14) return undefined;
  if (gapDays < 28) return { startedAt, gapDays, reason, totalSessions: 1, sessionsRemaining: 1, loadFactor: 0.9, volumeFactor: 0.75, targetRir: 3 };
  if (gapDays < 56) return { startedAt, gapDays, reason, totalSessions: 2, sessionsRemaining: 2, loadFactor: 0.85, volumeFactor: 0.67, targetRir: 4 };
  return { startedAt, gapDays, reason, totalSessions: 3, sessionsRemaining: 3, loadFactor: 0.8, volumeFactor: 0.5, targetRir: 4 };
};

export const returnPlanSetCount = (sets: number, volumeFactor: number) =>
  Math.max(1, Math.round(Math.max(1, sets) * Math.max(0.5, Math.min(1, volumeFactor))));

export const nextUnfinishedProgramDay = (data: TrainingData): TrainingDay | null => {
  if (!data.profile) return null;
  const days = programDays(data.program.activeId, data.program.frequency, data.profile.programTrack, data.profile.goal, data.profile.equipment);
  if (!days.length) return null;
  if (data.program.activeId === "phase2") {
    const completedIds = new Set(activeSessions(data)
      .filter((session) => session.programId === "phase2" && session.programWeek === data.program.week && (session.programFrequency ?? 5) === data.program.frequency && sessionCountsAsCompletedDay(session, data))
      .map((session) => session.dayId));
    const resolvedIds = new Set(data.absences
      .filter((record) => record.programId === "phase2" && record.programWeek === data.program.week && record.resolution !== "continue")
      .flatMap((record) => record.resolvedDayIds));
    return days.find((day) => !completedIds.has(day.id) && !resolvedIds.has(day.id)) ?? days[0];
  }
  const events: Array<{ at: string; dayId: string }> = activeSessions(data)
    .filter((session) => session.programId !== "phase2" && sessionCountsAsCompletedDay(session, data))
    .map((session) => ({ at: session.updatedAt, dayId: session.dayId }));
  data.absences.filter((record) => record.programId === "phase1" && record.resolution !== "continue").forEach((record) => {
    const dayId = record.resolvedDayIds.at(-1);
    if (dayId) events.push({ at: record.updatedAt, dayId });
  });
  const latest = events.sort((left, right) => left.at.localeCompare(right.at)).at(-1);
  if (!latest) return days[0];
  const index = days.findIndex((day) => day.id === latest.dayId);
  return days[(index < 0 ? 0 : index + 1) % days.length];
};

export const absenceDayIds = (data: TrainingData, count: number) => {
  if (!data.profile || count <= 0) return [];
  const days = programDays(data.program.activeId, data.program.frequency, data.profile.programTrack, data.profile.goal, data.profile.equipment);
  const first = nextUnfinishedProgramDay(data);
  const start = Math.max(0, days.findIndex((day) => day.id === first?.id));
  return Array.from({ length: count }, (_, index) => days[(start + index) % days.length].id);
};

const decimalValue = (value: string) => value.trim() !== "" && /^\d{1,4}(?:\.\d{1,2})?$/.test(value) ? Number(value) : Number.NaN;
const repValue = (value: string) => /^\d{1,3}$/.test(value) ? Number(value) : Number.NaN;

export const validSetEntry = (entry: SetEntry, exercise?: Exercise | null) => {
  const reps = repValue(entry.r);
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) return false;
  if (entry.rir !== "") {
    const rir = decimalValue(entry.rir);
    if (!Number.isFinite(rir) || rir < 0 || rir > 10) return false;
  }
  const loadingType = exercise?.loadingType ?? (exercise?.bodyweight ? "bodyweight" : "external");
  if (loadingType === "bodyweight" || loadingType === "unloaded") {
    if (entry.w === "") return true;
    const optionalLoad = decimalValue(entry.w);
    return Number.isFinite(optionalLoad) && optionalLoad >= 0 && optionalLoad <= 2_000;
  }
  const load = decimalValue(entry.w);
  return Number.isFinite(load) && load > 0 && load <= 2_000;
};

export const isFilledSet = validSetEntry;

const validIso = (value: unknown, fallback: string) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;

export const isValidDateOnly = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeSetEntry = (value: unknown, exercise?: Exercise | null): SetEntry => {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const candidate = {
    w: source.w === undefined || source.w === null ? "" : String(source.w).trim(),
    r: source.r === undefined || source.r === null ? "" : String(source.r).trim(),
    rir: source.rir === undefined || source.rir === null ? "" : String(source.rir).trim(),
  };
  if (candidate.w !== "" && !Number.isFinite(decimalValue(candidate.w))) candidate.w = "";
  if (candidate.r !== "" && (!Number.isInteger(repValue(candidate.r)) || repValue(candidate.r) < 1 || repValue(candidate.r) > 100)) candidate.r = "";
  if (candidate.rir !== "") {
    const rir = decimalValue(candidate.rir);
    if (!Number.isFinite(rir) || rir < 0 || rir > 10) candidate.rir = "";
  }
  if (candidate.w !== "") {
    const load = decimalValue(candidate.w);
    const canBeZero = !exerciseNeedsLoad(exercise);
    if (!Number.isFinite(load) || load > 2_000 || load < 0 || (!canBeZero && load === 0)) candidate.w = "";
  }
  return candidate;
};

const normalizePlanSnapshot = (value: unknown): SessionPlanSnapshot | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  if (source.programId !== "phase1" && source.programId !== "phase2") return undefined;
  if (typeof source.dayId !== "string" || typeof source.dayName !== "string" || !Array.isArray(source.exercises)) return undefined;
  const frequency = validFrequency(source.frequency);
  const exercises = source.exercises.flatMap((item): ExerciseSnapshot[] => {
    if (!item || typeof item !== "object") return [];
    const exercise = item as Record<string, unknown>;
    if (typeof exercise.id !== "string" || typeof exercise.key !== "string" || typeof exercise.name !== "string") return [];
    const sets = Math.trunc(numeric(exercise.sets));
    const repLow = Math.trunc(numeric(exercise.repLow));
    const repHigh = Math.trunc(numeric(exercise.repHigh));
    const restSeconds = exercise.restSeconds === 120 || exercise.restSeconds === 180 ? exercise.restSeconds : 90;
    if (sets < 1 || sets > 10 || repLow < 1 || repHigh < repLow || repHigh > 100) return [];
    const loadingType: LoadingType = exercise.loadingType === "bodyweight" || exercise.loadingType === "assisted-bodyweight" || exercise.loadingType === "unloaded" ? exercise.loadingType : "external";
    return [{
      id: exercise.id,
      key: exercise.key,
      name: exercise.name,
      sets,
      repLow,
      repHigh,
      restSeconds,
      ratio: Number(exercise.ratio) > 0 ? Number(exercise.ratio) : undefined,
      perSide: exercise.perSide === true,
      bodyweight: loadingType === "bodyweight" || loadingType === "assisted-bodyweight",
      note: typeof exercise.note === "string" ? exercise.note : undefined,
      sbsRole: exercise.sbsRole === "main" || exercise.sbsRole === "auxiliary" ? exercise.sbsRole : undefined,
      historyIds: Array.isArray(exercise.historyIds) ? exercise.historyIds.filter((id): id is string => typeof id === "string") : undefined,
      loadingType,
      equipment: Array.isArray(exercise.equipment) ? exercise.equipment.filter((item): item is Equipment => item === "home" || item === "limited" || item === "full") : undefined,
    }];
  });
  if (!exercises.length) return undefined;
  const snapshotWeekdays = Array.isArray(source.preferredWeekdays)
    ? [...new Set(source.preferredWeekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [];
  return {
    programId: source.programId,
    programWeek: typeof source.programWeek === "number" && source.programWeek >= 1 && source.programWeek <= 21 ? Math.trunc(source.programWeek) : undefined,
    frequency,
    preferredWeekdays: snapshotWeekdays.length === frequency ? snapshotWeekdays : defaultWeekdays(frequency),
    track: source.track === "women" ? "women" : "current",
    goal: source.goal === "upper" || source.goal === "lower" || source.goal === "strength" ? source.goal : "balanced",
    equipment: source.equipment === "home" || source.equipment === "limited" ? source.equipment : "full",
    dayId: source.dayId,
    dayName: source.dayName,
    focus: typeof source.focus === "string" ? source.focus : "Recorded workout",
    exercises,
  };
};

const validReadiness = (value: unknown): Readiness | undefined =>
  value === "normal" || value === "low" || value === "sore" || value === "severe-soreness" || value === "symptoms" || value === "pain" ? value : undefined;

const validAbsenceReason = (value: unknown): AbsenceReason =>
  value === "travel" || value === "illness" || value === "injury" || value === "soreness" || value === "planned" || value === "other" ? value : "busy";

const validFrequency = (value: unknown): TrainingFrequency => value === 3 || value === 4 ? value : 5;
const defaultWeekdays = (frequency: TrainingFrequency) =>
  frequency === 3 ? [1, 3, 5] : frequency === 4 ? [1, 2, 4, 5] : [1, 2, 4, 5, 6];

export const isActiveSession = (session: Session) => !session.deletedAt;
export const activeSessions = (data: Pick<TrainingData, "sessions">) => data.sessions.filter(isActiveSession);
export const activeWeighIns = (data: Pick<TrainingData, "weighIns">) => data.weighIns.filter((entry) => !entry.deletedAt);

export const bodyweightForSession = (data: TrainingData, session: Session, unit: Unit) => {
  if (session.bodyweightAtSession !== undefined) return convertWeight(session.bodyweightAtSession, session.unit, unit);
  const prior = activeWeighIns(data)
    .filter((entry) => entry.date <= session.date)
    .sort((left, right) => left.date.localeCompare(right.date) || left.updatedAt.localeCompare(right.updatedAt))
    .at(-1);
  if (prior) return convertWeight(prior.weight, prior.unit, unit);
  return data.profile ? convertWeight(data.profile.bodyweight, data.profile.unit, unit) : 0;
};

const exerciseForSessionKey = (session: Session, key: string) => {
  const snapshot = session.planSnapshot?.exercises.find((exercise) => exercise.key === key);
  return snapshot ? { ...snapshot, alternatives: [] } as Exercise : exerciseFromKey(key);
};

export function recalculatePhase2Progression(data: TrainingData): TrainingData {
  const rolling: Record<string, number> = {};
  const managedKeys = new Set<string>();
  const revisedById = new Map<string, Session>();
  const phaseTwoSessions = data.sessions
    .filter((session) => session.programId === "phase2")
    .sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt) || (left.programWeek ?? 1) - (right.programWeek ?? 1));
  phaseTwoSessions.forEach((session) => {
    Object.keys(session.trainingMaxesBefore ?? {}).forEach((key) => {
      managedKeys.add(key);
      if (rolling[key] === undefined) rolling[key] = session.trainingMaxesBefore![key];
    });
    Object.keys(session.trainingMaxesAfter ?? {}).forEach((key) => managedKeys.add(key));
  });
  phaseTwoSessions
    .filter((session) => !session.deletedAt)
    .forEach((session) => {
      const before = { ...(session.trainingMaxesBefore ?? {}) };
      const after = { ...(session.trainingMaxesAfter ?? {}) };
      Object.entries(session.entries).forEach(([key, sets]) => {
        const exercise = exerciseForSessionKey(session, key);
        if (!exercise?.sbsRole) return;
        managedKeys.add(key);
        const base = rolling[key]
          ?? before[key]
          ?? before[exercise.id]
          ?? data.program.trainingMaxes[key]
          ?? data.program.trainingMaxes[exercise.id];
        if (!base || !Number.isFinite(base) || base <= 0) return;
        before[key] = base;
        const finalSet = sets[exercise.sets - 1];
        const prescription = sbsPrescription(exercise.sbsRole, session.programWeek ?? 1);
        const progressionEligible = session.affectsProgression !== false
          && session.completionStatus !== "partial"
          && session.completionStatus !== "skipped";
        after[key] = !progressionEligible || !finalSet || !isFilledSet(finalSet, exercise) || prescription.deload
          ? base
          : base * (1 + sbsTrainingMaxChange(numeric(finalSet.r), prescription.repOutTarget));
        rolling[key] = after[key];
      });
      revisedById.set(session.id, { ...session, trainingMaxesBefore: before, trainingMaxesAfter: after });
    });
  return {
    ...data,
    sessions: data.sessions.map((session) => revisedById.get(session.id) ?? session),
    program: data.program.activeId === "phase2"
      ? { ...data.program, trainingMaxes: { ...Object.fromEntries(Object.entries(data.program.trainingMaxes).filter(([key]) => !managedKeys.has(key))), ...rolling } }
      : data.program,
  };
}

export const trainingDataBytes = (data: TrainingData) => new TextEncoder().encode(JSON.stringify(data)).byteLength;

export function trainingDataValidationIssues(raw: unknown) {
  const issues: string[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ["Training data must be an object."];
  const source = raw as Record<string, unknown>;
  const sourceVersion = Number(source.version);
  if (!Number.isInteger(sourceVersion) || sourceVersion < 2 || sourceVersion > 8) issues.push("Unsupported data version.");
  if (!source.program || typeof source.program !== "object" || Array.isArray(source.program)) issues.push("Program settings are missing.");
  if (!Array.isArray(source.sessions)) {
    issues.push("Session history must be a list.");
  } else {
    if (source.sessions.length > 5_000) issues.push("Session history exceeds 5,000 entries.");
    source.sessions.forEach((value, sessionIndex) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        issues.push(`Session ${sessionIndex + 1} is invalid.`);
        return;
      }
      const session = value as Record<string, unknown>;
      if (!isValidDateOnly(session.date)) issues.push(`Session ${sessionIndex + 1} has an invalid date.`);
      if (typeof session.dayId !== "string" || !session.dayId.trim()) issues.push(`Session ${sessionIndex + 1} has no workout day.`);
      if (session.unit !== "kg" && session.unit !== "lb" && !(sourceVersion < 6 && session.unit === undefined)) issues.push(`Session ${sessionIndex + 1} has an invalid unit.`);
      for (const field of ["warmup", "postCardio"] as const) {
        if (session[field] === undefined) continue;
        const conditioning = session[field] && typeof session[field] === "object" && !Array.isArray(session[field]) ? session[field] as Record<string, unknown> : null;
        if (!conditioning || !["walk", "bike", "stairs", "other"].includes(String(conditioning.mode)) || !["easy", "moderate", "vigorous"].includes(String(conditioning.intensity)) || !Number.isFinite(Number(conditioning.durationMinutes)) || Number(conditioning.durationMinutes) < 1 || Number(conditioning.durationMinutes) > 300) issues.push(`Session ${sessionIndex + 1} has an invalid ${field === "warmup" ? "warm-up" : "post-lift cardio"} log.`);
      }
      if (!session.entries || typeof session.entries !== "object" || Array.isArray(session.entries)) {
        issues.push(`Session ${sessionIndex + 1} has invalid set data.`);
        return;
      }
      Object.entries(session.entries as Record<string, unknown>).forEach(([key, sets]) => {
        if (!Array.isArray(sets) || sets.length > 10) {
          issues.push(`Session ${sessionIndex + 1}, ${key}, has an invalid set list.`);
          return;
        }
        sets.forEach((set, setIndex) => {
          if (!set || typeof set !== "object" || Array.isArray(set)) {
            issues.push(`Session ${sessionIndex + 1}, ${key}, set ${setIndex + 1} is invalid.`);
            return;
          }
          const entry = set as Record<string, unknown>;
          const weight = entry.w === undefined || entry.w === null ? "" : String(entry.w).trim();
          const reps = entry.r === undefined || entry.r === null ? "" : String(entry.r).trim();
          const rir = entry.rir === undefined || entry.rir === null ? "" : String(entry.rir).trim();
          if (weight !== "" && (!Number.isFinite(decimalValue(weight)) || decimalValue(weight) < 0 || decimalValue(weight) > 2_000)) issues.push(`Session ${sessionIndex + 1}, ${key}, set ${setIndex + 1} has an invalid load.`);
          if (reps !== "" && (!Number.isInteger(repValue(reps)) || repValue(reps) < 1 || repValue(reps) > 100)) issues.push(`Session ${sessionIndex + 1}, ${key}, set ${setIndex + 1} has invalid reps.`);
          if (rir !== "" && (!Number.isFinite(decimalValue(rir)) || decimalValue(rir) < 0 || decimalValue(rir) > 10)) issues.push(`Session ${sessionIndex + 1}, ${key}, set ${setIndex + 1} has invalid RIR.`);
        });
      });
    });
  }
  if (source.weighIns !== undefined && !Array.isArray(source.weighIns)) {
    issues.push("Weigh-in history must be a list.");
  } else if (Array.isArray(source.weighIns)) {
    if (source.weighIns.length > 10_000) issues.push("Weigh-in history exceeds 10,000 entries.");
    source.weighIns.forEach((value, index) => {
      const entry = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
      const unit = entry?.unit === "lb" ? "lb" : "kg";
      const weight = Number(entry?.weight);
      if (!entry || !isValidDateOnly(entry.date) || !Number.isFinite(weight) || weight < 25 || weight > (unit === "kg" ? 300 : 660)) issues.push(`Weigh-in ${index + 1} is invalid.`);
    });
  }
  if (source.loadProfiles !== undefined && (!source.loadProfiles || typeof source.loadProfiles !== "object" || Array.isArray(source.loadProfiles))) {
    issues.push("Available-load profiles must be an object.");
  } else if (source.loadProfiles && typeof source.loadProfiles === "object") {
    const profiles = Object.entries(source.loadProfiles as Record<string, unknown>);
    if (profiles.length > 500) issues.push("Available-load profiles exceed 500 entries.");
    profiles.forEach(([key, value]) => {
      const profile = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
      if (!key.trim() || !profile || (profile.unit !== "kg" && profile.unit !== "lb") || !Array.isArray(profile.values) || profile.values.length > 100 || normalizeLoadValues(profile.values).length !== profile.values.length || (!profile.values.length && !profile.deletedAt) || typeof profile.updatedAt !== "string" || Number.isNaN(Date.parse(profile.updatedAt)) || (profile.deletedAt !== undefined && (typeof profile.deletedAt !== "string" || Number.isNaN(Date.parse(profile.deletedAt))))) issues.push(`Available-load profile ${key || "(unnamed)"} is invalid.`);
    });
  }
  if (Array.isArray(source.planHistory) && source.planHistory.length > 2_000) issues.push("Plan history exceeds 2,000 changes.");
  if (source.absences !== undefined && !Array.isArray(source.absences)) issues.push("Time-away history must be a list.");
  if (Array.isArray(source.absences)) {
    if (source.absences.length > 2_000) issues.push("Time-away history exceeds 2,000 entries.");
    source.absences.forEach((value, index) => {
      const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
      if (!record || !isValidDateOnly(record.startDate) || !isValidDateOnly(record.endDate) || String(record.startDate) > String(record.endDate)) {
        issues.push(`Time-away record ${index + 1} has invalid dates.`);
        return;
      }
      if (!Array.isArray(record.missedDates) || record.missedDates.length > 366 || !record.missedDates.every(isValidDateOnly)) issues.push(`Time-away record ${index + 1} has invalid missed dates.`);
      if (record.resolution !== "continue" && record.resolution !== "trained-elsewhere" && record.resolution !== "skip" && record.resolution !== "pause") issues.push(`Time-away record ${index + 1} has an invalid resolution.`);
      if (!Array.isArray(record.resolvedDayIds) || record.resolvedDayIds.length > 50 || !record.resolvedDayIds.every((id) => typeof id === "string")) issues.push(`Time-away record ${index + 1} has invalid workout references.`);
    });
  }
  if (Array.isArray(source.sessionRevisions) && source.sessionRevisions.length > 5_000) issues.push("Session revision history exceeds 5,000 entries.");
  if (source.consent && typeof source.consent === "object" && !Array.isArray(source.consent)) {
    const consent = source.consent as Record<string, unknown>;
    if (typeof consent.termsVersion !== "string" || !consent.termsVersion.trim()) issues.push("Consent version is invalid.");
    if (typeof consent.adultConfirmedAt !== "string" || Number.isNaN(Date.parse(consent.adultConfirmedAt))) issues.push("Adult confirmation date is invalid.");
    if (typeof consent.safetyAcceptedAt !== "string" || Number.isNaN(Date.parse(consent.safetyAcceptedAt))) issues.push("Safety confirmation date is invalid.");
  }
  if (!issues.length && Array.isArray(source.sessions)) {
    const rawSessions = source.sessions as unknown[];
    const normalized = normalizeTrainingData(source);
    normalized.sessions.forEach((session, index) => {
      if ((rawSessions[index] as Record<string, unknown>)?.completionStatus === "completed" && !sessionCountsAsCompletedDay(session, normalized)) issues.push(`Session ${index + 1} is marked complete but required sets are missing.`);
    });
  }
  return [...new Set(issues)].slice(0, 20);
}

export const recordPlanChange = (data: TrainingData, kind: PlanChange["kind"], effectiveAt = new Date().toISOString()): TrainingData => {
  if (!data.profile) return data;
  const change: PlanChange = {
    id: globalThis.crypto?.randomUUID?.() ?? `plan-${kind}-${effectiveAt}`,
    effectiveAt,
    kind,
    programId: data.program.activeId,
    week: data.program.week,
    frequency: data.program.frequency,
    preferredWeekdays: [...data.program.preferredWeekdays],
    track: data.profile.programTrack,
    goal: data.profile.goal,
    equipment: data.profile.equipment,
    status: data.program.status,
  };
  return { ...data, planHistory: [...data.planHistory, change].slice(-2_000) };
};

export const PHASE_TWO_PROGRAMMED_EXERCISES = [...new Map(
  PHASE_TWO_EXERCISE_SOURCE.flatMap((day) => day.exercises).filter((exercise) => exercise.sbsRole).map((exercise) => [exercise.id, exercise]),
).values()];

export const WOMENS_PHASE_TWO_PROGRAMMED_EXERCISES = [...new Map(
  WOMENS_PHASE_TWO_SOURCE.flatMap((day) => day.exercises).filter((exercise) => exercise.sbsRole).map((exercise) => [exercise.id, exercise]),
).values()];

export const phaseTwoProgrammedExercises = (track: ProgramTrack = "current") =>
  track === "women" ? WOMENS_PHASE_TWO_PROGRAMMED_EXERCISES : PHASE_TWO_PROGRAMMED_EXERCISES;

export const suggestedTrainingMax = (data: TrainingData, exercise: Exercise, unit: Unit) => {
  return activeSessions(data).reduce((best, session) => {
    return Object.entries(session.entries).reduce((innerBest, [key, entries]) => {
      const historicalExercise = exerciseForSessionKey(session, key);
      if (!historicalExercise || historicalExercise.name.toLocaleLowerCase() !== exercise.name.toLocaleLowerCase() || !supportsEstimatedMax(historicalExercise)) return innerBest;
      return entries.reduce((setBest, entry) => {
        const reps = numeric(entry.r);
        if (!isFilledSet(entry, historicalExercise) || reps < 4 || reps > 10) return setBest;
        const externalLoad = convertWeight(numeric(entry.w), session.unit, unit);
        const effectiveLoad = effectiveExerciseLoad(historicalExercise, externalLoad, bodyweightForSession(data, session, unit));
        if (effectiveLoad <= 0) return setBest;
        return Math.max(setBest, estimatedOneRepMax(effectiveLoad, reps) * 0.9);
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
  if (!isValidDateOnly(session.date) || typeof session.dayId !== "string") return null;
  const fallbackTime = `${session.date}T12:00:00.000Z`;
  const entriesSource = session.entries && typeof session.entries === "object"
    ? (session.entries as Record<string, unknown>)
    : {};
  const entries = Object.fromEntries(
    Object.entries(entriesSource).flatMap(([key, sets]) => {
      if (!Array.isArray(sets)) return [];
      const exercise = exerciseFromKey(key);
      return [[key, sets.map((set) => normalizeSetEntry(set, exercise))]];
    }),
  );
  const normalizeConditioning = (value: unknown): ConditioningLog | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    const mode = record.mode === "bike" || record.mode === "stairs" || record.mode === "other" ? record.mode : record.mode === "walk" ? "walk" : null;
    const intensity = record.intensity === "moderate" || record.intensity === "vigorous" ? record.intensity : record.intensity === "easy" ? "easy" : null;
    const durationMinutes = Math.trunc(Number(record.durationMinutes));
    return mode && intensity && Number.isFinite(durationMinutes) && durationMinutes >= 1 && durationMinutes <= 300 ? { mode, intensity, durationMinutes } : undefined;
  };
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
    readiness: validReadiness(session.readiness),
    sessionRpe: Number.isFinite(Number(session.sessionRpe)) && Number(session.sessionRpe) >= 1 && Number(session.sessionRpe) <= 10
      ? Number(session.sessionRpe)
      : undefined,
    warmup: normalizeConditioning(session.warmup),
    postCardio: normalizeConditioning(session.postCardio),
    startedAt: typeof session.startedAt === "string" ? validIso(session.startedAt, fallbackTime) : undefined,
    completedAt: typeof session.completedAt === "string" ? validIso(session.completedAt, fallbackTime) : undefined,
    durationSeconds: Number.isFinite(Number(session.durationSeconds)) && Number(session.durationSeconds) >= 0 && Number(session.durationSeconds) <= 43_200
      ? Math.trunc(Number(session.durationSeconds))
      : undefined,
    completionStatus: session.completionStatus === "completed" || session.completionStatus === "adjusted" || session.completionStatus === "skipped" || session.completionStatus === "partial" ? session.completionStatus : undefined,
    affectsProgression: session.affectsProgression !== false,
    bodyweightAtSession: Number(session.bodyweightAtSession) >= 25 && Number(session.bodyweightAtSession) <= ((session.unit === "lb" ? "lb" : fallbackUnit) === "kg" ? 300 : 660) ? Number(session.bodyweightAtSession) : undefined,
    planSnapshot: normalizePlanSnapshot(session.planSnapshot),
    logicalKey: typeof session.logicalKey === "string" ? session.logicalKey : undefined,
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
  const profileUnit: Unit = rawProfile?.unit === "lb" ? "lb" : "kg";
  const normalizedBodyweight = numeric(rawProfile?.bodyweight ?? rawProfile?.bw);
  const validBodyweight = normalizedBodyweight >= 25 && normalizedBodyweight <= (profileUnit === "kg" ? 300 : 660);
  const normalizedLevel: Level = rawProfile?.level === "new"
    ? "new"
    : rawProfile?.level === "beginner"
      ? "beginner"
      : rawProfile?.level === "experienced" || rawProfile?.level === "exp"
        ? "experienced"
        : rawProfile?.level === "returning"
          ? "returning"
          : "intermediate";
  const profile: Profile | null = rawProfile && validBodyweight
    ? {
        displayName: typeof rawProfile.displayName === "string" && rawProfile.displayName.trim() ? rawProfile.displayName.trim().slice(0, 40) : undefined,
        bodyweight: normalizedBodyweight,
        unit: profileUnit,
        level: normalizedLevel,
        gender: rawProfile.gender === "woman" ? "woman" : "man",
        programTrack: rawProfile.programTrack === "women" || rawProfile.programTrack === "current"
          ? rawProfile.programTrack
          : trainingTrack(rawProfile.gender === "woman" ? "woman" : "man"),
        goal: rawProfile.goal === "upper" || rawProfile.goal === "lower" ? rawProfile.goal : "balanced",
        equipment: rawProfile.equipment === "limited" || rawProfile.equipment === "home" ? rawProfile.equipment : "full",
        weightGoal: rawProfile.weightGoal === "cut" || rawProfile.weightGoal === "bulk" ? rawProfile.weightGoal : "maintain",
        weightTrackingEnabled: rawProfile.weightTrackingEnabled !== false,
      }
    : null;
  const fallbackUnit: Unit = profile?.unit ?? profileUnit;
  const rawSessions = Array.isArray(source.sessions) ? source.sessions : [];
  const sessions = rawSessions.flatMap((item, index) => normalizeSession(item, index, fallbackUnit) ?? []);
  const updatedAt = validIso(source.updatedAt, remoteUpdatedAt ?? new Date(0).toISOString());
  const swaps = source.swaps && typeof source.swaps === "object"
    ? Object.fromEntries(Object.entries(source.swaps as Record<string, unknown>).filter(([, value]) => typeof value === "string")) as Record<string, string>
    : {};
  const loadProfiles: Record<string, LoadProfile> = source.loadProfiles && typeof source.loadProfiles === "object" && !Array.isArray(source.loadProfiles)
    ? Object.fromEntries(Object.entries(source.loadProfiles as Record<string, unknown>).flatMap(([key, value]) => {
        if (!key.trim() || !value || typeof value !== "object" || Array.isArray(value)) return [];
        const record = value as Record<string, unknown>;
        const unit: Unit = record.unit === "lb" ? "lb" : "kg";
        const values = Array.isArray(record.values) ? normalizeLoadValues(record.values) : [];
        const deletedAt = typeof record.deletedAt === "string" ? validIso(record.deletedAt, updatedAt) : undefined;
        if (!values.length && !deletedAt) return [];
        return [[key, { unit, values, updatedAt: validIso(record.updatedAt, updatedAt), deletedAt }]];
      }).slice(0, 500))
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
    const entryUnit: Unit = entry.unit === "lb" ? "lb" : fallbackUnit;
    if (!isValidDateOnly(entry.date) || weight < 25 || weight > (entryUnit === "kg" ? 300 : 660)) return [];
    const fallbackTime = `${entry.date}T08:00:00.000Z`;
    return [{
      id: typeof entry.id === "string" ? entry.id : `weight-${entry.date}-${index}`,
      date: entry.date,
      weight,
      unit: entryUnit,
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
  const planHistory: PlanChange[] = Array.isArray(source.planHistory) ? source.planHistory.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const change = item as Record<string, unknown>;
    const effectiveAt = validIso(change.effectiveAt, updatedAt);
    const changeFrequency = validFrequency(change.frequency);
    const changeKind = change.kind === "schedule" || change.kind === "program" || change.kind === "profile" || change.kind === "pause" || change.kind === "resume" ? change.kind : "setup";
    const candidateWeekdays = Array.isArray(change.preferredWeekdays)
      ? [...new Set(change.preferredWeekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
      : [];
    return [{
      id: typeof change.id === "string" ? change.id : `plan-${index}-${effectiveAt}`,
      effectiveAt,
      kind: changeKind,
      programId: change.programId === "phase2" ? "phase2" : "phase1",
      week: Math.max(1, Math.min(21, Math.trunc(numeric(change.week) || 1))),
      frequency: changeFrequency,
      preferredWeekdays: candidateWeekdays.length === changeFrequency ? candidateWeekdays : defaultWeekdays(changeFrequency),
      track: change.track === "women" ? "women" : "current",
      goal: change.goal === "upper" || change.goal === "lower" || change.goal === "strength" ? change.goal : "balanced",
      equipment: change.equipment === "home" || change.equipment === "limited" ? change.equipment : "full",
      status: change.status === "paused" || change.status === "completed" ? change.status : "active",
    }];
  }) : [];
  const absences: AbsenceRecord[] = Array.isArray(source.absences) ? source.absences.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (!isValidDateOnly(record.startDate) || !isValidDateOnly(record.endDate) || record.startDate > record.endDate) return [];
    const reason = validAbsenceReason(record.reason);
    const resolution: AbsenceResolution = record.resolution === "trained-elsewhere" || record.resolution === "skip" || record.resolution === "pause" ? record.resolution : "continue";
    const createdAt = validIso(record.createdAt, `${record.endDate}T12:00:00.000Z`);
    return [{
      id: typeof record.id === "string" ? record.id : `absence-${index}-${record.startDate}`,
      startDate: record.startDate,
      endDate: record.endDate,
      missedDates: Array.isArray(record.missedDates) ? record.missedDates.filter(isValidDateOnly).slice(0, 366) : [],
      reason,
      resolution,
      programId: record.programId === "phase2" ? "phase2" as const : "phase1" as const,
      programWeek: Number(record.programWeek) >= 1 && Number(record.programWeek) <= 21 ? Math.trunc(Number(record.programWeek)) : undefined,
      frequency: validFrequency(record.frequency),
      resolvedDayIds: Array.isArray(record.resolvedDayIds) ? record.resolvedDayIds.filter((id): id is string => typeof id === "string").slice(0, 50) : [],
      createdAt,
      updatedAt: validIso(record.updatedAt, createdAt),
    }];
  }).slice(-2_000) : [];
  const rawReturnPlan = rawProgram.returnPlan && typeof rawProgram.returnPlan === "object" ? rawProgram.returnPlan as Record<string, unknown> : null;
  const returnPlan: ReturnPlan | undefined = rawReturnPlan && Number(rawReturnPlan.sessionsRemaining) > 0
    ? {
        startedAt: validIso(rawReturnPlan.startedAt, updatedAt),
        gapDays: Math.max(0, Math.min(3_650, Math.trunc(numeric(rawReturnPlan.gapDays)))),
        reason: validAbsenceReason(rawReturnPlan.reason),
        totalSessions: Math.max(1, Math.min(3, Math.trunc(numeric(rawReturnPlan.totalSessions) || 1))),
        sessionsRemaining: Math.max(1, Math.min(3, Math.trunc(numeric(rawReturnPlan.sessionsRemaining) || 1))),
        loadFactor: Math.max(0.5, Math.min(1, numeric(rawReturnPlan.loadFactor) || 0.9)),
        volumeFactor: Math.max(0.5, Math.min(1, numeric(rawReturnPlan.volumeFactor) || 0.75)),
        targetRir: Math.max(2, Math.min(5, Math.trunc(numeric(rawReturnPlan.targetRir) || 3))),
      }
    : undefined;
  const rawConsent = source.consent && typeof source.consent === "object" ? source.consent as Record<string, unknown> : null;
  const consent: ConsentRecord | undefined = rawConsent && typeof rawConsent.termsVersion === "string"
    ? {
        termsVersion: rawConsent.termsVersion,
        adultConfirmedAt: validIso(rawConsent.adultConfirmedAt, updatedAt),
        safetyAcceptedAt: validIso(rawConsent.safetyAcceptedAt, updatedAt),
      }
    : undefined;
  const normalized: TrainingData = {
    version: 8,
    updatedAt,
    setupVersion: profile ? Math.max(2, Math.trunc(numeric(source.setupVersion) || 2)) : 0,
    setupCompletedAt: profile ? validIso(source.setupCompletedAt, updatedAt) : undefined,
    profile,
    sessions,
    sessionRevisions: sessionRevisions.slice(-5_000),
    weighIns,
    swaps,
    loadProfiles,
    planHistory,
    absences,
    consent,
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
      returnPlan,
    },
  };
  return recalculatePhase2Progression(normalized);
}

export function mergeTrainingData(left: TrainingData, right: TrainingData): TrainingData {
  const newer = Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left : right;
  const sessions = new Map<string, Session>();
  [...left.sessions, ...right.sessions].forEach((session) => {
    const mergeKey = session.logicalKey ?? session.id;
    const existing = sessions.get(mergeKey);
    if (!existing || Date.parse(session.updatedAt) >= Date.parse(existing.updatedAt)) {
      sessions.set(mergeKey, session);
    }
  });
  const weighIns = new Map<string, WeighIn>();
  [...left.weighIns, ...right.weighIns].forEach((entry) => {
    const existing = weighIns.get(entry.id);
    if (!existing || Date.parse(entry.updatedAt) >= Date.parse(existing.updatedAt)) weighIns.set(entry.id, entry);
  });
  const revisions = new Map<string, SessionRevision>();
  [...left.sessionRevisions, ...right.sessionRevisions].forEach((revision) => revisions.set(revision.id, revision));
  const planChanges = new Map<string, PlanChange>();
  [...left.planHistory, ...right.planHistory].forEach((change) => planChanges.set(change.id, change));
  const absences = new Map<string, AbsenceRecord>();
  [...left.absences, ...right.absences].forEach((record) => {
    const existing = absences.get(record.id);
    if (!existing || record.updatedAt >= existing.updatedAt) absences.set(record.id, record);
  });
  const loadProfiles = new Map<string, LoadProfile>();
  [...Object.entries(left.loadProfiles), ...Object.entries(right.loadProfiles)].forEach(([key, profile]) => {
    const existing = loadProfiles.get(key);
    if (!existing || profile.updatedAt >= existing.updatedAt) loadProfiles.set(key, profile);
  });
  return recalculatePhase2Progression({
    version: 8,
    updatedAt: new Date(Math.max(Date.parse(left.updatedAt), Date.parse(right.updatedAt))).toISOString(),
    setupVersion: newer.setupVersion,
    setupCompletedAt: newer.setupCompletedAt,
    profile: newer.profile,
    swaps: newer.swaps,
    loadProfiles: Object.fromEntries(loadProfiles),
    program: newer.program,
    planHistory: [...planChanges.values()].sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt)).slice(-2_000),
    absences: [...absences.values()].sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(-2_000),
    consent: newer.consent,
    sessions: [...sessions.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    sessionRevisions: [...revisions.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-5_000),
    weighIns: [...weighIns.values()].sort((a, b) => a.date.localeCompare(b.date)),
  });
}
