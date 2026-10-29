/* OKK Novi Pazar — automatska naslovna sa RKSCS.
   Ne menja datoteke kojima upravlja Pages CMS.
   Učitati posle assets/site.js kao defer skriptu. */
(() => {
  'use strict';

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const club = name => /novi\s+pazar/i.test(String(name || ''));
  const upper = text => String(text || '').toLocaleUpperCase('sr-RS');
  const prettyDate = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '')
    ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}.` : 'Datum nije potvrđen';
  const validTime = time => /^([01]\d|2[0-3]):[0-5]\d$/.test(time || '') && time !== '00:00';
  const matchSort = (a, b) => `${a.datum}T${a.vreme}`.localeCompare(`${b.datum}T${b.vreme}`);
  const put = (root, selector, value) => { const el = $(selector, root); if (el) el.textContent = String(value); };

  // Tačan početak u vremenskoj zoni Srbije, uključujući letnje/zimsko vreme.
  function serbianTimestamp(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !validTime(time)) return NaN;
    const [y, m, d] = date.split('-').map(Number);
    const [h, min] = time.split(':').map(Number);
    const wall = Date.UTC(y, m - 1, d, h, min);
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Belgrade', hourCycle: 'h23', year: 'numeric',
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
    for (const offsetHours of [1, 2]) {
      const candidate = wall - offsetHours * 3600000;
      const parts = Object.fromEntries(formatter.formatToParts(new Date(candidate))
        .filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
      if (+parts.year === y && +parts.month === m && +parts.day === d &&
          +parts.hour === h && +parts.minute === min) return candidate;
    }
    return NaN;
  }

  const serbianToday = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()).replaceAll('/', '-');

  async function readJSON(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  function correspondingManual(match, manual) {
    return manual.find(m => m.date === match.datum && club(m.home) === club(match.domacin)
      && club(m.away) === club(match.gost));
  }

  function renderPanel(panel, match, upcoming, manual) {
    if (!panel) return;
    if (!match) { panel.hidden = true; return; }
    panel.hidden = false;
    const spans = $$('.result-kicker span', panel);
    if (spans[0]) spans[0].textContent = `${match.kolo}. KOLO · ${prettyDate(match.datum)}`;
    if (spans[1]) {
      const win = club(match.domacin)
        ? match.poeni_domacin > match.poeni_gost
        : match.poeni_gost > match.poeni_domacin;
      spans[1].textContent = upcoming ? (club(match.domacin) ? 'KOD KUĆE' : 'GOSTOVANJE')
        : (win ? 'POBEDA' : 'PORAZ');
    }
    put(panel, '.panel-opponent', `${upper(match.domacin)} – ${upper(match.gost)}`);
    const time = validTime(match.vreme) ? match.vreme : 'Termin uskoro';
    put(panel, '.panel-sub', upcoming
      ? `${manual?.venue || 'Dvorana nije potvrđena'} · ${prettyDate(match.datum)} · ${time}`
      : 'Prva muška regionalna liga Zapad');
    put(panel, '.score-line', upcoming ? time
      : `${match.poeni_domacin} : ${match.poeni_gost}`);
    put(panel, '.score-note', upcoming
      ? (manual?.note || 'Raspored prema RKSCS')
      : 'Konačan rezultat · RKSCS');
  }

  function showBadge(element, name, logo) {
    if (!element) return;
    element.replaceChildren();
    element.setAttribute('aria-label', name);
    let path = logo;
    if (!path && club(name)) path = 'assets/logo.png';
    if (path) {
      const img = document.createElement('img');
      img.src = path.startsWith('/media/') || path.startsWith('/assets/') ? '.' + path : path;
      img.alt = `Grb ${name}`;
      img.style.cssText = 'width:85%;height:85%;object-fit:contain';
      img.addEventListener('error', () => { element.textContent = upper(name).slice(0, 2); });
      element.appendChild(img);
    } else {
      element.textContent = upper(name).slice(0, 2);
    }
  }

  let clockInterval;
  function renderHero(match, manual) {
    const card = $('.match-card');
    if (!card) return;
    if (!match) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    card.setAttribute('aria-label', `Naredna utakmica: ${match.domacin} – ${match.gost}, ${prettyDate(match.datum)} ${validTime(match.vreme) ? match.vreme : ''}`);
    put(card, '.match-card-top span:first-child', `${match.kolo}. KOLO`);
    put(card, '.match-card-top span:last-child', club(match.domacin) ? 'DOMAĆIN' : 'GOSTOVANJE');
    const names = $$('.team-name', card);
    if (names[0]) names[0].textContent = upper(match.domacin);
    if (names[1]) names[1].textContent = upper(match.gost);
    const badges = $$('.team-logo', card);
    showBadge(badges[0], match.domacin, manual?.home_logo);
    showBadge(badges[1], match.gost, manual?.away_logo);
    put(card, '.match-details .date', prettyDate(match.datum));
    put(card, '.match-details .place', manual?.venue || 'Dvorana nije potvrđena');
    put(card, '.match-details > div:last-child .date', validTime(match.vreme) ? match.vreme : 'Termin uskoro');

    // Originalni tajmer iz site.js ažurira element #countdown na svakih 60 s.
    // Dajemo novom tajmeru zaseban ID da se međusobno ne prepisuju.
    const oldClock = $('#countdown', card);
    if (oldClock) {
      const newClock = document.createElement('strong');
      newClock.id = 'rkscs-countdown';
      oldClock.replaceWith(newClock);
    }
    const clock = $('#rkscs-countdown', card);
    if (!clock) return;
    if (clockInterval) clearInterval(clockInterval);
    const target = serbianTimestamp(match.datum, match.vreme);
    const clockLabel = $('.countdown span', card);
    function tick() {
      if (!Number.isFinite(target)) {
        if (clockLabel) clockLabel.textContent = 'Početak utakmice';
        clock.textContent = 'Termin uskoro';
        return;
      }
      const remaining = target - Date.now();
      if (remaining <= 0) {
        if (clockLabel) clockLabel.textContent = 'Čekamo potvrđen rezultat';
        clock.textContent = 'Utakmica je počela';
        return;
      }
      if (clockLabel) clockLabel.textContent = 'Do početka utakmice';
      const days = Math.floor(remaining / 86400000);
      const hours = Math.floor((remaining % 86400000) / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      clock.textContent = days > 0
        ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m ${secs}s`;
    }
    tick();
    clockInterval = setInterval(tick, 1000);
  }

  function renderMiniSchedule(matches, manual) {
    const list = $('#match-list');
    if (!list) return;
    list.replaceChildren();
    const complete = matches.filter(g => g.status === 'zavrsena').sort(matchSort).slice(-3);
    const next = matches.filter(g => g.status !== 'zavrsena' && g.datum >= serbianToday())
      .sort(matchSort).slice(0, 3);
    [...complete, ...next].forEach(g => {
      const meta = correspondingManual(g, manual);
      const row = document.createElement('article');
      row.className = 'match-row';
      const left = document.createElement('div');
      const round = document.createElement('div'); round.className = 'match-round';
      round.textContent = `${g.kolo}. KOLO · ${prettyDate(g.datum)}`;
      const teams = document.createElement('div'); teams.className = 'match-teams';
      teams.textContent = `${upper(g.domacin)} – ${upper(g.gost)}`;
      const location = document.createElement('div'); location.className = 'match-location';
      location.textContent = meta?.venue || (g.status === 'zavrsena' ? 'Konačan rezultat' : 'Dvorana nije potvrđena');
      const score = document.createElement('div'); score.className = 'match-score';
      score.textContent = g.status === 'zavrsena'
        ? `${g.poeni_domacin} : ${g.poeni_gost}`
        : (validTime(g.vreme) ? g.vreme : 'Termin uskoro');
      left.append(round, teams, location);
      row.append(left, score);
      list.appendChild(row);
    });
    const link = document.createElement('a');
    link.href = 'rezultati.html?v=20261029';
    link.textContent = 'SVA KOLA I REZULTATI ↗';
    link.className = 'arrow-link';
    link.style.cssText = 'display:inline-block;margin-top:18px';
    list.after(link);
  }

  function renderPosition(standings) {
    const entry = standings?.tabela?.find(row => club(row.tim));
    if (!entry) return;
    const score = $('.stats-grid .stat:nth-child(2) strong');
    if (score) score.textContent = `${entry.pobede}–${entry.porazi}`;
    const pos = $('.stats-grid .stat:nth-child(3) strong');
    const label = $('.stats-grid .stat:nth-child(3) span');
    if (pos) pos.textContent = `${entry.pozicija}.`;
    if (label) label.textContent = 'Mesto na tabeli';
  }

  // Originalni site.js se asinhrono učitava iz data/matches.json. Čekamo da završi
  // inicijalni prikaz, pa prikazujemo ažurnije podatke RKSCS bez trke između skripti.
  function waitForLegacyMatches() {
    const list = $('#match-list');
    if (!list || list.children.length) return Promise.resolve();
    return new Promise(resolve => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        clearTimeout(timeout);
        resolve();
      };
      const observer = new MutationObserver(() => { if (list.children.length) done(); });
      observer.observe(list, { childList: true });
      const timeout = setTimeout(done, 5000);
    });
  }

  async function initialize() {
    try {
      const [results, standings, manual] = await Promise.all([
        readJSON('data/rkscs_rezultati.json'),
        readJSON('data/rkscs.json'),
        readJSON('data/matches.json').catch(() => [])
      ]);
      if (!Array.isArray(results.utakmice) || !Array.isArray(standings.tabela)) {
        throw new Error('Neispravan format RKSCS podataka');
      }
      const matches = results.utakmice.filter(g => club(g.domacin) || club(g.gost));
      if (!matches.length) throw new Error('Nema utakmica kluba');
      await waitForLegacyMatches();
      const finished = matches.filter(g => g.status === 'zavrsena' &&
        Number.isFinite(g.poeni_domacin) && Number.isFinite(g.poeni_gost)).sort(matchSort);
      const future = matches.filter(g => g.status !== 'zavrsena' && g.datum >= serbianToday()).sort(matchSort);
      const latest = finished.at(-1);
      const upcoming = future[0];
      renderPanel($('.result-panel.dark'), latest, false, correspondingManual(latest || {}, manual));
      renderPanel($('.result-panel.white'), upcoming, true, correspondingManual(upcoming || {}, manual));
      renderHero(upcoming, correspondingManual(upcoming || {}, manual));
      renderMiniSchedule(matches, manual);
      renderPosition(standings);
      console.info('OKK Novi Pazar: automatski podaci RKSCS učitani.');
    } catch (error) {
      console.warn('RKSCS nije dostupan; zadržani su postojeći podaci na naslovnoj.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
