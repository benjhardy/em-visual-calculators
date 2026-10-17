// Skin effect core maths. Pure functions, no DOM. Tested by tests/skin.test.mjs.
// Time convention e^{+jwt}. Inside a round wire, Jz(r) = J(0) J0(k r) with k = (1 - j)/delta.
const SkinCore = (() => {
  const MU0 = 1.25663706212e-6;           // CODATA 2018, H/m
  const TWO_PI = 2 * Math.PI;

  // complex numbers as [re, im]
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const scl = (a, s) => [a[0] * s, a[1] * s];
  const abs = a => Math.hypot(a[0], a[1]);
  const arg = a => Math.atan2(a[1], a[0]);
  const csqrt = a => { const r = abs(a), t = arg(a) / 2, s = Math.sqrt(r); return [s * Math.cos(t), s * Math.sin(t)]; };

  // Skin depth delta = sqrt(2 rho / (w mu0 mur))  [m]
  function skinDepth(rho, f, mur = 1) { return Math.sqrt(2 * rho / (TWO_PI * f * MU0 * mur)); }
  // Surface resistance Rs = rho / delta  [ohm/sq]
  function surfaceR(rho, f, mur = 1) { return rho / skinDepth(rho, f, mur); }

  // J0(z), J1(z) for complex z with a shared scale: value = mantissa * exp(s).
  // |z| <= 25: power series. |z| > 25: Hankel asymptotic expansion (A&S 9.2.5-9.2.10), scaled.
  function besselJ01(z) {
    const r = abs(z);
    if (r <= 25) {
      const q = scl(mul(z, z), -0.25);         // -z^2/4
      let t0 = [1, 0], s0 = [1, 0];             // J0 terms
      let t1 = [1, 0], s1 = [1, 0];             // J1 / (z/2) terms
      for (let k = 1; k < 200; k++) {
        t0 = scl(mul(t0, q), 1 / (k * k));
        t1 = scl(mul(t1, q), 1 / (k * (k + 1)));
        s0 = add(s0, t0); s1 = add(s1, t1);
        if (k > r && abs(t0) < 1e-17 * Math.max(1e-300, abs(s0)) && abs(t1) < 1e-17 * Math.max(1e-300, abs(s1))) break;
      }
      return { j0: s0, j1: mul(scl(z, 0.5), s1), s: 0 };
    }
    // asymptotic: J_nu = sqrt(2/(pi z)) [P cos w - Q sin w], w = z - nu pi/2 - pi/4
    const PQ = nu => {
      const mu = 4 * nu * nu;
      let P = [1, 0], Q = [0, 0];
      let term = [1, 0];                         // a_k / z^k
      const iz = div([1, 0], z);
      let last = Infinity;
      for (let k = 1; k < 40; k++) {
        const fac = (mu - (2 * k - 1) * (2 * k - 1)) / (k * 8);
        term = scl(mul(term, iz), fac);
        const m = abs(term);
        if (m > last) break;                     // asymptotic series: stop at smallest term
        last = m;
        // k odd -> Q, k even -> P, sign (-1)^floor(k/2)
        const sgn = (Math.floor(k / 2) % 2) ? -1 : 1;
        if (k % 2) Q = add(Q, scl(term, sgn)); else P = add(P, scl(term, sgn));
        if (m < 1e-17) break;
      }
      return [P, Q];
    };
    const pre = csqrt(div([2 / Math.PI, 0], z));
    const out = [];
    let sc = 0;
    for (const nu of [0, 1]) {
      const w = [z[0] - nu * Math.PI / 2 - Math.PI / 4, z[1]];
      const m = Math.abs(w[1]); sc = m;
      // e^{iw} e^{-m} and e^{-iw} e^{-m}
      const ep = scl([Math.cos(w[0]), Math.sin(w[0])], Math.exp(-w[1] - m));
      const em = scl([Math.cos(w[0]), -Math.sin(w[0])], Math.exp(w[1] - m));
      const cosw = scl(add(ep, em), 0.5);
      const sinw = div(add(ep, scl(em, -1)), [0, 2]);
      const [P, Q] = PQ(nu);
      out.push(mul(pre, add(mul(P, cosw), scl(mul(Q, sinw), -1))));
    }
    return { j0: out[0], j1: out[1], s: sc };
  }

  // Normalised current density J(r)/J(a) for x = a/delta and rho = r/a in [0, 1]  -> complex
  function currentRatio(x, rho) {
    const ka = [x, -x];                          // (1 - j) a / delta
    const A = besselJ01(ka), R = besselJ01(scl(ka, rho));
    return scl(div(R.j0, A.j0), Math.exp(R.s - A.s));
  }

  // Internal impedance per unit length over R_dc: Z/Rdc = (k a / 2) J0(ka) / J1(ka)  -> [R/Rdc, wLi/Rdc]
  function zRatio(x) {
    if (x < 1e-6) return [1, x * x / 4];
    const ka = [x, -x];
    const B = besselJ01(ka);
    return mul(scl(ka, 0.5), div(B.j0, B.j1));
  }
  const racRdc = x => zRatio(x)[0];

  // Approximations (a/delta = x)
  const approx = {
    surface: x => x / 2,                         // all current in a 2*pi*a*delta shell
    surfacePlusQuarter: x => x / 2 + 0.25,       // first two terms of the large-x expansion
    annulus: x => (x > 1 ? x * x / (2 * x - 1) : 1), // annulus of thickness delta: a^2 / (2 a delta - delta^2)
  };

  // Flat conductor (half-space): J(z)/J(0) = exp(-(1 + j) z / delta)
  const flatRatio = zd => scl([Math.cos(-zd), Math.sin(-zd)], Math.exp(-zd));

  // DC resistance per metre of a round wire of radius a
  const rdcPerM = (rho, a) => rho / (Math.PI * a * a);

  return { MU0, skinDepth, surfaceR, besselJ01, currentRatio, zRatio, racRdc, approx, flatRatio, rdcPerM, cx: { add, mul, div, scl, abs, arg } };
})();
globalThis.SkinCore = SkinCore;
