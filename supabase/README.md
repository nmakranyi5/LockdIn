# LockdIn backend (Supabase)

## 1. Create the tables

In the Supabase dashboard open **SQL Editor → New query** and run these nine files, in order, once each:

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
5. [`migrations/20260101000400_xp.sql`](migrations/20260101000400_xp.sql): the XP ledger (see "Experience and
   levels" below). Skipping it is harmless: XP and levels still work on the device, they just don't sync
   between devices.
6. [`migrations/20260101000500_goals.sql`](migrations/20260101000500_goals.sql): the daily goal (see
   "Daily goal" below). Skipping it is harmless: goals still work on the device, they just don't sync
   between devices or count for friends' shared streaks.
7. [`migrations/20260101000600_water.sql`](migrations/20260101000600_water.sql): the hydration tracker (see
   "Hydration" below). Skipping it is harmless: water still works on the device, it just doesn't sync.
8. [`migrations/20260101000700_avatars.sql`](migrations/20260101000700_avatars.sql): lets a profile picture be
   stored as the avatar. Skipping it is harmless: a picture stays on the device that chose it (everything else
   keeps syncing) and uploads once this is run.
9. [`migrations/20260101000800_friend_today.sql`](migrations/20260101000800_friend_today.sql): fixes friends'
   "done today" going stale (a friend who finished yesterday no longer shows as done today until they report
   today), and the shared streak counting it twice. Safe to run more than once.

(Or, with the Supabase CLI: `supabase link` then `supabase db push`, which runs all nine.)

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

`supabase/tests/xp.test.mjs` covers the XP ledger (owner-only, write-once, hidden from friends).

`supabase/tests/friends.test.mjs` does the same for the friends migration (requests, privacy, shared
streaks, nudges, push payloads, account deletion):

```bash
node supabase/tests/friends.test.mjs
node supabase/tests/xp.test.mjs
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

## Experience and levels

- **XP per task** depends on its priority: Low 5, Normal 10, Important 20, Urgent 30.
- **Streak multiplier**: a day's XP is multiplied by the streak going *into* that day, +5% per day up to ×2.0
  at 20 days. (Using the streak from before the day avoids the loop where finishing today's tasks would
  boost the XP for those same tasks.)
- **Daily cap**: only the 10 most valuable completed tasks of a day count, so piles of trivial tasks can't be
  farmed.
- **Levels**: reaching level *n* takes `50 · (n−1) · n` total XP (level 2 = 100, 3 = 300, 5 = 1,000,
  10 = 4,500, 20 = 19,000). Titles: Newcomer, Getting Started (3), Focused (5), Dedicated (10),
  Relentless (15), Legend (25).
- **Frozen days**: a finished day's XP is stored once (`day_xp`, write-once like `day_history`) so deleting
  tasks later can't change it, and it syncs between devices. Today's XP is always worked out live.
- **Private**: unlike streaks, XP and level are visible only to their owner (not to friends).

The numbers live in `components/xp.ts` if you want to tune them. Changing the formula affects days that
haven't been frozen yet; already-finished days keep the XP they earned.

## Daily goal

People choose how many tasks a day must include to count for their streak: "At least N tasks in a day"
(1 to 10, and **1 is the default**) or "All my tasks", listed last. Reaching the goal gives a bonus on top of
the streak multiplier: every task completed that day earns `1 + 0.1 × (N − 1)` times its XP (so ×1.2 for 3
tasks), applied only on days the goal is reached. "All my tasks" scales with the day: finishing all of a day's
n tasks (n up to 10) earns the bonus of a goal of n. A change starts tomorrow, so today can't be gamed;
past days keep the goal they were played with (`day_history.goal`, 0 meaning "all tasks"). The schedule of
changes lives in `profiles.goal_schedule`.

The column's default in the database is still the original "all tasks" rule: that is what "never chose a
goal" means to the server. The app moves everyone who never touched the setting to the new default from
tomorrow, and sends the goal up whenever it differs from the server's default. Before the goals migration is
run the app keeps syncing and simply leaves the goal data out.

## Hydration

A card on today's home screen counts glasses of water (+ and undo), with a daily target (8 by default, 1 to 30)
and a last-7-days chart behind it. It is standalone: it never affects streaks or XP, and it is private to the
owner like XP.

`water_log` holds one row per day (`glasses`, `updated_at`). Unlike finished days these are edited all day,
so rows are updated in place and the newest edit wins when two devices disagree (`updated_at` is the time of
the edit on the device). The target is `profiles.water_goal`. As with goals, the app keeps syncing everything
else before this migration is run and uploads the water days once the table exists.

## Profile pictures

Besides the emoji, a person can pick a photo (**Profile → the picture tile**). The app crops it to a centred
square, shrinks it to 128 px and stores it in `profiles.avatar` as a small JPEG data URI (a few KB), so it syncs
and shows up for friends without any file storage. The column only accepts an emoji (16 characters or fewer)
or a `data:image/jpeg;base64,` string of at most 24000 characters.

## Hosting the web app on GitHub Pages

The same app runs in a browser, and on an iPhone you can open it in Safari and use Share -> Add to Home Screen
(it then opens full screen with the app icon). `.github/workflows/pages.yml` builds it and publishes it to
`https://<user>.github.io/<repo>/` on every push to `master` (or by hand from the Actions tab).

One-time setup:
1. **Settings -> Pages -> Build and deployment -> Source: GitHub Actions.**
2. **Settings -> Secrets and variables -> Actions -> Variables:** add `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the same two values as in `.env`; the anon key is meant to be public).
3. **Supabase -> Authentication -> URL Configuration:** set the Site URL to the Pages address and add it under
   Redirect URLs, so the links in confirmation emails land on the site.

Notes: the web version has no push notifications or task alerts (browsers can't schedule them like the phone
app), and the data in the browser is stored per site, so sign in to see your tasks. For a local test of the
Pages build: `EXPO_BASE_URL=/LockdIn npx expo export -p web`.
