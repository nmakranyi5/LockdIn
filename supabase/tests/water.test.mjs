// Checks the hydration migration: owner-only, editable, bounded, cascades on
// account deletion, and the daily target on the profile.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/water.test.mjs
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
for (const f of ['20260101000000_init.sql', '20260101000100_grants.sql', '20260101000200_friends.sql', '20260101000300_signup_username.sql', '20260101000400_xp.sql', '20260101000500_goals.sql', '20260101000600_water.sql'])
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

await as(A, () => db.exec(`insert into public.water_log (day, glasses) values ('2026-10-24', 5), ('2026-10-25', 8)`));
ok('a user records their own days (user_id defaults to them)', (await db.query(`select count(*)::int c from public.water_log where user_id='${A}'`)).rows[0].c === 2);
ok('and reads them back', (await as(A, () => db.query(`select sum(glasses)::int s from public.water_log`))).rows[0].s === 13);
ok('another user sees nothing of it', (await as(B, () => db.query(`select * from public.water_log`))).rows.length === 0);
await fails('another user cannot write rows for A', as(B, () => db.exec(`insert into public.water_log (user_id, day, glasses) values ('${A}', '2026-10-20', 5)`)));
await as(A, () => db.exec(`insert into public.water_log (day, glasses) values ('2026-10-24', 6) on conflict (user_id, day) do update set glasses = excluded.glasses`));
ok('a day can be edited in place (upsert)', (await db.query(`select glasses from public.water_log where user_id='${A}' and day='2026-10-24'`)).rows[0].glasses === 6);
await as(B, () => db.exec(`update public.water_log set glasses = 99`));
ok("another user's update touches nothing of A's", (await db.query(`select sum(glasses)::int s from public.water_log where user_id='${A}'`)).rows[0].s === 14);
await fails('rows cannot be deleted by clients', as(A, () => db.exec(`delete from public.water_log`)));
ok('...so A still has both days', (await db.query(`select count(*)::int c from public.water_log where user_id='${A}'`)).rows[0].c === 2);
await fails('cannot hand a row to someone else by updating user_id', as(A, () => db.exec(`update public.water_log set user_id = '${B}' where day = '2026-10-24'`)));
await fails('a negative count is rejected', as(A, () => db.exec(`update public.water_log set glasses = -1 where day = '2026-10-24'`)));
await fails('an absurd count is rejected', as(A, () => db.exec(`update public.water_log set glasses = 100 where day = '2026-10-24'`)));
await fails('anon cannot read it', (async () => { await db.exec(`set role anon`); try { await db.query(`select * from public.water_log`); } finally { await db.exec(`reset role`); } })());

ok('the daily target defaults to 8', (await db.query(`select water_goal from public.profiles where id='${A}'`)).rows[0].water_goal === 8);
await as(A, () => db.exec(`update public.profiles set water_goal = 12 where id = '${A}'`));
ok('and can be changed', (await db.query(`select water_goal from public.profiles where id='${A}'`)).rows[0].water_goal === 12);
await fails('a target of 0 is rejected', as(A, () => db.exec(`update public.profiles set water_goal = 0 where id = '${A}'`)));
await fails('a target of 31 is rejected', as(A, () => db.exec(`update public.profiles set water_goal = 31 where id = '${A}'`)));

await as(A, () => db.exec(`select public.delete_my_account()`));
ok('deleting the account removes its water log', (await db.query(`select count(*)::int c from public.water_log where user_id='${A}'`)).rows[0].c === 0);
console.log('ALL PASSED');
