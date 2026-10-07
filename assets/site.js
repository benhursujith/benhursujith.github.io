/* Sujith Benhur — site behaviour. No framework. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const MEDIA = 'assets/media/demos/';

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

  /* ---------- Masthead + current section ---------- */
  const mast = $('.masthead');
  let lastY = scrollY;
  const navLinks = $$('.nav a[href^="#"]');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  function onScroll() {
    const y = scrollY;
    mast?.classList.toggle('is-scrolled', y > 40);
    if (!root.classList.contains('menu-open')) mast?.classList.toggle('is-hidden', y > lastY && y > 480);
    lastY = y;
    let current = null;
    sections.forEach((s) => { if (s.getBoundingClientRect().top < innerHeight * 0.4) current = s.id; });
    navLinks.forEach((a) => {
      if (a.getAttribute('href') === `#${current}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll', onScroll, { passive: true });

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
  // Scale a fixed-size virtual screen (1280 x 800) to its frame.
  function fit(container, baseWidth) {
    const set = () => container.style.setProperty('--s', container.clientWidth / baseWidth);
    new ResizeObserver(set).observe(container);
    set();
  }

  /* ---------- Recreated demo (time-based, like a video) ---------- */
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
      const reset = () => {
        turns.forEach((t) => t.classList.remove('on'));
        typed.textContent = '';
        move.classList.remove('is-press');
        cursor.style.setProperty('--x', '1180px');
        cursor.style.setProperty('--y', '840px');
      };
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
            [sent + 5700, () => {
              move.classList.remove('is-press');
              show(6);
              cursor.style.setProperty('--x', '1180px');
              cursor.style.setProperty('--y', '840px');
            }],
            [sent + 6500, () => show(7)],
            [DURATION, () => onEnd && onEnd()],
          );
          cancel = timeline(steps);
        },
        stop() { cancel(); },
        still() { this.stop(); reset(); [1, 2, 3, 4].forEach(show); },
      };
    },
  };

  /* ---------- Showcase: a list of apps beside one device that plays them in turn ---------- */
  const wide = matchMedia('(min-width: 901px)');

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

  /* ---------- Tagging stream ---------- */
  const stream = $('[data-stream]');
  if (stream) {
    const qs = [
      ["What's the German word for a bedsore?", ['Language']],
      ['Do I need B2 German for the knowledge exam in Bavaria?', ['Recognition', 'Language']],
      ['How do I chart a fall that nobody saw?', ['Paperwork', 'Clinical']],
      ['Can my husband join me on my work visa?', ['Recognition', 'Unanswered']],
      ['What does Grundpflege cover, exactly?', ['Clinical', 'Language']],
      ['How many hours can I work during the adaptation course?', ['Recognition']],
      ['Can I refuse a second shift in a row?', ['Unanswered']],
      ['How do I write the SIS for a new resident?', ['Paperwork']],
      ['What do I say when a resident refuses their tablets?', ['Clinical', 'Language']],
      ['Where do I find my recognition file number?', ['Recognition', 'Unanswered']],
      ['How formal should I be with my ward manager?', ['Language']],
      ['Who signs off the wound documentation, me or the doctor?', ['Paperwork', 'Clinical']],
    ];
    const tally = Object.fromEntries($$('[data-k]').map((d) => [d.dataset.k, $('b', d)]));
    const counts = {};
    let i = 0, timer = null;
    const count = (tags) => tags.forEach((t) => {
      counts[t] = (counts[t] || 0) + 1;
      if (tally[t]) tally[t].textContent = counts[t];
    });
    const item = ([q, tags], animate) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="q">${q}</span><span class="tags">${tags.map((t) => `<span class="tag${t === 'Unanswered' ? ' gap' : ''}">${t === 'Unanswered' ? 'No answer found' : t}</span>`).join('')}</span>`;
      if (animate) li.classList.add('enter');
      stream.prepend(li);
      const tagEls = $$('.tag', li);
      if (!animate) tagEls.forEach((t) => t.classList.add('on'));
      else tagEls.forEach((t, k) => setTimeout(() => t.classList.add('on'), 700 + k * 260));
      while (stream.children.length > 5) stream.lastElementChild.remove();
    };
    for (; i < 4; i++) { item(qs[i], false); count(qs[i][1]); }
    const tick = () => { const q = qs[i++ % qs.length]; item(q, true); setTimeout(() => count(q[1]), 900); };
    if (!reduce) onVisible(stream, () => { if (!timer) timer = setInterval(tick, 2600); }, () => { clearInterval(timer); timer = null; }, 0.2);
  }

  onScroll();
})();
