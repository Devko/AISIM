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
    preMedian:      { v: 7,    lo: 3,    hi: 21,   why: 'No public measurement of pre-disclosure exploit age. Shape assumed lognormal.' },
    /* 75th percentile of the PoC clock, days (anchors the slow tail) */
    pocP75:         { v: 47.5, lo: 30,   hi: 90,   why: 'CyberMon hero series p75 for the current year; widened for censoring.' },
    /* daily hazard that a mass-exploitation campaign reaches one exposed system */
    scanHazBase:    { v: 0.010, lo: 0.004, hi: 0.022, why: 'No public per-asset campaign-arrival rate. Widest band in the model.' },
    /* hazard multiplier when an exploit exists publicly but is not known to be used */
    pocOnlyHazard:  { v: 0.08, lo: 0.02, hi: 0.20, why: 'Public PoC without confirmed in-the-wild use still draws opportunistic traffic.' },
    /* hazard multiplier for edge appliances vs ordinary web systems */
    edgeHazard:     { v: 2.2,  lo: 1.4,  hi: 3.6,  why: 'Edge appliances are hit harder and carry no endpoint telemetry.' },
    /* hazard multiplier applied to the pre-publication window (targeted, not mass) */
    preHazard:      { v: 0.25, lo: 0.08, hi: 0.60, why: 'Zero-day activity is targeted; mass scanning follows public code.' },
    /* P(you actually run the affected product at all) */
    runsEdge:       { v: 0.55, lo: 0.30, hi: 0.85, why: 'No measurement of estate-to-CVE product overlap. The single largest lever.' },
    runsWeb:        { v: 0.35, lo: 0.15, hi: 0.65, why: 'As above, for ordinary internet-facing software.' },
    /* containment: breakout and objective timings, days */
    breakoutMedian: { v: 0.0134, lo: 0.009, hi: 0.033,
      why: 'Median that reproduces the reported 29-minute average eCrime breakout under this model\'s lognormal spread. Upper bound is the 2024 figure (~48 min average).',
      src: 'CrowdStrike Global Threat Report 2026' },
    objectiveMedian:{ v: 5,    lo: 2,    hi: 12,
      why: 'Median dwell when the adversary announces itself, usually via a ransomware note, giving a direct read on time from foothold to objective.',
      src: 'Mandiant M-Trends 2026' },
    /* P(contain) in each of the three detection regimes */
    containFast:    { v: 0.92, lo: 0.80, hi: 0.98, why: 'Detected before breakout.' },
    containMid:     { v: 0.55, lo: 0.35, hi: 0.75,
      why: 'Detected after breakout but before the objective. Corroborated by 44% of ransomware attacks being stopped before encryption (34% at small organisations, 46% at large).',
      src: 'Sophos State of Ransomware 2026' },
    containLate:    { v: 0.10, lo: 0.02, hi: 0.25, why: 'Detected after the objective is reached.' },
    /* fraction of your estate an affected product covers */
    afEdgeMin:      { v: 0.30, lo: 0.15, hi: 0.45, why: 'Appliance fleets are homogeneous: one vendor covers much of the tier.' },
    afWebMax:       { v: 0.44, lo: 0.25, hi: 0.65, why: 'Ordinary software is spread thinner across an estate.' },
    /* P(a landed campaign actually compromises a reachable affected system) */
    exploitWorks:   { v: 0.35, lo: 0.18, hi: 0.55, why: 'Exploits fail: wrong version, hardening, luck.' },
    /* how much slower detection is on a system with no endpoint telemetry */
    blindMult:      { v: 2.6,  lo: 1.8,  hi: 5,
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
      { k: 'emergHit',  l: 'Exploited vulns triggering out-of-band', min: 0, max: 100, step: 5, v: 60,
        f: function (v) { return v + '%'; },
        h: 'Requires the vulnerability to be recognised as urgent first.' },
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
      { k: 'stackVulns', l: 'Critical vulns in your stack / yr', min: 0, max: 200, step: 1, v: 34,
        f: function (v) { return fmtN(v); },
        h: 'Published criticals in software you operate. Worldwide run-rate is ' + fmtN(C.volume.curYearRunRate.critical) + '.' },
      { k: 'ai',        l: 'Exploit-clock compression',   min: 0,   max: 100,  step: 1,   v: 0,
        f: function (v) { return v === 0 ? 'as measured' : '+' + v; },
        h: 'Zero is the measured ' + C.pocTiming.latest.year + ' distribution. Above zero models faster exploit development, greater volume, and more pre-disclosure availability.' },
      { k: 'scan',      l: 'Mass-exploitation pressure',  min: 0,   max: 100,  step: 1,   v: 50,
        f: function (v) { return String(v); },
        h: 'Rate at which opportunistic exploitation reaches you once exploit code is public.' },
      { k: 'campaigns', l: 'Targeted campaigns / yr',     min: 0,   max: 100,  step: 1,   v: 6,
        f: function (v) { return fmtN(v); },
        h: 'Operations that enumerate your estate specifically rather than scanning indiscriminately.' },
      { k: 'agentSkill', l: 'Campaign success vs a patched surface', min: 0, max: 10, step: 0.5, v: 1,
        f: function (v) { return v + '%'; },
        h: 'Per campaign, via misconfiguration, chained logic flaws or credential abuse.' },
      { k: 'supply',    l: 'Supply-chain compromises reaching you / yr', min: 0, max: 3, step: 0.01, v: 0.12,
        f: function (v) { return v.toFixed(2); },
        h: 'Compromised dependency or signed update. Remediation cadence does not apply to this vector.' },
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
   * TRAITS - things that are true about you. Pick any number; they compose.
   *
   * A real organisation is not one archetype. It is "SaaS and regulated", or
   * "corporate network with an OT plant attached". So each trait is a MODIFIER
   * on the baseline estate rather than a complete parameter set, and selecting
   * several applies all of them.
   *
   * Numeric values multiply; string values like '+20' or '-6' offset. Every
   * result is clamped to the slider range afterwards, so combinations cannot
   * produce impossible estates.
   *
   * These are editorial judgement, not measurement: no public dataset gives
   * per-sector estate composition. They exist because the alternative is
   * asking a reader to guess "criticals in my stack per year" cold. Every
   * slider stays editable once you have picked.
   * ====================================================================== */
  var TRAITS = {
    saas: {
      l: 'We ship SaaS',
      d: 'The product is the exposed surface: a wide web tier, few appliances, and first-party fixes deployable within the hour. The trade-off is a substantially larger dependency stream.',
      m: { exposed: 2.4, edge: 0.35, cadence: 0.25, emergH: 0.25, awareH: 0.5,
           stackVulns: 1.9, supply: 2.5, virtual: '+20', edrCoverage: '+12' },
    },
    vendor: {
      l: 'We sell software',
      d: 'Customers operate what you build, which makes you a supply-chain node. Targeted well above what headcount would suggest, and the build and signing pipeline forms part of the attack surface.',
      m: { campaigns: 3, supply: 3, stackVulns: 1.3 },
    },
    corponly: {
      l: 'Corporate network only',
      d: 'Software is operated, not distributed. A small exposed surface of VPN, mail and a few web applications, which makes it appliance-heavy for its size.',
      m: { exposed: 0.55, edge: 1.4, stackVulns: 0.7, campaigns: 0.7 },
    },
    ot: {
      l: 'OT / ICS',
      d: 'Change windows run to months and any reboot carries a safety case. Long-lived appliances, minimal endpoint telemetry, and a small surface with high consequence of loss.',
      m: { edge: 2.0, cadence: 4.0, emergH: 3.0, emergHit: 0.5, awareH: 3.0,
           edrCoverage: 0.3, detect: 2.5, stackVulns: 0.7 },
    },
    regulated: {
      l: 'Regulated / finance',
      d: 'Heavily targeted and funded accordingly: enforced change control, maintained detection, and a third-party estate large enough to constitute its own exposure.',
      m: { campaigns: 4, supply: 2, inventory: '+2', virtual: '+25',
           emergHit: 1.35, edrCoverage: '+10' },
    },
    hosting: {
      l: 'We host for others',
      d: 'A large exposed surface operated on behalf of third parties, under sustained campaign pressure. A single appliance vulnerability becomes a customer-wide event.',
      m: { exposed: 6, campaigns: 5, stackVulns: 2.2, inventory: '-6', scan: '+20' },
    },
    legacy: {
      l: 'Legacy we cannot touch',
      d: 'Systems with no approved downtime window, or past end of support. They leave the remediation cycle without leaving the estate.',
      m: { cadence: 2.2, inventory: '-8', virtual: 0.4, edrCoverage: 0.6, emergHit: 0.7 },
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
  var MATURITY = {
    tight:   { l: 'Mature',  cadence: 0.25, emergH: 0.20, emergHit: 1.5, awareH: 0.25, detect: 0.05, virtual: 2.5, inventory: 4,   edrCoverage: 12 },
    typical: { l: 'Typical',   cadence: 1,    emergH: 1,    emergHit: 1,   awareH: 1,    detect: 1,    virtual: 1,   inventory: 0,   edrCoverage: 0 },
    loose:   { l: 'Sprawling', cadence: 2.6,  emergH: 2.4,  emergHit: 0.5, awareH: 3.5,  detect: 3.2,  virtual: 0.3, inventory: -12, edrCoverage: -25 },
    bod:     { l: 'BOD 26-04',  cadence: 1,    emergH: 1,    emergHit: 1.55, awareH: 0.33, detect: 1,    virtual: 1,   inventory: 3,   edrCoverage: 4 },
  };

  function clampTo(k, v) {
    var s = SPEC.def.concat(SPEC.att).filter(function (x) { return x.k === k; })[0];
    if (!s) return v;
    var q = Math.min(s.max, Math.max(s.min, v));
    /* snap to the slider's own step so control and model never disagree */
    var snapped = Math.round((q - s.min) / s.step) * s.step + s.min;
    return Math.min(s.max, Math.max(s.min, +snapped.toFixed(4)));
  }

  /* Compose a parameter set: baseline -> traits -> maturity -> detection.
   * Traits multiply or offset, so the order they were clicked in cannot
   * change the result. */
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
    traits.forEach(function (key) {
      var t = TRAITS[key];
      if (!t) return;
      Object.keys(t.m).forEach(function (prop) {
        var mod = t.m[prop];
        if (typeof mod === 'string') off[prop] = (off[prop] || 0) + parseFloat(mod);
        else if (mod >= 1) up[prop] = (up[prop] || 0) + (mod - 1);
        else if (mod > 0) down[prop] = (down[prop] || 0) + (1 / mod - 1);
      });
    });
    Object.keys(out).forEach(function (prop) {
      var factor = (1 + (up[prop] || 0)) / (1 + (down[prop] || 0));
      out[prop] = out[prop] * factor + (off[prop] || 0);
    });

    var mat = MATURITY[opts.maturity] || MATURITY.typical;
    ['cadence', 'emergH', 'emergHit', 'awareH', 'detect', 'virtual'].forEach(function (k) {
      out[k] = out[k] * mat[k];
    });
    out.inventory += mat.inventory;
    out.edrCoverage += mat.edrCoverage;

    var det = DETECTION[opts.detection];
    if (det) Object.keys(det.p).forEach(function (k) { out[k] = det.p[k]; });

    Object.keys(out).forEach(function (k) { out[k] = clampTo(k, out[k]); });
    out.ai = opts.ai || 0;
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
  function clockScale(ai) { return Math.exp(-0.023 * ai); }        /* ai=100 -> x0.10 */
  function weapMult(ai)   { return 1 + 0.010 * ai; }               /* ai=100 -> x2.0  */
  function preMult(ai)    { return 1 + 0.012 * ai; }               /* ai=100 -> x2.2  */

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
    var ai = P.ai;
    k.scale       = clockScale(ai);
    k.pPoC        = Math.min(0.9, MEASURED.pPoC * weapMult(ai));
    k.pWildGivenPoC = MEASURED.pWildGivenPoC;
    k.pWildNoPoC  = MEASURED.pWildNoPoC;
    k.pBefore     = Math.min(0.75, MEASURED.pocBefore * preMult(ai));
    k.median      = MEASURED.pocMedian;
    k.pWithinWeek = MEASURED.pocWithinWeek;
    k.p75         = k.pocP75;
    /* measured quantile positions, shifted by the pre-publication mass */
    k.pMedian     = 0.5;
    k.scanHaz     = k.scanHazBase * Math.exp(0.030 * (P.scan - 50));
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

  function simulate(P, trials, seed, opts) {
    opts = opts || {};
    var wantSurv = opts.surv !== false;
    var spread = opts.spread === undefined ? 1 : opts.spread;
    var rnd = RNG(seed);

    var surv = new Float64Array(H + 2);
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

    for (var t = 0; t < trials; t++) {
      if (k === null || bc === 0) k = drawCoeffs(rnd, P, spread);
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
        var stop = compromised ? Math.ceil(first) : H + 1;
        for (var d = 0; d < stop && d <= H; d++) surv[d]++;
      }

      bh += compromised ? 1 : 0; bi += incident ? 1 : 0; bc++;
      if (bc === blockN) { blockHits.push(bh / bc); blockInc.push(bi / bc); bh = 0; bi = 0; bc = 0; }
    }

    firsts.sort(function (a, b) { return a - b; });
    var pHit = hit / trials, pInc = inc / trials;
    var ciH = decompose(blockHits, pHit, blockN), ciI = decompose(blockInc, pInc, blockN);
    var totalRoute = route[0] + route[1] + route[2] || 1;

    return {
      p: pHit, pLo: ciH[0], pHi: ciH[1],
      incident: pInc, incLo: ciI[0], incHi: ciI[1],
      med: pHit >= 0.5 ? firsts[Math.floor(trials * 0.5)] : null,
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
    CAL: C, FUNNEL: FUNNEL, ROUTES: ROUTES, TRAITS: TRAITS, MATURITY: MATURITY, DETECTION: DETECTION, compose: compose,
    defaults: defaults, simulate: simulate, densities: densities,
    RNG: RNG, inverseNormal: inverseNormal,
    clockScale: clockScale, weapMult: weapMult, preMult: preMult,
    fmtN: fmtN, fmtH: fmtH,
  };
});
