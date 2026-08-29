# One-time Supabase account setup for v6

Complete these steps before deploying v6.

## 1. Create the account-owned tables

1. Open the Supabase project used by RepArc.
2. Open **SQL Editor** and create a new query.
3. Paste the complete contents of `supabase/v6-account-security.sql`.
4. Run the query once.

The migration creates `training_profiles`, `beta_feedback`, and `diagnostic_events`, enables Row Level Security, revokes anonymous access, and limits inserts/updates to `auth.uid()`.

## 2. Configure authentication URLs

Open **Authentication → URL Configuration**.

- Set **Site URL** to `https://reparc.netlify.app`
- Add `https://reparc.netlify.app/auth/confirm` to **Redirect URLs**
- For local testing, optionally add `http://localhost:3000/auth/confirm`

Do not use a broad production wildcard.

## 3. Configure the Magic Link email

Open **Authentication → Email Templates → Magic Link** and use a template that provides both the link and the code:

```html
<h2>Sign in to RepArc</h2>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in to RepArc</a></p>
<p>Or return to the installed app and enter this one-time code:</p>
<h1>{{ .Token }}</h1>
<p>This link and code expire automatically. Ignore this email if you did not request it.</p>
```

Email authentication and automatic user creation must be enabled. Supabase rate-limits repeated requests by default.

## 4. Verify before deleting legacy configuration

1. Deploy v6.
2. Sign in on the device containing the current v5 data.
3. Wait for **Cloud saved**.
4. Sign in with the same email in a different browser and confirm the history appears.
5. Test offline logging and reconnect synchronization.

Keep the old `kv` table and `TRAINING_SYNC_KEY` during this verification window. They are not accessible through the v6 app and provide a rollback path. Remove them only after all intended accounts have migrated and backups have been checked.
