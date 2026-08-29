# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Security decision-makers: CISOs, heads of vulnerability management, and risk
leads. They arrive already exposed to the claim that AI has collapsed the window
between disclosure and working exploit, and they are deciding — or defending —
patch cadence, exposure reduction, and detection investment against it.

They read to sanity-check a policy position and to push back on severity-driven
mandates. The argument therefore has to survive being retold by them to a board,
an auditor, or a vendor, without the reader present to defend it.

Method reviewers, practitioners, and general readers are secondary. Nothing
should be written to exclude them, but they do not set the register.

## Product Purpose

A single interactive page that answers one question: when a vulnerability lands
in something you expose, does a working exploit exist before you have closed it?

It runs a Monte Carlo simulation over a measured corpus and reports a compromise
rate with a credible interval, plus prioritised remediation actions for the
configured estate.

Success is a reader who leaves with the question reframed — the exploit clock
was already at zero, and severity is the wrong prioritisation trigger — and who
can act on that. The page carries four jobs at once, all confirmed:

- **Argument first.** The reframing is the point; the simulator is its evidence.
- **A tool that must actually work.** Readers configure their estate and read
  their own numbers, so control legibility and defensible output are load-bearing.
- **Argument that earns the tool.** The reading order is fixed and intentional:
  the case against severity-based prioritisation comes before the instrument.
- **A reference artefact.** The thing you link when someone repeats the
  AI-compression claim. Longevity and auditability outrank engagement.

**Open decision:** no tiebreak has been set for the cases where the argument and
the tool pull against each other — where narrative continuity wants one layout
and instrument scanability wants another. Resolve per surface; do not assume one
job outranks the others.

## Positioning

The model runs on whether a working exploit exists, measured directly, and
treats CVSS severity as the unreliable proxy it is. A neighbouring product could
not truthfully copy this, because the position is derived from the corpus rather
than asserted: Critical is only 2.4x High for confirmed exploitation, a
criticals-only model discards 65% of everything known to be exploited, and 63%
of Critical-rated CVEs carry under a 1% chance of exploitation.

Two further commitments distinguish it:

- **Compression is a scenario, not a baseline.** The measured public-exploit
  clock has not visibly accelerated, so acceleration sits behind an explicit
  what-if slider rather than being baked into the default.
- **Two clocks are kept separate.** Public exploit code existing (8.2% of
  criticals) and confirmed exploitation in the wild (2.87%) are not sequential
  gates, and the gap between them is where virtual patching and detection live.

CISA's BOD 26-04 (10 June 2026) reached the same primitive independently,
dropping severity as a trigger in favour of four SSVC decision points. That is
corroboration, not the source of the position.

## Operating Context

Readers evaluate this against vendor threat reports, internal patch-SLA
dashboards, and directives written by someone else. They are usually comparing
it to a severity-banded process they already run and may be contractually bound
to.

The page is a static artefact: it must work from a link, on a laptop, in a
meeting, with no sign-in, no account, and no setup. The single-file build exists
so it can be sent as an attachment or opened offline. Shared links carry state,
so a reader can hand a colleague the exact configuration they were looking at.

## Capabilities and Constraints

- Vanilla HTML, CSS, and JavaScript. No framework, no `package.json`, no runtime
  dependency, no build step required to view. Deployed on GitHub Pages with
  `.nojekyll`.
- `js/model.js` is MIT and runs headless under Node as well as in the browser.
- Four CI gates, all blocking: the model test suite; the palette must still
  clear the contrast floor `DESIGN.md` states; `js/calibration.js` must be
  reproducible from the vendored snapshot; `dist/exposure-race.html` must be
  current. Drift in any of these means the page is quoting numbers no longer in
  the corpus, or asserting an accessibility floor it no longer meets, and fails
  the build.
- 60,000 interactive trials across 150 blocks. The point estimate settles long
  before that; the credible interval does not, and block count is what makes the
  reported width stable across seeds and trial counts.
- Every number is tagged by epistemic status — `measured`, `reported`, or
  `assumed`. This is a product commitment, not a presentation device.
- Traits, maturity, and detection profiles are explicitly editorial judgement,
  not measurement. They compose by summing excess over 1, so stacking is
  order-independent with diminishing returns, and every slider stays editable.
- **Scope limit:** vulnerability exploitation only. Credential abuse, phishing,
  and insider routes are absent. Output is a lower bound on intrusion risk, not
  a picture of it. Never present it as a risk assessment for a named organisation.
- **Known tension, undecided:** Google Fonts is loaded from a CDN, which is the
  one runtime external dependency and sits against the offline-reproducibility
  claim made everywhere else. No decision has been made to self-host or drop it.

## Brand Commitments

- Name: **Exposure Race**, currently v3.
- Voice: analyst register. British spelling, plain declaratives, numbers carrying
  the argument rather than adjectives doing it. No vendor-marketing register, no
  threat-report melodrama. Limitations are stated in the same tone as findings.
- MIT licensed. Data credited to CyberMon, which maintains the upstream pipeline.

## Evidence on Hand

Real, dated, and vendored:

- `data/cybermon/*.json` — snapshot generated 2026-08-27, covering cvelistV5
  (383,416 CVEs), EPSS v2026.06.15, CISA KEV catalogue 2026.08.26 (1,682
  entries), and NVD analysis status.
- Reported coefficients, each attributed: breakout time (CrowdStrike Global
  Threat Report 2026), time to objective and the off-telemetry penalty (Mandiant
  M-Trends 2026), containment rate (Sophos State of Ransomware 2026). These are
  vendor incident-response populations and are labelled as distribution shape,
  not population baseline.
- CISA BOD 26-04, 10 June 2026, cited and linked.

**Absences future work must not fill by invention:** there is no public dataset
for per-sector estate composition, per-asset campaign arrival rates, or
product-overlap between an estate and the CVE stream — these are `assumed` by
necessity, and the campaign arrival rate is the widest and the one the model is
most sensitive to. There are no customers, no testimonials, no case studies, no
pricing, no user counts, and no adoption figures. Do not manufacture any.

## Product Principles

1. **Label the epistemic status of every number.** A reader must always be able
   to tell what was measured, what was reported by someone else, and what is
   judgement. Collapsing the three is the failure mode this product exists to
   avoid.
2. **Never bake a contested assumption into the baseline.** Where the evidence is
   genuinely unsettled, the default is the measured value and the alternative is
   an explicit control the reader operates.
3. **Reproducibility is load-bearing, not hygiene.** The corpus is vendored and
   CI fails on drift, because the argument's authority is that anyone can check
   it.
4. **State the failure mode rather than hiding it.** Right-censoring, sensitivity
   to the widest assumption, and the scope limit are published in the same
   register as the findings.
5. **Write for retelling.** The reader will repeat this argument without the page
   in front of them, to an audience that is sceptical and may be contractually
   committed to the opposite position.

## Accessibility & Inclusion

No formal standard has been adopted, and none is claimed. Current practice is
binding and must be preserved rather than regressed:

- `:focus-visible` outlines on interactive controls
- `prefers-reduced-motion: reduce` disabling transitions
- `aria-label` on every SVG chart
- `role="status"` with `aria-live` on the toast
- light and dark themes from one palette definition, set before first paint

A formal bar (WCAG 2.2 AA, colourblind-safe chart series, tabular fallbacks for
chart data) remains an open decision, deliberately not committed to.
