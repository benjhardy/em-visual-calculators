# Roadmap

Topic inspiration: the classic calculator list on Microwaves101 (attenuator, cascade, coax, CPW, dual-dielectric coax, microstrip, reactance, percent bandwidth, resonant frequency, skin depth, stripline, unequal-split divider, VSWR, wavelength, wire over ground, noise conversion, S-parameter cascade, Smith chart plotter). Only the topic list was used. Methods and formulas below come from the primary references cited; no text, code or images were taken from that site.

Each calculator follows the same rule: **the visual is the answer**. Every input change redraws a physical picture (fields, currents, waves, power flow) next to the number, and every page carries a Check panel with its method and reference values, plus a Node test.

Difficulty: **1** closed form + simple drawing · **2** closed form + field picture or animation · **3** needs a numerical solver or a mode solver in the browser.

## Built (batch 1)

| # | Calculator | Visual | Method | Status |
|---|---|---|---|---|
| 01 | Skin effect | current density in a round wire (exact Bessel), animated phase, flat-conductor decay | J0 of complex argument, Ramo/Whinnery/Van Duzer §5.5 | done |
| 02 | Coaxial line | E and H lines, \|E\| map, TEM side view, TE11 pattern, ratio trade-off curves | Pozar §2.7/3.5, exact TE11 root (Marcuvitz §2.4) | done |
| 03 | Microstrip | live 2-D finite-difference field solve: equipotentials, E lines, mesh | FD Laplace + Hammerstad–Jensen 1980 + Kirschning–Jansen 1982 | done |
| 04 | Rectangular waveguide | TE/TM cross-section, animated top view, mode chart, evanescent decay | Pozar §3.3, Collin §3.13 | done |
| 05 | Path loss and link budget | spherical spreading, effective aperture, waterfall budget | Friis 1946, ITU-R P.525, P.838-3 | done |

## Transmission lines

| Topic | What the visual shows | Formulas / method (primary refs) | Diff. |
|---|---|---|---|
| Stripline (centered, offset) | cross-section field lines between two grounds; field-solve vs closed form | Cohn 1954 (exact conformal map, K(k)/K′(k)); Wheeler 1978 thickness correction; reuse the FD solver from 03 | 2 |
| CPW and grounded CPW | E field from centre strip to coplanar grounds; GCPW shows the field moving to the backside ground as h shrinks | Wen 1969 (conformal mapping); Simons, *Coplanar Waveguide Circuits* (2001) Ch. 2; FD solve as check | 2–3 |
| Coupled microstrip / coupled lines | even- and odd-mode field pictures side by side, Z0e, Z0o, coupling vs gap | Kirschning & Jansen 1984 (coupled microstrip); Garg & Bahl 1979; FD two-conductor solve for C matrix | 3 |
| Dual-dielectric coax | radial E with the field jump at the dielectric boundary | series capacitance of two coaxial shells; Ramo et al. | 1 |
| Wire over ground / twin lead | field lines from a line charge and its image | image theory, Z0 = (η/2π) acosh(h/a) | 1 |
| Twisted pair / differential | odd-mode field, common-mode leakage | two-wire acosh form, Wadell, *Transmission Line Design Handbook* (1991) | 2 |
| Surface roughness | current path over a rough profile; loss multiplier vs frequency | Hammerstad & Bekkadal 1975 (arctan model); Huray et al. 2010 (snowball, Proc. IEEE EMC); Groiss 1996 | 2 |
| Dielectric loss | loss tangent as phase lag of polarization; αd vs f for common laminates | αd = (π f √εeff / c) tanδ · filling factor; Djordjevic–Sarkar wideband model (2001) | 1–2 |
| Line loss budget (conductor + dielectric + roughness) | stacked loss contributions vs frequency | combine 01 + roughness + dielectric | 2 |

## Waveguides and resonators

| Topic | What the visual shows | Formulas / method | Diff. |
|---|---|---|---|
| Circular waveguide | TE11, TM01, TE01 patterns, mode chart, TE01 loss falling with f | Bessel zeros p′nm, pnm; Pozar §3.4; Marcuvitz §2.3 | 2 |
| Ridge waveguide | bandwidth gain from the ridge; field concentration in the gap | Hopfer 1955; Cohn 1947 transverse resonance | 3 |
| Cavity resonator (rectangular / cylindrical) | standing-wave pattern, Q from wall loss | Pozar §6.7–6.8 | 2 |
| Dielectric resonator | field confined in the puck, resonant frequency vs size | Kajfez & Guillon, *Dielectric Resonators* (1986) | 3 |
| Resonant frequency / LC tank | energy sloshing between L and C | f = 1/(2π√LC), Q, bandwidth | 1 |

## Matching, mismatch and the Smith chart

