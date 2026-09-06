"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { equipmentChoices, parseAvailableLoads } from "@/lib/load-profile-editor";
import { type TrainingData, type Unit } from "@/lib/training";

export function LoadProfileEditor({ name, unit, values, hint, onSave, onClear }: {
  name: string; unit: Unit; values: number[]; hint: string;
  onSave: (values: number[]) => Promise<boolean>;
  onClear?: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(values.join(", "));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <form className="load-profile-editor space-y-3" onSubmit={async (event) => {
    event.preventDefault();
    const parsed = parseAvailableLoads(draft);
    if (parsed.error) { setMessage(parsed.error); return; }
    setBusy(true);
    try {
      const saved = await onSave(parsed.values);
      setMessage(saved ? "Loads saved. You can edit them here anytime." : "Could not save. Your entries are still here; try again.");
      if (saved) setDraft(parsed.values.join(", "));
    } catch { setMessage("Could not save. Your entries are still here; try again."); }
    finally { setBusy(false); }
  }}>
    <p className="text-sm leading-6 text-stone-400">{hint}</p>
    <label className="block text-sm font-semibold">Available loads in {unit}
      <Input value={draft} onChange={(event) => { setDraft(event.target.value); setMessage(""); }} disabled={busy} autoComplete="off" spellCheck={false} placeholder="2.5, 5, 7.5, 10" aria-label={`Available ${unit} loads for ${name}`} className="mt-2 h-12 rounded-xl border-white/10 bg-black/20 font-mono !text-base" />
    </label>
    <p className="text-sm leading-5 text-stone-400">Enter the values actually available on this equipment. This sets equipment choices, not a recommended starting weight.</p>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy} type="submit" className="min-h-11 rounded-xl bg-amber-300 font-bold text-[#0b0d0c] hover:bg-amber-200">{busy ? "Saving…" : "Save loads"}</Button>
      {values.length > 0 && onClear && <Button disabled={busy} type="button" variant="outline" className="min-h-11 rounded-xl" onClick={async () => {
        if (!window.confirm(`Clear the saved equipment loads for ${name}? Workout logs will stay unchanged.`)) return;
        setBusy(true);
        try { if (await onClear()) { setDraft(""); setMessage("Saved loads cleared. Workout history is unchanged."); } else setMessage("Could not clear the saved loads. Try again."); }
        catch { setMessage("Could not clear the saved loads. Try again."); }
        finally { setBusy(false); }
      }}>Clear saved loads</Button>}
    </div>
    {message && <p role="status" className="text-sm leading-5">{message}</p>}
  </form>;
}

export function EquipmentSettings({ data, onUpdate }: { data: TrainingData; onUpdate: (data: TrainingData, message?: string) => Promise<boolean> }) {
  const choices = equipmentChoices(data);
  const [selected, setSelected] = useState("");
  const item = choices.find((choice) => choice.key === selected);
  const unit = data.profile!.unit;
  return <article className="rounded-2xl border border-white/10 bg-[#121512] p-4 sm:p-6 md:col-span-2">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Settings2 className="size-5" />Available loads</h2>
    <p className="mt-2 text-sm leading-6 text-stone-400">Set each exercise once. Saved values stay with that exercise and convert when you change units. Your workout logs are not changed.</p>
    <label className="mt-4 block text-sm font-semibold">Exercise
      <select value={item?.key ?? ""} onChange={(event) => setSelected(event.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-white/10 bg-background px-3 text-base text-foreground">
        <option value="">Choose an exercise</option>
        {choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.name}{choice.values.length ? " · saved" : " · not set"}</option>)}
      </select>
    </label>
    {item && <div className="swap-reveal mt-4" key={`${item.key}:${unit}`}><LoadProfileEditor name={item.name} unit={unit} values={item.values} hint={item.hint}
      onSave={(values) => { const now = new Date().toISOString(); return onUpdate({ ...data, loadProfiles: { ...data.loadProfiles, [item.key]: { unit, values, updatedAt: now } }, updatedAt: now }, "Available loads saved"); }}
      onClear={() => { const now = new Date().toISOString(); return onUpdate({ ...data, loadProfiles: { ...data.loadProfiles, [item.key]: { unit, values: [], updatedAt: now, deletedAt: now } }, updatedAt: now }, "Available loads cleared"); }}
    /></div>}
  </article>;
}

export function ExerciseSwap({ name, options, open, disabled, lockedLabel, onToggle, onSelect, id }: {
  name: string; options: string[]; open: boolean; disabled: boolean; lockedLabel?: string;
  onToggle: () => void; onSelect: (name: string) => void; id: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return <div className="exercise-heading" onKeyDown={(event) => { if (event.key === "Escape" && open) { event.stopPropagation(); onToggle(); triggerRef.current?.focus(); } }}>
    <div className="flex items-start justify-between gap-2">
      <h3 key={open ? "choosing" : name} className="swap-reveal min-w-0 flex-1 text-lg font-semibold leading-6">{open ? "Choose an exercise" : name}</h3>
      <Button ref={triggerRef} type="button" variant="ghost" onClick={onToggle} disabled={disabled} aria-label={open ? `Cancel swapping ${name}` : `Swap ${name}`} aria-expanded={open} aria-controls={open ? `swap-options-${id}` : undefined} className="-mt-2 min-h-11 shrink-0 rounded-xl px-3 text-sm text-stone-300">
        {lockedLabel ?? (open ? "Cancel" : "Swap")}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
    </div>
    {open && <div id={`swap-options-${id}`} className="swap-reveal mt-2 grid gap-2 sm:grid-cols-2" role="group" aria-label={`Alternatives to ${name}`}>
      {[...new Set([name, ...options])].map((option) => <Button key={option} type="button" variant="outline" aria-pressed={option === name} data-selected={option === name} onClick={() => { onSelect(option); triggerRef.current?.focus(); }} className="selection-button h-auto min-h-11 justify-start whitespace-normal rounded-xl px-3 py-3 text-left text-sm leading-5">{option === name && <Check className="size-4 shrink-0" />}{option}</Button>)}
    </div>}
  </div>;
}
