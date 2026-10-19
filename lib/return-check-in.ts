import {
  activeSessions, buildReturnPlan, detectMissedTraining, isFilledSet, isValidDateOnly, loadProfileId,
  normalizeReturnCheckIn, recordPlanChange, returnPlanSetCount,
  type AbsenceRecord, type ExerciseExposureSnapshot, type ReturnCheckIn, type ReturnPlan, type SessionPlanSnapshot,
  type SetEntry, type TrainingData,
} from "./training";

export const RETURN_CHECK_IN_VERSION = 1;
const daysBetween = (a: string, b: string) => Math.max(0, Math.floor((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000));

/** Absence decisions acknowledge logging gaps; they are not evidence of lifting. */
export function returnCheckInContext(data: TrainingData, date: string) {
  const latestSession = activeSessions(data).filter((session) => session.date <= date
    && Object.entries(session.entries).some(([key, entries]) => {
      const snapshot = session.planSnapshot?.exercises.find((exercise) => exercise.key === key);
      return entries.some((entry) => isFilledSet(entry, snapshot ? { ...snapshot, alternatives: [] } : undefined));
    }))
    .sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const latestCheck = data.absences.filter((record) => record.checkIn && record.endDate <= date)
    .sort((a, b) => a.endDate.localeCompare(b.endDate) || a.createdAt.localeCompare(b.createdAt)).at(-1);
  const lastRecorded = latestSession?.date;
  const lastLiftDate = [lastRecorded, latestCheck?.checkIn?.lastLiftDate].filter((value): value is string => Boolean(value)).sort().at(-1);
  const fallbackDate = [lastLiftDate ?? data.program.pausedAt?.slice(0, 10) ?? data.setupCompletedAt?.slice(0, 10) ?? date, date].sort()[0];
  const gapDays = daysBetween(fallbackDate, date);
  const sinceAnswer = latestCheck ? daysBetween(latestCheck.endDate, date) : Infinity;
  const legacyReturn = Boolean(data.program.returnPlan && !latestCheck
    && !activeSessions(data).some((session) => session.createdAt >= data.program.returnPlan!.startedAt));
  // Do not interrupt brand-new accounts or repeatedly ask about an already acknowledged break.
  const due = data.program.status === "active" && ((Boolean(lastLiftDate) && gapDays >= 14 && sinceAnswer >= 14) || legacyReturn);
  return { date, lastRecorded, fallbackDate, gapDays, due, lastAnswer: latestCheck?.checkIn,
    key: `${data.program.pausedAt ?? "active"}:${lastRecorded ?? "none"}:${latestCheck?.id ?? "unanswered"}` };
}

/** Preserve an underway return plan; never restart its count or multiply reductions. */
function combinePlans(existing: ReturnPlan | undefined, requested: ReturnPlan | undefined): ReturnPlan | undefined {
  if (!existing) return requested;
  if (!requested) return existing;
  const stricter = requested.loadFactor < existing.loadFactor || requested.volumeFactor < existing.volumeFactor || requested.targetRir > existing.targetRir;
  const sessionsRemaining = stricter ? Math.max(existing.sessionsRemaining, requested.sessionsRemaining) : existing.sessionsRemaining;
  return { ...existing, gapDays: Math.max(existing.gapDays, requested.gapDays),
    totalSessions: Math.min(3, Math.max(existing.totalSessions, existing.totalSessions - existing.sessionsRemaining + sessionsRemaining)),
    sessionsRemaining, loadFactor: Math.min(existing.loadFactor, requested.loadFactor),
    volumeFactor: Math.min(existing.volumeFactor, requested.volumeFactor), targetRir: Math.max(existing.targetRir, requested.targetRir) };
}

export function assessReturnCheckIn(data: TrainingData, answer: ReturnCheckIn, date: string, now: string) {
  if (!isValidDateOnly(date) || !normalizeReturnCheckIn(answer, date)) throw new Error("Check your last workout date and answers.");
  const gapDays = daysBetween(answer.lastLiftDate, date);
  const blocked = answer.readiness === "pain" || answer.readiness === "severe-soreness";
  const reason = answer.readiness === "sore" || answer.readiness === "severe-soreness" ? "soreness" as const
    : answer.readiness === "pain" ? "injury" as const : "planned" as const;
  // The short reduced-training check uses the existing 14-day plan, a product guardrail,
  // not an estimate of strength lost. Continued training does not fabricate exercise history.
  const needsShortReturn = answer.activity === "reduced" || answer.readiness === "low" || answer.readiness === "sore";
  const requested = blocked ? undefined : buildReturnPlan(needsShortReturn ? Math.max(14, gapDays) : gapDays, reason, now);
  // Older releases inferred a break from a pause alone. A confirmed logging-only gap
  // may remove that unused plan, but never erase a return workout already performed
  // or independent exercise/Phase 2 calibration requirements.
  const unusedLegacyPlan = data.program.returnPlan && !data.absences.some((record) => record.checkIn)
    && !activeSessions(data).some((session) => session.createdAt >= data.program.returnPlan!.startedAt);
  const correctedLoggingGap = Boolean(unusedLegacyPlan && answer.activity === "continued" && gapDays < 14 && answer.readiness === "normal");
  return { gapDays, blocked, correctedLoggingGap, plan: combinePlans(correctedLoggingGap ? undefined : data.program.returnPlan, requested) };
}

export function applyReturnCheckIn(data: TrainingData, answer: ReturnCheckIn, date: string, now: string, id: string): TrainingData {
  if (!data.profile) throw new Error("Finish setup before checking in.");
  if (data.program.status === "completed") throw new Error("Choose an active program before checking in.");
  const assessment = assessReturnCheckIn(data, answer, date, now);
  const missedDates = detectMissedTraining(data, date)?.missedDates ?? [];
  const startDate = missedDates[0] ?? returnCheckInContext(data, date).fallbackDate;
  const record: AbsenceRecord = { id, startDate: startDate > date ? date : startDate, endDate: date,
    missedDates, reason: answer.readiness === "severe-soreness" || answer.readiness === "sore" ? "soreness" : assessment.blocked ? "injury" : "other", resolution: "continue",
    programId: data.program.activeId, programWeek: data.program.activeId === "phase2" ? data.program.week : undefined,
    frequency: data.program.frequency, resolvedDayIds: [], createdAt: now, updatedAt: now, checkIn: normalizeReturnCheckIn(answer, date) };
  const next: TrainingData = {
    ...data, updatedAt: now, profile: { ...data.profile, weightGoal: answer.weightGoal },
    absences: [...data.absences, record].slice(-2_000),
    program: { ...data.program, status: assessment.blocked ? "paused" : "active",
      pausedAt: assessment.blocked ? data.program.pausedAt ?? now : undefined,
      returnPlan: assessment.plan, calibrationRequired: data.program.calibrationRequired || Boolean(assessment.plan) },
  };
  return recordPlanChange(next, assessment.blocked ? "pause" : data.program.status === "paused" ? "resume" : "profile", now);
}

/** Re-limit an unfinished local draft without erasing anything the user entered. */
export function restrictReturnDraft<T extends { snapshot: SessionPlanSnapshot; exposures: Record<string, ExerciseExposureSnapshot> }>(
  draft: T, entries: Record<string, SetEntry[]>, plan: ReturnPlan,
): T {
  const exposures = { ...draft.exposures };
  const exercises = draft.snapshot.exercises.map((exercise) => {
    const previous = exposures[exercise.key];
    const originalSets = previous?.originalSets ?? exercise.sets;
    const touched = (entries[exercise.key] ?? []).reduce((count, entry, index) => entry.w !== "" || entry.r !== "" || entry.rir !== "" ? index + 1 : count, 0);
    const sets = Math.max(touched, Math.min(exercise.sets, returnPlanSetCount(originalSets, plan.volumeFactor)));
    exposures[exercise.key] = { ...(previous ?? { policyVersion: 1, identity: loadProfileId(exercise),
      stateAtStart: "recalibration", noveltyRisk: "high", originalSets, relatedHistory: false, startingLoadSource: "guided" }),
      prescribedSets: sets, progressionEligible: false, targetRir: Math.max(previous?.targetRir ?? 0, plan.targetRir), suggestedLoad: null };
    return { ...exercise, sets };
  });
  return { ...draft, snapshot: { ...draft.snapshot, exercises }, exposures };
}
