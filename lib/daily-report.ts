import { nextSessionAdjustment, type AdjustmentConfidence, type LoadAdjustment } from "@/lib/autoregulation";
import {
  activeSessions,
  convertWeight,
  estimatedOneRepMax,
  exerciseFromKey,
  exerciseName,
  isFilledSet,
  numeric,
  programDays,
  trainingTrack,
  type Session,
  type TrainingData,
} from "@/lib/training";

export type DailyReportStatus = "completed" | "adjusted" | "partial" | "recovery";

export type DailyExerciseReport = {
  key: string;
  name: string;
  completedSets: number;
  plannedSets: number;
  totalReps: number;
  bestEstimatedMax: number;
  priorBestEstimatedMax: number;
  changePercent: number | null;
  recommendation: LoadAdjustment | null;
};

export type DailyReport = {
  date: string;
  status: DailyReportStatus;
  label: string;
  sessions: number;
  completedSets: number;
  plannedSets: number;
  completionPercent: number;
  totalReps: number;
  loadedVolume: number;
  averageRir: number | null;
  rirCoveragePercent: number;
  averageSessionRpe: number | null;
  totalDurationSeconds: number | null;
  performanceImprovements: number;
  confidence: AdjustmentConfidence;
  headline: string;
  summary: string;
  exercises: DailyExerciseReport[];
};

const bestEstimatedMax = (session: Session, key: string, bodyweight: number, targetUnit: "kg" | "lb") => {
  const exercise = exerciseFromKey(key);
  if (!exercise) return 0;
  return (session.entries[key] ?? []).reduce((best, entry) => {
    if (!isFilledSet(entry, exercise)) return best;
    const externalLoad = convertWeight(numeric(entry.w), session.unit, targetUnit);
    const effectiveLoad = exercise.bodyweight ? bodyweight + externalLoad : externalLoad;
    return Math.max(best, estimatedOneRepMax(effectiveLoad, numeric(entry.r)));
  }, 0);
};

const plannedSetsFor = (data: TrainingData, session: Session) => {
  const profile = data.profile!;
  const programId = session.programId ?? data.program.activeId;
  const frequency = session.programFrequency ?? data.program.frequency;
  const track = profile.programTrack ?? trainingTrack(profile.gender);
  return programDays(programId, frequency, track, profile.goal, profile.equipment)
    .find((day) => day.id === session.dayId)?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;
};

