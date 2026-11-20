'use strict';
/**
 * Express application: JSON API under /api plus the static front-end.
 */
const path = require('node:path');
const express = require('express');
const { tx } = require('./db');
const {
  HttpError, hashPassword, verifyPassword, createSession, destroySession,
  loadUser, requireAuth, csrfGuard, rateLimit,
} = require('./auth');
const {
  LEVELS, MATCH_LEVELS, DAYS, SLOTS, SLOT_IDS, MATCH_DURATIONS, TIME_ZONE,
  levelRating, distanceKm, brusselsToDate, brusselsYmd,
} = require('./domain');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const LUCIDE = path.join(__dirname, '..', 'node_modules', 'lucide', 'dist', 'umd', 'lucide.min.js');

// ---------------------------------------------------------------- validation
function str(value, field, { min = 0, max = 200, required = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, `Le champ « ${field} » est obligatoire.`);
    return '';
  }
  if (typeof value !== 'string') throw new HttpError(400, `Le champ « ${field} » est invalide.`);
  const v = value.trim();
  if (required && !v) throw new HttpError(400, `Le champ « ${field} » est obligatoire.`);
  if (v.length < min) throw new HttpError(400, `« ${field} » doit contenir au moins ${min} caractères.`);
  if (v.length > max) throw new HttpError(400, `« ${field} » ne peut pas dépasser ${max} caractères.`);
  return v;
}
function int(value, field, { min, max }) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(400, `« ${field} » doit être un entier entre ${min} et ${max}.`);
  return n;
}
function oneOf(value, field, allowed) {
  if (!allowed.includes(value)) throw new HttpError(400, `« ${field} » est invalide.`);
  return value;
}
function ymd(value, field) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `« ${field} » doit être une date AAAA-MM-JJ.`);
  }
  return value;
}
function httpsUrl(value, field) {
  const v = str(value, field, { max: 500 });
  if (!v) return null;
  let u;
  try { u = new URL(v); } catch { throw new HttpError(400, `« ${field} » doit être une URL valide.`); }
  if (u.protocol !== 'https:') throw new HttpError(400, `« ${field} » doit commencer par https://`);
  return u.toString();
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const idParam = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'Introuvable.');
  return n;
};

/**
 * @param db         node:sqlite database
 * @param trustProxy honour X-Forwarded-* (Render/Railway sit behind a proxy)
 * @param demo       {email, password} shown on the login page, or null to hide it
 */
