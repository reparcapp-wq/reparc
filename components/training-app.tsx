"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BellRing,
  ClipboardCheck,
  Check,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cloud,
  CloudOff,
  Download,
  Dumbbell,
  FileJson,
  Footprints,
  HeartPulse,
  History,
  Lock,
  LockOpen,
  Mars,
  Monitor,
  Moon,
  Minus,
  Plus,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Trash2,
  Pencil,
  Timer,
  UserRound,
  Venus,
  ShieldAlert,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { BrandLockup, RepArcLoader } from "@/components/brand-lockup";
import { Button } from "@/components/ui/button";
import { SettingsTools } from "@/components/settings-tools";
import { exerciseGuidance } from "@/lib/exercise-guidance";
import { nextSessionAdjustment, nextSetAdjustment, type LoadAdjustment } from "@/lib/autoregulation";
import { buildDailyReport, buildScheduleAdherence } from "@/lib/daily-report";
import { TrainingGuide } from "@/components/training-guide";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LEVELS,
  PROGRAMS,
  activeSessions,
  activeWeighIns,
  absenceDayIds,
  blankEntries,
  buildReturnPlan,
  buildSessionPlanSnapshot,
  bodyweightForSession,
  convertWeight,
  CURRENT_TERMS_VERSION,
  effectiveExerciseLoad,
  emptyData,
  detectMissedTraining,
  estimatedOneRepMax,
  exerciseNeedsLoad,
  exerciseFromKey,
  exerciseKey,
  exerciseName,
  isFilledSet,
  isoDate,
  numeric,
  loadProfileValues,
  loadProfileId,
  normalizeLoadValues,
  nextUnfinishedProgramDay,
  prettyDate,
  programDays,
  recalculatePhase2Progression,
  returnPlanSetCount,
  recordPlanChange,
  resolveExerciseVariant,
  resolveAvailableLoad,
  roundLoad,
  sbsPrescription,
  sessionCountsAsCompletedDay,
  sessionLogicalKey,
  supportsEstimatedMax,
  phase2DataConfidence,
  phaseTwoProgrammedExercises,
  suggestedTrainingMax,
  trainingTrack,
  trainingDataBytes,
  trainingDayFromSnapshot,
  weightTrend,
  slugify,
  type Exercise,
  type AbsenceReason,
  type AbsenceRecord,
  type AbsenceResolution,
  type Equipment,
  type Gender,
  type Level,
  type Profile,
  type ConditioningLog,
  type CardioMode,
  type ConditioningIntensity,
  type ProgramId,
  type Readiness,
  type Session,
  type SetEntry,
  type TrainingData,
  type TrainingDay,
  type TrainingFrequency,
  type TrainingGoal,
  type Unit,
  type WeightGoal,
} from "@/lib/training";
import {
  loadDrafts,
  loadTrainingData,
  rememberName,
  saveTrainingData,
  replaceTrainingData,
  saveDrafts,
  savedName,
} from "@/lib/training-storage";
import { downloadTrainingBackup, type RestoreMode } from "@/lib/backup";
import type { Account } from "@/lib/account-client";
import type { PwaLifecycle } from "@/hooks/use-pwa";

type Stage = "loading" | "name" | "profile" | "consent" | "app";
type SyncState = "loading" | "saving" | "synced" | "pending" | "local";
type View = "train" | "progress" | "settings" | "guide";
type RestTimer = {
  exerciseId: string;
  exerciseName: string;
  durationSeconds: number;
  endsAt: number;
  remainingSeconds: number;
};
type AlertPermission = NotificationPermission | "unsupported";
type RestAlertLevel = "quiet" | "normal" | "maximum";
type WakeLockState = "active" | "available" | "unavailable";
type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
};
type WakeLockNavigator = Navigator & {
  standalone?: boolean;
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

const today = () => isoDate();

const REPARC_LOADER_MINIMUM_MS = 2_600;

const waitForRepArcLoader = async (startedAt: number) => {
  const remaining = REPARC_LOADER_MINIMUM_MS - (performance.now() - startedAt);
  if (remaining > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
};

const emptySet = (): SetEntry => ({ w: "", r: "", rir: "" });

const LOAD_PROFILE_PRESETS = [
  { label: "Dumbbells 2.5–40 kg", unit: "kg" as const, values: [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40] },
  { label: "Stack 5–91 kg", unit: "kg" as const, values: [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59, 64, 68, 73, 77, 82, 86, 91] },
  { label: "Stack 4.5–90 kg", unit: "kg" as const, values: [4.5, 9, 14, 18, 23, 29, 36, 43, 50, 57, 63, 70, 77, 84, 90] },
  { label: "Stack 4.5–104 kg", unit: "kg" as const, values: [4.5, 9, 14, 18, 23, 29, 36, 43, 50, 57, 63, 70, 77, 84, 90, 97, 104] },
  { label: "Stack 9–104 kg", unit: "kg" as const, values: [9, 14, 18, 23, 29, 36, 43, 50, 57, 63, 70, 77, 84, 90, 97, 104] },
] as const;

function ConditioningEditor({ kind, value, onChange }: { kind: "warmup" | "post"; value: ConditioningLog | null; onChange: (value: ConditioningLog | null) => void }) {
  const isWarmup = kind === "warmup";
  const update = <K extends keyof ConditioningLog,>(field: K, next: ConditioningLog[K]) => onChange({ mode: value?.mode ?? "walk", durationMinutes: value?.durationMinutes ?? (isWarmup ? 5 : 10), intensity: value?.intensity ?? "easy", [field]: next });
  const modes: Array<[CardioMode, string]> = [["walk", "Walk"], ["bike", "Bike"], ["stairs", "Stairs"], ["other", "Other"]];
  const intensities: Array<[ConditioningIntensity, string]> = [["easy", "Easy"], ["moderate", "Moderate"], ["vigorous", "Vigorous"]];
  return (
    <details className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-300/10 text-amber-300">{isWarmup ? <Footprints className="size-4" /> : <HeartPulse className="size-4" />}</span><div><p className="text-sm font-semibold">{isWarmup ? "Warm-up" : "Post-lift cardio"} · optional</p><p className="mt-0.5 text-[11px] text-stone-500">{value ? `${value.durationMinutes} min · ${value.mode} · ${value.intensity}` : isWarmup ? "Brief and easy before working sets" : "After lifting or in a separate session"}</p></div></div>
        <ChevronDown className="size-4 text-stone-500" />
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-xs leading-5 text-stone-500">{isWarmup ? "Aim to feel warm without tiring yourself. Before the first heavy or unfamiliar movement, add 1–3 progressively heavier rehearsal sets; do not log those as working sets. Stairs can fatigue the legs, so keep them easy on lower-body days." : "This is not required for recovery. If strength is the priority, place substantial cardio after lifting or separate it by several hours."}</p>
        <div className="grid grid-cols-4 gap-1.5">{modes.map(([mode, label]) => <Button key={mode} type="button" variant="outline" data-selected={value?.mode === mode} aria-pressed={value?.mode === mode} onClick={() => update("mode", mode)} className="selection-button h-9 rounded-lg px-1 text-[11px]">{label}</Button>)}</div>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
          <div className="grid grid-cols-3 gap-1.5">{intensities.map(([intensity, label]) => <Button key={intensity} type="button" variant="outline" data-selected={value?.intensity === intensity} aria-pressed={value?.intensity === intensity} onClick={() => update("intensity", intensity)} className="selection-button h-9 rounded-lg px-1 text-[10px]">{label}</Button>)}</div>
          <Input inputMode="numeric" value={value?.durationMinutes ?? ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { if (/^\d{0,3}$/.test(event.target.value)) update("durationMinutes", Math.max(1, Math.min(300, Number(event.target.value) || 1))); }} placeholder={isWarmup ? "5 min" : "10 min"} aria-label={`${isWarmup ? "Warm-up" : "Post-lift cardio"} minutes`} className="h-9 rounded-lg border-white/10 bg-black/20 text-center font-mono text-xs" />
        </div>
        <div className="flex items-center justify-between"><p className="text-[10px] text-stone-600">Easy = full sentences. Moderate = talk, not sing.</p>{value && <button type="button" onClick={() => onChange(null)} className="text-[11px] text-stone-500 hover:text-white">Clear</button>}</div>
      </div>
    </details>
  );
}

const formatTimer = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function RestTimerPanel({ timer, remaining, permission, wakeLockState, className = "", onClose, onAdd, onEnable }: {
  timer: RestTimer;
  remaining: number;
  permission: AlertPermission;
  wakeLockState: WakeLockState;
  className?: string;
  onClose: () => void;
  onAdd: () => void;
  onEnable: () => void;
}) {
  const complete = remaining <= 0;
  const displaySeconds = complete ? Math.abs(remaining) : remaining;
  return (
    <aside className={`motion-rest overflow-hidden rounded-[1.35rem] border p-4 shadow-xl backdrop-blur-xl ${complete ? "border-amber-300 bg-amber-300 text-[#0b0d0c]" : "border-white/15 bg-[#171a17]/95 text-stone-100"} ${className}`} aria-label={`Rest timer for ${timer.exerciseName}`}>
      <div className="flex items-center gap-3">
        <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${complete ? "bg-black/10" : "bg-amber-300 text-[#0b0d0c]"}`}><Timer className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <p className={`eyebrow ${complete ? "text-black/60" : "text-amber-300"}`}>{complete ? "Rest complete" : "Recover for your next set"}</p>
          <p className="mt-1 truncate text-sm font-semibold">{timer.exerciseName}</p>
        </div>
        <time className="font-mono text-3xl font-semibold tracking-[-0.06em]" aria-label={complete ? `Rest completed ${displaySeconds} seconds ago` : `${remaining} seconds remaining`}>{complete ? "+" : ""}{formatTimer(displaySeconds)}</time>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close rest timer" className={`size-8 rounded-lg ${complete ? "text-black/60 hover:bg-black/10 hover:text-black" : "text-stone-500 hover:bg-white/10 hover:text-white"}`}><X className="size-4" /></Button>
      </div>
      {!complete && <Progress value={Math.min(100, ((timer.durationSeconds - remaining) / timer.durationSeconds) * 100)} className="mt-3 h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-amber-300" />}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className={`text-[11px] ${complete ? "text-black/60" : "text-stone-500"}`}>{complete ? "Continue when your technique and breathing are ready." : wakeLockState === "active" ? "Screen awake · keep RepArc visible for guaranteed sound" : permission === "granted" ? "Notifications allowed · background timing is best effort" : permission === "unsupported" ? "Keep RepArc visible for a reliable alert" : "Enable notifications before switching apps"}</p>
        <div className="flex shrink-0 gap-1">
          {!complete && permission === "default" && <Button type="button" variant="ghost" onClick={onEnable} className="h-8 rounded-lg px-2 text-[11px] text-amber-300 hover:bg-white/10 hover:text-amber-200">Enable</Button>}
          {!complete && <Button type="button" variant="outline" onClick={onAdd} className="h-8 rounded-lg border-white/10 bg-white/[0.04] px-2 text-[11px] text-stone-300"><Plus className="size-3" />30 sec</Button>}
          <Button type="button" onClick={onClose} className={`h-8 rounded-lg px-3 text-[11px] font-bold ${complete ? "bg-[#0b0d0c] text-amber-200 hover:bg-black" : "bg-white/10 text-stone-200 hover:bg-white/15"}`}>{complete ? "Next set" : "Skip"}</Button>
        </div>
      </div>
    </aside>
  );
}

const sessionEntriesForDay = (
  day: TrainingDay,
  swaps: Record<string, string>,
  source?: Record<string, SetEntry[]>,
  sourceUnit?: Unit,
  targetUnit?: Unit,
) => {
  const blank = blankEntries(day, swaps);
  Object.keys(blank).forEach((key) => {
    const exercise = exerciseFromKey(key);
    const saved = source?.[key];
    if (!exercise || !saved) return;
    blank[key] = Array.from({ length: exercise.sets }, (_, index) => {
      const entry = saved[index] ?? emptySet();
      if (!sourceUnit || !targetUnit || sourceUnit === targetUnit || entry.w === "") return entry;
      return {
        ...entry,
        w: String(Math.round(convertWeight(numeric(entry.w), sourceUnit, targetUnit) * 100) / 100),
      };
    });
  });
  return blank;
};

const storedExercise = (session: Session, key: string) => {
  const snapshot = session.planSnapshot?.exercises.find((exercise) => exercise.key === key);
  return snapshot ? { ...snapshot, alternatives: [] } as Exercise : exerciseFromKey(key);
};

function SyncBadge({ state, lastSyncedAt, onSync }: { state: SyncState; lastSyncedAt?: string; onSync?: () => void }) {
  const syncedTime = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
  const content = {
    loading: { label: "Loading", icon: RefreshCw, className: "text-stone-400" },
    saving: { label: "Saving", icon: RefreshCw, className: "text-amber-300" },
    synced: { label: syncedTime ? `Cloud saved · ${syncedTime}` : "Cloud saved", icon: Cloud, className: "text-emerald-300" },
    pending: { label: "Saved offline · 1 change pending", icon: CloudOff, className: "text-amber-300" },
    local: { label: "Saved on device", icon: CloudOff, className: "text-stone-400" },
  }[state];
  const Icon = content.icon;
  return (
    <button type="button" data-sync-state={state} onClick={onSync} disabled={!onSync || state === "saving" || state === "loading"} className={`sync-badge inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-default ${content.className}`} aria-live="polite" aria-label={`${content.label}. ${onSync ? "Activate to sync now." : ""}`} title={onSync ? "Sync now" : undefined}>
      <Icon className={`size-3.5 ${state === "saving" || state === "loading" ? "animate-spin" : ""}`} />
      <span>{content.label}</span>
    </button>
  );
}

function ChoiceRadio({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <div className="choice-card">
      <RadioGroupItem id={id} value={value} className="choice-radio" />
      <label htmlFor={id} className="choice-label">{label}</label>
      <Check className="choice-check size-3.5" aria-hidden="true" />
    </div>
  );
}

function RequiredMark() {
  return <span className="ml-1 text-red-400" aria-hidden="true">*</span>;
}

function LoadingScreen() {
  return (
    <main id="main-content" className="grid min-h-dvh place-items-center bg-[#0b0d0c] text-stone-100">
      <RepArcLoader label="Preparing your training log" />
    </main>
  );
}

function NameSetup({ onContinue }: { onContinue: (name: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed || !slugify(trimmed)) {
      setError("Enter a name with at least one letter or number.");
      return;
    }
    if (trimmed.length > 40) {
      setError("Keep your training name under 40 characters.");
      return;
    }
    setError("");
    setBusy(true);
    await onContinue(trimmed);
    setBusy(false);
  };

  return (
    <main id="main-content" className="onboarding-shell min-h-dvh bg-[#0b0d0c] text-stone-100">
      <section className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-between px-5 py-6 sm:px-10 sm:py-10">
        <header className="motion-header flex items-center justify-between">
          <BrandLockup />
          <span className="eyebrow">01 / Identity</span>
        </header>

        <div className="grid gap-12 py-14 lg:grid-cols-[1.05fr_.95fr] lg:items-end">
          <div className="motion-page">
            <p className="eyebrow text-amber-300">Built around your numbers</p>
            <h1 className="mt-5 max-w-xl text-[clamp(3.25rem,9vw,7.5rem)] font-semibold leading-[0.84] tracking-[-0.07em]">
              Train.<br />Record.<br /><span className="text-amber-300">Progress.</span>
            </h1>
          </div>

          <div className="motion-panel rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/30 sm:p-7">
            <span className="step-number">01</span>
            <h2 className="mt-8 text-2xl font-semibold tracking-tight">Who&apos;s training?</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-stone-400">
              Choose a local training label. Your verified account—not this name—owns the cloud history.
            </p>
            <label className="mt-8 block">
              <span className="eyebrow">Training name</span>
              <Input
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
                placeholder="e.g. Franz"
                aria-invalid={Boolean(error)}
                className="mt-3 h-14 rounded-xl border-white/10 bg-white/[0.055] px-4 text-lg text-white shadow-none placeholder:text-stone-600 focus-visible:border-amber-300 focus-visible:ring-amber-300/20"
              />
            </label>
            {error && <p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
            <Button
              onClick={submit}
              disabled={busy}
              className="mt-6 h-14 w-full rounded-xl bg-amber-300 text-sm font-bold text-[#0b0d0c] hover:bg-amber-200"
            >
              {busy ? "Opening your log…" : "Continue"}
              {!busy && <ArrowUpRight className="size-4" />}
            </Button>
          </div>
        </div>

        <p className="max-w-md text-xs leading-5 text-stone-600">
          Your latest copy stays on this device, so a weak connection will never stop a workout.
        </p>
      </section>
    </main>
  );
}

type OnboardingDraft = {
  step: number;
  unit: Unit;
  level: Level | null;
  gender: Gender | null;
  frequency: TrainingFrequency | null;
  preferredWeekdays: number[];
  goal: TrainingGoal;
  equipment: Equipment | null;
  bodyweight: string;
  weightTrackingEnabled: boolean | null;
  weightGoal: WeightGoal;
  adultConfirmed: boolean;
  safetyAccepted: boolean;
};

function ProfileSetup({ accountId, name, onSave }: { accountId: string; name: string; onSave: (profile: Profile, frequency: TrainingFrequency, preferredWeekdays: number[]) => Promise<boolean> }) {
  const [step, setStep] = useState(1);
  const [unit, setUnit] = useState<Unit>("kg");
  const [level, setLevel] = useState<Level | null>(null);
  const [gender, setGender] = useState<Gender | null>(null);
  const [frequency, setFrequency] = useState<TrainingFrequency | null>(null);
  const [preferredWeekdays, setPreferredWeekdays] = useState<number[]>([]);
  const [goal, setGoal] = useState<TrainingGoal>("balanced");
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [bodyweight, setBodyweight] = useState("");
  const [weightTrackingEnabled, setWeightTrackingEnabled] = useState<boolean | null>(null);
  const [weightGoal, setWeightGoal] = useState<WeightGoal>("maintain");
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const draftKey = `my-progress-onboarding-v2:${slugify(accountId)}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw) as Partial<OnboardingDraft>;
          if (typeof draft.step === "number") setStep(Math.max(1, Math.min(5, Math.trunc(draft.step))));
          if (draft.unit === "kg" || draft.unit === "lb") setUnit(draft.unit);
          if (LEVELS.some((option) => option.id === draft.level)) setLevel(draft.level as Level);
          if (draft.gender === "man" || draft.gender === "woman") setGender(draft.gender);
          if (draft.frequency === 3 || draft.frequency === 4 || draft.frequency === 5) setFrequency(draft.frequency);
          if (Array.isArray(draft.preferredWeekdays)) setPreferredWeekdays(draft.preferredWeekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6));
          if (draft.goal === "upper" || draft.goal === "lower") setGoal(draft.goal); else if (draft.goal === "balanced" || draft.goal === "strength") setGoal("balanced");
          if (draft.equipment === "full" || draft.equipment === "limited" || draft.equipment === "home") setEquipment(draft.equipment);
          if (typeof draft.bodyweight === "string") setBodyweight(draft.bodyweight);
          if (typeof draft.weightTrackingEnabled === "boolean") setWeightTrackingEnabled(draft.weightTrackingEnabled);
          if (draft.weightGoal === "cut" || draft.weightGoal === "maintain" || draft.weightGoal === "bulk") setWeightGoal(draft.weightGoal);
          setAdultConfirmed(draft.adultConfirmed === true);
          setSafetyAccepted(draft.safetyAccepted === true);
        }
      } catch {
        // A malformed draft is ignored; required choices still prevent completion.
      } finally {
        setDraftReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftKey]);

  useEffect(() => {
    if (!draftReady) return;
    const draft: OnboardingDraft = { step, unit, level, gender, frequency, preferredWeekdays, goal, equipment, bodyweight, weightTrackingEnabled, weightGoal, adultConfirmed, safetyAccepted };
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // The required setup still remains in memory for this visit.
    }
  }, [adultConfirmed, bodyweight, draftKey, draftReady, equipment, frequency, gender, goal, level, preferredWeekdays, safetyAccepted, step, unit, weightGoal, weightTrackingEnabled]);

  const selectFrequency = (value: TrainingFrequency) => {
    setFrequency(value);
    setPreferredWeekdays(value === 3 ? [1, 3, 5] : value === 4 ? [1, 2, 4, 5] : [1, 2, 4, 5, 6]);
  };

  const togglePreferredDay = (weekday: number) => {
    if (!frequency) return;
    setPreferredWeekdays((current) => current.includes(weekday)
      ? current.filter((day) => day !== weekday)
      : current.length < frequency ? [...current, weekday].sort() : current);
  };

  const stepError = () => {
    if (step === 1 && !gender) return "Select Man or Woman to assign your program.";
    if (step === 1 && !adultConfirmed) return "Confirm that you are 18 or older to use this adult program.";
    const value = Number(bodyweight);
    const maximum = unit === "kg" ? 300 : 660;
    if (step === 2 && (!value || value < 25 || value > maximum)) return `Enter a bodyweight between 25 and ${maximum} ${unit}.`;
    if (step === 2 && !level) return "Choose how long you have been lifting.";
    if (step === 3 && !frequency) return "Choose how many days you can train.";
    if (step === 3 && preferredWeekdays.length !== frequency) return `Choose exactly ${frequency} preferred training days.`;
    if (step === 4 && !equipment) return "Choose the equipment you can normally use.";
    if (step === 4 && weightTrackingEnabled === null) return "Choose whether bodyweight trends should appear in Progress.";
    if (step === 4 && !safetyAccepted) return "Confirm that you understand the program's safety limits.";
    return "";
  };

  const continueSetup = () => {
    const message = stepError();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(5, current + 1));
  };

  const submit = async () => {
    if (!gender || !adultConfirmed) {
      setStep(1);
      setError("Complete the age confirmation and program assignment first.");
      return;
    }
    const value = Number(bodyweight);
    const maximum = unit === "kg" ? 300 : 660;
    if (!level || !value || value < 25 || value > maximum) {
      setStep(2);
      setError("Complete your valid starting point first.");
      return;
    }
    if (!frequency || preferredWeekdays.length !== frequency) {
      setStep(3);
      setError("Complete your weekly schedule first.");
      return;
    }
    if (!equipment || weightTrackingEnabled === null || !safetyAccepted) {
      setStep(4);
      setError("Complete your training preferences and safety confirmation first.");
      return;
    }
    setBusy(true);
    setError("");
    const saved = await onSave({ displayName: name, bodyweight: value, unit, level, gender, programTrack: trainingTrack(gender), goal: goal === "strength" ? "balanced" : goal, equipment, weightGoal, weightTrackingEnabled }, frequency, preferredWeekdays);
    if (saved) {
      try { window.localStorage.removeItem(draftKey); } catch { /* The completed profile is authoritative. */ }
    } else {
      setError("Your setup could not be saved. Keep this page open and try again.");
    }
    setBusy(false);
  };

  const stepTitles = ["About you", "Starting point", "Your schedule", "Preferences", "Review"];
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedProgram = gender === "woman" ? "Women’s · Foundation" : "Current · Foundation";

  return (
    <main id="main-content" className="onboarding-shell min-h-dvh bg-[#0b0d0c] px-5 py-6 text-stone-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <header className="motion-header flex items-center justify-between">
          <BrandLockup />
          <span className="eyebrow">Required setup</span>
        </header>

        <section className="motion-panel mt-8 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 sm:mt-12 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div><span className="step-number">{String(step).padStart(2, "0")} / 05</span><p className="mt-1 text-sm font-semibold">{stepTitles[step - 1]}</p></div>
            <p className="text-xs text-stone-500">Welcome, {name}</p>
          </div>
          <Progress value={step * 20} className="mt-4 h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-amber-300" aria-label={`Setup step ${step} of 5`} />

          <div key={step} className="onboarding-step mt-8">
            {step === 1 && <>
              <p className="eyebrow text-amber-300">Automatic program assignment</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Choose your training track.</h1>
              <p className="mt-3 text-sm leading-6 text-stone-400">Your selection assigns the matching Foundation program automatically. Completed workouts become the stronger signal after training begins.</p>
              <p className="mt-6 text-xs font-semibold text-stone-300">Gender <RequiredMark /><span className="sr-only"> required</span></p>
              <div className="mt-2 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Gender" aria-required="true">
                {([['man', 'Man', Mars], ['woman', 'Woman', Venus]] as const).map(([value, label, Icon]) => <Button key={value} type="button" role="radio" aria-checked={gender === value} variant="outline" data-selected={gender === value} onClick={() => setGender(value)} className="selection-button onboarding-choice h-24 flex-col gap-2 rounded-2xl border-white/10 text-base font-bold"><Icon className="size-7" aria-hidden="true" /><span>{label}</span></Button>)}
              </div>
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-stone-300"><input type="checkbox" required aria-required="true" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-amber-300" /><span>I confirm that I am 18 or older <RequiredMark />. This program provides general adult fitness guidance.</span></label>
            </>}

            {step === 2 && <>
              <p className="eyebrow text-amber-300">Baseline</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Set your starting point.</h1>
              <div className="mt-7 grid gap-6 sm:grid-cols-2 sm:items-end">
                <fieldset><legend className="eyebrow">Units <RequiredMark /></legend><RadioGroup value={unit} onValueChange={(value) => setUnit(value as Unit)} className="mt-3 grid grid-cols-2 gap-2" aria-label="Weight unit" aria-required="true">{(["kg", "lb"] as Unit[]).map((value) => <ChoiceRadio key={value} id={`calibrate-unit-${value}`} value={value} label={value.toUpperCase()} />)}</RadioGroup></fieldset>
                <label><span className="eyebrow">Bodyweight ({unit}) <RequiredMark /></span><Input required aria-required="true" inputMode="decimal" value={bodyweight} onChange={(event) => /^\d*\.?\d*$/.test(event.target.value) && setBodyweight(event.target.value)} placeholder={unit === "kg" ? "75" : "165"} className="mt-3 h-12 rounded-xl border-white/10 bg-white/[0.055] px-4 font-mono text-lg text-white" /></label>
              </div>
              <fieldset className="mt-7"><legend className="eyebrow">Time spent lifting <RequiredMark /></legend><RadioGroup value={level ?? ""} onValueChange={(value) => setLevel(value as Level)} className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Time spent lifting" aria-required="true">{LEVELS.map((option) => <ChoiceRadio key={option.id} id={`calibrate-level-${option.id}`} value={option.id} label={option.label} />)}</RadioGroup></fieldset>
            </>}

            {step === 3 && <>
              <p className="eyebrow text-amber-300">Weekly cadence</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Make the plan fit your week.</h1>
              <p className="mt-3 text-sm leading-6 text-stone-400">Choose the number of workouts first, then confirm the exact days you prefer. You can still open any session manually.</p>
              <p className="mt-6 text-xs font-semibold text-stone-300">Training days <RequiredMark /></p><div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Training days per week" aria-required="true">{([3, 4, 5] as TrainingFrequency[]).map((value) => <Button key={value} type="button" role="radio" variant="outline" aria-checked={frequency === value} data-selected={frequency === value} onClick={() => selectFrequency(value)} className="selection-button onboarding-choice h-14 rounded-xl font-bold">{value} days</Button>)}</div>
              <p className="mt-7 text-xs font-semibold text-stone-300">Preferred days <RequiredMark /></p>
              <div className="mt-2 grid grid-cols-7 gap-1">{weekdayLabels.map((label, weekday) => <Button key={label} type="button" variant="outline" disabled={!frequency} aria-pressed={preferredWeekdays.includes(weekday)} data-selected={preferredWeekdays.includes(weekday)} onClick={() => togglePreferredDay(weekday)} className="selection-button h-12 rounded-lg px-1 text-[10px]">{label}</Button>)}</div>
              <p className="mt-3 text-xs text-stone-500">{preferredWeekdays.length} / {frequency ?? 0} selected</p>
            </>}

            {step === 4 && <>
              <p className="eyebrow text-amber-300">Personalization</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Choose what is practical.</h1>
              <div className="mt-7 grid gap-6 sm:grid-cols-2">
                <fieldset><legend className="eyebrow">Equipment <RequiredMark /></legend><RadioGroup value={equipment ?? ""} onValueChange={(value) => setEquipment(value as Equipment)} className="mt-3 grid gap-2" aria-label="Available equipment" aria-required="true">{([['full','Full gym'],['limited','Limited gym'],['home','Home']] as const).map(([value, label]) => <ChoiceRadio key={value} id={`equipment-${value}`} value={value} label={label} />)}</RadioGroup></fieldset>
                <fieldset><legend className="eyebrow">Training emphasis</legend><RadioGroup value={goal} onValueChange={(value) => setGoal(value as TrainingGoal)} className="mt-3 grid gap-2" aria-label="Training emphasis">{([['balanced','Balanced'],['upper','Upper body'],['lower','Lower body / glutes']] as const).map(([value, label]) => <ChoiceRadio key={value} id={`goal-${value}`} value={value} label={label} />)}</RadioGroup><p className="mt-2 text-[11px] leading-4 text-stone-500">Emphasis adds a small amount of accessory work; it does not replace the main progression.</p></fieldset>
              </div>
              <fieldset className="mt-7"><legend className="eyebrow">Bodyweight trends in Progress <RequiredMark /></legend><div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-required="true">{([[true,"Track weigh-ins"],[false,"Hide weigh-ins"]] as const).map(([value, label]) => <Button key={label} type="button" role="radio" variant="outline" aria-checked={weightTrackingEnabled === value} data-selected={weightTrackingEnabled === value} onClick={() => setWeightTrackingEnabled(value)} className="selection-button onboarding-choice min-h-14 rounded-xl font-semibold">{label}</Button>)}</div></fieldset>
              {weightTrackingEnabled && <fieldset className="motion-pop mt-5"><legend className="eyebrow">Current goal</legend><RadioGroup value={weightGoal} onValueChange={(value) => setWeightGoal(value as WeightGoal)} className="mt-3 grid grid-cols-3 gap-2" aria-label="Weight goal">{(["cut","maintain","bulk"] as WeightGoal[]).map((value) => <ChoiceRadio key={value} id={`setup-weight-${value}`} value={value} label={value[0].toUpperCase() + value.slice(1)} />)}</RadioGroup></fieldset>}
              <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-stone-400"><input type="checkbox" required aria-required="true" checked={safetyAccepted} onChange={(event) => setSafetyAccepted(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-amber-300" /><span>I understand this is general fitness guidance—not medical care, injury rehabilitation, or a pregnancy/postpartum prescription <RequiredMark />.</span></label>
            </>}

            {step === 5 && gender && level && frequency && equipment && weightTrackingEnabled !== null && <>
              <p className="eyebrow text-amber-300">Ready to begin</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Review your program.</h1>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {[['Program', selectedProgram],['Schedule', `${frequency} days · ${preferredWeekdays.map((day) => weekdayLabels[day]).join(" / ")}`],['Starting point', `${bodyweight} ${unit} · ${LEVELS.find((option) => option.id === level)?.label}`],['Equipment', equipment === 'full' ? 'Full gym' : equipment === 'limited' ? 'Limited gym' : 'Home'],['Emphasis', goal === 'upper' ? 'Upper body' : goal === 'lower' ? 'Lower body / glutes' : 'Balanced'],['Progress tracking', weightTrackingEnabled ? `Weigh-ins · ${weightGoal}` : 'Weigh-ins hidden']].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="eyebrow text-stone-600">{label}</p><p className="mt-2 text-sm font-semibold text-stone-200">{value}</p></div>)}
              </div>
              <p className="mt-5 text-xs leading-5 text-stone-500">Only after you build the program will Train open. These choices remain editable later without deleting workout history.</p>
            </>}
          </div>

          {error && <p className="motion-notice mt-5 text-sm text-red-300" role="alert">{error}</p>}
          <div className="mt-8 flex gap-2">
            {step > 1 && <Button type="button" variant="outline" onClick={() => { setError(""); setStep((current) => current - 1); }} disabled={busy} className="h-13 min-w-28 rounded-xl border-white/10 bg-white/[0.035] text-stone-300">Back</Button>}
            <Button type="button" onClick={() => step === 5 ? void submit() : continueSetup()} disabled={busy} className="h-13 flex-1 rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">{busy ? "Saving…" : step === 5 ? "Build my program" : "Continue"}<ArrowUpRight className="size-4" /></Button>
          </div>
          <p className="mt-4 text-center text-[11px] text-stone-600">Progress is saved on this device after every step.</p>
        </section>
      </div>
    </main>
  );
}

