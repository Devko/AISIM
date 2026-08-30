#!/usr/bin/env node
/* Derives js/calibration.js from the vendored CyberMon snapshot in data/cybermon/.
 * Every number the model uses is computed here, once, with its provenance recorded.
 * Nothing downstream is allowed to invent a coefficient.
 *
 * Run:  node tools/derive-calibration.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'cybermon');
const OUT = path.join(ROOT, 'js', 'calibration.js');

const load = (n) => JSON.parse(fs.readFileSync(path.join(SRC, n + '.json'), 'utf8'));
const meta = load('meta');
const flood = load('nine_eight_flood');
const volume = load('volume_curve');
const svr = load('score_vs_reality');
const poc = load('time_to_poc');
const kevLat = load('kev_latency');
const decay = load('nvd_decay');

const CM = 'https://devko.github.io/CyberMon/';
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;

/* ── year rows ─────────────────────────────────────────────────────────── */
const byYear = {};
flood.years.forEach((y) => {
  byYear[y.year] = { ...y, scored: y.critical + y.high + y.medium + y.low };
});
volume.years.forEach((v) => {
  if (byYear[v.year]) byYear[v.year].published = v.published;
});
const elapsed = flood.projection.elapsed;
const CUR = flood.projection.year;
const PREV = CUR - 1;

const cur = byYear[CUR];
const prev = byYear[PREV];
const runRate = (n) => Math.round(n / elapsed);

/* ── exploitation rate by CVSS band (KEV / scored population) ───────────── */
const pop = {};
svr.grid.forEach((g) => { pop[g.cvss_bucket] = (pop[g.cvss_bucket] || 0) + g.n; });
const kevByBand = {};
svr.kev.cvss_distribution.forEach((k) => { kevByBand[k.bucket] = k.n; });
const bands = svr.cvss_buckets.map((b) => ({
  band: b,
  population: pop[b],
  inKev: kevByBand[b],
  pExploited: r3((kevByBand[b] / pop[b]) * 100),
}));
const kevTotal = svr.kev.total;
const popTotal = Object.values(pop).reduce((a, b) => a + b, 0);

/* ── PoC availability by band (CY of poc.coverage.window_year) ──────────── */
const CRIT = '9.0-10.0';
const pPoCCritical = poc.coverage.buckets.find((b) => b.bucket === CRIT).pct / 100;
const pKevCritical = bands.find((b) => b.band === CRIT).pExploited / 100;

/* ── PoC timing: the "arming" series is the methodologically clean one ──── */
const arming = poc.arming.years;
const armLatest = arming[arming.length - 1];
/* last non-provisional year: the defensible anchor */
const armSolid = [...arming].reverse().find((y) => !y.provisional);
/* Pooled settled anchor — what the model actually runs on.
 *
 * A single year is a thin base: the settled rows run from n=146 to n=1019 and
 * their pre-publication share swings 33-42% on sampling noise alone. Pooling
 * the most recent settled years gives a base an order of magnitude larger
 * without reaching back into an era whose publication practice was different
 * (2015 reads 62.9% pre-publication against 41.8% in 2024 — that is a change in
 * how CVEs are published, not in how fast exploits arrive).
 *
 * The three statistics are pooled by n-weighting. For the two shares that is
 * exact. For the median it is not — a weighted mean of medians is not a median
 * — but only per-year summaries are published, and every year in the window
 * reports 0 or 1 day, so the pooled anchor cannot land outside that range and
 * the approximation cannot move it by as much as a day. Stated here rather than
 * hidden because it is the one derived figure in this file that is not exact. */
const SETTLED_WINDOW = 5;
const settledYears = arming.filter((y) => !y.provisional).slice(-SETTLED_WINDOW);
const settledN = settledYears.reduce((a, y) => a + y.n, 0);
const wmean = (f) => r3(settledYears.reduce((a, y) => a + f(y) * y.n, 0) / settledN);
const armPooled = {
  years: settledYears.map((y) => y.year),
  n: settledN,
  medianDays: wmean((y) => y.median_days),
  pctWithinWeek: wmean((y) => y.pct_within_week),
  pctBefore: wmean((y) => y.pct_negative),
  note: 'n-weighted over the settled years listed. Shares pool exactly; the median is a weighted mean of per-year medians, which is an approximation forced by the published summaries — every year in the window reports 0 or 1 day.',
};

/* ── KEV additions per year, and how many were preceded by a public PoC ── */
const kevYears = poc.kev_preempt.years;
const kevCur = kevYears.find((y) => y.year === CUR);
const kevPrev = kevYears.find((y) => y.year === PREV);
const pctPreempted = poc.kev_preempt.trend.pct_preempted / 100;

/* Decompose P(in the wild | critical) into the PoC-first and no-PoC paths.
 * Measured: 8.2% of criticals get a public PoC; 2.87% reach KEV; 79.2% of KEV
 * entries with a known PoC date had the PoC published first. */
const pInWildGivenPoC = r3((pKevCritical * pctPreempted) / pPoCCritical);
const pInWildNoPoC = r3((pKevCritical * (1 - pctPreempted)) / (1 - pPoCCritical));

