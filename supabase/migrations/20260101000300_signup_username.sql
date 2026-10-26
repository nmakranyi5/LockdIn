-- Choose a username while signing up.
--
-- The app sends the username along with the sign-up request. This function
-- (which already creates the profile row for every new account) now reads it
-- from there, so it works even when email confirmation is on and there is no
-- session yet. It never blocks sign-up: if the name is invalid, reserved or
-- grabbed by someone else a moment earlier, the profile is created without
-- one and the app asks for it again on the Friends screen.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
begin
  if wanted !~ '^[a-z0-9_]{3,20}$'
     or wanted in ('admin', 'administrator', 'support', 'lockdin', 'root', 'system', 'moderator') then
    wanted := null;
  end if;

  begin
    insert into public.profiles (id, username) values (new.id, wanted)
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Someone claimed that username between the check and now.
    insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  end;
  return new;
end;
$$;

-- Lets the sign-up screen say "taken" / "available" as you type. It has to work
-- before an account exists, so it is open to signed-out visitors. It only
-- answers yes/no for one exact name; it cannot list or search usernames.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower(btrim(p_username)) ~ '^[a-z0-9_]{3,20}$'
    and lower(btrim(p_username)) not in
        ('admin', 'administrator', 'support', 'lockdin', 'root', 'system', 'moderator')
    and not exists (
      select 1 from public.profiles where username = lower(btrim(p_username))
    ),
    false
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
