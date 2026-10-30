# RepArc 12.2.8 — flexible equipment choices

- Untouched exercises remain swappable before logging and in partially saved current workouts. Previously any saved session disabled the entire chooser.
- Exercises with entries, completed workouts, and historical workouts offer an enabled **Next time** chooser. It changes the future preference without renaming performed sets or changing the saved prescription.
- Reviewed Phase 2 main-lift alternatives are available, including machine squat choices. Substitutes use their own loading identity, calibration and rep-range progression. They neither inherit nor update the original SBS training max and do not receive its final-effort prescription. The confirmation explicitly identifies this as modified Phase 2 programming.
- Replacing an untouched saved slot preserves the other entries, captures the previous revision, and cannot add sets or lower the captured recovery effort limit. Preferences and partial-session updates use the durable save/sync path.
- Cable-crunch slots offer Decline sit-up with a separate exercise identity, added-plate-only weight entry and no estimated maximum. The technique guide distinguishes it from cable-stack loading. This is a trunk-training alternative, not an identical biomechanical movement.
- Recommendation provenance: `12.2.8-policy8`. No historical records are migrated or reclassified.

Evidence boundary: exercise-specific strength supports separating load histories; similar average hypertrophy across machine/free-weight modalities does not establish identical prescriptions or safe weight conversions. The substitution and first-exposure rules are app policy, not a validated equivalent of the original SBS progression. Reference: https://pubmed.ncbi.nlm.nih.gov/37582807/

Sit-up evidence boundary: trunk and hip-flexor activation differ from curl-ups. Acute activation data do not prove equal long-term outcomes or establish a cable-to-plate conversion. Reference: https://pubmed.ncbi.nlm.nih.gov/23207881/

Scope: users can change the listed exercise for the equipment available at each visit. This does not add branch profiles or automatically identify two differently built machines sharing the same exercise name.

Validation: 313/313 regression tests, lint, TypeScript, both builds, dependency/static security checks and 37 isolated PostgreSQL checks passed. Database checks are local isolation checks, not a new live RLS audit. Synthetic browser acceptance covers main-lift substitution, partial save then hack-squat-to-linear-leg-press substitution, reload persistence, and next-time preferences retaining recorded sets. No live workout records are changed by these tests.