function createApp(db, { trustProxy = false, demo = null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxy) app.set('trust proxy', 1);

  // ------------------------------------------------------------ prepared SQL
  const q = {
    city: db.prepare('SELECT name, lat, lng FROM cities WHERE name = ?'),
    cities: db.prepare('SELECT name, lat, lng FROM cities ORDER BY name'),
    sports: db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM user_sports us WHERE us.sport_id = s.id) AS active_mates,
        (SELECT COUNT(DISTINCT c.venue_id) FROM courts c WHERE c.sport_id = s.id) AS venues_count
      FROM sports s ORDER BY s.sort_order`),
    sport: db.prepare('SELECT * FROM sports WHERE id = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userSports: db.prepare(`SELECT us.user_id, us.sport_id, us.level, s.name, s.icon
      FROM user_sports us JOIN sports s ON s.id = us.sport_id ORDER BY us.user_id, us.position`),
    sportsOfUser: db.prepare(`SELECT us.sport_id, us.level, s.name, s.icon
      FROM user_sports us JOIN sports s ON s.id = us.sport_id WHERE us.user_id = ? ORDER BY us.position`),
    availabilityOf: db.prepare('SELECT day, slot FROM availability WHERE user_id = ?'),
    playedCount: db.prepare(`SELECT COUNT(*) AS n FROM match_players mp JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = ? AND m.status = 'open' AND m.ends_at < ?`),
    venuesForSport: db.prepare(`
      SELECT v.*, COUNT(c.id) AS court_count, MIN(c.price_per_hour_cents) AS min_price_per_hour
      FROM venues v JOIN courts c ON c.venue_id = v.id
      WHERE c.sport_id = ? GROUP BY v.id ORDER BY v.city = 'Liège' DESC, v.name`),
    courtsForVenueSport: db.prepare('SELECT id, name, price_per_hour_cents FROM courts WHERE venue_id = ? AND sport_id = ? ORDER BY id'),
    court: db.prepare(`SELECT c.*, v.name AS venue_name, v.city AS venue_city FROM courts c
      JOIN venues v ON v.id = c.venue_id WHERE c.id = ?`),
    courtBusy: db.prepare(`SELECT starts_at, ends_at FROM matches
      WHERE court_id = ? AND status = 'open' AND starts_at < ? AND ends_at > ?`),
    match: db.prepare('SELECT * FROM matches WHERE id = ?'),
    upcomingMatches: db.prepare(`
      SELECT m.*, c.name AS court_name, c.sport_id, v.id AS venue_id, v.name AS venue_name, v.city AS venue_city,
             s.name AS sport_name, s.icon AS sport_icon
      FROM matches m JOIN courts c ON c.id = m.court_id JOIN venues v ON v.id = c.venue_id
      JOIN sports s ON s.id = c.sport_id
      WHERE m.status = 'open' AND m.starts_at > ? AND (? IS NULL OR c.sport_id = ?)
      ORDER BY m.starts_at LIMIT 100`),
    matchPlayers: db.prepare(`SELECT mp.match_id, u.id, u.first_name, u.last_name, u.avatar_url
      FROM match_players mp JOIN users u ON u.id = mp.user_id WHERE mp.match_id = ? ORDER BY mp.joined_at, u.id`),
    playerCount: db.prepare('SELECT COUNT(*) AS n FROM match_players WHERE match_id = ?'),
    isPlayer: db.prepare('SELECT 1 FROM match_players WHERE match_id = ? AND user_id = ?'),
  };

  // --------------------------------------------------------------- helpers
  const coordsOf = (user) => {
    if (!user) return q.city.get('Liège');
    if (user.lat != null && user.lng != null) return { lat: user.lat, lng: user.lng };
    return q.city.get(user.city) || null;
  };
  const sportEntry = (r) => ({ id: r.sport_id, name: r.name, icon: r.icon, level: r.level, rating: levelRating(r.level) });

  function availabilityMap(userId) {
    const map = Object.fromEntries(DAYS.map((d) => [d, []]));
    for (const r of q.availabilityOf.all(userId)) map[DAYS[r.day]].push(r.slot);
    for (const d of DAYS) map[d].sort((a, b) => SLOT_IDS.indexOf(a) - SLOT_IDS.indexOf(b));
    return map;
  }

  function publicProfile(u, viewer, { full = false } = {}) {
    const out = {
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      age: u.age,
      city: u.city,
      avatarUrl: u.avatar_url,
      bio: u.bio,
      distanceKm: viewer && viewer.id === u.id ? null : distanceKm(coordsOf(viewer), coordsOf(u)),
      sports: q.sportsOfUser.all(u.id).map(sportEntry),
    };
    if (full) {
      out.availability = availabilityMap(u.id);
      out.matchesPlayed = u.matches_played_base + q.playedCount.get(u.id, new Date().toISOString()).n;
      out.reliability = u.reliability;
      out.fairPlayScore = u.fair_play_score;
    }
    return out;
  }

  function privateProfile(u) {
    return { ...publicProfile(u, u, { full: true }), email: u.email, lat: u.lat, lng: u.lng };
  }

  const shortName = (p) => `${p.first_name}${p.last_name ? ` ${p.last_name[0]}.` : ''}`;

  function serializeMatch(m, viewer) {
    const players = q.matchPlayers.all(m.id);
    const host = players.find((p) => p.id === m.host_id) || q.userById.get(m.host_id);
    return {
      id: m.id,
      sport: { id: m.sport_id, name: m.sport_name, icon: m.sport_icon },
      venue: { id: m.venue_id, name: m.venue_name, city: m.venue_city },
      court: { id: m.court_id, name: m.court_name },
      startsAt: m.starts_at,
      endsAt: m.ends_at,
      durationMin: Math.round((Date.parse(m.ends_at) - Date.parse(m.starts_at)) / 60000),
      levelRequired: m.level_required,
      priceCents: m.price_cents,
      totalSlots: m.total_slots,
      bookedSlots: players.length,
      host: { id: host.id, name: shortName(host), avatarUrl: host.avatar_url },
      players: players.map((p) => ({ id: p.id, name: shortName(p), avatarUrl: p.avatar_url })),
      joined: !!viewer && players.some((p) => p.id === viewer.id),
      isHost: !!viewer && viewer.id === m.host_id,
    };
  }

  function getMatchFull(id) {
    return db.prepare(`
      SELECT m.*, c.name AS court_name, c.sport_id, v.id AS venue_id, v.name AS venue_name, v.city AS venue_city,
             s.name AS sport_name, s.icon AS sport_icon
      FROM matches m JOIN courts c ON c.id = m.court_id JOIN venues v ON v.id = c.venue_id
      JOIN sports s ON s.id = c.sport_id WHERE m.id = ?`).get(id);
  }

  // ------------------------------------------------------------ middleware
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': [
        "default-src 'self'", "script-src 'self'", "style-src 'self' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com", "img-src 'self' https: data:", "connect-src 'self'",
        "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    });
    next();
  });

  const api = express.Router();
  api.use(express.json({ limit: '50kb' }));
  api.use(csrfGuard);
  api.use(loadUser(db));
  api.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const authLimiter = rateLimit({ windowMs: 15 * 60000, max: 20 });

  // ------------------------------------------------------------------ meta
  api.get('/health', (_req, res) => res.json({ ok: true }));

  api.get('/meta', (_req, res) => {
    res.json({
      levels: LEVELS, matchLevels: MATCH_LEVELS, days: DAYS, slots: SLOTS,
      durations: MATCH_DURATIONS, timeZone: TIME_ZONE, cities: q.cities.all().map((c) => c.name),
      today: brusselsYmd(0), demo: demo || null,
    });
  });

  api.get('/stats', (_req, res) => {
    res.json({
      players: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
      openMatches: db.prepare("SELECT COUNT(*) AS n FROM matches WHERE status = 'open' AND starts_at > ?").get(new Date().toISOString()).n,
    });
  });

  api.get('/cities/nearest', (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new HttpError(400, 'Coordonnées invalides.');
    }
    let best = null;
    for (const c of q.cities.all()) {
      const d = distanceKm({ lat, lng }, c);
      if (!best || d < best.distanceKm) best = { city: c.name, distanceKm: d };
    }
    res.json({ ...best, lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 });
  });

  // ------------------------------------------------------------------ auth
  api.post('/auth/register', authLimiter, async (req, res) => {
    const b = req.body || {};
    const email = str(b.email, 'Email', { required: true, max: 254 }).toLowerCase();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Adresse email invalide.');
    const password = typeof b.password === 'string' ? b.password : '';
    if (password.length < 8) throw new HttpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
    if (password.length > 128) throw new HttpError(400, 'Mot de passe trop long.');
    const firstName = str(b.firstName, 'Prénom', { required: true, max: 50 });
    const lastName = str(b.lastName, 'Nom', { max: 50 });
    if (q.userByEmail.get(email)) throw new HttpError(409, 'Un compte existe déjà avec cet email.');
    const hash = await hashPassword(password);
    const { lastInsertRowid } = db.prepare(`INSERT INTO users (email, password_hash, first_name, last_name, city)
      VALUES (?, ?, ?, ?, 'Liège')`).run(email, hash, firstName, lastName);
    const user = q.userById.get(Number(lastInsertRowid));
    createSession(db, res, req, user.id);
    res.status(201).json({ user: privateProfile(user) });
  });

  api.post('/auth/login', authLimiter, async (req, res) => {
    const b = req.body || {};
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    const user = email ? q.userByEmail.get(email) : null;
    const ok = await verifyPassword(password, user && user.password_hash);
    if (!user || !ok) throw new HttpError(401, 'Email ou mot de passe incorrect.');
    createSession(db, res, req, user.id);
    res.json({ user: privateProfile(user) });
  });

  api.post('/auth/logout', (req, res) => {
    destroySession(db, req, res);
    res.json({ ok: true });
  });

  api.get('/auth/me', (req, res) => {
    res.json({ user: req.user ? privateProfile(req.user) : null });
  });

  // ---------------------------------------------------------------- sports
  const serializeSport = (s) => ({
    id: s.id, name: s.name, icon: s.icon, category: s.category, slogan: s.slogan,
    description: s.description, playersPerMatch: s.players_per_match, duration: s.duration,
    popularIn: s.popular_in, accentColor: s.accent_color,
    activeMatesCount: s.active_mates, venuesCount: s.venues_count,
  });

  api.get('/sports', (_req, res) => res.json(q.sports.all().map(serializeSport)));

  api.get('/sports/:id', (req, res) => {
    const s = q.sports.all().find((x) => x.id === req.params.id);
    if (!s) throw new HttpError(404, 'Sport introuvable.');
    res.json(serializeSport(s));
  });

  // ----------------------------------------------------------------- mates
  api.get('/mates', (req, res) => {
    const sport = typeof req.query.sport === 'string' && req.query.sport !== 'all' ? req.query.sport : null;
    const level = typeof req.query.level === 'string' && req.query.level !== 'all' ? req.query.level : null;
    const city = typeof req.query.city === 'string' ? normalize(req.query.city.trim()).slice(0, 60) : '';
    if (sport && !q.sport.get(sport)) throw new HttpError(400, 'Sport inconnu.');
    if (level) oneOf(level, 'Niveau', LEVELS);

    const sportsByUser = new Map();
    for (const r of q.userSports.all()) {
      if (!sportsByUser.has(r.user_id)) sportsByUser.set(r.user_id, []);
      sportsByUser.get(r.user_id).push(r);
    }
    const users = db.prepare('SELECT * FROM users ORDER BY id').all().filter((u) => {
      if (req.user && u.id === req.user.id) return false;
      const sports = sportsByUser.get(u.id) || [];
      if (sports.length === 0) return false;
      // Level is checked against the selected sport, not "any sport".
      if (sport && !sports.some((s) => s.sport_id === sport && (!level || s.level === level))) return false;
      if (!sport && level && !sports.some((s) => s.level === level)) return false;
      if (city && !normalize(u.city).includes(city)) return false;
      return true;
    });
    const list = users.map((u) => publicProfile(u, req.user));
    list.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    res.json(list);
  });

  api.get('/mates/:id', (req, res) => {
    let user;
    if (req.params.id === 'me') {
      if (!req.user) throw new HttpError(401, 'Connecte-toi pour voir ton profil.');
      user = req.user;
    } else {
      user = q.userById.get(idParam(req.params.id));
    }
    if (!user) throw new HttpError(404, 'Ce mate est introuvable.');
    res.json(publicProfile(user, req.user, { full: true }));
  });

  // ---------------------------------------------------------- my profile
  api.put('/me', requireAuth, (req, res) => {
    const b = req.body || {};
    const firstName = str(b.firstName, 'Prénom', { required: true, max: 50 });
    const lastName = str(b.lastName, 'Nom', { max: 50 });
    const age = b.age == null || b.age === '' ? null : int(b.age, 'Âge', { min: 14, max: 99 });
    const city = str(b.city, 'Ville', { required: true, max: 60 });
    const bio = str(b.bio, 'Bio', { max: 500 });
    const avatarUrl = httpsUrl(b.avatarUrl, 'Photo');
    let lat = null; let lng = null;
    if (b.lat != null && b.lng != null) {
      lat = Number(b.lat); lng = Number(b.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new HttpError(400, 'Position GPS invalide.');
      }
      lat = Math.round(lat * 100) / 100; lng = Math.round(lng * 100) / 100; // ~1 km precision
    }

    if (!Array.isArray(b.sports) || b.sports.length > 14) throw new HttpError(400, 'Liste de sports invalide.');
    const seen = new Set();
    const sports = b.sports.map((s) => {
      if (!s || typeof s.id !== 'string' || !q.sport.get(s.id)) throw new HttpError(400, 'Sport inconnu.');
      if (seen.has(s.id)) throw new HttpError(400, 'Un sport apparaît deux fois.');
      seen.add(s.id);
      return { id: s.id, level: oneOf(s.level, 'Niveau', LEVELS) };
    });

    const avail = b.availability && typeof b.availability === 'object' ? b.availability : {};
    const slots = [];
    for (const [day, list] of Object.entries(avail)) {
      const d = DAYS.indexOf(day);
      if (d < 0 || !Array.isArray(list)) throw new HttpError(400, 'Disponibilités invalides.');
      for (const slot of new Set(list)) slots.push([d, oneOf(slot, 'Créneau', SLOT_IDS)]);
    }

    tx(db, () => {
      db.prepare(`UPDATE users SET first_name = ?, last_name = ?, age = ?, city = ?, bio = ?, avatar_url = ?,
        lat = ?, lng = ? WHERE id = ?`).run(firstName, lastName, age, city, bio, avatarUrl, lat, lng, req.user.id);
      db.prepare('DELETE FROM user_sports WHERE user_id = ?').run(req.user.id);
      const addSport = db.prepare('INSERT INTO user_sports (user_id, sport_id, level, position) VALUES (?, ?, ?, ?)');
      sports.forEach((s, i) => addSport.run(req.user.id, s.id, s.level, i));
      db.prepare('DELETE FROM availability WHERE user_id = ?').run(req.user.id);
      const addSlot = db.prepare('INSERT INTO availability (user_id, day, slot) VALUES (?, ?, ?)');
      for (const [d, s] of slots) addSlot.run(req.user.id, d, s);
    });
    res.json({ user: privateProfile(q.userById.get(req.user.id)) });
  });

  // ------------------------------------------------------- venues & courts
  api.get('/venues', (req, res) => {
    const sport = typeof req.query.sport === 'string' ? req.query.sport : '';
    if (!q.sport.get(sport)) throw new HttpError(400, 'Sport inconnu.');
    const viewer = coordsOf(req.user);
    const venues = q.venuesForSport.all(sport).map((v) => ({
      id: v.id, name: v.name, kind: v.kind, description: v.description, city: v.city, badge: v.badge,
      distanceKm: distanceKm(viewer, q.city.get(v.city)),
      minPricePerHourCents: v.min_price_per_hour,
      courts: q.courtsForVenueSport.all(v.id, sport).map((c) => ({ id: c.id, name: c.name, pricePerHourCents: c.price_per_hour_cents })),
    }));
    venues.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    res.json(venues);
  });

  /** Bookable start times (every 30 min, 08:00 → 22:00) for one court and day. */
  function courtSlots(courtId, date, duration) {
    const out = [];
    const now = Date.now();
    for (let mins = 8 * 60; mins + duration <= 22 * 60; mins += 30) {
      const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
      const start = brusselsToDate(date, time);
      const end = new Date(start.getTime() + duration * 60000);
      const free = start.getTime() > now && q.courtBusy.all(courtId, end.toISOString(), start.toISOString()).length === 0;
      out.push({ time, free });
    }
    return out;
  }

  api.get('/courts/:id/slots', (req, res) => {
    const court = q.court.get(idParam(req.params.id));
    if (!court) throw new HttpError(404, 'Terrain introuvable.');
    const date = ymd(req.query.date, 'Date');
    const duration = Number(req.query.duration || 90);
    oneOf(duration, 'Durée', MATCH_DURATIONS);
    res.json({ courtId: court.id, date, duration, slots: courtSlots(court.id, date, duration) });
  });

  // --------------------------------------------------------------- matches
  api.get('/matches', (req, res) => {
    const sport = typeof req.query.sport === 'string' && req.query.sport !== 'all' ? req.query.sport : null;
    const rows = q.upcomingMatches.all(new Date().toISOString(), sport, sport);
    res.json(rows.map((m) => serializeMatch(m, req.user)));
  });

  api.post('/matches', requireAuth, (req, res) => {
    const b = req.body || {};
    const court = q.court.get(int(b.courtId, 'Terrain', { min: 1, max: 1e9 }));
    if (!court) throw new HttpError(400, 'Terrain introuvable.');
    const date = ymd(b.date, 'Date');
    if (typeof b.time !== 'string' || !/^([01]\d|2[0-3]):(00|30)$/.test(b.time)) throw new HttpError(400, 'Heure invalide (créneaux de 30 min).');
    const duration = oneOf(Number(b.durationMin), 'Durée', MATCH_DURATIONS);
    const totalSlots = int(b.totalSlots, 'Nombre de joueurs', { min: 2, max: 22 });
    const level = oneOf(b.levelRequired, 'Niveau', MATCH_LEVELS);

    const start = brusselsToDate(date, b.time);
    const end = new Date(start.getTime() + duration * 60000);
    const [h, m] = b.time.split(':').map(Number);
    if (h * 60 + m < 8 * 60 || h * 60 + m + duration > 22 * 60) throw new HttpError(400, 'Les terrains sont ouverts de 08h00 à 22h00.');
    if (start.getTime() <= Date.now()) throw new HttpError(400, 'Ce créneau est déjà passé.');
    if (start.getTime() > Date.now() + 60 * 86400000) throw new HttpError(400, 'Réservation possible jusqu\'à 60 jours à l\'avance.');
    const price = Math.ceil((court.price_per_hour_cents * duration) / 60 / totalSlots);

    const id = tx(db, () => {
      if (q.courtBusy.all(court.id, end.toISOString(), start.toISOString()).length) {
        throw new HttpError(409, 'Ce terrain est déjà réservé sur ce créneau.');
      }
      const r = db.prepare(`INSERT INTO matches (court_id, host_id, starts_at, ends_at, level_required, total_slots, price_cents)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(court.id, req.user.id, start.toISOString(), end.toISOString(), level, totalSlots, price);
      db.prepare('INSERT INTO match_players (match_id, user_id) VALUES (?, ?)').run(r.lastInsertRowid, req.user.id);
      return Number(r.lastInsertRowid);
    });
    res.status(201).json(serializeMatch(getMatchFull(id), req.user));
  });

  function loadOpenMatch(id) {
    const m = q.match.get(idParam(id));
    if (!m || m.status !== 'open') throw new HttpError(404, 'Ce match n\'existe plus.');
    if (Date.parse(m.starts_at) <= Date.now()) throw new HttpError(409, 'Ce match a déjà commencé.');
    return m;
  }

  api.post('/matches/:id/join', requireAuth, (req, res) => {
    tx(db, () => {
      const m = loadOpenMatch(req.params.id);
      if (q.isPlayer.get(m.id, req.user.id)) throw new HttpError(409, 'Tu es déjà inscrit à ce match.');
      if (q.playerCount.get(m.id).n >= m.total_slots) throw new HttpError(409, 'Ce match est complet.');
      db.prepare('INSERT INTO match_players (match_id, user_id) VALUES (?, ?)').run(m.id, req.user.id);
    });
    res.json(serializeMatch(getMatchFull(Number(req.params.id)), req.user));
  });

  api.post('/matches/:id/leave', requireAuth, (req, res) => {
    tx(db, () => {
      const m = loadOpenMatch(req.params.id);
      if (m.host_id === req.user.id) throw new HttpError(409, 'Tu organises ce match : annule-le plutôt.');
      if (!q.isPlayer.get(m.id, req.user.id)) throw new HttpError(409, 'Tu n\'es pas inscrit à ce match.');
      db.prepare('DELETE FROM match_players WHERE match_id = ? AND user_id = ?').run(m.id, req.user.id);
    });
    res.json(serializeMatch(getMatchFull(Number(req.params.id)), req.user));
  });

  api.delete('/matches/:id', requireAuth, (req, res) => {
    const m = loadOpenMatch(req.params.id);
    if (m.host_id !== req.user.id) throw new HttpError(403, 'Seul l\'organisateur peut annuler ce match.');
    db.prepare("UPDATE matches SET status = 'cancelled' WHERE id = ?").run(m.id);
    res.json({ ok: true });
  });

  // ----------------------------------------------------------- invitations
  api.get('/invitations', requireAuth, (req, res) => {
    const rows = db.prepare(`
      SELECT i.*, s.name AS sport_name, s.icon AS sport_icon,
             f.first_name AS from_first, f.last_name AS from_last, f.avatar_url AS from_avatar,
             t.first_name AS to_first, t.last_name AS to_last, t.avatar_url AS to_avatar
      FROM invitations i JOIN sports s ON s.id = i.sport_id
      JOIN users f ON f.id = i.from_user_id JOIN users t ON t.id = i.to_user_id
      WHERE i.from_user_id = ? OR i.to_user_id = ? ORDER BY i.created_at DESC LIMIT 200`).all(req.user.id, req.user.id);
    const ser = (i) => ({
      id: i.id, sport: { id: i.sport_id, name: i.sport_name, icon: i.sport_icon }, date: i.date, slot: i.slot,
      message: i.message, status: i.status, createdAt: i.created_at,
      from: { id: i.from_user_id, name: shortName({ first_name: i.from_first, last_name: i.from_last }), avatarUrl: i.from_avatar },
      to: { id: i.to_user_id, name: shortName({ first_name: i.to_first, last_name: i.to_last }), avatarUrl: i.to_avatar },
    });
    res.json({
      received: rows.filter((i) => i.to_user_id === req.user.id).map(ser),
      sent: rows.filter((i) => i.from_user_id === req.user.id).map(ser),
    });
  });

  api.post('/invitations', requireAuth, (req, res) => {
    const b = req.body || {};
    const toId = int(b.toUserId, 'Destinataire', { min: 1, max: 1e9 });
    if (toId === req.user.id) throw new HttpError(400, 'Tu ne peux pas t\'inviter toi-même.');
    if (!q.userById.get(toId)) throw new HttpError(404, 'Ce mate est introuvable.');
    if (typeof b.sportId !== 'string' || !q.sport.get(b.sportId)) throw new HttpError(400, 'Sport inconnu.');
    const date = ymd(b.date, 'Date');
    if (date < brusselsYmd(0) || date > brusselsYmd(60)) throw new HttpError(400, 'Choisis une date dans les 60 prochains jours.');
    const slot = oneOf(b.slot, 'Créneau', SLOT_IDS);
    const message = str(b.message, 'Message', { max: 500 });
    const dup = db.prepare(`SELECT 1 FROM invitations WHERE from_user_id = ? AND to_user_id = ? AND sport_id = ?
      AND date = ? AND slot = ? AND status = 'pending'`).get(req.user.id, toId, b.sportId, date, slot);
    if (dup) throw new HttpError(409, 'Tu as déjà envoyé cette invitation.');
    const r = db.prepare(`INSERT INTO invitations (from_user_id, to_user_id, sport_id, date, slot, message)
      VALUES (?, ?, ?, ?, ?, ?)`).run(req.user.id, toId, b.sportId, date, slot, message);
    res.status(201).json({ id: Number(r.lastInsertRowid), status: 'pending' });
  });

  api.post('/invitations/:id/respond', requireAuth, (req, res) => {
    const status = oneOf(req.body && req.body.response, 'Réponse', ['accepted', 'declined']);
    const inv = db.prepare('SELECT * FROM invitations WHERE id = ?').get(idParam(req.params.id));
    if (!inv || inv.to_user_id !== req.user.id) throw new HttpError(404, 'Invitation introuvable.');
    if (inv.status !== 'pending') throw new HttpError(409, 'Tu as déjà répondu à cette invitation.');
    db.prepare('UPDATE invitations SET status = ? WHERE id = ?').run(status, inv.id);
    res.json({ id: inv.id, status });
  });

  api.use((_req, _res, next) => next(new HttpError(404, 'Route API inconnue.')));

  // Express 4 does not catch async rejections: wrap every route handler.
  for (const layer of api.stack) {
    if (!layer.route) continue;
    for (const l of layer.route.stack) {
      const fn = l.handle;
      if (fn.length <= 3) l.handle = (req, res, next) => Promise.resolve().then(() => fn(req, res, next)).catch(next);
    }
  }

  app.use('/api', api);

  // --------------------------------------------------------------- static
  app.get('/vendor/lucide.min.js', (_req, res) => res.sendFile(LUCIDE, { maxAge: '7d' }));
  app.use(express.static(PUBLIC_DIR, {
    index: 'index.html',
    maxAge: '1d',
    // HTML, JS and CSS are unversioned: revalidate (ETag) so a deploy shows up immediately.
    setHeaders: (res, file) => { if (/\.(html|js|css)$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); },
  }));

  // ---------------------------------------------------------------- errors
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.parse.failed') err = new HttpError(400, 'JSON invalide.');
    if (err.type === 'entity.too.large') err = new HttpError(413, 'Requête trop volumineuse.');
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Erreur interne, réessaie plus tard.' : err.message });
  });

  return app;
}

module.exports = { createApp };
