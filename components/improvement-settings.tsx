"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IMPROVEMENT_NOTICE_VERSION, type ImprovementStatus } from "@/lib/improvement";

export function ImprovementSettings({ onContinue }: { onContinue?: () => void }) {
  const [status, setStatus] = useState<ImprovementStatus | null>(null);
  const [chosen, setChosen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; void fetch("/api/improvement", { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error();
    const result = await response.json() as ImprovementStatus;
    if (active) { setStatus(result); setChosen(result.enabled); }
  }).catch(() => { if (active) setStatus({ available: false, enabled: false }); }); return () => { active = false; }; }, []);
  const save = async (enabled: boolean) => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/improvement", { method: enabled ? "POST" : "DELETE", headers: { "Content-Type": "application/json", "x-reparc-request": "1" }, body: enabled ? JSON.stringify({ enabled, noticeVersion: IMPROVEMENT_NOTICE_VERSION }) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus({ available: true, enabled }); setChosen(enabled);
      setMessage(enabled ? "Enabled for future sessions. You can withdraw here anytime." : "Sharing stopped. Your identifiable improvement records were deleted; workout history stays in your account.");
      if (onContinue) onContinue();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save. Reconnect and try again."); }
    finally { setBusy(false); }
  };
  const download = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/improvement", { method: "POST", headers: { "Content-Type": "application/json", "x-reparc-request": "1" }, body: JSON.stringify({ action: "export" }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "reparc-improvement-data.json"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Your improvement-data export was downloaded.");
    } catch { setMessage("Export unavailable. Reconnect and try again."); } finally { setBusy(false); }
  };
  return <section className="space-y-4 text-sm leading-6">
    <div><p className="eyebrow text-amber-300">Optional</p><h2 className="mt-2 text-xl font-semibold">Help improve RepArc</h2></div>
    <p className="text-stone-300">You can optionally share future recommendations and results so RepArc’s maintainers can check how well its guidance works. Saying no does not change your program or any feature.</p>
    <details className="rounded-xl border border-white/10 p-3 text-stone-400"><summary className="cursor-pointer font-semibold text-stone-300">What would be shared?</summary><div className="mt-3 space-y-2"><p>Exercise targets, completed sets, weights, reps, reps left, recovery, program track, and lifting experience. The separate review copy has no name or email, but it is still linked to your account ID.</p><p>Authorized RepArc maintainers may review it. Workout review records expire after 180 days; consent and access records after 365 days. Participation expires after one year.</p><p>No advertising, automatic changes to the live recommendation rules, or third-party analytics.</p></div></details>
    <p className="text-stone-400">Turn sharing off here at any time. The separate review copy will be deleted, while your own workout history stays. <a href="/privacy" target="_blank" rel="noreferrer" className="text-amber-300 underline">Read the privacy notice</a>.</p>
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-white/15 p-4"><Checkbox checked={chosen} disabled={busy || !status?.available} onCheckedChange={(value) => setChosen(value === true)} className="mt-1" /><span>I choose to share future training and recovery results to help improve RepArc.</span></label>
    {!status && <p role="status">Checking your privacy settings…</p>}
    {status && !status.available && <p role="status">Sharing status is unavailable. Reconnect to check or withdraw. If you enabled sharing earlier, that choice remains until withdrawal is confirmed. You can continue using RepArc.</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy || !status?.available} onClick={() => void save(chosen)} className="min-h-11 bg-amber-300 text-[#0b0d0c]">{busy ? "Saving…" : chosen ? "Enable sharing" : status?.enabled ? "Withdraw and delete shared data" : "Keep sharing off"}</Button>
      {!onContinue && <Button type="button" variant="outline" disabled={busy || !status?.available} onClick={() => void download()} className="min-h-11">Export shared data</Button>}
      {onContinue && <Button type="button" variant="outline" disabled={busy} onClick={onContinue} className="min-h-11">Continue without changing sharing</Button>}
    </div>
    {message && <p role="status" className="text-stone-200">{message}</p>}
  </section>;
}
