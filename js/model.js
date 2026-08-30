/* Exposure Race — simulation core.
 * MIT licensed. Runs unmodified in Node (require) and in the browser (script tag).
 *
 *   node > const M = require('./js/model.js')
 *          M.simulate(M.defaults(), 20000, 1234)
 *
 * Every coefficient that has a measured value comes from CALIBRATION (js/calibration.js,
 * generated from the CyberMon snapshot). Coefficients that are NOT measured are declared
 * in ASSUMED below, each with a plausible range, and each is drawn per-trial so the
 * headline carries a credible interval instead of pretending to be a point estimate.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./calibration.js'));
  } else {
    root.MODEL = factory(root.CALIBRATION);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  var H = 365; /* horizon, days */

  /* ═══════════════════════════════════════════════════════════════════════
   * MEASURED — read straight off the CyberMon snapshot.
   * ═══════════════════════════════════════════════════════════════════════ */
  var MEASURED = {
    /* share of criticals that ever get a public working exploit */
    pPoC: C.armed.pPoCCritical / 100,
    /* Share of PoC'd criticals that reach the confirmed-exploited catalogue,
     * and the same for criticals exploited with no public PoC first.
     *
     * These two are NOT measured, despite living in this block until now. They
     * are an algebraic residual:
     *
     *     pWildGivenPoC = pKevCritical x pctPoCFirst / pPoCCritical
     *                   = 2.869%       x 81.2%       / 8.2%        = 28.4%
     *
     * The numerator is an all-time corpus rate — 20,355 scored criticals with
     * up to a decade to reach KEV. The denominator is a single-year cohort —
     * 4,110 criticals published in 2025 with about one year to acquire exploit
     * code. Different populations over different exposure horizons, and the
     * one-year PoC rate is truncated because exploit code keeps arriving, so
     * dividing by it inflates the conditional.
     *
     * The vendored snapshot publishes PoC coverage for one window year only, so
     * this cannot be re-derived here against a matched population. What it can
     * do is stop claiming to be measured and carry the uncertainty explicitly:
     * ASSUMED.wildRate scales both conditionals together, preserving their
     * ratio — and therefore the measured 81.2% PoC-first share — while letting
     * the confirmed-exploitation rate move across a range that spans both known
     * biases. At spread 0 it is the identity, so the model still reproduces the
     * corpus exactly. */
    pWildGivenPoC: C.inWild.pInWildGivenPoC / 100,
    pWildNoPoC: C.inWild.pInWildNoPoC / 100,
    /* Attacker clock, days from CVE publication to public PoC.
     *
     * Read off the POOLED SETTLED years, not `latest`. The model used to
     * calibrate to the most recent row in the series, which is the most
     * heavily right-censored one in it: 2026, n=94, observed through May, and
     * the only row in twelve years reporting a median above one day (3.5).
     * The page's own headline claim — that this median has not exceeded a day
     * in any settled year since 2015 — was therefore contradicted by the number
     * the simulation ran on, and the calibration file's own caveat says
     * provisional years are biased. Calibrating to data the page calls
     * unreliable, while arguing from data it calls settled, is not a
     * conservative choice; it is two different clocks in one document.
     *
     * It also quietly inflated the scenario dial. At a 3.5-day baseline the
     * "Exploit arrival speed" slider spent 55 of its 100 points returning to
     * what the settled record already measured, on a page whose whole argument
     * is that this clock has no room left to compress. Against the pooled
     * anchor the dial starts where the evidence does.
     *
     * `latest` is still exported and the page still shows it — a reader should
     * see the most recent row and see it marked provisional. It just does not
     * calibrate anything. */
    pocBefore: C.pocTiming.settled.pctBefore / 100,
    pocMedian: C.pocTiming.settled.medianDays,
    pocWithinWeek: C.pocTiming.settled.pctWithinWeek / 100,
    pocWindow: C.pocTiming.settled.years,
    pocN: C.pocTiming.settled.n,
  };

  /* ═══════════════════════════════════════════════════════════════════════
   * ACCESS CLASSES — how an intrusion starts.
   *
   * The first three are the original model: a race between exploit
   * availability and remediation. The five below them are not that race at
   * all, and could not be bolted onto it — there is no patch for a person
   * clicking a link, so no window opens and no cadence closes it. They are
   * independent annual arrivals, each gated by controls the vulnerability
   * engine never touches.
   *
   * `tier` is the epistemic status of the class's RATE, not of its existence.
   * All five new classes are `assumed`: the breach literature is clear that
   * they happen and roughly how often relative to each other, and silent on
   * what any single estate should expect. See SCOPE.accessMix for the anchor
   * the aggregate is held to.
   * ═══════════════════════════════════════════════════════════════════════ */
  var ACCESS = {
    opportunistic: { l: 'Opportunistic exploitation', tier: 'measured', vuln: true,
      d: 'Mass exploitation of a published vulnerability in something you expose. Timed against the measured publication-to-exploit clock.' },
    targeted:      { l: 'Targeted campaign', tier: 'assumed', vuln: true,
      d: 'An adversary that came for you specifically, using an open window if one exists and another way in if it does not.' },
    supply:        { l: 'Supply chain', tier: 'assumed', vuln: true,
      d: 'Compromise arriving through a supplier or a component. Your patch cadence is irrelevant to it.' },
    phishing:      { l: 'Phishing and social engineering', tier: 'assumed', vuln: false,
      d: 'A lure that reaches somebody who acts on it. Gated by filtering and awareness on the way in, and by how phishing-resistant your authentication is on the way through.' },
    credential:    { l: 'Credential abuse', tier: 'assumed', vuln: false,
      d: 'Valid credentials obtained elsewhere and used against you: infostealer logs, reuse, session theft. Largely indifferent to who you are.' },
    misconfig:     { l: 'Misconfiguration and exposure', tier: 'assumed', vuln: false,
      d: 'A directly reachable weakness with no vulnerability behind it: open storage, an exposed management plane, a default credential. No patch closes it.' },
    insider:       { l: 'Insider and privilege misuse', tier: 'assumed', vuln: false,
      d: 'Deliberate or negligent action by somebody who is already authorised. The hardest class for technical controls to reach.' },
    physical:      { l: 'Device loss and physical access', tier: 'assumed', vuln: false,
      d: 'A lost or stolen device that reaches data. Small, and mostly answered by encryption.' },
  };

  /* ═══════════════════════════════════════════════════════════════════════
   * SCOPE — what this model counts, and what it does not.
   *
   * Declared here rather than written into the page copy, because it is a
   * property of the model and the page has to be able to state it next to the
   * headline instead of in a footnote.
   *
   * This note used to call vulnerability exploitation "the largest single
   * initial-access category in the DBIR series", which the series does not
   * support. Credential abuse has led that ranking throughout — 22% against
   * 20% for vulnerability exploitation in the most recent edition where both
   * are broken out, and by a wider margin before it. Vulnerability
   * exploitation is the fastest-GROWING category, which is a different and
   * much weaker claim.
   *
   * The error was not neutral. It was written while credential abuse was one
   * of the routes this model EXCLUDED, and overstating the modelled share made
   * the excluded remainder look like a rounding error when it was in fact the
   * larger half — the exact assumption this page exists to argue against, made
   * by the page itself. Modelling those routes is the right answer to that
   * problem; it is not a reason the claim was ever true. Every probability
   * reported here remains a lower bound on intrusion risk, because the classes
   * in SCOPE.excluded are still absent.
   * ═══════════════════════════════════════════════════════════════════════ */
  var SCOPE = {
    /* Derived from ACCESS so the claim cannot drift from the simulation. This
     * list was three items and hand-written; both facts were a problem the
     * first time a route was added. */
    modelled: Object.keys(ACCESS).map(function (k) { return ACCESS[k].l; }),
    /* What is still absent, having added the five non-vulnerability classes.
     * These are genuinely out of scope rather than merely unmodelled: the
     * first two are not intrusions at all, and the third is a physical
     * control problem this model has no purchase on. */
    excluded: [
      'Denial of service and destructive action that does not involve intrusion',
      'Fraud achieved without entering a system, such as invoice and payment redirection',
      'Physical intrusion into premises',
    ],
    /* The same list as a noun phrase. The enumerated form is right for a
     * methodology note and unreadable inside a sentence, and the page needs it
     * inside a sentence — beside the headline, where it is actually read. */
    excludedShort: 'Denial of service, fraud without intrusion, and physical premises access',
    /* The independence assumption, declared rather than left implicit. Every
     * access class is drawn independently of the others, which understates
     * concentration: an organisation with weak authentication usually also
     * patches late, so real estates cluster at both ends more than this model
     * does. No public figure quantifies that correlation, and inventing one
     * would put a fabricated coefficient in front of every result. The effect
     * is to narrow the tails — the middle of the distribution is roughly
     * right, the best and worst estates are both understated. */
    routeIndependence: true,
    routeIndependenceNote: 'Access classes are drawn independently. Real control weaknesses correlate, since an estate weak on authentication is usually also weak on patching, so this understates how concentrated risk is at both ends of the range.',
    /* Detection enters this model in exactly one place — contained() — and
     * never touches a hazard, a remediation clock or an exploit-success roll.
     * A perfectly flat compromise line against detection posture is therefore
     * a PROPERTY OF THE CONSTRUCTION, not a result the simulation discovered,
     * and the page has to say so where it makes the claim. Real endpoint and
     * network controls do prevent some compromises: a blocked exploitation
     * attempt, a killed dropper, an IPS rule that holds. None of that is
     * modelled, so the flat line is an upper bound on how little detection is
     * worth against being compromised at all — not a measurement of it.
     *
     * Declared here rather than written into the page copy for the same reason
     * as the route list above it: it is a property of the model, and a claim
     * about the model should not be able to drift from the model. */
    detectionIsPostCompromiseOnly: true,
    detectionNote: 'Detection is modelled only after a compromise has happened, so it cannot change the compromise rate here by construction. Controls that block exploitation outright are not simulated.',
    /* Two more properties of the construction, declared here for the same
     * reason as the one above: a claim about the model must not be able to
     * drift from the model.
     *
     * ONE. Opportunistic hazard begins when EXPLOIT CODE exists, on the
     * publication-to-PoC clock. The vendored snapshot also carries a measured
     * KEV-latency series — 12 to 26 day medians, p75 between 248 and 336 days,
     * with 23% of entries added more than a year after publication — and this
     * model does not use it. That is deliberate rather than an oversight, and
     * it is not a free choice either way: KEV latency measures when CISA
     * CATALOGUED exploitation, which lags the exploitation itself by an unknown
     * amount, so it is an upper bound on onset in the same way the PoC clock is
     * a lower bound. The model takes the lower bound, which front-loads
     * in-the-wild pressure. Every window here should be read as the earliest
     * one the evidence supports, not the expected one.
     *
     * TWO. The floor is not a finding. A perfectly run estate — everything in
     * inventory, applicability in an hour, a daily change window, full
     * telemetry, and no criticals at all — still reports a compromise rate in
     * the mid teens, entirely from supply-chain arrivals and from targeted
     * campaigns succeeding with no vulnerability to use. Both of those sit on
     * the threat side of the page, where the reader has no lever, because this
     * model does not simulate the controls that actually move them:
     * segmentation, egress control, phishing-resistant MFA, privileged access
     * management, provenance verification. That floor is the model's ignorance,
     * not an irreducible property of the world, and a reader who takes it as
     * "nothing more can be done here" has been misled by an absence. */
    wildTimingUsesPoCClock: true,
    wildTimingNote: 'In-the-wild exposure is timed from when exploit code exists, which is the earliest onset the evidence supports rather than the expected one. The KEV-latency series in the same snapshot is far slower, but it measures cataloguing rather than exploitation.',
    floorIsUnmodelledNotIrreducible: true,
    /* This note used to say the floor came from routes the model did not
     * simulate, and named phishing-resistant MFA and egress control as the
     * missing controls. Four of the five routes it meant are now simulated
     * and two of those controls are now sliders, so the floor has moved and
     * the reason has changed with it: what is left is supply chain, which
     * this model still carries as one reduced-form rate. */
    floorNote: 'The compromise rate a perfectly run estate still carries comes mostly from the supply-chain route, which is a single reduced-form rate rather than a simulation of what happens inside a supplier compromise. Provenance verification, segmentation and blast-radius control are not modelled, so that remainder measures what this model still omits rather than what cannot be fixed.',
    /* Share of breaches attributed to vulnerability exploitation as the initial
     * access vector. `reported`, not `measured`: somebody else's population and
     * methodology, cited so the page's coverage claim has one source. */
    vulnShareOfBreaches: 0.31,
    src: 'Verizon DBIR 2026',
    /* `agentSkill` is no longer the model's stand-in for phishing, credential
     * abuse and insider action — those are simulated. What it still carries is
     * narrower and worth stating precisely: a TARGETED adversary, one that has
     * chosen you and will keep trying, succeeding by some route when no
     * remediation window is open. The five new classes model the commodity
     * background rate that arrives whether or not anyone chose you; this is
     * the premium a determined adversary adds on top. The two overlap at the
     * edges, which is an argument for keeping this rate low rather than for
     * removing it. */
    proxy: 'agentSkill',
    proxyNote: 'agentSkill no longer stands in for the human routes, which are now simulated. It carries only the premium a targeted adversary adds over the commodity rate when no remediation window is open.',
    /* The one published aggregate that speaks to the containment block, kept
     * here rather than on `containMid` — where it used to sit as a claimed
     * corroboration it could not provide. 44% is unconditional across all
     * ransomware attacks; `containMid` is conditional on detection landing in
     * one specific window. What the figure CAN do is bound the block as a
     * whole: the containment this model produces across its detection ladder
     * has to bracket the only aggregate anyone has published, or one of the
     * three regime coefficients is wrong. A test asserts exactly that, which
     * is a real check where counting citations was not. */
    containmentReported: 0.44,
    containmentSrc: 'Sophos State of Ransomware 2026',
    containmentNote: 'Reported containment is an unconditional rate across all ransomware attacks. It bounds the containment block as a whole rather than any single regime coefficient.',
    /* The reported initial-access mix this model's baseline estate is tuned
     * against. It is a POPULATION distribution, not a law about any one
     * estate: the whole point of the instrument is that a specific estate
     * departs from it, and every configured run will. It is here because the
     * non-vulnerability coefficients have no individual public anchor, so the
     * aggregate they produce is what gets held to a source instead.
     *
     * Shares are of first compromises, and they sum to 1 by construction.
     * `tolerance` is what test/model.test.js allows before it fails. */
    accessMix: {
      src: 'Verizon DBIR 2026, initial action shares, rebased to the classes this model simulates',
      tolerance: 0.10,
      target: {
        opportunistic: 0.20, targeted: 0.11, supply: 0.09,
        phishing: 0.19, credential: 0.26, misconfig: 0.09,
        insider: 0.05, physical: 0.01,
      },
    },
  };


  /* ═══════════════════════════════════════════════════════════════════════
   * NON-CORPUS COEFFICIENTS — everything the vendored snapshot cannot answer.
   * Each is drawn from [lo,hi] on every block of trials, which is where the
   * credible interval on the headline comes from.
   *
   * Two kinds, and the page distinguishes them:
   *   src present  -> a dated, published figure. Cited, but not independently
   *                   reproducible here the way the CyberMon corpus is.
   *   src absent   -> judgement. No public measurement exists.
   *
   * If you disagree with one, this is the only block you need to edit.
   * ═══════════════════════════════════════════════════════════════════════ */
  var ASSUMED = {
    /* days before publication that a pre-disclosure exploit appears (median) */
    preMedian:      { l: 'Days a pre-disclosure exploit precedes publication (median)', v: 7,    lo: 3,    hi: 21,   why: 'No public measurement of pre-disclosure exploit age. Shape assumed lognormal.' },
    /* 75th percentile of the PoC clock, days (anchors the slow tail) */
    /* The fourth knot of the attacker clock, and the only one with no measured
     * value. The three below it come from CyberMon's `arming` series, which is
     * conditioned on a 90-day horizon; this used to be quoted as "hero series
     * p75", a DIFFERENT series over a different population (unbounded, and
     * reporting a 2024 p75 of 164 days — a value the 90-day series cannot
     * produce by construction). One inverse-CDF sampler cannot interpolate
     * between knots from two distributions, so the number stays but the claim
     * does not: it is judgement, bounded above by the horizon of the series it
     * is a knot in. */
    pocP75:         { l: 'Days from publication to public exploit code (75th percentile)', v: 40,   lo: 20,   hi: 90,   why: 'No published p75 for the 90-day arming series the other three knots come from. Bounded above by that horizon.' },
    /* daily hazard that a mass-exploitation campaign reaches one exposed system */
    scanHazBase:    { l: 'Daily chance a mass-exploitation campaign reaches one exposed system', v: 0.010, lo: 0.004, hi: 0.022, why: 'No public per-asset campaign-arrival rate. Widest band in the model.' },
    /* hazard multiplier when an exploit exists publicly but is not known to be used */
    pocOnlyHazard:  { l: 'Hazard multiplier when exploit code is public but not known to be used', v: 0.08, lo: 0.02, hi: 0.20, why: 'Public PoC without confirmed in-the-wild use still draws opportunistic traffic.' },
    /* hazard multiplier for edge appliances vs ordinary web systems */
    edgeHazard:     { l: 'Hazard multiplier for edge appliances against ordinary systems', v: 2.2,  lo: 1.4,  hi: 3.6,  why: 'Edge appliances are hit harder and carry no endpoint telemetry.' },
    /* hazard multiplier applied to the pre-publication window (targeted, not mass) */
    preHazard:      { l: 'Hazard multiplier before publication, where activity is targeted', v: 0.25, lo: 0.08, hi: 0.60, why: 'Zero-day activity is targeted; mass scanning follows public code.' },
    /* P(you actually run the affected product at all) */
    /* These two used to ask "do you run the affected product at all?", which is
     * the question `stackVulns` has ALREADY answered — its own label is
     * "criticals in your stack". The vulnerability stream was therefore
     * discounted twice: 34 published criticals entered the trial loop and 15.7
     * survived a filter for something the reader had already told the model.
     * The funnel showed it plainly, naming the same set in two consecutive
     * stages ("Criticals published in your stack" -> "Present in software you
     * operate"), and the README's calibration story — 34 criticals at the
     * measured 2.87% giving 0.98 exploited criticals a year — described a
     * quantity no run of this model produced; it produced 0.45.
     *
     * They now carry the applicability question that genuinely remains once you
     * know the product is yours: is the version you run, in the configuration
     * you run it in, actually vulnerable. Advisories routinely name a range
     * narrower than the installed base, and a vulnerable feature is often not
     * enabled. That is a real filter, it is still unmeasured, and it is still
     * drawn — but it is a different question from the one the slider asks. */
    runsEdge:       { l: 'Chance an affected appliance is in a vulnerable version and configuration', v: 0.92, lo: 0.80, hi: 1.00, why: 'Appliance fleets run few versions and ship monolithic firmware, so an advisory that names your product usually names your build.' },
    runsWeb:        { l: 'Chance an affected ordinary product is in a vulnerable version and configuration', v: 0.85, lo: 0.65, hi: 1.00, why: 'Version spread and optional features are wider in ordinary software, so more advisories land on a build or configuration that is not exposed to them.' },
    /* containment: breakout and objective timings, days */
    breakoutMedian: { l: 'Days from foothold to lateral movement (median)', v: 0.0134, lo: 0.009, hi: 0.033,
      why: 'Median that reproduces the reported 29-minute average eCrime breakout under this model\'s lognormal spread. Upper bound is the 2024 figure (~48 min average).',
      src: 'CrowdStrike Global Threat Report 2026' },
    objectiveMedian:{ l: 'Days from foothold to the adversary objective (median)', v: 5,    lo: 2,    hi: 12,
      why: 'Median dwell when the adversary announces itself, usually via a ransomware note, giving a direct read on time from foothold to objective.',
      src: 'Mandiant M-Trends 2026' },
    /* P(contain) in each of the three detection regimes */
    containFast:    { l: 'Containment when detected before breakout', v: 0.92, lo: 0.80, hi: 0.98, why: 'Detected before breakout.' },
    containMid:     { l: 'Containment when detected before the objective', v: 0.55, lo: 0.35, hi: 0.75,
      /* This used to claim corroboration from "44% of ransomware attacks
       * stopped before encryption". That figure is UNCONDITIONAL — it is a rate
       * over all ransomware attacks, including the ones caught instantly and
       * the ones never caught. `containMid` is CONDITIONAL: containment given
       * that detection landed after breakout and before the objective. Two
       * different populations, so the number could not corroborate the
       * coefficient it was attached to, and the model's own realised
       * containment sits well below it anyway. The Sophos series is still the
       * right order-of-magnitude sanity check on the containment block AS A
       * WHOLE, which is where it now sits — in SCOPE, against the aggregate the
       * model actually produces. */
      why: 'Detected after breakout but before the objective. Judgement: no published figure conditions containment on this window.' },
    containLate:    { l: 'Containment when detected after the objective', v: 0.10, lo: 0.02, hi: 0.25, why: 'Detected after the objective is reached.' },
    /* fraction of your estate an affected product covers */
    afEdgeMin:      { l: 'Share of the appliance tier one affected product covers', v: 0.30, lo: 0.15, hi: 0.45, why: 'Appliance fleets are homogeneous: one vendor covers much of the tier.' },
    afWebMax:       { l: 'Share of the estate one affected ordinary product covers', v: 0.44, lo: 0.25, hi: 0.65, why: 'Ordinary software is spread thinner across an estate.' },
    /* P(a landed campaign actually compromises a reachable affected system) */
    exploitWorks:   { l: 'Chance a landed campaign compromises a reachable system', v: 0.35, lo: 0.18, hi: 0.55, why: 'Exploits fail: wrong version, hardening, luck.' },
    /* How the chance of being reached scales with the number of affected systems
     * you run. Sub-linear because a campaign that finds one of your hosts has
     * usually found the rest — they share a product, a netblock and a scan.
     *
     * This was `Math.pow(cnt, 0.4)`, a literal inside a hazard expression, and
     * it is the single constant that decides the model's largest claim: that
     * reducing what you expose is the only lever worth much. Across its range
     * the compromise probability of a 2,000-system estate moves from 40% to
     * 58%. A number that load-bearing does not get to sit outside the interval
     * that is supposed to describe the model's uncertainty. */
    crowdExp:       { l: 'How campaign pressure scales with affected system count (exponent)', v: 0.4, lo: 0.25, hi: 0.70,
      why: 'No public measurement of how mass-scanning pressure scales with an estate. 1.0 would mean every system is found independently; 0 that finding one is finding all.' },
    /* share of reached systems a landed campaign actually touches */
    reachShare:     { l: 'Share of reachable systems a landed campaign touches', v: 0.7, lo: 0.45, hi: 0.90,
      why: 'A campaign that reaches your estate rarely enumerates all of it before being noticed or moving on.' },
    /* chance a targeted campaign succeeds when a remediation window is open */
    windowSuccess:  { l: 'Chance a targeted campaign succeeds with a window open', v: 0.7, lo: 0.45, hi: 0.90,
      why: 'The upper end of the targeted route: an adversary enumerating you specifically, with an unremediated exposed system to find.' },
    /* how far ahead of ordinary software appliance exploitation runs */
    edgeLeadF:      { l: 'Appliance exploitation lead over ordinary software', v: 0.6, lo: 0.40, hi: 0.85,
      why: 'Appliances draw exploitation earlier on both sides of publication. Applied to the magnitude of the clock, so it holds for pre-disclosure exploits too.' },
    /* Hours from publication until an enforceable rule is actually in front of
     * the service. Virtual patching used to be instantaneous AND retroactive:
     * `win = shielded ? 0` closed the exposure window to zero including the
     * stretch BEFORE the exploit existed, so a WAF rule was credited with
     * covering pre-disclosure exploitation it could not have been written
     * against. A rule is authored after the vulnerability is known, shipped by
     * a vendor or by you, and tested before it is enforced. */
    wafLagH:        { l: 'Hours from publication to an enforceable WAF or IPS rule', v: 18, lo: 4, hi: 96,
      why: 'Managed rulesets ship within hours for high-profile bugs and days for the rest; a self-authored rule waits on a change window of its own.' },
    /* Scaling on the confirmed-exploitation rate. Identity at the central
     * value, so spread 0 still reproduces the corpus exactly; the range is what
     * the derivation's two known biases are worth, and they point opposite ways.
     *
     * DOWN: the conditional is an all-time KEV rate over a one-year PoC rate.
     * Exploit code keeps arriving for a cohort, so the true all-time critical
     * PoC rate is above the 8.2% measured at one year; at a plausible 15% the
     * conditional falls to 0.55x what it is stated as.
     *
     * UP: KEV is a US federal remediation list, curated for operational reasons,
     * not a census of exploitation. It is a floor on what is exploited, and
     * membership is not independent of public exploit code — CISA frequently
     * adds a CVE BECAUSE code is circulating, which manufactures part of the
     * correlation this conditional is measuring. */
    wildRate:       { l: 'Scaling on the measured confirmed-exploitation rate', v: 1, lo: 0.55, hi: 1.6,
      why: 'The in-the-wild conditional is a residual over mismatched populations, and KEV undercounts exploitation. The range spans both.' },
    /* how much slower detection is on a system with no endpoint telemetry */
    blindMult:      { l: 'Detection slowdown on systems with no endpoint telemetry', v: 2.6,  lo: 1.8,  hi: 5,
      why: 'Median dwell is 26 days when an external party notifies you and 10 days when detected internally, a measured 2.6x penalty for external notification.',
      src: 'Mandiant M-Trends 2026' },
    /* AUTOMATED RESPONSE — the two coefficients that make the fast containment
     * branch reachable at all.
     *
     * `contained()` raced a DWELL median against a ~19-minute breakout median
     * and nothing else, so `containFast` fired on 0.00% of baseline compromises
     * and 0.014% at the best detection rung. The highest-value coefficient in
     * the containment block was inert, the model was two-regime in practice
     * while presenting as three, and the `managed` rung's own description —
     * "this is where adversary breakout time stops winning by default" — was
     * contradicted by the model underneath it.
     *
     * The defect was a conflation of two different clocks. Dwell time is a
     * BREACH-LEVEL, post-hoc statistic: it measures intrusions that were
     * eventually discovered, and is dominated by the ones nobody noticed for
     * weeks. Racing it against breakout asks an analyst-time number to win a
     * machine-time race, which it cannot and should not. Automated response —
     * host isolation, process termination, a blocked child process — runs on
     * the second clock, and the model had no way to express it, which is why
     * the branch was dead rather than merely rare.
     *
     * Both are judgement. No public dataset reports what share of compromises
     * on covered systems are contained by automation before an analyst reads an
     * alert, and the ceiling is deliberately well short of certain: automated
     * response fires on recognised behaviour, and the compromises that matter
     * are disproportionately the ones it did not recognise. */
    autoContain:    { l: 'Share of covered-system compromises met by automated response', v: 0.35, lo: 0.15, hi: 0.60,
      why: 'Endpoint agents isolate hosts and kill processes without an analyst. No published figure separates automated containment from analyst response; the range is bounded well below certainty because automation acts on recognised behaviour.' },
    autoRespond:    { l: 'Time for automated response to act, once triggered (median)', v: 0.021, lo: 0.007, hi: 0.083,
      why: 'Machine time rather than analyst time: a median of about 30 minutes, ranging from ten minutes to two hours. This is the only clock in the model that can beat a breakout median.' },

    /* ── the non-vulnerability access classes ─────────────────────────────
     *
     * Every coefficient below is JUDGEMENT, and more thinly evidenced than
     * anything above it. That is not a reason to omit the routes: omitting
     * them is itself a judgement — that their rate is zero — and it is the
     * one judgement the published breach data flatly contradicts. What it is
     * a reason for is the calibration discipline these carry instead.
     *
     * None of these values is defensible on its own. What IS checkable is the
     * MIX they produce: at the baseline estate they are tuned so the model's
     * initial-access split lands near the reported breach population in
     * SCOPE.accessMix, and test/model.test.js fails if it drifts. So the
     * individual numbers are assumptions, the aggregate is anchored to a dated
     * third-party distribution, and a reader who disagrees has one block to
     * edit and one assertion to re-run.
     *
     * Read every rate as "per head per year" or "per exposed system per year"
     * — they are scaled by the estate, not absolute. */

    /* PHISHING. `phishLure` is not emails received; it is credible lures that
     * survive filtering AND reach somebody who engages. Orders of magnitude
     * below inbox volume by construction. */
    phishLure:      { l: 'Credible lures per head per year that reach an engaged user', v: 0.090, lo: 0.035, hi: 0.20,
      why: 'Not inbox volume: lures that survive filtering and reach somebody who acts. No public per-head rate exists; simulation click-rates measure a self-selecting population and a different behaviour.' },
    phishConv:      { l: 'Chance an engaged user leads to compromise, before authentication controls', v: 0.0088, lo: 0.003, hi: 0.022,
      why: 'Engagement is common; organisational compromise is not. Most captured credentials are unprivileged, stale, or caught before use. This is the step where the two orders of magnitude between a click-rate and a breach-rate live, and it is the least evidenced number in this model.' },
    phishAwareEff:  { l: 'Share of lures neutralised at full awareness and filtering maturity', v: 0.72, lo: 0.50, hi: 0.88,
      why: 'Filtering, banners, and fast user reporting. Bounded short of certain: targeted lures defeat training.' },
    phishMfaEff:    { l: 'Share of phishing conversions blocked at full phishing-resistant authentication', v: 0.88, lo: 0.70, hi: 0.96,
      why: 'Origin-bound credentials defeat credential replay and most token theft. Not total: consent phishing, help-desk social engineering and session hijack survive it.' },

    /* CREDENTIAL ABUSE. Arrival is exposure, not targeting — infostealer logs
     * and reuse make this route largely indifferent to who you are. */
    credExposure:   { l: 'Usable credential exposures per head per year', v: 0.055, lo: 0.02, hi: 0.14,
      why: 'Infostealer logs, reuse against breached corpora, and session cookies for sale. Commercial datasets exist; none is public and reproducible.' },
    credConv:       { l: 'Chance an exposed credential reaches a compromise, before controls', v: 0.0180, lo: 0.006, hi: 0.045,
      why: 'Most exposed credentials are stale, unprivileged, or for something not reachable from where the adversary is. Judgement.' },
    credMfaEff:     { l: 'Share of credential abuse blocked at full phishing-resistant authentication', v: 0.90, lo: 0.72, hi: 0.97,
      why: 'A stolen password is worth little against origin-bound authentication. Stolen SESSIONS still work, which is why this is not higher.' },
    credPamEff:     { l: 'Share of surviving credential abuse contained by privileged access management', v: 0.55, lo: 0.30, hi: 0.75,
      why: 'Just-in-time privilege and vaulting reduce what a valid account reaches. Judgement.' },

    /* MISCONFIGURATION. A directly reachable weakness with no CVE behind it —
     * an open bucket, exposed RDP, a default credential, a management plane on
     * the internet. Patch cadence is irrelevant to it, which is the point. */
    misconfigRate:  { l: 'Exploitable exposures per exposed system per year, with no vulnerability involved', v: 0.008, lo: 0.003, hi: 0.022,
      why: 'Open storage, management interfaces, default credentials. No public per-asset rate; scan-derived figures count findings rather than compromises.' },
    misconfigConv:  { l: 'Chance such an exposure is found and used within the year', v: 0.167, lo: 0.07, hi: 0.35,
      why: 'Internet-wide scanning finds reachable misconfiguration fast. Judgement.' },
    configEff:      { l: 'Share of exposures prevented at full configuration assurance', v: 0.75, lo: 0.50, hi: 0.90,
      why: 'Baselines, drift detection and external attack-surface monitoring. Bounded short of certain: assurance finds what it is looking for.' },

    /* INSIDER. The worst-evidenced class in the model and the smallest. */
    insiderRate:    { l: 'Deliberate or negligent insider incidents per head per year', v: 0.000079, lo: 0.000022, hi: 0.00024,
      why: 'No public base rate. Reported breach shares are the only anchor, and they measure detected insider action in populations that ran an investigation.' },
    insiderEff:     { l: 'Share of insider incidents prevented at full personnel and access controls', v: 0.45, lo: 0.20, hi: 0.65,
      why: 'Least privilege, joiner-mover-leaver rigour and egress monitoring. Deliberately the weakest control effect here: an authorised person acting within their access is the hardest case in the model.' },

    /* PHYSICAL AND DEVICE LOSS. Small, and mostly answered by encryption. */
    deviceLoss:     { l: 'Device loss or theft events per head per year that reach data', v: 0.000035, lo: 0.000009, hi: 0.00011,
      why: 'Loss is common; loss that reaches data is not. Judgement.' },
    deviceEff:      { l: 'Share of device-loss compromises prevented at full device control', v: 0.90, lo: 0.72, hi: 0.97,
      why: 'Full-disk encryption and remote wipe answer most of this class, which is why it is small and why the control effect is high.' },
  };

  /* ═══════════════════════════════════════════════════════════════════════
   * SHAPE — structural constants the trial loop needs and no reader sets.
   *
   * These used to be numeric literals scattered through the loop, which made
   * the note on ASSUMED ("if you disagree with one, this is the only block you
   * need to edit") untrue: an exponent buried in a hazard expression governed
   * how risk scales with estate size, and appeared in neither the credible
   * interval nor the tornado nor any list a reader could find.
   *
   * The four that MOVE THE ANSWER have been promoted into ASSUMED above, where
   * they are drawn and land in the band. What is left here is genuinely shape
   * — the spread of a lognormal, the friction an appliance adds to a change
   * window — where a range would be false precision. They are named, gathered
   * and commented rather than drawn, so that disagreeing with one is at least
   * possible without reading the loop.
   * ═══════════════════════════════════════════════════════════════════════ */
  var SHAPE = {
    /* Lognormal spreads. Each is a sigma on a median stated elsewhere. */
    sigAware:     0.6,   /* time to establish applicability                     */
    sigEmerg:     0.3,   /* out-of-band change window                           */
    sigCadence:   0.5,   /* slack around a scheduled change window              */
    medChange:    0.6,   /* median days a change itself takes, once scheduled    */
    sigHaz:       0.9,   /* per-vulnerability variation in campaign pressure    */
    sigPre:       0.95,  /* age of a pre-disclosure exploit                     */
    sigDetectOn:  0.8,   /* dwell on a system with telemetry                    */
    sigDetectOff: 0.9,   /* dwell on one without                                */
    sigAuto:      0.7,   /* automated response, once triggered                  */
    sigBreakout:  0.9,   /* foothold to lateral movement; set so the lognormal  */
                         /* MEAN reproduces the cited 29-minute average         */
    sigObjective: 0.7,   /* foothold to objective                               */
    /* Appliance friction. An appliance is slower to establish applicability
     * against, waits longer for a change window, takes longer in an emergency
     * one, and is less likely to be recognised as urgent in time. */
    edgeAware:    1.4,
    edgeCadence:  1.6,
    edgeEmerg:    1.5,
    edgeEmergHit: 0.8,
    /* Affected-fraction bounds. The drawn ends are ASSUMED.afEdgeMin and
     * ASSUMED.afWebMax; these are the fixed ends opposite them. */
    afEdgeMax:    0.90,  /* one appliance advisory can cover almost the tier    */
    afWebMin:     0.04,  /* ordinary software is spread thinner                 */
    /* Systems in no remediation cycle: half are fixed on rebuild, half are not
     * fixed at all. The two branches, in days. */
    darkRebuildP: 0.5,
    darkRebuild:  90,
    darkNever:    300,
    /* The exponential tail past the p75 knot, expressed as the quantile it is
     * anchored on: mean chosen so p95 lands near one year. */
    tailQuantile: 0.2,
  };

  /* ═══════════════════════════════════════════════════════════════════════
   * SLIDERS
   * ═══════════════════════════════════════════════════════════════════════ */
  var SPEC = {
    def: [
      /* Floors at zero rather than five, for the same reason `staff` does: it
       * is the scale term for both the vulnerability routes and the
       * misconfiguration route, so nothing can isolate those without being
       * able to reach a genuinely unexposed estate. It is also a real
       * posture — everything brokered, nothing listening — and the model
       * should be able to represent an estate it is asked about. */
      { k: 'exposed',   l: 'Internet-exposed systems',   min: 0,   max: 2000, step: 5,   v: 100,
        f: function (v) { return fmtN(v); },
        h: 'Any system reachable by an unauthenticated attacker.' },
      { k: 'edge',      l: '…that are edge appliances',  min: 0,   max: 100,  step: 5,   v: 25,
        f: function (v) { return v + '%'; },
        h: 'VPN, firewall, gateway, managed file transfer. No endpoint agent, slower to remediate, most heavily targeted.' },
      /* Floor was 80%, which made a fifth of the estate the worst gap the model
       * could express — and `MATURITY.loose` only reached 84%. Inventory
       * completeness for internet-facing assets is routinely worse than that:
       * shadow IT, forgotten DNS records pointing at live hosts, and estates
       * inherited through acquisition are the usual reasons an external scan
       * finds systems the owner did not know were listening. The lever ranks in
       * the model's top eight; it should be able to reach the values that make
       * it matter. */
      { k: 'inventory', l: 'Exposed systems in inventory', min: 50, max: 100, step: 1, v: 96,
        f: function (v) { return v + '%'; },
        h: 'The remainder sit in no remediation cycle at all: shadow IT, stale DNS, an acquired estate nobody has enumerated.' },
      { k: 'awareH',    l: 'Time to establish applicability', min: 1,  max: 336, step: 1,   v: 30,
        f: fmtH,
        h: 'From publication to confirming the vulnerability affects your estate. Once remediation runs in hours, this is the governing interval.' },
      { k: 'cadence',   l: 'Routine remediation cycle',        min: 1,   max: 90,   step: 1,   v: 14,
        f: function (v) { return v + ' d'; },
        h: 'Days between scheduled change windows.' },
      { k: 'emergH',    l: 'Out-of-band remediation time',      min: 0,   max: 336,  step: 6,   v: 72,
        f: function (v) { return v === 0 ? 'none' : fmtH(v); },
        h: 'Emergency change path. Zero means every vulnerability waits for the routine cycle.' },
      { k: 'emergHit',  l: 'Out-of-band trigger rate', min: 0, max: 100, step: 5, v: 60,
        f: function (v) { return v + '%'; },
        h: 'Share of exploited vulnerabilities recognised as urgent in time to take the out-of-band path.' },
      { k: 'virtual',   l: 'Mitigated by WAF or IPS rule', min: 0,   max: 80,   step: 5,   v: 20,
        f: function (v) { return v + '%'; },
        h: 'Recovers the exposure window while the permanent fix ships. Does not apply to appliances.' },
      { k: 'detect',    l: 'Time to detect a compromise', min: 0.1, max: 60,  step: 0.1, v: 14,
        f: function (v) { return v < 1 ? Math.round(v * 24) + ' h' : Math.round(v) + ' d'; },
        h: 'Median dwell time on a monitored system.' },
      { k: 'edrCoverage', l: 'Estate with endpoint telemetry', min: 0, max: 100, step: 5, v: 70,
        f: function (v) { return v + '%'; },
        h: 'Appliances are excluded automatically, since they support no agent. Compromise outside telemetry is typically reported by a third party.' },
    ],
    att: [
      { k: 'stackVulns', l: 'Criticals in your stack, per year', min: 0, max: 200, step: 1, v: 34,
        f: function (v) { return fmtN(v); },
        h: 'Published criticals in software you operate. Worldwide run-rate is ' + C.volume.curYearRunRate.critical.toLocaleString('en-US') + '.' },
      /* The three attacker clocks an autonomous capability could plausibly move,
       * separated because they are not the same claim and do not carry the same
       * evidence. Bundled into one 'AI' slider they were indistinguishable, and
       * the bundle was named after the weakest of the three. At full travel,
       * against the baseline estate, at the test suite's convention (20,000
       * trials, seed 1234, spread 0): arrival speed +3.8pt of compromise,
       * weaponisation +13.3pt, tempo +0.0pt (and +1.6pt of incidents, which is
       * the whole of what it does). The page's own thesis — that the clock
       * everyone watches was already at the floor — is only visible once the
       * three move independently. */
      { k: 'ai',        l: 'Exploit arrival speed',      min: 0,   max: 100,  step: 1,   v: 0,
        f: function (v) { return v === 0 ? 'as measured' : 'x' + (1 / clockScale(v)).toFixed(1) + ' sooner'; },
        h: 'Compresses the publication-to-exploit clock. Zero is the settled record (' + C.pocTiming.settled.years[0] + '–' + C.pocTiming.settled.years[C.pocTiming.settled.years.length - 1] + ' pooled, n=' + C.pocTiming.settled.n + '), whose median is already under a day and the clock with the least room left to compress.' },
      { k: 'weap',      l: 'Share of bugs weaponised',   min: 0,   max: 100,  step: 1,   v: 0,
        f: function (v) { return v === 0 ? 'as measured' : 'x' + weapMult(v).toFixed(1) + ' armed'; },
        h: 'How many published vulnerabilities acquire working exploit code at all, and how many arrive before disclosure. Measured today at ' + C.armed.pPoCCritical.toFixed(1) + '% of criticals. Breadth, not speed.' },
      { k: 'tempo',     l: 'Post-exploitation tempo',    min: 0,   max: 100,  step: 1,   v: 0,
        f: function (v) { return v === 0 ? 'as reported' : 'x' + (1 / tempoScale(v)).toFixed(1) + ' faster'; },
        h: 'Speed from foothold to lateral movement to objective, once inside. Does not change whether you are compromised, only whether detection arrives in time to matter.' },
      /* The fourth clock, and the one the page had no way to say anything about
       * until now. An autonomous capability that finds bugs raises the SIZE of
       * the vulnerability stream, which `stackVulns` carries — but `stackVulns`
       * is an estate property the reader sets, not a scenario, so it was reset
       * by every selector click and could not be swept against the other three.
       *
       * It is not a small omission. Measured against the same baseline, at the
       * README's recipe, doubling the discovery rate is worth more than the
       * largest of the other three dials at full travel and roughly six times
       * the one the phrase "AI" usually means. It is also the mechanism with
       * the least speculative evidence behind it: machine-found vulnerabilities
       * in real codebases are a present-tense capability, not a forecast.
       *
       * A separate dial rather than a multiplier folded into `stackVulns`,
       * because the two are different claims: one is "this is how much software
       * I run", the other is "this is how fast bugs are found in it". A reader
       * who has told the model the first should not have to restate it to ask
       * the second. */
      { k: 'discovery', l: 'Vulnerability discovery rate', min: 0, max: 100, step: 1, v: 0,
        f: function (v) { return v === 0 ? 'as measured' : 'x' + discMult(v).toFixed(1) + ' found'; },
        h: 'How many vulnerabilities are found in the software you already run. Scales the published stream against your stack without changing the stack. Breadth of the input, where the other three dials move what happens to it.' },
      { k: 'scan',      l: 'Mass-exploitation pressure',  min: 0,   max: 100,  step: 1,   v: 50,
        f: function (v) { return String(v); },
        h: 'Rate at which opportunistic exploitation reaches you once exploit code is public.' },
      { k: 'campaigns', l: 'Targeted campaigns per year', min: 0,   max: 100,  step: 1,   v: 6,
        f: function (v) { return fmtN(v); },
        h: 'Operations that enumerate your estate specifically rather than scanning indiscriminately.' },
      /* The model's only non-vulnerability access path, and the widest range in
       * it. Capped at 10% this slider could not express an adversary who does
       * not need a vulnerability — which is most of them, and is what an
       * autonomous phishing or credential-abuse capability buys. It is the
       * LARGEST term in the whole model on the compromise metric — ahead of
       * supply-chain hits, which it went past when the attention ladder was
       * rebalanced to carry capability as well as volume. */
      /* Step stays at 0.5 despite the range now reaching 60. clampTo() snaps a
       * composed value to the slider's own step, so a coarser step silently
       * rounds the ATTENTION ladder's coefficients: at step 1 the opportunistic
       * rung's 0.5x came back as 1 and could not reach below the baseline at
       * all, which is the property that makes this a ladder rather than a
       * ratchet. Precision is wanted at the bottom of this range, not the top. */
      { k: 'agentSkill', l: 'Campaign success without a vulnerability', min: 0, max: 60, step: 0.5, v: 1,
        f: function (v) { return v + '%'; },
        h: 'Per targeted campaign, when no remediation window is open: phishing, credential abuse, misconfiguration or chained logic flaws. This is the model\'s proxy for the routes it does not simulate directly.' },
      /* A REDUCED-FORM route, like `agentSkill`, and for the same reason: the
       * model does not simulate what happens inside a supply-chain compromise,
       * so the slider is stated net of everything that would have to go right
       * for the adversary. The label says compromises and the hint used to say
       * "reaches your estate", which are very different quantities — of the
       * ~18,000 estates that installed the backdoored SolarWinds update, on the
       * order of a hundred were actually acted on. The hint now says what the
       * number is, so a reader setting it knows which one they are setting. */
      { k: 'supply',    l: 'Supply-chain compromises per year', min: 0, max: 3, step: 0.01, v: 0.12,
        f: function (v) { return v.toFixed(2); },
        h: 'Compromised dependency or signed update that reaches your estate AND is acted on. Stated net: far more compromised components arrive than are ever used. Remediation cadence does not apply to this vector.' },
    ],

    /* ── identity and people ──────────────────────────────────────────────
     *
     * A third card rather than more sliders on the first, because these
     * answer a different question. Everything in `def` is about the race
     * between a published vulnerability and your change window. Nothing here
     * is: these gate the routes where no vulnerability is involved at all,
     * and the controls that move them — authentication, privilege, filtering,
     * configuration assurance — have no bearing on the patch clock.
     *
     * `staff` leads because it is the denominator for four of the five new
     * classes. Phishing, credential abuse, insider action and device loss
     * scale with people; misconfiguration scales with systems. An estate's
     * exposure to the first four is a headcount question, and the model had
     * no headcount until these routes existed. */
    idn: [
      /* Floors at zero, not at five. Four of the five new classes are scaled
       * by this, so it is the only way to isolate them — the degenerate tests
       * need to reach a genuinely people-free estate, and so does a reader
       * asking what the machine-to-machine estate alone carries. */
      { k: 'staff',     l: 'People with access', min: 0, max: 50000, step: 5, v: 750,
        f: function (v) { return fmtN(v); },
        h: 'Anyone who can authenticate to something you run: staff, contractors, and the service desk. The denominator for phishing, credential abuse, insider action and device loss.' },
      { k: 'mfa',       l: 'Authentication strength', min: 0, max: 100, step: 1, v: 62,
        f: function (v) { return v + '%'; },
        h: '0 is passwords alone. 100 is origin-bound, phishing-resistant authentication everywhere, including the service desk. The single largest control in this half of the model.' },
      { k: 'awareness', l: 'Filtering and user reporting', min: 0, max: 100, step: 1, v: 48,
        f: function (v) { return v + '%'; },
        h: 'Mail filtering, link and attachment handling, and how fast a user who did click tells somebody. Reduces how many lures reach an engaged person; does not touch what happens after one does.' },
      { k: 'pam',       l: 'Privileged access management', min: 0, max: 100, step: 1, v: 48,
        f: function (v) { return v + '%'; },
        h: 'Just-in-time privilege, vaulting and session brokering. Acts on credential abuse that has already got a valid account, by limiting what that account reaches.' },
      { k: 'configAssurance', l: 'Configuration assurance', min: 0, max: 100, step: 1, v: 50,
        f: function (v) { return v + '%'; },
        h: 'Baselines, drift detection and external attack-surface monitoring. The only control acting on the misconfiguration route, which no patch cycle can close.' },
      { k: 'insiderCtl', l: 'Personnel and least privilege', min: 0, max: 100, step: 1, v: 48,
        f: function (v) { return v + '%'; },
        h: 'Joiner-mover-leaver rigour, least privilege and egress monitoring. Deliberately the weakest control effect in the model: an authorised person acting within their access is the hardest case here.' },
      { k: 'deviceCtl', l: 'Device encryption and management', min: 0, max: 100, step: 1, v: 72,
        f: function (v) { return v + '%'; },
        h: 'Full-disk encryption, MDM enrolment and remote wipe. Answers most of the device-loss class, which is why that class is small.' },
    ],
  };

  function fmtN(v) {
    return v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(v);
  }
  function fmtH(v) {
    if (v < 24) return v + ' h';
    var d = v / 24;
    return (d < 10 ? d.toFixed(1).replace(/\.0$/, '') : Math.round(d)) + ' d';
  }

  /* ======================================================================
   * EXPOSURE - what you put in front of an unauthenticated stranger.
   *
   * This is the page's founding claim, made selectable: the more of your
   * estate a stranger can reach without credentials, the more of the
   * attacker's clock applies to you at all. It is one axis, so it is one
   * choice - the rungs are alternatives, not attributes. You cannot be both
   * corporate-network-only and a SaaS vendor, and a multi-select could not
   * say so; it averaged the two and produced an estate that exists nowhere.
   *
   * The rungs are ordered and monotone in reachable surface. Rung one is the
   * floor the control previously had no way to express: an estate that
   * publishes no unauthenticated listener is not merely below average, it is
   * off the bottom of the baseline.
   *
   * Drives the four terms that describe reachable surface - how many systems,
   * how many of them are appliances, how large a vulnerability stream the
   * software they run commits you to, and how much of it a WAF can stand in
   * front of. Everything else is left to the other three controls.
   * ====================================================================== */
  var EXPOSURE = {
    /* Labelled 'Nothing inbound' until it was checked against what it
     * produces: ten exposed systems, one or two of them appliances, and a
     * fourteen-critical-a-year stream against them — with the opportunistic
     * route still carrying 6% of first compromises. The description was already
     * accurate ("what remains reachable is the broker itself"); the label
     * contradicted it, and a reader picking a rung reads the label. There is no
     * rung for a genuinely zero-listener estate because this model has nothing
     * to say about one. */
    none: {
      l: 'Brokered access only',
      d: 'No general-purpose unauthenticated listener. Access is brokered outbound-only, so what stays reachable is the broker itself and little else. The floor of this axis: not a typical estate, and not zero.',
      m: { exposed: 0.12, edge: 0.5, stackVulns: 0.4 },
    },
    corp: {
      l: 'Corporate edge only',
      d: 'VPN, mail and a handful of internal applications published to the internet. Software is operated, not distributed. A small surface, but appliance-heavy for its size, which is the worst composition per system.',
      m: { exposed: 0.55, edge: 1.4, stackVulns: 0.7, virtual: '-5' },
    },
    web: {
      l: 'Public web presence',
      d: 'The corporate edge plus a public site, a customer portal and some APIs. Reachable by anyone, but not the thing being sold, so the web tier stays a minority of the estate.',
      m: { exposed: 1, edge: 1, stackVulns: 1 },
    },
    product: {
      l: 'The product is public',
      d: 'The exposed surface is the revenue: a wide web tier, few appliances, and first-party fixes deployable within the hour. The trade-off is a substantially larger dependency stream.',
      m: { exposed: 2.4, edge: 0.35, stackVulns: 1.9, virtual: '+20' },
    },
    others: {
      l: 'We run other estates',
      d: 'Hosting or managed service. The surface is a multiple of headcount rather than a function of it, and a single appliance vulnerability becomes a customer-wide event.',
      m: { exposed: 6, edge: 1.1, stackVulns: 2.2, virtual: '+5' },
    },
  };

  /* ======================================================================
   * TRAITS - what else is true, on top of wherever you sit on that axis.
   *
   * Every trait here composes with every rung without contradicting it: you
   * can sell software from any exposure posture, run an OT plant behind any
   * of them, and depend on third parties regardless. That is the test a trait
   * has to pass to be a trait rather than a rung.
   *
   * Numeric values multiply; string values like '+20' or '-6' offset. Every
   * result is clamped to the slider range afterwards, so combinations cannot
   * produce impossible estates.
   *
   * These are editorial judgement, not measurement: no public dataset gives
   * per-sector estate composition. They exist because the alternative is
   * asking a reader to guess "criticals in my stack per year" cold. Every
   * slider stays editable once you have picked.
   *
   * Two former traits are deliberately absent. 'Legacy we cannot touch' set
   * cadence, coverage, trigger rate and inventory in the same direction as
   * MATURITY.loose, so selecting both counted one weakness twice and reached
   * an 80-day change window nobody asked for; the maturity ladder owns that
   * axis alone now. 'Regulated / finance' was not an environment attribute at
   * all - it bought campaigns x4, which is adversary attention - and has moved
   * to ATTENTION on the threat side, where the reader cannot mistake it for
   * something they control.
   * ====================================================================== */
  var TRAITS = {
    vendor: {
      l: 'We sell software others run',
      d: 'Customers operate what you build, which makes you a supply-chain node. The build and signing pipeline forms part of the attack surface, and the dependency stream is inherited by everyone downstream.',
      m: { supply: 3, stackVulns: 1.3 },
    },
    ot: {
      l: 'OT / ICS in scope',
      d: 'Change windows run to months and any reboot carries a safety case. Long-lived appliances, minimal endpoint telemetry, and a small surface with high consequence of loss.',
      m: { edge: 2.0, cadence: 4.0, emergH: 3.0, emergHit: 0.5, awareH: 3.0,
           edrCoverage: 0.3, detect: 2.5 },
    },
    thirdparty: {
      l: 'Heavy third-party / cloud',
      d: 'A significant share of the dependency estate is operated by third parties. Neither remediation cadence nor telemetry reaches it.',
      m: { supply: 3.5, inventory: '-4', stackVulns: 1.4, edrCoverage: 0.85 },
    },
  };

  /* DETECTION - what you have deployed, expressed as the two things that
   * actually decide containment: how fast you see a covered system, and how
   * much of the estate is covered at all. Appliances are never covered.
   * Coverage without speed buys very little - the model will show you that
   * if you set the two independently. */
  /* `detect` is the INTERNAL dwell median — the clock on a system you can see.
   * Everything off telemetry runs at `detect * blindMult`, and blindMult is the
   * measured 2.6x penalty for being told by an outsider (26-day median external
   * against 10-day internal). So the rung sets the internal figure and the
   * external one FALLS OUT; it must not be typed in twice.
   *
   * `siem` used to do exactly that. Its description named the 26-day external
   * median and its `detect` was 26 — assigning an external-notification figure
   * to the covered population, which then had the external penalty applied
   * again on top of the 60% that was uncovered. The estate-weighted dwell came
   * out at 51 days while the rung's own sentence claimed 26. `none` was worse
   * in a quieter way: 45 days at 5% coverage produces 113 days estate-weighted,
   * a figure no source cited here supports or comes near.
   *
   * The column below each rung is what it now produces across the estate,
   * excluding appliances, at the central blindMult. `edr` is unchanged because
   * it was the one rung already built this way.
   *
   *   rung      internal   coverage   estate-weighted
   *   none        24 d         5%        60 d
   *   siem        13 d        40%        26 d   <- the cited external median
   *   edr         10 d        80%        13 d   <- 10 internal / 26 external
   *   tuned        3 d        90%         4 d
   *   managed      1 d        95%         1 d
   *
   * The coverage column reads 80/90/95 rather than the 78/88/93 it carried
   * until now because `clampTo` snaps every composed value to its slider's own
   * step, and `edrCoverage` steps in fives. The three odd figures were
   * unreachable: the table declared one number and the model ran another. A
   * rung has to be able to state what it does.
   *
   * `none` is the one figure here with no anchor under it. M-Trends measures
   * external notification among organisations that ran an incident response
   * engagement; an estate with no detection at all is worse than that
   * population and there is no published number for how much worse. Roughly
   * double the external median is judgement, and is marked as such rather than
   * inheriting the citation from the rungs above it. */
  var DETECTION = {
    none:    { l: 'No detection',     d: 'Logs are retained but not reviewed. Notification arrives from a third party, later than the 26-day external median. How much later is judgement, not measurement.', p: { detect: 24,  edrCoverage: 5 } },
    siem:    { l: 'SIEM, untuned',    d: 'Collection is in place, detection content is not. Most of the estate is found by external notification, which lands the whole estate on the measured 26-day median.', p: { detect: 13,  edrCoverage: 40 } },
    edr:     { l: 'EDR deployed',     d: 'Endpoint agents on most servers with business-hours response. Matches the 10-day median for organisations detecting internally, and the 26-day one for the remainder.', p: { detect: 10,  edrCoverage: 80 } },
    tuned:   { l: 'EDR + tuned SIEM', d: 'Agents plus maintained detection content against live telemetry, with an analyst on the queue.',                                p: { detect: 3,   edrCoverage: 90 } },
    managed: { l: 'Managed 24/7',     d: 'MDR or an in-house SOC with genuine out-of-hours cover. This is where adversary breakout time stops winning by default.',    p: { detect: 1,   edrCoverage: 95 } },
  };

  /* ======================================================================
   * IDENTITY - how somebody proves they are allowed in.
   *
   * The same shape as DETECTION and for the same reason: a reader can pick a
   * posture they recognise far more reliably than they can estimate seven
   * coefficients. The sliders behind it stay editable, so the ladder is a
   * starting point rather than a cage.
   *
   * Ordered and single-select, because it is one axis. An estate does not
   * have both "passwords only" and "phishing-resistant everywhere" — and the
   * rungs are deliberately about the WEAKEST path in, not the best one
   * available, because that is what an adversary uses. An organisation with
   * FIDO2 for engineers and SMS codes for the service desk is on the SMS
   * rung, which is the observation most of this class turns on.
   * ====================================================================== */
  var IDENTITY = {
    passwords: { l: 'Passwords only',      d: 'Single factor somewhere that matters. A credential obtained anywhere is a credential that works here.',
      p: { mfa: 5,  pam: 10 } },
    sms:       { l: 'SMS or push codes',   d: 'Second factor present but replayable: codes a user can be talked into reading out, and push prompts they can be worn down into accepting.',
      p: { mfa: 38, pam: 30 } },
    app:       { l: 'App and number match', d: 'Number matching or TOTP, resistant to fatigue but not to a convincing proxy page.',
      p: { mfa: 62, pam: 48 } },
    fido:      { l: 'Phishing-resistant',  d: 'Origin-bound credentials with no fallback path, including for the service desk, which is where this control is usually undone.',
      p: { mfa: 93, pam: 72 } },
  };

  /* ======================================================================
   * PEOPLE - the human-process side, as one choice.
   *
   * Awareness, personnel controls and device management move together in
   * practice: they are funded by the same programme and neglected by the same
   * one. Three sliders that almost always agree are better presented as one
   * ladder with the sliders behind it.
   * ====================================================================== */
  var PEOPLE = {
    minimal:  { l: 'Minimal',  d: 'Annual compliance training, default mail filtering, and a joiner-mover-leaver process that runs late.',
      p: { awareness: 15, insiderCtl: 15, deviceCtl: 35 } },
    standard: { l: 'Standard', d: 'Maintained filtering, a reporting button people actually use, and access reviews that happen.',
      p: { awareness: 48, insiderCtl: 48, deviceCtl: 72 } },
    strong:   { l: 'Strong',   d: 'Continuous simulation with fast reporting, tight least privilege with egress monitoring, and full device enrolment.',
      p: { awareness: 78, insiderCtl: 76, deviceCtl: 92 } },
  };

  /* ======================================================================
   * ATTENTION - who is aiming at you, and how hard.
   *
   * Lives on the threat side because it is not a property of your estate. It
   * used to be a trait called 'Regulated / finance', sitting among things the
   * reader controls, described in defensive language - "enforced change
   * control, maintained detection" - while quadrupling the campaign rate. A
   * reader picked a chip that read as competence and watched the number rise
   * by nineteen points. The effect was defensible; its placement was not.
   *
   * Ordered, single-select, and monotone in adversary interest. Drives the
   * three terms that carry deliberate attention rather than opportunism:
   * campaigns that enumerate you specifically, supply-chain compromises aimed
   * at whoever is downstream of you, and how far a campaign gets with no
   * vulnerability to use.
   *
   * That third term is recent, and its absence had a shape: a named state-nexus
   * actor and a bystander were given identical odds of being let in by
   * phishing, stolen credentials or a service-desk call, which is the opposite
   * of what distinguishes them. `agentSkill` is the model's only proxy for
   * those routes, so adversary capability on them belongs to the axis that
   * already owns adversary interest.
   *
   * `campaigns` came down on the upper rungs at the same time, and had to. It
   * was calibrated with the non-vulnerability route nearly closed, so coupling
   * the two without rebalancing compounds them: at 12x on the top rung the
   * ladder reached 99.9%, which is arithmetic rather than an instrument. The
   * rebalanced ladder trades campaign VOLUME for campaign CAPABILITY —
   * sector 4x->2.5x and named 9x->5x on `campaigns`, against 2.5x and 4x on
   * `agentSkill` — and what moves is the mix, not just the total. The targeted
   * route goes from 4% of first compromises at the bottom rung to 73% at the
   * top, which is the claim: the more deliberate the attention, the more of
   * your risk sits on routes no remediation cycle touches.
   *
   * The totals rise too, and that is the finding rather than a side effect.
   * The old figures were low BECAUSE the route was closed; opening it should
   * raise them. The ladder now reads 28.8 / 37.1 / 61.1 / 86.5 percent
   * compromise, the targeted route carrying 4 / 21 / 50 / 68 percent of first
   * compromises. Those totals moved again when four defects were fixed
   * together — a stream discounted twice, a biased binomial, an appliance clock
   * applied to a signed time, and a per-year count that reached past the year —
   * so re-measure the column before quoting it; the MIX is the durable claim.
   *
   * Coefficients are judgement and nothing else — no public measurement gives
   * per-adversary success against a patched estate. 4% on the top rung is
   * conservative against any published account of how such intrusions begin.
   * ====================================================================== */
  var ATTENTION = {
    ambient: {
      l: 'Opportunistic only',
      d: 'Nobody is looking for you by name. What arrives is what arrives at every reachable address: mass scanning behind public exploit code. What little deliberate attention there is arrives with commodity tradecraft behind it.',
      m: { campaigns: 0.15, supply: 0.6, agentSkill: 0.5 },
    },
    ordinary: {
      l: 'Ordinary interest',
      d: 'The baseline. Occasional deliberate enumeration, mostly commodity ransomware affiliates working a target list you happen to be on.',
      m: { campaigns: 1, supply: 1 },
    },
    sector: {
      l: 'Sector under pressure',
      d: 'Finance, healthcare, government supply and defence industrial base. Targeted well above what headcount would suggest, and the third-party estate is large enough to constitute its own exposure. Fewer campaigns than a named target draws, but each one arrives with a credential-phishing capability behind it rather than only a scanner.',
      m: { campaigns: 2.5, supply: 2, agentSkill: 2.5 },
    },
    named: {
      l: 'A named target',
      d: 'Specific, persistent adversary interest in you rather than in your sector. State-nexus or a determined criminal group with a reason to keep coming back after a failure. Not waiting for a vulnerability to be available: this is the rung that phishes, buys credentials and calls the service desk.',
      m: { campaigns: 5, supply: 3, scan: '+15', agentSkill: 4 },
    },
  };
  /* MATURITY - how well the estate is run. Orthogonal to what you are, so it
   * is a transform rather than another table of absolutes. */
  /* 'bod' is not a maturity level so much as a mandated regime. CISA BOD 26-04
   * (10 June 2026) supersedes BOD 22-01 and prioritises on four decision
   * points - in the KEV catalogue, publicly exposed, automatable by an
   * adversary, and technical impact - with the shortest tier at three days
   * plus forensic triage. Its own heuristic for "automatable" is a public
   * proof-of-concept that achieves RCE and reliably executes, which is the
   * same primitive this model runs on. The numbers below express that regime
   * as a transform on the baseline estate. */
  /* The `d` strings describe what each regime does to the estate, in the same
   * terms as the multipliers beside them. 'BOD 26-04' in particular is the one
   * control on the page whose label cannot be guessed from the label alone. */
  var MATURITY = {
    tight:   { l: 'Mature',    d: 'Change windows in days rather than weeks, an emergency path that genuinely runs, applicability established quickly, and detection content maintained against live telemetry.',
      cadence: 0.25, emergH: 0.20, emergHit: 1.5, awareH: 0.25, detect: 0.05, virtual: 2.5, inventory: 4,   edrCoverage: 12 },
    typical: { l: 'Typical',   d: 'The baseline estate: scheduled change windows, an out-of-band path used when somebody escalates, and partial telemetry coverage.',
      cadence: 1,    emergH: 1,    emergHit: 1,   awareH: 1,    detect: 1,    virtual: 1,   inventory: 0,   edrCoverage: 0 },
    /* `inventory: -12` was written against a slider that floored at 80, so the
     * sprawling estate bottomed out at 84% — better inventory than the rung's
     * own description claims. With the floor at 50 it can now reach the gap the
     * words describe. */
    loose:   { l: 'Sprawling', d: 'Change control by exception, applicability established late, little virtual patching, and a material share of the estate in no remediation cycle at all.',
      cadence: 2.6,  emergH: 2.4,  emergHit: 0.5, awareH: 3.5,  detect: 3.2,  virtual: 0.3, inventory: -22, edrCoverage: -25 },
    bod:     { l: 'BOD 26-04', d: 'A mandated regime rather than a rung on the ladder. Prioritising on KEV presence, exposure, automatability and impact buys faster, more reliable triage and a better-known estate, not a faster change window.',
      cadence: 1,    emergH: 1,    emergHit: 1.55, awareH: 0.33, detect: 1,    virtual: 1,   inventory: 3,   edrCoverage: 4 },
  };

  /* The rung and the attention level the baseline estate already represents.
   * `SPEC` defaults describe a generic mid-size estate with a public web
   * presence and no particular adversary interest, so these two are the
   * identity of the composer: compose({}) must return defaults() unchanged,
   * which is what the ordering test asserts. Both tables carry a x1 rung for
   * exactly that reason. */
  var DEFAULT_EXPOSURE = 'web';
  var DEFAULT_ATTENTION = 'ordinary';
  /* The rungs the SPEC defaults already sit on, so compose({}) is defaults()
   * for these two ladders as well. Both tables carry a rung whose coefficients
   * ARE the slider defaults for exactly that reason. */
  var DEFAULT_IDENTITY = 'app';
  var DEFAULT_PEOPLE = 'standard';
  /* The scenario dials: what-if travel on the threat side, not estate shape.
   * No shape table touches them, so `compose` carries them across untouched
   * rather than recomposing them — which is precisely what it must do, because
   * a reader picking a maturity rung has said nothing about the exploit clock.
   *
   * Named as a SET, not one at a time. `compose` forwarded `ai` alone when `ai`
   * was the only dial there was, and kept forwarding `ai` alone after the
   * slider was split into three: every selector click silently reset `weap` and
   * `tempo` to zero while `ai` survived, so the page's own comparison — the
   * three clocks against each other — could not be held while shaping an
   * estate. Anything added to this list is carried by construction. */
  var SCENARIO = ['ai', 'weap', 'tempo', 'discovery'];
  /* Exported, because js/app.js needs the SAME arithmetic when it reads a
   * parameter off the query string. It clamped to the range there and stopped,
   * so a hand-edited `?cadence=14.3` left the model running on 14.3 while the
   * control it belongs to displayed the 14 the browser had snapped it to — the
   * instrument disagreeing with the estate it is reporting on, which is the
   * one thing this function exists to prevent. */
  function clampTo(k, v) {
    var s = SPEC.def.concat(SPEC.att, SPEC.idn).filter(function (x) { return x.k === k; })[0];
    if (!s) return v;
    var q = Math.min(s.max, Math.max(s.min, v));
    /* snap to the slider's own step so control and model never disagree */
    var snapped = Math.round((q - s.min) / s.step) * s.step + s.min;
    return Math.min(s.max, Math.max(s.min, +snapped.toFixed(4)));
  }

  /* Compose a parameter set:
   *   baseline -> exposure rung -> traits -> attention -> maturity -> detection
   *
   * The first three all speak the same `m` dialect and are gathered into one
   * pass, so they cannot depend on the order they were applied in - and,
   * because the rung and the attention level are single-select, a rung's
   * multiplier and a trait's multiplier on the same term compound exactly the
   * way two traits would. `edge` is the term where that matters: the corporate
   * rung already tilts appliance-heavy, and an OT plant on top of it tilts
   * further, which is the composition the old multi-select could not express
   * without also averaging away the exposure claim. */
  /* A table lookup by a key that came from a URL must not resolve an inherited
   * Object.prototype member. `DETECTION['constructor']` is truthy, so the guard
   * below used to pass and then dereference `det.p.detect` on undefined —
   * index.html?det=constructor threw inside fromURL(), which runs at the top of
   * init() outside any try/catch, and the whole console failed to build. The
   * maturity table was quieter and worse: ?mat=toString composed eight NaN
   * parameters and simulated them. */
  function owns(table, key) {
    return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
  }

  function compose(opts) {
    opts = opts || {};
    var traits = opts.traits || [];
    var out = defaults();

    /* Multipliers and offsets are gathered separately and applied once, because
     * the two do not commute: (x+12)*0.3 is not (x*0.3)+12, and clicking the
     * same two traits in the other order would otherwise give a different
     * estate.
     *
     * Multipliers combine by summing their EXCESS over 1 rather than by
     * multiplying. Three traits that each roughly double a term should not
     * produce an eightfold estate — stacking traits should compound, but with
     * diminishing returns. A single trait is unaffected: excess 1.4 gives
     * exactly x2.4, the multiplier as written. */
    var up = {}, down = {}, off = {};
    function gather(m) {
      if (!m) return;
      Object.keys(m).forEach(function (prop) {
        var mod = m[prop];
        if (typeof mod === 'string') off[prop] = (off[prop] || 0) + parseFloat(mod);
        else if (mod >= 1) up[prop] = (up[prop] || 0) + (mod - 1);
        else if (mod > 0) down[prop] = (down[prop] || 0) + (1 / mod - 1);
      });
    }
    /* The rung is the only one of the three that is always present. An unknown
     * or absent key falls back to the middle rung rather than to no rung at
     * all, so a stale shared link cannot silently produce a surface-free
     * estate that the reader never chose. */
    gather(EXPOSURE[owns(EXPOSURE, opts.exposure) ? opts.exposure : DEFAULT_EXPOSURE].m);
    /* `owns`, not a truthiness test, for the same reason as the three tables
     * either side of it — and this is the one that takes a LIST, which is why
     * it was the one the guard missed. `?traits=constructor` resolved the
     * Object constructor, whose `.m` is undefined; `gather` tolerated that and
     * returned, so the damage surfaced later and elsewhere, in the coverage-cap
     * loop below, as a TypeError out of init(). */
    traits = traits.filter(function (key) { return owns(TRAITS, key); });
    traits.forEach(function (key) { gather(TRAITS[key].m); });
    gather(ATTENTION[owns(ATTENTION, opts.attention) ? opts.attention : DEFAULT_ATTENTION].m);

    Object.keys(out).forEach(function (prop) {
      var factor = (1 + (up[prop] || 0)) / (1 + (down[prop] || 0));
      out[prop] = out[prop] * factor + (off[prop] || 0);
    });

    var mat = MATURITY[owns(MATURITY, opts.maturity) ? opts.maturity : 'typical'];
    ['cadence', 'emergH', 'emergHit', 'awareH', 'detect', 'virtual'].forEach(function (k) {
      out[k] = out[k] * mat[k];
    });
    out.inventory += mat.inventory;
    out.edrCoverage += mat.edrCoverage;

    /* Detection is an assignment, not a multiplier, because the reader picked
     * a stack and the stack states its own dwell time and coverage. The one
     * thing it must not do is overwrite a physical impossibility with an
     * aspiration: an OT estate cannot reach 93% endpoint coverage by buying an
     * MDR contract, because the appliances support no agent. So a trait that
     * suppresses coverage keeps its suppression, applied to whatever the
     * posture claims. Dwell time is genuinely purchasable and is not capped. */
    var det = owns(DETECTION, opts.detection) ? DETECTION[opts.detection] : null;
    if (det) {
      var covCap = 1;
      traits.forEach(function (key) {
        var m = TRAITS[key].m;
        if (typeof m.edrCoverage === 'number' && m.edrCoverage < 1) covCap *= m.edrCoverage;
      });
      out.detect = det.p.detect;
      out.edrCoverage = det.p.edrCoverage * covCap;
    }

    /* Identity and people, assigned the same way and for the same reason: the
     * reader picked a posture, and the posture states its own coefficients.
     * Both are optional — an absent ladder leaves the sliders wherever the
     * shape pass put them, so compose({}) is still defaults(). */
    var idt = owns(IDENTITY, opts.identity) ? IDENTITY[opts.identity] : null;
    if (idt) Object.keys(idt.p).forEach(function (k) { out[k] = idt.p[k]; });
    var ppl = owns(PEOPLE, opts.people) ? PEOPLE[opts.people] : null;
    if (ppl) Object.keys(ppl.p).forEach(function (k) { out[k] = ppl.p[k]; });

    Object.keys(out).forEach(function (k) { out[k] = clampTo(k, out[k]); });
    /* After the clamp, and read from `opts` rather than composed: these are the
     * reader's scenario, carried through the shape pass unchanged. An absent
     * dial falls back to its own default rather than to zero, so compose({})
     * stays identical to defaults(). */
    SCENARIO.forEach(function (k) {
      out[k] = clampTo(k, opts[k] === undefined ? out[k] : +opts[k] || 0);
    });
    return out;
  }

  /* Derived, so the ordering test exercises the maturity axis for real. */
  var PRESETS = {
    tight:     compose({ maturity: 'tight' }),
    typical:   compose({ maturity: 'typical' }),
    sprawling: compose({ maturity: 'loose' }),
  };

  function defaults() {
    var P = {};
    SPEC.def.concat(SPEC.att, SPEC.idn).forEach(function (s) { P[s.k] = s.v; });
    return P;
  }
  /* One frozen copy for code that wants a slider's declared default without
   * allocating a whole parameter set to read one field off it. */
  var SPEC_DEFAULT = defaults();

  /* ═══════════════════════════════════════════════════════════════════════
   * AI COUPLINGS — identity at ai=0 (the measured clock).
   * ═══════════════════════════════════════════════════════════════════════ */
  /* Three independent scenario dials, each named for the mechanism it drives.
   * They were one slider called 'AI' until measuring them apart showed that the
   * one the slider was named after does the least work. Isolated, at full
   * travel, at the same convention as above: the clock is worth +3.8pt of
   * compromise, weaponised share +10.3pt, pre-disclosure share +1.9pt (measured
   * by neutering the other coupling to the identity, which leaves the RNG
   * sequence untouched). `weap` carries the last two together, because
   * both are the same claim — that more bugs acquire working exploit code, and
   * sooner relative to disclosure — and no evidence separates them. A reader
   * watching one curve attributed the whole 15pt to speed. */
  function clockScale(ai)  { return Math.exp(-0.023 * ai); }       /* ai=100    -> x0.10 */
  function weapMult(weap)  { return 1 + 0.010 * weap; }            /* weap=100  -> x2.0  */
  function preMult(weap)   { return 1 + 0.012 * weap; }            /* weap=100  -> x2.2  */
  /* Discovery scales the published stream against a fixed stack. Full travel is
   * x3, which is deliberately short of what the CVE series has already done to
   * itself — total publication grew 1.8x year over year in the vendored
   * snapshot — because this dial is asking a narrower question than that growth
   * answers: how much of the increase lands on software THIS reader operates,
   * not how much is published worldwide. */
  function discMult(d)     { return 1 + 0.020 * (d || 0); }        /* disc=100  -> x3.0  */
  /* Post-exploitation tempo. Scales BOTH containment clocks together, because
   * an adversary that reaches lateral movement faster reaches the objective
   * faster by the same capability — decoupling them would let a reader build an
   * adversary that breaks out in seconds and then waits a week. */
  function tempoScale(t)   { return Math.exp(-0.023 * t); }        /* tempo=100 -> x0.10 */

  /* ═══════════════════════════════════════════════════════════════════════
   * RNG — mulberry32. Deterministic, seedable, fast.
   * ═══════════════════════════════════════════════════════════════════════ */
  function RNG(seed) {
    var s = seed >>> 0;
    function rnd() {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    rnd.norm = function () {
      var u = 0, v = 0;
      while (u === 0) u = rnd();
      while (v === 0) v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    rnd.lnorm = function (m, sig) { return m * Math.exp(sig * rnd.norm()); };
    rnd.expo = function (mean) { return -mean * Math.log(1 - rnd()); };
    rnd.range = function (lo, hi) { return lo + (hi - lo) * rnd(); };
    rnd.pois = function (l) {
      if (l <= 0) return 0;
      if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * rnd.norm()));
      var L = Math.exp(-l), k = 0, p = 1;
      do { k++; p *= rnd(); } while (p > L);
      return k - 1;
    };
    /* The `n * p < 12` fast path used to run for ANY p, substituting a Poisson
     * where a Poisson is only valid for small p. This sampler is called with
     * p = 0.7 (the share of reached systems a campaign actually touches),
     * p ~ 0.35 (exploitWorks) and p up to 0.9 (affected fraction of an
     * appliance tier), so the approximation ran squarely outside its range on
     * every small estate:
     *
     *   binom(1, 0.9)  mean 0.60 against a true 0.90, P(0) 0.40 against 0.10
     *   binom(3, 0.7)  mean 1.85 against a true 2.10, P(0) 0.12 against 0.03
     *
     * Three such draws compound per vulnerability, all in the same direction,
     * so compromise was understated by 0.3pt on the smallest exposure rung and
     * 3.0pt on the largest. Small n is now exact — the loop is cheaper than the
     * two approximations it replaces at these sizes — and the approximations
     * are kept only where they are actually valid. */
    rnd.binom = function (n, p) {
      if (p <= 0 || n <= 0) return 0;
      if (p >= 1) return n;
      if (n <= 32) { var c = 0; for (var i = 0; i < n; i++) if (rnd() < p) c++; return c; }
      if (n * p >= 9 && n * (1 - p) >= 9) {
        return Math.min(n, Math.max(0, Math.round(n * p + Math.sqrt(n * p * (1 - p)) * rnd.norm())));
      }
      /* n > 32 with n*p < 9 puts p under 0.28, which is where a Poisson
       * genuinely approximates a binomial; the mirrored branch does the same
       * for p near 1. */
      if (n * p < 9) return Math.min(n, rnd.pois(n * p));
      return Math.max(0, n - Math.min(n, rnd.pois(n * (1 - p))));
    };
    return rnd;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ATTACKER CLOCK — inverse-CDF sampler over the measured PoC distribution.
   * t < 0 means a working exploit existed before the patch did.
   * ═══════════════════════════════════════════════════════════════════════ */
  function drawPoCTime(rnd, k) {
    var u = rnd();
    if (u < k.pBefore) {
      /* pre-publication branch: shape assumed, magnitude from ASSUMED.preMedian */
      var q = u / k.pBefore;                       /* uniform within the branch  */
      return -k.preMedian * Math.exp(SHAPE.sigPre * inverseNormal(q));
    }
    /* post-publication branch: piecewise-linear through the measured quantiles,
     * then an exponential tail past p75. */
    var t;
    var pw = k.pWithinWeek, p75 = 0.75;
    if (u < k.pMedian) {
      t = lerp(u, k.pBefore, k.pMedian, 0, k.median);
    } else if (u < pw) {
      t = lerp(u, k.pMedian, pw, k.median, 7);
    } else if (u < p75) {
      t = lerp(u, pw, p75, 7, k.p75);
    } else {
      /* exponential tail: mean chosen so p95 lands near one year */
      t = k.p75 + rnd.expo((365 - k.p75) / Math.log(1 / SHAPE.tailQuantile));
    }
    return t * k.scale;
  }
  /* When the fix actually lands, given applicability was established at `aware`.
   *
   * The routine cycle is ALWAYS drawn, and an escalation competes with it
   * rather than replacing it. The old form was an either/or: with probability
   * `emergHit` the vulnerability took the out-of-band path and the routine
   * window it was already in stopped existing. That made the slider
   * non-monotone and inverted its meaning past your own cadence — an estate
   * whose emergency path took ten days came out WORSE than one with no
   * emergency path at all (40.6% against 39.3%), because six in ten urgent
   * vulnerabilities were pulled out of a seven-day routine window and put into
   * a ten-day escalation.
   *
   * No change process behaves that way. Escalating a fix does not withdraw it
   * from the next scheduled window; it adds a second, usually faster, route to
   * the same outcome. Taking the earlier of the two makes the control monotone
   * and makes "out-of-band remediation time" mean what its label says.
   *
   * Both draws happen on every vulnerability whether or not the escalation
   * fires, so the random stream does not depend on the branch taken.
   * Extracted from the trial loop because `densities()` has to agree with it
   * exactly — the two copies had already drifted once. */
  function remediate(rnd, P, aware, isEdge) {
    var routine = aware + rnd() * P.cadence * (isEdge ? SHAPE.edgeCadence : 1)
                + rnd.lnorm(SHAPE.medChange, SHAPE.sigCadence);
    var emerg = aware + (P.emergH / 24) * Math.exp(SHAPE.sigEmerg * rnd.norm())
              * (isEdge ? SHAPE.edgeEmerg : 1);
    var escalated = rnd() < (P.emergHit / 100) * (isEdge ? SHAPE.edgeEmergHit : 1);
    return (P.emergH > 0 && escalated) ? Math.min(routine, emerg) : routine;
  }

  /* Appliance exploitation runs ahead of the field, applied to a SIGNED time.
   * `tX` is negative when the exploit predates publication, so the bare
   * `tX *= 0.6` this replaces moved pre-publication draws TOWARD publication —
   * appliances got a 6.6-day mean zero-day lead against 10.9 days for ordinary
   * software, the reverse of the intent and of the asset class the rest of the
   * model treats as the most heavily targeted. Scale the MAGNITUDE toward
   * earlier on both sides of zero: a post-publication exploit arrives sooner,
   * a pre-publication one arrives further ahead. */
  function edgeLead(tX, f) { return tX > 0 ? tX * f : tX / f; }

  function lerp(u, u0, u1, t0, t1) {
    if (u1 <= u0) return t1;
    return t0 + ((u - u0) / (u1 - u0)) * (t1 - t0);
  }
  /* Acklam-style rational approximation to the normal quantile function. */
  function inverseNormal(p) {
    if (p <= 0) p = 1e-9;
    if (p >= 1) p = 1 - 1e-9;
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
    var pl = 0.02425, q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - pl) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /* Draw one coefficient across its declared range with the MEAN PINNED to the
   * central value.
   *
   * This used to be `rnd.range(lo, hi)` — a flat uniform — and 21 of the 23
   * declared ranges are asymmetric, most of them because the quantity is
   * roughly lognormal and the upper bound sits much further from the centre
   * than the lower one. A uniform draw over such a range has expectation
   * (lo+hi)/2, not `v`, so the DEFAULT run was not the calibrated model:
   *
   *   breakoutMedian   cited 29-min average   ->  drawn mean gave 45 min
   *   blindMult        cited "measured 2.6x"  ->  drawn mean gave 3.4x
   *   objectiveMedian  cited 5-day median     ->  drawn mean gave 7 days
   *   wafLagH          central 18 h           ->  drawn mean gave 50 h
   *
   * Every coefficient carrying a citation was honoured only at spread 0, while
   * the headline and the README's own recipe run at spread 1. Widening a range
   * for honesty about uncertainty had quietly moved the central estimate off
   * the evidence it was calibrated to.
   *
   * The fix keeps the declared support exactly as written and splits it at `v`:
   * the lower arm is chosen with probability (hi-v)/(hi-lo), which is precisely
   * the weight that makes E[draw] = v. Written as an inverse CDF so it still
   * costs ONE random draw per coefficient, and the split weight is invariant
   * under `spread`, so the mean sits on `v` at every setting rather than only
   * at zero. Shape inside each arm stays uniform: the ranges are declared as
   * bounds, not as distributions, and inventing curvature inside them would be
   * false precision of a different kind. */
  function drawAsym(rnd, a, spread) {
    var lo = a.v + (a.lo - a.v) * spread;
    var hi = a.v + (a.hi - a.v) * spread;
    var w = hi - lo;
    if (!(w > 0)) return a.v;
    var pLo = (hi - a.v) / w;
    var u = rnd();
    if (pLo <= 0) return a.v + (hi - a.v) * u;
    if (pLo >= 1) return lo + (a.v - lo) * u;
    return u < pLo ? lo + (a.v - lo) * (u / pLo)
                   : a.v + (hi - a.v) * ((u - pLo) / (1 - pLo));
  }

  /* Draw one coefficient set. `spread` 0 pins every assumption at its central
   * value (reproducible point estimate); 1 draws the full declared range. */
  function drawCoeffs(rnd, P, spread) {
    var k = {};
    Object.keys(ASSUMED).forEach(function (key) {
      var a = ASSUMED[key];
      k[key] = spread <= 0 ? a.v : drawAsym(rnd, a, spread);
    });
    /* `weap` defaults to whatever `ai` is when it has not been set at all, so a
     * link shared before the split — which carried one `ai=N` meaning all three
     * effects at once — still resolves to the estate its author saw. */
    var ai = P.ai, weap = P.weap === undefined ? P.ai : P.weap;
    k.vulnRate    = P.stackVulns * discMult(P.discovery);
    k.scale       = clockScale(ai);
    k.pPoC        = Math.min(0.9, MEASURED.pPoC * weapMult(weap));
    /* Scaled together, so their ratio — and with it the measured 81.2%
     * PoC-first share the calibration test checks — survives the draw. */
    k.pWildGivenPoC = Math.min(1, MEASURED.pWildGivenPoC * k.wildRate);
    k.pWildNoPoC  = Math.min(1, MEASURED.pWildNoPoC * k.wildRate);
    k.pBefore     = Math.min(0.75, MEASURED.pocBefore * preMult(weap));
    k.median      = MEASURED.pocMedian;
    k.pWithinWeek = MEASURED.pocWithinWeek;
    k.p75         = k.pocP75;
    /* measured quantile positions, shifted by the pre-publication mass */
    k.pMedian     = 0.5;
    /* The inverse-CDF sampler walks these knots in order and interpolates
     * between consecutive pairs, so they have to BE in order. They are, for
     * the current snapshot at every compression setting — pBefore tops out at
     * 0.47 against a median knot of 0.50. But pBefore is measured data times
     * a slider: the 2015 row of the same series reads 62.9%, and a snapshot
     * refresh that moved `latest` onto a year like that would put pBefore
     * past pMedian and have the post-publication branch extrapolate outside
     * its own segment. Clamping costs nothing today and keeps the sampler
     * honest against data that has not arrived yet. */
    k.pBefore     = Math.min(k.pBefore, k.pMedian);
    k.pWithinWeek = Math.min(Math.max(k.pWithinWeek, k.pMedian), 0.75);
    k.scanHaz     = k.scanHazBase * Math.exp(0.030 * (P.scan - 50));
    /* Post-exploitation tempo compresses both containment clocks after they are
     * drawn, so the scenario scales the uncertainty band rather than replacing
     * it: a faster adversary is still an adversary with a spread of speeds. */
    var tScale    = tempoScale(P.tempo || 0);
    k.breakoutMedian  *= tScale;
    k.objectiveMedian *= tScale;
    return k;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * SIMULATE
   * ═══════════════════════════════════════════════════════════════════════ */
  /* Derived from ACCESS rather than restated, so a class cannot exist in the
   * declaration table and be missing from the tally, or vice versa. The order
   * here is the order every route array in the result is in. */
  var ROUTES = Object.keys(ACCESS);
  /* Index of each route, in ROUTES and in the per-trial `route` tally below.
   * The three assignments to `firstRoute` were bare 0, 1 and 2 and the tally
   * was a literal [0, 0, 0], so ROUTES named three columns without being
   * connected to any of them — documentation that reordering the list would
   * have silently falsified, and the only export in this file that nothing
   * inside it read. Derived here, so the list is now the one definition of
   * both the names and the order. */
  var R = {};
  ROUTES.forEach(function (name, i) { R[name] = i; });
  /* A strict funnel: every stage is a subset of the one above it.
   * Whether a vulnerability is merely armed (public exploit) or actually used
   * in the wild is NOT a funnel stage — it is a hazard multiplier, because
   * armed-but-unused bugs still draw opportunistic traffic. It is reported
   * separately as `wildShare`. */
  /* Stage 2 was 'Public exploit code exists', which is not the gate below it:
   * the trial loop passes a vulnerability that is EITHER publicly armed or
   * confirmed exploited without public code first, and the second of those is
   * about 0.6% of the stream. A small mislabel, but the funnel is the one place
   * a reader can check the model's arithmetic against its own claims, so a
   * stage has to name the set it counts. */
  var FUNNEL = [
    'Criticals published in your stack',
    'In a vulnerable version or configuration',
    'A working exploit exists',
    'Unremediated when exploit code lands',
    'A campaign reaches your estate',
    'Exploitation succeeds',
  ];

  /* A run, suspendable between trials.
   *
   * The trial loop is the one genuinely expensive thing this file does: 60,000
   * trials is about 92ms, which is roughly twice the budget a main thread has
   * if it means to stay responsive to input. Exposing the loop as something a
   * caller can advance in pieces lets the page spend that cost in slices
   * without holding the frame.
   *
   * Splitting it changes nothing about the result. Every accumulator and the
   * RNG itself live in this closure, so a run advanced 10,000 at a time visits
   * exactly the trials, in exactly the order, with exactly the coefficient
   * draws, that one advanced all at once would — including the block flushes
   * the credible interval is built from. `simulate` below is the whole-run
   * case and remains the API everything except the settle pass uses. */
  /* Block count for a given trial count. Hoisted out of createRun and exported
   * because the method note in the footer states it, and a number typed into
   * copy drifts from the model the first time either moves: that note said
   * "150 blocks" for as long as it took somebody to read both. */
  function blocksFor(trials) {
    return trials >= 6000 ? 650 : Math.max(10, Math.floor(trials / 40));
  }

  function createRun(P, trials, seed, opts) {
    opts = opts || {};
    var wantSurv = opts.surv !== false;
    var spread = opts.spread === undefined ? 1 : opts.spread;
    var rnd = RNG(seed);

    var surv = new Float64Array(H + 2);
    /* Day each trial stopped surviving; H+1 means it never did. surv[] is the
     * suffix sum of this, taken once after the loop. */
    var stopAt = new Int32Array(H + 2);
    var hit = 0, inc = 0, events = 0;
    var firsts = [];
    var route = ROUTES.map(function () { return 0; });
    var fn = [0, 0, 0, 0, 0, 0];
    var wildN = 0, armedN = 0;
    /* Credible interval by variance decomposition.
     *
     * Trials are grouped into blocks and ONE coefficient set is drawn per block,
     * so the spread between block means contains both parameter uncertainty and
     * Monte-Carlo noise. Subtracting the known binomial noise leaves the part
     * that is actually about the assumptions — which is the only part worth
     * reporting. Drawing per-trial instead (the obvious approach) makes the two
     * inseparable and the band ends up measuring the trial count.
     *
     * Block COUNT matters as much as the decomposition. A variance estimated
     * from B blocks carries a relative error of about sqrt(2/(B-1)), so at 40
     * blocks the reported width wandered by a third between runs and did not
     * settle as trials rose. At 650 it is stable in trial count (measured:
     * 11.6 / 11.4 / 11.7 % at 40k / 80k / 160k). Do not lower this without
     * re-running the stability test. */
    /* Raised from 150 when five coefficients joined ASSUMED — `wildRate` and
     * the four structural constants that used to be literals in this loop.
     *
     * Every drawn coefficient adds between-block variance, and the relative
     * error of a variance estimated from B blocks is ~sqrt(2/(B-1)), so a wider
     * band needs MORE blocks to report a stable width. Measured across eight
     * seeds on the ~23pt band those coefficients produce: 150 blocks swung the
     * reported width by 3.7pt, 250 by 3.7pt, 500 by 3.5pt, 650 by 1.9pt. Above
     * that it degrades again from the other end — at 800 blocks the 30,000-trial
     * case is down to 37 trials per block and the binomial term subtracted from
     * the variance is itself too noisy to subtract.
     *
     * Do not change this without re-running test 11 across the full seed list. */
    var BLOCKS = blocksFor(trials);
    var blockN = Math.max(1, Math.floor(trials / BLOCKS)), blockHits = [], blockInc = [];
    var bh = 0, bi = 0, bc = 0;
    var k = null;

    var nEdge = Math.round(P.exposed * P.edge / 100);
    var nWeb = P.exposed - nEdge;
    var invF = P.inventory / 100;
    var eKnown = Math.round(nEdge * invF), eDark = nEdge - eKnown;
    var wKnown = Math.round(nWeb * invF), wDark = nWeb - wKnown;

    var t = 0;
    /* Advance by `count` trials, or to the end when `count` is omitted. Returns
     * true once the run is complete.
     *
     * The parameter is `count` rather than `n` because `n` is the per-trial
     * compromise counter a few lines below, declared with `var` and therefore
     * the SAME binding as the parameter. It worked only because `end` was
     * computed before the loop overwrote it — a correct result standing on an
     * accident of statement order, which is the kind of thing that survives
     * review and then breaks the first time somebody reads the parameter
     * twice. */
    function advance(count) {
      var end = count > 0 ? Math.min(trials, t + count) : trials;
      for (; t < end; t++) {
        /* bc is 0 on the first trial and again after every block flush, which
         * is exactly when a fresh coefficient set is due. */
        if (bc === 0) k = drawCoeffs(rnd, P, spread);
        var first = Infinity, firstRoute = -1, firstEdge = false, incident = false;
        var n = 0, edSum = 0;

        /* The published stream against this stack, scaled by the discovery
         * dial. `stackVulns` says how much software you run; `discovery` says
         * how fast bugs are found in it. */
        var K = rnd.pois(k.vulnRate);
        fn[0] += K;

        for (var i = 0; i < K; i++) {
          var isEdge = rnd() < P.edge / 100;

          /* 1. is the version and configuration you run actually vulnerable?
           *    NOT "do you run it at all" — `stackVulns` has already said so. */
          if (rnd() >= (isEdge ? k.runsEdge : k.runsWeb)) continue;
          fn[1]++;

          /* 2. does a working exploit ever exist, and is it used for real?
           *    These are not sequential gates: a bug can be used in the wild with
           *    no public PoC, and a public PoC can go unused. Either one arms it. */
          var hasPoC = rnd() < k.pPoC;
          var inWild = rnd() < (hasPoC ? k.pWildGivenPoC : k.pWildNoPoC);
          if (!hasPoC && !inWild) continue;
          fn[2]++;
          armedN++;
          if (inWild) wildN++;

          /* 3. when does the exploit exist, relative to the patch? */
          var tX = hasPoC ? drawPoCTime(rnd, k)
                          : -k.preMedian * Math.exp(SHAPE.sigPre * inverseNormal(rnd()));
          if (isEdge) tX = edgeLead(tX, k.edgeLeadF); /* ahead on BOTH sides of zero */

          /* 4. how much of your estate does it touch? */
          var af = isEdge
            ? k.afEdgeMin + (SHAPE.afEdgeMax - k.afEdgeMin) * rnd()
            : SHAPE.afWebMin + (k.afWebMax - SHAPE.afWebMin) * rnd() * rnd();
          var popKnown = isEdge ? eKnown : wKnown;
          var popDark = isEdge ? eDark : wDark;
          var nKnown = rnd.binom(popKnown, af);
          var nDark = rnd.binom(popDark, af);
          if (nKnown + nDark < 1) continue;

          /* 5. when have you closed it? */
          var aware = rnd.lnorm(P.awareH / 24, SHAPE.sigAware) * (isEdge ? SHAPE.edgeAware : 1);
          var tp = remediate(rnd, P, aware, isEdge);
          var shielded = !isEdge && rnd() < P.virtual / 100;

          /* A shielded system is exposed from the moment the exploit exists
           * until the rule is enforceable, or until the permanent fix lands,
           * whichever comes first. At wafLagH = 0 this is the old behaviour;
           * it is not zero, because a rule written against a vulnerability
           * cannot predate the vulnerability being published. */
          var win = shielded
            ? Math.max(0, Math.min(tp, k.wafLagH / 24) - tX)
            : Math.max(0, tp - tX);
          /* Stage 3 is decided AFTER the out-of-inventory window below, not
           * here. This read `if (win > 0) fn[3]++` — the in-inventory window
           * alone — while stage 4 is reached through EITHER population. Systems
           * in no remediation cycle are by construction the most unremediated
           * part of the estate, so counting stage 4 through them and stage 3
           * without them made the funnel report a subset larger than its own
           * superset. At 80% virtual patching against a 20% inventory gap the
           * chart drew "a campaign reaches your estate" ten times wider than
           * "unremediated when exploit code lands" and printed the drop between
           * them as "−-962%". Roughly a quarter of the parameter space inverted
           * it; the two sliders that do it are ordinary settings, not extremes. */
          var openWindow = win > 0;
          edSum += Math.min(win, H) * nKnown;

          /* 6. does a campaign reach you inside that window? */
          var hazMul = Math.exp(SHAPE.sigHaz * rnd.norm()) * (isEdge ? k.edgeHazard : 1)
                     * (inWild ? 1 : k.pocOnlyHazard);
          var landed = false, won = false;

          var reach = function (cnt, wTotal, tStart) {
            if (cnt < 1 || wTotal <= 0) return null;
            var h = k.scanHaz * hazMul * Math.pow(cnt, k.crowdExp);
            /* pre-publication time is targeted, not mass: discount it */
            var pre = Math.max(0, Math.min(0, tStart + wTotal) - Math.min(0, tStart));
            var eff = Math.min(wTotal, H) - pre * (1 - k.preHazard);
            if (eff <= 0) return null;
            var pArr = 1 - Math.exp(-h * eff);
            if (rnd() >= pArr) return null;
            /* Arrival time is already CONDITIONED on the campaign landing
             * inside the window, so it is a truncated exponential, not an
             * unconditional one clipped at the end. The old
             * `Math.min(wTotal, rnd.expo(1/h))` put a point mass of
             * exp(-h*wTotal) exactly on the window boundary and drew against
             * the calendar length rather than the hazard-weighted one. It does
             * not move the compromise probability — arrival was already
             * decided above — but it dates every compromise it does produce,
             * and so shapes the survival curve and the median time to first
             * compromise the page reports off it. */
            return { c: Math.max(1, rnd.binom(cnt, k.reachShare)),
                     t: -Math.log(1 - rnd() * pArr) / h };
          };
          var land = function (r, when0) {
            var c = rnd.binom(r.c, k.exploitWorks);
            if (c < 1) return false;
            var when = when0 + Math.max(0, tX) + r.t;
            /* `n` and the funnel's last stage are per-YEAR figures, so a
             * compromise dated past the horizon belongs to neither. `n += c`
             * used to run before this check: a vulnerability published on day
             * 350 whose exploit landed 30 days later was excluded from the
             * compromise probability and included in the headline count, so
             * roughly 5% of the systems in "per year" fell outside the year. */
            if (when >= H) return false;
            n += c;
            if (when < first) { first = when; firstRoute = R.opportunistic; firstEdge = isEdge; }
            return true;
          };

          var day0 = rnd() * H;
          var rK = reach(nKnown, win, tX);
          if (rK) { landed = true; if (land(rK, day0)) won = true; }

          if (nDark > 0) {
            /* systems in no patch cycle: fixed on rebuild, or not at all */
            var tpDark = rnd() < SHAPE.darkRebuildP
              ? aware + rnd() * SHAPE.darkRebuild + rnd.lnorm(SHAPE.medChange, SHAPE.sigCadence)
              : aware + rnd.expo(SHAPE.darkNever);
            var winDark = Math.max(0, tpDark - tX);
            if (winDark > 0) openWindow = true;
            edSum += Math.min(winDark, H) * nDark;
            var rD = reach(nDark, winDark, tX);
            if (rD) { landed = true; if (land(rD, day0)) won = true; }
          }
          /* `reach` returns null for a window of zero, so `landed` implies
           * `openWindow` by construction: the funnel cannot invert here again
           * without one of those two returns changing. */
          if (openWindow) fn[3]++;
          if (landed) fn[4]++;
          if (won) fn[5]++;
        }

        /* Targeted campaigns: succeed more often when a window happens to be
         * open. `edSum` is a SUM of exposure system-days over every
         * vulnerability, so two open windows covering the same systems at the
         * same time each contribute in full — it is an expected count of
         * concurrent windows, not a probability, and it was being used
         * directly as one under a clamp at 1.
         *
         * That clamp was load-bearing in the wrong direction. On a sprawling
         * estate the raw ratio reaches 2.96 and clamps in 99.3% of trials,
         * which pins `pWin` to `windowSuccess` and makes `agentSkill` inert:
         * across its entire 0-60% range it moved the targeted route by 0.09pt
         * there, against 88.9pt on the baseline estate. `agentSkill` is this
         * model's ONLY representation of phishing, credential abuse and
         * insider action — the routes SCOPE names as the reason every number
         * here is a lower bound — so it went dead precisely on the estates
         * carrying the most risk.
         *
         * Converting the count to the probability that at least one window is
         * open, under the same independence the rest of the arrival model
         * assumes, both fixes the saturation and removes an overstatement that
         * peaked at 37 points around a raw ratio of 1. */
        var openFrac = 1 - Math.exp(-edSum / (H * Math.max(1, P.exposed)));
        var pWin = openFrac * k.windowSuccess + (1 - openFrac) * (P.agentSkill / 100);
        var nC = rnd.pois(P.campaigns);
        for (var ci = 0; ci < nC; ci++) {
          if (rnd() < pWin) {
            n++;
            var wc = rnd() * H;
            if (wc < first) { first = wc; firstRoute = R.targeted; firstEdge = rnd() < P.edge / 100; }
          }
        }
        /* supply chain: patch cadence is irrelevant */
        var nS = rnd.pois(P.supply);
        for (var si = 0; si < nS; si++) {
          n++;
          var ws = rnd() * H;
          if (ws < first) { first = ws; firstRoute = R.supply; firstEdge = false; }
        }

        /* ── the non-vulnerability classes ───────────────────────────────
         *
         * Each is an independent Poisson arrival over the year with its own
         * gate, drawn on the same coefficient block as everything above so
         * they widen the credible interval rather than sitting outside it.
         *
         * They are deliberately NOT routed through the vulnerability engine:
         * there is no window to open, no cadence to close it and no exploit
         * clock to race, which is exactly why the first three routes could
         * never represent them. `firstEdge` is false throughout — an
         * appliance has no user to phish and no credential of its own — so
         * these compromises are contained on the ordinary telemetry path.
         *
         * A note on independence: these are drawn independently of each other
         * and of the vulnerability routes, which understates concentration.
         * An organisation with weak authentication usually also patches late,
         * so real estates cluster at both ends more than this model does. The
         * correlation is real, no public figure quantifies it, and inventing
         * one would put a fabricated coefficient in front of every result.
         * Declared in SCOPE.routeIndependence rather than left implicit. */
        var fire = function (rate, pSuccess, routeIdx) {
          if (!(rate > 0) || !(pSuccess > 0)) return;
          var cnt = rnd.pois(rate);
          for (var q = 0; q < cnt; q++) {
            if (rnd() >= pSuccess) continue;
            n++;
            var w = rnd() * H;
            if (w < first) { first = w; firstRoute = routeIdx; firstEdge = false; }
          }
        };
        var heads = Math.max(0, P.staff);
        var eff = function (control, ceiling) { return 1 - (control / 100) * ceiling; };

        /* Phishing. Awareness thins the arrivals; authentication blocks the
         * conversion. Two different stages, which is why a programme strong on
         * one and weak on the other does not average out. */
        fire(heads * k.phishLure * eff(P.awareness, k.phishAwareEff),
             k.phishConv * eff(P.mfa, k.phishMfaEff), R.phishing);

        /* Credential abuse. Arrival is exposure elsewhere, so nothing the
         * estate does reduces it — only what the credential reaches once
         * used. Both gates act on conversion, hence the product. */
        fire(heads * k.credExposure,
             k.credConv * eff(P.mfa, k.credMfaEff) * eff(P.pam, k.credPamEff),
             R.credential);

        /* Misconfiguration. The one new class that scales with systems rather
         * than people, and the only route in the model where remediation
         * cadence is irrelevant by construction rather than by assumption. */
        fire(P.exposed * k.misconfigRate * eff(P.configAssurance, k.configEff),
             k.misconfigConv, R.misconfig);

        fire(heads * k.insiderRate, eff(P.insiderCtl, k.insiderEff), R.insider);
        fire(heads * k.deviceLoss, eff(P.deviceCtl, k.deviceEff), R.physical);

        events += n;

        var compromised = first < H;
        if (compromised) {
          hit++;
          firsts.push(first);
          route[firstRoute]++;             /* once per trial — not once per improvement */
          incident = !contained(rnd, P, k, firstEdge);
          if (incident) inc++;
        }
        if (wantSurv) {
          /* Record only WHERE this trial leaves the survivor set. Incrementing
           * every day it survived cost 365 writes per trial — 21.9M at 60k
           * trials — to build a suffix sum that one pass at the end produces
           * exactly, and measurably faster. */
          stopAt[compromised ? Math.ceil(first) : H + 1]++;
        }

        bh += compromised ? 1 : 0; bi += incident ? 1 : 0; bc++;
        if (bc === blockN) { blockHits.push(bh / bc); blockInc.push(bi / bc); bh = 0; bi = 0; bc = 0; }
      }
      return t >= trials;
    }

    /* Aggregate. Reads the accumulators without disturbing them, so it is
     * safe to call on a finished run more than once. */
    function result() {
      if (wantSurv) {
        /* surv[d] is the number of trials still uncompromised at the end of day
         * d — that is, those whose stop day is strictly greater than d. */
        var alive = trials;
        for (var sd = 0; sd <= H; sd++) { alive -= stopAt[sd]; surv[sd] = alive; }
      }

      firsts.sort(function (a, b) { return a - b; });
      var pHit = hit / trials, pInc = inc / trials;
      var ciH = decompose(blockHits, pHit, blockN), ciI = decompose(blockInc, pInc, blockN);
      var totalRoute = route.reduce(function (a, b) { return a + b; }, 0) || 1;
      var medIdx = Math.floor(trials * 0.5);

      return {
        p: pHit, pLo: ciH[0], pHi: ciH[1],
        incident: pInc, incLo: ciI[0], incHi: ciI[1],
        /* Median across ALL trials, with the uncompromised years sorted past
         * the end — so the index is into the trial count, not into `firsts`.
         * Bounds-checked rather than gated on pHit >= 0.5: with exactly half
         * the trials compromised the index is one past the last element, and
         * the old form returned `undefined` there rather than null, leaking a
         * third value out of a documented number-or-null field. */
        med: medIdx < firsts.length ? firsts[medIdx] : null,
        events: events / trials,
        surv: Array.prototype.slice.call(surv, 0, H + 1).map(function (v) { return v / trials; }),
        routes: route.map(function (v) { return v / totalRoute; }),
        routeN: route.slice(),
        fn: fn.map(function (v) { return v / trials; }),
        armed: armedN / trials,
        wild: wildN / trials,
        wildShare: armedN ? wildN / armedN : 0,
        /* `expDays` and `se` were reported here and read by nothing — not the
         * page, not the charts, not the tests. `expDays` also carried its own
         * per-trial accumulator. The credible band from decompose() supersedes
         * the standard error, and exposure-days never had a caller at all. An
         * export is an API commitment; these two were commitments to nobody,
         * which is the same argument that retired CAL and fmtH below. */
        trials: trials,
        /* the interval needs enough blocks AND enough trials per block to mean
         * anything; below this the caller should keep showing the last good one */
        bandReliable: trials >= 30000,
      };
    }

    return {
      advance: advance,
      done: function () { return t >= trials; },
      result: result,
    };
  }

  /* The whole run, in one call — the original signature, unchanged. */
  function simulate(P, trials, seed, opts) {
    var run = createRun(P, trials, seed, opts);
    run.advance();
    return run.result();
  }

  /* Two-stage containment: beat breakout, or beat the objective, or neither.
   * Detection speed is not uniform across the estate. Edge appliances take no
   * endpoint agent at all, and part of the rest is off-telemetry too. A
   * compromise you cannot see is not detected on your median dwell — it is
   * found much later, usually by somebody else. */
  function contained(rnd, P, k, isEdge) {
    /* The fallback is the slider's own default rather than a literal restating
     * it. A hand-copied 70 here would have gone on reporting containment
     * against a coverage figure the control no longer offered. */
    var cov = P.edrCoverage === undefined ? SPEC_DEFAULT.edrCoverage : P.edrCoverage;
    /* Both rolls are taken unconditionally and combined afterwards, rather than
     * short-circuited. `contained()` then consumes a FIXED number of draws
     * whatever the estate looks like, which is what keeps the compromise rate
     * bit-identical across detection posture — the property SCOPE declares and
     * the suite checks. Short-circuiting either one makes the stream depend on
     * coverage, and every trial after the first compromise drifts. */
    var covRoll = rnd() < cov / 100;
    var covered = !isEdge && covRoll;
    /* Three clocks, not two. A covered system can be met by automated response
     * on machine time, by an analyst on the dwell clock, or — off telemetry —
     * by somebody else entirely. Only the first can beat breakout; see
     * ASSUMED.autoContain for why the branch existed with nothing able to
     * reach it. Appliances take no agent, so they take no automated path. */
    var autoRoll = rnd() < k.autoContain;
    var auto = covered && autoRoll;
    var tD = auto    ? rnd.lnorm(k.autoRespond, SHAPE.sigAuto)
           : covered ? rnd.lnorm(P.detect, SHAPE.sigDetectOn)
                     : rnd.lnorm(P.detect * k.blindMult, SHAPE.sigDetectOff);
    var tB = rnd.lnorm(k.breakoutMedian, SHAPE.sigBreakout);
    var tO = rnd.lnorm(k.objectiveMedian, SHAPE.sigObjective);
    if (tD < tB) return rnd() < k.containFast;
    if (tD < tO) return rnd() < k.containMid;
    return rnd() < k.containLate;
  }

  /* Split the observed between-block variance into Monte-Carlo noise and
   * genuine parameter uncertainty, and report only the latter as the band. */
  function decompose(blocks, mean, blockN) {
    if (blocks.length < 4) return [mean, mean];
    var n = blocks.length, sum = 0;
    for (var i = 0; i < n; i++) { var d = blocks[i] - mean; sum += d * d; }
    var observed = sum / (n - 1);
    var mc = (mean * (1 - mean)) / Math.max(1, blockN);   /* binomial, per block */
    var param = Math.max(0, observed - mc);
    var half = 1.645 * Math.sqrt(param);
    return [Math.max(0, mean - half), Math.min(1, mean + half)];
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * RACE DENSITIES — for the headline chart. Clamped, so no mass is lost.
   * ═══════════════════════════════════════════════════════════════════════ */
  function densities(P, N) {
    N = N || 30000;
    var rnd = RNG(7);
    var k = drawCoeffs(rnd, P, 0);
    var x0 = -30;
    var x1 = Math.max(24, Math.min(120, P.cadence * 1.7 * (1 + P.edge / 160) + P.emergH / 24 + P.awareH / 24 + 8));
    /* These bins are sized for drawing a shape, not for reading a quantile off
     * it. x0 is pinned at -30 and x1 floors at 24, so the narrowest bin this
     * function can produce anywhere in the parameter space is 54/160 = 0.34d.
     * That is coarser than the median it would be measuring under heavy
     * compression: at ai=100 the modelled median is around 0.31d, so the whole
     * quantity sits inside a single bin and no readout of `cum` can resolve
     * it — interpolating within the crossing bin does not rescue it either,
     * since that assumes a uniform density across the very interval in
     * question. If a modelled median is ever wanted on the page, bin
     * adaptively or sample it directly; do NOT read it off `cum`, and do not
     * compute it as the measured median times `scale` (that product is never
     * exact — the pre-publication branch is unscaled and its mass grows with
     * ai independently, so it drifts several percent and is not a figure any
     * run of this model produces). */
    var B = 160, dx = (x1 - x0) / B;
    var A = new Float64Array(B), D = new Float64Array(B);
    var before = 0, wins = 0;
    /* Mass outside the drawn range is counted, never discarded (that was a v2
     * bug), but it is also NOT folded into the edge bins — doing that creates a
     * fake spike that dominates the normalisation and flattens the real shape.
     * It is reported separately so the chart can label it honestly. */
    var aBelow = 0, aAbove = 0, dAbove = 0;

    for (var i = 0; i < N; i++) {
      var isEdge = rnd() < P.edge / 100;
      var tX = isEdge ? edgeLead(drawPoCTime(rnd, k), k.edgeLeadF) : drawPoCTime(rnd, k);
      if (tX < 0) before++;
      if (tX < x0) aBelow++;
      else if (tX >= x1) aAbove++;
      else A[Math.floor((tX - x0) / dx)]++;

      var aware = rnd.lnorm(P.awareH / 24, SHAPE.sigAware) * (isEdge ? SHAPE.edgeAware : 1);
      var tp = remediate(rnd, P, aware, isEdge);
      if (tp >= x1) dAbove++;
      else D[Math.max(0, Math.floor((tp - x0) / dx))]++;

      if (tX < tp) wins++;
    }

    /* CDF of the exploit clock, including the mass below the drawn range */
    var F = new Float64Array(B), c = aBelow / N;
    for (var j = 0; j < B; j++) { c += A[j] / N; F[j] = c; }
    var ov = new Float64Array(B);
    for (var m = 0; m < B; m++) ov[m] = (D[m] / N) * F[m];

    var nz = function (v) {
      var mx = 0;
      for (var z = 0; z < v.length; z++) if (v[z] > mx) mx = v[z];
      return Array.prototype.map.call(v, function (x) { return mx ? x / mx : 0; });
    };
    var dmax = 0;
    for (var q = 0; q < B; q++) if (D[q] / N > dmax) dmax = D[q] / N;

    return {
      A: nz(A), D: nz(D), ov: Array.prototype.slice.call(ov), ovMax: dmax,
      /* cumulative share of exploits that have arrived by each bin, including
       * the mass below the drawn window. This is what the headline measures,
       * and it stays readable where the density does not. */
      cum: Array.prototype.slice.call(F),
      x0: x0, x1: x1, B: B, dx: dx,
      pLate: wins / N,          /* exact, by direct comparison — not a bin sum */
      beforeFrac: before / N,
      overflow: { aBelow: aBelow / N, aAbove: aAbove / N, dAbove: dAbove / N },
      median: k.median, scale: k.scale,
    };
  }

  return {
    /* `CAL: C` was here, re-exporting the whole calibration module through the
     * model. Nothing ever read it: the page takes CALIBRATION off the global
     * directly and Node requires it directly, so this was a second name for a
     * module that already had one. `fmtH` went the same way — it formats the
     * two hour-valued sliders inside SPEC and has no caller outside this file.
     * An export is an API commitment; these two were commitments to nobody. */
    H: H, SPEC: SPEC, PRESETS: PRESETS, MEASURED: MEASURED, ASSUMED: ASSUMED, SHAPE: SHAPE,
    FUNNEL: FUNNEL, ROUTES: ROUTES,
    EXPOSURE: EXPOSURE, TRAITS: TRAITS, ATTENTION: ATTENTION,
    MATURITY: MATURITY, DETECTION: DETECTION, compose: compose,
    IDENTITY: IDENTITY, PEOPLE: PEOPLE, ACCESS: ACCESS,
    DEFAULT_IDENTITY: DEFAULT_IDENTITY, DEFAULT_PEOPLE: DEFAULT_PEOPLE,
    DEFAULT_EXPOSURE: DEFAULT_EXPOSURE, DEFAULT_ATTENTION: DEFAULT_ATTENTION,
    defaults: defaults, simulate: simulate, createRun: createRun, densities: densities,
    SCENARIO: SCENARIO, clampTo: clampTo,
    RNG: RNG, inverseNormal: inverseNormal,
    clockScale: clockScale, weapMult: weapMult, preMult: preMult,
    tempoScale: tempoScale, discMult: discMult, SCOPE: SCOPE,
    blocksFor: blocksFor,
    fmtN: fmtN,
  };
});
