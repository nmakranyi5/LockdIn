-- Experience points. The XP earned on each finished day is stored once and
-- never changes, exactly like day_history, so deleting tasks later can't alter
-- it and it syncs cleanly between a person's devices.
--
-- Private to the owner: unlike streaks, XP is not visible to friends.

create table public.day_xp (
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  day         date not null,
  xp          integer not null check (xp between 0 and 10000),
  created_at  timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.day_xp enable row level security;

create policy "xp: read own"   on public.day_xp
  for select to authenticated using (user_id = (select auth.uid()));
create policy "xp: insert own" on public.day_xp
  for insert to authenticated with check (user_id = (select auth.uid()));
-- No update or delete policy: a finished day's XP is write-once.

grant select, insert on public.day_xp to authenticated;
revoke all on public.day_xp from anon;
