import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, rel } from './load.mjs';
const K = loadCore('coax.html', 'CoaxCore');
const IN = 25.4e-3;

test('Bessel J0, J1, Y0, Y1 match A&S tables (series and asymptotic branches)', () => {
  const ref = {
    1: [0.7651976866, 0.4400505857, 0.0882569642, -0.7812128213],
    10: [-0.2459357645, 0.0434727462, 0.0556711673, 0.2490154242],
    20: [0.1670246643, 0.0668331242, 0.0626405968, -0.1655116144],
  };
  for (const [x, [j0, j1, y0, y1]] of Object.entries(ref)) {
    const B = K.bessel(+x);
    for (const [a, b] of [[B.j0, j0], [B.j1, j1], [B.y0, y0], [B.y1, y1]]) assert.ok(Math.abs(a - b) < 2e-9, `x=${x}: ${a} vs ${b}`);
  }
});

test('Z0 of standard lines from manufacturer / standard dimensions', () => {
  const cases = [
    ['N air line 7.00/3.04 mm', 3.04e-3, 7.00e-3, 1, 50.0, 0.1],
    ['7/16 air line 16/7 mm', 7e-3, 16e-3, 1, 49.6, 0.1],
    ['3.5 mm air line', 1.52e-3, 3.5e-3, 1, 50.0, 0.1],
    ['RG-402 (M17/130)', 0.0362 * IN, 0.1175 * IN, 2.07, 50, 1.0],
    ['LMR-400 (Times)', 0.108 * IN, 0.285 * IN, 1.38, 50, 0.6],
    ['RG-58/U (Belden 8240)', 0.033 * IN, 0.116 * IN, 2.25, 50, 0.6],
  ];
  for (const [n, d, D, er, z, tol] of cases) { const v = K.z0(d / 2, D / 2, er); assert.ok(Math.abs(v - z) <= tol, `${n}: ${v}`); }
});

test('classic optima for a fixed outer conductor (air): 30, 60, 76.7 ohm', () => {
  assert.ok(Math.abs(K.optima.power - Math.exp(0.5)) < 1e-12);
  assert.ok(Math.abs(K.optima.voltage - Math.E) < 1e-12);
  const x = K.optima.loss; assert.ok(Math.abs(Math.log(x) - 1 - 1 / x) < 1e-12);
  assert.ok(Math.abs(x - 3.5911) < 1e-4);
  assert.ok(Math.abs(K.z0(1, K.optima.power, 1) - 29.98) < 0.01);
  assert.ok(Math.abs(K.z0(1, K.optima.voltage, 1) - 59.96) < 0.01);
  assert.ok(Math.abs(K.z0(1, K.optima.loss, 1) - 76.65) < 0.01);
  for (const k of ['power', 'voltage']) { const o = K.optima[k]; assert.ok(K.sweep[k](o) > K.sweep[k](o * 1.01) && K.sweep[k](o) > K.sweep[k](o / 1.01)); }
  const o = K.optima.loss; assert.ok(K.sweep.loss(o) < K.sweep.loss(o * 1.01) && K.sweep.loss(o) < K.sweep.loss(o / 1.01));
});

test('conductor loss equals the Wheeler incremental-inductance rule (numerical derivative)', () => {
  const a = 0.46e-3, b = 1.49e-3, er = 2.07, f = 10e9, rho = 1.7241e-8;
  const Rs = Math.sqrt(Math.PI * f * K.MU0 * rho), eta = K.ETA0 / Math.sqrt(er), dn = 1e-9;
  const dZ = (K.z0(a - dn, b + dn, er) - K.z0(a, b, er)) / dn;
  const wheeler = Rs / (2 * K.z0(a, b, er) * eta) * dZ;
  assert.ok(rel(K.alphaC(a, b, er, f, rho), wheeler) < 1e-5);
});

test('dielectric loss = 27.29 sqrt(er) tan(d) / lambda0 dB/m', () => {
  const er = 2.1, td = 3e-4, f = 18e9;
  const ref = Math.PI * 20 / Math.LN10 * Math.sqrt(er) * td / (K.C0 / f);
  assert.ok(rel(K.alphaD(er, td, f) * K.NP2DB, ref) < 1e-12);
});

// independent TE11 root: own Bessel series (valid for small arguments) and own bracketing
function jy1(x) {
  const g = 0.5772156649015329; let j0 = 0, j1 = 0, s0 = 0, s1 = 0, f = 1, H = 0;
  for (let k = 0; k < 60; k++) {
    if (k > 0) { f *= k; H += 1 / k; }
    const t0 = (-1) ** k * (x / 2) ** (2 * k) / (f * f), t1 = (-1) ** k * (x / 2) ** (2 * k + 1) / (f * f * (k + 1));
    j0 += t0; j1 += t1; s0 += (H - g) * t0; s1 += ((H - g) + (H + 1 / (k + 1) - g)) * t1;
  }
  const y0 = (2 / Math.PI) * Math.log(x / 2) * j0 - (2 / Math.PI) * s0;
  const y1 = -2 / (Math.PI * x) + (2 / Math.PI) * Math.log(x / 2) * j1 - s1 / Math.PI;
  return { dj: j0 - j1 / x, dy: y0 - y1 / x };
}
function te11Ind(c) {
  const F = x => { const A = jy1(x), B = jy1(c * x); return A.dj * B.dy - B.dj * A.dy; };
  let lo = 0.3 / (1 + c), hi = lo + 1e-3; while (F(lo) * F(hi) > 0) { lo = hi; hi += 1e-3; }
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (F(lo) * F(m) <= 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}
test('TE11 cutoff root agrees with an independent series solve', () => {
  for (const c of [1.2, 1.5, 2, 2.3026, 3, 3.5911, 5, 8]) {
    const k = K.te11Kc(1, c), ki = te11Ind(c);
    assert.ok(rel(k, ki) < 1e-8, `b/a=${c}: ${k} vs ${ki}`);
  }
  assert.ok(Math.abs(K.te11Kc(1, 1.001) * (1 + 1.001) / 2 - 1) < 1e-5);   // thin-gap limit: kc -> 2/(a+b)
});

test('peak field and power limit are consistent', () => {
  const a = 3.5e-3, b = 8e-3, Ebd = 3e6, P = K.pMax(a, b, 1, Ebd);
  const V = Math.sqrt(2 * K.z0(a, b, 1) * P);
  assert.ok(rel(K.eMax(V, a, b), Ebd) < 1e-12);
});
