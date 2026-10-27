-- Hydration tracker: glasses of water per day, plus the daily target.
--
-- Unlike finished days (write-once), a day's water count is edited all day long
-- (+ and undo), so a row is updated in place; `updated_at` is the time of the
-- edit on the device, and the newest edit wins when two devices disagree.
--
-- Private to the owner, like XP.

create table public.water_log (
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  day         date not null,
  glasses     integer not null check (glasses between 0 and 99),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.water_log enable row level security;

create policy "water: read own"   on public.water_log
  for select to authenticated using (user_id = (select auth.uid()));
create policy "water: insert own" on public.water_log
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "water: update own" on public.water_log
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.water_log to authenticated;
revoke all on public.water_log from anon;

-- Glasses a day the person aims for (8 unless they change it).
alter table public.profiles
  add column water_goal integer not null default 8
    check (water_goal between 1 and 30);
