# RepArc 12.0.3 — recommendation and report safety audit

## Scope and conclusion

This is the requested separate software verification pass after the v12 analysis build. It combined training-logic, reporting and evidence reviews with adversarial runtime fixtures and regression tests. Confirmed defects were fixed with the user's permission. It is not an independent coach sign-off, clinical validation, prospective accuracy study, or guarantee that no defects remain.

The original entered loads, repetitions, effort and workout dates are preserved. Corrected derived reports and Phase 2 planning numbers can change when the app recalculates history. No live database migration, account deletion, or direct workout-row rewrite is part of this release.

## Confirmed defects and corrections

| Area | Reproduced failure | Correction |
| --- | --- | --- |
| Effort-aware progression | An average concealed a failed set or missing RIR and allowed an increase. | Every completed set must have known effort; a set below one rep left vetoes an increase. A high-effort rep miss is assessed per set, not by average. |
| Phase 2 unit replay | Historical pound-based maxes were reused as kilogram values after a unit change. | Replay uses a common physical unit and preserves each session's own units. Explicit kg records and weigh-ins are no longer relabeled as lb. |
| Phase 2 effort-set validity | A final-set result at half the prescribed load could raise the planning max. | Progression requires all prescribed sets, correct normal-set reps, the captured load, and no recorded protection/adverse recovery. Missing captured load holds progression; legacy records must match the exact percentage. |
| Phase 2 equipment rounding | Nearest rounding could select a heavier equipment step than the target. | Select an available load at or below the target; no fitting load means no numeric suggestion. |
| Manual planning-max review | Replay silently discarded an explicitly reviewed starting value. | Timestamped, unit-stamped review events preserve reset boundaries and subsequent eligible progression. Repeated reviews, local dates, deleted workouts and historical edits are tested. Both merge paths retain independently added events. |
| Duplicate revisions | Replaying duplicate sessions inflated maxes; a newer tombstone could be replaced by an older active revision. | Shared canonical current-record selection precedes replay and muscle totals. Obsolete raw records remain intact and cannot overwrite a selected deletion. |
| Historical unit editing | New entries used display units while old recommendation/max metadata kept the former numbers. | All load metadata is converted together; entered weights are rounded to valid precision. Unknown historical bodyweight stays unknown. |
| Ordinary symptoms | Symptoms alone reset established familiarity; an initial fix then hid a genuinely failed familiarization set. | Symptoms hold promotion without erasing familiarity, but actual failure, pain and adverse recovery take precedence. |
| Daily report advice | A second recommendation path could suggest increases despite severe recovery, or downgrade stop guidance for skipped work. | Safety concerns remain stop guidance. Otherwise the daily report points to Train for the current prescription, with no competing numeric weight recommendation. |
| Missing historical targets | Normalization invented 1–100 reps and a three-RIR target, enabling unjustified green results. | Missing targets remain missing. The old fabricated 1–100 pair is treated as unknown. No target compliance is asserted without a saved target. |
| Daily performance claims | Best-set formula comparisons ignored effort/protocol changes and missing effort. | Fixed first-set, same-exercise/protocol, exact same reported-effort comparisons. The legacy chart is labeled a descriptive load–rep score, not a measured strength maximum. The detailed analysis retains its separately disclosed comparison rules. |
| Attendance | An app workout and an external-workout record on the same date could be counted twice. | Count distinct due scheduled dates; exclude later performance and clip absence intervals to the period. |
| Historical review stability | A later adverse workout or today's return mode changed an older period's verdict. | Familiarity is anchored to the last selected exposure, with saved protection flags. Explicit corrections or recovery answers about that exposure still legitimately update its report. |
| Evaluation timing | Rounding 47.5 hours to 48 incorrectly crossed a recovery-data threshold. | Preserve fractional elapsed hours; invalid, absent and negative timing is unknown. Missing targets stay null in opt-in samples. |
| Presentation | Analysis entry/selected controls used inconsistent accents. | Shared RepArc gold, dark button text and theme-specific readable secondary colors. Existing semantic warning/success colors remain distinct. |

## Evidence boundaries checked

- RIR is a subjective input, not a physiological measurement. The 12-study, 414-participant meta-analysis found imperfect predictions and substantial heterogeneity; it does not validate RepArc's individual recommendations. [Halperin et al.](https://pubmed.ncbi.nlm.nih.gov/34542869/)
- The cited 1RM cross-validation tested young men performing repetitions to failure at 80% 1RM on bench press and leg extension. It does not establish accurate 1RM estimates from all ordinary submaximal sets, machines, or populations. Guide wording now names those limits. The displayed load–rep score is descriptive. [Cross-validation study](https://pubmed.ncbi.nlm.nih.gov/39495260/)
- The women's resistance-training review reported moderator associations, not proof that adding sessions or volume causes a particular user's result. Guide wording no longer presents the volume association as a demonstrated causal prescription. [Systematic review](https://pubmed.ncbi.nlm.nih.gov/38090747/)
- Exact familiarization states, novelty budgets, return percentages, percentage step caps and report sufficiency thresholds are conservative engineering rules informed by evidence. They have not been individually validated by trials of this app. SBS tables are published programming; the app's surrounding safeguards and adaptations are not themselves the published trial intervention.
- Ordinary menstrual symptoms are not classified as injury. Movement-limiting soreness, pain and recorded adverse recovery still prevent automatic progression. Neither a green body map nor a confidence label promises safe exercise or measured muscle growth.

## Limits and data handling

- Reports cannot recover historical information that was never recorded. Previously fabricated defaults that are indistinguishable from genuine values cannot be perfectly reconstructed. There is no guessed backfill.
- Review events protect future explicit planning-max reviews; an earlier discarded manual review cannot be recovered if no record of it exists.
- Workout sets are not rewritten during recalculation. Older derived planning snapshots may be corrected. Editing an old session in another unit preserves physical quantities, subject to two-decimal input rounding.
- Consent, evaluation retention and ownership rules are unchanged. No automatic production-algorithm learning is introduced.
- The optional emphasis allocator already uses structured metadata and a weekly direct-set check; its 18-direct-set ceiling is a product guardrail, not an optimal universal dose. See the dated clarification in EXPOSURE-REVIEW.md.
- A qualified independent program review remains unsigned in PROGRAM-REVIEW.md. Physical iOS/Android acceptance, authenticated end-to-end testing, a provider-backup restore and live two-account RLS are separate checks, not proven by local unit or isolated database tests.
- The user reports Gmail delivery is working again. This audit does not claim to have independently retested mailbox delivery or changed SMTP credentials.

## Verification record

Release checks passed: **215/215 automated tests**, production Next/Netlify build, TypeScript, lint, static security scan, **37 isolated PostgreSQL checks**, and production dependency audit (zero reported vulnerabilities). The 29 new safety cases cover report and training edge cases; additional existing fixtures were corrected to enforce the new contracts rather than expect unsupported improvements.

A separate review reran the duplicate-revision/deletion, reviewed-max merge and symptoms/failure probes after the fixes; no residual regression was found in that bounded pass. Browser synthetic checks covered 320px, 390px and 1280px, dark/light gold controls, 200% text, section navigation and empty records. No horizontal overflow or browser console errors were observed. These are browser simulations, not physical-phone acceptance.

The development build still reports its pre-existing large-chunk advisory; it is a performance optimization opportunity, not a failed build or a recommendation-safety finding. Isolated database checks do not establish live two-account RLS. Publication is verified separately; a queued deploy is not a live release.

Recommendation version: `12.0.3-policy3`. Review version: `12.0.3-review2`.
