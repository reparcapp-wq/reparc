"use client";

import { bodyBack, bodyFront, type AnatomyRegion } from "@/lib/anatomy-paths";
import type { Muscle } from "@/lib/exercise-metadata";
import { MUSCLE_LABELS } from "@/lib/muscle-volume";
import { REVIEW_STATUS, type ProgressAnalysis } from "@/lib/progress-analysis";

/** Display mapping only. Never infer sets, recovery, or individual submuscle results from the drawing. */
export const ANATOMY_GROUPS: Readonly<Partial<Record<string, Muscle>>> = {
  chest: "chest", deltoids: "shoulders", biceps: "biceps", triceps: "triceps",
  abs: "trunk", obliques: "trunk", quadriceps: "quads", hamstring: "hamstrings",
  gluteal: "glutes", calves: "calves", trapezius: "back", "upper-back": "back", "lower-back": "back",
};

type Props = { review: ProgressAnalysis; selected: Muscle; select: (muscle: Muscle) => void; compact?: boolean };

function BodyView({ regions, side, review, selected, select }: Props & { regions: AnatomyRegion[]; side: "Front" | "Back" }) {
  // One keyboard stop per report group, even when several anatomical shapes share its status.
  const groups = new Map<string, AnatomyRegion[]>();
  for (const region of regions) {
    const key = ANATOMY_GROUPS[region.slug] ?? region.slug;
    groups.set(key, [...groups.get(key) ?? [], region]);
  }
  return <figure className="anatomy-view">
    <figcaption>{side}</figcaption>
    <svg viewBox={side === "Front" ? "35 95 660 1270" : "755 95 660 1270"} className="anatomy-figure" role="group" aria-label={`${side} muscle map`}>
      {[...groups.values()].map((parts) => {
        const region = parts[0];
        const muscle = ANATOMY_GROUPS[region.slug];
        const row = muscle && review.muscles.find((item) => item.muscle === muscle);
        const paths = parts.flatMap((part) => [...part.path.common ?? [], ...part.path.left ?? [], ...part.path.right ?? []]);
        return <g key={region.slug} className="anatomy-region" data-region={region.slug} data-muscle={muscle}
          data-status={row ? row.status : "untracked"} data-selected={muscle === selected || undefined}
          role={muscle ? "button" : undefined} tabIndex={muscle ? 0 : undefined}
          aria-hidden={!muscle || undefined} aria-pressed={muscle ? muscle === selected : undefined}
          aria-label={muscle ? `${MUSCLE_LABELS[muscle]}, ${side.toLowerCase()}: ${row ? REVIEW_STATUS[row.status] : "Not enough information"}` : undefined}
          onClick={muscle ? () => select(muscle) : undefined}
          onKeyDown={muscle ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(muscle); } } : undefined}>
          {paths.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
        </g>;
      })}
    </svg>
  </figure>;
}

export function MuscleAnatomy(props: Props) {
  return <div className={`analysis-body-layout${props.compact ? " is-compact" : ""}`}>
    {props.compact && <label className="analysis-select">Muscle group<select value={props.selected} onChange={(event) => props.select(event.target.value as Muscle)}>{props.review.muscles.map((row) => <option key={row.muscle} value={row.muscle}>{MUSCLE_LABELS[row.muscle]}</option>)}</select></label>}
    <div className="anatomy-stage">
      <div className="anatomy-pair"><BodyView {...props} regions={bodyFront} side="Front" /><BodyView {...props} regions={bodyBack} side="Back" /></div>
      <p className="anatomy-hint">Tap a muscle or choose its name.</p>
    </div>
    {!props.compact && <div className="analysis-muscle-buttons" aria-label="Muscle groups">
      {props.review.muscles.map((row) => <button type="button" key={row.muscle} aria-pressed={props.selected === row.muscle}
        aria-label={`${MUSCLE_LABELS[row.muscle]}: ${row.direct} direct sets, ${row.indirect} supporting sets. ${REVIEW_STATUS[row.status]}`}
        onClick={() => props.select(row.muscle)}>
        <span className="analysis-dot" data-status={row.status} />
        <span>{MUSCLE_LABELS[row.muscle]}<small>{row.direct} direct · {row.indirect} supporting</small></span>
      </button>)}
    </div>}
  </div>;
}
