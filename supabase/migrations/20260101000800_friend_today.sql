-- Friends' "done today" status could go stale. A friend who finished all their
-- tasks yesterday and hadn't opened the app yet today still showed "All done
-- today" (the status was believed if it was within a day of the viewer's date),
-- and the shared streak could count that stale "today" on top of yesterday.
--
-- Now a friend's status only counts for today itself (or a friend whose
-- calendar is already a day ahead). Otherwise it reads "Not seen today" until
-- they open the app and report. Shared streaks and nudges use the same idea.
-- Safe to run more than once.

create or replace function public.friends_overview(p_today date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  result jsonb;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;

  select jsonb_build_object(
    'me', (select jsonb_build_object('username', p.username, 'nudges_enabled', p.nudges_enabled)
             from public.profiles p where p.id = me),

    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',  f.other,
        'username', p.username,
        'name',     p.name,
        'avatar',   p.avatar,
        -- A streak nobody has refreshed in 3 days no longer counts.
        'streak',   case when s.expires_at > now() then coalesce(s.current_streak, 0) else 0 end,
        'longest',  coalesce(s.longest_streak, 0),
        -- `today` is only believed for the viewer's today (or a friend whose
        -- calendar is already a day ahead). A status from yesterday means they
        -- haven't opened the app yet today: "unknown", not "done today".
        'today',    case when s.today_day is not null
                          and s.today_day between p_today and p_today + 1
                         then s.today else 'unknown' end,
        'shared_streak', public.shared_streak(me, f.other, p_today),
        'nudged_recently', exists (
          select 1 from public.nudges n
           where n.from_user = me and n.to_user = f.other
             and n.created_at > now() - interval '20 hours')
      ) order by p.username)
      from (
        select case when fr.requester = me then fr.addressee else fr.requester end as other
          from public.friendships fr
         where fr.status = 'accepted' and (fr.requester = me or fr.addressee = me)
      ) f
      join public.profiles p on p.id = f.other
      left join public.streak_stats s on s.user_id = f.other
    ), '[]'::jsonb),

    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fr.id, 'user_id', fr.requester, 'username', p.username,
        'name', p.name, 'avatar', p.avatar, 'created_at', fr.created_at
      ) order by fr.created_at desc)
      from public.friendships fr join public.profiles p on p.id = fr.requester
      where fr.addressee = me and fr.status = 'pending'
    ), '[]'::jsonb),

    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fr.id, 'user_id', fr.addressee, 'username', p.username,
        'name', p.name, 'avatar', p.avatar, 'created_at', fr.created_at
      ) order by fr.created_at desc)
      from public.friendships fr join public.profiles p on p.id = fr.addressee
      where fr.requester = me and fr.status = 'pending'
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

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
     and sa.today_day = p_today and sb.today_day = p_today then
    n := n + 1;
  end if;
  return n;
end;
$$;

create or replace function public.send_nudge(p_to uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_name text;
  target_stats public.streak_stats;
  wants boolean;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if not public.is_friend(p_to) then return 'not_friends'; end if;

  if exists (select 1 from public.nudges n
              where n.from_user = me and n.to_user = p_to
                and n.created_at > now() - interval '20 hours') then
    return 'already_nudged';
  end if;

  select * into target_stats from public.streak_stats where user_id = p_to;
  -- Finished today by their calendar: today's date, or yesterday's shortly after
  -- they reported it (the server clock is UTC, theirs isn't). A "complete" from
  -- yesterday that was reported long ago is stale.
  if found and target_stats.today = 'complete'
     and (target_stats.today_day >= current_date
          or (target_stats.today_day = current_date - 1
              and target_stats.updated_at > now() - interval '5 hours')) then
    return 'already_done';
  end if;

  insert into public.nudges (from_user, to_user) values (me, p_to);

  -- Whether they receive it is their choice, and the sender isn't told.
  select nudges_enabled into wants from public.profiles where id = p_to;
  if coalesce(wants, true) then
    select username into my_name from public.profiles where id = me;
    perform public.push_to_user(p_to, '👋 @' || coalesce(my_name, 'A friend') || ' nudged you',
      'You haven''t finished today''s tasks yet. Keep your streak alive!',
      jsonb_build_object('type', 'nudge', 'from', me));
  end if;
  return 'sent';
end;
$$;

revoke all on function public.shared_streak(uuid, uuid, date) from public, anon, authenticated;
