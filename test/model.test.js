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
  mono('faster exploit arrival is worse', 'ai', 0, 100, +1);
  mono('more bugs weaponised is worse', 'weap', 0, 100, +1);
  mono('a more capable non-vulnerability route is worse', 'agentSkill', 0, 40, +1);
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

  ok('every scenario dial is identity at zero',
    M.clockScale(0) === 1 && M.weapMult(0) === 1 && M.preMult(0) === 1 &&
    M.tempoScale(0) === 1);
  ok('the arrival dial compresses the clock as it rises', M.clockScale(100) < 0.2,
    `x${fmt(M.clockScale(100))}`);
  ok('the tempo dial compresses the containment clocks as it rises',
    M.tempoScale(100) < 0.2, `x${fmt(M.tempoScale(100))}`);

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
 * 12b. Suspendable runs — js/app.js drives the 60,000-trial settle pass
 *      through createRun() a slice at a time so it does not hold the frame.
 *      That is only legitimate if a sliced run is the SAME run: same trials,
 *      same order, same coefficient draws, same block flushes. Whole-run
 *      equality is therefore the property under test, and it is checked at
 *      slice sizes that do not divide the trial count and do not align with
 *      the 150 block boundaries, which is where an off-by-one would show.
 * ───────────────────────────────────────────────────────────────────────── */
{
  const opts = { surv: true, spread: 1 };
  const whole = M.simulate(D(), 30000, 1234, opts);
  const drain = (chunk) => {
    const run = M.createRun(D(), 30000, 1234, opts);
    let guard = 0;
    while (!run.advance(chunk)) if (++guard > 100000) throw new Error('advance never completed');
    return run.result();
  };
  [1, 7, 997, 10000, 30000].forEach((chunk) => {
    const sliced = drain(chunk);
    const same = ['p', 'pLo', 'pHi', 'incident', 'incLo', 'incHi', 'med', 'events', 'expDays',
      'armed', 'wild', 'wildShare', 'se', 'trials', 'bandReliable']
      .every((k) => sliced[k] === whole[k]) &&
      ['fn', 'routes', 'routeN', 'surv'].every((k) => JSON.stringify(sliced[k]) === JSON.stringify(whole[k]));
    ok(`a run sliced ${chunk} at a time is identical to one run whole`, same,
      `p=${fmt(sliced.p)} vs ${fmt(whole.p)}`);
  });

  const run = M.createRun(D(), 5000, 7, { surv: false, spread: 0 });
  ok('advance() reports incomplete until the last trial', run.advance(4999) === false);
  ok('done() agrees with advance()', run.done() === false);
  ok('advance() reports complete on the final trial', run.advance(1) === true && run.done() === true);
  ok('advancing past the end is a no-op, not an overrun',
    run.advance(10000) === true && run.result().trials === 5000);
  ok('result() is idempotent', run.result().p === run.result().p);
  ok('advance() with no argument runs to completion',
    M.createRun(D(), 3000, 5, { surv: false, spread: 0 }).advance() === true);
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
 * 13b. Shape composition — one exposure rung, any number of traits, one
 *      attention level. The result must not depend on click order, must never
 *      leave the slider ranges, and each ladder must be monotone in the thing
 *      it claims to order.
 * ───────────────────────────────────────────────────────────────────────── */
{
  const keys = Object.keys(M.TRAITS);
  const expKeys = Object.keys(M.EXPOSURE);
  const attKeys = Object.keys(M.ATTENTION);
  const all = M.SPEC.def.concat(M.SPEC.att);
  const P = (o) => M.compose(o);

  const tables = [['exposure', M.EXPOSURE], ['trait', M.TRAITS], ['attention', M.ATTENTION]];
  tables.forEach(([name, tbl]) => {
    ok(`every ${name} has a label, description and modifier set`,
      Object.keys(tbl).every(k => tbl[k].l && tbl[k].d && tbl[k].m &&
        Object.keys(tbl[k].m).length));
    const unknown = [];
    Object.keys(tbl).forEach(k => Object.keys(tbl[k].m).forEach(prop => {
      if (!all.some(s => s.k === prop)) unknown.push(k + '.' + prop);
    }));
    ok(`${name}s only modify real parameters`, unknown.length === 0, unknown.join(','));
  });

  /* The composer's identity. Both ladders carry a x1 rung so that an untouched
   * console is exactly the baseline estate — if either default drifts off its
   * identity rung, every headline on the page moves and nothing says so. */
  {
    const d = M.defaults(), c = P({});
    const drift = Object.keys(d).filter(k => Math.abs(d[k] - c[k]) > 1e-9);
    ok('compose({}) returns the baseline estate untouched', drift.length === 0,
      drift.map(k => `${k} ${d[k]}->${c[k]}`).join(', '));
    ok('the default rungs exist in their tables',
      !!M.EXPOSURE[M.DEFAULT_EXPOSURE] && !!M.ATTENTION[M.DEFAULT_ATTENTION]);
  }

  /* Each ladder is an ordered axis, so walking it must move the headline one
   * way only. A rung that does not raise the number is a rung that is lying
   * about where it sits. */
  const walk = (label, ks, mk) => {
    const ps = ks.map(k => M.simulate(P(mk(k)), 20000, 1234, { surv: false, spread: 0 }).p);
    ok(`the ${label} ladder is monotone in compromise probability`,
      ps.every((v, i) => i === 0 || v > ps[i - 1]),
      ps.map(x => (x * 100).toFixed(1) + '%').join(' -> '));
  };
  walk('exposure', expKeys, (k) => ({ exposure: k }));
  walk('attention', attKeys, (k) => ({ attention: k }));

  /* Monotone totals are not what the attention ladder is FOR. It carries both
   * how many campaigns arrive and how capable each one is without a
   * vulnerability to use, and the second was added by trading away some of the
   * first — so the claim being made is about the MIX, not the height. As
   * deliberate attention rises, more of the reader's risk has to move onto the
   * route no remediation cycle touches. A future rebalance that restored the
   * old totals by putting the volume back would pass the monotonicity test
   * above and silently undo the point of the change; this is the assertion
   * that would fail. */
  {
    const targeted = attKeys.map(k =>
      M.simulate(P({ attention: k }), 20000, 1234, { surv: false, spread: 0 }).routes[1]);
    ok('rising adversary attention moves the mix onto the targeted route',
      targeted.every((v, i) => i === 0 || v > targeted[i - 1]),
      targeted.map(x => (x * 100).toFixed(0) + '%').join(' -> '));
    ok('the top rung carries most of its risk off the remediation path',
      targeted[targeted.length - 1] > 0.6,
      `${(targeted[targeted.length - 1] * 100).toFixed(0)}% targeted at the top rung`);
  }

  /* The ladder has to reach below the baseline on the capability axis too, or
   * `agentSkill` is a ratchet. This is also the regression test for the slider
   * step: clampTo() snaps composed values to it, and at step 1 the bottom
   * rung's 0.5x came back as 1 and the rung silently lost its reduction. */
  {
    const skill = attKeys.map(k => M.compose({ attention: k }).agentSkill);
    ok('non-vulnerability capability is ordered across the attention ladder',
      skill.every((v, i) => i === 0 || v > skill[i - 1]), skill.join(' -> '));
    ok('the bottom rung reaches below the baseline capability, step included',
      skill[0] < M.defaults().agentSkill, `${skill[0]} vs ${M.defaults().agentSkill}`);
  }

  /* The floor the old multi-select could not express: the safest posture the
   * console can describe must sit well below the baseline, or the control is a
   * ratchet rather than an axis. */
  {
    const floor = M.simulate(P({ exposure: expKeys[0], attention: attKeys[0] }),
      20000, 1234, { surv: false, spread: 0 }).p;
    const base = M.simulate(P({}), 20000, 1234, { surv: false, spread: 0 }).p;
    ok('the bottom of both ladders sits below the baseline estate', floor < base * 0.8,
      `${fmt(floor)} vs ${fmt(base)}`);
  }

  /* Order independence across a colliding set — ot multiplies edrCoverage while
   * thirdparty multiplies it again, which is exactly the case that broke. */
  const perm = [
    ['vendor', 'ot', 'thirdparty'], ['ot', 'thirdparty', 'vendor'],
    ['thirdparty', 'vendor', 'ot'], ['ot', 'vendor', 'thirdparty'],
  ].map(t => JSON.stringify(P({ traits: t })));
  ok('composition is independent of click order', new Set(perm).size === 1,
    `${new Set(perm).size} distinct results from 4 orderings`);

  /* A single modifier must apply exactly as written — no diminishing returns
   * until something else stacks on it. True across the tables, not just within
   * traits, because a rung and a trait share one multiplier pass. */
  near('a lone rung multiplier applies exactly', P({ exposure: 'others' }).exposed,
    M.defaults().exposed * M.EXPOSURE.others.m.exposed, 1e-9);
  near('a lone trait multiplier applies exactly', P({ traits: ['thirdparty'] }).supply,
    M.defaults().supply * M.TRAITS.thirdparty.m.supply, 1e-9);

  /* Stacking must compound but with diminishing returns, never multiplicatively
   * — and a rung stacking with a trait must obey the same rule as two traits. */
  {
    const stacked = P({ exposure: 'corp', traits: ['ot'] }).edge;
    const naive = M.defaults().edge * M.EXPOSURE.corp.m.edge * M.TRAITS.ot.m.edge;
    ok('a rung and a trait compound sub-multiplicatively',
      stacked > P({ exposure: 'corp' }).edge && stacked < naive,
      `${stacked} < ${naive} naive`);
  }

  /* No pair of selectable things may contradict each other. The exposure axis
   * is single-select precisely so that it cannot, and the surviving traits earn
   * their place by composing with every rung: raising exposure must never lower
   * the reachable surface, whatever else is selected. */
  {
    let bad = [];
    expKeys.forEach((e, i) => {
      if (i === 0) return;
      keys.concat([null]).forEach(t => {
        const lo = P({ exposure: expKeys[i - 1], traits: t ? [t] : [] });
        const hi = P({ exposure: e, traits: t ? [t] : [] });
        if (hi.exposed < lo.exposed) bad.push(`${expKeys[i - 1]}->${e} with ${t || 'no trait'}`);
      });
    });
    ok('every trait leaves the exposure ladder monotone in reachable systems',
      bad.length === 0, bad.slice(0, 3).join('; '));
  }

  /* Every combination must stay inside every slider range. The sweep is now the
   * full cross-product of both ladders against the trait power set, because a
   * rung multiplying the same term a trait offsets is the new collision. */
  const subsets = [[], ...keys.map(k => [k]), keys,
    ['vendor', 'thirdparty'], ['ot', 'thirdparty']];
  {
    let bad = [];
    subsets.forEach(t => expKeys.forEach(e => attKeys.forEach(a =>
      Object.keys(M.MATURITY).forEach(mat => Object.keys(M.DETECTION).concat([null]).forEach(det => {
        const p = P({ exposure: e, traits: t, attention: a, maturity: mat, detection: det });
        all.forEach(s => {
          if (!(p[s.k] >= s.min && p[s.k] <= s.max)) {
            bad.push(`${s.k}=${p[s.k]} [${e}/${t.join('+') || 'none'}/${a}/${mat}/${det}]`);
          }
        });
      })))));
    ok('every exposure x trait x attention x maturity x detection stays in range',
      bad.length === 0, bad.slice(0, 3).join('; '));
  }

  /* And every combination must actually simulate. */
  {
    let ran = 0, failed = 0;
    subsets.forEach(t => expKeys.forEach(e => {
      const r = M.simulate(P({ exposure: e, traits: t }), 3000, 1234, { surv: false, spread: 1 });
      ran++;
      if (!(r.p >= 0 && r.p <= 1 && isFinite(r.events) && r.incident <= r.p + 1e-9)) failed++;
    }));
    ok('every shape combination produces a valid simulation', failed === 0, `${ran} combinations`);
  }

  /* Detection posture assigns dwell time outright — the reader bought a stack
   * and the stack states its own median. */
  const otManaged = P({ traits: ['ot'], detection: 'managed' });
  near('detection posture wins on dwell time', otManaged.detect, M.DETECTION.managed.p.detect, 1e-9);
  /* But it may not overwrite a physical impossibility with an aspiration. An OT
   * estate cannot reach 93% endpoint coverage by signing an MDR contract,
   * because the appliances support no agent. */
  ok('a trait that suppresses telemetry keeps its ceiling under any posture',
    otManaged.edrCoverage < M.DETECTION.managed.p.edrCoverage,
    `${otManaged.edrCoverage}% vs ${M.DETECTION.managed.p.edrCoverage}% bought`);

  /* Every one of these keys arrives from the query string, and a bare
   * `TABLE[key]` truthiness test passes for all of them. ?det=constructor used
   * to throw inside compose() — from fromURL(), which runs at the top of init()
   * outside any try/catch, so the whole console failed to build. ?mat=toString
   * was quieter and worse: eight NaN parameters, simulated. */
  const PROTO = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'isPrototypeOf'];
  const baseline = JSON.stringify(M.compose({}));
  let threw = null, nanned = null, drifted = null;
  /* `traits` is on this list because it is the one axis that was NOT on it.
   * The guard was threaded through the four single-select tables and missed
   * the only one taking a list, so `?traits=constructor` still resolved the
   * Object constructor and dereferenced its absent `.m` in the coverage-cap
   * loop — a TypeError out of fromURL(), which runs at the top of init()
   * outside any try/catch. The check is written over every axis compose reads,
   * derived from nothing, so a fifth axis is covered the day it is added. */
  const AXES = ['exposure', 'attention', 'maturity', 'detection', 'traits'];
  PROTO.forEach((k) => {
    AXES.forEach((axis) => {
      const opts = {};
      /* traits takes a list; every other axis takes a bare key. The point of
       * the case is that the difference is where the guard went missing. */
      opts[axis] = axis === 'traits' ? [k] : k;
      try {
        const c = M.compose(opts);
        const bad = Object.keys(c).filter((x) => !isFinite(c[x]));
        if (bad.length && !nanned) nanned = `${axis}=${k} -> ${bad.join(',')}`;
        if (JSON.stringify(c) !== baseline && !drifted) drifted = `${axis}=${k}`;
      } catch (e) {
        if (!threw) threw = `${axis}=${k} -> ${e.message}`;
      }
      /* And again with a detection posture selected, which is the combination
       * that actually threw: the coverage cap is the only place a trait's `.m`
       * is dereferenced, and it only runs when a posture is set. */
      try {
        const opts2 = { detection: 'edr' };
        opts2[axis] = opts[axis];
        M.compose(opts2);
      } catch (e) {
        if (!threw) threw = `${axis}=${k} with a posture -> ${e.message}`;
      }
    });
  });
  ok('an inherited Object.prototype key cannot throw out of compose()', threw === null, threw || '');
  ok('an inherited key cannot compose a non-finite parameter', nanned === null, nanned || '');
  ok('an unknown shape key falls back to the default estate', drifted === null, drifted || '');
  near('a posture is unrestricted where no trait suppresses coverage',
    P({ detection: 'managed' }).edrCoverage, M.DETECTION.managed.p.edrCoverage, 5);

  /* Shaping an estate must not move the reader's scenario. compose() forwarded
   * `ai` by name, which was right while `ai` was the only dial and wrong the
   * moment it was split into three: every selector click — exposure, trait,
   * maturity, detection posture — silently reset `weap` and `tempo` to zero
   * and left `ai` standing, so the page's central comparison could not be held
   * while configuring an estate. Asserted over M.SCENARIO rather than over a
   * written-out list, so a fourth dial is covered by construction. */
  {
    const dialled = {};
    M.SCENARIO.forEach((k, i) => { dialled[k] = 40 + i * 20; });
    const shapes = [
      { exposure: 'others' }, { attention: 'named' }, { traits: ['ot'] },
      { maturity: 'tight' }, { detection: 'managed' },
    ];
    const lost = [];
    shapes.forEach((shape) => {
      const c = M.compose(Object.assign({}, shape, dialled));
      M.SCENARIO.forEach((k) => {
        if (c[k] !== dialled[k]) lost.push(`${Object.keys(shape)[0]} reset ${k} to ${c[k]}`);
      });
    });
    ok('shaping the estate carries every scenario dial through', lost.length === 0,
      lost.length ? lost.join('; ') : M.SCENARIO.join(', ') + ' held across ' + shapes.length + ' shapes');

    /* The dials are scenario, so no shape table may claim one as a term. */
    const tables = { EXPOSURE: M.EXPOSURE, TRAITS: M.TRAITS, ATTENTION: M.ATTENTION };
    const claimed = [];
    Object.keys(tables).forEach((name) => {
      Object.keys(tables[name]).forEach((key) => {
        M.SCENARIO.forEach((d) => {
          if (tables[name][key].m && d in tables[name][key].m) claimed.push(`${name}.${key}.${d}`);
        });
      });
    });
    ok('no shape table drives a scenario dial', claimed.length === 0, claimed.join(','));

    /* An absent dial falls back to its own default, never to zero — which is
     * what keeps compose({}) identical to defaults(). */
    const bare = M.compose({ maturity: 'loose' });
    ok('an unset dial keeps its default rather than collapsing to zero',
      M.SCENARIO.every((k) => bare[k] === M.defaults()[k]),
      M.SCENARIO.map((k) => `${k}=${bare[k]}`).join(' '));
  }

  /* The two tables that used to overlap must stay disjoint. 'legacy' set the
   * same four terms in the same direction as MATURITY.loose, so selecting both
   * counted one weakness twice; nothing in TRAITS may touch the maturity axis
   * wholesale again. */
  {
    const matAxis = ['cadence', 'emergH', 'emergHit', 'awareH', 'virtual', 'inventory'];
    const overlap = keys.filter(k => {
      const m = Object.keys(M.TRAITS[k].m);
      return matAxis.every(x => m.indexOf(x) >= 0);
    });
    ok('no trait duplicates the whole maturity axis', overlap.length === 0, overlap.join(','));
    ok('the retired keys are gone from TRAITS',
      ['saas', 'corponly', 'hosting', 'legacy', 'regulated'].every(k => !M.TRAITS[k]),
      Object.keys(M.TRAITS).join(','));
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * 13c. The three scenario clocks, and the scope they sit in.
 *
 *      These were one slider named after the weakest of the three effects it
 *      carried, and a chart that could not show the difference. The tests
 *      below pin the separation: each dial has to move its own mechanism and
 *      nothing else, and tempo in particular has to be provably post-
 *      compromise or the page's second headline claim is unsupported.
 * ───────────────────────────────────────────────────────────────────────── */
{
  const base = run({});

  /* Post-exploitation tempo cannot change whether you were breached — only
   * whether anyone reached it in time. The containment draw takes the same
   * number of RNG values in every branch, so the compromise figure is not
   * merely close under a faster adversary, it is bit-identical. An inequality
   * here means tempo has leaked into the pre-compromise path. */
  const fast = run({ tempo: 100 });
  ok('post-exploitation tempo leaves compromise bit-identical',
    fast.p === base.p, `${fmt(fast.p)} vs ${fmt(base.p)}`);
  ok('post-exploitation tempo raises the incident rate',
    fast.incident > base.incident + 0.005,
    `${fmt(base.incident)} -> ${fmt(fast.incident)}`);

  /* The finding the sweep chapter now rests on: a faster adversary does not
   * defeat detection by beating it on any one intrusion, it defeats the
   * INVESTMENT, by collapsing the distance between the best posture and none
   * at all. If this ever falls back below half, the chapter is overstating. */
  const incAt = (det, tempo) => M.simulate(
    Object.assign(M.compose({ detection: det }), { tempo }),
    20000, 1234, { surv: false, spread: 0 }).incident;
  const gapSlow = incAt('none', 0) - incAt('managed', 0);
  const gapFast = incAt('none', 100) - incAt('managed', 100);
  ok('detection is worth something against a reported-tempo adversary',
    gapSlow > 0.05, `${(gapSlow * 100).toFixed(1)}pt`);
  ok('adversary tempo erodes most of what detection buys',
    gapFast < gapSlow * 0.5,
    `${(gapSlow * 100).toFixed(1)}pt -> ${(gapFast * 100).toFixed(1)}pt`);

  /* Named after the right mechanism. The page argues that the clock everyone
   * means by "AI" is the one with least room left to move; that argument is
   * only honest if the arithmetic agrees, so it is asserted rather than
   * asserted-in-prose. */
  const dSpeed = run({ ai: 100 }).p - base.p;
  const dWeap = run({ weap: 100 }).p - base.p;
  ok('the arrival clock is the weaker of the two exploit-side dials',
    dWeap > dSpeed * 1.5,
    `speed +${(dSpeed * 100).toFixed(1)}pt vs weaponisation +${(dWeap * 100).toFixed(1)}pt`);

  /* A link shared before the split carried one `ai=N` meaning all three
   * effects. js/app.js restores the weaponisation term when a URL has `ai`
   * and no `weap`; the model's own fallback is what that relies on. */
  const legacy = M.defaults();
  legacy.ai = 100;
  delete legacy.weap;
  const both = Object.assign(M.defaults(), { ai: 100, weap: 100 });
  ok('a pre-split ai=N resolves to the estate its author published',
    M.simulate(legacy, 20000, 1234, { surv: false, spread: 0 }).p ===
    M.simulate(both, 20000, 1234, { surv: false, spread: 0 }).p);

  /* SCOPE is what lets the page state its coverage next to the headline
   * instead of in a footer. It is load-bearing copy, so it is checked. */
  const S = M.SCOPE;
  ok('SCOPE names one modelled route per simulated route',
    S.modelled.length === M.ROUTES.length,
    `${S.modelled.length} vs ${M.ROUTES.length}`);
  ok('SCOPE names the routes that are absent', S.excluded.length >= 3 &&
    S.excluded.join(' ').toLowerCase().includes('phishing'));
  ok('SCOPE carries a cited, in-range coverage share',
    S.vulnShareOfBreaches > 0 && S.vulnShareOfBreaches < 1 && !!S.src,
    `${(S.vulnShareOfBreaches * 100).toFixed(0)}% per ${S.src}`);
  ok('SCOPE points at a proxy that is a real slider',
    M.SPEC.def.concat(M.SPEC.att).some((x) => x.k === S.proxy), S.proxy);
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
