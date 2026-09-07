# RepArc 11 rollout

Do not publish the application before applying its additive database migrations. No existing workout rows or accounts should be deleted for this upgrade.

## Database first

1. Open the Supabase SQL Editor for RepArc project `eeasgcrzakvssowzxtbf`.
2. Run `supabase/v11-improvement-consent.sql`, then `supabase/v11-training-archive.sql`. These assume v6–v10 are already installed. The new policies restrict each user to their own records; improvement participation defaults off.
3. Confirm both statements finish successfully. If either fails, stop and preserve the error; do not deploy. Do not send service-role keys, passwords or tokens in chat.
4. Run the existing protected RLS security workflow with its configured Supabase secrets. `npm run security:rls` now covers the new tables and RPCs using two temporary test accounts, and removes those accounts afterward. This is separate from `npm run security:database`, which uses isolated PostgreSQL and synthetic identities, not the live project.

## Application release

After migration and live database isolation pass, run lint, tests, `security:database`, `security:static`, production dependency audit and `build:netlify`. Then commit/push through the existing GitHub → Netlify pipeline with publication approval. Inspect the published release and errors before announcing completion. A passing transactional policy check is not a substitute for the separate HTTP/JWT sign-in workflow.

Test a new account through overview → required setup → optional sharing. Test an existing account's new Terms/Privacy acknowledgment. Rejecting sharing must not change training. Confirm withdrawal removes evaluation records while preserving personal history. Do not opt a real user into evaluation on their behalf.

Use two test devices/accounts to exercise offline edits, reconnect, a same-item conflict and recovery export. Verify an archive above 600 KB still loads all sessions and exports/restores correctly. Check new records on account A never appear for account B.

## Limits and remaining acceptance

- 32 MB total cloud history and existing record-count limits remain; staging space is bounded. Failed/incomplete uploads leave local data pending and do not publish an incomplete archive.
- The latest device conflict copy is recoverable from Setup → Restore backup. A subsequent conflict can replace that copy; export it promptly. This is not a provider-backup system.
- CSP removes `unsafe-inline` and `unsafe-eval` from production scripts. Inline styles remain allowed for existing component/chart styles. Cached app-shell responses preserve their original nonce/header pair; authenticated offline acceptance still requires device testing.
- Improvement collection is best-effort and currently evaluates the latest five eligible sessions on each successful save. It excludes pre-consent sessions and sessions without recommendation provenance. It is not a complete clinical/research registry; disclose missingness and this sampling window in analysis. Withdrawal is server-confirmed, not inferred from an offline screen.
- Frozen historical snapshots retain their recorded loading meaning. Legacy muscle attribution uses current metadata and is labeled as inferred. Weekly set counts are descriptive, not a growth/safety score. The 18-direct-set optional-emphasis cap is an engineering guardrail, not a universal research threshold.
- Still external: physical iOS/Android acceptance, full authenticated E2E, provider-backup restore in an isolated target, independent qualified strength-coach review. Automated passing checks cannot certify these.

## Recovery

Keep the additive migrations if a frontend rollback is required. After an account has archived history, versions before 11 cannot read it: the API returns an update-required response rather than an empty history. **Do not roll the API back to v10 after archives exist**, because old code cannot interpret the manifest. Roll forward with a fix, or rehearse an explicit archive-to-row restoration in an isolated environment first. Never remove archive tables or restore a production database merely to test rollback.
