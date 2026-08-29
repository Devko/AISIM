# Exposure Race

An interactive Monte Carlo model of one question: **when a vulnerability lands in
something you expose, does a working exploit exist before you have closed it?**

The AI framing of that question turns out to be the wrong one. The exploit clock
everyone expects AI to have collapsed was already at zero: measured median time
from CVE publication to public exploit code has **not exceeded one day in any
settled year since 2015**. Compression is available here as an explicit scenario
slider, not as a baseline assumption.

It is calibrated against a dated, public corpus rather than against vendor
narrative — and the first thing that corpus says is that the obvious way to
build this model would have been wrong.

**[▶ Open the live page](https://devko.github.io/AISIM/)** ·
[single-file build](dist/exposure-race.html) ·
[![model](https://github.com/Devko/AISIM/actions/workflows/test.yml/badge.svg)](https://github.com/Devko/AISIM/actions/workflows/test.yml)

Everything on the page is reproducible offline: the data snapshot is vendored,
the calibration module is generated from it, and CI fails if either drifts.

---

## Why it does not count "critical" CVEs

The intuitive design is: count Critical-rated CVEs per year, assume some
fraction get exploited, race that against your patch cycle. Every number in that
chain is available. It is also the wrong chain, and the data says so plainly.

Measured across the whole scored CVE population, against CISA's
confirmed-exploited catalogue:

| CVSS band | Scored CVEs | Confirmed exploited | Rate |
|---|---:|---:|---:|
| Critical 9.0–10.0 | 20,355 | 584 | **2.87%** |
| High 7.0–8.9 | 74,163 | 888 | 1.20% |
| Medium 4.0–6.9 | 91,045 | 203 | 0.22% |
| Low 0.1–3.9 | 8,576 | 7 | 0.08% |

Critical is **2.4× High**. That is a nudge, not a filter. And a criticals-only
model throws away the 888 confirmed-exploited bugs rated High plus the 210 rated
below it — **65% of everything known to be exploited**. Meanwhile 63% of
Critical-rated CVEs carry less than a 1% chance of exploitation.

The label is also inflating. Criticals are growing **2.4×** year over year
against **1.8×** total CVE volume, and a large part of that is scoring policy:
CNAs assign their own scores, and the share they rate 9.0+ ranges from near zero
to roughly two in five for the same scale. NVD has stopped analysing 44,050
records outright — 11.5% of the corpus.

So this model runs on **whether a working exploit exists**, measured directly,
and treats severity as the unreliable proxy it is.

### This is no longer a contrarian position

[CISA's Binding Operational Directive **26-04**](https://www.cisa.gov/news-events/directives/bod-26-04-prioritizing-security-updates-based-risk)
(10 June 2026) supersedes both BOD 19-02 and BOD 22-01, and drops severity as
the trigger entirely. It
prioritises on four SSVC decision points instead:

- Is the vulnerability **in the KEV catalogue**?
- Is the asset **publicly exposed**?
- Is exploitation **automatable by an adversary**?
- What **technical impact** does it give — partial or total control?

The shortest tier is three days plus forensic triage; the lowest is "fix on
system upgrade". Severity survives only as *technical impact*, one input of
four, and CVSS is not used to compute it.

The directive's published heuristic for *automatable* is worth quoting: a public
proof-of-concept that achieves remote code execution and reliably executes
against a vulnerable system. That is the same primitive this model measures, via
ExploitDB, Metasploit and Nuclei — arrived at independently, from the other
direction. The directive also names the reason: adversary "use of AI may further
narrow the time defenders have to react between patch release and possible
exploitation".

`BOD 26-04` is available on the maturity axis as a policy regime, so you can see
what mandating it does to an estate.

### The near-miss worth knowing about

Calibrating the naive version is instructive. The obvious defaults — 14
criticals a year in your stack, 7% of them exploited — give 0.98 exploited
criticals a year. Re-derived properly from current data — 34 criticals (the
volume has grown) at the measured 2.9% rate — gives **0.98**. Identical.

Two independent errors of the same size in opposite directions. A model can be
right for entirely wrong reasons, and this one would have drifted the moment
either input moved alone. Which is happening now.

---

## The two clocks

The model separates two things that are usually conflated:

- **A working exploit exists** — public exploit code, measured against
  ExploitDB, Metasploit and Nuclei. 8.2% of criticals, ever.
- **It is used against real targets** — the confirmed-exploited catalogue.
  2.87% of criticals.

These are not sequential gates. A bug can be exploited in the wild with no
public code, and public code often goes unused. Either arms it; only the second
carries full hazard. The gap between them is where virtual patching and
detection actually live.

The **attacker clock** is not a curve someone drew. It is sampled from the
measured distribution of days between CVE publication and public exploit code:
median 3.5 days, **21% before the patch exists at all**, 53% within a week, and
a long tail — 27% of arrivals fall beyond the drawn window, which the chart
labels rather than hides.

Note what that record does *not* show: compression. Across the measured series
the public-exploit clock has not visibly accelerated, and the pre-publication
share has fallen. The recent years are right-censored — exploits are still
arriving for them — so this is a caveat, not a finding. The page therefore
**defaults to the measured clock** and puts acceleration behind an explicit
what-if slider, rather than baking an assumption into the baseline.

---

## Three kinds of number

The page will not pretend they are the same, and tags each one.

**`measured`** — read directly off the vendored
[CyberMon](https://devko.github.io/CyberMon/) snapshot in `data/cybermon/`, and
reproducible offline: exploit availability by severity band, confirmed
exploitation rates, the publication-to-exploit distribution, CVE volume, KEV
additions, NVD analysis status.

**`reported`** — a dated published figure. Cited, but you are trusting somebody
else's methodology and population:

| Coefficient | Value | Source |
|---|---|---|
| Breakout time | 29 min average (fastest 27 s) | CrowdStrike Global Threat Report 2026 |
| Time to objective | 5 d median when the adversary announces itself | Mandiant M-Trends 2026 |
| Off-telemetry penalty | 2.6× — 26 d dwell when told by an outsider vs 10 d self-detected | Mandiant M-Trends 2026 |
| Containment | 44% of ransomware stopped before encryption | Sophos State of Ransomware 2026 |

These are vendor incident-response populations, which skew toward organisations
that needed incident response. Read them as the shape of the distribution
rather than as a population baseline. Note also that the breakout figure is an
*average* while the model samples a lognormal *median* — the two differ by ~1.5×
at this spread, and taking the reported number at face value would make breakout
half again slower than it is.

**`assumed`** — judgement, because no public measurement exists: per-asset
campaign arrival rates, product-overlap between your estate and the CVE stream.
The widest is the campaign arrival rate, and the model is sensitive to it.

The last two kinds are drawn from their range on every block of trials, which is
where the credible interval comes from. Pin them (`spread: 0`) and the band
collapses; open them fully and it is about twelve points wide.

### How the interval is computed

By variance decomposition. The spread between blocks contains both parameter
uncertainty and Monte-Carlo noise, and the known binomial component is
subtracted so the band reports only the part that is actually about the
assumptions. Drawing per-trial instead — the obvious approach — makes the two
inseparable and the band ends up measuring your trial count.

Block *count* turned out to matter as much as the decomposition. A variance
estimated from `B` blocks carries a relative error of about `sqrt(2/(B-1))`, so
at 40 blocks the reported width swung between 6.6% and 13.5% as trials rose and
never settled. At 150 it is stable in trial count and across seeds, which
`test/model.test.js` now asserts directly. That is also why the interactive
trial count is 60,000: the point estimate is settled long before that, but the
interval is not.

---

## What it will tell you

Three results that hold across most settings:

1. **No single lever you control moves the compromise rate more than a few
   points.** Reducing what you expose is the only large one. Patch cadence has a
   floor because a fifth of exploitation predates the patch.
2. **Detection changes nothing about being compromised and everything about
   whether it matters.** It is flat on one metric and the largest term on the
   other. The page has a toggle for exactly this.
3. **Telemetry coverage without speed buys almost nothing.** Appliances take no
   agent at all, and a compromise you cannot see is not found on your median
   dwell time — it is found by somebody else, roughly 2.6× later.

---

## Structure

```
index.html                 the page
css/app.css                theme tokens, light + dark, one palette definition
js/calibration.js          GENERATED — every measured anchor, with provenance
js/model.js                simulation core; MIT; runs in node and the browser
js/charts.js               SVG rendering + PNG export
js/app.js                  state, URL sharing, wiring
data/cybermon/*.json       vendored snapshot, so the page is reproducible offline
test/model.test.js         88 assertions
tools/refresh-data.js      re-pull the snapshot
tools/derive-calibration.js  snapshot -> js/calibration.js
tools/build.js             inline everything -> dist/exposure-race.html
```

```bash
node test/model.test.js                                  # verify the model
node tools/refresh-data.js && node tools/derive-calibration.js   # update the data
node tools/build.js                                      # single-file build
```

The model runs headless:

```js
const M = require('./js/model.js');
M.simulate(M.compose({ traits: ['saas', 'regulated'], detection: 'tuned' }), 40000, 1234);
```

### Traits are editorial

`TRAITS`, `MATURITY` and `DETECTION` in `js/model.js` are judgement, not
measurement — no public dataset gives per-sector estate composition. They exist
because the alternative is asking a reader to guess "criticals in my stack per
year" cold. They are multi-select and compose: multipliers combine by summing
their excess over 1, so stacking several compounds with diminishing returns
rather than exploding, and the result never depends on click order. Every slider
stays editable afterwards.

---

## Scope and honest limits

- **Vulnerability exploitation only.** Credential abuse, phishing and insider
  routes are absent. Treat the output as a lower bound on intrusion risk, not a
  picture of it.
- **The widest assumption is the campaign arrival rate**, and the answer is
  sensitive to it. The tornado will usually rank the things it is least sure
  about near the top. That is the honest failure mode, stated rather than hidden.
- **Run-rate figures are linear extrapolation** of a partial year — calendar
  arithmetic, not a forecast.
- **Recent exploit-timing years are right-censored** and marked provisional in
  the anchors panel.
- The numbers are directionally defensible and roughly right in absolute terms.
  They are not a risk assessment for your organisation.

## Credits

Vulnerability, exploit-catalogue, EPSS and KEV data from
[CyberMon](https://devko.github.io/CyberMon/), which does the hard part —
maintaining a nightly pipeline over cvelistV5, EPSS, CISA KEV, NVD status and
the public exploit catalogues. Model and page MIT licensed.
