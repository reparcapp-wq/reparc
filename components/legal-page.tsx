import { BrandLockup } from "@/components/brand-lockup";
import Link from "next/link";

export function LegalPage({ eyebrow, title, summary, children }: {
  eyebrow: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[#0b0d0c] px-5 py-7 text-stone-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between gap-4"><Link href="/" aria-label="Return to RepArc"><BrandLockup /></Link><Link href="/" className="text-xs text-amber-300 hover:text-amber-200">Return to app</Link></header>
        <article className="mt-10 rounded-[2rem] border border-white/10 bg-[#121512] p-6 sm:p-10">
          <p className="eyebrow text-amber-300">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-400">{summary}</p>
          <p className="mt-3 text-xs text-stone-600">Last updated 29 August 2026</p>
          <div className="legal-copy mt-9 space-y-8 text-sm leading-7 text-stone-300">{children}</div>
        </article>
        <footer className="flex flex-wrap gap-x-4 gap-y-2 px-2 py-7 text-xs text-stone-600"><a href="/privacy" className="hover:text-stone-300">Privacy</a><a href="/terms" className="hover:text-stone-300">Terms & safety</a></footer>
      </div>
    </main>
  );
}
