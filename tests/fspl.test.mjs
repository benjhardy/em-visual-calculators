import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, rel } from './load.mjs';
const L = loadCore('fspl.html', 'LinkCore');

test('free-space path loss: ITU-R P.525 form 32.45 + 20 log f[MHz] + 20 log d[km]', () => {
  for (const [d, f] of [[1e3, 1e9], [100, 2.4e9], [35786e3, 12e9], [2e3, 80e9]]) {
    const ref = 32.4478 + 20 * Math.log10(f / 1e6) + 20 * Math.log10(d / 1e3);
    assert.ok(Math.abs(L.fsplDb(d, f) - ref) < 1e-3);
  }
  assert.ok(Math.abs(L.fsplDb(1e3, 1e9) - 92.45) < 0.01);
  assert.ok(Math.abs(L.fsplDb(35786e3, 12e9) - 205.10) < 0.01);
});

test('Friis, aperture and dish gain are consistent', () => {
  const f = 10e9, d = 5e3, Pt = 1, Gt = 100, Gr = 300;
  assert.ok(Math.abs(L.db(L.friis(Pt, Gt, Gr, d, f)) - (L.db(Pt * Gt * Gr) - L.fsplDb(d, f))) < 1e-9);
  const At = L.aperture(Gt, f), Ar = L.aperture(Gr, f), lam = L.C0 / f;      // aperture form: Pr = Pt At Ar / (lambda d)^2
  assert.ok(rel(L.friis(Pt, Gt, Gr, d, f), Pt * At * Ar / (lam * d) ** 2) < 1e-12);
  assert.ok(Math.abs(L.db(L.dishGain(1, 10e9, 0.55)) - 37.81) < 0.01);      // 1 m dish, 55%, 10 GHz
  assert.ok(rel(L.gainFromAperture(L.aperture(42, 3e9), 3e9), 42) < 1e-12);
});

test('power density, field and safe distance', () => {
  const eirp = 100, d = 10;
  assert.ok(rel(L.eField(eirp, d), Math.sqrt(30 * eirp) / d) < 5e-4);   // E = sqrt(30 EIRP)/d (eta0 ~ 120 pi)
  assert.ok(rel(L.safeDistance(eirp, L.density(eirp, 7)), 7) < 1e-12);
  assert.ok(rel(L.fresnel1(5e3, 5e3, 10e9), 8.6566) < 1e-3);           // r1 = 17.32 sqrt(d1 d2 / (f d)) m, km and GHz
});

test('ITU-R P.838-3 coefficients reproduce Table 5', () => {
  const T5 = [[12, 0.02386, 1.1825, 0.02455, 1.1216], [15, 0.04481, 1.1233, 0.05008, 1.0440], [20, 0.09164, 1.0568, 0.09611, 0.9847], [30, 0.2403, 0.9485, 0.2291, 0.9129],
    [40, 0.4431, 0.8673, 0.4274, 0.8421], [60, 0.8606, 0.7656, 0.8515, 0.7486], [80, 1.1704, 0.7115, 1.1668, 0.7021]];
  for (const [f, kH, aH, kV, aV] of T5) {
    const q = L.rainCoeffs(f);
    assert.ok(rel(q.kH, kH) < 3e-3 && rel(q.kV, kV) < 3e-3, `k at ${f}: ${q.kH} ${q.kV}`);
    assert.ok(Math.abs(q.aH - aH) < 2e-3 && Math.abs(q.aV - aV) < 2e-3, `alpha at ${f}: ${q.aH} ${q.aV}`);
  }
  const c = L.rainCoeffs(20, 45, 0), h = L.rainCoeffs(20);           // circular (tau = 45 deg): k = (kH + kV)/2
  assert.ok(rel(c.k, (h.kH + h.kV) / 2) < 1e-12);
});

test('link budget arithmetic', () => {
  const B = L.budget({ pt_dBm: 30, ltx: 1, gt: 20, f: 10e9, d: 10e3, gas_dBkm: 0.01, rainR: 0, rainKm: 0, misc: 0.5, gr: 25, lrx: 2, sens: -80 });
  const pr = 30 - 1 + 20 - L.fsplDb(10e3, 10e9) - 0.1 - 0.5 + 25 - 2;
  assert.ok(Math.abs(B.pr - pr) < 1e-9 && Math.abs(B.margin - (pr + 80)) < 1e-9 && Math.abs(B.eirp - 49) < 1e-12);
});
