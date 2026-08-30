# Exposure Race

An interactive Monte Carlo model of one question: **when a vulnerability lands in
something you expose, does a working exploit exist before you have closed it?**

The AI framing of that question turns out to be aimed at the wrong clock. The
one everyone expects AI to have collapsed was already at zero: measured median
time from CVE publication to public exploit code has **not exceeded one day in
any settled year since 2015**. Compression is available here as an explicit
scenario dial, not as a baseline assumption.

That is not the same as saying an autonomous adversary changes nothing. "AI" is
several separate claims, they carry different evidence, and the page gives each
its own dial rather than bundling them under one word:

| dial | mechanism | rank at full travel |
|---|---|---|
| Exploit arrival speed | the publication-to-exploit clock | **weakest** |
| Share of bugs weaponised | how many bugs get working exploit code at all | middle |
| Post-exploitation tempo | foothold to lateral movement to objective | zero on compromise, real on incidents |
| Vulnerability discovery rate | how many bugs are found in what you already run | **strongest** |

Every figure quoted in this file comes from one recipe — `M.simulate(P, 200000,
1234)`, the default estate unless another is named, assumptions drawn across
their full declared range. Quoting a mixture of trial counts is how the tables
here drifted from the model once already.

The table above gives an *ordering*, not point values, and that is deliberate.
The ordering is asserted in CI and is a property of the mechanisms; the
magnitudes depend on the estate, and every previous version of this table went
stale within a few commits of being written. The page draws the same four
sweeps against whatever estate you have configured, which is where the numbers
belong.

The dial the phrase usually means is the weakest of the four, which is the
argument this page was already making in prose and can now make on one axis.

The tempo dial is the one worth sitting with. It cannot change whether you were
compromised — only whether anyone reached it in time. Against a reported-tempo
adversary a 24/7 SOC is worth a large margin of incident rate over no detection
at all; at full tempo roughly half of that margin is gone. A faster
adversary does not beat detection on any single intrusion. It devalues the
investment.

The discovery dial is the one that was missing. It scales the published stream
against a fixed stack — the size of the input rather than the speed of anything
downstream of it — and on most estates it is worth more than the other three
put together. It is also the least speculative: machine-found vulnerabilities in
real codebases are a present-tense capability. A verification pass found that
the page had spent its life arguing about three clocks while the mechanism with
the best evidence behind it had no dial at all, which flattered the argument in
the page's own favour.

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
Critical-rated CVEs score below 1% on EPSS, which is a probability of
exploitation activity *in the next 30 days* rather than over the life of the
vulnerability — a distinction the earlier phrasing here dropped, and one that
turns a 30-day hazard into a lifetime claim.

That criticism used to land on this model too. It ran on the Critical band
alone: `stackVulns` asked for criticals, `pPoC` was the critical arming rate and
the in-the-wild conditional came off the critical KEV rate, so the simulation
covered the 584 confirmed-exploited criticals and none of the 1,098 below them.
The argument in this section and the implementation underneath it contradicted
each other, and the implementation was the one producing the numbers. Raising
`stackVulns` could not fix it either, because the coefficients are
band-conditional — 8.2% arming and 2.87% exploitation for Critical against 2.1%
and 1.20% for High.

The stream is now derived across every band. You still set the critical count,
because that is the number anyone can estimate about their own estate, and the
model carries the High, Medium and Low volume beside it at the published corpus
ratios — about **11×** what you set — each band with its own arming rate, its own
exploitation rate, and a foothold weight for the fact that a Medium-rated
information disclosure is real exploitation and is not a foothold. For the
Critical band the derivation reproduces the snapshot's own published
conditionals exactly, which is the check that it is a re-derivation rather than
a fresh set of assumptions.

The label is also inflating. Criticals are on track to grow **2.4×** against
**1.8×** for total CVE volume — a run-rate extrapolated from a partial year set
against a completed one, which is calendar arithmetic rather than a measured
year-over-year figure, and CVE publication is not uniform across a year. The
direction is not in doubt; the multiplier is provisional. A large part of it is
scoring policy:
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

There is a third version of the same lesson, and this repository shipped it for
a while. That 0.98 described the model's *inputs* rather than its behaviour: the
trial loop discounted the stream a second time, asking "do you run the affected
product?" of a slider whose own label already said *criticals in your stack*.
The funnel named the same set twice in consecutive stages and nobody read it
that way, so the simulation ran on 0.45 while the prose beside it claimed 0.98.
The stage now asks the question that genuinely remains — whether the version and
configuration you run are actually vulnerable — and the model produces **0.84**
criticals confirmed exploited a year: short of 0.98 by exactly that filter, and
no longer short of its own documentation.

Note which number that is. It is the *Critical band*, reported separately for
exactly this reason — every citation on the page is about that band, so the
prose and the simulation have to be comparable. Across all four bands the model
now carries **2.6** confirmed-exploited vulnerabilities a year against the same
stack, and the ratio between the two is the 65% this section opened with.
---