/* ── NVD scoring integrity ─────────────────────────────────────────────── */
const st = {};
decay.current.statuses.forEach((s) => { st[s.status] = s.n; });
const corpus = meta.sources.cvelist.cve_count;
const hist = decay.history;

const out = {
  /* provenance */
  generatedAt: meta.generated_at,
  snapshot: {
    cvelist: meta.sources.cvelist.release,
    cveCount: corpus,
    epss: meta.sources.epss.model_version,
    epssDate: meta.sources.epss.score_date,
    kev: meta.sources.kev.catalog_version,
    kevCount: meta.sources.kev.count,
  },
  currentYear: CUR,
  yearElapsed: r3(elapsed),
  source: CM,

  /* ── volume and severity: the "critical vs non-critical" answer ──────── */
  volume: {
    prevYear: {
      year: PREV,
      published: prev.published,
      critical: prev.critical,
      high: prev.high,
      medium: prev.medium,
      low: prev.low,
      unscored: prev.unscored,
      criticalShare: r3((prev.critical / prev.scored) * 100),
      highPlusShare: r3(((prev.critical + prev.high) / prev.scored) * 100),
    },
    curYearToDate: {
      year: CUR,
      published: cur.published,
      critical: cur.critical,
      high: cur.high,
      medium: cur.medium,
      low: cur.low,
      unscored: cur.unscored,
      criticalShare: r3((cur.critical / cur.scored) * 100),
      highPlusShare: r3(((cur.critical + cur.high) / cur.scored) * 100),
    },
    curYearRunRate: {
      year: CUR,
      published: volume.projection.published,
      critical: runRate(cur.critical),
      high: runRate(cur.high),
      medium: runRate(cur.medium),
      low: runRate(cur.low),
    },
    growth: {
      published: r2(volume.projection.published / prev.published),
      critical: r2(runRate(cur.critical) / prev.critical),
      high: r2(runRate(cur.high) / prev.high),
      medium: r2(runRate(cur.medium) / prev.medium),
    },
    note: 'Run-rate is linear extrapolation of a partial year — calendar arithmetic, not a forecast.',
    src: CM + 'cve.html#flood',
  },

  /* ── severity is a weak predictor of exploitation ────────────────────── */
  exploitation: {
    bands,
    allBands: { population: popTotal, inKev: kevTotal, pExploited: r3((kevTotal / popTotal) * 100) },
    criticalVsHigh: r2(
      bands.find((b) => b.band === CRIT).pExploited /
      bands.find((b) => b.band === '7.0-8.9').pExploited
    ),
    kevBelowCritical: r3(((kevTotal - kevByBand[CRIT]) / kevTotal) * 100),
    criticalEpssBelow1pct: svr.headline.pct_critical_epss_below_1pct,
    src: CM + 'cve.html#reality',
  },

  /* ── the two clocks, measured separately ─────────────────────────────── */
  armed: {
    window: poc.coverage.window_year,
    byBand: poc.coverage.buckets.map((b) => ({ band: b.bucket, total: b.total, withPoC: b.with_poc, pct: b.pct })),
    pPoCCritical: r3(pPoCCritical * 100),
    worldwidePoCPerYear: poc.coverage.buckets.reduce((a, b) => a + b.with_poc, 0),
    catalog: poc.catalog,
    src: CM + 'exploits.html',
  },
  inWild: {
    pKevCritical: r3(pKevCritical * 100),
    pInWildGivenPoC: r3(pInWildGivenPoC * 100),
    pInWildNoPoC: r3(pInWildNoPoC * 100),
    pctPoCFirst: poc.kev_preempt.trend.pct_preempted,
    kevAddedPrevYear: kevPrev ? kevPrev.total_added : null,
    kevAddedCurYTD: kevCur ? kevCur.total_added : null,
    kevAddedRunRate: kevCur ? runRate(kevCur.total_added) : null,
    src: CM + 'kev.html',
  },

  /* ── attacker clock: days from CVE publication to public PoC ─────────── */
  pocTiming: {
    observedThrough: poc.arming.observed_through,
    horizonDays: poc.arming.horizon_days,
    series: arming.filter((y) => y.year >= 2015).map((y) => ({
      year: y.year, n: y.n, medianDays: y.median_days,
      pctWithinWeek: y.pct_within_week, pctBefore: y.pct_negative, provisional: !!y.provisional,
    })),
    latest: { year: armLatest.year, medianDays: armLatest.median_days, pctWithinWeek: armLatest.pct_within_week, pctBefore: armLatest.pct_negative, provisional: !!armLatest.provisional },
    lastSettled: { year: armSolid.year, medianDays: armSolid.median_days, pctWithinWeek: armSolid.pct_within_week, pctBefore: armSolid.pct_negative },
    /* The anchor js/model.js runs on. `latest` stays exported because the page
     * shows the series and has to be able to name its most recent row, but the
     * model must not be calibrated to a provisional one. */
    settled: armPooled,
    caveat: 'Recent years are right-censored: PoCs are still arriving for them. Provisional years understate speed and understate the pre-publication share.',
    /* The second caveat, and the one that cuts deeper than censoring, because
     * it is a property of the INSTRUMENT rather than of the window.
     *
     * This series is measured on CVEs that appear in ExploitDB, Metasploit or
     * Nuclei. The dated sample per year peaked above a thousand in 2017 and is
     * down to the low hundreds, while CVE publication roughly tripled over the
     * same span. Exploit code did not become five times rarer as vulnerability
     * volume tripled; the catalogues stopped being where it lands. Public
     * exploit code now appears predominantly in ad-hoc repositories, private
     * channels and commercial brokerages, none of which this corpus can see,
     * and one of the three sources counted here ships detection templates
     * rather than exploits.
     *
     * Two consequences, and the second is the one that matters for the page's
     * argument. The share of criticals recorded as acquiring exploit code is
     * a floor rather than an estimate. And a shrinking sample selects for
     * high-profile vulnerabilities, which are exactly the ones that acquire
     * exploit code fastest — so this instrument would hold a near-zero median
     * whether or not the broad population had moved. It can establish that
     * the fast tail is already at the floor. It cannot, on its own, establish
     * that no compression is available anywhere in the distribution. */
    coverageCaveat: 'The dated sample fell from over a thousand CVEs a year to the low hundreds while CVE publication tripled. Exploit code moved off the public catalogues rather than becoming rarer, so the weaponised share is a floor, and the near-zero median describes the fast tail this instrument can still see.',
    sampleTrend: arming.filter((y) => y.year >= 2015).map((y) => ({ year: y.year, n: y.n })),
    src: CM + 'exploits.html',
  },

  /* ── KEV listing latency: a proxy for how fast anyone tells you ───────── */
  kevLatency: {
    byYear: kevLat.latency_by_year.map((y) => ({ year: y.year, n: y.n, medianDays: y.median_days, p25: y.p25_days, p75: y.p75_days, pctBefore: y.pct_negative })),
    buckets: kevLat.latency_buckets,
    within7d: r3(kevLat.latency_buckets.filter((b) => ['before_publish', '0-7d'].includes(b.bucket)).reduce((a, b) => a + b.pct, 0)),
    cisaDeadlineDays: (kevLat.remediation_span_by_year.find((y) => y.year === CUR) || {}).median_days,
    src: CM + 'kev.html',
  },

  /* ── scoring integrity: why severity counts cannot be trusted ─────────── */
  nvd: {
    statuses: decay.current.statuses,
    corpus,
    deferred: st.Deferred,
    deferredShare: r3((st.Deferred / corpus) * 100),
    backlogTotal: decay.current.backlog_total,
    backlogFirst: hist.length ? hist[0] : null,
    backlogLast: hist.length ? hist[hist.length - 1] : null,
    backlogGrowth: hist.length > 1 ? r2(hist[hist.length - 1].backlog_total / hist[0].backlog_total) : null,
    src: CM + 'cve.html#decay',
  },
};

