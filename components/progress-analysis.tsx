"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck } from "lucide-react";
import { buildProgressAnalysis, REVIEW_CONFIDENCE, REVIEW_RULES, REVIEW_STATUS, reviewBounds, shiftReviewDate, type ProgressAnalysis, type ReviewPeriod, type ReviewStatus } from "@/lib/progress-analysis";
import { isoDate, isValidDateOnly, prettyDate, resolvedSessionScheduleDates, type TrainingData } from "@/lib/training";
import { MUSCLE_LABELS } from "@/lib/muscle-volume";
import type { Muscle } from "@/lib/exercise-metadata";

const fmt = (value: number | null, suffix = "") => value === null ? "Not recorded" : `${Number(value.toFixed(1))}${suffix}`;
const shortDate = (date: string) => prettyDate(date, { month: "short", day: "numeric" });
const color: Record<ReviewStatus, string> = { "on-track": "#159a70", hold: "#b77d0b", adjust: "#d24f58", insufficient: "#7d8887" };
const tabs = ["Summary", "Performance", "Muscles", "Full review"] as const;

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="analysis-metric"><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>;
}
function Badge({ status }: { status: ReviewStatus }) {
  return <span className="analysis-badge" data-status={status}>{REVIEW_STATUS[status]}</span>;
}

/** Native SVG avoids chart-library hydration/inline-style requirements. Tables remain the numeric source. */
function LinePlot({ values, label, suffix = "" }: { values: Array<{ date: string; value: number | null }>; label: string; suffix?: string }) {
  const valid = values.flatMap((item, index) => item.value === null ? [] : [{ ...item, value: item.value, index }]);
  if (!valid.length) return <p className="analysis-muted">Not enough recorded values to draw this chart.</p>;
  const min = Math.min(...valid.map((p) => p.value)); const max = Math.max(...valid.map((p) => p.value));
  const low = min === max ? min - 1 : min - (max - min) * .15;
  const high = min === max ? max + 1 : max + (max - min) * .15;
  const x = (index: number) => values.length === 1 ? 240 : 55 + index / (values.length - 1) * 405;
  const y = (value: number) => 135 - (value - low) / (high - low) * 105;
  // Nulls create gaps, not invented interpolated measurements.
  const segments: string[] = []; let segment = "";
  values.forEach((p, i) => { if (p.value === null) { if (segment) segments.push(segment); segment = ""; } else segment += `${segment ? " L" : "M"}${x(i)},${y(p.value)}`; });
  if (segment) segments.push(segment);
  return <svg viewBox="0 0 490 175" className="analysis-line" role="img" aria-label={`${label}. ${valid.length} measurements; range ${fmt(min)} to ${fmt(max)} ${suffix}. Dates are equally spaced observations, not elapsed time.`}>
    <path d="M55 25V140H465" className="analysis-axis" fill="none" />
    <text x="3" y="35">{fmt(high)}</text><text x="3" y="137">{fmt(low)}</text>
    {segments.map((d, i) => <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth="2.5" />)}
    {valid.map((p) => <circle key={p.index} cx={x(p.index)} cy={y(p.value)} r="4" fill="currentColor"><title>{p.date}: {fmt(p.value, ` ${suffix}`)}</title></circle>)}
    <text x="55" y="164">{shortDate(values[0].date)}</text><text x="462" y="164" textAnchor="end">{shortDate(values.at(-1)!.date)}</text>
  </svg>;
}

function WeeklyChart({ review }: { review: ProgressAnalysis }) {
  const max = Math.max(1, ...review.weekly.map((w) => w.sets));
  return <section className="analysis-card"><h2>Working sets by week</h2><p className="analysis-muted">By the day you actually trained. More sets do not automatically mean better progress.</p>
    <svg viewBox="0 0 490 165" className="analysis-bars" role="img" aria-label="Working sets by performed week. Exact values are in the table below.">
      {review.weekly.map((week, index) => { const width = 430 / review.weekly.length; const height = 100 * week.sets / max; return <g key={week.start}><rect x={35 + index * width} y={120 - height} width={Math.min(48, width - 15)} height={height} rx="5" fill="currentColor" /><text x={35 + index * width} y={110 - height}>{week.sets}</text><text x={35 + index * width} y="145">{shortDate(week.start)}</text></g>; })}
    </svg>
    <details><summary>See weekly numbers</summary><table><caption>Weeks begin Monday; only valid working sets count</caption><thead><tr><th>Week of</th><th>Sets</th><th>Recorded plan</th></tr></thead><tbody>{review.weekly.map((w) => <tr key={w.start}><td>{shortDate(w.start)}</td><td>{w.sets}</td><td>{w.planned}</td></tr>)}</tbody></table></details>
  </section>;
}

