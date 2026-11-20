'use strict';
/**
 * SQLite access (Node's built-in node:sqlite, no native build step).
 */
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cities (
  name TEXT PRIMARY KEY,
  lat  REAL NOT NULL,
  lng  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS sports (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  icon              TEXT NOT NULL,
  players_per_match TEXT NOT NULL,
  duration          TEXT NOT NULL,
  category          TEXT NOT NULL,
  slogan            TEXT NOT NULL,
  description       TEXT NOT NULL,
  popular_in        TEXT NOT NULL,
  accent_color      TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash       TEXT,              -- NULL = seeded profile that cannot sign in
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL DEFAULT '',
  age                 INTEGER,
  city                TEXT NOT NULL DEFAULT 'Liège',
  lat                 REAL,              -- rounded to ~1 km; NULL = use city centre
  lng                 REAL,
  avatar_url          TEXT,
  bio                 TEXT NOT NULL DEFAULT '',
  matches_played_base INTEGER NOT NULL DEFAULT 0,
  reliability         INTEGER,           -- percent, NULL = new player
  fair_play_score     REAL,              -- NULL = not rated yet
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_sports (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id TEXT    NOT NULL REFERENCES sports(id),
  level    TEXT    NOT NULL CHECK (level IN ('Débutant','Intermédiaire','Confirmé','Expert')),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, sport_id)
);

CREATE TABLE IF NOT EXISTS availability (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),   -- 0 = Lundi
  slot    TEXT    NOT NULL CHECK (slot IN ('matin','midi','apresmidi','soir')),
  PRIMARY KEY (user_id, day, slot)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS venues (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  description TEXT NOT NULL,
  city        TEXT NOT NULL REFERENCES cities(name),
  badge       TEXT NOT NULL DEFAULT 'Ouvert'
);

CREATE TABLE IF NOT EXISTS courts (
  id                    INTEGER PRIMARY KEY,
  venue_id              INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  sport_id              TEXT    NOT NULL REFERENCES sports(id),
  name                  TEXT    NOT NULL,
  price_per_hour_cents  INTEGER NOT NULL CHECK (price_per_hour_cents >= 0)
);

CREATE TABLE IF NOT EXISTS matches (
  id              INTEGER PRIMARY KEY,
  court_id        INTEGER NOT NULL REFERENCES courts(id),
  host_id         INTEGER NOT NULL REFERENCES users(id),
  starts_at       TEXT    NOT NULL,   -- ISO 8601 UTC
  ends_at         TEXT    NOT NULL,
  level_required  TEXT    NOT NULL,
  total_slots     INTEGER NOT NULL CHECK (total_slots BETWEEN 2 AND 22),
  price_cents     INTEGER NOT NULL,   -- per person
  status          TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','cancelled')),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_matches_court_time ON matches(court_id, starts_at);

CREATE TABLE IF NOT EXISTS match_players (
  match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id           INTEGER PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id     TEXT    NOT NULL REFERENCES sports(id),
  date         TEXT    NOT NULL,      -- YYYY-MM-DD
  slot         TEXT    NOT NULL CHECK (slot IN ('matin','midi','apresmidi','soir')),
  message      TEXT    NOT NULL DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  return db;
}

/** Run fn inside a transaction (node:sqlite has no helper for this). */
function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { openDatabase, tx };
