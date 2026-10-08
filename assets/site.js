/* Sujith Benhur — site behaviour. No framework. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const MEDIA = 'assets/media/demos/';
  const wide = matchMedia('(min-width: 901px)');

  /* ---------- Theme ---------- */
  const themeBtn = $('[data-theme-toggle]');
  const theme = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const syncTheme = () => { if (themeBtn) themeBtn.textContent = theme() === 'dark' ? 'Switch to light' : 'Switch to dark'; };
  themeBtn?.addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* storage blocked: theme lasts this visit */ }
    syncTheme();
  });
  syncTheme();

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

  /* ---------- Hero: one orchestrated entrance ---------- */
  const title = $('[data-split]');
  if (title) {
    const text = title.textContent.trim();
    title.setAttribute('aria-label', text);
    title.innerHTML = text.split(/\s+/)
      .map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
      .join(' ');
  }
  const ready = () => root.classList.add('is-ready');
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(ready));
  setTimeout(ready, 1400);

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
    $('.pin-title', pin).textContent = $('.ch-title, h1', ch)?.textContent.trim() || '';
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
  // Runs [atMs, fn] steps on one clock; returns a cancel function.
  function timeline(steps) {
    const timers = steps.map(([at, fn]) => setTimeout(fn, at));
    return () => timers.forEach(clearTimeout);
  }
  // Scale a fixed-size virtual screen (390 x 844 or 1280 x 800) to its frame.
  function fit(container, baseWidth) {
    const set = () => container.style.setProperty('--s', container.clientWidth / baseWidth);
    new ResizeObserver(set).observe(container);
    set();
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
  const htmlDemos = {
    ads(container) {
      const app = $('[data-ads]', container);
      fit(container, 1280);
      const turns = $$('[data-step]', app);
      const typed = $('[data-ads-typed]', app);
      const cursor = $('[data-ads-cursor]', app);
      const move = $('[data-ads-move]', app);
      const question = 'Which Meta campaigns are overspending this week?';
      let cancel = () => {};
      const DURATION = 13000;
      const show = (n) => turns.forEach((t) => { if (+t.dataset.step === n) t.classList.add('on'); });
      const park = () => { cursor.style.setProperty('--x', '1180px'); cursor.style.setProperty('--y', '840px'); };
      const reset = () => { turns.forEach((t) => t.classList.remove('on')); typed.textContent = ''; move.classList.remove('is-press'); park(); };
      const pointAt = (el) => {
        const s = parseFloat(container.style.getPropertyValue('--s')) || 1;
        const a = app.getBoundingClientRect(), r = el.getBoundingClientRect();
        cursor.style.setProperty('--x', `${(r.left - a.left + r.width * 0.45) / s}px`);
        cursor.style.setProperty('--y', `${(r.top - a.top + r.height * 0.55) / s}px`);
      };
      return {
        duration: DURATION,
        play(onEnd) {
          this.stop();
          reset();
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
            [DURATION, () => onEnd && onEnd()],
          );
          cancel = timeline(steps);
        },
        stop() { cancel(); },
        still() { this.stop(); reset(); [1, 2, 3, 4].forEach(show); },
      };
    },

    trade(container) {
      const app = $('[data-trd]', container);
      fit(container, 390);
      const msgs = $$('[data-step]', app);
      const typed = $('[data-trd-typed]', app);
      let cancel = () => {};
      const DURATION = 14000;
      const show = (n) => msgs.forEach((m) => { if (+m.dataset.step === n) m.classList.add('on'); });
      const reset = () => { msgs.forEach((m) => m.classList.remove('on')); typed.textContent = ''; };
      // Type a reply into the input, then send it as message n.
      const reply = (at, text, n) => [
        ...[...text].map((ch, i) => [at + i * 70, () => { typed.textContent += ch; }]),
        [at + text.length * 70 + 300, () => { typed.textContent = ''; show(n); }],
      ];
      return {
        duration: DURATION,
        play(onEnd) {
          this.stop();
          reset();
          cancel = timeline([
            [300, () => show(1)],
            ...reply(1700, 'approve 41', 2),
            [3900, () => show(3)],
            ...reply(5300, 'status', 4),
            [7100, () => show(5)],
            ...reply(8500, 'kill crypto', 6),
            [10800, () => show(7)],
            [DURATION, () => onEnd && onEnd()],
          ]);
        },
        stop() { cancel(); },
        still() { this.stop(); reset(); msgs.forEach((m) => m.classList.add('on')); },
      };
    },
  };

  /* ---------- Showcase: a list of apps beside one device that plays them in turn ---------- */
  function setupShowcase(sc) {
    const items = $$('.sc-item', sc);
    const stage = $('.sc-stage', sc);
    if (!items.length || !stage) return;
    const devices = Object.fromEntries($$('[data-device]', stage).map((d) => [d.dataset.device, d]));
    const caption = $('[data-caption]', sc);
    const detail = $('[data-detail]', sc);
    const hero = sc.hasAttribute('data-hero');
    const built = {};
    let idx = -1, visible = false, raf = 0, active = null;

    // Lists advance on wide screens; on phones the chosen demo loops until another is tapped.
    const autoAdvance = () => hero || wide.matches;
    const bar = (i, p) => $('.sc-bar i', items[i])?.style.setProperty('--p', p);
    const usable = (i) => !items[i].classList.contains('is-missing');
    const nextIndex = () => {
      for (let k = 1; k <= items.length; k++) { const j = (idx + k) % items.length; if (usable(j)) return j; }
      return -1;
    };

    function stop() {
      cancelAnimationFrame(raf);
      if (active?.video) active.video.pause();
      if (active?.demo) active.demo.stop();
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
        const t0 = performance.now();
        d.play(() => { if (autoAdvance()) advance(); else play(); });
        const tick = () => { bar(idx, clamp((performance.now() - t0) / d.duration)); raf = requestAnimationFrame(tick); };
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
      if (caption) {
        caption.style.opacity = 0;
        setTimeout(() => { caption.textContent = label; caption.style.opacity = 1; }, 250);
      }

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
        built[key] = built[key] || htmlDemos[key]($(`.dv-html[data-html="${key}"]`, device));
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

  /* ---------- Hero highlights: story-style cards on the phone ---------- */
  function setupHighlights(el) {
    fit(el.parentElement, 390);
    const cards = $$('.hl-card', el);
    const bars = $$('.hl-bars i', el);
    const track = $('.hl-track', el);
    const DWELL = 4200;
    let idx = 0, t0 = 0, raf = 0, visible = false;
    const paint = () => {
      bars.forEach((b, k) => {
        b.classList.toggle('done', k < idx);
        $('b', b).style.width = k === idx ? `${clamp((performance.now() - t0) / DWELL) * 100}%` : '';
      });
    };
    function go(i, user) {
      idx = (i + cards.length) % cards.length;
      track.style.transform = `translateX(${-idx * 100}%)`;
      cards.forEach((c, k) => { c.classList.toggle('on', k === idx); c.setAttribute('aria-hidden', String(k !== idx)); });
      if (user) el.classList.add('touched');
      t0 = performance.now();
      paint();
    }
    const tick = () => {
      if (!visible) return;
      if (!reduce && performance.now() - t0 >= DWELL) go(idx + 1);
      paint();
      raf = requestAnimationFrame(tick);
    };
    let swiped = false;   // a swipe ends with a click on a tap zone; don't count it twice
    $('.hl-zone.next', el).addEventListener('click', () => { if (!swiped) go(idx + 1, true); swiped = false; });
    $('.hl-zone.prev', el).addEventListener('click', () => { if (!swiped) go(idx - 1, true); swiped = false; });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1, true); }
    });
    let x0 = null;
    el.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    el.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) { swiped = true; go(idx + (dx < 0 ? 1 : -1), true); setTimeout(() => { swiped = false; }, 400); }
    });
    go(0);
    onVisible(el, () => { visible = true; t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); },
      () => { visible = false; cancelAnimationFrame(raf); }, 0.2);
  }
  $$('[data-highlights]').forEach(setupHighlights);

  /* ---------- MIS: rounded running totals from the weekly MIS, March to September 2026 ---------- */
  const mis = $('[data-mis]');
  if (mis) {
    const start = new Date(2026, 2, 2);
    const weeks = Array.from({ length: 31 }, (_, i) => new Date(start.getTime() + i * 7 * 864e5));
    const series = {
      nurses: [100, 210, 340, 440, 520, 600, 730, 850, 1060, 1380, 1810, 2080, 2300, 2680, 2920, 3170, 3400, 3540, 3730, 3860, 4060, 4160, 4390, 4510, 4630, 4730, 4830, 4950, 5190, 5310, 5450],
      ask: [0, 0, 0, 0, 0, 0, 10, 280, 720, 1240, 1960, 2870, 3780, 4590, 5330, 6330, 7200, 7780, 8580, 9230, 10210, 10650, 11140, 11680, 11990, 12380, 12730, 13050, 13660, 14210, 14820],
      learn: [2320, 2840, 3380, 4240, 5410, 6950, 9140, 10820, 12810, 14840, 17320, 20050, 22980, 27430, 31350, 34980, 37920, 40180, 41770, 42860, 43930, 44610, 45690, 47400, 48910, 50390, 52010, 53050, 54290, 55340, 56260],
    };
    const num = (n) => n.toLocaleString('en-IN');
    const day = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const svgNS = 'http://www.w3.org/2000/svg';

    // Main chart: one series, area wash, end label, crosshair tooltip.
    const box = $('[data-chart="nurses"]', mis);
    const data = series.nurses;
    const W = 640, H = 300, L = 44, R = 56, T = 16, B = 28;
    const max = 6000;
    const x = (i) => L + (i / (data.length - 1)) * (W - L - R);
    const y = (v) => T + (1 - v / max) * (H - T - B);
    const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    let g = '';
    for (let v = 0; v <= max; v += 2000) {
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`;
      g += `<text class="axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`;
    }
    weeks.forEach((d, i) => {
      if (i > 0 && d.getMonth() === weeks[i - 1].getMonth()) return;
      g += `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${d.toLocaleDateString('en-GB', { month: 'short' })}</text>`;
    });
    g += `<path class="area" d="M${x(0)},${y(0)} L${pts.join(' L')} L${x(data.length - 1)},${y(0)} Z"/>`;
    g += `<polyline class="line" points="${pts.join(' ')}"/>`;
    const last = data.length - 1;
    g += `<circle class="dot" cx="${x(last)}" cy="${y(data[last])}" r="4.5"/>`;
    g += `<text class="end-label" x="${x(last) + 10}" y="${y(data[last]) + 4}">${num(data[last])}</text>`;
    g += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
    g += `<circle class="dot hover" r="4.5" visibility="hidden"/>`;
    g += `<rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="${svgNS}">${g}</svg><div class="tip" hidden></div>`;
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
      el.innerHTML = `<svg viewBox="0 0 120 40" xmlns="${svgNS}"><polyline points="${p}" fill="none" stroke="var(--green)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="120" cy="${sy(d[d.length - 1])}" r="3.5" fill="var(--green)" stroke="var(--paper)" stroke-width="2"/></svg>`;
    });

    // Table view: the last week of each month.
    const rows = $('[data-mis-rows]', mis);
    rows.innerHTML = weeks.map((d, i) => [d, i]).filter(([d, i]) => i === last || d.getMonth() !== weeks[i + 1].getMonth())
      .map(([d, i]) => `<tr><td>${d.toLocaleDateString('en-GB', { month: 'long' })}</td><td>${num(series.nurses[i])}</td><td>${num(series.ask[i])}</td><td>${num(series.learn[i])}</td></tr>`)
      .join('');
  }

  onScroll();
})();
