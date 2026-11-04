/* The keynote: My work.key, played from the laptop's desktop. The work is told the way the MacBook Air itself was
   launched in 2008, one idea per slide, full screen. Slides are laid out on a fixed canvas (1600 × 900, or 780 × 1400
   on a phone) and scaled to fit, the way Keynote does. Everything on them comes from the page's own notes (.desk-data .note), and
   every demo plays through the site's own player, so recordings and recreations behave as they do on the laptop.
   window.Keynote(host, { notes, makePlayer, narrow }) builds it in host and returns { run, layout, focus, next, prev, atEdge }. */
(() => {
  'use strict';

  const GROUPS = [
    { id: 'borderplus', label: 'BorderPlus', when: '2026', role: 'Lead PM, AI products', mark: 'borderplus-mark.png', keys: ['carepilot', 'ask', 'learn', 'mis', 'pathways'] },
    { id: 'zenea', label: 'Zenea', when: '2026', role: 'Managed childcare at home, built at BorderPlus', mark: 'zenea-icon.png', keys: ['zenea-caregiver', 'zenea-parent'] },
    { id: 'pixis', label: 'Pixis', when: '2020–25', role: 'Founding PM, optimisation', mark: 'pixis-mark.svg', keys: ['ads', 'pixis'] },
    { id: 'personal', label: 'Personal', when: '2026', role: 'On my own time', mark: null, keys: ['money-plan', 'trade', 'eatouts', 'gbf'] },
  ];
  // three recordings are of wide screens, and the Ads Agent is recreated at 1280 × 800; the rest are phones
  const WIDE = new Set(['gbf-site', 'pathways', 'runway', 'ads']);
  const ICON = {
    wave: '<svg viewBox="0 0 48 48"><path d="M6 24h3M12 17v14M18 11v26M24 15v18M30 8v32M36 14v20M42 24h-3"/></svg>',
    ask: '<svg viewBox="0 0 48 48"><path d="M40 23a15 15 0 0 1-22 13.3L8 39l2.8-8.6A15 15 0 1 1 40 23z"/><path d="M20 19.5a4.2 4.2 0 1 1 5.6 4c-1.2.4-1.6 1.3-1.6 2.6M24 30.5v.4"/></svg>',
    globe: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15"/><path d="M9 24h30M24 9c-4.6 4.2-6.8 9.2-6.8 15s2.2 10.8 6.8 15c4.6-4.2 6.8-9.2 6.8-15S28.6 13.2 24 9z"/></svg>',
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const txt = (el, sel) => (el.querySelector(sel)?.textContent || '').trim().replace(/\s+/g, ' ');

  function item(n) {
    const d = n.dataset, [product, company] = (d.title || '').split('·').map((s) => s.trim());
    return {
      key: d.key, note: n, product, company,
      kick: txt(n, '.note-kick'), head: txt(n, '.note-title'), stat: txt(n, '.note-stat'), lab: txt(n, '.note-lab'),
      tags: (d.tags || '').split('|').filter(Boolean),
      facts: (d.facts || '').split('|').filter(Boolean).map((f) => { const i = f.lastIndexOf(': '); return [f.slice(0, i), f.slice(i + 2)]; }),
      playable: !!(d.video || d.html), honest: d.honest || '', short: d.short || '', article: d.article || '',
      marks: [...n.querySelectorAll('.note-marks li')].map((li) => ({ at: +(li.dataset.at || 0), mat: +(li.dataset.mAt || li.dataset.at || 0), text: li.textContent.trim() })),
    };
  }
  // what a demo slide shows: the phone-width version on a phone, where there is one
  const demoName = (it, narrow) => {
    const d = it.note.dataset;
    return (narrow && (d.mVideo || d.mHtml)) || d.video || d.html;
  };
  const numberParts = (stat) => {
    const m = stat.match(/^([\d,.]+)(.*)$/);
    return m && !/[–-]/.test(stat) && !/ of /.test(stat) && !stat.includes('→') ? { n: parseFloat(m[1].replace(/,/g, '')), dec: (m[1].split('.')[1] || '').length, rest: m[2], comma: m[1].includes(',') } : null;
  };

  function Keynote(host, opts) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = Object.fromEntries(opts.notes.map((n) => [n.dataset.key, item(n)]));
    const groups = GROUPS.map((g) => ({ ...g, items: g.keys.map((k) => items[k]).filter(Boolean) }));
    const arts = Object.values(items).filter((x) => x.article);

    host.insertAdjacentHTML('beforeend', `
      <div class="kn-screen" data-kn-screen tabindex="-1" role="group" aria-roledescription="slides" aria-label="My work, as a keynote">
        <div class="kn-canvas" data-kn-canvas aria-live="polite"></div>
      </div>
      <div class="kn-prog" data-kn-prog></div>
      <nav class="kn-bar" data-kn-bar aria-label="Chapters"></nav>
      <p class="kn-hint" data-kn-hint aria-hidden="true">Click, or press →</p>`);
    const $ = (s) => host.querySelector(s);
    const screen = $('[data-kn-screen]'), canvas = $('[data-kn-canvas]'), bar = $('[data-kn-bar]'), prog = $('[data-kn-prog]'), hint = $('[data-kn-hint]');

    /* ---------- the running order ---------- */
    const slides = [];
    slides.push({ ch: 'Today', type: 'open', steps: 4 }, { ch: 'Today', type: 'idea', steps: 2 });
    for (const g of groups) {
      slides.push({ ch: g.label, type: 'chapter', g });
      for (const it of g.items) {
        if (it.playable) slides.push({ ch: g.label, type: 'demo', it, g });
        // a number slide only when there's a number to show; a demo already says "Parent app"
        if (/\d/.test(it.stat) || !it.playable) slides.push({ ch: g.label, type: 'number', it, g });
      }
    }
    if (items.ai) slides.push({ ch: 'How I work', type: 'ai', it: items.ai });
    if (arts.length) slides.push({ ch: 'How I work', type: 'writing' });
    slides.push({ ch: 'Say hi', type: 'more' }, { ch: 'Say hi', type: 'hi' });
    const chapters = [...new Set(slides.map((s) => s.ch))];
    bar.innerHTML = chapters.map((c) => `<button type="button" data-ch="${esc(c)}">${esc(c)}</button>`).join('');

    const brand = (f) => `assets/brand/${f}`;
    const markOf = (g) => (g?.mark ? `<img src="${brand(g.mark)}" alt="">` : '');
    function html(s, narrow) {
      const it = s.it, g = s.g;
      switch (s.type) {
        case 'open': return `<div class="kn-ctr"><p class="kn-mid kn-b">Three things I've been building.</p>
          <div class="kn-three">
            <div class="kn-b"><span class="kn-ico">${ICON.wave}</span><p>A care record you can talk to</p></div>
            <div class="kn-b"><span class="kn-ico">${ICON.ask}</span><p>Answers for nurses, in German and English</p></div>
            <div class="kn-b"><span class="kn-ico">${ICON.globe}</span><p>Work abroad, worked out in a chat</p></div>
          </div></div>`;
        case 'idea': return `<div class="kn-ctr"><p class="kn-sub kn-b kn-lead">The pain point I keep solving for:</p><p class="kn-big kn-b">Hours lost to work that should take <span class="kn-brush">minutes</span>.</p></div>`;
        case 'chapter': return `<div class="kn-ctr"><img class="kn-mark kn-b${g.mark ? '' : ' kn-mark--me'}" src="${brand(g.mark || 'sujith.jpg')}" alt=""><p class="kn-big kn-b">${esc(g.label)}</p><p class="kn-sub kn-b">${esc(g.when)} · ${esc(g.role)}</p></div>`;
        case 'demo': {
          const name = demoName(it, narrow);
          return `<div class="kn-dm-title"><h2>${esc(it.product)}</h2><p>${esc(it.head)}</p></div>
            <div class="kn-dev ${WIDE.has(name) ? 'kn-dev--wide' : 'kn-dev--phone'}"><div class="kn-dev-in" data-kn-dev></div></div>
            <ol class="kn-notes">${it.marks.map((m) => `<li>${esc(m.text)}</li>`).join('')}</ol>`;
        }
        case 'number': {
          const arrow = it.stat.split('→').map((x) => x.trim());
          const long = it.stat.length > 9 && arrow.length < 2;
          const big = arrow.length === 2 ? `<span class="kn-from"><s>${esc(arrow[0])}</s></span>${esc(arrow[1])}` : esc(it.stat);
          const own = it.company === 'Personal' || it.company === 'Church';
          return `<p class="kn-kick">${markOf(g)}${esc(own ? it.kick : `${g?.label || ''} · ${it.product}`)}</p>
            <div class="kn-ctr"><p class="kn-stat kn-b${long ? ' is-long' : ''}"${numberParts(it.stat) ? ' data-count' : ''}>${big}</p><p class="kn-lab kn-b">${esc(it.lab || it.head)}</p>
            ${it.facts.length ? `<div class="kn-facts kn-b">${it.facts.slice(0, 2).map(([l, v]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : ''}</div>
            ${it.tags.length || it.honest ? `<p class="kn-foot kn-b">${it.tags.length ? `Built with ${esc(it.tags.join(', '))}.` : ''}${it.honest ? `<i>${esc(it.honest)}</i>` : ''}</p>` : ''}`;
        }
        case 'ai': return `<p class="kn-kick">How I work with AI</p><div class="kn-ctr"><p class="kn-big kn-b">${esc(it.head)}</p><div class="kn-facts kn-b">${it.facts.map(([l, v]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div></div>`;
        case 'writing': return `<div class="kn-ctr"><p class="kn-mid kn-b">I write about how it works.</p><ul class="kn-wr kn-b">${arts.map((a) => `<li><a href="${esc(a.article)}">${esc(a.short || a.product)}</a></li>`).join('')}</ul></div>`;
        case 'more': return '<div class="kn-ctr"><p class="kn-more kn-b">One more thing…</p></div>';
        case 'hi': return `<div class="kn-ctr"><p class="kn-sub kn-b kn-lead kn-ask">Are you solving an interesting problem with AI, and think I could be of help?</p><p class="kn-big kn-b" data-visitor-talk>Let's talk.</p>
          <div class="kn-hi kn-b"><a href="mailto:sujithbenhur@gmail.com">Email me</a><a href="https://www.linkedin.com/in/sujithbenhur" target="_blank" rel="noopener">LinkedIn</a></div></div>`;
      }
      return '';
    }

    /* ---------- layout: a fixed canvas, scaled to the window ---------- */
    let port = false;
    function layout() {
      const W = host.clientWidth, H = host.clientHeight;
      if (!W || !H) return;
      const was = port;
      port = opts.narrow() && H > W;
      host.classList.toggle('kn--port', port);
      const cw = port ? 780 : 1600, ch = port ? 1400 : 900;
      // as big as the window allows, leaving a band above for the masthead and one below for the chapters
      const band = opts.narrow() ? 36 : 56;
      const s = port ? Math.min(W / cw, H / ch) : Math.min((W - 32) / cw, (H - 2 * band) / ch);
      host.style.setProperty('--kn-cw', `${cw}px`); host.style.setProperty('--kn-ch', `${ch}px`);
      host.style.setProperty('--kn-s', s.toFixed(5));
      if (was !== port && cur >= 0) show(cur, { full: true });
    }

    /* ---------- the show ---------- */
    let cur = -1, step = 0, el = null, timers = [], running = false, player = null, playing = false, markRaf = 0;
    const later = (f, ms) => timers.push(setTimeout(f, reduce ? 0 : ms));
    function count(node) {
      const p = numberParts(node.textContent.trim());
      if (!p || reduce) return;
      const fmt = (v) => (p.comma ? v.toLocaleString('en-US', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }) : v.toFixed(p.dec)) + p.rest;
      const t0 = performance.now();
      const f = (t) => { const k = Math.min(1, (t - t0) / 1300), e = 1 - Math.pow(1 - k, 4); node.textContent = fmt(p.n * e); if (k < 1 && node.isConnected) requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }
    function build(n) {
      const bs = [...el.querySelectorAll('.kn-b')], s = slides[cur];
      const total = s.steps || 1;
      // the last step shows whatever is left; earlier steps one piece at a time
      const upto = n >= total ? bs.length : Math.min(bs.length, n);
      bs.slice(0, upto).forEach((b, i) => {
        if (b.classList.contains('is-on')) return;
        later(() => { b.classList.add('is-on'); if (b.hasAttribute('data-count')) count(b); }, i * (s.type === 'number' || s.type === 'chapter' ? 160 : 0));
      });
    }
    function stopDemo() {
      cancelAnimationFrame(markRaf);
      player?.pause();
      player = null; playing = false;
    }
    function show(i, o = {}) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      timers.forEach(clearTimeout); timers = [];
      stopDemo();
      const old = el;
      if (old) { old.classList.remove('is-on'); setTimeout(() => old.remove(), 600); }
      cur = i; step = o.full ? (slides[i].steps || 1) : 1;
      const s = slides[i];
      el = document.createElement('section');
      el.className = `kn-sl kn-sl--${s.type}`;
      el.innerHTML = html(s, port);
      if (s.type === 'demo' && el.querySelector('.kn-dev--wide')) el.classList.add('kn-sl--wide');
      if (s.type === 'hi') opts.greet?.(el);
      canvas.append(el);
      const here = el;
      requestAnimationFrame(() => requestAnimationFrame(() => { if (el !== here) return; here.classList.add('is-on'); if (s.type !== 'demo') build(step); }));
      if (s.type === 'demo') demo(s, here);
      bar.querySelectorAll('button').forEach((b) => {
        const on = b.dataset.ch === s.ch;
        b.setAttribute('aria-current', String(on));
        // centre the chapter in its own row (scrollIntoView would also scroll the fixed stage behind it)
        if (on && port) bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
      });
      prog.style.width = `${((i + 1) / slides.length) * 100}%`;
    }
    // the product's name settles in the corner, its demo rises, and the notes build beside it as it plays
    function demo(s, here) {
      const box = here.querySelector('[data-kn-dev]'), lis = [...here.querySelectorAll('.kn-notes li')];
      player = opts.makePlayer(s.it.note, box, port);
      // a recording shows its first frame while the title settles; a recreation waits at its own start
      player?.load?.();
      const atOf = (m) => (port && s.it.note.dataset.mVideo ? m.mat : m.at) * 1000;
      const marks = () => {
        if (!player) return;
        const t = player.elapsed;
        let k = -1;
        s.it.marks.forEach((m, j) => { if (t >= atOf(m)) k = j; });
        lis.forEach((li, j) => { li.classList.toggle('is-on', j <= k); li.classList.toggle('is-past', j < k); });
        markRaf = requestAnimationFrame(marks);
      };
      const go = () => {
        if (el !== here || !player) return;
        here.classList.add('is-set');
        playing = true;
        // with reduced motion nothing plays by itself: the demo holds still and its notes are all there
        if (reduce) { player.still?.(); lis.forEach((li) => li.classList.add('is-on')); return; }
        // when the demo ends, the number follows on its own
        player.start(() => { if (el === here) later(() => next(), 900); });
        if (!running) player.pause();
        cancelAnimationFrame(markRaf); marks();
      };
      later(() => { here.classList.add('is-set'); later(go, 650); }, 1100);
      here._go = go;
    }
    function next() {
      hint.classList.add('is-gone');
      const s = slides[cur];
      if (s.type === 'demo' && !playing) { timers.forEach(clearTimeout); timers = []; el._go?.(); return; }
      if (step < (s.steps || 1) && s.type !== 'demo') { step++; build(step); return; }
      if (cur < slides.length - 1) show(cur + 1);
    }
    const prev = () => { if (cur > 0) show(cur - 1, { full: true }); };

    screen.addEventListener('click', (e) => {
      if (e.target.closest('a') || !running) return;
      if (port && e.clientX < host.getBoundingClientRect().left + host.clientWidth * 0.3) prev(); else next();
    });
    addEventListener('keydown', (e) => {
      if (!running || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key) && !(e.key === 'Enter' && e.target.closest?.('a, button'))) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    });
    let sx = null;
    screen.addEventListener('touchstart', (e) => { sx = e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY] : null; }, { passive: true });
    screen.addEventListener('touchend', (e) => {
      if (!sx || !running) return;
      const dx = e.changedTouches[0].clientX - sx[0], dy = e.changedTouches[0].clientY - sx[1];
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) { e.preventDefault(); dx < 0 ? next() : prev(); }
    });
    // a chapter jump hands the keys back to the slides
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ch]');
      if (!b) return;
      hint.classList.add('is-gone');
      show(slides.findIndex((s) => s.ch === b.dataset.ch));
      screen.focus({ preventScroll: true });
    });

    layout();
    show(0);
    new ResizeObserver(layout).observe(host);
    return {
      // plays while it fills the window; holds its place when the visitor goes back to the laptop
      run(on) {
        if (on === running) return;
        running = on;
        host.classList.toggle('is-live', on);
        if (on) { if (playing) player?.resume(); }
        else player?.pause();
      },
      layout,
      focus() { screen.focus({ preventScroll: true }); },
      next, prev,
      // true when there are no more slides that way, so the page can have the scroll
      atEdge: (dir) => (dir > 0 ? cur === slides.length - 1 && step >= (slides[cur].steps || 1) : cur === 0),
    };
  }

  window.Keynote = Keynote;
})();
