# RepArc operations

## Release gate

Use Node 22. From a clean checkout run `npm ci`, `npm run lint`, `npm test`, `npm run build:netlify`, and `npm audit --omit=dev --audit-level=high`. Deploy only if every command succeeds. Confirm `/`, `/privacy`, `/terms`, passwordless sign-in, offline launch, queued workout synchronization, backup export/restore, account deletion, and the update prompt on the production URL.

The package version is the single release source. Next.js and Vinext inject it as `NEXT_PUBLIC_APP_RELEASE`, so diagnostics and feedback cannot drift from the deployed package.

## Database migrations

Apply SQL files in filename order through `supabase/v9-api-security.sql`. Verify RLS remains enabled, anonymous grants remain revoked, `delete_current_user()` and `consume_api_rate_limit(text)` are executable only by `authenticated`, the rate-limit table has no Data API grants, and the `reparc-support-data-retention` cron job is active. Its daily job removes feedback older than 180 days, optional diagnostics older than 30 days, and inactive rate counters after 2 days; review `cron.job_run_details` after deployment and after any database upgrade.

Review aggregate abuse signals without reading workout data:

```sql
select action, sum(blocked_count) as blocked_requests, max(last_blocked_at) as latest_block
from public.api_rate_limits
where last_blocked_at > now() - interval '7 days'
group by action
order by blocked_requests desc;
```

After the migration, run `npm run security:rls` from a protected administrative environment or dispatch the **Live Supabase authorization test** workflow. Store `SUPABASE_SERVICE_ROLE_KEY` only as a masked GitHub Actions secret; never expose it to Netlify, browser code, logs, or pull requests. The test creates two temporary confirmed accounts, proves cross-account reads and mutations are blocked, verifies rate-limit privacy, and deletes both accounts in cleanup.

Before any destructive maintenance, record the exact Supabase project reference and read-only row counts. Never drop RepArc tables for a user reset. Delete the verified auth user and let foreign-key cascades remove account-owned rows; clear `public.kv` only during an explicitly authorized full legacy reset. Re-run counts afterward.

## Backup and restore

Before migrations or bulk changes, create a Supabase backup appropriate to the active plan and verify its timestamp. At least quarterly, restore a backup into a separate non-production project and validate user authentication, training-profile JSON, session history and RLS isolation. A backup that has never been restored is unverified.

If the hosted database plan does not provide point-in-time recovery, schedule encrypted logical exports to a separate provider account and document retention. Do not store database exports in the public repository or app bundle.

Record a quarterly restore result with the source backup timestamp, isolated destination project, tester, result, and cleanup date. Rotate Supabase secret keys immediately after suspected exposure and at least annually as an operational rehearsal; rotate SMTP app passwords and Turnstile secrets after exposure or administrator turnover. Redeploy after rotation and invalidate active sessions when authentication keys change.

## Email and domain

Production authentication mail should use a transactional provider or the dedicated `reparcapp@gmail.com` mailbox with a Google App Password—not the normal Google password. The visible From address, SMTP username and authenticated mailbox must agree. For a custom domain, configure and verify SPF, DKIM and DMARC before switching production traffic. Keep Supabase Site URL and redirect allow-list synchronized with every live hostname.

Before public launch, configure Cloudflare Turnstile on the live hostname, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Netlify, enable the matching Turnstile secret in Supabase Auth Bot and Abuse Protection, then test both a valid challenge and an expired challenge. Keep email OTP expiry at 3,600 seconds or less and review Auth rate limits against observed legitimate traffic.

## Acceptance matrix

For each release test current Safari on iPhone/iPad, Chrome on Android, Chrome or Edge on Windows, and one desktop Safari/Chrome path. Check first registration and mandatory setup, returning OTP, installed PWA update, airplane-mode logging, reconnect synchronization, numeric-input zoom, rest timer, keyboard navigation, reduced motion, export/restore, and account deletion. Record device, OS/browser version, date and result.

## Incident response

For data exposure or ownership concerns, stop deployment, preserve logs, disable the affected route if necessary, and verify RLS with two separate test accounts. Rotate leaked credentials in Supabase/Netlify/email provider, redeploy, invalidate sessions where appropriate, and document scope and recovery. Never paste service-role keys or SMTP passwords into source, issue trackers or diagnostic feedback.

## Repository protection

Scheduled secret/insecure-code scans, dependency audits, pinned workflow actions, and Dependabot configuration are stored in the repository. Dependabot vulnerability alerts, malware alerts, grouped security updates, and version updates should remain enabled. GitHub CodeQL and native secret scanning require a plan that supports them for a private repository; enable those native controls if the repository becomes public or the account plan changes. Protect `main` with pull requests and require the Verify RepArc and Security regression scan checks before merge when more than one maintainer is working on the app.
