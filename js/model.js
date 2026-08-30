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
    /* share of PoC'd criticals that reach the confirmed-exploited catalogue */
    pWildGivenPoC: C.inWild.pInWildGivenPoC / 100,
    /* share of criticals exploited in the wild with no public PoC first */
    pWildNoPoC: C.inWild.pInWildNoPoC / 100,
    /* attacker clock, days from CVE publication to public PoC */
    pocBefore: C.pocTiming.latest.pctBefore / 100,
    pocMedian: C.pocTiming.latest.medianDays,
    pocWithinWeek: C.pocTiming.latest.pctWithinWeek / 100,
  };

  /* ═══════════════════════════════════════════════════════════════════════
   * SCOPE — what this model counts, and what it does not.
   *
   * Declared here rather than written into the page copy, because it is a
   * property of the model and the page has to be able to state it next to the
   * headline instead of in a footnote. Three routes are simulated. The routes
   * that are not simulated are not small: vulnerability exploitation is the
   * largest single initial-access category in the DBIR series and still a
   * minority of breaches, so every probability this model reports is a lower
   * bound on intrusion risk and has to be read as one.
   *
   * `agentSkill` is the one place the excluded routes are represented at all,
   * as the residual success of a targeted campaign that finds no open
   * remediation window. It is a proxy, not a simulation of them.
   * ═══════════════════════════════════════════════════════════════════════ */
  var SCOPE = {
    modelled: [
      'Opportunistic exploitation of a published vulnerability',
      'Targeted campaign against the exposed estate',
      'Supply-chain compromise reaching your estate',
    ],
    excluded: [
      'Phishing and social engineering as a primary route',
      'Credential abuse and session theft',
      'Insider action',
    ],
    /* The same list as a noun phrase. The enumerated form is right for a
     * methodology note and unreadable inside a sentence, and the page needs it
     * inside a sentence — beside the headline, where it is actually read. */
    excludedShort: 'Phishing, credential abuse and insider action',
    /* Share of breaches attributed to vulnerability exploitation as the initial
     * access vector. `reported`, not `measured`: somebody else's population and
     * methodology, cited so the page's coverage claim has one source. */
    vulnShareOfBreaches: 0.31,
    src: 'Verizon DBIR 2026',
    proxy: 'agentSkill',
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
    pocP75:         { l: 'Days from publication to public exploit code (75th percentile)', v: 47.5, lo: 30,   hi: 90,   why: 'CyberMon hero series p75 for the current year; widened for censoring.' },
    /* daily hazard that a mass-exploitation campaign reaches one exposed system */
    scanHazBase:    { l: 'Daily chance a mass-exploitation campaign reaches one exposed system', v: 0.010, lo: 0.004, hi: 0.022, why: 'No public per-asset campaign-arrival rate. Widest band in the model.' },
    /* hazard multiplier when an exploit exists publicly but is not known to be used */
    pocOnlyHazard:  { l: 'Hazard multiplier when exploit code is public but not known to be used', v: 0.08, lo: 0.02, hi: 0.20, why: 'Public PoC without confirmed in-the-wild use still draws opportunistic traffic.' },
    /* hazard multiplier for edge appliances vs ordinary web systems */
    edgeHazard:     { l: 'Hazard multiplier for edge appliances against ordinary systems', v: 2.2,  lo: 1.4,  hi: 3.6,  why: 'Edge appliances are hit harder and carry no endpoint telemetry.' },
    /* hazard multiplier applied to the pre-publication window (targeted, not mass) */
    preHazard:      { l: 'Hazard multiplier before publication, where activity is targeted', v: 0.25, lo: 0.08, hi: 0.60, why: 'Zero-day activity is targeted; mass scanning follows public code.' },
    /* P(you actually run the affected product at all) */
    runsEdge:       { l: 'Chance you run an affected appliance product at all', v: 0.55, lo: 0.30, hi: 0.85, why: 'No measurement of estate-to-CVE product overlap. The single largest lever.' },
    runsWeb:        { l: 'Chance you run an affected ordinary product at all', v: 0.35, lo: 0.15, hi: 0.65, why: 'As above, for ordinary internet-facing software.' },
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
      why: 'Detected after breakout but before the objective. Corroborated by 44% of ransomware attacks being stopped before encryption (34% at small organisations, 46% at large).',
      src: 'Sophos State of Ransomware 2026' },
    containLate:    { l: 'Containment when detected after the objective', v: 0.10, lo: 0.02, hi: 0.25, why: 'Detected after the objective is reached.' },
    /* fraction of your estate an affected product covers */
    afEdgeMin:      { l: 'Share of the appliance tier one affected product covers', v: 0.30, lo: 0.15, hi: 0.45, why: 'Appliance fleets are homogeneous: one vendor covers much of the tier.' },
    afWebMax:       { l: 'Share of the estate one affected ordinary product covers', v: 0.44, lo: 0.25, hi: 0.65, why: 'Ordinary software is spread thinner across an estate.' },
    /* P(a landed campaign actually compromises a reachable affected system) */
    exploitWorks:   { l: 'Chance a landed campaign compromises a reachable system', v: 0.35, lo: 0.18, hi: 0.55, why: 'Exploits fail: wrong version, hardening, luck.' },
    /* how much slower detection is on a system with no endpoint telemetry */
    blindMult:      { l: 'Detection slowdown on systems with no endpoint telemetry', v: 2.6,  lo: 1.8,  hi: 5,
      why: 'Median dwell is 26 days when an external party notifies you and 10 days when detected internally, a measured 2.6x penalty for external notification.',
      src: 'Mandiant M-Trends 2026' },
  };

  /* ═══════════════════════════════════════════════════════════════════════
   * SLIDERS
   * ═══════════════════════════════════════════════════════════════════════ */
  var SPEC = {
    def: [
      { k: 'exposed',   l: 'Internet-exposed systems',   min: 5,   max: 2000, step: 5,   v: 100,
        f: function (v) { return fmtN(v); },
        h: 'Any system reachable by an unauthenticated attacker.' },
      { k: 'edge',      l: '…that are edge appliances',  min: 0,   max: 100,  step: 5,   v: 25,
        f: function (v) { return v + '%'; },
        h: 'VPN, firewall, gateway, managed file transfer. No endpoint agent, slower to remediate, most heavily targeted.' },
      { k: 'inventory', l: 'Exposed systems in inventory', min: 80, max: 100, step: 1, v: 96,
        f: function (v) { return v + '%'; },
        h: 'The remainder sit in no remediation cycle at all.' },
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
       * against the baseline estate: arrival speed +2.8pt of compromise,
       * weaponisation +8.9pt, tempo +0.0pt (and +1.7pt of incidents, which is
       * the whole of what it does). The page's own thesis — that the clock
       * everyone watches was already at the floor — is only visible once the
       * three move independently. */
      { k: 'ai',        l: 'Exploit arrival speed',      min: 0,   max: 100,  step: 1,   v: 0,
        f: function (v) { return v === 0 ? 'as measured' : 'x' + (1 / clockScale(v)).toFixed(1) + ' sooner'; },
        h: 'Compresses the publication-to-exploit clock. Zero is the measured ' + C.pocTiming.latest.year + ' distribution, whose median is already ' + C.pocTiming.latest.medianDays + ' days, the clock with the least room left to compress.' },
      { k: 'weap',      l: 'Share of bugs weaponised',   min: 0,   max: 100,  step: 1,   v: 0,
        f: function (v) { return v === 0 ? 'as measured' : 'x' + weapMult(v).toFixed(1) + ' armed'; },
        h: 'How many published vulnerabilities acquire working exploit code at all, and how many arrive before disclosure. Measured today at ' + C.armed.pPoCCritical.toFixed(1) + '% of criticals. Breadth, not speed.' },
      { k: 'tempo',     l: 'Post-exploitation tempo',    min: 0,   max: 100,  step: 1,   v: 0,
        f: function (v) { return v === 0 ? 'as reported' : 'x' + (1 / tempoScale(v)).toFixed(1) + ' faster'; },
        h: 'Speed from foothold to lateral movement to objective, once inside. Does not change whether you are compromised, only whether detection arrives in time to matter.' },
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
       * second-largest term in the whole model on the compromise metric. */
      /* Step stays at 0.5 despite the range now reaching 60. clampTo() snaps a
       * composed value to the slider's own step, so a coarser step silently
       * rounds the ATTENTION ladder's coefficients: at step 1 the opportunistic
       * rung's 0.5x came back as 1 and could not reach below the baseline at
       * all, which is the property that makes this a ladder rather than a
       * ratchet. Precision is wanted at the bottom of this range, not the top. */
      { k: 'agentSkill', l: 'Campaign success without a vulnerability', min: 0, max: 60, step: 0.5, v: 1,
        f: function (v) { return v + '%'; },
        h: 'Per targeted campaign, when no remediation window is open: phishing, credential abuse, misconfiguration or chained logic flaws. This is the model\'s proxy for the routes it does not simulate directly.' },
      { k: 'supply',    l: 'Supply-chain compromises per year', min: 0, max: 3, step: 0.01, v: 0.12,
        f: function (v) { return v.toFixed(2); },
        h: 'Compromised dependency or signed update that reaches your estate. Remediation cadence does not apply to this vector.' },
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
    none: {
      l: 'Nothing inbound',
      d: 'No unauthenticated listener on the public internet. Access is brokered outbound-only, and what remains reachable is the broker itself. The floor of this axis, not a typical estate.',
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
  var DETECTION = {
    none:    { l: 'No detection',     d: 'Logs are retained but not reviewed. Notification arrives late, from a third party.',                              p: { detect: 45,  edrCoverage: 5 } },
    siem:    { l: 'SIEM, untuned',    d: 'Collection is in place, detection content is not. External notification typically arrives first, at a 26-day median.', p: { detect: 26,  edrCoverage: 40 } },
    edr:     { l: 'EDR deployed',     d: 'Endpoint agents on most servers with business-hours response. Matches the 10-day median for organisations detecting internally.', p: { detect: 10,  edrCoverage: 78 } },
    tuned:   { l: 'EDR + tuned SIEM', d: 'Agents plus maintained detection content against live telemetry, with an analyst on the queue.',                                p: { detect: 3,   edrCoverage: 88 } },
    managed: { l: 'Managed 24/7',     d: 'MDR or an in-house SOC with genuine out-of-hours cover. This is where adversary breakout time stops winning by default.',    p: { detect: 1,   edrCoverage: 93 } },
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
   * 45% -> 52% at `sector` and 67% -> 83% at `named`. The old figures were low
   * BECAUSE the route was closed; opening it should raise them.
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
    loose:   { l: 'Sprawling', d: 'Change control by exception, applicability established late, little virtual patching, and a material share of the estate in no remediation cycle at all.',
      cadence: 2.6,  emergH: 2.4,  emergHit: 0.5, awareH: 3.5,  detect: 3.2,  virtual: 0.3, inventory: -12, edrCoverage: -25 },
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
  var SCENARIO = ['ai', 'weap', 'tempo'];
  function clampTo(k, v) {
    var s = SPEC.def.concat(SPEC.att).filter(function (x) { return x.k === k; })[0];
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
    SPEC.def.concat(SPEC.att).forEach(function (s) { P[s.k] = s.v; });
    return P;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * AI COUPLINGS — identity at ai=0 (the measured clock).
   * ═══════════════════════════════════════════════════════════════════════ */
  /* Three independent scenario dials, each named for the mechanism it drives.
   * They were one slider called 'AI' until measuring them apart showed that the
   * one the slider was named after does the least work. Isolated, at full
   * travel: the clock is worth +2.8pt of compromise, weaponised share +7.2pt,
   * pre-disclosure share +0.6pt. `weap` carries the last two together, because
   * both are the same claim — that more bugs acquire working exploit code, and
   * sooner relative to disclosure — and no evidence separates them. A reader
   * watching one curve attributed the whole 15pt to speed. */
  function clockScale(ai)  { return Math.exp(-0.023 * ai); }       /* ai=100    -> x0.10 */
  function weapMult(weap)  { return 1 + 0.010 * weap; }            /* weap=100  -> x2.0  */
  function preMult(weap)   { return 1 + 0.012 * weap; }            /* weap=100  -> x2.2  */
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
    rnd.binom = function (n, p) {
      if (p <= 0 || n <= 0) return 0;
      if (p >= 1) return n;
      if (n * p > 12 && n * (1 - p) > 12) {
        return Math.min(n, Math.max(0, Math.round(n * p + Math.sqrt(n * p * (1 - p)) * rnd.norm())));
      }
      if (n * p < 12) return Math.min(n, rnd.pois(n * p));
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
      return -k.preMedian * Math.exp(0.95 * inverseNormal(q));
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
      t = k.p75 + rnd.expo((365 - k.p75) / Math.log(1 / 0.2));
    }
    return t * k.scale;
  }
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

  /* Draw one coefficient set. `spread` 0 pins every assumption at its central
   * value (reproducible point estimate); 1 draws the full declared range. */
  function drawCoeffs(rnd, P, spread) {
    var k = {};
    Object.keys(ASSUMED).forEach(function (key) {
      var a = ASSUMED[key];
      k[key] = spread <= 0 ? a.v
        : rnd.range(a.v + (a.lo - a.v) * spread, a.v + (a.hi - a.v) * spread);
    });
    /* `weap` defaults to whatever `ai` is when it has not been set at all, so a
     * link shared before the split — which carried one `ai=N` meaning all three
     * effects at once — still resolves to the estate its author saw. */
    var ai = P.ai, weap = P.weap === undefined ? P.ai : P.weap;
    k.scale       = clockScale(ai);
    k.pPoC        = Math.min(0.9, MEASURED.pPoC * weapMult(weap));
    k.pWildGivenPoC = MEASURED.pWildGivenPoC;
    k.pWildNoPoC  = MEASURED.pWildNoPoC;
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
  var ROUTES = ['opportunistic', 'targeted', 'supply'];
  /* A strict funnel: every stage is a subset of the one above it.
   * Whether a vulnerability is merely armed (public exploit) or actually used
   * in the wild is NOT a funnel stage — it is a hazard multiplier, because
   * armed-but-unused bugs still draw opportunistic traffic. It is reported
   * separately as `wildShare`. */
  var FUNNEL = [
    'Criticals published in your stack',
    'Present in software you operate',
    'Public exploit code exists',
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
  function createRun(P, trials, seed, opts) {
    opts = opts || {};
    var wantSurv = opts.surv !== false;
    var spread = opts.spread === undefined ? 1 : opts.spread;
    var rnd = RNG(seed);

    var surv = new Float64Array(H + 2);
    /* Day each trial stopped surviving; H+1 means it never did. surv[] is the
     * suffix sum of this, taken once after the loop. */
    var stopAt = new Int32Array(H + 2);
    var hit = 0, inc = 0, events = 0, expDays = 0;
    var firsts = [];
    var route = [0, 0, 0];
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
     * settle as trials rose. At 150 it is stable in trial count (measured:
     * 11.6 / 11.4 / 11.7 % at 40k / 80k / 160k). Do not lower this without
     * re-running the stability test. */
    var BLOCKS = trials >= 6000 ? 150 : Math.max(10, Math.floor(trials / 40));
    var blockN = Math.max(1, Math.floor(trials / BLOCKS)), blockHits = [], blockInc = [];
    var bh = 0, bi = 0, bc = 0;
    var k = null;

    var nEdge = Math.round(P.exposed * P.edge / 100);
    var nWeb = P.exposed - nEdge;
    var invF = P.inventory / 100;
    var eKnown = Math.round(nEdge * invF), eDark = nEdge - eKnown;
    var wKnown = Math.round(nWeb * invF), wDark = nWeb - wKnown;

    var t = 0;
    /* Advance by `n` trials, or to the end when `n` is omitted. Returns true
     * once the run is complete. */
    function advance(n) {
      var end = n > 0 ? Math.min(trials, t + n) : trials;
      for (; t < end; t++) {
        /* bc is 0 on the first trial and again after every block flush, which
         * is exactly when a fresh coefficient set is due. */
        if (bc === 0) k = drawCoeffs(rnd, P, spread);
        var first = Infinity, firstRoute = -1, firstEdge = false, incident = false;
        var n = 0, edSum = 0;

        var K = rnd.pois(P.stackVulns);
        fn[0] += K;

        for (var i = 0; i < K; i++) {
          var isEdge = rnd() < P.edge / 100;

          /* 1. do you run the affected product at all? */
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
                          : -k.preMedian * Math.exp(0.95 * inverseNormal(rnd()));
          if (isEdge) tX *= 0.6; /* appliance exploitation runs ahead of the field */

          /* 4. how much of your estate does it touch? */
          var af = isEdge
            ? k.afEdgeMin + (0.90 - k.afEdgeMin) * rnd()
            : 0.04 + (k.afWebMax - 0.04) * rnd() * rnd();
          var popKnown = isEdge ? eKnown : wKnown;
          var popDark = isEdge ? eDark : wDark;
          var nKnown = rnd.binom(popKnown, af);
          var nDark = rnd.binom(popDark, af);
          if (nKnown + nDark < 1) continue;

          /* 5. when have you closed it? */
          var aware = rnd.lnorm(P.awareH / 24, 0.6) * (isEdge ? 1.4 : 1);
          var tp;
          if (P.emergH > 0 && rnd() < (P.emergHit / 100) * (isEdge ? 0.8 : 1)) {
            tp = aware + (P.emergH / 24) * Math.exp(0.3 * rnd.norm()) * (isEdge ? 1.5 : 1);
          } else {
            tp = aware + rnd() * P.cadence * (isEdge ? 1.6 : 1) + rnd.lnorm(0.6, 0.5);
          }
          var shielded = !isEdge && rnd() < P.virtual / 100;

          var win = shielded ? 0 : Math.max(0, tp - tX);
          if (win > 0) fn[3]++;
          edSum += Math.min(win, H) * nKnown;

          /* 6. does a campaign reach you inside that window? */
          var hazMul = Math.exp(0.9 * rnd.norm()) * (isEdge ? k.edgeHazard : 1)
                     * (inWild ? 1 : k.pocOnlyHazard);
          var landed = false, won = false;

          var reach = function (cnt, wTotal, tStart) {
            if (cnt < 1 || wTotal <= 0) return null;
            var h = k.scanHaz * hazMul * Math.pow(cnt, 0.4);
            /* pre-publication time is targeted, not mass: discount it */
            var pre = Math.max(0, Math.min(0, tStart + wTotal) - Math.min(0, tStart));
            var eff = Math.min(wTotal, H) - pre * (1 - k.preHazard);
            if (eff <= 0) return null;
            if (rnd() >= 1 - Math.exp(-h * eff)) return null;
            return { c: Math.max(1, rnd.binom(cnt, 0.7)), t: Math.min(wTotal, rnd.expo(1 / h)) };
          };
          var land = function (r, when0) {
            var c = rnd.binom(r.c, k.exploitWorks);
            if (c < 1) return false;
            n += c;
            var when = when0 + Math.max(0, tX) + r.t;
            if (when < first) { first = when; firstRoute = 0; firstEdge = isEdge; }
            return true;
          };

          var day0 = rnd() * H;
          var rK = reach(nKnown, win, tX);
          if (rK) { landed = true; if (land(rK, day0)) won = true; }

          if (nDark > 0) {
            /* systems in no patch cycle: fixed on rebuild, or not at all */
            var tpDark = rnd() < 0.5 ? aware + rnd() * 90 + rnd.lnorm(0.6, 0.5)
                                     : aware + rnd.expo(300);
            var winDark = Math.max(0, tpDark - tX);
            edSum += Math.min(winDark, H) * nDark;
            var rD = reach(nDark, winDark, tX);
            if (rD) { landed = true; if (land(rD, day0)) won = true; }
          }
          if (landed) fn[4]++;
          if (won) fn[5]++;
        }

        /* targeted campaigns: succeed more often when a window happens to be open */
        var openFrac = Math.min(1, edSum / (H * Math.max(1, P.exposed)));
        var pWin = openFrac * 0.7 + (1 - openFrac) * (P.agentSkill / 100);
        var nC = rnd.pois(P.campaigns);
        for (var ci = 0; ci < nC; ci++) {
          if (rnd() < pWin) {
            n++;
            var wc = rnd() * H;
            if (wc < first) { first = wc; firstRoute = 1; firstEdge = rnd() < P.edge / 100; }
          }
        }
        /* supply chain: patch cadence is irrelevant */
        var nS = rnd.pois(P.supply);
        for (var si = 0; si < nS; si++) {
          n++;
          var ws = rnd() * H;
          if (ws < first) { first = ws; firstRoute = 2; firstEdge = false; }
        }

        events += n;
        expDays += edSum;

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
      var totalRoute = route[0] + route[1] + route[2] || 1;
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
        expDays: expDays / trials,
        surv: Array.prototype.slice.call(surv, 0, H + 1).map(function (v) { return v / trials; }),
        routes: route.map(function (v) { return v / totalRoute; }),
        routeN: route.slice(),
        fn: fn.map(function (v) { return v / trials; }),
        armed: armedN / trials,
        wild: wildN / trials,
        wildShare: armedN ? wildN / armedN : 0,
        se: Math.sqrt(pHit * (1 - pHit) / trials),
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
    var covered = !isEdge && rnd() < (P.edrCoverage === undefined ? 70 : P.edrCoverage) / 100;
    var tD = covered ? rnd.lnorm(P.detect, 0.8) : rnd.lnorm(P.detect * k.blindMult, 0.9);
    var tB = rnd.lnorm(k.breakoutMedian, 0.9);
    var tO = rnd.lnorm(k.objectiveMedian, 0.7);
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
      var tX = drawPoCTime(rnd, k) * (isEdge ? 0.6 : 1);
      if (tX < 0) before++;
      if (tX < x0) aBelow++;
      else if (tX >= x1) aAbove++;
      else A[Math.floor((tX - x0) / dx)]++;

      var aware = rnd.lnorm(P.awareH / 24, 0.6) * (isEdge ? 1.4 : 1);
      var tp;
      if (P.emergH > 0 && rnd() < (P.emergHit / 100) * (isEdge ? 0.8 : 1)) {
        tp = aware + (P.emergH / 24) * Math.exp(0.3 * rnd.norm()) * (isEdge ? 1.5 : 1);
      } else {
        tp = aware + rnd() * P.cadence * (isEdge ? 1.6 : 1) + rnd.lnorm(0.6, 0.5);
      }
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
    H: H, SPEC: SPEC, PRESETS: PRESETS, MEASURED: MEASURED, ASSUMED: ASSUMED,
    CAL: C, FUNNEL: FUNNEL, ROUTES: ROUTES,
    EXPOSURE: EXPOSURE, TRAITS: TRAITS, ATTENTION: ATTENTION,
    MATURITY: MATURITY, DETECTION: DETECTION, compose: compose,
    DEFAULT_EXPOSURE: DEFAULT_EXPOSURE, DEFAULT_ATTENTION: DEFAULT_ATTENTION,
    defaults: defaults, simulate: simulate, createRun: createRun, densities: densities,
    SCENARIO: SCENARIO,
    RNG: RNG, inverseNormal: inverseNormal,
    clockScale: clockScale, weapMult: weapMult, preMult: preMult,
    tempoScale: tempoScale, SCOPE: SCOPE,
    fmtN: fmtN, fmtH: fmtH,
  };
});
