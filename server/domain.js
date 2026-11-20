'use strict';
/**
 * Shared vocabulary, geo and time helpers.
 */

const LEVELS = ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert'];
const MATCH_LEVELS = ['Tous niveaux', ...LEVELS];
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const SLOTS = [
  { id: 'matin', label: 'Matin (08h - 12h)' },
  { id: 'midi', label: 'Midi (12h - 14h)' },
  { id: 'apresmidi', label: 'Après-midi (14h - 18h)' },
  { id: 'soir', label: 'Soir (18h - 22h)' },
];
const SLOT_IDS = SLOTS.map((s) => s.id);
const MATCH_DURATIONS = [45, 60, 90, 120];
const TIME_ZONE = 'Europe/Brussels';

/** Star rating shown next to a level (one consistent mapping, 2..5). */
function levelRating(level) {
  return { 'Débutant': 2, 'Intermédiaire': 3, 'Confirmé': 4, 'Expert': 5 }[level] || 3;
}

/** Great-circle distance in km, one decimal. */
function distanceKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/** Offset (ms) between the wall clock in `tz` and UTC at instant `ts`. */
function tzOffsetMs(ts, tz = TIME_ZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(ts)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - ts;
}

/** Brussels wall-clock date + time -> Date (UTC instant). */
function brusselsToDate(ymd, hhmm) {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - tzOffsetMs(guess);
  ts = guess - tzOffsetMs(ts); // second pass handles DST edges
  return new Date(ts);
}

/** Today's date in Brussels, shifted by `days`, as YYYY-MM-DD. */
function brusselsYmd(days = 0, from = Date.now()) {
  const ts = from + tzOffsetMs(from) + days * 86400000;
  return new Date(ts).toISOString().slice(0, 10);
}

/** Day index (0 = Monday) of a Brussels YYYY-MM-DD date. */
function weekdayIndex(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

module.exports = {
  LEVELS, MATCH_LEVELS, DAYS, SLOTS, SLOT_IDS, MATCH_DURATIONS, TIME_ZONE,
  levelRating, distanceKm, brusselsToDate, brusselsYmd, weekdayIndex,
};
