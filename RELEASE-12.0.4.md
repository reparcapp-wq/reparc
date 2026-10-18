# RepArc 12.0.4 — consistent return-workout guidance

- First-set instructions now use the same saved/effective reps-left target as the exercise card, including reduced-volume return workouts.
- A shorter return plan can no longer replace a stricter unfamiliar-exercise effort target in the explanatory text.
- Existing set counts, load calculations, return-session counts, Phase 2 progression, and workout records are unchanged. No database migration.
- Added executable regression checks for month-long returns, Foundation/bodyweight guidance, decreases, historical targets, and equipment rounding.

These are wording-consistency fixes, not new physiological rules or a claim of guaranteed safety. The existing return thresholds remain product safeguards, not individually validated recovery cutoffs.

## Dependency security patches

- Next.js and eslint-config-next 16.3.8; sharp 0.35.5; fast-uri 3.1.8; source-map-js 1.2.2; brace-expansion 1.1.21/5.0.12.
- Scoped miniflare → undici 7.29.1 override, because the current Miniflare package pins vulnerable 7.29.0 exactly. No framework major upgrade or forced audit downgrade.
- Production dependency audit reports zero known vulnerabilities after these patches.
- Remaining limitation: the full development-tool audit reports the unpatched [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), propagated through eight development dependency nodes. It does not appear in the production dependency audit. Do not treat the full development audit as clean or downgrade the toolchain to satisfy the advisory automatically.

Patch references: [Next.js](https://github.com/vercel/next.js/releases/tag/v16.3.8), [sharp](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w), [fast-uri](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj), [source-map-js](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2), [Undici](https://github.com/nodejs/undici/releases/tag/v7.29.1).

## Verification

2026-10-19: 220/220 tests, lint, static security scan, production Next build (including TypeScript), 37 isolated PostgreSQL checks and production dependency audit passed. Focused separate code review found no blockers. No new live RLS or clinical validation claim.

Run the vinext test build and Next production build sequentially: both generate `.next/types`, so parallel execution can create incompatible generated types. The sequential production rerun passed. Validated service-worker stamp: `23fac47db9fa`. Publication must still be verified against the hosted commit and live stamp.
