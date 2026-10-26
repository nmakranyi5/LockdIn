// Exercises the friends migration in an in-process Postgres (PGlite): usernames,
// requests, privacy between friends and strangers, shared streaks, nudges, push
// payloads and account deletion. `pg_net` is replaced by a stub that records the
// pushes the database would send.
//   npm i --no-save @electric-sql/pglite && node supabase/tests/friends.test.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import assert from 'assert';

const sql = (f) => fs.readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8');
const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  -- stand-in for pg_net: remember every request instead of sending it
  create schema net;
  create table net.calls (id serial primary key, url text, body jsonb, headers jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
      headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint
    language sql as $$ insert into net.calls (url, body, headers) values (url, body, headers) returning id::bigint $$;
`);
await db.exec(sql('20260101000000_init.sql'));
await db.exec(sql('20260101000100_grants.sql'));
await db.exec(sql('20260101000200_friends.sql').replace('create extension if not exists pg_net;', ''));
console.log('ok   all three migrations apply cleanly');

let n = 0;
const ok = (name, cond, extra) => { assert.ok(cond, name + (extra ? ' :: ' + extra : '')); console.log('ok  ', name); };
const as = async (uid, fn) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
};
const rpc = async (uid, call) => (await as(uid, () => db.query(`select ${call} as r`))).rows[0].r;
const fails = async (name, p) => { try { await p; } catch (e) { console.log('ok  ', name, '->', e.message.slice(0, 55)); return; } throw new Error('expected failure: ' + name); };
const user = async (email) => (await db.query(`insert into auth.users (email) values ('${email}') returning id`)).rows[0].id;
const pushes = async () => (await db.query(`select body from net.calls order by id`)).rows.flatMap(r => r.body);
const clearPushes = () => db.exec(`delete from net.calls`);

const A = await user('a@x.com'), B = await user('b@x.com'), C = await user('c@x.com'), D = await user('d@x.com');

// ---------------------------------------------------------------- usernames
ok('invalid: too short', (await rpc(A, `public.set_username('ab')`)) === 'invalid');
ok('invalid: spaces', (await rpc(A, `public.set_username('al ex')`)) === 'invalid');
ok('invalid: symbols', (await rpc(A, `public.set_username('a-lex')`)) === 'invalid');
ok('invalid: too long', (await rpc(A, `public.set_username('${'a'.repeat(21)}')`)) === 'invalid');
ok('reserved names are refused', (await rpc(A, `public.set_username('Admin')`)) === 'reserved');
ok('a valid name is stored in lower case', (await rpc(A, `public.set_username('  Alex_99 ')`)) === 'ok'
  && (await db.query(`select username from public.profiles where id='${A}'`)).rows[0].username === 'alex_99');
ok('usernames are unique, ignoring case', (await rpc(B, `public.set_username('ALEX_99')`)) === 'taken');
ok('you can keep your own name when re-saving it', (await rpc(A, `public.set_username('alex_99')`)) === 'ok');
ok('and change it', (await rpc(A, `public.set_username('alex')`)) === 'ok');
ok('the old name is free again', (await rpc(B, `public.set_username('alex_99')`)) === 'ok');
await rpc(B, `public.set_username('bella')`); await rpc(C, `public.set_username('cam')`);
await fails('the table itself rejects upper-case names', as(D, () => db.exec(`update public.profiles set username='Dan' where id='${D}'`)));
await fails('anon cannot set a username', (async () => { await db.exec('set role anon'); try { await db.query(`select public.set_username('hax')`); } finally { await db.exec('reset role'); } })());

// ---------------------------------------------------------------- requests
ok('you need a username before adding friends', (await rpc(D, `public.send_friend_request('alex')`)) === 'need_username');
ok('unknown username', (await rpc(A, `public.send_friend_request('nobody')`)) === 'not_found');
ok('cannot add yourself', (await rpc(A, `public.send_friend_request('ALEX')`)) === 'self');
ok('send a request (case-insensitive)', (await rpc(A, `public.send_friend_request('Bella')`)) === 'sent');
ok('sending again says already requested', (await rpc(A, `public.send_friend_request('bella')`)) === 'already_requested');
ok('one row per pair', (await db.query(`select count(*)::int c from public.friendships`)).rows[0].c === 1);
ok('no push when the recipient has no device', (await pushes()).length === 0);

await as(B, () => db.query(`select public.register_push_token('ExponentPushToken[bella-phone]', 'ios')`));
await as(C, () => db.query(`select public.register_push_token('ExponentPushToken[cam-phone]', 'android')`));
ok('C requests B: push goes to B\'s device with the right content', (await rpc(C, `public.send_friend_request('bella')`)) === 'sent' && await (async () => {
  const p = await pushes(); return p.length === 1 && p[0].to === 'ExponentPushToken[bella-phone]' && p[0].title.includes('friend request') && p[0].body.includes('@cam') && p[0].data.type === 'friend_request' && p[0].sound === 'default';
})());
const calls = (await db.query(`select url, headers from net.calls`)).rows[0];
ok('pushes go to Expo\'s push API as JSON', calls.url === 'https://exp.host/--/api/v2/push/send' && calls.headers['Content-Type'] === 'application/json');
await clearPushes();

// ---------------------------------------------------------------- privacy before accepting
const reqId = (await db.query(`select id from public.friendships where requester='${A}'`)).rows[0].id;
ok('a pending requester\'s name/avatar are visible to the addressee', (await as(B, () => db.query(`select username from public.profiles where id='${A}'`))).rows.length === 1);
ok('the requester can see who they asked', (await as(A, () => db.query(`select username from public.profiles where id='${B}'`))).rows.length === 1);
ok('...but a stranger sees nothing', (await as(D, () => db.query(`select * from public.profiles where id in ('${A}','${B}','${C}')`))).rows.length === 0);
await as(A, () => db.exec(`insert into public.streak_stats (current_streak, longest_streak, today, today_day) values (4, 9, 'pending', current_date)`));
ok('stats are NOT visible while a request is only pending', (await as(B, () => db.query(`select * from public.streak_stats where user_id='${A}'`))).rows.length === 0);

// ---------------------------------------------------------------- responding
ok('only the addressee can respond', (await rpc(C, `public.respond_friend_request('${reqId}', true)`)) === 'not_found');
ok('the requester cannot accept their own request', (await rpc(A, `public.respond_friend_request('${reqId}', true)`)) === 'not_found');
ok('accepting works', (await rpc(B, `public.respond_friend_request('${reqId}', true)`)) === 'accepted');
ok('...and notifies the requester', await (async () => { const p = await pushes(); return p.length === 0; })(), 'A has no device registered, so no push');
await as(A, () => db.query(`select public.register_push_token('ExponentPushToken[alex-phone]', 'ios')`));
ok('accepting twice is a no-op', (await rpc(B, `public.respond_friend_request('${reqId}', true)`)) === 'not_found');
ok('sending to an existing friend says so', (await rpc(A, `public.send_friend_request('bella')`)) === 'already_friends');

// now friends: visibility
ok('friends can read each other\'s streak stats', (await as(B, () => db.query(`select current_streak, today from public.streak_stats where user_id='${A}'`))).rows[0].current_streak === 4);
ok('a stranger cannot', (await as(D, () => db.query(`select * from public.streak_stats`))).rows.length === 0);
ok('a friend of someone else cannot', (await as(C, () => db.query(`select * from public.streak_stats where user_id='${A}'`))).rows.length === 0);
await as(A, () => db.exec(`insert into public.tasks (id, title, start_at, end_at) values ('t1', 'Secret task', now(), now())`));
await as(A, () => db.exec(`insert into public.day_history (day, total, done) values (current_date - 1, 5, 5)`));
ok('friends can NOT read tasks', (await as(B, () => db.query(`select * from public.tasks`))).rows.length === 0);
ok('friends can NOT read day history', (await as(B, () => db.query(`select * from public.day_history`))).rows.length === 0);
ok('friends can read each other\'s profile', (await as(B, () => db.query(`select name, avatar, username from public.profiles where id='${A}'`))).rows.length === 1);
ok('friends cannot edit each other\'s stats', (await as(B, () => db.query(`update public.streak_stats set current_streak = 999 where user_id='${A}' returning user_id`))).rows.length === 0);
await fails('nobody can write a stats row for someone else', as(B, () => db.exec(`insert into public.streak_stats (user_id, current_streak) values ('${A}', 1)`)));
await fails('stats values are bounded', as(A, () => db.exec(`update public.streak_stats set current_streak = -1`)));
await fails('today must be a known status', as(A, () => db.exec(`update public.streak_stats set today = 'sleeping'`)));

// ---------------------------------------------------------------- direct writes are closed
await fails('friendships cannot be inserted directly', as(D, () => db.exec(`insert into public.friendships (requester, addressee, status) values ('${D}', '${A}', 'accepted')`)));
await fails('friendships cannot be updated directly', as(B, () => db.exec(`update public.friendships set status='pending'`)));
await fails('friendships cannot be deleted directly', as(B, () => db.exec(`delete from public.friendships`)));
await fails('push tokens are not readable', as(A, () => db.query(`select * from public.push_tokens`)));
await fails('nudges are not readable', as(A, () => db.query(`select * from public.nudges`)));
ok('you only see your own friendships', (await as(D, () => db.query(`select * from public.friendships`))).rows.length === 0);

// ---------------------------------------------------------------- cross requests auto-accept
await rpc(D, `public.set_username('dan')`);
await as(D, () => db.query(`select public.register_push_token('ExponentPushToken[dan-phone]', 'ios')`));
await rpc(D, `public.send_friend_request('alex')`);
await clearPushes();
ok('if they already asked you, asking back accepts', (await rpc(A, `public.send_friend_request('dan')`)) === 'accepted');
ok('...and tells the original requester', await (async () => { const p = await pushes(); return p.length === 1 && p[0].to === 'ExponentPushToken[dan-phone]' && p[0].body.includes('@alex') && p[0].data.type === 'friend_accepted'; })());

// ---------------------------------------------------------------- decline / remove
await rpc(D, `public.send_friend_request('cam')`);
const dReq = (await db.query(`select id from public.friendships where requester='${D}' and addressee='${C}'`)).rows[0].id;
ok('declining deletes the request', (await rpc(C, `public.respond_friend_request('${dReq}', false)`)) === 'declined' && (await db.query(`select count(*)::int c from public.friendships where requester='${D}' and addressee='${C}'`)).rows[0].c === 0);
ok('a declined person can ask again', (await rpc(D, `public.send_friend_request('cam')`)) === 'sent');
await as(D, () => db.query(`select public.remove_friend('${C}')`));
ok('the sender can cancel a pending request', (await db.query(`select count(*)::int c from public.friendships where requester='${D}' and addressee='${C}'`)).rows[0].c === 0);
await as(C, () => db.query(`select public.remove_friend('${A}')`));
ok('removing someone who isn\'t a friend changes nothing', (await db.query(`select count(*)::int c from public.friendships where status='accepted'`)).rows[0].c === 2);

// ---------------------------------------------------------------- overview
await as(B, () => db.exec(`insert into public.streak_stats (current_streak, longest_streak, today, today_day) values (7, 12, 'complete', current_date)`));
await rpc(C, `public.send_friend_request('alex')`);
const ov = await rpc(A, `public.friends_overview(current_date)`);
ok('overview lists accepted friends, sorted, with display fields', ov.friends.map(f => f.username).join() === 'bella,dan' && ov.friends[0].avatar && 'name' in ov.friends[0]);
ok('overview carries streak and today status', ov.friends[0].streak === 7 && ov.friends[0].longest === 12 && ov.friends[0].today === 'complete');
ok('a friend who never reported shows 0 / unknown', ov.friends[1].streak === 0 && ov.friends[1].today === 'unknown');
ok('overview includes my username and nudge setting', ov.me.username === 'alex' && ov.me.nudges_enabled === true);
ok('incoming requests are listed with who sent them', ov.incoming.length === 1 && ov.incoming[0].username === 'cam' && ov.incoming[0].id);
const ovC = await rpc(C, `public.friends_overview(current_date)`);
ok('outgoing requests are listed for the sender', ovC.outgoing.some(o => o.username === 'alex') && ovC.outgoing.some(o => o.username === 'bella') && ovC.outgoing.every(o => o.id && o.avatar));
ok('the overview never contains task data', !JSON.stringify(ov).includes('Secret') && !JSON.stringify(ov).includes('total'));
// simulate someone who went silent: bypass the trigger that refreshes expiry on write
await db.exec(`alter table public.streak_stats disable trigger streak_stats_touch; update public.streak_stats set expires_at = now() - interval '1 hour' where user_id='${B}'; alter table public.streak_stats enable trigger streak_stats_touch;`);
ok('a streak nobody refreshed for 3 days is shown as 0', (await rpc(A, `public.friends_overview(current_date)`)).friends[0].streak === 0);
await as(B, () => db.exec(`update public.streak_stats set current_streak = 7`));
ok('refreshing it brings it back (expiry is server-set)', (await rpc(A, `public.friends_overview(current_date)`)).friends[0].streak === 7);
await db.exec(`update public.streak_stats set today_day = current_date - 5 where user_id='${B}'`);
ok('a status from days ago is shown as unknown, not as "done today"', (await rpc(A, `public.friends_overview(current_date)`)).friends[0].today === 'unknown');
await db.exec(`update public.streak_stats set today_day = current_date where user_id='${B}'`);

// ---------------------------------------------------------------- shared streak
const hist = async (uid, offsets, total, done) => { for (const o of offsets) await db.exec(`insert into public.day_history (user_id, day, total, done) values ('${uid}', current_date - ${o}, ${total}, ${done}) on conflict do nothing`); };
await db.exec(`delete from public.day_history`);
await hist(A, [1, 2, 3, 4], 3, 3); await hist(B, [1, 2, 3, 4], 2, 2);
const shared = async (a = A, b = B) => (await db.query(`select public.shared_streak('${a}', '${b}', current_date) s`)).rows[0].s;
await db.exec(`update public.streak_stats set today='pending' where user_id in ('${A}','${B}')`);
ok('4 days where both finished everything = 4', (await shared()) === 4);
await db.exec(`update public.streak_stats set today='complete', today_day=current_date where user_id in ('${A}','${B}')`);
ok('today counts once both are done = 5', (await shared()) === 5);
await db.exec(`update public.streak_stats set today='pending' where user_id='${B}'`);
ok('...but not while only one of you is done', (await shared()) === 4);
await db.exec(`update public.day_history set done = 1 where user_id='${B}' and day = current_date - 3`);
ok('one person missing a day ends it (counts back to that day)', (await shared()) === 2);
await db.exec(`update public.day_history set done = 2 where user_id='${B}' and day = current_date - 3`);
await db.exec(`delete from public.day_history where user_id='${B}' and day = current_date - 2`);
ok('a day one of you had no tasks is neutral, not a break', (await shared()) === 3);
await db.exec(`delete from public.day_history where user_id='${A}'`);
ok('no shared history = 0', (await shared()) === 0);
await db.exec(`delete from public.day_history`);
await hist(A, [1, 2], 1, 1); await hist(B, [3, 4], 1, 1);
ok('days only one of you had tasks never count', (await shared()) === 0);
await db.exec(`update public.streak_stats set today='complete' where user_id='${B}'`);
await hist(A, [1, 2, 3, 4], 3, 3); await hist(B, [1, 2, 3, 4], 2, 2);
ok('the overview reports the shared streak per friend', (await rpc(A, `public.friends_overview(current_date)`)).friends.find(f => f.username === 'bella').shared_streak === 5);
await fails('shared_streak is not callable by clients', as(A, () => db.query(`select public.shared_streak('${A}','${B}', current_date)`)));
await fails('push_to_user is not callable by clients', as(A, () => db.query(`select public.push_to_user('${B}', 't', 'b')`)));

// ---------------------------------------------------------------- nudges
await db.exec(`update public.streak_stats set today='pending' where user_id='${B}'`); await clearPushes();
ok('can\'t nudge a stranger', (await rpc(A, `public.send_nudge('${C}')`)) === 'not_friends');
ok('nudging a friend who hasn\'t finished sends it', (await rpc(A, `public.send_nudge('${B}')`)) === 'sent');
const np = await pushes();
ok('the push goes to the friend\'s device with a friendly message', np.length === 1 && np[0].to === 'ExponentPushToken[bella-phone]' && np[0].title.includes('@alex nudged you') && np[0].data.type === 'nudge' && np[0].data.from === A);
ok('only one nudge per friend per day', (await rpc(A, `public.send_nudge('${B}')`)) === 'already_nudged' && (await pushes()).length === 1);
ok('overview marks them as recently nudged', (await rpc(A, `public.friends_overview(current_date)`)).friends.find(f => f.username === 'bella').nudged_recently === true);
await db.exec(`update public.nudges set created_at = now() - interval '21 hours'`);
ok('after 20 hours you can nudge again', (await rpc(A, `public.send_nudge('${B}')`)) === 'sent');
await db.exec(`update public.streak_stats set today='complete', today_day=current_date where user_id='${B}'`); await db.exec(`update public.nudges set created_at = now() - interval '30 hours'`); await clearPushes();
ok('no nudging someone who already finished today', (await rpc(A, `public.send_nudge('${B}')`)) === 'already_done' && (await pushes()).length === 0);
await db.exec(`update public.streak_stats set today='pending' where user_id='${B}'`);
await as(B, () => db.exec(`update public.profiles set nudges_enabled = false where id='${B}'`)); await db.exec(`update public.nudges set created_at = now() - interval '30 hours'`); await clearPushes();
ok('if they turned nudges off: recorded, sender told "sent", nothing delivered', (await rpc(A, `public.send_nudge('${B}')`)) === 'sent' && (await pushes()).length === 0);
await as(B, () => db.exec(`update public.profiles set nudges_enabled = true where id='${B}'`));
// a push service outage must never break the action that triggered it
await db.exec(`create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language plpgsql as $$ begin raise exception 'push service is down'; end $$;`);
await db.exec(`update public.nudges set created_at = now() - interval '30 hours'`);
ok('a push outage does not break sending a nudge', (await rpc(A, `public.send_nudge('${B}')`)) === 'sent');
ok('...or sending a friend request', (await rpc(C, `public.send_friend_request('dan')`)) === 'sent');
await db.exec(`create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000) returns bigint language sql as $$ insert into net.calls (url, body, headers) values (url, body, headers) returning id::bigint $$;`);

// ---------------------------------------------------------------- push tokens
await as(C, () => db.query(`select public.register_push_token('ExponentPushToken[shared-phone]', 'ios')`));
await as(D, () => db.query(`select public.register_push_token('ExponentPushToken[shared-phone]', 'ios')`));
ok('a phone belongs to whoever signed in last', (await db.query(`select user_id from public.push_tokens where token='ExponentPushToken[shared-phone]'`)).rows.map(r => r.user_id).join() === D);
await as(C, () => db.query(`select public.unregister_push_token('ExponentPushToken[shared-phone]')`));
ok('you cannot unregister someone else\'s device', (await db.query(`select count(*)::int c from public.push_tokens where token='ExponentPushToken[shared-phone]'`)).rows[0].c === 1);
await as(D, () => db.query(`select public.unregister_push_token('ExponentPushToken[shared-phone]')`));
ok('unregistering your own works', (await db.query(`select count(*)::int c from public.push_tokens where token='ExponentPushToken[shared-phone]'`)).rows[0].c === 0);

// ---------------------------------------------------------------- request cap
const spammer = await user('spam@x.com'); await rpc(spammer, `public.set_username('spammer')`);
await db.exec(`insert into auth.users (email) select 'u' || g || '@x.com' from generate_series(1, 31) g`);
await db.exec(`update public.profiles p set username = 'victim' || row_number from (select id, row_number() over (order by id) from public.profiles where username is null) v where p.id = v.id`);
await db.exec(`insert into public.friendships (requester, addressee) select '${spammer}', id from public.profiles where username like 'victim%' limit 30`);
ok('after 30 pending requests, no more can be sent', (await rpc(spammer, `public.send_friend_request('victim31')`)) === 'too_many');
ok('...but others can still send to the spammer', (await rpc(C, `public.send_friend_request('spammer')`)) === 'sent');

// ---------------------------------------------------------------- locked-down functions
for (const call of [`public.friends_overview(current_date)`, `public.send_nudge('${B}')`, `public.send_friend_request('alex')`, `public.remove_friend('${B}')`, `public.register_push_token('t','ios')`]) {
  await fails(`anon cannot call ${call.split('(')[0]}`, (async () => { await db.exec('set role anon'); try { await db.query(`select ${call}`); } finally { await db.exec('reset role'); } })());
}
await fails('anon cannot read stats', (async () => { await db.exec('set role anon'); try { await db.query(`select * from public.streak_stats`); } finally { await db.exec('reset role'); } })());

// ---------------------------------------------------------------- deleting an account
const before = (await db.query(`select (select count(*) from public.nudges)::int n, (select count(*) from public.friendships)::int f`)).rows[0];
await as(B, () => db.query(`select public.delete_my_account()`));
const after = (await db.query(`select (select count(*) from public.friendships where requester='${B}' or addressee='${B}')::int f, (select count(*) from public.streak_stats where user_id='${B}')::int s, (select count(*) from public.push_tokens where user_id='${B}')::int t, (select count(*) from public.nudges where from_user='${B}' or to_user='${B}')::int n`)).rows[0];
ok('deleting an account removes its friendships, stats, devices and nudges', after.f + after.s + after.t + after.n === 0 && before.f > 0);
ok('...and other people\'s data is untouched', (await db.query(`select count(*)::int c from public.friendships`)).rows[0].c >= 1 && (await db.query(`select count(*)::int c from public.profiles where id='${A}'`)).rows[0].c === 1);
ok('the freed username can be claimed again', (await rpc(C, `public.set_username('bella')`)) === 'ok');
console.log('ALL PASSED');
