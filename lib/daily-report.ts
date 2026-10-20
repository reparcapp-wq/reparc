import { type AdjustmentConfidence, type LoadAdjustment } from "@/lib/autoregulation";
import { comparablePerformanceScore, performanceScorePoint } from "./performance-score";
import { measuredSessionDuration } from "./session-duration";
import {
  activeSessions,
  comparableExerciseHistory,
  convertWeight,
  externalLoadVolume,
  exerciseFromKey,
  isFilledSet,
  isScheduledTrainingDate,
  loadProfileId,
  numeric,
  resolvedSessionScheduleDates,
  sessionPlannedSets,
  sessionCompletedPlannedSets,
  sessionCountsAsCompletedDay,
  type Session,
  type TrainingData,
} from "@/lib/training";

export type ScheduleAdherence = {
  available: boolean;
  expectedSessions: number;
  completedSessions: number;
  loggedSessions: number;
  adherencePercent: number | null;
  movedSessions: number;
  skippedSessions: number;
  sorenessRecoverySessions: number;
  externalSessions: number;
  plannedBreakDays: number;
};

export function buildScheduleAdherence(data: TrainingData, startDate: string, endDate: string, asOfDate = new Date().toISOString().slice(0, 10)): ScheduleAdherence {
  const empty = { movedSessions: 0, skippedSessions: 0, sorenessRecoverySessions: 0, externalSessions: 0, plannedBreakDays: 0 };
  if (!data.profile || startDate > endDate) return { available: false, expectedSessions: 0, completedSessions: 0, loggedSessions: 0, adherencePercent: null, ...empty };
  const effectiveEnd = endDate < asOfDate ? endDate : asOfDate;
  if (startDate > effectiveEnd) return { available: true, expectedSessions: 0, completedSessions: 0, loggedSessions: 0, adherencePercent: null, ...empty };
  const history = [...data.planHistory].sort((left, right) => left.effectiveAt.localeCompare(right.effectiveAt));
  const setupDate = data.setupCompletedAt?.slice(0, 10);
  const trackingStart = setupDate && setupDate > startDate ? setupDate : startDate;
  if (!history.length || trackingStart < history[0].effectiveAt.slice(0, 10)) return { available: false, expectedSessions: 0, completedSessions: 0, loggedSessions: 0, adherencePercent: null, ...empty };
  const relevantAbsences = data.absences.filter((record) => record.endDate >= startDate && record.startDate <= effectiveEnd);
  const inRange = (date: string) => date >= trackingStart && date <= effectiveEnd;
  const plannedDates = new Set(relevantAbsences.filter((record) => record.reason === "planned" || record.resolution === "pause").flatMap((record) => record.missedDates.filter(inRange)));
  const expectedDates = new Set<string>();
  for (let cursor = new Date(`${startDate}T12:00:00.000Z`), end = new Date(`${effectiveEnd}T12:00:00.000Z`); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    if (setupDate && date < setupDate) continue;
    const plan = history.filter((change) => change.effectiveAt.slice(0, 10) <= date).at(-1);
    const status = plan?.status ?? data.program.status;
    const preferredWeekdays = plan?.preferredWeekdays ?? data.program.preferredWeekdays;
    if (status === "active" && preferredWeekdays.includes(cursor.getUTCDay()) && !plannedDates.has(date)) expectedDates.add(date);
  }
  const expectedSessions = expectedDates.size;
  const scheduleDates = resolvedSessionScheduleDates(data);
  const completedInRange = activeSessions(data).filter((session) => {
    const scheduledDate = scheduleDates.get(session.id) ?? session.date;
    return inRange(scheduledDate) && session.date <= asOfDate && sessionCountsAsCompletedDay(session, data);
  });
  const loggedSessions = new Set(completedInRange
    .map((session) => session.logicalKey ?? session.id)).size;
  const movedSessions = completedInRange.filter((session) => (scheduleDates.get(session.id) ?? session.date) !== session.date).length;
  const recordedDates = new Set(completedInRange.map((session) => scheduleDates.get(session.id) ?? session.date).filter((date) => expectedDates.has(date)));
  const externalDates = new Set(relevantAbsences
    .filter((record) => record.resolution === "trained-elsewhere")
    .flatMap((record) => record.missedDates).filter((date) => expectedDates.has(date) && !recordedDates.has(date)));
  const completedDates = new Set([...recordedDates, ...externalDates]);
  const skippedSessions = new Set(relevantAbsences.filter((record) => record.resolution === "skip").flatMap((record) => record.missedDates).filter((date) => expectedDates.has(date) && !completedDates.has(date))).size;
  const sorenessRecoverySessions = new Set(relevantAbsences.filter((record) => record.resolution === "skip" && record.reason === "soreness").flatMap((record) => record.missedDates).filter((date) => expectedDates.has(date) && !completedDates.has(date))).size;
  const externalSessions = externalDates.size;
  const completedSessions = completedDates.size;
  return {
    available: true,
    expectedSessions,
    completedSessions,
    loggedSessions,
    adherencePercent: expectedSessions ? Math.min(100, Math.round((completedSessions / expectedSessions) * 100)) : null,
    movedSessions,
    skippedSessions,
    sorenessRecoverySessions,
    externalSessions,
    plannedBreakDays: plannedDates.size,
  };
}