const banner = `/* GENERATED FILE — do not edit by hand.
 * Produced by tools/derive-calibration.js from the CyberMon snapshot in data/cybermon/.
 * Snapshot: ${out.snapshot.cvelist} · EPSS ${out.snapshot.epss} · KEV ${out.snapshot.kev}
 * Generated at: ${out.generatedAt}
 * Refresh with:  node tools/refresh-data.js && node tools/derive-calibration.js
 */
`;

const body = `${banner}(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CALIBRATION = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return ${JSON.stringify(out, null, 2)};
});
`;

fs.writeFileSync(OUT, body);
console.log('wrote ' + path.relative(ROOT, OUT) + '  (' + body.length.toLocaleString('en-US') + ' bytes)');
console.log('');
console.log('  snapshot           ' + out.snapshot.cvelist + '  (' + out.generatedAt + ')');
console.log('  ' + PREV + ' criticals      ' + prev.critical.toLocaleString('en-US') + '  (' + out.volume.prevYear.criticalShare + '% of scored)');
console.log('  ' + CUR + ' run-rate       ' + out.volume.curYearRunRate.critical.toLocaleString('en-US') + '  (' + out.volume.curYearToDate.criticalShare + '% of scored, ' + out.volume.growth.critical + 'x)');
console.log('  P(public PoC|crit) ' + out.armed.pPoCCritical + '%');
console.log('  P(in wild  |crit)  ' + out.inWild.pKevCritical + '%   [PoC-first ' + out.inWild.pInWildGivenPoC + '% · no-PoC ' + out.inWild.pInWildNoPoC + '%]');
console.log('  PoC median         ' + out.pocTiming.latest.medianDays + 'd (' + out.pocTiming.latest.year + ', provisional=' + out.pocTiming.latest.provisional + ')');
console.log('  PoC before pub     ' + out.pocTiming.latest.pctBefore + '%');
console.log('  KEV additions/yr   ' + out.inWild.kevAddedPrevYear + ' (' + PREV + ') · ' + out.inWild.kevAddedRunRate + ' (' + CUR + ' run-rate)');
console.log('  NVD deferred       ' + out.nvd.deferred.toLocaleString('en-US') + ' (' + out.nvd.deferredShare + '% of corpus)');
