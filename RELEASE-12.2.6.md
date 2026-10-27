# RepArc 12.2.6

Completed Phase 2 weeks now show saved-workout status and an expanded Start next week control instead of reopening an empty Day 1. Existing dates, entries and program weeks are preserved; advancing remains explicit.

## Fixes
- Completed day buttons show a check and offer the saved session for review. Existing unsaved drafts remain accessible.
- Refresh the schedule after midnight/resume without moving an unfinished workout or historical/make-up edit.
- Refresh cloud data on return to the app. Ignore delayed reads after typing or saving, block overlapping saves, and retain pending/error feedback rather than replacing it with a generic success message.
- Explain the existing 48-hour recovery wait with a countdown. Problem reporting remains available before that interval ends; background sync no longer disables recovery choices.
- Allow equipment alternatives for Phase 2 auxiliary lifts, including Hack squat to Linear leg press. The replacement has separate load history and calibrated rep-range sets, without the original lift's training max or AMRAP progression. Main lifts retain their lock and explain the skip option. Saved exercise names are not automatically rewritten.
- Patch zod, fast-uri, undici, satori and fflate dependency alerts.

## Verification
- 303 automated tests passed, including new completed-week, midnight, stale-read, recovery-boundary and substitute-history regressions.
- Lint and Netlify production build (including TypeScript) passed.
- Production dependency audit: zero alerts; full audit: no unmitigated alerts.
- 37 isolated PostgreSQL security checks passed. These do not substitute for a live two-account RLS test.
- Mobile browser with synthetic data: completed-week screen, explicit week advance, Hack squat substitution, partial save and reload preserving Linear leg press entries.

## Limits
The reported cloud failure was not reproduced in the inspected live session. The inspected recent workouts were present. These safeguards address confirmed navigation and save/read-race risks; they do not establish that every intermittent network failure has been eliminated. No user's historical entries or program week were changed during verification.

Auxiliary substitution is an application adaptation, not a claim that machines have interchangeable resistance or identical training effects. Existing calibration and recovery limits continue to apply.
