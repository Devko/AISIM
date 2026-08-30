#!/usr/bin/env node
/* Exposure Race — deck export gate.
 *
 *   node tools/check-deck.js
 *
 * js/deck.js is the third piece of browser-only code, and the one with the
 * most to lose from going untested: a deck travels without the page, so a
 * figure it gets wrong has nothing around it to correct it. The parse gate
 * proves it compiles. This proves the three things that actually matter.
 *
 * First, that it reports the reader's run rather than a stored answer. Every
 * figure on a slide is asserted twice — once against a run, and once against
 * a different run — because a number that does not move between the two was
 * written into the copy rather than read from the result.
 *
 * Second, that the scope limit cannot be separated from the figures. This deck
 * exists to be handed to people who were not on the page, and its output is a
 * lower bound rather than a risk assessment. Slides get pulled out of decks
 * one at a time, so the caveat has to be on the slides carrying numbers.
 *
 * Third, that the PDF is structurally valid — the xref is byte offsets into
 * the file, so it is exactly the kind of thing that is either perfect or
 * catastrophic, with nothing in between to notice in review.
 *
 * The slide LAYOUT needs a DOM and is not covered here; tools/check-layout.js
 * is the precedent for how far that can be taken if it ever needs to be.
 */
'use strict';

const DECK = require('../js/deck.js');
const CAL = require('../js/calibration.js');
const M = require('../js/model.js');

let failed = 0;
function ok(name, cond, detail) {
  if (cond) { console.log('  ok    ' + name); return; }
  failed++;
  console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
}
function section(s) { console.log('\n' + s); }

/* Two genuinely different estates, each simulated rather than invented, so
 * "does this figure move" is asked of real model output. */
function runFor(opts, over) {
  const P = Object.assign(M.compose(opts), over || {});
  return M.simulate(P, 20000, 1234, { surv: true, spread: 1 });
}
const RUN_A = runFor({ exposure: 'web', attention: 'ordinary', maturity: 'typical', detection: 'edr' });
const RUN_B = runFor({ exposure: 'product', attention: 'named', maturity: 'loose', detection: 'none' });

function ctxFor(run, over) {
  return Object.assign({
    cal: CAL, run: run, metric: 'p', scope: M.SCOPE,
    estate: '100 exposed systems · 25% appliances',
    dateLabel: '30 August 2026',
    url: 'https://devko.github.io/AISIM/?exposed=100&cadence=14',
    config: [
      { l: 'What strangers can reach', v: 'Internet-facing product' },
      { l: 'Adversary attention', v: 'Named-target interest' },
    ],
    params: [{ l: 'Exposed systems', v: '100' }, { l: 'Criticals a year in your stack', v: '34' }],
    actions: [
      { k: 'stackVulns', title: 'Reduce edge software footprint', detail: 'Each exposed product commits you to its vulnerability stream.', gain: 0.081 },
      { k: 'exposed', title: 'Reduce the exposed attack surface', detail: 'Fewer reachable systems reduces every other term.', gain: 0.047 },
    ],
    /* Shaped the way js/app.js builds them, and empty when there is no run —
     * which is the state the page is in for the first few hundred
     * milliseconds after load, and the one a reader can click into. */
    funnel: run ? M.FUNNEL.map((l, i) => ({ l: l, v: run.fn[i].toFixed(2) })) : [],
    routeRows: run ? run.routes.map((s, i) => ({ l: M.ROUTES[i], v: (s * 100).toFixed(1) + '%' })) : [],
    sens: run ? {
      base: run.p, rows: [{ k: 'exposed' }],
      sweep: [
        { k: 'ai', l: 'Exploit arrival speed', pts: [[0, run.p], [100, run.p + 0.028]] },
        { k: 'weap', l: 'Share of bugs weaponised', pts: [[0, run.p], [100, run.p + 0.089]] },
        { k: 'tempo', l: 'Post-exploitation tempo', pts: [[0, run.p], [100, run.p + 0.001]] },
      ],
    } : null,
    soc: { reported: 0.093, full: 0.022 },
  }, over || {});
}

