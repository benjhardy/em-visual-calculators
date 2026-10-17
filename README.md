# Visual RF calculators

RF and microwave calculators that show the physics, not just the number. Every input change redraws a live picture of the fields, currents or waves next to the result. Every page shows its method and checks itself against published values.

Each calculator is **one self-contained HTML file** (vanilla JavaScript and canvas, no libraries). Open it from disk, host it anywhere, or read the source. The inputs are stored in the URL hash, so any state can be shared as a link. Light and dark themes, keyboard accessible, works at phone width.

| | Calculator | What you see | Verified against |
|---|---|---|---|
| 01 | [Skin effect](skin.html) | current density in a round wire from the exact Bessel solution, with animated phase; flat-conductor view | classic R<sub>ac</sub>/R<sub>dc</sub> table; independent ber/bei series; large-x asymptote |
| 02 | [Coaxial line](coax.html) | radial E and azimuthal H lines, \|E\| map, TEM side view, TE11 pattern, 30/60/77 Ω trade-off curves | cable and connector standards; analytic optima; independent TE11 root; Wheeler's rule |
| 03 | [Microstrip, solved live](microstrip.html) | a finite-difference Laplace solve of the cross-section in a web worker: equipotentials, E lines, mesh | Hammerstad–Jensen 1980 over w/h 0.1–10 and εr 2.2–12.9 |
| 04 | [Rectangular waveguide](waveguide.html) | TE/TM cross-section, animated top view, mode chart, evanescent decay, vp and vg | Pozar Example 3.1; power-loss integration of the fields |
| 05 | [Path loss and link budget](fspl.html) | spherical spreading and effective aperture; waterfall budget with rain | ITU-R P.525 values; ITU-R P.838-3 Table 5 |

Start at [index.html](index.html). The next calculators are listed in [ROADMAP.md](ROADMAP.md).

## How each one is verified

The maths of each page lives in one `<script id="core">` block with no DOM access. The Node tests load that block **from the built HTML file**, so they check exactly the code the browser runs. Run them with `npm test` (Node 18+; no dependencies). 31 tests, all passing.

**Skin effect.** R<sub>ac</sub>/R<sub>dc</sub> = Re{(ka/2) J0(ka)/J1(ka)} with k = (1 − j)/δ. J0 and J1 of complex argument use the power series up to |ka| = 25 and a scaled Hankel expansion above, so a/δ in the thousands does not overflow. Checks: an independent Kelvin-function route (ber/bei series, A&S Table 9.12 values reproduced to 1e-8), the classic table, and the asymptote a/2δ + 1/4 + 3δ/32a.

| q = √2·a/δ | 1 | 2 | 3 | 4 | 5 | 7 | 10 | 20 |
|---|---|---|---|---|---|---|---|---|
| this code | 1.0052 | 1.0782 | 1.3181 | 1.6779 | 2.0427 | 2.7432 | 3.7986 | 7.3277 |
| table | 1.005 | 1.078 | 1.318 | 1.678 | 2.043 | 2.743 | 3.799 | 7.328 |

**Coax.** Z0, αc (smooth walls), αd, exact TE11 cutoff (smallest root of J1′(x)Y1′(cx) − J1′(cx)Y1′(x) = 0), peak-field power limit. Checks: real Bessel J0, J1, Y0, Y1 against A&S to 2e-9; Z0 of RG-58/U (Belden 8240), RG-402 (M17/130), LMR-400, N, 7/16, 3.5 mm and 2.4 mm air lines; the optima 29.98, 59.96 and 76.65 Ω in air; αc equal to Wheeler's incremental-inductance rule; the TE11 root equal to an independent series solve to 1e-8. The common approximation kc ≈ 2/(a+b) is 1.6% low at b/a = 2 and 2.8% low at b/a = 3.6.

**Microstrip.** Laplace's equation ∇·(ε∇φ) = 0 on the half cross-section, graded grid (finest cell 0.004·min(w/2, h) at the strip edge, box 40× the strip size), finite-volume 5-point stencil with the interface on a grid line, conjugate gradients with an IC(0) preconditioner. C and C0 come from the field energy; εeff = C/C0 and Z0 = 1/(c√(C·C0)). A drag uses the default grid (about 50–100 ms); 350 ms after you stop, a refined grid replaces it. Results for t = 0 (also reproducible with the "Run sweep" button on the page and `npm run table`):

