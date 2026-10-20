export function MakeupWorkoutNotice({ scheduledDate, performedDate, onTrainToday }: {
  scheduledDate: string;
  performedDate: string;
  onTrainToday: () => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-200">Make-up workout · {scheduledDate}</p>
        <p className="mt-1 text-xs leading-5 text-stone-400">Report: {scheduledDate} · Trained: {performedDate}</p>
        <p className="text-xs leading-5 text-stone-400">Recovery timing uses the day you train.</p>
      </div>
      <button type="button" onClick={onTrainToday} className="min-h-11 shrink-0 self-start rounded-xl px-3 text-xs font-medium text-stone-300 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:self-auto">
        Train today instead
      </button>
    </div>
  );
}