## The two clocks

The model separates two things that are usually conflated:

- **A working exploit exists** — public exploit code, measured against
  ExploitDB, Metasploit and Nuclei. 8.2% of criticals, ever — and that is a
  *floor*, not a value. The dated sample in those three catalogues fell from
  1,019 CVEs in 2017 to 146 in 2024, the latest complete year, while CVE
  publication nearly tripled; exploit code
  moved to GitHub and to private tooling rather than becoming rarer. The
  calibration file has always said so in its own `coverageCaveat`, and the model
  used to run the floor as though it were the measurement. `ASSUMED.pocCoverage`
  now carries the correction, drawn across a range from "the catalogues see
  everything" to "they see a third of it". It is applied so the *unconditional*
  confirmed-exploitation rate — the quantity that is measured against a full
  corpus — is invariant across that range: more bugs are armed, the same number
  reach the catalogue, so the conditional falls by the same factor. A test
  asserts that invariance.
- **It is used against real targets** — the confirmed-exploited catalogue.
  2.87% of criticals.

These are not sequential gates. A bug can be exploited in the wild with no
public code, and public code often goes unused. Either arms it; only the second
carries full hazard. The gap between them is where virtual patching and
detection actually live.

The **attacker clock** is not a curve someone drew. It is sampled from the
measured distribution of days between CVE publication and public exploit code,
pooled over the five most recent **settled** years (2020–2024, n=1,298): median
**0.64 days**, **36% with a negative interval**, 73% within a week, and a long
tail that the chart labels rather than hides.

That third figure used to read "36% before the patch exists at all", and it was
wrong. The same series reports:

| year | n | median | share negative |
|---|---:|---:|---:|
| 2000 | 273 | **−44 d** | 98.5% |
| 2002 | 184 | **−57 d** | 95.7% |
| 2005 | 1,173 | −2 d | 85.8% |
| 2020 | 354 | +1 d | 35.6% |

An exploit cannot exist fifty-seven days before the vulnerability does. The
quantity is *exploit-catalogue date minus NVD publication date*, and a negative
value means the CVE **record** was late — for backfilled early-2000s entries, by
years. The smooth decay from 98.5% to the mid thirties is CVE assignment latency
improving, not adversary capability collapsing by two thirds. Read as a zero-day
rate it is off by about an order of magnitude: Google and Mandiant between them
track roughly 75 to 100 exploited-in-the-wild zero-days a year across all
software, and 36.5% of the armed critical stream alone would be about 124.

The negative mass is kept, because it is measured and the exposure it describes
is real, and split into the two mechanisms it actually contains:

- **a genuine zero-day** — nobody outside the adversary knows. Targeted activity
  only, discounted by `preHazard`. Sized by `ASSUMED.zeroDayShare`, whose whole
  declared range sits below the measured share.
- **record lag** — exploit code is public, the CVE record is not yet. This
  carries **full** mass-scanning hazard, because public exploit code draws
  scanning whether or not NVD has caught up. The defender is late to know; the
  adversary is not late to act.

The old code applied the targeted discount to the whole negative stretch, which
discounted genuinely public exploit code fourfold on the grounds that a database
record had not landed. The evidence for the split is generated from the snapshot
rather than asserted here, and a test reads it.

Pooled, and settled, for a reason. The model used to calibrate to the newest row
in the series, which is also the most right-censored one in it — 2026, n=94,
observed through May, and the only row in twelve years reporting a median above
one day. That put two different clocks in one document: the prose argued from
the settled record while the simulation ran on a row the same file marks
provisional. It also handed the compression slider 55 of its 100 points of
travel just to get back to what the settled years already measured, on a page
whose entire argument is that this clock has nowhere left to go. Against the
pooled anchor the dial starts where the evidence does, and weaponised share now
outruns arrival speed **six to one** rather than three.

Note what the record does *not* show: compression. Across the settled series the
public-exploit clock has not visibly accelerated, and the pre-publication share
has fallen. The page therefore **defaults to the settled record** and puts
acceleration behind an explicit what-if slider, rather than baking an assumption
into the baseline. The most recent year is still shown in the anchors panel,
marked provisional, where a reader can see it without it calibrating anything.

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

These are vendor incident-response populations, which skew toward organisations
that needed incident response. Read them as the shape of the distribution
rather than as a population baseline. Note also that the breakout figure is an
*average* while the model samples a lognormal *median* — the two differ by ~1.5×
at this spread, and taking the reported number at face value would make breakout
half again slower than it is.

A fourth row used to sit in that table: 44% of ransomware stopped before
encryption, from Sophos, attached to the middle containment coefficient. It has
been removed as a *coefficient* citation and moved to `SCOPE`, because it could
not do the job it was cited for. The Sophos figure is unconditional across all
ransomware attacks; the coefficient it was attached to is conditional on
detection landing in one specific window between breakout and objective. Two
different populations. What the figure can legitimately do is bound the
containment block as a whole, and a test now asserts that the containment this
model produces across its detection ladder brackets it — which is a real check
where hanging the citation on one coefficient was not.

