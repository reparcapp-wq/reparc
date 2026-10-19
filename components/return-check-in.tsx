"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { assessReturnCheckIn, returnCheckInContext } from "@/lib/return-check-in";
import { isValidDateOnly, prettyDate, type Readiness, type ReturnCheckIn, type TrainingData, type WeightGoal } from "@/lib/training";

export function ReturnCheckInPanel({ data, date, onClose, onSave, onPause }: {
  data: TrainingData; date: string; onClose: () => void;
  onSave: (answer: ReturnCheckIn) => Promise<boolean>; onPause: () => Promise<boolean>;
}) {
  const context = useMemo(() => returnCheckInContext(data, date), [data, date]);
  const previous = !context.due ? context.lastAnswer : undefined;
  const previousDate = previous ? [previous.lastLiftDate, context.lastRecorded].filter((value): value is string => Boolean(value)).sort().at(-1)! : "";
  const [activity, setActivity] = useState<ReturnCheckIn["activity"] | null>(previous?.activity ?? null);
  const [lastLiftDate, setLastLiftDate] = useState(previousDate);
  const [approximate, setApproximate] = useState(previousDate === previous?.lastLiftDate && Boolean(previous?.approximate));
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [weightGoal, setWeightGoal] = useState<WeightGoal>(data.profile?.weightGoal ?? "maintain");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const answer: ReturnCheckIn | null = activity && readiness && isValidDateOnly(lastLiftDate) && lastLiftDate <= date
    ? { version: 1, activity, lastLiftDate, approximate, readiness, weightGoal } : null;
  const assessment = preview && answer ? assessReturnCheckIn(data, answer, date, new Date().toISOString()) : null;
  const run = async (pause = false) => {
    setBusy(true); setError("");
    try {
      const saved = pause ? await onPause() : answer ? await onSave(answer) : false;
      if (saved) onClose(); else setError("Could not save. Your answers are still here; please try again.");
    } catch { setError("Could not save. Check the date and try again."); }
    finally { setBusy(false); }
  };
  return <Sheet open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <SheetContent showCloseButton={false} className="return-check-in z-[60] w-full max-w-full gap-0 bg-background text-foreground data-[state=open]:duration-200 data-[state=closed]:duration-150 sm:max-w-lg">
      <SheetHeader className="shrink-0 border-b p-4">
        <div className="flex items-center justify-between gap-3"><SheetTitle>{preview ? "Your next workouts" : "Welcome back"}</SheetTitle><Button type="button" variant="ghost" size="icon" aria-label="Close return check-in" disabled={busy} onClick={onClose}><X className="size-5" /></Button></div>
        <SheetDescription>{context.lastRecorded ? `Your last recorded workout was ${prettyDate(context.lastRecorded, { month: "short", day: "numeric" })}. Tell RepArc what happened since then.` : "Tell RepArc how you have been training before resuming."}</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {!preview ? <div className="space-y-6">
          <fieldset><legend className="mb-2 text-sm font-semibold">Have you been lifting?</legend><div className="grid gap-2">{([
            ["stopped", "I stopped lifting"], ["reduced", "I trained less than usual"], ["continued", "I kept lifting, but did not log it"],
          ] as const).map(([value, label]) => <Button key={value} type="button" variant="outline" aria-pressed={activity === value} data-selected={activity === value} onClick={() => setActivity(value)} className="selection-button min-h-12 justify-start whitespace-normal text-left">{activity === value && <Check className="size-4 shrink-0" />}{label}</Button>)}</div></fieldset>
          <div><label htmlFor="return-last-lift" className="text-sm font-semibold">When did you last lift?</label><Input id="return-last-lift" type="date" max={date} value={lastLiftDate} onChange={(event) => { setLastLiftDate(event.target.value); setApproximate(false); }} className="mt-2 min-h-12 w-full min-w-0 text-base" />
            {lastLiftDate > date && <p role="alert" className="mt-2 text-xs text-destructive">Choose today or an earlier date.</p>}
            <Button type="button" variant="ghost" className="mt-1 min-h-11 h-auto whitespace-normal px-0 text-left text-xs" onClick={() => { setLastLiftDate(context.fallbackDate); setApproximate(true); }}>Not sure — use {prettyDate(context.fallbackDate, { month: "short", day: "numeric" })} conservatively</Button>
            {approximate && <p className="text-xs text-muted-foreground">Saved as an approximate date. You can review this check-in later.</p>}</div>
          <fieldset><legend className="mb-2 text-sm font-semibold">How do you feel today?</legend><div className="grid grid-cols-2 gap-2">{([
            ["normal", "Ready"], ["low", "Low energy"], ["sore", "Sore, moving normally"], ["severe-soreness", "Soreness limits movement"], ["pain", "Pain / not safe to train"],
            ...(data.profile?.gender === "woman" ? [["symptoms", "Menstrual symptoms"] as const] : []),
          ] as Array<readonly [Readiness, string]>).map(([value, label]) => <Button key={value} type="button" variant="outline" aria-pressed={readiness === value} data-selected={readiness === value} onClick={() => setReadiness(value)} className="selection-button h-auto min-h-12 whitespace-normal px-2 py-2 text-xs">{label}</Button>)}</div></fieldset>
          <fieldset><legend className="mb-1 text-sm font-semibold">Your weight goal</legend><p className="mb-2 text-xs text-muted-foreground">Taking a diet break does not mean you stopped lifting.</p><div className="grid grid-cols-3 gap-2">{([["cut", "Cut"], ["maintain", "Maintain"], ["bulk", "Bulk"]] as const).map(([value, label]) => <Button key={value} type="button" variant="outline" aria-pressed={weightGoal === value} data-selected={weightGoal === value} onClick={() => setWeightGoal(value)} className="selection-button min-h-11 px-2">{label}</Button>)}</div></fieldset>
        </div> : assessment && <div className="space-y-4 text-sm leading-6">
          <div className="rounded-2xl border p-4"><p className="font-semibold">{assessment.blocked ? "Keep training paused" : assessment.plan ? `${assessment.plan.sessionsRemaining} easier workout${assessment.plan.sessionsRemaining === 1 ? "" : "s"} before review` : "Continue with your exercise checks"}</p>
            <p className="mt-1 text-muted-foreground">{approximate ? "About " : ""}{assessment.gapDays} day{assessment.gapDays === 1 ? "" : "s"} since you last lifted · Goal: {weightGoal === "bulk" ? "Bulk" : weightGoal === "cut" ? "Cut" : "Maintain"}</p></div>
          {assessment.blocked ? <p role="alert">Wait until you can train comfortably. Do not train through pain or soreness that limits normal movement. Severe pain, dark urine, marked swelling or unusual weakness needs urgent medical assessment.</p> : <>
            {assessment.plan ? <ul className="list-disc space-y-2 pl-5"><li>Fewer working sets. If an exercise is unfamiliar, its lower set limit still applies.</li><li>Conservative starting weights. Follow each exercise’s suggestion and how it feels.</li><li>Leave at least {assessment.plan.targetRir} good reps left, or more if the exercise asks.</li><li>Automatic increases stay on hold during return workouts.</li></ul> : <p>Your answers do not call for an extra whole-workout reduction. Each exercise still follows its saved history, familiarity and recovery checks.</p>}
            <p className="text-muted-foreground">After training, report recovery in Training notices.{assessment.plan ? " Completing the easier workouts does not bypass those checks." : " Your exercise recovery checks still apply."}</p>
            {assessment.correctedLoggingGap ? <p className="text-muted-foreground">Your unused return plan was based on a logging gap. Your answers remove that extra reduction; exercise checks still apply.</p> : data.program.returnPlan && <p className="text-muted-foreground">These limits are combined with your current return plan once; the reductions are not multiplied.</p>}
            {activity !== "stopped" && <p className="text-muted-foreground">Unlogged lifting helps explain the gap, but does not create sets, weights or established exercise history.</p>}
            <p className="text-muted-foreground">Your program week and previous records stay in place. Missed days are marked as explained; no catch-up workouts are stacked into today.</p>
          </>}
        </div>}
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
      <div className="shrink-0 space-y-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">{preview && <Button type="button" variant="outline" aria-label="Back to return questions" disabled={busy} onClick={() => setPreview(false)} className="min-h-12"><ArrowLeft className="size-4" /></Button>}<Button type="button" disabled={!answer || busy} onClick={() => preview ? void run() : setPreview(true)} className="min-h-12 flex-1 whitespace-normal bg-amber-300 font-semibold text-[#0b0d0c] hover:bg-amber-200">{busy ? "Saving…" : preview ? assessment?.blocked ? "Save and keep paused" : "Save return plan" : "See my return plan"}</Button></div>
        {!preview && <Button type="button" variant="ghost" disabled={busy} onClick={() => void run(true)} className="min-h-11 w-full">I’m not back yet — keep training paused</Button>}
      </div>
    </SheetContent>
  </Sheet>;
}
