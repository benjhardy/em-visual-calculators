/* ---- shared UI kit (identical block in every calculator; edit src/common.js and rebuild) ---- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- theme ----------
const Theme = (() => {
  const KEY = 'vc-theme', subs = [];
  let col = null;
  const eff = () => {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') return t;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  function read() {
    const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim();
    const names = ['bg', 'surface', 'ink', 'muted', 'line', 'grid', 'field', 'hfield', 'ok', 'bad', 'warn', 'accent', 'metal', 'metal-hi', 'diel', 'diel-edge', 'seq0', 'seq1', 'seq2', 'seq3'];
    col = {}; for (const n of names) col[n.replace('-', '_')] = g('--' + n);
    col.rgb = {}; for (const k in col) if (k !== 'rgb') col.rgb[k] = hexRgb(col[k]);
    col.mono = g('--mono'); col.body = g('--body');
  }
  function apply(t) {
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    read(); label(); subs.forEach(f => f());
  }
  function label() { const b = $('#themeBtn'); if (b) { const d = eff() === 'dark'; b.textContent = d ? 'Light' : 'Dark'; b.setAttribute('aria-label', 'Switch to ' + (d ? 'light' : 'dark') + ' theme'); } }
  function init() {
    let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
    read(); label();
    const b = $('#themeBtn');
    if (b) b.addEventListener('click', () => { const t = eff() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(KEY, t); } catch (e) {} apply(t); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { read(); label(); subs.forEach(f => f()); });
  }
  return { init, on: f => subs.push(f), get c() { if (!col) read(); return col; }, eff, apply };
})();
function hexRgb(h) {
  h = (h || '').trim();
  if (h[0] !== '#') return [128, 128, 128];
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgbStr = (c, al = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`;
// sequential map t in [0,1] -> rgb (theme aware, 4 stops)
function seqRgb(t) {
  const R = Theme.c.rgb, s = [R.seq0, R.seq1, R.seq2, R.seq3];
  t = Math.max(0, Math.min(1, t)) * 3; const i = Math.min(2, Math.floor(t));
  return mixRgb(s[i], s[i + 1], t - i);
}
// diverging map s in [-1,1]: hfield <- surface -> field
function divRgb(s) {
  const R = Theme.c.rgb; s = Math.max(-1, Math.min(1, s));
  return s >= 0 ? mixRgb(R.surface, R.field, Math.pow(s, 0.8)) : mixRgb(R.surface, R.hfield, Math.pow(-s, 0.8));
}
function rampCss(kind) {
  if (kind === 'div') { const c = Theme.c; return `linear-gradient(90deg, ${c.hfield}, ${c.surface}, ${c.field})`; }
  const c = Theme.c; return `linear-gradient(90deg, ${c.seq0}, ${c.seq1}, ${c.seq2}, ${c.seq3})`;
}

// ---------- canvas ----------
// Size the backing store to the element's CSS size x devicePixelRatio. Returns {ctx, w, h} in CSS px.
function fitCanvas(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, dpr };
}
function arrow(ctx, x0, y0, x1, y1, head = 5) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 0.5) return;
  const ux = dx / L, uy = dy / L, hh = Math.min(head, L * 0.6);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hh * 0.6, y1 - uy * hh * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * hh - uy * hh * 0.55, y1 - uy * hh + ux * hh * 0.55);
  ctx.lineTo(x1 - ux * hh + uy * hh * 0.55, y1 - uy * hh - ux * hh * 0.55); ctx.closePath(); ctx.fill();
}
function onResize(el, fn) { if ('ResizeObserver' in window) new ResizeObserver(() => fn()).observe(el); else window.addEventListener('resize', fn); }

// ---------- number formatting ----------
function fmt(v, sig = 4) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) { const s = v.toExponential(sig - 1).replace('e+', 'e'); return s.replace(/\.?0+e/, 'e'); }
  return String(Number(v.toPrecision(sig)));
}
const PRE = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
function fmtSI(v, unit, sig = 4) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0 ' + unit;
  const a = Math.abs(v);
  for (const [s, p] of PRE) if (a >= s * 0.99995) return fmt(v / s, sig) + ' ' + p + unit;
  return fmt(v, sig) + ' ' + unit;
}
const NP2DB = 20 / Math.LN10;

// ---------- units ----------
const Units = {
  len: { mm: 1e-3, mil: 25.4e-6, um: 1e-6 },
  freq: { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 },
};

// ---------- URL hash state ----------
const Hash = {
  read() { const o = {}; const h = location.hash.replace(/^#/, ''); if (!h) return o; for (const kv of h.split('&')) { const [k, v] = kv.split('='); if (k) o[decodeURIComponent(k)] = decodeURIComponent(v || ''); } return o; },
  _t: 0,
  write(obj) {
    clearTimeout(this._t);
    this._t = setTimeout(() => {
      const s = Object.entries(obj).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(typeof v === 'number' ? Number(v.toPrecision(6)) : v)).join('&');
      try { history.replaceState(null, '', '#' + s); } catch (e) {}
    }, 150);
  },
};
const num = (v, d) => { const x = parseFloat(v); return isFinite(x) ? x : d; };

// ---------- bound inputs ----------
// A number input bound to a state value in SI units. kind: 'len' | 'freq' | null. units() returns the current unit name.
const Fields = [];
function bindNumber(el, o) {
  const f = { el, ...o };
  const factor = () => f.kind === 'len' ? Units.len[f.units()] : f.kind === 'freq' ? Units.freq[f.units()] : (f.scale || 1);
  f.show = () => { if (document.activeElement === el) return; const v = f.get() / factor(); el.value = isFinite(v) ? String(Number(v.toPrecision(f.sig || 5))) : ''; };
  el.addEventListener('input', () => {
    const v = parseFloat(el.value); if (!isFinite(v)) return;
    const si = v * factor();
    if ((f.min !== undefined && si < f.min) || (f.max !== undefined && si > f.max)) { el.setAttribute('aria-invalid', 'true'); return; }
    el.removeAttribute('aria-invalid'); f.set(si); f.onchange && f.onchange();
  });
  el.addEventListener('change', () => { f.show(); });
  el.addEventListener('blur', () => { f.show(); });
  Fields.push(f); f.show(); return f;
}
// A range input mapped (optionally log) onto [min, max] in SI units.
function bindRange(el, o) {
  const f = { el, ...o, isRange: true }; const N = 1000; el.min = 0; el.max = N; el.step = 1;
  const to = v => f.log ? Math.log(v / f.min) / Math.log(f.max / f.min) * N : (v - f.min) / (f.max - f.min) * N;
  const from = s => f.log ? f.min * Math.pow(f.max / f.min, s / N) : f.min + (f.max - f.min) * s / N;
  f.show = () => { const v = f.get(); el.value = String(Math.round(Math.max(0, Math.min(N, to(v))))); if (f.text) el.setAttribute('aria-valuetext', f.text(v)); };
  el.addEventListener('input', () => { let v = from(+el.value); if (f.snap) v = f.snap(v); f.set(v); f.onchange && f.onchange(); });
  Fields.push(f); f.show(); return f;
}
const refreshFields = () => Fields.forEach(f => f.show());
// segmented control: buttons with data-v; calls set(v)
function bindSeg(seg, get, set) {
  const bs = $$('button', seg);
  const show = () => bs.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(get()))));
  bs.forEach(b => b.addEventListener('click', () => { set(b.dataset.v); show(); }));
  show(); Fields.push({ show }); return show;
}

// ---------- line plots ----------
function niceTicks(lo, hi, n = 5) {
  const span = hi - lo; if (!(span > 0)) return [lo];
  const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const st = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => span / s <= n) || 10 * mag;
  const out = []; for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
  return out;
}
function logTicks(lo, hi) {
  const a = Math.floor(Math.log10(lo) + 1e-9), b = Math.ceil(Math.log10(hi) - 1e-9), out = [], minor = [];
  const dec = b - a;
  for (let e = a; e <= b; e++) for (const m of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const v = m * Math.pow(10, e); if (v < lo * 0.999 || v > hi * 1.001) continue;
    if (m === 1 || (dec <= 2 && (m === 2 || m === 5)) || (dec <= 1 && m !== 1)) out.push(v); else minor.push(v);
  }
  return { major: out, minor };
}
// opt: {x:{min,max,log,label,fmt}, y:{...}, series:[{pts,color,width,dash,label}], points:[{x,y,color,r,label,ring}], vlines:[{x,color,dash,label}], bands:[{x0,x1,color}], hlines}
function drawPlot(cv, opt) {
  const { ctx, w, h } = fitCanvas(cv), C = Theme.c;
  ctx.clearRect(0, 0, w, h);
  const small = w < 420;
  const m = { l: small ? 46 : 56, r: 14, t: 12, b: small ? 38 : 42 };
  const X = opt.x, Y = opt.y, pw = w - m.l - m.r, ph = h - m.t - m.b;
  const sx = v => m.l + (X.log ? Math.log(v / X.min) / Math.log(X.max / X.min) : (v - X.min) / (X.max - X.min)) * pw;
  const sy = v => m.t + ph - (Y.log ? Math.log(v / Y.min) / Math.log(Y.max / Y.min) : (v - Y.min) / (Y.max - Y.min)) * ph;
  ctx.font = `500 ${small ? 10 : 11}px ${C.mono}`; ctx.textBaseline = 'middle';
  // bands
  for (const b of opt.bands || []) { ctx.fillStyle = b.color; const x0 = Math.max(m.l, sx(b.x0)), x1 = Math.min(m.l + pw, sx(b.x1)); if (x1 > x0) ctx.fillRect(x0, m.t, x1 - x0, ph); if (b.label) { ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.fillText(b.label, x0 + 4, m.t + 9); } }
  // grid + ticks
  const xt = X.log ? logTicks(X.min, X.max) : { major: niceTicks(X.min, X.max, small ? 4 : 6), minor: [] };
  const yt = Y.log ? logTicks(Y.min, Y.max) : { major: niceTicks(Y.min, Y.max, 5), minor: [] };
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.grid;
  for (const v of xt.minor) { const x = Math.round(sx(v)) + 0.5; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.globalAlpha = 1; }
  for (const v of yt.minor) { const y = Math.round(sy(v)) + 0.5; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'center';
  for (const v of xt.major) { const x = Math.round(sx(v)) + 0.5; ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.fillText((X.fmt || fmt)(v), x, m.t + ph + 12); }
  ctx.textAlign = 'right';
  for (const v of yt.major) { const y = Math.round(sy(v)) + 0.5; ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l + pw, y); ctx.stroke(); ctx.fillText((Y.fmt || fmt)(v), m.l - 6, y); }
  ctx.strokeStyle = C.line; ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);
  ctx.textAlign = 'center'; ctx.fillText(X.label || '', m.l + pw / 2, h - 9);
  ctx.save(); ctx.translate(11, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(Y.label || '', 0, 0); ctx.restore();
  // clip to plot area
  ctx.save(); ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
  for (const L of opt.hlines || []) { ctx.strokeStyle = L.color || C.muted; ctx.setLineDash(L.dash || [4, 4]); ctx.beginPath(); ctx.moveTo(m.l, sy(L.y)); ctx.lineTo(m.l + pw, sy(L.y)); ctx.stroke(); ctx.setLineDash([]); }
  for (const L of opt.vlines || []) {
    const x = sx(L.x); ctx.strokeStyle = L.color || C.muted; ctx.lineWidth = L.width || 1; ctx.setLineDash(L.dash || [4, 4]);
    ctx.beginPath(); ctx.moveTo(x, m.t); ctx.lineTo(x, m.t + ph); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    if (L.label) { ctx.fillStyle = L.color || C.muted; ctx.textAlign = x > m.l + pw - 70 ? 'right' : 'left'; ctx.fillText(L.label, x + (ctx.textAlign === 'left' ? 4 : -4), m.t + (L.ly || 10)); }
  }
  for (const s of opt.series || []) {
    ctx.strokeStyle = s.color || C.ink; ctx.lineWidth = s.width || 2; ctx.setLineDash(s.dash || []); ctx.beginPath();
    let pen = false;
    for (const [x, y] of s.pts) {
      if (!isFinite(y) || (Y.log && y <= 0)) { pen = false; continue; }
      const px = sx(x), py = sy(y);
      if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  for (const p of opt.points || []) {
    if (!isFinite(p.y) || !isFinite(p.x)) continue;
    const px = sx(p.x), py = sy(p.y); if (px < m.l - 1 || px > m.l + pw + 1 || py < m.t - 1 || py > m.t + ph + 1) continue;
    ctx.fillStyle = p.ring ? C.surface : (p.color || C.ink); ctx.strokeStyle = p.color || C.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, p.r || 4.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    if (p.label) { ctx.fillStyle = p.color || C.ink; ctx.textAlign = px > m.l + pw * 0.7 ? 'right' : 'left'; ctx.fillText(p.label, px + (ctx.textAlign === 'left' ? 8 : -8), py - 10); }
  }
  return { sx, sy, m, pw, ph };
}

// ---------- animation clock ----------
const Clock = (() => {
  let on = !REDUCED, last = 0, t = 0; const subs = [];
  function frame(ts) { const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts; if (on) { t += dt; subs.forEach(f => f(t)); } requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  return { on: f => subs.push(f), get running() { return on; }, set running(v) { on = v; }, get t() { return t; }, set t(v) { t = v; } };
})();
function bindPlay(btn) {
  const show = () => { btn.setAttribute('aria-pressed', String(Clock.running)); btn.textContent = Clock.running ? 'Pause' : 'Animate'; };
  btn.addEventListener('click', () => { Clock.running = !Clock.running; show(); });
  show();
}
