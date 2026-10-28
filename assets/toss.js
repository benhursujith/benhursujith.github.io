/* Crumple: toss a crumpled page into Leopard's Trash past a desk fan, the way Paper Toss played on the 2009 iPhone.
   A small 3D scene (metres, y up, z away from the eye) projected by hand onto a 2D canvas: the Aurora wallpaper
   behind, the Dock's glass shelf as the floor, the mesh Trash, and a fan whose wind pushes the ball sideways.
   window.Toss(host, hooks) builds a game in host and returns a player ({ start, pause, resume, still }) for the
   window manager; window.Toss.icon(el) paints the Dock icon. Sounds are synthesised, nothing is sampled. */
(() => {
  'use strict';

  const G = 9.8, DRAG = 0.42, EYE = 2.4, FLIGHT = 0.98, WIND = 0.55;
  const BIN = { z: 4, r0: 0.315, r1: 0.38, h: 1, rim: 0.03, floor: 0.03 };
  const RB = 0.105;
  const HAND = { x: 0, y: 1.35, z: 1.15 };
  const FLOOR = { w: 2.6, far: 8 };
  const SHEET = { w: 0.23, h: 0.3 };
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
    };
  }

  /* A crumpled sheet of ruled paper: big folds and small creases (two sets of facets on a lumpy sphere), each
     facet tilted its own way, with bits of the blue rules running every which way. Painted once into a sprite. */
  function paintBall(size, seed) {
    const r = rng(seed), c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d'), img = x.createImageData(size, size), d = img.data;
    const facets = (n, tilt) => [...Array(n)].map(() => {
      const z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z), la = r() * Math.PI;
      return { p: [s * Math.cos(a), s * Math.sin(a), z], t: [(r() - 0.5) * tilt, (r() - 0.5) * tilt, (r() - 0.5) * tilt], lx: Math.cos(la), ly: Math.sin(la), lo: r(), ruled: r() < 0.4 };
    });
    const big = facets(15, 1.1), small = facets(54, 0.55);
    const near = (set, N) => {
      let b1 = -2, b2 = -2, k1 = 0;
      for (let k = 0; k < set.length; k++) {
        const p = set[k].p, dd = N[0] * p[0] + N[1] * p[1] + N[2] * p[2];
        if (dd > b1) { b2 = b1; b1 = dd; k1 = k; } else if (dd > b2) b2 = dd;
      }
      return [set[k1], b1 - b2];
    };
    const lobes = [2, 3, 4, 5, 7].map((k) => [0.01 + r() * 0.026, r() * TAU, k]);
    const radius = (t) => 0.9 + lobes.reduce((s, [a, ph, k]) => s + a * Math.sin(k * t + ph), 0);
    const L = norm([-0.42, -0.6, 0.68]);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const u = ((i + 0.5) / size) * 2 - 1, v = ((j + 0.5) / size) * 2 - 1;
        const rr = Math.hypot(u, v), R = radius(Math.atan2(v, u));
        const edge = ((R - rr) * size) / 2;
        if (edge <= -1) continue;
        const q = Math.min(rr / R, 0.999), N = [u / R, v / R, Math.sqrt(1 - q * q)];
        const [fb, gb] = near(big, N), [fs, gs] = near(small, N);
        const n = norm([N[0] + fb.t[0] + fs.t[0], N[1] + fb.t[1] + fs.t[1], N[2] + fb.t[2] + fs.t[2]]);
        let c = 0.7 + 0.36 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
        c *= 0.78 + 0.22 * N[2];
        if (gb < 0.016) c *= 0.82 + (0.18 * gb) / 0.016;
        if (gs < 0.01) c *= 0.92 + (0.08 * gs) / 0.01;
        let R8 = 254 * c, G8 = 252 * c, B8 = 247 * c;
        if (fb.ruled) {
          const t = (u * fb.lx + v * fb.ly) * 6.5 + fb.lo;
          if (t - Math.floor(t) < 0.05) { R8 *= 0.86; G8 *= 0.91; B8 *= 0.99; }
        }
        const o = (j * size + i) * 4;
        d[o] = Math.min(255, R8); d[o + 1] = Math.min(255, G8); d[o + 2] = Math.min(255, B8);
        d[o + 3] = 255 * clamp(edge + 1);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  const pathPoly = (x, pts) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); };
  const strokePts = (x, pts) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); };

  /* ---------- the desk fan: one painter for the game, the desktop's corner and the flight between them ----------
     A silver fan with Aqua-blue blades, turned 35° toward the eye and blowing away from `side` (-1 stands on the
     left and blows right). P projects world points; o = { fx, fz, side, angle, speed, mirror, only }, where `only`
     paints one part: 'back' (base, stem, motor), 'blades' or 'front' (the cage). */
  function paintFan(x, P, o) {
    const m = o.mirror ? -1 : 1, fx = o.fx, fz = o.fz, dir = -o.side, part = o.only;
    const a = 0.62, n = [dir * Math.cos(a), 0, -Math.sin(a)], U = [Math.sin(a), 0, dir * Math.cos(a)];
    const k = 1.25, C = [fx, 0.74 * k, fz], R = 0.27;
    const at = (u, v, w) => P(C[0] + (U[0] * u + n[0] * w) * k, (C[1] + v * k) * m, C[2] + (U[2] * u + n[2] * w) * k);
    const circ = (r, w, k = 32) => [...Array(k + 1)].map((_, i) => at(r * Math.cos((i / k) * TAU), r * Math.sin((i / k) * TAU), w));
    const s0 = P(fx, 0, fz)[2] * k;
    let g;
    if (!part || part === 'back') {
      // base and stem
      const base = (y) => [...Array(29)].map((_, i) => P(fx + 0.2 * k * Math.cos((i / 28) * TAU), y * k * m, fz + 0.2 * k * Math.sin((i / 28) * TAU)));
      g = x.createLinearGradient(P(fx - 0.2 * k, 0, fz)[0], 0, P(fx + 0.2 * k, 0, fz)[0], 0);
      g.addColorStop(0, '#8C96A4'); g.addColorStop(0.4, '#E9EDF2'); g.addColorStop(1, '#7C8696');
      x.fillStyle = g;
      pathPoly(x, [...base(0).slice(14), ...base(0.055).slice(14).reverse()]); x.fill();
      x.fillStyle = '#DDE2E9';
      pathPoly(x, base(0.055)); x.fill();
      x.strokeStyle = 'rgba(60,68,82,.5)'; x.lineWidth = 0.8; x.stroke();
      const sb = P(fx, 0.05 * k * m, fz), st = P(fx, 0.66 * k * m, fz), sw = 0.022 * s0;
      g = x.createLinearGradient(sb[0] - sw, 0, sb[0] + sw, 0);
      g.addColorStop(0, '#7E8898'); g.addColorStop(0.45, '#F2F5F8'); g.addColorStop(1, '#717C8C');
      x.fillStyle = g;
      x.fillRect(sb[0] - sw, Math.min(sb[1], st[1]), sw * 2, Math.abs(sb[1] - st[1]));
      // the motor, behind the blades
      const mc = at(0, 0, -0.2);
      g = x.createRadialGradient(mc[0] - 0.03 * s0, mc[1] - 0.04 * s0, 0, mc[0], mc[1], 0.13 * s0);
      g.addColorStop(0, '#F4F6F9'); g.addColorStop(1, '#848E9E');
      x.fillStyle = g;
      for (let w = -0.2; w <= -0.06; w += 0.035) { pathPoly(x, circ(0.105 + (w + 0.2) * 0.12, w, 24)); x.fill(); }
    }
    if (!part || part === 'blades') {
      // blades: translucent, Aqua blue, smearing into a disc as they speed up
      const sp = clamp(o.speed / 30);
      if (sp > 0.05) {
        x.fillStyle = `rgba(150,190,232,${(0.32 * sp).toFixed(3)})`;
        pathPoly(x, circ(R * 0.92, 0, 40)); x.fill();
      }
      x.fillStyle = `rgba(120,168,222,${(0.78 - 0.5 * sp).toFixed(3)})`;
      x.strokeStyle = `rgba(40,80,140,${(0.5 - 0.35 * sp).toFixed(3)})`;
      x.lineWidth = 0.7;
      for (let k = 0; k < 3; k++) {
        const base0 = o.angle + (k * TAU) / 3, pts = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10, r = 0.045 + 0.2 * t, hw = 0.08 + 0.42 * Math.sin(Math.PI * (0.12 + 0.88 * t)); pts.push(at(r * Math.cos(base0 - hw), r * Math.sin(base0 - hw), 0)); }
        for (let i = 10; i >= 0; i--) { const t = i / 10, r = 0.045 + 0.2 * t, hw = 0.08 + 0.42 * Math.sin(Math.PI * (0.12 + 0.88 * t)); pts.push(at(r * Math.cos(base0 + hw + 0.25 * t), r * Math.sin(base0 + hw + 0.25 * t), 0)); }
        pathPoly(x, pts); x.fill(); x.stroke();
      }
    }
    if (part && part !== 'front') return;
    // the cage
    x.lineWidth = Math.max(0.5, 0.006 * s0);
    for (let pass = 0; pass < 2; pass++) {
      x.strokeStyle = pass ? 'rgba(246,248,251,.9)' : 'rgba(50,58,72,.45)';
      const o = pass ? 0 : 0.7;
      x.beginPath();
      [0.27, 0.2, 0.13].forEach((r) => circ(r, 0.045, 36).forEach((p, i) => (i ? x.lineTo(p[0] + o, p[1] + o) : x.moveTo(p[0] + o, p[1] + o))));
      for (let k = 0; k < 16; k++) { const th = (k / 16) * TAU, p0 = at(0.05 * Math.cos(th), 0.05 * Math.sin(th), 0.05), p1 = at(R * Math.cos(th), R * Math.sin(th), 0.045); x.moveTo(p0[0] + o, p0[1] + o); x.lineTo(p1[0] + o, p1[1] + o); }
      x.stroke();
    }
    x.lineWidth = Math.max(1, 0.018 * s0); x.strokeStyle = '#E4E8EE';
    strokePts(x, circ(R, 0.045, 40));
    const bc = at(0, 0, 0.055);
    g = x.createRadialGradient(bc[0] - 0.012 * s0, bc[1] - 0.014 * s0, 0, bc[0], bc[1], 0.045 * s0);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#9AA4B2');
    x.fillStyle = g;
    pathPoly(x, circ(0.042, 0.055, 18)); x.fill();
  }

  // The fan's on-screen box under projection P, for cropping it and flying it about
  function fanBox(P, fx, fz, side) {
    const a = 0.62, dir = -side, k = 1.25, n = [dir * Math.cos(a), 0, -Math.sin(a)], U = [Math.sin(a), 0, dir * Math.cos(a)];
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const t = (i / 24) * TAU;
      for (const w of [-0.24, 0.06]) pts.push(P(fx + (U[0] * 0.29 * Math.cos(t) + n[0] * w) * k, (0.74 + 0.29 * Math.sin(t)) * k, fz + (U[2] * 0.29 * Math.cos(t) + n[2] * w) * k));
      for (const y of [0, 0.055]) pts.push(P(fx + 0.2 * k * Math.cos(t), y * k, fz + 0.2 * k * Math.sin(t)));
    }
    return [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
  }

  /* The fan as it's drawn every frame: its still parts painted once into two images (behind and in front of the
     blades) over `box`, so only the three blades are drawn fresh. `under` paints anything that sits beneath it. */
  function fanArt(P, o, box, pr, under) {
    const w = box[2] - box[0], h = box[3] - box[1];
    const paint = (only) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(w * pr)); c.height = Math.max(1, Math.ceil(h * pr));
      const x = c.getContext('2d');
      x.setTransform(pr, 0, 0, pr, -box[0] * pr, -box[1] * pr);
      if (under && only === 'back') under(x);
      paintFan(x, P, { ...o, only });
      return c;
    };
    const back = paint('back'), front = paint('front');
    return (x, angle, speed) => {
      x.drawImage(back, box[0], box[1], back.width / pr, back.height / pr);
      paintFan(x, P, { ...o, angle, speed, only: 'blades' });
      x.drawImage(front, box[0], box[1], front.width / pr, front.height / pr);
    };
  }

  // A soft round shadow, stretched to fit whatever casts it
  let blobArt = null;
  const blob = () => {
    if (blobArt) return blobArt;
    const c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = c.height = 64;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(10,6,24,.8)'); g.addColorStop(1, 'rgba(10,6,24,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (blobArt = c);
  };

  const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 3000 }) : (f) => setTimeout(f, 300);

  // The crumpled balls take a moment to paint, so each is painted once a visit, ahead of time where possible, and kept
  const balls = {};
  const ballArt = (seed) => balls[seed] || (balls[seed] = paintBall(160, seed));

  /* ---------- Sound: crumples, whooshes and clinks made from noise and sine partials ---------- */
  const snd = (() => {
    let ac = null, out = null, noise = null, on = true;
    try { on = localStorage.getItem('toss-sound') !== 'off'; } catch (e) {}
    // Opening the audio device takes the better part of a tenth of a second, so it's done as a finger or button goes
    // down (prime), and the click that follows only has to resume it
    const prime = () => {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        const lim = ac.createDynamicsCompressor();
        lim.threshold.value = -16; lim.knee.value = 10; lim.ratio.value = 8; lim.attack.value = 0.002; lim.release.value = 0.18;
        out = ac.createGain();
        out.gain.value = 0.9;
        out.connect(lim).connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const ch = noise.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
      }
    };
    const init = () => {
      prime();
      if (ac && ac.state === 'suspended') ac.resume();
    };
    const env = (g, t, peak, dur) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.008, dur * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    };
    const burst = (t, dur, type, freq, q, peak, toFreq) => {
      const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; s.loop = true;
      fl.type = type; fl.Q.value = q;
      fl.frequency.setValueAtTime(freq, t);
      if (toFreq) fl.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
      env(g, t, peak, dur);
      s.connect(fl).connect(g).connect(out);
      s.start(t, Math.random() * 0.9);
      s.stop(t + dur + 0.03);
    };
    const tone = (t, freq, dur, peak) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = freq;
      env(g, t, peak, dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.03);
    };
    const live = () => on && ac && ac.state === 'running';
    return {
      prime() { if (on) prime(); },
      init() { if (on) init(); },
      // Better still: once the visitor has clicked or tapped anywhere, open it while nothing is moving, and hold it
      // until the game starts
      warm() {
        const go = () => idle(() => { if (!on || ac) return; prime(); if (ac && ac.state === 'running') ac.suspend(); });
        if (navigator.userActivation?.hasBeenActive) go();
        else ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, go, { once: true, capture: true, passive: true }));
      },
      get on() { return on; },
      toggle() {
        on = !on;
        try { localStorage.setItem('toss-sound', on ? 'on' : 'off'); } catch (e) {}
        if (on) init();
        return on;
      },
      crumple(len = 0.42) {
        if (!live()) return;
        const t = ac.currentTime;
        for (let i = 0; i < 26; i++) burst(t + Math.random() * len, 0.01 + Math.random() * 0.03, 'bandpass', 1500 + Math.random() * 4800, 1.3, 0.3 + Math.random() * 0.5);
        burst(t, len + 0.05, 'lowpass', 1300, 0.7, 0.22);
      },
      whoosh(p) {
        if (!live()) return;
        burst(ac.currentTime, 0.28, 'bandpass', 420, 1.2, 0.5 * p, 1800);
      },
      rim(i) {
        if (!live() || i < 0.25) return;
        const t = ac.currentTime, a = Math.min(1, i / 3);
        [[1830, 0.32], [2790, 0.22], [4410, 0.14], [6020, 0.08]].forEach(([fq, k]) => tone(t, fq * (0.98 + Math.random() * 0.04), 0.18 + k, 0.2 * a * k * 3));
        burst(t, 0.02, 'highpass', 4000, 0.7, 0.3 * a);
      },
      wall(i) {
        if (!live() || i < 0.25) return;
        const t = ac.currentTime, a = Math.min(1, i / 3);
        burst(t, 0.07, 'bandpass', 2400, 2.5, 0.5 * a);
        tone(t, 1240, 0.09, 0.08 * a);
      },
      land() {
        if (!live()) return;
        const t = ac.currentTime;
        burst(t, 0.12, 'lowpass', 650, 0.8, 0.75);
        burst(t + 0.01, 0.06, 'bandpass', 3100, 2, 0.3);
      },
      glass(i) {
        if (!live() || i < 0.3) return;
        const t = ac.currentTime, a = Math.min(1, i / 3);
        tone(t, 3350, 0.06, 0.12 * a);
        burst(t, 0.03, 'bandpass', 900, 1, 0.35 * a);
      },
    };
  })();

  const ARROW = '<svg viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6h19M15 1.5 20.5 6 15 10.5"/></svg>';
  const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="tc-body" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="tc-on" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/><path class="tc-off" d="M15.5 9.5l5 5M20.5 9.5l-5 5"/></svg>';

  function Toss(host, hooks = {}) {
    const root = document.createElement('div');
    root.className = 'toss';
    root.innerHTML = `<canvas class="toss-bg" aria-hidden="true"></canvas><canvas class="toss-cv" tabindex="0" aria-label="Crumple: flick the paper ball into the Trash. Or aim with the left and right arrow keys and press Space."></canvas>
      <div class="toss-hud">
        <p class="toss-score" aria-live="polite"><b data-score>0</b><span data-best></span></p>
        <p class="toss-wind" aria-label="Wind"><i data-wind-dir>${ARROW}</i><span data-wind>0.0</span></p>
        <button class="toss-snd" type="button" aria-label="Sound" aria-pressed="${snd.on}">${SPEAKER}</button>
      </div>
      <p class="toss-tip" data-tip>Flick the paper into the Trash</p>`;
    host.append(root);
    // The scene is two canvases: the still backdrop, painted once, and above it everything that moves, cleared and
    // redrawn each frame from images painted ahead of time
    const cvBg = root.querySelector('.toss-bg'), bgx = cvBg.getContext('2d', { alpha: false });
    const cv = root.querySelector('.toss-cv'), ctx = cv.getContext('2d');
    const $ = (s) => root.querySelector(s);
    const scoreEl = $('[data-score]'), bestEl = $('[data-best]'), windEl = $('[data-wind]'), windDir = $('[data-wind-dir]'), tip = $('[data-tip]'), sndBtn = $('.toss-snd');

    const rand = rng((Date.now() & 0xffff) ^ 0x5a17);
    const sprites = [ballArt(11), ballArt(29), ballArt(47)];
    const wall = new Image();
    wall.src = `assets/retro/${matchMedia('(min-width: 901px)').matches ? 'wallpaper-aurora.jpg' : 'wallpaper-aurora-sm.jpg'}`;
    wall.onload = () => { if (W) bake(); };

    let W = 0, H = 0, pr = 1, f = 300, cx = 0, yh = 0, fanX = 1.4;
    let back = null, backEmpty = null, front = null, backBox = null, fans = {};
    let best = 0;
    try { best = +localStorage.getItem('toss-best') || 0; } catch (e) {}
    let streak = 0, total = 0;
    let wind = 0, air = 0, fanSide = -1, fanFade = hooks.deskFan ? 0 : 1, fanSwap = null, fanAngle = 0, fanSpeed = 0;
    let state = 'page', stateT = 0, sprite = sprites[0];
    let ball = null;
    const pile = [];
    let hold = null, aim = 0, keyAim = false, thrown = false;
    let running = false, raf = 0, last = 0, calm = false;
    const streaks = [...Array(18)].map(() => ({ x: (rand() * 2 - 1) * 3, y: 0.3 + rand() * 2.4, z: 1.8 + rand() * 4.4, k: 0.6 + rand() * 0.8 }));

    const P = (x, y, z) => [cx + (f * x) / z, yh + (f * (EYE - y)) / z, f / z];

    /* ---------- layout and the static layers ---------- */
    function layout() {
      const w = root.clientWidth, h = root.clientHeight;
      if (!w || !h) return false;
      const p = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      if (w === W && h === H && p === pr && front) return true;
      W = w; H = h; pr = p;
      cv.width = cvBg.width = Math.round(W * pr); cv.height = cvBg.height = Math.round(H * pr);
      f = Math.min(0.78 * H, 1.2 * W);
      yh = 0.93 * H - 1.01 * f;
      cx = W / 2;
      fanX = clamp(((W * 0.45) * (BIN.z + 0.25)) / f - 0.42, 0.95, 1.5);
      bake();
      return true;
    }

    const layer = (bx, by, bw, bh) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.ceil(bw * pr)); c.height = Math.max(1, Math.ceil(bh * pr));
      const x = c.getContext('2d');
      x.setTransform(pr, 0, 0, pr, -bx * pr, -by * pr);
      return { c, x, bx, by, bw, bh };
    };

    // A reflection in the shelf: drawn into a scratch layer, faded out with depth below the contact line, laid down
    let scratch = null;
    function reflect(x, y0, y1, alpha, paint) {
      if (!scratch || scratch.width !== cv.width || scratch.height !== cv.height) { scratch = document.createElement('canvas'); scratch.width = cv.width; scratch.height = cv.height; }
      const s = scratch.getContext('2d');
      s.setTransform(1, 0, 0, 1, 0, 0);
      s.clearRect(0, 0, scratch.width, scratch.height);
      s.setTransform(pr, 0, 0, pr, 0, 0);
      s.globalCompositeOperation = 'source-over';
      paint(s);
      s.globalCompositeOperation = 'destination-in';
      const g = s.createLinearGradient(0, y0, 0, Math.max(y0 + 1, y1));
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      s.fillStyle = g;
      s.fillRect(0, y0, W, H - y0);
      s.globalCompositeOperation = 'source-over';
      x.save();
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalAlpha = alpha;
      x.drawImage(scratch, 0, 0);
      x.restore();
    }

    function floorPoly() {
      const zn = Math.max(0.35, (f * EYE) / (H + 40 - yh));
      return [P(-FLOOR.w, 0, zn), P(FLOOR.w, 0, zn), P(FLOOR.w, 0, FLOOR.far), P(-FLOOR.w, 0, FLOOR.far)];
    }

    function bake() {
      if (!W) return;
      const x = bgx;
      x.setTransform(pr, 0, 0, pr, 0, 0);
      // the wallpaper, as the desktop shows it
      x.fillStyle = '#2B1642';
      x.fillRect(0, 0, W, H);
      if (wall.complete && wall.naturalWidth) {
        const s = Math.max(W / wall.naturalWidth, H / wall.naturalHeight) * 1.04;
        const iw = wall.naturalWidth * s, ih = wall.naturalHeight * s;
        x.drawImage(wall, (W - iw) / 2, clamp(yh - ih * 0.42, H - ih, 0), iw, ih);
      }
      // the Dock's glass shelf, laid flat as the floor
      const fp = floorPoly();
      x.save();
      pathPoly(x, fp);
      x.clip();
      const top = fp[2][1];
      let g = x.createLinearGradient(0, top, 0, H);
      g.addColorStop(0, 'rgba(255,255,255,.34)');
      g.addColorStop(0.45, 'rgba(226,232,246,.16)');
      g.addColorStop(1, 'rgba(190,198,218,.1)');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      reflect(x, P(0, 0, BIN.z - BIN.r0)[1], P(0, -BIN.h * 0.8, BIN.z - BIN.r0)[1], 0.3, (c) => drawBinShape(c, true));
      scratch = null;
      g = x.createLinearGradient(0, top, 0, top + (H - top) * 0.5);
      g.addColorStop(0, 'rgba(255,255,255,.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, top, W, H - top);
      // the bin's contact shadow
      const c0 = P(0, 0, BIN.z);
      g = x.createRadialGradient(c0[0], c0[1], 0, c0[0], c0[1], BIN.r0 * 1.7 * c0[2]);
      g.addColorStop(0, 'rgba(10,6,24,.42)');
      g.addColorStop(1, 'rgba(10,6,24,0)');
      x.fillStyle = g;
      x.save();
      x.translate(c0[0], c0[1]);
      x.scale(1, (EYE / BIN.z) * 1.05);
      x.translate(-c0[0], -c0[1]);
      x.beginPath(); x.arc(c0[0], c0[1], BIN.r0 * 1.7 * c0[2], 0, TAU); x.fill();
      x.restore();
      x.restore();
      // the shelf's edges catch the light, as the Dock's do
      x.lineWidth = 1;
      x.strokeStyle = 'rgba(255,255,255,.75)';
      x.beginPath(); x.moveTo(fp[3][0], fp[3][1]); x.lineTo(fp[2][0], fp[2][1]); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.35)';
      x.beginPath(); x.moveTo(fp[0][0], fp[0][1]); x.lineTo(fp[3][0], fp[3][1]); x.moveTo(fp[1][0], fp[1][1]); x.lineTo(fp[2][0], fp[2][1]); x.stroke();

      const t1 = P(-BIN.r1 - 0.1, BIN.h + 0.35, BIN.z - BIN.r1), b1 = P(BIN.r1 + 0.1, -0.05, BIN.z - BIN.r1);
      backBox = [t1[0], t1[1], b1[0] - t1[0], b1[1] - t1[1]];
      backEmpty = layer(...backBox);
      drawBinBack(backEmpty.x);
      bakeBack();
      front = layer(...backBox);
      drawBinFront(front.x);
      bakeFans();
    }

    function bakeBack() {
      back = layer(...backBox);
      back.x.save(); back.x.setTransform(1, 0, 0, 1, 0, 0); back.x.drawImage(backEmpty.c, 0, 0); back.x.restore();
      pile.slice().sort((a, b) => b.z - a.z || a.y - b.y).forEach((p) => drawBall(back.x, p, 1));
    }

    // The fan on either side of the Trash, with its shadow and its reflection in the shelf
    function bakeFans() {
      const fz = BIN.z + 0.25;
      for (const side of [-1, 1]) {
        const fx = side * fanX, b = fanBox(P, fx, fz, side), fs = P(fx, 0, fz);
        const rx = 0.32 * fs[2], ry = (0.32 * f * EYE) / (fz * fz);
        const box = [Math.min(b[0], fs[0] - rx) - 2, Math.min(b[1], fs[1] - ry) - 2, Math.max(b[2], fs[0] + rx) + 2, Math.max(b[3], fs[1] + ry) + 2];
        const art = fanArt(P, { fx, fz, side }, box, pr, (x) => {
          x.fillStyle = 'rgba(10,6,24,.245)';
          x.beginPath(); x.ellipse(fs[0], fs[1], rx, ry, 0, 0, TAU); x.fill();
        });
        // the reflection fades out within a short way below the contact line, so the blades barely reach it and it
        // can be painted once, still
        const mb = fanBox((X, Y, Z) => P(X, -Y, Z), fx, fz, side), y0 = fs[1], y1 = y0 + (y0 - P(fx, 1.3, fz)[1]) * 0.7;
        const refl = layer(mb[0] - 2, y0, mb[2] - mb[0] + 4, Math.max(1, Math.min(y1, mb[3]) - y0));
        paintFan(refl.x, P, { fx, fz, side, angle: 0.5, speed: 10, mirror: true });
        const g = refl.x.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        refl.x.globalCompositeOperation = 'destination-in';
        refl.x.fillStyle = g; refl.x.fillRect(refl.bx, refl.by, refl.bw, refl.bh);
        fans[side] = { art, refl };
      }
    }

    /* ---------- the Trash: Leopard's wire-mesh wastebasket ---------- */
    const radAt = (y) => BIN.r0 + ((BIN.r1 - BIN.r0) * clamp(y / BIN.h)) ;
    const binPt = (th, y, r, m = 1) => P(Math.sin(th) * r, y * m, BIN.z - Math.cos(th) * r);
    const tangent = (r) => Math.acos(clamp(r / BIN.z, 0, 1));
    function arc(y, r, a0, a1, n, m = 1) {
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(binPt(a0 + ((a1 - a0) * i) / n, y, r, m));
      return pts;
    }

    function drawBinShape(x, mirror) {
      // the silhouette only, for the reflection in the shelf
      const m = mirror ? -1 : 1, tt = tangent(BIN.r1), tb = tangent(BIN.r0);
      const pts = [...arc(BIN.h, BIN.r1, -tt, tt, 24, m), ...arc(0, BIN.r0, tb, -tb, 24, m)];
      x.fillStyle = 'rgba(205,214,226,1)';
      pathPoly(x, pts);
      x.fill();
      x.strokeStyle = 'rgba(240,244,250,1)';
      x.lineWidth = BIN.rim * 2 * P(0, 0, BIN.z)[2];
      strokePts(x, arc(BIN.h, BIN.r1, 0, TAU, 48, m));
    }

    function mesh(x, a0, a1, light) {
      const n = 44, rows = 12;
      x.lineWidth = Math.max(0.5, 0.0045 * P(0, 0, BIN.z)[2]);
      for (let pass = 0; pass < 2; pass++) {
        x.strokeStyle = pass ? light : 'rgba(60,70,88,.32)';
        const off = pass ? 0 : 0.6;
        x.beginPath();
        for (let k = 0; k < n; k++) {
          const th = (k / n) * TAU;
          let a = th;
          while (a < a0) a += TAU;
          while (a >= a0 + TAU) a -= TAU;
          if (a > a1) continue;
          const p0 = binPt(a, 0.02, BIN.r0), p1 = binPt(a, BIN.h - 0.02, BIN.r1);
          x.moveTo(p0[0] + off, p0[1] + off); x.lineTo(p1[0] + off, p1[1] + off);
        }
        for (let j = 1; j < rows; j++) {
          const y = (j / rows) * BIN.h, pts = arc(y, radAt(y), a0, a1, 22);
          pts.forEach((p, i) => (i ? x.lineTo(p[0] + off, p[1] + off) : x.moveTo(p[0] + off, p[1] + off)));
        }
        x.stroke();
      }
    }

    function rimStroke(x, y, r, a0, a1, tube, back) {
      const pts = arc(y, r, a0, a1, 40), w = tube * 2 * P(0, 0, BIN.z)[2];
      x.lineCap = 'round';
      x.lineWidth = w + 1.4; x.strokeStyle = 'rgba(52,60,74,.75)'; strokePts(x, pts);
      x.lineWidth = w; x.strokeStyle = back ? '#AEB6C1' : '#D5DBE3'; strokePts(x, pts);
      x.lineWidth = Math.max(0.6, w * 0.38); x.strokeStyle = back ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.95)';
      strokePts(x, pts.map((p) => [p[0], p[1] - w * 0.22]));
    }

    function drawBinBack(x) {
      const tt = tangent(BIN.r1), tb = tangent(BIN.r0);
      // the inside of the far wall, seen through the mouth and through the front mesh
      const pts = [...arc(BIN.h, BIN.r1, tt, TAU - tt, 30), ...arc(0, BIN.r0, TAU - tb, tb, 30)];
      const l = binPt(-Math.PI / 2, 0.5, BIN.r1)[0], r = binPt(Math.PI / 2, 0.5, BIN.r1)[0];
      let g = x.createLinearGradient(l, 0, r, 0);
      g.addColorStop(0, 'rgba(120,130,148,.55)');
      g.addColorStop(0.55, 'rgba(176,186,202,.42)');
      g.addColorStop(1, 'rgba(104,114,132,.6)');
      x.fillStyle = g;
      pathPoly(x, pts); x.fill();
      // the floor of the bin
      const fl = arc(BIN.floor, BIN.r0, 0, TAU, 40);
      const c = P(0, BIN.floor, BIN.z);
      g = x.createRadialGradient(c[0], c[1], 0, c[0], c[1], BIN.r0 * c[2]);
      g.addColorStop(0, 'rgba(70,78,96,.7)');
      g.addColorStop(1, 'rgba(118,128,146,.62)');
      x.fillStyle = g;
      pathPoly(x, fl); x.fill();
      mesh(x, tt, TAU - tt, 'rgba(236,240,246,.42)');
      rimStroke(x, BIN.h, BIN.r1, tt - 0.12, TAU - tt + 0.12, BIN.rim, true);
    }

    function drawBinFront(x) {
      const tt = tangent(BIN.r1), tb = tangent(BIN.r0);
      const pts = [...arc(BIN.h, BIN.r1, -tt, tt, 30), ...arc(0, BIN.r0, tb, -tb, 30)];
      const l = binPt(-tt, 0.5, BIN.r1)[0], r = binPt(tt, 0.5, BIN.r1)[0];
      const g = x.createLinearGradient(l, 0, r, 0);
      g.addColorStop(0, 'rgba(96,106,124,.55)');
      g.addColorStop(0.18, 'rgba(196,205,218,.34)');
      g.addColorStop(0.32, 'rgba(250,252,255,.46)');
      g.addColorStop(0.5, 'rgba(206,214,226,.26)');
      g.addColorStop(0.86, 'rgba(150,160,178,.36)');
      g.addColorStop(1, 'rgba(86,96,114,.6)');
      x.fillStyle = g;
      pathPoly(x, pts); x.fill();
      mesh(x, -tt, tt, 'rgba(255,255,255,.62)');
      // the silhouette edges
      x.lineWidth = 1; x.strokeStyle = 'rgba(70,80,98,.55)';
      [-1, 1].forEach((s) => { const a = binPt(s * tb, 0, BIN.r0), b = binPt(s * tt, BIN.h, BIN.r1); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); });
      rimStroke(x, 0.012, BIN.r0, -tb, tb, BIN.rim * 0.7, false);
      rimStroke(x, BIN.h, BIN.r1, -tt - 0.12, tt + 0.12, BIN.rim, false);
    }

    /* ---------- the ball and the page ---------- */
    function drawBall(x, b, alpha) {
      const p = P(b.x, b.y, b.z), d = (2 * RB * p[2]) / 0.9;
      x.save();
      x.globalAlpha *= alpha;
      x.translate(p[0], p[1]);
      x.rotate(b.rot || 0);
      x.drawImage(b.sprite || sprite, -d / 2, -d / 2, d, d);
      x.restore();
    }

    // A fast ball leaves a short smear along the way it came, as a camera's shutter would catch it, so the flight
    // reads as motion rather than as a ball hopping from frame to frame
    function drawMoving(x, b) {
      const q = b.prev;
      if (q && !calm) {
        const a = P(q[0], q[1], q[2]), c = P(b.x, b.y, b.z), d = (2 * RB * c[2]) / 0.9;
        const n = Math.min(5, Math.floor(Math.hypot(c[0] - a[0], c[1] - a[1]) / (d * 0.12)));
        for (let i = n; i >= 1; i--) {
          const t = 1 - (0.8 * i) / n;
          drawBall(x, { x: q[0] + (b.x - q[0]) * t, y: q[1] + (b.y - q[1]) * t, z: q[2] + (b.z - q[2]) * t, rot: q[3] + (b.rot - q[3]) * t, sprite: b.sprite }, b.fade * 0.42 * (1 - i / (n + 1)));
        }
      }
      drawBall(x, b, b.fade);
    }

    function drawShadow(x, b) {
      if (b.inside || b.y > 3.5 || b.y < 0) return;
      const p = P(b.x, 0, b.z), rx = RB * p[2] * (1 + b.y * 0.6), ry = (f * EYE * RB * (1 + b.y * 0.6)) / (b.z * b.z);
      x.globalAlpha = 0.5 * Math.exp(-b.y * 1.1);
      x.drawImage(blob(), p[0] - rx, p[1] - ry, rx * 2, ry * 2);
      x.globalAlpha = 1;
    }

    function drawPage(x, t) {
      // a ruled page slides up, then crumples into the ball
      const k = ease((t - 0.3) / 0.7), up = ease(t / 0.3);
      const c = P(HAND.x, HAND.y - (1 - up) * 0.7, HAND.z), s = c[2];
      const sc = 1 - k * 0.66, rot = -0.08 + k * 1.1;
      const wob = (u, v) => 1 + k * 0.3 * (Math.sin(u * 13 + 1.7) * Math.cos(v * 11 + 0.4) + 0.6 * Math.sin((u - v) * 19 + 2.2));
      const map = (u, v) => {
        const w = wob(u, v);
        let px = u * SHEET.w * sc * w, py = -v * SHEET.h * sc * w;
        const L = Math.hypot(px, py) || 1, cap = RB * 1.15;
        const pull = k * k;
        px = px * (1 - pull) + (px / L) * Math.min(L, cap) * pull;
        py = py * (1 - pull) + (py / L) * Math.min(L, cap) * pull;
        const cr = Math.cos(rot), sr = Math.sin(rot);
        return [c[0] + (px * cr - py * sr) * s, c[1] + (px * sr + py * cr) * s];
      };
      const edge = [];
      const side = (u0, v0, u1, v1) => { for (let i = 0; i < 12; i++) edge.push(map(u0 + ((u1 - u0) * i) / 12, v0 + ((v1 - v0) * i) / 12)); };
      side(-0.5, 0.5, 0.5, 0.5); side(0.5, 0.5, 0.5, -0.5); side(0.5, -0.5, -0.5, -0.5); side(-0.5, -0.5, -0.5, 0.5);
      const pageA = 1 - clamp((k - 0.62) / 0.3);
      if (pageA > 0) {
        x.save();
        // a soft shadow under the page: the page's own outline, dropped and spread a little (a real blur costs too much)
        x.fillStyle = 'rgba(10,6,24,.13)';
        for (const [dy, sp] of [[2, 1.02], [4, 1.05], [6, 1.08]]) {
          x.globalAlpha = pageA;
          pathPoly(x, edge.map((p) => [c[0] + (p[0] - c[0]) * sp, c[1] + dy + (p[1] - c[1]) * sp])); x.fill();
        }
        x.globalAlpha = pageA;
        const g = x.createLinearGradient(c[0] - 40, c[1] - 60, c[0] + 40, c[1] + 60);
        g.addColorStop(0, `rgb(${252 - k * 30},${251 - k * 30},${246 - k * 30})`);
        g.addColorStop(1, `rgb(${232 - k * 50},${231 - k * 50},${224 - k * 50})`);
        x.fillStyle = g;
        pathPoly(x, edge); x.fill();
        x.save();
        x.lineWidth = Math.max(0.6, 0.004 * s);
        x.strokeStyle = `rgba(110,150,205,${0.55 * (1 - k * 0.6)})`;
        for (let i = 0; i < 11; i++) { const v = 0.36 - i * 0.075; strokePts(x, [...Array(9)].map((_, j) => map(-0.5 + j / 8, v))); }
        x.strokeStyle = `rgba(214,80,70,${0.55 * (1 - k * 0.6)})`;
        strokePts(x, [...Array(9)].map((_, j) => map(-0.33, 0.5 - j / 8)));
        if (k > 0) {
          x.strokeStyle = `rgba(70,72,80,${0.3 * k})`;
          for (let i = 0; i < 7; i++) { const a = i * 2.3 + 0.4; strokePts(x, [map(Math.cos(a) * 0.45, Math.sin(a) * 0.45), map(Math.cos(a + 0.9) * 0.1, Math.sin(a + 1.4) * 0.12), map(Math.cos(a + 2.6) * 0.4, Math.sin(a + 2.1) * 0.4)]); }
        }
        x.restore();
        x.restore();
      }
      const ballA = clamp((k - 0.55) / 0.4);
      if (ballA > 0) drawBall(x, { x: HAND.x, y: HAND.y, z: HAND.z, rot: rot }, ballA);
    }

    /* ---------- the round: wind, the page, the throw ---------- */
    function newRound(first) {
      const maxW = Math.min(6, 1.1 + streak * 0.75);
      let w = first ? 0.5 + rand() * 0.8 : rand() * maxW;
      if (!first && rand() < 0.08) w = 0;
      w = Math.round(w * 10) / 10;
      const sign = first && desk ? 1 : rand() < 0.5 ? -1 : 1;
      const next = w * sign;
      const side = next > 0 ? -1 : next < 0 ? 1 : fanSide;
      if (first) fanSide = side;
      else if (side !== fanSide) fanSwap = { t: 0, to: side };
      wind = next;
      windEl.textContent = Math.abs(wind).toFixed(1);
      windDir.style.transform = wind < 0 ? 'scaleX(-1)' : '';
      windDir.style.opacity = wind === 0 ? '0' : '1';
      sprite = sprites[Math.floor(rand() * sprites.length)];
      state = 'page'; stateT = 0; ball = null; thrown = false;
      setTimeout(() => { if (state === 'page') snd.crumple(); }, 260);
    }

    function setScore() {
      scoreEl.textContent = streak;
      bestEl.textContent = best ? `Best ${best}` : '';
    }

    function throwBall(alpha, p) {
      const z0 = HAND.z, y0 = HAND.y + (hold ? hold.lift : 0), x0 = hold ? hold.dx : 0;
      const sHand = P(0, HAND.y, HAND.z)[1], sBin = P(0, BIN.h, BIN.z)[1];
      const Xt = (Math.tan(alpha) * (sHand - sBin) * BIN.z) / f;
      const Zt = z0 + (BIN.z - z0) * p, Yt = BIN.h - 0.02;
      const E = (1 - Math.exp(-DRAG * FLIGHT)) / DRAG;
      ball = {
        x: x0, y: y0, z: z0,
        vx: (Xt - x0) / E, vz: (Zt - z0) / E, vy: (Yt - y0 + (G * FLIGHT) / DRAG) / E - G / DRAG,
        rot: 0, spin: (rand() - 0.5) * 9 + Math.tan(alpha) * 6,
        sprite, inside: false, scored: false, t: 0, slow: 0, fade: 1,
      };
      hold = null;
      state = 'fly'; stateT = 0; thrown = true;
      tip.classList.add('is-gone');
      snd.whoosh(p);
    }

    function bounce(b, nx, ny, nz, e, fr, kind) {
      const vn = b.vx * nx + b.vy * ny + b.vz * nz;
      if (vn >= 0) return;
      if (vn > -0.3) { b.vx -= vn * nx; b.vy -= vn * ny; b.vz -= vn * nz; return; }
      b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz;
      const tx = b.vx - (b.vx * nx + b.vy * ny + b.vz * nz) * nx, ty = b.vy - (b.vx * nx + b.vy * ny + b.vz * nz) * ny, tz = b.vz - (b.vx * nx + b.vy * ny + b.vz * nz) * nz;
      b.vx -= tx * (1 - fr); b.vy -= ty * (1 - fr); b.vz -= tz * (1 - fr);
      b.spin *= -0.6;
      if (kind === 'rim') snd.rim(-vn);
      else if (kind === 'wall') snd.wall(-vn);
      else if (kind === 'glass') snd.glass(-vn);
    }

    function physics(b, dt) {
      b.vx += -DRAG * (b.vx - wind * WIND) * dt;
      b.vy += (-G - DRAG * b.vy) * dt;
      b.vz += -DRAG * b.vz * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.rot += b.spin * dt;
      const dx = b.x, dz = b.z - BIN.z, d = Math.hypot(dx, dz) || 1e-6, ux = dx / d, uz = dz / d;
      if (b.y > BIN.h) b.inside = d < BIN.r1;
      // the rolled rim
      const qx = ux * BIN.r1, qz = BIN.z + uz * BIN.r1;
      let nx = b.x - qx, ny = b.y - BIN.h, nz = b.z - qz;
      const dist = Math.hypot(nx, ny, nz), min = RB + BIN.rim;
      if (dist < min) {
        nx /= dist; ny /= dist; nz /= dist;
        b.x += nx * (min - dist); b.y += ny * (min - dist); b.z += nz * (min - dist);
        bounce(b, nx, ny, nz, 0.38, 0.85, b.inside && ny < 0.3 ? 'wall' : 'rim');
      }
      // the mesh walls
      if (b.y < BIN.h && b.y > -RB) {
        const R = radAt(b.y);
        if (b.inside && d > R - RB) {
          b.x = ux * (R - RB); b.z = BIN.z + uz * (R - RB);
          bounce(b, -ux, 0, -uz, 0.28, 0.8, 'wall');
        } else if (!b.inside && d < R + RB) {
          b.x = ux * (R + RB); b.z = BIN.z + uz * (R + RB);
          bounce(b, ux, 0, uz, 0.35, 0.8, 'wall');
        }
      }
      // the pile, then the bin's own floor
      if (b.inside) {
        for (const p of pile) {
          let px = b.x - p.x, py = b.y - p.y, pz = b.z - p.z;
          const pd = Math.hypot(px, py, pz);
          if (pd < 2 * RB * 0.92 && pd > 1e-6) {
            px /= pd; py /= pd; pz /= pd;
            const push = 2 * RB * 0.92 - pd;
            b.x += px * push; b.y += py * push; b.z += pz * push;
            bounce(b, px, py, pz, 0.12, 0.55);
          }
        }
        if (b.y < BIN.floor + RB) { b.y = BIN.floor + RB; bounce(b, 0, 1, 0, 0.18, 0.55); }
        if (!b.scored && b.y < BIN.h - RB) { b.scored = true; scored(); }
      } else if (b.y < RB && Math.abs(b.x) < FLOOR.w && b.z < FLOOR.far && b.z > 0.2) {
        // the glass shelf
        b.y = RB;
        if (b.vy < -0.6) bounce(b, 0, 1, 0, 0.32, 0.78, 'glass');
        else { b.vy = Math.max(0, b.vy); b.vx -= b.vx * 2.4 * dt; b.vz -= b.vz * 2.4 * dt; b.spin -= b.spin * 3 * dt; }
      }
    }

    function scored() {
      streak++; total++;
      snd.land();
      if (streak > best) {
        best = streak;
        try { localStorage.setItem('toss-best', String(best)); } catch (e) {}
      }
      setScore();
      scoreEl.parentElement.classList.remove('is-up'); void scoreEl.offsetWidth; scoreEl.parentElement.classList.add('is-up');
      hooks.onScore?.(total);
    }

    function update(dt) {
      stateT += dt;
      // the fan follows the wind: it slips out, crosses over, and comes back on the side the wind blows from
      const target = calm ? 0 : Math.abs(wind) * 6;
      fanSpeed += (target - fanSpeed) * Math.min(1, dt * 1.6);
      fanAngle += fanSpeed * dt;
      if (fanSwap) {
        fanSwap.t += dt;
        if (fanSwap.t < 0.25) fanFade = 1 - fanSwap.t / 0.25;
        else { fanSide = fanSwap.to; fanFade = Math.min(1, (fanSwap.t - 0.25) / 0.3); if (fanSwap.t > 0.55) { fanFade = 1; fanSwap = null; } }
      }
      air += (wind - air) * Math.min(1, dt * 3);
      if (!calm) for (const s of streaks) { s.x += air * WIND * 1.6 * s.k * dt; if (s.x > 3) s.x -= 6; if (s.x < -3) s.x += 6; }

      if (state === 'page' && stateT > 0.78) { state = 'ready'; stateT = 0; }
      if (state === 'fly') {
        const b = ball;
        b.t += dt;
        b.prev = [b.x, b.y, b.z, b.rot];
        const n = Math.ceil(dt / (1 / 240));
        for (let i = 0; i < n; i++) physics(b, dt / n);
        const speed = Math.hypot(b.vx, b.vy, b.vz);
        b.slow = speed < 0.14 ? b.slow + dt : 0;
        if (b.scored) {
          if (b.slow > 0.2 || b.t > 4) {
            pile.push({ x: b.x, y: b.y, z: b.z, rot: b.rot, sprite: b.sprite });
            if (pile.length > 18) { pile.splice(0); setTimeout(() => snd.crumple(0.7), 120); }
            bakeBack();
            ball = null; state = 'next'; stateT = 0;
          }
        } else if (b.slow > 0.25 || b.t > 4.5 || b.y < -2 || b.z > 14) {
          state = 'miss'; stateT = 0;
        }
      }
      if (state === 'miss') {
        ball.fade = 1 - stateT / 0.4;
        if (stateT > 0.4) {
          streak = 0; setScore();
          ball = null; state = 'next'; stateT = 0;
        }
      }
      if (state === 'next' && stateT > 0.3) newRound(false);
    }

    function draw() {
      if (!W || !front) return;
      const x = ctx;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, cv.width, cv.height);
      x.setTransform(pr, 0, 0, pr, 0, 0);
      const fan = fans[fanSide], b = ball;
      // reflections in the shelf: the fan and the ball
      x.globalAlpha = 0.22 * fanFade;
      x.drawImage(fan.refl.c, fan.refl.bx, fan.refl.by, fan.refl.bw, fan.refl.bh);
      x.globalAlpha = 1;
      if (b && !b.inside && b.y > 0 && Math.abs(b.x) < FLOOR.w - RB && b.z < FLOOR.far - RB) drawBall(x, { ...b, y: -b.y }, 0.16 * b.fade * Math.exp(-b.y * 0.6));
      // the fan, with its shadow
      x.globalAlpha = fanFade;
      fan.art(x, fanAngle, calm ? 0 : fanSpeed);
      x.globalAlpha = 1;

      const behind = b && !b.inside && b.z > BIN.z && b.y < BIN.h + RB;
      if (b) drawShadow(x, b);
      if (b && behind) drawMoving(x, b);
      x.drawImage(back.c, back.bx, back.by, back.bw, back.bh);
      if (b && b.inside) drawMoving(x, b);
      x.drawImage(front.c, front.bx, front.by, front.bw, front.bh);
      if (b && !b.inside && !behind) drawMoving(x, b);

      if (state === 'page') drawPage(x, stateT / 0.78);
      if (state === 'ready') {
        const bob = calm ? 0 : Math.sin(performance.now() / 420) * 0.008;
        const hb = { x: HAND.x + (hold ? hold.dx : 0), y: HAND.y + bob + (hold ? hold.lift : 0), z: HAND.z, rot: 1.02 };
        if (!hold) {
          const sh = P(HAND.x, HAND.y - 0.16, HAND.z), rx = RB * sh[2] * 1.15, ry = RB * sh[2] * 0.3;
          x.globalAlpha = 0.45;
          x.drawImage(blob(), sh[0] - rx, sh[1] - ry, rx * 2, ry * 2);
          x.globalAlpha = 1;
        }
        drawBall(x, hb, 1);
        if (keyAim) {
          const s = P(hb.x, hb.y, hb.z), len = 0.22 * H, a = aim * 0.7;
          x.save();
          x.setLineDash([3, 5]); x.lineWidth = 2; x.lineCap = 'round';
          x.strokeStyle = 'rgba(255,255,255,.8)';
          x.beginPath(); x.moveTo(s[0], s[1] - RB * s[2]); x.lineTo(s[0] + Math.sin(a) * len, s[1] - RB * s[2] - Math.cos(a) * len); x.stroke();
          x.restore();
        }
      }

      // wind in the air: each streak fades in and out at the ends of its run instead of popping, and they all ease
      // round when the wind changes
      if (Math.abs(air) > 0.02) {
        x.save();
        x.lineCap = 'round';
        const a = Math.min(1, Math.abs(air) / 2.5);
        for (const s of streaks) {
          const p0 = P(s.x, s.y, s.z), p1 = P(s.x - air * 0.07 * s.k, s.y, s.z);
          x.strokeStyle = `rgba(255,255,255,${(0.22 * a * clamp((3 - Math.abs(s.x)) / 0.9)).toFixed(3)})`;
          x.lineWidth = Math.max(0.6, 0.012 * p0[2]);
          x.beginPath(); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.stroke();
        }
        x.restore();
      }
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      update(dt);
      draw();
    }

    /* ---------- input: flick with a finger or the mouse; arrows and Space on a keyboard ---------- */
    // Each event's own time, so a busy frame can't squash a flick's speed; and every point the pointer reported
    // between frames, so a fast flick keeps its shape
    const stamp = (e) => { const t = e.timeStamp, n = performance.now(); return t > 0 && Math.abs(n - t) < 1000 ? t : n; };
    const local = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) * W) / (r.width || 1), ((e.clientY - r.top) * H) / (r.height || 1)]; };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      root.classList.add('by-pointer');
      snd.init();
      if (state === 'page' && stateT > 0.55) { state = 'ready'; stateT = 0; }
      if (state !== 'ready' || hold) return;
      e.preventDefault();
      cv.focus({ preventScroll: true });
      cv.setPointerCapture(e.pointerId);
      keyAim = false;
      const [lx, ly] = local(e);
      hold = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx, ly, pts: [{ x: e.clientX, y: e.clientY, t: stamp(e) }], path: [], dx: 0, lift: 0 };
      root.classList.add('is-holding');
    });
    cv.addEventListener('pointermove', (e) => {
      if (!hold || e.pointerId !== hold.id) return;
      const all = e.getCoalescedEvents?.() || [], now = stamp(e);
      for (const q of all.length ? all : [e]) {
        hold.pts.push({ x: q.clientX, y: q.clientY, t: Math.min(now, stamp(q)) });
        if (hold.path.length < 600) hold.path.push([q.clientX, q.clientY]);
      }
      while (hold.pts.length > 2 && now - hold.pts[0].t > 140) hold.pts.shift();
      const [lx, ly] = local(e), s = f / HAND.z;
      hold.dx = clamp(((lx - hold.lx) * 0.3) / s, -0.12, 0.12);
      hold.lift = clamp((-(ly - hold.ly) * 0.3) / s, -0.04, 0.16);
    });
    const release = (e) => {
      if (!hold || e.pointerId !== hold.id) return;
      root.classList.remove('is-holding');
      const now = stamp(e), pts = hold.pts.filter((p) => now - p.t < 110);
      const a = pts[0], z = { x: e.clientX, y: e.clientY, t: now };
      const dt = Math.max(0.016, (z.t - (a ? a.t : now)) / 1000);
      let vx = a ? (z.x - a.x) / dt : 0, vy = a ? (z.y - a.y) / dt : 0;
      const tx = z.x - hold.x0, ty = z.y - hold.y0;
      let p = 1;
      if (vy > -180) {
        if (ty > -36) { hold = null; return; }
        vx = tx; vy = ty; p = 0.95;   // a slow drag still throws, a little short
      } else {
        const sp = Math.hypot(vx, vy);
        p = 1 + 0.075 * Math.tanh((sp - 1300) / 900);
      }
      // aim along the stroke from where the ball was picked up to about two thirds of the way up,
      // because a thumb's flick curls off at the end
      let aimX = vx, aimY = vy;
      if (ty < -40) {
        const k = hold.path.find(([, y]) => hold.y0 - y >= -ty * 0.65) || [z.x, z.y];
        aimX = k[0] - hold.x0; aimY = k[1] - hold.y0;
      }
      throwBall(clamp(Math.atan2(aimX, -aimY), -0.9, 0.9), p);
    };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', (e) => { if (hold && e.pointerId === hold.id) { hold = null; root.classList.remove('is-holding'); } });
    cv.addEventListener('keydown', (e) => {
      root.classList.remove('by-pointer');
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        keyAim = true;
        aim = clamp(aim + (e.key === 'ArrowRight' ? 0.05 : -0.05), -1, 1);
      } else if ((e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') && state === 'ready') {
        e.preventDefault();
        snd.init();
        keyAim = true;
        throwBall(aim * 0.7, 1);
      } else if (e.key === ' ') e.preventDefault();
    });
    sndBtn.addEventListener('click', () => sndBtn.setAttribute('aria-pressed', String(snd.toggle())));

    const ro = new ResizeObserver(() => { layout(); if (!running) draw(); });
    ro.observe(root);

    /* ---------- the fan comes in from the desktop's corner, and goes back there when the game closes ---------- */
    const desk = hooks.deskFan || null;
    let arrived = !desk, flight = null;
    function fanShot() {
      const fx = fanSide * fanX, fz = BIN.z + 0.25, b = fanBox(P, fx, fz, fanSide), pad = 4;
      const r = cv.getBoundingClientRect(), vis = r.width / W || 1, box = [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad];
      return {
        rect: { left: r.left + box[0] * vis, top: r.top + box[1] * vis, width: (box[2] - box[0]) * vis, height: (box[3] - box[1]) * vis },
        P: (X, Y, Z) => { const q = P(X, Y, Z); return [(q[0] - box[0]) * vis, (q[1] - box[1]) * vis, q[2] * vis]; },
        fan: { fx, fz, side: fanSide, angle: fanAngle },
      };
    }
    function arrive() {
      arrived = true; flight = null;
      fanFade = 1; fanSpeed = 0;
      root.classList.add('is-on');
      newRound(true);
    }
    function fetchFan() {
      const from = desk.rect();
      desk.hide();
      if (calm || !from) { arrive(); return; }
      fanFade = 0;
      flight = Toss.fly(from, fanShot(), true, arrive);
    }

    setScore();
    if (arrived) { root.classList.add('is-on'); newRound(true); }
    else state = 'wait';

    const go = () => {
      if (running) return;
      layout();
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
      if (!arrived && !flight) fetchFan();
    };
    return {
      running: false,
      start() { calm = false; go(); },
      resume() { go(); },
      still() { calm = true; go(); },
      pause() { running = false; cancelAnimationFrame(raf); hold = null; },
      closing(immediate) {
        if (!desk) return;
        if (flight) { flight.cancel(); flight = null; }
        const to = desk.rect();
        if (immediate || calm || !arrived || !W || !to) { desk.show(); return; }
        const g = fanShot();
        fanFade = 0; draw();
        Toss.fly(to, g, false, () => desk.show());
      },
    };
  }

  /* A fan flying between the desktop's corner (small) and its place in the game (big, g = fanShot()). It is drawn at
     the big size and scaled, along a shallow arc, spinning as it goes. */
  Toss.fly = (small, g, inward, done) => {
    const big = g.rect, c = document.createElement('canvas'), pr = Math.min(2, window.devicePixelRatio || 1);
    c.className = 'toss-flyer';
    c.width = Math.max(1, Math.round(big.width * pr)); c.height = Math.max(1, Math.round(big.height * pr));
    Object.assign(c.style, { left: `${big.left}px`, top: `${big.top}px`, width: `${big.width}px`, height: `${big.height}px` });
    document.body.append(c);
    const x = c.getContext('2d'), art = fanArt(g.P, g.fan, [0, 0, big.width, big.height], pr), dur = 780;
    const lift = Math.min(140, Math.hypot(big.left - small.left, big.top - small.top) * 0.2);
    let angle = g.fan.angle, t0 = 0, last = 0, raf = 0;
    const step = (now) => {
      // the clock starts on the first frame, so the time spent painting the fan doesn't eat into the flight
      if (!t0) t0 = last = now;
      const p = clamp((now - t0) / dur), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      const q = inward ? e : 1 - e;
      const s = (small.height + (big.height - small.height) * q) / big.height;
      const lx = small.left + (big.left - small.left) * q, ly = small.top + (big.top - small.top) * q - Math.sin(Math.PI * q) * lift;
      c.style.transform = `translate(${(lx - big.left).toFixed(1)}px, ${(ly - big.top).toFixed(1)}px) scale(${s.toFixed(4)}) rotate(${(-7 * Math.sin(Math.PI * q)).toFixed(2)}deg)`;
      angle += (24 * (now - last)) / 1000; last = now;
      x.setTransform(pr, 0, 0, pr, 0, 0);
      x.clearRect(0, 0, big.width, big.height);
      art(x, angle, 24);
      if (p < 1) raf = requestAnimationFrame(step);
      else { c.remove(); done?.(); }
    };
    raf = requestAnimationFrame(step);
    return { cancel() { cancelAnimationFrame(raf); c.remove(); } };
  };

  /* The way in: a small fan in the desktop's bottom-left corner, blowing a breeze toward the Dock. Hovering it, or the
     page in the Dock, spins it up and sets the page swaying; every so often a gust rocks the page toward the Trash. */
  Toss.deskFan = (btn, opts = {}) => {
    if (!btn) return null;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cv = document.createElement('canvas'), x = cv.getContext('2d');
    cv.className = 'dt-deskfan-cv';
    btn.prepend(cv);
    const FX = -1.5, FZ = BIN.z + 0.25, BREEZE = 3.4;
    const P0 = (X, Y, Z) => [X / Z, (EYE - Y) / Z, 1 / Z];
    const b0 = fanBox(P0, FX, FZ, -1), bh = b0[3] - b0[1];
    btn.style.aspectRatio = ((b0[2] - b0[0]) / bh).toFixed(4);
    let w = 0, h = 0, pr = 1, sc = 1, angle = 0, speed = 0, raf = 0, last = 0, on = false, away = false, hover = 0, gust = 0, gustAt = 0, art = null;
    const streaks = [...Array(8)].map(() => ({ x: Math.random(), y: 0.18 + Math.random() * 0.4, k: 0.6 + Math.random() * 0.8 }));
    const P = (X, Y, Z) => { const q = P0(X, Y, Z); return [(q[0] - b0[0]) * sc, (q[1] - b0[1]) * sc, q[2] * sc]; };
    const scope = opts.scope;
    function size() {
      w = btn.clientWidth; h = btn.clientHeight;
      if (!w || !h) return false;
      const vis = btn.getBoundingClientRect().height / h || 1;
      pr = Math.min(2, Math.max(1, (window.devicePixelRatio || 1) * vis));
      sc = h / bh;
      cv.style.width = `${w * (1 + BREEZE)}px`;
      cv.width = Math.round(w * (1 + BREEZE) * pr); cv.height = Math.round(h * pr);
      art = fanArt(P, { fx: FX, fz: FZ, side: -1 }, [0, 0, w, h], pr);
      return true;
    }
    function draw() {
      if (!w && !size()) return;
      x.setTransform(pr, 0, 0, pr, 0, 0);
      x.clearRect(0, 0, w * (1 + BREEZE), h);
      if (away) return;
      const a = clamp(speed / 26);
      x.lineCap = 'round'; x.lineWidth = 1;
      for (const s of streaks) {
        const sx = w * 0.95 + s.x * w * BREEZE, sy = h * s.y, len = w * (0.14 + 0.34 * a) * s.k;
        x.strokeStyle = `rgba(255,255,255,${((1 - s.x) * (0.1 + 0.42 * a)).toFixed(3)})`;
        x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx - len, sy); x.stroke();
      }
      art(x, angle, speed);
    }
    function tick(now) {
      // nothing to spin while the fan is away in the game
      if (away) { raf = 0; return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (now > gustAt) {
        gust = 1.5; gustAt = now + 9000 + Math.random() * 6000;
        if (!shown) { shown = true; blowPage(); }
        scope?.classList.add('is-gust');
        setTimeout(() => scope?.classList.remove('is-gust'), 1500);
      }
      gust = Math.max(0, gust - dt);
      const want = hover ? 28 : gust > 0 ? 22 : 7;
      speed += (want - speed) * Math.min(1, dt * 2.2);
      angle += speed * dt;
      for (const s of streaks) { s.x += (0.05 + speed * 0.012) * s.k * dt; if (s.x > 1) { s.x -= 1; s.y = 0.18 + Math.random() * 0.4; } }
      draw();
      raf = requestAnimationFrame(tick);
    }
    // The first gust of a visit blows a crumpled page out of the corner, over the Dock and into the Trash:
    // the whole game in one breath, before anyone has read a word.
    let shown = false;
    function blowPage() {
      const trash = opts.trash, icon = trash?.querySelector('.dt-icon') || trash;
      if (!scope || !icon) return;
      const hr = scope.getBoundingClientRect(), fr = btn.getBoundingClientRect(), tr = icon.getBoundingClientRect();
      const vis = hr.width / scope.clientWidth || 1, d = (fr.height * 0.34) / vis;
      const c = document.createElement('canvas'), q = Math.round(d * 2);
      c.width = c.height = q;
      c.getContext('2d').drawImage(ballArt(29), 0, 0, q, q);
      c.className = 'dt-deskfan-page';
      Object.assign(c.style, { width: `${d}px`, height: `${d}px` });
      scope.append(c);
      const sx = (fr.right - hr.left) / vis - d * 0.4, sy = (fr.top - hr.top) / vis + fr.height * 0.18 / vis;
      const ex = (tr.left + tr.width / 2 - hr.left) / vis - d / 2, ey = (tr.top - hr.top) / vis + tr.height * 0.12 / vis - d / 2;
      const arc = Math.max(40, Math.abs(ex - sx) * 0.22), frames = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const y = sy + (ey - sy) * t * t - arc * Math.sin(Math.PI * Math.min(1, t * 1.15));
        frames.push({ transform: `translate(${(sx + (ex - sx) * e).toFixed(1)}px, ${y.toFixed(1)}px) rotate(${Math.round(t * 760)}deg) scale(${(t > 0.9 ? 1 - (t - 0.9) * 4 : 0.7 + Math.min(1, t * 6) * 0.3).toFixed(3)})`, opacity: t < 0.06 ? t / 0.06 : t > 0.94 ? (1 - t) / 0.06 : 1 });
      }
      c.animate(frames, { duration: 1900, easing: 'linear' }).finished.then(() => {
        c.remove();
        trash.classList.add('is-full', 'is-hit');
        setTimeout(() => trash.classList.remove('is-hit'), 500);
      });
    }
    const breezy = (v) => () => { hover = v; scope?.classList.toggle('is-breezy', !!v && !still); };
    [btn, opts.link].forEach((el) => {
      if (!el) return;
      el.addEventListener('pointerdown', () => snd.prime());
      el.addEventListener('click', () => snd.init());
      el.addEventListener('pointerenter', breezy(1)); el.addEventListener('pointerleave', breezy(0));
      el.addEventListener('focus', breezy(1)); el.addEventListener('blur', breezy(0));
    });
    new ResizeObserver(() => { if (size()) draw(); }).observe(btn);
    let ready = false;
    const spin = () => {
      if (on && !ready) { ready = true; [29, 47].forEach((k) => idle(() => ballArt(k))); idle(blob); snd.warm(); }
      cancelAnimationFrame(raf);
      if (on && !still && !away) { last = performance.now(); if (gustAt < last) gustAt = last + 3500 + Math.random() * 2500; raf = requestAnimationFrame(tick); }
      else draw();
    };
    return {
      run(v) {
        if (v === on) return;
        on = v;
        spin();
      },
      rect() { const r = btn.getBoundingClientRect(); return r.width && r.height ? r : null; },
      hide() { away = true; btn.classList.add('is-away'); spin(); },
      show() { away = false; btn.classList.remove('is-away'); spin(); },
    };
  };

  // The Dock icon: one crumpled page standing on the shelf
  Toss.icon = (el) => {
    const c = document.createElement('canvas'), s = 112;
    c.width = c.height = s;
    const x = c.getContext('2d'), b = ballArt(11);
    x.drawImage(b, s * 0.13, s * 0.2, s * 0.74, s * 0.74);
    el.append(c);
  };

  window.Toss = Toss;
  document.querySelectorAll('[data-toss-icon]').forEach((el) => Toss.icon(el));
})();
