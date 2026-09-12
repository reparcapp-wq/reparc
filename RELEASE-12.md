# RepArc 12.0.0 — Progress Analysis

## What ships

- Progress → Open progress analysis, also accessible from Training notices.
- Dedicated daily, weekly and monthly review with Summary, Performance, Muscles and Full review sections. Past periods are navigable, not appended into an endless feed.
- Up to three grouped next steps; exact logged-set, target, attendance, recovery and duration coverage; exercise and bodyweight charts with numeric tables.
- Front/back muscle schematic plus named buttons. Direct and supporting sets remain separate. Colors describe recorded target/recovery information, not growth, optimal dose, injury diagnosis or guaranteed safety.
- Existing canonical exercise-history matching, frozen prescriptions, catch-up scheduling, units, return/calibration and Phase 2 semantics are retained. A review never changes training maxes, logs or the live program and does not issue a second competing load prescription.
- Partial workout saves continue accumulating elapsed time. Completed/historical edits preserve timing. Missing and sub-minute historical durations are reported as unavailable, not reconstructed.

## Data and evidence boundaries

The analysis version is `12.0.0-review1`. It is deterministic and computed from the current account's current records. Historical periods are recalculated after corrections/recovery answers; they are not immutable reports of exactly what the app knew then. Both recommendation versions and included workout revisions are visible.

Implementation improvement over the earlier persistence proposal: there is **no new report table or duplicated persistent report cache**. The existing account-scoped offline workout store is the input. This avoids stale verdicts, a second personal-data copy and a new migration. Offline results reflect only data already present on that device. Sync/backup/retention/optional improvement consent remain unchanged. The on-device outcome counts do not upload evaluation data or alter consent.

Summary/calendar attendance uses the scheduled slot; weekly workload and muscle exposure use physical performed dates. Catch-ups can update an earlier period without pretending that recovery started earlier. Snapshot-less data can contribute identifiable performed work, but cannot acquire invented historical targets.

Exact information-coverage thresholds are product rules, **not trial-validated accuracy probabilities**. Monthly verdicts require three fully ended, sufficiently recorded weeks inside the month. Totals and reported recovery concerns remain available before that threshold. No causal/diagnostic inference is made from low volume, absent logs, weight changes or a two-session performance comparison. Phase 2 AMRAP sets are not assessed as ordinary rep-range misses, and review advice refers the user to Train for its current prescription.

Evidence checked against primary sources on 2026-09-13:

- Halperin et al., *Accuracy in Predicting Repetitions to Task Failure*, Sports Medicine (2022), [DOI](https://link.springer.com/article/10.1007/s40279-021-01559-x). The 12-study, 414-participant meta-analysis found imperfect RIR prediction and substantial heterogeneity. Supports treating reported RIR as uncertain; does not validate our 60/80% coverage thresholds or ±1-RIR comparison filter.
- McBride et al., *Comparison of Methods to Quantify Volume During Resistance Exercise* (2009), [PubMed](https://pubmed.ncbi.nlm.nih.gov/19130641/). The 10-participant crossover study illustrates that volume methods produce different quantities. Supports descriptive labels, not treating set counts as growth measurements or a cross-exercise strength score.
- Existing evidence library and `PROGRAM-REVIEW.md` remain the references for the underlying training program. This feature adds no new physiological loading algorithm or claims of independent program validation.

## Verification and release

Run the full test suite, TypeScript, lint, production Next build, static security scan including new files, isolated database checks, and production dependency audit. Browser QA uses the synthetic-only preview (`node scripts/preview-progress-analysis.mjs`); it is not a production route and has no account connection.

No database migration or user-data reset is needed. Publish through the existing GitHub → Netlify pipeline after checks. Verify the actual production release/build stamp; do not announce a queued deployment as live.

The requested **GPT-6 Astra / xhigh separate recommendation-logic and safety verification pass has not yet run**. Its reviewer should challenge the report's denominators, sufficiency labels, treatment of saved snapshots, dates, Phase 2, recovery precedence, hidden/excluded records, alias matching, and suggestion-outcome selection bias. Passing the implementation tests is not independent evidence of clinical safety or predictive accuracy.

Existing external acceptance still applies: physical iOS/Android offline behavior, full authenticated end-to-end checks, provider-backup restoration and qualified independent program review. No new live RLS claim is made from the isolated PostgreSQL test.

## Concise team changelog

RepArc now explains your progress inside the app: quick weekly/monthly reviews, exercise and weight charts, muscle coverage, and clear next steps. Missing data is called out instead of guessed. Catch-up workouts keep their correct calendar slot while workload uses the day you actually trained. Partial-save workout timing is fixed. Existing logs and training rules are preserved.
