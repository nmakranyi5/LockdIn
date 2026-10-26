-- Friends: usernames, friend requests, friends' streaks, shared streaks and
-- push nudges.
--
-- Privacy by design: friends only ever see a person's username, name, avatar,
-- streaks and whether they've finished TODAY. Task titles, task counts and day
-- history stay private. Friends are added by exact username only (there is no
-- way to list or search users), and every action goes through a function that
-- enforces the rules, so a modified app can't skip them.

-- Needed to send push notifications straight from the database (no separate
-- server). On Supabase this is also available under Database → Extensions.
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Usernames and nudge preference on profiles
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column username text,
  add column nudges_enabled boolean not null default true,
  add constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,20}$'),
  add constraint profiles_username_reserved
    check (username not in ('admin', 'administrator', 'support', 'lockdin', 'root', 'system', 'moderator'));

-- Usernames are stored lower-case (enforced above), so a plain index is
-- case-insensitive in practice. NULLs (no username yet) don't collide.
create unique index profiles_username_key on public.profiles (username);

-- ---------------------------------------------------------------------------
-- friendships: one row per pair, pending until the addressee accepts
-- ---------------------------------------------------------------------------
create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester     uuid not null references auth.users (id) on delete cascade,
  addressee     uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  check (requester <> addressee)
);

-- One relationship per pair, whichever direction it was requested in.
create unique index friendships_pair_key
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

-- ---------------------------------------------------------------------------
-- streak_stats: the only thing about your progress that friends can read
-- ---------------------------------------------------------------------------
create table public.streak_stats (
  user_id         uuid primary key default auth.uid()
                    references auth.users (id) on delete cascade,
  current_streak  integer not null default 0 check (current_streak between 0 and 100000),
  longest_streak  integer not null default 0 check (longest_streak between 0 and 100000),
  today           text not null default 'none' check (today in ('none', 'pending', 'complete')),
  -- The person's own calendar date that `today` refers to.
  today_day       date,
  -- A streak that hasn't been refreshed for 3 days is shown as lost to friends,
  -- so someone who stops using the app doesn't keep a ghost streak forever.
  expires_at      timestamptz not null default now() + interval '72 hours',
  updated_at      timestamptz not null default now()
);

create function public.touch_streak_stats()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.expires_at = now() + interval '72 hours';
  return new;
end;
$$;

create trigger streak_stats_touch
  before insert or update on public.streak_stats
  for each row execute function public.touch_streak_stats();

-- ---------------------------------------------------------------------------
-- Devices that can receive push notifications, and the nudge log
-- ---------------------------------------------------------------------------
create table public.push_tokens (
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null check (char_length(token) <= 200),
  platform    text not null default 'unknown' check (char_length(platform) <= 20),
  updated_at  timestamptz not null default now(),
  primary key (user_id, token)
);
create index push_tokens_token_idx on public.push_tokens (token);

create table public.nudges (
  id          bigint generated always as identity primary key,
  from_user   uuid not null references auth.users (id) on delete cascade,
  to_user     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index nudges_pair_idx on public.nudges (from_user, to_user, created_at desc);

-- ---------------------------------------------------------------------------
-- Relationship helpers (used by row-level security below)
-- ---------------------------------------------------------------------------
create function public.is_friend(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = (select auth.uid()) and f.addressee = other)
        or (f.addressee = (select auth.uid()) and f.requester = other))
  );
$$;

-- Friends, or a request in either direction (so you can see who is asking).
create function public.is_connected(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where (f.requester = (select auth.uid()) and f.addressee = other)
       or (f.addressee = (select auth.uid()) and f.requester = other)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.friendships enable row level security;
alter table public.streak_stats enable row level security;
alter table public.push_tokens  enable row level security;
alter table public.nudges       enable row level security;

create policy "friendships: read own" on public.friendships
  for select to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));
-- No insert/update/delete policies: changes only happen through the functions below.

create policy "profiles: read connected" on public.profiles
  for select to authenticated using (public.is_connected(id));

create policy "streak_stats: read own" on public.streak_stats
  for select to authenticated using (user_id = (select auth.uid()));
create policy "streak_stats: read friends" on public.streak_stats
  for select to authenticated using (public.is_friend(user_id));
create policy "streak_stats: insert own" on public.streak_stats
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "streak_stats: update own" on public.streak_stats
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- push_tokens and nudges have no policies at all: only the functions touch them.

-- ---------------------------------------------------------------------------
-- Internal: send a push notification to every device of a user.
-- Fire-and-forget; a delivery problem must never break the action behind it.
-- ---------------------------------------------------------------------------
create function public.push_to_user(p_user uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  msgs jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', p_title, 'body', p_body, 'data', p_data,
           'sound', 'default', 'priority', 'high')), '[]'::jsonb)
    into msgs
    from public.push_tokens t
   where t.user_id = p_user;

  if jsonb_array_length(msgs) = 0 then
    return;
  end if;

  perform net.http_post(
    url     := 'https://exp.host/--/api/v2/push/send',
    body    := msgs,
    headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
  );
exception when others then
  raise warning 'push notification failed: %', sqlerrm;
end;
$$;

-- Internal: the number of consecutive days two people both finished everything.
-- Reads both people's private history but returns only the count.
create function public.shared_streak(a uuid, b uuid, p_today date)
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
    if not found then d := d - 1; continue; end if;      -- no tasks that day: neutral
    select * into hb from public.day_history where user_id = b and day = d;
    if not found then d := d - 1; continue; end if;
    if ha.done = ha.total and hb.done = hb.total then
      n := n + 1;
    else
      exit;                                              -- someone missed: streak ends
    end if;
    d := d - 1;
  end loop;

  -- Today counts once both have finished everything (their calendars may differ
  -- by a day because of time zones).
  select * into sa from public.streak_stats where user_id = a;
  select * into sb from public.streak_stats where user_id = b;
  if sa.today = 'complete' and sb.today = 'complete'
     and abs(sa.today_day - p_today) <= 1 and abs(sb.today_day - p_today) <= 1 then
    n := n + 1;
  end if;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usernames