function ConsentUpdate({ onAccept }: { onAccept: () => Promise<boolean> }) {
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const accept = async () => {
    if (!adultConfirmed || !safetyAccepted) {
      setError("Confirm both required statements to continue.");
      return;
    }
    setBusy(true);
    setError("");
    const saved = await onAccept();
    if (!saved) setError("Your confirmation could not be saved. Keep this page open and try again.");
    setBusy(false);
  };
  return (
    <main id="main-content" className="onboarding-shell grid min-h-dvh place-items-center bg-[#0b0d0c] px-5 py-8 text-stone-100">
      <section className="motion-panel w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 sm:p-8">
        <BrandLockup />
        <p className="eyebrow mt-10 text-amber-300">Terms &amp; safety update</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em]">Review before continuing.</h1>
        <p className="mt-3 text-sm leading-6 text-stone-400">Your training history is unchanged. RepArc records this confirmation because its program and safety terms were updated.</p>
        <label className="mt-7 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-stone-300"><input type="checkbox" checked={adultConfirmed} onChange={(event) => setAdultConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-amber-300" /><span>I confirm that I am 18 or older <RequiredMark />.</span></label>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-5 text-stone-300"><input type="checkbox" checked={safetyAccepted} onChange={(event) => setSafetyAccepted(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-amber-300" /><span>I understand RepArc provides general fitness guidance—not medical care, rehabilitation, or pregnancy/postpartum advice <RequiredMark />.</span></label>
        <p className="mt-4 text-xs leading-5 text-stone-500">Read the <a href="/terms" target="_blank" rel="noreferrer" className="text-amber-300 underline underline-offset-4">Terms &amp; safety notice</a> and <a href="/privacy" target="_blank" rel="noreferrer" className="text-amber-300 underline underline-offset-4">Privacy notice</a>.</p>
        {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}
        <Button type="button" onClick={() => void accept()} disabled={busy} className="mt-6 h-13 w-full rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">{busy ? "Saving…" : "Accept and continue"}<ArrowUpRight className="size-4" /></Button>
      </section>
    </main>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-8 w-24" aria-hidden="true" />;
  const width = 100;
  const height = 32;
  const padding = 3;
  const minimum = Math.min(...points);
  const maximum = Math.max(...points);
  const span = maximum - minimum || 1;
  const coordinates = points.map((point, index) => ({
    x: padding + (index / (points.length - 1)) * (width - padding * 2),
    y: height - padding - ((point - minimum) / span) * (height - padding * 2),
  }));
  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const last = coordinates.at(-1)!;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-24" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={polyline} fill="none" stroke="#f7c66b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={last.x} cy={last.y} r="2.75" fill="#f7c66b" />
    </svg>
  );
}

const weekKey = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week = 1 + Math.round(((target.valueOf() - firstThursday.valueOf()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

type HistoryRange = "day" | "week" | "month" | "year";

const dateOnly = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const bucketBounds = (range: HistoryRange, key: string) => {
  if (range === "day") return { start: key, end: key };
  if (range === "month") {
    const [year, month] = key.split("-").map(Number);
    return { start: `${key}-01`, end: dateOnly(new Date(year, month, 0, 12)) };
  }
  if (range === "year") return { start: `${key}-01-01`, end: `${key}-12-31` };
  const [yearText, weekText] = key.split("-W");
  const year = Number(yearText);
  const week = Number(weekText);
  const januaryFourth = new Date(year, 0, 4, 12);
  const monday = new Date(januaryFourth);
  monday.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7) + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: dateOnly(monday), end: dateOnly(sunday) };
};

function ProgressView({
  data,
  onUpdate,
  onEditSession,
}: {
  data: TrainingData;
  onUpdate: (data: TrainingData, message?: string) => Promise<boolean>;
  onEditSession: (session: Session) => void;
}) {
  const [range, setRange] = useState<HistoryRange>("day");
  const [selectedBuckets, setSelectedBuckets] = useState<Partial<Record<HistoryRange, string>>>({});
  const [weighDate, setWeighDate] = useState(today);
  const [weighValue, setWeighValue] = useState("");
  const [message, setMessage] = useState("");
  const [openedAt] = useState(() => Date.now());
  const profile = data.profile!;
  const sessions = useMemo(() => activeSessions(data), [data]);
  const deletedSessions = useMemo(() => data.sessions.filter((session) => session.deletedAt).sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "")), [data.sessions]);
  const weighIns = useMemo(() => activeWeighIns(data), [data]);
  const trend = useMemo(() => weightTrend(data, profile.unit), [data, profile.unit]);
  const sortedSessions = useMemo(
    () => [...sessions].sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt)),
    [sessions],
  );
  const totalSets = sessions.reduce(
    (sum, session) => sum + Object.entries(session.entries).reduce(
      (entrySum, [key, entries]) => entrySum + entries.filter((entry) => isFilledSet(entry, storedExercise(session, key))).length,
      0,
    ),
    0,
  );
  const thirtyDaysAgo = openedAt - 30 * 86_400_000;
  const recentSessions = sessions.filter((session) => Date.parse(`${session.date}T00:00:00`) >= thirtyDaysAgo).length;
  const activeWeeks = new Set(sessions.map((session) => weekKey(session.date))).size;

  const series = useMemo(() => {
    const byExercise: Record<string, Array<{ date: string; value: number }>> = {};
    [...sessions]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .forEach((session) => {
        Object.entries(session.entries).forEach(([key, entries]) => {
          const exercise = storedExercise(session, key);
          const best = entries.reduce((maximum, entry) => {
            if (!isFilledSet(entry, exercise)) return maximum;
            const reps = numeric(entry.r);
            if (reps < 4 || reps > 10 || !supportsEstimatedMax(exercise)) return maximum;
            const external = convertWeight(numeric(entry.w), session.unit, profile.unit);
            const bodyweight = bodyweightForSession(data, session, profile.unit);
            const load = exercise ? effectiveExerciseLoad(exercise, external, bodyweight) : external;
            return Math.max(maximum, estimatedOneRepMax(load, reps));
          }, 0);
          if (!best) return;
          if (!byExercise[key]) byExercise[key] = [];
          byExercise[key].push({ date: session.date, value: best });
        });
      });
    return byExercise;
  }, [data, sessions, profile.unit]);

  const addWeighIn = async () => {
    const weight = Number(weighValue);
    const maximum = profile.unit === "kg" ? 300 : 660;
    if (!weighDate || !weight || weight < 25 || weight > maximum) {
      setMessage(`Enter a date and a weight between 25 and ${maximum} ${profile.unit}.`);
      return;
    }
    const now = new Date().toISOString();
    const existing = data.weighIns.find((entry) => entry.date === weighDate && !entry.deletedAt);
    const entry = {
      id: existing?.id ?? globalThis.crypto?.randomUUID?.() ?? `weight-${weighDate}-${now}`,
      date: weighDate,
      weight,
      unit: profile.unit,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const next = {
      ...data,
      weighIns: existing ? data.weighIns.map((item) => item.id === existing.id ? entry : item) : [...data.weighIns, entry],
      profile: { ...profile, bodyweight: weight },
      updatedAt: now,
    };
    const saved = await onUpdate(next, existing ? "Weigh-in updated" : "Weigh-in saved");
    setMessage(saved ? "Weigh-in saved" : "The weigh-in could not be saved.");
    if (saved) setWeighValue("");
  };

  const deleteWeighIn = async (id: string) => {
    const now = new Date().toISOString();
    await onUpdate({ ...data, weighIns: data.weighIns.map((entry) => entry.id === id ? { ...entry, deletedAt: now, updatedAt: now } : entry), updatedAt: now }, "Weigh-in removed");
  };

  const deleteSession = async (session: Session) => {
    if (!window.confirm(`Remove the ${prettyDate(session.date)} session? It stays recoverable in the audit history.`)) return;
    const now = new Date().toISOString();
    const changed: TrainingData = {
      ...data,
      sessions: data.sessions.map((item) => item.id === session.id ? { ...item, deletedAt: now, updatedAt: now, revision: item.revision + 1 } : item),
      sessionRevisions: [...data.sessionRevisions, { id: globalThis.crypto?.randomUUID?.() ?? `revision-${now}`, sessionId: session.id, action: "deleted", at: now, note: "Removed from Progress", previous: session }],
      updatedAt: now,
    };
    await onUpdate(recalculatePhase2Progression(changed), "Session removed and progression recalculated");
  };

  const restoreSession = async (session: Session) => {
    const now = new Date().toISOString();
    const changed: TrainingData = {
      ...data,
      sessions: data.sessions.map((item) => item.id === session.id ? { ...item, deletedAt: undefined, updatedAt: now, revision: item.revision + 1 } : item),
      sessionRevisions: [...data.sessionRevisions, { id: globalThis.crypto?.randomUUID?.() ?? `revision-${now}`, sessionId: session.id, action: "restored", at: now, note: "Restored from Progress", previous: session }],
      updatedAt: now,
    };
    await onUpdate(recalculatePhase2Progression(changed), "Session restored and progression recalculated");
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof sortedSessions>();
    sortedSessions.forEach((session) => {
      const key = range === "day"
        ? session.date
        : range === "week"
          ? weekKey(session.date)
          : range === "month"
            ? session.date.slice(0, 7)
            : session.date.slice(0, 4);
      groups.set(key, [...(groups.get(key) ?? []), session]);
    });
    return [...groups.entries()];
  }, [range, sortedSessions]);
  const currentBucketKey = range === "day"
    ? today()
    : range === "week"
      ? weekKey(today())
      : range === "month"
        ? today().slice(0, 7)
        : today().slice(0, 4);
  const reportGroups = useMemo(() => {
    if (range === "day" || grouped.some(([key]) => key === currentBucketKey)) return grouped;
    return [[currentBucketKey, [] as Session[]], ...grouped] as Array<[string, Session[]]>;
  }, [currentBucketKey, grouped, range]);
  const selectedBucketKey = selectedBuckets[range] ?? reportGroups[0]?.[0] ?? currentBucketKey;
  const selectedSessions = range === "day"
    ? sortedSessions.filter((session) => session.date === selectedBucketKey)
    : reportGroups.find(([key]) => key === selectedBucketKey)?.[1] ?? [];
  const visibleGrouped: Array<[string, Session[]]> = [[selectedBucketKey, selectedSessions]];

  const selectBucket = (key: string) => setSelectedBuckets((current) => ({ ...current, [range]: key }));
  const shiftBucket = (direction: -1 | 1) => {
    if (range === "day") {
      const date = new Date(`${selectedBucketKey}T12:00:00`);
      date.setDate(date.getDate() + direction);
      const key = dateOnly(date);
      if (key <= today()) selectBucket(key);
      return;
    }
    if (range === "week") {
      const bounds = bucketBounds("week", selectedBucketKey);
      const date = new Date(`${bounds.start}T12:00:00`);
      date.setDate(date.getDate() + direction * 7);
      const key = weekKey(dateOnly(date));
      if (key <= currentBucketKey) selectBucket(key);
      return;
    }
    if (range === "month") {
      const [year, month] = selectedBucketKey.split("-").map(Number);
      const date = new Date(year, month - 1 + direction, 1, 12);
      const key = dateOnly(date).slice(0, 7);
      if (key <= currentBucketKey) selectBucket(key);
      return;
    }
    const key = String(Number(selectedBucketKey) + direction);
    if (key <= currentBucketKey) selectBucket(key);
  };

  const selectedWeekDates = useMemo(() => {
    if (range !== "day") return [];
    const selected = new Date(`${selectedBucketKey}T12:00:00`);
    const monday = new Date(selected);
    monday.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return dateOnly(date);
    });
  }, [range, selectedBucketKey]);

  const dailyStatus = (date: string) => {
    const absence = data.absences.find((record) => record.missedDates.includes(date));
    if (absence?.reason === "soreness" && absence.resolution === "skip") return "recovery" as const;
    if (absence?.resolution === "trained-elsewhere") return "external" as const;
    if (absence?.resolution === "skip") return "skipped" as const;
    if (absence?.resolution === "pause") return "paused" as const;
    const report = buildDailyReport(data, date);
    return report.status;
  };
  const quickPeriodKeys = reportGroups.slice(0, 4).map(([key]) => key);
  const canMoveNewer = selectedBucketKey < currentBucketKey;

  const bucketLabel = (key: string) => {
    if (range === "day") return prettyDate(key, { weekday: "short", day: "numeric", month: "long" });
    if (range === "week") return key.replace("-W", " · Week ");
    if (range === "month") {
      const [year, month] = key.split("-").map(Number);
      return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    }
    return key;
  };

  return (
    <section className="motion-page mx-auto max-w-7xl px-4 py-5 sm:px-7 lg:py-8" role="tabpanel" aria-label="Progress history">
      <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-8">
        <aside className="lg:sticky lg:top-36 lg:self-start">
          <p className="eyebrow text-amber-300">Performance archive</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">Your progress</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">Every session becomes a clearer next target. Trends use the unit selected in Setup.</p>

          <div className="motion-stagger mt-6 grid grid-cols-3 gap-2 lg:grid-cols-1">
            {[
              { label: "Sessions", value: sessions.length },
              { label: "Working sets", value: totalSets },
              { label: "Active weeks", value: activeWeeks },
            ].map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 lg:p-4">
                <p className="font-mono text-xl font-semibold text-stone-100 lg:text-3xl">{metric.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-600">{metric.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-stone-600">{recentSessions} session{recentSessions === 1 ? "" : "s"} in the last 30 days</p>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-stone-500">Timeline</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Strength by period</h2>
            </div>
            <Tabs value={range} onValueChange={(value) => setRange(value as HistoryRange)}>
              <TabsList className="grid h-10 w-full grid-cols-4 gap-1 rounded-xl bg-transparent p-0 sm:w-72">
                {(["day", "week", "month", "year"] as HistoryRange[]).map((value) => (
                  <TabsTrigger key={value} value={value} className="rounded-lg text-[11px] capitalize text-stone-500 data-[state=active]:bg-amber-300 data-[state=active]:text-[#0b0d0c]">
                    {value}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-3 sm:p-4" aria-label="Choose a report period">
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="ghost" size="icon" onClick={() => shiftBucket(-1)} aria-label={`Previous ${range}`} className="size-10 shrink-0 rounded-xl text-stone-400 hover:bg-white/10 hover:text-white"><ChevronLeft className="size-4" /></Button>
              <div className="min-w-0 text-center"><p className="eyebrow text-stone-600">Selected {range}</p><p className="mt-1 truncate text-sm font-semibold text-stone-200">{bucketLabel(selectedBucketKey)}</p></div>
              <Button type="button" variant="ghost" size="icon" onClick={() => shiftBucket(1)} disabled={!canMoveNewer} aria-label={`Next ${range}`} className="size-10 shrink-0 rounded-xl text-stone-400 hover:bg-white/10 hover:text-white disabled:opacity-25"><ChevronRight className="size-4" /></Button>
            </div>

            {range === "day" ? (
              <>
                <div className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Selected week">
                  {selectedWeekDates.map((date) => {
                    const status = dailyStatus(date);
                    const selected = date === selectedBucketKey;
                    const future = date > today();
                    const statusClass = status === "completed"
                      ? "bg-emerald-300"
                      : status === "adjusted"
                        ? "bg-amber-300"
                        : status === "partial" || status === "skipped"
                          ? "bg-red-300"
                          : status === "external" || status === "recovery"
                            ? "bg-sky-300"
                            : status === "paused"
                              ? "bg-stone-400"
                              : "bg-stone-700";
                    return <button key={date} type="button" disabled={future} aria-current={selected ? "date" : undefined} onClick={() => selectBucket(date)} className={`min-h-16 rounded-xl border px-1 py-2 text-center transition-colors ${selected ? "border-amber-300 bg-amber-300/10 text-amber-200" : "border-white/[0.07] bg-black/15 text-stone-500 hover:border-white/20 hover:text-stone-200"} disabled:opacity-25`}><span className="block text-[9px] font-bold uppercase tracking-wider">{prettyDate(date, { weekday: "short" })}</span><span className="mt-1 block font-mono text-sm font-semibold">{Number(date.slice(-2))}</span><span className={`mx-auto mt-1 block size-1.5 rounded-full ${statusClass}`} aria-hidden="true" /><span className="sr-only">{status}</span></button>;
                  })}
                </div>
                <label className="mt-3 flex min-h-10 items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 text-xs text-stone-500"><span className="flex items-center gap-2"><CalendarDays className="size-3.5" />Jump to date</span><input type="date" value={selectedBucketKey} max={today()} onChange={(event) => event.target.value && selectBucket(event.target.value)} className="max-w-36 bg-transparent text-right font-mono text-xs text-stone-300 outline-none" /></label>
              </>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`Recent ${range} reports`}>
                {quickPeriodKeys.map((key) => <button key={key} type="button" aria-pressed={selectedBucketKey === key} onClick={() => selectBucket(key)} className={`min-h-10 rounded-xl border px-2 py-2 text-[10px] ${selectedBucketKey === key ? "border-amber-300 bg-amber-300 font-bold text-[#0b0d0c]" : "border-white/10 bg-black/15 text-stone-400 hover:border-white/20 hover:text-white"}`}>{bucketLabel(key)}</button>)}
              </div>
            )}
          </div>

          {profile.weightTrackingEnabled && (
            <article className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#121512] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-amber-300">Bodyweight trend</p>
                  <h2 className="mt-2 text-2xl font-semibold">{trend.latestAverage ? `${trend.latestAverage.toFixed(1)} ${profile.unit}` : "Start your baseline"}</h2>
                  <p className="mt-1 text-xs text-stone-500">7-day average · goal: {profile.weightGoal}</p>
                </div>
                <Sparkline points={trend.entries.slice(-14).map((entry) => entry.weight)} />
              </div>
              {trend.recentCount >= 3 && trend.previousAverage > 0 ? (
                <p className={`mt-3 text-xs ${Math.abs(trend.weeklyChangePercent) < 0.1 ? "text-stone-400" : trend.weeklyChangePercent > 0 ? "text-amber-300" : "text-sky-300"}`}>
                  {trend.weeklyChangePercent > 0 ? "+" : ""}{trend.weeklyChangePercent.toFixed(2)}% versus the prior 7 days. Treat this as a trend, not a daily verdict.
                </p>
              ) : <p className="mt-3 text-xs text-stone-500">Log at least three recent measurements to show a trend. Daily fluctuations are normal.</p>}
              <details className="mt-4 border-t border-white/10 pt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-stone-300">Log or review weigh-ins<ChevronDown className="size-4 text-stone-500" /></summary>
                <div className="mt-4 grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
                  <Input type="date" aria-label="Weigh-in date" value={weighDate} max={today()} onChange={(event) => setWeighDate(event.target.value)} className="h-11 rounded-xl border-white/10 bg-white/[0.035] text-white" />
                  <Input inputMode="decimal" aria-label={`Bodyweight in ${profile.unit}`} value={weighValue} onChange={(event) => /^\d*\.?\d*$/.test(event.target.value) && setWeighValue(event.target.value)} placeholder={`Weight (${profile.unit})`} className="h-11 rounded-xl border-white/10 bg-white/[0.035] font-mono text-white" />
                  <Button onClick={() => void addWeighIn()} className="h-11 rounded-xl bg-amber-300 px-6 font-bold text-[#0b0d0c] hover:bg-amber-200">Log</Button>
                </div>
                {!!weighIns.length && <div className="mt-4 overflow-hidden rounded-xl border border-white/[0.08]" aria-label="Recent weigh-ins"><p className="border-b border-white/[0.08] px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-stone-600">Recent weigh-ins</p>{[...weighIns].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5).map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-2 first:border-t-0"><span className="text-xs text-stone-500">{prettyDate(entry.date, { month: "short", day: "numeric", year: "numeric" })}</span><div className="flex items-center gap-2"><strong className="font-mono text-xs text-stone-300">{convertWeight(entry.weight, entry.unit, profile.unit).toFixed(1)} {profile.unit}</strong><button type="button" onClick={() => void deleteWeighIn(entry.id)} aria-label={`Remove weigh-in from ${entry.date}`} className="grid min-h-8 min-w-8 place-items-center rounded-lg text-stone-500 hover:bg-red-300/10 hover:text-red-300"><X className="size-3.5" /></button></div></div>)}</div>}
                {message && <p className="mt-3 text-xs text-amber-300" role="status">{message}</p>}
              </details>
            </article>
          )}

          {!sessions.length ? (
            <div className="mt-5 grid min-h-[26rem] place-items-center rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] px-6 text-center">
              <div>
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/[0.06] text-stone-400"><BarChart3 className="size-6" /></div>
                <h3 className="mt-5 text-xl font-semibold">Your first trend starts today</h3>
                <p className="mt-2 text-sm text-stone-500">Save a workout and its loads will appear here.</p>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {visibleGrouped.map(([key, sessions]) => {
                const keys = [...new Set(sessions.flatMap((session) => Object.keys(session.entries)))];
                const dailyReport = range === "day" ? buildDailyReport(data, key) : null;
                const periodReports = range === "day"
                  ? []
                  : [...new Set(sessions.map((session) => session.date))].map((date) => buildDailyReport(data, date));
                const completedSets = periodReports.reduce((sum, report) => sum + report.completedSets, 0);
                const plannedSets = periodReports.reduce((sum, report) => sum + report.plannedSets, 0);
                const completionPercent = plannedSets ? Math.min(100, Math.round((completedSets / plannedSets) * 100)) : sessions.length ? 100 : 0;
                const measuredDurations = sessions.flatMap((session) => typeof session.durationSeconds === "number" ? [session.durationSeconds] : []);
                const totalDurationSeconds = measuredDurations.reduce((sum, duration) => sum + duration, 0);
                const effortRatings = sessions.flatMap((session) => typeof session.sessionRpe === "number" ? [session.sessionRpe] : []);
                const averageEffort = effortRatings.length ? effortRatings.reduce((sum, effort) => sum + effort, 0) / effortRatings.length : null;
                const loadedVolume = periodReports.reduce((sum, report) => sum + report.loadedVolume, 0);
                const isCurrentPeriod = key === currentBucketKey;
                const bounds = bucketBounds(range, key);
                const scheduleAdherence = range === "day" ? null : buildScheduleAdherence(data, bounds.start, bounds.end, today());
                const sets = sessions.reduce((sum, session) => sum + Object.entries(session.entries).reduce(
                  (inner, [exerciseKeyValue, entries]) => inner + entries.filter((entry) => isFilledSet(entry, storedExercise(session, exerciseKeyValue))).length,
                  0,
                ), 0);
                return (
                  <article key={key} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#121512]">
                    <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <h3 className="truncate font-semibold">{bucketLabel(key)}</h3>
                        {range !== "day" && <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${isCurrentPeriod ? "bg-amber-300/10 text-amber-300" : "bg-emerald-300/10 text-emerald-300"}`}>{isCurrentPeriod ? "In progress" : "Final report"}</span>}
                      </div>
                      {!!sessions.length && <span className="shrink-0 font-mono text-[10px] text-stone-600">{sessions.length} session{sessions.length === 1 ? "" : "s"} · {sets} sets</span>}
                    </header>
                    {dailyReport && (
                      <section className="border-b border-white/10 bg-white/[0.02] px-4 py-5 sm:px-5" aria-label={`Daily report for ${bucketLabel(key)}`}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="max-w-2xl">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300"><ClipboardCheck className="size-3.5" />{dailyReport.label}</span>
                            <h4 className="mt-3 text-lg font-semibold">{dailyReport.headline}</h4>
                            <p className="mt-1 text-xs leading-5 text-stone-500">{dailyReport.summary}</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] uppercase text-stone-500">{dailyReport.confidence} confidence</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            ["Completion", `${dailyReport.completionPercent}%`],
                            ["Avg RIR", dailyReport.averageRir === null ? "Not logged" : dailyReport.averageRir.toFixed(1)],
                            ["Session effort", dailyReport.averageSessionRpe === null ? "Not logged" : `${dailyReport.averageSessionRpe.toFixed(1)} / 10`],
                            ["Duration", dailyReport.totalDurationSeconds === null ? "Not measured" : dailyReport.totalDurationSeconds < 60 ? "Under 1 min" : `${Math.round(dailyReport.totalDurationSeconds / 60)} min`],
                          ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-black/15 p-3"><p className="font-mono text-sm font-semibold text-stone-200">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-stone-600">{label}</p></div>)}
                        </div>
                        <details className="mt-3 rounded-xl border border-white/[0.07] bg-black/10 p-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-stone-300">Analysis and next-session guidance<ChevronDown className="size-4 text-stone-500" /></summary>
                          <div className="mt-3 grid grid-cols-3 gap-2"><div><p className="font-mono text-sm text-stone-200">{dailyReport.totalReps}</p><p className="text-[9px] uppercase text-stone-600">Total reps</p></div><div><p className="font-mono text-sm text-stone-200">{Math.round(dailyReport.loadedVolume).toLocaleString()} {profile.unit}-reps</p><p className="text-[9px] uppercase text-stone-600">External volume</p></div><div><p className="font-mono text-sm text-stone-200">{dailyReport.rirCoveragePercent}%</p><p className="text-[9px] uppercase text-stone-600">RIR coverage</p></div></div>
                          {(dailyReport.warmupMinutes > 0 || dailyReport.postCardioMinutes > 0) && <p className="mt-3 text-[10px] text-stone-600">Conditioning logged: {dailyReport.warmupMinutes} min warm-up · {dailyReport.postCardioMinutes} min post-lift. These minutes are descriptive and do not change load progression.</p>}
                          {!!dailyReport.exercises.length && <div className="mt-3 space-y-2">{dailyReport.exercises.map((exercise) => exercise.recommendation && (
                            <div key={exercise.key} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">{exercise.name}</p><span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${exercise.recommendation.action === "increase" ? "bg-emerald-300/10 text-emerald-300" : exercise.recommendation.action === "decrease" || exercise.recommendation.action === "stop" ? "bg-red-300/10 text-red-300" : "bg-white/[0.07] text-stone-400"}`}>{exercise.recommendation.action}{exercise.recommendation.nextLoad !== null ? ` · ${exercise.recommendation.nextLoad} ${profile.unit}` : ""}</span></div>
                              <p className="mt-1 text-[11px] leading-4 text-stone-500">{exercise.recommendation.reason}</p>
                            </div>
                          ))}</div>}
                          <p className="mt-3 text-[10px] leading-4 text-stone-600">Descriptive only—not a readiness score or medical assessment. Missing sets or RIR reduce confidence.</p>
                        </details>
                      </section>
                    )}
                    {!dailyReport && !sessions.length && (
                      <div className="px-4 py-6 text-center sm:px-5">
                        <p className="text-sm font-medium text-stone-300">No workouts logged this {range}.</p>
                        <p className="mt-1 text-xs text-stone-600">Your report will appear here after the first saved session.</p>
                      </div>
                    )}
                    {!dailyReport && !!sessions.length && <section className="px-4 py-4 sm:px-5" aria-label={`${bucketLabel(key)} report summary`}>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ["Workout completion", `${completionPercent}%`],
                          ["Schedule fulfillment", !scheduleAdherence?.available ? "Not available" : scheduleAdherence.adherencePercent === null ? "No sessions due" : `${scheduleAdherence.completedSessions}/${scheduleAdherence.expectedSessions} · ${scheduleAdherence.adherencePercent}%`],
                          ["Duration", measuredDurations.length ? totalDurationSeconds < 60 ? "Under 1 min" : `${Math.round(totalDurationSeconds / 60)} min` : "Not measured"],
                          ["Avg effort", averageEffort === null ? "Not logged" : `${averageEffort.toFixed(1)} / 10`],
                        ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-black/15 p-3"><p className="font-mono text-sm font-semibold text-stone-200">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-stone-600">{label}</p></div>)}
                      </div>
                      {scheduleAdherence && (scheduleAdherence.movedSessions > 0 || scheduleAdherence.skippedSessions > 0 || scheduleAdherence.externalSessions > 0 || scheduleAdherence.plannedBreakDays > 0) && <p className="mt-3 text-[10px] leading-4 text-stone-600">Schedule context: {[scheduleAdherence.movedSessions ? `${scheduleAdherence.movedSessions} moved` : "", scheduleAdherence.externalSessions ? `${scheduleAdherence.externalSessions} elsewhere` : "", scheduleAdherence.sorenessRecoverySessions ? `${scheduleAdherence.sorenessRecoverySessions} soreness recovery` : "", scheduleAdherence.skippedSessions - scheduleAdherence.sorenessRecoverySessions ? `${scheduleAdherence.skippedSessions - scheduleAdherence.sorenessRecoverySessions} skipped` : "", scheduleAdherence.plannedBreakDays ? `${scheduleAdherence.plannedBreakDays} planned-break day${scheduleAdherence.plannedBreakDays === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ")}.</p>}
                      <p className="mt-3 text-[10px] text-stone-600">External-load volume: {Math.round(loadedVolume).toLocaleString()} {profile.unit}-reps. Per-side loads count both sides; compare only the same exercise and setup. Bodyweight is excluded.</p>
                    </section>}
                    {!dailyReport && !!sessions.length && !isCurrentPeriod && <details className="border-t border-white/10">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-xs font-semibold text-stone-300 sm:px-5">
                        <span>Exercises &amp; progression</span>
                        <span className="flex items-center gap-2 font-mono text-[9px] font-normal uppercase tracking-wider text-stone-600">{keys.length} movement{keys.length === 1 ? "" : "s"}<ChevronDown className="size-4" /></span>
                      </summary>
                      <div className="border-t border-white/[0.07]">
                      {keys.map((exerciseKeyValue) => {
                        const points = (series[exerciseKeyValue] ?? []).map((point) => point.value).slice(-12);
                        const first = points[0] ?? 0;
                        const latest = points.at(-1) ?? 0;
                        const delta = latest - first;
                        const deltaPercent = first > 0 ? (delta / first) * 100 : 0;
                        return (
                          <div key={exerciseKeyValue} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3 border-t border-white/[0.07] px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_6rem_4.5rem] sm:px-5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{exerciseName(exerciseKeyValue)}</p>
                              <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-stone-600">Estimated max trend</p>
                            </div>
                            <div className="hidden sm:block"><Sparkline points={points} /></div>
                            <span className={`text-right font-mono text-[11px] ${deltaPercent >= 5 ? "text-amber-300" : deltaPercent <= -5 ? "text-red-300" : "text-stone-600"}`}>
                              {deltaPercent >= 5 ? "+" : ""}{Math.abs(deltaPercent) < 5 ? "—" : `${delta.toFixed(1)} ${profile.unit}`}
                            </span>
                          </div>
                        );
                      })}
                      </div>
                      <footer className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
                      {sessions.map((session) => (
                        <div key={session.id} className="flex items-center gap-1 rounded-xl bg-white/[0.035] p-1">
                          <span className="px-2 font-mono text-[10px] text-stone-500">{prettyDate(session.date, { month: "short", day: "numeric" })} · {session.dayId}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => onEditSession(session)} aria-label={`Edit session from ${session.date}`} className="size-8 rounded-lg text-stone-400 hover:bg-white/10 hover:text-white"><Pencil className="size-3.5" /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => void deleteSession(session)} aria-label={`Remove session from ${session.date}`} className="size-8 rounded-lg text-stone-500 hover:bg-red-300/10 hover:text-red-300"><Trash2 className="size-3.5" /></Button>
                        </div>
                      ))}
                      </footer>
                    </details>}
                    {dailyReport && <footer className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
                      {sessions.map((session) => (
                        <div key={session.id} className="flex items-center gap-1 rounded-xl bg-white/[0.035] p-1">
                          <span className="px-2 font-mono text-[10px] text-stone-500">{prettyDate(session.date, { month: "short", day: "numeric" })} · {session.dayId}</span>
                          <Button type="button" variant="ghost" size="icon" onClick={() => onEditSession(session)} aria-label={`Edit session from ${session.date}`} className="size-8 rounded-lg text-stone-400 hover:bg-white/10 hover:text-white"><Pencil className="size-3.5" /></Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => void deleteSession(session)} aria-label={`Remove session from ${session.date}`} className="size-8 rounded-lg text-stone-500 hover:bg-red-300/10 hover:text-red-300"><Trash2 className="size-3.5" /></Button>
                        </div>
                      ))}
                    </footer>}
                  </article>
                );
              })}
            </div>
          )}

          {!!deletedSessions.length && <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4"><summary className="cursor-pointer text-xs font-semibold text-stone-400">Recently removed sessions ({deletedSessions.length})</summary><div className="mt-3 space-y-2">{deletedSessions.slice(0, 10).map((session) => <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2"><span className="text-xs text-stone-500">{prettyDate(session.date)} · {session.dayId}</span><Button type="button" variant="ghost" onClick={() => void restoreSession(session)} className="h-8 rounded-lg text-xs text-amber-300 hover:bg-white/10 hover:text-amber-200"><RefreshCw className="size-3.5" />Restore</Button></div>)}</div></details>}
          <p className="mt-4 text-[11px] leading-5 text-stone-600">Estimated performance max is shown only for comparable loaded movements using 4–10 reps. It is an exercise-specific trend—not a true 1RM or a recommendation to attempt one. Lines show the latest 12 entries.</p>
        </div>
      </div>
    </section>
  );
}

const csvCell = (value: string | number) => {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};

function downloadText(filename: string, value: string, type: string) {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function SettingsView({
  account,
  name,
  data,
  pwa,
  onUpdate,
  onRestore,
  onSignOut,
  onDeleteAccount,
  onRename,
  restAlertLevel,
  alertPermission,
  wakeLockState,
  isStandalone,
  onRestAlertLevelChange,
  onEnableRestAlerts,
  onTestRestAlert,
}: {
  account: Account;
  name: string;
  data: TrainingData;
  pwa: PwaLifecycle;
  onUpdate: (data: TrainingData, message?: string) => Promise<boolean>;
  onRestore: (data: TrainingData, mode: RestoreMode) => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onRename: (name: string) => Promise<boolean>;
  restAlertLevel: RestAlertLevel;
  alertPermission: AlertPermission;
  wakeLockState: WakeLockState;
  isStandalone: boolean;
  onRestAlertLevelChange: (level: RestAlertLevel) => void;
  onEnableRestAlerts: () => Promise<void>;
  onTestRestAlert: () => Promise<void>;
}) {
  const { theme, setTheme } = useTheme();
  const profile = data.profile!;
  const [bodyweight, setBodyweight] = useState(String(profile.bodyweight));
  const [nameDraft, setNameDraft] = useState(name);
  const [message, setMessage] = useState("");
  const [showPhaseReview, setShowPhaseReview] = useState(false);
  const [reviewMaxes, setReviewMaxes] = useState<Record<string, string>>({});
  const [draftWeekdays, setDraftWeekdays] = useState(data.program.preferredWeekdays);
  const [settingsCategory, setSettingsCategory] = useState<"overview" | "training" | "profile" | "experience" | "data">("overview");
  const [trainingSection, setTrainingSection] = useState<"program" | "schedule" | "personalization">("program");
  const [profileSection, setProfileSection] = useState<"identity" | "measurements" | "experience" | null>(null);
  const track = profile.programTrack;
  const phaseTwoExercises = phaseTwoProgrammedExercises(track);
  const phaseTwoMaxesComplete = phaseTwoExercises.every((exercise) => Number(reviewMaxes[exercise.id]) > 0);
  const confidence = phase2DataConfidence(data, track);
  const storageBytes = trainingDataBytes(data);
  const storagePercent = Math.min(100, Math.round((storageBytes / 900_000) * 100));

  const saveDisplayName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || !slugify(trimmed) || trimmed.length > 40) {
      setMessage("Enter a training name containing a letter or number, up to 40 characters.");
      return;
    }
    const saved = await onRename(trimmed);
    setMessage(saved ? "Training name updated on this account" : "The training name could not be saved.");
  };

  const updateProfile = async (changes: Partial<typeof profile>, success: string) => {
    if (changes.equipment && changes.equipment !== "full" && data.program.activeId === "phase2") {
      setMessage("Switch to Foundation before changing away from Full gym; Phase 2 training maxes are tied to its programmed lifts.");
      return;
    }
    const now = new Date().toISOString();
    const next = recordPlanChange({ ...data, profile: { ...profile, ...changes }, updatedAt: now }, "profile", now);
    const saved = await onUpdate(next, success);
    setMessage(saved ? success : "The change could not be saved.");
  };

  const changeUnit = async (unit: Unit) => {
    if (unit === profile.unit) return;
    const convertedBodyweight = Math.round(convertWeight(profile.bodyweight, profile.unit, unit) * 10) / 10;
    setBodyweight(String(convertedBodyweight));
    const convertedTrainingMaxes = Object.fromEntries(
      Object.entries(data.program.trainingMaxes).map(([key, value]) => [
        key,
        convertWeight(value, profile.unit, unit),
      ]),
    );
    const convertedLoadProfiles = Object.fromEntries(Object.entries(data.loadProfiles).map(([key, loadProfile]) => [key, {
      ...loadProfile,
      unit,
      values: normalizeLoadValues(loadProfile.values.map((value) => convertWeight(value, loadProfile.unit, unit))),
      updatedAt: new Date().toISOString(),
    }]));
    const now = new Date().toISOString();
    const next = recordPlanChange({
      ...data,
      profile: { ...profile, unit, bodyweight: convertedBodyweight },
      loadProfiles: convertedLoadProfiles,
      program: { ...data.program, trainingMaxes: convertedTrainingMaxes },
      updatedAt: now,
    }, "profile", now);
    const saved = await onUpdate(next, `Display unit changed to ${unit}`);
    setMessage(saved ? `Display unit changed to ${unit}` : "The change could not be saved.");
  };

  const changeProgram = async (activeId: ProgramId) => {
    if (activeId === data.program.activeId) return;
    if (activeId === "phase2" && profile.equipment !== "full") {
      setMessage("Phase 2 currently requires the programmed full-gym lifts so every training max remains exercise-specific. Update Equipment to Full gym or continue Foundation.");
      return;
    }
    if (activeId === "phase2" && !data.program.phase2UnlockedAt) {
      setReviewMaxes(Object.fromEntries(phaseTwoExercises.map((exercise) => {
        const value = data.program.trainingMaxes[exercise.id] || suggestedTrainingMax(data, exercise, profile.unit);
        return [exercise.id, value ? String(roundLoad(value, profile.unit)) : ""];
      })));
      setShowPhaseReview(true);
      return;
    }
    const now = new Date().toISOString();
    const next = recordPlanChange({ ...data, program: { ...data.program, activeId, week: 1 }, updatedAt: now }, "program", now);
    const saved = await onUpdate(next, `${PROGRAMS[activeId].name} selected`);
    setMessage(saved ? `${PROGRAMS[activeId].name} selected` : "The program change could not be saved.");
  };

  const unlockPhaseTwo = async () => {
    if (!phaseTwoMaxesComplete) {
      setMessage("Enter a positive, exercise-specific training max for every programmed lift.");
      return;
    }
    const trainingMaxes = { ...data.program.trainingMaxes };
    phaseTwoExercises.forEach((exercise) => {
      const value = Number(reviewMaxes[exercise.id]);
      if (value > 0) trainingMaxes[exercise.id] = value;
    });
    const now = new Date().toISOString();
    const next = recordPlanChange({
      ...data,
      program: { ...data.program, activeId: "phase2" as const, week: data.program.phase2UnlockedAt ? data.program.week : 1, trainingMaxes, calibrationRequired: true, phase1CompletedAt: data.program.phase1CompletedAt ?? now, phase2UnlockedAt: data.program.phase2UnlockedAt ?? now },
      updatedAt: now,
    }, "program", now);
    const saved = await onUpdate(next, "Phase 2 unlocked — review complete");
    setMessage(saved ? "Phase 2 unlocked. Starting loads can still be edited later." : "The phase change could not be saved.");
    if (saved) setShowPhaseReview(false);
  };

  const changeFrequency = async (frequency: TrainingFrequency) => {
    const defaults: Record<TrainingFrequency, number[]> = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 4, 5, 6] };
    setDraftWeekdays(defaults[frequency]);
    const now = new Date().toISOString();
    await onUpdate(recordPlanChange({ ...data, program: { ...data.program, frequency, preferredWeekdays: defaults[frequency] }, updatedAt: now }, "schedule", now), `${frequency}-day schedule selected`);
  };

  const togglePreferredDay = (weekday: number) => {
    setDraftWeekdays((selected) => selected.includes(weekday) ? selected.filter((day) => day !== weekday) : selected.length < data.program.frequency ? [...selected, weekday].sort() : selected);
  };

  const savePreferredDays = async () => {
    if (draftWeekdays.length !== data.program.frequency) {
      setMessage(`Choose exactly ${data.program.frequency} training days.`);
      return;
    }
    const now = new Date().toISOString();
    await onUpdate(recordPlanChange({ ...data, program: { ...data.program, preferredWeekdays: draftWeekdays }, updatedAt: now }, "schedule", now), "Training days updated");
  };

  const togglePause = async () => {
    const now = new Date().toISOString();
    const paused = data.program.status === "paused";
    await onUpdate(recordPlanChange({
      ...data,
      program: { ...data.program, status: paused ? "active" : "paused", pausedAt: paused ? undefined : now, calibrationRequired: paused ? true : data.program.calibrationRequired },
      updatedAt: now,
    }, paused ? "resume" : "pause", now), paused ? "Program resumed — first session is a calibration session" : "Program paused");
  };

  const changeWeek = async (week: number) => {
    const nextWeek = Math.max(1, Math.min(21, Math.trunc(week)));
    if (nextWeek === data.program.week) return;
    const now = new Date().toISOString();
    const next = recordPlanChange({ ...data, program: { ...data.program, week: nextWeek }, updatedAt: now }, "program", now);
    const saved = await onUpdate(next, `Phase 2 moved to week ${nextWeek}`);
    setMessage(saved ? `Phase 2 moved to week ${nextWeek}` : "The week change could not be saved.");
  };

  const saveBodyweight = async () => {
    const value = Number(bodyweight);
    const maximum = profile.unit === "kg" ? 300 : 660;
    if (!value || value < 25 || value > maximum) {
      setMessage(`Enter a bodyweight between 25 and ${maximum} ${profile.unit}.`);
      return;
    }
    await updateProfile({ bodyweight: value }, "Bodyweight updated");
  };

  const changeGender = async (gender: Gender) => {
    if (gender === profile.gender) return;
    const programTrack = trainingTrack(gender);
    const now = new Date().toISOString();
    const next = recordPlanChange({ ...data, profile: { ...profile, gender, programTrack }, program: { ...data.program, activeId: "phase1" as const, week: 1, status: "active" as const, calibrationRequired: true, phase1CompletedAt: undefined, phase2UnlockedAt: undefined, trainingMaxes: {} }, updatedAt: now }, "profile", now);
    const saved = await onUpdate(next, "Gender and automatic training track updated");
    setMessage(saved ? "Gender updated. The matching Foundation track is now active; history remains available." : "The profile change could not be saved.");
  };

  const exportCsv = () => {
    const rows: Array<Array<string | number>> = [["date", "program", "program_week", "session", "exercise", "set", "weight", "unit", "reps", "rir"]];
    activeSessions(data).forEach((session) => {
      Object.entries(session.entries).forEach(([key, entries]) => {
        entries.forEach((entry, index) => {
          const exercise = storedExercise(session, key);
          if (!isFilledSet(entry, exercise)) return;
          rows.push([session.date, session.programId ?? "legacy", session.programWeek ?? "", session.dayId, exercise?.name ?? exerciseName(key), index + 1, entry.w || 0, session.unit, entry.r, entry.rir]);
        });
      });
    });
    downloadText("training-log.csv", rows.map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
    setMessage("CSV backup downloaded");
  };

  const exportJson = () => {
    downloadTrainingBackup(data);
    setMessage("Full backup downloaded");
  };

  return (
    <section className="motion-page mx-auto max-w-5xl px-4 py-5 sm:px-7 lg:py-8" role="tabpanel" aria-label="Setup and backup">
      <p className="eyebrow text-amber-300">Account & preferences</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.05em]">Setup</h1>
          <p className="mt-2 text-sm text-stone-500">Tune recommendations and keep a portable copy of your work.</p>
        </div>
      </div>

      {settingsCategory !== "overview" && <div className="mt-5 flex items-center justify-between gap-3"><Button type="button" variant="ghost" onClick={() => setSettingsCategory("overview")} className="h-9 rounded-lg px-2 text-xs text-stone-400 hover:bg-white/10 hover:text-white"><ChevronDown className="size-3.5 rotate-90" />Back to Setup</Button><span className="font-mono text-[10px] uppercase tracking-wider text-stone-600">{settingsCategory === "training" ? "Training plan" : settingsCategory === "profile" ? "Profile" : settingsCategory === "experience" ? "App preferences" : "Data & account"}</span></div>}

      {settingsCategory === "overview" && <div className="settings-topic mt-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#121512]">
        {([
          ["training", "Training plan", `${track === "women" ? "Women’s" : "Current"} · ${PROGRAMS[data.program.activeId].name} · ${data.program.frequency} days`, Dumbbell],
          ["profile", "Profile", `${name} · ${profile.bodyweight} ${profile.unit} · ${LEVELS.find((option) => option.id === profile.level)?.label}`, UserRound],
          ["experience", "App preferences", `${theme === "system" ? "System theme" : theme ? `${theme[0].toUpperCase()}${theme.slice(1)} theme` : "Theme"} · ${restAlertLevel} alert`, Monitor],
          ["data", "Data & account", "Updates, backups, feedback and privacy", ShieldAlert],
        ] as const).map(([value, label, summary, Icon], index) => <button key={value} type="button" onClick={() => setSettingsCategory(value)} className={`flex min-h-[4.4rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${index ? "border-t border-white/[0.07]" : ""}`}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-stone-300"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block text-sm text-stone-200">{label}</strong><span className="mt-0.5 block truncate text-[11px] text-stone-500">{summary}</span></span><ChevronDown className="size-4 -rotate-90 text-stone-600" /></button>)}
      </div>}

      {settingsCategory === "training" && <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Training setup sections">{([['program','Program'],['schedule','Schedule'],['personalization','Personalize']] as const).map(([value, label]) => <Button key={value} type="button" role="tab" aria-selected={trainingSection === value} variant="outline" data-selected={trainingSection === value} onClick={() => setTrainingSection(value)} className="selection-button h-10 rounded-xl border-white/10 px-1 text-[11px]">{label}</Button>)}</div>}

      <div key={`${settingsCategory}-${trainingSection}-${profileSection ?? "menu"}`} className="settings-topic mt-4 grid gap-4 md:grid-cols-2">
        {settingsCategory === "training" && trainingSection === "program" && <>
        <article className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-6 md:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow text-stone-600">Training program</p>
              <h2 className="mt-2 text-xl font-semibold">{track === "women" ? "Women’s" : "Current"} · {PROGRAMS[data.program.activeId].name}</h2>
              <p className="mt-2 text-xs leading-5 text-stone-500">{PROGRAMS[data.program.activeId].description}. Existing workout history remains available when you switch.</p>
            </div>
            {data.program.activeId === "phase2" && (
              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
                <Button type="button" variant="ghost" size="icon" disabled={data.program.week <= 1} onClick={() => void changeWeek(data.program.week - 1)} aria-label="Previous program week" className="size-9 rounded-lg text-stone-400 hover:bg-white/10 hover:text-white"><Minus className="size-4" /></Button>
                <div className="min-w-24 text-center"><p className="font-mono text-sm font-bold">Week {data.program.week}</p><p className="mt-0.5 text-[9px] uppercase tracking-wider text-stone-600">Block {Math.ceil(data.program.week / 7)} of 3</p></div>
                <Button type="button" variant="ghost" size="icon" disabled={data.program.week >= 21} onClick={() => void changeWeek(data.program.week + 1)} aria-label="Next program week" className="size-9 rounded-lg text-stone-400 hover:bg-white/10 hover:text-white"><Plus className="size-4" /></Button>
              </div>
            )}
          </div>
          <RadioGroup value={data.program.activeId} onValueChange={(value) => void changeProgram(value as ProgramId)} className="mt-5 grid gap-2 sm:grid-cols-2" aria-label="Training program">
            {(Object.entries(PROGRAMS) as Array<[ProgramId, (typeof PROGRAMS)[ProgramId]]>).map(([id, program]) => (
              <ChoiceRadio key={id} id={`program-${id}`} value={id} label={program.name} />
            ))}
          </RadioGroup>
          {data.program.phase2UnlockedAt && !showPhaseReview && <Button type="button" variant="ghost" onClick={() => { setReviewMaxes(Object.fromEntries(phaseTwoExercises.map((exercise) => [exercise.id, String(roundLoad(data.program.trainingMaxes[exercise.id] || suggestedTrainingMax(data, exercise, profile.unit), profile.unit) || "")] ))); setShowPhaseReview(true); }} className="mt-3 rounded-xl text-xs text-amber-300 hover:bg-white/10 hover:text-amber-200">Review Phase 2 training maxes</Button>}
          {showPhaseReview && (
            <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <LockOpen className="mt-0.5 size-5 shrink-0 text-amber-300" />
                <div><h3 className="font-semibold">Phase 2 transition review</h3><p className="mt-1 text-xs leading-5 text-stone-400">You have usable performance data for {confidence.covered} of {confidence.total} programmed lifts ({confidence.level} confidence). There is no arbitrary time lock: review the starting training maxes and confirm when you are ready.</p></div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {phaseTwoExercises.map((exercise) => <label key={exercise.id} className="rounded-xl bg-black/20 p-3"><span className="text-xs text-stone-400">{exercise.name} <RequiredMark /></span><div className="mt-2 flex items-center gap-2"><Input inputMode="decimal" required aria-required="true" aria-label={`${exercise.name} training max in ${profile.unit}`} value={reviewMaxes[exercise.id] ?? ""} onChange={(event) => /^\d*\.?\d*$/.test(event.target.value) && setReviewMaxes((current) => ({ ...current, [exercise.id]: event.target.value }))} placeholder="Required" className="h-11 border-white/10 bg-white/[0.04] font-mono text-white" /><span className="text-xs text-stone-400">{profile.unit}</span></div></label>)}
              </div>
              <p className="mt-4 text-[11px] leading-5 text-stone-500">Training maxes are exercise-specific. If exact history is unavailable, enter a conservative estimate you could confidently lift; the first Phase 2 session is calibration and cannot change progression.</p>
              <div className="mt-4 flex flex-wrap gap-2"><Button disabled={!phaseTwoMaxesComplete} onClick={() => void unlockPhaseTwo()} className="rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">{data.program.phase2UnlockedAt ? "Save training maxes" : "Confirm and unlock Phase 2"}</Button><Button variant="ghost" onClick={() => setShowPhaseReview(false)} className="rounded-xl text-stone-400 hover:bg-white/10 hover:text-white">Not yet</Button></div>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
            <div><p className="text-sm font-semibold">{data.program.status === "paused" ? "Program paused" : "Need time away?"}</p><p className="mt-1 text-xs text-stone-500">Resuming marks the first workout as calibration; it will not change training maxes.</p></div>
            <Button variant="outline" onClick={() => void togglePause()} className="rounded-xl border-white/10 bg-white/[0.035] text-stone-300 hover:bg-white/10 hover:text-white">{data.program.status === "paused" ? <Play className="size-4" /> : <Pause className="size-4" />}{data.program.status === "paused" ? "Resume" : "Pause"}</Button>
          </div>
        </article>
        </>}

        {settingsCategory === "training" && trainingSection === "schedule" &&
          <article className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-6 md:col-span-2">
            <p className="eyebrow text-stone-600">Flexible weekly schedule</p>
            <h2 className="mt-2 text-xl font-semibold">Keep the program; choose the cadence</h2>
            <p className="mt-2 text-xs leading-5 text-stone-500">The three-, four- and five-day layouts preserve the program’s main movement patterns while distributing work across the week.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">{([3,4,5] as TrainingFrequency[]).map((frequency) => <Button key={frequency} variant="outline" data-selected={data.program.frequency === frequency} onClick={() => void changeFrequency(frequency)} className="selection-button h-11 rounded-xl border-white/10">{frequency} days</Button>)}</div>
            <p className="mt-5 text-xs font-semibold text-stone-300">Preferred days</p>
            <div className="mt-2 grid grid-cols-7 gap-1">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((label, weekday) => <Button key={label} type="button" variant="outline" aria-pressed={draftWeekdays.includes(weekday)} data-selected={draftWeekdays.includes(weekday)} onClick={() => togglePreferredDay(weekday)} className="selection-button h-11 rounded-lg px-1 text-[10px]">{label}</Button>)}</div>
            <div className="mt-3 flex items-center justify-between gap-3"><p className="text-[11px] text-stone-600">{draftWeekdays.length} / {data.program.frequency} selected. You can always open any session manually from Train.</p><Button type="button" onClick={() => void savePreferredDays()} disabled={draftWeekdays.length !== data.program.frequency} className="h-9 rounded-xl bg-amber-300 px-4 text-xs font-bold text-[#0b0d0c] hover:bg-amber-200">Save days</Button></div>
          </article>
        }

        {settingsCategory === "profile" && <div className="grid overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#121512] md:col-span-2">
          {([
            ["identity", "Identity & training track", `${profile.gender === "woman" ? "Woman" : "Man"} · ${profile.programTrack === "women" ? "Women’s" : "Current"} track`],
            ["measurements", "Measurements & goal", `${profile.bodyweight} ${profile.unit} · ${profile.weightGoal}`],
            ["experience", "Training experience", LEVELS.find((option) => option.id === profile.level)?.label ?? "Set experience"],
          ] as const).map(([value, label, summary], index) => <button key={value} type="button" aria-expanded={profileSection === value} onClick={() => setProfileSection((current) => current === value ? null : value)} style={{ order: index * 2 }} className={`flex min-h-[4rem] w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.04] ${index ? "border-t border-white/[0.07]" : ""}`}><span className="min-w-0"><strong className="block text-sm text-stone-200">{label}</strong><span className="mt-0.5 block truncate text-[11px] capitalize text-stone-500">{summary}</span></span><ChevronDown className={`size-4 shrink-0 text-stone-600 transition-transform ${profileSection === value ? "rotate-180" : ""}`} /></button>)}

        {settingsCategory === "profile" && profileSection === "identity" &&
        <article style={{ order: 1 }} className="border-t border-white/10 bg-black/10 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-300 text-[#0b0d0c]"><UserRound className="size-5" /></div>
            <div><p className="eyebrow text-stone-600">Training profile</p><h2 className="mt-1 font-semibold">{name}</h2></div>
          </div>
          <p className="mt-5 text-xs leading-5 text-stone-400">Changing this label does not delete history. One verified account owns one cloud training profile.</p>
          <p className="mt-5 text-xs font-semibold text-stone-300">Profile</p>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Gender">
            {([['man', 'Man', Mars], ['woman', 'Woman', Venus]] as const).map(([value, label, Icon]) => <Button key={value} type="button" role="radio" aria-checked={profile.gender === value} variant="outline" data-selected={profile.gender === value} onClick={() => void changeGender(value)} className="selection-button h-14 rounded-xl border-white/10 text-sm font-semibold"><Icon className="size-5" aria-hidden="true" />{label}</Button>)}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-stone-600">The training track follows this selection automatically: Man uses Current; Woman uses Women’s. Changing it restarts at Foundation while preserving completed history.</p>
          <div className="mt-5 flex gap-2"><Input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} maxLength={40} aria-label="Training name" className="h-11 rounded-xl border-white/10 bg-white/[0.035] text-white" /><Button type="button" onClick={() => void saveDisplayName()} className="h-11 rounded-xl bg-amber-300 px-5 font-bold text-[#0b0d0c] hover:bg-amber-200">Save</Button></div>
        </article>}

        {settingsCategory === "profile" && profileSection === "measurements" && <div style={{ order: 3 }} className="grid gap-3 border-t border-white/10 bg-black/10 p-4 sm:p-5 md:grid-cols-2">
        <article className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-6">
          <p className="eyebrow text-stone-600">Units</p>
          <RadioGroup
            value={profile.unit}
            onValueChange={(value) => void changeUnit(value as Unit)}
            className="mt-4 grid grid-cols-2 gap-2"
            aria-label="Display unit"
          >
            {(["kg", "lb"] as Unit[]).map((unit) => (
              <ChoiceRadio key={unit} id={`settings-unit-${unit}`} value={unit} label={unit.toUpperCase()} />
            ))}
          </RadioGroup>
          <p className="mt-4 text-xs leading-5 text-stone-500">Past sessions retain the unit used when you logged them. Charts convert them correctly to your current display unit.</p>
        </article>

        <article className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-6">
          <p className="eyebrow text-stone-600">Bodyweight</p>
          <div className="mt-4 flex gap-2"><Input inputMode="decimal" aria-label={`Bodyweight in ${profile.unit}`} value={bodyweight} onChange={(event) => /^\d*\.?\d*$/.test(event.target.value) && setBodyweight(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void saveBodyweight()} className="h-11 rounded-xl border-white/10 bg-white/[0.035] font-mono text-white" /><Button onClick={() => void saveBodyweight()} className="h-11 rounded-xl bg-amber-300 px-5 font-bold text-[#0b0d0c] hover:bg-amber-200">Save</Button></div>
          <label className="mt-5 flex items-center justify-between gap-4 text-sm"><span>Track weigh-ins in Progress</span><input type="checkbox" checked={profile.weightTrackingEnabled} onChange={(event) => void updateProfile({ weightTrackingEnabled: event.target.checked }, event.target.checked ? "Weight tracking enabled" : "Weight tracking hidden")} className="size-4 accent-amber-300" /></label>
          <p className="mt-5 text-xs font-semibold text-stone-300">Current goal</p>
          <RadioGroup value={profile.weightGoal} onValueChange={(value) => void updateProfile({ weightGoal: value as WeightGoal }, "Weight goal updated")} className="mt-2 grid grid-cols-3 gap-2" aria-label="Weight goal">{(["cut","maintain","bulk"] as WeightGoal[]).map((goal) => <ChoiceRadio key={goal} id={`goal-${goal}`} value={goal} label={goal[0].toUpperCase() + goal.slice(1)} />)}</RadioGroup>
          <p className="mt-4 text-xs leading-5 text-stone-500">Trend feedback uses rolling averages. The app does not prescribe calories or diagnose health conditions.</p>
        </article>
        </div>}

        {settingsCategory === "profile" && profileSection === "experience" &&
        <article style={{ order: 5 }} className="border-t border-white/10 bg-black/10 p-5 sm:p-6">
          <p className="eyebrow text-stone-600">Time spent lifting</p>
          <RadioGroup
            value={profile.level}
            onValueChange={(value) => void updateProfile({ level: value as Level }, "Training age updated")}
            className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3"
            aria-label="Time spent lifting"
          >
            {LEVELS.map((level) => (
              <ChoiceRadio key={level.id} id={`settings-level-${level.id}`} value={level.id} label={level.label} />
            ))}
          </RadioGroup>
          <p className="mt-4 text-xs leading-5 text-stone-500">Only affects estimates for exercises you have never logged.</p>
        </article>}
        </div>}

        {settingsCategory === "training" && trainingSection === "personalization" &&
        <article className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-6 md:col-span-2">
          <p className="eyebrow text-stone-600">Program personalization</p>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <fieldset>
              <legend className="text-xs font-semibold text-stone-300">Training emphasis</legend>
              <RadioGroup value={profile.goal} onValueChange={(value) => void updateProfile({ goal: value as TrainingGoal }, "Training emphasis updated")} className="mt-2 grid gap-2 sm:grid-cols-2" aria-label="Training emphasis">
                {([['balanced','Balanced'],['upper','Upper body'],['lower','Lower body / glutes']] as const).map(([value, label]) => <ChoiceRadio key={value} id={`settings-emphasis-${value}`} value={value} label={label} />)}
              </RadioGroup>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-semibold text-stone-300">Available equipment</legend>
              <RadioGroup value={profile.equipment} onValueChange={(value) => void updateProfile({ equipment: value as Equipment }, "Equipment profile updated")} className="mt-2 grid gap-2" aria-label="Available equipment">
                {([['full','Full gym'],['limited','Limited gym'],['home','Home']] as const).map(([value, label]) => <ChoiceRadio key={value} id={`settings-equipment-${value}`} value={value} label={label} />)}
              </RadioGroup>
            </fieldset>
          </div>
          <p className="mt-4 text-xs leading-5 text-stone-500">Emphasis adds a small amount of matching accessory work. Equipment selection prioritizes compatible options in each exercise’s swap menu; first-set adjustments still take priority.</p>
        </article>
        }

        {settingsCategory === "experience" && <>
          <article className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-6 md:col-span-2">
            <p className="eyebrow text-amber-300">Appearance</p>
            <h2 className="mt-2 text-xl font-semibold">Use the display that fits your environment</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {([['system','System',Monitor],['light','Light',Sun],['dark','Dark',Moon]] as const).map(([value, label, Icon]) => <Button key={value} type="button" variant="outline" aria-pressed={theme === value} data-selected={theme === value} onClick={() => setTheme(value)} className="selection-button min-h-12 justify-start rounded-xl border-white/10"><Icon className="size-4" />{label}</Button>)}
            </div>
          </article>
          <article className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-6 md:col-span-2">
            <p className="eyebrow text-amber-300">Rest alert</p>
            <h2 className="mt-2 text-xl font-semibold">Choose how strongly RepArc gets your attention</h2>
            <p className="mt-2 text-xs leading-5 text-stone-500">During an active workout RepArc keeps the screen awake where supported. Foreground completion uses a ten-second sound and vibration. Background web alerts remain best effort and may be delayed or silenced by the device.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {([['quiet','Quiet'],['normal','Normal'],['maximum','Maximum']] as const).map(([value, label]) => <Button key={value} type="button" variant="outline" aria-pressed={restAlertLevel === value} data-selected={restAlertLevel === value} onClick={() => onRestAlertLevelChange(value)} className="selection-button min-h-12 justify-start rounded-xl border-white/10"><BellRing className="size-4" />{label}</Button>)}
            </div>
            {restAlertLevel === "maximum" && <p className="mt-3 text-[10px] leading-4 text-amber-200">Maximum uses a sharper, limited alarm pattern. Check your device volume and lower it before testing with headphones.</p>}
            <details className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-stone-300"><span className="flex items-center gap-2"><BellRing className="size-3.5 text-amber-300" />Alarm readiness</span><ChevronDown className="size-4 text-stone-500" /></summary>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["App mode", isStandalone ? "Installed" : "Browser tab", isStandalone],
                  ["Notifications", alertPermission === "granted" ? "Allowed" : alertPermission === "denied" ? "Blocked" : alertPermission === "unsupported" ? "Unavailable" : "Not enabled", alertPermission === "granted"],
                  ["Screen awake", wakeLockState === "unavailable" ? "Unavailable" : wakeLockState === "active" ? "Active now" : "Ready in workout", wakeLockState !== "unavailable"],
                  ["Exact offline alarm", "Native app only", false],
                ].map(([label, value, ready]) => <div key={String(label)} className="rounded-lg border border-white/[0.07] bg-white/[0.025] p-2.5"><p className={`font-mono text-[10px] ${ready ? "text-emerald-300" : "text-stone-500"}`}>{String(value)}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-stone-600">{String(label)}</p></div>)}
              </div>
              <p className="mt-3 text-[10px] leading-4 text-stone-600">For iPhone background notifications, install RepArc with Add to Home Screen. Keep RepArc visible when exact timing matters; the web platform cannot schedule an offline system alarm.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {alertPermission === "default" && <Button type="button" variant="outline" onClick={() => void onEnableRestAlerts()} className="h-9 rounded-lg border-white/10 bg-white/[0.035] px-3 text-[11px] text-stone-300">Enable notifications</Button>}
                <Button type="button" variant="ghost" onClick={() => void onTestRestAlert()} className="h-9 rounded-lg px-3 text-[11px] text-amber-300 hover:bg-white/10 hover:text-amber-200"><Play className="size-3.5" />Run alert test</Button>
              </div>
            </details>
          </article>
        </>}

        {settingsCategory === "data" && <>
        <article className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-6 md:col-span-2">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/[0.07] text-stone-300"><Download className="size-5" /></div>
            <div><p className="eyebrow text-stone-600">Portable backups</p><h2 className="mt-1 font-semibold">Own your training data</h2></div>
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-5 text-stone-500">CSV opens cleanly in Excel or Google Sheets. JSON preserves the complete app structure for a full restore or future migration.</p>
          <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 p-3" aria-label={`Cloud data capacity ${storagePercent}% used`}>
            <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-stone-500">
              <span>Cloud data capacity</span>
              <span className={storagePercent >= 75 ? "text-amber-300" : "text-stone-400"}>{storagePercent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className={`h-full rounded-full ${storagePercent >= 75 ? "bg-amber-300" : "bg-emerald-300"}`} style={{ width: `${storagePercent}%` }} />
            </div>
            <p className="mt-2 text-[10px] leading-4 text-stone-600">{Math.max(1, Math.round(storageBytes / 1024))} KB of the safe 879 KB sync allowance. Export a full backup if this approaches 75%.</p>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={exportCsv} disabled={!data.sessions.length} className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-stone-300 hover:bg-white/10 hover:text-white"><Download className="size-4" />Export spreadsheet</Button>
            <Button variant="outline" onClick={exportJson} className="h-12 rounded-xl border-white/10 bg-white/[0.035] text-stone-300 hover:bg-white/10 hover:text-white"><FileJson className="size-4" />Download full backup</Button>
          </div>
        </article>
        <SettingsTools account={account} data={data} pwa={pwa} onRestore={onRestore} onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} onMessage={setMessage} />
        </>}
      </div>

      {message && <p className={`mt-5 text-center text-xs ${message.includes("could not") || message.startsWith("Enter") ? "text-red-300" : "text-amber-300"}`} role="status">{message}</p>}
    </section>
  );
}

type Suggestion = { value: number | null; tag: "up" | "down" | "hold" | "bodyweight" | "estimate"; reason: string; confidence?: LoadAdjustment["confidence"] };

export function TrainingApp({ account, onSignOut, onDeleteAccount, pwa }: { account: Account; onSignOut: () => Promise<void>; onDeleteAccount: () => Promise<void>; pwa: PwaLifecycle }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [name, setName] = useState("");
  const [data, setData] = useState<TrainingData>(emptyData);
  const [dayId, setDayId] = useState<string | null>(null);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Record<string, SetEntry[]>>>({});
  const [openSwap, setOpenSwap] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>();
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("train");
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [warmup, setWarmup] = useState<ConditioningLog | null>(null);
  const [postCardio, setPostCardio] = useState<ConditioningLog | null>(null);
  const [loadProfileDrafts, setLoadProfileDrafts] = useState<Record<string, string>>({});
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState(today);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimer | null>(null);
  const [restAlertLevel, setRestAlertLevel] = useState<RestAlertLevel>(() => {
    if (typeof window === "undefined") return "normal";
    const stored = window.localStorage.getItem("reparc-rest-alert-level");
    if (stored === "quiet" || stored === "normal" || stored === "maximum") return stored;
    return "maximum";
  });
  const [alertPermission, setAlertPermission] = useState<AlertPermission>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const [wakeLockState, setWakeLockState] = useState<WakeLockState>("unavailable");
  const [isStandalone, setIsStandalone] = useState(false);
  const pendingRestSetsRef = useRef(new Set<string>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const alertedRestEndRef = useRef<number | null>(null);
  const restoredTimerKeyRef = useRef<string | null>(null);
  const restoredSessionStartKeyRef = useRef<string | null>(null);
  const hydratedSessionKeyRef = useRef<string | null>(null);
  const restTimerAnchorRef = useRef<HTMLDivElement | null>(null);
  const syncAttemptRef = useRef(false);

  const selectScheduledDay = (programId: ProgramId, frequency: TrainingFrequency, preferredWeekdays: number[], selectedProfile?: Profile | null, date = today(), selectedData?: TrainingData) => {
    const days = programDays(programId, frequency, selectedProfile?.programTrack ?? trainingTrack(selectedProfile?.gender ?? "man"), selectedProfile?.goal ?? "balanced", selectedProfile?.equipment ?? "full");
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const scheduledIndex = preferredWeekdays.indexOf(weekday);
    const nextUnfinished = selectedData ? nextUnfinishedProgramDay(selectedData) : null;
    const match = nextUnfinished ?? days[scheduledIndex];
    pendingRestSetsRef.current.clear();
    setRestTimer(null);
    setReadiness(null);
    setReadinessOpen(false);
    setSessionRpe(null);
    setWarmup(null);
    setPostCardio(null);
    setSessionStartedAt(null);
    hydratedSessionKeyRef.current = null;
    restoredSessionStartKeyRef.current = null;
    setActiveExerciseIndex(0);
    setDayId(match?.id ?? null);
  };

  const openForUser = async (trainingName: string) => {
    const loaderStartedAt = performance.now();
    setName(trainingName);
    rememberName(account.id, trainingName);
    setStage("loading");
    setSyncState("loading");
    const loaded = await loadTrainingData(account.id, trainingName);
    const next = loaded.data ?? emptyData();
    const resolvedName = next.profile?.displayName?.trim() || trainingName;
    setName(resolvedName);
    rememberName(account.id, resolvedName);
    setData(next);
    setDrafts(await loadDrafts(account.id, trainingName) as Record<string, Record<string, SetEntry[]>>);
    setActiveDate(today());
    selectScheduledDay(next.program.activeId, next.program.frequency, next.program.preferredWeekdays, next.profile, today(), next);
    setLastSyncedAt(loaded.lastSyncedAt);
    setSyncState(loaded.pending ? "pending" : loaded.cloudAvailable ? "synced" : "local");
    await waitForRepArcLoader(loaderStartedAt);
    setStage(next.profile ? next.consent?.termsVersion === CURRENT_TERMS_VERSION ? "app" : "consent" : "profile");
  };

  useEffect(() => {
    const remembered = savedName(account.id);
    const timer = window.setTimeout(() => {
      if (remembered) {
        void openForUser(remembered);
        return;
      }
      void loadTrainingData(account.id).then((loaded) => {
        const cloudName = loaded.data?.profile?.displayName?.trim();
        if (cloudName) void openForUser(cloudName);
        else {
          setStage("name");
          setSyncState("local");
        }
      });
    }, 0);
    return () => window.clearTimeout(timer);
    // The initial identity lookup should run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!name || stage !== "app") return;
    void saveDrafts(account.id, drafts);
  }, [account.id, drafts, name, stage]);

  useEffect(() => {
    const synchronizeTimer = () => {
      const currentTime = Date.now();
      setRestTimer((current) => {
        if (!current) return current;
        const remainingSeconds = Math.max(-599, Math.ceil((current.endsAt - currentTime) / 1000));
        return remainingSeconds === current.remainingSeconds ? current : { ...current, remainingSeconds };
      });
    };
    const synchronizeWhenVisible = () => {
      if (document.visibilityState === "visible") synchronizeTimer();
    };
    const interval = window.setInterval(synchronizeTimer, 250);
    window.addEventListener("focus", synchronizeTimer);
    document.addEventListener("visibilitychange", synchronizeWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", synchronizeTimer);
      document.removeEventListener("visibilitychange", synchronizeWhenVisible);
    };
  }, []);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const updateDisplayMode = () => setIsStandalone(displayMode.matches || Boolean((navigator as WakeLockNavigator).standalone));
    updateDisplayMode();
    displayMode.addEventListener?.("change", updateDisplayMode);
    return () => displayMode.removeEventListener?.("change", updateDisplayMode);
  }, []);

  const restTimerStorageKey = name ? `reparc-rest-timer:${slugify(account.id)}:${slugify(name)}` : null;

  useEffect(() => {
    window.localStorage.setItem("reparc-rest-alert-level", restAlertLevel);
  }, [restAlertLevel]);

  useEffect(() => {
    if (!restTimerStorageKey || stage !== "app" || restoredTimerKeyRef.current === restTimerStorageKey) return;
    restoredTimerKeyRef.current = restTimerStorageKey;
    try {
      const stored = JSON.parse(window.localStorage.getItem(restTimerStorageKey) ?? "null") as RestTimer | null;
      if (!stored || !Number.isFinite(stored.endsAt) || Date.now() - stored.endsAt > 10 * 60_000) return;
      const remainingSeconds = Math.max(0, Math.ceil((stored.endsAt - Date.now()) / 1000));
      const restore = window.setTimeout(() => setRestTimer({ ...stored, remainingSeconds }), 0);
      return () => window.clearTimeout(restore);
    } catch {
      window.localStorage.removeItem(restTimerStorageKey);
    }
  }, [restTimerStorageKey, stage]);

  useEffect(() => {
    if (!restTimerStorageKey || stage !== "app") return;
    if (restTimer) window.localStorage.setItem(restTimerStorageKey, JSON.stringify(restTimer));
    else window.localStorage.removeItem(restTimerStorageKey);
  }, [restTimer, restTimerStorageKey, stage]);

  const restRemaining = restTimer?.remainingSeconds ?? 0;
  const restExerciseId = restTimer?.exerciseId;
  const restExerciseName = restTimer?.exerciseName;
  const restEndsAt = restTimer?.endsAt;

  const prepareChime = () => {
    const AudioContextConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    if (context.state === "suspended") void context.resume();
  };

  const playChime = (durationSeconds = 10) => {
    const context = audioContextRef.current;
    if (!context) return;
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime;
    const maximum = restAlertLevel === "maximum";
    const peak = maximum ? 0.92 : restAlertLevel === "quiet" ? 0.1 : 0.32;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-18, start);
    compressor.knee.setValueAtTime(14, start);
    compressor.ratio.setValueAtTime(12, start);
    compressor.attack.setValueAtTime(0.003, start);
    compressor.release.setValueAtTime(0.18, start);
    compressor.connect(context.destination);
    const repeats = Math.max(1, Math.ceil(durationSeconds / 0.42));
    Array.from({ length: repeats }, (_, index) => index * 0.42).forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = maximum ? "square" : restAlertLevel === "quiet" ? "sine" : "triangle";
      oscillator.frequency.value = [880, 1175, 988][index % 3];
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(peak, start + offset + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.3);
      oscillator.connect(gain);
      gain.connect(compressor);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.31);
      if (maximum) {
        const reinforcement = context.createOscillator();
        const reinforcementGain = context.createGain();
        reinforcement.type = "triangle";
        reinforcement.frequency.value = oscillator.frequency.value / 2;
        reinforcementGain.gain.setValueAtTime(0.0001, start + offset);
        reinforcementGain.gain.exponentialRampToValueAtTime(0.38, start + offset + 0.025);
        reinforcementGain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.3);
        reinforcement.connect(reinforcementGain);
        reinforcementGain.connect(compressor);
        reinforcement.start(start + offset);
        reinforcement.stop(start + offset + 0.31);
      }
    });
  };

  const showRestNotification = useCallback(async (exerciseNameValue: string, tag: string) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Rest complete", {
      body: `${exerciseNameValue} — ready for your next set.`,
      tag,
      renotify: true,
      requireInteraction: restAlertLevel === "maximum",
      silent: false,
      data: { url: "/" },
      vibrate: restAlertLevel === "maximum" ? [400, 100, 400, 100, 400] : restAlertLevel === "quiet" ? [120] : [180, 90, 180],
    } as NotificationOptions & { vibrate: number[] });
  }, [restAlertLevel]);

  const triggerRestAlert = useCallback((exerciseNameValue: string, tag = `rest-test-${Date.now()}`, testOnly = false) => {
    prepareChime();
    playChime(testOnly ? 2 : 10);
    const vibration = testOnly ? [250, 100, 250] : Array.from({ length: 13 }, () => [500, 250]).flat();
    navigator.vibrate?.(vibration);
    if (!testOnly) {
      if ("setAppBadge" in navigator) void (navigator as Navigator & { setAppBadge: (count?: number) => Promise<void> }).setAppBadge(1).catch(() => undefined);
      if (document.visibilityState !== "visible") void showRestNotification(exerciseNameValue, tag).catch(() => undefined);
    }
  // Audio helpers intentionally use the latest alert setting from this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restAlertLevel, showRestNotification]);

  useEffect(() => {
    if (!restExerciseId || !restEndsAt || restRemaining > 0 || alertedRestEndRef.current === restEndsAt) return;
    alertedRestEndRef.current = restEndsAt;
    triggerRestAlert(restExerciseName ?? "Exercise", `rest-${restEndsAt}`);
  }, [restEndsAt, restExerciseId, restExerciseName, restRemaining, triggerRestAlert]);

  const attemptCloudSync = useCallback(async (announce = false) => {
    if (!name || stage !== "app" || syncAttemptRef.current) return;
    syncAttemptRef.current = true;
    setSyncState("saving");
    try {
      const loaded = await loadTrainingData(account.id, name);
      if (loaded.data) setData(loaded.data);
      setLastSyncedAt(loaded.lastSyncedAt);
      setSyncState(loaded.pending ? "pending" : loaded.cloudAvailable ? "synced" : "local");
      if (announce) setNotice(loaded.pending ? "Still offline — your latest change remains safely queued" : loaded.cloudAvailable ? "Offline changes are now cloud saved" : "Cloud is unavailable — your data remains on this device");
    } catch {
      setSyncState("pending");
      if (announce) setNotice("Cloud is unavailable — your latest change remains safely queued");
    } finally {
      syncAttemptRef.current = false;
    }
  }, [account.id, name, stage]);

  useEffect(() => {
    const syncWhenOnline = () => void attemptCloudSync(true);
    const syncWhenFocused = () => {
      if (document.visibilityState === "visible" && (syncState === "pending" || syncState === "local")) void attemptCloudSync();
    };
    window.addEventListener("online", syncWhenOnline);
    window.addEventListener("focus", syncWhenFocused);
    document.addEventListener("visibilitychange", syncWhenFocused);
    const interval = window.setInterval(syncWhenFocused, 60_000);
    return () => {
      window.removeEventListener("online", syncWhenOnline);
      window.removeEventListener("focus", syncWhenFocused);
      document.removeEventListener("visibilitychange", syncWhenFocused);
      window.clearInterval(interval);
    };
  }, [attemptCloudSync, syncState]);

  useEffect(() => {
    const refreshDateAfterResume = () => {
      if (document.visibilityState !== "visible" || stage !== "app" || editingSessionId || sessionStartedAt) return;
      const currentDate = today();
      if (activeDate === currentDate) return;
      setActiveDate(currentDate);
      selectScheduledDay(data.program.activeId, data.program.frequency, data.program.preferredWeekdays, data.profile, currentDate, data);
      setNotice("A new day started — today’s scheduled workout is ready");
    };
    window.addEventListener("focus", refreshDateAfterResume);
    document.addEventListener("visibilitychange", refreshDateAfterResume);
    return () => {
      window.removeEventListener("focus", refreshDateAfterResume);
      document.removeEventListener("visibilitychange", refreshDateAfterResume);
    };
  }, [activeDate, data, editingSessionId, sessionStartedAt, stage]);

  const persist = async (next: TrainingData, successMessage?: string, mode: RestoreMode = "merge") => {
    const previousUnit = data.profile?.unit;
    const nextUnit = next.profile?.unit;
    if (previousUnit && nextUnit && previousUnit !== nextUnit) {
      setLoadProfileDrafts({});
      setDrafts((currentDrafts) => Object.fromEntries(
        Object.entries(currentDrafts).map(([draftDayId, entries]) => [
          draftDayId,
          Object.fromEntries(Object.entries(entries).map(([key, sets]) => [
            key,
            sets.map((entry) => ({
              ...entry,
              w: entry.w === ""
                ? ""
                : String(Math.round(convertWeight(numeric(entry.w), previousUnit, nextUnit) * 100) / 100),
            })),
          ])),
        ]),
      ));
    }
    if (data.profile?.gender !== next.profile?.gender || data.profile?.programTrack !== next.profile?.programTrack || data.profile?.goal !== next.profile?.goal || data.profile?.equipment !== next.profile?.equipment || data.program.activeId !== next.program.activeId || data.program.week !== next.program.week || data.program.frequency !== next.program.frequency || data.program.preferredWeekdays.join(",") !== next.program.preferredWeekdays.join(",")) {
      pendingRestSetsRef.current.clear();
      setRestTimer(null);
      setOpenSwap(null);
      setActiveDate(today());
      selectScheduledDay(next.program.activeId, next.program.frequency, next.program.preferredWeekdays, next.profile, today(), next);
    }
    setData(next);
    setSyncState("saving");
    const result = mode === "replace"
      ? await replaceTrainingData(account.id, next)
      : await saveTrainingData(account.id, next);
    setData(result.data);
    setLastSyncedAt(result.lastSyncedAt);
    setSyncState(result.pending ? "pending" : result.synced ? "synced" : "local");
    setNotice(result.saved ? result.pending ? `${successMessage ?? "Changes saved"} · queued for cloud sync` : successMessage ?? "Changes saved" : "Could not save. Keep this page open and try again.");
    return result.saved;
  };

  const finishProfile = async (profile: Profile, frequency: TrainingFrequency, preferredWeekdays: number[]) => {
    const now = new Date().toISOString();
    const next: TrainingData = {
      ...data,
      updatedAt: now,
      setupVersion: 3,
      setupCompletedAt: now,
      profile,
      program: { ...data.program, frequency, preferredWeekdays },
      consent: { termsVersion: CURRENT_TERMS_VERSION, adultConfirmedAt: now, safetyAcceptedAt: now },
      planHistory: [{ id: globalThis.crypto?.randomUUID?.() ?? `plan-${now}`, effectiveAt: now, kind: "setup", programId: data.program.activeId, week: data.program.week, frequency, preferredWeekdays: [...preferredWeekdays], track: profile.programTrack, goal: profile.goal, equipment: profile.equipment, status: "active" }],
    };
    const saved = await persist(next, "Your training plan is ready");
    if (saved) setStage("app");
    return saved;
  };

  const acceptCurrentTerms = async () => {
    const now = new Date().toISOString();
    const accepted = { ...data, updatedAt: now, consent: { termsVersion: CURRENT_TERMS_VERSION, adultConfirmedAt: now, safetyAcceptedAt: now } };
    const next = accepted.planHistory.length ? accepted : recordPlanChange(accepted, "setup", now);
    const saved = await persist(next, "Terms confirmation saved");
    if (saved) setStage("app");
    return saved;
  };

  const renameProfile = async (nextName: string) => {
    const trimmed = nextName.trim();
    if (!data.profile || !trimmed || !slugify(trimmed) || trimmed.length > 40) return false;
    const now = new Date().toISOString();
    const next = { ...data, profile: { ...data.profile, displayName: trimmed }, updatedAt: now };
    const saved = await persist(next, "Training name updated");
    if (saved) {
      setName(trimmed);
      rememberName(account.id, trimmed);
    }
    return saved;
  };

  const activeProgram = PROGRAMS[data.program.activeId];
  const profile = data.profile;
  const missedTraining = useMemo(() => detectMissedTraining(data, today()), [data]);
  const editingSession = editingSessionId ? data.sessions.find((session) => session.id === editingSessionId) : undefined;
  const workingProgramId = editingSession?.programId ?? data.program.activeId;
  const workingWeek = editingSession?.programWeek ?? data.program.week;
  const workingFrequency = editingSession?.programFrequency ?? data.program.frequency;
  const snapshotDay = editingSession?.planSnapshot ? trainingDayFromSnapshot(editingSession.planSnapshot) : null;
  const baseActiveDays = snapshotDay
    ? [snapshotDay]
    : programDays(
        workingProgramId,
        workingFrequency,
        editingSession?.planSnapshot?.track ?? profile?.programTrack ?? trainingTrack(profile?.gender ?? "man"),
        editingSession?.planSnapshot?.goal ?? profile?.goal ?? "balanced",
        editingSession?.planSnapshot?.equipment ?? profile?.equipment ?? "full",
      );
  const activeDays = !editingSession && data.program.returnPlan
    ? baseActiveDays.map((programDay) => ({
        ...programDay,
        exercises: programDay.exercises.map((exercise) => ({ ...exercise, sets: returnPlanSetCount(exercise.sets, data.program.returnPlan!.volumeFactor) })),
      }))
    : baseActiveDays;
  const day = activeDays.find((item) => item.id === dayId) ?? null;
  const keyForExercise = (exercise: Exercise, index?: number) => {
    const snapshotIndex = index ?? day?.exercises.indexOf(exercise) ?? -1;
    if (editingSession?.planSnapshot?.exercises[snapshotIndex]?.key) return editingSession.planSnapshot.exercises[snapshotIndex].key;
    if (workingProgramId === "phase2" && exercise.sbsRole) return exercise.id;
    return exerciseKey(exercise, data.swaps);
  };
  const resolvedForExercise = (exercise: Exercise, index?: number) => {
    const resolved = exerciseFromKey(keyForExercise(exercise, index))
      ?? resolveExerciseVariant(exercise, workingProgramId === "phase2" && exercise.sbsRole ? exercise.name : data.swaps[exercise.id] ?? exercise.defaultVariant ?? exercise.name);
    return { ...resolved, sets: exercise.sets };
  };

  const resolveTimeAway = async (resolution: AbsenceResolution, reason: AbsenceReason = "busy") => {
    if (!missedTraining) return;
    const now = new Date().toISOString();
    const resolvedDayIds = resolution === "skip" || resolution === "trained-elsewhere"
      ? absenceDayIds(data, missedTraining.missedDates.length)
      : [];
    const returnPlan = resolution === "pause" ? undefined : buildReturnPlan(missedTraining.gapDays, reason, now);
    const record: AbsenceRecord = {
      id: globalThis.crypto?.randomUUID?.() ?? `absence-${now}`,
      startDate: missedTraining.missedDates[0],
      endDate: missedTraining.missedDates.at(-1)!,
      missedDates: missedTraining.missedDates,
      reason,
      resolution,
      programId: data.program.activeId,
      programWeek: data.program.activeId === "phase2" ? data.program.week : undefined,
      frequency: data.program.frequency,
      resolvedDayIds,
      createdAt: now,
      updatedAt: now,
    };
    let next: TrainingData = {
      ...data,
      updatedAt: now,
      absences: [...data.absences, record].slice(-2_000),
      program: {
        ...data.program,
        status: resolution === "pause" ? "paused" : data.program.status,
        pausedAt: resolution === "pause" ? now : data.program.pausedAt,
        calibrationRequired: Boolean(returnPlan) || data.program.calibrationRequired,
        returnPlan,
      },
    };
    if (resolution === "pause") next = recordPlanChange(next, "pause", now);
    const saved = await persist(next, resolution === "pause" ? "Program paused — your history is safe" : returnPlan ? "Welcome back — return mode is ready" : "Time away recorded");
    if (saved) selectScheduledDay(next.program.activeId, next.program.frequency, next.program.preferredWeekdays, next.profile, today(), next);
  };
  const currentSession = editingSession ?? (day
    ? data.sessions.find((session) =>
        !session.deletedAt
        &&
        session.date === activeDate
        && session.dayId === day.id
        && (workingProgramId === "phase2"
          ? session.programId === "phase2" && session.programWeek === workingWeek && (session.programFrequency ?? 5) === workingFrequency
          : session.programId !== "phase2"),
      )
    : undefined);
  const draftKey = day ? `${workingProgramId}:${workingWeek}:${activeDate}:${day.id}` : null;

  useEffect(() => {
    const hydrationKey = currentSession?.id ?? draftKey;
    if (!hydrationKey || hydratedSessionKeyRef.current === hydrationKey) return;
    hydratedSessionKeyRef.current = hydrationKey;
    setReadiness(currentSession?.readiness ?? null);
    setSessionRpe(currentSession?.sessionRpe ?? null);
    setWarmup(currentSession?.warmup ?? null);
    setPostCardio(currentSession?.postCardio ?? null);
  }, [currentSession?.id, currentSession?.postCardio, currentSession?.readiness, currentSession?.sessionRpe, currentSession?.warmup, draftKey]);
  const sessionStartStorageKey = name && draftKey ? `reparc-session-start:${slugify(account.id)}:${slugify(name)}:${draftKey}` : null;
  const shouldKeepScreenAwake = stage === "app" && view === "train" && Boolean(day) && (Boolean(restTimer) || (Boolean(sessionStartedAt) && !currentSession?.completedAt));

  useEffect(() => {
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;
    let cancelled = false;
    const capabilityTimer = window.setTimeout(() => setWakeLockState((current) => current === "active" ? current : "available"), 0);

    const requestWakeLock = async () => {
      if (cancelled || !shouldKeepScreenAwake || document.visibilityState !== "visible" || (wakeLockRef.current && !wakeLockRef.current.released)) return;
      try {
        const sentinel = await wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        setWakeLockState("active");
        sentinel.addEventListener("release", () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
          if (!cancelled) setWakeLockState("available");
        });
      } catch {
        setWakeLockState("available");
      }
    };
    const requestWhenVisible = () => {
      if (document.visibilityState === "visible") void requestWakeLock();
    };
    void requestWakeLock();
    document.addEventListener("visibilitychange", requestWhenVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(capabilityTimer);
      document.removeEventListener("visibilitychange", requestWhenVisible);
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
    };
  }, [shouldKeepScreenAwake]);

  useEffect(() => {
    if (!sessionStartStorageKey || currentSession?.startedAt || restoredSessionStartKeyRef.current === sessionStartStorageKey) return;
    restoredSessionStartKeyRef.current = sessionStartStorageKey;
    const stored = window.localStorage.getItem(sessionStartStorageKey);
    if (!stored || !Number.isFinite(Date.parse(stored))) return;
    const restore = window.setTimeout(() => setSessionStartedAt((current) => current ?? stored), 0);
    return () => window.clearTimeout(restore);
  }, [currentSession?.startedAt, sessionStartStorageKey]);

  const log = day && draftKey
    ? drafts[draftKey] ?? sessionEntriesForDay(
        day,
        editingSession ? {} : data.swaps,
        currentSession?.entries,
        currentSession?.unit,
        profile?.unit,
      )
    : {};

  const historyFor = (key: string) =>
    activeSessions(data)
      .filter((session) => session.entries[key]?.some((entry) => isFilledSet(entry, storedExercise(session, key))))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const estimatedTrainingMax = (exercise: Exercise, key: string) => {
    if (!profile) return 0;
    return suggestedTrainingMax(data, { ...exercise, name: exerciseName(key) }, profile.unit);
  };

  const prescriptionFor = (exercise: Exercise) =>
    workingProgramId === "phase2" && exercise.sbsRole
      ? !editingSession && data.program.calibrationRequired
        ? { ...sbsPrescription(exercise.sbsRole, workingWeek), deload: true }
        : sbsPrescription(exercise.sbsRole, workingWeek)
      : null;

  const suggestionFor = (exercise: Exercise, key: string): Suggestion | null => {
    if (!profile || !day) return null;
    const prescription = prescriptionFor(exercise);
    const availableLoads = loadProfileValues(data.loadProfiles[loadProfileId(exercise)] ?? data.loadProfiles[key], profile.unit);
    if (prescription) {
      const storedTrainingMax = data.program.trainingMaxes[key];
      const trainingMax = storedTrainingMax || estimatedTrainingMax(exercise, key);
      const theoreticalLoad = trainingMax * prescription.intensity;
      const value = availableLoads.length ? resolveAvailableLoad(theoreticalLoad, availableLoads, "nearest") : null;
      return {
        value,
        tag: storedTrainingMax ? "hold" : "estimate",
        reason: !availableLoads.length
          ? `Configure this exercise’s available loads to convert the ${Math.round(prescription.intensity * 100)}% training-max target into a load you can actually select.`
          : prescription.deload
            ? `Week ${workingWeek} deload · ${Math.round(prescription.intensity * 100)}% TM · nearest available load · no AMRAP`
            : `Week ${workingWeek} · ${Math.round(prescription.intensity * 100)}% TM · nearest available load · final set ${prescription.repOutTarget}+`,
      };
    }
    const history = historyFor(key);
    const last = history.at(-1);
    if (last) {
      const normalizedEntries = last.entries[key].map((entry) => entry.w === "" ? entry : { ...entry, w: String(convertWeight(numeric(entry.w), last.unit, profile.unit)) });
      const adjustment = nextSessionAdjustment({ exercise, entries: normalizedEntries, unit: profile.unit, readiness: last.readiness, availableLoads });
      if (adjustment) return {
        value: adjustment.nextLoad,
        tag: exercise.bodyweight && adjustment.nextLoad === null ? "bodyweight" : adjustment.action === "increase" ? "up" : adjustment.action === "decrease" || adjustment.action === "stop" ? "down" : "hold",
        reason: adjustment.reason,
        confidence: adjustment.confidence,
      };
    }

    if (exercise.loadingType === "bodyweight" || exercise.bodyweight) return { value: null, tag: "bodyweight", reason: "Start with bodyweight. Add load after the top of the range." };
    return { value: null, tag: "estimate", reason: "No same-exercise history exists. Start light enough to finish the range with about 2–3 RIR, then adjust after set one." };
  };

  const startRestTimer = (exercise: Exercise) => {
    prepareChime();
    setAlertPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    const startedAt = new Date().valueOf();
    setRestTimer({
      exerciseId: exercise.id,
      exerciseName: data.swaps[exercise.id] ?? exercise.name,
      durationSeconds: exercise.restSeconds,
      endsAt: startedAt + exercise.restSeconds * 1000,
      remainingSeconds: exercise.restSeconds,
    });
  };

  const closeRestTimer = () => {
    navigator.vibrate?.(0);
    if ("clearAppBadge" in navigator) void (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => undefined);
    setRestTimer(null);
  };
  const addRestTime = () => setRestTimer((current) => current ? { ...current, durationSeconds: current.durationSeconds + 30, endsAt: current.endsAt + 30_000, remainingSeconds: current.remainingSeconds + 30 } : null);

  const finishSet = (key: string, index: number) => {
    if (!draftKey) return;
    const exercise = exerciseFromKey(key);
    const pendingKey = `${draftKey}:${key}:${index}`;
    if (!exercise || !pendingRestSetsRef.current.has(pendingKey)) return;
    const entry = log[key]?.[index];
    if (!entry || !isFilledSet(entry, exercise)) return;
    pendingRestSetsRef.current.delete(pendingKey);
    startRestTimer(exercise);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      window.setTimeout(() => restTimerAnchorRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 60);
    }
  };

  const enableRestAlerts = async () => {
    prepareChime();
    if (typeof Notification === "undefined") {
      setAlertPermission("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setAlertPermission(permission);
  };

  const testRestAlert = async () => {
    prepareChime();
    let permission: AlertPermission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
      setAlertPermission(permission);
    }
    triggerRestAlert("Alarm readiness test", undefined, true);
    if (permission === "granted") await showRestNotification("Alarm readiness test", `rest-readiness-${Date.now()}`).catch(() => undefined);
    setNotice(permission === "granted" ? "Alert test sent — confirm that you heard or saw it" : "Foreground alert tested — system notifications are not enabled on this device");
  };

  const setField = (key: string, index: number, field: keyof SetEntry, value: string) => {
    if (field === "r" && value !== "" && !/^\d{0,3}$/.test(value)) return;
    if (field === "rir" && value !== "" && (!/^\d{0,2}(?:\.\d)?$/.test(value) || Number(value) > 10)) return;
    if (field === "w" && value !== "" && !/^\d{0,4}(?:\.\d{0,2})?$/.test(value)) return;
    if (!day || !draftKey) return;
    if (value !== "" && !sessionStartedAt) {
      const startedAt = new Date().toISOString();
      setSessionStartedAt(startedAt);
      if (sessionStartStorageKey) window.localStorage.setItem(sessionStartStorageKey, startedAt);
    }
    const exercise = exerciseFromKey(key);
    const previousEntry = log[key]?.[index] ?? emptySet();
    const nextEntry = {
      ...previousEntry,
      [field]: value,
      ...(exercise?.bodyweight && field === "r" && value !== "" && previousEntry.w === "" ? { w: "0" } : {}),
    };
    const completesSet = Boolean(
      exercise
      && !isFilledSet(previousEntry, exercise)
      && isFilledSet(nextEntry, exercise),
    );
    const pendingKey = `${draftKey}:${key}:${index}`;
    if (completesSet) {
      pendingRestSetsRef.current.add(pendingKey);
      prepareChime();
    } else if (exercise && !isFilledSet(nextEntry, exercise)) {
      pendingRestSetsRef.current.delete(pendingKey);
    }
    setDrafts((previous) => {
      const dayLog = previous[draftKey] ?? sessionEntriesForDay(
        day,
        editingSession ? {} : data.swaps,
        currentSession?.entries,
        currentSession?.unit,
        profile?.unit,
      );
      const sets = dayLog[key] ?? [];
      return {
        ...previous,
        [draftKey]: {
          ...dayLog,
          [key]: sets.map((entry, setIndex) => setIndex === index ? nextEntry : entry),
        },
      };
    });
    setNotice("");
  };

  const saveLoadProfile = async (key: string, values: number[]) => {
    if (!profile) return;
    const normalized = normalizeLoadValues(values);
    if (normalized.length < 2) {
      setNotice("Enter at least two available loads, separated by commas.");
      return;
    }
    const now = new Date().toISOString();
    await persist({ ...data, loadProfiles: { ...data.loadProfiles, [key]: { unit: profile.unit, values: normalized, updatedAt: now } }, updatedAt: now }, "Available loads saved");
    setLoadProfileDrafts((current) => ({ ...current, [key]: normalized.join(", ") }));
  };

  const clearLoadProfile = async (key: string) => {
    const now = new Date().toISOString();
    const nextProfiles = { ...data.loadProfiles, [key]: { unit: profile?.unit ?? "kg", values: [], updatedAt: now, deletedAt: now } };
    await persist({ ...data, loadProfiles: nextProfiles, updatedAt: now }, "Available loads cleared");
    setLoadProfileDrafts((current) => ({ ...current, [key]: "" }));
  };

  const applySwap = async (exercise: Exercise, alternative: string | null) => {
    if (!day || !draftKey) return;
    if (editingSession) {
      setNotice("Historical sessions keep their saved exercise variation. Change the current plan from a new workout instead.");
      return;
    }
    const nextSwaps = { ...data.swaps };
    if (alternative) nextSwaps[exercise.id] = alternative;
    else delete nextSwaps[exercise.id];
    const nextKey = exerciseKey(exercise, nextSwaps);
    setDrafts((previous) => {
      const dayLog = previous[draftKey] ?? sessionEntriesForDay(
        day,
        data.swaps,
        currentSession?.entries,
        currentSession?.unit,
        profile?.unit,
      );
      return {
        ...previous,
        [draftKey]: {
          ...dayLog,
          [nextKey]: dayLog[nextKey] ?? Array.from({ length: exercise.sets }, emptySet),
        },
      };
    });
    setOpenSwap(null);
    const next = { ...data, swaps: nextSwaps, updatedAt: new Date().toISOString() };
    await persist(next, "Exercise variation saved");
  };

  const saveSession = async () => {
    if (!day || !profile) return;
    if (readiness === "pain" || readiness === "severe-soreness") {
      setNotice(readiness === "severe-soreness" ? "Training is paused because movement-limiting soreness is selected." : "Saving is paused because Pain / unsafe is selected in the readiness check.");
      return;
    }
    if (data.program.status === "paused") {
      setNotice("Resume the program in Setup before saving a workout.");
      return;
    }
    const entries: Record<string, SetEntry[]> = {};
    day.exercises.forEach((baseExercise, exerciseIndex) => {
      const key = keyForExercise(baseExercise, exerciseIndex);
      const exercise = resolvedForExercise(baseExercise, exerciseIndex);
      const sets = log[key] ?? [];
      if (!sets.some((entry) => isFilledSet(entry, exercise))) return;
      entries[key] = sets.map((entry) => ({
        ...entry,
        w: !exerciseNeedsLoad(exercise) && entry.r !== "" && entry.w === "" ? "0" : entry.w,
      }));
    });
    if (!Object.keys(entries).length) {
      setNotice("Log at least one complete set first.");
      return;
    }
    const now = new Date().toISOString();
    const startedAt = currentSession?.startedAt ?? sessionStartedAt ?? now;
    const durationSeconds = currentSession?.durationSeconds ?? Math.min(43_200, Math.max(0, Math.round((Date.parse(now) - Date.parse(startedAt)) / 1000)));
    const planSnapshot = currentSession?.planSnapshot ?? buildSessionPlanSnapshot(data, day, workingProgramId, workingWeek, workingFrequency);
    const plannedSets = planSnapshot.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const completedSetCount = Object.entries(entries).reduce((sum, [key, sets]) => {
      const snapshot = planSnapshot.exercises.find((exercise) => exercise.key === key);
      const exercise = snapshot ? { ...snapshot, alternatives: [] } as Exercise : exerciseFromKey(key);
      return sum + sets.filter((entry) => isFilledSet(entry, exercise)).length;
    }, 0);
    const completionStatus = completedSetCount >= plannedSets ? "completed" as const : "partial" as const;
    const calibrationSession = !editingSession && (data.program.calibrationRequired || Boolean(data.program.returnPlan));
    const calibrationCompleted = calibrationSession && completionStatus === "completed";
    const affectsProgression = !calibrationSession && completionStatus === "completed";
    const trainingMaxesBefore = { ...(currentSession?.trainingMaxesBefore ?? {}) };
    const trainingMaxesAfter = { ...data.program.trainingMaxes };
    if (workingProgramId === "phase2") {
      planSnapshot.exercises.forEach((snapshot) => {
        const exercise = { ...snapshot, alternatives: [] } as Exercise;
        if (!exercise.sbsRole) return;
        const key = snapshot.key;
        const baseTrainingMax = currentSession?.trainingMaxesBefore?.[key]
          ?? data.program.trainingMaxes[key]
          ?? estimatedTrainingMax(exercise, key);
        if (!baseTrainingMax) return;
        trainingMaxesBefore[key] = baseTrainingMax;
        trainingMaxesAfter[key] = baseTrainingMax;
      });
    }
    const session: Session = {
      id: currentSession?.id ?? globalThis.crypto?.randomUUID?.() ?? `${activeDate}-${day.id}-${now}`,
      date: activeDate,
      dayId: day.id,
      unit: profile.unit,
      entries,
      programId: workingProgramId,
      programWeek: workingProgramId === "phase2" ? workingWeek : undefined,
      programFrequency: workingFrequency,
      trainingMaxesBefore: workingProgramId === "phase2" ? trainingMaxesBefore : undefined,
      trainingMaxesAfter: workingProgramId === "phase2" ? trainingMaxesAfter : undefined,
      readiness: readiness ?? undefined,
      sessionRpe: sessionRpe ?? undefined,
      warmup: warmup ?? undefined,
      postCardio: postCardio ?? undefined,
      startedAt,
      completedAt: now,
      durationSeconds,
      completionStatus,
      affectsProgression,
      bodyweightAtSession: currentSession?.bodyweightAtSession ?? profile.bodyweight,
      planSnapshot,
      logicalKey: currentSession?.logicalKey ?? sessionLogicalKey(activeDate, workingProgramId, workingProgramId === "phase2" ? workingWeek : undefined, workingFrequency, day.id),
      revision: (currentSession?.revision ?? 0) + 1,
      createdAt: currentSession?.createdAt ?? now,
      updatedAt: now,
    };
    const sessions = currentSession
      ? data.sessions.map((item) => item.id === currentSession.id ? session : item)
      : [...data.sessions, session];
    const sessionRevisions = currentSession
      ? [...data.sessionRevisions, { id: globalThis.crypto?.randomUUID?.() ?? `revision-${now}`, sessionId: currentSession.id, action: "edited" as const, at: now, note: "Session values updated", previous: currentSession }].slice(-5_000)
      : data.sessionRevisions;
    const remainingReturnSessions = calibrationCompleted && data.program.returnPlan
      ? Math.max(0, data.program.returnPlan.sessionsRemaining - 1)
      : data.program.returnPlan?.sessionsRemaining;
    const nextReturnPlan = data.program.returnPlan && remainingReturnSessions
      ? { ...data.program.returnPlan, sessionsRemaining: remainingReturnSessions }
      : undefined;
    let next: TrainingData = {
      ...data,
      sessions,
      sessionRevisions,
      program: {
        ...data.program,
        calibrationRequired: calibrationCompleted ? Boolean(nextReturnPlan) : data.program.calibrationRequired,
        returnPlan: nextReturnPlan,
      },
      updatedAt: now,
    };
    if (workingProgramId === "phase2") next = recalculatePhase2Progression(next);
    const saved = await persist(
      next,
      currentSession ? "Session updated — previous version kept in history" : calibrationCompleted && nextReturnPlan ? `Return session saved — ${nextReturnPlan.sessionsRemaining} conservative session${nextReturnPlan.sessionsRemaining === 1 ? "" : "s"} remaining` : calibrationCompleted ? "Calibration session saved — normal progression resumes next time" : calibrationSession ? "Partial return session saved — complete it before progression resumes" : "Session saved — strong work",
    );
    if (saved) {
      if (sessionStartStorageKey) window.localStorage.removeItem(sessionStartStorageKey);
      setNotice(currentSession ? "Session updated — previous version kept in history" : "Session saved — complete the week when you are ready");
      if (editingSession) {
        setEditingSessionId(null);
        setView("progress");
      }
    }
  };

  const finishWeek = async (status: "completed" | "extended" | "skipped") => {
    if (data.program.activeId !== "phase2") return;
    const currentWeekDays = programDays("phase2", data.program.frequency, profile?.programTrack ?? "current", profile?.goal ?? "balanced", profile?.equipment ?? "full");
    const completedDayIds = currentWeekDays.filter((programDay) => activeSessions(data).some((session) =>
      session.programId === "phase2"
      && session.programWeek === data.program.week
      && (session.programFrequency ?? 5) === data.program.frequency
      && session.dayId === programDay.id
      && sessionCountsAsCompletedDay(session, data)
    )).map((programDay) => programDay.id);
    const skippedDayIds = currentWeekDays.filter((programDay) => !completedDayIds.includes(programDay.id)).map((programDay) => programDay.id);
    if (status === "completed" && skippedDayIds.length) {
      setNotice(`Complete all ${currentWeekDays.length} sessions or choose “Skip missing & advance”.`);
      return;
    }
    if (status === "skipped" && skippedDayIds.length && !window.confirm(`Advance week ${data.program.week} and mark ${skippedDayIds.length} missing session${skippedDayIds.length === 1 ? "" : "s"} as skipped? Training maxes will only use fully completed eligible sessions.`)) return;
    const now = new Date().toISOString();
    const advances = status !== "extended";
    const finalWeek = data.program.week >= 21 && advances;
    const nextWeek = finalWeek ? 21 : advances ? data.program.week + 1 : data.program.week;
    const next: TrainingData = {
      ...data,
      program: {
        ...data.program,
        week: nextWeek,
        status: finalWeek ? "completed" : data.program.status,
        weekRecords: [...data.program.weekRecords, { programId: "phase2", week: data.program.week, frequency: data.program.frequency, status, completedDayIds, skippedDayIds: status === "skipped" ? skippedDayIds : [], at: now }],
      },
      updatedAt: now,
    };
    const saved = await persist(next, status === "extended" ? `Week ${data.program.week} extended` : finalWeek ? "Phase 2 completed" : `Week ${data.program.week} closed — week ${nextWeek} is ready`);
    if (saved && advances) {
      setActiveDate(today());
      setDayId(null);
      setReadiness(null);
      setSessionRpe(null);
      setSessionStartedAt(null);
      pendingRestSetsRef.current.clear();
      setRestTimer(null);
    }
  };

  const editSession = (session: Session) => {
    setEditingSessionId(session.id);
    setActiveDate(session.date);
    setDayId(session.dayId);
    setReadiness(session.readiness ?? null);
    setSessionRpe(session.sessionRpe ?? null);
    setWarmup(session.warmup ?? null);
    setPostCardio(session.postCardio ?? null);
    setSessionStartedAt(session.startedAt ?? null);
    setReadinessOpen(false);
    setActiveExerciseIndex(0);
    setView("train");
    setNotice(`Editing ${prettyDate(session.date)}. Saving will preserve the previous revision.`);
  };

  const cancelHistoricalEdit = () => {
    setEditingSessionId(null);
    const currentDate = today();
    setActiveDate(currentDate);
    selectScheduledDay(data.program.activeId, data.program.frequency, data.program.preferredWeekdays, data.profile, currentDate, data);
    setView("progress");
    setNotice("Historical edit cancelled");
  };

  if (stage === "loading") return <LoadingScreen />;
  if (stage === "name") return <NameSetup onContinue={openForUser} />;
  if (stage === "profile") return <ProfileSetup accountId={account.id} name={name} onSave={finishProfile} />;
  if (stage === "consent") return <ConsentUpdate onAccept={acceptCurrentTerms} />;
  if (!profile) return <LoadingScreen />;

  const totalSets = day?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
  const completedSets = day
    ? day.exercises.reduce((sum, exercise, index) => {
        const key = keyForExercise(exercise, index);
        return sum + (log[key] ?? []).filter((entry) => isFilledSet(entry, resolvedForExercise(exercise, index))).length;
      }, 0)
    : 0;
  const completion = totalSets ? Math.round((completedSets / totalSets) * 100) : 0;
  const exerciseIsComplete = (index: number) => {
    const exercise = day?.exercises[index];
    if (!exercise) return false;
    const resolved = resolvedForExercise(exercise, index);
    const entries = log[keyForExercise(exercise, index)] ?? [];
    return entries.length >= resolved.sets && entries.slice(0, resolved.sets).every((entry) => isFilledSet(entry, resolved));
  };
  const firstIncompleteExerciseIndex = day?.exercises.findIndex((_, index) => !exerciseIsComplete(index)) ?? -1;
  const lastAccessibleExerciseIndex = firstIncompleteExerciseIndex === -1 ? (day?.exercises.length ?? 1) - 1 : firstIncompleteExerciseIndex;
  const goToExercise = (index: number) => {
    if (!day || index < 0 || index >= day.exercises.length) return;
    if (index > lastAccessibleExerciseIndex) {
      setNotice("Complete every kg and reps field in the current exercise before continuing.");
      return;
    }
    setActiveExerciseIndex(index);
    setOpenSwap(null);
    setNotice("");
  };
  const formattedToday = prettyDate(activeDate, { weekday: "long", day: "numeric", month: "long" });
  const currentProgramDays = programDays(data.program.activeId, data.program.frequency, profile?.programTrack ?? "current", profile?.goal ?? "balanced", profile?.equipment ?? "full");
  const weekCompletedDays = data.program.activeId === "phase2" ? currentProgramDays.filter((programDay) => activeSessions(data).some((session) => session.programId === "phase2" && session.programWeek === data.program.week && (session.programFrequency ?? 5) === data.program.frequency && session.dayId === programDay.id && sessionCountsAsCompletedDay(session, data))).length : 0;

  return (
    <main id="main-content" className={`min-h-dvh bg-[#0b0d0c] text-stone-100 ${view === "train" && day ? "pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-12" : "pb-12"}`}>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b0d0c]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between">
            <BrandLockup />
            <div className="flex items-center gap-1 lg:hidden"><Button type="button" variant="ghost" size="icon" onClick={() => setView("guide")} aria-label="Open guide" title="Guide" className="size-11 rounded-xl text-stone-400 hover:bg-white/10 hover:text-white"><CircleHelp className="size-5" /></Button><SyncBadge state={syncState} lastSyncedAt={lastSyncedAt} onSync={() => void attemptCloudSync(true)} /></div>
          </div>
          <Tabs value={view} onValueChange={(value) => setView(value as View)}>
            <TabsList className="grid h-11 w-full grid-cols-3 gap-1 rounded-none border-0 bg-transparent p-0 shadow-none lg:w-80">
              <TabsTrigger value="train" className="h-11 rounded-xl border border-white/10 bg-white/[0.035] text-[11px] text-stone-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-stone-200 data-[state=active]:bg-amber-300 data-[state=active]:text-[#0b0d0c]"><Dumbbell className="size-3.5" />Train</TabsTrigger>
              <TabsTrigger value="progress" className="h-11 rounded-xl border border-white/10 bg-white/[0.035] text-[11px] text-stone-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-stone-200 data-[state=active]:bg-amber-300 data-[state=active]:text-[#0b0d0c]"><History className="size-3.5" />Progress</TabsTrigger>
              <TabsTrigger value="settings" className="h-11 rounded-xl border border-white/10 bg-white/[0.035] text-[11px] text-stone-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-stone-200 data-[state=active]:bg-amber-300 data-[state=active]:text-[#0b0d0c]"><Settings className="size-3.5" />Setup</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="hidden items-center gap-1 lg:flex"><Button type="button" variant="ghost" onClick={() => setView("guide")} aria-pressed={view === "guide"} className="h-11 rounded-xl px-3 text-xs text-stone-400 hover:bg-white/10 hover:text-white"><CircleHelp className="size-4" />Guide</Button><SyncBadge state={syncState} lastSyncedAt={lastSyncedAt} onSync={() => void attemptCloudSync(true)} /></div>
        </div>
      </header>

      {view === "train" && <div className="motion-page mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-7 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-8 lg:py-8" role="tabpanel" aria-label="Training log">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow text-stone-500">{formattedToday}</p>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 font-mono text-[10px] text-amber-300">
              {data.program.activeId === "phase2" ? `Week ${data.program.week} / 21 · Block ${Math.ceil(data.program.week / 7)}` : activeProgram.name}
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-stone-500">Training as {name}</p>
              <h1 className="mt-1 text-4xl font-semibold tracking-[-0.05em]">{day?.name ?? "Rest day"}</h1>
              <p className="mt-1 text-sm text-stone-400">{day?.focus ?? "Recovery is part of the program."}</p>
            </div>
            {day && (
              <div
                className="progress-ring grid size-[4.6rem] shrink-0 place-items-center rounded-full"
                style={{ "--progress": `${completion * 3.6}deg` } as React.CSSProperties}
                aria-label={`${completion}% of sets logged`}
              >
                <div className="grid size-[3.65rem] place-items-center rounded-full bg-[#0b0d0c] font-mono text-sm font-bold">
                  {completion}%
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${activeDays.length}, minmax(0, 1fr))` }} aria-label="Choose a training session">
            {activeDays.map((item, index) => (
              <Button
                key={item.id}
                variant="outline"
                onClick={() => {
                  setDayId(item.id);
                  setReadiness(null);
                  setReadinessOpen(false);
                  setSessionRpe(null);
                  setWarmup(null);
                  setPostCardio(null);
                  setSessionStartedAt(null);
                  hydratedSessionKeyRef.current = null;
                  restoredSessionStartKeyRef.current = null;
                  setActiveExerciseIndex(0);
                  pendingRestSetsRef.current.clear();
                  setRestTimer(null);
                  setOpenSwap(null);
                  setNotice("");
                }}
                aria-pressed={dayId === item.id}
                data-selected={dayId === item.id}
                className="selection-button h-11 rounded-xl px-0 text-xs font-bold"
              >
                D{index + 1}
              </Button>
            ))}
          </div>

          {data.program.activeId === "phase2" && !editingSession && (
            <details className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 lg:block lg:[&>summary]:cursor-default">
              <summary className="flex cursor-pointer list-none items-center justify-between"><span className="eyebrow">Week progress</span><span className="font-mono text-sm text-stone-300">{weekCompletedDays} / {currentProgramDays.length}</span></summary>
              <Progress value={(weekCompletedDays / currentProgramDays.length) * 100} className="mt-3 h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-amber-300" />
              <div className="mt-4 grid gap-2">
                <Button type="button" onClick={() => void finishWeek(weekCompletedDays === currentProgramDays.length ? "completed" : "skipped")} className="h-10 rounded-xl bg-amber-300 text-xs font-bold text-[#0b0d0c] hover:bg-amber-200"><CalendarCheck className="size-4" />{weekCompletedDays === currentProgramDays.length ? "Complete week & advance" : "Skip missing & advance"}</Button>
                <Button type="button" variant="ghost" onClick={() => void finishWeek("extended")} className="h-9 rounded-xl text-xs text-stone-400 hover:bg-white/10 hover:text-white">Extend this week</Button>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-stone-600">Weeks never advance automatically. You decide when to stay, extend, skip, or progress.</p>
            </details>
          )}

          {day && (
            <div className="mt-5 hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4 lg:block">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Sets logged</span>
                <span className="font-mono text-sm text-stone-300">{completedSets} / {totalSets}</span>
              </div>
              <Progress value={completion} className="mt-3 h-1.5 bg-white/10 [&_[data-slot=progress-indicator]]:bg-amber-300" />
              <p className="mt-4 text-xs leading-5 text-stone-500">
                Complete kg and reps for every working set before moving to the next exercise. Bodyweight sets display 0 added load.
              </p>
            </div>
          )}
        </aside>

        <section className="min-w-0">
          {editingSession && <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-sky-300/20 bg-sky-300/[0.06] p-4"><div><p className="font-semibold text-sky-200">Editing {prettyDate(editingSession.date)}</p><p className="mt-1 text-xs text-stone-400">This uses the saved historical plan and cannot change your current program, week, schedule, or training status.</p></div><Button type="button" variant="ghost" onClick={cancelHistoricalEdit} className="h-9 shrink-0 rounded-xl text-xs text-sky-200 hover:bg-white/10">Cancel</Button></div>}
          {!editingSession && missedTraining && data.program.status === "active" && (
            <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
              <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-amber-200">Welcome back</p><p className="mt-1 text-xs leading-5 text-stone-400">{missedTraining.missedDates.length} planned session{missedTraining.missedDates.length === 1 ? " needs" : "s need"} a decision. RepArc will not invent sets or reduce your training maxes.</p></div><span className="shrink-0 rounded-full bg-black/20 px-2 py-1 font-mono text-[10px] text-stone-400">{missedTraining.gapDays} days</span></div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Button type="button" onClick={() => void resolveTimeAway("continue", "busy")} className="h-10 rounded-xl bg-amber-300 text-xs font-bold text-[#0b0d0c] hover:bg-amber-200"><Play className="size-3.5" />Continue next</Button>
                <Button type="button" variant="outline" onClick={() => void resolveTimeAway("trained-elsewhere", "other")} className="h-10 rounded-xl border-white/10 text-xs"><Check className="size-3.5" />Trained elsewhere</Button>
                <Button type="button" variant="outline" onClick={() => void resolveTimeAway("skip", "busy")} className="h-10 rounded-xl border-white/10 text-xs">Skip missed</Button>
                <Button type="button" variant="outline" onClick={() => void resolveTimeAway("skip", "soreness")} className="h-10 rounded-xl border-red-300/20 text-xs text-red-200"><ShieldAlert className="size-3.5" />Severe soreness</Button>
                <Button type="button" variant="ghost" onClick={() => void resolveTimeAway("pause", "illness")} className="h-9 rounded-xl text-xs text-stone-400 hover:bg-white/10">Sick / injured</Button>
                <Button type="button" variant="ghost" onClick={() => void resolveTimeAway("pause", "planned")} className="h-9 rounded-xl text-xs text-stone-400 hover:bg-white/10"><Pause className="size-3.5" />Pause program</Button>
              </div>
            </div>
          )}
          {data.program.status === "paused" && <div className="mb-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4"><p className="font-semibold text-amber-200">Training is paused</p><p className="mt-1 text-xs text-stone-400">Your history and drafts are safe. Resume from Setup before saving another workout.</p></div>}
          {!editingSession && data.program.calibrationRequired && data.program.status !== "paused" && <div className="mb-4 rounded-2xl border border-sky-300/20 bg-sky-300/[0.06] p-4"><p className="font-semibold text-sky-200">{data.program.returnPlan ? `Return session ${data.program.returnPlan.totalSessions - data.program.returnPlan.sessionsRemaining + 1} of ${data.program.returnPlan.totalSessions}` : "Return calibration session"}</p><p className="mt-1 text-xs text-stone-400">{data.program.returnPlan ? `Volume and starting loads are temporarily reduced. Aim for about ${data.program.returnPlan.targetRir} RIR. Progression stays frozen until return mode ends.` : "Use conservative loads. This workout will not adjust SBS training maxes; normal progression resumes afterward."}</p></div>}
          {!day ? (
            <div className="grid min-h-[28rem] place-items-center rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] px-6 text-center">
              <div>
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/[0.06] text-stone-400"><Dumbbell className="size-6" /></div>
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">Nothing scheduled today</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-stone-500">Take the recovery day, or choose one of your sessions above if your week moved around.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div><p className="eyebrow text-stone-500">Readiness · optional</p><p className="mt-1 text-sm font-semibold">{readiness === "normal" ? "Ready" : readiness === "low" ? "Low energy" : readiness === "sore" ? "Unusually sore" : readiness === "severe-soreness" ? "Soreness limits walking" : readiness === "symptoms" ? "Menstrual symptoms" : readiness === "pain" ? "Pain / unsafe" : "How are you arriving today?"}</p></div>
                  <Button type="button" variant="ghost" onClick={() => setReadinessOpen((open) => !open)} aria-expanded={readinessOpen} className="h-10 rounded-xl px-3 text-xs text-amber-300 hover:bg-white/10 hover:text-amber-200">{readinessOpen ? "Done" : readiness ? "Change" : "Check in"}<ChevronDown className={`size-3.5 transition-transform ${readinessOpen ? "rotate-180" : ""}`} /></Button>
                </div>
                {readinessOpen && <div className="motion-pop mt-3 flex flex-wrap gap-2">{([['normal','Ready'],['low','Low energy'],['sore','Unusually sore'],['severe-soreness','Soreness limits walking'],...(profile.gender === 'woman' ? [['symptoms','Menstrual symptoms'] as const] : []),['pain','Pain / unsafe']] as Array<readonly [Readiness, string]>).map(([value, label]) => <Button key={value} type="button" variant="outline" aria-pressed={readiness === value} data-selected={readiness === value} onClick={() => { setReadiness(value); if (value === "normal") setReadinessOpen(false); }} className="selection-button min-h-10 rounded-xl border-white/10 px-3 text-xs">{label}</Button>)}</div>}
                {(readiness === "low" || readiness === "sore" || readiness === "symptoms") && <p className="mt-3 text-xs leading-5 text-amber-200">Consider 5–10% less load, one fewer accessory set, two to three RIR, or postponing.</p>}
                {readiness === "severe-soreness" && <div className="mt-3 flex gap-3 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-xs leading-5 text-red-200"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><p>Do not train while soreness limits normal walking. Seek urgent medical care for dark tea/cola-colored urine, marked swelling, unusual weakness, reduced urination, or pain far beyond expected soreness.</p></div>}
                {readiness === "pain" && <div className="mt-3 flex gap-3 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-xs leading-5 text-red-200"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><p>Do not train through sharp, sudden or worsening pain. Saving is paused until you choose a safe readiness state.</p></div>}
              </div>
              <div className="mb-4"><ConditioningEditor kind="warmup" value={warmup} onChange={setWarmup} /></div>
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="eyebrow text-amber-300">Today&apos;s work</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">{day.exercises.length} movements · {totalSets} working sets</h2>
                </div>
                {currentSession && <span className="hidden rounded-full bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-300 sm:inline-flex"><Check className="mr-1.5 size-3.5" />Saved today</span>}
              </div>

              {restTimer && <div ref={restTimerAnchorRef} className="scroll-mt-24 lg:hidden"><RestTimerPanel timer={restTimer} remaining={restRemaining} permission={alertPermission} wakeLockState={wakeLockState} onClose={closeRestTimer} onAdd={addRestTime} onEnable={() => void enableRestAlerts()} className="mb-4" /></div>}

              <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                <div className="flex items-center justify-between gap-3"><p className="eyebrow text-stone-500">Exercise {activeExerciseIndex + 1} of {day.exercises.length}</p><p className="truncate text-xs font-semibold text-stone-300">{day.exercises[activeExerciseIndex] ? resolvedForExercise(day.exercises[activeExerciseIndex], activeExerciseIndex).name : ""}</p></div>
                <div className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${day.exercises.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Choose an exercise">
                  {day.exercises.map((item, index) => {
                    const itemKey = keyForExercise(item, index);
                    const resolvedItem = resolvedForExercise(item, index);
                    const complete = (log[itemKey] ?? []).filter((entry) => isFilledSet(entry, resolvedItem)).length >= resolvedItem.sets;
                    const locked = index > lastAccessibleExerciseIndex;
                    return <Button key={item.id} type="button" role="tab" aria-selected={activeExerciseIndex === index} aria-label={`${index + 1}. ${resolvedItem.name}${complete ? ", complete" : locked ? ", locked until earlier exercises are complete" : ""}`} variant="outline" data-selected={activeExerciseIndex === index} disabled={locked} onClick={() => goToExercise(index)} className="selection-button h-10 rounded-xl px-0 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-35">{complete ? <Check className="size-3.5" /> : locked ? <Lock className="size-3.5" /> : index + 1}</Button>;
                  })}
                </div>
              </div>

              <div className="space-y-3">
                {day.exercises.map((baseExercise, exerciseIndex) => {
                  if (exerciseIndex !== activeExerciseIndex) return null;
                  const key = keyForExercise(baseExercise, exerciseIndex);
                  const exercise = resolvedForExercise(baseExercise, exerciseIndex);
                  const equipmentProfileKey = loadProfileId(exercise);
                  const availableLoads = loadProfileValues(data.loadProfiles[equipmentProfileKey] ?? data.loadProfiles[key], profile.unit);
                  const sets = log[key] ?? Array.from({ length: exercise.sets }, emptySet);
                  const baseSuggestion = suggestionFor(exercise, key);
                  const suggestion = !editingSession && data.program.returnPlan && baseSuggestion?.value
                    ? {
                        ...baseSuggestion,
                        value: availableLoads.length ? resolveAvailableLoad(baseSuggestion.value * data.program.returnPlan.loadFactor, availableLoads, "nearest") : null,
                        tag: "hold" as const,
                        reason: `Return session ${data.program.returnPlan.totalSessions - data.program.returnPlan.sessionsRemaining + 1} of ${data.program.returnPlan.totalSessions} · conservative starting load · target ${data.program.returnPlan.targetRir} RIR`,
                      }
                    : baseSuggestion;
                  const history = historyFor(key);
                  const last = history.at(-1);
                  const displayName = exercise.name;
                  const guidance = exerciseGuidance(displayName);
                  const prescription = prescriptionFor(exercise);
                  const TagIcon = suggestion?.tag === "up" ? ArrowUpRight : suggestion?.tag === "down" ? ArrowDownRight : Minus;
                  const liveAdjustment = data.program.activeId === "phase1" ? nextSetAdjustment({ exercise, entries: sets, unit: profile.unit, readiness, availableLoads }) : null;
                  const nextSetIndex = sets.findIndex((entry) => !isFilledSet(entry, exercise));

                  return (
                    <article key={exercise.id} className="exercise-card overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#121512] motion-page" style={{ animationDelay: `${Math.min(exerciseIndex, 5) * 55}ms` }}>
                      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_12.5rem]">
                        <div className="min-w-0">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 font-mono text-xs text-stone-600">{String(exerciseIndex + 1).padStart(2, "0")}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-semibold sm:text-lg">{displayName}</h3>
                              </div>
                              <p className="mt-1 font-mono text-[11px] text-stone-500">
                                {prescription
                                  ? prescription.deload
                                    ? `${exercise.sets} × ${prescription.normalReps} · no AMRAP`
                                    : `${exercise.sets - 1} × ${prescription.normalReps} + AMRAP ${prescription.repOutTarget}+`
                                  : `${exercise.sets} × ${exercise.repLow}–${exercise.repHigh}`}
                                {exercise.perSide ? " · each side" : ""} · {formatTimer(exercise.restSeconds)} rest{prescription?.deload ? " · deload" : exercise.note ? ` · ${exercise.note}` : ""}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setOpenSwap(openSwap === exercise.id ? null : exercise.id)}
                              disabled={Boolean(editingSession) || (workingProgramId === "phase2" && Boolean(exercise.sbsRole))}
                              aria-expanded={openSwap === exercise.id}
                              className="h-8 rounded-lg px-2.5 text-[11px] text-stone-400 hover:bg-white/10 hover:text-white"
                            >
                              {workingProgramId === "phase2" && exercise.sbsRole ? "TM-specific lift" : "Swap"} <ChevronDown className={`size-3 transition-transform ${openSwap === exercise.id ? "rotate-180" : ""}`} />
                            </Button>
                          </div>

                          {openSwap === exercise.id && (
                            <div className="motion-pop ml-7 mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-2 sm:grid-cols-2">
                              {[baseExercise.name, ...baseExercise.alternatives].map((option) => {
                                const active = displayName === option;
                                return (
                                  <Button
                                    key={option}
                                    type="button"
                                    variant="ghost"
                                    onClick={() => void applySwap(baseExercise, option === baseExercise.name ? null : option)}
                                    data-selected={active}
                                    className="selection-button h-auto min-h-10 justify-start whitespace-normal rounded-lg px-3 py-2 text-left text-xs"
                                  >
                                    {active && <Check className="size-3.5" />}{option}
                                  </Button>
                                );
                              })}
                            </div>
                          )}

                          <details className="ml-7 mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-stone-400">
                            <summary className="cursor-pointer font-semibold text-stone-300">Technique guide</summary>
                            <p className="mt-3 leading-5"><strong className="text-stone-200">Set up:</strong> {guidance.setup}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 leading-5">{guidance.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
                            <p className="mt-3 leading-5 text-red-200"><strong>Stop:</strong> {guidance.stop}</p>
                          </details>

                          {exerciseNeedsLoad(exercise) && <details className="ml-7 mt-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-stone-400">
                            <summary className="cursor-pointer font-semibold text-stone-300">Available loads {availableLoads.length ? `· ${availableLoads.length} saved` : "· set once for accurate adjustments"}</summary>
                            <p className="mt-3 leading-5 text-stone-500">Choose the exact dumbbells, plates, or machine-stack values available for this exercise. RepArc will never suggest a value outside this list.</p>
                            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">{LOAD_PROFILE_PRESETS.map((preset) => <Button key={preset.label} type="button" variant="outline" onClick={() => void saveLoadProfile(equipmentProfileKey, preset.values.map((value) => preset.unit === profile.unit ? value : convertWeight(value, preset.unit, profile.unit)))} className="selection-button h-auto min-h-9 whitespace-normal rounded-lg px-2 py-1.5 text-[10px]">{preset.label}</Button>)}</div>
                            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Input value={loadProfileDrafts[equipmentProfileKey] ?? availableLoads.join(", ")} onChange={(event) => setLoadProfileDrafts((current) => ({ ...current, [equipmentProfileKey]: event.target.value }))} placeholder="2.5, 5, 7.5, 10…" aria-label={`Available ${profile.unit} loads for ${displayName}`} className="h-9 rounded-lg border-white/10 bg-black/20 font-mono text-[11px]" /><Button type="button" onClick={() => void saveLoadProfile(equipmentProfileKey, (loadProfileDrafts[equipmentProfileKey] ?? availableLoads.join(",")).split(/[,\s]+/).filter(Boolean).map(Number))} className="h-9 rounded-lg bg-amber-300 px-3 text-[11px] font-bold text-[#0b0d0c] hover:bg-amber-200">Save</Button></div>
                            {availableLoads.length > 0 && <div className="mt-2 flex items-start justify-between gap-3"><p className="font-mono text-[10px] leading-4 text-stone-600">{availableLoads.join(" · ")} {profile.unit}</p><button type="button" onClick={() => void clearLoadProfile(equipmentProfileKey)} className="shrink-0 text-[10px] text-stone-500 hover:text-red-300">Clear</button></div>}
                          </details>}

                          <div className="mt-5 grid grid-cols-[1.25rem_repeat(3,minmax(0,1fr))] items-center gap-2">
                            <span />
                            <span className="field-label">{exercise.loadingType === "assisted-bodyweight" ? `Assistance ${profile.unit}` : exercise.loadingType === "bodyweight" || exercise.bodyweight ? `Added ${profile.unit}` : exercise.loadingType === "unloaded" ? "Load optional" : profile.unit}</span>
                            <span className="field-label">Reps</span>
                            <span className="field-label">RIR</span>
                            {sets.flatMap((entry, setIndex) => [
                              <span key={`number-${setIndex}`} className={`text-center font-mono text-xs ${prescription && !prescription.deload && setIndex === exercise.sets - 1 ? "font-bold text-amber-300" : "text-stone-600"}`}>
                                {prescription && !prescription.deload && setIndex === exercise.sets - 1 ? "A" : setIndex + 1}
                              </span>,
                              <Input
                                key={`weight-${setIndex}`}
                                inputMode="decimal"
                                value={entry.w}
                                onChange={(event) => setField(key, setIndex, "w", event.target.value)}
                                onBlur={() => finishSet(key, setIndex)}
                                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                                placeholder={!exerciseNeedsLoad(exercise) ? "0" : suggestion?.value === null ? "—" : String(suggestion?.value ?? "")}
                                aria-label={`${displayName}, set ${setIndex + 1}, weight in ${profile.unit}`}
                                className="set-input"
                              />,
                              <Input
                                key={`reps-${setIndex}`}
                                inputMode="numeric"
                                value={entry.r}
                                onChange={(event) => setField(key, setIndex, "r", event.target.value)}
                                onBlur={() => finishSet(key, setIndex)}
                                onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                                placeholder={last?.entries[key]?.[setIndex]?.r || String(prescription ? (!prescription.deload && setIndex === exercise.sets - 1 ? prescription.repOutTarget : prescription.normalReps) : exercise.repHigh)}
                                aria-label={`${displayName}, set ${setIndex + 1}, reps`}
                                className="set-input"
                              />,
                              <Input
                                key={`rir-${setIndex}`}
                                inputMode="decimal"
                                value={entry.rir}
                                onChange={(event) => setField(key, setIndex, "rir", event.target.value)}
                                placeholder={prescription && !prescription.deload && setIndex === exercise.sets - 1 ? "0" : "2"}
                                aria-label={`${displayName}, set ${setIndex + 1}, reps in reserve`}
                                className="set-input"
                              />,
                            ])}
                          </div>

                          {last && (
                            <p className="ml-7 mt-3 truncate font-mono text-[10px] text-stone-600">
                              Last · {prettyDate(last.date)} · {last.entries[key].filter((entry) => isFilledSet(entry, exercise)).map((entry) => `${entry.w || 0}×${entry.r}${entry.rir !== "" ? ` @${entry.rir}` : ""}`).join("  /  ")}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="target-panel flex flex-row items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4 md:flex-col md:items-start">
                            <div>
                              <p className="eyebrow">Next session target</p>
                              <p className="mt-2 font-mono text-3xl font-semibold tracking-tight">
                                {suggestion?.value === null ? <span className="text-xl">{exercise.loadingType === "bodyweight" ? "Bodyweight" : exercise.loadingType === "assisted-bodyweight" ? "Choose assistance" : exercise.loadingType === "unloaded" ? "No fixed load" : "Choose load"}</span> : <>{suggestion?.value}<span className="ml-1 text-sm text-stone-500">{profile.unit}</span></>}
                              </p>
                            </div>
                            <div className="max-w-[12rem] text-right md:mt-5 md:text-left">
                              {suggestion && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${suggestion.tag === "up" ? "bg-amber-300 text-[#0b0d0c]" : suggestion.tag === "down" ? "bg-red-300 text-[#0b0d0c]" : "bg-white/10 text-stone-400"}`}>
                                  <TagIcon className="size-3" />{suggestion.tag === "estimate" ? "Starting point" : suggestion.tag}
                                </span>
                              )}
                              <p className="mt-2 text-[11px] leading-4 text-stone-500">{suggestion?.reason}</p>
                              {suggestion?.confidence && <p className="mt-1 font-mono text-[9px] uppercase text-stone-600">{suggestion.confidence} confidence</p>}
                            </div>
                          </div>
                          {liveAdjustment && (
                            <div className={`rounded-2xl border p-4 ${liveAdjustment.action === "stop" ? "border-red-300/25 bg-red-300/[0.06]" : "border-amber-300/20 bg-amber-300/[0.04]"}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-xs font-semibold"><TrendingUp className="size-3.5" />Next-set adjustment</p><span className="font-mono text-[9px] uppercase text-stone-500">{liveAdjustment.confidence}</span></div>
                              <p className="mt-2 text-[11px] leading-4 text-stone-400">{liveAdjustment.reason}</p>
                              <p className="mt-1 font-mono text-[9px] text-stone-600">{liveAdjustment.evidence.join(" · ")}</p>
                              {nextSetIndex >= 0 && liveAdjustment.nextLoad !== null && liveAdjustment.action !== "stop" && <Button type="button" variant="ghost" onClick={() => setField(key, nextSetIndex, "w", String(liveAdjustment.nextLoad))} className="mt-2 h-8 rounded-lg px-2 text-[11px] text-amber-300 hover:bg-white/10 hover:text-amber-200">{liveAdjustment.action === "hold" ? "Keep" : "Use"} {liveAdjustment.nextLoad} {profile.unit}</Button>}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" disabled={activeExerciseIndex === 0} onClick={() => goToExercise(activeExerciseIndex - 1)} className="h-11 rounded-xl border-white/10 bg-white/[0.035] text-stone-300">Previous</Button>
                <Button type="button" disabled={activeExerciseIndex === day.exercises.length - 1 || !exerciseIsComplete(activeExerciseIndex)} onClick={() => goToExercise(activeExerciseIndex + 1)} className="h-11 rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">{exerciseIsComplete(activeExerciseIndex) ? "Next exercise" : "Complete kg & reps"}</Button>
              </div>

              <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-5 text-stone-500"><summary className="cursor-pointer font-semibold text-stone-300">{data.program.activeId === "phase2" ? "What does AMRAP mean?" : "What does RIR mean?"}</summary><p className="mt-3">{data.program.activeId === "phase2" ? "For SBS lifts, complete the normal sets, then take the final set to technical failure. That result adjusts next week’s training max. Deload weeks skip the AMRAP." : "RIR means reps in reserve. Aim for roughly 1–3 on working sets. Leave it blank if you are unsure; reps and load still count."}</p></details>

              <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4" aria-label="Session effort">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><p className="eyebrow text-stone-500">Session effort · optional</p><p className="mt-1 text-xs text-stone-400">{sessionRpe === null ? "Add a 1–10 whole-workout effort rating" : `Recorded ${sessionRpe} / 10`}</p></div><ChevronDown className="size-4 text-stone-500" /></summary>
                <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-stone-500">This improves the daily report and never overrides set performance.</p>{sessionRpe !== null && <button type="button" onClick={() => setSessionRpe(null)} className="text-[11px] text-stone-500 hover:text-white">Clear</button>}</div>
                <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10">{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <Button key={value} type="button" variant="outline" aria-pressed={sessionRpe === value} data-selected={sessionRpe === value} onClick={() => setSessionRpe(value)} className="selection-button h-10 rounded-lg border-white/10 px-0 font-mono text-xs">{value}</Button>)}</div>
              </details>

              <div className="mt-4"><ConditioningEditor kind="post" value={postCardio} onChange={setPostCardio} /></div>

              <div className="mt-5 hidden items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-[#121512] p-4 lg:flex">
                <div>
                  <p className="text-sm font-semibold">{currentSession ? "Update today’s session" : "Ready to lock it in?"}</p>
                  <p className="mt-1 text-xs text-stone-500">Your entries stay on screen after saving, so you can correct anything without losing the session.</p>
                </div>
                <Button onClick={() => void saveSession()} disabled={syncState === "saving" || data.program.status === "paused" || readiness === "pain" || readiness === "severe-soreness"} className="h-12 min-w-48 rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">
                  {syncState === "saving" ? "Saving…" : currentSession ? "Update session" : "Save session"}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>}

      {view === "guide" && <TrainingGuide />}

      {view === "progress" && <ProgressView data={data} onUpdate={persist} onEditSession={editSession} />}
      {view === "settings" && (
        <SettingsView
          account={account}
          name={name}
          data={data}
          pwa={pwa}
          onUpdate={persist}
          onRestore={(next, mode) => persist(next, mode === "merge" ? "Backup merged" : "Backup restored", mode)}
          onSignOut={onSignOut}
          onDeleteAccount={onDeleteAccount}
          onRename={renameProfile}
          restAlertLevel={restAlertLevel}
          alertPermission={alertPermission}
          wakeLockState={wakeLockState}
          isStandalone={isStandalone}
          onRestAlertLevelChange={setRestAlertLevel}
          onEnableRestAlerts={enableRestAlerts}
          onTestRestAlert={testRestAlert}
        />
      )}

      {view === "train" && day && restTimer && (
        <RestTimerPanel timer={restTimer} remaining={restRemaining} permission={alertPermission} wakeLockState={wakeLockState} onClose={closeRestTimer} onAdd={addRestTime} onEnable={() => void enableRestAlerts()} className="fixed bottom-5 right-5 z-50 hidden w-[22rem] lg:block" />
      )}

      {view === "train" && day && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0d0c]/95 px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden">
          {notice && <p className={`motion-notice mb-2 text-center text-xs ${notice.includes("Could not") || notice.includes("at least") ? "text-red-300" : "text-amber-300"}`} role="status">{notice}</p>}
          <Button onClick={() => void saveSession()} disabled={syncState === "saving" || data.program.status === "paused" || readiness === "pain" || readiness === "severe-soreness"} className="h-[3.25rem] w-full rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">
            {syncState === "saving" ? "Saving…" : currentSession ? "Update session" : `Save session · ${completedSets}/${totalSets}`}
          </Button>
        </div>
      )}

    </main>
  );
}