export function buildDailyReport(data: TrainingData, date: string): DailyReport {
  const profile = data.profile!;
  const allSessions = activeSessions(data);
  const sessions = allSessions.filter((session) => session.date === date);
  const earlier = allSessions.filter((session) => session.date < date);
  const keys = [...new Set(sessions.flatMap((session) => Object.keys(session.entries)))].filter((key) => Boolean(exerciseFromKey(key)));
  const plannedSets = sessions.reduce((sum, session) => sum + plannedSetsFor(data, session), 0);
  const completedSets = sessions.reduce((sum, session) => sum + Object.entries(session.entries).reduce((inner, [key, entries]) => {
    const exercise = exerciseFromKey(key);
    return inner + entries.filter((entry) => isFilledSet(entry, exercise)).length;
  }, 0), 0);
  const completedEntries = sessions.flatMap((session) => Object.entries(session.entries).flatMap(([key, entries]) => {
    const exercise = exerciseFromKey(key);
    return entries.filter((entry) => isFilledSet(entry, exercise)).map((entry) => ({ session, exercise, entry }));
  }));
  const rirValues = completedEntries.filter(({ entry }) => entry.rir !== "").map(({ entry }) => numeric(entry.rir));
  const sessionRpes = sessions.flatMap((session) => typeof session.sessionRpe === "number" ? [session.sessionRpe] : []);
  const totalReps = completedEntries.reduce((sum, { entry }) => sum + numeric(entry.r), 0);
  const loadedVolume = completedEntries.reduce((sum, { session, entry }) => sum + convertWeight(numeric(entry.w), session.unit, profile.unit) * numeric(entry.r), 0);

  const exercises: DailyExerciseReport[] = keys.map((key) => {
    const exercise = exerciseFromKey(key)!;
    const exerciseSessions = sessions.filter((session) => session.entries[key]);
    const entries = exerciseSessions.flatMap((session) => session.entries[key] ?? []);
    const completed = entries.filter((entry) => isFilledSet(entry, exercise));
    const todayBest = Math.max(0, ...exerciseSessions.map((session) => bestEstimatedMax(session, key, profile.bodyweight, profile.unit)));
    const priorBest = Math.max(0, ...earlier.filter((session) => session.entries[key]).map((session) => bestEstimatedMax(session, key, profile.bodyweight, profile.unit)));
    const changePercent = priorBest > 0 && todayBest > 0 ? ((todayBest - priorBest) / priorBest) * 100 : null;
    const lastSession = exerciseSessions.at(-1);
    const recommendationEntries = (lastSession?.entries[key] ?? []).map((entry) => entry.w === "" ? entry : { ...entry, w: String(convertWeight(numeric(entry.w), lastSession?.unit ?? profile.unit, profile.unit)) });
    return {
      key,
      name: exerciseName(key),
      completedSets: completed.length,
      plannedSets: exercise.sets * exerciseSessions.length,
      totalReps: completed.reduce((sum, entry) => sum + numeric(entry.r), 0),
      bestEstimatedMax: todayBest,
      priorBestEstimatedMax: priorBest,
      changePercent,
      recommendation: nextSessionAdjustment({ exercise, entries: recommendationEntries, unit: profile.unit, readiness: lastSession?.readiness }),
    };
  });

  const completionPercent = plannedSets ? Math.min(100, Math.round((completedSets / plannedSets) * 100)) : sessions.length ? 100 : 0;
  const averageRir = rirValues.length ? rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length : null;
  const rirCoveragePercent = completedEntries.length ? Math.round((rirValues.length / completedEntries.length) * 100) : 0;
  const averageSessionRpe = sessionRpes.length ? sessionRpes.reduce((sum, value) => sum + value, 0) / sessionRpes.length : null;
  const durations = sessions.flatMap((session) => typeof session.durationSeconds === "number" && session.durationSeconds >= 0 ? [session.durationSeconds] : []);
  const totalDurationSeconds = durations.length ? durations.reduce((sum, value) => sum + value, 0) : null;
  const performanceImprovements = exercises.filter((exercise) => exercise.changePercent !== null && exercise.changePercent >= 2.5).length;
  const status: DailyReportStatus = !sessions.length ? "recovery" : completionPercent >= 100 ? "completed" : completionPercent >= 70 ? "adjusted" : "partial";
  const confidence: AdjustmentConfidence = completionPercent >= 100 && rirCoveragePercent >= 60
    ? "high"
    : completionPercent >= 70 && (rirCoveragePercent >= 30 || completedSets >= 6)
      ? "moderate"
      : "low";
  const label = status === "completed" ? "Completed as planned" : status === "adjusted" ? "Productively adjusted" : status === "partial" ? "Partial session" : "Recovery day";
  const headline = !sessions.length
    ? "No workout was recorded."
    : performanceImprovements > 0
      ? `${performanceImprovements} exercise${performanceImprovements === 1 ? "" : "s"} showed a positive performance signal.`
      : completionPercent >= 100
        ? "The planned work was completed without a clear performance change."
        : "Today adds useful history, but the incomplete plan limits progression confidence.";
  const summary = !sessions.length
    ? "Recovery days are part of the program. RepArc does not grade rest as a missed workout."
    : `${completedSets} of ${plannedSets || completedSets} planned sets were recorded${averageRir === null ? ". RIR was not recorded consistently, so load advice is conservative." : ` at ${averageRir.toFixed(1)} average RIR.`}`;

  return {
    date,
    status,
    label,
    sessions: sessions.length,
    completedSets,
    plannedSets,
    completionPercent,
    totalReps,
    loadedVolume,
    averageRir,
    rirCoveragePercent,
    averageSessionRpe,
    totalDurationSeconds,
    performanceImprovements,
    confidence,
    headline,
    summary,
    exercises,
  };
}
