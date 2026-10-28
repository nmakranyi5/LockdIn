# LockdIn

A daily task app with streaks, XP, friends and a water tracker. Built with Expo (React Native), so it runs on iPhone, Android and the web.

- **Tasks by day:** timers, checklists and one-and-done tasks, with priorities, repeats and an "end of day" deadline. A task can only be done on its own day; missed tasks stay on their day and can be rescheduled.
- **Streaks and goals:** finish at least N tasks a day (or all of them) to keep your streak.
- **XP and levels:** more for important tasks, boosted by your streak and goal, less for late work.
- **Friends:** add people by username, compare streaks, nudge each other.
- **Water tracker, profile pictures, accounts and sync** through Supabase.

## Run it

```bash
npm install
npx expo start        # press i for iOS, a for Android, w for web
```

Sign-in and sync need a Supabase project: see [`supabase/README.md`](supabase/README.md) for the SQL to run, the `.env` keys, and how to publish the web app to GitHub Pages.

## Tests

The database rules have tests that run in-process: `npm i --no-save @electric-sql/pglite`, then `node supabase/tests/<name>.test.mjs`.
