// Checks the XP ledger migration: owner-only, write-once, bounded, cascades on
// account deletion, and invisible even to friends.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/xp.test.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import assert from 'assert';

const sql = (f) => fs.readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  create schema net;
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $$ select 1::bigint $$;
`);
for (const f of ['20260101000000_init.sql', '20260101000100_grants.sql', '20260101000200_friends.sql', '20260101000300_signup_username.sql', '20260101000400_xp.sql', '20260101000500_goals.sql', '20260101000800_friend_today.sql'])
  await db.exec(sql(f).replace('create extension if not exists pg_net;', ''));
console.log('ok   all seven migrations apply cleanly');

const as = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const ok = (name, cond) => { assert.ok(cond, name); console.log('ok  ', name); };
const fails = async (name, p) => { try { await p; } catch (e) { console.log('ok  ', name, '->', e.message.slice(0, 60)); return; } throw new Error('expected failure: ' + name); };
const user = async (e) => (await db.query(`insert into auth.users (email) values ('${e}') returning id`)).rows[0].id;
const A = await user('a@x.com'), B = await user('b@x.com');

await as(A, () => db.exec(`insert into public.day_xp (day, xp) values ('2026-10-24', 45), ('2026-10-25', 120)`));
ok('a user can record their own days (user_id defaults to them)', (await db.query(`select count(*)::int c from public.day_xp where user_id='${A}'`)).rows[0].c === 2);
ok('and read them back', (await as(A, () => db.query(`select sum(xp)::int s from public.day_xp`))).rows[0].s === 165);
ok('another user sees nothing of it', (await as(B, () => db.query(`select * from public.day_xp`))).rows.length === 0);
await fails('another user cannot write rows for A', as(B, () => db.exec(`insert into public.day_xp (user_id, day, xp) values ('${A}', '2026-10-20', 5)`)));
await fails('a day is write-once: duplicate rejected', as(A, () => db.exec(`insert into public.day_xp (day, xp) values ('2026-10-24', 999)`)));
await fails('a recorded day cannot be edited', as(A, () => db.exec(`update public.day_xp set xp = 9999 where day = '2026-10-24'`)));
await fails('a recorded day cannot be deleted', as(A, () => db.exec(`delete from public.day_xp where day = '2026-10-24'`)));
await fails('negative XP rejected', as(A, () => db.exec(`insert into public.day_xp (day, xp) values ('2026-10-01', -1)`)));
await fails('absurd XP rejected', as(A, () => db.exec(`insert into public.day_xp (day, xp) values ('2026-10-02', 10001)`)));
await db.exec(`set role anon`);
await fails('signed-out visitors cannot read it', db.query(`select * from public.day_xp`));
await db.exec(`reset role`);

// friends can see streaks but never XP
await as(A, () => db.query(`select public.set_username('alex')`)); await as(B, () => db.query(`select public.set_username('bella')`));
await as(A, () => db.query(`select public.send_friend_request('bella')`));
const req = (await db.query(`select id from public.friendships`)).rows[0].id;
await as(B, () => db.query(`select public.respond_friend_request('${req}', true)`));
ok('A and B are friends', (await db.query(`select status from public.friendships`)).rows[0].status === 'accepted');
ok('...and a friend still cannot read A\'s XP', (await as(B, () => db.query(`select * from public.day_xp where user_id='${A}'`))).rows.length === 0);
const overview = await as(B, () => db.query(`select public.friends_overview(current_date) o`));
ok('...and it is not in the friends overview either', !JSON.stringify(overview.rows[0].o).toLowerCase().includes('xp'));

await as(A, () => db.query(`select public.delete_my_account()`));
ok('deleting the account removes its XP', (await db.query(`select count(*)::int c from public.day_xp where user_id='${A}'`)).rows[0].c === 0);
console.log('ALL PASSED');
