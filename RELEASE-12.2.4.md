# RepArc 12.2.4 — tooling security and release safeguards

- Upgrade Vite 8.2.2 to the compatible security patch 8.2.4 for the launch-editor advisories (including Windows command injection).
- Apply deterministic, source-hash-checked nesting limits to development-only braces 3.0.3 after installation. Cover parsing braces/parentheses and direct compile/expand/stringify AST calls. Reject unexpected upstream source/version changes; verify installed protection before audit/build publication.
- Upstream GHSA-vfj7-8cjw-p6xm has **no published patched version**. Standard npm/GitHub scanners will still flag this package and its dependency chain. This is a locally mitigated advisory, not a zero-alert full audit. A narrowly scoped development-only exception expires November 20, 2026; new advisories, production exposure, changed packages, missing patches, failed audit requests and expired review all block release.
- Audit production and development dependencies on every change, before Netlify builds, and daily in GitHub Actions. Dependabot now checks npm daily, including grouped development patches. Updates require review/testing; no automatic merge.
- Netlify runs the historical-record/sync regression suite before publication. This protects the v12.2.3 fix for older completion labels and deletion markers blocking whole-profile sync. Existing pending data stays local until the server acknowledges a successful save.
- No training calculations, workout records, user settings or database schemas changed.

## Why it appeared

The sync failure came from treating current workout-completion rules as upload-validity rules for old records. The old label could disagree with current counting, rejecting the entire upload. The v12.2.3 regression cases now run as an explicit deployment gate.

Dependency alerts are separate: advisory information changes over time, and the prior automated audit intentionally omitted development dependencies. The new gate covers both. No safeguard can prevent all future defects or vulnerabilities.

## Sources and maintenance

- https://github.com/advisories/GHSA-587h-7wmj-h5pm
- https://github.com/advisories/GHSA-698v-4r3x-3vcv
- https://github.com/advisories/GHSA-r825-w8mm-5pxw
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/micromatch/braces/issues/70

Review the temporary mitigation before 2026-11-20. Prefer an official fixed version when available, then remove the patch and exception together. Do not rename the dependency, blindly downgrade the framework, or dismiss the upstream warning to obtain a green audit.

## Verification

- Clean `npm ci` reapplied the mitigation successfully.
- Six security regression tests verify bounded recursion, ordinary glob compatibility, patch integrity, strict advisory scoping and expiry.
- Full local suite exercised 294 cases: 293 passed initially; the remaining assertion expected the old production-only audit command. It was strengthened to check the new full audit and Netlify sync gate; all five tests in that file passed on rerun.
- Vinext and Next production builds, TypeScript, lint and static security scan passed; isolated PostgreSQL suite passed all 37 checks. These are isolated fixtures, not a live-account penetration test.
- Production dependency audit reports zero alerts. Full audit reports only the one locally mitigated upstream advisory (eight affected dependency nodes).
