"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CircleHelp } from "lucide-react";
import { buildProgressAnalysis, REVIEW_CONFIDENCE, REVIEW_RULES, REVIEW_STATUS, reviewBounds, shiftReviewDate, type ProgressAnalysis, type ReviewPeriod, type ReviewStatus } from "@/lib/progress-analysis";
import { isoDate, isValidDateOnly, prettyDate, resolvedSessionScheduleDates, type TrainingData } from "@/lib/training";
import { MUSCLE_LABELS } from "@/lib/muscle-volume";
import type { Muscle } from "@/lib/exercise-metadata";
import { MuscleAnatomy } from "@/components/muscle-anatomy";

const fmt = (value: number | null, suffix = "") => value === null ? "Not recorded" : `${Number(value.toFixed(1))}${suffix}`;
const shortDate = (date: string) => prettyDate(date, { month: "short", day: "numeric" });
const tabs = ["Overview", "Trends", "Muscles", "Details"] as const;

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
    <details className="analysis-disclosure"><summary>Weekly numbers</summary><div className="analysis-table-scroll"><table><caption>Weeks begin Monday; only valid working sets count</caption><thead><tr><th>Week of</th><th>Sets</th><th>Recorded plan</th></tr></thead><tbody>{review.weekly.map((w) => <tr key={w.start}><td>{shortDate(w.start)}</td><td>{w.sets}</td><td>{w.planned}</td></tr>)}</tbody></table></div></details>
  </section>;
}