// Schematic regions, not a diagnostic anatomy model. Labeled buttons provide an accessible equivalent.
const regions: Array<{ muscle: Muscle; d: string; back?: boolean }> = [
  { muscle: "chest", d: "M71 69Q88 60 98 74V99L72 95Z M129 69Q112 60 102 74V99L128 95Z" },
  { muscle: "shoulders", d: "M66 63Q46 65 47 92L64 94L71 69Z M134 63Q154 65 153 92L136 94L129 69Z" },
  { muscle: "biceps", d: "M47 95L63 98L57 134L41 133Z M153 95L137 98L143 134L159 133Z" },
  { muscle: "trunk", d: "M77 102H96V147L79 142Z M104 102H123L121 142L104 147Z" },
  { muscle: "quads", d: "M77 164L96 164L93 229L71 226Z M104 164H123L129 226L107 229Z" },
  { muscle: "back", d: "M71 70L99 62L129 70L122 127L102 146L79 127Z", back: true },
  { muscle: "triceps", d: "M47 95L63 98L57 134L41 133Z M153 95L137 98L143 134L159 133Z", back: true },
  { muscle: "glutes", d: "M78 145H98V176H72Z M102 145H122L128 176H102Z", back: true },
  { muscle: "hamstrings", d: "M74 181H96L92 228H71Z M104 181H126L129 228H108Z", back: true },
  { muscle: "calves", d: "M72 237H91L86 288H73Z M109 237H128L127 288H114Z", back: true },
];
function MuscleMap({ review, selected, select }: { review: ProgressAnalysis; selected: Muscle; select: (muscle: Muscle) => void }) {
  return <div className="analysis-body-layout"><svg viewBox="0 0 420 330" className="analysis-body" role="img" aria-label="Front and back muscle map. Use the named muscle buttons alongside it to inspect each area.">
    {[false, true].map((back) => <g key={String(back)} transform={`translate(${back ? 210 : 0},0)`}><circle cx="100" cy="36" r="21" className="analysis-silhouette" /><path d="M83 58L67 61L46 68L29 154L43 159L67 105L70 149L67 224L71 296L91 296L100 208L109 296L129 296L133 224L130 149L133 105L157 159L171 154L154 68L133 61L117 58Z" className="analysis-silhouette" />
      {regions.filter((region) => !!region.back === back).map((region) => <path key={region.muscle} d={region.d} fill={color[review.muscles.find((m) => m.muscle === region.muscle)!.status]} stroke={selected === region.muscle ? "currentColor" : "none"} strokeWidth="2"><title>{MUSCLE_LABELS[region.muscle]}: {REVIEW_STATUS[review.muscles.find((m) => m.muscle === region.muscle)!.status]}</title></path>)}
      <text x="100" y="322" textAnchor="middle">{back ? "Back" : "Front"}</text></g>)}
    </svg><div className="analysis-muscle-buttons">{review.muscles.map((row) => <button type="button" key={row.muscle} aria-pressed={selected === row.muscle} onClick={() => select(row.muscle)}><span className="analysis-dot" data-status={row.status} /><span>{MUSCLE_LABELS[row.muscle]}<small>{row.direct} direct · {row.indirect} supporting</small></span></button>)}</div></div>;
}

