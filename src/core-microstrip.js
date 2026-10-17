// Microstrip core: a 2-D quasi-static finite-difference (finite-volume) Laplace solver plus the
// Hammerstad-Jensen (1980) closed form and Kirschning-Jansen (1982) dispersion. Pure functions, no DOM.
// Tested by tests/microstrip.test.mjs.
const MsCore = (() => {
  const EPS0 = 8.8541878128e-12, C0 = 299792458, ETA0 = 376.730313668;

  // ------------------------------------------------------------------ grid
  // Graded 1-D grid between lo and hi, finest (d0) next to `fine` (one of the ends), growing by r, capped at dmax.
  function grade(lo, hi, fineAtLo, d0, r, dmax) {
    const L = hi - lo; if (L <= 0) return [lo];
    const steps = []; let d = d0, s = 0;
    while (s + d < L) { steps.push(d); s += d; d = Math.min(d * r, dmax); }
    // fold the remainder into the last step (or add one if it is a large fraction)
    const rem = L - s;
    if (steps.length && rem < 0.5 * steps[steps.length - 1]) steps[steps.length - 1] += rem; else steps.push(rem);
    if (!fineAtLo) steps.reverse();
    const out = [lo]; let p = lo; for (const st of steps) { p += st; out.push(p); }
    out[out.length - 1] = hi; return out;
  }
  const join = (...parts) => { const o = []; for (const p of parts) for (const v of p) if (!o.length || v > o[o.length - 1] + 1e-12) o.push(v); return o; };

  // Build the half-domain grid (x >= 0, symmetry wall at x = 0). Lengths normalised to h = 1.
  // q = refinement knob (1 = default). Returns {x, y, js0, js1, iw}.
  function buildGrid(W, T, opt = {}) {
    const q = opt.q || 1;
    const d0 = Math.min(W, 1) * 0.004 / q;               // finest cell at the strip edge
    const r = 1 + 0.18 / q;                               // growth ratio
    const ext = opt.ext || 40;                            // box size in units of (1 + 2W)
    const X = W + ext * (1 + 2 * W), Y = 1 + T + ext * (1 + 2 * W);
    const dmaxIn = Math.max(W, 0.05) / (6 * q);
    const x = join(grade(0, W, false, d0, r, dmaxIn), grade(W, X, true, d0, r, 1e9));
    const ySub = grade(0, 1, false, Math.min(d0, 0.004 / q), r, 0.08 / q);
    const yT = T > 0 ? grade(1, 1 + T, true, Math.min(d0, T / 4), r, T / 3) : [1];
    // refine the top side of a thick strip as well
    const yAir = grade(1 + T, Y, true, d0, r, 1e9);
    const y = join(ySub, yT, yAir);
    const iw = x.findIndex(v => Math.abs(v - W) < 1e-12);
    const js0 = y.findIndex(v => Math.abs(v - 1) < 1e-12);
    const js1 = y.findIndex(v => Math.abs(v - (1 + T)) < 1e-12);
    return { x, y, iw, js0, js1, W, T };
  }

  // ------------------------------------------------------------------ assembly
  // Finite-volume conductances on a vertex grid. eps(cell) = er below y = 1, 1 above.
  function assemble(G, er) {
    const { x, y, iw, js0, js1 } = G, nx = x.length, ny = y.length, N = nx * ny;
    const id = (i, j) => j * nx + i;
    const epsC = (i, j) => (y[j + 1] <= 1 + 1e-12 ? er : 1);    // cell (i,j): x_i..x_i+1, y_j..y_j+1
    const gE = new Float64Array(N), gN = new Float64Array(N);   // to (i+1,j) and (i,j+1)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      if (i < nx - 1) {
        const dx = x[i + 1] - x[i];
        const dn = j < ny - 1 ? (y[j + 1] - y[j]) / 2 * epsC(i, j) : 0;
        const ds = j > 0 ? (y[j] - y[j - 1]) / 2 * epsC(i, j - 1) : 0;
        gE[id(i, j)] = (dn + ds) / dx;
      }
      if (j < ny - 1) {
        const dy = y[j + 1] - y[j];
        const de = i < nx - 1 ? (x[i + 1] - x[i]) / 2 * epsC(i, j) : 0;
        const dw = i > 0 ? (x[i] - x[i - 1]) / 2 * epsC(i - 1, j) : 0;  // i = 0: symmetry wall, half volume only
        gN[id(i, j)] = (de + dw) / dy;
      }
    }
    // fixed nodes: 0 = free, 1 = ground/box (phi = 0), 2 = strip (phi = 1)
    const fix = new Uint8Array(N), phi = new Float64Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const p = id(i, j);
      if (j === 0 || j === ny - 1 || i === nx - 1) fix[p] = 1;
      else if (i <= iw && j >= js0 && j <= js1) { fix[p] = 2; phi[p] = 1; }
    }
    return { nx, ny, N, gE, gN, fix, phi };
  }

  // ------------------------------------------------------------------ PCG with IC(0) preconditioner
  function solve(S, opt = {}) {
    const { nx, N, gE, gN, fix, phi } = S;
    const tol = opt.tol || 1e-10, maxIt = opt.maxIt || 4000;
    const diag = new Float64Array(N), b = new Float64Array(N);
    for (let p = 0; p < N; p++) {
      if (fix[p]) continue;
      const nb = [[p + 1, gE[p]], [p - 1, gE[p - 1]], [p + nx, gN[p]], [p - nx, gN[p - nx]]];
      let d = 0;
      for (const [q, g] of nb) { d += g; if (fix[q]) b[p] += g * phi[q]; }
      diag[p] = d;
    }
    // A v (free part only)
    const Av = (v, out) => {
      for (let p = 0; p < N; p++) {
        if (fix[p]) { out[p] = 0; continue; }
        let s = diag[p] * v[p];
        if (!fix[p + 1]) s -= gE[p] * v[p + 1];
        if (!fix[p - 1]) s -= gE[p - 1] * v[p - 1];
        if (!fix[p + nx]) s -= gN[p] * v[p + nx];
        if (!fix[p - nx]) s -= gN[p - nx] * v[p - nx];
        out[p] = s;
      }
    };
    // IC(0): d_p = a_pp - gW^2/d_W - gS^2/d_S   (natural ordering, 5-point stencil)
    const dI = new Float64Array(N);
    for (let p = 0; p < N; p++) {
      if (fix[p]) continue;
      let d = diag[p];
      if (!fix[p - 1]) d -= gE[p - 1] * gE[p - 1] / dI[p - 1];
      if (!fix[p - nx]) d -= gN[p - nx] * gN[p - nx] / dI[p - nx];
      dI[p] = d > 1e-30 ? d : diag[p];
    }
    const prec = (r, z) => {               // solve (L D^-1 L^T) z = r
      const t = z;
      for (let p = 0; p < N; p++) {
        if (fix[p]) { t[p] = 0; continue; }
        let s = r[p];
        if (!fix[p - 1]) s += gE[p - 1] * t[p - 1];
        if (!fix[p - nx]) s += gN[p - nx] * t[p - nx];
        t[p] = s / dI[p];
      }
      for (let p = 0; p < N; p++) if (!fix[p]) t[p] *= dI[p];
      for (let p = N - 1; p >= 0; p--) {
        if (fix[p]) continue;
        let s = t[p];
        if (!fix[p + 1]) s += gE[p] * t[p + 1];
        if (!fix[p + nx]) s += gN[p] * t[p + nx];
        t[p] = s / dI[p];
      }
    };
    // initial guess: supplied or zero
    const xv = new Float64Array(N);
    if (opt.x0 && opt.x0.length === N) for (let p = 0; p < N; p++) if (!fix[p]) xv[p] = opt.x0[p];
    const r = new Float64Array(N), z = new Float64Array(N), pv = new Float64Array(N), q = new Float64Array(N);
    Av(xv, q);
    let bn = 0; for (let p = 0; p < N; p++) { r[p] = fix[p] ? 0 : b[p] - q[p]; bn += b[p] * b[p]; }
    bn = Math.sqrt(bn) || 1;
    prec(r, z); pv.set(z);
    let rz = 0; for (let p = 0; p < N; p++) rz += r[p] * z[p];
    let it = 0, res = 1;
    for (; it < maxIt; it++) {
      Av(pv, q);
      let pq = 0; for (let p = 0; p < N; p++) pq += pv[p] * q[p];
      const al = rz / pq;
      let rn = 0;
      for (let p = 0; p < N; p++) { xv[p] += al * pv[p]; r[p] -= al * q[p]; rn += r[p] * r[p]; }
      res = Math.sqrt(rn) / bn;
      if (res < tol) { it++; break; }
      prec(r, z);
      let rz2 = 0; for (let p = 0; p < N; p++) rz2 += r[p] * z[p];
      const be = rz2 / rz; rz = rz2;
      for (let p = 0; p < N; p++) pv[p] = z[p] + be * pv[p];
    }
    const out = new Float64Array(N);
    for (let p = 0; p < N; p++) out[p] = fix[p] ? phi[p] : xv[p];
    return { phi: out, it, res };
  }

  // Energy: C/eps0 = 2 * sum g (dphi)^2 (factor 2 for the mirrored half)
  function capNorm(S, phi) {
    const { nx, ny, gE, gN } = S; let e = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const p = j * nx + i;
      if (i < nx - 1) { const d = phi[p + 1] - phi[p]; e += gE[p] * d * d; }
      if (j < ny - 1) { const d = phi[p + nx] - phi[p]; e += gN[p] * d * d; }
    }
    return 2 * e;
  }

  // Full quasi-static solve: returns C, C0, eps_eff, Z0 and the fields (with dielectric) for drawing.
  // w, h, t in metres (any consistent unit works; only ratios matter for eps_eff and Z0).
  function fdSolve(w, h, t, er, opt = {}) {
    const W = w / (2 * h), T = t / h;
    const G = buildGrid(W, T, opt);
    const Sd = assemble(G, er), Sa = assemble(G, 1);
    const sd = solve(Sd, { x0: opt.x0d, tol: opt.tol }), sa = solve(Sa, { x0: opt.x0a, tol: opt.tol });
    const cN = capNorm(Sd, sd.phi), c0N = capNorm(Sa, sa.phi);
    const C = cN * EPS0, Ca = c0N * EPS0;
    const eeff = C / Ca, z0 = 1 / (C0 * Math.sqrt(C * Ca));
    return { C, C0: Ca, eeff, z0, grid: G, S: Sd, phi: sd.phi, phiAir: sa.phi, it: [sd.it, sa.it], res: [sd.res, sa.res] };
  }

  // Node charges around the strip perimeter (for equal-flux field-line seeding).
  // Returns an ordered list [{x, y, q}] along bottom -> tip -> top, positions at edge midpoints (normalised units).
  function stripFlux(R) {
    const { grid: G, S, phi } = R, { x, y, iw, js0, js1 } = G, nx = x.length;
    const id = (i, j) => j * nx + i, out = [];
    for (let i = 0; i <= iw; i++) { const p = id(i, js0), q = p - nx; out.push({ x: x[i], y: (y[js0] + y[js0 - 1]) / 2, q: S.gN[q] * (1 - phi[q]), dir: [0, -1] }); }
    for (let j = js0; j <= js1; j++) { const p = id(iw, j); out.push({ x: (x[iw] + x[iw + 1]) / 2, y: y[j], q: S.gE[p] * (1 - phi[p + 1]), dir: [1, 0] }); }
    for (let i = iw; i >= 0; i--) { const p = id(i, js1), q = p + nx; out.push({ x: x[i], y: (y[js1] + y[js1 + 1]) / 2, q: S.gN[p] * (1 - phi[q]), dir: [0, 1] }); }
    return out;
  }

  // ------------------------------------------------------------------ interpolation helpers for drawing
  function locate(arr, v) { let lo = 0, hi = arr.length - 1; if (v <= arr[0]) return 0; if (v >= arr[hi]) return hi - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] <= v) lo = m; else hi = m; } return lo; }
  // potential and E (normalised units) at (x, y); x may be negative (mirror)
  function sample(R, X, Y, which = 'phi') {
    const { x, y } = R.grid, nx = x.length, f = R[which];
    const sx = X < 0 ? -1 : 1, ax = Math.abs(X);
    const i = locate(x, ax), j = locate(y, Y);
    const tx = (ax - x[i]) / (x[i + 1] - x[i]), ty = (Y - y[j]) / (y[j + 1] - y[j]);
    const p = j * nx + i;
    const a = f[p], b = f[p + 1], c = f[p + nx], d = f[p + nx + 1];
    const v = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
    const dvx = ((b - a) * (1 - ty) + (d - c) * ty) / (x[i + 1] - x[i]);
    const dvy = ((c - a) * (1 - tx) + (d - b) * tx) / (y[j + 1] - y[j]);
    return { v, ex: -dvx * sx, ey: -dvy };
  }
  const inStrip = (R, X, Y) => Math.abs(X) <= R.grid.W && Y >= 1 && Y <= 1 + R.grid.T;

  // trace an E-field line from (x, y) until it reaches ground, the box, or a max length
  function traceLine(R, X, Y, opt = {}) {
    const pts = [[X, Y]], hmin = opt.hmin || 2e-3, maxLen = opt.maxLen || 60, yTop = opt.yTop || 1e9, xMax = opt.xMax || 1e9;
    let len = 0;
    for (let k = 0; k < 4000; k++) {
      const s1 = sample(R, X, Y), m1 = Math.hypot(s1.ex, s1.ey); if (m1 < 1e-12) break;
      const dist = Math.max(hmin, 0.02 * Math.min(Math.hypot(X - Math.sign(X) * Math.min(Math.abs(X), R.grid.W), Y - 1) + 0.05, Y + 0.02));
      const hx = s1.ex / m1 * dist, hy = s1.ey / m1 * dist;
      const s2 = sample(R, X + hx / 2, Y + hy / 2), m2 = Math.hypot(s2.ex, s2.ey); if (m2 < 1e-12) break;
      X += s2.ex / m2 * dist; Y += s2.ey / m2 * dist; len += dist;
      if (Y <= 0) { const prev = pts[pts.length - 1]; const t = prev[1] / (prev[1] - Y); pts.push([prev[0] + (X - prev[0]) * t, 0]); break; }
      pts.push([X, Y]);
      if (len > maxLen || Y > yTop || Math.abs(X) > xMax) break;
    }
    return pts;
  }

  // marching squares: segments of the level-set phi = lev, normalised coordinates, half domain
  function contour(R, lev, which = 'phi', box) {
    const { x, y } = R.grid, nx = x.length, ny = y.length, f = R[which], segs = [];
    const i1 = box ? locate(x, box[1]) + 1 : nx - 1, j1 = box ? locate(y, box[3]) + 1 : ny - 1;
    for (let j = 0; j < Math.min(j1, ny - 1); j++) for (let i = 0; i < Math.min(i1, nx - 1); i++) {
      const p = j * nx + i, v = [f[p], f[p + 1], f[p + nx + 1], f[p + nx]];
      const P = [[x[i], y[j]], [x[i + 1], y[j]], [x[i + 1], y[j + 1]], [x[i], y[j + 1]]];
      const cut = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e], b = v[(e + 1) % 4];
        if ((a < lev) !== (b < lev)) { const t = (lev - a) / (b - a); const A = P[e], B = P[(e + 1) % 4]; cut.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
      }
      if (cut.length === 2) segs.push(cut);
      else if (cut.length === 4) { segs.push([cut[0], cut[1]]); segs.push([cut[2], cut[3]]); }
    }
    return segs;
  }

  // ------------------------------------------------------------------ Hammerstad & Jensen (1980)
  function z01(u) {                                     // air-filled, zero thickness
    const f = 6 + (2 * Math.PI - 6) * Math.exp(-Math.pow(30.666 / u, 0.7528));
    return ETA0 / (2 * Math.PI) * Math.log(f / u + Math.sqrt(1 + 4 / (u * u)));
  }
  function eeffHJ0(u, er) {
    const a = 1 + Math.log((Math.pow(u, 4) + Math.pow(u / 52, 2)) / (Math.pow(u, 4) + 0.432)) / 49 + Math.log(1 + Math.pow(u / 18.1, 3)) / 18.7;
    const b = 0.564 * Math.pow((er - 0.9) / (er + 3), 0.053);
    return (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 10 / u, -a * b);
  }
  // with strip thickness t (HJ thickness correction); returns {z0, eeff}
  function hj(w, h, t, er) {
    const u = w / h;
    if (!(t > 0)) { const e = eeffHJ0(u, er); return { z0: z01(u) / Math.sqrt(e), eeff: e, z0air: z01(u) }; }
    const th = t / h;
    const coth = v => 1 / Math.tanh(v);
    const du1 = th / Math.PI * Math.log(1 + 4 * Math.E / (th * Math.pow(coth(Math.sqrt(6.517 * u)), 2)));
    const dur = 0.5 * (1 + 1 / Math.cosh(Math.sqrt(er - 1))) * du1;
    const u1 = u + du1, ur = u + dur;
    const er_ = eeffHJ0(ur, er);
    const eeff = er_ * Math.pow(z01(u1) / z01(ur), 2);
    return { z0: z01(ur) / Math.sqrt(er_), eeff, z0air: z01(u1) };
  }
  // Kirschning & Jansen (1982) dispersion of eps_eff. f in Hz, h in m.
  function eeffKJ(w, h, t, er, f) {
    const u = w / h, fn = f * 1e-9 * h * 1e3;           // GHz * mm
    const e0 = hj(w, h, t, er).eeff;
    const P1 = 0.27488 + (0.6315 + 0.525 / Math.pow(1 + 0.0157 * fn, 20)) * u - 0.065683 * Math.exp(-8.7513 * u);
    const P2 = 0.33622 * (1 - Math.exp(-0.03442 * er));
    const P3 = 0.0363 * Math.exp(-4.6 * u) * (1 - Math.exp(-Math.pow(fn / 38.7, 4.97)));
    const P4 = 1 + 2.751 * (1 - Math.exp(-Math.pow(er / 15.916, 8)));
    const P = P1 * P2 * Math.pow((0.1844 + P3 * P4) * fn, 1.5763);
    return er - (er - e0) / (1 + P);
  }
  // synthesis: width for a target Z0 (HJ), bisection on log(u)
  function synthHJ(z0t, h, t, er) {
    let lo = Math.log(0.01), hi = Math.log(100);
    const g = lu => hj(Math.exp(lu) * h, h, t, er).z0 - z0t;
    if (g(lo) < 0 || g(hi) > 0) return NaN;
    for (let k = 0; k < 100; k++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; }
    return Math.exp((lo + hi) / 2) * h;
  }

  return { EPS0, C0, ETA0, buildGrid, assemble, solve, capNorm, fdSolve, stripFlux, sample, inStrip, traceLine, contour, locate, z01, eeffHJ0, hj, eeffKJ, synthHJ };
})();
globalThis.MsCore = MsCore;
