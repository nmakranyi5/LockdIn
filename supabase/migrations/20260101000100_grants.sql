-- Table privileges for the Data API.
--
-- Row-level security decides WHICH rows a user may touch, but Postgres also
-- requires the signed-in role to be granted access to the table itself.
-- Supabase used to grant this automatically for tables created in the SQL
-- editor; newer projects don't, which shows up in the app as
--   "permission denied for table profiles"
-- Safe to run more than once.

grant usage on schema public to anon, authenticated;

-- Signed-in users: only what the app needs, and RLS still limits them to
-- their own rows.
grant select, insert, update, delete on public.tasks       to authenticated;
grant select, insert, update         on public.profiles    to authenticated;
-- Finished days are write-once: no update or delete.
grant select, insert                 on public.day_history to authenticated;

-- Signed-out visitors get nothing.
revoke all on public.tasks, public.profiles, public.day_history from anon;
