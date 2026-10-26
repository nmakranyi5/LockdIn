-- LockdIn schema: profiles, tasks, day history. Every table is protected by
-- row-level security so a signed-in user can only ever see their own rows.
-- Run this once in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- profiles: one row per user, created automatically on sign-up
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 24),
  avatar      text not null default '🦊' check (char_length(avatar) <= 16),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tasks: notification ids are device-local and are NOT stored here.
-- Rows are soft-deleted (deleted_at) so deletes reach the user's other devices.
-- ---------------------------------------------------------------------------
create table public.tasks (
  user_id           uuid not null default auth.uid()
                      references auth.users (id) on delete cascade,
  id                text not null,
  title             text not null default '' check (char_length(title) <= 500),
  kind              text not null default 'timer'
                      check (kind in ('timer', 'checklist', 'oneshot')),
  priority          text not null default 'normal'
                      check (priority in ('low', 'normal', 'important', 'urgent')),
  repeats           text not null default 'none'
                      check (repeats in ('none', 'daily', 'weekdays', 'weekly', 'monthly')),
  start_at          timestamptz not null,
  end_at            timestamptz not null,
  started_at        timestamptz,
  completed_at      timestamptz,
  estimate_minutes  integer check (estimate_minutes between 1 and 1440),
  items             jsonb not null default '[]'::jsonb
                      check (jsonb_typeof(items) = 'array'),
  series_id         text,
  spawned_next      boolean not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

create index tasks_user_updated_idx on public.tasks (user_id, updated_at);
create index tasks_user_start_idx   on public.tasks (user_id, start_at);

-- ---------------------------------------------------------------------------
-- day_history: a day's result, frozen once the day has ended (streaks)
-- ---------------------------------------------------------------------------
create table public.day_history (
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  day         date not null,
  total       integer not null check (total >= 0),
  done        integer not null check (done >= 0 and done <= total),
  created_at  timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- updated_at is always set by the server so devices with skewed clocks can
-- still sync with a reliable cursor.
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before insert or update on public.profiles
  for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
  before insert or update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create the profile row as soon as someone signs up
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security: owner-only access
-- ---------------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.tasks       enable row level security;
alter table public.day_history enable row level security;

create policy "profiles: read own"   on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "tasks: read own"   on public.tasks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "tasks: insert own" on public.tasks
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "tasks: update own" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "tasks: delete own" on public.tasks
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "history: read own"   on public.day_history
  for select to authenticated using (user_id = (select auth.uid()));
create policy "history: insert own" on public.day_history
  for insert to authenticated with check (user_id = (select auth.uid()));
-- History is write-once (no update / delete policy): a finished day never changes.

-- ---------------------------------------------------------------------------
-- Account deletion (required by the App Store for apps with sign-up).
-- Cascades to profiles, tasks and day_history.
-- ---------------------------------------------------------------------------
create function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = (select auth.uid());
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