export function ProgressAnalysisView({ data, onClose, onTrain, onGuide, initialDate, initialPeriod = "week" }: { data: TrainingData; onClose: () => void; onTrain: () => void; onGuide: () => void; initialDate?: string; initialPeriod?: ReviewPeriod }) {
  const [asOf, setAsOf] = useState(() => isoDate(new Date()));
  const [anchor, setAnchor] = useState(initialDate ?? asOf);
  const [period, setPeriod] = useState<ReviewPeriod>(initialPeriod);
  const [tab, setTab] = useState<typeof tabs[number]>("Overview");
  const [trend, setTrend] = useState<"Exercises" | "Workload" | "Weight">("Exercises");
  const [selectedMuscle, setSelectedMuscle] = useState<Muscle>("chest");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [selectedWorkout, setSelectedWorkout] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { const refresh = () => setAsOf(isoDate(new Date())); const timer = window.setInterval(refresh, 30_000); window.addEventListener("focus", refresh); return () => { clearInterval(timer); window.removeEventListener("focus", refresh); }; }, []);
  // Presentation only: preserve the existing account-scoped analysis and its safety rules.
  const review = useMemo(() => buildProgressAnalysis(data, period, anchor, asOf), [data, period, anchor, asOf]);
  const exercise = review.exercises.find((e) => e.identity === selectedExercise) ?? review.exercises[0];
  const workout = review.workouts.find((w) => w.id === selectedWorkout) ?? review.workouts[0];
  const muscle = review.muscles.find((m) => m.muscle === selectedMuscle)!;
  const unit = data.profile?.unit ?? "kg";
  const scheduleDates = useMemo(() => resolvedSessionScheduleDates(data), [data]);
  const archive = [...new Set(data.sessions.filter((s) => !s.deletedAt && isValidDateOnly(scheduleDates.get(s.id) ?? s.date) && s.date <= asOf).map((s) => reviewBounds(period, scheduleDates.get(s.id) ?? s.date).start))].sort().reverse();
  const isCurrent = review.start === reviewBounds(period, asOf).start;
  const changePeriod = (value: ReviewPeriod) => { setPeriod(value); };
  const move = (direction: number) => { if (period !== "month") setAnchor(shiftReviewDate(review.start, direction * (period === "week" ? 7 : 1))); else { const date = new Date(`${review.start}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() + direction); setAnchor(date.toISOString().slice(0, 10)); } };
  const exercisePicker = <label className="analysis-select">Exercise<select value={exercise?.identity ?? ""} onChange={(e) => setSelectedExercise(e.target.value)}>{review.exercises.map((item) => <option key={item.identity} value={item.identity}>{item.name}</option>)}</select></label>;
  return <section className="progress-analysis" aria-label="Progress analysis">
    <header className="analysis-heading"><button type="button" className="analysis-link" onClick={onClose}><ArrowLeft size={18} />Progress</button><button type="button" className="analysis-link" onClick={onGuide} aria-label="Open the evidence guide"><CircleHelp size={20} /></button></header>
    <h1 ref={heading} tabIndex={-1}>Your progress</h1>
    <div className="analysis-control-deck">
      <div className="analysis-periods" aria-label="Review period">{(["day", "week", "month"] as const).map((value) => <button type="button" key={value} aria-pressed={period === value} onClick={() => changePeriod(value)}>{value === "day" ? "Daily" : value === "week" ? "Weekly" : "Monthly"}</button>)}</div>
      <div className="analysis-date"><button type="button" aria-label="Previous period" onClick={() => move(-1)}><ChevronLeft size={20} /></button><div><strong>{shortDate(review.start)}{review.end !== review.start ? ` – ${shortDate(review.end)}` : ""}</strong><small>{review.start.slice(0, 4)} · {review.complete ? "Complete period" : "In progress"}</small></div><button type="button" aria-label="Next period" disabled={review.end >= asOf} onClick={() => move(1)}><ChevronRight size={20} /></button></div>
      <details className="analysis-archive analysis-disclosure"><summary>Choose dates</summary><div className="analysis-fields"><label>Jump to date<input type="date" value={anchor} max={asOf} onChange={(e) => { if (isValidDateOnly(e.target.value) && e.target.value <= asOf) setAnchor(e.target.value); }} /></label><label>Saved periods<select value={archive.includes(review.start) ? review.start : ""} onChange={(e) => { if (e.target.value) setAnchor(e.target.value); }}><option value="">Choose a recorded period</option>{archive.map((date) => <option key={date} value={date}>{date}</option>)}</select></label></div></details>
      {!isCurrent && <button type="button" className="analysis-reset" onClick={() => setAnchor(asOf)}>Back to {period === "day" ? "today" : `this ${period}`}</button>}
    </div>
    <nav className="analysis-tabs" aria-label="Analysis sections">{tabs.map((name) => <button type="button" key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</nav>
    <div className="analysis-content" key={tab}>
      {tab === "Overview" && <>
        <section className="analysis-verdict" data-status={review.status}><Badge status={review.status} /><h2>{review.headline}</h2><p>{review.sessionCount ? `${review.sessionCount} workout records · ${review.counts.sets} working sets` : "No workout records for this period."}</p></section>
        {review.sessionCount > 0 && <div className="analysis-metrics">
          <Metric label="Planned sets" value={fmt(review.counts.completionPercent, "%")} detail={`${review.counts.plannedCompleted} of ${review.counts.planned} recorded`} />
          <Metric label="Workouts" value={review.adherence.available ? `${review.adherence.completedSessions}/${review.adherence.expectedSessions}` : "—"} detail={review.adherence.available ? "Completed / scheduled" : "Schedule unavailable"} />
          <Metric label="Reps on target" value={review.counts.repKnown ? `${review.counts.repMet}/${review.counts.repKnown}` : "—"} detail="Sets with known targets" />
          <Metric label="Recovery checks" value={review.recoveryCoverage} detail="Checked after 48+ hours" />
        </div>}
        <section className="analysis-card"><div className="analysis-section-heading"><h2>Next steps</h2><button type="button" className="analysis-link" onClick={onTrain}>Train <ArrowRight size={16} /></button></div><ol className="analysis-actions">{review.actions.map((action) => <li key={action.title}><strong>{action.title}</strong><p>{action.text}</p></li>)}</ol></section>
        {!!review.improvements.length && <details className="analysis-disclosure"><summary>Recorded improvements <span>{review.improvements.length}</span></summary>{review.improvements.map((item) => <p key={item.name}><strong>{item.name}</strong> — {item.text}</p>)}</details>}
        {!!review.warnings.length && <button type="button" className="analysis-detail-link" onClick={() => setTab("Details")}>{review.warnings.length} data limits to check <ArrowRight size={16} /></button>}
      </>}
      {tab === "Trends" && <>
        <div className="analysis-trend-switch" aria-label="Chart type">{(["Exercises", "Workload", "Weight"] as const).map((name) => <button type="button" key={name} aria-pressed={trend === name} onClick={() => setTrend(name)}>{name}</button>)}</div>
        <div key={trend} className="analysis-chart-panel">
          {trend === "Workload" && <WeeklyChart review={review} />}
          {trend === "Exercises" && <section className="analysis-card">{exercise ? <>
            {exercisePicker}<Badge status={exercise.status} /><p>{exercise.reason}</p>
            <h2 className="analysis-chart-title">First-set {exercise.chartMetric === "reps" ? "reps" : "load"}</h2>
            <small>{exercise.loadingLabel} · one point per workout</small>
            <LinePlot values={exercise.points.map((p) => ({ date: p.date, value: exercise.chartMetric === "reps" ? p.reps : p.load }))} label={`${exercise.name} first-set ${exercise.chartMetric}`} suffix={exercise.chartMetric === "reps" ? "reps" : unit} />
            <p className="analysis-callout">{exercise.trendReason}</p>
            <details className="analysis-disclosure"><summary>Load, reps & effort</summary><div className="analysis-table-scroll"><table><caption>First valid set per workout. Points are spaced by observation, not elapsed time; lines alone do not show strength gains.</caption><thead><tr><th>Date</th><th>{unit}</th><th>Reps</th><th>Reps left</th></tr></thead><tbody>{exercise.points.map((p) => <tr key={p.sessionId}><td>{shortDate(p.date)}</td><td>{p.load}</td><td>{p.reps}</td><td>{p.rir ?? "—"}</td></tr>)}</tbody></table></div></details>
          </> : <div className="analysis-empty"><h2>No exercise records</h2><p>Choose another period or record a workout.</p></div>}</section>}
          {trend === "Weight" && <section className="analysis-card"><h2>Bodyweight trend</h2><Metric label="Change in 7-day average" value={fmt(review.weight.change, ` ${unit}`)} detail={`${review.weight.currentSamples} recent / ${review.weight.priorSamples} prior measurements`} /><LinePlot values={review.weight.points.map((p) => ({ date: p.date, value: p.average }))} label="Seven-day mean bodyweight" suffix={unit} /><small>At least 3 measurements per window. Weight change is not a measure of fat or muscle change.</small><details className="analysis-disclosure"><summary>Weigh-in numbers</summary><div className="analysis-table-scroll"><table><caption>Recorded weight and available 7-day average ({unit}) · goal: {review.weight.goal}</caption><thead><tr><th>Date</th><th>Weight</th><th>Average</th></tr></thead><tbody>{review.weight.points.map((p) => <tr key={p.date}><td>{shortDate(p.date)}</td><td>{p.weight}</td><td>{p.average ?? "—"}</td></tr>)}</tbody></table></div></details></section>}
        </div>
      </>}
      {tab === "Muscles" && <section className="analysis-card">
        <h2>Muscle coverage</h2><small>Sets by the day you actually trained—not a growth score.</small>
        <div className="analysis-legend"><span><i className="analysis-dot" data-status="on-track" />Targets met</span><span><i className="analysis-dot" data-status="hold" />Review targets</span><span><i className="analysis-dot" data-status="adjust" />Recovery concern</span><span><i className="analysis-dot" data-status="insufficient" />Missing data</span></div>
        <MuscleAnatomy review={review} selected={selectedMuscle} select={setSelectedMuscle} compact />
        <div className="analysis-muscle-detail" aria-live="polite"><div className="analysis-section-heading"><h3>{MUSCLE_LABELS[muscle.muscle]}</h3><Badge status={muscle.status} /></div><div className="analysis-muscle-totals"><div><strong>{muscle.direct}</strong><small>Direct sets</small></div><div><strong>{muscle.indirect}</strong><small>Supporting</small></div><div><strong>{muscle.planned}</strong><small>Planned direct</small></div></div><p>{muscle.reason}</p></div>
        <details className="analysis-disclosure"><summary>What the colors mean</summary><p>Colors summarize muscle groups, not individual muscles or left/right differences. Pale areas are not tracked separately. Red does not diagnose an injury; green does not certify safe training. Sets can involve several muscles; direct and supporting sets stay separate. Counts do not measure growth or an ideal weekly dose. Missing workouts are not assigned invented sets.</p></details>
      </section>}
      {tab === "Details" && <div className="analysis-detail-menu">
        <p className="analysis-detail-intro">Open only what you want to check.</p>
        <details className="analysis-detail-section" name="analysis-details"><summary><span>Record quality<small>{REVIEW_CONFIDENCE[review.confidence]} · {review.warnings.length} data limits</small></span></summary><div className="analysis-detail-body">
          <div className="analysis-metrics"><Metric label="Effort entries" value={`${review.counts.rirKnown}/${review.counts.sets}`} detail="Sets with reps left recorded" /><Metric label="Workout difficulty" value={fmt(review.workoutDifficulty, " / 10")} detail="Average session rating" /><Metric label="Measured time" value={review.measuredDurationSeconds === null ? "—" : `${Math.round(review.measuredDurationSeconds / 60)} min`} detail={`${review.durationCoverage} workouts timed`} /><Metric label="Effort on target" value={review.counts.rirTargetKnown ? `${review.counts.rirMet}/${review.counts.rirTargetKnown}` : "—"} detail="Sets with original effort targets" /></div>
          {review.warnings.length ? <ul>{review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>No missing-data flags found by these checks. This is not proof that every input or the program is error-free.</p>}
          <p>Coverage labels describe how much information is available—not prediction accuracy. Planned-set completion is not a growth score. Scheduled workouts include recorded training elsewhere. Effort coverage uses only valid sets; session difficulty is separate from individual-set effort.</p>
        </div></details>
        <details className="analysis-detail-section" name="analysis-details"><summary><span>Exercise review<small>{review.exercises.length} exercises · choose one</small></span></summary><div className="analysis-detail-body">{exercise ? <>{exercisePicker}<Badge status={exercise.status} /><p>{exercise.reason}</p><p className="analysis-callout"><strong>Next:</strong> {exercise.action}</p><p>{exercise.trendReason}</p><small>{REVIEW_CONFIDENCE[exercise.confidence]} · {exercise.exposures} recorded days · {exercise.counts.sets} sets</small><details className="analysis-disclosure"><summary>Rule versions</summary><p>{exercise.provenance.join(", ")}</p></details></> : <p>No exercise records in this period.</p>}</div></details>
        <details className="analysis-detail-section" name="analysis-details"><summary><span>Included workouts<small>{review.workouts.length} records · dates & revisions</small></span></summary><div className="analysis-detail-body">{workout ? <><label className="analysis-select">Workout<select value={workout.id} onChange={(e) => setSelectedWorkout(e.target.value)}>{review.workouts.map((w) => <option key={w.id} value={w.id}>{shortDate(w.scheduled)} · {w.name}</option>)}</select></label><dl className="analysis-facts"><div><dt>Scheduled</dt><dd>{workout.scheduled}</dd></div><div><dt>Performed</dt><dd>{workout.performed}</dd></div><div><dt>Revision</dt><dd>{workout.revision}</dd></div></dl></> : <p>No workout records filed under this period.</p>}<p>Attendance uses the scheduled slot. Muscle exposure and weekly workload use the actual training date. Catch-ups may update an earlier period.</p></div></details>
        <details className="analysis-detail-section" name="analysis-details"><summary><span>Suggestion results<small>{review.evaluation.eligible} usable exercise records</small></span></summary><div className="analysis-detail-body"><p>{review.evaluation.eligible ? `${review.evaluation.metTargetsAndRecovery} of ${review.evaluation.eligible} evaluable exercise exposures met the saved rep/effort targets and had acceptable delayed recovery.` : "Not enough fully recorded, followed suggestions to evaluate yet."}</p><p>{review.evaluation.excluded} excluded: the exact suggestion, whether it was followed, complete effort, or delayed recovery was missing. Phase 2 effort sets use a different protocol.</p><p>This selected sample is descriptive—not a success rate or proof that the app caused a result.</p></div></details>
        <details className="analysis-detail-section" name="analysis-details"><summary><span>Evidence & privacy<small>How this review works</small></span></summary><div className="analysis-detail-body"><p>Analysis rule: <code>{review.version}</code>. Recalculated from records available on {review.asOf}, including later recovery answers and edits. Offline reviews use this device’s records; reconnect for other-device changes.</p><p>No new data upload, AI service or separate report database. Reviews do not measure muscle growth, diagnose overtraining or change your plan. They are not medical advice.</p><details className="analysis-disclosure"><summary>Information-coverage rules</summary><p>“Well recorded” requires at least {REVIEW_RULES.highExposures} prior/selected exercise dates, {REVIEW_RULES.highRirCoverage}% effort coverage, delayed recovery and no missing original plan or invalid entries.</p><p>Monthly verdicts require {REVIEW_RULES.monthlyWeeks} complete weeks in that month, each with at least {REVIEW_RULES.weeklySessions} recorded workouts, {REVIEW_RULES.weeklySetCoverage}% of known planned sets and {REVIEW_RULES.moderateRirCoverage}% effort coverage. These are conservative product rules, not trial-proven thresholds. Totals and recovery concerns remain visible.</p></details><p><a href="https://link.springer.com/article/10.1007/s40279-021-01559-x" target="_blank" rel="noopener noreferrer">RIR accuracy review</a>: reported reps left are useful but imperfect. <a href="https://pubmed.ncbi.nlm.nih.gov/19130641/" target="_blank" rel="noopener noreferrer">Volume measurement study</a>: counting methods describe different things. Neither validates RepArc’s exact thresholds.</p><button type="button" className="analysis-link" onClick={onGuide}><CircleHelp size={18} />Evidence library</button></div></details>
      </div>}
    </div>
  </section>;
}
