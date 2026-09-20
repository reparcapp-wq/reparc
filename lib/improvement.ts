import { loadProfileId, exerciseFromKey, type TrainingData, type Session } from "@/lib/training";

export const IMPROVEMENT_NOTICE_VERSION = "2026-09-07";
export const RECOMMENDATION_VERSION = "12.0.3-policy3";
export const IMPROVEMENT_RETENTION_DAYS = 180;
export type ImprovementStatus = { available: boolean; enabled: boolean; noticeVersion?: string; grantedAt?: string; expiresAt?: string };

// No identity, free text, dates of birth or diagnostic fields enter this dataset.
// A load error is not a safety/efficacy score: RIR and recovery remain self-reported.
export function improvementSample(session: Session, data: TrainingData) {
  if (!session.recommendationVersion || !data.profile || session.deletedAt) return null;
  return {
    recommendationVersion: session.recommendationVersion,
    unit: session.unit,
    experience: data.profile.level,
    track: data.profile.programTrack,
    readiness: session.readiness ?? null,
    completion: session.completionStatus ?? null,
    exercises: Object.entries(session.entries).flatMap(([key, sets]) => {
      const exercise = session.planSnapshot?.exercises.find((item) => item.key === key) ?? exerciseFromKey(key);
      const exposure = session.exerciseExposures?.[key];
      if (!exercise || !exposure) return [];
      return [{ identity: loadProfileId(exercise), policyVersion: exposure.policyVersion,
        state: exposure.stateAtStart, prescribedSets: exposure.prescribedSets,
        suggestedLoad: exposure.suggestedLoad ?? null, targetRir: exposure.targetRir ?? null,
        repLow: exposure.targetRepLow ?? null, repHigh: exposure.targetRepHigh ?? null,
        sets: sets.map(({ w, r, rir }) => ({ load: w === "" ? null : Number(w), reps: r === "" ? null : Number(r), rir: rir === "" ? null : Number(rir) })),
        recovery: data.exerciseRecovery.filter((check) => check.sessionId === session.id && check.exerciseIdentity === exposure.identity).map((check) => {
          const hours = session.completedAt ? (Date.parse(check.createdAt) - Date.parse(session.completedAt)) / 3_600_000 : NaN;
          return { status: check.status, hoursAfter: Number.isFinite(hours) && hours >= 0 ? hours : null };
        }),
      }];
    }),
  };
}
