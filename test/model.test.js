#!/usr/bin/env node
/* Correctness tests for the Exposure Race model.
 * Run:  node test/model.test.js
 * These exist because v2 shipped four bugs that a single assertion each would
 * have caught. Every one of them has a test here.
 */
'use strict';
const M = require('../js/model.js');
const C = require('../js/calibration.js');

let pass = 0, fail = 0;
const results = [];

function ok(name, cond, detail) {
  if (cond) { pass++; results.push(['  PASS  ', name, detail || '']); }
  else { fail++; results.push(['! FAIL  ', name, detail || '']); }
}
function near(name, a, b, tol, detail) {
  ok(name, Math.abs(a - b) <= tol, (detail ? detail + '  ' : '') + `got ${fmt(a)}, expected ${fmt(b)} ±${tol}`);
}
const fmt = (x) => (typeof x === 'number' ? (Math.abs(x) < 1 ? x.toFixed(4) : x.toFixed(2)) : String(x));
const D = () => M.defaults();
const run = (over, n, seed, opts) =>
  M.simulate(Object.assign(M.defaults(), over || {}), n || 20000, seed || 1234,
    Object.assign({ surv: false, spread: 0 }, opts || {}));

console.log('\n══ Exposure Race — model tests ══════════════════════════════════\n');

