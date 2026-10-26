// Runs the migration in an in-process Postgres (PGlite) and checks row-level security,
// constraints, triggers and account deletion. Usage:
//   npm i --no-save @electric-sql/pglite && node supabase/tests/rls.test.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import assert from 'assert';

const db = new PGlite();
// --- minimal stand-in for the parts of Supabase the migration relies on
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
`);
await db.exec(fs.readFileSync(new URL('../migrations/20260101000000_init.sql', import.meta.url), 'utf8'));
if (process.env.INIT_ONLY !== '1') await db.exec(fs.readFileSync(new URL('../migrations/20260101000100_grants.sql', import.meta.url), 'utf8'));
console.log('ok   migration applies cleanly');

const as = async (uid, fn) => {           // run as an authenticated user
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const fails = async (name, p) => { try { await p; } catch (e) { console.log('ok  ', name, '->', e.message.slice(0, 60)); return; } throw new Error('expected failure: ' + name); };
const ok = (n, c) => { assert.ok(c, n); console.log('ok  ', n); };

const A = (await db.query(`insert into auth.users (email) values ('a@x.com') returning id`)).rows[0].id;
const B = (await db.query(`insert into auth.users (email) values ('b@x.com') returning id`)).rows[0].id;

ok('profile row is created on sign-up', (await db.query(`select count(*)::int c from public.profiles`)).rows[0].c === 2);

const task = (id, extra = '') => `insert into public.tasks (id, title, start_at, end_at ${extra ? ',' + extra.cols : ''}) values ('${id}', 'T ${id}', now(), now() + interval '1 hour' ${extra ? ',' + extra.vals : ''})`;
await as(A, () => db.exec(task('t1')));
ok('user_id defaults to the signed-in user', (await db.query(`select user_id from public.tasks where id='t1'`)).rows[0].user_id === A);

// isolation
ok('B cannot read A\'s tasks', (await as(B, () => db.query(`select * from public.tasks`))).rows.length === 0);
ok('A can read own tasks', (await as(A, () => db.query(`select * from public.tasks`))).rows.length === 1);
await fails('B cannot insert a row for A', as(B, () => db.exec(`insert into public.tasks (user_id, id, start_at, end_at) values ('${A}', 'evil', now(), now())`)));
const upd = await as(B, () => db.query(`update public.tasks set title='hacked' where id='t1' returning id`));
ok('B cannot update A\'s row (0 rows)', upd.rows.length === 0);
ok('B cannot soft-delete A\'s row', (await as(B, () => db.query(`update public.tasks set deleted_at=now() where id='t1' returning id`))).rows.length === 0);
ok('B cannot read A\'s profile', (await as(B, () => db.query(`select * from public.profiles where id='${A}'`))).rows.length === 0);
await fails('B cannot hand a row to A via update', as(B, async () => { await db.exec(task('b1')); await db.exec(`update public.tasks set user_id='${A}' where id='b1'`); }));

// same task id for two users is fine (composite key)
await as(B, () => db.exec(task('t1')));
ok('two users can use the same task id', (await db.query(`select count(*)::int c from public.tasks where id='t1'`)).rows[0].c === 2);

// anonymous
await db.exec(`set role anon`);
await fails('anon cannot even read tasks (no table privileges)', db.query(`select * from public.tasks`));
await fails('anon cannot insert', db.exec(`insert into public.tasks (user_id, id, start_at, end_at) values ('${A}', 'x', now(), now())`));
await db.exec(`reset role`);

// constraints
await fails('bad kind rejected', as(A, () => db.exec(task('c1', { cols: 'kind', vals: `'weird'` }))));
await fails('bad repeat rejected', as(A, () => db.exec(task('c2', { cols: 'repeats', vals: `'hourly'` }))));
await fails('estimate must be 1..1440', as(A, () => db.exec(task('c3', { cols: 'estimate_minutes', vals: '0' }))));
await fails('items must be an array', as(A, () => db.exec(task('c4', { cols: 'items', vals: `'{"a":1}'::jsonb` }))));
await as(A, () => db.exec(task('c5', { cols: 'items, kind', vals: `'[{"id":"i","text":"Milk","done":false}]'::jsonb, 'checklist'` })));
ok('checklist items stored as jsonb', (await db.query(`select items->0->>'text' t from public.tasks where id='c5'`)).rows[0].t === 'Milk');

// server-side updated_at
const before = (await db.query(`select updated_at from public.tasks where user_id='${A}' and id='t1'`)).rows[0].updated_at;
await new Promise(r => setTimeout(r, 30));
await as(A, () => db.exec(`update public.tasks set title='edited', updated_at='2000-01-01' where id='t1'`));
const after = (await db.query(`select updated_at from public.tasks where user_id='${A}' and id='t1'`)).rows[0].updated_at;
ok('updated_at is server-controlled (client value ignored, moves forward)', after > before && after.getFullYear() > 2000);

// soft delete is just an update
await as(A, () => db.exec(`update public.tasks set deleted_at = now() where id='t1'`));
ok('soft delete visible to owner as a tombstone', (await as(A, () => db.query(`select deleted_at from public.tasks where id='t1'`))).rows[0].deleted_at !== null);

// profiles
await as(A, () => db.exec(`update public.profiles set name='Alex', avatar='🚀' where id='${A}'`));
ok('owner can update own profile', (await db.query(`select name from public.profiles where id='${A}'`)).rows[0].name === 'Alex');
ok('B cannot update A\'s profile', (await as(B, () => db.query(`update public.profiles set name='x' where id='${A}' returning id`))).rows.length === 0);
await fails('profile name length capped', as(A, () => db.exec(`update public.profiles set name='${'x'.repeat(25)}' where id='${A}'`)));

// history is write-once
await as(A, () => db.exec(`insert into public.day_history (day, total, done) values ('2026-10-25', 3, 3)`));
await fails('history: done cannot exceed total', as(A, () => db.exec(`insert into public.day_history (day, total, done) values ('2026-10-24', 1, 2)`)));
await fails('history: duplicate day rejected', as(A, () => db.exec(`insert into public.day_history (day, total, done) values ('2026-10-25', 1, 1)`)));
await fails('history cannot be edited', as(A, () => db.query(`update public.day_history set done=0 where day='2026-10-25' returning day`)));
await fails('history cannot be deleted', as(A, () => db.query(`delete from public.day_history where day='2026-10-25' returning day`)));
ok('B cannot read A\'s history', (await as(B, () => db.query(`select * from public.day_history`))).rows.length === 0);

// account deletion
const bBefore = (await db.query(`select count(*)::int c from public.tasks where user_id='${B}'`)).rows[0].c;
await fails('anon cannot call delete_my_account', (async () => { await db.exec(`set role anon`); try { await db.query(`select public.delete_my_account()`); } finally { await db.exec(`reset role`); } })());
await as(A, () => db.query(`select public.delete_my_account()`));
const left = (await db.query(`select (select count(*) from auth.users where id='${A}')::int u, (select count(*) from public.tasks where user_id='${A}')::int t, (select count(*) from public.profiles where id='${A}')::int p, (select count(*) from public.day_history where user_id='${A}')::int h`)).rows[0];
ok('delete_my_account removes the user and cascades everything', left.u + left.t + left.p + left.h === 0);
ok('...and leaves other users untouched', (await db.query(`select count(*)::int c from public.tasks where user_id='${B}'`)).rows[0].c === bBefore && bBefore > 0);
console.log('ALL PASSED');
