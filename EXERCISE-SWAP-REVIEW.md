# RepArc 11.0.1 — exercise substitution and stop-path audit

## Scope and evidence boundary

This is an internal programming/code review, not independent coach approval or an injury-prevention trial. Both tracks, both phases, 3/4/5-day schedules, all equipment settings and goal emphasis settings are covered by the catalog invariants. Existing SBS main/auxiliary prescriptions and training-max tables are unchanged; their swap lock remains enforced in the handler as well as the UI.

The curated list contains effective training options, not a scientifically ranked universal optimum. Similar-role substitutions can differ in technique, range of motion, resistance profile, muscle emphasis and fatigue. No kilogram conversion between different movements or machines is claimed.

## Corrections

- Offered swaps must have an explicit matching programming role and known metadata. Unknown names fail closed. Historical catalog names are retained for old entries and saved selections.
- Row → pulldown, leg extension → goblet squat, hip thrust → kickback, and triceps isolation → close-grip press are not presented as direct replacements.
- Rear-delt and lateral-raise roles are separate; hip abduction and kickback roles are separate; trunk flexion and stability are separate.
- Nordic curls, good mornings and sissy squats are excluded from new drop-in swap menus pending separate technique/assistance/dose review. They are not declared inherently unsafe, and their old logs are not erased.
- Wall sits are excluded from repetition-based substitutions: a timed hold cannot inherit a repetition prescription. The home knee-extension option uses the already catalogued Spanish squat, which still requires suitable setup, comfort and calibration; it is not an identical leg-extension stimulus.
- Home rear-delt and kickback fallbacks retain their movement emphasis instead of silently becoming lateral raises or hip abduction.
- Similar-role options carry a non-equivalence explanation. Prior selections that no longer qualify remain identifiable and are explicitly labelled for review; no forced migration of existing choices, logs or saved session snapshots.
- Skip / stop unlocks navigation, preserves entered sets, supports undo and persists in local drafts and saved session data. Skipping never fills missing fields or changes planned sets. Sessions with skips remain partial and cannot advance SBS training maxes or schedule completion. With zero logged sets, no workout performance is fabricated.
- Skipped exercise entries cannot promote familiarity or seed a suggested training max; the latest stopped exercise receives hold/reassess wording in Train and its daily report.
- Recommendation version changes to `11.0.1-policy2`; old session provenance is retained.

## Sources and interpretation

- ACSM 2026 position stand / official summary: individualization, consistent participation and goal-appropriate programming rather than universal perfect exercises. https://acsm.org/resistance-training-guidelines-update-2026/
- Kassiano et al. 2022 systematic review: purposeful exercise variation may support regional development; excessive random variation may be counterproductive. It does not supply RepArc's exact substitution graph. https://pubmed.ncbi.nlm.nih.gov/35438660/
- 2023 free-weight/machine meta-analysis: similar observed hypertrophy with exercise/equipment-specific strength adaptations. No validated load conversion between equipment is provided. https://pubmed.ncbi.nlm.nih.gov/37582807/
- 2025 Nordic dose-response review: supports Nordic training efficacy, not a blanket claim that Nordics are unsafe or interchangeable with leg-curl machine prescriptions. https://pubmed.ncbi.nlm.nih.gov/40991853/

The role graph, curated-menu policy and skip workflow are engineering/coaching judgments informed by that evidence. Expert review must assess the actual list, setup guidance and doses. Real-device usability, authenticated end-to-end acceptance, independent coach review and prospective safety/outcome evaluation remain separate gates. No automatic production algorithm learning is introduced.

## Verification

- Full regression suite: 133/133 passed, including six new swap/skip safety checks.
- Catalog invariants cover both tracks and phases across frequency, equipment and goal settings; legacy identity regression remains passing.
- Production Next.js build and TypeScript passed; lint and static security scan passed; production dependency audit reported zero known vulnerabilities.
- Local preview returned HTTP 200. No claim of physical-device or authenticated end-to-end testing is made for this patch.
