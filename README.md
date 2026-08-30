# Exposure Race

An interactive Monte Carlo model of one question: **when a vulnerability lands in
something you expose, does a working exploit exist before you have closed it?**

The AI framing of that question turns out to be aimed at the wrong clock. The
one everyone expects AI to have collapsed was already at zero: measured median
time from CVE publication to public exploit code has **not exceeded one day in
any settled year since 2015**. Compression is available here as an explicit
scenario dial, not as a baseline assumption.

That is not the same as saying an autonomous adversary changes nothing. "AI" is
several separate claims, they carry different evidence, and the page now gives
each its own dial rather than bundling them under one word:

| dial | mechanism | worth at full travel |
|---|---|---:|
| Exploit arrival speed | the publication-to-exploit clock | **+2.8pt** compromise |
| Share of bugs weaponised | how many bugs get working exploit code at all | **+8.9pt** compromise |
| Post-exploitation tempo | foothold to lateral movement to objective | **+1.7pt** incidents, +0.0 compromise |

The dial the phrase usually means is the weakest of the three, which is the
argument this page was already making in prose and can now make on one axis.

The tempo dial is the one worth sitting with. It cannot change whether you were
compromised — only whether anyone reached it in time. Against a reported-tempo
adversary a 24/7 SOC is worth 9.3 points of incident rate over no detection at
all; at full tempo that margin is **2.2 points**. A faster adversary does not
beat detection on any one intrusion. It devalues the investment.

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
   floor because a fifth of exploitation predates the patch. Read this alongside
   the scope limits below: the finding holds *within the routes that are
   modelled*, and it holds partly because the two routes no defender control
   touches — supply chain, and campaigns that need no vulnerability — are a
   majority of first compromises at the baseline estate.
2. **Detection changes nothing about being compromised and everything about
   whether it matters.** It is flat on one metric and among the largest terms on
   the other. The page has a toggle for exactly this. The finding is also the
   most fragile one here: it assumes the adversary still needs days to reach its
   objective. Put the tempo dial at full travel and most of what detection buys
   is gone.
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
test/model.test.js         determinism, monotonicity, calibration fidelity, regressions
tools/refresh-data.js      re-pull the snapshot
tools/derive-calibration.js  snapshot -> js/calibration.js
tools/check-contrast.js    palette -> contrast floor, both themes
tools/build.js             inline everything -> dist/exposure-race.html
```

```bash
node test/model.test.js                                  # verify the model
node tools/check-contrast.js                             # verify the palette
node tools/refresh-data.js && node tools/derive-calibration.js   # update the data
node tools/build.js                                      # single-file build
```

The model runs headless:

```js
const M = require('./js/model.js');
M.simulate(M.compose({
  exposure: 'product',      // one of five rungs — what strangers can reach
  traits: ['vendor'],       // any number — what else is true on top of that
  attention: 'sector',      // one of four — who is aiming at you
  detection: 'tuned',
}), 40000, 1234);

// the three scenario dials are ordinary parameters, 0 = the measured record
M.simulate(Object.assign(M.defaults(), { ai: 0, weap: 60, tempo: 80 }), 40000, 1234);
```

A run can also be advanced in pieces, which is how the page keeps a 60,000-trial
pass off the frame. It visits the same trials in the same order as `simulate`,
so the result is identical to the whole-run call:

```js
const run = M.createRun(M.defaults(), 60000, 1234, { surv: true, spread: 1 });
while (!run.advance(10000)) { /* yield to whatever else needs the thread */ }
run.result();
```

### The shape controls are editorial

`EXPOSURE`, `TRAITS`, `ATTENTION`, `MATURITY` and `DETECTION` in `js/model.js`
are judgement, not measurement — no public dataset gives per-sector estate
composition. They exist because the alternative is asking a reader to guess
"criticals in my stack per year" cold.

Each answers exactly one question, which is the rule that decides where a new
one belongs:

| table | question | select |
|---|---|---|
| `EXPOSURE` | what can a stranger reach without credentials? | one of five |
| `TRAITS` | what else is true, on top of that? | any number |
| `ATTENTION` | who is aiming at you? | one of four |
| `MATURITY` | how well is the estate run? | one of four |
| `DETECTION` | what have you deployed to see an intrusion? | one of five |

`EXPOSURE` is single-select because it is one axis, and its rungs are
alternatives rather than attributes. You cannot be both corporate-network-only
and a SaaS vendor; when that axis was a multi-select the composer averaged the
two and produced an estate that exists nowhere. `ATTENTION` lives on the threat
card because adversary interest is not something the reader controls — it used
to be a trait called "Regulated / finance", described in defensive language
while quadrupling the campaign rate.

The first three compose in one pass: multipliers combine by summing their excess
over 1, so stacking several compounds with diminishing returns rather than
exploding, and the result never depends on click order. Both ladders carry an
identity rung, so `compose({})` returns the baseline estate untouched. Every
slider stays editable afterwards.

Anything added to `TRAITS` has to compose with *every* exposure rung without
contradicting it — that is the test a trait has to pass to be a trait rather
than a rung. It also may not restate an axis another table already owns: a
"legacy we cannot touch" trait moved cadence, coverage, trigger rate and
inventory in the same direction as `MATURITY.loose`, so selecting both counted
one weakness twice. The maturity ladder owns that axis alone.

---

## Scope and honest limits

- **Three access routes, not all of them.** Opportunistic exploitation, targeted
  campaign and supply chain are simulated. Phishing, credential abuse and
  insider action are not, so every figure is a lower bound on intrusion risk
  rather than a picture of it. The page states this beside the headline and on
  the routes chart, not only here — a caveat a screen and a half from the number
  it qualifies is not a caveat.
- **The proxy for those routes is load-bearing.** `agentSkill` — the chance a
  targeted campaign succeeds with no remediation window open — is the only place
  the absent routes appear, and on the compromise metric it is the **largest**
  term in the sensitivity chart. It was missing from that chart entirely until
  it was checked. A model whose biggest lever is its own proxy for what it does
  not simulate should say so, which is what this bullet is for.
- **Adversary attention now carries capability, not just volume**, and the
  published figures moved because of it. Each rung sets how capable a campaign
  is with no vulnerability to use, alongside how many arrive:

  | rung | campaigns/yr | success without a vuln | compromise | via targeted route |
  |---|---:|---:|---:|---:|
  | Opportunistic only | 1 | 0.5% | 15.0% | 4% |
  | Ordinary interest | 6 | 1% | 24.1% | 26% |
  | Sector under pressure | 15 | 2.5% | 51.8% | 56% |
  | A named target | 30 | 4% | 82.5% | 73% |

  `campaigns` came *down* on the upper rungs (4x to 2.5x, 9x to 5x) to pay for
  it, because those multipliers were calibrated with the non-vulnerability route
  nearly closed and compound with it otherwise — at 12x the top rung reached
  99.9%, which is arithmetic rather than an instrument. What the rebalance
  changes is the **mix**: the more deliberate the attention, the more of the
  risk sits on the one route no remediation cycle touches. The totals rose too
  (45% to 52%, 67% to 83%), and that is the finding rather than a side effect —
  the old figures were low *because* the route was closed.
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
