# RepArc 11 implementation record

Scope approved: 7 September 2026. Existing logs must remain recoverable. This record distinguishes implemented behavior from tests and external acceptance.

## Build and fix checklist

- [x] One-time overview before profile setup; replay from Guide.
- [x] Separate, default-off improvement participation, server-enforced consent, withdrawal in Setup.
- [x] Explicit retention, deletion, export, restricted access and audit records for the improvement dataset.
- [x] Recommendation version and actual-versus-prescribed records; no automatic production-rule changes.
- [x] Updated Privacy/Terms and versioned acknowledgment for existing accounts.
- [x] Structured exercise/loading/equipment/muscle metadata, preserving exact history identity.
- [x] Weekly muscle set audit with direct/indirect work separated and honest uncertainty.
- [x] Device-clock-independent synchronization using last synchronized state and server revisions.
- [x] Durable archive path beyond the main profile limit, preserving reports and backups within documented limits.
- [x] Nonce-based script Content Security Policy; production hydration and cached header/nonce compatibility tested. Full authenticated offline device acceptance remains below.

## Verification gates

- [x] Regression tests, types, lint, production build and production dependency/static security checks.
- [x] Live two-identity database isolation, archive revision checks, grants and withdrawal (transactional test, rolled back).
- [ ] Two-account HTTP/JWT authentication workflow (`security:rls`); database role simulation is not an end-to-end login test.
- [ ] Authenticated end-to-end acceptance.
- [ ] Physical iPhone, Android and Windows acceptance (requires testers on those devices).
- [ ] Provider-backup recovery rehearsal in an isolated restore target.
- [ ] Independent qualified strength-coach review.

## Decisions

- Product evaluation is opt-in, with no historical collection before consent. Withdrawal stops collection and deletes identifiable evaluation records; ordinary training history is separate.
- Evaluation uses allowlisted structured fields, no email/name or free-text medical notes. An account-linked random identifier is pseudonymous, not anonymous.
- Raw evaluation retention: 180 days. Consent/access audit retention: 365 days, erased with account deletion. Published anonymous aggregates cannot necessarily be removed; none are generated automatically in this release.
- Any rule change requires a documented hypothesis, held-out-user evaluation, subgroup/sample-size reporting, regression checks and human review. Observational logs and subjective RIR are not clinical validation.
- Existing Netlify/Supabase architecture is retained. The legacy Sites project returns 404; no replacement site or database will be created.

## Current progress

Repository clean at start (10.5.1). Local implementation targets 11.0.0. User explicitly approved the live additive migrations; both executed successfully in Supabase. No existing accounts or workout rows were deleted or rewritten. Application publishing is not yet completed.

## Verification evidence

- Full suite: 127/127 passed. After the final day-classification cleanup, targeted training/migration suite: 37/37 passed.
- Isolated PostgreSQL: 37 checks passed (owner separation, grants, withdrawal, account cascades, retention, archive CAS/integrity and malformed inputs). The live-policy SQL also passed against this fixture.
- The same policy script subsequently passed on the live Supabase project: `PASS: live owner isolation, archive CAS, grants and withdrawal; synthetic changes rolled back`. No real user's identity was impersonated and no synthetic users/rows were retained.
- Next.js production build and TypeScript passed; lint passed; static security scan passed; production dependency audit reported zero known vulnerabilities.
- Browser: 390px overview, transition into mandatory setup, light-mode default-unchecked optional consent, collapsed weekly audit and expandable counts checked. These used synthetic local fixtures, not live personal training data.
- Production Next.js sign-in hydrated with no console errors. All 12 script elements carried the response nonce; separate requests received different nonces. Service-worker regression retained the original CSP/nonce pair while offline.
- Historical identity regression compares against 10.5.1 across every program, track, frequency, equipment setting and alternative. Original logs are not assigned invented recommendation versions.
- Limits, sampling-window caveats, latest-conflict-copy behavior and rollback restrictions are documented in RELEASE-11.md. Passing tests are evidence of tested behavior, not a guarantee of no defects or clinical validity.
