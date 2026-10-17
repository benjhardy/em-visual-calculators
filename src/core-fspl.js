// Free-space path loss and link budget core maths. Pure functions, no DOM. Tested by tests/fspl.test.mjs.
const LinkCore = (() => {
  const C0 = 299792458, ETA0 = 376.730313668;
  const db = x => 10 * Math.log10(x), undb = x => Math.pow(10, x / 10);

  // Free-space path loss between isotropic antennas: (4 pi d / lambda)^2   [dB]
  const fsplDb = (d, f) => 20 * Math.log10(4 * Math.PI * d * f / C0);
  // Friis: Pr = Pt Gt Gr (lambda / 4 pi d)^2   (all linear, W)
  const friis = (Pt, Gt, Gr, d, f) => Pt * Gt * Gr * Math.pow(C0 / (4 * Math.PI * d * f), 2);
  // Effective aperture of an antenna of gain G: Ae = G lambda^2 / (4 pi)
  const aperture = (G, f) => G * Math.pow(C0 / f, 2) / (4 * Math.PI);
  const gainFromAperture = (Ae, f) => 4 * Math.PI * Ae / Math.pow(C0 / f, 2);
  // circular dish: G = eta (pi D / lambda)^2
  const dishGain = (D, f, eta) => eta * Math.pow(Math.PI * D * f / C0, 2);
  // power density and field at distance d from an EIRP (W)
  const density = (eirp, d) => eirp / (4 * Math.PI * d * d);
  const eField = (eirp, d) => Math.sqrt(density(eirp, d) * ETA0);       // V/m rms
  // distance at which the power density falls to S (W/m^2)
  const safeDistance = (eirp, S) => Math.sqrt(eirp / (4 * Math.PI * S));
  // first Fresnel zone radius at a point d1 from Tx and d2 from Rx
  const fresnel1 = (d1, d2, f) => Math.sqrt(C0 / f * d1 * d2 / (d1 + d2));

  // ---- ITU-R P.838-3 specific attenuation for rain: gamma = k R^alpha  [dB/km], f in GHz (1-1000) ----
  const T = {
    kH: { a: [-5.33980, -0.35351, -0.23789, -0.94158], b: [-0.10008, 1.26970, 0.86036, 0.64552], c: [1.13098, 0.45400, 0.15354, 0.16817], m: -0.18961, cc: 0.71147 },
    kV: { a: [-3.80595, -3.44965, -0.39902, 0.50167], b: [0.56934, -0.22911, 0.73042, 1.07319], c: [0.81061, 0.51059, 0.11899, 0.27195], m: -0.16398, cc: 0.63297 },
    aH: { a: [-0.14318, 0.29591, 0.32177, -5.37610, 16.1721], b: [1.82442, 0.77564, 0.63773, -0.96230, -3.29980], c: [-0.55187, 0.19822, 0.13164, 1.47828, 3.43990], m: 0.67849, cc: -1.95537 },
    aV: { a: [-0.07771, 0.56727, -0.20238, -48.2991, 48.5833], b: [2.33840, 0.95545, 1.14520, 0.791669, 0.791459], c: [-0.76284, 0.54039, 0.26809, 0.116226, 0.116479], m: -0.053739, cc: 0.83433 },
  };
  const fit = (P, fGHz) => { const L = Math.log10(fGHz); let s = 0; for (let j = 0; j < P.a.length; j++) s += P.a[j] * Math.exp(-Math.pow((L - P.b[j]) / P.c[j], 2)); return s + P.m * L + P.cc; };
  function rainCoeffs(fGHz, tiltDeg = 0, elevDeg = 0) {
    const kH = Math.pow(10, fit(T.kH, fGHz)), kV = Math.pow(10, fit(T.kV, fGHz)), aH = fit(T.aH, fGHz), aV = fit(T.aV, fGHz);
    const c = Math.pow(Math.cos(elevDeg * Math.PI / 180), 2) * Math.cos(2 * tiltDeg * Math.PI / 180);
    const k = (kH + kV + (kH - kV) * c) / 2;
    const alpha = (kH * aH + kV * aV + (kH * aH - kV * aV) * c) / (2 * k);
    return { kH, kV, aH, aV, k, alpha };
  }
  // P.838-3 covers 1-1000 GHz; outside that the fit is not used (returns NaN)
  const rainGamma = (fGHz, R, tiltDeg = 0, elevDeg = 0) => { if (fGHz < 1 || fGHz > 1000) return NaN; const q = rainCoeffs(fGHz, tiltDeg, elevDeg); return q.k * Math.pow(R, q.alpha); };

  // ---- link budget (dB domain) ----
  // o: {pt_dBm, ltx, gt, f, d, gas_dBkm, rainR, rainKm, tilt, elev, misc, gr, lrx, sens}
  function budget(o) {
    const fspl = fsplDb(o.d, o.f);
    const gas = (o.gas_dBkm || 0) * o.d / 1000;
    const g = o.rainR > 0 ? rainGamma(o.f / 1e9, o.rainR, o.tilt || 0, o.elev || 0) : 0, rainValid = isFinite(g);
    const rain = rainValid ? g * Math.min(o.rainKm, o.d / 1000) : 0;
    const steps = [
      { k: 'pt', label: 'Tx power', v: o.pt_dBm, abs: true },
      { k: 'ltx', label: 'Tx line', v: -o.ltx },
      { k: 'gt', label: 'Tx gain', v: o.gt },
      { k: 'fspl', label: 'Path loss', v: -fspl },
      { k: 'gas', label: 'Gases', v: -gas },
      { k: 'rain', label: 'Rain', v: -rain },
      { k: 'misc', label: 'Other', v: -(o.misc || 0) },
      { k: 'gr', label: 'Rx gain', v: o.gr },
      { k: 'lrx', label: 'Rx line', v: -o.lrx },
    ];
    let lvl = 0; for (const s of steps) { s.from = s.abs ? 0 : lvl; lvl = s.abs ? s.v : lvl + s.v; s.to = lvl; }
    const eirp = o.pt_dBm - o.ltx + o.gt, pr = lvl;
    return { steps, fspl, gas, rain, rainValid, eirp, pr, margin: pr - o.sens };
  }

  return { C0, ETA0, db, undb, fsplDb, friis, aperture, gainFromAperture, dishGain, density, eField, safeDistance, fresnel1, rainCoeffs, rainGamma, budget };
})();
globalThis.LinkCore = LinkCore;
