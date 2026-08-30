#!/usr/bin/env node
/* Renders every chart headlessly and checks it against the page that hosts it.
 *
 *   node tools/check-layout.js
 *
 * Why this exists. js/charts.js is 700 lines of browser-only drawing code and
 * CI could say nothing about it beyond `node --check`: it parses. Everything
 * it actually does — what it computes, what it hands the renderer, how tall it
 * comes out — was covered by nothing, because running it needs a DOM.
 *
 * It needs much less of a DOM than that suggests. The chart functions build
 * SVG through createElementNS/setAttribute/appendChild and read almost nothing
 * back, so a thirty-line shim that records what they set is enough to run them
 * for real. Not a mock of the charts: the real functions, over a real
 * simulation result, with the real palette read out of css/app.css.
 *
 * Three classes of failure are caught here, all of them observed:
 *
 *   1. Reserved height against drawn height. index.html holds a `height` open
 *      on each <svg> before any script runs. The sensitivity chart grew from
 *      thirteen levers to seventeen and the markup went on reserving thirteen,
 *      so the settle pass shoved a screen and a half of document down by 100px
 *      the moment it landed. Neither side could see the other; now the build
 *      can see both.
 *
 *   2. Attributes that are not values. An undefined palette token or a divide
 *      by zero reaches the renderer as fill="undefined" or width="NaN", and an
 *      SVG renderer's response to either is to draw nothing at all — so the
 *      page reads as merely sparse rather than as broken. That is the same
 *      failure tools/check-contrast.js guards from the stylesheet side; this is
 *      the other end of it.
 *
 *   3. Malformed figures in labels. A negative printed under a hardcoded minus
 *      sign reads "--962%", which is what the attrition funnel showed before
 *      stage 3 counted the out-of-inventory estate.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ── the smallest DOM these functions actually touch ──────────────────────── */
function node(tag) {
  const n = {
    tagName: tag,
    attrs: {},
    childNodes: [],
    id: '',
    _text: '',
    style: { setProperty: (k, v) => { n.attrs['style:' + k] = v; } },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return k in this.attrs ? String(this.attrs[k]) : null; },
    appendChild(c) { this.childNodes.push(c); return c; },
    removeChild(c) {
      const i = this.childNodes.indexOf(c);
      if (i >= 0) this.childNodes.splice(i, 1);
      return c;
    },
    get firstChild() { return this.childNodes[0] || null; },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
  };
  return n;
}
global.document = {
  createElementNS: (ns, tag) => node(tag),
  createElement: (tag) => node(tag),
};

const CHARTS = require(path.join(ROOT, 'js', 'charts.js'));
const MODEL = require(path.join(ROOT, 'js', 'model.js'));
const CAL = require(path.join(ROOT, 'js', 'calibration.js'));

