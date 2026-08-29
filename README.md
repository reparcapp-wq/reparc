# RepArc

A secure, offline-first workout log with evidence-aligned progression, account-owned cloud synchronization, validated backups, and a focused mobile training workflow.

## Product capabilities

- Foundation and official three-, four-, or five-day SBS Hypertrophy programming
- Editable, soft-deleted, revisioned workout history
- Independent histories and training maxes for substitutions
- Pause/resume calibration and explicit Phase 2 review
- Rolling bodyweight trends with cut, maintain, and bulk context
- IndexedDB-first offline logging with a coalesced newest-snapshot outbox
- Passwordless Supabase accounts with HTTP-only cookie sessions and RLS ownership
- JSON restore preview with merge or authoritative replacement and an automatic rollback download
- Installable PWA with user-approved updates
- Keyboard skip navigation, persistent focus indicators, labelled inputs, and enlarged touch controls
- Opt-in minimal diagnostics and private beta feedback with no workout data attached automatically

## Security model

Cloud ownership comes exclusively from the server-verified Supabase user and `auth.uid()` policies. Profile labels are local display values and never authorize data access. Authentication tokens are not stored in localStorage or IndexedDB. Device-local workout data remains readable to software with access to the browser profile and should not be treated as encrypted at rest.

## Deployment

Complete `AUTH-SETUP.md`, then follow `NETLIFY.md`. The required runtime values are `SUPABASE_URL` and `SUPABASE_ANON_KEY`; never commit their values.

## Local verification

Requirements: Node.js 22.13 or newer.

```text
npm ci
npm run lint
npm run build:netlify
npm test
npm audit --omit=dev
```

The `npm run dev`, `npm run build`, and `npm run lint` scripts are cross-platform and work from Windows Command Prompt, PowerShell, macOS, and Linux.

## Data compatibility

Training data remains schema version 5. Version 6 changes account ownership and application behavior rather than the workout schema. Raw v2-v5 and versioned v6 JSON backups are accepted. The first authenticated load on an existing device migrates its v5 profile into an account-scoped IndexedDB record and uploads it to the authenticated cloud row.
