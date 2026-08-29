"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, BookOpen, ExternalLink, ShieldCheck, WifiOff } from "lucide-react";

const references = [
  {
    grade: "Strong",
    title: "ACSM resistance-training position stand",
    result: "137 systematic reviews and more than 30,000 participants: consistency, individualization and adequate weekly work matter more than complicated methods.",
    limitation: "General healthy-adult guidance; individual clinical needs still require professional assessment.",
    href: "https://acsm.org/resistance-training-guidelines-update-2026/",
  },
  {
    grade: "Moderate",
    title: "Sex differences in resistance training",
    result: "No meaningful sex difference in relative hypertrophy or lower-body strength response; relative upper-body strength gains favored women in the available studies.",
    limitation: "The included studies were generally short and heterogeneous.",
    href: "https://pubmed.ncbi.nlm.nih.gov/32218059/",
  },
  {
    grade: "Strong",
    title: "Resistance training in women",
    result: "A women-only meta-analysis of 24 studies found large strength improvements and a moderate hypertrophy effect.",
    limitation: "Overall study quality was moderate and prescriptions varied.",
    href: "https://pubmed.ncbi.nlm.nih.gov/31820374/",
  },
  {
    grade: "Moderate",
    title: "Training moderators in healthy young women",
    result: "Forty studies with 1,312 participants found meaningful strength, lean-mass, body-fat and power improvements; training exposure and volume influenced outcomes.",
    limitation: "The population was primarily healthy women aged 18–35.",
    href: "https://pubmed.ncbi.nlm.nih.gov/38090747/",
  },
  {
    grade: "Insufficient for automatic cycle syncing",
    title: "Menstrual-cycle phase and resistance training",
    result: "Current reviews do not show a reliable general effect of cycle phase on acute strength or long-term resistance-training adaptations.",
    limitation: "Cycle verification and study methods are inconsistent; an individual's symptoms may still affect a given session.",
    href: "https://pubmed.ncbi.nlm.nih.gov/37033884/",
  },
  {
    grade: "Moderate",
    title: "Resistance-training fatigue by sex",
    result: "A review of 34 studies found mostly minor or no sex differences in trained participants.",
    limitation: "Exercise selection, strength level, rest periods and study methods varied substantially.",
    href: "https://pubmed.ncbi.nlm.nih.gov/40112869/",
  },
  {
    grade: "Clinical consensus",
    title: "Relative Energy Deficiency in Sport",
    result: "Prolonged under-fueling can impair health, recovery and performance in women and men.",
    limitation: "REDs is a clinical diagnosis; an app cannot diagnose it.",
    href: "https://doi.org/10.1136/bjsports-2023-106994",
  },
  {
    grade: "Clinical guidance",
    title: "Exercise during pregnancy and postpartum",
    result: "Exercise can be beneficial, but pregnancy requires clinical screening and pregnancy-specific modifications.",
    limitation: "The programs in this app are not pregnancy or postpartum prescriptions.",
    href: "https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/04/physical-activity-and-exercise-during-pregnancy-and-the-postpartum-period",
  },
];

const topics = [
  { id: "start", label: "Start" },
  { id: "program", label: "Program" },
  { id: "logging", label: "Logging" },
  { id: "women", label: "Women" },
  { id: "offline", label: "Offline" },
  { id: "safety", label: "Safety" },
  { id: "evidence", label: "Evidence" },
] as const;

type TopicId = (typeof topics)[number]["id"];

function GuideSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-7">
      <p className="eyebrow text-amber-300">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-6 text-stone-400">{children}</div>
    </section>
  );
}

