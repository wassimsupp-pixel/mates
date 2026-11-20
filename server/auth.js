'use strict';
/**
 * Password hashing, cookie sessions, CSRF guard and a small login rate limiter.
 */
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const COOKIE = 'mates_sid';
const SESSION_DAYS = 30;
const BCRYPT_COST = 10;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* ignore bad cookie */ }
    }
  }
  return out;
}

function hashPassword(pw) { return bcrypt.hash(pw, BCRYPT_COST); }

// Constant-ish time even when the user does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);
async function verifyPassword(pw, hash) { return bcrypt.compare(pw, hash || DUMMY_HASH).then((ok) => ok && !!hash); }

function createSession(db, res, req, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(new Date().toISOString());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, expires.toISOString());
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: req.secure, path: '/', expires,
  });
}

function destroySession(db, req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

/** Attaches req.user (users row) when a valid session cookie is present. */
function loadUser(db) {
  const stmt = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                           WHERE s.token_hash = ? AND s.expires_at > ?`);
  return (req, _res, next) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    req.user = token ? stmt.get(sha256(token), new Date().toISOString()) || null : null;
    next();
  };
}

function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Connecte-toi pour continuer.'));
  next();
}

/**
 * State-changing API calls must carry `X-Mates: 1`. Browsers cannot add a custom
 * header cross-site without a CORS preflight (which we never allow), so this
 * blocks CSRF on top of the SameSite=Lax cookie.
 */
function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('x-mates') !== '1') return next(new HttpError(403, 'Requête refusée.'));
  next();
}

/** Fixed-window limiter, in memory (fine for a single instance). */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip;
    let entry = hits.get(key);
    if (!entry || entry.reset < now) { entry = { count: 0, reset: now + windowMs }; hits.set(key, entry); }
    entry.count += 1;
    if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    if (entry.count > max) return next(new HttpError(429, 'Trop de tentatives, réessaie dans quelques minutes.'));
    next();
  };
}

module.exports = {
  HttpError, hashPassword, verifyPassword, createSession, destroySession,
  loadUser, requireAuth, csrfGuard, rateLimit,
};
