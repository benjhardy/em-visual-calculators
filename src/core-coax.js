// Coaxial line core maths. Pure functions, no DOM. Tested by tests/coax.test.mjs.
const CoaxCore = (() => {
  const MU0 = 1.25663706212e-6, EPS0 = 8.8541878128e-12, C0 = 299792458;
  const ETA0 = MU0 * C0;                       // 376.730... ohm
  const NP2DB = 20 / Math.LN10;                // 8.686 dB per neper
  const GAMMA = 0.5772156649015329;

  // ---- real Bessel functions J0, J1, Y0, Y1 (series for x < 12, Hankel asymptotic above) ----
  function bessel(x) {
    if (x < 12) {
      const q = -x * x / 4;
      let t0 = 1, j0 = 1, t1 = 1, j1s = 1, y0s = 0, y1s = 0, H = 0;
      // psi(k+1) = -gamma + H_k
      let psi1 = -GAMMA, psi2 = -GAMMA + 1;   // psi(k+1), psi(k+2) at k = 0
      y0s = psi1 * t0; y1s = (psi1 + psi2) * t1;
      for (let k = 1; k < 80; k++) {
        t0 *= q / (k * k);
        t1 *= q / (k * (k + 1));
        H += 1 / k;
        psi1 = -GAMMA + H; psi2 = psi1 + 1 / (k + 1);
        j0 += t0; j1s += t1;
        y0s += psi1 * t0; y1s += (psi1 + psi2) * t1;
        if (Math.abs(t0) < 1e-18 && Math.abs(t1) < 1e-18 && k > x) break;
      }
      const j1 = x / 2 * j1s;
      const L = Math.log(x / 2);
      const y0 = (2 / Math.PI) * L * j0 - (2 / Math.PI) * y0s;
      const y1 = -2 / (Math.PI * x) + (2 / Math.PI) * L * j1 - (x / (2 * Math.PI)) * y1s;
      return { j0, j1, y0, y1 };
    }
    const PQ = nu => {
      const mu = 4 * nu * nu; let P = 1, Q = 0, term = 1, last = Infinity;
      for (let k = 1; k < 40; k++) {
        term *= (mu - (2 * k - 1) * (2 * k - 1)) / (k * 8 * x);
        const m = Math.abs(term); if (m > last) break; last = m;
        const sgn = (Math.floor(k / 2) % 2) ? -1 : 1;
        if (k % 2) Q += sgn * term; else P += sgn * term;
        if (m < 1e-17) break;
      }
      return [P, Q];
    };
    const pre = Math.sqrt(2 / (Math.PI * x));
    const out = {};
    for (const nu of [0, 1]) {
      const w = x - nu * Math.PI / 2 - Math.PI / 4, [P, Q] = PQ(nu);
      out['j' + nu] = pre * (P * Math.cos(w) - Q * Math.sin(w));
      out['y' + nu] = pre * (P * Math.sin(w) + Q * Math.cos(w));
    }
    return out;
  }
  // derivatives of order 1: J1'(x) = J0 - J1/x, Y1'(x) = Y0 - Y1/x
  function d1(x) { const B = bessel(x); return { j1: B.j1, y1: B.y1, dj1: B.j0 - B.j1 / x, dy1: B.y0 - B.y1 / x }; }

  // ---- TEM line parameters ----
  // a, b = inner conductor radius, outer conductor inner radius [m]
  const z0 = (a, b, er) => ETA0 / (2 * Math.PI * Math.sqrt(er)) * Math.log(b / a);
  const capPerM = (a, b, er) => 2 * Math.PI * EPS0 * er / Math.log(b / a);
  const indPerM = (a, b) => MU0 / (2 * Math.PI) * Math.log(b / a);
  const skinDepth = (rho, f) => Math.sqrt(rho / (Math.PI * f * MU0));
  // Conductor loss (smooth walls, skin-effect limit): R' = Rs/(2 pi) (1/a + 1/b), alpha_c = R'/(2 Z0)  [Np/m]
  function alphaC(a, b, er, f, rhoIn, rhoOut = rhoIn) {
    const RsA = rhoIn / skinDepth(rhoIn, f), RsB = rhoOut / skinDepth(rhoOut, f);
    const R = (RsA / a + RsB / b) / (2 * Math.PI);
    return R / (2 * z0(a, b, er));
  }
  // Dielectric loss: alpha_d = (omega sqrt(er)/(2 c)) tan(delta)  [Np/m]
  const alphaD = (er, tand, f) => Math.PI * f * Math.sqrt(er) / C0 * tand;

  // ---- TE11 cutoff ----
  // approximation: kc ~ 2 / (a + b)   (mean circumference = one wavelength)
  const te11Approx = (a, b, er) => C0 / (Math.PI * (a + b) * Math.sqrt(er));
  // exact: smallest root x = kc a of J1'(x) Y1'(c x) - J1'(c x) Y1'(x) = 0, c = b/a
  function te11Kc(a, b) {
    const c = b / a;
    const F = x => { const A = d1(x), B = d1(c * x); return A.dj1 * B.dy1 - B.dj1 * A.dy1; };
    const x0 = 2 / (1 + c);
    let lo = x0 * 0.6, flo = F(lo), hi = lo, fhi = flo;
    for (let i = 0; i < 400; i++) { hi = lo * 1.01; fhi = F(hi); if (flo * fhi <= 0) break; lo = hi; flo = fhi; }
    for (let i = 0; i < 200; i++) {
      const m = 0.5 * (lo + hi), fm = F(m);
      if (flo * fm <= 0) { hi = m; fhi = fm; } else { lo = m; flo = fm; }
      if (hi - lo < 1e-14 * hi) break;
    }
    return 0.5 * (lo + hi) / a;
  }
  const te11Exact = (a, b, er) => C0 * te11Kc(a, b) / (2 * Math.PI * Math.sqrt(er));
  // TE11 longitudinal field Hz(r, phi) ~ [J1(kc r) Y1'(kc a) - Y1(kc r) J1'(kc a)] cos(phi)
  function te11Hz(r, phi, a, kc) { const A = d1(kc * a), R = bessel(kc * r); return (R.j1 * A.dy1 - R.y1 * A.dj1) * Math.cos(phi); }

  // ---- peak-field limits ----
  // field at radius r for voltage V: E(r) = V / (r ln(b/a)); max at r = a
  const eMax = (V, a, b) => V / (a * Math.log(b / a));
  // peak power at breakdown (matched, CW): P = V^2/(2 Z0) with V = Ebd a ln(b/a)
  function pMax(a, b, er, Ebd) { const V = Ebd * a * Math.log(b / a); return V * V / (2 * z0(a, b, er)); }
  const vMax = (a, b, Ebd) => Ebd * a * Math.log(b / a);

  // ---- classic optima for a fixed outer radius b (independent of er) ----
  // power  ~ ln(x)/x^2   -> ln x = 1/2  -> x = 1.6487 (30 ohm in air)
  // voltage~ ln(x)/x     -> ln x = 1    -> x = e      (60 ohm in air)
  // loss   ~ (1+x)/ln x  -> ln x = 1 + 1/x -> x = 3.5911 (76.7 ohm in air)
  function optLossRatio() { let x = 3.5; for (let i = 0; i < 60; i++) { const g = Math.log(x) - 1 - 1 / x, dg = 1 / x + 1 / (x * x); x -= g / dg; } return x; }
  const optima = { power: Math.exp(0.5), voltage: Math.E, loss: optLossRatio() };
  // normalised sweep functions (each = 1 at its optimum)
  const sweep = {
    power: x => (Math.log(x) / (x * x)) / (0.5 / Math.E),
    voltage: x => (Math.log(x) / x) / (1 / Math.E),
    loss: x => ((1 + x) / Math.log(x)) / ((1 + optima.loss) / Math.log(optima.loss)),
  };

  return { MU0, EPS0, C0, ETA0, NP2DB, bessel, d1, z0, capPerM, indPerM, skinDepth, alphaC, alphaD, te11Approx, te11Kc, te11Exact, te11Hz, eMax, pMax, vMax, optima, sweep };
})();
globalThis.CoaxCore = CoaxCore;