/* Everything a slide could print, flattened, so a claim can be looked for
 * without caring which field of which slide carries it. */
function textOf(slides) {
  return slides.map((s) => [
    s.eyebrow, s.title, s.short, s.long, s.note, s.estate, s.fence, s.link,
    s.stat ? s.stat.v + ' ' + s.stat.l + ' ' + s.stat.tag : '',
    (s.rows || []).map((r) => r.l + ' ' + r.v).join(' '),
    (s.acts || []).map((a) => a.title + ' ' + a.detail + ' ' + a.gain).join(' '),
  ].filter(Boolean).join(' ')).join('\n');
}
const pct1 = (n) => (n * 100).toFixed(1) + '%';

section('The deck reports a run, or it does not exist');
{
  ok('no run means no deck at all', DECK._slides(ctxFor(null)).length === 0);

  const internal = DECK._slides(ctxFor(RUN_A));
  const carousel = internal.filter((s) => s.only !== 'internal');
  ok('a run produces a deck', internal.length > 8);
  ok('carousel drops the internal-only slides',
    carousel.length < internal.length && !carousel.some((s) => s.only === 'internal'));
  ok('every slide has a title', internal.every((s) => s.title));
  ok('every carousel slide is written in the carousel register',
    carousel.every((s) => s.short || s.estate || s.acts || s.link),
    carousel.filter((s) => !(s.short || s.estate || s.acts || s.link)).map((s) => s.id).join(', '));

  /* The order is the argument the deck makes: this is what you told it, this
   * is what came out, this is why, this is what to do. Shuffling it would
   * still produce a valid deck and a much worse one. */
  const order = internal.map((s) => s.id);
  const seq = ['cover', 'headline', 'readout', 'actions', 'estate', 'reproduce'];
  let at = -1, inOrder = true;
  seq.forEach((id) => { const i = order.indexOf(id); if (i <= at) inOrder = false; at = i; });
  ok('result precedes recommendation precedes configuration', inOrder, order.join(' > '));

  /* The deck opened with the configuration and buried the number four slides
   * in. Somebody handed this PDF wants the result and what to do about it;
   * the estate is what qualifies those, not what introduces them. Asserted
   * as a position, because "results first" is the kind of intent that erodes
   * one convenient insertion at a time. */
  ok('the result is in the first three slides',
    order.indexOf('headline') <= 2, order.slice(0, 4).join(' > '));
  ok('the readout bank travels in both decks',
    carousel.some((s) => s.id === 'readout'),
    'it was internal-only, which split four figures meant to be read together');
  ok('every graph-bearing slide precedes the configuration',
    ['drivers', 'routes', 'funnel', 'scenario'].every((id) =>
      order.indexOf(id) < 0 || order.indexOf(id) < order.indexOf('estate')),
    order.join(' > '));
}

