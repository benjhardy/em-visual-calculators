import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, rel } from './load.mjs';
const S = loadCore('skin.html', 'SkinCore');

// Independent route: Kelvin functions ber, bei and derivatives by their power series (A&S 9.9.10),
// R/R0 = (q/2) (ber bei' - bei ber') / (ber'^2 + bei'^2), q = sqrt(2) a / delta.
function kelvin(q) {
  let ber = 0, bei = 0, berp = 0, beip = 0; const h = q / 2;
  let f2 = 1;
  for (let k = 0; k < 60; k++) {
    if (k > 0) f2 *= (2 * k - 1) * (2 * k);         // (2k)!
    const f21 = f2 * (2 * k + 1), s = k % 2 ? -1 : 1;
    ber += s * h ** (4 * k) / (f2 * f2); bei += s * h ** (4 * k + 2) / (f21 * f21);
    if (k > 0) berp += s * 2 * k * h ** (4 * k - 1) / (f2 * f2);
    beip += s * (2 * k + 1) * h ** (4 * k + 1) / (f21 * f21);
  }
  return { ber, bei, berp, beip, ratio: (q / 2) * (ber * beip - bei * berp) / (berp * berp + beip * beip) };
}

test('Kelvin functions match A&S Table 9.12', () => {
  // ber(1), bei(1), ber(2), bei(2), ber(5), bei(5)
  assert.ok(Math.abs(kelvin(1).ber - 0.98438178) < 1e-8);
  assert.ok(Math.abs(kelvin(1).bei - 0.24956604) < 1e-8);
  assert.ok(Math.abs(kelvin(2).ber - 0.75173418) < 1e-8);
  assert.ok(Math.abs(kelvin(2).bei - 0.97229163) < 1e-8);
  assert.ok(Math.abs(kelvin(5).ber - (-6.23008250)) < 1e-7);
  assert.ok(Math.abs(kelvin(5).bei - 0.11603444) < 1e-7);
});

test('Rac/Rdc: Bessel solution = independent ber/bei route (q 0.5..20)', () => {
  for (const q of [0.5, 1, 1.5, 2, 3, 4, 5, 7, 10, 14, 20]) {
    const ex = S.racRdc(q / Math.SQRT2), kv = kelvin(q).ratio;
    assert.ok(rel(ex, kv) < 1e-9, `q=${q}: ${ex} vs ${kv}`);
  }
});

test('Rac/Rdc matches the classic tabulated values (3 decimals)', () => {
  const table = [[1, 1.005], [2, 1.078], [3, 1.318], [4, 1.678], [5, 2.043], [7, 2.743], [10, 3.799], [20, 7.328]];
  for (const [q, r] of table) assert.ok(Math.abs(S.racRdc(q / Math.SQRT2) - r) < 6e-4, `q=${q}`);
});

test('Rac/Rdc approaches a/2δ + 1/4 + 3δ/32a (asymptotic branch, |ka| > 25)', () => {
  for (const x of [30, 50, 100, 1000, 1e5]) {
    const asym = x / 2 + 0.25 + 3 / (32 * x);
    assert.ok(rel(S.racRdc(x), asym) < 2e-5, `x=${x}: ${S.racRdc(x)} vs ${asym}`);
  }
});

test('series and asymptotic branches join smoothly at |ka| = 25', () => {
  const x = 25 / Math.SQRT2, a = S.zRatio(x * (1 - 1e-10)), b = S.zRatio(x * (1 + 1e-10));
  assert.ok(Math.abs(a[0] - b[0]) < 1e-8 && Math.abs(a[1] - b[1]) < 1e-8, `${a} vs ${b}`);
});

test('low-frequency limit: Z/Rdc -> 1 + j x^2/4', () => {
  const z = S.zRatio(0.05);
  assert.ok(Math.abs(z[0] - 1) < 1e-6 && rel(z[1], 0.05 ** 2 / 4) < 1e-3);
});

test('skin depth of annealed copper at 1 MHz and 10 GHz', () => {
  // delta = sqrt(rho / (pi f mu0)); rho = 1.7241e-8 ohm m
  assert.ok(rel(S.skinDepth(1.7241e-8, 1e6), 66.085e-6) < 1e-4);
  assert.ok(rel(S.skinDepth(1.7241e-8, 10e9), 0.66085e-6) < 1e-4);
  assert.ok(rel(S.surfaceR(1.7241e-8, 10e9), 0.02609) < 1e-3);
  // mu_r scales delta by 1/sqrt(mu_r)
  assert.ok(rel(S.skinDepth(1e-7, 1e3, 100), S.skinDepth(1e-7, 1e3, 1) / 10) < 1e-12);
});

test('current profile: |J(r)/J(a)| decays like sqrt(a/r) e^{-(a-r)/δ} for thin skins', () => {
  const x = 400, rho = 0.99, J = S.currentRatio(x, rho), mag = Math.hypot(J[0], J[1]);
  const approx = Math.sqrt(1 / rho) * Math.exp(-(1 - rho) * x);
  assert.ok(rel(mag, approx) < 2e-3, `${mag} vs ${approx}`);
  const ph = Math.atan2(J[1], J[0]);   // phase lag of (a-r)/delta = 4 rad -> wraps to 4 - 2pi
  assert.ok(Math.abs(ph - (-(1 - rho) * x + 2 * Math.PI)) < 2e-3 || Math.abs(ph + (1 - rho) * x) < 2e-3);
});