export type DailyReportStatus = "completed" | "adjusted" | "partial" | "recovery" | "missed" | "moved";

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
  completedPlannedSets: number;
  totalReps: number;
  loadedVolume: number;
  averageRir: number | null;
  rirCoveragePercent: number;
  averageSessionRpe: number | null;
  totalDurationSeconds: number | null;
  warmupMinutes: number;
  postCardioMinutes: number;
  performanceImprovements: number;
  possiblePerformanceImprovements: number;
  confidence: AdjustmentConfidence;
  headline: string;
  summary: string;
  performedOnDates: string[];
  sessionNames: string[];
  exercises: DailyExerciseReport[];
};

const exerciseForSession = (session: Session, key: string) => {
  const snapshot = session.planSnapshot?.exercises.find((exercise) => exercise.key === key);
  return snapshot ? { ...snapshot, alternatives: [] } : exerciseFromKey(key);
};

const plannedSetsFor = (data: TrainingData, session: Session) => {
  return sessionPlannedSets(session, data);
};

export function buildDailyReport(data: TrainingData, date: string): DailyReport {
  const profile = data.profile!;
  const allSessions = activeSessions(data);
  const scheduleDates = resolvedSessionScheduleDates(data);
  // Reports are filed under the calendar slot the workout fulfilled. The
  // actual performance date remains on the session for audit/recovery logic.
  const sessions = allSessions.filter((session) => (scheduleDates.get(session.id) ?? session.date) === date);
  const performedOnDates = [...new Set(sessions
    .filter((session) => session.date !== date)
    .map((session) => session.date))].sort();
  const sessionNames = [...new Set(sessions.map((session) => session.planSnapshot?.dayName ?? session.dayId))];
  const sorenessRecovery = data.absences.some((record) => record.reason === "soreness" && record.resolution === "skip" && record.missedDates.includes(date));
  const currentOccurrences = sessions
    .flatMap((session) => Object.entries(session.entries).flatMap(([key, entries]) => {
      const exercise = exerciseForSession(session, key);
      return exercise ? [{ session, key, exercise, entries }] : [];
    }))
    .sort((left, right) => left.session.createdAt.localeCompare(right.session.createdAt));
  const occurrencesByExercise = new Map<string, typeof currentOccurrences>();
  currentOccurrences.forEach((occurrence) => {
    const identity = loadProfileId(occurrence.exercise);
    occurrencesByExercise.set(identity, [...(occurrencesByExercise.get(identity) ?? []), occurrence]);
  });
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
  const loadedVolume = completedEntries.reduce((sum, { session, exercise, entry }) =>
    sum + externalLoadVolume(exercise, convertWeight(numeric(entry.w), session.unit, profile.unit), numeric(entry.r)), 0);

  const establishedImprovementIds = new Set<string>();
  const exercises: DailyExerciseReport[] = [...occurrencesByExercise.entries()].map(([identity, occurrences]) => {
    const latest = occurrences.at(-1)!;
    const exercise = latest.exercise;
    const completed = occurrences.flatMap((occurrence) => occurrence.entries.filter((entry) => isFilledSet(entry, occurrence.exercise)));
    const point = performanceScorePoint(latest.session, latest.key, profile.unit);
    const todayBest = point?.value ?? 0;
    const history = [...new Map(comparableExerciseHistory(data, exercise)
      .filter((occurrence) => occurrence.session.date < latest.session.date)
      .map((occurrence) => performanceScorePoint(occurrence.session, occurrence.key, profile.unit))
      .filter((prior) => comparablePerformanceScore(point, prior))
      .map((prior) => [prior!.date, prior!])).values()];
    const priorBest = Math.max(0, ...history.map((prior) => prior.value));
    const changePercent = priorBest > 0 && todayBest > 0 ? ((todayBest - priorBest) / priorBest) * 100 : null;
    if (history.length >= 2) {
      const previous = history.at(-1)!;
      const baseline = Math.max(0, ...history.slice(0, -1).map((prior) => prior.value));
      const previousBest = previous.value;
      if (baseline > 0 && previousBest >= baseline * 1.05 && todayBest >= previousBest * 0.99) establishedImprovementIds.add(identity);
    }
    const unsafe = latest.session.readiness === "pain" || latest.session.readiness === "severe-soreness"
      || data.exerciseRecovery.some((check) => check.sessionId === latest.session.id && check.exerciseIdentity === identity && (check.status === "limiting" || check.status === "severe"));
    return {
      key: identity,
      name: exercise.name,
      completedSets: completed.length,
      plannedSets: occurrences.reduce((sum, occurrence) => sum + occurrence.exercise.sets, 0),
      totalReps: completed.reduce((sum, entry) => sum + numeric(entry.r), 0),
      bestEstimatedMax: todayBest,
      priorBestEstimatedMax: priorBest,
      changePercent,
      recommendation: unsafe
        ? { action: "stop", nextLoad: null, confidence: "low", reason: "Pain or movement-limiting recovery was recorded. Do not train this area while movement is limited. Check recovery before resuming.", evidence: ["recorded pain / adverse recovery"] }
        : { action: "hold", nextLoad: null, confidence: "low", reason: latest.session.skippedExerciseKeys?.includes(latest.key)
          ? "This exercise was stopped. Check that it is suitable and comfortable before resuming; open Train for its current target."
          : "Open Train for the next load and reps. It checks your current recovery, starting level, equipment and program together; this past report does not prescribe a new weight.", evidence: ["historical report; current prescription stays in Train"] },
    };
  });

  const completedPlannedSets = sessions.reduce((sum, session) => sum + sessionCompletedPlannedSets(session, data), 0);
  const completionPercent = plannedSets ? Math.min(100, Math.round((completedPlannedSets / plannedSets) * 100)) : 0;
  const averageRir = rirValues.length ? rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length : null;
  const rirCoveragePercent = completedEntries.length ? Math.round((rirValues.length / completedEntries.length) * 100) : 0;
  const averageSessionRpe = sessionRpes.length ? sessionRpes.reduce((sum, value) => sum + value, 0) / sessionRpes.length : null;
  const durations = sessions.flatMap((session) => { const duration = measuredSessionDuration(session); return duration === null ? [] : [duration]; });
  const totalDurationSeconds = durations.length ? durations.reduce((sum, value) => sum + value, 0) : null;
  const warmupMinutes = sessions.reduce((sum, session) => sum + (session.warmup?.durationMinutes ?? 0), 0);
  const postCardioMinutes = sessions.reduce((sum, session) => sum + (session.postCardio?.durationMinutes ?? 0), 0);
  const performanceImprovements = exercises.filter((exercise) => exercise.changePercent !== null && exercise.changePercent >= 5).length;
  const possiblePerformanceImprovements = performanceImprovements;
  const establishedPerformanceImprovements = establishedImprovementIds.size;
  const status: DailyReportStatus = !sessions.length
    ? sorenessRecovery ? "recovery" : isScheduledTrainingDate(data, date) ? "missed" : "recovery"
    : completionPercent >= 100 ? "completed" : completionPercent >= 70 ? "adjusted" : "partial";
  const confidence: AdjustmentConfidence = completionPercent >= 100 && rirCoveragePercent >= 60
    ? "high"
    : completionPercent >= 70 && (rirCoveragePercent >= 30 || completedSets >= 6)
      ? "moderate"
      : "low";
  const performedLaterLabel = performedOnDates.map((value) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })).join(" and ");
  const label = performedOnDates.length
    ? `Completed on ${performedLaterLabel}`
    : sessions.length > 1 ? `${sessions.length} workouts recorded` : status === "completed" ? "Completed as planned" : status === "adjusted" ? "Productively adjusted" : status === "partial" ? "Partial session" : status === "missed" ? "Scheduled workout not recorded" : sorenessRecovery ? "Soreness recovery recorded" : "Recovery day";
  const headline = !sessions.length
    ? status === "missed" ? "A scheduled workout was not recorded." : sorenessRecovery ? "This planned workout was skipped for recovery." : "No workout was recorded."
    : sessions.length > 1
      ? `${sessions.length} separate workouts were completed on this date.`
    : establishedPerformanceImprovements > 0
      ? `${establishedPerformanceImprovements} exercise${establishedPerformanceImprovements === 1 ? "" : "s"} repeated a higher first-set load–rep score at the same reported effort. This is not measured strength gain.`
      : possiblePerformanceImprovements > 0
        ? `${possiblePerformanceImprovements} exercise${possiblePerformanceImprovements === 1 ? "" : "s"} recorded a higher first-set load–rep score at the same reported effort. Confirm it with another comparable workout.`
      : completionPercent >= 100
        ? "The planned work was completed. Open progress analysis to review comparable exercise results."
        : "Today adds useful history, but the incomplete workout is not enough to support an increase.";
  const summary = !sessions.length
    ? status === "missed"
      ? "This date was on your saved training schedule. Record time away or a workout performed elsewhere to keep adherence context accurate."
      : sorenessRecovery
        ? "You recorded movement-limiting soreness. No performance was invented; the scheduled session remains visible in adherence context and the next session uses conservative return mode."
        : "Recovery days are part of the program. RepArc does not grade rest as a missed workout."
    : performedOnDates.length
      ? `${completedPlannedSets} of ${plannedSets} planned sets are filed under this missed workout date. You actually trained on ${performedOnDates.map((value) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })).join(" and ")}; the workout is shown here only, not duplicated on that day.`
    : sessions.length > 1
      ? `${sessionNames.join(" and ")} remain separate workout records. These totals combine only the work actually performed on this date; RepArc does not require missed sessions to be doubled up.`
      : `${completedPlannedSets} of ${plannedSets} planned sets were recorded${completedSets > completedPlannedSets ? `, plus ${completedSets - completedPlannedSets} extra sets that do not replace missing planned work` : ""}${averageRir === null ? ". Reps-left estimates were not recorded consistently, so weight advice remains conservative." : ` with ${averageRir.toFixed(1)} good reps left on average.`}`;

  return {
    date,
    status,
    label,
    sessions: sessions.length,
    completedSets,
    completedPlannedSets,
    plannedSets,
    completionPercent,
    totalReps,
    loadedVolume,
    averageRir,
    rirCoveragePercent,
    averageSessionRpe,
    totalDurationSeconds,
    warmupMinutes,
    postCardioMinutes,
    performanceImprovements: establishedPerformanceImprovements,
    possiblePerformanceImprovements,
    confidence,
    headline,
    summary,
    performedOnDates,
    sessionNames,
    exercises,
  };
}
