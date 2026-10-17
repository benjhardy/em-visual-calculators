import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, rel } from './load.mjs';
const G = loadCore('waveguide.html', 'WgCore');
const IN = 25.4e-3;

test('Pozar Example 3.1 (Teflon-filled K-band guide, 15 GHz) within 0.5% (book uses c = 3e8)', () => {
  const a = 1.07e-2, b = 0.43e-2, er = 2.08, f = 15e9;
  const fc = (m, n) => G.fc(m, n, a, b, er) / 1e9;
  assert.ok(rel(fc(1, 0), 9.72) < 0.005 && rel(fc(2, 0), 19.44) < 0.005 && rel(fc(0, 1), 24.19) < 0.005 && rel(fc(1, 1), 26.07) < 0.005 && rel(fc(3, 0), 29.16) < 0.005);
  const p = G.prop('TE', 1, 0, a, b, f, er);
  assert.ok(rel(p.k, 453.1) < 0.005 && rel(p.beta, 345.1) < 0.005);
  assert.ok(rel(G.alphaD('TE', 1, 0, a, b, f, er, 4e-4) * G.NP2DB, 1.03) < 0.005);
  assert.ok(rel(G.alphaC('TE', 1, 0, a, b, f, 1 / 5.813e7, er) * G.NP2DB, 0.434) < 0.005);
  assert.equal(G.modeList(a, b, er, 6).map(m => m.name).slice(0, 3).join(','), 'TE10,TE20,TE01');
});

test('standard guides: TE10 cutoff WR-90 6.557 GHz, WR-28 21.08 GHz, WR-10 59.01 GHz', () => {
  assert.ok(rel(G.fc(1, 0, 0.9 * IN, 0.4 * IN), 6.557e9) < 1e-4);
  assert.ok(rel(G.fc(1, 0, 0.28 * IN, 0.14 * IN), 21.08e9) < 2e-4);
  assert.ok(rel(G.fc(1, 0, 0.1 * IN, 0.05 * IN), 59.01e9) < 2e-4);
});

test('TE10 loss equals the Pozar eq. 3.96 form Rs(2b pi^2 + a^3 k^2)/(a^3 b beta k eta)', () => {
  const a = 0.9 * IN, b = 0.4 * IN, f = 10e9, rho = 1.7241e-8, p = G.prop('TE', 1, 0, a, b, f, 1), Rs = G.Rs(f, rho);
  const ref = Rs * (2 * b * Math.PI ** 2 + a ** 3 * p.k ** 2) / (a ** 3 * b * p.beta * p.k * G.ETA0);
  assert.ok(rel(G.alphaC('TE', 1, 0, a, b, f, rho, 1), ref) < 1e-12);
  assert.ok(Math.abs(G.alphaC('TE', 1, 0, a, b, f, rho, 1) * G.NP2DB - 0.1095) < 0.002);   // ~0.11 dB/m, WR-90 copper at 10 GHz
});

// Independent check of every attenuation formula: integrate wall loss and transmitted power from the field expressions.
function alphaNumeric(type, m, n, a, b, f, rho, er) {
  const N = 300, Rs = G.Rs(f, rho), mag2 = c => c[0] * c[0] + c[1] * c[1];
  let P = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const F = G.fields(type, m, n, a, b, f, er, (i + 0.5) / N * a, (j + 0.5) / N * b);
    const [Ex, Ey] = F.E, [Hx, Hy] = F.H;    // Sz = 1/2 Re(Ex Hy* - Ey Hx*)
    P += 0.5 * ((Ex[0] * Hy[0] + Ex[1] * Hy[1]) - (Ey[0] * Hx[0] + Ey[1] * Hx[1])) * (a / N) * (b / N);
  }
  let Pl = 0;
  for (let i = 0; i < N; i++) {          // walls y = 0 and y = b: tangential Hx, Hz
    const x = (i + 0.5) / N * a;
    for (const y of [0, b]) { const F = G.fields(type, m, n, a, b, f, er, x, y); Pl += Rs / 2 * (mag2(F.H[0]) + mag2(F.H[2])) * a / N; }
  }
  for (let j = 0; j < N; j++) {          // walls x = 0 and x = a: tangential Hy, Hz
    const y = (j + 0.5) / N * b;
    for (const x of [0, a]) { const F = G.fields(type, m, n, a, b, f, er, x, y); Pl += Rs / 2 * (mag2(F.H[1]) + mag2(F.H[2])) * b / N; }
  }
  return Pl / (2 * P);
}
test('attenuation formulas (TEm0, TE0n, TEmn, TMmn) agree with direct power-loss integration of the fields', () => {
  const a = 22.86e-3, b = 10.16e-3, rho = 1.7241e-8;
  for (const [type, m, n] of [['TE', 1, 0], ['TE', 2, 0], ['TE', 0, 1], ['TE', 1, 1], ['TE', 2, 1], ['TE', 1, 2], ['TM', 1, 1], ['TM', 2, 1], ['TM', 1, 2]]) {
    const f = 1.4 * G.fc(m, n, a, b, 1);
    const an = alphaNumeric(type, m, n, a, b, f, rho, 1), af = G.alphaC(type, m, n, a, b, f, rho, 1);
    assert.ok(rel(af, an) < 2e-3, `${type}${m}${n}: formula ${af} vs numeric ${an}`);
  }
});

test('field amplitudes give the right wave impedance and dispersion identities', () => {
  const a = 22.86e-3, b = 10.16e-3, f = 11e9;
  const p = G.prop('TE', 1, 0, a, b, f, 1), F = G.fields('TE', 1, 0, a, b, f, 1, a / 2, b / 2);
  assert.ok(rel(-F.E[1][1] / F.H[0][1], p.Z) < 1e-12);           // Ey / -Hx = Z_TE
  const q = G.prop('TM', 1, 1, a, b, 20e9, 1), T = G.fields('TM', 1, 1, a, b, 20e9, 1, a / 3, b / 4);
  assert.ok(rel(T.E[0][1] / T.H[1][1], q.Z) < 1e-12);            // Ex / Hy = Z_TM
  assert.ok(rel(p.vp * p.vg, G.C0 * G.C0) < 1e-12);
  const e = G.prop('TE', 1, 0, a, b, 5e9, 1), kc = Math.PI / a, k = 2 * Math.PI * 5e9 / G.C0;
  assert.ok(!e.propagating && rel(e.alpha, Math.sqrt(kc * kc - k * k)) < 1e-12);
});