/* ─────────────────────────────────────────────────────────────────────────
 * 1. Determinism and RNG
 * ───────────────────────────────────────────────────────────────────────── */
{
  const a = run({}, 8000, 99), b = run({}, 8000, 99);
  ok('deterministic for a fixed seed', a.p === b.p && a.events === b.events, `p=${fmt(a.p)}`);
  const c = run({}, 8000, 100);
  ok('different seed gives a different draw', a.p !== c.p, `${fmt(a.p)} vs ${fmt(c.p)}`);

  const rnd = M.RNG(42);
  let sum = 0, n = 200000, min = 1, max = 0;
  for (let i = 0; i < n; i++) { const u = rnd(); sum += u; if (u < min) min = u; if (u > max) max = u; }
  near('RNG uniform mean is 0.5', sum / n, 0.5, 0.005);
  ok('RNG stays in [0,1)', min >= 0 && max < 1, `[${fmt(min)}, ${fmt(max)}]`);

  const r2 = M.RNG(7);
  let s2 = 0, sq = 0;
  for (let i = 0; i < 200000; i++) { const z = r2.norm(); s2 += z; sq += z * z; }
  near('normal draw has mean 0', s2 / 200000, 0, 0.02);
  near('normal draw has variance 1', sq / 200000, 1, 0.02);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. inverseNormal accuracy (used by the pre-disclosure branch)
 * ───────────────────────────────────────────────────────────────────────── */
{
  const known = [[0.5, 0], [0.975, 1.959964], [0.025, -1.959964], [0.9, 1.281552], [0.01, -2.326348]];
  let worst = 0;
  known.forEach(([p, want]) => { worst = Math.max(worst, Math.abs(M.inverseNormal(p) - want)); });
  ok('inverseNormal matches known quantiles', worst < 5e-5, `max error ${worst.toExponential(2)}`);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 3. Degenerate cases — the model must be able to reach zero
 * ───────────────────────────────────────────────────────────────────────── */
{
  ok('no vulns, no campaigns, no supply chain -> p = 0',
    run({ stackVulns: 0, campaigns: 0, supply: 0 }, 20000).p === 0);
  ok('nothing exposed -> essentially no vuln route',
    run({ exposed: 5, stackVulns: 0, campaigns: 0, supply: 0 }, 20000).p === 0);

  const supplyOnly = run({ stackVulns: 0, campaigns: 0, supply: 1.0 }, 40000).p;
  near('supply chain alone follows Poisson: 1/yr -> 1-e^-1', supplyOnly, 1 - Math.exp(-1), 0.012);

  const campOnly = run({ stackVulns: 0, campaigns: 10, supply: 0, agentSkill: 10 }, 40000).p;
  near('campaigns alone: 10/yr at 10% -> 1-e^-1', campOnly, 1 - Math.exp(-1), 0.02);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 4. Monotonicity — every slider must move the outcome the right way
 * ───────────────────────────────────────────────────────────────────────── */
{
  const mono = (label, key, lo, hi, dir) => {
    const a = run({ [key]: lo }, 24000).p, b = run({ [key]: hi }, 24000).p;
    const good = dir > 0 ? b >= a - 0.004 : b <= a + 0.004;
    ok(`monotone: ${label}`, good, `${lo}->${fmt(a)}  ${hi}->${fmt(b)}`);
  };
  mono('more exposed systems is worse', 'exposed', 25, 800, +1);
  mono('longer patch cycle is worse', 'cadence', 2, 80, +1);
  mono('slower emergency patching is worse', 'emergH', 6, 300, +1);
  mono('lower emergency trigger rate is worse', 'emergHit', 95, 10, +1);
  mono('worse inventory is worse', 'inventory', 100, 82, +1);
  mono('slower awareness is worse', 'awareH', 2, 300, +1);
  mono('less virtual patching is worse', 'virtual', 75, 0, +1);
  mono('more edge appliances is worse', 'edge', 0, 90, +1);
  mono('more vulns in your stack is worse', 'stackVulns', 4, 120, +1);
  mono('more campaigns is worse', 'campaigns', 0, 50, +1);
  mono('more supply-chain hits is worse', 'supply', 0, 2, +1);
  mono('exploit-clock compression is worse', 'ai', 0, 100, +1);
  mono('more scanning pressure is worse', 'scan', 5, 95, +1);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 5. BUG 1 REGRESSION — route attribution counts once per compromised trial
 * ───────────────────────────────────────────────────────────────────────── */
{
  const trials = 30000;
  const r = M.simulate(D(), trials, 1234, { surv: false, spread: 0 });
  const totalRoutes = r.routeN[0] + r.routeN[1] + r.routeN[2];
  const hits = Math.round(r.p * trials);
  ok('route attribution: one increment per compromised year',
    totalRoutes === hits, `routes=${totalRoutes} hits=${hits}`);
  near('route shares sum to 1', r.routes.reduce((a, b) => a + b, 0), 1, 1e-9);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 6. BUG 2 REGRESSION — the race chart must not discard distribution mass
 * ───────────────────────────────────────────────────────────────────────── */
{
  const d = M.densities(D(), 40000);
  ok('density x-range covers the pre-disclosure zone', d.x0 < 0, `x0=${d.x0}`);
  ok('pLate is a direct comparison, in (0,1)', d.pLate > 0 && d.pLate < 1, `pLate=${fmt(d.pLate)}`);
  near('measured pre-publication share is reproduced', d.beforeFrac,
    C.pocTiming.latest.pctBefore / 100, 0.05,
    `calibration says ${C.pocTiming.latest.pctBefore}%`);
  /* every sample must land in a bin: the normalised arrays cannot be all-zero
   * and the bin count must match B */
  ok('attacker density has full support', d.A.length === d.B && d.A.some(v => v > 0));
  ok('defender density has full support', d.D.length === d.B && d.D.some(v => v > 0));

  /* extreme settings must not push mass out of range */
  const wide = M.densities(Object.assign(D(), { cadence: 90, emergH: 336, awareH: 336 }), 20000);
  ok('extreme defender settings keep pLate valid', wide.pLate > 0 && wide.pLate <= 1, `pLate=${fmt(wide.pLate)}`);

  /* Conservation: v2 silently dropped out-of-range samples. v3 must account for
   * every one — inside the window or in a labelled overflow bucket. */
  ok('overflow is reported, not discarded',
    d.overflow && typeof d.overflow.aBelow === 'number' && typeof d.overflow.aAbove === 'number');
  ok('the exploit clock loses no probability mass',
    d.overflow.aBelow + d.overflow.aAbove < 1 && d.overflow.aBelow >= 0 && d.overflow.aAbove >= 0,
    `below=${fmt(d.overflow.aBelow)} above=${fmt(d.overflow.aAbove)}`);
  /* overflow must not be folded into the edge bins: the first and last interior
   * bins should not be the tallest, which is what folding would cause */
  const maxA = Math.max(...d.A);
  ok('edge bins are not inflated by folded-in overflow',
    d.A[0] < maxA - 1e-9 && d.A[d.B - 1] < maxA - 1e-9,
    `first=${fmt(d.A[0])} last=${fmt(d.A[d.B - 1])} max=${fmt(maxA)}`);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 7. BUG 3/4 REGRESSION — a baseline computed the same way is reproducible
 * ───────────────────────────────────────────────────────────────────────── */
{
  const base = run({}, 12000, 7).p;
  const again = run({}, 12000, 7).p;
  ok('tornado/sweep baseline is exactly reproducible at a fixed seed+n',
    base === again, `${fmt(base)}`);
  const sweepAt0 = run({ ai: 0 }, 12000, 7).p;
  ok('sweep curve passes through the baseline at the current setting',
    Math.abs(sweepAt0 - base) < 1e-12, `${fmt(sweepAt0)} vs ${fmt(base)}`);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 8. Containment — must be live across the whole slider, and bounded by p
 * ───────────────────────────────────────────────────────────────────────── */
{
  const pts = [0.1, 0.5, 1, 3, 7, 14, 30, 60].map(d => ({ d, r: run({ detect: d }, 20000) }));
  pts.forEach(({ d, r }) => {
    ok(`incidents <= compromises at detect=${d}d`, r.incident <= r.p + 1e-9,
      `${fmt(r.incident)} <= ${fmt(r.p)}`);
  });
  const lo = pts[0].r.incident, hi = pts[pts.length - 1].r.incident;
  ok('detection changes the incident rate substantially', hi / lo > 2,
    `0.1d -> ${fmt(lo)}   60d -> ${fmt(hi)}   ratio ${fmt(hi / lo)}x`);
  const fastContain = 1 - pts[0].r.incident / pts[0].r.p;
  ok('fast detection contains most compromises', fastContain > 0.5,
    `${(fastContain * 100).toFixed(0)}% contained at 2.4h`);
  const slowContain = 1 - hi / pts[pts.length - 1].r.p;
  ok('slow detection contains almost none', slowContain < 0.2,
    `${(slowContain * 100).toFixed(0)}% contained at 60d`);
  ok('detection does NOT change the compromise rate',
    Math.abs(pts[0].r.p - pts[pts.length - 1].r.p) < 0.02,
    `${fmt(pts[0].r.p)} vs ${fmt(pts[pts.length - 1].r.p)}`);
  /* the dead-zone bug: v2's containment was flat past 3 days */
  const mid = pts.filter(x => x.d >= 3 && x.d <= 30).map(x => x.r.incident);
  ok('containment is not flat in the 3-30 day range',
    Math.max(...mid) - Math.min(...mid) > 0.04,
    mid.map(v => fmt(v)).join(' '));
}

/* ─────────────────────────────────────────────────────────────────────────
 * 9. Funnel — must be a funnel
 * ───────────────────────────────────────────────────────────────────────── */
{
  const r = run({}, 30000);
  ok('funnel has one entry per stage', r.fn.length === M.FUNNEL.length);
  near('funnel starts at the stack-vuln rate', r.fn[0], D().stackVulns, 0.6);
  let monotone = true;
  for (let i = 1; i < r.fn.length; i++) if (r.fn[i] > r.fn[i - 1] + 1e-9) monotone = false;
  ok('funnel is non-increasing', monotone, r.fn.map(v => v.toFixed(2)).join(' > '));
  const drop = 1 - r.fn[1] / r.fn[0];
  ok('the "do you run it" stage is a real filter, not decoration', drop > 0.25,
    `drops ${(drop * 100).toFixed(0)}%`);

  /* armed vs in-the-wild is a hazard multiplier, not a funnel stage */
  ok('armed count equals the funnel stage that gates on it',
    Math.abs(r.armed - r.fn[2]) < 1e-9, `armed=${fmt(r.armed)} fn[2]=${fmt(r.fn[2])}`);
  ok('in-the-wild is a subset of armed', r.wild <= r.armed + 1e-9,
    `${fmt(r.wild)} <= ${fmt(r.armed)}`);
  const expectedWildShare =
    (M.MEASURED.pPoC * M.MEASURED.pWildGivenPoC + (1 - M.MEASURED.pPoC) * M.MEASURED.pWildNoPoC) /
    (M.MEASURED.pPoC + (1 - M.MEASURED.pPoC) * M.MEASURED.pWildNoPoC);
  near('in-the-wild share of armed bugs matches the measured decomposition',
    r.wildShare, expectedWildShare, 0.03);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 10. Calibration fidelity — the model must reproduce its own inputs
 * ───────────────────────────────────────────────────────────────────────── */
{
  near('P(public PoC | critical) matches CyberMon',
    M.MEASURED.pPoC * 100, C.armed.pPoCCritical, 1e-9);
  near('P(in the wild | critical) decomposes back to the measured rate',
    (M.MEASURED.pPoC * M.MEASURED.pWildGivenPoC +
     (1 - M.MEASURED.pPoC) * M.MEASURED.pWildNoPoC) * 100,
    C.exploitation.bands.find(b => b.band === '9.0-10.0').pExploited, 0.05);

  ok('AI slider is identity at zero',
    M.clockScale(0) === 1 && M.weapMult(0) === 1 && M.preMult(0) === 1);
  ok('AI slider compresses the clock as it rises', M.clockScale(100) < 0.2,
    `x${fmt(M.clockScale(100))}`);

  /* the funnel's "exploit exists" stage should sit near the measured PoC rate */
  const r = run({}, 40000);
  const observedPoC = r.fn[2] / r.fn[1];
  near('simulated PoC share reproduces the measured rate', observedPoC,
    M.MEASURED.pPoC, 0.012, `stage 3 / stage 2`);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 11. Uncertainty — the credible band must behave
 * ───────────────────────────────────────────────────────────────────────── */
{
  const r = M.simulate(D(), 40000, 1234, { surv: false, spread: 1 });
  ok('credible interval brackets the point estimate',
    r.pLo <= r.p && r.p <= r.pHi, `${fmt(r.pLo)} <= ${fmt(r.p)} <= ${fmt(r.pHi)}`);
  ok('credible interval is a real interval, not a point', r.pHi - r.pLo > 0.02,
    `width ${fmt(r.pHi - r.pLo)}`);
  const pinned = M.simulate(D(), 40000, 1234, { surv: false, spread: 0 });
  ok('spread=0 gives a narrower band than spread=1',
    (pinned.pHi - pinned.pLo) < (r.pHi - r.pLo),
    `${fmt(pinned.pHi - pinned.pLo)} < ${fmt(r.pHi - r.pLo)}`);
  ok('incident interval brackets the incident estimate',
    r.incLo <= r.incident && r.incident <= r.incHi);

  /* REGRESSION. The band must describe the assumptions, not the trial count.
   * At 40 blocks it did the latter: the reported width swung 6.6%-13.5% as
   * trials rose and wandered by a third between seeds, because a variance
   * estimated from B blocks carries a relative error of ~sqrt(2/(B-1)). */
  const widths = [30000, 60000, 120000].map(
    (n) => { const x = M.simulate(D(), n, 1234, { surv: false, spread: 1 }); return x.pHi - x.pLo; });
  const wSpread = Math.max(...widths) - Math.min(...widths);
  ok('band width is stable as trials rise', wSpread < 0.035,
    widths.map((w) => fmt(w)).join(' / ') + `  spread ${fmt(wSpread)}`);

  const bySeed = [1, 7, 99, 1234].map(
    (s) => { const x = M.simulate(D(), 60000, s, { surv: false, spread: 1 }); return x.pHi - x.pLo; });
  ok('band width is stable across seeds', Math.max(...bySeed) - Math.min(...bySeed) < 0.035,
    bySeed.map((w) => fmt(w)).join(' / '));

  const pBySeed = [1, 7, 99, 1234].map(
    (s) => M.simulate(D(), 60000, s, { surv: false, spread: 1 }).p);
  ok('point estimate is stable across seeds', Math.max(...pBySeed) - Math.min(...pBySeed) < 0.02,
    pBySeed.map((p) => fmt(p)).join(' / '));

  ok('the band is flagged unreliable at interactive trial counts',
    M.simulate(D(), 4000, 1, { surv: false }).bandReliable === false &&
    M.simulate(D(), 60000, 1, { surv: false }).bandReliable === true);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 11b. Coefficient provenance — every non-corpus coefficient must declare a
 *      range, and the ones carrying a published figure must cite it.
 * ───────────────────────────────────────────────────────────────────────── */
{
  const keys = Object.keys(M.ASSUMED);
  const bad = keys.filter((k) => {
    const a = M.ASSUMED[k];
    return !(typeof a.v === 'number' && typeof a.lo === 'number' && typeof a.hi === 'number');
  });
  ok('every coefficient declares v/lo/hi', bad.length === 0, bad.join(','));

  const unordered = keys.filter((k) => !(M.ASSUMED[k].lo <= M.ASSUMED[k].v && M.ASSUMED[k].v <= M.ASSUMED[k].hi));
  ok('every central value sits inside its own range', unordered.length === 0, unordered.join(','));

  const unexplained = keys.filter((k) => !M.ASSUMED[k].why || M.ASSUMED[k].why.length < 20);
  ok('every coefficient explains itself', unexplained.length === 0, unexplained.join(','));

  const cited = keys.filter((k) => M.ASSUMED[k].src);
  ok('the vendor-sourced coefficients carry a citation', cited.length >= 4,
    cited.join(', '));
}

/* ─────────────────────────────────────────────────────────────────────────
 * 12. Survival curve
 * ───────────────────────────────────────────────────────────────────────── */
{
  const r = M.simulate(D(), 20000, 1234, { surv: true, spread: 0 });
  ok('survival starts at 1', Math.abs(r.surv[0] - 1) < 1e-9, `${fmt(r.surv[0])}`);
  let mono = true;
  for (let i = 1; i <= M.H; i++) if (r.surv[i] > r.surv[i - 1] + 1e-9) mono = false;
  ok('survival is non-increasing', mono);
  near('survival at the horizon equals 1 - p', r.surv[M.H], 1 - r.p, 0.01);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 13. Presets must all be valid and ordered
 * ───────────────────────────────────────────────────────────────────────── */
{
  const keys = M.SPEC.def.concat(M.SPEC.att).map(s => s.k);
  Object.keys(M.PRESETS).forEach(name => {
    const p = M.PRESETS[name];
    const missing = keys.filter(k => p[k] === undefined);
    ok(`preset "${name}" sets every slider`, missing.length === 0, missing.join(','));
    const bad = M.SPEC.def.concat(M.SPEC.att)
      .filter(s => p[s.k] < s.min || p[s.k] > s.max)
      .map(s => `${s.k}=${p[s.k]} outside [${s.min},${s.max}]`);
    ok(`preset "${name}" is inside every slider range`, bad.length === 0, bad.join('; '));
  });
  const t = M.simulate(M.PRESETS.tight, 20000, 1234, { surv: false, spread: 0 }).p;
  const y = M.simulate(M.PRESETS.typical, 20000, 1234, { surv: false, spread: 0 }).p;
  const s = M.simulate(M.PRESETS.sprawling, 20000, 1234, { surv: false, spread: 0 }).p;
  ok('presets are ordered tight < typical < sprawling', t < y && y < s,
    `${fmt(t)} < ${fmt(y)} < ${fmt(s)}`);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 13b. Trait composition — traits are multi-select, so the result must not
 *      depend on click order and must never leave the slider ranges.
 * ───────────────────────────────────────────────────────────────────────── */
{
  const keys = Object.keys(M.TRAITS);
  const all = M.SPEC.def.concat(M.SPEC.att);

  ok('every trait has a label, description and modifier set',
    keys.every(k => M.TRAITS[k].l && M.TRAITS[k].d && M.TRAITS[k].m &&
      Object.keys(M.TRAITS[k].m).length));

  const unknown = [];
  keys.forEach(k => Object.keys(M.TRAITS[k].m).forEach(prop => {
    if (!all.some(s => s.k === prop)) unknown.push(k + '.' + prop);
  }));
  ok('traits only modify real parameters', unknown.length === 0, unknown.join(','));

  /* order independence across permutations of a colliding set — saas offsets
   * edrCoverage while ot multiplies it, which is exactly the case that broke */
  const perm = [
    ['saas', 'regulated', 'ot'], ['ot', 'regulated', 'saas'],
    ['regulated', 'saas', 'ot'], ['ot', 'saas', 'regulated'],
  ].map(t => JSON.stringify(M.compose({ traits: t })));
  ok('composition is independent of click order', new Set(perm).size === 1,
    `${new Set(perm).size} distinct results from 4 orderings`);

  /* a single trait must apply exactly as written — no diminishing returns yet */
  near('a lone multiplier applies exactly', M.compose({ traits: ['saas'] }).exposed,
    M.defaults().exposed * M.TRAITS.saas.m.exposed, 1e-9);

  /* stacking must compound but with diminishing returns, never multiplicatively */
  const stacked = M.compose({ traits: ['hosting', 'saas'] }).exposed;
  const naive = M.defaults().exposed * M.TRAITS.hosting.m.exposed * M.TRAITS.saas.m.exposed;
  ok('stacked multipliers compound sub-multiplicatively',
    stacked > M.compose({ traits: ['hosting'] }).exposed && stacked < naive,
    `${stacked} < ${naive} naive`);

  /* every subset must stay inside every slider range */
  let bad = [];
  const subsets = [[], ...keys.map(k => [k]), keys,
    ['saas', 'regulated'], ['corponly', 'ot', 'legacy'], ['hosting', 'vendor', 'thirdparty']];
  subsets.forEach(t => Object.keys(M.MATURITY).forEach(mat => Object.keys(M.DETECTION).concat([null]).forEach(det => {
    const p = M.compose({ traits: t, maturity: mat, detection: det });
    all.forEach(s => {
      if (!(p[s.k] >= s.min && p[s.k] <= s.max)) bad.push(`${s.k}=${p[s.k]} [${t.join('+') || 'none'}/${mat}/${det}]`);
    });
  })));
  ok('every trait × maturity × detection combination stays in range',
    bad.length === 0, bad.slice(0, 3).join('; '));

  /* and every combination must actually simulate */
  let ran = 0, failed = 0;
  subsets.forEach(t => {
    const r = M.simulate(M.compose({ traits: t }), 3000, 1234, { surv: false, spread: 1 });
    ran++;
    if (!(r.p >= 0 && r.p <= 1 && isFinite(r.events) && r.incident <= r.p + 1e-9)) failed++;
  });
  ok('every trait combination produces a valid simulation', failed === 0, `${ran} combinations`);

  /* detection posture must override whatever the traits set */
  const otManaged = M.compose({ traits: ['ot'], detection: 'managed' });
  near('detection posture wins over trait defaults', otManaged.detect, M.DETECTION.managed.p.detect, 1e-9);
}

/* ─────────────────────────────────────────────────────────────────────────
 * 14. Slider spec integrity
 * ───────────────────────────────────────────────────────────────────────── */
{
  const all = M.SPEC.def.concat(M.SPEC.att);
  const dup = all.map(s => s.k).filter((k, i, a) => a.indexOf(k) !== i);
  ok('no duplicate slider keys', dup.length === 0, dup.join(','));
  const bad = all.filter(s => !(s.min < s.max) || !s.step || typeof s.f !== 'function' || !s.h);
  ok('every slider has a valid range, step, formatter and hint', bad.length === 0,
    bad.map(s => s.k).join(','));
  const outside = all.filter(s => s.v < s.min || s.v > s.max);
  ok('every default sits inside its own range', outside.length === 0,
    outside.map(s => s.k).join(','));
}

/* ─────────────────────────────────────────────────────────────────────────
 * 15. Performance budget — the UI redraws on every slider move
 * ───────────────────────────────────────────────────────────────────────── */
{
  const t0 = Date.now();
  M.simulate(D(), 6000, 1234, { surv: true, spread: 1 });
  const dt = Date.now() - t0;
  ok('6k-trial interactive pass stays under 120ms', dt < 120, `${dt}ms`);
}

/* ───────────────────────────────────────────────────────────────────────── */
const width = Math.max(...results.map(r => r[1].length));
results.forEach(([tag, name, detail]) => {
  console.log(tag + name.padEnd(width + 2) + (detail ? '\x1b[2m' + detail + '\x1b[0m' : ''));
});
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
