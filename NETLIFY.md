# Netlify deployment

RepArc is a server-rendered Next.js app with Supabase passwordless accounts. Complete `AUTH-SETUP.md` before the first production deployment.

Required Netlify environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (a Supabase publishable key also works)
- `NODE_VERSION=22`

`TRAINING_SYNC_KEY` is not read by the account-owned sync architecture and should not be present in new deployments.

## Deploy with Netlify CLI

From the linked project folder:

```text
netlify build
netlify deploy --prod
```

Do not upload `.next` or `dist` through Netlify Drop. Netlify must prepare the Next.js server functions and authenticated API routes.

## Existing legacy data

On the device that currently holds the profile, export a JSON backup before deploying. After deployment, sign in on that same device and wait for **Cloud saved**. Its account-scoped IndexedDB migration uploads the existing device copy into the authenticated row. The legacy `kv` row is intentionally left untouched for rollback and is no longer read.
