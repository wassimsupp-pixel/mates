'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../server/db');
const { seed, DEMO_EMAIL } = require('../server/seed');
const { createApp } = require('../server/app');
const { brusselsYmd } = require('../server/domain');

const DEMO_PASSWORD = 'test-password-123';
let server; let base; let ids;

before(async () => {
  const db = openDatabase(':memory:');
  ({ userIds: ids } = seed(db, { demoPassword: DEMO_PASSWORD }));
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

/** Tiny client keeping one cookie jar per "browser". */
function client() {
  let cookie = '';
  return async (method, path, body, { csrf = true } = {}) => {
    const headers = { 'Content-Type': 'application/json' };
    if (csrf) headers['X-Mates'] = '1';
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await res.json();
    return { status: res.status, data };
  };
}

async function loggedInDemo() {
  const c = client();
  const r = await c('POST', '/auth/login', { email: DEMO_EMAIL, password: DEMO_PASSWORD });
  assert.equal(r.status, 200);
  return c;
}

test('sports catalogue has 14 sports with computed counts', async () => {
  const { data } = await client()('GET', '/sports');
  assert.equal(data.length, 14);
  const padel = data.find((s) => s.id === 'padel');
  assert.ok(padel.venuesCount >= 2);
  assert.ok(padel.activeMatesCount >= 5);
});

test('anonymous visitors are not logged in', async () => {
  const { data } = await client()('GET', '/auth/me');
  assert.equal(data.user, null);
});

test('login rejects a wrong password and seeded mates cannot sign in', async () => {
  const c = client();
  assert.equal((await c('POST', '/auth/login', { email: DEMO_EMAIL, password: 'wrong-password' })).status, 401);
  assert.equal((await c('POST', '/auth/login', { email: 'thomas.lambert@mates.test', password: '' })).status, 401);
});

test('state-changing requests without the CSRF header are refused', async () => {
  const r = await client()('POST', '/auth/login', { email: DEMO_EMAIL, password: DEMO_PASSWORD }, { csrf: false });
  assert.equal(r.status, 403);
});

test('register, read me, logout', async () => {
  const c = client();
  const short = await c('POST', '/auth/register', { email: 'new@mates.test', password: 'short', firstName: 'Nina' });
  assert.equal(short.status, 400);
  const r = await c('POST', '/auth/register', { email: 'New@Mates.test', password: 'long-enough-pw', firstName: 'Nina', lastName: 'Roy' });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.email, 'new@mates.test');
  assert.equal((await c('POST', '/auth/register', { email: 'new@mates.test', password: 'long-enough-pw', firstName: 'X' })).status, 409);
  assert.equal((await c('GET', '/auth/me')).data.user.firstName, 'Nina');
  await c('POST', '/auth/logout');
  assert.equal((await c('GET', '/auth/me')).data.user, null);
});

test('level filter applies to the selected sport (original bug)', async () => {
  // Camille: Tennis Expert, Padel Intermédiaire -> must NOT appear for Padel + Expert.
  const { data } = await client()('GET', '/mates?sport=padel&level=Expert');
  const names = data.map((m) => m.firstName);
  assert.ok(names.includes('Elena'));
  assert.ok(!names.includes('Camille'));
});

test('city filter ignores accents and case', async () => {
  const { data } = await client()('GET', '/mates?city=liege');
  assert.ok(data.length > 0);
  assert.ok(data.every((m) => m.city === 'Liège'));
});

test('the logged-in user is excluded from search and gets distances', async () => {
  const c = await loggedInDemo();
  const { data } = await c('GET', '/mates');
  assert.ok(!data.some((m) => m.id === ids.Alexandre));
  assert.ok(data.every((m) => typeof m.distanceKm === 'number'));
});

test('profile update is validated and persisted', async () => {
  const c = await loggedInDemo();
  const bad = await c('PUT', '/me', { firstName: 'A', city: 'Liège', sports: [{ id: 'golf', level: 'Expert' }] });
  assert.equal(bad.status, 400);
  const badUrl = await c('PUT', '/me', { firstName: 'A', city: 'Liège', avatarUrl: 'javascript:alert(1)', sports: [] });
  assert.equal(badUrl.status, 400);
  const ok = await c('PUT', '/me', {
    firstName: '<b>Alex</b>', lastName: 'Deville', age: 24, city: 'Namur', bio: 'Salut',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde', lat: 50.4674, lng: 4.872,
    sports: [{ id: 'squash', level: 'Expert' }, { id: 'padel', level: 'Débutant' }],
    availability: { Lundi: ['soir', 'matin'], Samedi: ['midi'] },
  });
  assert.equal(ok.status, 200);
  const me = (await c('GET', '/mates/me')).data;
  assert.equal(me.firstName, '<b>Alex</b>'); // stored as text; the UI escapes it
  assert.equal(me.city, 'Namur');
  assert.deepEqual(me.sports.map((s) => [s.id, s.level, s.rating]), [['squash', 'Expert', 5], ['padel', 'Débutant', 2]]);
  assert.deepEqual(me.availability.Lundi, ['matin', 'soir']);
});

test('joining: no double join, no joining a full match, leave works', async () => {
  const c = await loggedInDemo();
  const list = (await c('GET', '/matches')).data;
  const tennis = list.find((m) => m.sport.id === 'tennis'); // 1 of 2 slots taken
  const j1 = await c('POST', `/matches/${tennis.id}/join`);
  assert.equal(j1.status, 200);
  assert.equal(j1.data.bookedSlots, 2);
  assert.equal(j1.data.joined, true);
  assert.equal((await c('POST', `/matches/${tennis.id}/join`)).status, 409);

  // Now full: a second user must be refused.
  const other = client();
  await other('POST', '/auth/register', { email: 'other@mates.test', password: 'long-enough-pw', firstName: 'Zoé' });
  const full = await other('POST', `/matches/${tennis.id}/join`);
  assert.equal(full.status, 409);
  assert.match(full.data.error, /complet/);

  const left = await c('POST', `/matches/${tennis.id}/leave`);
  assert.equal(left.data.bookedSlots, 1);
  assert.equal((await other('POST', `/matches/${tennis.id}/join`)).status, 200);
});

test('anonymous users cannot join', async () => {
  const list = (await client()('GET', '/matches')).data;
  assert.equal((await client()('POST', `/matches/${list[0].id}/join`)).status, 401);
});

test('creating a match books the court and blocks overlaps', async () => {
  const c = await loggedInDemo();
  const venues = (await c('GET', '/venues?sport=squash')).data;
  const court = venues[0].courts[0];
  const date = brusselsYmd(3);
  const body = { courtId: court.id, date, time: '18:00', durationMin: 60, totalSlots: 2, levelRequired: 'Tous niveaux' };
  const created = await c('POST', '/matches', body);
  assert.equal(created.status, 201);
  assert.equal(created.data.bookedSlots, 1);
  assert.equal(created.data.isHost, true);
  assert.equal(created.data.priceCents, Math.ceil(court.pricePerHourCents / 2));

  const overlap = await c('POST', '/matches', { ...body, time: '18:30' });
  assert.equal(overlap.status, 409);

  const slots = (await c('GET', `/courts/${court.id}/slots?date=${date}&duration=60`)).data.slots;
  assert.equal(slots.find((s) => s.time === '18:00').free, false);
  assert.equal(slots.find((s) => s.time === '19:00').free, true);

  assert.equal((await c('POST', '/matches', { ...body, time: '21:30' })).status, 400); // past closing time
  assert.equal((await c('POST', '/matches', { ...body, date: brusselsYmd(-1) })).status, 400); // in the past

  assert.equal((await c('POST', `/matches/${created.data.id}/leave`)).status, 409); // host cannot leave
  assert.equal((await c('DELETE', `/matches/${created.data.id}`)).status, 200);
  assert.equal((await c('POST', '/matches', body)).status, 201); // slot free again after cancel
});

test('invitations: send, list, respond once, no self-invite', async () => {
  const c = await loggedInDemo();
  const date = brusselsYmd(2);
  assert.equal((await c('POST', '/invitations', { toUserId: ids.Alexandre, sportId: 'padel', date, slot: 'soir' })).status, 400);
  const sent = await c('POST', '/invitations', { toUserId: ids.Thomas, sportId: 'padel', date, slot: 'soir', message: 'Partant ?' });
  assert.equal(sent.status, 201);
  assert.equal((await c('POST', '/invitations', { toUserId: ids.Thomas, sportId: 'padel', date, slot: 'soir' })).status, 409);

  // Register someone, get invited by the demo user, respond.
  const bob = client();
  const reg = await bob('POST', '/auth/register', { email: 'bob@mates.test', password: 'long-enough-pw', firstName: 'Bob' });
  const inv = await c('POST', '/invitations', { toUserId: reg.data.user.id, sportId: 'tennis', date, slot: 'matin' });
  const inbox = (await bob('GET', '/invitations')).data;
  assert.equal(inbox.received.length, 1);
  assert.equal(inbox.received[0].from.id, ids.Alexandre);
  assert.match(inbox.received[0].from.name, / D\.$/); // first name + last initial only
  assert.equal((await c('POST', `/invitations/${inv.data.id}/respond`, { response: 'accepted' })).status, 404); // not the recipient
  assert.equal((await bob('POST', `/invitations/${inv.data.id}/respond`, { response: 'accepted' })).status, 200);
  assert.equal((await bob('POST', `/invitations/${inv.data.id}/respond`, { response: 'declined' })).status, 409);
});

test('unknown API routes and bad ids return JSON errors', async () => {
  const c = client();
  assert.equal((await c('GET', '/nope')).status, 404);
  assert.equal((await c('GET', '/mates/abc')).status, 404);
  assert.equal((await c('GET', '/mates/99999')).status, 404);
});
