/* Interactive figures in the writing (figure.ix[data-ix]). Each kind reads plain markup the article already
   holds, so with scripts off the reader still gets every word: the steps as a list, both sides of a toggle,
   the tree as nested folders, the cards with their reasons. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n));
  const h = (tag, cls, html = '') => { const el = document.createElement(tag); if (cls) el.className = cls; el.innerHTML = html; return el; };

  const kinds = {
    // A click-through sequence: tabs on top, one step at a time, Back/Next below
    steps(fig) {
      const items = $$(':scope > ol > li', fig);
      if (!items.length) return;
      const tabs = h('div', 'ix-tabs');
      tabs.setAttribute('role', 'tablist');
      const nav = h('div', 'ix-nav', '<button type="button" class="ix-btn" data-prev>Back</button><span class="ix-count"></span><button type="button" class="ix-btn ix-btn--go" data-next>Next</button>');
      let i = 0;
      items.forEach((li, n) => {
        const b = h('button', 'ix-tab', `<span class="ix-tab-n">${n + 1}</span>${li.dataset.label || `Step ${n + 1}`}`);
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.addEventListener('click', () => go(n));
        tabs.append(b);
      });
      $(':scope > ol', fig).before(tabs);
      $(':scope > ol', fig).after(nav);
      const go = (n) => {
        const dir = n >= i ? 1 : -1;
        i = Math.max(0, Math.min(items.length - 1, n));
        items.forEach((li, k) => { li.hidden = k !== i; li.style.setProperty('--dir', dir); });
        $$('.ix-tab', tabs).forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.classList.toggle('is-past', k < i); });
        tabs.style.setProperty('--p', items.length > 1 ? i / (items.length - 1) : 1);
        $('.ix-count', nav).textContent = `${i + 1} of ${items.length}`;
        $('[data-prev]', nav).disabled = i === 0;
        $('[data-next]', nav).textContent = i === items.length - 1 ? 'Start again' : 'Next';
      };
      $('[data-prev]', nav).addEventListener('click', () => go(i - 1));
      $('[data-next]', nav).addEventListener('click', () => go(i === items.length - 1 ? 0 : i + 1));
      go(0);
    },

    // Two versions of the same thing, one switch; an optional meter shows what each costs
    toggle(fig) {
      const a = $(':scope > [data-side="a"]', fig), b = $(':scope > [data-side="b"]', fig);
      if (!a || !b) return;
      const sw = h('div', 'ix-switch', `<button type="button" data-s="a">${fig.dataset.a || 'Before'}</button><button type="button" data-s="b">${fig.dataset.b || 'After'}</button><i></i>`);
      sw.setAttribute('role', 'group');
      a.before(sw);
      const ta = +a.dataset.tokens || 0, tb = +b.dataset.tokens || 0, max = Math.max(ta, tb);
      let meter = null;
      if (max) {
        meter = h('div', 'ix-meter', '<span class="ix-meter-bar"><i></i></span><span class="ix-meter-n"></span>');
        b.after(meter);
      }
      const set = (s) => {
        fig.dataset.on = s;
        a.hidden = s !== 'a'; b.hidden = s !== 'b';
        $$('button', sw).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.s === s)));
        if (meter) {
          const t = s === 'a' ? ta : tb;
          $('i', meter).style.width = `${Math.max(1.5, (t / max) * 100)}%`;
          $('.ix-meter-n', meter).textContent = `~${fmt(t)} ${fig.dataset.unit || 'tokens'}`;
        }
      };
      $$('button', sw).forEach((x) => x.addEventListener('click', () => set(x.dataset.s)));
      set('a');
    },

    // Tick what a session loads; the bar fills against the context window
    budget(fig) {
      const list = $(':scope > ul', fig);
      if (!list) return;
      const win = +fig.dataset.window || 200000, unit = fig.dataset.unit || 'tokens';
      const items = $$(':scope > li', list);
      const bar = h('div', 'ix-budget', `<div class="ix-budget-top"><span class="ix-budget-n"></span><span class="ix-budget-of">of a ${fmt(win)}-${unit.replace(/s$/, "")} window</span></div><div class="ix-budget-bar"></div><p class="ix-budget-note"></p><button type="button" class="ix-btn ix-budget-reset">Reset to my default</button>`);
      list.after(bar);
      const track = $('.ix-budget-bar', bar);
      items.forEach((li, n) => {
        li.style.setProperty('--hue', n);
        const t = +li.dataset.tokens || 0;
        const box = h('button', 'ix-check', '<i></i>');
        box.type = 'button';
        box.setAttribute('aria-label', `Load ${li.querySelector('b')?.textContent || 'item'}`);
        li.prepend(box);
        li.append(h('span', 'ix-tok', `~${fmt(t)}`));
        li.addEventListener('click', () => { li.toggleAttribute('data-sel'); render(); });
        track.append(h('i', '', ''));
      });
      const reset = () => { items.forEach((li) => li.toggleAttribute('data-sel', li.hasAttribute('data-on'))); render(); };
      const render = () => {
        let sum = 0;
        items.forEach((li, n) => {
          const on = li.hasAttribute('data-sel'), t = +li.dataset.tokens || 0;
          $('.ix-check', li).setAttribute('aria-pressed', String(on));
          const seg = track.children[n];
          seg.style.width = on ? `${Math.min(100, (t / win) * 100)}%` : '0%';
          seg.style.setProperty('--hue', n);
          if (on) sum += t;
        });
        const pct = (sum / win) * 100;
        $('.ix-budget-n', bar).textContent = `~${fmt(sum)} ${unit}`;
        bar.classList.toggle('is-over', sum > win * 0.5);
        $('.ix-budget-note', bar).textContent = sum > win
          ? 'That no longer fits. The model would drop the oldest parts without telling you.'
          : pct > 50
            ? `${Math.round(pct)}% of the window is gone before you've asked anything.`
            : `${Math.round(pct)}% of the window. The rest is left for the work.`;
      };
      $('.ix-budget-reset', bar).addEventListener('click', reset);
      reset();
    },

    // Folders that carry rules: pick one and see every rule that applies there, nearest last
    tree(fig) {
      const top = $(':scope > ul', fig);
      if (!top) return;
      const panel = h('div', 'ix-rules', '<p class="ix-rules-h"></p><ol></ol>');
      const wrap = h('div', 'ix-tree');
      top.before(wrap);
      wrap.append(top, panel);
      const nodes = $$('li', top);
      const pick = (li) => {
        nodes.forEach((n) => n.classList.remove('is-on', 'is-path'));
        const chain = [];
        for (let n = li; n && n !== fig; n = n.parentElement) if (n.tagName === 'LI') { chain.unshift(n); n.classList.add('is-path'); }
        li.classList.add('is-on');
        $('.ix-rules-h', panel).textContent = `Working in ${chain.map((n) => $(':scope > span', n).textContent).join('')}, the agent follows:`;
        const ol = $('ol', panel);
        ol.innerHTML = '';
        chain.forEach((n, depth) => {
          (n.dataset.rules || '').split('|').filter(Boolean).forEach((r) => {
            const item = h('li', depth === chain.length - 1 ? 'is-near' : '', `<span class="ix-rules-from">${$(':scope > span', n).textContent}</span>${r}`);
            item.style.setProperty('--d', depth);
            ol.append(item);
          });
        });
      };
      nodes.forEach((li) => {
        const label = $(':scope > span', li);
        const b = h('button', 'ix-folder', `<svg viewBox="0 0 20 16" aria-hidden="true"><path d="M1 3.5C1 2.7 1.7 2 2.5 2h4.6l1.8 2h8.6c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5h-15C1.7 15 1 14.3 1 13.5z"/></svg>${label.textContent}`);
        b.type = 'button';
        label.replaceWith(b);
        b.after(h('span', '', label.textContent));
        b.nextSibling.hidden = true;
        b.addEventListener('click', () => pick(li));
      });
      pick(nodes[nodes.length - 1]);
    },

    // Cards that turn over to give the reason
    cards(fig) {
      const cards = $$(':scope > .ix-card', fig);
      const grid = h('div', 'ix-cards');
      cards[0]?.before(grid);
      cards.forEach((c) => {
        const v = c.dataset.verdict || 'neutral';
        const tag = v === 'do' ? 'Do' : v === 'dont' ? "Don't" : '';
        const b = h('button', `ix-card ix-card--${v}`, `<span class="ix-card-in"><span class="ix-face ix-face--f">${tag ? `<em>${tag}</em>` : ''}${$('.ix-front', c)?.innerHTML || ''}<small>Why?</small></span><span class="ix-face ix-face--b">${tag ? `<em>${tag}</em>` : ''}${$('.ix-back', c)?.innerHTML || ''}</span></span>`);
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')));
        grid.append(b);
        c.remove();
      });
    },
  };

  $$('figure.ix[data-ix]').forEach((fig) => {
    const fn = kinds[fig.dataset.ix];
    if (!fn) return;
    try { fn(fig); fig.classList.add('is-live'); } catch (e) { console.error(e); }
  });

  // Figures come in as they reach the reader
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
    $$('figure.ix, figure.dg').forEach((f) => io.observe(f));
  } else $$('figure.ix, figure.dg').forEach((f) => f.classList.add('is-in'));
})();
