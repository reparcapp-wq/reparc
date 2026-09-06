# Focused Train workspace — 10.5.1

## Changes and preservation boundaries

- Swap now replaces the exercise heading with its options. Current selection, cancel/Escape, keyboard focus, saved-session locks and SBS fixed-lift restrictions are retained.
- The top bell opens Training notices: readiness, return/calibration guidance, deferred exercises, per-exercise recovery and known-starting-load confirmation. Closing it does not acknowledge recovery or change the prescription.
- Movement-limiting soreness/pain warnings and save restrictions remain outside the panel. Current prescribed sets/RIR remain beside the logging fields.
- Equipment values are configured once, then edited under Setup → Available loads. Updates are not displayed as saved until persistence succeeds. A failed save retains its form and values.
- Equipment inputs reject invalid values rather than silently dropping them. Unit changes remount the editor in the current unit. Canonical profiles and tombstones remain authoritative; conflicting legacy slot profiles stay separately editable instead of silently overwriting each other.
- Compact warm-up, navigation and finish-session disclosures; improved light active-tab contrast, label contrast, 16px number-entry text and reduced-motion-compatible heading transitions.

No changes to the training catalogue, progression mathematics, Epley estimate, report calculations, first-exposure policy, logged workout history or database schema. Existing limitations in EXPOSURE-REVIEW.md are not closed by this UI release.

## Evidence and wording check

- Readiness text now refers to the displayed RIR target instead of suggesting 2–3 RIR when familiarization requires 4. Return-session text also preserves the separate per-exercise recovery checks.
- Equipment values describe available equipment, not a scientifically determined starting load or a guarantee of safety.
- Safety warning retained against [CDC rhabdomyolysis guidance](https://www.cdc.gov/niosh/rhabdo/signs-symptoms/index.html). This warning does not diagnose a condition.
- Contrast and reduced-motion changes follow [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [interaction-animation guidance](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html). This is not a whole-app accessibility certification.

## Verification

- 116 automated tests pass, including 10 added equipment/heading/notice/visual-contract regressions. Includes prior calculation, report, swap identity, return and familiarization checks.
- Isolated browser fixture (synthetic account, in-memory storage, no real workout records): inline swap and variant change, persistent pain warning/save lock, equipment save/remove-from-Train/edit-in-Setup, failed save with retained text followed by successful retry, and focus return to the bell after the original opener disappears.
- Mobile light/dark layouts checked in the desktop browser; 16px workout inputs and 14px field labels checked in rendered styles, along with horizontal overflow. This does not replace physical iPhone/Android acceptance or authenticated production end-to-end testing.
- Production build, lint, standalone TypeScript, static security scan and dependency audit passed before publishing. Passing tests establish the tested behavior, not guaranteed prediction accuracy or clinical efficacy.
