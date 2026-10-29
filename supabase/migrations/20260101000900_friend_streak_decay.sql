-- Friends' streaks on the leaderboard never dropped back to 0. A friend's app
-- only reports its streak when it is open, so the last reported number stayed
-- on the board for up to 3 days after they missed a day.
--
-- Now the number is worked out as of the viewer's today: a friend who reported
-- today keeps it; one who reported yesterday keeps it only if they finished (or
-- had nothing scheduled) yesterday; a friend who left yesterday unfinished, or
-- hasn't reported for two days, shows 0. Safe to run more than once.

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
        -- A friend's app only reports when it is open, so the number can be out
        -- of date. Work out what it is worth today: still alive if they reported
        -- today (or are a day ahead), or reported yesterday having finished (or
        -- having had nothing to do); gone if yesterday was left unfinished or
        -- they haven't reported for two days. A streak nobody has refreshed in
        -- 3 days is gone regardless.
        'streak',   case
                      when s.expires_at <= now() or s.today_day is null then 0
                      when s.today_day >= p_today then coalesce(s.current_streak, 0)
                      when s.today_day = p_today - 1 and s.today in ('complete', 'none')
                        then coalesce(s.current_streak, 0)
                      else 0 end,
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
