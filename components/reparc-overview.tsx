"use client";
import { useEffect, useState } from "react";
import { ClipboardCheck, TrendingUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/brand-lockup";

export function OverviewContent() {
  return <div className="space-y-5 text-base leading-7">
    <h1 className="text-3xl font-semibold tracking-tight">Your training, one session at a time.</h1>
    {[[ClipboardCheck, "Set up your week", "Choose your schedule, equipment and starting point."], [TrendingUp, "Log and build", "Record sets, reps and effort. Guidance uses comparable exercise history and your recovery."], [ShieldCheck, "Ease into new exercises", "Start with comfortable loads and reduced sets, even if you have trained for years."]].map(([Icon, title, copy]) => {
      const IconComponent = Icon as typeof ClipboardCheck;
      return <div key={String(title)} className="flex gap-3"><IconComponent aria-hidden="true" className="mt-1 size-5 shrink-0 text-amber-300" /><div><h2 className="font-semibold">{String(title)}</h2><p className="text-stone-400">{String(copy)}</p></div></div>;
    })}
    <p className="text-sm leading-6 text-stone-400">Built on published research and an adaptation of SBS. Recommendations are estimates, not guaranteed results or medical advice. Stop for pain; the Guide explains the program and its limits.</p>
  </div>;
}
export function FirstSetupOverview({ accountId, children }: { accountId: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const key = `reparc-overview-v1:${accountId}`;
  useEffect(() => { const timer = window.setTimeout(() => { try { setDismissed(localStorage.getItem(key) === "1"); } catch { /* Optional device preference. */ } setReady(true); }, 0); return () => window.clearTimeout(timer); }, [key]);
  if (!ready) return <main className="min-h-dvh bg-[#0b0d0c]" aria-busy="true" />;
  if (dismissed) return children;
  return <main id="main-content" className="onboarding-shell min-h-dvh bg-[#0b0d0c] px-5 py-8 text-stone-100"><div className="mx-auto max-w-xl"><BrandLockup /><section className="motion-panel mt-8 rounded-3xl border border-white/10 bg-white/[0.045] p-6"><OverviewContent /><Button type="button" className="mt-6 min-h-12 w-full rounded-xl bg-amber-300 font-bold text-[#0b0d0c]" onClick={() => { try { localStorage.setItem(key, "1"); } catch { /* Optional device preference. */ } setDismissed(true); }}>Start setup</Button></section></div></main>;
}