section('Figures come from the run, not the copy');
{
  const a = textOf(DECK._slides(ctxFor(RUN_A)));
  const b = textOf(DECK._slides(ctxFor(RUN_B)));

  ok('the headline is the run’s compromise probability', a.indexOf(pct1(RUN_A.p)) >= 0,
    'expected ' + pct1(RUN_A.p));

  /* The result slide carries a chart too, and the layout rule elsewhere is
   * that a chart displaces the headline figure. On this one slide that trade
   * is backwards — the percentage is what the deck was opened for — so the
   * slide has to say so explicitly, and it dropped the number until it did. */
  const head = DECK._slides(ctxFor(RUN_A)).filter((x) => x.id === 'headline')[0];
  ok('the result slide keeps its figure even when it carries a chart',
    head.keepStat === true && head.stat && head.stat.v === pct1(RUN_A.p));
  ok('the headline moves with the estate',
    b.indexOf(pct1(RUN_B.p)) >= 0 && a.indexOf(pct1(RUN_B.p)) < 0,
    'RUN_A ' + pct1(RUN_A.p) + ' vs RUN_B ' + pct1(RUN_B.p));
  /* The band is only quoted once it has settled. At the trial count this test
   * runs, it has not — and the deck saying so is the behaviour worth keeping:
   * a slide that prints an interval the run did not earn is worse than one
   * that admits the interval is not ready, because the interval is the part a
   * reader will quote as the range. */
  const settled = Object.assign({}, RUN_A, { bandReliable: true });
  const withBand = textOf(DECK._slides(ctxFor(settled)));
  /* "90% band", the page's own label for the same interval — the deck used to
   * say "90% uncertainty band" and the two surfaces printed one quantity two
   * ways. The regex asserts the label, not any adjective inside it. */
  ok('a settled band is quoted beside the figure',
    withBand.indexOf(pct1(RUN_A.pLo)) >= 0 && withBand.indexOf(pct1(RUN_A.pHi)) >= 0 &&
    /90% band/.test(withBand));
  /* The property, not the phrase, for the same reason as the scope gate below:
   * the slide has to SAY the band is not ready and must not print it. Which
   * adjective it uses for the band is a copy decision, not a contract. */
  ok('an unsettled band is declared rather than printed',
    /band has not settled/.test(a) && a.indexOf(pct1(RUN_A.pHi)) < 0,
    'bandReliable was ' + RUN_A.bandReliable);

  /* The metric toggle is a different question, not a different presentation. */
  const inc = textOf(DECK._slides(ctxFor(RUN_A, { metric: 'incident' })));
  ok('the incident metric reports the incident probability',
    inc.indexOf(pct1(RUN_A.incident)) >= 0 && /incident in 12 months/.test(inc));

  ok('the funnel reprints the run’s stages',
    a.indexOf(RUN_A.fn[0].toFixed(2)) >= 0 && a.indexOf(RUN_A.fn[5].toFixed(2)) >= 0);
  ok('the route split is the run’s', a.indexOf((RUN_A.routes[0] * 100).toFixed(1) + '%') >= 0);

  /* A simulation result handed straight to a slide prints as
   * 34.01538333333333. Every figure that reaches a deck has to have been
   * through a formatter, and the cheapest way to assert that is that none of
   * them carries more precision than a person would ever read aloud. */
  const raw = (a + '\n' + b).match(/\d+\.\d{4,}/g);
  ok('no unformatted simulation output reaches a slide', !raw,
    raw ? 'raw values printed: ' + raw.slice(0, 4).join(', ') : '');
}

section('Configuration and recommendations are the reader’s own');
{
  const s = DECK._slides(ctxFor(RUN_A));
  const t = textOf(s);
  ok('the estate slide reprints what was configured',
    t.indexOf('Internet-facing product') >= 0 && t.indexOf('Named-target interest') >= 0);
  ok('the parameters the controls compose to are shown',
    t.indexOf('Criticals a year in your stack') >= 0);

  const acts = s.filter((x) => x.id === 'actions')[0];
  ok('the recommendations are the ranked list it was handed',
    acts.acts.length === 2 && acts.acts[0].title === 'Reduce edge software footprint');
  ok('each recommendation reports what it buys here',
    acts.acts[0].gain === 0.081 && acts.acts[1].gain === 0.047);
  ok('each recommendation carries its reason', acts.acts.every((x) => x.detail));
  ok('the gain is named as a reduction for this estate',
    /reduction in the annual probability/i.test(acts.note));

  /* An estate where nothing a defender controls moves the number is a real
   * outcome, not an empty slide — and saying so is the finding. */
  const empty = DECK._slides(ctxFor(RUN_A, { actions: [] })).filter((x) => x.id === 'actions')[0];
  ok('no material lever is reported as a finding, not a blank',
    /No defender parameter moves this materially/.test(empty.title) &&
    /routes the remediation process does not reach/i.test(empty.long));

  const rep = s.filter((x) => x.id === 'reproduce')[0];
  ok('the deck carries the configured link, with its state',
    rep.link.indexOf('exposed=100') >= 0 && rep.link.indexOf('cadence=14') >= 0);
}

