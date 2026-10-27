-- Daily goals: how many tasks a person must finish for a day to count toward
-- their streak ("at least N tasks in a day"). 0 means "all of my tasks", the
-- original rule, and is the default, so nothing changes for anyone who doesn't
-- set a goal.

-- The goal in force is stored as a schedule ("from this date, this goal")
-- because a change only starts tomorrow and past days keep the goal they had.
alter table public.profiles
  add column goal_schedule jsonb not null
    default '[{"from": "0000-01-01", "goal": 0}]'::jsonb
    check (jsonb_typeof(goal_schedule) = 'array'
           and jsonb_array_length(goal_schedule) between 1 and 100);

-- A finished day remembers the goal it was judged against.
alter table public.day_history
  add column goal integer not null default 0 check (goal between 0 and 10);

-- Did this day meet its goal?
create function public.day_complete(p_total integer, p_done integer, p_goal integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when p_goal > 0 then p_done >= p_goal
              else p_total > 0 and p_done = p_total end;
$$;

-- Shared streak (days in a row you BOTH met your goals), now goal-aware. Same
-- rules as before: a day either of you had no tasks is neutral, a day either of
-- you missed ends it, and only the count is returned.
create or replace function public.shared_streak(a uuid, b uuid, p_today date)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d date := p_today - 1;
  n integer := 0;
  ha public.day_history;
  hb public.day_history;
  sa public.streak_stats;
  sb public.streak_stats;
begin
  while d >= p_today - 400 loop
    select * into ha from public.day_history where user_id = a and day = d;
    if not found then d := d - 1; continue; end if;
    select * into hb from public.day_history where user_id = b and day = d;
    if not found then d := d - 1; continue; end if;
    if public.day_complete(ha.total, ha.done, ha.goal)
       and public.day_complete(hb.total, hb.done, hb.goal) then
      n := n + 1;
    else
      exit;
    end if;
    d := d - 1;
  end loop;

  select * into sa from public.streak_stats where user_id = a;
  select * into sb from public.streak_stats where user_id = b;
  if sa.today = 'complete' and sb.today = 'complete'
     and abs(sa.today_day - p_today) <= 1 and abs(sb.today_day - p_today) <= 1 then
    n := n + 1;
  end if;
  return n;
end;
$$;

revoke all on function public.shared_streak(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.day_complete(integer, integer, integer) from public, anon, authenticated;
