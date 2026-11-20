'use strict';
/**
 * Seed data: 14 sports, cities, partner venues and courts, the 12 demo mates,
 * a demo account and three upcoming open matches.
 *
 * Usage:  node server/seed.js --reset   (wipes and reseeds DATABASE_PATH)
 *
 * Demo account (also documented in README):
 *   email:    alex.deville@mates.test
 *   password: DEMO_PASSWORD env var, default "demo-mates-2026"
 * The 12 seeded mates have no password and cannot sign in.
 */
const bcrypt = require('bcryptjs');
const { tx } = require('./db');
const { DAYS, brusselsToDate, brusselsYmd, weekdayIndex } = require('./domain');
const { INITIAL_SPORTS, INITIAL_MATES, DEFAULT_MY_PROFILE } = require('./seed-data');

const DEMO_EMAIL = 'alex.deville@mates.test';

const CITIES = [
  ['Liège', 50.6326, 5.5797], ['Bruxelles', 50.8503, 4.3517], ['Namur', 50.4674, 4.8720],
  ['Charleroi', 50.4108, 4.4446], ['Wavre', 50.7170, 4.6014], ['Louvain-la-Neuve', 50.6681, 4.6118],
  ['Mons', 50.4542, 3.9567], ['Herstal', 50.6635, 5.6283], ['Visé', 50.7377, 5.6947],
  ['Ottignies', 50.6658, 4.5694], ['Rocourt', 50.6738, 5.5530], ['Angleur', 50.6122, 5.5990],
  ['Sart-Tilman', 50.5833, 5.5667],
];

const COURT_LABEL = {
  padel: 'Terrain', football: 'Terrain synthétique', tennis: 'Court', basketball: 'Playground',
  badminton: 'Terrain', volleyball: 'Terrain', running: 'Groupe', escalade: 'Espace',
  squash: 'Court', pingpong: 'Table', rugby: 'Terrain', handball: 'Terrain',
  fitness: 'Plateau', natation: 'Couloir',
};

// [name, kind, description, city, badge, [[sport, courtCount, €/hour], ...]]
const VENUES = [
  ['Padel Club Liège Belle-Île', 'Centre recommandé', 'Courts intérieurs chauffés et terrains extérieurs panoramiques.', 'Liège', 'Ouvert',
    [['padel', 4, 40], ['squash', 2, 18], ['badminton', 3, 14]]],
  ['Sport Arena Rocourt', 'Complexe Métropole', 'Infrastructures modernes avec vestiaires et club-house.', 'Rocourt', 'Ouvert',
    [['football', 2, 80], ['basketball', 2, 45], ['volleyball', 2, 45], ['handball', 1, 60], ['badminton', 4, 12], ['pingpong', 6, 8], ['fitness', 1, 0]]],
  ['Centre sportif Sart-Tilman', 'Club universitaire', 'Accessible aux étudiants et au grand public. Réductions membres.', 'Sart-Tilman', 'Tarif étudiant',
    [['tennis', 3, 14], ['basketball', 1, 30], ['volleyball', 1, 30], ['badminton', 4, 9], ['natation', 6, 0], ['fitness', 1, 0], ['rugby', 1, 50], ['handball', 1, 40], ['running', 3, 0]]],
  ['Royal Tennis Club de Liège', 'Club historique', 'Courts en terre battue et en résine, éclairage en soirée.', 'Liège', 'Ouvert',
    [['tennis', 4, 24], ['padel', 2, 36]]],
  ['Bloc & Voies Liège', 'Salle d\'escalade', 'Salle de bloc et murs de cordes, location de matériel sur place.', 'Liège', 'Ouvert',
    [['escalade', 2, 0], ['fitness', 1, 0]]],
  ['Bords de Meuse', 'Point de rendez-vous', 'Départ des sorties running le long de la Meuse.', 'Liège', 'Gratuit',
    [['running', 4, 0]]],
  ['Brussels Padel Arena', 'Centre recommandé', 'Huit pistes couvertes, bar et vestiaires.', 'Bruxelles', 'Ouvert',
    [['padel', 6, 44], ['tennis', 2, 28], ['squash', 2, 20]]],
  ['Salle omnisports Bruxelles-Centre', 'Complexe Métropole', 'Grande salle multisport et piscine olympique.', 'Bruxelles', 'Ouvert',
    [['football', 1, 90], ['basketball', 2, 50], ['volleyball', 2, 50], ['handball', 1, 70], ['badminton', 4, 14], ['pingpong', 4, 8], ['natation', 8, 0], ['fitness', 1, 0], ['rugby', 1, 60], ['escalade', 1, 0], ['running', 2, 0]]],
  ['Namur Sports Center', 'Complexe régional', 'Terrains couverts et extérieurs au bord de la Sambre.', 'Namur', 'Ouvert',
    [['padel', 3, 36], ['football', 2, 70], ['pingpong', 4, 8], ['natation', 5, 0], ['volleyball', 1, 40]]],
  ['Charleroi Arena', 'Complexe régional', 'Salle omnisports et terrain synthétique éclairé.', 'Charleroi', 'Ouvert',
    [['football', 2, 70], ['volleyball', 2, 40], ['handball', 1, 55], ['rugby', 1, 50]]],
];

