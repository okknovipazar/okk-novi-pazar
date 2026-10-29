/* OKK Novi Pazar — oznaka prenosa uživo, samo posle potvrde YouTube API-ja.
   Ne menja originalni DScore program ni tok za snimke. */
(() => {
  'use strict';

  function start() {
    const head = document.querySelector('.panelhead');
    const heading = document.getElementById('video-heading');
    const screen = document.getElementById('video-box');
    const videoTitle = document.getElementById('video-title');
    const videoInfo = document.getElementById('video-info');
    const videoDate = document.getElementById('video-date');
    const youtubeButton = document.getElementById('yt-video');
    if (!head || !heading || !screen || !youtubeButton) return;

    const style = document.createElement('style');
    style.textContent = `
      .okk-live-indicator { display:inline-flex;align-items:center;gap:9px;
        background:#c91c32;color:#fff;border-radius:5px;padding:10px 14px;
        font:800 12px/1.25 Arial,sans-serif;letter-spacing:.08em;
        margin-bottom:12px;box-shadow:0 6px 20px #c91c323b; }
      .okk-live-indicator[hidden] { display:none !important; }
      .okk-live-indicator .okk-live-dot { width:9px;height:9px;border-radius:50%;
        background:#fff;box-shadow:0 0 0 4px #ffffff35;
        animation:okk-live-pulse 1.5s infinite; }
      @keyframes okk-live-pulse { 50% { opacity:.35;transform:scale(.78); } }
    `;
    document.head.appendChild(style);
    const badge = document.createElement('div');
    badge.className = 'okk-live-indicator';
    badge.hidden = true;
    badge.setAttribute('role', 'status');
    const dot = document.createElement('span');
    dot.className = 'okk-live-dot';
    dot.setAttribute('aria-hidden', 'true');
    const badgeText = document.createElement('span');
    badgeText.textContent = 'PRENOS UŽIVO';
    badge.append(dot, badgeText);
    head.prepend(badge);

    let displayedLiveId = '';
    const channelLink = 'https://www.youtube.com/@digitalscoretv/streams';
    function checkedLive(v) {
      if (!v || v.is_live !== true || v.embeddable !== true) return false;
      const verified = Date.parse(v.live_verified_at || '');
      const age = Date.now() - verified;
      // I nestali i zastareli streamovi moraju automatski da izgube oznaku.
      return Number.isFinite(verified) && age >= -60000 && age < 45 * 60 * 1000;
    }

    function videoId(url) {
      try {
        const u = new URL(url);
        if (!['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(u.hostname)) return '';
        const id = u.pathname === '/watch' ? u.searchParams.get('v') : '';
        return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : '';
      } catch { return ''; }
    }

    function installLivePlayer(v, id) {
      if (displayedLiveId === id) return;
      displayedLiveId = id;
      if (videoTitle) videoTitle.textContent = v.title || 'OKK Novi Pazar — prenos uživo';
      if (videoInfo) videoInfo.textContent = 'YouTube je potvrdio aktivan prenos. Pokreni ga ovde ili na YouTube-u.';
      if (videoDate) videoDate.textContent = 'Aktivan video-prenos · DIGITAL Score TV';
      const play = document.createElement('button');
      play.className = 'play';
      play.type = 'button';
      play.textContent = '▶ GLEDAJ PRENOS UŽIVO';
      play.addEventListener('click', () => {
        const frame = document.createElement('iframe');
        frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
        frame.title = v.title || 'Prenos uživo OKK Novi Pazar';
        frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        frame.allowFullscreen = true;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        screen.replaceChildren(frame);
      });
      screen.replaceChildren(play);
    }

    async function refresh() {
      try {
        const response = await fetch(`data/last-video.json?live=${Date.now()}`, { cache:'no-store' });
        if (!response.ok) throw new Error('Nisu dostupni podaci o videu');
        const v = await response.json();
        const id = videoId(v.youtube_url);
        const live = Boolean(id && checkedLive(v));
        badge.hidden = !live;
        heading.textContent = live ? 'Gledaj prenos uživo' : 'Poslednji objavljeni snimak';
        youtubeButton.href = id ? `https://www.youtube.com/watch?v=${id}` : channelLink;
        youtubeButton.textContent = live ? '▶ GLEDAJ UŽIVO NA YOUTUBE-U ↗'
          : (id ? 'Otvori snimak na YouTube-u ↗' : 'Proveri DScore prenose ↗');
        if (live) installLivePlayer(v, id);
        else if (displayedLiveId) {
          displayedLiveId = '';
          if (videoInfo) videoInfo.textContent = 'Prenos nije više potvrđen kao aktivan. Proveri DScore kanal.';
        }
      } catch (error) {
        badge.hidden = true;
        heading.textContent = 'Poslednji objavljeni snimak';
        console.info('Provera prenosa nije dostupna:', error.message);
      }
    }
    // Ne osvežavamo iframe svakim upitom: to bi prekidalo gledanje.
    window.setTimeout(refresh, 650);
    window.setInterval(refresh, 90000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else start();
})();
