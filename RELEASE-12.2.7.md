# RepArc 12.2.7 — resume interrupted cloud saves

- Saves remain in the durable local queue if the app is hidden during upload or response download. Background suspension is shown as queued, not an internet failure.
- Returning to the app retries queued writes even with an unfinished workout or historical edit open. Clean active forms still avoid automatic remote-plan refreshes. A queued upload also defers a conflicting remote profile/program/swap change until the current workout is finished or closed.
- A short retry after the local save finishes covers a foreground event arriving while the save lock was held. Further transient failures use the existing periodic retry. Authentication, validation, rate-limit, archive and required-update errors remain visible and are not immediately retried automatically.
- Response-body download now remains covered by cancellation and timeout. Only a verified server revision clears pending; an interrupted acknowledgement is reconciled on retry.
- Training prescriptions and calculations are unchanged. Real iPhone screen-lock behavior still needs a device acceptance check; automated tests simulate visibility changes, request cancellation, hidden saves and interrupted acknowledgements.

Reference: https://developer.chrome.com/docs/web-platform/page-lifecycle-api

Validation: 307/307 full regression tests passed; final focused sync suite 21/21 passed (including the added active-plan conflict case); lint, TypeScript, production build, dependency/static security checks and 37 isolated PostgreSQL checks passed. These database checks are local isolation tests, not a fresh live RLS audit.
