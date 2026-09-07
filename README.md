# RepArc

An offline-first workout log built on published research and an adaptation of the SBS program, with account-owned cloud synchronization, tested backup handling, and a focused mobile training workflow. Internal testing does not replace independent security, device or coaching review.

## Product capabilities

- Foundation training and RepArc adaptations of three-, four-, or five-day SBS Hypertrophy programming, with direct attribution and no claimed endorsement
- Editable, soft-deleted, revisioned workout history
- Independent histories and training maxes for substitutions
- Deterministic set-by-set and next-session load guidance with readiness, completion, RIR-coverage, and confidence guardrails; suggestions are always user-approved
- Compact in-app daily reports covering adherence, repetitions, external-load volume, effort, duration, performance signals, and expandable next-session guidance
- Pause/resume calibration and explicit Phase 2 review
- Rolling bodyweight trends with cut, maintain, and bulk context
- IndexedDB-first offline logging with a coalesced newest-snapshot outbox
- Atomic server revisions with automatic merge-and-retry protection when the same account edits on two devices
- Passwordless Supabase accounts with HTTP-only cookie sessions and RLS ownership
- Same-origin mutation checks, strict JSON/body limits, and durable per-account write throttling
- JSON restore preview with merge or authoritative replacement and an automatic rollback download
- Installable PWA with user-approved updates, persistent rest timers, service-worker notifications where the platform permits, and configurable foreground alert strength
- Focused exercise sequencing that requires visible load and repetition entries before forward navigation
- Inline exercise swaps; a top Training notices panel for readiness, recovery, calibration and starting-load guidance, with important warnings kept beside the workout
- One-time equipment-load setup per exercise, editable from Setup → Available loads; failed saves retain the editor and entered values
- System, light, and dark appearance modes
- Keyboard skip navigation, persistent focus indicators, labelled inputs, and enlarged touch controls
- Opt-in minimal diagnostics and private beta feedback with no workout data attached automatically
- One-time introduction before setup, replayable in Guide
- Separate, default-off recommendation evaluation consent, withdrawal and data export
- Structured exercise metadata and a collapsed weekly direct/indirect muscle-set audit
- Three-way cloud reconciliation without device-clock precedence and an exportable latest conflict copy
- Verified account-owned history chunks beyond the single-row limit (32 MB total; existing record-count limits still apply)
- Per-response script nonces in the production Next.js runtime

## Security model

Cloud ownership comes exclusively from the server-verified Supabase user and `auth.uid()` policies. Profile labels are local display values and never authorize data access. Authentication tokens are not stored in localStorage or IndexedDB. Mutating APIs reject cross-site requests, oversized payloads, and excessive account activity before changing records. Device-local workout data remains readable to software with access to the browser profile and should not be treated as encrypted at rest.

## Deployment

Complete `AUTH-SETUP.md`, then follow `NETLIFY.md`. For version 11, follow `RELEASE-11.md` **before deploying**. The required runtime values are `SUPABASE_URL` and `SUPABASE_ANON_KEY`; never commit their values.

## Local verification

Requirements: Node.js 22.13 or newer.

```text
npm ci
npm run lint
npm run build:netlify
npm test
npm run security:database
npm audit --omit=dev
```

The `npm run dev`, `npm run build`, and `npm run lint` scripts are cross-platform and work from Windows Command Prompt, PowerShell, macOS, and Linux.

## Data compatibility

Training data uses schema version 9. Version 11 adds optional recommendation/muscle-metadata provenance without relabeling historical sessions. Versions 2–8 remain migratable, and raw v2–v9 or versioned account-era JSON backups are accepted after validation. Larger records use SHA-256-verified archive chunks. Limits remain 32 MB of serialized history, 5,000 sessions, 5,000 session revisions, 10,000 recovery checks and 2,000 time-away/plan records. This is a bounded archive path, not unlimited storage. The first authenticated load on an existing device migrates its earlier profile into an account-scoped IndexedDB record.