**Every one of these is honoured at `spread: 0` and drifts at `spread: 1`** —
or rather, it used to. The declared ranges are mostly asymmetric, because these
quantities are roughly lognormal and the upper bound sits further from the
centre than the lower one. Drawing uniformly across such a range puts the
expected value at `(lo+hi)/2` rather than at the calibrated centre, so the
default run reported breakout at 45 minutes against a cited 29, an off-telemetry
penalty of 3.4× against a measured 2.6, and a WAF lag of 50 hours against a
central 18. The headline was not the calibrated model. Coefficients are now
drawn from a two-arm distribution over the same declared support, weighted so
the mean sits on the central value at every spread setting.

**`assumed`** — judgement, because no public measurement exists: per-asset
campaign arrival rates, version-and-configuration applicability, how campaign
pressure scales with estate size. The widest is the campaign arrival rate, and
the model is sensitive to it.

There used to be a fourth kind that nothing declared: numeric literals inside
the trial loop. `Math.pow(cnt, 0.4)` decided how risk scales with the number of
systems you run — the model's largest single claim — and appeared in neither the
credible interval nor the sensitivity chart nor any list a reader could find.
Four such constants have been promoted into `ASSUMED`, where they are drawn; the
rest are gathered into a named, commented `SHAPE` block. A test now fails if a
bare decimal reappears in the loop, so *"if you disagree with one, this is the
only block you need to edit"* is checkable rather than aspirational.

The last two kinds are drawn from their range on every block of trials, which is
where the credible interval comes from. Pin them (`spread: 0`) and the band
collapses to nothing — on some seeds to exactly zero, since what is left is the
noise on a variance estimate clamped at zero. Open them fully and it runs around
thirty-four points wide. It was twelve before the undeclared constants were
declared and twenty-three before the corrections in this file's own verification
pass added nine more, and that widening is the point: the uncertainty was always
there, it just was not being reported. A model that reports a narrower band
after being made more honest has hidden something.

The figure in this paragraph has gone stale twice. It is measured at the recipe
named at the top of this file, over eight seeds, and if you change anything in
`ASSUMED` you should expect to change it.

### How the interval is computed

By variance decomposition. The spread between blocks contains both parameter
uncertainty and Monte-Carlo noise, and the known binomial component is
subtracted so the band reports only the part that is actually about the
assumptions. Drawing per-trial instead — the obvious approach — makes the two
inseparable and the band ends up measuring your trial count.

Block *count* turned out to matter as much as the decomposition. A variance
estimated from `B` blocks carries a relative error of about `sqrt(2/(B-1))`, so
at 40 blocks the reported width swung between 6.6% and 13.5% as trials rose and
never settled. The count is now **650**, raised from 150 when six coefficients
were promoted into `ASSUMED` — a wider band needs more blocks to report a stable
width, and above about 650 it degrades from the other end, because the
30,000-trial case runs out of trials per block and the binomial term subtracted
from the variance becomes too noisy to subtract. Measured across eight seeds:
150 blocks swung the width 3.7pt, 500 swung it 3.5pt, 650 swings it 1.9pt. It is
stable in trial count and across seeds, which
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
   modelled*, and it holds partly because the two routes the remediation
   process cannot touch — supply chain, and campaigns that need no vulnerability — carry
   about a quarter of first compromises at the baseline estate (14% targeted,
   11% supply) and roughly half at the `sector` rung.
2. **Detection changes nothing about being compromised and everything about
   whether it matters.** It is flat on one metric and among the largest terms on
   the other. The page has a toggle for exactly this.

   Read the first half as a **scope statement, not a result**. Detection enters
   the model in one function, `contained()`, and never touches a hazard or a
   remediation clock, so the flat line is guaranteed before any trial runs.
   Real endpoint and network controls do prevent some compromises — a blocked
   exploitation attempt, a killed dropper, an IPS rule that holds — and none of
   that is simulated. `SCOPE.detectionIsPostCompromiseOnly` declares this in the
   model rather than in prose, and the sensitivity panel says it beside the
   chart. Treat the flat line as an upper bound on how little detection is worth
   against compromise, not a measurement of it.

   The second half is a real result, and the most fragile one here: it assumes
   the adversary still needs days to reach its objective. Put the tempo dial at
   full travel and most of what detection buys is gone.
3. **Telemetry coverage without speed buys almost nothing.** Appliances take no
   agent at all, and a compromise you cannot see is not found on your median
   dwell time — it is found by somebody else, roughly 2.6× later.

---

## Taking it away

The page exports **your run**, not its own argument. Two decks, built in the
browser from whatever is on screen: what you configured, what came out, what
drives it, and what to do about it. Both are PDFs, because a LinkedIn carousel
*is* a PDF — one page per slide, uploaded as a document post — so this is one
engine with two geometries and two copy budgets rather than two exporters.

