/* The laptop's body, drawn in WebGL: the original MacBook Air (2008), modelled on its real profile (traced from
   Apple's side view of it) and lit like a studio shot, so the rounded edges and the wedge stay clean from any angle.
   The screen stays HTML: site.js lays it out with CSS 3D as before, and this canvas sits just under it, projected
   with the same perspective, so the two line up. Without WebGL the CSS laptop stays as it was. */
window.MacGL = (() => {
  const MM = 1 / 325;            // a millimetre, in widths of the machine (325 mm)
  const D = 0.69;                // depth over width: --Hl / --W in the CSS
  const RF = 0.024, RR = 0.008;  // corner radii in plan, front and hinge (the screen face's border-radius)
  const LT = 4 * MM;             // the lid

  // Base thickness in mm from the front edge (0) to the hinge (1), measured off Apple's side view of the 2008
  // model: a rounded nose, a straight taper under the keyboard, and a rounded spine where the lid hinges.
  const PROFILE = [[0, 1.9], [0.026, 3.7], [0.052, 4.8], [0.078, 5.7], [0.104, 6.6], [0.13, 7.3], [0.155, 8], [0.18, 8.7],
    [0.21, 9.4], [0.26, 10.1], [0.31, 10.5], [0.36, 10.9], [0.41, 11.2], [0.47, 11.6], [0.52, 11.9], [0.57, 12.2], [0.7, 13],
    [0.75, 13.3], [0.83, 13.7], [0.86, 13.85], [0.885, 13.6], [0.91, 12.3], [0.935, 11.2], [0.96, 10], [0.985, 8.2], [1, 6.8]];
  const TMAX = 13.85 * MM;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Monotone cubic through the measured points, so the curve never bulges between them
  function monotone(pts) {
    const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), d = [], m = [];
    for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (!d[i]) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return (x) => {
      x = clamp(x, xs[0], xs[n - 1]);
      let i = 0;
      while (i < n - 2 && x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (3 * t2 - 2 * t3) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  const tAt = monotone(PROFILE);
  const thick = (z) => tAt(1 - z / D) * MM;   // z: 0 at the hinge, D at the front

  // ---------- Geometry ----------
  // The plan outline as stations that keep their order at every inset, so rings at different insets stitch
  // into strips. Coordinates (a, b): a across, b from 0 to D; r0 rounds the b = 0 corners, r1 the b = D ones.
  function outline(r0, r1) {
    const P = Math.PI;
    const arc = (cx, cb, r, t0, t1, sx, sb) => {
      const n = Math.max(5, Math.round(r * 520)), out = [];
      for (let i = 0; i <= n; i++) { const th = t0 + (t1 - t0) * (i / n); out.push({ cx, cb, r, th, sx, sb, n: [Math.cos(th), Math.sin(th)] }); }
      return out;
    };
    // the long sides get more stations near their ends, where the base's thickness changes fastest
    const side = Array.from({ length: 34 }, (_, i) => 0.5 - 0.5 * Math.cos((P * (i + 1)) / 35));
    const end = Array.from({ length: 22 }, (_, i) => (i + 1) / 23);
    const edge = (A, B, n, ss) => ss.map((s) => ({ A, B, s, n }));
    const last = (x) => x[x.length - 1];
    const a = arc(r0, r0, r0, -P / 2, -P, -1, -1);
    const b = arc(r1, D - r1, r1, P, P / 2, -1, 1);
    const c = arc(1 - r1, D - r1, r1, P / 2, 0, 1, 1);
    const d = arc(1 - r0, r0, r0, 0, -P / 2, 1, -1);
    return [...a, ...edge(last(a), b[0], [-1, 0], side), ...b, ...edge(last(b), c[0], [0, 1], end),
      ...c, ...edge(last(c), d[0], [1, 0], side), ...d, ...edge(last(d), a[0], [0, -1], end)];
  }
  function at(st, d) {
    if (st.A) { const p = at(st.A, d), q = at(st.B, d); return [p[0] + (q[0] - p[0]) * st.s, p[1] + (q[1] - p[1]) * st.s]; }
    const r = st.r - d;
    return r >= 0 ? [st.cx + r * Math.cos(st.th), st.cb + r * Math.sin(st.th)] : [st.cx + r * st.sx, st.cb + r * st.sb];
  }

  function Mesh() {
    const v = [], ix = [];
    const add = (p, n, seam = -1) => { v.push(p[0], p[1], p[2], n[0], n[1], n[2], seam); return v.length / 7 - 1; };
    // keeps every triangle wound so its face points the way its normals do
    const tri = (a, b, c) => {
      const p = (i, k) => v[i * 7 + k];
      const ux = p(b, 0) - p(a, 0), uy = p(b, 1) - p(a, 1), uz = p(b, 2) - p(a, 2);
      const wx = p(c, 0) - p(a, 0), wy = p(c, 1) - p(a, 1), wz = p(c, 2) - p(a, 2);
      const gx = uy * wz - uz * wy, gy = uz * wx - ux * wz, gz = ux * wy - uy * wx;
      if (Math.abs(gx) + Math.abs(gy) + Math.abs(gz) < 1e-13) return;
      const nx = p(a, 3) + p(b, 3) + p(c, 3), ny = p(a, 4) + p(b, 4) + p(c, 4), nz = p(a, 5) + p(b, 5) + p(c, 5);
      if (gx * nx + gy * ny + gz * nz < 0) ix.push(a, c, b); else ix.push(a, b, c);
    };
    const strip = (A, B) => { for (let j = 0; j < A.length; j++) { const k = (j + 1) % A.length; tri(A[j], A[k], B[k]); tri(A[j], B[k], B[j]); } };
    const fan = (c, A) => { for (let j = 0; j < A.length; j++) tri(c, A[j], A[(j + 1) % A.length]); };
    return { v, ix, add, strip, fan };
  }
  const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };

  // The lid: a 4 mm plate, crisp on the screen side and rounded off generously on the back.
  // Local space is the screen face's: x across, y down from the lid's top edge, the back at z = -LT.
  function buildLid() {
    const m = Mesh(), sts = outline(RF, RR), f1 = 0.35 * MM, ah = 3 * MM, av = 2.4 * MM;
    const prof = [[f1, 0, 0, -1]];
    for (let i = 1; i <= 4; i++) { const p = (i / 4) * (Math.PI / 2); prof.push([f1 - f1 * Math.sin(p), f1 - f1 * Math.cos(p), Math.sin(p), -Math.cos(p)]); }
    prof.push([0, LT - av, 1, 0]);
    for (let i = 1; i <= 12; i++) {
      const p = (i / 12) * (Math.PI / 2), no = Math.cos(p) / ah, nd = Math.sin(p) / av, l = Math.hypot(no, nd);
      prof.push([ah * (1 - Math.cos(p)), LT - av + av * Math.sin(p), no / l, nd / l]);
    }
    const rings = prof.map(([d, h, po, ph]) => sts.map((st) => { const q = at(st, d); return m.add([q[0], q[1], -h], [po * st.n[0], po * st.n[1], -ph]); }));
    m.fan(m.add([0.5, D / 2, 0], [0, 0, 1]), rings[0]);
    for (let k = 0; k < rings.length - 1; k++) m.strip(rings[k], rings[k + 1]);
    m.fan(m.add([0.5, D / 2, -LT], [0, 0, -1]), rings[rings.length - 1]);
    return m;
  }

  // The base: a flat top case with a softened edge and a thin band, the parting line, then the bottom shell
  // curving under to the wedge's underside. Local space: x across, y down from the deck, z from hinge to front.
  function buildBase() {
    const m = Mesh(), sts = outline(RR, RF), imax = D / 2 - 0.002;
    const per = sts.map((st) => {
      const t = thick(at(st, 0)[1]);
      const r1 = Math.min(0.7 * MM, 0.28 * t), b = clamp(0.42 * t, r1 + 0.15 * MM, 1.5 * MM);
      let a = clamp(0.9 * (t - b), 0.6 * MM, 8 * MM), te = thick(at(st, a)[1]);
      a = clamp(0.9 * (te - b), 0.6 * MM, 8 * MM); te = thick(at(st, a)[1]);
      return { st, r1, b, a, te };
    });
    const vert = (q, d, h, po, ph) => { const s = at(q.st, d); return m.add([s[0], h, s[1]], norm(po * q.st.n[0], ph, po * q.st.n[1]), q.b); };
    const rings = [];
    for (let i = 0; i <= 4; i++) {
      const p = (i / 4) * (Math.PI / 2);
      rings.push(per.map((q) => vert(q, q.r1 - q.r1 * Math.sin(p), q.r1 - q.r1 * Math.cos(p), Math.sin(p), -Math.cos(p))));
    }
    // the top case's band down to the parting line (drawn by the shader, which knows how big a pixel is)
    rings.push(per.map((q) => vert(q, 0, q.b, 1, 0)));
    for (let i = 1; i <= 10; i++) {
      const p = (i / 10) * (Math.PI / 2);
      rings.push(per.map((q) => {
        const ry = q.te - q.b;
        return vert(q, q.a * (1 - Math.cos(p)), q.b + ry * Math.sin(p), Math.cos(p) / q.a, Math.sin(p) / ry);
      }));
    }
    // the underside, following the profile front to back
    for (let i = 1; i <= 14; i++) {
      const f = (i / 14) ** 2;
      rings.push(per.map((q) => {
        const s = at(q.st, q.a + (imax - q.a) * f), z = s[1], dz = (thick(z + 1e-4) - thick(z - 1e-4)) / 2e-4;
        return m.add([s[0], thick(z), z], norm(0, 1, -dz), q.b);
      }));
    }
    // the centres carry a parting-line height too, so it never crosses the deck or the underside
    m.fan(m.add([0.5, 0, D / 2], [0, -1, 0], 1.5 * MM), rings[0]);
    for (let k = 0; k < rings.length - 1; k++) m.strip(rings[k], rings[k + 1]);
    m.fan(m.add([0.5, thick(D / 2), D / 2], [0, 1, 0], 1.5 * MM), rings[rings.length - 1]);
    return m;
  }

  // ---------- Textures (painted once on a 2D canvas) ----------
  const APPLE = 'M150.4 172.1c-8.3 12.3-17.1 24.4-30.6 24.6-13.4.3-17.7-7.9-33-7.9s-20.1 7.6-32.7 8.2c-13.1.5-23.1-13.3-31.5-25.5C5.4 146.6-7.6 101.6 9.8 71.4c8.6-15 24-24.5 40.8-24.8 12.8-.2 24.9 8.6 32.7 8.6 7.8 0 22.5-10.7 37.9-9.1 6.5.3 24.6 2.6 36.2 19.7-.9.6-21.6 12.6-21.4 37.7.3 30 26.3 40 26.6 40.1-.3.7-4.2 14.2-13.7 28.5zM104.1 32.6c7.1-8.6 11.9-20.6 10.6-32.6-10.2.4-22.6 6.8-30 15.4-6.6 7.6-12.4 19.8-10.8 31.5 11.4.9 23.1-5.8 30.2-14.3z';
  const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

  // The 2008 Air's keyboard: black keys in their own openings in the silver top case, a half-height function row,
  // the inverted-T arrows, the wide trackpad with its button bar, and the round power button. Channels:
  // red = keycaps, green = legends on the keys and the backlight's halo around them, blue = shading in the metal.
  function paintDeck(size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size / 2;
    const x = c.getContext('2d');
    const DW = 325, DD = D * 325, sx = c.width / DW, sy = c.height / DD;
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(sx, 0, 0, sy, 0, 0);
    const rr = (x0, y0, w, h, r, p = null) => {
      const t = p || x;
      if (!p) x.beginPath();
      t.moveTo(x0 + r, y0); t.arcTo(x0 + w, y0, x0 + w, y0 + h, r); t.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
      t.arcTo(x0, y0 + h, x0, y0, r); t.arcTo(x0, y0, x0 + w, y0, r); t.closePath();
    };
    const text = (s, tx, ty, size, align = 'center', base = 'middle') => {
      x.save();
      x.setTransform(sx / 10, 0, 0, sy / 10, tx * sx, ty * sy);
      x.font = `500 ${size * 10}px ${FONT}`;
      x.textAlign = align; x.textBaseline = base;
      x.fillText(s, 0, 0);
      x.restore();
    };
    const well = { x0: 0.084 * DW, x1: 0.916 * DW, y0: 0.07 * DD, y1: 0.54 * DD };
    const gap = 2.7, pad = 1.6;

    const W1 = (k) => [k, 1];
    const ROWS = [
      [['esc', 1.4], ...'F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'.split(' ').map((k) => [k, 1, 'f']), ['⏏', 1]],
      [['~`', 1, 'p'], ...'!1 @2 #3 $4 %5 ^6 &7 *8 (9 )0 _- +='.split(' ').map((k) => [k, 1, 'p']), ['delete', 1.5, 'r']],
      [['tab', 1.5, 'l'], ...'QWERTYUIOP'.split('').map(W1), ['{[', 1, 'p'], ['}]', 1, 'p'], ['|\\', 1, 'p']],
      [['caps lock', 1.8, 'l'], ...'ASDFGHJKL'.split('').map(W1), [':;', 1, 'p'], ['"\'', 1, 'p'], ['return', 1.7, 'r', 'enter']],
      [['shift', 2.3, 'l'], ...'ZXCVBNM'.split('').map(W1), ['<,', 1, 'p'], ['>.', 1, 'p'], ['?/', 1, 'p'], ['shift', 2.2, 'r']],
      [['fn', 1, 'l'], ['control', 1, 'l'], ['option', 1, 'l', 'alt'], ['command', 1.3, 'l', '⌘'], ['', 5.2], ['command', 1.3, 'r', '⌘'], ['option', 1, 'r', 'alt'], ['◀', 1, 'a'], ['▲▼', 1, 'ud'], ['▶', 1, 'a']],
    ];
    const weights = [0.62, 1, 1, 1, 1, 1];
    const rowH = (well.y1 - well.y0 - 2 * pad - gap * (ROWS.length - 1)) / weights.reduce((s, w) => s + w, 0);
    const keys = [];
    let y = well.y0 + pad;
    ROWS.forEach((row, r) => {
      const h = rowH * weights[r], units = row.reduce((s, k) => s + k[1], 0);
      const unit = (well.x1 - well.x0 - 2 * pad - gap * (row.length - 1)) / units;
      let kx = well.x0 + pad;
      row.forEach(([label, w, kind, sub]) => {
        const kw = unit * w;
        if (kind === 'ud') {
          const hh = (h - 0.9) / 2;
          keys.push({ x: kx, y, w: kw, h: hh, label: '▲', kind: 'a' }, { x: kx, y: y + hh + 0.9, w: kw, h: hh, label: '▼', kind: 'a' });
        } else if (kind === 'a') keys.push({ x: kx, y: y + h / 2 + 0.45, w: kw, h: (h - 0.9) / 2, label, kind });
        else keys.push({ x: kx, y, w: kw, h, label, kind, sub, fn: r === 0 });
        kx += kw + gap;
      });
      y += h + gap;
    });

    x.globalCompositeOperation = 'lighter';
    // the keyboard sits in a shallow well: a touch darker, shadowed under its top edge
    x.fillStyle = 'rgb(0,0,34)'; rr(well.x0, well.y0, well.x1 - well.x0, well.y1 - well.y0, 2.2); x.fill();
    const g = x.createLinearGradient(0, well.y0, 0, well.y0 + 2.2);
    g.addColorStop(0, 'rgb(0,0,120)'); g.addColorStop(1, 'rgb(0,0,0)');
    x.fillStyle = g; x.fillRect(well.x0 + 1, well.y0, well.x1 - well.x0 - 2, 2.2);
    x.strokeStyle = 'rgb(0,0,80)'; x.lineWidth = 0.3; rr(well.x0, well.y0, well.x1 - well.x0, well.y1 - well.y0, 2.2); x.stroke();
    // every key throws a soft shadow into the metal, and when the backlight's on, a halo leaks round it
    // (all the caps in one path: two blurs in all, not two per key)
    const caps = new Path2D();
    for (const k of keys) rr(k.x, k.y, k.w, k.h, 1, caps);
    x.fillStyle = '#000';
    x.shadowColor = 'rgba(0,0,255,.7)'; x.shadowBlur = 1.3 * sx; x.shadowOffsetX = 0; x.shadowOffsetY = 0.45 * sy;
    x.fill(caps);
    x.shadowColor = 'rgba(0,255,0,.9)'; x.shadowBlur = 0.8 * sx; x.shadowOffsetY = 0;
    x.fill(caps);
    x.shadowColor = 'transparent'; x.shadowBlur = 0;
    // keycaps, then their legends
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = 'rgb(255,0,0)';
    x.fill(caps);
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = 'rgb(0,255,0)';
    for (const k of keys) {
      const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
      if (k.kind === 'l' || k.kind === 'r') {
        const tx = k.kind === 'l' ? k.x + 1.6 : k.x + k.w - 1.6, al = k.kind === 'l' ? 'left' : 'right';
        text(k.label, tx, k.y + k.h - 2.4, 2.25, al);
        if (k.sub) text(k.sub, tx, k.y + 2.6, k.sub === '⌘' ? 2.6 : 2.0, al);
      } else if (k.kind === 'p') {
        text(k.label[0], cx, cy - 2.6, 2.6); text(k.label.slice(1), cx, cy + 2.4, 2.6);
      } else if (k.kind === 'f') text(k.label, cx, cy + 0.2, 1.8);
      else if (k.kind === 'a') text(k.label, cx, cy + 0.1, 1.5);
      else if (k.fn) text(k.label, k.label === 'esc' ? k.x + 1.6 : cx, cy + 0.2, k.label === 'esc' ? 2 : 2.4, k.label === 'esc' ? 'left' : 'center');
      else if (k.label) text(k.label, cx, cy, 3.6);
    }
    // the trackpad and its button bar, flush with the case, and the power button by the keyboard's corner
    const tp = { x0: 0.335 * DW, x1: 0.665 * DW, y0: 0.63 * DD, y1: 0.92 * DD };
    x.strokeStyle = 'rgb(0,0,150)'; x.lineWidth = 0.38;
    rr(tp.x0, tp.y0, tp.x1 - tp.x0, tp.y1 - tp.y0, 2.2); x.stroke();
    const by = tp.y1 - (tp.y1 - tp.y0) * 0.19;
    x.beginPath(); x.moveTo(tp.x0 + 0.2, by); x.lineTo(tp.x1 - 0.2, by); x.stroke();
    x.fillStyle = 'rgb(0,0,14)'; rr(tp.x0, tp.y0, tp.x1 - tp.x0, tp.y1 - tp.y0, 2.2); x.fill();
    const pb = { x: 0.953 * DW, y: well.y0 + 9 };
    x.lineWidth = 0.35; x.beginPath(); x.ellipse(pb.x, pb.y, 3.3, 3.3, 0, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgb(0,0,70)'; x.lineWidth = 0.3;
    x.beginPath(); x.arc(pb.x, pb.y, 1.5, -Math.PI / 2 + 0.6, Math.PI * 1.5 - 0.6); x.stroke();
    x.beginPath(); x.moveTo(pb.x, pb.y - 2.1); x.lineTo(pb.x, pb.y - 0.4); x.stroke();
    return c;
  }

  // The Apple on the lid (red), with a soft halo (green) for when the screen lights it from behind
  function paintLogo(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, size, size);
    const logo = new Path2D(APPLE);
    const draw = (ctx, n, color) => {
      const k = (n * 0.6) / 200;
      ctx.setTransform(k, 0, 0, k, n / 2 - 85 * k, n / 2 - 100 * k);
      ctx.fillStyle = color; ctx.fill(logo);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    // the halo: the logo drawn tiny and scaled up, which blurs it far faster than a canvas shadow
    const s = document.createElement('canvas');
    s.width = s.height = 48;
    const sx = s.getContext('2d');
    sx.fillStyle = '#000'; sx.fillRect(0, 0, 48, 48);
    draw(sx, 48, 'rgb(0,255,0)');
    x.globalCompositeOperation = 'lighter';
    x.imageSmoothingQuality = 'high';
    x.drawImage(s, 0, 0, size, size);
    draw(x, size, 'rgb(255,0,0)');
    return c;
  }

  // The contact shadow on the floor, from the base's real clearance: sharp and dark under the thick back,
  // soft and light under the raised nose
  function paintShadow(n) {
    const out = new Uint8Array(n * n * 4), X0 = -0.16, X1 = 1.16, Z0 = -0.12, Z1 = D + 0.24;
    const sd = (px, pz) => {
      const r = pz > D / 2 ? RF : RR, qx = Math.abs(px - 0.5) - (0.5 - r), qz = Math.abs(pz - D / 2) - (D / 2 - r);
      return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const px = X0 + ((X1 - X0) * (i + 0.5)) / n, pz = Z0 + ((Z1 - Z0) * (j + 0.5)) / n;
        const d = sd(px, pz), gap = TMAX - thick(clamp(pz, 0, D)) + 0.5 * MM, s = 0.9 * MM + 0.5 * gap;
        const contact = 0.5 * (1 - smooth(-s, s, d)) * (0.3 + 0.7 * Math.exp(-gap / (4 * MM)));
        const amb = 0.2 * Math.exp(-Math.max(d, 0) / 0.04) * smooth(-0.16, 0.06, pz - 0) * (1 - 0.35 * smooth(D * 0.5, D + 0.2, pz));
        out[(j * n + i) * 4 + 3] = Math.round(255 * (1 - (1 - contact) * (1 - amb)));
      }
    }
    return { data: out, rect: [X0, Z0, X1, Z1] };
  }

  // ---------- Shaders ----------
  const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute float aSeam;
uniform mat4 uMVP, uModel; uniform mat3 uNorm;
varying vec3 vW, vN, vL, vLN; varying float vSeam;
void main() {
  vL = aPos; vLN = aNor; vSeam = aSeam;
  vW = (uModel * vec4(aPos, 1.0)).xyz;
  vN = uNorm * aNor;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;
  const FS = `#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec3 uEye, uKey;
uniform float uPart, uLit, uShut, uD;
uniform vec4 uLogo;
uniform sampler2D tDeck, tLogo;
varying vec3 vW, vN, vL, vLN; varying float vSeam;
const float MM = 1.0 / 325.0;

// A seamless ivory studio: a warm floor, a bright sweep at the horizon, a softbox overhead and strip lights
// at the sides. k widens every transition, for rougher reflections.
vec3 studio(vec3 r, float k) {
  float up = -r.y, w = 0.04 + 0.5 * k;
  // the sweep is brightest just above the horizon and dims as it rises, which is what a shut lid, seen low,
  // reflects: a soft glow at its far edge fading toward you; brighter to the right, where the key light is
  vec3 wall = vec3(0.985, 0.975, 0.95) * (0.93 + 0.45 * clamp(r.x, -0.22, 0.22));
  vec3 c = mix(vec3(0.46, 0.45, 0.42), wall, smoothstep(-0.22 - w, 0.02 + 0.3 * w, up));
  c = mix(c, vec3(0.80, 0.80, 0.80), smoothstep(0.0, 0.22 + w, up));
  c = mix(c, vec3(0.76, 0.76, 0.77), smoothstep(0.4, 0.95, up));
  c *= 1.0 - 0.3 * smoothstep(-0.1, 0.9, r.z) * (1.0 - smoothstep(0.1, 0.6, up));
  c += vec3(0.55, 0.55, 0.53) * smoothstep(0.6 - w, 0.8, up) * (1.0 - smoothstep(0.05 - w, 0.45 + w, r.z));
  float strip = smoothstep(0.5 - w, 0.88, abs(r.x)) * (1.0 - smoothstep(0.3, 0.8, abs(r.y)));
  c += vec3(0.32) * strip * (r.x > 0.0 ? 1.0 : 0.65);
  return c;
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uEye - vW);
#ifdef GL_OES_standard_derivatives
  float k = clamp(length(fwidth(N)) * 0.8, 0.0, 1.0), fy = fwidth(vL.y);
#else
  float k = 0.0, fy = 0.0;
#endif
  vec3 R = reflect(-V, N);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 irr = mix(vec3(0.44, 0.43, 0.41), vec3(1.0), -N.y * 0.5 + 0.5);
  float F = 0.6 + 0.4 * pow(1.0 - ndv, 5.0);
  vec3 alu = vec3(0.86, 0.855, 0.83);
  vec3 col = alu * (0.5 * irr + 0.62 * F * studio(R, max(0.3, k))) * 1.04;
  // a big softbox up and behind to the right, close enough that its glow sweeps across a flat lid
  vec3 L = normalize(uKey - vW);
  col += vec3(1.0, 0.995, 0.98) * 0.16 * pow(max(dot(N, normalize(L + V)), 0.0), 10.0) * (0.3 + 0.7 * F);
  float ao = 1.0;

  if (uPart < 0.5) {
    if (vLN.y < -0.5) {
      vec4 d = texture2D(tDeck, vec2(vL.x, vL.z / uD));
      float key = d.r, legend = d.g * key, halo = d.g * (1.0 - key);
      col *= 1.0 - 0.7 * d.b;
      vec3 kc = vec3(0.045) * irr + 0.12 * F * studio(R, 0.5) * vec3(0.55);
      kc = mix(kc, mix(vec3(0.72), vec3(1.12, 1.09, 1.02), uLit), legend);
      col = mix(col, kc, key);
      col += uLit * halo * vec3(0.95, 0.92, 0.85) * 0.75;
      // light from the screen falls on the keyboard, and the open lid shades the strip by the hinge
      col += uLit * 0.1 * exp(-vL.z / (0.22 * uD)) * vec3(1.0, 0.97, 0.9);
      ao *= 1.0 - (1.0 - uShut) * 0.22 * exp(-vL.z / (5.0 * MM));
    }
    float side = 1.0 - smoothstep(0.5, 0.9, -vLN.y);
    // the parting line between the top case and the bottom shell: a fifth of a millimetre, never thinner than a
    // pixel; when a pixel is wider than the line it gets fainter instead
    float wl = 0.2 * MM;
    ao *= 1.0 - 0.6 * clamp(wl / max(fy, 1e-7), 0.0, 1.0) * (1.0 - smoothstep(0.0, max(wl, fy), abs(vL.y - vSeam)));
    // under the shut lid the top of the band sits in shadow, deepest at the scoop for lifting it
    float scoop = (1.0 - smoothstep(0.07, 0.08, abs(vL.x - 0.5))) * smoothstep(uD - 6.0 * MM, uD - 0.5 * MM, vL.z);
    ao *= 1.0 - uShut * side * (0.4 * exp(-vL.y / (0.6 * MM)) + 0.3 * scoop * exp(-vL.y / (1.2 * MM)));
  } else {
    if (vLN.z < -0.5) {
      // the Apple: polished metal while the machine sleeps, lit white from behind once the screen is on.
      // Seen from behind the open lid it stands upright, so from the front it's upside down when shut.
      vec2 lu = vec2(uLogo.x - vL.x, vL.y - uLogo.y) / uLogo.zw + 0.5;
      vec4 lg = texture2D(tLogo, lu);
      vec3 mirror = studio(R, 0.04) * 1.02 + 0.07;
      col = mix(col, mix(mirror, vec3(1.1, 1.09, 1.07), uLit), lg.r);
      col += uLit * lg.g * 0.25 * (1.0 - lg.r);
    }
    float edge = 1.0 - smoothstep(0.5, 0.9, abs(vLN.z));
    ao *= 1.0 - uShut * edge * 0.4 * exp(vL.z / (0.6 * MM));
  }
  // a little noise keeps the long gradients from banding
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(col * ao + (n - 0.5) / 255.0, 1.0);
}`;
  const SVS = `
attribute vec2 aP; uniform mat4 uMVP; uniform float uY; uniform vec4 uRect; varying vec2 vUv;
void main() { vUv = (aP - uRect.xy) / (uRect.zw - uRect.xy); gl_Position = uMVP * vec4(aP.x, uY, aP.y, 1.0); }`;
  const SFS = `
precision mediump float; uniform sampler2D tShadow; uniform float uK; varying vec2 vUv;
void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, texture2D(tShadow, vUv).a * uK); }`;

  // ---------- Matrices (column-major, CSS conventions: y down, z toward the viewer) ----------
  const mul2 = (a, b) => {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  };
  const mul = (...ms) => ms.reduce(mul2);
  const T = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  const S = (x, y, z) => new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  const rad = (d) => (d * Math.PI) / 180;
  const RX = (d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
  const RY = (d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };
  const RZ = (d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); };
  const PERS = (d) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / d, 0, 0, 0, 1]);
  const rot3 = (m) => new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);

  return function create(stage, mac) {
    const canvas = document.createElement('canvas');
    canvas.className = 'mac-gl';
    canvas.setAttribute('aria-hidden', 'true');
    let gl = null;
    try { gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return null;
    gl.getExtension('OES_standard_derivatives');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    // asked once, before any drawing: a query waits for the GPU to finish whatever is queued
    const maxAniso = aniso ? Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)) : 0;

    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = (vs, fs) => {
      const p = gl.createProgram();
      gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
        const name = gl.getActiveUniform(p, i).name;
        u[name] = gl.getUniformLocation(p, name);
      }
      return { p, u };
    };
    const texture = (src, w, h) => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, maxAniso);
      return t;
    };
    const buffers = (m) => {
      const vb = gl.createBuffer(), ib = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(m.v), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.ix), gl.STATIC_DRAW);
      return { vb, ib, n: m.ix.length };
    };

    let shell, flat, lid, base, quad, tDeck, tLogo, tShadow, shadowRect;
    try {
      shell = program(VS, FS);
      flat = program(SVS, SFS);
      lid = buffers(buildLid());
      base = buffers(buildBase());
      tDeck = texture(paintDeck(innerWidth > 900 ? 2048 : 1024));
      tLogo = texture(paintLogo(512));
      const sh = paintShadow(256);
      tShadow = texture(sh.data, 256, 256);
      shadowRect = sh.rect;
      const [x0, z0, x1, z1] = shadowRect;
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, z0, x1, z0, x1, z1, x0, z0, x1, z1, x0, z1]), gl.STATIC_DRAW);
    } catch (e) {
      console.warn('MacGL:', e);
      return null;
    }

    mac.after(canvas);
    let cw = 0, ch = 0, lost = false, last = null;
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; mac.classList.remove('mac--gl'); canvas.hidden = true; });
    mac.classList.add('mac--gl');

    const LOGO_W = 0.09;   // the logo's width over the lid's; its texture square is a little larger
    const logoSq = (LOGO_W * (200 / 170)) / 0.6;

    function draw(s) {
      const W = s.W, Hl = D * W;
      const body = mul(T(W / 2, Hl / 2, 0), RX(s.rx), RY(s.ry), RZ(s.rz), T(-W / 2, -Hl / 2, 0));
      const hinge = mul(T(W / 2, Hl, 0), RX(s.lid), T(-W / 2, -Hl, 0));
      const po = [W / 2, -0.58 * Hl], dist = 4.4 * W;
      const place = mul(T(s.tx + W / 2, s.ty + Hl / 2, 0), S(s.s, s.s, 1), T(-W / 2, -Hl / 2, 0));
      const clip = new Float32Array([2 / cw, 0, 0, 0, 0, -2 / ch, 0, 0, 0, 0, -1 / (3 * W), 0, -1, 1, 0, 1]);
      const proj = mul(clip, place, T(po[0], po[1], 0), PERS(dist), T(-po[0], -po[1], 0));
      const mBase = mul(body, S(W, W, W)), mLid = mul(body, hinge, S(W, W, W));
      const shut = 1 - smooth(-90, -84, s.lid);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // the shadow first, blended onto the page
      gl.useProgram(flat.p);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(flat.u.uMVP, false, mul(proj, mBase, T(0, D, 0)));
      gl.uniform1f(flat.u.uY, TMAX + 0.5 * MM);
      gl.uniform4fv(flat.u.uRect, shadowRect);
      gl.uniform1f(flat.u.uK, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tShadow); gl.uniform1i(flat.u.tShadow, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      const aP = gl.getAttribLocation(flat.p, 'aP');
      gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 8, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.disableVertexAttribArray(aP);

      // then the machine
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW);
      gl.useProgram(shell.p);
      const u = shell.u;
      gl.uniform3f(u.uEye, po[0], po[1], dist);
      gl.uniform3f(u.uKey, 1.5 * W, -1.4 * W, -1.2 * W);
      gl.uniform1f(u.uLit, s.lit);
      gl.uniform1f(u.uShut, shut);
      gl.uniform1f(u.uD, D);
      gl.uniform4f(u.uLogo, 0.5, D / 2, logoSq, logoSq);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tDeck); gl.uniform1i(u.tDeck, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tLogo); gl.uniform1i(u.tLogo, 1);
      const aPos = gl.getAttribLocation(shell.p, 'aPos'), aNor = gl.getAttribLocation(shell.p, 'aNor'), aSeam = gl.getAttribLocation(shell.p, 'aSeam');
      const part = (b, model, which) => {
        gl.uniform1f(u.uPart, which);
        gl.uniformMatrix4fv(u.uMVP, false, mul(proj, model));
        gl.uniformMatrix4fv(u.uModel, false, model);
        gl.uniformMatrix3fv(u.uNorm, false, rot3(model).map((v) => v / W));
        gl.bindBuffer(gl.ARRAY_BUFFER, b.vb);
        gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 28, 0);
        gl.enableVertexAttribArray(aNor); gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 28, 12);
        gl.enableVertexAttribArray(aSeam); gl.vertexAttribPointer(aSeam, 1, gl.FLOAT, false, 28, 24);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.ib);
        gl.drawElements(gl.TRIANGLES, b.n, gl.UNSIGNED_SHORT, 0);
      };
      part(base, mul(mBase, T(0, D, 0)), 0);
      part(lid, mLid, 1);
    }

    return {
      canvas,
      // the canvas covers the stage, at the screen's pixel density (capped at 2x)
      resize(w, h) {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        cw = w; ch = h;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        if (last) this.render(last);
      },
      // s: W, the .mac transform (tx, ty, s), the body's turn (rx, ry, rz), lid angle, lit (0..1), op
      render(s) {
        last = s;
        if (lost || !cw) return;
        canvas.style.opacity = s.op;
        if (s.op < 0.002) return;
        draw(s);
      },
    };
  };
})();
