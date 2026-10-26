/* Sujith Benhur — site behaviour. No framework. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const MEDIA = 'assets/media/demos/';
  const MV = '?v=3';   // bump when any recording is re-made, so browsers don't keep the old clip
  const SVG = 'http://www.w3.org/2000/svg';
  const wide = matchMedia('(min-width: 901px)');

  /* ---------- Theme ---------- */
  const themeBtn = $('[data-theme-toggle]');
  const theme = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  // cards are paper, so the phone's status bar follows the theme there
  const syncCards = () => $$('.card:not([hidden])').forEach((c) => c.parentElement.classList.toggle('band-dark', theme() === 'dark'));
  const syncTheme = () => {
    if (themeBtn) themeBtn.textContent = theme() === 'dark' ? 'Switch to light' : 'Switch to dark';
    syncCards();
    $$('iframe.win-iframe').forEach((f) => { try { if (f.contentDocument) f.contentDocument.documentElement.dataset.theme = theme(); } catch (e) {} });
  };
  themeBtn?.addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked: theme lasts this visit */ }
    syncTheme();
  });

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (!reduce && !root.classList.contains('embed') && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* ---------- Menu ---------- */
  const menuBtn = $('.menu-btn');
  const setMenu = (open) => {
    root.classList.toggle('menu-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
    if (menuBtn) menuBtn.textContent = open ? 'Close' : 'Menu';
    if (lenis) open ? lenis.stop() : lenis.start();
  };
  menuBtn?.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const el = id === '#top' ? document.body : $(id);
    if (!el) return;
    e.preventDefault();
    setMenu(false);
    if (lenis) lenis.scrollTo(el, { offset: id === '#top' ? 0 : -10, duration: 1.4 });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    history.replaceState(null, '', id);
  }));

  /* ---------- Headings: words rise into place ---------- */
  function splitWords(el) {
    let i = 0;
    const walk = (parent) => [...parent.childNodes].forEach((node) => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.style.setProperty('--i', i++);
          w.textContent = part;
          frag.append(w);
        });
        node.replaceWith(frag);
      } else if (node.nodeType === 1 && node.namespaceURI !== SVG) walk(node);
    });
    walk(el);
  }
  $$('[data-write], .note-title').forEach(splitWords);

  const ready = () => root.classList.add('is-ready');
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(ready));
  setTimeout(ready, 1400);

  // Highlighter strokes outside the stories swipe on once they're in view.
  const marker = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('on');
    marker.unobserve(e.target);
  }), { rootMargin: '0px 0px -18% 0px' });
  $$('.marker').forEach((m) => { if (!m.closest('.note, .card')) marker.observe(m); });

  /* ---------- The visitor's name: a blank on the cover, used on the laptop and the phone. Kept in this browser only. ---------- */
  const visitor = $('[data-visitor]');
  if (visitor) {
    const sizer = $('[data-visitor-sizer]');
    const useName = () => {
      const first = visitor.value.trim().split(/\s+/)[0] || '';
      sizer.textContent = visitor.value || visitor.placeholder;
      $$('[data-visitor-cta]').forEach((el) => { el.textContent = first ? `Open my laptop, ${first}` : 'Open my laptop'; });
      const hi = $('[data-visitor-hi]');
      if (hi) { hi.hidden = !first; hi.textContent = first ? `Hi ${first}!` : ''; }
      const talk = $('[data-visitor-talk]');
      if (talk) talk.textContent = first ? `Let's talk, ${first}.` : "Let's talk.";
      root.classList.toggle('has-visitor', !!first);
    };
    try { visitor.value = localStorage.getItem('visitor') || ''; } catch (e) {}
    visitor.addEventListener('input', () => { useName(); try { localStorage.setItem('visitor', visitor.value.trim()); } catch (e) {} });
    visitor.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      visitor.blur();
      $('.me-open')?.click();
    });
    useName();
  }

  /* ---------- Masthead, current section, pinned headings ---------- */
  const mast = $('.masthead');
  let lastY = scrollY, mastH = 0, pinH = 0, mastShown = true;
  const navLinks = $$('.nav a[href^="#"]');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);

  // While a chapter scrolls, a compact copy of its heading holds the top edge (sticky, so the next chapter
  // pushes it out), with the part you're reading on the right and a line for how far through you are.
  const pins = $$('[data-pin]').map((ch) => {
    const pin = document.createElement('div');
    pin.className = 'pin';
    pin.setAttribute('aria-hidden', 'true');
    pin.innerHTML = '<div class="pin-bar wrap"><span class="pin-name"></span><span class="pin-title"></span><span class="pin-sub"></span><span class="pin-line"><i></i></span></div>';
    $('.pin-name', pin).textContent = ch.dataset.pin;
    $('.pin-title', pin).textContent = $('.ch-title, h1', ch)?.textContent.trim().replace(/\s+/g, ' ') || '';
    ch.prepend(pin);
    return { ch, pin, head: $('.ch-head, .article-head', ch), subs: $$('[data-sub], .prose h2', ch),
      sub: $('.pin-sub', pin), line: $('.pin-line i', pin), text: null, timer: 0 };
  });
  const setMastH = () => root.style.setProperty('--mast-h', `${mastShown ? mastH : 0}px`);
  const measure = () => { mastH = mast?.offsetHeight || 0; pinH = pins[0]?.pin.offsetHeight || 0; setMastH(); };

  function syncPins() {
    if (!pins.length) return;
    const edge = (mastShown ? mastH : 0) + pinH;
    // wide screens name the part in view; phones name it once its title docks under the bar
    const reading = wide.matches ? innerHeight * 0.45 : edge + 12;
    // Read every position first, then write, so the page lays out once per frame.
    const states = pins.map(({ ch, head, subs }) => {
      const box = ch.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) return null;
      const end = head.getBoundingClientRect().bottom;
      let text = '', top = -Infinity;
      subs.forEach((s) => {
        const t = ($('.row-name', s) || s).getBoundingClientRect().top;
        if (t > reading) return;
        if (Math.abs(t - top) < 2) text = '';          // side by side, like two columns: name neither
        else { top = t; text = s.dataset.sub || s.textContent.trim(); }
      });
      return { on: end < edge, text, p: clamp((edge - end) / Math.max(1, box.bottom - end)) };
    });
    states.forEach((s, i) => {
      if (!s) return;
      const p = pins[i];
      p.pin.classList.toggle('is-on', s.on);
      p.line.style.setProperty('--p', s.p.toFixed(4));
      if (s.text === p.text) return;
      p.text = s.text;
      clearTimeout(p.timer);
      p.sub.style.opacity = 0;
      p.timer = setTimeout(() => {
        p.sub.textContent = p.text;
        p.sub.style.opacity = 1;
        p.pin.classList.toggle('has-sub', !!p.text);
      }, p.sub.textContent ? 180 : 0);
    });
  }

  function onScroll() {
    const y = scrollY;
    mast?.classList.toggle('is-scrolled', y > 40);
    if (!root.classList.contains('menu-open')) mast?.classList.toggle('is-hidden', y > lastY && y > 480);
    lastY = y;
    const shown = !mast?.classList.contains('is-hidden');
    if (shown !== mastShown) { mastShown = shown; setMastH(); }
    let current = null;
    sections.forEach((s) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) current = s.id; });
    navLinks.forEach((a) => {
      if (a.getAttribute('href') === `#${current}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    syncPins();
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); syncPins(); });
  measure();

  /* ---------- Helpers ---------- */
  function onVisible(el, enter, leave, threshold = 0.35) {
    if (!el) return;
    new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) enter(); else if (leave) leave();
    }), { threshold }).observe(el);
  }
  // Scale a fixed-size virtual screen (390 x 844 or 1280 x 800) to its frame.
  function fit(container, baseWidth, baseHeight = 0) {
    const set = () => {
      const sw = container.clientWidth / baseWidth;
      const sh = baseHeight && container.clientHeight ? container.clientHeight / baseHeight : sw;
      container.style.setProperty('--s', Math.min(sw, sh));
    };
    new ResizeObserver(set).observe(container);
    set();
  }
  // Plays a recreated demo or a card like a video: start, pause, resume, and how far through it is.
  function clock(demo) {
    let timers = [], elapsed = 0, since = 0, running = false, done = null;
    const c = {
      duration: demo.duration,
      get elapsed() { return running ? elapsed + performance.now() - since : elapsed; },
      start(onEnd) { c.pause(); demo.reset(); elapsed = 0; done = onEnd; c.resume(); },
      resume() {
        if (running || elapsed >= demo.duration) return;
        running = true;
        since = performance.now();
        timers = demo.steps.filter(([at]) => at >= elapsed).map(([at, fn]) => setTimeout(fn, at - elapsed));
        timers.push(setTimeout(() => { running = false; elapsed = demo.duration; if (done) done(); }, demo.duration - elapsed));
      },
      pause() {
        if (!running) return;
        elapsed += performance.now() - since;
        running = false;
        timers.forEach(clearTimeout);
        timers = [];
      },
      still() { c.pause(); demo.still(); },
    };
    return c;
  }

  /* ---------- Phone frames: one status bar and Dynamic Island for every screen ---------- */
  const STATUS = `<div class="phone-status" aria-hidden="true"><span>9:41</span><span class="phone-icons">
    <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
    <svg viewBox="0 0 16 12"><path d="M8 2.6c2.2 0 4.2.9 5.7 2.3l1.3-1.3A9.9 9.9 0 0 0 8 .8 9.9 9.9 0 0 0 1 3.6l1.3 1.3A8.1 8.1 0 0 1 8 2.6Zm0 3.6c1.2 0 2.3.5 3.1 1.3l1.3-1.3A6.2 6.2 0 0 0 8 4.4c-1.7 0-3.3.7-4.4 1.8l1.3 1.3c.8-.8 1.9-1.3 3.1-1.3Zm0 3.6c-.5 0-1 .2-1.3.6L8 11.7l1.3-1.3a1.9 1.9 0 0 0-1.3-.6Z"/></svg>
    <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="8" rx="2"/><path d="M25 4v4a2 2 0 0 0 0-4Z" opacity=".45"/></svg>
  </span></div><div class="phone-island" aria-hidden="true"></div><div class="phone-home" aria-hidden="true"></div>`;
  $$('.device.phone .device-screen').forEach((s) => s.insertAdjacentHTML('beforeend', STATUS));
  $$('.phone-icons svg').forEach((s) => s.setAttribute('fill', 'currentColor'));

  // Keep the status bar readable: sample the top band of each playing phone video a few times a second
  // and switch the status text between dark and light, the way iOS does over dark sheets.
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const pctx = probe.getContext('2d', { willReadFrequently: true });
  setInterval(() => {
    $$('.device.phone .dv-video').forEach((v) => {
      if (v.hidden || v.paused || v.readyState < 2 || !v.videoWidth || v.closest('.ig')) return;
      try {
        pctx.drawImage(v, v.videoWidth * 0.5, v.videoHeight * 0.025, 4, 4, 0, 0, 1, 1);
        const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
        const dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
        v.closest('.device-screen')?.classList.toggle('band-dark', dark);
      } catch (e) { /* frame not ready */ }
    });
  }, 300);

  /* ---------- Recreated demos (time-based, like a video) ---------- */
  const TEMPLATES = {
    ads: `<div class="ads" data-ads>
      <aside class="ads-side">
        <p class="ads-brand">Ads Agent</p>
        <p class="ads-acct">Acme Retail<small>Meta and Google</small></p>
        <p class="ads-nav is-on">Chat</p><p class="ads-nav">Campaigns</p><p class="ads-nav">Rules</p><p class="ads-nav">Reports</p>
      </aside>
      <div class="ads-main">
        <p class="ads-top"><b>Ads Agent</b><span>Acme Retail · Meta and Google</span></p>
        <div class="ads-log">
          <div class="turn me" data-step="1"><p class="said">Which Meta campaigns are overspending this week?</p></div>
          <div class="turn tool" data-step="2"><code>get_campaign_performance</code> Meta, last 7 days</div>
          <div class="turn tool" data-step="3"><code>forecast_spend</code> 12 active campaigns</div>
          <div class="turn bot" data-step="4">
            <p>Three are pacing over budget. Retargeting is getting purchases at a lower cost, so the money works harder there.</p>
            <table class="spend">
              <thead><tr><th>Campaign</th><th>Spend against plan</th><th>Return on spend</th></tr></thead>
              <tbody>
                <tr><td>Broad prospecting</td><td><span class="pace"><span class="pace-track" style="--p:132"><i></i></span>132%</span></td><td>1.4</td></tr>
                <tr><td>Lookalike 3%</td><td><span class="pace"><span class="pace-track" style="--p:118"><i></i></span>118%</span></td><td>2.1</td></tr>
                <tr><td>Festive video</td><td><span class="pace"><span class="pace-track" style="--p:111"><i></i></span>111%</span></td><td>0.9</td></tr>
              </tbody>
            </table>
            <p class="ads-ask">Move ₹1.2 lakh from Broad prospecting to 30-day retargeting?</p>
            <div class="actions"><span class="btn" data-ads-move>Move budget</span><span class="btn-quiet">Not now</span></div>
          </div>
          <div class="turn tool" data-step="6"><code>update_budget</code> 2 ad sets on Meta</div>
          <div class="turn bot" data-step="7"><p>Done. Broad prospecting is capped at ₹3.8 lakh and 30-day retargeting is up to ₹2.6 lakh. I'll check pacing again tomorrow at 9.</p></div>
        </div>
        <div class="ads-input"><span data-ads-typed></span><i class="ads-caret"></i></div>
      </div>
      <svg class="ads-cursor" data-ads-cursor width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M2 2v19.5l5.2-4.9 3.4 7.6 3.3-1.5-3.3-7.4H18z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
    </div>`,
    trade: `<div class="trd" data-trd>
      <div class="trd-head"><span class="trd-avatar">TL</span><span><b>Trading loop</b><small>bot</small></span></div>
      <div class="trd-log">
        <div class="trd-msg bot" data-step="1"><b>Proposal 41</b><br>SOL/USDT, daily breakout<br>Buy 0.8 at 142.10, stop 136.40<br>Risk 0.5% of the sleeve. Expires 15:30.</div>
        <div class="trd-msg me" data-step="2">approve 41</div>
        <div class="trd-msg bot" data-step="3">Approved 41. Paper fill at 142.08. Stop is live.</div>
        <div class="trd-msg me" data-step="4">status</div>
        <div class="trd-msg bot" data-step="5">4 strategies running. 1 open position. Last heartbeat 2 min ago.</div>
        <div class="trd-msg me" data-step="6">kill crypto</div>
        <div class="trd-msg bot" data-step="7">Crypto sleeve halted. Only the laptop can restart it.</div>
      </div>
      <div class="trd-input"><span data-trd-typed></span><i class="ads-caret"></i></div>
    </div>`,
  };

  // Each returns { duration, steps: [[atMs, fn]], reset, still } for clock() to play.
  const htmlDemos = {
    ads(container, base = 1280) {
      container.innerHTML = TEMPLATES.ads;
      const app = $('[data-ads]', container);
      const phone = base < 600;
      app.classList.toggle('ads--phone', phone);
      fit(container, base, phone ? 0 : 800);
      const turns = $$('[data-step]', app);
      const typed = $('[data-ads-typed]', app);
      const cursor = $('[data-ads-cursor]', app);
      const move = $('[data-ads-move]', app);
      // on a phone the pointer is a fingertip
      if (phone) cursor.innerHTML = '<circle cx="11" cy="13" r="10" fill="rgba(20,20,20,.22)" stroke="rgba(255,255,255,.95)" stroke-width="1.5"/>';
      const rest = phone ? ['330px', '900px'] : ['1180px', '840px'];
      const question = 'Which Meta campaigns are overspending this week?';
      const show = (n) => turns.forEach((t) => { if (+t.dataset.step === n) t.classList.add('on'); });
      const park = () => { cursor.style.setProperty('--x', rest[0]); cursor.style.setProperty('--y', rest[1]); };
      const reset = () => { turns.forEach((t) => t.classList.remove('on')); typed.textContent = ''; move.classList.remove('is-press'); park(); };
      const pointAt = (el) => {
        const s = parseFloat(container.style.getPropertyValue('--s')) || 1;
        const a = app.getBoundingClientRect(), r = el.getBoundingClientRect();
        cursor.style.setProperty('--x', `${(r.left - a.left + r.width * 0.45) / s}px`);
        cursor.style.setProperty('--y', `${(r.top - a.top + r.height * 0.55) / s}px`);
      };
      const steps = [...question].map((ch, i) => [300 + i * 34, () => { typed.textContent += ch; }]);
      const sent = 300 + question.length * 34 + 350;
      steps.push(
        [sent, () => { typed.textContent = ''; show(1); }],
        [sent + 700, () => show(2)],
        [sent + 1300, () => show(3)],
        [sent + 2200, () => show(4)],
        [sent + 4200, () => pointAt(move)],
        [sent + 5400, () => move.classList.add('is-press')],
        [sent + 5700, () => { move.classList.remove('is-press'); show(6); park(); }],
        [sent + 6500, () => show(7)],
      );
      return { duration: 13000, steps, reset, still() { reset(); [1, 2, 3, 4].forEach(show); } };
    },

    trade(container) {
      container.innerHTML = TEMPLATES.trade;
      const app = $('[data-trd]', container);
      fit(container, 390);
      const msgs = $$('[data-step]', app);
      const typed = $('[data-trd-typed]', app);
      const show = (n) => msgs.forEach((m) => { if (+m.dataset.step === n) m.classList.add('on'); });
      const reset = () => { msgs.forEach((m) => m.classList.remove('on')); typed.textContent = ''; };
      // Type a reply into the input, then send it as message n.
      const reply = (at, text, n) => [
        ...[...text].map((ch, i) => [at + i * 70, () => { typed.textContent += ch; }]),
        [at + text.length * 70 + 300, () => { typed.textContent = ''; show(n); }],
      ];
      const steps = [
        [300, () => show(1)],
        ...reply(1700, 'approve 41', 2),
        [3900, () => show(3)],
        ...reply(5300, 'status', 4),
        [7100, () => show(5)],
        ...reply(8500, 'kill crypto', 6),
        [10800, () => show(7)],
      ];
      return { duration: 14000, steps, reset, still() { reset(); msgs.forEach((m) => m.classList.add('on')); } };
    },
  };
  htmlDemos['ads-phone'] = (container) => htmlDemos.ads(container, 390);

  /* ---------- Rows: one product each; its demo plays (and loops) only while it's in view ---------- */
  function setupRow(row) {
    const players = new Map();
    let cur = null;
    // a row can hold a browser for wide screens and a phone-width version for phones; play whichever shows
    const shown = () => $$('[data-play]', row).find((d) => d.offsetParent !== null);
    function player(d) {
      if (players.has(d)) return players.get(d);
      let p;
      if (d.dataset.play === 'video') {
        const v = $('video', d);
        const load = () => { if (!v.getAttribute('src')) { const src = MEDIA + d.dataset.src; v.poster = `${src}.jpg${MV}`; v.src = `${src}.mp4${MV}`; } };
        // a seek to where it already is makes the browser draw the frame again (a video it suspended in a
        // background tab otherwise stays blank)
        const redraw = () => { if (v.readyState >= 1) v.currentTime = v.currentTime; };
        p = { load, play() { load(); if (reduce) redraw(); else v.play().catch(redraw); }, pause() { v.pause(); } };
      } else {
        const c = clock(htmlDemos[d.dataset.html]($('.dv-html', d)));
        const loop = () => c.start(loop);
        let started = false;
        p = {
          load() {},
          play() { if (reduce) return c.still(); if (started) c.resume(); else { started = true; c.start(loop); } },
          pause() { c.pause(); },
        };
      }
      players.set(d, p);
      return p;
    }
    // load the poster a little before the row arrives, play once most of it is on screen
    new IntersectionObserver(([e]) => { if (e.isIntersecting) { const d = shown(); if (d) player(d).load(); } }, { rootMargin: '600px 0px' }).observe(row);
    let inView = false;
    onVisible(row, () => {
      const d = shown();
      if (!d) return;
      inView = true;
      if (cur && cur !== player(d)) cur.pause();
      cur = player(d);
      cur.play();
    }, () => { inView = false; cur?.pause(); }, 0.35);
    // Browsers suspend video in a background tab; coming back, the row on screen plays (and repaints) again.
    document.addEventListener('visibilitychange', () => {
      if (!cur || !inView) return;
      if (document.hidden) cur.pause(); else cur.play();
    });
  }
  $$('.row').forEach(setupRow);

  /* ---------- MIS: rounded running totals from the weekly MIS, March to October 2026 ---------- */
  const misStart = new Date(2026, 2, 2);
  const weeks = Array.from({ length: 34 }, (_, i) => new Date(misStart.getTime() + i * 7 * 864e5));
  const series = {
    nurses: [100, 210, 340, 440, 520, 600, 730, 850, 1060, 1380, 1810, 2080, 2300, 2680, 2920, 3170, 3400, 3540, 3730, 3860, 4060, 4160, 4390, 4510, 4630, 4730, 4830, 4950, 5190, 5310, 5450, 5660, 5810, 5930],
    ask: [0, 0, 0, 0, 0, 0, 10, 280, 720, 1240, 1960, 2870, 3780, 4590, 5330, 6330, 7200, 7780, 8580, 9230, 10210, 10650, 11140, 11680, 11990, 12380, 12730, 13050, 13660, 14210, 14820, 15520, 16070, 16570],
    learn: [2320, 2840, 3380, 4240, 5410, 6950, 9140, 10820, 12810, 14840, 17320, 20050, 22980, 27430, 31350, 34980, 37920, 40180, 41770, 42860, 43930, 44610, 45690, 47400, 48910, 50390, 52010, 53050, 54290, 55340, 56260, 57640, 59160, 61970],
  };
  const num = (n) => n.toLocaleString('en-IN');
  const EPISODE_MIN = 5;   // learning hours count each completed episode as five minutes
  const month = (d) => d.toLocaleDateString('en-GB', { month: 'short' });

  const mis = $('[data-mis]');
  if (mis) {
    const day = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    // Main chart: one series, a soft area, end label, crosshair note.
    const box = $('[data-chart="nurses"]', mis);
    const data = series.nurses;
    const W = 640, H = 300, L = 44, R = 60, T = 16, B = 30;
    const max = 6000;
    const x = (i) => L + (i / (data.length - 1)) * (W - L - R);
    const y = (v) => T + (1 - v / max) * (H - T - B);
    const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    let g = '';
    for (let v = 0; v <= max; v += 2000) {
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
      g += `<text class="axis" x="${L - 8}" y="${y(v) + 5}" text-anchor="end">${num(v)}</text>`;
    }
    weeks.forEach((d, i) => {
      if (i > 0 && d.getMonth() === weeks[i - 1].getMonth()) return;
      g += `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${month(d)}</text>`;
    });
    g += `<path class="area" d="M${x(0)},${y(0)} L${pts.join(' L')} L${x(data.length - 1)},${y(0)} Z"/>`;
    g += `<polyline class="line" points="${pts.join(' ')}"/>`;
    const last = data.length - 1;
    g += `<circle class="dot" cx="${x(last)}" cy="${y(data[last])}" r="5"/>`;
    g += `<text class="end-label" x="${x(last) + 10}" y="${y(data[last]) + 6}">${num(data[last])}</text>`;
    g += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
    g += `<circle class="dot hover" r="5" visibility="hidden"/>`;
    g += `<rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="${SVG}">${g}</svg><div class="tip" hidden></div>`;
    const svg = $('svg', box), tip = $('.tip', box), cross = $('.cross', svg), hdot = $('.hover', svg);
    const showAt = (clientX) => {
      const r = svg.getBoundingClientRect();
      const sx = ((clientX - r.left) / r.width) * W;
      const i = Math.round(clamp((sx - L) / (W - L - R)) * last);
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
      hdot.setAttribute('cx', x(i)); hdot.setAttribute('cy', y(data[i]));
      cross.setAttribute('visibility', 'visible'); hdot.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = `<b>${num(data[i])}</b> <span>nurses, week of ${day(weeks[i])}</span>`;
      tip.style.left = `${(x(i) / W) * 100}%`;
      tip.style.top = `${(y(data[i]) / H) * r.height}px`;
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); hdot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.addEventListener('pointermove', (e) => showAt(e.clientX));
    svg.addEventListener('pointerleave', hide);

    // Sparklines in the tiles: same series, no axes.
    $$('[data-spark]', mis).forEach((el) => {
      const d = series[el.dataset.spark];
      const top = Math.max(...d);
      const sx = (i) => (i / (d.length - 1)) * 120, sy = (v) => 36 - (v / top) * 32;
      const p = d.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(' ');
      el.innerHTML = `<svg viewBox="0 0 120 40" xmlns="${SVG}"><polyline points="${p}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="120" cy="${sy(d[d.length - 1])}" r="3.5" fill="var(--clay)" stroke="var(--paper)" stroke-width="2"/></svg>`;
    });

    // Table view: the last week of each month.
    const rows = $('[data-mis-rows]', mis);
    rows.innerHTML = weeks.map((d, i) => [d, i]).filter(([d, i]) => i === last || d.getMonth() !== weeks[i + 1].getMonth())
      .map(([d, i]) => `<tr><td>${d.toLocaleDateString('en-GB', { month: 'long' })}</td><td>${num(series.nurses[i])}</td><td>${num(series.ask[i])}</td><td>${num(Math.round(series.learn[i] * EPISODE_MIN / 60))}</td></tr>`)
      .join('');
  }

  // The MIS story card: the same totals, sketched (the line draws itself when the card is on).
  function sketch(box, data, { w, h, labels }) {
    const L = labels ? 6 : 0, R = labels ? 10 : 4, T = 8, B = labels ? 26 : 4;
    const top = Math.max(...data) * 1.04;
    const x = (i) => L + (i / (data.length - 1)) * (w - L - R);
    const y = (v) => T + (1 - v / top) * (h - T - B);
    const line = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    let g = `<path class="sk-area" d="${line} L${x(data.length - 1).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z"/>`;
    if (labels) {
      g += `<path class="sk-axis" d="M${L - 4} ${h - B + 1} L${w - R + 6} ${h - B - 1}"/>`;
      weeks.forEach((d, i) => {
        if (i > 0 && d.getMonth() === weeks[i - 1].getMonth()) return;
        g += `<text class="sk-label" x="${x(i)}" y="${h - 4}" text-anchor="middle">${month(d)}</text>`;
      });
    }
    g += `<path class="sk-line" pathLength="1" d="${line}"/>`;
    g += `<circle class="sk-dot" cx="${x(data.length - 1).toFixed(1)}" cy="${y(data[data.length - 1]).toFixed(1)}" r="${labels ? 5 : 3.5}"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${w} ${h}" xmlns="${SVG}" aria-hidden="true">${g}</svg>`;
  }
  $$('[data-sketch]').forEach((el) => sketch(el, series[el.dataset.sketch], { w: 346, h: 232, labels: true }));
  $$('[data-sketch-spark]').forEach((el) => sketch(el, series[el.dataset.sketchSpark], { w: 116, h: 42, labels: false }));

  /* ---------- Landing: open my laptop, then my phone ----------
     Scroll position drives the lid, the narrow push-in, and the laptop-aside-to-phone handoff. Every button or lid
     drag is a shortcut to a scroll target. Desktop apps and files open in windows (or full-screen sheets on phones)
     that grow from their icon and can also be dragged out by sliding. */
  function setupDesk(desk) {
    const stage = $('.desk-stage', desk);
    const deskMe = $('.desk-me', desk);
    const mac = $('[data-mac]', desk);
    const macLid = $('[data-mac-lid]', desk);
    const macScreen = $('[data-mac-screen]', desk);
    const macDark = $('[data-mac-dark]', desk);
    const desktop = $('[data-desktop]', desk);
    const dtFront = $('[data-dt-front]', desk);
    const dtClock = $('[data-clock]', desk);
    const dtWins = $('[data-dt-wins]', desk);
    const mScreen = $('[data-m-screen]', desk);
    const pocket = $('[data-pocket]', desk);
    const pkPhone = $('[data-pk-phone]', desk);
    const pkScreen = $('.device-screen', pkPhone);
    const pkStatusTime = $('.phone-status span', pkPhone);
    const mk = $('[data-mk]', desk), mkText = $('span', mk);
    const notesByKey = Object.fromEntries($$('.desk-data .note', desk).map((n) => [n.dataset.key, n]));
    const tpls = Object.fromEntries($$('.desk-data template[data-tpl]', desk).map((t) => [t.dataset.tpl, t]));
    const INTRO = 2800;

    const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
    const tintFor = (ch) => (ch === 'pixis' ? 'var(--lilac)' : (ch === 'personal' || ch === 'hi') ? 'var(--blush)' : ch === 'ai' ? 'var(--sand)' : 'var(--sage)');

    $$('.card', desk).forEach((c) => fit(c, 390));

    // The unibody keyboard: black keys set into the aluminium, one row at a time (width in key units).
    const KEYS = [
      [['esc', 1.4], ...'F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'.split(' ').map((k) => [k, 1]), ['⏏', 1]],
      [...'` 1 2 3 4 5 6 7 8 9 0 - ='.split(' ').map((k) => [k, 1]), ['delete', 1.5]],
      [['tab', 1.5], ...'Q W E R T Y U I O P [ ] \\'.split(' ').map((k) => [k, 1])],
      [['caps lock', 1.8], ...'A S D F G H J K L ; \''.split(' ').map((k) => [k, 1]), ['return', 1.7]],
      [['shift', 2.3], ...'Z X C V B N M , . /'.split(' ').map((k) => [k, 1]), ['shift', 2.2]],
      [['fn', 1], ['control', 1], ['option', 1], ['⌘', 1.3], ['', 5.2], ['⌘', 1.3], ['option', 1], ['←', 1], ['↑↓', 1], ['→', 1]],
    ];
    const keyWell = $('.mac-keys', mac);
    if (keyWell) keyWell.innerHTML = KEYS.map((row, r) => `<div class="mk-row${r === 0 ? ' mk-row--fn' : ''}">${row
      .map(([k, w]) => `<i style="--kw:${w}"${k.length > 2 ? ' class="mk-w"' : ''}>${k === '↑↓' ? '<b>↑</b><b>↓</b>' : k}</i>`).join('')}</div>`).join('');

    // Live Mumbai clock in the laptop's menu bar and the phone's status bar.
    const fmtMenu = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
    const fmtPhone = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    const tickClock = () => {
      const now = new Date();
      const parts = Object.fromEntries(fmtMenu.formatToParts(now).map((p) => [p.type, p.value]));
      if (dtClock) { dtClock.textContent = `${parts.weekday} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`; dtClock.title = 'Mumbai time'; }
      if (pkStatusTime) pkStatusTime.textContent = fmtPhone.format(now);
      // iCal's Dock icon always showed today's date
      const cal = $('.dt-icon--cal', desktop);
      if (cal) {
        $('b', cal).textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', month: 'short' }).format(now).toUpperCase();
        $('i', cal).textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric' }).format(now);
      }
    };
    tickClock();
    setInterval(tickClock, 20000);

    // State & geometry
    let H = innerHeight, stageW = innerWidth, W = 840, Hl = 548;
    let a1 = 500, b0 = 800, b1 = 1500, end = 1800, deskTop = 0;
    let open = 0, push = 0, aside = 0, atDesk = false, atPhone = false, inStage = true;
    // Phones don't scroll the page: the scene has three states (cover, desktop, phone) and a swipe or a button plays
    // an eased transition between them, so it can never stop half way (iOS Safari's momentum and toolbar did that).
    let vY = 0, tweenRaf = 0, tweening = false;
    let lastScrollY = scrollY, scrollDir = 1, snapTimer = 0, snapping = false, pointerDown = false;
    let nudgeDeg = 0, interacted = false;
    let wins = [], zCounter = 10, cascadeIdx = 0;
    let curPk = null, mkTimer = 0, activeMarks = [], activeMarkIdx = -1, activePlayer = null, activeMkHost = null;

    // Re-parent the desktop when crossing the 900px breakpoint.
    function syncBreakpoint() {
      closeAllWins(true);
      closeStory(true);
      if (wide.matches) {
        if (desktop.parentElement !== macScreen) macScreen.prepend(desktop);
      } else if (desktop.parentElement !== mScreen) mScreen.append(desktop);
    }

    function measure() {
      H = stage.clientHeight || innerHeight;
      stageW = stage.clientWidth || innerWidth;
      a1 = Math.round((wide.matches ? 0.6 : 0.8) * H);
      b0 = Math.round(a1 + 0.35 * H);
      b1 = Math.round(b0 + 0.8 * H);
      end = Math.round(b1 + 0.35 * H);
      desk.style.height = wide.matches ? `${H + end}px` : `${H}px`;
      if (!wide.matches) vY = [0, a1, b1][stateOf(vY)];

      if (wide.matches) {
        W = Math.round(Math.min(0.72 * stageW, (H - 136) / 0.652, 1120));
      } else {
        W = Math.round(Math.min(0.88 * stageW, 370));
      }
      Hl = Math.round(0.652 * W);
      mac.style.setProperty('--W', `${W}px`);
      deskTop = scrollY + desk.getBoundingClientRect().top;
      frame();
    }

    function frame() {
      const rect = desk.getBoundingClientRect();
      deskTop = scrollY + rect.top;
      inStage = rect.bottom > 80 && rect.top < H * 0.85;
      const y = wide.matches ? clamp(-rect.top, 0, end) : vY;
      if (!wide.matches) inStage = true;

      if (reduce) {
        if (y < a1 * 0.5) { open = 0; push = 0; aside = 0; }
        else if (y < (b0 + b1) * 0.5) { open = 1; push = 1; aside = 0; }
        else { open = 1; push = 1; aside = 1; }
      } else if (wide.matches) {
        open = clamp(y / a1);
        push = 0;
        aside = clamp((y - b0) / (b1 - b0));
      } else {
        open = clamp(y / (a1 * 0.5));
        push = clamp((y - a1 * 0.5) / (a1 * 0.5));
        aside = clamp((y - b0) / (b1 - b0));
      }

      const onCover = open <= 0.02;
      atDesk = (wide.matches ? open >= 0.98 : push >= 0.98) && aside <= 0.02;
      atPhone = aside >= 0.98;

      desk.classList.toggle('on-cover', onCover);
      desk.classList.toggle('is-desk', atDesk);
      desk.classList.toggle('is-phone', atPhone);
      desktop.inert = !atDesk;
      pocket.inert = !atPhone;

      // Identity copy fade
      const meOp = 1 - smoothstep(0.02, 0.46, open);
      const meY = -smoothstep(0, 0.5, open) * 26;
      deskMe.style.setProperty('--me-op', meOp.toFixed(3));
      deskMe.style.setProperty('--me-y', `${meY.toFixed(1)}px`);

      // Lid angle, glass reflection sweep, and studio lighting
      const eo = smoothstep(0, 1, open);
      const ea = smoothstep(0, 1, aside);
      const lidDeg = clamp(-90 * (1 - eo) + (onCover ? nudgeDeg : 0), -90, 0);
      macLid.style.setProperty('--lid', `${lidDeg.toFixed(2)}deg`);
      mac.style.setProperty('--deck-op', smoothstep(0.05, 0.35, open).toFixed(3));
      const darkOp = 1 - smoothstep(0.48, 0.88, open);
      mac.style.setProperty('--dark', darkOp.toFixed(3));
      const sheenX = -34 + eo * 66;
      const sheenOp = Math.sin(eo * Math.PI) * 0.85 + 0.12;
      mac.style.setProperty('--sheen', `${sheenX.toFixed(1)}%`);
      mac.style.setProperty('--sheen-op', sheenOp.toFixed(3));

      if (wide.matches) {
        const x0 = 0.72 * stageW - 0.5 * W;
        const y0 = 0.44 * H - 0.82 * Hl;
        const s0 = 0.63;
        const x1 = (stageW - W) * 0.5;
        const y1 = Math.max(66, (H - Hl) * 0.42);
        const s1 = 1;
        const x2 = 0.04 * stageW - 0.5 * W;
        const y2 = (H - Hl) * 0.5;
        const s2 = 0.45;

        const mx = x0 + (x1 - x0) * eo + (x2 - x1) * ea;
        const my = y0 + (y1 - y0) * eo + (y2 - y1) * ea;
        const ms = s0 + (s1 - s0) * eo + (s2 - s1) * ea;

        // 3D hero camera angle on the cover, orbiting to front-and-center as the lid opens, then angling aside
        const heroRx = 5.5 * (1 - eo);
        const heroRy = -9.5 * (1 - eo) + 20 * ea;
        const heroRz = 0.8 * (1 - eo);
        mac.style.setProperty('--rx', `${heroRx.toFixed(2)}deg`);
        mac.style.setProperty('--ry', `${heroRy.toFixed(2)}deg`);
        mac.style.setProperty('--rz', `${heroRz.toFixed(2)}deg`);
        mac.style.setProperty('--sh-y', `${(28 - 10 * eo).toFixed(1)}px`);
        mac.style.setProperty('--sh-s', (0.94 + 0.06 * eo).toFixed(3));

        const macOp = 1 - 0.45 * ea;

        if (atDesk) {
          mac.style.transform = `translate3d(${Math.round(x1)}px, ${Math.round(y1)}px, 0) scale(1)`;
        } else {
          mac.style.transform = `translate3d(${mx.toFixed(1)}px, ${my.toFixed(1)}px, 0) scale(${ms.toFixed(3)})`;
        }
        mac.style.opacity = macOp.toFixed(3);

        const pkProg = smoothstep(0.28, 1, aside);
        pocket.style.setProperty('--pk-y', `${((1 - pkProg) * 32).toFixed(2)}%`);
        pocket.style.setProperty('--pk-op', pkProg.toFixed(3));
      } else {
        // Phones: the closed laptop sits just under the words (Sujith's pick); opening it, the camera
        // zooms into its screen (transform only, so it stays on the GPU) and the real desktop fades in over it.
        const ep = smoothstep(0, 1, push);
        const meBottom = deskMe.offsetTop + deskMe.offsetHeight;
        const x0 = (stageW - W) * 0.5;
        const y0 = Math.min(H - Hl - 48, meBottom - Hl + 32);
        const y1 = (H - Hl) * 0.44;
        const zoom = Math.max(stageW / (W * 0.94), H / (Hl * 0.9)) * 1.04;
        const ms = 1 + (zoom - 1) * ep * ep;
        const yz = H * 0.5 - Hl * 0.5 + Hl * 0.03 * ms;
        const mx = x0 - stageW * 0.92 * ea;
        const my = y0 + (y1 - y0) * eo + (yz - y1) * ep;
        mac.style.setProperty('--rx', '0deg');
        mac.style.setProperty('--ry', '0deg');
        mac.style.setProperty('--rz', '0deg');
        mac.style.transform = `translate3d(${mx.toFixed(1)}px, ${my.toFixed(1)}px, 0) scale(${ms.toFixed(3)})`;
        mac.style.opacity = (1 - smoothstep(0.82, 1, ep) * (1 - ea)).toFixed(3);

        mScreen.style.clipPath = 'none';
        if (aside <= 0.01) {
          mScreen.style.opacity = smoothstep(0.72, 0.95, ep).toFixed(3);
          mScreen.style.transform = `scale(${(1.06 - 0.06 * smoothstep(0.62, 1, ep)).toFixed(4)})`;
        } else {
          mScreen.style.opacity = (1 - smoothstep(0, 0.85, ea)).toFixed(3);
          mScreen.style.transform = `translate3d(${(-ea * 100).toFixed(2)}%, 0, 0)`;
        }

        pocket.style.setProperty('--pk-x', `${((1 - ea) * 102).toFixed(2)}%`);
      }

      syncPlayers();
    }

    // Phones: which of the three states a position belongs to, and an eased tween between states
    function stateOf(y) { return y < a1 * 0.5 ? 0 : y < (a1 + b1) * 0.5 ? 1 : 2; }
    function tweenTo(target, immediate = false) {
      cancelAnimationFrame(tweenRaf);
      const from = vY;
      if (immediate || reduce || from === target) { vY = target; tweening = false; frame(); return; }
      // the lid and the zoom get room to breathe; the slide to the phone is quicker
      const dur = Math.abs(target - from) > (b1 - a1) * 1.2 ? 1900 : (target > a1 || from > a1) ? 950 : 1500;
      const t0 = performance.now();
      const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      tweening = true;
      const step = (now) => {
        const p = clamp((now - t0) / dur);
        vY = from + (target - from) * ease(p);
        frame();
        if (p < 1) tweenRaf = requestAnimationFrame(step);
        else { vY = target; tweening = false; frame(); }
      };
      tweenRaf = requestAnimationFrame(step);
    }
    function stepState(dir) {
      if (tweening) return;
      const next = clamp(stateOf(vY) + dir, 0, 2);
      if (next === stateOf(vY)) return;
      if (next < 2) closeStory(true);
      if (next !== 1) closeAllWins(true);
      tweenTo([0, a1, b1][next]);
    }
    // a vertical swipe anywhere outside the scrolling parts (the feed, a story, an open window) changes state
    const SCROLLERS = '.ig-views, .igs, .ig-sheet, .win, .dt-wins, input, textarea, [data-slide-file]';
    let swipe = null;
    stage.addEventListener('touchstart', (e) => {
      if (wide.matches || e.touches.length !== 1 || e.target.closest(SCROLLERS)) { swipe = null; return; }
      swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
    }, { passive: true });
    stage.addEventListener('touchmove', (e) => {
      if (swipe && !wide.matches && e.cancelable) e.preventDefault();
    }, { passive: false });
    stage.addEventListener('touchend', (e) => {
      if (!swipe || wide.matches) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dy) > 36 && Math.abs(dy) > Math.abs(dx) * 1.2) stepState(dy < 0 ? 1 : -1);
    });
    let wheelLock = 0;
    stage.addEventListener('wheel', (e) => {
      if (wide.matches || e.target.closest(SCROLLERS)) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) < 12 || performance.now() < wheelLock) return;
      wheelLock = performance.now() + 1100;
      stepState(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    // Scroll to a target offset inside section.desk
    function scrollToDesk(targetY, immediate = false) {
      interacted = true;
      if (!wide.matches) { tweenTo(clamp(targetY, 0, b1), immediate); return; }
      const top = deskTop + targetY;
      if (immediate || reduce) {
        if (lenis) lenis.scrollTo(top, { immediate: true });
        else window.scrollTo(0, top);
        frame();
        return;
      }
      snapping = true;
      clearTimeout(snapTimer);
      if (lenis && wide.matches) lenis.scrollTo(top, { duration: 0.9 });
      else window.scrollTo({ top, behavior: 'smooth' });
      setTimeout(() => {
        if (wide.matches) {
          if (lenis) lenis.scrollTo(top, { immediate: true });
          else window.scrollTo(0, top);
        }
        snapping = false;
        frame();
      }, 920);
    }

    // Direction-aware snap after ~160ms idle
    function checkSnap() {
      if (!wide.matches || reduce || snapping || pointerDown) return;
      const rect = desk.getBoundingClientRect();
      const y = -rect.top;
      if (y <= 2 || y >= end - 2) return;
      if (y > 0 && y < a1) {
        const prog = y / a1;
        const dest = (scrollDir >= 0 ? prog > 0.12 : prog > 0.88) ? a1 : 0;
        scrollToDesk(dest);
      } else if (y > b0 && y < b1) {
        const prog = (y - b0) / (b1 - b0);
        const dest = (scrollDir >= 0 ? prog > 0.12 : prog > 0.88) ? b1 : b0;
        scrollToDesk(dest);
      }
    }

    let rafScroll = 0;
    addEventListener('scroll', () => {
      const dy = scrollY - lastScrollY;
      if (Math.abs(dy) > 0.5) { scrollDir = dy > 0 ? 1 : -1; interacted = true; }
      lastScrollY = scrollY;
      if (!rafScroll) rafScroll = requestAnimationFrame(() => { rafScroll = 0; frame(); });
      if (!snapping && !reduce) {
        clearTimeout(snapTimer);
        snapTimer = setTimeout(checkSnap, 160);
      }
    }, { passive: true });

    addEventListener('pointerdown', () => { pointerDown = true; interacted = true; clearTimeout(snapTimer); }, { passive: true });
    const endPointer = () => {
      if (!pointerDown) return;
      pointerDown = false;
      if (!snapping && !reduce) { clearTimeout(snapTimer); snapTimer = setTimeout(checkSnap, 160); }
    };
    addEventListener('pointerup', endPointer, { passive: true });
    addEventListener('pointercancel', endPointer, { passive: true });

    // Shortcuts & lid drag
    // The masthead's Laptop and Phone links are shortcuts too.
    const shortcut = (sel, fn) => $$(sel).forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); setMenu(false); fn(); }));
    shortcut('[data-desk-open]', () => {
      closeStory(true);
      scrollToDesk(a1);
      setTimeout(() => $('.dt-app', desktop)?.focus({ preventScroll: true }), reduce ? 20 : 940);
    });
    shortcut('[data-desk-phone]', () => {
      closeAllWins(true);
      scrollToDesk(b1);
      setTimeout(() => $('.ig-ring', pocket)?.focus({ preventScroll: true }), reduce ? 20 : 940);
    });
    $$('[data-desk-laptop]', desk).forEach((b) => b.addEventListener('click', () => {
      closeStory(true);
      scrollToDesk(b0);
      setTimeout(() => $('.dt-app', desktop)?.focus({ preventScroll: true }), reduce ? 20 : 940);
    }));

    // Lid drag or click on the closed/aside laptop
    let lidDrag = null;
    mac.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      if (atDesk) return;
      if (atPhone) { scrollToDesk(b0); return; }
      if (e.pointerType === 'touch') return; // touch uses native scroll
      lidDrag = { id: e.pointerId, startY: e.clientY, startScroll: clamp(-desk.getBoundingClientRect().top, 0, a1), moved: false };
      mac.setPointerCapture(e.pointerId);
    });
    mac.addEventListener('pointermove', (e) => {
      if (!lidDrag || e.pointerId !== lidDrag.id) return;
      const dy = lidDrag.startY - e.clientY;
      if (Math.abs(dy) > 5) lidDrag.moved = true;
      if (!lidDrag.moved) return;
      const target = clamp(lidDrag.startScroll + (dy / 300) * a1, 0, a1);
      scrollDir = dy >= 0 ? 1 : -1;
      scrollToDesk(target, true);
    });
    const endLidDrag = (e) => {
      if (!lidDrag || e.pointerId !== lidDrag.id) return;
      const d = lidDrag;
      lidDrag = null;
      if (!d.moved) scrollToDesk(a1);
      else checkSnap();
    };
    mac.addEventListener('pointerup', endLidDrag);
    mac.addEventListener('pointercancel', endLidDrag);

    /* ---------- Players & Title Card (titled) ---------- */

    function makePlayer(note, bodyEl, isPhoneView) {
      const m = isPhoneView && (note.dataset.mVideo || note.dataset.mHtml);
      const videoName = m && note.dataset.mVideo ? note.dataset.mVideo : note.dataset.video;
      const htmlName = m && note.dataset.mHtml ? note.dataset.mHtml : note.dataset.html;
      let L;
      if (videoName) {
        let v = $('video', bodyEl);
        if (!v) {
          v = document.createElement('video');
          v.className = 'dv-video';
          v.muted = true; v.playsInline = true; v.preload = 'none';
          v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
          bodyEl.prepend(v);
        }
        v.hidden = false;
        const src = MEDIA + videoName;
        const load = () => { if (v.dataset.src !== src) { v.dataset.src = src; v.poster = `${src}.jpg${MV}`; v.src = `${src}.mp4${MV}`; } };
        const redraw = () => { if (v.readyState >= 1) v.currentTime = v.currentTime; };
        L = {
          el: v, load,
          get elapsed() { return v.currentTime * 1000; },
          get duration() { return (v.duration || 12) * 1000; },
          start(onEnd) { load(); v.loop = !onEnd; v.onended = onEnd || null; try { v.currentTime = 0; } catch (e) {} v.play().catch(redraw); },
          resume() { load(); v.play().catch(redraw); },
          pause() { v.pause(); },
          still() { load(); v.pause(); redraw(); },
        };
      } else if (htmlName) {
        let box = $(`.dv-html[data-html="${htmlName}"]`, bodyEl);
        if (!box) {
          box = document.createElement('div');
          box.className = 'dv-html';
          box.dataset.html = htmlName;
          bodyEl.prepend(box);
        }
        box.hidden = false;
        const c = clock(htmlDemos[htmlName](box));
        L = {
          el: box, load() {},
          get elapsed() { return c.elapsed; },
          get duration() { return c.duration; },
          start(onEnd) { const done = onEnd || (() => c.start(done)); c.start(done); },
          resume() { c.resume(); },
          pause() { c.pause(); },
          still() { c.still(); },
        };
      }
      return L;
    }

    // What I did, in a few lines: the kicker, headline, result, up to two more numbers and three "Worked with" tags.
    const INTRO_HTML = '<p class="intro-kick"></p><p class="intro-title"></p><p class="intro-stat"><span class="marker"></span></p><p class="intro-lab"></p><ul class="intro-m"></ul><ul class="row-tags intro-tags"></ul>';
    function fillIntro(note, introEl) {
      const stat = $('.note-stat', note)?.textContent || '';
      if (!stat) return false;
      $('.intro-kick', introEl).textContent = $('.note-kick', note)?.textContent || '';
      $('.intro-title', introEl).textContent = $('.note-title', note)?.textContent.trim().replace(/\s+/g, ' ') || '';
      $('.intro-stat .marker', introEl).textContent = stat;
      $('.intro-lab', introEl).textContent = $('.note-lab', note)?.textContent || '';
      const facts = (note.dataset.facts || '').split('|').filter(Boolean).slice(0, 2).map((f) => f.split(': '));
      $('.intro-m', introEl).innerHTML = facts.map(([l, v]) => `<li><b>${v}</b>${l}</li>`).join('');
      const tags = (note.dataset.tags || '').split('|').filter(Boolean).slice(0, 3);
      $('.intro-tags', introEl).innerHTML = tags.map((t) => `<li>${t}</li>`).join('');
      introEl.style.setProperty('--tint', tintFor(note.dataset.chapter));
      return true;
    }

    // On the laptop the demo starts at once and the summary floats over it until it's closed (or after a few seconds).
    const POP_MS = 7000;
    function summarised(L, note, introEl) {
      if (!L || !fillIntro(note, introEl)) return L;
      let timer = 0;
      const hide = () => { clearTimeout(timer); introEl.classList.remove('on'); };
      $('.intro-x', introEl)?.addEventListener('click', (e) => { e.stopPropagation(); hide(); });
      introEl.addEventListener('click', (e) => { if (e.target === introEl) hide(); });
      return {
        el: L.el,
        get elapsed() { return L.elapsed; },
        get duration() { return L.duration; },
        get media() { return L.elapsed; },
        start(onEnd) {
          L.start(onEnd);
          introEl.classList.add('on');
          clearTimeout(timer);
          if (!reduce) timer = setTimeout(hide, POP_MS);
        },
        resume() { L.resume(); },
        pause() { L.pause(); },
        still() { L.still(); introEl.classList.add('on'); },
      };
    }

    /* ---------- Timed Ink Notes (.mk) ---------- */

    function setActiveInk(player, note, hostEl, isPhoneCut) {
      activePlayer = player;
      activeMkHost = hostEl;
      activeMarkIdx = -1;
      mk.classList.remove('on');
      if (!player || !note) { activeMarks = []; return; }
      activeMarks = $$('.note-marks li', note).map((li) => ({
        at: +(isPhoneCut && li.dataset.mAt ? li.dataset.mAt : li.dataset.at),
        y: +li.dataset.y || 50,
        text: li.textContent,
      }));
    }

    function tickInk() {
      if (!activePlayer || !activeMarks.length) return;
      const tm = activePlayer.media === undefined ? activePlayer.elapsed : activePlayer.media;
      let m = -1;
      if (tm >= 0) activeMarks.forEach((x, k) => { if (tm >= x.at * 1000) m = k; });
      if (m !== activeMarkIdx) {
        activeMarkIdx = m;
        mk.classList.remove('on');
        if (m >= 0) {
          void mk.offsetWidth;
          mkText.textContent = activeMarks[m].text;
          mk.style.setProperty('--y', activeMarks[m].y);
          mk.classList.toggle('mk-top', activeMarks[m].y >= 50);
          // Place beside the device on wide screens when margin >= 180px; otherwise as an ivory pill inside the window/sheet.
          if (!wide.matches) {
            if (activeMkHost && mk.parentElement !== activeMkHost) activeMkHost.append(mk);
            mk.classList.add('mk--pill');
          } else if (atDesk) {
            const macRect = macScreen.getBoundingClientRect();
            const stRect = stage.getBoundingClientRect();
            const rightMargin = stRect.right - macRect.right;
            if (rightMargin >= 180) {
              if (mk.parentElement !== stage) stage.append(mk);
              mk.classList.remove('mk--pill');
              mk.style.setProperty('--mk-x', `${Math.round(macRect.right - stRect.left + 16)}px`);
              mk.style.setProperty('--mk-w', `${Math.round(rightMargin - 28)}px`);
            } else {
              if (activeMkHost && mk.parentElement !== activeMkHost) activeMkHost.append(mk);
              mk.classList.add('mk--pill');
            }
          } else if (atPhone) {
            const phRect = pkPhone.getBoundingClientRect();
            const stRect = stage.getBoundingClientRect();
            const rightMargin = stRect.right - phRect.right;
            if (mk.parentElement !== stage) stage.append(mk);
            mk.classList.remove('mk--pill');
            mk.style.setProperty('--mk-x', `${Math.round(phRect.right - stRect.left + 18)}px`);
            mk.style.setProperty('--mk-w', `${Math.max(180, Math.round(rightMargin - 28))}px`);
          }
          mk.classList.add('on');
        }
      }
      if (activePlayer.running) mkTimer = requestAnimationFrame(tickInk);
    }

    function syncPlayers() {
      cancelAnimationFrame(mkTimer);
      const canPlay = inStage && !document.hidden;
      // Laptop windows: only the front window plays when atDesk
      const frontWin = wins[wins.length - 1];
      wins.forEach((w) => {
        if (!w.player) return;
        const wantWin = canPlay && atDesk && w === frontWin && w.t >= 0.95;
        if (reduce && wantWin && !w.started) { w.started = true; w.player.still(); }
        else if (wantWin && !reduce && !w.running) {
          w.running = true;
          w.player.running = true;
          if (w.started) w.player.resume();
          else { w.started = true; w.player.start(); }
        } else if ((!wantWin || reduce) && w.running) {
          w.running = false;
          w.player.running = false;
          w.player.pause();
        }
      });

      // Phone app player: plays when atPhone
      if (curPk?.player) {
        const wantPk = canPlay && atPhone;
        if (reduce && wantPk && !curPk.started) { curPk.started = true; curPk.player.still(); }
        else if (wantPk && !reduce && !curPk.running) {
          curPk.running = true;
          curPk.player.running = true;
          if (curPk.started) curPk.player.resume();
          else { curPk.started = true; curPk.player.start(() => storyStep(1)); }
        } else if ((!wantPk || reduce) && curPk.running) {
          curPk.running = false;
          curPk.player.running = false;
          curPk.player.pause();
        }
      }

      // Drive timed ink notes for whichever player is active
      if (atDesk && frontWin?.player && frontWin.t >= 0.95) {
        setActiveInk(frontWin.player, frontWin.note, frontWin.body, !wide.matches);
        if (frontWin.running) mkTimer = requestAnimationFrame(tickInk);
      } else if (atPhone && curPk?.player) {
        setActiveInk(curPk.player, curPk.note, story, !wide.matches);
        if (curPk.running) mkTimer = requestAnimationFrame(tickInk);
      } else {
        setActiveInk(null, null, null, false);
      }
    }

    // say-hi.txt opens by the visitor's name when they gave one on the cover
    function greetTxt(el) {
      const first = ($('[data-visitor]')?.value || '').trim().split(/\s+/)[0];
      const line = $('[data-txt-hi]', el);
      if (line) line.textContent = first ? `Hi ${first},` : 'Hi,';
    }

    /* ---------- Window Manager (Desktop Apps & Files) ---------- */

    function winSizeFor(key) {
      if (key === 'ads' || key === 'money-plan' || key === 'gbf' || key === 'pathways') return { w: 0.64, aspect: 1.6 };
      if (key === 'mis' || key === 'ai') return { w: 0.64, h: 0.72 };
      if (key.startsWith('writing-')) return { w: 0.62, h: 0.76 };
      if (key === 'kit') return { w: 0.48, h: 0.66 };
      if (key === 'pixis') return { w: 0.56, h: 0.66 };
      return { w: 0.42, h: 0.48 };
    }

    function populateWinBody(key, note, body) {
      if (note?.dataset.video || note?.dataset.html) {
        const introEl = document.createElement('div');
        introEl.className = 'intro intro--pop';
        introEl.innerHTML = `<div class="intro-card" role="note">${INTRO_HTML}<button class="intro-x" type="button" aria-label="Close the summary">×</button></div>`;
        body.append(introEl);
        const raw = makePlayer(note, body, !wide.matches);
        return summarised(raw, note, introEl);
      }
      body.classList.add('win-body--scroll');
      if (key === 'mis') {
        body.append(tpls.mis.content.cloneNode(true));
        $$('[data-sketch]', body).forEach((el) => sketch(el, series[el.dataset.sketch], { w: 460, h: 200, labels: true }));
        $$('[data-sketch-spark]', body).forEach((el) => sketch(el, series[el.dataset.sketchSpark], { w: 116, h: 42, labels: false }));
      } else if (tpls[key]) {
        body.append(tpls[key].content.cloneNode(true));
        if (key === 'hi') greetTxt(body);
      } else if (note?.dataset.article) {
        body.classList.remove('win-body--scroll');
        const iframe = document.createElement('iframe');
        iframe.className = 'win-iframe';
        iframe.src = `${note.dataset.article}?embed=1`;
        iframe.title = note.dataset.title || 'Article';
        iframe.addEventListener('load', () => {
          try { if (iframe.contentDocument) iframe.contentDocument.documentElement.dataset.theme = 'light'; } catch (e) {}
        });
        body.append(iframe);
      }
      return null;
    }

    function focusWin(w) {
      const idx = wins.indexOf(w);
      if (idx < 0) return;
      wins.splice(idx, 1);
      wins.push(w);
      wins.forEach((item, i) => {
        item.el.style.zIndex = String(++zCounter);
        item.el.classList.toggle('is-front', i === wins.length - 1);
      });
      if (dtFront) dtFront.textContent = (w.note?.dataset.title || '').split('·')[0].trim() || 'Finder';
      syncPlayers();
    }

    function measureWinGeom(w) {
      if (!wide.matches) {
        w.box = { left: 0, top: 0, width: innerWidth, height: innerHeight };
        const ir = w.fromEl?.getBoundingClientRect() || { left: innerWidth * 0.5, top: innerHeight * 0.5, width: 48, height: 48 };
        w.fromBox = { left: ir.left, top: ir.top, width: ir.width, height: ir.height };
        return;
      }
      const hostRect = dtWins.getBoundingClientRect();
      const hostW = dtWins.clientWidth || hostRect.width || 800;
      const hostH = dtWins.clientHeight || hostRect.height || 480;
      const scale = hostRect.width / hostW || 1;

      if (w.maximized) {
        w.el.style.left = '0px';
        w.el.style.top = '0px';
        w.el.style.width = `${hostW}px`;
        w.el.style.height = `${hostH}px`;
        w.box = { left: 0, top: 0, width: hostW, height: hostH };
      } else {
        const spec = winSizeFor(w.key);
        const winW = Math.round(hostW * spec.w);
        const barH = 34;
        const winH = spec.aspect ? Math.min(hostH - 20, Math.round(winW / spec.aspect) + barH) : Math.round(hostH * spec.h);
        const off = (w.cascade % 4 - 1) * 16;
        const left = Math.round(clamp((hostW - winW) * 0.5 + off, 10, Math.max(10, hostW - winW - 10)));
        const top = Math.round(clamp((hostH - winH) * 0.14 + off * 0.6, 6, Math.max(6, hostH - winH - 6)));
        w.el.style.left = `${left}px`;
        w.el.style.top = `${top}px`;
        w.el.style.width = `${winW}px`;
        w.el.style.height = `${winH}px`;
        w.box = { left, top, width: winW, height: winH };
      }

      const iconEl = $('.dt-icon, .dt-ficon', w.fromEl) || w.fromEl;
      const ir = iconEl ? iconEl.getBoundingClientRect() : hostRect;
      w.fromBox = {
        left: (ir.left - hostRect.left) / scale,
        top: (ir.top - hostRect.top) / scale,
        width: Math.max(24, ir.width / scale),
        height: Math.max(24, ir.height / scale),
      };
    }

    function syncWinControls(w) {
      w.el.classList.toggle('is-max', !!w.maximized && !w.theater);
      w.el.classList.toggle('is-theater', !!w.theater);
      const fsBtn = $('[data-win-fs]', w.el);
      if (fsBtn) {
        if (w.theater) {
          fsBtn.textContent = 'In laptop ↙';
          fsBtn.setAttribute('aria-label', 'Return window to laptop screen');
        } else if (w.maximized) {
          fsBtn.textContent = 'Windowed';
          fsBtn.setAttribute('aria-label', 'Switch to floating window');
        } else {
          fsBtn.textContent = 'Full screen';
          fsBtn.setAttribute('aria-label', 'Maximize window in laptop screen');
        }
      }
    }

    function toggleWinMax(w, forceMax) {
      if (!wide.matches) return;
      if (w.theater) {
        w.theater = false;
        if (w.el.parentElement !== dtWins) dtWins.append(w.el);
      }
      w.maximized = forceMax !== undefined ? forceMax : !w.maximized;
      syncWinControls(w);
      measureWinGeom(w);
      setWinT(w, 1);
      syncPlayers();
    }

    function toggleWinTheater(w, forceTheater) {
      if (!wide.matches) return;
      w.theater = forceTheater !== undefined ? forceTheater : !w.theater;
      if (w.theater) {
        if (w.el.parentElement !== stage) stage.append(w.el);
        w.el.style.transform = 'none';
        w.el.style.opacity = '1';
      } else {
        if (w.el.parentElement !== dtWins) dtWins.append(w.el);
        measureWinGeom(w);
        setWinT(w, 1);
      }
      syncWinControls(w);
      syncPlayers();
    }

    function setWinT(w, t, dragOffset = null) {
      w.t = clamp(t);
      if (w.theater) {
        w.el.style.transform = 'none';
        w.el.style.opacity = '1';
        return;
      }
      const { left, top, width, height } = w.box;
      const fb = w.fromBox;
      const dx = (fb.left - left) * (1 - w.t) + (dragOffset ? dragOffset.x * (1 - w.t) : 0);
      const dy = (fb.top - top) * (1 - w.t) + (dragOffset ? dragOffset.y * (1 - w.t) : 0);
      const sx = (fb.width / width) + (1 - fb.width / width) * w.t;
      const sy = (fb.height / height) + (1 - fb.height / height) * w.t;
      if (w.t >= 0.999 && !dragOffset) {
        w.el.style.transform = 'none';
        w.el.style.opacity = '1';
      } else {
        w.el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
        w.el.style.opacity = clamp(w.t * 1.6).toFixed(3);
      }
    }

    function animateWinT(w, targetT, onDone) {
      cancelAnimationFrame(w.raf);
      if (reduce) {
        setWinT(w, targetT);
        if (onDone) onDone();
        syncPlayers();
        return;
      }
      const startT = w.t;
      const t0 = performance.now();
      const dur = targetT > startT ? 400 : 280;
      const step = (now) => {
        const p = clamp((now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        setWinT(w, startT + (targetT - startT) * e);
        if (p < 1) w.raf = requestAnimationFrame(step);
        else { setWinT(w, targetT); if (onDone) onDone(); syncPlayers(); }
      };
      w.raf = requestAnimationFrame(step);
    }

    function createWin(key, fromEl) {
      const existing = wins.find((x) => x.key === key);
      if (existing) {
        focusWin(existing);
        return existing;
      }
      if (!wide.matches) closeAllWins(true);
      else if (wins.length >= 3) closeWin(wins[0], true);

      const note = notesByKey[key];
      const titleText = note?.dataset.title || key;
      const el = document.createElement('div');
      el.className = 'win is-front is-max';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', titleText);

      let extLink = '';
      if (note?.dataset.article) extLink = `<a class="win-ext" href="${note.dataset.article}">Full page ↗</a>`;
      else if (key === 'gbf') extLink = '<a class="win-ext" href="https://www.gbf-blr.com" target="_blank" rel="noopener">Visit ↗</a>';
      else if (key === 'money-plan') extLink = '<a class="win-ext" href="runway/" target="_blank" rel="noopener">Visit ↗</a>';
      else if (key === 'pathways') extLink = '<a class="win-ext" href="https://pathways.borderplus.co" target="_blank" rel="noopener">Visit ↗</a>';

      el.innerHTML = `<div class="win-bar"><div class="win-lights"><button class="win-dot win-dot--close" type="button" data-win-close aria-label="Close ${titleText}">×</button><button class="win-dot win-dot--min" type="button" data-win-mode="window" aria-label="Toggle windowed mode">–</button><button class="win-dot win-dot--full" type="button" data-win-mode="theater" aria-label="Toggle full screen">+</button></div><span class="win-title">${titleText}</span><div class="win-actions"><button class="win-fs" type="button" data-win-fs>Windowed</button>${extLink}</div></div><div class="win-body"></div>`;
      dtWins.append(el);

      const body = $('.win-body', el);
      const player = populateWinBody(key, note, body);
      const w = { key, note, el, body, player, fromEl, cascade: cascadeIdx++, maximized: true, theater: false, t: 0, raf: 0, started: false, running: false };
      wins.push(w);
      syncWinControls(w);
      measureWinGeom(w);
      setWinT(w, 0);
      focusWin(w);

      if (!wide.matches) {
        root.classList.add('sheet-open');
        lenis?.stop();
      }

      $('[data-win-close]', el).addEventListener('click', (e) => { e.stopPropagation(); closeWin(w); });
      $('[data-win-mode="window"]', el).addEventListener('click', (e) => { e.stopPropagation(); toggleWinMax(w); });
      $('[data-win-mode="theater"]', el).addEventListener('click', (e) => { e.stopPropagation(); toggleWinTheater(w); });
      $('[data-win-fs]', el).addEventListener('click', (e) => {
        e.stopPropagation();
        if (w.theater) toggleWinTheater(w, false);
        else toggleWinMax(w);
      });
      el.addEventListener('pointerdown', () => focusWin(w));

      // Title-bar double-click toggles full-screen/windowed on wide screens; drag moves windowed windows; swipe-down closes on phones
      const bar = $('.win-bar', el);
      bar.addEventListener('dblclick', (e) => {
        if (e.target.closest('button, a') || !wide.matches) return;
        toggleWinMax(w);
      });
      let dragState = null;
      bar.addEventListener('pointerdown', (e) => {
        if (e.button > 0 || e.target.closest('button, a')) return;
        focusWin(w);
        if (wide.matches && (w.maximized || w.theater)) return;
        dragState = { id: e.pointerId, sx: e.clientX, sy: e.clientY, origL: w.box.left, origT: w.box.top };
        bar.setPointerCapture(e.pointerId);
      });
      bar.addEventListener('pointermove', (e) => {
        if (!dragState || e.pointerId !== dragState.id) return;
        const dx = e.clientX - dragState.sx, dy = e.clientY - dragState.sy;
        if (!wide.matches) {
          if (dy > 0) el.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
          return;
        }
        const hostW = dtWins.clientWidth, hostH = dtWins.clientHeight;
        w.box.left = clamp(dragState.origL + dx, -w.box.width * 0.4, hostW - w.box.width * 0.6);
        w.box.top = clamp(dragState.origT + dy, 0, hostH - 36);
        el.style.left = `${Math.round(w.box.left)}px`;
        el.style.top = `${Math.round(w.box.top)}px`;
      });
      const endBarDrag = (e) => {
        if (!dragState || e.pointerId !== dragState.id) return;
        const dy = e.clientY - dragState.sy;
        dragState = null;
        if (!wide.matches) {
          if (dy > 90) closeWin(w);
          else el.style.transform = 'none';
        }
      };
      bar.addEventListener('pointerup', endBarDrag);
      bar.addEventListener('pointercancel', endBarDrag);

      return w;
    }

    function openWin(key, fromEl) {
      const w = createWin(key, fromEl);
      fromEl?.classList.add('is-opened');
      animateWinT(w, 1, () => {
        $('[data-win-close]', w.el)?.focus({ preventScroll: true });
      });
    }

    function closeWin(w, immediate = false) {
      const idx = wins.indexOf(w);
      if (idx < 0) return;
      wins.splice(idx, 1);
      if (w.theater) {
        w.theater = false;
        w.el.classList.remove('is-theater');
        if (w.el.parentElement !== dtWins) dtWins.append(w.el);
      }
      if (w.player) { w.player.pause(); w.running = false; }
      const finish = () => {
        w.el.remove();
        if (!wins.length) {
          if (dtFront) dtFront.textContent = 'Finder';
          if (!wide.matches && !curPk) { root.classList.remove('sheet-open'); lenis?.start(); }
        } else {
          focusWin(wins[wins.length - 1]);
        }
        syncPlayers();
        if (!immediate) w.fromEl?.focus({ preventScroll: true });
      };
      if (immediate) { cancelAnimationFrame(w.raf); finish(); }
      else animateWinT(w, 0, finish);
    }

    function closeAllWins(immediate = false) {
      [...wins].forEach((w) => closeWin(w, immediate));
    }

    // Desktop apps: click opens
    $$('.dt-app', desktop).forEach((btn) => {
      btn.addEventListener('click', () => {
        const launching = !wins.some((x) => x.key === btn.dataset.open);
        if (launching && !reduce && wide.matches) {
          btn.classList.remove('is-launching');
          void btn.offsetWidth;
          btn.classList.add('is-launching');
          setTimeout(() => { btn.classList.remove('is-launching'); openWin(btn.dataset.open, btn); }, 520);
        } else openWin(btn.dataset.open, btn);
      });
    });

    // Files: click, Enter, or slide/drag to open (§6 & §8)
    $$('[data-slide-file]', desktop).forEach((btn) => {
      let slide = null;
      btn.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        slide = { id: e.pointerId, sx: e.clientX, sy: e.clientY, win: null, dragging: false };
        btn.setPointerCapture(e.pointerId);
      });
      btn.addEventListener('pointermove', (e) => {
        if (!slide || e.pointerId !== slide.id) return;
        const dx = e.clientX - slide.sx, dy = e.clientY - slide.sy;
        const dist = wide.matches ? Math.hypot(dx, dy) : Math.max(0, -dy);
        if (!slide.dragging && dist > 6) {
          slide.dragging = true;
          slide.win = createWin(btn.dataset.open, btn);
        }
        if (!slide.dragging || !slide.win) return;
        const threshold = wide.matches ? 200 : innerHeight * 0.35;
        const t = clamp(dist / threshold);
        setWinT(slide.win, t, { x: dx * 0.35, y: dy * 0.35 });
      });
      const endSlide = (e) => {
        if (!slide || e.pointerId !== slide.id) return;
        const s = slide;
        slide = null;
        if (!s.dragging) return; // plain click handler will run
        if (s.win.t > 0.4) {
          btn.classList.add('is-opened');
          animateWinT(s.win, 1, () => $('[data-win-close]', s.win.el)?.focus({ preventScroll: true }));
        } else {
          closeWin(s.win);
        }
      };
      btn.addEventListener('pointerup', endSlide);
      btn.addEventListener('pointercancel', endSlide);
      btn.addEventListener('click', () => {
        const existing = wins.find((x) => x.key === btn.dataset.open);
        if (existing && existing.t > 0.1) return;
        openWin(btn.dataset.open, btn);
      });
    });

    /* ---------- Phone: my work as Instagram (stories, a feed of metric cards, search, results, profile) ----------
       Every product is one post and one story segment. A post is its numbers, set as a card, with Watch; stories
       play the same recordings and recreations as the laptop, through makePlayer + titled. */

    const ig = $('[data-ig]', pocket);
    const igViews = $('[data-ig-views]', ig);
    const igTitle = $('[data-ig-title]', ig);
    const story = $('[data-story]', ig);
    const stBars = $('[data-story-bars]', story);
    const stAv = $('[data-story-av]', story), stUser = $('[data-story-user]', story), stSub = $('[data-story-sub]', story);
    const stMedia = $('[data-story-media]', story), stCard = $('[data-story-card]', story);
    const stIntro = $('[data-story-intro]', story), stNote = $('[data-story-note]', story);
    const sheet = $('[data-ig-sheet]', ig);
    stIntro.innerHTML = INTRO_HTML;

    // a logo either fills its circle, or (a mark drawn to its edges) sits inside it with room around it
    const mark = (src, inset) => `<img src="assets/brand/${src}" alt="" width="40" height="40"${inset ? ' class="is-mark"' : ''}>`;
    const STORIES = [
      { label: 'Pixis', av: mark('pixis-mark.svg'), when: '2020–25', keys: ['ads', 'pixis'] },
      { label: 'BorderPlus', av: mark('borderplus-mark.png'), when: '2026', keys: ['carepilot', 'ask', 'learn', 'mis', 'pathways'] },
      { label: 'Zenea', av: mark('zenea-wordmark.png', true), when: '2026', keys: ['zenea-caregiver', 'zenea-parent'] },
      { label: 'Personal', av: '<span>S</span>', me: true, when: '2026', keys: ['money-plan', 'trade', 'eatouts'] },
      { label: 'Church', av: mark('gbf-icon.png'), when: '2026', keys: ['gbf'] },
      { label: 'Say hi', av: '<span>Hi</span>', me: true, when: 'Oct 2026', keys: ['kit', 'hi'] },
    ];
    const FEED = ['ads', 'pixis', 'mis', 'carepilot', 'ask', 'learn', 'pathways', 'zenea-caregiver', 'zenea-parent', 'trade', 'eatouts', 'money-plan', 'gbf'];
    const TINT = { borderplus: '#E4EEE8', pixis: '#E9E6F6', personal: '#F7E9E1', ai: '#F3ECDA' };
    const where = (key) => STORIES.findIndex((st) => st.keys.includes(key));
    // A story's cards: a playable product gets its summary, then its demo as the next card; the rest are one card.
    const segs = (i) => STORIES[i].keys.flatMap((k) => (playable(notesByKey[k]) ? [{ key: k, part: 'sum' }, { key: k, part: 'demo' }] : [{ key: k, part: 'card' }]));
    const segAt = (i, key) => Math.max(0, segs(i).findIndex((g) => g.key === key));
    const product = (note) => (note.dataset.title || '').split('·')[0].trim();
    const txt = (note, sel) => $(sel, note)?.textContent.trim().replace(/\s+/g, ' ') || '';
    const playable = (note) => !!(note.dataset.video || note.dataset.html);
    const metrics = (note) => (note.dataset.facts || '').split('|').filter(Boolean).map((f) => f.split(': ')).slice(0, 2);
    const playIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';

    // A post's square: its numbers, set as a card. Big for the feed; the grids reuse it, smaller.
    function card(key) {
      const note = notesByKey[key];
      const m = metrics(note);
      return `<span class="ig-card" style="--w:${TINT[note.dataset.chapter] || TINT.borderplus}">
        <span class="ig-card-k">${txt(note, '.note-kick')}</span>
        <span class="ig-card-t">${txt(note, '.note-title')}</span>
        <span class="ig-card-big">${txt(note, '.note-stat')}</span>
        <span class="ig-card-l">${txt(note, '.note-lab')}</span>
        ${m.length ? `<span class="ig-card-m">${m.map(([l, v]) => `<span><b>${v}</b>${l}</span>`).join('')}</span>` : ''}
        <span class="ig-watch">${playIcon}${playable(note) ? 'Watch' : 'View'}</span>
      </span>`;
    }

    // Stories tray, and the same rings as profile highlights
    const rings = STORIES.map((st, i) =>
      `<li><button class="ig-ring" type="button" data-story-open="${i}"><span class="ig-av${st.me ? ' ig-av--me' : ''}">${st.av}</span><span class="ig-ring-l">${st.label}</span></button></li>`).join('');
    $('[data-ig-stories]', ig).innerHTML = rings;
    $('[data-ig-highlights]', ig).innerHTML = rings;

    // Feed
    const icon = {
      heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3S3.6 15.2 3.6 9.1A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8.4 2.1c0 6.1-8.4 11.2-8.4 11.2z"/></svg>',
      chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.5-4.4a8.4 8.4 0 1 1 15.5-4.5z"/></svg>',
      send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3.5 3.5 10.3l6.6 2.6L21 3.5zM10.1 12.9l2.6 7.6L21 3.5"/></svg>',
      save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 20.5 12 15.6l-6.5 4.9V4.3a.8.8 0 0 1 .8-.8h11.4a.8.8 0 0 1 .8.8z"/></svg>',
    };
    $('[data-ig-feed]', ig).innerHTML = FEED.map((key) => {
      const note = notesByKey[key];
      const st = STORIES[where(key)];
      const tags = (note.dataset.tags || '').split('|').filter(Boolean);
      return `<article class="ig-post" data-post="${key}">
        <header class="ig-ph"><span class="ig-av ig-av--me"><span>S</span></span><span class="ig-ph-who"><b>sujithbenhur</b><span>${txt(note, '.note-kick')}</span></span><span class="ig-ph-time">${st.when}</span></header>
        <button class="ig-pm" type="button" data-post-media="${key}" aria-label="${playable(note) ? 'Watch' : 'View'} ${product(note)}">${card(key)}<span class="ig-burst" aria-hidden="true">${icon.heart}</span></button>
        <div class="ig-pb">
          <div class="ig-acts"><button class="ig-act" type="button" data-like aria-label="Like">${icon.heart}</button><button class="ig-act" type="button" data-post-media="${key}" aria-label="Watch">${icon.chat}</button><button class="ig-act" type="button" data-ig-hi aria-label="Say hi">${icon.send}</button><span class="ig-act ig-act--save" aria-hidden="true">${icon.save}</span></div>
          ${tags.length ? `<p class="ig-cap"><b>sujithbenhur</b> Built with ${tags.join(', ')}.</p>` : ''}
          ${note.dataset.honest ? `<p class="ig-honest">${note.dataset.honest}</p>` : ''}
        </div>
      </article>`;
    }).join('');

    // Search and profile grids
    $$('[data-ig-grid]', ig).forEach((g) => {
      g.innerHTML = FEED.map((key) => `<button class="ig-cell" type="button" data-post-media="${key}" aria-label="${product(notesByKey[key])}">${card(key)}</button>`).join('');
    });

    // Results: each headline number and fact, one line each
    $('[data-ig-news]', ig).innerHTML = FEED.flatMap((key) => {
      const note = notesByKey[key];
      const st = STORIES[where(key)];
      const row = (html) => `<li><span class="ig-av${st.me ? ' ig-av--me' : ''}">${st.av}</span><p>${html}</p><button class="ig-news-th" type="button" data-post-media="${key}" aria-label="${playable(note) ? 'Watch' : 'View'} ${product(note)}">${playIcon}</button></li>`;
      return [row(`<b>${product(note)}</b> <b>${txt(note, '.note-stat')}</b> ${txt(note, '.note-lab')}`),
        ...metrics(note).map(([l, v]) => row(`<b>${product(note)}</b> ${l}: <b>${v}</b>`))];
    }).join('');

    $('[data-ig-stats]', ig).innerHTML = [[FEED.length, 'posts'], ['5,900+', 'nurses'], ['300+', 'brands']]
      .map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join('');

    // Tabs: Reels plays every story from the start
    const TITLES = { search: 'Search', activity: 'Results', profile: 'sujithbenhur' };
    function setTab(name) {
      if (name === 'reels') { openStory(0, 0, $('[data-tab="reels"]', ig)); return; }
      const view = $(`.ig-view[data-view="${name}"]`, ig);
      if (view.classList.contains('is-on')) { igViews.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }
      $$('.ig-view', ig).forEach((v) => v.classList.toggle('is-on', v === view));
      $$('.ig-tab', ig).forEach((t) => t.classList.toggle('is-on', t.dataset.tab === name));
      igTitle.innerHTML = TITLES[name] ? `<span class="ig-title-t">${TITLES[name]}</span>` : '<span class="ig-logo">Instagram</span>';
      igViews.scrollTop = 0;
      if (!reduce) { view.classList.remove('is-in'); void view.offsetWidth; view.classList.add('is-in'); }
    }
    $$('[data-tab]', ig).forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));

    function openSheet() {
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add('is-on'));
      $('.ig-sbtn', sheet)?.focus({ preventScroll: true });
    }
    function closeSheet() {
      if (sheet.hidden) return;
      sheet.classList.remove('is-on');
      setTimeout(() => { sheet.hidden = true; }, reduce ? 0 : 300);
    }
    $('[data-sheet-close]', sheet).addEventListener('click', closeSheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

    // A post: one tap opens its story, a double tap likes it
    let tapTimer = 0, tapKey = null;
    function like(post) {
      if (!post) return;
      post.classList.add('is-liked');
      const burst = $('.ig-burst', post);
      burst.classList.remove('on');
      void burst.offsetWidth;
      burst.classList.add('on');
    }
    ig.addEventListener('click', (e) => {
      if (e.target.closest('[data-ig-hi]')) { openSheet(); return; }
      const ring = e.target.closest('[data-story-open]');
      if (ring) { openStory(+ring.dataset.storyOpen, 0, ring); return; }
      const likeBtn = e.target.closest('[data-like]');
      if (likeBtn) { const post = likeBtn.closest('.ig-post'); post.classList.contains('is-liked') ? post.classList.remove('is-liked') : like(post); return; }
      const m = e.target.closest('[data-post-media]');
      if (!m) return;
      const key = m.dataset.postMedia;
      const post = m.classList.contains('ig-pm') ? m.closest('.ig-post') : null;
      if (post && tapKey === key) { clearTimeout(tapTimer); tapKey = null; like(post); return; }
      const go = () => { tapKey = null; const si = where(key); openStory(si, segAt(si, key), m); };
      if (!post) { go(); return; }
      tapKey = key;
      tapTimer = setTimeout(go, 260);
    });

    /* Story viewer */
    let stI = 0, stSeg = 0, barRaf = 0, held = false, holdTimer = 0, stFrom = null;
    const still = (ms) => {
      const c = clock({ duration: ms, steps: [], reset() {}, still() {} });
      return { el: null, get elapsed() { return c.elapsed; }, get duration() { return ms; }, start: (onEnd) => c.start(onEnd), resume: () => c.resume(), pause: () => c.pause(), still() {} };
    };

    function tickBars() {
      cancelAnimationFrame(barRaf);
      if (story.hidden) return;
      const p = curPk?.player;
      const fill = p && p.duration ? clamp(p.elapsed / p.duration) : 0;
      $$('i', stBars).forEach((b, i) => b.style.setProperty('--p', i < stSeg ? 1 : i === stSeg ? fill.toFixed(4) : 0));
      barRaf = requestAnimationFrame(tickBars);
    }

    function showSeg() {
      const st = STORIES[stI];
      const sg = segs(stI)[stSeg];
      const key = sg.key;
      const note = notesByKey[key];
      if (curPk?.player) curPk.player.pause();
      stVideoReset();
      stAv.innerHTML = st.av;
      stAv.classList.toggle('ig-av--me', !!st.me);
      stUser.textContent = st.label;
      stSub.textContent = `${product(note)} · ${st.when}`;
      $$('.dv-video, .dv-html, .card, .igs-card', stMedia).forEach((el) => { el.hidden = true; el.classList.remove('is-on'); });
      stIntro.classList.remove('on');
      let player;
      if (sg.part === 'sum') {
        fillIntro(note, stIntro);
        stIntro.classList.add('on');
        player = still(6000);
      } else if (sg.part === 'demo') {
        player = makePlayer(note, stMedia, true);
      } else if (key === 'mis') {
        const cardEl = $('.card[data-card="mis"]', stMedia);
        cardEl.hidden = false;
        void cardEl.offsetWidth;
        cardEl.classList.add('is-on');
        player = still(7000);
      } else {
        stCard.innerHTML = '';
        stCard.append(tpls[key].content.cloneNode(true));
        if (key === 'hi') greetTxt(stCard);
        stCard.hidden = false;
        stCard.scrollTop = 0;
        player = still(key === 'hi' ? 6000 : 9000);
      }
      stNote.textContent = note.dataset.honest || '';
      story.classList.toggle('is-card', sg.part === 'card');
      story.classList.toggle('is-wide', 'wide' in note.dataset && !note.dataset.mVideo);
      curPk = { key, note: sg.part === 'demo' ? note : null, player, started: false, running: false };
      $('.ig-ring', $$('[data-ig-stories] li', ig)[stI])?.classList.add('is-seen');
      syncPlayers();
      tickBars();
    }
    function stVideoReset() {
      const v = $('video', stMedia);
      if (v) v.pause();
    }

    function openStory(i, seg = 0, fromEl = null) {
      if (!STORIES[i]) return;
      closeSheet();
      stI = i;
      stSeg = Math.max(0, seg);
      if (fromEl) {
        stFrom = fromEl;
        // grow the story out of whatever was tapped
        const ir = ig.getBoundingClientRect(), fr = fromEl.getBoundingClientRect();
        if (ir.width) {
          story.style.setProperty('--ox', `${(((fr.left + fr.width / 2) - ir.left) / ir.width * 100).toFixed(1)}%`);
          story.style.setProperty('--oy', `${(((fr.top + fr.height / 2) - ir.top) / ir.height * 100).toFixed(1)}%`);
        }
      }
      stBars.innerHTML = segs(i).map(() => '<i></i>').join('');
      const wasHidden = story.hidden;
      story.hidden = false;
      desk.classList.add('has-story');
      pkScreen.classList.add('band-dark');
      if (wasHidden && !reduce) {
        story.classList.add('is-opening');
        requestAnimationFrame(() => requestAnimationFrame(() => story.classList.remove('is-opening')));
      }
      if (!wide.matches) { root.classList.add('sheet-open'); lenis?.stop(); }
      showSeg();
      $('.igs-close', story)?.focus({ preventScroll: true });
    }

    function storyStep(dir) {
      if (story.hidden) return;
      const count = segs(stI).length;
      if (stSeg + dir >= 0 && stSeg + dir < count) { stSeg += dir; showSeg(); return; }
      const next = stI + dir;
      if (next < 0) { stSeg = 0; showSeg(); return; }
      if (next >= STORIES.length) { closeStory(); return; }
      openStory(next, dir < 0 ? segs(next).length - 1 : 0);
    }

    function closeStory(immediate = false) {
      if (story.hidden) return;
      if (curPk?.player) curPk.player.pause();
      stVideoReset();
      curPk = null;
      cancelAnimationFrame(barRaf);
      stIntro.classList.remove('on');
      story.hidden = true;
      story.classList.remove('is-held');
      desk.classList.remove('has-story');
      pkScreen.classList.remove('band-dark');
      if (!wide.matches && !wins.length) { root.classList.remove('sheet-open'); lenis?.start(); }
      syncPlayers();
      if (!immediate) stFrom?.focus({ preventScroll: true });
    }

    $('[data-story-close]', story).addEventListener('click', () => closeStory());
    // Tap the left third for back, the rest for next; hold to pause; swipe down to close.
    let stTouch = null;
    story.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('.igs-close, .igs-card a')) return;
      stTouch = { id: e.pointerId, sx: e.clientX, sy: e.clientY };
      held = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        held = true;
        story.classList.add('is-held');
        curPk?.player?.pause();
      }, 240);
    });
    const endTouch = (e) => {
      clearTimeout(holdTimer);
      if (!stTouch || e.pointerId !== stTouch.id) return;
      const dx = e.clientX - stTouch.sx, dy = e.clientY - stTouch.sy;
      stTouch = null;
      if (held) {
        story.classList.remove('is-held');
        if (curPk?.running) curPk.player.resume();
      }
      if (dy > 80 && Math.abs(dy) > Math.abs(dx) && !(stCard.scrollTop > 0)) { held = true; closeStory(); }
      else if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) { held = true; storyStep(dx < 0 ? 1 : -1); }
    };
    story.addEventListener('pointerup', endTouch);
    story.addEventListener('pointercancel', endTouch);
    $('[data-story-prev]', story).addEventListener('click', () => { if (!held) storyStep(-1); held = false; });
    $('[data-story-next]', story).addEventListener('click', () => { if (!held) storyStep(1); held = false; });

    // Keyboard controls: Esc closes the story, sheet or front window; arrows step through stories
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!story.hidden) { e.preventDefault(); closeStory(); }
        else if (!sheet.hidden) { e.preventDefault(); closeSheet(); }
        else if (wins.length) {
          e.preventDefault();
          const front = wins[wins.length - 1];
          if (front.theater) toggleWinTheater(front, false);
          else closeWin(front);
        }
      } else if (!story.hidden && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        storyStep(e.key === 'ArrowRight' ? 1 : -1);
      }
    });

    document.addEventListener('visibilitychange', syncPlayers);
    wide.addEventListener('change', () => { syncBreakpoint(); measure(); });
    addEventListener('resize', () => {
      measure();
      wins.forEach((w) => { measureWinGeom(w); setWinT(w, w.t); });
    });

    syncBreakpoint();
    measure();
  }
  $$('[data-desk]').forEach(setupDesk);

  syncTheme();
  onScroll();
})();
