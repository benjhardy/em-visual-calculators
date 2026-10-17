import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCore, rel } from './load.mjs';
const M = loadCore('microstrip.html', 'MsCore');

// Pozar (4th ed., eqs. 3.195-3.196) simple closed form, ~1% accurate: an independent check on the H-J implementation
function pozar(u, er) {
  const ee = (er + 1) / 2 + (er - 1) / 2 / Math.sqrt(1 + 12 / u);
  const z = u <= 1 ? 60 / Math.sqrt(ee) * Math.log(8 / u + u / 4) : 120 * Math.PI / (Math.sqrt(ee) * (u + 1.393 + 0.667 * Math.log(u + 1.444)));
  return { z, ee };
}
const ERS = [2.2, 4.4, 9.8, 12.9], US = [0.1, 0.3, 1, 3, 10];

test('Hammerstad-Jensen implementation vs Pozar closed form (Z0 within 1.5%, eeff within 2.5%: the Pozar form omits the narrow-strip term)', () => {
  for (const er of ERS) for (const u of US) {
    const h = M.hj(u, 1, 0, er), p = pozar(u, er);
    assert.ok(rel(h.z0, p.z) < 0.015, `er ${er} u ${u}: ${h.z0} vs ${p.z}`);
    assert.ok(rel(h.eeff, p.ee) < 0.025, `eeff er ${er} u ${u}: ${h.eeff} vs ${p.ee}`);
  }
  assert.equal(M.eeffHJ0(1, 1), 1);
});

test('finite-difference solve vs Hammerstad-Jensen, w/h 0.1-10, er 2.2-12.9 (default grid < 0.5%, refined < 0.25%)', () => {
  const rows = [];
  for (const er of ERS) for (const u of US) {
    const a = M.fdSolve(u, 1, 0, er, { q: 1 }), b = M.fdSolve(u, 1, 0, er, { q: 2 }), h = M.hj(u, 1, 0, er);
    rows.push({ er, u, hj: h.z0, fd1: a.z0, fd2: b.z0, e2: b.eeff, eh: h.eeff });
    assert.ok(rel(a.z0, h.z0) < 0.005, `q1 er ${er} u ${u}: ${a.z0} vs ${h.z0}`);
    assert.ok(rel(b.z0, h.z0) < 0.0025, `q2 er ${er} u ${u}: ${b.z0} vs ${h.z0}`);
    assert.ok(rel(b.eeff, h.eeff) < 0.002, `q2 eeff er ${er} u ${u}: ${b.eeff} vs ${h.eeff}`);
    assert.ok(Math.abs(b.z0 - h.z0) <= Math.abs(a.z0 - h.z0) + 1e-9, 'refinement should not move away from H-J');
  }
  if (process.env.PRINT_TABLE) {
    console.log('| εr | w/h | H–J Z0 (Ω) | FD default | Δ | FD refined | Δ | εeff Δ (refined) |');
    console.log('|---|---|---|---|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.er} | ${r.u} | ${r.hj.toFixed(2)} | ${r.fd1.toFixed(2)} | ${(100 * (r.fd1 / r.hj - 1)).toFixed(2)}% | ${r.fd2.toFixed(2)} | ${(100 * (r.fd2 / r.hj - 1)).toFixed(2)}% | ${(100 * (r.e2 / r.eh - 1)).toFixed(2)}% |`);
  }
});

test('thick strip (t/h = 0.05): FD within 1.5% of H-J with thickness correction', () => {
  for (const [u, er] of [[0.5, 4.4], [2, 3.66], [5, 9.8]]) {
    const a = M.fdSolve(u, 1, 0.05, er, { q: 1.5 }), h = M.hj(u, 1, 0.05, er);
    assert.ok(rel(a.z0, h.z0) < 0.015, `u ${u} er ${er}: ${a.z0} vs ${h.z0}`);
    assert.ok(a.z0 < M.fdSolve(u, 1, 0, er, { q: 1.5 }).z0, 'thickness lowers Z0');
  }
});

test('air-filled strip: eeff = 1 exactly', () => { const a = M.fdSolve(1, 1, 0, 1, { q: 1 }); assert.ok(Math.abs(a.eeff - 1) < 1e-9); });

test('Kirschning-Jansen dispersion: static limit, monotonic rise toward er', () => {
  const w = 1.1e-3, h = 0.508e-3, er = 3.66, e0 = M.hj(w, h, 0, er).eeff;
  assert.ok(rel(M.eeffKJ(w, h, 0, er, 1e6), e0) < 1e-6);
  let prev = 0; for (const f of [1e9, 10e9, 30e9, 60e9, 110e9]) { const e = M.eeffKJ(w, h, 0, er, f); assert.ok(e > prev && e < er); prev = e; }
});

test('synthesis inverts the analysis', () => {
  for (const [z, er] of [[50, 3.66], [25, 9.8], [100, 2.2]]) { const w = M.synthHJ(z, 1e-3, 0, er); assert.ok(rel(M.hj(w, 1e-3, 0, er).z0, z) < 1e-9); }
});
