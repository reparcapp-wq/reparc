import {
  activeSessions, activeWeighIns, comparableExerciseHistory, convertWeight, exerciseFromKey,
  isFilledSet, isValidDateOnly, loadProfileId, numeric, resolvedSessionScheduleDates,
  sbsPrescription, type Exercise, type Session, type SetEntry, type TrainingData,
} from "./training";
import { buildScheduleAdherence } from "./daily-report";
import { exerciseCalibration, EXPOSURE_POLICY } from "./exercise-calibration";
import type { LoadAdjustment } from "./autoregulation";
import { exerciseMetadata, MUSCLES, type Muscle } from "./exercise-metadata";
import { measuredSessionDuration } from "./session-duration";

export const REVIEW_VERSION = "12.0.0-review1";
// Published product thresholds for data sufficiency; these are not accuracy probabilities.
export const REVIEW_RULES = { highExposures: 3, highRirCoverage: 80, moderateRirCoverage: 60, monthlyWeeks: 3, weeklySessions: 2, weeklySetCoverage: 70 } as const;
export type ReviewPeriod = "day" | "week" | "month";
export type ReviewStatus = "on-track" | "hold" | "adjust" | "insufficient";
export type ReviewConfidence = "high" | "moderate" | "low" | "insufficient";
export const REVIEW_STATUS: Record<ReviewStatus, string> = { "on-track": "Recorded targets met", hold: "Hold steady", adjust: "Adjustment needed", insufficient: "Not enough data" };
export const REVIEW_CONFIDENCE: Record<ReviewConfidence, string> = { high: "Well recorded", moderate: "Some information missing", low: "Limited information", insufficient: "Not enough information" };
export const shiftReviewDate = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export function reviewBounds(period: ReviewPeriod, anchor: string) {
  if (!isValidDateOnly(anchor)) throw new Error("Invalid review date");
  if (period === "day") return { start: anchor, end: anchor };
  if (period === "week") { const day = new Date(`${anchor}T12:00:00Z`).getUTCDay(); const start = shiftReviewDate(anchor, -(day + 6) % 7); return { start, end: shiftReviewDate(start, 6) }; }
  const start = `${anchor.slice(0, 7)}-01`;
  const next = new Date(`${start}T12:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: shiftReviewDate(next.toISOString().slice(0, 10), -1) };
}
const percent = (part: number, total: number) => total > 0 ? Math.round(100 * part / total) : null;
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const round = (value: number) => Math.round(value * 100) / 100;
const hasValue = (entry: SetEntry) => entry.w !== "" || entry.r !== "" || entry.rir !== "";
const storedExercise = (session: Session, key: string): Exercise | null => {
  const snapshot = session.planSnapshot?.exercises.find((exercise) => exercise.key === key);
  return snapshot ? { ...snapshot, alternatives: [] } : exerciseFromKey(key);
};

// Only the current revision counts; never count tombstones, duplicated ids or logical workouts twice.
export function reviewSessions(data: TrainingData, asOf: string) {
  const ids = new Map<string, Session>();
  const newer = (a: Session, b: Session) => a.revision > b.revision || a.revision === b.revision && a.updatedAt > b.updatedAt;
  for (const session of data.sessions) { const old = ids.get(session.id); if (!old || newer(session, old)) ids.set(session.id, session); }
  const logical = new Map<string, Session>();
  for (const session of ids.values()) { const key = session.logicalKey ?? session.id; const old = logical.get(key); if (!old || newer(session, old)) logical.set(key, session); }
  return [...logical.values()].filter((session) => !session.deletedAt && isValidDateOnly(session.date) && session.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

type Occurrence = { session: Session; key: string; exercise: Exercise; entries: SetEntry[]; planned: number | null; targets: Array<{ low: number; high: number | null; rir: number | null } | null>; recovery: TrainingData["exerciseRecovery"][number] | undefined; recoveryMature: boolean; identity: string };
function occurrences(data: TrainingData): Occurrence[] {
  const recoveryByExposure = new Map<string, TrainingData["exerciseRecovery"]>();
  for (const check of data.exerciseRecovery) {
    const key = `${check.sessionId}:${check.exerciseIdentity}`;
    const records = recoveryByExposure.get(key) ?? []; records.push(check); recoveryByExposure.set(key, records);
  }
  return activeSessions(data).flatMap((session) => {
    const keys = new Set([...Object.keys(session.entries), ...(session.planSnapshot?.exercises.map((exercise) => exercise.key) ?? [])]);
    return [...keys].flatMap((key) => {
      const exercise = storedExercise(session, key); if (!exercise) return [];
      const identity = loadProfileId(exercise);
      const snapshot = session.planSnapshot?.exercises.find((item) => item.key === key);
      const exposure = session.exerciseExposures?.[key];
      const entries = session.entries[key] ?? [];
      const planned = exposure?.prescribedSets ?? snapshot?.sets ?? null;
      const phase2 = (session.programId ?? session.planSnapshot?.programId) === "phase2" && exercise.sbsRole;
      const week = session.programWeek ?? session.planSnapshot?.programWeek;
      const sbs = phase2 && week ? sbsPrescription(exercise.sbsRole!, week) : null;
      const targets = entries.map((_, index) => {
        if (!snapshot || planned === null || index >= planned) return null;
        if (phase2) {
          // Old Phase 2 records without provenance cannot tell us whether an AMRAP was allowed.
          if (!exposure || !sbs) return null;
          const calibration = !exposure.progressionEligible || session.affectsProgression === false || Boolean(session.readiness && session.readiness !== "normal");
          if (!calibration) return index === planned - 1 && !sbs.deload
            ? { low: sbs.repOutTarget, high: null, rir: null }
            : { low: sbs.normalReps, high: sbs.normalReps, rir: null };
        }
        return { low: exposure?.targetRepLow ?? exercise.repLow, high: exposure?.targetRepHigh ?? exercise.repHigh, rir: exposure?.targetRir ?? null };
      });
      const checks = [...(recoveryByExposure.get(`${session.id}:${identity}`) ?? [])]
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
      // Match calibration: a later green answer must not erase an adverse exposure.
      const recovery = checks.find((check) => check.status === "severe") ?? checks.find((check) => check.status === "limiting") ?? checks.at(-1);
      const elapsed = recovery && session.completedAt ? Date.parse(recovery.createdAt) - Date.parse(session.completedAt) : NaN;
      const recoveryMature = !!recovery && Number.isFinite(elapsed) && elapsed >= EXPOSURE_POLICY.recoveryHours * 3_600_000;
      return [{ session, key, exercise, entries, planned, targets, identity, recovery, recoveryMature }];
    });
  });
}
function counts(items: Occurrence[]) {
  let sets = 0, planned = 0, plannedCompleted = 0, unknownPlan = 0, invalid = 0, repKnown = 0, repMet = 0, rirKnown = 0, rirMet = 0, rirTargetKnown = 0, extra = 0;
  const rirs: number[] = [];
  for (const item of items) {
    if (item.planned === null) unknownPlan++; else planned += item.planned;
    item.entries.forEach((entry, index) => {
      if (!isFilledSet(entry, item.exercise)) { if (hasValue(entry)) invalid++; return; }
      sets++; if (item.planned !== null) { if (index < item.planned) plannedCompleted++; else extra++; }
      if (entry.rir !== "") { rirKnown++; rirs.push(numeric(entry.rir)); }
      const target = item.targets[index];
      if (target) {
        repKnown++;
        if (numeric(entry.r) >= target.low && (target.high === null || numeric(entry.r) <= target.high)) repMet++;
        if (target.rir !== null && entry.rir !== "") { rirTargetKnown++; if (numeric(entry.rir) >= target.rir) rirMet++; }
      }
    });
  }
  return { sets, planned, plannedCompleted, unknownPlan, invalid, extra, repKnown, repMet, rirKnown, rirTargetKnown, rirMet,
    completionPercent: percent(plannedCompleted, planned), repPercent: percent(repMet, repKnown), rirCoverage: percent(rirKnown, sets), rirPercent: percent(rirMet, rirTargetKnown), averageRir: mean(rirs) };
}
export type ExerciseReview = {
  identity: string; name: string; primary: Muscle[]; secondary: Muscle[]; status: ReviewStatus; reason: string; action: string;
  confidence: ReviewConfidence; exposures: number; lastDate: string; recommendation: LoadAdjustment | null;
  trend: "improved" | "decreased" | "stable" | "calibration" | "not-comparable" | "insufficient";
  trendReason: string; points: Array<{ date: string; sessionId: string; load: number; reps: number; rir: number | null }>;
  loadingLabel: string; chartMetric: "load" | "reps"; counts: ReturnType<typeof counts>; provenance: string[];
};
function firstPoint(item: Occurrence, unit: "kg" | "lb") {
  // Fixed set position prevents cherry-picking a best set when the set count changed.
  const entry = item.entries[0];
  return entry && isFilledSet(entry, item.exercise) ? { date: item.session.date, sessionId: item.session.id, load: round(convertWeight(numeric(entry.w), item.session.unit, unit)), reps: numeric(entry.r), rir: entry.rir === "" ? null : numeric(entry.rir) } : null;
}
function exerciseReview(data: TrainingData, items: Occurrence[], all: Occurrence[], asOf: string): ExerciseReview {
  const latest = items.at(-1)!; const exercise = latest.exercise; const unit = data.profile?.unit ?? "kg";
  const c = counts(items); const latestCounts = counts([latest]);
  // The canonical history matcher is shared with Train. Additional protocol filters are stricter for trend claims.
  const canonical = new Set(comparableExerciseHistory(data, exercise).map((item) => `${item.session.id}:${item.key}`));
  const history = all.filter((item) => item.identity === latest.identity && canonical.has(`${item.session.id}:${item.key}`) && item.session.date <= latest.session.date);
  const exposureCount = new Set(history.map((item) => item.session.date)).size;
  const previous = history.filter((item) => item.session.date < latest.session.date).at(-1);
  const currentPoint = firstPoint(latest, unit); const previousPoint = previous ? firstPoint(previous, unit) : null;
  const exposure = latest.session.exerciseExposures?.[latest.key];
  const calibration = exerciseCalibration(data, exercise, shiftReviewDate(asOf, 1));
  let trend: ExerciseReview["trend"] = "insufficient";
  let trendReason = "Record this exercise on another day to compare performance.";
  const familiar = exposure?.stateAtStart === "calibrated" || exposure?.stateAtStart === "developing";
  if (exposure && !familiar || latest.session.affectsProgression === false) { trend = "calibration"; trendReason = "The recorded plan reduced or protected progression. Fewer sets or reps do not establish lost strength."; }
  else if (previous && currentPoint && previousPoint) {
    const previousExposure = previous.session.exerciseExposures?.[previous.key];
    const protocolsMatch = !!latest.session.planSnapshot && !!previous.session.planSnapshot
      && exercise.loadingType === previous.exercise.loadingType && !!exercise.perSide === !!previous.exercise.perSide
      && exercise.sbsRole === previous.exercise.sbsRole
      && exercise.repLow === previous.exercise.repLow && exercise.repHigh === previous.exercise.repHigh
      && latest.session.programWeek === previous.session.programWeek
      && previous.session.affectsProgression !== false
      && (!previousExposure || previousExposure.stateAtStart === "developing" || previousExposure.stateAtStart === "calibrated");
    const effortMatches = currentPoint.rir !== null && previousPoint.rir !== null && Math.abs(currentPoint.rir - previousPoint.rir) <= 1;
    if (!protocolsMatch || !effortMatches || exercise.loadingType !== "external" || exercise.sbsRole) {
      trend = "not-comparable"; trendReason = "The saved plan, effort, loading method or Phase 2 prescription differs or is missing. Recorded values are shown without a strength-change claim.";
    } else if (currentPoint.load === previousPoint.load) {
      trend = currentPoint.reps > previousPoint.reps ? "improved" : currentPoint.reps < previousPoint.reps ? "decreased" : "stable";
      trendReason = `First set: ${previousPoint.reps} → ${currentPoint.reps} reps at ${currentPoint.load} ${unit}, with reported effort within 1 rep left. This is a recorded performance comparison, not measured muscle growth.`;
    } else if (currentPoint.reps === previousPoint.reps) {
      trend = currentPoint.load > previousPoint.load ? "improved" : "decreased";
      trendReason = `First set: ${previousPoint.load} → ${currentPoint.load} ${unit} for ${currentPoint.reps} reps, with reported effort within 1 rep left. Confirm the same equipment and technique were used.`;
    } else { trend = "not-comparable"; trendReason = "Both load and repetitions changed. Repeat a comparable prescription before concluding that strength changed."; }
  }
  // Historical reviews do not issue a second load prescription. Train alone evaluates
  // current readiness, return plans, available equipment and the live program together.
  let recommendation: LoadAdjustment | null = null;
  let status: ReviewStatus = "hold", reason = "Repeat the recorded targets before increasing the load.", action = `Open ${exercise.name} in Train and follow its current target.`;
  const recovery = latest.recovery;
  const critical = latest.session.readiness === "pain" || latest.session.readiness === "severe-soreness" || recovery?.status === "severe";
  const limited = recovery?.status === "limiting";
  const missingRecovery = !latest.recoveryMature || !recovery;
  const effortMiss = latestCounts.rirTargetKnown > latestCounts.rirMet;
  const repMiss = latestCounts.repKnown > latestCounts.repMet;
  if (critical || limited) {
    status = "adjust"; reason = `${exercise.name}: ${critical ? "pain or severe symptoms" : "recovery that limited movement"} was recorded. Confirm normal movement before training this area again.`;
    action = "Pause this exercise while movement is limited. Use the recovery check before resuming.";
    recommendation = { action: "stop", nextLoad: null, confidence: "low", reason, evidence: ["recorded recovery/readiness"] };
  } else if (latest.session.skippedExerciseKeys?.includes(latest.key)) {
    reason = "This exercise was stopped or skipped. The reason is unknown; no load increase follows from this record.";
    action = "Check that the exercise is suitable and comfortable before resuming."; recommendation = null;
  } else if (exercise.sbsRole) {
    reason = `This lift uses the saved Phase 2 prescription${missingRecovery ? "; recovery feedback is still needed" : ""}. Its final effort set is evaluated separately from ordinary rep ranges.`;
    action = "Follow this lift’s current Phase 2 target in Train; this review does not change training maxes."; recommendation = null;
  } else if (effortMiss || repMiss) {
    reason = `${exercise.name}: ${latestCounts.repKnown - latestCounts.repMet} of ${latestCounts.repKnown} evaluable sets missed the rep target; ${latestCounts.rirTargetKnown - latestCounts.rirMet} of ${latestCounts.rirTargetKnown} effort entries were harder than prescribed.`;
    action = "Follow the displayed rep range rather than adding extra reps. If you could not reach its minimum with the prescribed reps left, use a lighter available weight in Train.";
  } else if (!latestCounts.sets) { status = "insufficient"; reason = "No valid working set was recorded for this exercise."; action = "Record load and reps when you next perform it."; recommendation = null; }
  else if (missingRecovery || latestCounts.rirTargetKnown < latestCounts.sets || c.rirCoverage === null || c.rirCoverage < 80 || latestCounts.unknownPlan) {
    reason = missingRecovery ? `Recovery after ${latest.session.date} has not been confirmed at least 48 hours after completion.` : latestCounts.unknownPlan || latestCounts.rirTargetKnown < latestCounts.rirKnown ? "Part of the original prescription was not saved, so full target compliance cannot be reconstructed." : `Reps left were recorded for ${c.rirKnown} of ${c.sets} sets.`;
    action = missingRecovery ? "Answer the recovery check when due before increasing load." : "Keep recording reps left. Open Train for the current target; this review will not invent missing historical targets.";
  } else if (calibration.state !== "calibrated" || latest.session.affectsProgression === false || data.program.returnPlan) {
    reason = "This exercise is building repeatable history or returning gradually. Reduced volume is intentional.";
    action = "Repeat the comfortable target in Train and record recovery before adding work.";
  } else if (latestCounts.plannedCompleted < latestCounts.planned) {
    reason = `Recorded ${latestCounts.plannedCompleted} of ${latestCounts.planned} planned sets.`; action = "Keep the load steady and record why any remaining sets were skipped.";
  } else {
    status = "on-track"; reason = "The latest recorded sets met their saved rep and effort targets, and recovery was reported as acceptable.";
    action = "Open Train for the next load and rep target. It checks your current readiness and equipment before any increase.";
  }
  const confidence: ReviewConfidence = !c.sets ? "insufficient" : exposureCount >= 3 && (c.rirCoverage ?? 0) >= 80 && latest.recoveryMature && !c.invalid && !c.unknownPlan && !missingRecovery ? "high" : exposureCount >= 2 && (c.rirCoverage ?? 0) >= 60 && !c.invalid && !c.unknownPlan ? "moderate" : "low";
  const metadata = exerciseMetadata(exercise.name);
  return { identity: latest.identity, name: exercise.name, primary: exercise.primaryMuscles ?? metadata?.primary ?? [], secondary: exercise.secondaryMuscles ?? metadata?.secondary ?? [], status, reason, action, confidence, exposures: exposureCount, lastDate: latest.session.date, recommendation, trend, trendReason,
    points: history.flatMap((item) => { const point = firstPoint(item, unit); return point ? [point] : []; }).slice(-16),
    loadingLabel: exercise.loadingType === "assisted-bodyweight" ? `Assistance (${unit}); more assistance is easier` : exercise.loadingType === "bodyweight" ? `Added load (${unit}); bodyweight history is not inferred` : exercise.loadingType === "unloaded" ? "Repetitions; no comparable external load" : `${unit}${exercise.perSide ? " per side" : " total / machine setting"}`,
    chartMetric: exercise.loadingType === "unloaded" || exercise.loadingType === "bodyweight" && history.every((item) => !numeric(item.entries[0]?.w ?? "")) ? "reps" : "load",
    counts: c, provenance: [...new Set(items.map((item) => item.session.recommendationVersion ?? "Legacy: recommendation version not saved"))] };
}

export function buildProgressAnalysis(data: TrainingData, period: ReviewPeriod, anchor: string, asOf: string) {
  if (!isValidDateOnly(asOf)) throw new Error("Invalid analysis date");
  const { start, end } = reviewBounds(period, anchor);
  const through = end < asOf ? end : asOf;
  const cleaned: TrainingData = { ...data, sessions: reviewSessions(data, asOf), exerciseRecovery: data.exerciseRecovery.filter((check) => check.createdAt.slice(0, 10) <= asOf && check.updatedAt.slice(0, 10) <= asOf) };
  const scheduleDates = resolvedSessionScheduleDates(cleaned);
  const filed = cleaned.sessions.filter((session) => { const date = scheduleDates.get(session.id) ?? session.scheduledDate ?? session.date; return date >= start && date <= through; });
  const filedIds = new Set(filed.map((session) => session.id));
  const all = occurrences(cleaned); const selected = all.filter((item) => filedIds.has(item.session.id));
  const c = counts(selected);
  const unknownExercises = filed.flatMap((session) => Object.entries(session.entries).filter(([key, entries]) => !storedExercise(session, key) && entries.some(hasValue))).length;
  const grouped = new Map<string, Occurrence[]>();
  selected.forEach((item) => grouped.set(item.identity, [...(grouped.get(item.identity) ?? []), item]));
  const exercises = [...grouped.values()].map((items) => exerciseReview(cleaned, items, all, asOf));
  const adherence = buildScheduleAdherence(cleaned, start, end, asOf);
  const durationValues = filed.flatMap((session) => { const value = measuredSessionDuration(session); return value === null ? [] : [value]; });
  const workoutDifficulty = mean(filed.flatMap((session) => typeof session.sessionRpe === "number" && session.sessionRpe >= 1 && session.sessionRpe <= 10 ? [session.sessionRpe] : []));
  const recoverable = selected.filter((item) => item.entries.some((entry) => isFilledSet(entry, item.exercise)));
  const mature = recoverable.filter((item) => item.recoveryMature);
  let validWeeks = 0;
  const weekly: Array<{ start: string; sets: number; planned: number; valid: boolean }> = [];
  const graphStart = period === "month" ? reviewBounds("week", start).start : shiftReviewDate(reviewBounds("week", start).start, -21);
  for (let week = graphStart; week <= through; week = shiftReviewDate(week, 7)) {
    const weekEnd = shiftReviewDate(week, 6);
    const weekItems = all.filter((item) => item.session.date >= week && item.session.date <= weekEnd && item.session.date <= through);
    const totals = counts(weekItems);
    const valid = weekEnd < asOf && new Set(weekItems.filter((item) => item.entries.some((entry) => isFilledSet(entry, item.exercise))).map((item) => item.session.id)).size >= REVIEW_RULES.weeklySessions
      && !totals.unknownPlan && !totals.invalid && (totals.completionPercent ?? 0) >= REVIEW_RULES.weeklySetCoverage && (totals.rirCoverage ?? 0) >= REVIEW_RULES.moderateRirCoverage;
    if (week >= start && weekEnd <= end && valid) validWeeks++;
    weekly.push({ start: week, sets: totals.sets, planned: totals.planned, valid });
  }
  const enough = c.sets > 0 && (period !== "month" || validWeeks >= REVIEW_RULES.monthlyWeeks);
  const warnings: string[] = [];
  if (data.sessions.length !== cleaned.sessions.length) warnings.push("Deleted, duplicate or future-dated workouts are excluded. Only current revisions count.");
  if (unknownExercises) warnings.push(`${unknownExercises} exercise entries could not be identified. They are excluded; do not interpret the totals as complete.`);
  if (c.invalid) warnings.push(`${c.invalid} incomplete or invalid set entries were excluded. They were not treated as zero.`);
  if (c.unknownPlan) warnings.push(`${c.unknownPlan} exercise records lack their original plan. Their logged work counts, but target compliance is unavailable.`);
  if (c.extra) warnings.push(`${c.extra} extra sets count as performed work but do not increase planned-set completion above 100%.`);
  if (durationValues.length !== filed.length) warnings.push(`${filed.length - durationValues.length} workout durations are missing or outside the 1-minute–12-hour recording bounds. Duration totals cover measured workouts only.`);
  if ((c.rirCoverage ?? 0) < 80 && c.sets) warnings.push(`Reps left were recorded on ${c.rirKnown}/${c.sets} valid sets. Missing effort is not guessed.`);
  if (c.rirTargetKnown < c.rirKnown) warnings.push(`${c.rirKnown - c.rirTargetKnown} recorded effort entries have no comparable saved effort target (including Phase 2 effort sets). No target pass is invented.`);
  if (mature.length < recoverable.length) warnings.push(`${recoverable.length - mature.length}/${recoverable.length} exercise exposures lack a recovery answer at least 48 hours after completion.`);
  if (filed.some((session) => !session.readiness)) warnings.push("Some readiness check-ins are missing. The review cannot establish how you felt before those workouts.");
  const inferredDates = filed.filter((session) => !session.scheduledDate && scheduleDates.get(session.id) !== session.date);
  if (inferredDates.length) warnings.push(`${inferredDates.length} older catch-up workout dates are inferred by the existing calendar resolver. The performed dates remain unchanged.`);
  if (!adherence.available) warnings.push("Schedule history is incomplete; an attendance percentage cannot be established for this period.");
  if (!enough && period === "month") warnings.push(`${validWeeks}/3 complete, sufficiently recorded weeks fall inside this month. Descriptive totals remain available; a monthly verdict is withheld.`);
  const confidence: ReviewConfidence = !enough ? "insufficient" : unknownExercises || c.invalid || c.unknownPlan ? "low" : exercises.length && exercises.every((exercise) => exercise.confidence === "high") ? "high" : (c.rirCoverage ?? 0) >= 60 && exercises.some((exercise) => exercise.exposures >= 2) ? "moderate" : "low";
  const critical = exercises.filter((exercise) => exercise.status === "adjust");
  const status: ReviewStatus = critical.length ? "adjust" : !enough ? "insufficient" : confidence === "low" || c.repMet < c.repKnown || c.rirMet < c.rirTargetKnown || !adherence.available || exercises.some((exercise) => exercise.status !== "on-track") || (adherence.adherencePercent !== null && adherence.adherencePercent < 100) ? "hold" : "on-track";
  const priority: Record<ReviewStatus, number> = { adjust: 0, hold: 1, insufficient: 2, "on-track": 3 };
  const ranked = [...exercises].sort((a, b) => priority[a.status] - priority[b.status] || a.name.localeCompare(b.name));
  const actionGroups = new Map<string, string[]>();
  for (const exercise of ranked.filter((item) => item.status !== "on-track")) actionGroups.set(exercise.action, [...(actionGroups.get(exercise.action) ?? []), exercise.name]);
  const actions = [...actionGroups].slice(0, c.rirCoverage !== null && c.rirCoverage < 80 && !critical.length ? 2 : 3).map(([text, names]) => ({ title: names.length > 2 ? `${names.slice(0, 2).join(", ")} + ${names.length - 2} more` : names.join(", "), text }));
  if (actions.length < 3 && c.sets && (c.rirCoverage ?? 0) < 80) actions.push({ title: "Complete effort entries", text: `Record reps left after each working set. This period has ${c.sets - c.rirKnown} missing entries.` });
  if (!actions.length && enough) actions.push({ title: "Continue the current plan", text: "Follow the next targets in Train and record recovery. This review does not change your workout." });
  if (!actions.length) actions.push({ title: "Build comparable history", text: "Record the next planned workout, including load, reps and reps left. Early totals are available without a progress verdict." });

  // Muscle dose/recovery uses physical dates, never the calendar slot that a catch-up fulfilled.
  const physical = all.filter((item) => item.session.date >= start && item.session.date <= through);
  const muscles = MUSCLES.map((muscle) => {
    let direct = 0, indirect = 0, planned = 0, inferred = 0;
    const involved: Occurrence[] = [];
    for (const item of physical) {
      const metadata = exerciseMetadata(item.exercise.name);
      const primary = item.exercise.primaryMuscles ?? metadata?.primary ?? [];
      const secondary = item.exercise.secondaryMuscles ?? metadata?.secondary ?? [];
      const count = item.entries.filter((entry) => isFilledSet(entry, item.exercise)).length;
      if (primary.includes(muscle)) { direct += count; planned += item.planned ?? 0; involved.push(item); }
      else if (secondary.includes(muscle)) { indirect += count; involved.push(item); }
      if (!item.exercise.metadataVersion && (primary.includes(muscle) || secondary.includes(muscle))) inferred += count;
    }
    const latestByIdentity = [...new Map(involved.map((item) => [item.identity, item])).values()];
    const limited = latestByIdentity.filter((item) => ["limiting", "severe"].includes(item.recovery?.status ?? "") || ["pain", "severe-soreness"].includes(item.session.readiness ?? ""));
    const pending = latestByIdentity.some((item) => !item.recoveryMature);
    const totals = counts(involved);
    const targetMiss = totals.repMet < totals.repKnown || totals.rirMet < totals.rirTargetKnown || totals.plannedCompleted < totals.planned;
    const status: ReviewStatus = limited.length ? "adjust" : !(direct + indirect) || pending || totals.rirTargetKnown < totals.sets || !totals.rirTargetKnown || totals.unknownPlan || inferred || totals.invalid ? "insufficient" : targetMiss ? "hold" : "on-track";
    const reason = limited.length ? `Movement-limiting recovery or pain was recorded for ${limited.map((item) => item.exercise.name).join(", ")}.`
      : !(direct + indirect) ? "No recorded working sets targeted this area in this period."
      : pending ? "Recorded training exposure is shown; recovery information is missing or too early."
      : inferred || totals.unknownPlan ? "Older records use inferred muscle attribution or lack a saved prescription."
      : targetMiss ? "At least one recorded set missed its saved target, or planned sets were incomplete."
      : status === "insufficient" ? "An effort target was not available for comparison." : "Saved rep and effort targets were met, with acceptable reported recovery. This is not a muscle-growth measurement.";
    return { muscle, direct, indirect, planned, inferred, status, reason };
  });
  const weightsByDate = new Map<string, { date: string; weight: number; updatedAt: string }>();
  for (const entry of activeWeighIns(data)) {
    const kg = convertWeight(entry.weight, entry.unit, "kg");
    if (!isValidDateOnly(entry.date) || entry.date > through || kg < 25 || kg > 300 || !Number.isFinite(kg)) continue;
    const old = weightsByDate.get(entry.date);
    if (!old || entry.updatedAt > old.updatedAt) weightsByDate.set(entry.date, { date: entry.date, weight: convertWeight(entry.weight, entry.unit, data.profile?.unit ?? "kg"), updatedAt: entry.updatedAt });
  }
  const weights = [...weightsByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const weightWindow = (low: string, high: string) => weights.filter((entry) => entry.date >= low && entry.date <= high);
  const currentWeights = weightWindow(shiftReviewDate(through, -6), through);
  const priorWeights = weightWindow(shiftReviewDate(through, -13), shiftReviewDate(through, -7));
  const currentWeight = mean(currentWeights.map((entry) => entry.weight)); const priorWeight = mean(priorWeights.map((entry) => entry.weight));
  const weightChange = currentWeights.length >= 3 && priorWeights.length >= 3 && currentWeight !== null && priorWeight !== null ? round(currentWeight - priorWeight) : null;
  const weightPoints = weights.filter((entry) => entry.date >= shiftReviewDate(start, -7)).map((entry) => {
    const recent = weightWindow(shiftReviewDate(entry.date, -6), entry.date);
    return { date: entry.date, weight: round(entry.weight), average: recent.length >= 3 ? round(mean(recent.map((item) => item.weight))!) : null, samples: recent.length };
  });
  // Descriptive hit rate only for followed, versioned prescriptions with complete effort and delayed recovery.
  const evaluation = { eligible: 0, metTargetsAndRecovery: 0, excluded: 0 };
  for (const item of selected) {
    const exposure = item.session.exerciseExposures?.[item.key]; const count = counts([item]);
    const followedLoad = exposure?.suggestedLoad != null && item.entries.every((entry) => isFilledSet(entry, item.exercise) && Math.abs(numeric(entry.w) - exposure.suggestedLoad!) < 0.01);
    if (!item.session.recommendationVersion || !followedLoad || item.exercise.sbsRole || !item.recoveryMature || count.sets !== item.planned || count.rirKnown !== count.sets || count.repKnown !== count.sets || count.rirTargetKnown !== count.sets || item.session.skippedExerciseKeys?.includes(item.key)) { evaluation.excluded++; continue; }
    evaluation.eligible++;
    if (count.repMet === count.repKnown && count.rirMet === count.rirTargetKnown && ["recovered", "mild"].includes(item.recovery?.status ?? "")) evaluation.metTargetsAndRecovery++;
  }
  return {
    version: REVIEW_VERSION, period, start, end, asOf, through, complete: end < asOf, status, confidence, enough, validWeeks,
    headline: critical.length ? `${critical.length} exercise${critical.length === 1 ? " needs" : "s need"} a recovery check before continuing.` : !enough ? "More recorded training is needed for a progress verdict." : status === "on-track" ? "Recorded targets were met; continue checking recovery." : "Review the listed targets and missing information before increasing work.",
    counts: c, adherence, sessionCount: filed.length, measuredDurationSeconds: durationValues.length ? durationValues.reduce((a, b) => a + b, 0) : null, durationCoverage: `${durationValues.length}/${filed.length}`, workoutDifficulty,
    recoveryCoverage: `${mature.length}/${recoverable.length}`, exercises: ranked, muscles, warnings, actions,
    improvements: exercises.filter((exercise) => exercise.trend === "improved").map((exercise) => ({ name: exercise.name, text: exercise.trendReason })).slice(0, 3),
    weekly, weight: { points: weightPoints, current: currentWeight, prior: priorWeight, change: weightChange, currentSamples: currentWeights.length, priorSamples: priorWeights.length, goal: data.profile?.weightGoal ?? "maintain" }, evaluation,
    workouts: filed.map((session) => ({ id: session.id, name: session.planSnapshot?.dayName ?? session.dayId, scheduled: scheduleDates.get(session.id) ?? session.scheduledDate ?? session.date, performed: session.date, revision: session.revision })),
  };
}
export type ProgressAnalysis = ReturnType<typeof buildProgressAnalysis>;
