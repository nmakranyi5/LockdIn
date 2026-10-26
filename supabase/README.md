# LockdIn backend (Supabase)

## 1. Create the tables

In the Supabase dashboard open **SQL Editor → New query** and run these four files, in order, once each:

1. [`migrations/20260101000000_init.sql`](migrations/20260101000000_init.sql): tables, security rules, triggers
2. [`migrations/20260101000100_grants.sql`](migrations/20260101000100_grants.sql): table access for signed-in users.
   Skipping this gives `permission denied for table profiles` in the app.
3. [`migrations/20260101000200_friends.sql`](migrations/20260101000200_friends.sql): usernames, friend
   requests, friends' streaks, shared streaks and nudges (see "Friends" below). It turns on the
   `pg_net` extension; if the SQL editor complains about it, enable **pg_net** under
   *Database → Extensions* first and run the file again.
4. [`migrations/20260101000300_signup_username.sql`](migrations/20260101000300_signup_username.sql): lets
   people choose their username on the sign-up screen (with a live "available / taken" check). Skipping it
   is harmless: sign-up still works and people are asked for a username on the Friends screen instead.

(Or, with the Supabase CLI: `supabase link` then `supabase db push`, which runs all four.)

It creates `profiles`, `tasks` and `day_history`, turns on **row-level security** (every
user can only read and write their own rows), and adds the `delete_my_account()` function.

## 2. Add your keys to the app

Create a file named `.env` in the project root (it is gitignored) with:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Take both values from **Project Settings → API**. Use the **anon / public** key only, never the
`service_role` key. Put real values in `.env`, not in any tracked file such as `.env.example`.
Restart Expo (`npx expo start -c`) after changing them.

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

`supabase/tests/friends.test.mjs` does the same for the friends migration (requests, privacy, shared
streaks, nudges, push payloads, account deletion):

```bash
node supabase/tests/friends.test.mjs
```

Re-run both after editing a migration or adding new ones.

## Friends, shared streaks and nudges

- **Usernames**: each person picks a unique username (3–20 letters, numbers, underscores) on the sign-up
  screen; it can be changed later from the Friends screen. Friends are added by exact username only; there
  is no list or search of users. The sign-up screen can ask "is this name free?" before an account exists;
  that is the only thing signed-out visitors can ask the database.
- **What friends can see**: username, name, avatar, current/longest streak and whether you have finished
  *today*. Never task titles, task counts or your day-by-day history. Friends' tables are protected by
  row-level security, and the shared-streak maths runs inside the database so it can read both people's
  history without ever returning it.
- **Shared streak**: the number of days in a row you *both* finished everything (days when either of you had
  no tasks are neutral, a day either of you missed ends it).
- **Leaderboard**: you and your friends, ranked by current streak.
- **Stale streaks**: a streak that hasn't been refreshed by its owner for 72 hours shows as 0 to friends.
- **Limits**: 30 pending friend requests per person; one nudge per friend per 20 hours; no nudging someone
  who has already finished today. People can switch nudges off in Settings (the sender isn't told).

### Push notifications (nudges, friend requests)

Pushes are sent by the database itself: a function calls Expo's push service through `pg_net`, so there is
no server or Edge Function to deploy. What you need to do:

1. **Rebuild the development app** once. `expo-notifications` was added to the app's plugins, which changes
   the native project: `npx expo run:ios` / `npx expo run:android` (or an EAS build).
2. **Use a real phone.** Simulators and emulators can't receive remote notifications. The app asks for
   notification permission and registers the phone's push token automatically after sign-in.
3. **Credentials** (EAS manages them; run `eas credentials` or just `eas build`):
   - *iOS*: an Apple Developer account (push key / APNs).
   - *Android*: an FCM v1 service-account key uploaded to EAS, and `google-services.json` in the project.
4. Debugging: in the SQL editor run `select * from net._http_response order by created desc limit 5;` to
   see Expo's reply to each push the database sent.

Signing out (or deleting the account) unregisters that phone, so it stops receiving the old account's pushes.
