/* Sujith Benhur — site behaviour. No framework. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const MEDIA = 'assets/media/demos/';
  const SVG = 'http://www.w3.org/2000/svg';
  const wide = matchMedia('(min-width: 901px)');

  /* ---------- Theme ---------- */
  const themeBtn = $('[data-theme-toggle]');
  const theme = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  // cards are paper, so the phone's status bar follows the theme there
  const syncCards = () => $$('.card:not([hidden])').forEach((c) => c.parentElement.classList.toggle('band-dark', theme() === 'dark'));
  const syncTheme = () => { if (themeBtn) themeBtn.textContent = theme() === 'dark' ? 'Switch to light' : 'Switch to dark'; syncCards(); };
  themeBtn?.addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked: theme lasts this visit */ }
    syncTheme();
  });

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
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
    const reading = innerHeight * 0.45;
    // Read every position first, then write, so the page lays out once per frame.
    const states = pins.map(({ ch, head, subs }) => {
      const box = ch.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) return null;
      const end = head.getBoundingClientRect().bottom;
      let text = '', top = -Infinity;
      subs.forEach((s) => {
        const t = s.getBoundingClientRect().top;
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
  function fit(container, baseWidth) {
    const set = () => container.style.setProperty('--s', container.clientWidth / baseWidth);
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
      if (v.hidden || v.paused || v.readyState < 2 || !v.videoWidth) return;
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
      fit(container, base);
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

  /* ---------- Showcase: a list of apps beside one device that plays them in turn ---------- */
  function setupShowcase(sc) {
    const items = $$('.sc-item', sc);
    const stage = $('.sc-stage', sc);
    if (!items.length || !stage) return;
    const devices = Object.fromEntries($$('[data-device]', stage).map((d) => [d.dataset.device, d]));
    const detail = $('[data-detail]', sc);
    const built = {};
    let idx = -1, visible = false, raf = 0, active = null;

    // Lists advance on wide screens; on phones the chosen demo loops until another is tapped.
    const autoAdvance = () => wide.matches;
    const bar = (i, p) => $('.sc-bar i', items[i])?.style.setProperty('--p', p);
    const usable = (i) => !items[i].classList.contains('is-missing');
    const nextIndex = () => {
      for (let k = 1; k <= items.length; k++) { const j = (idx + k) % items.length; if (usable(j)) return j; }
      return -1;
    };

    function stop() {
      cancelAnimationFrame(raf);
      if (active?.video) active.video.pause();
      if (active?.demo) active.demo.pause();
    }

    function play() {
      if (!active || !visible) return;
      cancelAnimationFrame(raf);
      if (active.video) {
        if (reduce) return;
        active.video.play().catch(() => {});
        const tick = () => {
          const v = active?.video;
          if (!v) return;
          if (v.duration) bar(idx, clamp(v.currentTime / v.duration));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } else if (active.demo) {
        const d = active.demo;
        if (reduce) return d.still();
        d.start(() => { if (autoAdvance()) advance(); else play(); });
        const tick = () => { bar(idx, clamp(d.elapsed / d.duration)); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      }
    }

    function advance() {
      const j = nextIndex();
      if (j < 0) return;
      if (j !== idx) activate(j);
      else { if (active?.video) active.video.currentTime = 0; play(); }
    }

    function activate(i) {
      stop();
      if (idx >= 0) bar(idx, 0);
      idx = i;
      const item = items[i];
      items.forEach((it, k) => {
        it.classList.toggle('is-active', k === i);
        $('.sc-btn', it)?.setAttribute('aria-pressed', String(k === i));
      });
      const device = devices[item.dataset.frame || 'phone'];
      Object.values(devices).forEach((d) => d.classList.toggle('is-on', d === device));
      const label = item.dataset.title || $('.sc-name', item)?.textContent || '';
      const t = $('[data-title]', device);
      if (t) t.textContent = label;
      if (detail) detail.innerHTML = $('.sc-detail p', item)?.innerHTML || '';

      const video = $('.dv-video', device);
      $$('.dv-html', device).forEach((h) => { h.hidden = h.dataset.html !== item.dataset.html; });
      if (item.dataset.video) {
        const src = MEDIA + item.dataset.video;
        video.onended = () => advance();
        video.onerror = () => { item.classList.add('is-missing'); if (idx === i) advance(); };
        if (video.dataset.src !== src) {
          video.dataset.src = src;
          video.poster = `${src}.jpg`;
          video.src = `${src}.mp4`;
        } else {
          try { video.currentTime = 0; } catch (e) { /* metadata not loaded yet */ }
        }
        video.hidden = false;
        video.loop = !autoAdvance();
        active = { video };
      } else {
        if (video) { video.pause(); video.hidden = true; }
        const key = item.dataset.html;
        built[key] = built[key] || clock(htmlDemos[key]($(`.dv-html[data-html="${key}"]`, device)));
        active = { demo: built[key] };
      }
      play();
    }

    items.forEach((it, i) => $('.sc-btn', it)?.addEventListener('click', () => {
      if (i !== idx) return activate(i);
      stop();
      if (active?.video) active.video.currentTime = 0;
      play();
    }));
    stage.addEventListener('click', () => {
      if (!reduce || !active?.video) return;
      active.video.paused ? active.video.play().catch(() => {}) : active.video.pause();
    });
    wide.addEventListener('change', () => { if (active?.video) active.video.loop = !autoAdvance(); });

    onVisible(sc, () => {
      visible = true;
      if (idx < 0) activate(0); else play();
    }, () => { visible = false; stop(); }, 0.3);
  }
  $$('[data-showcase]').forEach(setupShowcase);

  /* ---------- Slides: one product per slide, each with its own phone ---------- */
  function setupSlides(el) {
    const tabs = $$('.slides-tab', el);
    const slides = $$('.slide', el);
    const track = $('.slides-track', el);
    let idx = 0, visible = false, started = false, raf = 0;
    const videoOf = (i) => $('video', slides[i]);
    const bar = (i, p) => $('.sc-bar i', tabs[i])?.style.setProperty('--p', p);

    function stop() {
      cancelAnimationFrame(raf);
      slides.forEach((s, i) => videoOf(i)?.pause());
    }
    function load(i) {
      const v = videoOf(i);
      if (!v || v.dataset.src) return;
      const src = MEDIA + slides[i].dataset.video;
      v.dataset.src = src;
      v.poster = `${src}.jpg`;
      v.src = `${src}.mp4`;
    }
    function play() {
      if (!visible || reduce) return;
      const v = videoOf(idx);
      if (!v) return;
      v.loop = !wide.matches;
      v.play().catch(() => {});
      cancelAnimationFrame(raf);
      const tick = () => { if (v.duration) bar(idx, clamp(v.currentTime / v.duration)); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    function go(i) {
      stop();
      bar(idx, 0);
      idx = (i + slides.length) % slides.length;
      track.style.transform = `translateX(${-idx * 100}%)`;
      tabs.forEach((t, k) => t.setAttribute('aria-selected', String(k === idx)));
      slides.forEach((s, k) => { s.inert = k !== idx; });
      load(idx);
      load((idx + 1) % slides.length);
      const v = videoOf(idx);
      if (v) {
        try { v.currentTime = 0; } catch (e) { /* not loaded yet */ }
        v.onended = () => go(idx + 1);
      }
      el.dataset.sub = $('.sc-name', tabs[idx])?.textContent || '';
      syncPins();
      play();
    }
    tabs.forEach((t, i) => t.addEventListener('click', () => { started = true; go(i); }));
    el.goTo = (i) => { started = true; go(i); };   // "Read the notes" from a story lands on its slide

    // Swipe between slides on touch screens.
    let x0 = null;
    const vp = $('.slides-viewport', el);
    vp.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') x0 = e.clientX; });
    vp.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 50) { started = true; go(idx + (dx < 0 ? 1 : -1)); }
    });

    onVisible(el, () => {
      visible = true;
      if (!started) { started = true; go(0); } else play();
    }, () => { visible = false; stop(); }, 0.3);
  }
  $$('[data-slides]').forEach(setupSlides);

  /* ---------- MIS: rounded running totals from the weekly MIS, March to September 2026 ---------- */
  const misStart = new Date(2026, 2, 2);
  const weeks = Array.from({ length: 31 }, (_, i) => new Date(misStart.getTime() + i * 7 * 864e5));
  const series = {
    nurses: [100, 210, 340, 440, 520, 600, 730, 850, 1060, 1380, 1810, 2080, 2300, 2680, 2920, 3170, 3400, 3540, 3730, 3860, 4060, 4160, 4390, 4510, 4630, 4730, 4830, 4950, 5190, 5310, 5450],
    ask: [0, 0, 0, 0, 0, 0, 10, 280, 720, 1240, 1960, 2870, 3780, 4590, 5330, 6330, 7200, 7780, 8580, 9230, 10210, 10650, 11140, 11680, 11990, 12380, 12730, 13050, 13660, 14210, 14820],
    learn: [2320, 2840, 3380, 4240, 5410, 6950, 9140, 10820, 12810, 14840, 17320, 20050, 22980, 27430, 31350, 34980, 37920, 40180, 41770, 42860, 43930, 44610, 45690, 47400, 48910, 50390, 52010, 53050, 54290, 55340, 56260],
  };
  const num = (n) => n.toLocaleString('en-IN');
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
      .map(([d, i]) => `<tr><td>${d.toLocaleDateString('en-GB', { month: 'long' })}</td><td>${num(series.nurses[i])}</td><td>${num(series.ask[i])}</td><td>${num(series.learn[i])}</td></tr>`)
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

  /* ---------- Landing: my highlights, as stories ----------
     Each .note is one story screen: its words, and what plays on the device (a recording, a recreated demo, or a
     card). On phones the profile is screen zero and the whole first screen is the story: tap the right side for
     next, the left for back, hold to pause, swipe sideways to change chapter, scroll to leave. On wide screens the
     profile stays beside the device, the stories start by themselves, and the device takes the clicks. */
  function setupStories(land) {
    const notes = $$('.note', land);
    const stage = $('.stage', land);
    const devices = Object.fromEntries($$('[data-device]', stage).map((d) => [d.dataset.device, d]));
    const segs = $('.st-segs', land), chapterLabel = $('.st-chapter', land);
    const countEl = $('.nn-count', land), more = $('.nn-more', land);
    const mk = $('.mk', land), mkText = $('.mk span', land);
    const rings = $$('.ring', land);
    const ringName = Object.fromEntries(rings.map((r) => [r.dataset.go, $('.ring-name', r).textContent]));
    const order = [...new Set(notes.map((n) => n.dataset.chapter))];
    const layers = new Map();
    const seen = new Set();
    let idx = null, cur = null, raf = 0, visible = false, held = false, ended = false, segChapter = null;
    let marks = [], markIdx = -1;

    $$('.card', land).forEach((c) => fit(c, 390));
    $$('.mk-arrow path', land).forEach((p) => p.setAttribute('pathLength', '1'));

    const chapterOf = (i) => notes[i].dataset.chapter;
    const inChapter = (ch) => notes.reduce((a, n, k) => (n.dataset.chapter === ch ? [...a, k] : a), []);
    const first = () => (wide.matches ? 0 : -1);

    // What a screen plays, and in which frame: phones can swap a browser demo for a phone-sized one.
    const spec = (n) => {
      const m = !wide.matches && n.dataset.mFrame;
      return {
        frame: (m ? n.dataset.mFrame : n.dataset.frame) || 'phone',
        video: m ? n.dataset.mVideo : n.dataset.video,
        html: m ? n.dataset.mHtml : n.dataset.html,
        card: n.dataset.card,
      };
    };

    // One layer per screen inside its device, built on first use and kept.
    function layerFor(n) {
      const s = spec(n);
      const key = `${s.frame}:${s.video || s.html || s.card}`;
      if (layers.has(key)) return layers.get(key);
      const device = devices[s.frame];
      let L;
      if (s.video) {
        const v = document.createElement('video');
        v.className = 'dv-video';
        v.muted = true; v.playsInline = true; v.preload = 'none'; v.hidden = true;
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        $('.device-screen', device).prepend(v);
        L = {
          el: v, src: MEDIA + s.video,
          get elapsed() { return v.currentTime * 1000; },
          get duration() { return (v.duration || 12) * 1000; },
          start(onEnd) { v.onended = onEnd; try { v.currentTime = 0; } catch (e) { /* not loaded yet */ } v.play().catch(() => {}); },
          resume() { v.play().catch(() => {}); },
          pause() { v.pause(); },
          still() { /* the poster stands in */ },
        };
      } else if (s.html) {
        const el = $(`.dv-html[data-html="${s.html}"]`, device);
        L = clock(htmlDemos[s.html](el));
        L.el = el;
      } else {
        const el = $(`.card[data-card="${s.card}"]`, device);
        L = clock({
          duration: +n.dataset.dwell || 8000, steps: [],
          reset() { el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on'); },
          still() { el.classList.add('is-on'); },
        });
        L.el = el;
        L.card = true;
      }
      L.device = device;
      layers.set(key, L);
      return L;
    }
    const load = (L) => { if (L.src && !L.el.getAttribute('src')) { L.el.poster = `${L.src}.jpg`; L.el.src = `${L.src}.mp4`; } };

    function go(i) {
      if (cur) {
        cur.pause();
        cur.running = false;
        cur.el.hidden = true;
        if (cur.card) cur.el.classList.remove('is-on');
      }
      cancelAnimationFrame(raf);
      idx = i;
      ended = false;
      land.classList.toggle('on-cover', i < 0);
      if (i >= 0) land.dataset.ch = chapterOf(i);   // each chapter has its own colour wash
      notes.forEach((n, k) => n.classList.toggle('is-on', k === i));
      if (i < 0) { cur = null; paint(); sync(); return; }

      const n = notes[i];
      const L = layerFor(n);
      cur = L;
      L.started = false;
      L.running = false;
      Object.values(devices).forEach((d) => d.classList.toggle('is-on', d === L.device));
      land.classList.toggle('is-browser', L.device === devices.browser);
      land.classList.toggle('is-card', !!L.card);
      const title = $('[data-title]', L.device);
      if (title) title.textContent = n.dataset.title || '';
      $$('.dv-video, .dv-html, .card', L.device).forEach((el) => { el.hidden = el !== L.el; });
      if (L.card) syncCards();
      load(L);
      const nx = notes[i + 1];
      if (nx) { const N = layerFor(nx); if (N.src) { N.el.preload = 'metadata'; load(N); } }

      // a phone-width recording keeps its own timings
      const phoneCut = !wide.matches && !!n.dataset.mVideo;
      marks = $$('.note-marks li', n).map((li) => ({ at: +(phoneCut && li.dataset.mAt ? li.dataset.mAt : li.dataset.at), y: +li.dataset.y || 50, text: li.textContent }));
      markIdx = -1;
      mk.classList.remove('on');
      more.setAttribute('href', n.dataset.more || '#work');
      more.dataset.slide = n.dataset.slide || '';
      seen.add(chapterOf(i));
      paint();
      sync();
    }

    const want = () => visible && !held && !ended && !document.hidden && !reduce;
    function sync() {
      cancelAnimationFrame(raf);
      if (!cur) { land.classList.add('is-paused'); return; }
      if (reduce && !cur.started) { cur.started = true; cur.still(); }
      const run = want();
      if (run && !cur.running) {
        cur.running = true;
        if (cur.started) cur.resume();
        else { cur.started = true; cur.start(next); }
      } else if (!run && cur.running) {
        cur.running = false;
        cur.pause();
      }
      land.classList.toggle('is-paused', !cur.running);
      draw();
      if (cur.running) raf = requestAnimationFrame(tick);
    }
    function tick() { draw(); if (cur?.running) raf = requestAnimationFrame(tick); }

    // The current segment fills with time; the latest pen note for this moment shows beside the screen.
    function draw() {
      if (!cur) return;
      const t = cur.elapsed;
      const seg = $$('b', segs)[inChapter(chapterOf(idx)).indexOf(idx)];
      if (seg) seg.style.width = `${clamp(t / cur.duration) * 100}%`;
      let m = -1;
      marks.forEach((x, k) => { if (t >= x.at * 1000) m = k; });
      if (m === markIdx) return;
      markIdx = m;
      mk.classList.remove('on');
      if (m < 0) return;
      void mk.offsetWidth;
      mkText.textContent = marks[m].text;
      mk.style.setProperty('--y', marks[m].y);
      mk.classList.toggle('mk-top', marks[m].y >= 50);   // on phones the note sits away from what it points at
      mk.classList.add('on');
    }

    function paint() {
      rings.forEach((r) => {
        r.classList.toggle('is-on', idx >= 0 && r.dataset.go === chapterOf(idx));
        r.classList.toggle('is-seen', seen.has(r.dataset.go) && !(idx >= 0 && r.dataset.go === chapterOf(idx)));
      });
      if (idx < 0) return;
      const ch = chapterOf(idx), list = inChapter(ch), pos = list.indexOf(idx);
      if (segChapter !== ch) {
        segChapter = ch;
        segs.innerHTML = list.map(() => '<i><b></b></i>').join('');
        chapterLabel.textContent = ringName[ch] || '';
      }
      $$('b', segs).forEach((b, k) => { b.style.width = k < pos ? '100%' : '0%'; });
      countEl.textContent = `${pos + 1} / ${list.length}`;
    }

    function next() {
      if (idx + 1 < notes.length) go(idx + 1);
      else if (wide.matches) go(0);
      else { ended = true; sync(); }          // on a phone the last screen stays, with "watch again"
    }
    function prev() { go(Math.max(first(), idx - 1)); }
    function chapter(ch) { const k = notes.findIndex((n) => n.dataset.chapter === ch); if (k >= 0) go(k); }
    function jump(dir) {
      if (idx < 0) { if (dir > 0) go(0); return; }
      const c = order.indexOf(chapterOf(idx)) + dir;
      if (c < 0) go(first());
      else if (c < order.length) chapter(order[c]);
    }
    const touched = () => land.classList.add('touched');

    $$('[data-go]', land).forEach((b) => b.addEventListener('click', () => { touched(); chapter(b.dataset.go); }));
    $$('.nn', land).forEach((b) => b.addEventListener('click', () => { touched(); if (+b.dataset.step > 0) next(); else prev(); }));
    more.addEventListener('click', () => { if (more.dataset.slide) $('[data-slides]')?.goTo?.(+more.dataset.slide); });

    // Taps, holds and swipes. Links and buttons inside keep their own clicks.
    let down = null, holdTimer = 0;
    const release = () => { clearTimeout(holdTimer); if (held) { held = false; sync(); } };
    land.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || e.target.closest('a, button')) return;
      if (wide.matches && !e.target.closest('.stage')) return;
      down = { x: e.clientX, y: e.clientY, hold: false };
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { if (down) { down.hold = true; held = true; sync(); } }, 260);
    });
    land.addEventListener('pointerup', (e) => {
      if (!down) return;
      const d = down;
      down = null;
      release();
      if (d.hold) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) return;      // a scroll, not a tap
      touched();
      if (Math.abs(dx) > 48) { jump(dx < 0 ? 1 : -1); return; }
      const box = (wide.matches ? stage : land).getBoundingClientRect();
      if (e.clientX - box.left < box.width * 0.3) prev(); else next();
    });
    land.addEventListener('pointercancel', () => { down = null; release(); });
    land.addEventListener('contextmenu', (e) => { if (held) e.preventDefault(); });
    addEventListener('keydown', (e) => {
      if (!visible || e.altKey || e.metaKey || e.ctrlKey || /^(input|textarea|select)$/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { touched(); next(); }
      if (e.key === 'ArrowLeft') { touched(); prev(); }
    });

    new IntersectionObserver(([e]) => {
      visible = e.intersectionRatio >= 0.5;
      if (visible && idx === null) go(first());
      else sync();
    }, { threshold: [0, 0.5, 1] }).observe(land);
    document.addEventListener('visibilitychange', sync);
    wide.addEventListener('change', () => { if (idx !== null) go(idx < 0 ? first() : idx); });
  }
  $$('[data-stories]').forEach(setupStories);

  syncTheme();
  onScroll();
})();