-- ---------------------------------------------------------------------------
create function public.set_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  u  text := lower(btrim(p_username));
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  if u !~ '^[a-z0-9_]{3,20}$' then return 'invalid'; end if;
  if u in ('admin', 'administrator', 'support', 'lockdin', 'root', 'system', 'moderator') then
    return 'reserved';
  end if;
  update public.profiles set username = u where id = me;
  if not found then
    insert into public.profiles (id, username) values (me, u);
  end if;
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;

-- ---------------------------------------------------------------------------
-- Friend requests
-- ---------------------------------------------------------------------------
create function public.send_friend_request(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_name text;
  target uuid;
  rel public.friendships;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select username into my_name from public.profiles where id = me;
  if my_name is null then return 'need_username'; end if;

  select id into target from public.profiles where username = lower(btrim(p_username));
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;

  -- Stops anyone from pestering strangers with a stream of requests.
  if (select count(*) from public.friendships where requester = me and status = 'pending') >= 30 then
    return 'too_many';
  end if;

  select * into rel from public.friendships
   where (requester = me and addressee = target) or (requester = target and addressee = me);

  if found then
    if rel.status = 'accepted' then return 'already_friends'; end if;
    if rel.requester = me then return 'already_requested'; end if;
    -- They already asked us: asking back means yes.
    update public.friendships set status = 'accepted', responded_at = now() where id = rel.id;
    perform public.push_to_user(target, '🎉 You''re friends!', '@' || my_name || ' accepted your friend request.',
      jsonb_build_object('type', 'friend_accepted'));
    return 'accepted';
  end if;

  insert into public.friendships (requester, addressee) values (me, target);
  perform public.push_to_user(target, '👋 New friend request', '@' || my_name || ' wants to be friends on LockdIn.',
    jsonb_build_object('type', 'friend_request'));
  return 'sent';
end;
$$;

create function public.respond_friend_request(p_request uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  rel public.friendships;
  my_name text;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into rel from public.friendships
   where id = p_request and addressee = me and status = 'pending';
  if not found then return 'not_found'; end if;

  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now() where id = rel.id;
    select username into my_name from public.profiles where id = me;
    perform public.push_to_user(rel.requester, '🎉 You''re friends!',
      '@' || coalesce(my_name, 'someone') || ' accepted your friend request.',
      jsonb_build_object('type', 'friend_accepted'));
    return 'accepted';
  end if;

  delete from public.friendships where id = rel.id;
  return 'declined';
end;
$$;

-- Unfriend, cancel a request you sent.
create function public.remove_friend(p_other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  delete from public.friendships
   where (requester = me and addressee = p_other) or (requester = p_other and addressee = me);
end;
$$;

-- ---------------------------------------------------------------------------
-- Everything the friends screen needs, in one call
-- ---------------------------------------------------------------------------
create function public.friends_overview(p_today date)
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
        'today',    case when s.today_day is not null and abs(s.today_day - p_today) <= 1
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

-- ---------------------------------------------------------------------------
-- Nudges: "you haven't finished today yet", delivered as a push notification
-- ---------------------------------------------------------------------------
create function public.send_nudge(p_to uuid)
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
  if found and target_stats.today = 'complete' and target_stats.today_day >= current_date - 1 then
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

-- ---------------------------------------------------------------------------
-- Push tokens
-- ---------------------------------------------------------------------------
create function public.register_push_token(p_token text, p_platform text default 'unknown')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  -- A phone belongs to whoever is signed in on it now.
  delete from public.push_tokens where token = p_token and user_id <> me;
  insert into public.push_tokens (user_id, token, platform)
  values (me, p_token, coalesce(p_platform, 'unknown'))
  on conflict (user_id, token) do update set platform = excluded.platform, updated_at = now();
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_tokens where token = p_token and user_id = (select auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
grant select                 on public.friendships  to authenticated;
grant select, insert, update on public.streak_stats to authenticated;
revoke all on public.friendships, public.streak_stats, public.push_tokens, public.nudges from anon;
revoke all on public.push_tokens, public.nudges from authenticated;

-- Functions are executable by everyone by default; lock that down.
revoke all on function public.push_to_user(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.shared_streak(uuid, uuid, date)       from public, anon, authenticated;

revoke all on function public.is_friend(uuid)                       from public, anon;
revoke all on function public.is_connected(uuid)                    from public, anon;
revoke all on function public.set_username(text)                    from public, anon;
revoke all on function public.send_friend_request(text)             from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friend(uuid)                   from public, anon;
revoke all on function public.friends_overview(date)                from public, anon;
revoke all on function public.send_nudge(uuid)                      from public, anon;
revoke all on function public.register_push_token(text, text)       from public, anon;
revoke all on function public.unregister_push_token(text)           from public, anon;

grant execute on function public.is_friend(uuid)                       to authenticated;
grant execute on function public.is_connected(uuid)                    to authenticated;
grant execute on function public.set_username(text)                    to authenticated;
grant execute on function public.send_friend_request(text)             to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid)                   to authenticated;
grant execute on function public.friends_overview(date)                to authenticated;
grant execute on function public.send_nudge(uuid)                      to authenticated;
grant execute on function public.register_push_token(text, text)       to authenticated;
grant execute on function public.unregister_push_token(text)           to authenticated;
