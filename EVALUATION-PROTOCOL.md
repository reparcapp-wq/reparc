# RepArc recommendation evaluation protocol

Policy date: 7 September 2026. Owner approval is required before changing any production recommendation rule. Collection is optional and cannot modify prescriptions.

## Questions and limits

- Compare prescribed and completed rep ranges, set completion, load overrides and reported RIR. Report missing values separately; never substitute zero for an unknown value.
- Track normal/mild versus movement-limiting recovery and hours since the recorded session. Self-report and device-clock uncertainty must be disclosed. Do not label absence of feedback as a successful recovery.
- Report calibration state, exercise/equipment identity and experience/track coverage. Track is a program selection, not a validated biological classifier. Never combine unlike machine load values into a single strength metric.
- Keep user-selected loads separate from algorithm predictions. Report no load prediction when the app intentionally provided none. Absolute rep/RIR error alone is not proof of safety, physiological adaptation or clinical accuracy.

## Before an evaluation

Specify the hypothesis, affected rules and version, eligible records, observation window, outcome definition, missing-data handling, minimum meaningful difference and sample-size/power rationale. No fixed universal user count establishes validity.

Use participant-level holdouts (all sessions from one participant stay in the same partition) and a later time window where practical. Report confidence intervals, participant counts, exposure counts, missing recovery, dropout and selection bias. Publish small-subgroup suppression rules before sharing aggregates. Do not tune on the final holdout.

## Access and retention

- Default off, separate consent. No backfill before granted_at. Consent expires after 365 days.
- Raw account-linked evaluation records expire after 180 days. Audits expire after 365 days. Account deletion cascades to all related rows.
- Owner-facing export and withdrawal use authenticated RPCs. Routine maintainer exports must use the restricted reviewed export RPC; never use dashboard dumps for routine evaluation. Administrative provider access remains privileged and requires account access controls and provider logs.
- The maintained code uses no third-party analytics and provides no public or cross-account training-data endpoint.

## Release decision

An authorized human records the hypothesis, analysis, population limitations, code diff, tests, independent coach findings where relevant, acceptance results, rollback version and approval in a new evaluation report. Change the recommendation version whenever prescription logic changes. No data pipeline, cron job or model can deploy/tune a production rule automatically.

Evidence: [NPC Data Privacy Act](https://privacy.gov.ph/data-privacy-act/); [NPC implementing rules](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/); [2025 volume dose-response analysis](https://pubmed.ncbi.nlm.nih.gov/41343037/). Direct and indirect set attribution is an explicit descriptive convention; no fraction or weekly set threshold is a universal individual optimum.
