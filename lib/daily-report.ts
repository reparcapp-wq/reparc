import { nextSessionAdjustment, type AdjustmentConfidence, type LoadAdjustment } from "@/lib/autoregulation";
import {
  activeSessions,
  convertWeight,
  effectiveExerciseLoad,
  estimatedOneRepMax,
  exerciseFromKey,
  exerciseName,
  isFilledSet,
  numeric,
  sessionPlannedSets,
  sessionCountsAsCompletedDay,
  type Session,
  type TrainingData,
} from "@/lib/training";

export type ScheduleAdherence = {
  available: boolean;
  expectedSessions: number;
  completedSessions: number;
  adherencePercent: number | null;
};

export function buildScheduleAdherence(data: TrainingData, startDate: string, endDate: string, asOfDate = new Date().toISOString().slice(0, 10)): ScheduleAdherence {
  if (!data.profile || startDate > endDate) return { available: false, expectedSessions: 0, completedSessions: 0, adherencePercent: null };
  const effectiveEnd = endDate < asOfDate ? endDate : asOfDate;
  if (startDate > effectiveEnd) return { available: true, expectedSessions: 0, completedSessions: 0, adherencePercent: null };
  const history = [...data.planHistory].sort((left, right) => left.effectiveAt.localeCompare(right.effectiveAt));
  const setupDate = data.setupCompletedAt?.slice(0, 10);
  const trackingStart = setupDate && setupDate > startDate ? setupDate : startDate;
  if (!history.length || trackingStart < history[0].effectiveAt.slice(0, 10)) return { available: false, expectedSessions: 0, completedSessions: 0, adherencePercent: null };
  let expectedSessions = 0;
  for (let cursor = new Date(`${startDate}T12:00:00.000Z`), end = new Date(`${effectiveEnd}T12:00:00.000Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    if (setupDate && date < setupDate) continue;
    const plan = history.filter((change) => change.effectiveAt.slice(0, 10) <= date).at(-1);
    const status = plan?.status ?? data.program.status;
    const preferredWeekdays = plan?.preferredWeekdays ?? data.program.preferredWeekdays;
    if (status === "active" && preferredWeekdays.includes(cursor.getUTCDay())) expectedSessions += 1;
  }
  const completedSessions = new Set(activeSessions(data)
    .filter((session) => session.date >= startDate && session.date <= effectiveEnd && sessionCountsAsCompletedDay(session, data))
    .map((session) => session.logicalKey ?? session.id)).size;
  return {
    available: true,
    expectedSessions,
    completedSessions,
    adherencePercent: expectedSessions ? Math.min(100, Math.round((completedSessions / expectedSessions) * 100)) : null,
  };
}

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
  possiblePerformanceImprovements: number;
  confidence: AdjustmentConfidence;
  headline: string;
  summary: string;
  exercises: DailyExerciseReport[];
};

const exerciseForSession = (session: Session, key: string) => {
  const snapshot = session.planSnapshot?.exercises.find((exercise) => exercise.key === key);
  return snapshot ? { ...snapshot, alternatives: [] } : exerciseFromKey(key);
};

const bestEstimatedMax = (session: Session, key: string, fallbackBodyweight: number, targetUnit: "kg" | "lb") => {
  const exercise = exerciseForSession(session, key);
  if (!exercise) return 0;
  if (exercise.loadingType === "unloaded") return 0;
  return (session.entries[key] ?? []).reduce((best, entry) => {
    if (!isFilledSet(entry, exercise)) return best;
    const reps = numeric(entry.r);
    if (reps < 4 || reps > 10) return best;
    const externalLoad = convertWeight(numeric(entry.w), session.unit, targetUnit);
    const bodyweight = session.bodyweightAtSession === undefined ? fallbackBodyweight : convertWeight(session.bodyweightAtSession, session.unit, targetUnit);
    const effectiveLoad = effectiveExerciseLoad(exercise, externalLoad, bodyweight);
    return Math.max(best, estimatedOneRepMax(effectiveLoad, reps));
  }, 0);
};

const plannedSetsFor = (data: TrainingData, session: Session) => {
  return sessionPlannedSets(session, data);
};

export function buildDailyReport(data: TrainingData, date: string): DailyReport {
  const profile = data.profile!;
  const allSessions = activeSessions(data);
  const sessions = allSessions.filter((session) => session.date === date);
  const earlier = allSessions.filter((session) => session.date < date);
  const keys = [...new Set(sessions.flatMap((session) => Object.keys(session.entries)))].filter((key) => sessions.some((session) => Boolean(exerciseForSession(session, key))));
  const plannedSets = sessions.reduce((sum, session) => sum + plannedSetsFor(data, session), 0);
  const completedSets = sessions.reduce((sum, session) => sum + Object.entries(session.entries).reduce((inner, [key, entries]) => {
    const exercise = exerciseForSession(session, key);
    return inner + entries.filter((entry) => isFilledSet(entry, exercise)).length;
  }, 0), 0);
  const completedEntries = sessions.flatMap((session) => Object.entries(session.entries).flatMap(([key, entries]) => {
    const exercise = exerciseForSession(session, key);
    return entries.filter((entry) => isFilledSet(entry, exercise)).map((entry) => ({ session, exercise, entry }));
  }));
  const rirValues = completedEntries.filter(({ entry }) => entry.rir !== "").map(({ entry }) => numeric(entry.rir));
  const sessionRpes = sessions.flatMap((session) => typeof session.sessionRpe === "number" ? [session.sessionRpe] : []);
  const totalReps = completedEntries.reduce((sum, { entry }) => sum + numeric(entry.r), 0);
  const loadedVolume = completedEntries.reduce((sum, { session, entry }) => sum + convertWeight(numeric(entry.w), session.unit, profile.unit) * numeric(entry.r), 0);

  const exercises: DailyExerciseReport[] = keys.map((key) => {
    const exerciseSessions = sessions.filter((session) => session.entries[key]);
    const exercise = exerciseForSession(exerciseSessions.at(-1)!, key)!;
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
  const possiblePerformanceImprovements = performanceImprovements;
  const establishedPerformanceImprovements = exercises.filter((exercise) => {
    const history = earlier.filter((session) => session.entries[exercise.key]).sort((left, right) => left.date.localeCompare(right.date) || left.createdAt.localeCompare(right.createdAt));
    if (history.length < 2) return false;
    const previous = history.at(-1)!;
    const baseline = Math.max(0, ...history.slice(0, -1).map((session) => bestEstimatedMax(session, exercise.key, profile.bodyweight, profile.unit)));
    const previousBest = bestEstimatedMax(previous, exercise.key, profile.bodyweight, profile.unit);
    return baseline > 0 && previousBest >= baseline * 1.025 && exercise.bestEstimatedMax >= previousBest * 0.99;
  }).length;
  const status: DailyReportStatus = !sessions.length ? "recovery" : completionPercent >= 100 ? "completed" : completionPercent >= 70 ? "adjusted" : "partial";
  const confidence: AdjustmentConfidence = completionPercent >= 100 && rirCoveragePercent >= 60
    ? "high"
    : completionPercent >= 70 && (rirCoveragePercent >= 30 || completedSets >= 6)
      ? "moderate"
      : "low";
  const label = status === "completed" ? "Completed as planned" : status === "adjusted" ? "Productively adjusted" : status === "partial" ? "Partial session" : "Recovery day";
  const headline = !sessions.length
    ? "No workout was recorded."
    : establishedPerformanceImprovements > 0
      ? `${establishedPerformanceImprovements} exercise${establishedPerformanceImprovements === 1 ? "" : "s"} repeated a positive performance trend.`
      : possiblePerformanceImprovements > 0
        ? `${possiblePerformanceImprovements} exercise${possiblePerformanceImprovements === 1 ? "" : "s"} showed a possible improvement that needs another comparable exposure.`
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
    performanceImprovements: establishedPerformanceImprovements,
    possiblePerformanceImprovements,
    confidence,
    headline,
    summary,
    exercises,
  };
}
