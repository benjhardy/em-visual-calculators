// Rectangular waveguide core maths (TE_mn / TM_mn of a hollow or uniformly filled guide). Pure functions, no DOM.
// Field forms follow Pozar, Microwave Engineering, 4th ed., Sec. 3.3 (time convention e^{jwt}, propagation e^{-jbz}).
// Tested by tests/waveguide.test.mjs.
const WgCore = (() => {
  const MU0 = 1.25663706212e-6, EPS0 = 8.8541878128e-12, C0 = 299792458, ETA0 = MU0 * C0;
  const NP2DB = 20 / Math.LN10;

  const kc = (m, n, a, b) => Math.hypot(m * Math.PI / a, n * Math.PI / b);
  const fc = (m, n, a, b, er = 1) => C0 * kc(m, n, a, b) / (2 * Math.PI * Math.sqrt(er));
  // TE needs m + n >= 1; TM needs m >= 1 and n >= 1
  const valid = (type, m, n) => type === 'TE' ? (m + n > 0) : (m > 0 && n > 0);

  // list modes sorted by cutoff (up to fmax or count)
  function modeList(a, b, er = 1, count = 12) {
    const out = [];
    for (let m = 0; m <= 6; m++) for (let n = 0; n <= 6; n++) for (const type of ['TE', 'TM']) {
      if (!valid(type, m, n)) continue;
      out.push({ type, m, n, fc: fc(m, n, a, b, er), name: type + m + n });
    }
    out.sort((p, q) => p.fc - q.fc || (p.type < q.type ? -1 : 1));
    return out.slice(0, count);
  }

  // propagation quantities at frequency f for a mode. Returns beta (rad/m) or alpha (Np/m) when evanescent.
  function prop(type, m, n, a, b, f, er = 1) {
    const v = C0 / Math.sqrt(er), k = 2 * Math.PI * f / v, K = kc(m, n, a, b), eta = ETA0 / Math.sqrt(er);
    const r = fc(m, n, a, b, er) / f, s = 1 - r * r;
    if (s > 0) {
      const beta = Math.sqrt(k * k - K * K);
      return {
        propagating: true, k, kc: K, beta, alpha: 0,
        lambda: v / f, lambdaG: 2 * Math.PI / beta, vp: 2 * Math.PI * f / beta, vg: v * Math.sqrt(s),
        Z: type === 'TE' ? eta * k / beta : eta * beta / k,
      };
    }
    const alpha = Math.sqrt(K * K - k * k);
    return { propagating: false, k, kc: K, beta: 0, alpha, lambda: v / f, lambdaG: Infinity, vp: Infinity, vg: 0,
      // reactive wave impedance: TE inductive (+j), TM capacitive (-j); magnitude only
      Zim: type === 'TE' ? eta * k / alpha : -eta * alpha / k, Z: NaN };
  }

  // Surface resistance of the walls: Rs = sqrt(w mu0 / (2 sigma))
  const Rs = (f, rho) => Math.sqrt(2 * Math.PI * f * MU0 * rho / 2);

  // Conductor attenuation (smooth walls, perturbation method) [Np/m].
  // TE_m0 (incl. TE10): Rs / (b eta sqrt(1-fr^2)) [1 + (2b/a) fr^2]               (Pozar eq. 3.96 for TE10)
  // TE_0n: same with a <-> b.
  // TE_mn (m,n >= 1): 2Rs/(b eta sqrt) { (1 + b/a) fr^2 + (1 - fr^2) [ (b/a)((b/a) m^2 + n^2) / ((b m/a)^2 + n^2) ] }
  // TM_mn: 2Rs/(b eta sqrt) (m^2 b^3 + n^2 a^3) / (m^2 b^2 a + n^2 a^3)
  // (e.g. Collin, Foundations for Microwave Engineering, 2nd ed., Sec. 3.13; Ramo, Whinnery & Van Duzer, Table 8.04)
  function alphaC(type, m, n, a, b, f, rho, er = 1) {
    const eta = ETA0 / Math.sqrt(er), fr = fc(m, n, a, b, er) / f;
    if (fr >= 1) return NaN;
    const sq = Math.sqrt(1 - fr * fr), R = Rs(f, rho);
    if (type === 'TE') {
      if (n === 0) return R / (b * eta * sq) * (1 + 2 * b / a * fr * fr);
      if (m === 0) return R / (a * eta * sq) * (1 + 2 * a / b * fr * fr);
      const ba = b / a;
      return 2 * R / (b * eta * sq) * ((1 + ba) * fr * fr + (1 - fr * fr) * (ba * (ba * m * m + n * n)) / (ba * ba * m * m + n * n));
    }
    return 2 * R / (b * eta * sq) * (m * m * b ** 3 + n * n * a ** 3) / (m * m * b * b * a + n * n * a ** 3);
  }
  // Dielectric attenuation: alpha_d = k^2 tan(delta) / (2 beta)  [Np/m]   (Pozar eq. 3.29)
  function alphaD(type, m, n, a, b, f, er, tand) { const P = prop(type, m, n, a, b, f, er); return P.propagating ? P.k * P.k * tand / (2 * P.beta) : NaN; }

  // Complex transverse+longitudinal field amplitudes at (x, y), unit mode amplitude (A or B = 1), z = 0.
  // gamma = j beta (propagating) or alpha (evanescent): fields carry e^{-gamma z}. Returns {E:[x,y,z], H:[x,y,z]} as [re,im].
  function fields(type, m, n, a, b, f, er, x, y) {
    const P = prop(type, m, n, a, b, f, er), K2 = P.kc * P.kc, w = 2 * Math.PI * f, mu = MU0, eps = EPS0 * er;
    const g = P.propagating ? [0, P.beta] : [P.alpha, 0];          // gamma = alpha + j beta
    const cx = Math.cos(m * Math.PI * x / a), sx = Math.sin(m * Math.PI * x / a);
    const cy = Math.cos(n * Math.PI * y / b), sy = Math.sin(n * Math.PI * y / b);
    const kx = m * Math.PI / a, ky = n * Math.PI / b;
    const mulj = (s, c) => [0, s * c];                                // j * s * c
    const mulg = (s) => [-g[0] * s, -g[1] * s];                        // -gamma * s
    if (type === 'TE') {
      // Hz = cos cos; Et = (j w mu / kc^2) z x grad Hz ... Pozar Table 3.2 with -j beta -> -gamma
      const Ex = mulj(w * mu * ky / K2, cx * sy);
      const Ey = mulj(-w * mu * kx / K2, sx * cy);
      const Hx = mulg(-kx / K2 * sx * cy);                            // Hx = (gamma kx / kc^2) sx cy
      const Hy = mulg(-ky / K2 * cx * sy);                            // Hy = (gamma ky / kc^2) cx sy
      return { E: [Ex, Ey, [0, 0]], H: [Hx, Hy, [cx * cy, 0]] };
    }
    // TM: Ez = sin sin
    const Ex = mulg(kx / K2 * cx * sy);                                 // Ex = -(gamma kx / kc^2) cx sy
    const Ey = mulg(ky / K2 * sx * cy);                                 // Ey = -(gamma ky / kc^2) sx cy
    const Hx = mulj(w * eps * ky / K2, sx * cy);
    const Hy = mulj(-w * eps * kx / K2, cx * sy);
    return { E: [Ex, Ey, [sx * sy, 0]], H: [Hx, Hy, [0, 0]] };
  }

  return { MU0, EPS0, C0, ETA0, NP2DB, kc, fc, valid, modeList, prop, Rs, alphaC, alphaD, fields };
})();
globalThis.WgCore = WgCore;
