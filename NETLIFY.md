# Netlify deployment

Version 6 is a server-rendered Next.js app with Supabase passwordless accounts. Complete `AUTH-SETUP.md` before the first v6 deployment.

Required Netlify environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (a Supabase publishable key also works)
- `NODE_VERSION=22`

`TRAINING_SYNC_KEY` is not read by v6. Leave it in Netlify temporarily if you want an easy rollback to v5; remove it after every existing device has migrated successfully.

## Deploy with Netlify CLI

From the linked project folder:

```text
netlify build
netlify deploy --prod
```

Do not upload `.next` or `dist` through Netlify Drop. Netlify must prepare the Next.js server functions and authenticated API routes.

## Existing v5 data

On the device that currently holds the profile, export a JSON backup before deploying v6. After deployment, sign in on that same device and wait for **Cloud saved**. Its account-scoped IndexedDB migration uploads the existing device copy into the authenticated row. The legacy `kv` row is intentionally left untouched for rollback and is no longer read by v6.
