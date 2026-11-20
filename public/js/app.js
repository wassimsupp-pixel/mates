/**
 * MATES — client SPA (hash router) talking to the JSON API under /api.
 * No inline handlers: every interaction goes through data-action delegation,
 * and every value inserted as HTML goes through esc().
 */
(() => {
  'use strict';

  const TZ = 'Europe/Brussels';
  const VOLT = '#C0FB18';
  const state = {
    me: null,
    meta: null,
    sports: [],
    sportsById: {},
    filters: { sport: 'all', level: 'all', city: '' },
    editing: null,
    matches: [],
    pendingJoinId: null,
    proposeTo: null,
    createMatch: { venues: [] },
    authMode: 'login',
    afterLogin: null,
  };

  // ------------------------------------------------------------ utilities
  const $ = (id) => document.getElementById(id);
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const avatarSrc = (url) => esc(url || '/assets/avatar-default.svg');
  const icons = (root) => {
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.5 }, ...(root ? { root } : {}) });
  };
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
  const km = (d) => (d == null ? '' : `${String(d).replace('.', ',')} km`);

  // ---------------------------------------------------------- sport icons
  // Seven sports exist in Lucide; the other seven are drawn in the same 24px / 1.5 stroke style.
  const LUCIDE_SPORT = {
    football: 'goal', basketball: 'dribbble', volleyball: 'volleyball', running: 'footprints',
    escalade: 'mountain', fitness: 'dumbbell', natation: 'waves',
  };
  const CUSTOM_SPORT = {
    padel: '<circle cx="14" cy="10" r="7.5"/><rect x="3.4" y="15.6" width="3.2" height="6.4" rx="1.4" transform="rotate(45 5 18.8)"/><circle cx="11.2" cy="7.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.8" cy="7.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="14" cy="10" r="1.1" fill="currentColor" stroke="none"/><circle cx="11.2" cy="12.8" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.8" cy="12.8" r="1.1" fill="currentColor" stroke="none"/>',
    tennis: '<circle cx="12" cy="12" r="9"/><path d="M6 5.3a9 9 0 0 1 0 13.4"/><path d="M18 5.3a9 9 0 0 0 0 13.4"/>',
    squash: '<ellipse cx="13.5" cy="9.5" rx="4" ry="6" transform="rotate(45 13.5 9.5)"/><path d="m10.3 12.7-5.8 5.8"/><circle cx="18.5" cy="18.5" r="1.5"/>',
    badminton: '<path d="M7 3h10l-2.5 11h-5Z"/><path d="M11 3.5 11.5 14M13 3.5 12.5 14"/><path d="M9.5 15h5a2.5 2.5 0 0 1-5 0Z"/>',
    pingpong: '<circle cx="10" cy="10" r="6.5"/><path d="m14.6 14.6 4.4 4.4"/><circle cx="19" cy="5" r="1.5"/>',
    rugby: '<ellipse cx="12" cy="12" rx="9.5" ry="5.5" transform="rotate(-45 12 12)"/><path d="m8.5 15.5 7-7"/><path d="m10 12.5 1.5 1.5M12 10.5l1.5 1.5"/>',
    handball: '<circle cx="12" cy="12" r="9"/><path d="m12 7.5 3.8 2.8-1.4 4.4H9.6l-1.4-4.4Z"/><path d="M12 3v4.5M15.8 10.3 20.5 9M14.4 14.7l2.6 3.8M9.6 14.7 7 18.5M8.2 10.3 3.5 9"/>',
  };
  function sportSvg(id, cls = '') {
    if (LUCIDE_SPORT[id]) return `<i data-lucide="${LUCIDE_SPORT[id]}" class="${cls}" aria-hidden="true"></i>`;
    const inner = CUSTOM_SPORT[id] || '<circle cx="12" cy="12" r="9"/>';
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  }
  const sportGlyph = (id, extra = '') => `<span class="sport-glyph ${extra}">${sportSvg(id)}</span>`;
  const sportName = (id) => (state.sportsById[id] || {}).name || id;

  async function api(method, path, body) {
    const opts = { method, headers: { 'X-Mates': '1' }, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(`/api${path}`, opts);
    } catch {
      throw Object.assign(new Error('Connexion au serveur impossible'), { status: 0 });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error((data.error || 'Erreur inattendue').replace(/\.$/, '')), { status: res.status });
    return data;
  }

  // ---------------------------------------------------------------- dates
  const fmtTime = (iso) => new Intl.DateTimeFormat('fr-BE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const ymdOf = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const todayYmd = () => ymdOf(new Date());
  function addDays(ymd, n) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  function weekdayIndex(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  }
  function dayLabel(ymd) {
    const today = todayYmd();
    if (ymd === today) return "Aujourd'hui";
    if (ymd === addDays(today, 1)) return 'Demain';
    const [y, m, d] = ymd.split('-').map(Number);
    const s = new Intl.DateTimeFormat('fr-BE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d)));
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const matchWhen = (m) => `${dayLabel(ymdOf(new Date(m.startsAt)))} · ${fmtTime(m.startsAt)}–${fmtTime(m.endsAt)}`;
  const euros = (cents) => (cents === 0 ? 'Gratuit' : (cents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' }));
  const slotLabel = (id) => ((state.meta.slots.find((s) => s.id === id) || {}).label || id);
  const slotShort = (id) => slotLabel(id).split('(')[0].trim();

  // ---------------------------------------------------------------- toast
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', { success: 'circle-check', error: 'circle-alert', warning: 'circle-alert' }[type] || 'info');
    icon.setAttribute('class', `w-[18px] h-[18px] flex-shrink-0 ${{ success: 'text-ok', error: 'text-bad', warning: 'text-warn' }[type] || 'text-fg-3'}`);
    const text = document.createElement('span');
    text.className = 'text-sm text-fg';
    text.textContent = message;
    toast.append(icon, text);
    $('toast-container').appendChild(toast);
    icons(toast);
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 220);
    }, 3500);
  }
  const fail = (err) => showToast(err.message || 'Erreur inattendue', 'error');

  function requireLogin(returnTo) {
    if (state.me) return true;
    state.afterLogin = returnTo || location.hash || '#home';
    showToast('Connecte-toi pour continuer');
    location.hash = '#auth';
    return false;
  }

  // ------------------------------------------------------------ bootstrap
  async function init() {
    setupListeners();
    try {
      const [meta, sports, me] = await Promise.all([api('GET', '/meta'), api('GET', '/sports'), api('GET', '/auth/me')]);
      state.meta = meta;
      state.sports = sports;
      state.sportsById = Object.fromEntries(sports.map((s) => [s.id, s]));
      state.me = me.user;
    } catch (err) {
      fail(err);
      return;
    }
    document.querySelectorAll('[data-sport-count]').forEach((el) => { el.textContent = state.sports.length; });
    populateStaticSelects();
    renderHeader();
    refreshInviteBadge();
    window.addEventListener('hashchange', route);
    route();
  }

  function populateStaticSelects() {
    const opts = state.sports.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    $('filter-sport').innerHTML = `<option value="all">Tous les sports</option>${opts}`;
    $('matches-sport-filter').innerHTML = `<option value="all">Tous les sports</option>${opts}`;
    $('cm-sport').innerHTML = opts;
    $('city-list').innerHTML = state.meta.cities.map((c) => `<option value="${esc(c)}"></option>`).join('');
    $('cm-duration').innerHTML = state.meta.durations.map((d) => `<option value="${d}" ${d === 90 ? 'selected' : ''}>${d} min</option>`).join('');
    $('cm-level').innerHTML = state.meta.matchLevels.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
    $('propose-slot').innerHTML = state.meta.slots.map((s) => `<option value="${esc(s.id)}">${esc(slotLabel(s.id))}</option>`).join('');
    $('auth-demo-box').classList.toggle('hidden', !state.meta.demo);
  }

  // --------------------------------------------------------------- router
  const PROTECTED = new Set(['edit-profile', 'inbox']);

  async function route() {
    const [view, param] = (location.hash.slice(1) || 'home').split('/');
    if (PROTECTED.has(view) && !state.me) {
      requireLogin(location.hash);
      return;
    }
    closeModals();
    document.querySelectorAll('.page-view').forEach((el) => el.classList.add('hidden'));
    updateNav(view);
    toggleDrawer(false);
    const show = (id) => $(id).classList.remove('hidden');
    window.scrollTo({ top: 0 });

    try {
      switch (view) {
        case 'mates': show('view-mates'); await renderMatesGrid(); break;
        case 'sports': show('view-sports'); renderSportsCatalog(); break;
        case 'sport': show('view-single-sport'); await renderSportPage(param); break;
        case 'mate': show('view-public-profile'); await renderPublicProfile(param); break;
        case 'edit-profile': show('view-edit-profile'); initEditProfile(); break;
        case 'auth': show('view-auth'); updateAuthCard(); break;
        case 'matches': show('view-matches'); await renderMatches(); break;
        case 'inbox': show('view-inbox'); await renderInbox(); break;
        case 'uml': show('view-uml'); break;
        default: show('view-home'); await renderHome(); break;
      }
    } catch (err) {
      fail(err);
    }
    icons();
  }

  function updateNav(view) {
    const active = { sport: 'sports', mate: 'mates' }[view] || view;
    document.querySelectorAll('.nav-link').forEach((link) => {
      const on = link.getAttribute('href') === `#${active}`;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
  }

  function toggleDrawer(open) {
    const drawer = $('mobile-drawer');
    const willOpen = open ?? drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !willOpen);
    $('mobile-menu-btn').setAttribute('aria-expanded', String(willOpen));
  }

  function renderHeader() {
    const box = $('header-user-section');
    const mobile = $('mobile-user-links');
    if (state.me) {
      box.innerHTML = `
        <a href="#inbox" class="icon-btn relative" aria-label="Invitations">
          <i data-lucide="inbox" class="w-[18px] h-[18px]"></i>
          <span id="invite-badge" class="hidden absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-mates-green text-mates-deep text-[11px] leading-4 num font-medium text-center"></span>
        </a>
        <a href="#edit-profile" class="flex items-center gap-2 h-9 pl-1 pr-3 rounded-lg text-sm text-fg-2 hover:text-fg hover:bg-mates-cardElevated transition-colors">
          <img src="${avatarSrc(state.me.avatarUrl)}" alt="" class="w-7 h-7 rounded-full object-cover bg-mates-cardElevated">
          <span class="hidden sm:inline">${esc(state.me.firstName)}</span>
        </a>`;
      mobile.innerHTML = `
        <a href="#inbox" class="nav-link">Invitations</a>
        <a href="#edit-profile" class="nav-link">Mon profil</a>`;
    } else {
      box.innerHTML = '<a href="#auth" class="btn btn-sm btn-secondary">Connexion</a>';
      mobile.innerHTML = '<a href="#auth" class="nav-link">Connexion ou inscription</a>';
    }
    icons(box);
  }

  async function refreshInviteBadge() {
    if (!state.me) return;
    try {
      const { received } = await api('GET', '/invitations');
      const n = received.filter((i) => i.status === 'pending').length;
      const badge = $('invite-badge');
      if (badge) {
        badge.textContent = n;
        badge.classList.toggle('hidden', n === 0);
        badge.parentElement.setAttribute('aria-label', n ? `Invitations, ${n} en attente` : 'Invitations');
      }
    } catch { /* badge is best-effort */ }
  }

  // ---------------------------------------------------- the court (moment)
  const COURT = {
    racket: { fill: '#1d4a80', ids: ['padel', 'tennis', 'squash', 'badminton', 'pingpong'] },
    turf: { fill: '#245539', ids: ['football', 'rugby'] },
    hall: { fill: '#6e4e2f', ids: [] },
  };
  const courtKind = (sportId) => (COURT.racket.ids.includes(sportId) ? 'racket' : COURT.turf.ids.includes(sportId) ? 'turf' : 'hall');

  function courtLines(kind) {
    const outer = '<rect x="16" y="16" width="368" height="188" rx="2"/>';
    if (kind === 'racket') {
      return `${outer}<path d="M126 16v188M274 16v188M126 110h148"/>`
        + '<path d="M200 10v200" stroke-width="3" stroke-opacity="0.9"/>';
    }
    if (kind === 'turf') {
      return `${outer}<path d="M200 16v188"/><circle cx="200" cy="110" r="30"/><circle cx="200" cy="110" r="2" fill="#fff"/>`
        + '<rect x="16" y="62" width="56" height="96"/><rect x="328" y="62" width="56" height="96"/>'
        + '<rect x="16" y="88" width="20" height="44"/><rect x="364" y="88" width="20" height="44"/>';
    }
    return `${outer}<path d="M200 16v188"/><circle cx="200" cy="110" r="28"/>`
      + '<rect x="16" y="80" width="72" height="60"/><rect x="312" y="80" width="72" height="60"/>'
      + '<path d="M88 80a30 30 0 0 1 0 60M312 80a30 30 0 0 0 0 60"/>';
  }

  /** Seat centres: players alternate sides like a real line-up (L, R, L, R…). */
  function seatPositions(total) {
    const per = [Math.ceil(total / 2), Math.floor(total / 2)];
    const halves = per.map((count, side) => {
      const cx = side === 0 ? 108 : 292;
      const cols = count > 3 ? 2 : 1;
      const rows = Math.ceil(count / cols);
      const pts = [];
      for (let i = 0; i < count; i++) {
        const col = cols === 1 ? 0 : i % 2;
        const row = cols === 1 ? i : Math.floor(i / 2);
        pts.push({ x: cols === 1 ? cx : cx + (col === 0 ? -40 : 40), y: 16 + (188 * (row + 1)) / (rows + 1), rows });
      }
      return pts;
    });
    const out = [];
    for (let i = 0; i < total; i++) out.push(halves[i % 2][Math.floor(i / 2)]);
    return out;
  }

  function courtSvg(m) {
    const kind = courtKind(m.sport.id);
    const remaining = m.totalSlots - m.bookedSlots;
    const canJoin = remaining > 0 && !m.joined;
    const pts = seatPositions(m.totalSlots);
    const r = m.totalSlots > 12 ? 12 : m.totalSlots > 8 ? 15 : 18;
    const showNames = pts.every((p) => p.rows <= 3);
    const uid = `c${m.id}`;
    const seats = pts.map((p, i) => {
      const player = m.players[i];
      const label = showNames
        ? `<text x="${p.x}" y="${p.y + r + 15}" text-anchor="middle" font-size="11" font-family="Plus Jakarta Sans, sans-serif" fill="${player ? '#ffffff' : VOLT}" fill-opacity="${player ? 0.9 : 1}">${player ? esc(player.name.split(' ')[0]) : 'Libre'}</text>`
        : '';
      if (player) {
        return `<g><clipPath id="${uid}-${i}"><circle cx="${p.x}" cy="${p.y}" r="${r - 1}"/></clipPath>`
          + `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="#232325"/>`
          + `<image href="${avatarSrc(player.avatarUrl)}" x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}" clip-path="url(#${uid}-${i})" preserveAspectRatio="xMidYMid slice"/>`
          + `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="none" stroke="#0f0f10" stroke-width="2"/>${label}<title>${esc(player.name)}</title></g>`;
      }
      const attrs = canJoin
        ? `class="court-seat" data-action="open-join" data-id="${m.id}" role="button" tabindex="0" aria-label="Place libre, rejoindre ce match"`
        : '';
      return `<g ${attrs}><circle class="seat-ring" cx="${p.x}" cy="${p.y}" r="${r}" fill="#0f0f10" fill-opacity="0.45" stroke="${VOLT}" stroke-width="1.5" stroke-dasharray="4 3"/>`
        + `<path d="M${p.x - 6} ${p.y}h12M${p.x} ${p.y - 6}v12" stroke="${VOLT}" stroke-width="1.5" stroke-linecap="round"/>${label}</g>`;
    }).join('');
    return `<svg viewBox="0 0 400 220" class="w-full h-auto block rounded-xl" role="img" aria-label="${esc(`Terrain ${m.court.name}, ${m.bookedSlots} joueurs sur ${m.totalSlots}`)}">`
      + `<rect width="400" height="220" rx="12" fill="${COURT[kind].fill}"/>`
      + `<g fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.5">${courtLines(kind)}</g>${seats}</svg>`;
  }

  /** Small seat row used on match cards and in the join modal. */
  function seatsRow(m, max = 10) {
    const remaining = Math.max(0, m.totalSlots - m.bookedSlots);
    const players = m.players.slice(0, max);
    const free = Math.min(remaining, Math.max(0, max - players.length));
    return players.map((p) => `<a href="#mate/${p.id}" title="${esc(p.name)}"><img src="${avatarSrc(p.avatarUrl)}" alt="${esc(p.name)}" class="seat"></a>`).join('')
      + Array.from({ length: free }, () => '<span class="seat-free" aria-hidden="true"><i data-lucide="plus" class="w-3.5 h-3.5"></i></span>').join('');
  }
  const placesText = (m) => {
    const remaining = m.totalSlots - m.bookedSlots;
    return remaining <= 0 ? 'Complet' : `${plural(remaining, 'place')} ${remaining > 1 ? 'libres' : 'libre'}`;
  };

  // ----------------------------------------------------------------- home
  async function renderHome() {
    $('home-sports-grid').innerHTML = state.sports.map((s) => `
      <a href="#sport/${esc(s.id)}" class="tile">
        ${sportGlyph(s.id)}
        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-fg">${esc(s.name)}</span>
          <span class="meta">${plural(s.activeMatesCount, 'mate')}</span>
        </div>
      </a>`).join('');

    const [stats, matches] = await Promise.all([api('GET', '/stats'), api('GET', '/matches')]);
    $('stat-mates').textContent = stats.players;
    $('stat-matches').textContent = stats.openMatches;
    state.matches = matches;

    const box = $('home-featured-match');
    const m = matches.find((x) => x.bookedSlots < x.totalSlots && !x.joined) || matches[0];
    if (!m) {
      box.innerHTML = `<div class="flex flex-col gap-4 items-start">
        <p class="text-[15px] text-fg-2">Aucun match ouvert pour le moment</p>
        <a href="#matches" class="btn btn-secondary">Créer le premier match</a></div>`;
      return;
    }
    const canJoin = m.bookedSlots < m.totalSlots && !m.joined;
    box.innerHTML = `
      <div class="flex items-start justify-between gap-4 mb-4">
        <div class="flex items-center gap-3 min-w-0">
          ${sportGlyph(m.sport.id)}
          <div class="min-w-0">
            <p class="text-[15px] font-medium text-fg truncate">${esc(m.sport.name)} · ${esc(m.venue.name)}</p>
            <p class="meta truncate mt-1">${esc(m.court.name)} · ${esc(m.venue.city)}</p>
          </div>
        </div>
        <span class="text-sm text-mates-green whitespace-nowrap pt-1">${esc(placesText(m))}</span>
      </div>
      ${courtSvg(m)}
      <dl class="grid grid-cols-3 gap-4 mt-4 text-sm">
        <div><dt class="text-fg-3 text-xs mb-1">Quand</dt><dd class="num text-fg">${esc(matchWhen(m))}</dd></div>
        <div><dt class="text-fg-3 text-xs mb-1">Niveau</dt><dd class="text-fg">${esc(m.levelRequired)}</dd></div>
        <div><dt class="text-fg-3 text-xs mb-1">Par joueur</dt><dd class="num text-fg">${esc(euros(m.priceCents))}</dd></div>
      </dl>
      <div class="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-mates-border">
        <a href="#matches" class="text-sm text-fg-2 hover:text-fg transition-colors">Tous les matchs ouverts</a>
        ${canJoin ? `<button type="button" data-action="open-join" data-id="${m.id}" class="btn btn-secondary">Rejoindre ce match</button>` : ''}
      </div>`;
  }

  // ---------------------------------------------------------------- mates
  let mateSearchSeq = 0;
  async function renderMatesGrid() {
    const seq = ++mateSearchSeq;
    const { sport, level, city } = state.filters;
    $('filter-sport').value = sport;
    $('filter-level').value = level;
    if (document.activeElement !== $('filter-city')) $('filter-city').value = city;
    $('filter-level-hint').textContent = sport === 'all' ? 'tous sports' : `en ${sportName(sport).toLowerCase()}`;
    const params = new URLSearchParams({ sport, level, city });
    const mates = await api('GET', `/mates?${params}`);
    if (seq !== mateSearchSeq) return; // a newer search finished first
    $('mates-count-badge').textContent = mates.length;
    $('mates-empty-state').classList.toggle('hidden', mates.length > 0);
    $('mates-grid').innerHTML = mates.map((m) => mateCard(m, sport)).join('');
    icons($('mates-grid'));
  }

  function mateCard(m, highlightSport) {
    const sports = m.sports.slice(0, 3).map((s) => `
      <span class="tag ${s.id === highlightSport ? 'tag-strong' : ''}">${sportSvg(s.id, 'w-3.5 h-3.5')}<span>${esc(s.name)}</span><span class="text-fg-3">${esc(s.level)}</span></span>`).join('');
    const where = [m.city, km(m.distanceKm)].filter(Boolean).join(' · ');
    return `
      <article class="card p-6 flex flex-col gap-4">
        <div class="flex items-center gap-4">
          <a href="#mate/${m.id}" class="flex-shrink-0"><img src="${avatarSrc(m.avatarUrl)}" alt="" class="w-12 h-12 rounded-full object-cover bg-mates-cardElevated"></a>
          <div class="min-w-0">
            <a href="#mate/${m.id}" class="text-[15px] font-medium text-fg hover:underline underline-offset-4 decoration-fg-3">${esc(m.firstName)}${m.age ? `, ${m.age} ans` : ''}</a>
            <p class="meta mt-1 truncate">${esc(where)}</p>
          </div>
        </div>
        ${m.bio ? `<p class="text-sm leading-5 text-fg-2 line-clamp-2">${esc(m.bio)}</p>` : ''}
        <div class="flex flex-wrap gap-2">${sports}</div>
        <div class="flex items-center justify-end gap-2 pt-4 mt-auto border-t border-mates-border">
          <a href="#mate/${m.id}" class="btn btn-sm btn-ghost">Profil</a>
          <button type="button" data-action="open-propose" data-id="${m.id}" class="btn btn-sm btn-secondary">Proposer une partie</button>
        </div>
      </article>`;
  }

  // --------------------------------------------------------------- sports
  function renderSportsCatalog() {
    const query = $('search-sport-input').value.trim().toLowerCase();
    const list = state.sports.filter((s) => !query || s.name.toLowerCase().includes(query) || s.category.toLowerCase().includes(query));
    $('all-sports-grid').innerHTML = list.map((s) => `
      <a href="#sport/${esc(s.id)}" class="tile p-6 gap-4">
        <div class="flex items-center justify-between">${sportGlyph(s.id)}<span class="meta">${esc(s.category)}</span></div>
        <div class="flex flex-col gap-2">
          <h3 class="text-[17px] font-medium text-fg">${esc(s.name)}</h3>
          <p class="text-sm leading-5 text-fg-2 line-clamp-3">${esc(s.description)}</p>
        </div>
        <p class="meta mt-auto pt-4 border-t border-mates-border">${plural(s.activeMatesCount, 'mate')} · ${plural(s.venuesCount, 'club')} · ${esc(s.playersPerMatch.split('(')[0].trim())}</p>
      </a>`).join('') || '<p class="text-sm text-fg-2">Aucun sport ne correspond</p>';
    icons($('all-sports-grid'));
  }

  async function renderSportPage(sportId) {
    const s = state.sportsById[sportId];
    if (!s) {
      $('sport-hero-banner').innerHTML = '<p class="text-fg-2">Ce sport est introuvable</p>';
      $('sport-mates-grid').innerHTML = '';
      $('sport-venues-grid').innerHTML = '';
      return;
    }
    $('sport-hero-banner').innerHTML = `
      <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div class="flex items-start gap-4">
          ${sportGlyph(s.id, 'w-12 h-12 rounded-xl')}
          <div>
            <p class="meta mb-2">${esc(s.category)}</p>
            <h1 class="page-title">${esc(s.name)}</h1>
            <p class="text-[15px] text-fg-2 mt-2 max-w-xl">${esc(s.slogan)}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-action="filter-sport-mates" data-sport="${esc(s.id)}" class="btn btn-secondary">Voir les mates</button>
          <button type="button" data-action="open-create-match" data-sport="${esc(s.id)}" class="btn btn-primary">Réserver un terrain</button>
        </div>
      </div>
      <dl class="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-8 pt-6 border-t border-mates-border text-sm">
        <div><dt class="text-fg-3 text-xs mb-1">Format</dt><dd class="text-fg">${esc(s.playersPerMatch)}</dd></div>
        <div><dt class="text-fg-3 text-xs mb-1">Durée</dt><dd class="text-fg num">${esc(s.duration)}</dd></div>
        <div><dt class="text-fg-3 text-xs mb-1">Clubs partenaires</dt><dd class="text-fg num">${s.venuesCount}</dd></div>
        <div><dt class="text-fg-3 text-xs mb-1">Où ça joue</dt><dd class="text-fg">${esc(s.popularIn)}</dd></div>
      </dl>`;
    $('sport-mates-title').textContent = `Mates qui jouent : ${s.name.toLowerCase()}`;

    const [mates, venues] = await Promise.all([api('GET', `/mates?sport=${encodeURIComponent(s.id)}`), api('GET', `/venues?sport=${encodeURIComponent(s.id)}`)]);
    $('sport-mates-grid').innerHTML = mates.length
      ? mates.slice(0, 6).map((m) => mateCard(m, s.id)).join('')
      : '<p class="col-span-full card border-dashed p-8 text-center text-sm text-fg-2">Aucun mate inscrit pour ce sport</p>';
    $('sport-venues-grid').innerHTML = venues.map((v) => `
      <article class="card p-6 flex flex-col gap-4">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h3 class="text-[15px] font-medium text-fg">${esc(v.name)}</h3>
            <p class="meta mt-1">${esc([v.kind, v.city, km(v.distanceKm)].filter(Boolean).join(' · '))}</p>
          </div>
          <span class="text-xs text-fg-2 whitespace-nowrap">${esc(v.badge)}</span>
        </div>
        <p class="text-sm leading-5 text-fg-2">${esc(v.description.replace(/\.$/, ''))}</p>
        <div class="flex items-center justify-between gap-4 pt-4 mt-auto border-t border-mates-border">
          <span class="text-sm text-fg-2"><span class="num text-fg">${v.minPricePerHourCents === 0 ? 'Gratuit' : `${esc(euros(v.minPricePerHourCents))}/h`}</span> · ${plural(v.courts.length, 'terrain')}</span>
          <button type="button" data-action="open-create-match" data-sport="${esc(s.id)}" data-venue="${v.id}" class="btn btn-sm btn-secondary">Réserver</button>
        </div>
      </article>`).join('');
  }

  // ------------------------------------------------------- public profile
  function availabilityMatrix(map = {}, interactive = false) {
    let html = '<div class="availability-grid"><div></div>';
    for (const day of state.meta.days) html += `<div class="availability-head">${esc(day.slice(0, 3))}</div>`;
    for (const slot of state.meta.slots) {
      html += `<div class="availability-row-label">${esc(slotShort(slot.id))}</div>`;
      for (const day of state.meta.days) {
        const on = (map[day] || []).includes(slot.id);
        const label = `${day}, ${slotShort(slot.id).toLowerCase()} : ${on ? 'disponible' : 'indisponible'}`;
        html += interactive
          ? `<button type="button" class="availability-cell interactive ${on ? 'active' : ''}" data-action="toggle-slot" data-day="${esc(day)}" data-slot="${esc(slot.id)}" aria-pressed="${on}" aria-label="${esc(label)}"></button>`
          : `<div class="availability-cell ${on ? 'active' : ''}" role="img" aria-label="${esc(label)}"></div>`;
      }
    }
    return `${html}</div>`;
  }

  const levelBar = (rating) => `<span class="flex gap-1" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<span class="w-3 h-1 rounded-full ${i <= rating ? 'bg-fg-2' : 'bg-mates-hover'}"></span>`).join('')}</span>`;

  async function renderPublicProfile(id) {
    const isMe = id === 'me' || (state.me && String(state.me.id) === id);
    if (isMe && !state.me) { requireLogin('#mate/me'); return; }
    let m;
    try {
      m = await api('GET', `/mates/${encodeURIComponent(isMe ? 'me' : id)}`);
    } catch (err) {
      $('public-identity-card').innerHTML = `<p class="text-fg-2">${esc(err.message)}</p>`;
      $('public-sports-list').innerHTML = '';
      $('public-availability-matrix').innerHTML = '';
      return;
    }
    const action = isMe
      ? '<a href="#edit-profile" class="btn btn-secondary">Modifier mon profil</a>'
      : `<button type="button" data-action="open-propose" data-id="${m.id}" class="btn btn-primary">Proposer une partie</button>`;
    const where = [m.age ? `${m.age} ans` : '', m.city, km(m.distanceKm)].filter(Boolean).join(' · ');
    const stat = (value, label) => `<div><dt class="text-fg-3 text-xs mb-1">${label}</dt><dd class="num text-xl text-fg">${value}</dd></div>`;
    $('public-identity-card').innerHTML = `
      <div class="flex flex-col sm:flex-row gap-6">
        <img src="${avatarSrc(m.avatarUrl)}" alt="" class="w-24 h-24 rounded-2xl object-cover bg-mates-cardElevated flex-shrink-0">
        <div class="flex flex-col gap-4 flex-grow min-w-0">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 class="page-title">${esc(m.firstName)} ${esc(m.lastName)}</h1>
              <p class="meta mt-2">${esc(where)}</p>
            </div>
            ${action}
          </div>
          ${m.bio ? `<p class="text-[15px] leading-6 text-fg-2 max-w-2xl">${esc(m.bio)}</p>` : ''}
          <dl class="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 border-t border-mates-border">
            ${stat(m.matchesPlayed, 'Matchs joués')}
            ${stat(m.reliability != null ? `${m.reliability} %` : '—', 'Présence')}
            ${stat(m.fairPlayScore != null ? m.fairPlayScore.toFixed(1).replace('.', ',') : '—', 'Fair-play sur 5')}
            ${stat(m.sports.length, 'Sports')}
          </dl>
        </div>
      </div>`;
    $('public-sports-count').textContent = m.sports.length;
    $('public-sports-list').innerHTML = m.sports.length ? m.sports.map((s) => `
      <a href="#sport/${esc(s.id)}" class="flex items-center justify-between gap-4 p-2 -mx-2 rounded-lg hover:bg-mates-cardElevated transition-colors">
        <span class="flex items-center gap-3">${sportGlyph(s.id)}<span class="text-sm text-fg">${esc(s.name)}</span></span>
        <span class="flex items-center gap-3"><span class="text-sm text-fg-2">${esc(s.level)}</span>${levelBar(s.rating)}</span>
      </a>`).join('') : '<p class="text-sm text-fg-3">Aucun sport renseigné</p>';
    $('public-availability-matrix').innerHTML = availabilityMatrix(m.availability, false);
  }

  // ---------------------------------------------------------- edit profile
  function initEditProfile() {
    const me = state.me;
    state.editing = {
      sports: me.sports.map((s) => ({ id: s.id, level: s.level })),
      availability: JSON.parse(JSON.stringify(me.availability || {})),
      lat: me.lat, lng: me.lng,
    };
    $('edit-firstname').value = me.firstName || '';
    $('edit-lastname').value = me.lastName || '';
    $('edit-age').value = me.age || '';
    $('edit-city').value = me.city || '';
    $('edit-bio').value = me.bio || '';
    $('edit-avatar-url').value = me.avatarUrl || '';
    $('edit-avatar-preview').src = me.avatarUrl || '/assets/avatar-default.svg';
    $('edit-gps-status').textContent = me.lat != null ? 'Position enregistrée, précision environ 1 km' : '';
    renderEditSports();
    renderEditAvailability();
  }

  function renderEditSports() {
    const list = state.editing.sports;
    $('edit-sports-list').innerHTML = list.length ? list.map((s, i) => `
      <div class="flex items-center justify-between gap-4 py-2 ${i ? 'border-t border-mates-border' : ''}">
        <span class="flex items-center gap-3">${sportGlyph(s.id)}<span class="text-sm text-fg">${esc(sportName(s.id))}</span></span>
        <span class="flex items-center gap-2">
          <select data-level-index="${i}" aria-label="Niveau en ${esc(sportName(s.id))}" class="field h-8 w-40 text-[13px]">
            ${state.meta.levels.map((l) => `<option value="${esc(l)}" ${l === s.level ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
          <button type="button" data-action="remove-sport" data-index="${i}" aria-label="Retirer ${esc(sportName(s.id))}" class="icon-btn hover:text-bad"><i data-lucide="x" class="w-4 h-4"></i></button>
        </span>
      </div>`).join('') : '<p class="text-sm text-fg-3">Aucun sport pour l\'instant</p>';
    const owned = new Set(list.map((s) => s.id));
    $('add-new-sport-select').innerHTML = '<option value="">Sport à ajouter</option>' + state.sports
      .filter((s) => !owned.has(s.id)).map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    icons($('edit-sports-list'));
  }

  function renderEditAvailability() {
    $('edit-availability-matrix').innerHTML = availabilityMatrix(state.editing.availability, true);
  }

  async function saveProfile(e) {
    e.preventDefault();
    const btn = e.submitter;
    const age = $('edit-age').value.trim();
    const body = {
      firstName: $('edit-firstname').value,
      lastName: $('edit-lastname').value,
      age: age === '' ? null : Number(age),
      city: $('edit-city').value,
      bio: $('edit-bio').value,
      avatarUrl: $('edit-avatar-url').value.trim() || null,
      sports: state.editing.sports,
      availability: state.editing.availability,
      lat: state.editing.lat,
      lng: state.editing.lng,
    };
    if (btn) btn.disabled = true;
    try {
      const { user } = await api('PUT', '/me', body);
      state.me = user;
      renderHeader();
      refreshInviteBadge();
      showToast('Profil enregistré', 'success');
      location.hash = '#mate/me';
    } catch (err) { fail(err); } finally { if (btn) btn.disabled = false; }
  }

  function locateGps() {
    const status = $('edit-gps-status');
    if (!navigator.geolocation) { status.textContent = 'La géolocalisation n\'est pas disponible sur ce navigateur'; return; }
    status.textContent = 'Recherche de ta position';
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const r = await api('GET', `/cities/nearest?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        state.editing.lat = r.lat;
        state.editing.lng = r.lng;
        $('edit-city').value = r.city;
        status.textContent = `Position détectée près de ${r.city}, pense à enregistrer`;
      } catch (err) { status.textContent = err.message; }
    }, () => {
      status.textContent = 'Position refusée ou indisponible, saisis ta ville';
    }, { timeout: 8000, maximumAge: 600000 });
  }

  // ------------------------------------------------------------------ auth
  function updateAuthCard() {
    const register = state.authMode === 'register';
    $('auth-title').textContent = register ? 'Créer un compte' : 'Connexion';
    $('auth-subtitle').textContent = register ? 'Ton profil est prêt en une minute' : 'Rejoins les sportifs près de chez toi';
    $('auth-name-fields').classList.toggle('hidden', !register);
    $('auth-firstname').required = register;
    $('auth-password').autocomplete = register ? 'new-password' : 'current-password';
    $('auth-submit-btn').textContent = register ? 'Créer mon compte' : 'Se connecter';
    $('auth-toggle-question').textContent = register ? 'Déjà un compte ?' : 'Pas encore de compte ?';
    $('auth-toggle-btn').textContent = register ? 'Se connecter' : "S'inscrire";
    $('auth-error').classList.add('hidden');
  }

  async function submitAuth(e) {
    e.preventDefault();
    const register = state.authMode === 'register';
    const errBox = $('auth-error');
    errBox.classList.add('hidden');
    const btn = $('auth-submit-btn');
    btn.disabled = true;
    try {
      const body = { email: $('auth-email').value, password: $('auth-password').value };
      if (register) Object.assign(body, { firstName: $('auth-firstname').value, lastName: $('auth-lastname').value });
      const { user } = await api('POST', register ? '/auth/register' : '/auth/login', body);
      state.me = user;
      $('auth-password').value = '';
      renderHeader();
      refreshInviteBadge();
      showToast(`Bienvenue, ${user.firstName}`, 'success');
      const next = state.afterLogin || (register ? '#edit-profile' : '#mates');
      state.afterLogin = null;
      if (location.hash === next) route(); else location.hash = next;
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  }

  async function logout() {
    try { await api('POST', '/auth/logout'); } catch { /* cookie is cleared server-side anyway */ }
    state.me = null;
    renderHeader();
    showToast('Tu es déconnecté');
    location.hash = '#home';
  }

  // --------------------------------------------------------------- matches
  async function renderMatches() {
    const sport = $('matches-sport-filter').value;
    state.matches = await api('GET', `/matches?sport=${encodeURIComponent(sport)}`);
    $('matches-empty-state').classList.toggle('hidden', state.matches.length > 0);
    $('open-matches-list').innerHTML = state.matches.map((m) => {
      const remaining = m.totalSlots - m.bookedSlots;
      let cta;
      if (m.isHost) cta = `<button type="button" data-action="cancel-match" data-id="${m.id}" class="btn btn-sm btn-ghost hover:text-bad">Annuler le match</button>`;
      else if (m.joined) cta = `<span class="text-sm text-fg-2 flex items-center gap-2"><i data-lucide="check" class="w-4 h-4 text-ok"></i>Inscrit</span><button type="button" data-action="leave-match" data-id="${m.id}" class="btn btn-sm btn-ghost">Se désister</button>`;
      else if (remaining <= 0) cta = '<span class="text-sm text-fg-3">Complet</span>';
      else cta = `<button type="button" data-action="open-join" data-id="${m.id}" class="btn btn-sm btn-secondary">Rejoindre</button>`;
      return `
        <article class="card p-6 flex flex-col gap-4">
          <div class="flex items-start gap-3">
            ${sportGlyph(m.sport.id)}
            <div class="min-w-0 flex-grow">
              <h3 class="text-[15px] font-medium text-fg truncate">${esc(m.venue.name)}</h3>
              <p class="meta mt-1 truncate">${esc(m.sport.name)} · ${esc(m.court.name)} · ${esc(m.venue.city)}</p>
            </div>
          </div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt class="text-fg-3">Quand</dt><dd class="num text-fg text-right">${esc(matchWhen(m))}</dd>
            <dt class="text-fg-3">Niveau</dt><dd class="text-fg text-right">${esc(m.levelRequired)}</dd>
            <dt class="text-fg-3">Par joueur</dt><dd class="num text-fg text-right">${esc(euros(m.priceCents))}</dd>
            <dt class="text-fg-3">Organisé par</dt><dd class="text-fg text-right">${esc(m.host.name)}</dd>
          </dl>
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-fg-3">Joueurs</span>
              <span class="num ${remaining > 0 ? 'text-mates-green' : 'text-fg-3'}">${m.bookedSlots}/${m.totalSlots} · ${esc(placesText(m))}</span>
            </div>
            <div class="flex flex-wrap gap-1">${seatsRow(m, 12)}</div>
          </div>
          <div class="flex items-center justify-end gap-2 pt-4 mt-auto border-t border-mates-border">${cta}</div>
        </article>`;
    }).join('');
  }

  function openJoinModal(id) {
    if (!requireLogin(location.hash === '#home' || !location.hash ? '#home' : '#matches')) return;
    const m = state.matches.find((x) => x.id === Number(id));
    if (!m) return;
    state.pendingJoinId = m.id;
    $('modal-match-title').textContent = `${m.sport.name} · ${m.venue.name}`;
    $('modal-match-details').textContent = `${m.court.name} · niveau ${m.levelRequired.toLowerCase()}`;
    $('modal-match-time').textContent = matchWhen(m);
    $('modal-match-price').textContent = euros(m.priceCents);
    $('modal-match-seats').innerHTML = seatsRow(m, 10);
    openModal('join-match-modal');
  }

  async function confirmJoin(btn) {
    btn.disabled = true;
    try {
      await api('POST', `/matches/${state.pendingJoinId}/join`);
      closeModals();
      showToast('Ta place est réservée', 'success');
      if (location.hash === '#matches') { await renderMatches(); icons(); } else location.hash = '#matches';
    } catch (err) { fail(err); } finally { btn.disabled = false; }
  }

  async function matchAction(kind, id, btn) {
    const confirmText = kind === 'cancel' ? 'Annuler ce match ? Le terrain sera libéré.' : 'Te désister de ce match ?';
    if (!window.confirm(confirmText)) return;
    btn.disabled = true;
    try {
      if (kind === 'cancel') await api('DELETE', `/matches/${id}`); else await api('POST', `/matches/${id}/leave`);
      showToast(kind === 'cancel' ? 'Match annulé, terrain libéré' : 'Tu t\'es désisté');
      await renderMatches();
      icons();
    } catch (err) { fail(err); btn.disabled = false; }
  }

  // ----------------------------------------------------- create a match
  async function openCreateMatch(sportId, venueId) {
    if (!requireLogin(location.hash)) return;
    const sport = sportId || $('cm-sport').value || state.sports[0].id;
    $('cm-sport').value = sport;
    const today = todayYmd();
    $('cm-date').min = today;
    $('cm-date').max = addDays(today, 60);
    if (!$('cm-date').value || $('cm-date').value < today) $('cm-date').value = today;
    openModal('create-match-modal');
    await loadVenues(venueId);
  }

  async function loadVenues(venueId) {
    const sport = $('cm-sport').value;
    state.createMatch.venues = await api('GET', `/venues?sport=${encodeURIComponent(sport)}`);
    $('cm-venue').innerHTML = state.createMatch.venues.map((v) => `<option value="${v.id}">${esc(v.name)}, ${esc(v.city)}</option>`).join('');
    if (venueId) $('cm-venue').value = String(venueId);
    loadCourts();
  }

  function loadCourts() {
    const venue = state.createMatch.venues.find((v) => String(v.id) === $('cm-venue').value);
    $('cm-court').innerHTML = (venue ? venue.courts : []).map((c) => `<option value="${c.id}">${esc(c.name)}, ${c.pricePerHourCents === 0 ? 'gratuit' : `${esc(euros(c.pricePerHourCents))}/h`}</option>`).join('');
    loadTimes();
  }

  let timesSeq = 0;
  async function loadTimes() {
    const seq = ++timesSeq;
    const courtId = $('cm-court').value;
    const select = $('cm-time');
    if (!courtId || !$('cm-date').value) { select.innerHTML = ''; updatePrice(); return; }
    select.innerHTML = '<option value="">Chargement</option>';
    try {
      const { slots } = await api('GET', `/courts/${courtId}/slots?date=${$('cm-date').value}&duration=${$('cm-duration').value}`);
      if (seq !== timesSeq) return;
      const free = slots.filter((s) => s.free);
      select.innerHTML = free.length
        ? free.map((s) => `<option value="${s.time}">${s.time}</option>`).join('')
        : '<option value="">Aucun créneau libre ce jour</option>';
      const preferred = free.find((s) => s.time === '19:00') || free.find((s) => s.time >= '18:00');
      if (preferred) select.value = preferred.time;
    } catch (err) { select.innerHTML = '<option value="">—</option>'; fail(err); }
    updatePrice();
  }

  function updatePrice() {
    const venue = state.createMatch.venues.find((v) => String(v.id) === $('cm-venue').value);
    const court = venue && venue.courts.find((c) => String(c.id) === $('cm-court').value);
    const slots = Number($('cm-slots').value);
    if (!court || !slots || slots < 2) { $('cm-price').textContent = '–'; return; }
    const cents = Math.ceil((court.pricePerHourCents * Number($('cm-duration').value)) / 60 / slots);
    $('cm-price').textContent = euros(cents);
  }

  async function submitCreateMatch(e) {
    e.preventDefault();
    const btn = e.submitter;
    if (!$('cm-time').value) { showToast('Choisis une heure de début libre', 'warning'); return; }
    if (btn) btn.disabled = true;
    try {
      await api('POST', '/matches', {
        courtId: Number($('cm-court').value),
        date: $('cm-date').value,
        time: $('cm-time').value,
        durationMin: Number($('cm-duration').value),
        totalSlots: Number($('cm-slots').value),
        levelRequired: $('cm-level').value,
      });
      closeModals();
      showToast('Terrain réservé, ton match est publié', 'success');
      $('matches-sport-filter').value = 'all';
      if (location.hash === '#matches') { await renderMatches(); icons(); } else location.hash = '#matches';
    } catch (err) {
      fail(err);
      if (err.status === 409) loadTimes();
    } finally { if (btn) btn.disabled = false; }
  }

  // ------------------------------------------------------------ propose
  async function openPropose(mateId) {
    if (!requireLogin(location.hash)) return;
    if (state.me && String(state.me.id) === String(mateId)) return;
    let mate;
    try { mate = await api('GET', `/mates/${encodeURIComponent(mateId)}`); } catch (err) { fail(err); return; }
    state.proposeTo = mate;
    $('propose-modal-title').textContent = `Proposer une partie à ${mate.firstName}`;
    $('propose-sport').innerHTML = mate.sports.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}, ${esc(s.level.toLowerCase())}</option>`).join('');
    const today = todayYmd();
    $('propose-date').min = today;
    $('propose-date').max = addDays(today, 60);
    $('propose-date').value = today;
    $('propose-message').value = '';
    updateProposeHint();
    openModal('propose-match-modal');
  }

  function updateProposeHint() {
    const mate = state.proposeTo;
    const date = $('propose-date').value;
    const hint = $('propose-availability-hint');
    if (!mate || !date) { hint.textContent = ''; return; }
    const day = state.meta.days[weekdayIndex(date)];
    const slot = $('propose-slot').value;
    const ok = (mate.availability[day] || []).includes(slot);
    hint.textContent = ok
      ? `${mate.firstName} est habituellement libre le ${day.toLowerCase()} ${slotShort(slot).toLowerCase()}`
      : `${mate.firstName} n'est habituellement pas libre sur ce créneau, tu peux quand même proposer`;
    hint.className = `text-sm min-h-5 ${ok ? 'text-ok' : 'text-fg-2'}`;
  }

  async function submitPropose(e) {
    e.preventDefault();
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    try {
      await api('POST', '/invitations', {
        toUserId: state.proposeTo.id,
        sportId: $('propose-sport').value,
        date: $('propose-date').value,
        slot: $('propose-slot').value,
        message: $('propose-message').value,
      });
      closeModals();
      showToast(`Invitation envoyée à ${state.proposeTo.firstName}`, 'success');
    } catch (err) { fail(err); } finally { if (btn) btn.disabled = false; }
  }

  // ------------------------------------------------------------- inbox
  const STATUS = {
    pending: '<span class="text-sm text-warn">En attente</span>',
    accepted: '<span class="text-sm text-ok">Acceptée</span>',
    declined: '<span class="text-sm text-fg-3">Refusée</span>',
  };

  async function renderInbox() {
    const { received, sent } = await api('GET', '/invitations');
    const row = (i, incoming) => {
      const who = incoming ? i.from : i.to;
      const actions = incoming && i.status === 'pending' ? `
        <div class="flex gap-2 flex-shrink-0">
          <button type="button" data-action="respond-invite" data-id="${i.id}" data-response="declined" class="btn btn-sm btn-ghost">Refuser</button>
          <button type="button" data-action="respond-invite" data-id="${i.id}" data-response="accepted" class="btn btn-sm btn-primary">Accepter</button>
        </div>` : STATUS[i.status];
      return `
        <article class="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-start gap-4 min-w-0">
            <a href="#mate/${who.id}" class="flex-shrink-0"><img src="${avatarSrc(who.avatarUrl)}" alt="" class="w-10 h-10 rounded-full object-cover bg-mates-cardElevated"></a>
            <div class="min-w-0">
              <p class="text-[15px] text-fg">${incoming ? `${esc(who.name)} te propose du ${esc(i.sport.name.toLowerCase())}` : `Proposé à ${esc(who.name)} : ${esc(i.sport.name.toLowerCase())}`}</p>
              <p class="meta mt-1">${esc(dayLabel(i.date))} · ${esc(slotShort(i.slot).toLowerCase())}</p>
              ${i.message ? `<p class="text-sm text-fg-2 mt-2 break-words">${esc(i.message)}</p>` : ''}
            </div>
          </div>
          ${actions}
        </article>`;
    };
    const empty = (t) => `<p class="card border-dashed p-6 text-sm text-fg-2">${t}</p>`;
    $('inbox-received').innerHTML = received.length ? received.map((i) => row(i, true)).join('') : empty('Aucune invitation reçue pour l\'instant');
    $('inbox-sent').innerHTML = sent.length ? sent.map((i) => row(i, false)).join('') : empty('Tu n\'as encore proposé de partie à personne. <a href="#mates" class="text-fg underline underline-offset-4">Trouver un mate</a>');
  }

  async function respondInvite(id, response, btn) {
    btn.disabled = true;
    try {
      await api('POST', `/invitations/${id}/respond`, { response });
      showToast(response === 'accepted' ? 'Invitation acceptée' : 'Invitation refusée', response === 'accepted' ? 'success' : 'info');
      await renderInbox();
      refreshInviteBadge();
    } catch (err) { fail(err); btn.disabled = false; }
  }

  // ------------------------------------------------------------- modals
  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    const modal = $(id);
    modal.classList.remove('hidden');
    icons(modal);
    const first = modal.querySelector('select, input, textarea, [data-action="confirm-join"]');
    if (first) first.focus();
  }
  function closeModals() {
    let wasOpen = false;
    document.querySelectorAll('.modal-overlay').forEach((m) => {
      if (!m.classList.contains('hidden')) wasOpen = true;
      m.classList.add('hidden');
    });
    if (wasOpen && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  // ---------------------------------------------------------- listeners
  function setupListeners() {
    $('mobile-menu-btn').addEventListener('click', () => toggleDrawer());

    document.addEventListener('click', (e) => {
      if (e.target.classList && e.target.classList.contains('modal-overlay')) { closeModals(); return; }
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const { action, id } = el.dataset;
      switch (action) {
        case 'reset-filters':
          state.filters = { sport: 'all', level: 'all', city: '' };
          $('filter-city').value = '';
          renderMatesGrid().catch(fail);
          break;
        case 'filter-sport-mates':
          state.filters = { sport: el.dataset.sport, level: 'all', city: '' };
          location.hash = '#mates';
          break;
        case 'open-propose': openPropose(id); break;
        case 'open-join': openJoinModal(id); break;
        case 'confirm-join': confirmJoin(el); break;
        case 'leave-match': matchAction('leave', id, el); break;
        case 'cancel-match': matchAction('cancel', id, el); break;
        case 'open-create-match': openCreateMatch(el.dataset.sport, el.dataset.venue).catch(fail); break;
        case 'close-modal': closeModals(); break;
        case 'add-sport': {
          const sportId = $('add-new-sport-select').value;
          if (!sportId) { showToast('Choisis un sport dans la liste', 'warning'); break; }
          state.editing.sports.push({ id: sportId, level: $('add-new-sport-level').value });
          renderEditSports();
          break;
        }
        case 'remove-sport':
          state.editing.sports.splice(Number(el.dataset.index), 1);
          renderEditSports();
          break;
        case 'toggle-slot': {
          const { day, slot } = el.dataset;
          const list = state.editing.availability[day] || (state.editing.availability[day] = []);
          const i = list.indexOf(slot);
          if (i >= 0) list.splice(i, 1); else list.push(slot);
          renderEditAvailability();
          const again = document.querySelector(`[data-action="toggle-slot"][data-day="${CSS.escape(day)}"][data-slot="${CSS.escape(slot)}"]`);
          if (again) again.focus();
          break;
        }
        case 'locate-gps': locateGps(); break;
        case 'logout': logout(); break;
        case 'toggle-auth':
          state.authMode = state.authMode === 'login' ? 'register' : 'login';
          updateAuthCard();
          break;
        case 'fill-demo':
          if (state.meta.demo) {
            state.authMode = 'login';
            updateAuthCard();
            $('auth-email').value = state.meta.demo.email;
            $('auth-password').value = state.meta.demo.password;
          }
          break;
        case 'respond-invite': respondInvite(id, el.dataset.response, el); break;
        default: break;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModals(); return; }
      // SVG court seats behave like buttons for keyboard users.
      const seat = e.target.closest && e.target.closest('g[role="button"][data-action]');
      if (seat && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        seat.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    });

    document.addEventListener('change', (e) => {
      const idx = e.target.dataset && e.target.dataset.levelIndex;
      if (idx !== undefined && state.editing) state.editing.sports[Number(idx)].level = e.target.value;
    });

    $('filter-sport').addEventListener('change', (e) => { state.filters.sport = e.target.value; renderMatesGrid().catch(fail); });
    $('filter-level').addEventListener('change', (e) => { state.filters.level = e.target.value; renderMatesGrid().catch(fail); });
    let cityTimer;
    $('filter-city').addEventListener('input', (e) => {
      clearTimeout(cityTimer);
      cityTimer = setTimeout(() => { state.filters.city = e.target.value.trim(); renderMatesGrid().catch(fail); }, 250);
    });
    $('search-sport-input').addEventListener('input', renderSportsCatalog);
    $('matches-sport-filter').addEventListener('change', () => renderMatches().then(() => icons()).catch(fail));

    $('profile-edit-form').addEventListener('submit', saveProfile);
    $('auth-form').addEventListener('submit', submitAuth);
    $('propose-form').addEventListener('submit', submitPropose);
    $('create-match-form').addEventListener('submit', submitCreateMatch);
    $('edit-avatar-url').addEventListener('input', (e) => {
      const v = e.target.value.trim();
      $('edit-avatar-preview').src = /^https:\/\//.test(v) ? v : '/assets/avatar-default.svg';
    });
    $('edit-avatar-preview').addEventListener('error', (e) => {
      if (!e.target.src.endsWith('/assets/avatar-default.svg')) e.target.src = '/assets/avatar-default.svg';
    });

    $('cm-sport').addEventListener('change', () => loadVenues().catch(fail));
    $('cm-venue').addEventListener('change', loadCourts);
    $('cm-court').addEventListener('change', loadTimes);
    $('cm-date').addEventListener('change', loadTimes);
    $('cm-duration').addEventListener('change', loadTimes);
    $('cm-slots').addEventListener('input', updatePrice);

    $('propose-date').addEventListener('change', updateProposeHint);
    $('propose-slot').addEventListener('change', updateProposeHint);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