| | pages | geometry | register |
|---|---:|---|---|
| **LinkedIn carousel** | 11 | 1080 × 1350 portrait | ~28 words a slide, no presenter |
| **Briefing deck** | 13 | 16:9 at projection size | full paragraphs, parameters and method |

The sequence is the same in both, and it is an argument about one estate rather
than in general:

1. **What was configured** — the seven shape controls as you answered them, and
   (briefing only) the parameters they compose to.
2. **The result** — probability of compromise or of an incident over twelve
   months, with its credible band when the band has settled and an explicit
   statement that it has not when it hasn't.
3. **How it got there** — the funnel from published vulnerabilities to
   compromises, and the split of first compromise by route.
4. **What moves it** — the sensitivity ranking for that configuration.
5. **What to do** — the same prioritised actions the page prints, each with the
   reduction it buys *on this estate* and the reason it works.
6. **What would change it** — the four adversary scenarios swept against the
   same estate, and what detection is worth under each.
7. **The link** — the configured URL, so a colleague opens the exact run rather
   than reconstructing it.

The recommendations come from the same `rankActions()` the page renders, not a
second copy: a deck that recommended something the panel above it did not would
give the reader no way to tell which was current.

**The scope limit rides the footer of every slide.** Decks are read a page at a
time and reshared a page at a time, so a caveat on the method slide is a caveat
that does not travel with the slide carrying the percentage. Every page says
*lower bound — denial of service, fraud without intrusion, and physical
premises access not counted*, and
the result slide carries the full statement plus the refusal: this is not a
risk assessment for a named organisation.

Nothing is uploaded and nothing is fetched. There is no PDF library: the writer
is about two hundred lines in `js/deck.js`, emitting pages of DCTDecode images
with an invisible Helvetica text layer over each, so the deck stays searchable
and its figures can be copied rather than retyped. That is the same commitment
the rest of the page makes — a CDN dependency to ship a slide deck would trade
offline reproducibility for convenience on a secondary surface.

`tools/check-deck.js` asserts every figure twice, against two different runs,
because a number that does not move between them was written into the copy
rather than read from the result.

---

## Structure

```
index.html                 the page
css/app.css                theme tokens, light + dark, one palette definition
js/calibration.js          GENERATED — every measured anchor, with provenance
js/model.js                simulation core; MIT; runs in node and the browser
js/charts.js               SVG rendering + PNG export
js/deck.js                 slide composition + PDF writer, for the two exports
js/app.js                  state, URL sharing, wiring
data/cybermon/*.json       vendored snapshot, so the page is reproducible offline
test/model.test.js         determinism, monotonicity, calibration fidelity, regressions
tools/refresh-data.js      re-pull the snapshot
tools/derive-calibration.js  snapshot -> js/calibration.js
tools/check-contrast.js    palette -> contrast floor, both themes
tools/check-layout.js      renders all eight charts headlessly, against the markup
tools/check-deck.js        deck figures against the corpus, and the PDF's xref
tools/build.js             inline everything -> dist/exposure-race.html
```

