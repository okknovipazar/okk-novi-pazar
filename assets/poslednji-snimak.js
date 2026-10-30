/* OKK Novi Pazar — poslednji snimak sa RKS Centralna Srbija.
   Cita data/rks-snimci.json i dodaje karticu na pocetnu stranu.
   Za upotrebu: <script src="assets/poslednji-snimak.js?v=1" defer></script>
*/
(() => {
  'use strict';

  function build() {
    if (document.getElementById('okk-poslednji-snimak')) return;
    const matches = document.getElementById('utakmice');
    if (!matches) return;

    const styles = document.createElement('style');
    styles.textContent = `
      .okk-last-video { background:#f4f6fb; }
      .okk-last-video [hidden] { display:none !important; }
      .okk-last-video .okk-video-head { display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:30px; }
      .okk-last-video .okk-video-kicker { color:#295ce7;font:800 11px/1.4 'DM Sans',Arial,sans-serif;letter-spacing:.23em; }
      .okk-last-video .okk-video-heading { font:800 clamp(34px,4.6vw,61px)/.98 'Barlow Condensed',Impact,Arial,sans-serif;letter-spacing:-.02em;margin:10px 0 0;color:#142141; }
      .okk-last-video .okk-video-all { font:800 12px/1.4 'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#295ce7;white-space:nowrap; }
      .okk-last-video .okk-video-card { background:#fff;border:1px solid #e2e8f3;border-radius:9px;overflow:hidden;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);box-shadow:0 14px 45px #091b4310; }
      .okk-last-video .okk-video-cover { position:relative;display:block;background:linear-gradient(130deg,#0a1537,#295ce7);min-height:258px;aspect-ratio:16/9;overflow:hidden; }
      .okk-last-video .okk-video-image {display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s ease; }
      .okk-last-video .okk-video-cover:hover .okk-video-image {transform:scale(1.035);}
      .okk-last-video .okk-video-cover::after {content:'';position:absolute;inset:0;background:linear-gradient(0deg,#06112d55,transparent 60%);pointer-events:none;}
      .okk-last-video .okk-video-play {position:absolute;z-index:1;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:72px;height:72px;border-radius:50%;background:#295ce7;color:white;font:800 31px/1 Arial,sans-serif;box-shadow:0 8px 30px #04112e99;transition:background .2s;}
      .okk-last-video .okk-video-cover:hover .okk-video-play {background:#123da8;}
      .okk-last-video .okk-video-content {padding:clamp(22px,3vw,42px);display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:15px;min-width:0;}
      .okk-last-video .okk-video-source {font:800 11px/1.4 'DM Sans',Arial,sans-serif;letter-spacing:.12em;color:#6a758e;text-transform:uppercase;}
      .okk-last-video .okk-video-title {font:800 clamp(24px,3vw,37px)/1.05 'Barlow Condensed',Impact,Arial,sans-serif;text-transform:uppercase;color:#0d1a3a;overflow-wrap:anywhere;margin:0;}
      .okk-last-video .okk-video-score {display:inline-flex;align-items:center;gap:8px;padding:9px 13px;border-radius:4px;background:#edf2ff;color:#244ed3;font:800 22px/1 'Barlow Condensed',Arial,sans-serif;letter-spacing:.03em;}
      .okk-last-video .okk-video-date {font:600 13px/1.5 'DM Sans',Arial,sans-serif;color:#6a758e;}
      .okk-last-video .okk-video-actions {display:flex;flex-wrap:wrap;gap:10px;margin-top:5px;}
      .okk-last-video .okk-video-btn {display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:12px 18px;border-radius:5px;background:#295ce7;color:white;font:800 12px/1.3 'DM Sans',Arial,sans-serif;text-decoration:none;letter-spacing:.06em;text-transform:uppercase;}
      .okk-last-video .okk-video-btn:hover {background:#173eb4;color:white;}
      .okk-last-video .okk-video-btn.secondary {background:#f0f3f9;color:#193765;}
      .okk-last-video .okk-video-btn.secondary:hover {background:#e3e9f5;}
      .okk-last-video .okk-video-note {color:#6a758e;font:500 12px/1.5 'DM Sans',Arial,sans-serif;}
      @media (max-width:760px) {
        .okk-last-video .okk-video-card {grid-template-columns:1fr;}
        .okk-last-video .okk-video-cover {min-height:0;}
        .okk-last-video .okk-video-head {align-items:start;flex-direction:column;gap:13px;}
        .okk-last-video .okk-video-content {padding:23px;gap:12px;}
        .okk-last-video .okk-video-title {font-size:29px;}
      }
      @media (prefers-reduced-motion:reduce) {
        .okk-last-video .okk-video-image {transition:none;}
      }
    `;
    document.head.appendChild(styles);

    const section = document.createElement('section');
    section.className = 'section okk-last-video';
    section.id = 'okk-poslednji-snimak';
    section.setAttribute('aria-labelledby', 'okk-video-heading');
    section.innerHTML = `
      <div class="container">
        <div class="okk-video-head">
          <div><div class="okk-video-kicker">VIDEO ARHIVA · OKK NOVI PAZAR</div>
            <h2 class="okk-video-heading" id="okk-video-heading">POSLEDNJI SNIMAK UTAKMICE</h2></div>
          <a class="okk-video-all" href="snimci.html">SVI SNIMCI ↗</a>
        </div>
        <article class="okk-video-card" aria-live="polite">
          <a class="okk-video-cover" id="okk-video-cover" href="snimci.html" aria-label="Otvori video arhivu">
            <img class="okk-video-image" id="okk-video-image" alt="Snimak košarkaške utakmice" loading="lazy" hidden>
            <span class="okk-video-play" aria-hidden="true">▶</span>
          </a>
          <div class="okk-video-content">
            <div class="okk-video-source" id="okk-video-source">RKS CENTRALNA SRBIJA</div>
            <h3 class="okk-video-title" id="okk-video-title">UČITAVAMO POSLEDNJI SNIMAK…</h3>
            <div class="okk-video-score" id="okk-video-score" hidden></div>
            <div class="okk-video-date" id="okk-video-date"></div>
            <div class="okk-video-actions">
              <a class="okk-video-btn" id="okk-video-watch" href="snimci.html">POGLEDAJ SNIMAK ↗</a>
              <a class="okk-video-btn secondary" href="snimci.html">VIDEO ARHIVA</a>
            </div>
            <div class="okk-video-note">Najnoviji snimak se prikazuje automatski nakon objave na RKS kanalu.</div>
          </div>
        </article>
      </div>
    `;
    matches.insertAdjacentElement('afterend', section);

    function setFallback() {
      document.getElementById('okk-video-title').textContent = 'Snimci utakmica OKK Novi Pazar';
      document.getElementById('okk-video-date').textContent = 'Poseti našu arhivu za dostupne snimke.';
    }
    async function refresh() {
      try {
        const response = await fetch('data/rks-snimci.json', {cache: 'no-store'});
        if (!response.ok) throw new Error('Nema odgovora iz arhive');
        const data = await response.json();
        if (!data || !Array.isArray(data.videos)) throw new Error('Pogresan oblik arhive');
        const valid = data.videos.filter(v => v && /^[A-Za-z0-9_-]{11}$/.test(v.id || ''));
        if (!valid.length) { setFallback(); return; }
        valid.sort((a,b) => (Date.parse(b.published_at || '') || 0) - (Date.parse(a.published_at || '') || 0));
        const video = valid[0];
        const url = 'https://www.youtube.com/watch?v=' + video.id;
        const title = String(video.title || 'OKK Novi Pazar — snimak utakmice');
        const cover = document.getElementById('okk-video-cover');
        const img = document.getElementById('okk-video-image');
        const watch = document.getElementById('okk-video-watch');
        cover.href = url;
        cover.target = '_blank';
        cover.rel = 'noopener noreferrer';
        cover.setAttribute('aria-label', 'Pogledaj snimak: ' + title);
        watch.href = url;
        watch.target = '_blank';
        watch.rel = 'noopener noreferrer';
        img.src = 'https://i.ytimg.com/vi/' + video.id + '/hqdefault.jpg';
        img.alt = 'Naslovna slika snimka: ' + title;
        img.hidden = false;
        img.onerror = () => { img.hidden = true; };
        document.getElementById('okk-video-title').textContent = title;
        const score = title.match(/\b\d{1,3}\s*:\s*\d{1,3}\b/);
        const scoreBox = document.getElementById('okk-video-score');
        if (score) { scoreBox.textContent = 'REZULTAT  ' + score[0]; scoreBox.hidden = false; }
        else { scoreBox.hidden = true; scoreBox.textContent = ''; }
        let dateText = '';
        if (/^\d{4}-\d{2}-\d{2}$/.test(video.date || '')) {
          const [year,month,day] = video.date.split('-');
          dateText = `Objavljeno: ${day}.${month}.${year}.`;
        }
        document.getElementById('okk-video-date').textContent = dateText;
        document.getElementById('okk-video-source').textContent = 'RKS CENTRALNA SRBIJA · VIDEO SNIMAK';
      } catch (e) {
        setFallback();
        console.info('Poslednji snimak nije ucitan:', e.message);
      }
    }
    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, {once:true});
  else build();
})();
