# RepArc 10.5.0: unfamiliar-exercise policy and external feedback review

Reviewed 6 September 2026. This document distinguishes code checks, research support and outstanding validation. It is not a coach or security sign-off.

## Research conclusions

Gradual re-exposure is a defensible direction for every experience level. In a 20-study review, repeat bouts produced lower soreness and muscle-damage markers than first bouts, with standardized differences of 0.51–1.23 at 24–48 hours. This is population evidence for familiarization, not proof that RepArc's exact dose prevents DOMS. [Doma et al., 2023](https://pubmed.ncbi.nlm.nih.gov/38015738/)

RIR is useful but uncertain. A meta-analysis covering 414 participants found about one repetition of average underprediction, with very high between-study heterogeneity. RepArc must not turn a subjective estimate into a claim of precise individualized safety. [Halperin et al., 2022](https://pubmed.ncbi.nlm.nih.gov/34542869/)

Related training can offer partial familiarity, but different equipment and movements are not interchangeable strength tests. Specificity is a reason to retain exact exercise identity for kilograms and training maxes. [Machine versus free-weight training review](https://pubmed.ncbi.nlm.nih.gov/37582807/)

The external reviewer is right to prioritize volume as well as load. Their exact proposals (1–2 sets, 3–4 RIR, ten novel sets, numerical state transitions and break cutoffs) are constructed safeguards. Neither a blanket compound-exercise risk multiplier nor a universal ten-set safety threshold is established by those claims. RepArc uses a conservative movement-family registry; its more cautious groups are engineering categories, not measured injury probabilities.

## Implemented policy v1

- One exact identity (`loadProfileId`) serves exercise history and familiarity state. A separate explicit name registry grants related-movement credit only; it never transfers weights. Unknown names receive conservative treatment and no cross-exercise credit.
- New or recalibrating exercises: one working set, at least 4 RIR. With at least two related exposure dates in the prior 42 days, a movement outside the more cautious group may use two sets at 3 RIR. Rehearsal sets are excluded.
- Preliminary: up to two working sets, at least 3 RIR. Developing: up to 75% of programmed sets rounded up, at least 2 RIR. Established: normal program volume. Normal program volume remains subject to return restrictions and the current recovery check.
- A qualifying exposure has all prescribed sets, valid values, repetitions in the exercise's range, recorded RIR from max(2, target−2) through target+2, no unsafe readiness/adverse recovery, and normal or mild/improving recovery recorded at least 48 hours after completion.
- One qualifying exposure earns Preliminary, two earn Developing, three earn Established. Consecutive qualifying dates must fit within 42 days; unsuccessful or unreviewed exposures interrupt the promotion streak. Same-day duplicates count once. Only the preceding 56 days are used in the replay, with prior state retained from versioned exposure snapshots where appropriate.
- A 28–55-day exercise gap caps Established at Developing. A gap of 56 days or more, an unintended near-failure calibration set, or movement-limiting/unusual recovery triggers recalibration. Break handling is applied between historical exposures as well as relative to today, preventing a single unchecked return session from restoring Established status.
- Missing recovery holds automatic load increases, state promotion and volume expansion. An early green response remains pending. Adverse responses are retained even if a later recovery check is green.
- Legacy full exercise histories are credited: one/two/three recent complete exposures seed Preliminary/Developing/Established. Known non-SBS failure or adverse readiness is not credited as successful tolerance. Partial legacy work is kept and may seed Preliminary, without receiving Established status.
- A default budget of six unfamiliar set-equivalents per session and four per primary muscle limits work. Related non-cautious sets count 0.5, others 1. Allocation prioritizes least-exposed movements so later exercises are not indefinitely deferred. The UI names held exercises and offers a deliberate reduced-volume override. These budgets are policy limits, not physiological thresholds.
- Current drafts preserve their plan after entry begins, including across reloads. Unfinished legacy drafts preserve entered sets. Swaps remain available before entering that exercise's values; an unfamiliar mid-workout swap requires deliberate confirmation and cannot increase that slot's set count.
- Return and unfamiliarity set restrictions combine with `min`, rather than successive percentage cuts. Return loads select an available load at or below the target. Explicit pause duration now participates in return-mode planning.
- Phase 2 retains mandatory exercise-specific training maxes. Unestablished or recovery-pending lifts use progression-neutral, reduced calibration sets at the exercise's lower rep target, without AMRAP. An eligible established lift in the same session can progress unless the whole session is in return/calibration mode.
- The existing equipment-step and 10% maximum increase safeguard remains. Automatic increases are held during familiarization; comfortable self-selected loads are permitted and recorded as user input, never as validated strength.
- Exposure prescriptions, suggested loads when present and recovery stay with the user's training history and JSON backup. They are not anonymous product telemetry and do not expire under the separate 30-day diagnostics policy. Any future aggregate research/evaluation use needs a defined consent, retention and analysis protocol. Logged RIR is still subjective, so target deviation alone cannot establish prediction accuracy.

## External feedback: checked status

| Claim | Result |
| --- | --- |
| Bad demographic starting-load formula removed, first-exposure volume missing | Correct at 10.4.1. This release supplies the exercise-specific ramp. |
| Percentage increment cap missing | Already implemented for autoregulation before this change. |
| Phase 2 calibration absent | Partly implemented globally before this change; now per exercise and progression neutral. |
| Exercise loading taxonomy still inferred | Still partly true. Existing loading/equipment fields and snapshots remain, but the underlying resolver uses names/regex. The new familiarity registry does not close the full loading-taxonomy audit. |
| Goal emphasis uses first matching name and lacks a weekly muscle audit | Still true; not closed by this release. |
| Client clocks can dominate merge decisions | Reproduced with a future timestamp. Server revision checks prevent stale writes but do not solve the client conflict-selection policy. A revision-aware metadata merge remains open. |
| Roughly four years before storage cap | Unsupported. The API cap is 900,000 bytes; representative pre-change sessions were around 2.4–3.0 KB, implying roughly 67 weeks at five sessions/week before revisions and new metadata. This is illustrative, not a forecast. Archival remains needed. |
| Legacy bodyweight is unavailable | Partly true. Prior dated weigh-ins can supply it; without an appropriate record, the app currently falls back to profile bodyweight, so historical effective-load estimates have uncertainty. |
| CSP still permits inline content | True. It weakens defense in depth; it is not evidence of a specific exploit. Nonce-based hardening remains open. |
| Live two-account RLS never ran | No recorded run was found; the GitHub workflow had zero runs. The test script exists, but the required Supabase service-role credential is unavailable in this environment. This release cannot claim a successful live RLS test. |
| Backup restore untested | Automated app JSON round-trip/restore tests exist. A provider-backup restore rehearsal is a separate, unrecorded check. |
| Authenticated E2E / physical devices / independent program review | No recorded completed acceptance/sign-off found. These remain open. |
| Turnstile disabled | Conditional implementation exists; no challenge was observed in the live HTML. Current Supabase/dashboard configuration could not be verified from this audit. |
| PWA requires a native wrapper for alarms | Incomplete phrasing: iOS Home Screen PWAs support online Web Push. Reliable native-style local alarms require native scheduling/permissions, not a wrapper alone. Dynamic Island integration is native work. |
| Test passes certify the whole app | Incorrect. A pass supports the tested behavior on that source/environment. Separate agent review adds another code-review method, not independent real-world or clinical validation. |
| A coach review closes the largest remaining exposure | A qualified review is valuable but cannot guarantee no defects or outcomes. PROGRAM-REVIEW.md remains unsigned. |
| Shared OTP and Gmail app password | An exposed still-valid OTP should not be used. Do not share future codes. Rotate a Gmail app password if it was exposed or access is uncertain; this audit did not inspect or rotate private credentials. |

Useful platform sources: [Apple Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple AlarmKit](https://developer.apple.com/videos/play/wwdc2025/230/), [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy).

The app should be described as built on published research and an adaptation of SBS, with internally tested safeguards. “Fully secured,” “clinically validated,” and guaranteed personalized accuracy remain unsupported claims.

## Verification record

The release passed 106 automated tests, including 15 unfamiliar-exercise/state/snapshot/report regressions; the Netlify production build; lint; the static security scan; and the dependency audit (zero reported vulnerabilities). A separate agent performed a read-only code review and identified snapshot, swap, recovery and return-state issues that were corrected before this release. These checks establish tested software behavior, not independent program efficacy.

The live RLS command could not start because Supabase test credentials were absent. The GitHub repository also had no configured Actions secrets for that workflow. No test accounts or user data were created, altered or deleted by that attempted check. Physical-device acceptance, authenticated end-to-end testing and coach sign-off remain unrecorded.
