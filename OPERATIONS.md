# RepArc operations

## Release gate

Use Node 22. From a clean checkout run `npm ci`, `npm run lint`, `npm test`, `npm run build:netlify`, and `npm audit --omit=dev --audit-level=high`. Deploy only if every command succeeds. Confirm `/`, `/privacy`, `/terms`, passwordless sign-in, offline launch, queued workout synchronization, backup export/restore, account deletion, and the update prompt on the production URL.

The package version is the single release source. Next.js and Vinext inject it as `NEXT_PUBLIC_APP_RELEASE`, so diagnostics and feedback cannot drift from the deployed package.

## Database migrations

Apply SQL files in filename order. Run `supabase/v7-account-lifecycle.sql` after `v6-account-security.sql`, then `supabase/v8-production-hardening.sql`. Verify RLS remains enabled, anonymous grants remain revoked, `delete_current_user()` is executable only by `authenticated`, and the `reparc-support-data-retention` cron job is active. Its daily job removes feedback older than 180 days and optional diagnostics older than 30 days; review `cron.job_run_details` after deployment and after any database upgrade.

Before any destructive maintenance, record the exact Supabase project reference and read-only row counts. Never drop RepArc tables for a user reset. Delete the verified auth user and let foreign-key cascades remove account-owned rows; clear `public.kv` only during an explicitly authorized full legacy reset. Re-run counts afterward.

## Backup and restore

Before migrations or bulk changes, create a Supabase backup appropriate to the active plan and verify its timestamp. At least quarterly, restore a backup into a separate non-production project and validate user authentication, training-profile JSON, session history and RLS isolation. A backup that has never been restored is unverified.

If the hosted database plan does not provide point-in-time recovery, schedule encrypted logical exports to a separate provider account and document retention. Do not store database exports in the public repository or app bundle.

## Email and domain

Production authentication mail should use a transactional provider or the dedicated `reparcapp@gmail.com` mailbox with a Google App Password—not the normal Google password. The visible From address, SMTP username and authenticated mailbox must agree. For a custom domain, configure and verify SPF, DKIM and DMARC before switching production traffic. Keep Supabase Site URL and redirect allow-list synchronized with every live hostname.

Before public launch, configure Cloudflare Turnstile on the live hostname, set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Netlify, enable the matching Turnstile secret in Supabase Auth Bot and Abuse Protection, then test both a valid challenge and an expired challenge. Keep email OTP expiry at 3,600 seconds or less and review Auth rate limits against observed legitimate traffic.

## Acceptance matrix

For each release test current Safari on iPhone/iPad, Chrome on Android, Chrome or Edge on Windows, and one desktop Safari/Chrome path. Check first registration and mandatory setup, returning OTP, installed PWA update, airplane-mode logging, reconnect synchronization, numeric-input zoom, rest timer, keyboard navigation, reduced motion, export/restore, and account deletion. Record device, OS/browser version, date and result.

## Incident response

For data exposure or ownership concerns, stop deployment, preserve logs, disable the affected route if necessary, and verify RLS with two separate test accounts. Rotate leaked credentials in Supabase/Netlify/email provider, redeploy, invalidate sessions where appropriate, and document scope and recovery. Never paste service-role keys or SMTP passwords into source, issue trackers or diagnostic feedback.