```bash
node test/model.test.js                                  # verify the model
node tools/check-contrast.js                             # verify the palette
node tools/check-layout.js                               # verify the charts
node tools/check-deck.js                                 # verify the deck export
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

// the four scenario dials are ordinary parameters, 0 = the measured record
M.simulate(Object.assign(M.defaults(), { ai: 0, weap: 60, tempo: 80, discovery: 40 }), 40000, 1234);
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

`EXPOSURE`, `TRAITS`, `ATTENTION`, `MATURITY`, `DETECTION`, `IDENTITY` and
`PEOPLE` in `js/model.js` are judgement, not measurement — no public dataset
gives per-sector estate composition. They exist because the alternative is
asking a reader to guess "criticals in my stack per year" cold.

Each answers exactly one question, which is the rule that decides where a new
one belongs:

| table | question | select |
|---|---|---|
| `EXPOSURE` | what can a stranger reach without credentials? | one of five |
| `TRAITS` | what else is true, on top of that? | any number |
| `ATTENTION` | who is aiming at you? | one of four |
| `MATURITY` | how well is the estate run? | one of four |
| `DETECTION` | what have you deployed to see an intrusion? | one of five |
| `IDENTITY` | how do the people with access authenticate? | one of four |
| `PEOPLE` | how well run are filtering, reporting and personnel process? | one of three |

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

## What a verification pass changed

Every figure in this file moved in one pass, and the reason is worth stating
plainly: the model was checked against its own documentation and against the
literature it cites, and fifteen things did not survive. Four were defects, six
were calibration or provenance errors, and five were claims stated more strongly
than the construction supports.

| | was | is |
|---|---|---|
| Appliance exploit clock | `tX *= 0.6` on a **signed** time, so pre-disclosure exploits arrived *later* on appliances (6.6 d lead) than on ordinary software (10.9 d) | scales magnitude, so appliances lead on both sides of zero (18.2 d) |
| Binomial sampler | Poisson substituted for any `p`; `binom(1, 0.9)` returned a mean of 0.60 against a true 0.90 | exact below n=32; approximations kept only where valid |
| Vulnerability stream | discounted twice — the trial loop asked "do you run this product?" of a slider labelled *criticals in your stack* | stage 1 asks the question that actually remains, version and configuration applicability |
| `Expected systems per year` | counted compromises past day 365, and two of three routes were not system counts | bounded to the horizon, relabelled to what it counts |
| Attacker clock | calibrated to 2026, n=94, provisional, right-censored — the only row in twelve years above a one-day median | pooled over the five settled years, n=1,298 |
| In-the-wild conditional | tagged `measured`; actually an all-time KEV rate divided by a one-year PoC rate | tagged for what it is, with `wildRate` carrying the mismatch as a drawn range |
| `p75` clock knot | quoted from a different series than the three knots below it | declared assumed, bounded by the horizon of the series it belongs to |
| Detection rungs | `SIEM, untuned` named the 26-day external median and produced 51 days; `No detection` produced 113 days with nothing behind it | `detect` is the internal dwell throughout, so the external figure falls out of `blindMult` instead of being typed in twice |
| Structural constants | six literals in the trial loop, in neither the band nor the chart | four promoted to `ASSUMED` and drawn, the rest gathered into `SHAPE`, with a test against regression |
| Virtual patching | closed the exposure window to zero, retroactively, before the exploit existed | closes it after `wafLagH`, because a rule cannot predate the vulnerability |
| Sensitivity chart | 5,000 trials with assumptions redrawn per endpoint; ranks 3 and 4 swapped between seeds and the advice list printed gains smaller than its own noise | 12,000 trials at pinned assumptions, and a floor below which no gain is printed |
| Supply-chain slider | label said *compromises*, hint said *reaches your estate* | hint says which one it is, and that it is stated net |
| `Nothing inbound` | modelled ten inbound systems | renamed `Brokered access only` |
| Inventory floor | 80%, so the sprawling estate bottomed out at 84% | 50%, so the rung can reach the gap its own description claims |
| Detection's flat line | presented as one of three findings | declared in `SCOPE` as a property of the construction, and said beside the chart |

Two of these moved the argument rather than just the arithmetic. Calibrating to
the settled clock **strengthened** the page's central claim — weaponised share
now outruns arrival speed by a wide margin, because the settled median has even
less room to compress than the censored one did. And declaring the structural
constants roughly doubled the credible interval, from twelve points to
twenty-three — and the third pass below widened it again, to thirty-four. That
uncertainty was always in the model. It simply was not being reported.

### The second pass

A later pass swept the model rather than reading it — every slider across its
full travel, four hundred random estates, and the coefficient draws checked
against the distribution they claimed to be. It found a different *class* of
defect from the first, and the difference is the useful part.

The first pass found wrong numbers. The second found mechanisms that had
silently stopped mattering, which is the failure mode an internal-consistency
suite is structurally blind to: 176 tests passed throughout, because every one
of them asked whether the model does what the model says, and a saturated term
or an unreachable branch answers *yes*.

| | was | is |
|---|---|---|
| Coefficient draws | flat uniform over asymmetric ranges, so `E[draw]` sat off the calibrated centre — the default run reported breakout at 45 min against a cited 29, and a WAF lag of 50 h against a central 18 | two-arm draw over the same support, weighted so the mean sits on the central value at every spread |
| Fast containment | `containFast` fired on **0.00%** of baseline compromises: a dwell median was racing a 19-minute breakout, and no clock in the model could win | an automated-response path on covered systems, so the branch is reachable and the `Managed 24/7` rung's own description is true |
| Out-of-band remediation | non-monotone — an escalation *replaced* the routine window, so a ten-day emergency path was worse than having none at all | both paths drawn, the fix lands on whichever completes first |
| `openFrac` | a sum of overlapping exposure windows used as a probability and clamped at 1; on a sprawling estate it clamped in 99.3% of trials and pinned `agentSkill` flat across its whole range | `1 - exp(-x)`, so it cannot saturate and the non-vulnerability route stays live |
| Campaign arrival time | unconditional exponential clipped at the window end, after arrival had already been conditioned — a point mass on the boundary | truncated exponential, which is what the conditioning implies |
| Discovery rate | not a dial at all, and discarded by `compose()` on every selector click | the fourth scenario dial, and the largest of them |
| Sophos containment figure | cited as corroborating a conditional coefficient it does not measure | moved to `SCOPE`, bounding the containment block, with a bracketing test |
| DBIR characterisation | "the largest single initial-access category" | corrected — credential abuse leads, and it is a route this model *excludes* |
| Detection rungs | declared 78 / 88 / 93% coverage; `clampTo` snapped them to 80 / 90 / 95 | declare what they run |
| Funnel stage 2 | labelled *Public exploit code exists*, counted `PoC or in-the-wild` | *A working exploit exists* |
| Exploit-catalogue coverage | undisclosed | stated as a limit on the central claim, with the sample trend on the anchors panel |
| In-the-wild timing / the floor | undisclosed properties of the construction | declared in `SCOPE`, asserted by tests |

The discovery dial is the one that changed the argument. The page had spent its
life comparing three clocks while the mechanism with the strongest present-day
evidence — machine-assisted vulnerability *finding* — had no dial, and it is
the largest of the four on most estates. An omission that flattered the page's
own thesis is worth more scrutiny than one that undercut it.

### The third pass

The first pass read the model. The second swept it. The third checked it against
the **outside world** — every coefficient and every output judged against
published measurement rather than against the model's own declarations — and it
found a third class of defect again: places where the model was internally
consistent, fully tested, and describing something that is not true of
cybersecurity.

259 tests passed throughout. They had to: every one of them asked whether the
model does what the model says, and a mechanism that is coherently wrong answers
*yes*.

| | was | is |
|---|---|---|
| Severity coverage | the Critical band alone — 35% of confirmed exploitation — under a README whose opening section argues at length that exactly this is the wrong instrument | every band, derived from the corpus ratios, each with its own arming rate, exploitation rate and foothold weight |
| Pre-publication window | `pctBefore` read as "an exploit existed before the patch did", from a series that reports −57-day medians and 98.5% negative for years when that is impossible | split into a small genuine zero-day share at targeted hazard and a CVE-record-lag remainder at **full** hazard, with the evidence generated from the snapshot |
| Targeted route | `agentSkill` bit-identical at `mfa=0` and `mfa=100`, while its own description named phishing, credential abuse, misconfiguration and service-desk social engineering | gated by the same four controls at a lower ceiling; origin-bound authentication is now worth ~10 points against a named target instead of ~1 |
| Remediation velocity | a "Typical" estate fixed an armed critical at a **5.5-day** median with 89% inside a fortnight; "Mature" managed 1.0 day | 26 days typical, 6 mature, 81 sprawling — inside the published range, where only the rung named for failure used to be |
| Unfixed systems | every in-inventory system was eventually remediated; only the 4% inventory gap could carry an open window | `neverFixShare`, because the published measurement is that roughly half of edge KEV vulnerabilities are never fully remediated on estates that *have* a process |
| Headcount scaling | strictly linear, so any estate above ~5,000 people read ~100% compromise whatever its controls said, and `staff` topped the sensitivity chart | `headExp`, the people-side twin of `crowdExp` — one lure reaches every mailbox in a single event |
| `incident` | one containment roll on the **first** compromise of the year, under a label reading "probability of an incident, 12-month window"; on a 13-intrusion estate it reported 43% where the model's own containment rate implies 99.6% | rolled per intrusion, so the label is true |
| `events` | one per compromised **system** on the mass-exploitation route and one per **intrusion** on every other — a sum of two units | intrusions, in one unit, with systems reported beside it |
| Containment level | a typical estate contained ~25% against a reported 44%, because the automated branch raced a 19-minute breakout on a 30-minute median | automated response on a ten-minute median; the ladder now brackets the anchor and the EDR rung lands on it |
| `scanHazBase` | labelled a daily *chance*, drawn as a lognormal *median* with σ=0.9, so the realised mean was 1.5× the label and the declared range bounded a quantity the model never used | mean-normalised at the draw site; the label is now true and the range is the one that bounds the run |
| Supply-chain and insider dwell | detected on the estate median, like a commodity intrusion | their own dwell penalties, and automated response mostly does not fire on either |
| `awareness` | called "Filtering and user reporting"; reporting did nothing at all | filtering thins arrivals, reporting is a share of phishing compromises on a two-hour clock |
| EPSS phrasing | "less than a 1% chance of exploitation" | an EPSS score below 1%, which is a probability over the **next 30 days** |
| The quoted magnitudes | four separate stale figures in comments and copy — a 23-point band that measured 34, a "mid teens" floor that measured in the fifties, a three-quarters tempo margin that measured 54%, dial effects off by 2–3× | measured, or replaced by the recipe that produces them, because every one of them had gone stale within a few commits of being written |

Two things are worth saying about what this pass did **not** overturn.

The central claim held. The ordering — discovery rate above weaponised share
above post-exploitation tempo above arrival speed — survives every correction,
and weaponisation still outruns arrival speed about six to one. So does the
finding that remediation cadence is a weak lever: re-measured from a
published-rate baseline rather than the model's own optimistic one, patch speed
still moves the answer by a few points where reducing exposed surface moves it
by forty. That conclusion was previously being *handed* to the page by a
baseline sitting on the flat part of the curve. It now has to earn it, and does.

And the corrections did not all point the same way. Covering every severity band,
lengthening the remediation clock, adding unfixed in-inventory systems and giving
record-lag windows full hazard all *raise* risk; the sub-linear headcount scaling,
the refitted arrival rate and the gated targeted route all *lower* it. The
per-intrusion containment fix raises the incident figure and the containment
retune lowers it. What did not survive is the idea that any of them was neutral.

The refitted `scanHazBase` deserves a note of its own, because a coefficient
moving by a factor of twenty looks like curve-fitting and is. It has never been
measured — its own label has said so since it was written — so its value has only
ever been whatever reproduced the reported initial-access mix. It was absorbing
four separate omissions at once: a stream covering a third of known exploitation,
invisible exploit code, no unfixed in-inventory systems, and a baseline that
patched in five days. Corrected, the model carries about four times the armed
volume across windows about five times wider, and the per-vulnerability arrival
rate that reproduces the *same* anchored mix falls by roughly that product. The
aggregate it is held to has not moved. What moved is how much of it this one
number was quietly doing.

## Scope and honest limits

- **Eight access classes, and the five newest are the least evidenced.**
  Opportunistic exploitation, targeted campaign, supply chain, phishing,
  credential abuse, misconfiguration, insider action and device loss are all
  simulated. What remains out of scope is genuinely out of scope rather than
  merely unmodelled: denial of service and destructive action that involve no
  intrusion, fraud achieved without entering a system, and physical intrusion
  into premises.
- **The five non-vulnerability classes are anchored as a mix, not as
  coefficients.** There is no KEV for credential abuse. Every rate behind
  phishing, credential abuse, misconfiguration, insider action and device loss
  is judgement, and no one of them can be checked on its own. What is checkable
  is what they produce together: at the baseline estate the initial-access split
  has to land within ten points of a dated third-party distribution, per class,
  and CI fails if it drifts. That is the whole basis on which those routes are
  allowed into the model — the individual numbers are assumptions, the aggregate
  is falsifiable, and one block in `js/model.js` is the only thing to edit if
  you disagree.
- **The addition raised the number, and that is the finding.** Counting five
  more classes moved the baseline compromise rate from roughly 42% to the high
  sixties. The old figure was not conservative, it was incomplete — and the
  recommendation ranking reordered with it: phishing-resistant authentication
  now ranks above patch cadence and exposed footprint on most estates. That
  reordering is the point of having done this.
- **`agentSkill` no longer stands in for the human routes.** It used to be the
  model's only representation of phishing, credential abuse and insider action,
  and on the compromise metric it was the largest term in the whole sensitivity
  chart — the biggest lever was the proxy for what the model declined to
  simulate. It now carries only the premium a *targeted* adversary adds over the
  commodity rate when no remediation window is open, and it answers to the same
  identity, filtering, privilege and configuration controls as the commodity
  routes do, at a lower ceiling. It did not, for most of this model's life: it
  was bit-identical at `mfa=0` and `mfa=100` while its own description named the
  four mechanisms those controls act on. That understated phishing-resistant
  authentication precisely against the adversary it matters most against.
- **Headcount is a scale term, and it scales sub-linearly.** The people routes
  used to be strictly linear in `staff`, which pinned any estate above about
  five thousand people near 100% compromise whatever its controls said, and put
  `staff` at the top of the sensitivity chart — a bar that reads as advice to
  employ fewer people. One phishing run reaches every mailbox in a single event;
  `ASSUMED.headExp` is the people-side twin of the `crowdExp` exponent that has
  always conceded the same correlation on the systems side.
- **A large estate still reads high, and that is not the same defect.** Twenty
  thousand people carry several successful intrusions a year in this model even
  with origin-bound authentication and a 24/7 SOC, so the compromise figure sits
  in the nineties. Large organisations do have compromises every year. What was
  broken was not the level but the *flatness* — controls have to separate
  estates at that size, and they now do by more than ten points.
- **Access classes are drawn independently, which understates the tails.** An
  organisation weak on authentication is usually also weak on patching, so real
  estates cluster at both ends more than this model does. No public figure
  quantifies that correlation and inventing one would put a fabricated
  coefficient in front of every result, so it is declared rather than modelled.
- **Adversary attention now carries capability, not just volume**, and the
  published figures moved because of it. Each rung sets how capable a campaign
  is with no vulnerability to use, alongside how many arrive:

  | rung | campaigns/yr | success without a vuln | compromise | via targeted route |
  |---|---:|---:|---:|---:|
  | Opportunistic only | 1 | 0.5% | 61.3% | 2% |
  | Ordinary interest | 6 | 1% | 67.1% | 14% |
  | Sector under pressure | 15 | 2.5% | 79.3% | 33% |
  | A named target | 30 | 4% | 92.2% | 52% |

  `campaigns` came *down* on the upper rungs (4x to 2.5x, 9x to 5x) to pay for
  it, because those multipliers were calibrated with the non-vulnerability route
  nearly closed and compound with it otherwise — at 12x the top rung reached
  99.9%, which is arithmetic rather than an instrument. What the rebalance
  changes is the **mix**: the more deliberate the attention, the more of the
  risk sits on the one route no remediation cycle touches. The totals rose too
  (45% to 52%, 67% to 83%), and that is the finding rather than a side effect —
  the old figures were low *because* the route was closed.

  These totals are higher than earlier published versions of this table, and
  almost none of that is the attention ladder: it is the defect and calibration
  work described under *What a verification pass changed* below. The ladder's
  *shape* is unchanged; the whole column moved under it. The targeted-route
  column came *down* in the third pass, because that route now answers to the
  identity and filtering controls the baseline estate already has switched on —
  which is the correction, not a weakening of the claim. The mix still opens up
  by a factor of twenty-five across the ladder.

  Re-measure this table before quoting it. Four versions of it have gone stale.
- **The widest assumption is the campaign arrival rate**, and the answer is
  sensitive to it. The tornado will usually rank the things it is least sure
  about near the top. That is the honest failure mode, stated rather than hidden.
  It is also the coefficient that absorbs every omission elsewhere in the
  vulnerability engine, because it has never been measured and its value is
  therefore whatever reproduces the anchored initial-access mix. It moved by a
  factor of twenty when four such omissions were corrected at once. Read it as a
  residual, not as a measurement.
- **Remediation velocity is anchored to published measurement, not to
  aspiration.** A "Typical" estate here fixes an armed critical at about a
  twenty-six-day median with roughly half done inside a month; "Mature" manages
  six days, "Sprawling" eighty-one. Those brackets come from the Verizon
  edge-device series, Edgescan MTTR and the Cyentia remediation curves. For most
  of this model's life the same rungs read 5.5, 1.0 and 20 days, which is faster
  than any published measurement of enterprise patching, and it mattered: a
  baseline on the flat part of the remediation curve makes remediation levers
  look cheap, and "patch speed is not the lever" is one of this page's own
  conclusions. It survives the correction. It should not have been handed it.
- **In-inventory systems can go unfixed.** Not every affected system in a
  working change process gets remediated inside the year, and the model used to
  assume otherwise — only the inventory gap could carry an unbounded window.
  `ASSUMED.neverFixShare` carries the residual that survives a real process.
- **Run-rate figures are linear extrapolation** of a partial year — calendar
  arithmetic, not a forecast.
- **Recent exploit-timing years are right-censored** and marked provisional in
  the anchors panel.
- **The exploit-timing instrument is losing coverage, and this bounds the
  page's central claim.** The clock is measured on CVEs that appear in
  ExploitDB, Metasploit or Nuclei. The dated sample per year peaked above a
  thousand in 2017 and is down to the low hundreds, while CVE publication
  roughly tripled over the same span. Exploit code did not become five times
  rarer as vulnerability volume tripled — the catalogues stopped being where it
  lands, and it now appears predominantly in ad-hoc repositories, private
  channels and commercial brokerages that this corpus cannot see. Two
  consequences, and the second is the sharper one. The measured weaponised
  share is a **floor**, not an estimate, which means the weaponisation dial may
  be closer to describing the present than the future. And a shrinking sample
  selects for high-profile vulnerabilities, which are exactly the ones that
  acquire exploit code fastest — so this instrument would report a near-zero
  median whether or not the broad population had moved. It establishes that the
  fast tail is already at the floor. It cannot, on its own, establish that no
  compression is available anywhere in the distribution. The claim this page
  leads with survives that, because "the clock everyone watches is already at
  zero" is a statement about the fast tail. The stronger reading — that there
  is no room left anywhere — is not supported by this instrument and is not
  made here.
- **In-the-wild exposure is timed from when exploit code exists**, which is the
  earliest onset the evidence supports rather than the expected one. The same
  snapshot carries a KEV-latency series that is far slower — 12 to 26 day
  medians, with roughly a quarter of entries added more than a year after
  publication — and the model does not use it, because KEV latency measures
  when CISA *catalogued* exploitation rather than when it began. Both series
  bound the truth from opposite sides; this model takes the near one. Every
  exposure window here should be read as the earliest one the evidence
  supports.
- **The floor is what this model omits, not what cannot be fixed.** A
  perfectly run estate still reports a nonzero compromise rate, and where that
  rate comes from routes with no defensive control on the page, it measures the
  model's ignorance rather than an irreducible property of the world. Both
  facts are declared in `SCOPE` and asserted by tests, so the page cannot drift
  from them quietly.
- The numbers are directionally defensible and roughly right in absolute terms.
  They are not a risk assessment for your organisation.

## Credits

Vulnerability, exploit-catalogue, EPSS and KEV data from
[CyberMon](https://devko.github.io/CyberMon/), which does the hard part —
maintaining a nightly pipeline over cvelistV5, EPSS, CISA KEV, NVD status and
the public exploit catalogues. Model and page MIT licensed.