| Topic | What the visual shows | Formulas / method | Diff. |
|---|---|---|---|
| VSWR / return loss / mismatch loss | standing wave envelope on a line, forward and reflected waves | Γ = (ZL − Z0)/(ZL + Z0), VSWR, RL, ML = −10 log(1 − \|Γ\|²) | 1 |
| Mismatch uncertainty | phasor circles of two reflections adding | Kerns & Beatty (1967) | 2 |
| Quarter-wave transformer | multiple reflections summing to zero at f0; bandwidth vs ratio | Z1 = √(Z0 ZL); Collin §5.6; binomial and Chebyshev multi-section (Cohn 1955) | 2 |
| Single-stub / double-stub match | locus on the Smith chart and the line with the stub | Pozar §5.2 | 2 |
| L-network / lumped match | Smith chart arcs for series and shunt elements | Pozar §5.1 | 2 |
| Smith chart plotter | impedance vs frequency trace, constant-Q circles | bilinear map Γ(Z) | 2 |
| Reactance / wavelength / percent bandwidth | small helpers inside the above | X = ωL, 1/ωC; λ = c/(f√εeff) | 1 |

## Passive components

| Topic | What the visual shows | Formulas / method | Diff. |
|---|---|---|---|
| Attenuators (pi, tee, bridged-tee) | current paths and power split in each resistor | standard resistive-pad design equations with K = 10^(A/20) (e.g. *Reference Data for Engineers*, 9th ed., 2002) | 1 |
| Wilkinson divider (equal and unequal) | even/odd-mode excitation, isolation resistor current | Wilkinson 1960; Cohn 1968 (multi-section); unequal split: Parad & Moynihan 1965 | 2 |
| Branch-line / rat-race coupler | wave interference giving 90° / 180° outputs | Pozar §7.5, 7.8 | 2 |
| Wire (straight) inductance | magnetic field around the wire, internal vs external inductance (links to 01) | Rosa 1908; Grover, *Inductance Calculations* (1946) | 1 |
| Spiral inductor | current crowding in inner turns, mutual coupling | Mohan et al. 1999 (modified Wheeler, current sheet); Greenhouse 1974 | 2 |
| Parallel-plate capacitor | field with fringing at the edges | ε A/d plus fringing (Palmer 1937); FD check | 1–2 |
| Interdigital capacitor | field between fingers, capacitance per finger pair | Alley 1970; Gevorgian 1995 (conformal mapping) | 2 |
| Via inductance | current return path through the via | Goldfarb & Pucel 1991 | 2 |

## Propagation and link budget

| Topic | What the visual shows | Formulas / method | Diff. |
|---|---|---|---|
| Free-space path loss | 1/r² shells; fixed-gain vs fixed-aperture antennas | Friis 1946; ITU-R P.525 | 1 (built) |
| Full link budget | waterfall from Tx power to margin | Tx power, gains, line loss, FSPL, gases (ITU-R P.676), rain (ITU-R P.838-3 + P.530/P.618 path factors), sensitivity | 2 (built, gas as input) |
| Atmospheric absorption | specific attenuation vs frequency with the 22 and 60 GHz lines | ITU-R P.676 Annex 1 (line-by-line) or Annex 2 | 3 |
| Fresnel zone clearance | ellipse over a path profile with earth bulge (k-factor) | r1 = √(λ d1 d2 / d); ITU-R P.526 | 2 |
| Two-ray ground reflection | direct and reflected rays, interference nulls, breakpoint 4 h_t h_r / λ | Rappaport, *Wireless Communications*, §4.6 | 2 |
| Radar range equation | power out and back, R⁴ law, RCS | Skolnik, *Introduction to Radar Systems*, Ch. 2 | 2 |
| Noise figure / cascaded noise | noise power bar stack through a chain (Friis noise) | Friis 1944; T = (F − 1) 290 K | 1–2 |
| EIRP / power density / safe distance | power density contours vs distance against exposure limits | S = EIRP/(4π d²); IEEE C95.1-2019, FCC OET 65 | 1 |

## Proposed order (next batches)

1. **Batch 2, transmission lines:** stripline, CPW/GCPW (both reuse the microstrip FD solver), VSWR and mismatch, quarter-wave transformer.
2. **Batch 3, propagation:** Fresnel zone, two-ray, noise cascade, radar range, EIRP/safe distance.
3. **Batch 4, components:** attenuators, Wilkinson, wire inductance, spiral inductor, parallel-plate and interdigital capacitors.
4. **Batch 5, harder solvers:** coupled lines (two-conductor FD), circular waveguide, surface roughness (Huray), cavity Q, atmospheric absorption (P.676).

Shared upgrades along the way: one FD engine for all planar lines (multi-conductor capacitance matrix), a shared Smith chart component, and export of each state as a PNG and a shareable URL (already in the hash).