| εr | w/h | H–J Z0 (Ω) | FD default | Δ | FD refined | Δ | εeff Δ (refined) |
|---|---|---|---|---|---|---|---|
| 2.2 | 0.1 | 202.68 | 201.96 | -0.36% | 202.37 | -0.15% | 0.09% |
| 2.2 | 0.3 | 150.70 | 150.18 | -0.35% | 150.47 | -0.16% | 0.11% |
| 2.2 | 1 | 94.96 | 94.66 | -0.32% | 94.82 | -0.15% | 0.11% |
| 2.2 | 3 | 50.92 | 50.79 | -0.24% | 50.85 | -0.13% | 0.11% |
| 2.2 | 10 | 20.44 | 20.42 | -0.09% | 20.43 | -0.03% | 0.00% |
| 4.4 | 0.1 | 153.95 | 153.42 | -0.35% | 153.73 | -0.14% | 0.07% |
| 4.4 | 0.3 | 113.91 | 113.54 | -0.32% | 113.76 | -0.13% | 0.05% |
| 4.4 | 1 | 71.03 | 70.83 | -0.28% | 70.95 | -0.11% | 0.03% |
| 4.4 | 3 | 37.47 | 37.38 | -0.24% | 37.43 | -0.13% | 0.11% |
| 4.4 | 10 | 14.76 | 14.75 | -0.11% | 14.76 | -0.05% | 0.05% |
| 9.8 | 0.1 | 107.91 | 107.58 | -0.31% | 107.80 | -0.11% | 0.00% |
| 9.8 | 0.3 | 79.59 | 79.37 | -0.27% | 79.52 | -0.08% | -0.05% |
| 9.8 | 1 | 49.29 | 49.18 | -0.22% | 49.26 | -0.05% | -0.08% |
| 9.8 | 3 | 25.73 | 25.67 | -0.22% | 25.70 | -0.11% | 0.08% |
| 9.8 | 10 | 10.02 | 10.01 | -0.12% | 10.01 | -0.07% | 0.08% |
| 12.9 | 0.1 | 94.95 | 94.66 | -0.30% | 94.85 | -0.10% | -0.01% |
| 12.9 | 0.3 | 69.97 | 69.80 | -0.26% | 69.93 | -0.07% | -0.07% |
| 12.9 | 1 | 43.27 | 43.19 | -0.20% | 43.26 | -0.04% | -0.11% |
| 12.9 | 3 | 22.54 | 22.49 | -0.22% | 22.52 | -0.11% | 0.07% |
| 12.9 | 10 | 8.76 | 8.75 | -0.12% | 8.75 | -0.08% | 0.09% |

The error falls with refinement (first order, as expected from the edge singularity of a zero-thickness strip) and H–J itself is quoted at better than 0.2% in this range, so the remaining gap is mostly discretization. With t/h = 0.05 the solve agrees with the H–J thickness correction to within 1.5%. The Hammerstad–Jensen code is also checked against Pozar's simpler closed form, and Kirschning–Jansen dispersion for its static limit and monotonic rise.

**Rectangular waveguide.** Cutoff, β or α, λg, vp, vg, wave impedance, wall loss (TEm0, TE0n, TEmn, TMmn) and dielectric loss. Checks: Pozar Example 3.1 (fc of the first five modes, k, β, αd = 1.03 dB/m, αc = 0.434 dB/m, all within 0.4%; the book uses c = 3e8); WR-90/28/10 cutoffs; and every loss formula against a direct numerical integration of wall loss and transmitted power from the field expressions (agreement < 0.2%), which also validates the field amplitudes. Ey/Hx and Ex/Hy reproduce Z_TE and Z_TM.

**Path loss and link budget.** FSPL, Friis, effective aperture, dish gain, power density, Fresnel radius, rain from ITU-R P.838-3. Checks: P.525's 32.45 + 20 log f[MHz] + 20 log d[km]; the P.838-3 coefficients reproduce its Table 5 (k within 0.3%, α within 0.002) at 12–80 GHz; Friis gain form equals the aperture form. Gas absorption is a user input (ITU-R P.676 is on the roadmap).

## Scope and limits

- Skin effect: isolated straight round wire, no proximity effect. Steel μr is illustrative.
- Coax: smooth conductors, same metal on both conductors, peak-field (not thermal) power limit.
- Microstrip: quasi-static TEM, single strip, no conductor or dielectric loss, closed box far away.
- Waveguide: perfect geometry, perturbation-method wall loss, smooth walls.
- Link budget: free space line of sight; no multipath; rain path reduction left to the user.

## Building

The HTML files at the root are generated. Edit the sources in `src/` (shared `common.css` and `common.js`, one `core-*.js` maths file per calculator, page templates in `src/pages/`), then run `npm run build`. The build inlines everything, so each output file stands alone.

## References

- S. Ramo, J. R. Whinnery, T. Van Duzer, *Fields and Waves in Communication Electronics*, 3rd ed., Wiley, 1994.
- M. Abramowitz, I. A. Stegun, *Handbook of Mathematical Functions*, NBS, 1964.
- F. E. Terman, *Radio Engineers' Handbook*, McGraw-Hill, 1943.
- D. M. Pozar, *Microwave Engineering*, 4th ed., Wiley, 2012.
- R. E. Collin, *Foundations for Microwave Engineering*, 2nd ed., IEEE Press, 2001.
- N. Marcuvitz, *Waveguide Handbook*, MIT Radiation Laboratory Series vol. 10, 1951.
- E. Hammerstad, Ø. Jensen, "Accurate models for microstrip computer-aided design," IEEE MTT-S Digest, 1980, pp. 407–409.
- M. Kirschning, R. H. Jansen, "Accurate model for effective dielectric constant of microstrip with validity up to millimetre-wave frequencies," Electronics Letters 18(6), 1982.
- M. N. O. Sadiku, *Numerical Techniques in Electromagnetics*, 3rd ed., CRC, 2009.
- Y. Saad, *Iterative Methods for Sparse Linear Systems*, 2nd ed., SIAM, 2003.
- H. T. Friis, "A note on a simple transmission formula," Proc. IRE 34(5), 1946.
- ITU-R P.525-4 (free-space attenuation) and ITU-R P.838-3 (rain specific attenuation).
- Cable and guide data: Belden 8240, MIL-DTL-17 (M17/130-RG402), Times Microwave LMR-400, IEC 61169-4/-16, IEEE Std 287, EIA RS-261-B.

Topic inspiration came from the classic calculator list on Microwaves101; no text, code or images were copied.

## Licence

MIT. Made by Ben Hardy.