section('The scope limit cannot be separated from the figures');
{
  const s = DECK._slides(ctxFor(RUN_A));
  const head = s.filter((x) => x.id === 'headline')[0];
  /* The property, not a hardcoded route name. This asserted /phishing/ back
   * when phishing was excluded; phishing is now simulated, and the check went
   * on demanding that a slide name it as absent. Both lists live on the model,
   * so read the first excluded class from there — the gate then survives a
   * route moving from one list to the other, which is the change it just
   * failed to survive. */
  const absent = M.SCOPE.excluded[0].split(/[ ,]+/)[0];
  const namesAbsent = (v) => new RegExp(absent, 'i').test(v);
  ok('the headline slide states what is not counted',
    namesAbsent(head.short) && namesAbsent(head.long),
    'looking for "' + absent + '" from SCOPE.excluded');
  /* The property, not the phrase. A reader has to be told which DIRECTION the
   * figure is wrong in, and "lower bound" is one way to say that but not the
   * only one — the carousel says the plainer "intrusion risk is higher than
   * this figure". Asserting the exact words would fail an edit that made the
   * slide clearer, which is the opposite of what this gate is for. */
  const understates = (s) => /lower bound/i.test(s) || /higher than this/i.test(s) ||
    /floor, not/i.test(s);
  ok('the headline slide says which way the figure is wrong',
    understates(head.short) && understates(head.long),
    'short: ' + head.short);
  ok('the headline slide refuses the risk-assessment reading',
    /not a risk assessment/i.test(head.note));

  const routes = s.filter((x) => x.id === 'routes')[0];
  ok('the route slide names the routes it does not simulate',
    namesAbsent(routes.note),
    'looking for "' + absent + '" from SCOPE.excluded');

  /* Both lists are three items long, which makes counting one of them next to
   * the other genuinely ambiguous. "Three access routes only — phishing,
   * credential abuse and insider action are not counted" reads as those three
   * BEING the routes, and shipped on the result slide saying the reverse of
   * what the model does. So: any sentence that counts the simulated routes
   * beside the excluded list has to name them too. */
  const strings = [];
  DECK._slides(ctxFor(RUN_A)).forEach((x) => {
    [x.short, x.long, x.note, x.title].forEach((v) => { if (v) strings.push([x.id, v]); });
  });
  const ambiguous = strings.filter(([, v]) =>
    /phishing/i.test(v) && /\b(three|3)\b[^.]*routes/i.test(v) && !/opportunistic/i.test(v));
  ok('no slide counts the simulated routes beside the excluded ones without naming them',
    ambiguous.length === 0,
    ambiguous.map(([id, v]) => id + ': "' + v.slice(0, 90) + '…"').join('\n        '));

  /* The excluded list comes from the model's own declaration, so softening it
   * in the deck is not possible without changing what the page says too. */
  const soft = DECK._slides(ctxFor(RUN_A, {
    scope: Object.assign({}, M.SCOPE, {
      excludedShort: 'Smuggling and telepathy',
      modelled: ['Wishful thinking'],
    }),
  }));
  const softHead = soft.filter((x) => x.id === 'headline')[0];
  /* Both lists, not just one. `credential abuse` used to be proof that the
   * excluded list had been restated in the copy; it is now a MODELLED class
   * and appears legitimately, so the assertion has to name which list it is
   * reading. Doctor both and check each moves independently. */
  ok('the excluded list is read from the model, not restated',
    /smuggling and telepathy/i.test(softHead.short) &&
    !/denial of service/i.test(softHead.short),
    softHead.short);
  ok('the simulated list is read from the model, not restated',
    /wishful thinking/i.test(softHead.long) && !/supply chain/i.test(softHead.long),
    softHead.long);
}

