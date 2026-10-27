import { activeSessions, programDays, sessionCountsAsCompletedDay, type TrainingData } from "./training";

export function phaseTwoWeekStatus(data: TrainingData) {
  const days = data.program.activeId === "phase2" && data.profile
    ? programDays("phase2", data.program.frequency, data.profile.programTrack, data.profile.goal, data.profile.equipment) : [];
  const completed = activeSessions(data).filter(session => session.programId === "phase2"
    && session.programWeek === data.program.week && (session.programFrequency ?? 5) === data.program.frequency
    && sessionCountsAsCompletedDay(session, data));
  const byDay = new Map(days.flatMap(day => {
    const session = completed.filter(item => item.dayId === day.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)).at(-1);
    return session ? [[day.id, session] as const] : [];
  }));
  return { byDay, total: days.length, complete: days.length > 0 && byDay.size === days.length };
}

export function canRefreshTrainingDate(input: { visible: boolean; editing: boolean; makeup: boolean; started: boolean; completed: boolean }) {
  return input.visible && !input.editing && !input.makeup && (!input.started || input.completed);
}
