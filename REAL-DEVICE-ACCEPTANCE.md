# RepArc real-device acceptance record

Complete this record on physical hardware before every public release. Automated responsive checks do not replace these tests.

| Device | OS | Browser / installed PWA | Tester | Date | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| iPhone |  | Safari and Home Screen |  |  |  |  |
| iPad |  | Safari and Home Screen |  |  |  |  |
| Android phone |  | Chrome and installed PWA |  |  |  |  |
| Windows laptop/desktop |  | Chrome or Edge and installed PWA |  |  |  |  |

For each device verify: first registration and every mandatory onboarding field; returning OTP; input fields do not zoom the page; guide tabs auto-scroll; training entry, rest timer and completion; airplane-mode launch and logging; reconnect sync; update prompt without sign-out; JSON/CSV export; restore preview and rollback download; keyboard and reduced-motion behavior where supported; and account deletion.

Use two distinct accounts on two devices to verify RLS isolation. Use one account on two devices to verify newest-state synchronization. Record failures with reproduction steps and do not sign off until corrected and retested.