section('Corpus figures still trace to calibration');
{
  const real = textOf(DECK._slides(ctxFor(RUN_A)));
  const c = JSON.parse(JSON.stringify(CAL));
  c.snapshot.cvelist = 'cve_1999-01-01_0000Z';
  c.snapshot.kevCount = 4321;
  c.exploitation.bands.forEach((b) => { if (b.band === '9.0-10.0') b.pExploited = 77.77; });
  const fake = textOf(DECK._slides(ctxFor(RUN_A, { cal: c })));

  [['corpus snapshot', CAL.snapshot.cvelist, 'cve_1999-01-01_0000Z'],
   ['KEV catalogue size', '1,682', '4,321'],
   ['confirmed-exploited rate', '2.87%', '77.77%']].forEach(([what, inReal, inFake]) => {
    ok('quotes the ' + what + ' from calibration', real.indexOf(inReal) >= 0,
      'expected "' + inReal + '"');
    ok('the ' + what + ' moves when the corpus moves',
      fake.indexOf(inFake) >= 0 && fake.indexOf(inReal) < 0,
      'expected "' + inFake + '" and not "' + inReal + '"');
  });
}

section('Carousel copy budget');
{
  const carousel = DECK._slides(ctxFor(RUN_A)).filter((s) => s.only !== 'internal');
  const budget = DECK.FORMATS.carousel.words;
  const over = carousel
    .filter((s) => s.short)
    .map((s) => ({ id: s.id, n: s.short.split(/\s+/).length }))
    .filter((s) => s.n > budget);
  ok('every carousel slide is inside its ' + budget + '-word budget',
    over.length === 0, over.map((s) => s.id + ' has ' + s.n).join(', '));
}

section('PDF writer');
{
  const jpeg = { data: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0xFF, 0xD9]), w: 4, h: 3 };
  let bytes = null;
  const RealBlob = global.Blob;
  global.Blob = function (parts) { bytes = Buffer.concat(parts.map((p) => Buffer.from(p))); };
  const pdf = DECK._PDF(1080, 1350, {
    title: 'T (paren)', author: 'A', subject: 'S', date: 'D:20260101000000Z',
  });
  pdf.addPage(jpeg, [{ text: 'a\\b(c) ≤ 1 day · 2.4×', size: 12, x: 40, y: 100 }]);
  pdf.addPage(jpeg, [{ text: 'second', size: 10, x: 40, y: 100 }]);
  pdf.blob();
  global.Blob = RealBlob;

  const s = bytes.toString('binary');
  ok('starts with a PDF header', s.slice(0, 8) === '%PDF-1.4');
  ok('carries the binary marker so gateways do not translate it',
    bytes[10] === 0xE2 && bytes[11] === 0xE3 && bytes[12] === 0xCF && bytes[13] === 0xD3);
  ok('ends with the EOF marker', /%%EOF\n$/.test(s));

  /* The xref is byte offsets into the file. Every entry must land exactly on
   * the object it claims, or a viewer either repairs the file silently or
   * refuses it. */
  const m = s.match(/xref\n0 (\d+)\n([\s\S]*?)\ntrailer/);
  ok('has an xref table', !!m);
  if (m) {
    const total = Number(m[1]);
    const lines = m[2].split('\n');
    const bad = [];
    for (let n = 1; n < total; n++) {
      const want = n + ' 0 obj';
      if (s.substr(Number(lines[n].slice(0, 10)), want.length) !== want) bad.push(n);
    }
    ok('every xref offset lands on its object', bad.length === 0,
      'objects out of place: ' + bad.join(', '));
    const sx = Number(s.match(/startxref\n(\d+)/)[1]);
    ok('startxref points at the xref table', s.substr(sx, 4) === 'xref');
    ok('the trailer counts every object', s.indexOf('/Size ' + total) >= 0);
  }

  ok('escapes backslashes and parens in the text layer',
    s.indexOf('(a\\\\b\\(c\\)') >= 0);
  ok('transliterates what WinAnsi cannot carry',
    s.indexOf('<= 1 day - 2.4x') >= 0);
  ok('draws the text layer invisible', s.indexOf('3 Tr') >= 0);
  ok('embeds the image as DCTDecode', s.indexOf('/Filter /DCTDecode') >= 0);
  ok('declares both pages', s.indexOf('/Count 2') >= 0);
}

console.log();
if (failed) {
  console.log('FAILED — ' + failed + ' check' + (failed === 1 ? '' : 's'));
  process.exit(1);
}
console.log('OK — the deck reports the reader’s run, carries its scope, and writes a valid PDF.');
