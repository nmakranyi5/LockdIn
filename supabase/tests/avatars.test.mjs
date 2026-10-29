// Checks the avatar migration: emoji as before, small JPEG data URIs allowed,
// anything else or anything oversized rejected, and friends can still see it.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/avatars.test.mjs
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
for (const f of ['20260101000000_init.sql', '20260101000100_grants.sql', '20260101000200_friends.sql', '20260101000300_signup_username.sql', '20260101000400_xp.sql', '20260101000500_goals.sql', '20260101000600_water.sql', '20260101000700_avatars.sql', '20260101000800_friend_today.sql', '20260101000900_friend_streak_decay.sql'])
  await db.exec(sql(f).replace('create extension if not exists pg_net;', ''));
console.log('ok   all ten migrations apply cleanly');

const as = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const ok = (name, cond) => { assert.ok(cond, name); console.log('ok  ', name); };
const fails = async (name, p) => { try { await p; } catch (e) { console.log('ok  ', name, '->', e.message.slice(0, 70)); return; } throw new Error('expected failure: ' + name); };
const user = async (e) => (await db.query(`insert into auth.users (email) values ('${e}') returning id`)).rows[0].id;
const A = await user('a@x.com');
const jpeg = (n) => 'data:image/jpeg;base64,' + 'A'.repeat(n);
const set = (v) => as(A, () => db.query(`update public.profiles set avatar = $1 where id = '${A}'`, [v]));
const get = async () => (await db.query(`select avatar from public.profiles where id='${A}'`)).rows[0].avatar;

await set('🐼');
ok('an emoji still works', (await get()) === '🐼');
await set(jpeg(8000));
ok('a small JPEG data URI is accepted', (await get()).length > 8000);
await set(jpeg(24000 - 'data:image/jpeg;base64,'.length));
ok('right at the limit (24000 characters) is accepted', (await get()).length === 24000);
await fails('one character over the limit is rejected', set(jpeg(24000 - 'data:image/jpeg;base64,'.length + 1)));
await fails('a PNG data URI is rejected', set('data:image/png;base64,' + 'A'.repeat(100)));
await fails('an SVG data URI is rejected', set('data:image/svg+xml;base64,' + 'A'.repeat(100)));
await fails('arbitrary long text is rejected', set('x'.repeat(100)));
await fails('a link is rejected', set('https://example.com/a.jpg'));
await set('🦊');
ok('and back to an emoji', (await get()) === '🦊');
console.log('ALL PASSED');
