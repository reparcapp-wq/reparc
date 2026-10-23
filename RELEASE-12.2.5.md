# RepArc 12.2.5 — working sets first, warm-up separate

- When past low-rep history cannot establish today's higher-rep working weight, the primary guidance now shows the working reps and reps-left target and explicitly says the weight is not yet established.
- Put the history-based warm-up reference in a separate, collapsed “Optional warm-up” section. It is not a working set, cannot fill the working-weight field, and disappears when working sets begin or safety/skip/completion states take priority.
- Keep the explanation and historical reference under “Why this guidance?” rather than making the rehearsal weight look like the workout prescription.
- Preserve workout logs, calculation rules, return/calibration restrictions, training maxes and database schemas. No new estimated working weight is invented from an incompatible rep record.
- Update Next.js and eslint-config-next from 16.3.8 to 16.4.2 after the release dependency gate caught new upstream advisories. No claim of an observed compromise is made.

## Calculation checks

The screenshot-matched synthetic case uses a prior 25 kg per-side set of six reps, a 38-day gap, and today's 12 reps / at least four reps left. The existing return policy uses 0.85 once: 25 × 0.85 = 21.25 kg per side. With the fixture's available weights, downward rounding selects 20 kg. The rehearsal limit is min(5, 6, 12) = 5 reps. The working-load value remains null: those six historical reps do not establish a 12-rep working weight.

The 0.85 return factor is an existing conservative product rule, not a research-proven individual capacity prediction. Correct arithmetic does not establish that a reference weight is comfortable or safe for a particular user. The UI explicitly says to reduce difficulty if it does not feel easy.

Regression coverage includes per-side loads, kg/lb conversions, assistance direction, sparse equipment rounding, no compounded return reductions, adverse/incomplete history, both tracks/phases, and preservation of recorded data.

## Security sources

- https://github.com/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/advisories/GHSA-p3m5-59mp-jv5r
- https://github.com/advisories/GHSA-673q-mjm6-r5xr

The existing development-only braces advisory remains locally mitigated with integrity checks and the November 20, 2026 review deadline; this release does not remove or broaden that exception. The full audit must not be described as zero upstream alerts.

## Verification

- Focused guidance, history and arithmetic suite: 46/46 passed.
- Browser inspection of the actual rendered component with synthetic data: dark 390px and light 320px constrained layouts; optional warm-up opens separately without replacing the working target. This is not an authenticated physical-phone test.
- Full release verification passed: 297/297 tests, 37 isolated PostgreSQL checks, lint, static security scan, Vinext build, Next.js production build and TypeScript. Isolated database tests are not a live-account penetration test.
- Production dependency audit: zero alerts. Full dependency gate: no unmitigated alerts; the previously documented braces advisory remains visible and locally mitigated.
- Local build emitted non-blocking bundle-size and preview HMR-port warnings. The preview was stopped after inspection; no functional test or build failed in the final verification run.
- Publication is verified separately against the exact commit and service-worker build ID; no user data migration is required.