// Small offsets so seeded mates are not all exactly on the city centre.
const MATE_OFFSETS = [[0.010, 0.012], [0.020, -0.030], [0.015, -0.010], [-0.010, 0.020], [-0.020, 0.015], [0.030, 0.010],
  [0.005, -0.020], [0.004, 0.006], [-0.018, -0.022], [-0.012, 0.030], [0.022, 0.005], [-0.015, -0.012]];

function insertProfile(db, p, { email, passwordHash, lat, lng }) {
  const { lastInsertRowid: id } = db.prepare(`
    INSERT INTO users (email, password_hash, first_name, last_name, age, city, lat, lng, avatar_url, bio,
                       matches_played_base, reliability, fair_play_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    email, passwordHash, p.firstName, p.lastName, p.age, p.city, lat, lng, p.avatar, p.bio,
    p.matchesPlayed || 0, parseInt(p.reliability, 10) || null, p.fairPlayScore || null);
  const addSport = db.prepare('INSERT INTO user_sports (user_id, sport_id, level, position) VALUES (?, ?, ?, ?)');
  p.sports.forEach((s, i) => addSport.run(id, s.id, s.level, i));
  const addSlot = db.prepare('INSERT INTO availability (user_id, day, slot) VALUES (?, ?, ?)');
  for (const [day, slots] of Object.entries(p.availability)) {
    for (const slot of slots) addSlot.run(id, DAYS.indexOf(day), slot);
  }
  return Number(id);
}

const DEFAULT_DEMO_PASSWORD = 'demo-mates-2026';

function seed(db, { demoPassword = process.env.DEMO_PASSWORD || DEFAULT_DEMO_PASSWORD, now = Date.now() } = {}) {
  return tx(db, () => {
    const addCity = db.prepare('INSERT INTO cities (name, lat, lng) VALUES (?, ?, ?)');
    CITIES.forEach((c) => addCity.run(...c));
    const cityCoords = Object.fromEntries(CITIES.map(([n, lat, lng]) => [n, { lat, lng }]));

    const addSport = db.prepare(`INSERT INTO sports (id, name, icon, players_per_match, duration, category, slogan,
      description, popular_in, accent_color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    INITIAL_SPORTS.forEach((s, i) => addSport.run(s.id, s.name, s.icon, s.playersPerMatch, s.duration, s.category,
      s.slogan, s.description, s.popularIn, s.accentColor, i));

    const addVenue = db.prepare('INSERT INTO venues (name, kind, description, city, badge) VALUES (?, ?, ?, ?, ?)');
    const addCourt = db.prepare('INSERT INTO courts (venue_id, sport_id, name, price_per_hour_cents) VALUES (?, ?, ?, ?)');
    const courtIds = {};
    for (const [name, kind, desc, city, badge, sports] of VENUES) {
      const venueId = Number(addVenue.run(name, kind, desc, city, badge).lastInsertRowid);
      for (const [sport, count, euros] of sports) {
        for (let n = 1; n <= count; n++) {
          let label = `${COURT_LABEL[sport]} ${n}`;
          if (sport === 'padel' && n === 2) label += ' (Panoramique)';
          if (sport === 'tennis' && name.startsWith('Royal')) label = `Court terre battue n°${n}`;
          courtIds[`${name}|${sport}|${n}`] = Number(addCourt.run(venueId, sport, label, euros * 100).lastInsertRowid);
        }
      }
    }

    const userIds = {};
    INITIAL_MATES.forEach((m, i) => {
      const base = cityCoords[m.city] || cityCoords['Liège'];
      const [dLat, dLng] = MATE_OFFSETS[i % MATE_OFFSETS.length];
      userIds[m.firstName] = insertProfile(db, m, {
        email: `${m.firstName}.${m.lastName}@mates.test`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
        passwordHash: null,
        lat: Math.round((base.lat + dLat) * 100) / 100,
        lng: Math.round((base.lng + dLng) * 100) / 100,
      });
    });
    const demo = { ...DEFAULT_MY_PROFILE, matchesPlayed: 19 };
    userIds.Alexandre = insertProfile(db, demo, {
      email: DEMO_EMAIL, passwordHash: bcrypt.hashSync(demoPassword, 10), lat: null, lng: null,
    });

    // Open matches relative to "now", in Brussels time.
    const today = brusselsYmd(0, now);
    const tonight = brusselsToDate(today, '19:00').getTime() > now + 3600000 ? today : brusselsYmd(1, now);
    const tomorrow = brusselsYmd(1, now);
    let saturday = brusselsYmd(1, now);
    for (let i = 1; i <= 7; i++) { saturday = brusselsYmd(i, now); if (weekdayIndex(saturday) === 5) break; }
    if (saturday === tomorrow) saturday = brusselsYmd(8, now);

    const addMatch = db.prepare(`INSERT INTO matches (court_id, host_id, starts_at, ends_at, level_required, total_slots, price_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const addPlayer = db.prepare('INSERT INTO match_players (match_id, user_id) VALUES (?, ?)');
    const priceOf = db.prepare('SELECT price_per_hour_cents AS p FROM courts WHERE id = ?');
    const createMatch = (courtKey, host, ymd, start, minutes, level, slots, players) => {
      const courtId = courtIds[courtKey];
      const startsAt = brusselsToDate(ymd, start);
      const endsAt = new Date(startsAt.getTime() + minutes * 60000);
      const price = Math.ceil((priceOf.get(courtId).p * minutes) / 60 / slots);
      const id = Number(addMatch.run(courtId, userIds[host], startsAt.toISOString(), endsAt.toISOString(), level, slots, price).lastInsertRowid);
      players.forEach((p) => addPlayer.run(id, userIds[p]));
      return id;
    };
    createMatch('Padel Club Liège Belle-Île|padel|2', 'Thomas', tonight, '19:00', 90, 'Intermédiaire', 4, ['Thomas', 'Elena', 'Romain']);
    createMatch('Sport Arena Rocourt|football|1', 'Julien', tomorrow, '20:00', 60, 'Tous niveaux', 10,
      ['Julien', 'Nathan', 'Maxime', 'Lucas', 'Antoine', 'Romain', 'Inès', 'Thomas', 'Sarah']);
    createMatch('Royal Tennis Club de Liège|tennis|4', 'Camille', saturday, '10:30', 90, 'Confirmé', 2, ['Camille']);

    return { demoUserId: userIds.Alexandre, userIds };
  });
}

function isEmpty(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM sports').get().n === 0;
}

if (require.main === module) {
  const fs = require('node:fs');
  const { openDatabase } = require('./db');
  const file = process.env.DATABASE_PATH || require('node:path').join(__dirname, '..', 'data', 'mates.db');
  if (process.argv.includes('--reset')) {
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(file + suffix, { force: true });
  }
  const db = openDatabase(file);
  if (isEmpty(db)) { seed(db); console.log(`Seeded ${file}`); } else { console.log('Database already seeded; use --reset to wipe it.'); }
}

module.exports = { seed, isEmpty, DEMO_EMAIL, DEFAULT_DEMO_PASSWORD };