/* ── the real palette, read off the stylesheet ────────────────────────────── */
const CSS = read('css/app.css');
const rootBlock = CSS.match(/:root\s*\{([\s\S]*?)\n\}/);
if (!rootBlock) throw new Error('could not find the :root token block in css/app.css');
const TOKENS = {};
for (const d of rootBlock[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) TOKENS[d[1]] = d[2];
/* Falling back to '' rather than leaving the key undefined, because that is
 * what the browser does: palette() in js/app.js reads each token with
 * getPropertyValue(), which returns the EMPTY STRING for a custom property
 * that is not defined — never undefined. The distinction decides whether this
 * gate can see the failure at all. el() in js/charts.js skips an undefined
 * attribute, so an undefined token silently draws an unfilled mark and the
 * gate passes; an empty string is set, reaches the renderer as fill="", and
 * paints nothing. Mimicking the wrong one made this check a no-op. */
const PAL = {};
['ink', 'panel', 'sunk', 'rule', 'rule2', 'txt', 'mut', 'dim', 'att', 'def', 'bad', 'zero', 'warn']
  .forEach((k) => { PAL[k] = TOKENS[k] === undefined ? '' : TOKENS[k]; });

/* ── the sensitivity chart is one row per LEVERS entry ────────────────────── */
/* LEVERS lives in js/app.js, which is browser-only and cannot be required
 * here. Its length is the whole subject of gate 1, so it is counted out of the
 * source — and the count is asserted, because a regex that quietly stopped
 * matching would turn this into a gate certifying a chart of zero rows. That
 * is the failure mode tools/check-contrast.js already guards against where it
 * parses palette() out of the same file. */
const APP = read('js/app.js');
const leverBlock = APP.match(/var LEVERS = \[([\s\S]*?)\n {2}\];/);
if (!leverBlock) {
  throw new Error('could not find LEVERS in js/app.js, so this gate cannot size the sensitivity chart');
}
const LEVER_N = (leverBlock[1].match(/\{ k: /g) || []).length;
if (LEVER_N < 5) {
  throw new Error('LEVERS in js/app.js parsed to only ' + LEVER_N +
    ' rows — the extractor in this gate has stopped matching it');
}

/* ── one real run to draw from ────────────────────────────────────────────── */
const P = MODEL.defaults();
const R = MODEL.simulate(P, 4000, 1234, { surv: true, spread: 1 });
const DENS = MODEL.densities(P, 4000);
const LEVER_ROWS = [];
for (let i = 0; i < LEVER_N; i++) {
  LEVER_ROWS.push({ k: 'k' + i, l: 'Lever ' + i, lo: 0.09, hi: 0.44, span: 0.35 });
}
/* The palette tokens js/app.js's CLOCKS actually uses — one per dial. This
 * list ran short of MODEL.SCENARIO once, which handed the fourth series an
 * undefined colour; el() silently drops an undefined attribute, so the gate
 * rendered a strokeless, invisible curve and its attribute checks could not
 * see the loss. The guard below makes a short list a build failure. */
const SERIES_COLOURS = ['warn', 'att', 'zero', 'bad'];
if (SERIES_COLOURS.length < MODEL.SCENARIO.length) {
  throw new Error('SERIES_COLOURS has ' + SERIES_COLOURS.length +
    ' entries for ' + MODEL.SCENARIO.length + ' scenario dials — a curve would render invisible');
}
const SERIES = MODEL.SCENARIO.map((k, i) => ({
  k: k, l: 'Scenario dial ' + k, c: SERIES_COLOURS[i],
  cur: 0, curY: R.p, pts: [[0, R.p], [50, 0.33], [100, 0.41]],
}));

const CHART = {
  race: (svg, w) => CHARTS.race(svg, w, DENS, PAL),
  funnel: (svg, w) => CHARTS.funnel(svg, w, R, MODEL.FUNNEL, PAL),
  /* The gates rows are derived from MODEL.ACCESS exactly as js/app.js derives
   * them, for the same reason the routes rows below are. */
  gates: (svg, w) => CHARTS.gates(svg, w, R, PAL,
    Object.keys(MODEL.ACCESS).filter((k) => !MODEL.ACCESS[k].vuln).map((k) => ({
      key: k, label: MODEL.ACCESS[k].l, short: MODEL.ACCESS[k].l.split(' ')[0],
      gate: 'control chain',
    }))),
  ladder: (svg, w) => CHARTS.ladder(svg, w,
    Object.keys(MODEL.IDENTITY).map((k, i) => ({
      k: k, l: MODEL.IDENTITY[k].l, v: 0.82 - i * 0.08, cur: k === MODEL.DEFAULT_IDENTITY,
    })), PAL),
  torn: (svg, w) => CHARTS.tornado(svg, w, LEVER_ROWS, R.p, PAL),
  /* The access classes are passed in by js/app.js rather than held inside the
   * chart, so the harness has to supply them too — derived from MODEL.ACCESS
   * the same way, or this gate would measure a chart drawn with no rows. */
  routes: (svg, w) => CHARTS.routes(svg, w, R, PAL, MODEL.SCOPE,
    Object.keys(MODEL.ACCESS).map((k) => ({
      key: k, label: MODEL.ACCESS[k].l, short: MODEL.ACCESS[k].l.split(' ')[0],
    }))),
  surv: (svg, w) => CHARTS.survival(svg, w, R, PAL),
  sweep: (svg, w) => CHARTS.sweep(svg, w, SERIES, PAL),
  severity: (svg, w) => CHARTS.severity(svg, w, CAL, PAL),
  volume: (svg, w) => CHARTS.volume(svg, w, CAL, PAL),
};

/* ── walk a drawn chart and judge it ──────────────────────────────────────── */
/* "--" catches a minus sign printed in front of a value that is already
 * negative; the funnel builds one by hand. The rest are the ways an absent
 * number reaches a label. */
const BAD_TEXT = /NaN|undefined|null|−-|--\d/;
const BAD_ATTR = /NaN|undefined/;

function walk(n, visit) {
  visit(n);
  n.childNodes.forEach((c) => walk(c, visit));
}

const fails = [];
const rows = [];
const WIDE = 840, NARROW = 360;
const drawn = {};

Object.keys(CHART).forEach((id) => {
  [WIDE, NARROW].forEach((w) => {
    const svg = node('svg');
    svg.id = id;
    try {
      CHART[id](svg, w);
    } catch (e) {
      fails.push(id + ' at ' + w + 'px threw while drawing: ' + e.message);
      return;
    }
    const label = (w === WIDE ? 'wide  ' : 'narrow') + '  ' + id;

    /* gate 2 and 3: nothing reaches the renderer that is not a value, and no
     * label carries a figure the arithmetic failed to produce */
    let attrs = 0, texts = 0;
    walk(svg, (el) => {
      Object.keys(el.attrs).forEach((k) => {
        attrs++;
        const v = el.attrs[k];
        const bad = v === '' || v === undefined || v === null ||
          (typeof v === 'number' && !isFinite(v)) ||
          (typeof v === 'string' && BAD_ATTR.test(v));
        if (bad) {
          fails.push(label + ': <' + el.tagName + ' ' + k + '="' + v +
            '"> is not a value — an SVG renderer draws nothing for it');
        }
      });
      if (el._text) {
        texts++;
        if (BAD_TEXT.test(el._text)) fails.push(label + ': label reads "' + el._text + '"');
      }
    });

    /* gate 1: the box it drew is the box it says it drew */
    const h = Number(svg.getAttribute('height'));
    const vb = (svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    if (!isFinite(h) || h <= 0) fails.push(label + ': height is ' + svg.getAttribute('height'));
    if (vb[3] !== h || vb[2] !== Number(svg.getAttribute('width'))) {
      fails.push(label + ': viewBox "' + svg.getAttribute('viewBox') +
        '" disagrees with width/height ' + svg.getAttribute('width') + 'x' + svg.getAttribute('height'));
    }
    rows.push([label, w + 'x' + h, attrs + ' attrs', texts + ' labels']);
    if (w === WIDE) drawn[id] = h;
  });
});

/* ── gate 3, against the estate that actually broke it ───────────────────── */
/* The loop above draws the default estate, and the default estate is one of
 * the ones that never inverted the funnel. The two sliders that do — virtual
 * patching, and a fifth of the estate outside inventory — are ordinary
 * settings a reader reaches in two clicks, so the chart is drawn once more
 * against them. The model-side property is asserted in test/model.test.js;
 * this is the rendering half of the same finding, and the one that would have
 * shown a reviewer the "--962%" rather than a number in an array. */
const STRESSED = MODEL.simulate(
  Object.assign(MODEL.defaults(), { virtual: 80, inventory: 80, exposed: 2000, stackVulns: 200, edge: 0 }),
  4000, 1234, { surv: true, spread: 1 });
[WIDE, NARROW].forEach((w) => {
  const svg = node('svg');
  svg.id = 'funnel';
  CHARTS.funnel(svg, w, STRESSED, MODEL.FUNNEL, PAL);
  walk(svg, (el) => {
    if (el._text && BAD_TEXT.test(el._text)) {
      fails.push('funnel over a shielded estate with an inventory gap, at ' + w +
        'px: label reads "' + el._text + '"');
    }
  });
});
for (let i = 1; i < STRESSED.fn.length; i++) {
  if (STRESSED.fn[i] > STRESSED.fn[i - 1] + 1e-9) {
    fails.push('the funnel inverts at stage ' + i + ' over a shielded estate with an ' +
      'inventory gap (' + STRESSED.fn[i - 1].toFixed(2) + ' -> ' + STRESSED.fn[i].toFixed(2) +
      '), so the chart draws a subset wider than its superset');
  }
}

/* gate 1, second half: against what index.html holds open for it */
const HTML = read('index.html');
const reserved = {};
for (const m of HTML.matchAll(/<svg id="(\w+)"[^>]*\bheight="(\d+)"/g)) reserved[m[1]] = Number(m[2]);
Object.keys(CHART).forEach((id) => {
  if (!(id in reserved)) {
    fails.push('index.html has no <svg id="' + id + '"> reserving a height');
  } else if (reserved[id] !== drawn[id]) {
    fails.push('index.html reserves height="' + reserved[id] + '" for #' + id +
      ' but js/charts.js draws ' + drawn[id] + 'px at desktop width — the document below it ' +
      'moves ' + Math.abs(reserved[id] - drawn[id]) + 'px when the chart lands');
  }
});

/* ── gate 4: every element js/app.js reaches for exists in the markup ─────── */
/* js/app.js dereferences the result of `$(id)` unguarded in about thirty
 * places — `$('acts-metric').textContent`, `$('theme-btn').addEventListener`
 * and so on. Each of those is a TypeError the moment an id is renamed in one
 * file and not the other, and where it lands decides how bad it is: inside
 * init() the whole console fails to build, and inside a render path four
 * charts silently freeze on the previous estate.
 *
 * Guarding each call site would be thirty null checks defending a contract
 * that is trivially checkable in full, once, here. So the contract is checked
 * instead and the call sites stay readable.
 *
 * Literal lookups only. A composed one — `$(id + '-ci')` in setStat — is not
 * part of this contract and must not be inferred into it: setStat guards that
 * result before touching it, precisely so a stat slot can exist without an
 * interval beside it, which is how the docked readout is built. Deriving the
 * suffixed ids here anyway reported #dock-v-ci as missing, which is a rule
 * this gate had invented rather than a defect in the page. */
const LOOKUP = /\$\('([a-z0-9-]+)'\)/g;
const UNGUARDED = new Set([...APP.matchAll(/\$\('([a-z0-9-]+)'\)\s*\./g)].map((m) => m[1]));
/* Every literal lookup, not only the unguarded ones. A guarded lookup that
 * resolves to nothing does not throw, which is worse rather than better: the
 * function returns early and whatever it was going to do — the docked readout,
 * an export button, the trait notes — silently never happens. Both are worth a
 * build failure, and neither has a false positive to trade against. */
const wanted = new Set([...APP.matchAll(LOOKUP)].map((m) => m[1]));
if (wanted.size < 20) {
  throw new Error('only ' + wanted.size + ' element lookups parsed out of js/app.js — ' +
    'the extractor in this gate has stopped matching them');
}
const htmlIds = new Set([...HTML.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
[...wanted].sort().forEach((id) => {
  if (!htmlIds.has(id)) {
    fails.push('js/app.js looks up $(\'' + id + '\') but index.html has no element with ' +
      'that id' + (UNGUARDED.has(id)
        ? ', and dereferences it without a null check — a TypeError wherever that is reached from'
        : ' — the lookup is guarded, so the work behind it silently never happens'));
  }
});
console.log(wanted.size + ' element ids looked up by js/app.js (' + UNGUARDED.size +
  ' of them unguarded), all present in index.html.\n');

const cols = [0, 1, 2, 3].map((i) => Math.max.apply(null, rows.map((r) => r[i].length)));
rows.forEach((r) => console.log(r.map((c, i) => c.padEnd(cols[i])).join('  ')));
console.log('\n' + LEVER_N + ' levers in js/app.js -> #torn draws ' + drawn.torn +
  'px; index.html reserves ' + reserved.torn + 'px.');

if (fails.length) {
  console.error('\n' + fails.length + ' render/layout failure(s):');
  fails.forEach((f) => console.error('  - ' + f));
  process.exit(1);
}
console.log('OK — ' + Object.keys(CHART).length + ' charts drawn at two widths, ' +
  rows.reduce((a, r) => a + parseInt(r[2], 10), 0) + ' attributes, heights match the markup.');
