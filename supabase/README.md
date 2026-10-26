# LockdIn backend (Supabase)

## 1. Create the tables

In the Supabase dashboard open **SQL Editor → New query**, paste the contents of
[`migrations/20260101000000_init.sql`](migrations/20260101000000_init.sql) and run it once.
(Or, with the Supabase CLI: `supabase link` then `supabase db push`.)

It creates `profiles`, `tasks` and `day_history`, turns on **row-level security** (every
user can only read and write their own rows), and adds the `delete_my_account()` function.

## 2. Add your keys to the app

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from
**Project Settings → API**. Restart Expo (`npx expo start -c`) after changing them.

Without these the app runs local-only (no sign-in screen), as it did before.

For EAS builds, set the same two variables in your EAS environment
(`eas env:create` or the expo.dev dashboard); `.env` is not uploaded.

## 3. Auth settings (Authentication → Providers → Email)

- **Confirm email**: on (default) means new users must click a link before signing in; the
  app shows a "Check your email" screen. Turn it off for frictionless sign-up while testing.
- Password reset emails are sent by Supabase. Point **Authentication → URL Configuration →
  Site URL** at a page you control; the app does not yet handle the reset link itself.

## How syncing works

- The app is **offline-first**: tasks live on the device and the UI never waits on the network.
- Changes are pushed a moment after you make them, and pulled when the app opens, comes back to
  the foreground, and every minute. Pulls are incremental (server `updated_at` cursor).
- Deleting a task sets `deleted_at` (a tombstone) so the delete reaches your other devices.
- If two devices edit the same task, the last one to sync wins.
- Day results (for streaks) are write-once: the first device to report a finished day wins.
- Notification ids are per-device and are never uploaded; each device schedules its own alerts
  for tasks it receives.
- First sign-in on a device that already has tasks uploads them to the account. Signing in as a
  *different* account on the same device starts clean instead of mixing data.

## Testing schema changes

`supabase/tests/rls.test.mjs` applies the migration in an in-process Postgres and checks that
users can't see or change each other's data, that constraints and triggers behave, and that
account deletion cascades:

```bash
npm i --no-save @electric-sql/pglite
node supabase/tests/rls.test.mjs
```

Re-run it after editing the migration or adding new ones.
