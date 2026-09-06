"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, BookOpen, ExternalLink, ShieldCheck, WifiOff } from "lucide-react";

const references = [
  {
    grade: "Moderate · mechanism",
    title: "Repeated exposure and muscle-damage responses",
    result: "A 2023 review of 20 studies found less soreness and smaller performance disruption after a repeated exercise bout. This supports gradual familiarization with unfamiliar movements.",
    limitation: "It does not validate RepArc’s exact set counts, recovery thresholds or novelty limit, and cannot guarantee prevention of severe soreness.",
    href: "https://pubmed.ncbi.nlm.nih.gov/38015738/",
  },
  {
    grade: "Program source",
    title: "Stronger by Science Program Bundle",
    result: "The official bundle describes a 21-week hypertrophy template split into three seven-week blocks with performance-based load progression.",
    limitation: "RepArc is an independent adaptation and is not affiliated with, reviewed by or endorsed by Stronger by Science.",
    href: "https://www.strongerbyscience.com/program-bundle/",
  },
  {
    grade: "Strong",
    title: "ACSM resistance-training position stand",
    result: "137 systematic reviews and more than 30,000 participants: consistency, individualization and adequate weekly work matter more than complicated methods.",
    limitation: "General healthy-adult guidance; individual clinical needs still require professional assessment.",
    href: "https://acsm.org/resistance-training-guidelines-update-2026/",
  },
  {
    grade: "Consensus guidance",
    title: "Progression models in resistance training",
    result: "ACSM recommends progressive loading in context, commonly increasing load after the target can be exceeded by one to two repetitions rather than after a single arbitrary result.",
    limitation: "The 2009 position stand is broad guidance; equipment increments, exercise type and training status still matter.",
    href: "https://pubmed.ncbi.nlm.nih.gov/19204579/",
  },
  {
    grade: "Moderate",
    title: "Accuracy of repetitions-in-reserve ratings",
    result: "A meta-analysis found that lifters underpredicted repetitions to failure by about one repetition on average, with substantial variation and better accuracy nearer failure.",
    limitation: "RIR is useful but subjective; RepArc lowers confidence when it is missing and never treats it as an exact measurement.",
    href: "https://pubmed.ncbi.nlm.nih.gov/34542869/",
  },
  {
    grade: "Emerging",
    title: "Cross-validation of estimated 1RM equations",
    result: "A 2025 study using four- to ten-repetition sets found prediction accuracy varied by exercise and equation, supporting exercise-specific trend use rather than a universal true-1RM claim.",
    limitation: "The study tested bench press and leg extension; RepArc therefore treats its estimate as a narrow trend and suppresses unsuitable movements.",
    href: "https://pubmed.ncbi.nlm.nih.gov/39495260/",
  },
  {
    grade: "Measurement caution",
    title: "Methods used to quantify resistance-training volume",
    result: "External load × repetitions is a simple volume-load measure, but different volume methods produce substantially different values.",
    limitation: "RepArc’s external-load volume is descriptive and should be compared only within the same exercise and setup—not as mechanical work or a cross-exercise score.",
    href: "https://pubmed.ncbi.nlm.nih.gov/19130641/",
  },
  {
    grade: "Moderate",
    title: "Rest intervals and muscle hypertrophy",
    result: "A systematic review found a small hypertrophy benefit from rest periods longer than 60 seconds, with little appreciable difference beyond roughly 90 seconds in the available evidence.",
    limitation: "Evidence was heterogeneous; longer rest may still be practical for heavy compound sets or individual performance.",
    href: "https://pubmed.ncbi.nlm.nih.gov/39205815/",
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
  {
    grade: "Small controlled study",
    title: "Two weeks of detraining in trained men",
    result: "In this small study, two weeks without training did not meaningfully reduce measured strength, supporting a calm rather than punitive response to short breaks.",
    limitation: "Only 20 resistance-trained men were studied; this does not establish an exact return prescription for everyone.",
    href: "https://pubmed.ncbi.nlm.nih.gov/28328712/",
  },
  {
    grade: "Controlled trial",
    title: "Training interruption and retraining",
    result: "A three-week interruption did not erase the longer-term adaptations achieved after retraining in previously untrained men.",
    limitation: "The participants and interruption pattern do not represent every trained user or longer absence.",
    href: "https://pubmed.ncbi.nlm.nih.gov/21771261/",
  },
  {
    grade: "Consensus guidance",
    title: "Safe return to training after inactivity",
    result: "The NSCA and CSCCa recommend a conservative transition after periods of inactivity rather than immediately restoring full workload.",
    limitation: "This guidance was written for organized athletic settings; RepArc uses simpler, user-overridable consumer guardrails.",
    href: "https://www.nsca.com/about-us/position-statements/safe-return-to-training/",
  },
  {
    grade: "Clinical safety",
    title: "CDC rhabdomyolysis signs and symptoms",
    result: "Muscle pain more severe than expected, dark tea- or cola-colored urine, and unusual weakness or exercise intolerance are warning signs that require immediate medical attention.",
    limitation: "Symptoms overlap with other conditions; only a healthcare professional using blood testing can confirm or exclude rhabdomyolysis.",
    href: "https://www.cdc.gov/niosh/rhabdo/signs-symptoms/index.html",
  },
  {
    grade: "Moderate",
    title: "Pre-conditioning and exercise-induced muscle damage",
    result: "A systematic review and meta-analysis found that prior lower-impact exposure can reduce damage and recovery time after later unfamiliar strenuous exercise, supporting gradual re-exposure.",
    limitation: "Most included participants were untrained and the evidence does not validate one exact load or set reduction for every user.",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10356650/",
  },
  {
    grade: "Moderate",
    title: "Muscle temperature and performance after warm-up",
    result: "A 2025 meta-analysis of 33 studies found that raising muscle temperature can improve fast and dynamic force outcomes, while maximum-force effects were not clear.",
    limitation: "Protocols and populations varied, and the review does not establish one universal warm-up duration or prove injury prevention.",
    href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12357318/",
  },
  {
    grade: "Moderate",
    title: "Aerobic exercise immediately before strength work",
    result: "A meta-analysis found acute strength performance was more likely to decline when prior aerobic work was longer or harder, particularly beyond 30 minutes.",
    limitation: "The included studies were in trained men and tested specific same-session protocols; brief easy movement was not shown to be harmful.",
    href: "https://pubmed.ncbi.nlm.nih.gov/34878640/",
  },
  {
    grade: "Moderate",
    title: "Order of concurrent strength and endurance training",
    result: "Across 19 trials, strength before endurance modestly favored lower-body strength, while aerobic-fitness gains did not meaningfully depend on order.",
    limitation: "The average effect was small and individual goals, intensity and recovery time still matter.",
    href: "https://pubmed.ncbi.nlm.nih.gov/36776981/",
  },
  {
    grade: "Public-health guidance",
    title: "WHO physical activity guidelines",
    result: "Adults are advised to accumulate 150–300 minutes of moderate aerobic activity or 75–150 minutes of vigorous activity weekly, plus muscle strengthening on at least two days.",
    limitation: "This is a weekly health target, not a requirement to perform cardio before and after every lifting session.",
    href: "https://iris.who.int/bitstream/handle/10665/336656/9789240015128-eng.pdf",
  },
  {
    grade: "Evidence caution",
    title: "Active cool-down review",
    result: "Active cool-down may speed immediate cardiovascular recovery, but generally did not improve next-day performance, soreness or injury outcomes.",
    limitation: "Evidence varies by protocol, so RepArc records post-lift cardio without presenting it as mandatory recovery treatment.",
    href: "https://pubmed.ncbi.nlm.nih.gov/29663142/",
  },
  {
    grade: "2026 expert consensus",
    title: "Context-specific warm-up framework",
    result: "An international expert panel supported combining general and task-specific preparation according to the athlete, activity and environment rather than prescribing one universal routine.",
    limitation: "Expert consensus organizes current practice; it does not prove that one exact warm-up prevents injuries in every lifter.",
    href: "https://pubmed.ncbi.nlm.nih.gov/42476526/",
  },
  {
    grade: "Controlled trial",
    title: "Load versus repetition progression",
    result: "A 2022 trial found that progressing repetitions or load were both viable strategies, supporting repetition progress when an equipment jump is too large.",
    limitation: "The trial was time-limited and does not establish a universal percentage or equipment increment.",
    href: "https://pubmed.ncbi.nlm.nih.gov/36199287/",
  },
  {
    grade: "Measurement caution",
    title: "RIR accuracy in trained adults",
    result: "A 2024 bench-press study found reasonably close RIR estimates near failure on average, but errors still occurred at the individual-set level.",
    limitation: "The finding came from a specific exercise and trained sample, so missing RIR remains unknown and recorded RIR is not treated as exact.",
    href: "https://pubmed.ncbi.nlm.nih.gov/37967832/",
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
          <p>RepArc records sets, load, repetitions and RIR, then uses comparable history from that exact exercise to suggest the next practical target. When reliable history does not exist, it asks you to calibrate conservatively instead of inventing a demographic load.</p>
          <p>The app is evidence-informed, not a promise of a particular result. Sleep, nutrition, technique, health, equipment and consistency all affect outcomes.</p>
        </GuideSection>}

        {active === "program" && <GuideSection eyebrow="02 / Program" title="Foundation, then autoregulation">
          <p><strong className="text-stone-200">Phase 1 · Foundation:</strong> build consistent technique and usable performance history. You can move to Phase 2 after reviewing the transition; there is no arbitrary calendar lock.</p>
          <p><strong className="text-stone-200">Phase 2 · Autoregulated hypertrophy:</strong> a RepArc adaptation of the Stronger by Science Hypertrophy Template: 21 weeks in three seven-week blocks, with programmed lifts using an exercise-specific training max and final performance set. Weeks 7, 14 and 21 use four sets of five at reduced loading without an AMRAP.</p>
          <p>Three-, four- and five-day schedules distribute the work differently. Changing frequency or program does not erase earlier sessions. Foundation supports equipment substitutions; Phase 2 currently requires its programmed full-gym lifts because each lift needs its own training max.</p>
          <p><strong className="text-stone-200">Missed time:</strong> RepArc continues with the next unfinished workout instead of compressing sessions into fewer days. You can record a moved workout, a skip, training elsewhere or a planned pause. Breaks of at least two weeks trigger one to three conservative return sessions; these temporary load and volume factors are cautious product guardrails, not individualized medical prescriptions.</p>
          <p><strong className="text-stone-200">Unfamiliar exercises:</strong> everyone starts with reduced working volume, usually one set with at least four good reps remaining. Related training may allow two comfortable sets. Each exercise builds up with comparable performance and recovery feedback; an experienced lifter can still be unfamiliar with a movement.</p>
          <p>RepArc limits unfamiliar work in one session and names any exercises held for later. You can deliberately include their reduced sets. Return mode and familiarization use the smaller set allowance once. Phase 2 lifts without established history skip AMRAPs and cannot change their training maxes.</p>
          <p><strong className="text-stone-200">Before lifting:</strong> use brief easy movement to feel warm, then perform one to three progressively heavier rehearsal sets before the first heavy or unfamiliar movement. Rehearsal sets are not working volume and do not affect progression. Walking is practical; a stair climber also raises heart rate but can fatigue the legs, so it is not automatically better.</p>
          <p><strong className="text-stone-200">Cardio:</strong> if strength is the priority, keep pre-lift cardio brief and easy. Put substantial cardio after lifting or in a separate session. Post-lift easy activity is optional—not a guarantee against soreness or injury. RepArc logs these minutes descriptively and never uses them alone to change strength loads.</p>
          <p className="text-xs text-stone-500">RepArc is independent and is not affiliated with, reviewed by or endorsed by Stronger by Science. It does not redistribute the original spreadsheets; the official free bundle is linked in Evidence.</p>
        </GuideSection>}

        {active === "logging" && <GuideSection eyebrow="03 / Logging" title="Sets, RIR and recommendations">
          <p><strong className="text-stone-200">RIR</strong> means repetitions in reserve: how many technically sound repetitions you believe remained. Most normal sets should finish with roughly one to three RIR.</p>
          <p><strong className="text-stone-200">AMRAP</strong> means as many technically sound repetitions as possible—not repetitions performed after form breaks down. Stop for pain, loss of control or unsafe technique.</p>
          <p>For a new exercise, start at the lower end of the rep range with a comfortably light load and the displayed RIR target. Rehearse first. If bodyweight is too demanding, use assistance or an easier variation. You may confirm a comfortable load you already know; the reduced sets and recovery checks still apply.</p>
          <p>Recovery asks about the effect over the following days. Confirm normal or mild, improving recovery after at least 48 hours. Missing feedback holds increases. A report of movement-limiting or unusual symptoms remains part of that exposure’s history even if you later recover.</p>
          <p>Your workout plan stays fixed after logging starts so recovery updates cannot hide entered sets. You can swap an exercise before entering its sets; unfamiliar swaps use reduced volume. Saved sessions keep their original prescriptions.</p>
          <p className="text-sm text-stone-400">These ramp thresholds are conservative RepArc rules informed by research. “Established history” describes the available logs; it is not a clinical assessment or a guarantee that a load is safe.</p>
          <p>Estimated performance max is calculated only from comparable four- to ten-repetition sets on suitable loaded movements. It is a noisy exercise-specific trend, not a true 1RM. External-load volume is descriptive, counts both sides when the field is labeled “each side,” and should not be compared across different exercises or machines.</p>
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
          <p>Do not train through soreness that limits normal walking. Dark tea- or cola-colored urine, marked swelling, unusual weakness, reduced urination, or muscle pain far beyond expected soreness needs urgent medical assessment.</p>
          <p>Pregnancy, recent postpartum recovery, osteoporosis treatment, eating disorders, repeated missed periods, recurrent stress injuries and active rehabilitation need appropriately qualified professional guidance.</p>
        </GuideSection>}

        {active === "evidence" && <section className="rounded-[1.5rem] border border-white/10 bg-[#121512] p-5 sm:p-7">
          <div className="flex items-start gap-3"><Activity className="mt-1 size-5 shrink-0 text-amber-300" /><div><p className="eyebrow text-amber-300">07 / Evidence</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Evidence library</h2><p className="mt-2 text-xs leading-5 text-stone-500">Last reviewed 5 September 2026. Ratings describe confidence for this app decision, not the quality of every outcome in a paper.</p></div></div>
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