export function TrainingGuide() {
  const [active, setActive] = useState<TopicId>("start");
  const topicListRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const topic = window.location.hash.replace("#guide-", "") as TopicId;
      if (topics.some((item) => item.id === topic)) setActive(topic);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const list = topicListRef.current;
    const tab = list?.querySelector<HTMLElement>(`#guide-tab-${active}`);
    if (!list || !tab) return;

    const listBounds = list.getBoundingClientRect();
    const tabBounds = tab.getBoundingClientRect();
    const centeredLeft = list.scrollLeft + tabBounds.left - listBounds.left - (listBounds.width - tabBounds.width) / 2;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ left: Math.max(0, centeredLeft), behavior: reduceMotion ? "auto" : "smooth" });
  }, [active]);

  const selectTopic = (topic: TopicId) => {
    setActive(topic);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#guide-${topic}`);
  };

  const activeIndex = topics.findIndex((topic) => topic.id === active);

  return (
    <section className="motion-page mx-auto max-w-5xl px-4 py-5 sm:px-7 lg:py-8" role="tabpanel" aria-label="Guide and evidence">
      <div className="flex items-start gap-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-300 text-[#0b0d0c]"><BookOpen className="size-6" /></div>
        <div>
          <p className="eyebrow text-amber-300">How this works</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Training guide</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">A straightforward explanation of the program, its limits and the evidence behind its decisions.</p>
        </div>
      </div>

      <nav ref={topicListRef} className="scrollbar-none mt-6 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Guide sections">
        {topics.map((topic) => <ButtonTopic key={topic.id} topic={topic} active={active === topic.id} onSelect={selectTopic} />)}
      </nav>

      <div id={`guide-panel-${active}`} key={active} className="guide-topic mt-4" role="tabpanel" aria-labelledby={`guide-tab-${active}`}>
        {active === "start" && <GuideSection eyebrow="01 / Start" title="What the app does">
          <p>RepArc turns each completed workout into the next practical target. It records sets, load, repetitions and RIR, then uses your own recent performance before relying on demographic estimates.</p>
          <p>The app is evidence-informed, not a promise of a particular result. Sleep, nutrition, technique, health, equipment and consistency all affect outcomes.</p>
        </GuideSection>}

        {active === "program" && <GuideSection eyebrow="02 / Program" title="Foundation, then autoregulation">
          <p><strong className="text-stone-200">Phase 1 · Foundation:</strong> build consistent technique and usable performance history. You can move to Phase 2 after reviewing the transition; there is no arbitrary calendar lock.</p>
          <p><strong className="text-stone-200">Phase 2 · Autoregulated hypertrophy:</strong> a 21-week, three-block progression. Programmed lifts use a training max and a final performance set. Weeks 7, 14 and 21 reduce loading.</p>
          <p>Three-, four- and five-day schedules distribute the work differently. Changing frequency or program does not erase earlier sessions.</p>
        </GuideSection>}

        {active === "logging" && <GuideSection eyebrow="03 / Logging" title="Sets, RIR and recommendations">
          <p><strong className="text-stone-200">RIR</strong> means repetitions in reserve: how many technically sound repetitions you believe remained. Most normal sets should finish with roughly one to three RIR.</p>
          <p><strong className="text-stone-200">AMRAP</strong> means as many technically sound repetitions as possible—not repetitions performed after form breaks down. Stop for pain, loss of control or unsafe technique.</p>
          <p>First-session loads are estimates. Adjust after the first set. Completed history, rep ranges and RIR become the stronger signal afterward.</p>
        </GuideSection>}

        {active === "women" && <GuideSection eyebrow="04 / Women’s track" title="What changes—and what does not">
          <p>The women’s track keeps the same movement fundamentals and progression rules. It distributes lower-body exposure across the week, retains meaningful upper-body training and lets the user choose balanced, upper- or lower-body emphasis.</p>
          <p>It does not assume that every woman recovers faster, needs lighter effort or should train only glutes. It also does not automatically change workouts from menstrual-cycle dates.</p>
          <p>Menstrual symptoms can be selected in the readiness check. The app responds with conservative session options without storing cycle dates or reproductive-health history.</p>
        </GuideSection>}

        {active === "offline" && <GuideSection eyebrow="05 / Data" title="Offline, cloud and backups">
          <div className="flex gap-3"><WifiOff className="mt-1 size-5 shrink-0 text-emerald-300" /><p>Once this device has signed in and loaded the app, workouts can be recorded without internet. Changes queue locally and sync when a connection returns.</p></div>
          <p>Cloud history belongs to the verified account. JSON preserves the complete app structure; CSV provides a portable spreadsheet copy.</p>
        </GuideSection>}

        {active === "safety" && <GuideSection eyebrow="06 / Safety" title="Know when the app is not enough">
          <div className="flex gap-3"><ShieldCheck className="mt-1 size-5 shrink-0 text-amber-300" /><p>This is general fitness guidance for adults—not diagnosis, rehabilitation or individualized medical care.</p></div>
          <p>Stop and seek appropriate help for chest pain, fainting, severe shortness of breath, sudden weakness, sharp or worsening pain, unusual swelling, or any symptom that makes training unsafe.</p>
          <p>Pregnancy, recent postpartum recovery, osteoporosis treatment, eating disorders, repeated missed periods, recurrent stress injuries and active rehabilitation need appropriately qualified professional guidance.</p>
        </GuideSection>}

        {active === "evidence" && <section className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-7">
          <div className="flex items-start gap-3"><Activity className="mt-1 size-5 shrink-0 text-amber-300" /><div><p className="eyebrow text-amber-300">07 / Evidence</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Evidence library</h2><p className="mt-2 text-xs leading-5 text-stone-500">Last reviewed 29 August 2026. Ratings describe confidence for this app decision, not the quality of every outcome in a paper.</p></div></div>
          <details className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"><summary className="cursor-pointer text-sm font-semibold text-stone-200">Show all {references.length} reviewed sources</summary><div className="mt-4 grid gap-3 sm:grid-cols-2">{references.map((reference) => <article key={reference.title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><span className="rounded-full bg-amber-300/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-amber-200">{reference.grade}</span><h3 className="mt-3 font-semibold text-stone-100">{reference.title}</h3><p className="mt-2 text-xs leading-5 text-stone-400">{reference.result}</p><p className="mt-2 text-[11px] leading-5 text-stone-600"><strong className="text-stone-500">Limit:</strong> {reference.limitation}</p><a href={reference.href} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-amber-300 hover:text-amber-200">Open source <ExternalLink className="size-3.5" /><span className="sr-only"> for {reference.title}</span></a></article>)}</div></details>
        </section>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => selectTopic(topics[Math.max(0, activeIndex - 1)].id)} disabled={activeIndex === 0} className="min-h-11 rounded-xl px-4 text-xs font-semibold text-stone-400 hover:bg-white/10 hover:text-white disabled:opacity-30">Previous</button>
        <span className="font-mono text-[10px] text-stone-600">{activeIndex + 1} / {topics.length}</span>
        <button type="button" onClick={() => selectTopic(topics[Math.min(topics.length - 1, activeIndex + 1)].id)} disabled={activeIndex === topics.length - 1} className="min-h-11 rounded-xl px-4 text-xs font-semibold text-amber-300 hover:bg-white/10 hover:text-amber-200 disabled:opacity-30">Next</button>
      </div>
    </section>
  );
}

function ButtonTopic({ topic, active, onSelect }: { topic: (typeof topics)[number]; active: boolean; onSelect: (topic: TopicId) => void }) {
  return <button id={`guide-tab-${topic.id}`} type="button" role="tab" aria-selected={active} aria-controls={`guide-panel-${topic.id}`} tabIndex={active ? 0 : -1} onClick={() => onSelect(topic.id)} className={`shrink-0 rounded-full border px-3 py-2 text-xs transition-colors ${active ? "border-amber-300 bg-amber-300 font-bold text-[#0b0d0c]" : "border-white/10 bg-white/[0.035] text-stone-300 hover:border-amber-300/40 hover:text-amber-200"}`}>{topic.label}</button>;
}
