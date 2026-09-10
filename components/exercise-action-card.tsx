"use client";

import { Button } from "@/components/ui/button";
import { isFilledSet, type Exercise, type Readiness, type SetEntry, type Unit } from "@/lib/training";
import type { LoadAdjustment } from "@/lib/autoregulation";

type Props = {
  exercise: Exercise;
  entries: SetEntry[];
  unit: Unit;
  adjustment: LoadAdjustment | null;
  suggestion: { value: number | null; reason: string; confidence?: string } | null;
  targetRir: number;
  readiness?: Readiness | null;
  skipped: boolean;
  recoveryPending: boolean;
  recovering: boolean;
  prescribed?: boolean;
  onApply: (load: number) => void;
};

/** Presentation only: never invents a load or recalculates progression. */
export function ExerciseActionCard({ exercise, entries, unit, adjustment, suggestion, targetRir, readiness, skipped, recoveryPending, recovering, prescribed, onApply }: Props) {
  const completed = entries.filter((entry) => isFilledSet(entry, exercise));
  const finished = completed.length >= exercise.sets;
  const unsafe = readiness === "pain" || readiness === "severe-soreness" || adjustment?.action === "stop";
  const weightLabel = (value: number) => exercise.loadingType === "assisted-bodyweight"
    ? `${value} ${unit} assistance`
    : exercise.loadingType === "bodyweight" || exercise.bodyweight
      ? value === 0 ? "bodyweight only" : `${value} ${unit} added`
      : `${value} ${unit}${exercise.perSide ? " per side" : ""}`;
  const numericLoad = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  let label = completed.length ? "Next set" : "First set";
  let title: string;
  let message: string;
  let detail: string | undefined;
  let confidence: string | undefined;
  let applyLoad: number | undefined;

  if (unsafe) {
    label = "Safety first";
    title = "Stop this exercise";
    message = adjustment?.action === "stop" ? adjustment.reason : "Do not continue while pain or soreness affects normal movement. Review how you feel before resuming.";
  } else if (skipped) {
    label = "Exercise skipped or stopped";
    title = "No further sets planned";
    message = "This exercise will not earn progression from this session. Continue to the next suitable exercise, or finish your workout.";
  } else if (finished) {
    label = "Exercise complete";
    title = recoveryPending ? "Recovery check pending" : "All working sets logged";
    message = recoveryPending
      ? "After at least 48 hours, tell RepArc how you recovered. The next recommendation needs that answer and enough useful history; an increase is not guaranteed."
      : "Review your guidance when you next train this exercise. Completing these sets alone does not mean the load should increase.";
    if (completed.some((entry) => entry.rir === "")) detail = "Some reps-left estimates are missing. Add them only if you can reasonably estimate them; missing effort data may delay a weight increase.";
  } else if (adjustment) {
    title = numericLoad(adjustment.nextLoad)
      ? `${adjustment.action === "hold" ? "Keep" : "Use"} ${weightLabel(adjustment.nextLoad)}`
      : adjustment.action === "decrease" ? "Reduce difficulty" : "No automatic increase";
    message = adjustment.reason;
    detail = adjustment.evidence.join(" · ");
    confidence = adjustment.confidence;
    if (numericLoad(adjustment.nextLoad)) applyLoad = adjustment.nextLoad;
  } else if (completed.length) {
    title = prescribed ? "Follow today’s set instructions" : "Complete the remaining sets";
    message = prescribed ? "Use the weight and reps shown for this workout. This is not a recommendation for your next workout."
      : "Follow the displayed reps and effort target. There is not enough guidance to recommend a different weight yet.";
  } else {
    title = numericLoad(suggestion?.value) ? `Start with ${weightLabel(suggestion.value)}`
      : recovering ? "Rebuild with a comfortable load"
      : exercise.loadingType === "assisted-bodyweight" ? "Start with comfortable assistance"
      : exercise.loadingType === "unloaded" ? "No external load required"
      : exercise.loadingType === "bodyweight" || exercise.bodyweight ? "Start with a manageable variation"
      : "Start light · rehearse first";
    message = suggestion?.reason ?? "RepArc does not have enough useful history to choose a number. Rehearse with an easy weight or variation and leave the displayed number of good reps.";
    confidence = suggestion?.confidence;
    if (numericLoad(suggestion?.value)) applyLoad = suggestion.value;
  }

  const lastLogged = completed.at(-1);
  return <section aria-label="Exercise guidance" className={`target-panel min-w-0 self-start rounded-2xl border p-4 ${unsafe ? "border-red-300/30 bg-red-300/[0.06]" : "border-white/10 bg-black/20"}`}>
    <p className="text-sm font-semibold text-stone-400">{label}</p>
    <h3 className="mt-2 text-xl font-semibold leading-snug text-stone-100">{title}</h3>
    {lastLogged && finished && <p className="mt-2 text-sm leading-6 text-stone-300">{completed.length} working sets logged · last set: {exercise.loadingType === "unloaded" ? "" : `${weightLabel(Number(lastLogged.w || 0))} × `}{lastLogged.r} reps. Logged result, not a new prescription.</p>}
    <p className="mt-2 text-sm leading-6 text-stone-300" role={unsafe ? "alert" : undefined}>{message}</p>
    {!unsafe && !skipped && !finished && <p className="mt-2 text-sm leading-6 text-stone-300">{prescribed ? "Follow the reps and any final-effort or starting-level instructions shown above." : `Aim for ${exercise.repLow}–${exercise.repHigh} reps and stop with at least ${targetRir} good reps left.`}</p>}
    {applyLoad !== undefined && <Button type="button" variant="outline" className="mt-3 min-h-11 w-full whitespace-normal text-sm" onClick={() => onApply(applyLoad)}>Fill {completed.length ? "next" : "first"} set · {weightLabel(applyLoad)}</Button>}
    {(detail || confidence) && <details className="mt-3 text-sm text-stone-400"><summary className="min-h-6 cursor-pointer">Why this guidance?</summary>{detail && <p className="mt-2 leading-6">{detail}</p>}{confidence && <p className="mt-2">This is based on {confidence === "high" ? "more" : confidence === "moderate" ? "some" : "limited"} usable data. It is an estimate, not a guarantee.</p>}</details>}
  </section>;
}
