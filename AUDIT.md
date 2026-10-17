# Physics audit, batch 1

An independent reviewer (a separate agent with no part in writing the code) read the maths cores, the page code, the tests and the README from source. It re-ran the test suite and spot-checked numbers with its own scripts. Date: 2026-10-17.

Result: **1 error, 7 warnings, 11 notes.** The physics in the five cores was found correct. Every finding below has been fixed or answered. The suite now has 33 tests (31 before), all passing.

## Findings and fixes

| # | Severity | Where | Finding | Fix |
|---|---|---|---|---|
| 1 | error | waveguide caption | The caption said λg is "longer than the free-space" wavelength, but it printed v/f, the wavelength in the filling. With εr > 1 the sentence was false. | The caption now names the right wavelength: in the filling when εr > 1, free space otherwise. |
| 2 | warning | waveguide cross-section | The contour field (E for TE, H for TM) faded with \|cos ωt\|. The arrows follow the true phase (sin ωt at z = 0), so the propagating-mode drawing showed Et and Ht in quadrature. | The contours now fade with \|sin ωt\|. Et and Ht are in phase when propagating and in quadrature when evanescent, as they should be. |
| 3 | warning | skin effect, gold | Au 2.44 µΩ·cm does not match the cited CRC value at 293 K. | Changed to 2.21 µΩ·cm (CRC, 293 K). The values are listed in the Check panel. |
| 4 | warning | skin caption | The caption said "the center carries almost nothing" from a/δ ≥ 3. At a/δ = 3 the center is still 25% of the surface value. | The caption now prints the computed center-to-surface ratio. |
| 5 | warning | microstrip dispersion | Kirschning–Jansen εeff(f) was plotted and quoted beyond its range (f·h ≤ 25 GHz·mm). | The plot shades f·h > 25 GHz·mm, and the readout says "outside K–J range". The Check note states the range and the t > 0 caveat. |
| 6 | warning | waveguide Check table | The WR-90 and WR-28 rows always printed "pass". | Pass/fail is now computed. |
| 7 | warning | rain model | P.838-3 covers 1–1000 GHz, but the page extrapolated below 1 GHz. | `rainGamma` returns NaN outside 1–1000 GHz, the budget drops rain there, and the readout says "n/a below 1 GHz". A new test covers this. |
| 8 | warning | tests | Some tolerances were too loose to catch real errors (P.838 3e-3, Pozar Ex. 3.1 0.5%). The K–J test checked only limits and monotonic rise. | Tightened: P.838 k to 5e-4 relative and α to 1e-4 absolute; Pozar to 0.3% (0.4% for the rounded αd). K–J has no independent absolute reference yet. The reviewer checked its coefficients line by line against the 1982 formula. Logged as an open item. |
| 9 | note | coax TE11 side view | The TE11 side-view amplitude was illustrative, not the TE11 field. The brace always showed the TEM wavelength. | The side view now plots Eφ ∝ −∂Hz/∂r · cos φ in the axial cut. The brace shows λg(TE11) when it fits in the window and is labeled λ(TEM) otherwise. |
| 10 | note | microstrip legend | Lines are seeded by charge, so their spacing is equal D-flux, not equal E-flux. There was also some dead code. | The legend now reads "equal D-flux (charge)". Dead code removed. |
| 11 | note | README | "First order" convergence cannot be shown from two grids compared against H–J. | The claim is removed. The README now says the gap shrinks on the refined grid. |
| 12 | note | coax breakdown | The 3 kV/mm default is air. | The Check note and README say so. |
| 13 | note | RG-402 | It computes 49.1 Ω (εr 2.07 from VoP 69.5%), against a nominal 50 ± 1 Ω. | The README states the computed value. The Check table already shows both. |
| 14 | note | path-loss page | The distance input's min/max were compared in user units. The equation had a stray "Lother" term. The P.838 tolerance differed from the README. The lede overstated "not the air". | The distance input is now SI-bound (new `dist` unit kind). The equation is fixed. Tolerances are aligned (5e-4 relative, 1e-4 absolute). The lede now says "in free space". |
| 15 | note | waveguide mode count | "N modes can propagate" was capped by a 10-mode list. | It now counts from a list of up to 400 modes. A new test uses a near-square guide. |
| 16 | note | ROADMAP | The dielectric-loss line was ambiguous. | Replaced with the standard microstrip form αd = (πf/c)·εr(εeff − 1)tanδ / (√εeff(εr − 1)). |

## What the reviewer confirmed correct

- **Skin effect:** δ and Rs, the k = (1 − j)/δ sign, Z/Rdc = (ka/2)J0/J1 and its low-frequency limit, the Hankel expansion and scaling, the approximations, the Kelvin-function route, q = √2·a/δ against the classic table, and the 3δ/32a asymptotic term.
- **Coax:** Z0, C, L, αc (equal to Wheeler's rule), αd, the real Bessel and Y-function series, the TE11 equation and field, E-lines as Hz contours, equal-flux H circles, the H direction for a wave out of the screen, Pmax, the optima (29.98, 59.96, 76.65 Ω), every preset dimension, and εr from velocity factor.
- **Microstrip:** the finite-volume conductances, permittivity averaging, symmetry-wall half volumes, the IC(0) solves, energy capacitance, every Hammerstad–Jensen coefficient including the thickness correction, the K–J coefficients, and an exact reproduction of the README table.
- **Waveguide:** fc, β/α, λg, vp, vg, Z_TE/Z_TM, the evanescent reactance sign, Rs, all four wall-loss formulas (also integrated independently in the tests), αd, the field forms, every WR dimension and band, and the Pozar Example 3.1 numbers.
- **Path loss:** FSPL/P.525, Friis, Ae, dish gain, power density, E, safe distance, the Fresnel radius, the P.838-3 coefficient tables, eqs. 4–5 with the τ mapping (H 0°, V 90°, circular 45°), the budget signs, and the three Pr(f) slopes.

## Open items

- K–J dispersion: add absolute reference values from an independent implementation (for example Qucs or scikit-rf `MLine`).
- Gas absorption is still a user input. ITU-R P.676 is on the roadmap.
