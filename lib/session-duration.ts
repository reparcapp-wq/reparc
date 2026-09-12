import type { Session } from "./training";

// Data-quality bounds, not physiological limits. Never invent historical time.
export function measuredSessionDuration(session: Session): number | null {
  const seconds = session.durationSeconds;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 60 && seconds <= 43_200
    ? Math.round(seconds) : null;
}

export function sessionTiming(current: Session | undefined, draftStartedAt: string | null, now: string, historicalEdit: boolean) {
  if (current && (historicalEdit || ["completed", "adjusted", "skipped"].includes(current.completionStatus ?? ""))) {
    return { startedAt: current.startedAt, completedAt: current.completedAt, durationSeconds: current.durationSeconds };
  }
  const startedAt = current?.startedAt ?? draftStartedAt ?? undefined;
  const elapsed = startedAt ? (Date.parse(now) - Date.parse(startedAt)) / 1000 : NaN;
  return {
    startedAt,
    completedAt: now,
    durationSeconds: Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 43_200 ? Math.round(elapsed) : undefined,
  };
}
