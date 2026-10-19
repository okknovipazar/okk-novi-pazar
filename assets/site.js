// OKK Novi Pazar — sadržaj iz data/*.json.
// Uređuje se preko Pages CMS (GitHub) i objavljuje preko povezanog Netlify projekta.
(() => {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const byId = id => document.getElementById(id);
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const put = (selector, value) => {
    const el = $(selector);
    if (el && value !== undefined && value !== null) el.textContent = String(value);
  };
  const safeUrl = v => {
    if (typeof v !== 'string') return '';
    const s = v.trim();
    if (s.startsWith('/assets/') || s.startsWith('/media/') || s.startsWith('assets/') || s.startsWith('media/')) return s;
    if (/^https:\/\//i.test(s)) return s;
    return '';
  };
  const fmtDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || 'Datum nije unet';
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}.`;
  };
  const upper = txt => String(txt || '').toLocaleUpperCase('sr');
  const clean = s => String(s || '').toLocaleLowerCase('sr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isClub = name => clean(name).includes('novi pazar');
  const isFinished = game => game.status === 'zavrsena';
  const calendarKey = game => `${game.date || ''}T${game.time || '00:00'}`;
  const modal = byId('info-modal');
  const modalImageWrap = byId('modal-image-wrap');
  const modalImage = byId('modal-image');
  let countdownTimer = null;

  function openModal(category, title, body, image = '', alt = '') {
    put('#modal-category', category);
    put('#modal-title', title);
    put('#modal-body', body || '');
    const src = safeUrl(image);
    if (src) {
      modalImage.src = src;
      modalImage.alt = alt || title;
      modalImageWrap.classList.add('show');
    } else {
      modalImage.removeAttribute('src');
      modalImage.alt = '';
      modalImageWrap.classList.remove('show');
    }
    if (!modal.open) modal.showModal();
  }
  byId('modal-close')?.addEventListener('click', () => modal.close());
  modal?.addEventListener('click', e => { if (e.target === modal) modal.close(); });

  const toggle = $('.menu-toggle');
  const mobile = byId('mobile-nav');
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    mobile.classList.toggle('open', !open);
  });
  $$('a', mobile).forEach(a => a.addEventListener('click', () => {
    mobile.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }));
  put('#year', new Date().getFullYear());

  function renderPlayers(players) {
    if (!Array.isArray(players)) return;
    const grid = byId('roster-grid');
    const search = byId('player-search');
    const empty = byId('no-players');
    function draw(query = '') {
      const selected = players.filter(player => clean(player.name).includes(clean(query.trim())) || String(player.number || '').includes(query.trim()));
      grid.replaceChildren();
      selected.forEach(player => {
        const b = make('button', 'player-card');
        b.type = 'button';
        b.setAttribute('aria-label', `${player.name}, broj ${player.number}`);
        const wrap = make('div', 'player-photo-wrap');
        const img = make('img', 'player-photo');
        img.src = safeUrl(player.image) || 'assets/logo.png';
        img.alt = player.name || 'Igrač OKK Novi Pazar';
        img.loading = 'lazy';
        const badge = make('span', 'player-badge', `#${player.number || '—'}`);
        const bottom = make('div', 'player-bottom');
        const num = make('div', 'player-number', player.number || '—');
        const label = make('div', 'player-name', player.name || 'Igrač');
        bottom.append(num, label);
        wrap.append(img, badge, bottom);
        b.append(wrap);
        b.addEventListener('click', () => openModal('PRVI TIM · SEZONA 2026/27.', upper(player.name),
          `Broj dresa: ${player.number || '—'}${player.position ? '\nPozicija: ' + player.position : ''}`, player.image_full || player.image, player.name));
        grid.append(b);
      });
      put('#roster-count', `${selected.length} OD ${players.length} IGRAČA`);
      empty.style.display = selected.length ? 'none' : 'block';
    }
    draw();
    search?.addEventListener('input', e => draw(e.target.value));
  }

  function renderSettings(settings) {
    if (!settings) return;
    put('.hero-p', settings.hero_subtitle);
    put('.history-copy', settings.about_text);
    put('.partner-inner p', settings.partner_text);
    put('.stats-grid .stat:nth-child(2) strong', settings.season_record);
    const coach = $('.coach-panel');
    if (coach) {
      const coachName = settings.coach_name || 'Mirsad Korać';
      put('.coach-panel strong', coachName);
      put('.coach-panel p', settings.coach_title);
      const img = $('.coach-photo', coach);
      if (img) {
        img.src = safeUrl(settings.coach_photo) || 'assets/logo.png';
        img.alt = coachName;
      }
      coach.addEventListener('click', () => openModal('STRUČNI ŠTAB', upper(coachName), settings.coach_title,
        settings.coach_photo_full || settings.coach_photo, coachName));
      coach.setAttribute('tabindex', '0');
      coach.setAttribute('role', 'button');
      coach.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); coach.click(); } });
    }
    $$('a[href*="instagram.com/"]').forEach(a => { if (safeUrl(settings.instagram)) a.href = settings.instagram; });
    $$('a[href*="facebook.com/"]').forEach(a => { if (safeUrl(settings.facebook)) a.href = settings.facebook; });
    $$('a[href^="mailto:"]').forEach(a => {
      if (settings.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) {
        const subject = a.href.includes('?subject=') ? a.href.slice(a.href.indexOf('?subject=')) : '';
        a.href = `mailto:${settings.email}${subject}`;
        if (a.textContent.includes('@')) a.textContent = settings.email;
      }
    });
    $$('a[href^="tel:"]').forEach(a => {
      const tel = String(settings.phone || '').replace(/[^\d+]/g, '');
      if (tel) { a.href = `tel:${tel}`; a.textContent = settings.phone; }
    });
  }

  function updateMatchPanel(el, game, dark) {
    if (!el || !game) { if (el) el.hidden = true; return; }
    el.hidden = false;
    const kicker = $('.result-kicker', el);
    if (kicker) {
      const spans = $$('span', kicker);
      if (spans[0]) spans[0].textContent = `${upper(game.round || 'UTAKMICA')} · ${fmtDate(game.date)}`;
      if (spans[1]) {
        if (isFinished(game)) {
          const clubWon = (isClub(game.home) && Number(game.home_score) > Number(game.away_score)) ||
                        (isClub(game.away) && Number(game.away_score) > Number(game.home_score));
          spans[1].textContent = clubWon ? 'POBEDA' : 'REZULTAT';
        } else spans[1].textContent = isClub(game.home) ? 'KOD KUĆE' : 'GOSTOVANJE';
      }
    }
    const teams = $('.panel-opponent', el);
    if (teams) teams.textContent = `${upper(game.home)} – ${upper(game.away)}`;
    putIn(el, '.panel-sub', isFinished(game) ? 'Prva muška regionalna liga Zapad' : `${game.venue || ''} · ${game.time || ''}`);
    const score = $('.score-line', el);
    if (score) score.textContent = isFinished(game) ? `${game.home_score ?? '–'} : ${game.away_score ?? '–'}` : (game.time || '—');
    putIn(el, '.score-note', game.note || '');
  }
  function putIn(scope, selector, text) { const e = $(selector, scope); if (e) e.textContent = text; }

  function renderMatchList(games) {
    const list = byId('match-list');
    if (!list) return;
    list.replaceChildren();
    games.slice().sort((a,b) => calendarKey(b).localeCompare(calendarKey(a))).forEach(game => {
      const row = make('article', 'match-row');
      const left = make('div');
      left.append(
        make('div', 'match-round', `${game.round || ''} · ${fmtDate(game.date)}`),
        make('div', 'match-teams', `${upper(game.home)} – ${upper(game.away)}`),
        make('div', 'match-location', `${game.venue || ''}${game.note ? ' · ' + game.note : ''}`)
      );
      const score = make('div','match-score',isFinished(game) ? `${game.home_score ?? '–'} : ${game.away_score ?? '–'}` : game.time || '—');
      row.append(left,score);
      list.append(row);
    });
  }

  function renderHeroGame(game) {
    if (!game) return;
    const card = $('.match-card');
    if (!card) return;
    put('.match-card-top span:first-child', upper(game.round || 'SLEDEĆA UTAKMICA'));
    put('.match-card-top span:last-child', isClub(game.home) ? 'DOMAĆIN ↗' : 'GOSTOVANJE ↗');
    const teamNames = $$('.match-card .team-name');
    if (teamNames[0]) teamNames[0].textContent = upper(game.home);
    if (teamNames[1]) teamNames[1].textContent = upper(game.away);
    const badges = $$('.match-card .team-logo');
    badges.forEach((el, index) => {
      const team = index === 0 ? game.home : game.away;
      el.setAttribute('aria-label', team);
      el.textContent = '';
      if (isClub(team)) {
        const img = make('img'); img.src = 'assets/logo.png'; img.alt = team;
        img.style.cssText = 'width:85%;height:85%;object-fit:contain;';
        el.append(img);
      } else el.textContent = String(team || '—').slice(0, 2).toLocaleUpperCase('sr');
    });
    put('.match-details .date', fmtDate(game.date));
    put('.match-details .place', game.venue || 'Dvorana će biti objavljena');
    put('.match-details > div:last-child .date', game.time || '—');
    if (countdownTimer) clearInterval(countdownTimer);
    const updateCountdown = () => {
      const el = byId('countdown');
      if (!el) return;
      const date = new Date(`${game.date}T${game.time || '18:00'}:00`).getTime();
      const ms = date - Date.now();
      if (!Number.isFinite(date)) { el.textContent = 'Termin uskoro'; return; }
      if (ms <= 0) { el.textContent = 'Termin je prošao'; return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      el.textContent = d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
    };
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 60000);
  }

  function renderMatches(games) {
    if (!Array.isArray(games)) return;
    const complete = games.filter(isFinished).sort((a,b) => calendarKey(b).localeCompare(calendarKey(a)));
    const upcoming = games.filter(g => !isFinished(g)).sort((a,b) => calendarKey(a).localeCompare(calendarKey(b)));
    updateMatchPanel($('.result-panel.dark'), complete[0], true);
    updateMatchPanel($('.result-panel.white'), upcoming[0], false);
    renderMatchList(games);
    renderHeroGame(upcoming[0]);
  }

  function renderNews(news) {
    if (!Array.isArray(news)) return;
    const grid = $('.news-grid');
    if (!grid) return;
    grid.replaceChildren();
    news.filter(n => n.published !== false).sort((a,b) => String(b.date).localeCompare(String(a.date))).forEach((entry, index) => {
      const art = make('article','news-card');
      const visual = make('div','news-visual');
      const cover = safeUrl(entry.image);
      if (cover) {
        const image = make('img'); image.src = cover; image.alt = entry.title || 'Fotografija vesti'; image.loading = 'lazy'; visual.append(image);
      } else {
        visual.style.background = [
          'radial-gradient(circle at 70% 20%,#568aff,#173578 52%,#0a1c42)',
          'radial-gradient(circle at 27% 55%,#5276dc,#102b74 56%,#091634)',
          'radial-gradient(circle at 70% 25%,#304bc1,#11234f 60%,#07142c)'
        ][index%3];
        visual.append(make('div','news-placeholder',entry.category || 'OKK NOVI PAZAR'));
      }
      const content = make('div','news-content');
      const meta = make('div','news-meta',`${fmtDate(entry.date)} · ${upper(entry.category)}`);
      const title = make('h3','news-title',entry.title);
      const summary = make('p','news-summary',entry.summary || '');
      const read = make('button','news-read','Pročitaj vest');
      read.type = 'button';
      read.addEventListener('click', () => openModal(`${fmtDate(entry.date)} · ${upper(entry.category)}`,
        upper(entry.title), entry.body || entry.summary || '', cover, entry.title));
      content.append(meta,title,summary,read);
      art.append(visual,content);
      grid.append(art);
    });
    if (!grid.children.length) grid.append(make('p','news-summary','Trenutno nema objavljenih vesti.'));
  }

  async function getJSON(name) {
    const response = await fetch(`data/${name}.json`, { cache:'no-store' });
    if (!response.ok) throw new Error(`Nije moguće učitati ${name} (${response.status})`);
    return response.json();
  }
  Promise.allSettled(['settings','players','matches','news'].map(getJSON)).then(results => {
    if (results[0].status === 'fulfilled') renderSettings(results[0].value);
    if (results[1].status === 'fulfilled') renderPlayers(results[1].value);
    if (results[2].status === 'fulfilled') renderMatches(results[2].value);
    if (results[3].status === 'fulfilled') renderNews(results[3].value);
    if (results.some(res => res.status === 'rejected')) {
      console.warn('Neki podaci nisu učitani. Proverite data/*.json i objavu na Netlify.');
      if (results[1].status === 'rejected') {
        const target = byId('no-players');
        if (target) { target.textContent = 'Podaci o igračima se trenutno ne mogu učitati.'; target.style.display='block'; }
      }
    }
  });
})();
