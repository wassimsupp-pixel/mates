/**
 * MATES. — client SPA (hash router) talking to the JSON API under /api.
 * No inline handlers: every interaction goes through data-action delegation,
 * and every value inserted as HTML goes through esc().
 */
(() => {
  'use strict';

  const TZ = 'Europe/Brussels';
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
  const icons = () => { if (window.lucide) window.lucide.createIcons(); };
  const sportIcon = (id) => (state.sportsById[id] || {}).icon || '🏅';

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
      throw Object.assign(new Error('Connexion au serveur impossible.'), { status: 0 });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Erreur inattendue.'), { status: res.status });
    return data;
  }

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
  const matchWhen = (m) => `${dayLabel(ymdOf(new Date(m.startsAt)))} • ${fmtTime(m.startsAt)} - ${fmtTime(m.endsAt)}`;
  const euros = (cents) => (cents === 0 ? 'Gratuit' : (cents / 100).toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' }));
  const stars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const slotLabel = (id) => ((state.meta.slots.find((s) => s.id === id) || {}).label || id);

  function showToast(message, type = 'info') {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast-msg${type === 'error' ? ' error' : ''}`;
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', { success: 'check-circle', error: 'alert-circle', warning: 'alert-circle' }[type] || 'info');
    icon.setAttribute('class', `w-5 h-5 flex-shrink-0 ${type === 'error' ? 'text-rose-400' : 'text-mates-green'}`);
    const text = document.createElement('span');
    text.className = 'text-xs font-semibold text-white';
    text.textContent = message;
    toast.append(icon, text);
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons({ root: toast });
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
  const fail = (err) => showToast(err.message || 'Erreur inattendue.', 'error');

  function requireLogin(returnTo) {
    if (state.me) return true;
    state.afterLogin = returnTo || location.hash || '#home';
    showToast('Connecte-toi pour continuer.', 'info');
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
    const opts = state.sports.map((s) => `<option value="${esc(s.id)}">${esc(s.icon)} ${esc(s.name)}</option>`).join('');
    $('filter-sport').innerHTML = `<option value="all">Tous les sports</option>${opts}`;
    $('matches-sport-filter').innerHTML = `<option value="all">Tous les sports</option>${opts}`;
    $('cm-sport').innerHTML = opts;
    $('city-list').innerHTML = state.meta.cities.map((c) => `<option value="${esc(c)}"></option>`).join('');
    $('cm-duration').innerHTML = state.meta.durations.map((d) => `<option value="${d}" ${d === 90 ? 'selected' : ''}>${d} min</option>`).join('');
    $('cm-level').innerHTML = state.meta.matchLevels.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
    $('propose-slot').innerHTML = state.meta.slots.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('');
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
    $('mobile-drawer').classList.add('hidden');
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
      link.classList.toggle('bg-mates-green', on);
      link.classList.toggle('text-black', on);
      link.classList.toggle('font-bold', on);
      link.classList.toggle('text-slate-300', !on);
    });
  }

  function renderHeader() {
    const box = $('header-user-section');
    const mobile = $('mobile-user-links');
    if (state.me) {
      box.innerHTML = `
        <a href="#inbox" class="relative p-2 rounded-full border border-mates-border hover:border-mates-green text-slate-300 hover:text-mates-green transition-all" title="Mes invitations">
          <i data-lucide="mail" class="w-5 h-5"></i>
          <span id="invite-badge" class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-mates-green text-black text-[10px] font-extrabold flex items-center justify-center"></span>
        </a>
        <a href="#edit-profile" class="flex items-center gap-2.5 bg-mates-card hover:bg-mates-cardElevated border border-mates-border hover:border-mates-green/60 p-1.5 pr-3.5 rounded-full transition-all group">
          <img src="${avatarSrc(state.me.avatarUrl)}" alt="" class="w-8 h-8 rounded-full object-cover ring-2 ring-mates-green">
          <div class="text-left hidden sm:block leading-tight">
            <div class="text-xs font-bold text-white group-hover:text-mates-green transition-colors">${esc(state.me.firstName)}</div>
            <div class="text-[10px] text-slate-400">Mon profil</div>
          </div>
        </a>`;
      mobile.innerHTML = `
        <a href="#inbox" class="mobile-nav-link block px-4 py-2 rounded-lg font-medium hover:bg-mates-cardElevated">Mes invitations</a>
        <a href="#edit-profile" class="mobile-nav-link block px-4 py-2 rounded-lg font-semibold bg-mates-green text-black text-center mt-3">Mon profil</a>`;
    } else {
      box.innerHTML = `<a href="#auth" class="btn-neon text-xs py-2 px-4 shadow-sm"><i data-lucide="log-in" class="w-4 h-4"></i><span>Connexion</span></a>`;
      mobile.innerHTML = '<a href="#auth" class="mobile-nav-link block px-4 py-2 rounded-lg font-semibold bg-mates-green text-black text-center mt-3">Connexion / Inscription</a>';
    }
    icons();
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
      }
    } catch { /* badge is best-effort */ }
  }

  // ----------------------------------------------------------------- home
  async function renderHome() {
    $('home-sports-grid').innerHTML = state.sports.map((s) => `
      <a href="#sport/${esc(s.id)}" class="sport-card-tile p-4 rounded-2xl flex flex-col items-center text-center group cursor-pointer relative overflow-hidden">
        <div class="text-3xl mb-2 group-hover:scale-110 transition-transform">${esc(s.icon)}</div>
        <h4 class="text-sm font-bold text-white group-hover:text-mates-green transition-colors">${esc(s.name)}</h4>
        <span class="text-[11px] text-slate-400 mt-1">${s.activeMatesCount} mate${s.activeMatesCount > 1 ? 's' : ''}</span>
      </a>`).join('');

    const [stats, matches] = await Promise.all([api('GET', '/stats'), api('GET', '/matches')]);
    $('stat-mates').textContent = stats.players;
    $('stat-matches').textContent = stats.openMatches;
    state.matches = matches;

    const box = $('home-featured-match');
    const m = matches.find((x) => x.bookedSlots < x.totalSlots && !x.joined) || matches[0];
    if (!m) {
      box.innerHTML = `<p class="text-sm text-slate-300">Aucun match ouvert pour le moment.</p>
        <a href="#matches" class="btn-neon w-full py-2.5 text-sm mt-4">Créer le premier match</a>`;
      return;
    }
    const remaining = m.totalSlots - m.bookedSlots;
    const shown = m.players.slice(0, remaining > 0 ? 3 : 4);
    box.innerHTML = `
      <div class="flex items-center justify-between pb-4 border-b border-mates-border gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-3xl">${esc(m.sport.icon)}</span>
          <div class="min-w-0">
            <div class="text-xs font-bold text-mates-green uppercase tracking-wider">Match ouvert • ${esc(m.sport.name)}</div>
            <h4 class="text-base font-bold text-white truncate">${esc(m.venue.name)}</h4>
          </div>
        </div>
        ${remainingBadge(remaining)}
      </div>
      <div class="flex items-center justify-between py-3 text-sm text-slate-300 gap-2 flex-wrap">
        <span class="flex items-center gap-1.5"><i data-lucide="calendar" class="w-4 h-4 text-mates-green"></i>${esc(matchWhen(m))}</span>
        <span class="font-bold text-white">${esc(euros(m.priceCents))} / pers.</span>
      </div>
      <div class="my-4">
        <div class="text-xs font-semibold text-slate-400 mb-2">Joueurs inscrits (${m.bookedSlots}/${m.totalSlots}) • ${esc(m.levelRequired)} :</div>
        <div class="grid grid-cols-4 gap-2">
          ${shown.map((p) => `
            <div class="bg-mates-cardElevated p-2 rounded-xl text-center border border-mates-border">
              <img src="${avatarSrc(p.avatarUrl)}" alt="" class="w-10 h-10 rounded-full mx-auto object-cover ring-2 ring-mates-green">
              <div class="text-[11px] font-bold mt-1 truncate">${esc(p.name)}</div>
            </div>`).join('')}
          ${remaining > 0 && !m.joined ? `
            <button type="button" data-action="open-join" data-id="${m.id}" class="bg-mates-green/10 border-2 border-dashed border-mates-green/60 p-2 rounded-xl text-center flex flex-col items-center justify-center hover:bg-mates-green/20 transition-all">
              <span class="w-10 h-10 rounded-full bg-mates-green text-black flex items-center justify-center font-extrabold text-lg">+</span>
              <span class="text-[11px] font-bold text-mates-green mt-1">Toi ?</span>
            </button>` : ''}
        </div>
      </div>
      <a href="#matches" class="w-full btn-neon py-2.5 text-sm"><span>Voir les matchs ouverts</span><i data-lucide="arrow-right" class="w-4 h-4"></i></a>`;
  }

  function remainingBadge(remaining) {
    if (remaining <= 0) return '<span class="px-2.5 py-1 rounded-full text-xs font-bold border bg-slate-500/20 text-slate-300 border-slate-500/30 whitespace-nowrap">Complet</span>';
    const color = remaining === 1 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    return `<span class="px-2.5 py-1 rounded-full text-xs font-bold border ${color} whitespace-nowrap">Reste ${remaining} place${remaining > 1 ? 's' : ''}</span>`;
  }

  // ---------------------------------------------------------------- mates
  let mateSearchSeq = 0;
  async function renderMatesGrid() {
    const seq = ++mateSearchSeq;
    const { sport, level, city } = state.filters;
    $('filter-sport').value = sport;
    $('filter-level').value = level;
    if (document.activeElement !== $('filter-city')) $('filter-city').value = city;
    $('filter-level-hint').textContent = sport === 'all' ? '(tous sports)' : `(en ${(state.sportsById[sport] || {}).name || ''})`;
    const params = new URLSearchParams({ sport, level, city });
    const mates = await api('GET', `/mates?${params}`);
    if (seq !== mateSearchSeq) return; // a newer search finished first
    $('mates-count-badge').textContent = mates.length;
    $('mates-empty-state').classList.toggle('hidden', mates.length > 0);
    $('mates-grid').innerHTML = mates.map((m) => mateCard(m, sport)).join('');
    icons();
  }

  const distanceText = (m) => (m.distanceKm == null ? '' : ` • à ${String(m.distanceKm).replace('.', ',')} km`);

  function mateCard(m, highlightSport) {
    const sports = m.sports.slice(0, 3).map((s) => `
      <span class="badge-sport ${s.id === highlightSport ? 'ring-1 ring-mates-green' : ''}">
        <span>${esc(s.icon)} ${esc(s.name)}</span><span class="opacity-80 font-normal">(${esc(s.level)})</span>
      </span>`).join('');
    return `
      <div class="bg-mates-card border border-mates-border hover:border-mates-green/60 rounded-3xl p-6 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-xl group">
        <div>
          <div class="flex items-center gap-4 mb-4">
            <a href="#mate/${m.id}" class="relative flex-shrink-0">
              <img src="${avatarSrc(m.avatarUrl)}" alt="" class="w-16 h-16 rounded-full object-cover ring-2 ring-mates-border group-hover:ring-mates-green transition-all">
            </a>
            <div class="overflow-hidden">
              <a href="#mate/${m.id}" class="text-lg font-bold text-white group-hover:text-mates-green transition-colors">
                ${esc(m.firstName)}${m.age ? `, ${m.age} ans` : ''}
              </a>
              <div class="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <i data-lucide="map-pin" class="w-3.5 h-3.5 text-mates-green"></i><span>${esc(m.city)}${esc(distanceText(m))}</span>
              </div>
            </div>
          </div>
          ${m.bio ? `<p class="text-xs text-slate-300 leading-relaxed mb-4 line-clamp-2">« ${esc(m.bio)} »</p>` : ''}
          <div class="space-y-1.5 mb-5">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sports & niveau :</div>
            <div class="flex flex-wrap gap-1.5">${sports}</div>
          </div>
        </div>
        <div class="pt-4 border-t border-mates-border flex items-center gap-2">
          <a href="#mate/${m.id}" class="w-1/2 btn-outline-neon py-2 text-xs"><i data-lucide="user" class="w-3.5 h-3.5"></i><span>Voir profil</span></a>
          <button type="button" data-action="open-propose" data-id="${m.id}" class="w-1/2 btn-neon py-2 text-xs"><i data-lucide="swords" class="w-3.5 h-3.5"></i><span>Jouer</span></button>
        </div>
      </div>`;
  }

  // --------------------------------------------------------------- sports
  function renderSportsCatalog() {
    const query = $('search-sport-input').value.trim().toLowerCase();
    const list = state.sports.filter((s) => !query || s.name.toLowerCase().includes(query) || s.category.toLowerCase().includes(query));
    $('all-sports-grid').innerHTML = list.map((s) => `
      <a href="#sport/${esc(s.id)}" class="bg-mates-card border border-mates-border hover:border-mates-green/70 rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl group flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-4xl p-2.5 bg-mates-cardElevated rounded-2xl border border-mates-border group-hover:border-mates-green/40 transition-colors">${esc(s.icon)}</span>
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-mates-green/10 text-mates-green border border-mates-green/30 uppercase tracking-wider">${esc(s.category)}</span>
          </div>
          <h3 class="text-xl font-bold text-white group-hover:text-mates-green transition-colors mb-2">${esc(s.name)}</h3>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">${esc(s.description)}</p>
        </div>
        <div class="pt-4 border-t border-mates-border space-y-2">
          <div class="flex items-center justify-between text-xs text-slate-400">
            <span>${s.activeMatesCount} mates • ${s.venuesCount} clubs</span>
            <span class="text-slate-300 font-semibold">${esc(s.playersPerMatch.split('(')[0])}</span>
          </div>
          <div class="text-xs font-bold text-mates-green flex items-center justify-end gap-1 pt-1 group-hover:translate-x-1 transition-transform">
            <span>Découvrir</span><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </div>
        </div>
      </a>`).join('') || '<p class="text-sm text-slate-400">Aucun sport ne correspond à ta recherche.</p>';
    icons();
  }

  async function renderSportPage(sportId) {
    const s = state.sportsById[sportId];
    if (!s) {
      $('sport-hero-banner').innerHTML = '<p class="text-slate-300">Ce sport est introuvable.</p>';
      $('sport-mates-grid').innerHTML = '';
      $('sport-venues-grid').innerHTML = '';
      return;
    }
    $('sport-hero-banner').innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div class="flex items-center gap-5">
          <div class="text-6xl p-4 bg-slate-900/80 rounded-3xl border border-mates-border shadow-xl">${esc(s.icon)}</div>
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-mates-green/15 text-mates-green text-xs font-bold uppercase mb-2">${esc(s.category)}</div>
            <h1 class="text-3xl sm:text-4xl font-extrabold text-white">${esc(s.name)}</h1>
            <p class="text-slate-300 text-sm mt-1 max-w-xl font-medium">« ${esc(s.slogan)} »</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button type="button" data-action="filter-sport-mates" data-sport="${esc(s.id)}" class="btn-neon text-sm py-3 px-5 shadow-lg"><i data-lucide="users" class="w-4 h-4"></i><span>Filtrer les mates</span></button>
          <button type="button" data-action="open-create-match" data-sport="${esc(s.id)}" class="btn-outline-neon text-sm py-3 px-5"><i data-lucide="calendar" class="w-4 h-4"></i><span>Réserver un terrain</span></button>
        </div>
      </div>
      <div class="mt-8 pt-6 border-t border-mates-border/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-slate-300">
        <div><span class="text-slate-500 block uppercase font-bold text-[10px]">Format classique</span><span class="text-white font-semibold">${esc(s.playersPerMatch)}</span></div>
        <div><span class="text-slate-500 block uppercase font-bold text-[10px]">Durée moyenne</span><span class="text-white font-semibold">${esc(s.duration)}</span></div>
        <div><span class="text-slate-500 block uppercase font-bold text-[10px]">Clubs partenaires</span><span class="text-white font-semibold">${s.venuesCount} centre${s.venuesCount > 1 ? 's' : ''}</span></div>
        <div><span class="text-slate-500 block uppercase font-bold text-[10px]">Zones actives</span><span class="text-white font-semibold">${esc(s.popularIn)}</span></div>
      </div>`;
    $('sport-mates-title').textContent = `Ils pratiquent : ${s.name}`;

    const [mates, venues] = await Promise.all([api('GET', `/mates?sport=${encodeURIComponent(s.id)}`), api('GET', `/venues?sport=${encodeURIComponent(s.id)}`)]);
    $('sport-mates-grid').innerHTML = mates.length
      ? mates.slice(0, 6).map((m) => mateCard(m, s.id)).join('')
      : '<div class="col-span-full text-center py-10 bg-mates-card rounded-2xl border border-dashed border-mates-border"><p class="text-sm text-slate-400">Aucun mate n\'est encore inscrit pour ce sport.</p></div>';
    $('sport-venues-grid').innerHTML = venues.map((v) => `
      <div class="bg-mates-card border border-mates-border rounded-2xl p-5 space-y-3 flex flex-col justify-between">
        <div class="space-y-3">
          <div class="flex justify-between items-start gap-2">
            <div>
              <span class="text-xs font-bold text-mates-green uppercase">${esc(v.kind)}</span>
              <h4 class="text-base font-bold text-white mt-1">${esc(v.name)}</h4>
              <div class="text-xs text-slate-400 mt-0.5">${esc(v.city)}${v.distanceKm != null ? ` • à ${String(v.distanceKm).replace('.', ',')} km` : ''}</div>
            </div>
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 whitespace-nowrap">${esc(v.badge)}</span>
          </div>
          <p class="text-xs text-slate-400">${esc(v.description)}</p>
        </div>
        <div class="pt-2 flex justify-between items-center text-xs">
          <span class="text-slate-300 font-bold">${v.minPricePerHourCents === 0 ? 'Accès gratuit' : `Dès ${esc(euros(v.minPricePerHourCents))} / h`} • ${v.courts.length} terrain${v.courts.length > 1 ? 's' : ''}</span>
          <button type="button" data-action="open-create-match" data-sport="${esc(s.id)}" data-venue="${v.id}" class="btn-neon text-[11px] py-1.5 px-3">Réserver</button>
        </div>
      </div>`).join('');
  }

  // ------------------------------------------------------- public profile
  function availabilityMatrix(map = {}, interactive = false) {
    let html = '<div class="availability-grid"><div class="font-bold text-[11px] text-slate-400 uppercase py-2 text-center">Créneau</div>';
    for (const day of state.meta.days) html += `<div class="font-bold text-[11px] text-slate-300 uppercase py-2 text-center">${esc(day.slice(0, 3))}</div>`;
    for (const slot of state.meta.slots) {
      html += `<div class="text-[11px] font-semibold text-slate-400 flex items-center">${esc(slot.label.split('(')[0])}</div>`;
      for (const day of state.meta.days) {
        const on = (map[day] || []).includes(slot.id);
        const label = `${day} ${slot.label.split('(')[0].trim()} : ${on ? 'disponible' : 'indisponible'}`;
        html += interactive
          ? `<button type="button" class="availability-cell interactive ${on ? 'active' : ''}" data-action="toggle-slot" data-day="${esc(day)}" data-slot="${esc(slot.id)}" aria-pressed="${on}" aria-label="${esc(label)}">${on ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}</button>`
          : `<div class="availability-cell ${on ? 'active' : ''}" role="img" aria-label="${esc(label)}">${on ? '<i data-lucide="check" class="w-3.5 h-3.5"></i>' : ''}</div>`;
      }
    }
    return `${html}</div>`;
  }

  async function renderPublicProfile(id) {
    const isMe = id === 'me' || (state.me && String(state.me.id) === id);
    if (isMe && !state.me) { requireLogin('#mate/me'); return; }
    let m;
    try {
      m = await api('GET', `/mates/${encodeURIComponent(isMe ? 'me' : id)}`);
    } catch (err) {
      $('public-identity-card').innerHTML = `<p class="text-slate-300">${esc(err.message)}</p>`;
      $('public-sports-list').innerHTML = '';
      $('public-availability-matrix').innerHTML = '';
      return;
    }
    const action = isMe
      ? '<a href="#edit-profile" class="btn-outline-neon text-xs py-2.5 px-5"><i data-lucide="pencil" class="w-4 h-4"></i><span>Modifier mon profil</span></a>'
      : `<button type="button" data-action="open-propose" data-id="${m.id}" class="btn-neon text-xs py-2.5 px-5 shadow-lg"><i data-lucide="swords" class="w-4 h-4"></i><span>Proposer une partie</span></button>`;
    $('public-identity-card').innerHTML = `
      <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div class="relative flex-shrink-0">
          <img src="${avatarSrc(m.avatarUrl)}" alt="" class="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover ring-4 ring-mates-border shadow-2xl">
          <span class="absolute -bottom-2 -right-2 px-3 py-1 bg-mates-green text-black font-extrabold text-xs rounded-full shadow-lg">
            ${m.reliability != null ? `${m.reliability}% fiable` : 'Nouveau'}
          </span>
        </div>
        <div class="space-y-3 text-center sm:text-left flex-grow">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 class="text-3xl font-extrabold text-white">${esc(m.firstName)} ${esc(m.lastName)}</h1>
              <div class="text-sm text-slate-400 flex items-center justify-center sm:justify-start gap-2 mt-1 flex-wrap">
                ${m.age ? `<span>${m.age} ans</span><span>•</span>` : ''}
                <i data-lucide="map-pin" class="w-4 h-4 text-mates-green"></i><span>${esc(m.city)}${esc(distanceText(m))}</span>
              </div>
            </div>
            ${action}
          </div>
          ${m.bio ? `<p class="text-sm text-slate-300 leading-relaxed max-w-2xl bg-mates-cardElevated/40 p-4 rounded-2xl border border-mates-border">« ${esc(m.bio)} »</p>` : ''}
          <div class="flex flex-wrap items-center justify-center sm:justify-start gap-6 pt-2 text-xs text-slate-400">
            <div><strong class="text-white text-sm">${m.matchesPlayed}</strong> matchs joués</div>
            <div><strong class="text-mates-green text-sm">${m.fairPlayScore != null ? `★ ${String(m.fairPlayScore.toFixed(1)).replace('.', ',')}` : '—'}</strong> note fair-play</div>
            <div><strong class="text-white text-sm">${m.sports.length}</strong> sport${m.sports.length > 1 ? 's' : ''} pratiqué${m.sports.length > 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>`;
    $('public-sports-count').textContent = `${m.sports.length} sport${m.sports.length > 1 ? 's' : ''}`;
    $('public-sports-list').innerHTML = m.sports.length ? m.sports.map((s) => `
      <a href="#sport/${esc(s.id)}" class="p-3.5 bg-mates-cardElevated rounded-2xl border border-mates-border flex items-center justify-between hover:border-mates-green/50 transition-colors">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${esc(s.icon)}</span>
          <div><h4 class="font-bold text-white text-sm">${esc(s.name)}</h4><span class="text-[11px] text-mates-green" aria-label="${s.rating} sur 5">${stars(s.rating)}</span></div>
        </div>
        <span class="badge-level font-semibold text-xs">${esc(s.level)}</span>
      </a>`).join('') : '<p class="text-xs text-slate-400 italic">Aucun sport renseigné.</p>';
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
    $('edit-gps-status').textContent = me.lat != null ? 'Position GPS enregistrée (précision ~1 km).' : '';
    renderEditSports();
    renderEditAvailability();
  }

  function renderEditSports() {
    const list = state.editing.sports;
    $('edit-sports-list').innerHTML = list.length ? list.map((s, i) => `
      <div class="p-3.5 bg-mates-cardElevated rounded-2xl border border-mates-border flex items-center justify-between gap-3">
        <div class="flex items-center gap-3"><span class="text-2xl">${esc(sportIcon(s.id))}</span><span class="font-bold text-white text-sm">${esc((state.sportsById[s.id] || {}).name || s.id)}</span></div>
        <div class="flex items-center gap-3">
          <select data-level-index="${i}" aria-label="Niveau" class="bg-mates-card border border-mates-border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-mates-green">
            ${state.meta.levels.map((l) => `<option value="${esc(l)}" ${l === s.level ? 'selected' : ''}>${esc(l)}</option>`).join('')}
          </select>
          <button type="button" data-action="remove-sport" data-index="${i}" title="Retirer ce sport" aria-label="Retirer ce sport" class="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-colors"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
      </div>`).join('') : '<p class="text-xs text-slate-400 italic">Aucun sport ajouté pour l\'instant.</p>';
    const owned = new Set(list.map((s) => s.id));
    $('add-new-sport-select').innerHTML = '<option value="">Choisir un sport à ajouter...</option>' + state.sports
      .filter((s) => !owned.has(s.id)).map((s) => `<option value="${esc(s.id)}">${esc(s.icon)} ${esc(s.name)}</option>`).join('');
    icons();
  }

  function renderEditAvailability() {
    $('edit-availability-matrix').innerHTML = availabilityMatrix(state.editing.availability, true);
    icons();
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
      showToast('Profil enregistré !', 'success');
      location.hash = '#mate/me';
    } catch (err) { fail(err); } finally { if (btn) btn.disabled = false; }
  }

  function locateGps() {
    const status = $('edit-gps-status');
    if (!navigator.geolocation) { status.textContent = 'La géolocalisation n\'est pas disponible sur ce navigateur.'; return; }
    status.textContent = 'Recherche de ta position…';
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const r = await api('GET', `/cities/nearest?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        state.editing.lat = r.lat;
        state.editing.lng = r.lng;
        $('edit-city').value = r.city;
        status.textContent = `Position détectée près de ${r.city}. Pense à enregistrer.`;
      } catch (err) { status.textContent = err.message; }
    }, () => {
      status.textContent = 'Position refusée ou indisponible — saisis ta ville à la main.';
    }, { timeout: 8000, maximumAge: 600000 });
  }

  // ------------------------------------------------------------------ auth
  function updateAuthCard() {
    const register = state.authMode === 'register';
    $('auth-title').textContent = register ? 'Inscription sur Mates' : 'Connexion à Mates';
    $('auth-subtitle').textContent = register ? 'Crée ton compte et rejoins des matchs en quelques clics.' : 'Rejoins les sportifs passionnés près de chez toi.';
    $('auth-name-fields').classList.toggle('hidden', !register);
    $('auth-firstname').required = register;
    $('auth-password').autocomplete = register ? 'new-password' : 'current-password';
    $('auth-submit-btn').innerHTML = `<span>${register ? 'Créer mon compte' : 'Se connecter'}</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    $('auth-toggle-question').textContent = register ? 'Déjà un compte ?' : 'Pas encore de compte ?';
    $('auth-toggle-btn').textContent = register ? 'Se connecter' : "S'inscrire";
    $('auth-error').classList.add('hidden');
    icons();
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
      showToast(`Bienvenue sur Mates, ${user.firstName} !`, 'success');
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
    showToast('Tu es déconnecté.', 'info');
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
      if (m.isHost) cta = `<button type="button" data-action="cancel-match" data-id="${m.id}" class="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-semibold text-xs">Annuler mon match</button>`;
      else if (m.joined) cta = `<button type="button" data-action="leave-match" data-id="${m.id}" class="w-full btn-outline-neon py-2.5 text-xs"><i data-lucide="check" class="w-4 h-4 text-mates-green"></i><span>Inscrit • Se désister</span></button>`;
      else if (remaining <= 0) cta = '<button type="button" disabled class="w-full btn-outline-neon py-2.5 text-xs">Match complet</button>';
      else cta = `<button type="button" data-action="open-join" data-id="${m.id}" class="w-full btn-neon py-2.5 text-xs"><span>Rejoindre le match</span><i data-lucide="check" class="w-4 h-4"></i></button>`;
      return `
        <div class="bg-mates-card border ${m.joined ? 'border-mates-green/60' : 'border-mates-border'} rounded-3xl p-6 flex flex-col justify-between hover:border-mates-green/60 transition-all hover:shadow-xl">
          <div class="space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-3xl">${esc(m.sport.icon)}</span>
                <div class="min-w-0">
                  <h4 class="font-bold text-white text-base truncate">${esc(m.venue.name)}</h4>
                  <div class="text-xs text-slate-400 truncate">${esc(m.court.name)} • ${esc(m.venue.city)}</div>
                </div>
              </div>
              ${remainingBadge(remaining)}
            </div>
            <div class="p-3.5 bg-mates-cardElevated rounded-2xl border border-mates-border space-y-2 text-xs">
              <div class="flex justify-between gap-2 text-slate-300"><span>Date & heure :</span><strong class="text-white text-right">${esc(matchWhen(m))}</strong></div>
              <div class="flex justify-between gap-2 text-slate-300"><span>Niveau attendu :</span><strong class="text-mates-green">${esc(m.levelRequired)}</strong></div>
              <div class="flex justify-between gap-2 text-slate-300"><span>Prix :</span><strong class="text-white">${esc(euros(m.priceCents))} / pers.</strong></div>
              <div class="flex justify-between gap-2 text-slate-300"><span>Organisé par :</span><strong class="text-white">${esc(m.host.name)}</strong></div>
            </div>
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Joueurs (${m.bookedSlots}/${m.totalSlots}) :</div>
              <div class="flex items-center gap-2 flex-wrap">
                ${m.players.map((p) => `<a href="#mate/${p.id}" title="${esc(p.name)}"><img src="${avatarSrc(p.avatarUrl)}" alt="${esc(p.name)}" class="w-8 h-8 rounded-full object-cover border border-mates-green"></a>`).join('')}
                ${Array.from({ length: Math.max(0, remaining) }, () => '<span class="w-8 h-8 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center text-xs text-slate-500 font-bold">+</span>').join('')}
              </div>
            </div>
          </div>
          <div class="pt-5 border-t border-mates-border mt-4">${cta}</div>
        </div>`;
    }).join('');
  }

  function openJoinModal(id) {
    if (!requireLogin('#matches')) return;
    const m = state.matches.find((x) => x.id === Number(id));
    if (!m) return;
    state.pendingJoinId = m.id;
    $('modal-match-title').textContent = `${m.sport.icon} ${m.sport.name} • ${m.venue.name}`;
    $('modal-match-details').textContent = `${m.court.name} • Niveau : ${m.levelRequired}`;
    $('modal-match-time').textContent = matchWhen(m);
    $('modal-match-price').textContent = euros(m.priceCents);
    openModal('join-match-modal');
  }

  async function confirmJoin(btn) {
    btn.disabled = true;
    try {
      await api('POST', `/matches/${state.pendingJoinId}/join`);
      closeModals();
      showToast('Ta place est réservée ! À tes baskets.', 'success');
      if (location.hash === '#matches') await renderMatches(); else location.hash = '#matches';
    } catch (err) { fail(err); } finally { btn.disabled = false; icons(); }
  }

  async function matchAction(kind, id, btn) {
    const confirmText = kind === 'cancel' ? 'Annuler ce match ? Le terrain sera libéré.' : 'Te désister de ce match ?';
    if (!window.confirm(confirmText)) return;
    btn.disabled = true;
    try {
      if (kind === 'cancel') await api('DELETE', `/matches/${id}`); else await api('POST', `/matches/${id}/leave`);
      showToast(kind === 'cancel' ? 'Match annulé.' : 'Tu t\'es désisté.', 'info');
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
    $('cm-venue').innerHTML = state.createMatch.venues.map((v) => `<option value="${v.id}">${esc(v.name)} — ${esc(v.city)}</option>`).join('');
    if (venueId) $('cm-venue').value = String(venueId);
    loadCourts();
  }

  function loadCourts() {
    const venue = state.createMatch.venues.find((v) => String(v.id) === $('cm-venue').value);
    $('cm-court').innerHTML = (venue ? venue.courts : []).map((c) => `<option value="${c.id}">${esc(c.name)} (${c.pricePerHourCents === 0 ? 'gratuit' : `${esc(euros(c.pricePerHourCents))}/h`})</option>`).join('');
    loadTimes();
  }

  let timesSeq = 0;
  async function loadTimes() {
    const seq = ++timesSeq;
    const courtId = $('cm-court').value;
    const select = $('cm-time');
    if (!courtId || !$('cm-date').value) { select.innerHTML = ''; updatePrice(); return; }
    select.innerHTML = '<option value="">Chargement…</option>';
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
    if (!$('cm-time').value) { showToast('Choisis une heure de début libre.', 'warning'); return; }
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
      showToast('Terrain réservé, ton match est publié !', 'success');
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
    $('propose-sport').innerHTML = mate.sports.map((s) => `<option value="${esc(s.id)}">${esc(s.icon)} ${esc(s.name)} (${esc(s.level)})</option>`).join('');
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
    if (!mate || !date) { $('propose-availability-hint').textContent = ''; return; }
    const day = state.meta.days[weekdayIndex(date)];
    const slot = $('propose-slot').value;
    const ok = (mate.availability[day] || []).includes(slot);
    const hint = $('propose-availability-hint');
    hint.textContent = ok
      ? `✓ ${mate.firstName} est habituellement disponible ce ${day.toLowerCase()} (${slotLabel(slot).split('(')[0].trim().toLowerCase()}).`
      : `${mate.firstName} n'est habituellement pas disponible sur ce créneau — tu peux quand même proposer.`;
    hint.className = `text-xs ${ok ? 'text-mates-green' : 'text-slate-400'}`;
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
      showToast(`Invitation envoyée à ${state.proposeTo.firstName} !`, 'success');
    } catch (err) { fail(err); } finally { if (btn) btn.disabled = false; }
  }

  // ------------------------------------------------------------- inbox
  const STATUS = {
    pending: '<span class="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">En attente</span>',
    accepted: '<span class="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Acceptée</span>',
    declined: '<span class="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300">Refusée</span>',
  };

  async function renderInbox() {
    const { received, sent } = await api('GET', '/invitations');
    const card = (i, incoming) => {
      const who = incoming ? i.from : i.to;
      const actions = incoming && i.status === 'pending' ? `
        <div class="flex gap-2">
          <button type="button" data-action="respond-invite" data-id="${i.id}" data-response="declined" class="btn-outline-neon py-1.5 px-3 text-xs">Refuser</button>
          <button type="button" data-action="respond-invite" data-id="${i.id}" data-response="accepted" class="btn-neon py-1.5 px-3 text-xs">Accepter</button>
        </div>` : STATUS[i.status];
      return `
        <div class="bg-mates-card border border-mates-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <a href="#mate/${who.id}"><img src="${avatarSrc(who.avatarUrl)}" alt="" class="w-12 h-12 rounded-full object-cover ring-2 ring-mates-border"></a>
            <div class="min-w-0">
              <div class="text-sm text-white font-bold">${incoming ? `${esc(who.name)} te propose` : `Proposé à ${esc(who.name)}`} : ${esc(i.sport.icon)} ${esc(i.sport.name)}</div>
              <div class="text-xs text-slate-400">${esc(dayLabel(i.date))} • ${esc(slotLabel(i.slot))}</div>
              ${i.message ? `<p class="text-xs text-slate-300 mt-1 break-words">« ${esc(i.message)} »</p>` : ''}
            </div>
          </div>
          ${actions}
        </div>`;
    };
    const empty = (t) => `<p class="text-sm text-slate-400 bg-mates-card/50 border border-dashed border-mates-border rounded-2xl p-6 text-center">${t}</p>`;
    $('inbox-received').innerHTML = received.length ? received.map((i) => card(i, true)).join('') : empty('Aucune invitation reçue pour l\'instant.');
    $('inbox-sent').innerHTML = sent.length ? sent.map((i) => card(i, false)).join('') : empty('Tu n\'as encore proposé de partie à personne. <a href="#mates" class="text-mates-green hover:underline">Trouve un mate</a>.');
  }

  async function respondInvite(id, response, btn) {
    btn.disabled = true;
    try {
      await api('POST', `/invitations/${id}/respond`, { response });
      showToast(response === 'accepted' ? 'Invitation acceptée !' : 'Invitation refusée.', response === 'accepted' ? 'success' : 'info');
      await renderInbox();
      refreshInviteBadge();
      icons();
    } catch (err) { fail(err); btn.disabled = false; }
  }

  // ------------------------------------------------------------- modals
  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    const modal = $(id);
    modal.classList.remove('hidden');
    icons();
    const first = modal.querySelector('select, input, textarea, button[type="submit"], [data-action="confirm-join"]');
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
    $('mobile-menu-btn').addEventListener('click', () => $('mobile-drawer').classList.toggle('hidden'));

    document.addEventListener('click', (e) => {
      const overlay = e.target.classList && e.target.classList.contains('modal-overlay');
      if (overlay) { closeModals(); return; }
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
          if (!sportId) { showToast('Choisis un sport dans la liste.', 'warning'); break; }
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

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

    document.addEventListener('change', (e) => {
      const idx = e.target.dataset && e.target.dataset.levelIndex;
      if (idx !== undefined && state.editing) state.editing.sports[Number(idx)].level = e.target.value;
    });

    // Mates filters
    $('filter-sport').addEventListener('change', (e) => { state.filters.sport = e.target.value; renderMatesGrid().catch(fail); });
    $('filter-level').addEventListener('change', (e) => { state.filters.level = e.target.value; renderMatesGrid().catch(fail); });
    let cityTimer;
    $('filter-city').addEventListener('input', (e) => {
      clearTimeout(cityTimer);
      cityTimer = setTimeout(() => { state.filters.city = e.target.value.trim(); renderMatesGrid().catch(fail); }, 250);
    });
    $('search-sport-input').addEventListener('input', renderSportsCatalog);
    $('matches-sport-filter').addEventListener('change', () => renderMatches().then(icons).catch(fail));

    // Forms
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

    // Create-match cascade
    $('cm-sport').addEventListener('change', () => loadVenues().catch(fail));
    $('cm-venue').addEventListener('change', loadCourts);
    $('cm-court').addEventListener('change', loadTimes);
    $('cm-date').addEventListener('change', loadTimes);
    $('cm-duration').addEventListener('change', loadTimes);
    $('cm-slots').addEventListener('input', updatePrice);

    // Propose hint
    $('propose-date').addEventListener('change', updateProposeHint);
    $('propose-slot').addEventListener('change', updateProposeHint);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
