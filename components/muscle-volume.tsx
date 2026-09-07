import { weeklyMuscleVolume, MUSCLE_LABELS } from "@/lib/muscle-volume";
import type { TrainingData } from "@/lib/training";

export function MuscleVolume({ data, start, end }: { data: TrainingData; start: string; end: string }) {
  const report = weeklyMuscleVolume(data, start, end);
  return <details className="my-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6">
    <summary className="cursor-pointer font-semibold">Weekly muscle work · {report.loggedSessions ? "view sets" : "no logged sessions"}</summary>
    <p className="mt-4 text-stone-400">Completed working sets from {start} to {end}. Direct work targets a muscle; indirect work assists. These are descriptive counts, not a muscle-growth or safety score. A set performed on both sides counts once per muscle.</p>
    <table className="mt-4 w-full text-left text-sm"><caption className="sr-only">Logged muscle set counts</caption><thead><tr className="border-b border-white/10"><th className="py-2">Muscle</th><th className="py-2 text-right">Direct</th><th className="py-2 text-right">Indirect</th></tr></thead><tbody>{report.rows.map((row) => <tr key={row.muscle} className="border-b border-white/5"><th className="py-2 font-medium">{MUSCLE_LABELS[row.muscle]}</th><td className="text-right tabular-nums">{row.direct}</td><td className="text-right tabular-nums">{row.indirect}</td></tr>)}</tbody></table>
    {report.inferredSets > 0 && <p className="mt-3 text-stone-400">{report.inferredSets} older sets use the current exercise classification because their original muscle labels were not recorded.</p>}
    {report.unclassifiedSets > 0 && <p className="mt-3 text-amber-300">{report.unclassifiedSets} sets have unknown exercise metadata and are excluded from muscle counts.</p>}
    <details className="mt-4"><summary className="cursor-pointer font-medium">Current normal-week plan</summary><p className="mt-3 text-stone-400">Planned direct / indirect sets, before return or unfamiliar-exercise reductions. This is your current setup, not a reconstruction of this historical week.</p><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">{report.rows.map((row) => <div key={row.muscle}><dt>{MUSCLE_LABELS[row.muscle]}</dt><dd className="text-stone-400">{row.plannedDirect} / {row.plannedIndirect}</dd></div>)}</dl></details>
  </details>;
}
