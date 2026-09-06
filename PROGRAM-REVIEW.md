# RepArc independent program review

## Internal evidence and calculation audit · 2 September 2026

The implemented program tables, progression rules and report calculations were checked against the official SBS Hypertrophy lower-frequency workbook supplied with the project and the primary/authoritative sources linked in RepArc's Evidence library.

Verified or corrected in version 10.3.0:

- The 3-, 4- and 5-day Phase 2 programmed-lift layouts, all 21 normal-week percentages and rep targets, four-set default, and final-set training-max adjustment table match the source workbook.
- Deload weeks 7, 14 and 21 now use the workbook's four sets of five with no AMRAP or training-max change. Earlier builds incorrectly displayed high-repetition deload targets.
- Phase 2 training maxes are mandatory and exercise-specific. RepArc no longer transfers performance between unlike machines, dumbbells, barbells or movement patterns, and the first Phase 2 exposure is progression-neutral calibration.
- Estimated performance trends use only comparable four- to ten-repetition sets on suitable loaded movements. Unsupported bodyweight movements are excluded, historical bodyweight uses the nearest prior weigh-in, and a change must clear a five-percent guardrail and repeat before it is called an established positive trend.
- External-load volume is explicitly descriptive, counts per-side work consistently, excludes bodyweight and is not presented as mechanical work or a valid comparison between different exercises or machines.
- Autoregulated load advice never progresses incomplete work, pain overrides progression, missing RIR lowers confidence, and a standard increase is withheld when it would exceed ten percent of the current load.
- Scheduled unlogged workouts, planned recovery, moved workouts and training elsewhere are reported separately. Training elsewhere can fulfill schedule adherence without fabricating performance data.

Important evidence boundary: the Phase 1 exercise selection, women's-track distribution, goal emphasis, readiness responses and return-from-break percentages are evidence-informed product rules, not independently validated clinical or coaching algorithms. Individual results cannot be guaranteed from app inputs. The external review below remains required before describing the complete program as independently coach-approved.

RepArc's evidence library and automated tests support internal consistency; they are not a substitute for independent expert review. Before a public fitness release, have a qualified strength-and-conditioning professional review the actual prescriptions and sign this record.

Reviewer should check: every exercise and substitution; weekly set distribution by program track and frequency; progression and deload calculations; return-from-pause calibration; Phase 1 to Phase 2 transition; women's-track wording and symptom-based readiness options; safety stop rules; training-max behavior; and the accuracy of every evidence summary and source link.

The reviewer must also confirm that RepArc clearly identifies its adaptation of the free Stronger by Science Program Bundle, does not imply affiliation or endorsement, and does not redistribute original spreadsheets. Separate legal advice may still be needed for branding, licensing and public distribution.

| Reviewer | Qualification | Review date | Version | Approved / changes required | Signature or written approval reference |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

Status: **external review not yet recorded**. Automated checks cannot fill or replace this sign-off. Do not describe the program as independently coach-approved until a qualified reviewer completes the row above.

## First-exposure policy · 6 September 2026

Version 10.5.0 adds per-exercise familiarization, reduced sets, recovery-dependent advancement, a visible unfamiliar-work budget and selective Phase 2 progression freezes. The complete deterministic policy, research boundaries and outstanding external-review findings are recorded in [EXPOSURE-REVIEW.md](EXPOSURE-REVIEW.md). These exact thresholds require coach review and prospective user evaluation; this addition does not fill the sign-off above.

## Warm-up, cardio and equipment audit · 5 September 2026

- A brief, easy general warm-up plus one to three movement-specific rehearsal sets is presented as practical preparation, not a universal performance or injury-prevention guarantee. Rehearsal sets are excluded from working volume and progression.
- Walking and stair-machine work can both raise heart rate. RepArc does not call either uniquely superior; stair work is flagged as potentially fatiguing before lower-body lifting.
- Substantial same-session cardio is placed after strength work when strength is the priority, or separated by several hours. Post-lift cardio is optional and is not described as preventing soreness or injury.
- Warm-up and post-lift cardio logs are descriptive only. They cannot independently increase or decrease strength prescriptions.
- Exercise-specific load ladders now constrain exact load recommendations. When a ladder is missing, RepArc asks the user to configure the equipment rather than inventing an unavailable number.
- Blank RIR remains unknown and lowers confidence. It is never converted to zero and cannot by itself trigger a load decrease; zero explicitly means no repetitions remained.

These decisions were checked against the linked systematic reviews, meta-analyses and public-health guidance in the in-app Evidence library. They remain general adult fitness guidance and do not replace individualized coaching or clinical screening.

## Missed-day and severe-soreness audit · 5 September 2026

- Original loads, repetitions, RIR and session snapshots remain immutable. Reports are derived from those records, while Phase 2 training-max state is rebuilt from the session sequence whenever stored data is normalized or merged.
- A missed workout can now be classified as severe soreness. It remains an honest unlogged scheduled session rather than invented performance data, and it activates one progression-neutral re-entry session.
- Return-session set counts use actual rounded reductions; a 0.67 volume factor now changes three planned sets to two instead of accidentally retaining all three.
- Movement-limiting soreness blocks session saving and progression. The app names CDC warning signs for exertional rhabdomyolysis and directs the user to urgent medical assessment rather than attempting a diagnosis.
- The one-session 0.90 load, 0.67 volume and three-RIR re-entry rule is a conservative product guardrail informed by gradual re-exposure evidence. It is not a clinically validated individualized prescription.
