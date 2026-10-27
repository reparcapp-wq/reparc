"use client";

import { Button } from "@/components/ui/button";
import { EXPOSURE_POLICY } from "@/lib/exercise-calibration";
import type { ExerciseRecoveryStatus } from "@/lib/training";

export function recoveryWait(completedAt: string, now: number) {
  const unlock = Date.parse(completedAt) + EXPOSURE_POLICY.recoveryHours * 3_600_000;
  if (!Number.isFinite(unlock)) return { ready: false, label: "Workout finish time is missing. Review the saved workout before confirming recovery." };
  const minutes = Math.max(0, Math.ceil((unlock - now) / 60_000));
  const hours = Math.floor(minutes / 60);
  return { ready: now >= unlock, label: `Normal or mild recovery unlocks in ${hours ? `${hours}h ` : ""}${minutes % 60}m.` };
}

export function RecoveryCheck({ completedAt, now, selected, busy, onSelect }: {
  completedAt: string; now: number; selected?: ExerciseRecoveryStatus; busy: boolean;
  onSelect: (status: ExerciseRecoveryStatus) => void;
}) {
  const wait = recoveryWait(completedAt, now);
  return <div className="recovery-check">
    <p className="mt-2 text-stone-400">How did you recover? RepArc waits 48 hours after the workout before accepting normal or mild recovery for increases.</p>
    {!wait.ready && <p role="status" className="mt-2 text-sm text-amber-200">{wait.label} You can report a problem now.</p>}
    {busy && <p role="status" className="mt-2 text-sm text-stone-400">Saving your changes…</p>}
    <div className="mt-3 grid grid-cols-2 gap-2">
      {([["recovered", "Normal movement"], ["mild", "Mild and improving"]] as const).map(([status, label]) =>
        <Button key={status} type="button" variant="outline" data-selected={selected === status} aria-pressed={selected === status} disabled={busy || !wait.ready} className="selection-button h-auto min-h-11 whitespace-normal rounded-lg px-2 py-2 text-xs" onClick={() => onSelect(status)}>{label}</Button>)}
    </div>
    <p className="mt-3 text-xs font-semibold text-stone-300">Report a problem at any time</p>
    <div className="mt-2 grid grid-cols-2 gap-2">
      {([["limiting", "Limited daily movement"], ["severe", "Severe / unusual symptoms"]] as const).map(([status, label]) =>
        <Button key={status} type="button" variant="outline" data-selected={selected === status} aria-pressed={selected === status} disabled={busy} className="selection-button recovery-problem h-auto min-h-11 whitespace-normal rounded-lg px-2 py-2 text-xs" onClick={() => onSelect(status)}>{label}</Button>)}
    </div>
    {(selected === "severe" || selected === "limiting") && <p className="mt-3 text-red-200">Wait until normal movement returns. Dark urine, marked swelling, unusual weakness or severe pain needs urgent medical assessment.</p>}
  </div>;
}