export function ProgressAnalysisView({ data, onClose, onTrain, onGuide, initialDate, initialPeriod = "week" }: { data: TrainingData; onClose: () => void; onTrain: () => void; onGuide: () => void; initialDate?: string; initialPeriod?: ReviewPeriod }) {
  const [asOf, setAsOf] = useState(() => isoDate(new Date()));
  const [anchor, setAnchor] = useState(initialDate ?? asOf);
  const [period, setPeriod] = useState<ReviewPeriod>(initialPeriod);
  const [tab, setTab] = useState<typeof tabs[number]>("Summary");
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle>("chest");
  const [selectedExercise, setSelectedExercise] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { const refresh = () => setAsOf(isoDate(new Date())); const timer = window.setInterval(refresh, 30_000); window.addEventListener("focus", refresh); return () => { clearInterval(timer); window.removeEventListener("focus", refresh); }; }, []);
  // Account data is the only input. No duplicate personal-data store or stale cached verdict.
  const review = useMemo(() => buildProgressAnalysis(data, period, anchor, asOf), [data, period, anchor, asOf]);
  const exercise = review.exercises.find((e) => e.identity === selectedExercise) ?? review.exercises[0];
  const muscle = review.muscles.find((m) => m.muscle === selectedMuscle)!;
  const unit = data.profile?.unit ?? "kg";
  const scheduleDates = useMemo(() => resolvedSessionScheduleDates(data), [data]);
  const archive = [...new Set(data.sessions.filter((s) => !s.deletedAt && isValidDateOnly(scheduleDates.get(s.id) ?? s.date) && s.date <= asOf).map((s) => reviewBounds(period, scheduleDates.get(s.id) ?? s.date).start))].sort().reverse();
  const changePeriod = (value: ReviewPeriod) => { setPeriod(value); setTab("Summary"); };
  const move = (direction: number) => { if (period !== "month") setAnchor(shiftReviewDate(review.start, direction * (period === "week" ? 7 : 1))); else { const date = new Date(`${review.start}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + direction); setAnchor(date.toISOString().slice(0, 10)); } };
  return <section className="progress-analysis motion-page" aria-label="Progress analysis">
    <header className="analysis-heading"><button type="button" className="analysis-link" onClick={onClose}><ArrowLeft size={18} />Progress</button><span className="analysis-muted">Your records, explained</span></header>
    <h1 ref={heading} tabIndex={-1}>Progress analysis</h1><p className="analysis-intro">What you recorded, what changed, and what to check next. No changes are made to your plan.</p>
    <div className="analysis-period-controls"><div className="analysis-periods" aria-label="Review period">{(["day", "week", "month"] as const).map((value) => <button type="button" key={value} aria-pressed={period === value} onClick={() => changePeriod(value)}>{value === "day" ? "Daily" : value === "week" ? "Weekly" : "Monthly"}</button>)}</div><button type="button" className="analysis-link" onClick={() => setAnchor(asOf)}>This {period}</button></div>
    <div className="analysis-date"><button type="button" aria-label="Previous period" onClick={() => move(-1)}><ChevronLeft size={20} /></button><div><strong>{shortDate(review.start)}{review.end !== review.start ? ` – ${shortDate(review.end)}` : ""}, {review.start.slice(0, 4)}</strong><small>{review.complete ? "Period ended" : "So far · period still open"}</small></div><button type="button" aria-label="Next period" disabled={review.end >= asOf} onClick={() => move(1)}><ChevronRight size={20} /></button></div>
    <details className="analysis-archive"><summary>Choose a date or past review</summary><div className="analysis-fields"><label>Jump to date<input type="date" value={anchor} max={asOf} onChange={(e) => { if (isValidDateOnly(e.target.value) && e.target.value <= asOf) setAnchor(e.target.value); }} /></label><label>Recorded periods<select value={archive.includes(review.start) ? review.start : ""} onChange={(e) => { if (e.target.value) setAnchor(e.target.value); }}><option value="">Choose a recorded period</option>{archive.map((date) => <option key={date} value={date}>{date}</option>)}</select></label></div><p className="analysis-muted">Past reviews are recalculated from current saved records, not frozen reports.</p></details>
    <div className="analysis-tabs" aria-label="Analysis sections">{tabs.map((name) => <button type="button" key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</div>
    <div className="analysis-content motion-pop" key={tab}>
      {tab === "Summary" && <>
        <section className="analysis-verdict" data-status={review.status}><div className="analysis-verdict-top"><Badge status={review.status} /><span>{REVIEW_CONFIDENCE[review.confidence]}</span></div><h2>{review.headline}</h2><p>{review.sessionCount ? `${review.sessionCount} workout record${review.sessionCount === 1 ? "" : "s"} · ${review.counts.sets} valid working sets` : "No reports to display yet for this period."}</p><small>Information coverage is not a prediction-accuracy score.</small></section>
        <div className="analysis-metrics"><Metric label="Planned sets recorded" value={fmt(review.counts.completionPercent, "%")} detail={`${review.counts.plannedCompleted}/${review.counts.planned} known planned sets · not a growth score`} /><Metric label="Scheduled workouts" value={review.adherence.available ? `${review.adherence.completedSessions}/${review.adherence.expectedSessions}` : "Unknown"} detail="Completed / expected so far, including recorded training elsewhere" /><Metric label="Reps in target" value={`${review.counts.repMet}/${review.counts.repKnown}`} detail="Only sets with a saved rep prescription" /><Metric label="Recovery answers" value={review.recoveryCoverage} detail="Exercise exposures checked at least 48 hours later" /></div>
        <section className="analysis-card"><h2>What to do next</h2><ol className="analysis-actions">{review.actions.map((action) => <li key={action.title}><strong>{action.title}</strong><p>{action.text}</p></li>)}</ol><button type="button" className="analysis-primary" onClick={onTrain}>Open Train <ArrowRight size={17} /></button></section>
        {!!review.improvements.length && <section className="analysis-card"><h2>Recorded improvements</h2>{review.improvements.map((item) => <p key={item.name}><strong>{item.name}</strong> — {item.text}</p>)}</section>}
        {!!review.warnings.length && <details className="analysis-card"><summary>{review.warnings.length} limits to this review</summary><ul>{review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></details>}
      </>}
      {tab === "Performance" && <>
        <WeeklyChart review={review} />
        <section className="analysis-card"><h2>Exercise performance</h2>{exercise ? <><label className="analysis-select">Exercise<select value={exercise.identity} onChange={(e) => setSelectedExercise(e.target.value)}>{review.exercises.map((item) => <option key={item.identity} value={item.identity}>{item.name}</option>)}</select></label><Badge status={exercise.status} /><p>{exercise.reason}</p><p className="analysis-callout">{exercise.trendReason}</p><h3>First-set {exercise.chartMetric === "reps" ? "rep" : "load"} history</h3><p className="analysis-muted">{exercise.loadingLabel}. One point per workout; spacing is by observation. Lines do not imply comparable strength.</p><LinePlot values={exercise.points.map((p) => ({ date: p.date, value: exercise.chartMetric === "reps" ? p.reps : p.load }))} label={`${exercise.name} first-set ${exercise.chartMetric}`} suffix={exercise.chartMetric === "reps" ? "reps" : unit} /><details><summary>See load, reps and effort</summary><table><caption>First valid set position, not a cherry-picked best set</caption><thead><tr><th>Date</th><th>{unit}</th><th>Reps</th><th>Reps left</th></tr></thead><tbody>{exercise.points.map((p) => <tr key={p.sessionId}><td>{shortDate(p.date)}</td><td>{p.load}</td><td>{p.reps}</td><td>{p.rir ?? "—"}</td></tr>)}</tbody></table></details></> : <p>No exercise records in this period.</p>}</section>
        <section className="analysis-card"><h2>Bodyweight trend</h2><p className="analysis-muted">Seven-day averages need at least 3 measurements per window. Weight change does not identify fat or muscle change.</p><Metric label="Change vs previous 7 days" value={fmt(review.weight.change, ` ${unit}`)} detail={`${review.weight.currentSamples} recent / ${review.weight.priorSamples} prior measurements · goal: ${review.weight.goal}`} /><LinePlot values={review.weight.points.map((p) => ({ date: p.date, value: p.average }))} label="Seven-day mean bodyweight" suffix={unit} /><details><summary>See weigh-in numbers</summary><table><caption>Recorded weight and available seven-day average ({unit})</caption><thead><tr><th>Date</th><th>Weight</th><th>Average</th></tr></thead><tbody>{review.weight.points.map((p) => <tr key={p.date}><td>{shortDate(p.date)}</td><td>{p.weight}</td><td>{p.average ?? "—"}</td></tr>)}</tbody></table></details></section>
      </>}
      {tab === "Muscles" && <section className="analysis-card"><h2>Where the work went</h2><p className="analysis-muted">By actual training date. Direct and supporting sets stay separate; a set can involve several muscles. These counts are not measurements of growth or an ideal weekly dose.</p><div className="analysis-legend"><span>● Green: saved targets met</span><span>● Yellow: review targets</span><span>● Red: recovery concern recorded</span><span>● Gray: missing information</span></div><MuscleMap review={review} selected={selectedMuscle} select={setSelectedMuscle} /><div className="analysis-muscle-detail" aria-live="polite"><h3>{MUSCLE_LABELS[muscle.muscle]}</h3><Badge status={muscle.status} /><p><strong>{muscle.direct}</strong> direct sets · <strong>{muscle.indirect}</strong> supporting sets · {muscle.planned} direct sets in recorded plans</p><p>{muscle.reason}</p></div><p className="analysis-muted">Red does not diagnose an injury; green does not certify that training is safe. Missing workouts are not assigned invented muscle volume.</p></section>}
      {tab === "Full review" && <>
        <section className="analysis-card"><h2>How complete are these records?</h2><div className="analysis-metrics"><Metric label="Effort entries" value={`${review.counts.rirKnown}/${review.counts.sets}`} detail="Valid sets with reps left recorded" /><Metric label="Workout difficulty" value={fmt(review.workoutDifficulty, " / 10")} detail="Average of recorded session ratings, not individual-set effort" /><Metric label="Measured time" value={review.measuredDurationSeconds === null ? "Not measured" : `${Math.round(review.measuredDurationSeconds / 60)} min`} detail={`${review.durationCoverage} workouts have usable timing`} /><Metric label="Effort target met" value={`${review.counts.rirMet}/${review.counts.rirTargetKnown}`} detail="Sets with both effort and its original target" /></div>{review.warnings.length ? <ul>{review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>No missing-data flags were found by these checks. This does not prove the inputs or program are error-free.</p>}</section>
        <section className="analysis-card"><h2>Exercise-by-exercise review</h2>{review.exercises.map((item) => <details key={item.identity}><summary>{item.name} · {REVIEW_STATUS[item.status]}</summary><p>{item.reason}</p><p><strong>Next:</strong> {item.action}</p><p>{item.trendReason}</p><p className="analysis-muted">{REVIEW_CONFIDENCE[item.confidence]} · {item.exposures} recorded days · {item.counts.sets} sets in this period. Recommendation versions: {item.provenance.join(", ")}.</p></details>)}</section>
        <section className="analysis-card"><h2>Which workouts counted?</h2><p className="analysis-muted">Attendance and this review’s summary use the scheduled slot. Muscle exposure and weekly workload use the performed date. Later catch-ups may update an earlier period.</p>{review.workouts.map((workout) => <details key={workout.id}><summary>{shortDate(workout.scheduled)} · {workout.name}</summary><p>Scheduled: {workout.scheduled}<br />Performed: {workout.performed}<br />Current revision: {workout.revision}</p></details>)}{!review.workouts.length && <p>No workout records filed under this period.</p>}</section>
        <section className="analysis-card"><h2>Did the recorded suggestions fit?</h2><p>{review.evaluation.eligible ? `${review.evaluation.metTargetsAndRecovery} of ${review.evaluation.eligible} evaluable exercise exposures met the saved rep/effort targets and had acceptable delayed recovery.` : "Not enough fully recorded, followed suggestions to evaluate yet."}</p><p className="analysis-muted">{review.evaluation.excluded} excluded: the exact suggestion, whether it was followed, complete effort, or delayed recovery was missing; Phase 2 effort sets use a different protocol. This selected sample is descriptive, not a success-rate estimate or proof that the app caused a result.</p></section>
        <section className="analysis-card"><h2>Rules, evidence and privacy</h2><p>Analysis rule: <code>{review.version}</code>. Recalculated from the records available on {review.asOf}, including later recovery answers and edits. Offline reviews use the records already on this device; reconnect to include other-device changes.</p><p>No new data upload, AI service or separate report database. Reviews are not medical advice and do not measure muscle growth, diagnose overtraining, or silently change your plan.</p><details><summary>Show the information-coverage rules</summary><p>“Well recorded” requires at least {REVIEW_RULES.highExposures} prior/selected exercise dates, {REVIEW_RULES.highRirCoverage}% effort coverage, delayed recovery and no missing original plan or invalid entries. Lower coverage lowers the label, not a claimed probability of accuracy.</p><p>Monthly verdicts require {REVIEW_RULES.monthlyWeeks} complete weeks inside that month, each with at least {REVIEW_RULES.weeklySessions} recorded workouts, {REVIEW_RULES.weeklySetCoverage}% of known planned sets and {REVIEW_RULES.moderateRirCoverage}% effort coverage. These are conservative product rules, not thresholds proven by a trial. Totals and recovery concerns remain visible.</p></details><p><a href="https://link.springer.com/article/10.1007/s40279-021-01559-x" target="_blank" rel="noopener noreferrer">RIR accuracy review</a>: reported reps left are useful but imperfect. <a href="https://pubmed.ncbi.nlm.nih.gov/19130641/" target="_blank" rel="noopener noreferrer">Volume measurement study</a>: counting methods describe different things. Neither validates RepArc’s exact thresholds.</p><button type="button" className="analysis-link" onClick={onGuide}><CircleHelp size={18} />Open the full evidence library</button></section>
      </>}
    </div><footer className="analysis-footer"><ClipboardCheck size={16} /><span>Read-only analysis · {review.version} · {REVIEW_CONFIDENCE[review.confidence]}</span><BarChart3 size={16} /></footer>
  </section>;
}
