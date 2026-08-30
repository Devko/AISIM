/* Exposure Race — UI wiring.
 *
 * Note on DOM construction: js/calibration.js is regenerated from a network
 * fetch (tools/refresh-data.js). Its contents are therefore treated as data,
 * never as markup — every dynamic value goes in through textContent. innerHTML
 * is used only to clear containers.
 */
(function () {
  'use strict';
  /* Tells the pre-paint script in index.html that this file arrived and is
   * running, so its failsafe does not strip the class that arms the reveals.
   * Set before anything that could throw. */
  document.documentElement.setAttribute('data-live', '');

  var M = window.MODEL, CH = window.CHARTS, C = window.CALIBRATION;

  /* ── state ─────────────────────────────────────────────────────────────── */
  var P = M.defaults();
  var METRIC = 'p';                 /* 'p' = compromise, 'incident' = incident */
  /* Four controls, four questions. EXP and ATTN are single-select ladders —
   * one axis each, so one answer each; ON is the multi-select that carries
   * everything which composes on top of a rung without contradicting it. */
  var EXP = M.DEFAULT_EXPOSURE, ATTN = M.DEFAULT_ATTENTION;
  var ON = [], MAT = 'typical', DET = null;   /* ON = selected traits, multi-select */
  var SEED = 1234, SEED_SENS = 7;
  /* N_HEAVY is set by the credible interval, not by the point estimate: the
   * variance decomposition needs ~150 blocks with enough trials in each. The
   * point estimate is settled long before this. ~116ms on a laptop. */
  var N_FAST = 4000, N_HEAVY = 60000, N_SENS = 5000;

  /* Sliders shown up front. Detection is driven by the posture selector, so the
   * two knobs behind it live in "more" — the reader picks a stack, not a dwell
   * time they have no way to estimate. */
  var BASIC = { exposed: 1, edge: 1, cadence: 1, stackVulns: 1, ai: 1, weap: 1, tempo: 1 };

  /* The three scenario dials drawn together in chapter 07, in the order the
   * chapter argues them: the clock everyone means by "AI", then the two that
   * turn out to matter more. Colours are the shared palette tokens, so the
   * curve and its slider are never a guess apart. */
  var CLOCKS = [
    { k: 'ai',    l: 'Exploit arrival speed',    c: 'warn' },
    { k: 'weap',  l: 'Share of bugs weaponised', c: 'att' },
    { k: 'tempo', l: 'Post-exploitation tempo',  c: 'zero' },
  ];

  /* Motion is opt-in. `ANIM` is what every entry animation in the stylesheet
   * hangs off — it is never set for a reader who has asked for reduced motion,
   * so the page renders complete and static for them rather than relying on an
   * animation having run. `DRAG` suppresses the tween and the chart reveals
   * while a slider is held: the model re-runs faster there than any animation
   * could finish, and a lagging numeral is simply a wrong reading. */
  var ANIM = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var DRAG = false, lastInputAt = 0;
  /* True while the reader is actually working a control — a held pointer, or
   * a held arrow key, which auto-repeats every few tens of milliseconds and
   * would otherwise start a fresh 320ms tween on each press. A tween in that
   * window would show figures the model never produced and lag the truth by
   * its own duration, so live values are painted straight. */
  function live() { return DRAG || (Date.now() - lastInputAt) < 150; }
  /* Script-driven motion reads its curve off the stylesheet rather than
   * restating it, so `--ease` stays the one definition of how this page moves.
   * Resolved once, lazily, because it needs a laid-out document. */
  var easeAt = null;
  function ease() {
    if (easeAt === null) {
      easeAt = (getComputedStyle(document.documentElement)
        .getPropertyValue('--ease') || '').trim() || 'ease-out';
    }
    return easeAt;
  }
  /* Element.animate carries the two motions CSS cannot express here: a
   * distance only measurable at runtime, and a restart on a node that was
   * never replaced. Both are gated on ANIM, so a reader who asked for reduced
   * motion never reaches them — the stylesheet's kill-switch does not apply to
   * script-driven animations. */
  var CAN_ANIMATE = typeof Element !== 'undefined' && !!Element.prototype.animate;

  var $ = function (id) { return document.getElementById(id); };
  var pctS = function (v) { return (v * 100).toFixed(0) + '%'; };
  var num = function (v, d) { return Number(v).toFixed(d === undefined ? 0 : d); };
  var thou = function (v) { return Number(v).toLocaleString('en-US'); };

  /* ── tiny DOM builders ─────────────────────────────────────────────────── */
  function E(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = String(text);
    return e;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      parent.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return parent;
  }
  function b(text) { return E('b', null, text); }
  function empty(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  /* ── theme ─────────────────────────────────────────────────────────────── */
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var b2 = $('theme-btn');
    if (b2) b2.textContent = t === 'dark' ? 'Light' : 'Dark';
    redrawAll();
  }
  function setTheme(t) {
    try { localStorage.setItem('er-theme', t); } catch (e) { /* private mode */ }
    applyTheme(t);
  }
  /* Chart colours are literal hex baked in at draw time, so a page printed
   * from the dark theme puts #E4EFEC labels on white paper — twenty-six of
   * them, invisible. The theme is swapped and the charts redrawn for the
   * duration of the print, then put back. Not persisted: this is not a choice
   * the reader made. */
  var themeBeforePrint = null;
  function bindPrint() {
    if (!window.addEventListener) return;
    window.addEventListener('beforeprint', function () {
      if (currentTheme() !== 'dark') return;
      themeBeforePrint = 'dark';
      applyTheme('light');
    });
    window.addEventListener('afterprint', function () {
      if (!themeBeforePrint) return;
      applyTheme(themeBeforePrint);
      themeBeforePrint = null;
    });
  }
  function palette() {
    var cs = getComputedStyle(document.documentElement);
    var get = function (n) { return cs.getPropertyValue('--' + n).trim(); };
    return {
      ink: get('ink'), panel: get('panel'), sunk: get('sunk'),
      rule: get('rule'), rule2: get('rule2'),
      txt: get('txt'), mut: get('mut'), dim: get('dim'),
      att: get('att'), def: get('def'), bad: get('bad'), zero: get('zero'), warn: get('warn'),
    };
  }

  /* ── URL state: only non-default values, so shared links stay short ────── */
  /* Query values are attacker-supplied strings. A bare `TABLE[key]` truthiness
   * test passes for every Object.prototype member, so ?det=constructor used to
   * survive this guard and take down init(). */
  function owns(table, key) {
    return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key);
  }

  function toURL() {
    var d = M.defaults(), parts = [];
    Object.keys(d).forEach(function (k) { if (P[k] !== d[k]) parts.push(k + '=' + P[k]); });
    if (METRIC !== 'p') parts.push('m=' + METRIC);
    if (EXP !== M.DEFAULT_EXPOSURE) parts.push('exp=' + EXP);
    if (ATTN !== M.DEFAULT_ATTENTION) parts.push('attn=' + ATTN);
    if (ON.length) parts.push('traits=' + ON.join(','));
    if (MAT !== 'typical') parts.push('mat=' + MAT);
    if (DET) parts.push('det=' + DET);
    var q = parts.join('&');
    return location.origin + location.pathname + (q ? '?' + q : '');
  }
  function fromURL() {
    var q = new URLSearchParams(location.search), d = M.defaults();
    /* The trait table lost five entries when the exposure axis became a rung.
     * A link shared before that carries keys this build no longer knows, and
     * the filter drops them rather than throwing — the reader gets the rest of
     * their selection instead of a blank console. */
    if (owns(M.EXPOSURE, q.get('exp'))) EXP = q.get('exp');
    if (owns(M.ATTENTION, q.get('attn'))) ATTN = q.get('attn');
    if (q.get('traits')) {
      ON = q.get('traits').split(',').filter(function (t) { return owns(M.TRAITS, t); });
    }
    if (owns(M.MATURITY, q.get('mat'))) MAT = q.get('mat');
    if (owns(M.DETECTION, q.get('det'))) DET = q.get('det');
    applyShape();
    Object.keys(d).forEach(function (k) {
      if (!q.has(k)) return;
      var v = parseFloat(q.get(k));
      if (!isFinite(v)) return;
      var s = spec(k);
      if (s) v = Math.min(s.max, Math.max(s.min, v));
      P[k] = v;
    });
    /* Links shared before the AI slider was split carry one `ai=N` that meant
     * all three of its effects at once. Read alone it now means only the
     * arrival clock, and the estate the author sent would come back materially
     * safer than the one they saw — 30% where they published 42%. An `ai`
     * without a `weap` beside it is therefore a pre-split link, and the
     * weaponisation term is restored to what that link asked for. A link from
     * this build always carries both, or neither. */
    if (q.has('ai') && !q.has('weap')) P.weap = P.ai;
    if (q.get('m') === 'incident') METRIC = 'incident';
  }
  function pushURL() {
    try { history.replaceState(null, '', toURL()); } catch (e) { /* file:// */ }
  }
  /* Every slider, indexed once. `spec()` used to concatenate the two spec
   * arrays and filter them on each call, and syncAll() concatenated them
   * again on every trait click; KEYS also gives the parameter signature the
   * race chart is memoised on a stable order to build from. */
  var ALL_SPEC = M.SPEC.def.concat(M.SPEC.att);
  var KEYS = ALL_SPEC.map(function (s) { return s.k; });
  var SPEC_BY_KEY = {};
  ALL_SPEC.forEach(function (s) { SPEC_BY_KEY[s.k] = s; });
  function spec(k) { return SPEC_BY_KEY[k]; }

  /* ── controls ──────────────────────────────────────────────────────────── */
  function buildControls(list, basicHost, advHost) {
    list.forEach(function (s) {
      var d = E('div', 'ctrl');
      var row = E('div', 'row');
      var lab = E('label', null, s.l);
      lab.setAttribute('for', 'i-' + s.k);
      var val = E('span', 'val');
      val.id = 'v-' + s.k;
      add(row, lab, val);

      var input = document.createElement('input');
      input.type = 'range';
      input.id = 'i-' + s.k;
      input.min = s.min; input.max = s.max; input.step = s.step; input.value = P[s.k];
      input.setAttribute('aria-describedby', 'h-' + s.k);

      var hint = E('div', 'hint', s.h);
      hint.id = 'h-' + s.k;

      add(d, row, input, hint);
      (BASIC[s.k] ? basicHost : advHost).appendChild(d);

      setFill(input, s);
      input.addEventListener('pointerdown', function () { DRAG = true; });
      input.addEventListener('input', function (e) {
        lastInputAt = Date.now();
        P[s.k] = +e.target.value;
        setVal(s);
        setFill(e.target, s);
        if (s.k === 'detect' || s.k === 'edrCoverage') DET = null;
        refreshSelectors();
        schedule();
      });
      setVal(s);
    });
  }
  /* The formatted readout ("14 d", "as measured") is the value that means
   * something; the raw number a screen reader would otherwise announce is not.
   * On the compression slider in particular, "0" is exactly the wrong thing to
   * hear when the point of zero is that it is the measured distribution. */
  function setVal(s) {
    var e = $('v-' + s.k), i = $('i-' + s.k), t = s.f(P[s.k]);
    if (e) e.textContent = t;
    if (i) i.setAttribute('aria-valuetext', t);
  }
  /* The groove is filled up to the thumb so the reader can see where in the
   * range they are without reading the number back. */
  function setFill(input, s) {
    var span = s.max - s.min;
    var pct = span ? (input.value - s.min) / span * 100 : 0;
    input.style.setProperty('--fill', Math.max(0, Math.min(100, pct)).toFixed(2) + '%');
  }

  function syncAll() {
    ALL_SPEC.forEach(function (s) {
      var i = $('i-' + s.k);
      if (i) { i.value = P[s.k]; setVal(s); setFill(i, s); }
    });
  }

  /* ── shape: traits x maturity x detection posture ─────────────────────── */
  /* Re-derive the estate from the four shape controls, carrying the reader's
   * scenario dials across untouched. The dials are handed over as a SET rather
   * than named here: this function passed `ai` alone, so selecting an exposure
   * rung — or a trait, a maturity level, a detection posture — silently reset
   * `weap` and `tempo` to zero while leaving `ai` standing. */
  function applyShape() {
    var opts = { exposure: EXP, traits: ON, attention: ATTN,
                 maturity: MAT, detection: DET };
    M.SCENARIO.forEach(function (k) { opts[k] = P[k]; });
    P = M.compose(opts);
  }
  /* Which posture does the current detect/coverage pair most resemble? Used to
   * light the right button when traits set those values rather than a click. */
  function closestDetection() {
    var best = null, bestD = Infinity;
    Object.keys(M.DETECTION).forEach(function (k) {
      var d = M.DETECTION[k].p;
      var dist = Math.abs(Math.log(P.detect / d.detect)) + Math.abs(P.edrCoverage - d.edrCoverage) / 60;
      if (dist < bestD) { bestD = dist; best = k; }
    });
    return best;
  }

  /* Descriptions do not stack, so a multi-select cannot explain itself in
   * prose. Show the resulting estate instead — that is what the reader needs
   * to sanity-check before trusting the number. */
  function estateSummary() {
    var bits = [
      M.fmtN(P.exposed) + ' exposed systems',
      P.edge + '% appliances',
      P.stackVulns + ' criticals a year',
      P.cadence + '-day patch cycle',
      P.edrCoverage + '% on telemetry',
    ];
    if (P.supply >= 0.3) bits.push(P.supply.toFixed(2) + ' supply-chain hits a year');
    return bits.join(' · ');
  }

  /* Each trait carries a paragraph explaining what it does to the estate, and
   * until now the only way to read one was to hover a mouse over the chip —
   * unreachable on a touch screen and by keyboard. The descriptions of the
   * traits actually selected are shown instead, so the reasoning behind the
   * numbers is on the page rather than behind a pointer. */
  var traitNotesAt = null;
  function renderTraitNotes() {
    var host = $('trait-notes');
    if (!host) return;
    /* refreshSelectors runs on every input event, so a dragged slider would
     * otherwise rebuild this list sixty times a second for a set that has not
     * changed. */
    var sig = ON.join(',');
    if (sig === traitNotesAt) return;
    /* A chip is at the top of the rail and its note lands several rows below
     * it, so nothing connects the click to what changed. The notes that are
     * new to this selection arrive; the ones already standing do not move. On
     * the first render there is no previous selection and nothing is new. */
    var seen = traitNotesAt === null ? null : traitNotesAt.split(',');
    traitNotesAt = sig;
    empty(host);
    ON.forEach(function (k) {
      var t = M.TRAITS[k];
      if (!t || !t.d) return;
      var row = E('div', seen && seen.indexOf(k) < 0 ? 'enter' : null);
      add(row, E('b', null, t.l), document.createTextNode(' ' + t.d));
      host.appendChild(row);
    });
  }

  /* The console's description slots rewrite themselves on every selection.
   * Swapping the text outright reads as a flicker in the corner of the eye;
   * bringing the new line up over 180ms reads as the console reporting what
   * was just chosen. Suppressed under `live()`, which is what keeps a slider
   * that re-derives the detection posture from strobing this line. */
  function setDesc(el, text) {
    if (!el || el.textContent === text) return;
    el.textContent = text;
    if (!ANIM || !CAN_ANIMATE || live()) return;
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: ease() });
  }

  function buildToggles(hostId, table, isOn, onPick, meta) {
    var host = empty($(hostId));
    Object.keys(table).forEach(function (key) {
      var btn = E('button', null, table[key].l);
      btn.type = 'button';
      btn.dataset.key = key;
      if (table[key].d) btn.title = table[key].d;
      if (meta) btn.appendChild(E('span', 'mtr', meta(key)));
      /* Hidden until the posture is a derived match, at which point it joins
       * the button's accessible name. The dashed border says the same thing,
       * and says it to sighted readers only. */
      if (meta) btn.appendChild(E('span', 'vh near-note',
        ', closest match to your current dwell time and coverage'));
      btn.setAttribute('aria-pressed', String(!!isOn(key)));
      btn.addEventListener('click', function () { onPick(key); });
      host.appendChild(btn);
    });
  }
  function refreshSelectors() {
    var det = DET || closestDetection();
    document.querySelectorAll('#sel-profile button').forEach(function (b2) {
      var on = ON.indexOf(b2.dataset.key) >= 0;
      b2.classList.toggle('on', on);
      b2.setAttribute('aria-pressed', String(on));
    });
    [['sel-exposure', EXP], ['sel-attention', ATTN],
     ['sel-maturity', MAT], ['sel-detection', det]].forEach(function (pair) {
      /* Moving the dwell or coverage slider clears the explicit choice and
       * lights whichever posture the numbers now resemble. Shown identically
       * to a click, that reads as a selection the reader never made — so a
       * derived match is drawn as a match, and reports itself unpressed. */
      var derived = pair[0] === 'sel-detection' && !DET;
      document.querySelectorAll('#' + pair[0] + ' button').forEach(function (b2) {
        var on = b2.dataset.key === pair[1];
        b2.classList.toggle('on', on && !derived);
        b2.classList.toggle('near', on && derived);
        b2.setAttribute('aria-pressed', String(on && !derived));
      });
    });
    setDesc($('desc-exposure'), M.EXPOSURE[EXP] ? M.EXPOSURE[EXP].d : '');
    setDesc($('desc-attention'), M.ATTENTION[ATTN] ? M.ATTENTION[ATTN].d : '');
    setDesc($('desc-maturity'), M.MATURITY[MAT] ? M.MATURITY[MAT].d : '');
    renderTraitNotes();
    /* The estate line is the composed result of all four controls, so it sits
     * below the last of them rather than under the chips — where it used to
     * report a total the reader had not finished specifying. There is always a
     * rung selected now, so it no longer has an empty case to caption. */
    setDesc($('desc-profile'), estateSummary());
    setDesc($('desc-detection'), M.DETECTION[det] ? M.DETECTION[det].d : '');
  }
  /* The metric toggle is a selected-state control like the chips, so it
   * carries the same state to assistive technology. */
  function syncMetric() {
    document.querySelectorAll('[data-metric]').forEach(function (x) {
      var on = x.dataset.metric === METRIC;
      x.classList.toggle('on', on);
      x.setAttribute('aria-pressed', String(on));
    });
  }

  function buildShapeUI() {
    /* Exposure first, because it is the page's founding claim and the term
     * every other control is a correction to: how much of you a stranger can
     * reach without credentials. Single-select, so the two rungs a reader
     * might have wanted at once are the two that contradict each other. */
    buildToggles('sel-exposure', M.EXPOSURE,
      function (k) { return k === EXP; },
      function (k) { EXP = k; applyShape(); syncAll(); refreshSelectors(); schedule(); });
    /* Attention lives on the threat card — it is the one shape control the
     * reader does not get to choose about themselves. */
    buildToggles('sel-attention', M.ATTENTION,
      function (k) { return k === ATTN; },
      function (k) { ATTN = k; applyShape(); syncAll(); refreshSelectors(); schedule(); });
    buildToggles('sel-profile', M.TRAITS,
      function (k) { return ON.indexOf(k) >= 0; },
      function (k) {
        var i = ON.indexOf(k);
        if (i >= 0) ON.splice(i, 1); else ON.push(k);
        applyShape(); syncAll(); refreshSelectors(); schedule();
      });
    buildToggles('sel-maturity', M.MATURITY,
      function (k) { return k === MAT; },
      function (k) { MAT = k; applyShape(); syncAll(); refreshSelectors(); schedule(); });
    /* A console that does not show what its presets write is not a console:
     * each posture reports the dwell time and coverage it sets. */
    buildToggles('sel-detection', M.DETECTION,
      function (k) { return k === (DET || closestDetection()); },
      function (k) { DET = k; applyShape(); syncAll(); refreshSelectors(); schedule(); },
      function (k) {
        var d = M.DETECTION[k].p;
        return (d.detect < 1 ? Math.round(d.detect * 24) + ' h' : d.detect + ' d') +
          ' · ' + d.edrCoverage + '%';
      });
    refreshSelectors();
  }

  /* ── sensitivity ───────────────────────────────────────────────────────── */
  /* `lo` is the good end of each range and `hi` the bad one, which is what lets
   * renderActions() print the one-sided gain from moving a parameter the right
   * way. Ranges are plausible operating bounds, not slider extremes.
   *
   * Two levers were absent from this list for reasons that did not survive
   * being checked. `agentSkill` — access that needs no vulnerability — is the
   * second-largest term in the entire model on the compromise metric, and a
   * sensitivity chart that omits its own second-largest term is not a
   * sensitivity chart. `edrCoverage` reads as a flat zero on compromise, which
   * is exactly why it belongs: it is the clearest case the page has of a
   * control that is worthless on one metric and decisive on the other, and it
   * only makes that argument if it is drawn on both. */
  var LEVERS = [
    { k: 'stackVulns',  lo: 8,    hi: 90,  l: 'Criticals in your stack' },
    { k: 'exposed',     lo: 25,   hi: 400, l: 'Exposed systems' },
    { k: 'edge',        lo: 0,    hi: 70,  l: 'Edge appliance share' },
    { k: 'inventory',   lo: 100,  hi: 86,  l: 'Inventory coverage' },
    { k: 'detect',      lo: 0.25, hi: 45,  l: 'Time to detect' },
    { k: 'edrCoverage', lo: 100,  hi: 0,   l: 'Endpoint telemetry coverage' },
    { k: 'cadence',     lo: 2,    hi: 60,  l: 'Routine remediation cycle' },
    { k: 'awareH',      lo: 4,    hi: 240, l: 'Triage to applicability' },
    { k: 'emergH',      lo: 12,   hi: 0,   l: 'Out-of-band remediation' },
    { k: 'emergHit',    lo: 95,   hi: 25,  l: 'Out-of-band trigger rate' },
    { k: 'virtual',     lo: 70,   hi: 0,   l: 'WAF / virtual patching' },
    { k: 'campaigns',   lo: 0,    hi: 30,  l: 'Targeted campaigns' },
    { k: 'agentSkill',  lo: 0.5,  hi: 40,  l: 'Access without a vulnerability' },
    { k: 'supply',      lo: 0,    hi: 1,   l: 'Supply-chain hits' },
    { k: 'ai',          lo: 0,    hi: 80,  l: 'Exploit arrival speed' },
    { k: 'weap',        lo: 0,    hi: 80,  l: 'Share of bugs weaponised' },
    { k: 'tempo',       lo: 0,    hi: 80,  l: 'Post-exploitation tempo' },
  ];
  var ADVICE = {
    stackVulns: ['Reduce edge software footprint', 'Each exposed product commits you to its vulnerability stream. This is the largest single term in the model.'],
    exposed:    ['Reduce the exposed attack surface', 'Fewer reachable systems reduces every other term simultaneously.'],
    edge:       ['Reduce or segment edge appliances', 'They remediate slower, support no endpoint agent, and are the asset class where mass exploitation begins at day zero.'],
    inventory:  ['Close the asset inventory gap', 'A system in no remediation cycle stays exposed for months rather than days.'],
    detect:     ['Reduce time to detect', 'This does not prevent compromise. It determines whether a compromise escalates to an incident, and no other parameter comes close on that metric.'],
    cadence:    ['Shorten the routine remediation cycle', 'Effective, but floored: around a fifth of exploitation precedes patch availability entirely.'],
    awareH:     ['Shorten triage to applicability', 'Once remediation runs in hours, triage is the entire timeline.'],
    emergH:     ['Establish an out-of-band remediation path', 'Without one, every urgent vulnerability inherits the routine cadence.'],
    emergHit:   ['Fix the trigger, not the speed', 'Remediating in hours has no effect if applicability is never established.'],
    virtual:    ['Front exposed services with enforceable rulesets', 'Recovers the exposure window while the permanent fix is tested. Does not cover appliances.'],
    campaigns:  ['Instrument the edge for enumeration', 'Targeted campaigns are distinguishable from background scanning where telemetry exists.'],
    supply:     ['Verify software provenance and integrity', 'Remediation cadence has no effect on this vector.'],
    edrCoverage: ['Extend telemetry across the estate', 'Worth nothing against being compromised and a great deal against it becoming an incident. Appliances take no agent, so this has a ceiling you do not set.'],
    /* The one action on this list whose mechanism the model does not simulate.
     * It moves the residual rate at which a campaign succeeds with no
     * vulnerability to use, which is where phishing, credential abuse and
     * misconfiguration live — so the advice names the controls rather than
     * implying the model has costed them. */
    agentSkill: ['Close the routes that need no vulnerability', 'Phishing-resistant MFA, least privilege and egress control. The model does not simulate these routes; it carries them as one residual rate, and that rate is its second-largest term.'],
  };

  function copyOf(src) { var o = {}; Object.keys(src).forEach(function (x) { o[x] = src[x]; }); return o; }
  function over(k, v, base) { var o = copyOf(base || P); o[k] = v; return o; }
  function sim(params, n, seed, wantSurv) {
    return M.simulate(params, n, seed, { surv: !!wantSurv, spread: 1 });
  }
  /* One lever, both ends. Each run reseeds from SEED_SENS, so a row does not
   * depend on which rows were computed before it — which is what lets the
   * settle pass compute them one per turn without moving a single figure. */
  function sensitivityRow(t, base) {
    var lo = sim(over(t.k, t.lo, base), N_SENS, SEED_SENS)[METRIC];
    var hi = sim(over(t.k, t.hi, base), N_SENS, SEED_SENS)[METRIC];
    return { k: t.k, l: t.l, lo: lo, hi: hi, span: Math.abs(hi - lo) };
  }

  /* ── render ────────────────────────────────────────────────────────────── */
  var lastRun = null, lastSens = null, lastDens = null;
  /* Each drawn curve carries the dial value it belongs to in `cur`, taken from
   * the pass's snapshot. Reading the live P at redraw time would move a marker
   * off the curve it was computed for whenever a redraw lands between passes —
   * a theme toggle, the resize debounce, beforeprint. */

  /* The SVG's own laid-out width, not its parent's border box. Measuring the
   * parent included the panel's padding and border, so every chart was drawn
   * ~34px wider than it was displayed and then uniformly shrunk by
   * preserveAspectRatio — 11px labels rendered at 10.4px, with dead
   * letterbox bands top and bottom. `.chart { width: 100% }` means the
   * element itself already reports the exact drawing width. */
  function width(id) {
    return Math.max(280, Math.floor($(id).getBoundingClientRect().width));
  }
  /* Stat values are counted to their new figure rather than swapped, so a
   * change reads as the instrument settling on a reading. Two cases skip the
   * tween entirely: a drag in progress, where the model re-runs faster than
   * any animation could finish and a lagging numeral would simply be wrong,
   * and a value that is not a number ('>12'), which has nothing to count. */
  var statAt = {}, statRaf = {}, statEnd = {};
  function stopStat(id) {
    if (statRaf[id]) { cancelAnimationFrame(statRaf[id]); statRaf[id] = 0; }
    if (statEnd[id]) { clearTimeout(statEnd[id]); statEnd[id] = 0; }
  }
  function paintStat(el, text, unit) {
    empty(el);
    add(el, document.createTextNode(text), unit ? E('span', 'u', unit) : null);
  }
  /* `straight` paints the figure without the tween for a caller that knows the
   * settle would not be seen — the docked readout while it is translated out
   * of view. It still records the value, so the next visible change counts
   * from the figure actually on screen. */
  function setStat(id, value, fmt, unit, ci, straight) {
    var el = $(id), ciEl = $(id + '-ci');
    if (!el) return;
    if (ciEl) ciEl.textContent = ci;
    stopStat(id);

    var from = statAt[id];
    statAt[id] = value;
    if (!ANIM || straight || live() || value === null || !isFinite(value) ||
        typeof from !== 'number' || !isFinite(from) || from === value) {
      paintStat(el, fmt(value), unit);
      return;
    }
    var t0 = 0, span = value - from;
    var step = function (now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / 320);
      var e = 1 - Math.pow(1 - k, 3);
      /* Record what is on screen, not what it is heading for: interrupted at
       * 40%, the next tween has to start from the figure the reader can see. */
      statAt[id] = from + span * e;
      paintStat(el, fmt(statAt[id]), unit);
      if (k < 1) { statRaf[id] = requestAnimationFrame(step); return; }
      stopStat(id);
      statAt[id] = value;
    };
    statRaf[id] = requestAnimationFrame(step);
    /* rAF is not merely throttled but suspended outright in a background tab,
     * an embedded pane or a power-saving mode, and some of those still report
     * the document visible — which is why the redraw scheduler already carries
     * a timer backstop. The settle needs the same one, and needs it more: a
     * redraw that never runs repeats the last chart, but a settle that never
     * gets a frame leaves the previous reading on screen for good. The
     * instrument would be quietly displaying a figure the model has already
     * superseded, which is worse than not animating at all. */
    statEnd[id] = setTimeout(function () {
      if (!statRaf[id]) return;
      stopStat(id);
      statAt[id] = value;
      paintStat(el, fmt(value), unit);
    }, 400);
  }
  /* The band is drawn on a full 0-100% scale rather than fitted to itself, so
   * a wide interval looks wide. It follows the text above it and is therefore
   * only redrawn on a pass whose interval means anything. */
  function setBand(id, lo, hi) {
    var el = $(id);
    if (!el) return;
    el.style.setProperty('--lo', (lo * 100).toFixed(1) + '%');
    el.style.setProperty('--hi', (hi * 100).toFixed(1) + '%');
  }
  var lastBand = { p: '', i: '' };
  var fmtPct = function (v) { return pctS(v); };
  var fmtEvents = function (v) { return v < 10 ? num(v, 2) : num(v); };
  var fmtDaysN = function (v) { return v === null ? '>12' : num(v); };
  function renderHead(r) {
    /* The fast pass while a slider is moving does not run enough blocks for the
     * interval to mean anything. Show the point estimate live and keep the last
     * trustworthy band rather than flashing a number that is mostly noise. */
    if (r.bandReliable) {
      lastBand.p = '90% band ' + pctS(r.pLo) + ' to ' + pctS(r.pHi);
      lastBand.i = '90% band ' + pctS(r.incLo) + ' to ' + pctS(r.incHi);
      setBand('s-p-band', r.pLo, r.pHi);
      setBand('s-i-band', r.incLo, r.incHi);
    }
    setStat('s-p', r.p, fmtPct, 'of years', lastBand.p);
    setStat('s-i', r.incident, fmtPct, 'of years', lastBand.i);
    setStat('s-n', r.events, fmtEvents, 'systems', 'across the 12-month window');
    /* A bare rule in the value slot reads as a failed render, not as "this does
     * not happen inside the window". Give it an actual bound. */
    setStat('s-t', r.med == null ? null : r.med, fmtDaysN,
      r.med == null ? 'months' : 'days',
      r.med == null ? 'no compromise in most simulated years' : 'across simulated years');
    renderDock(r);
  }

  /* ── docked readout ────────────────────────────────────────────────────── */
  function renderDock(r) {
    var v = $('dock-v'), d = $('dock');
    if (!v) return;
    /* The dock is the readout bank in another position, so the same reading
     * settles the same way rather than snapping because the reader happens to
     * have scrolled. Counted only while the dock is actually up: below that,
     * it is a tween nobody can see. */
    setStat('dock-v', r.p, fmtPct, '', null, !(d && d.classList.contains('up')));
    $('dock-ci').textContent = lastBand.p;
    $('dock-est').textContent = estateSummary();
  }

  /* densities() seeds its own RNG with a constant, so it is a pure function of
   * the parameter set — the same estate always produces the same curve. It
   * costs ~6ms for 30,000 samples, and it was being paid three times over for
   * one answer: once on the fast pass, again on the heavy pass that follows it
   * with identical parameters, and again on every theme toggle and every
   * resize. Keyed on the parameters instead, so it is recomputed exactly when
   * the curve would actually differ. */
  var densAt = null;
  function raceDensities() {
    var sig = '';
    for (var i = 0; i < KEYS.length; i++) sig += P[KEYS[i]] + ',';
    if (!lastDens || densAt !== sig) { lastDens = M.densities(P, 30000); densAt = sig; }
    return lastDens;
  }

  function drawRace() {
    var d = raceDensities();
    CH.race($('race'), width('race'), d, palette());
    var n = empty($('race-note'));
    add(n, 'Measured ' + C.pocTiming.latest.year + ' clock: median ',
      b(CH.fmtDays(d.median)), ' from publication to public exploit code.');
    if (P.ai > 0) {
      add(n, ' Modelled at ', b('+' + P.ai), ' compression, scaling that clock by ×' +
        d.scale.toFixed(2) + ': ', b(pctS(d.beforeFrac)),
        ' of exploits arrive ahead of patch availability.');
    } else {
      add(n, ' ', b(pctS(d.beforeFrac)), ' of exploits arrive ahead of patch availability.');
    }
  }

  function drawMain(r) {
    var pal = palette();
    drawRace();
    CH.funnel($('funnel'), width('funnel'), r, M.FUNNEL, pal);
    CH.routes($('routes'), width('routes'), r, pal, M.SCOPE);
    CH.survival($('surv'), width('surv'), r, pal);
    updateWild(r);
  }
  /* Chapters 08 and 09 read the vendored snapshot, never the simulation, so
   * their only inputs are the palette and the drawn width. They were being
   * redrawn on every settle regardless — DOM churn for a figure that cannot
   * have changed. They are drawn once at init and again only when one of
   * those two inputs actually moves. */
  function drawEvidence(pal) {
    CH.severity($('severity'), width('severity'), C, pal);
    CH.volume($('volume'), width('volume'), C, pal);
  }
  function redrawAll() {
    var pal = palette();
    drawEvidence(pal);
    if (!lastRun) return;
    drawMain(lastRun);
    if (lastSens) {
      CH.tornado($('torn'), width('torn'), lastSens.rows, lastSens.base, pal);
      /* Only once the sweep points belong to the same pass as the bars. */
      if (lastSens.sweep) CH.sweep($('sweep'), width('sweep'), lastSens.sweep, pal);
    }
  }

  function fast() {
    var r = sim(P, N_FAST, SEED, true);
    lastRun = r;
    renderHead(r);
    drawMain(r);
  }

  /* The settle pass is about 380ms of arithmetic on this machine: a 60,000
   * trial run, then 26 sensitivity runs, then 11 sweep points. Run as one
   * block it holds the main thread for all of it — scrolling stops, hover
   * states stick, and the theme button does not answer until it ends.
   *
   * It is therefore cut into stages that yield to the browser between them —
   * six slices of the main run, then the render, then one stage per lever and
   * one per sweep point, about thirty-four in all. No stage runs more than
   * 10,000 trials or one lever, which measured 55ms as the longest remaining
   * block against 260ms for the unsliced pass. Nothing is approximated: the
   * run carries its own RNG and accumulators (see createRun), and each
   * sensitivity run reseeds from SEED_SENS independently of the others, so
   * stage-at-a-time gives bit-identical figures to one straight loop.
   *
   * A generation counter rather than a boolean: a pass superseded by fresh
   * input abandons the stages it has left instead of finishing arithmetic
   * about an estate the reader has already moved on from. */
  /* How a stage hands control back. setTimeout(…, 0) is the obvious choice and
   * the wrong one: a background tab clamps timers to roughly one a second, so
   * a 26-stage pass that takes 380ms in front of a reader would take 26
   * SECONDS behind one — measured here, where the sweep chart was still
   * undrawn seconds after every other chart had settled. A MessageChannel task
   * is not subject to that clamp. It is still a macrotask, so paint and input
   * get their turn between stages exactly as they would with a timer. */
  var yieldChan = null, yieldQueue = [];
  if (typeof MessageChannel === 'function') {
    yieldChan = new MessageChannel();
    yieldChan.port1.onmessage = function () {
      var fn = yieldQueue.shift();
      if (fn) fn();
    };
  }
  function yieldTo(fn) {
    if (!yieldChan) return setTimeout(fn, 0);
    yieldQueue.push(fn);
    yieldChan.port2.postMessage(0);
    return null;
  }

  /* A queued MessageChannel task cannot be cancelled, so the generation
   * counter is what actually stops a superseded pass: a stale stage sees a
   * gen that no longer matches and returns without doing any work. The timer
   * handle is cleared too, for the fallback path. */
  var heavyGen = 0, heavyTimer = null;
  function cancelHeavy() {
    heavyGen++;
    if (heavyTimer) { clearTimeout(heavyTimer); heavyTimer = null; }
  }
  /* 10,000 trials a slice: ~15ms of the 92ms the full run costs, which keeps
   * every slice inside the budget a main thread needs to stay responsive to
   * input. The slicing does not approximate anything — see createRun in
   * js/model.js: the accumulators and the RNG live in the run, so a sliced
   * run and a whole one visit the same trials in the same order. */
  var HEAVY_CHUNK = 10000;

  function heavy() {
    cancelHeavy();
    var gen = heavyGen;

    /* One coherent estate for the whole pass. Every stage reads this rather
     * than the live parameters: a control moved mid-pass abandons the pass
     * outright, so no stage should ever be in a position to answer half about
     * one estate and half about another. */
    var snap = copyOf(P);
    var run = M.createRun(snap, N_HEAVY, SEED, { surv: true, spread: 1 });

    var base = null, rows = [], sweepSeries = [];
    var stages = [];
    for (var c = 0; c < N_HEAVY; c += HEAVY_CHUNK) {
      stages.push(function () { run.advance(HEAVY_CHUNK); });
    }
    stages.push(function () {
      var r = run.result();
      lastRun = r;
      renderHead(r);
      drawMain(r);
      pushURL();
    });

    /* Baseline computed with EXACTLY the seed and trial count the bars use, so
     * a bar can never be offset against a mismatched base. */
    stages.push(function () { base = sim(snap, N_SENS, SEED_SENS)[METRIC]; });
    LEVERS.forEach(function (t) {
      stages.push(function () { rows.push(sensitivityRow(t, snap)); });
    });
    stages.push(function () {
      rows.sort(function (x, y) { return y.span - x.span; });
      CH.tornado($('torn'), width('torn'), rows, base, palette());
      renderActions(rows, base);
      /* Published with the bars, not eleven stages later with the sweep. A
       * redraw in that gap — a theme toggle, the resize debounce, beforeprint —
       * read lastSens and repainted the tornado with the PREVIOUS estate's
       * numbers, over bars that had already been redrawn with these. `sweep`
       * stays null until its points exist, so the same redraw leaves the sweep
       * chart alone rather than drawing it from a half-filled array. */
      lastSens = { base: base, rows: rows, sweep: null, sweepCur: base };
    });
    /* Three curves at six points each rather than one at eleven. Each dial is
     * swept over its own travel with the other two held where the reader left
     * them, so what the chart compares is three mechanisms against one estate.
     * Six points is enough: every one of these curves is smooth and monotone,
     * and the shape being compared is which of them is steepest. */
    CLOCKS.forEach(function (cl) {
      var pts = [];
      sweepSeries.push({ k: cl.k, l: cl.l, c: cl.c, cur: snap[cl.k] || 0, pts: pts });
      for (var a = 0; a <= 100; a += 20) {
        (function (v) {
          stages.push(function () { pts.push([v, sim(over(cl.k, v, snap), N_SENS, SEED_SENS)[METRIC]]); });
        })(a);
      }
    });
    stages.push(function () {
      /* Every curve's marker sits at the baseline height, because each dial is
       * swept from the snapshot the baseline was computed from — so at its
       * current value each curve passes through exactly that number. It was a
       * further simulation of a figure already in hand. */
      sweepSeries.forEach(function (s2) { s2.curY = base; });
      lastSens = { base: base, rows: rows, sweep: sweepSeries, sweepCur: base };
      CH.sweep($('sweep'), width('sweep'), sweepSeries, palette());
    });

    var i = 0;
    var step = function () {
      heavyTimer = null;
      if (gen !== heavyGen) return;
      stages[i++]();
      if (i < stages.length) heavyTimer = yieldTo(step);
    };
    heavyTimer = yieldTo(step);
  }

  function updateWild(r) {
    var n = empty($('wild-note'));
    add(n, 'Of the ', b(num(r.fn[2], 2)), ' vulnerabilities a year that receive public exploit code, ', b(num(r.wild, 2)),
      ' (' + pctS(r.wildShare) + ') are confirmed exploited against live targets. The remainder still attract ' +
      'opportunistic traffic at a fraction of the hazard rate.');
  }

  /* The five actions are ranked by their effect at the current settings, so
   * the list reorders whenever the estate does — and that reordering is one of
   * the page's findings, not a redraw. Rows that teleport into a new order
   * report the ranking without ever showing it change.
   *
   * The rows are rebuilt from scratch on every pass, so there is no element to
   * transition. Positions are measured before the rebuild and again after,
   * each survivor is put back where it was and then released, which is the
   * only way to animate a layout change that has already happened. Nothing but
   * `transform` moves, so a five-row reorder costs no layout work. */
  function actPositions(host) {
    if (!ANIM || !CAN_ANIMATE || live()) return null;
    var at = {};
    host.querySelectorAll('li[data-k]').forEach(function (li) {
      at[li.dataset.k] = li.getBoundingClientRect().top;
    });
    return at;
  }
  function playActs(host, before) {
    /* No previous list means the first render, where the chapter's own reveal
     * is the entrance and a second one on top of it would be a stutter. */
    if (!before) return;
    host.querySelectorAll('li[data-k]').forEach(function (li) {
      var was = before[li.dataset.k];
      if (was === undefined) { li.className = 'enter'; return; }
      var dy = was - li.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      li.animate(
        [{ transform: 'translateY(' + dy.toFixed(1) + 'px)' }, { transform: 'none' }],
        { duration: 320, easing: ease() });
    });
  }

  function renderActions(rows, base) {
    var acts = $('acts');
    var before = actPositions(acts);
    var host = empty(acts);
    /* rows arrive ranked by the full span of the sensitivity bar, but what is
     * printed here is the one-sided reduction from moving the parameter the
     * good way. Ranking by one number and printing another gave a list that
     * read −8.1, −7.9, −4.7, −1.7, −6.0. */
    var items = rows.filter(function (r) { return base - r.lo > 0.004 && ADVICE[r.k]; })
      .map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; });
        o.gain = base - r.lo; return o; })
      .sort(function (x, y) { return y.gain - x.gain; })
      .slice(0, 5);
    if (!items.length) {
      var li0 = E('li');
      var t0 = E('div', 'a-t');
      add(t0, b('No defender parameter moves this materially.'),
        E('span', null, 'At these settings the outcome is driven by vectors the remediation process does not reach. See the initial access vector split.'));
      add(li0, t0, E('div', 'a-d', 'n/a'));
      host.appendChild(li0);
    } else {
      items.forEach(function (r) {
        var a = ADVICE[r.k];
        var li = E('li');
        li.dataset.k = r.k;
        var t = E('div', 'a-t');
        add(t, b(a[0]), E('span', null, a[1]));
        add(li, t, E('div', 'a-d', '−' + (r.gain * 100).toFixed(1) + ' pts'));
        host.appendChild(li);
      });
    }
    playActs(host, before);
    $('acts-metric').textContent = METRIC === 'p'
      ? 'annual probability of compromise' : 'annual probability of an incident';
  }

  /* ── scheduling ────────────────────────────────────────────────────────── */
  /* requestAnimationFrame is the right way to coalesce redraws while a slider
   * moves, but it is not guaranteed to fire: background tabs, embedded panes
   * and power-saving modes throttle or suspend it, and some of those still
   * report visibilityState "visible", so a visibility check does not catch it.
   * rAF is therefore an optimisation with a timer backstop — whichever arrives
   * first runs the pass and cancels the other. */
  var raf = null, fallback = null, slow = null;
  function runFast() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    clearTimeout(fallback);
    fallback = null;
    fast();
  }
  function schedule() {
    /* A chart mid-reveal that is redrawn by a slider would replay the reveal
     * on the new nodes, once per pass. Drop the flag as soon as the reader
     * touches anything. */
    if (ANIM) document.querySelectorAll('.chart.fresh').forEach(function (c) { c.classList.remove('fresh'); });
    /* Whatever the last settle had left to compute is about to be answered by
     * a newer one. Drop it, rather than let it finish and paint a stale chart
     * over a fresher reading. */
    cancelHeavy();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(runFast);
    clearTimeout(fallback);
    fallback = setTimeout(runFast, 90);
    clearTimeout(slow);
    slow = setTimeout(heavy, 280);
  }

  /* ── sharing ───────────────────────────────────────────────────────────── */
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function exportOpts(title, subtitle) {
    var pal = palette();
    return {
      title: title, subtitle: subtitle, scale: 2,
      bg: pal.ink, fg: pal.txt, mut: pal.mut,
      source: 'Exposure Race · calibrated to CyberMon ' + C.snapshot.cvelist + ' · devko.github.io/CyberMon',
    };
  }
  function subtitleFor(id) {
    var r = lastRun;
    if (!r) return '';
    /* Read the drawn figure, never a fresh sample: a second 4,000-trial pass
     * would put a different percentage in the caption than the one printed
     * inside the image it captions. */
    if (id === 'race') return lastDens
      ? pctS(lastDens.pLate) + ' have public exploit code before remediation completes' : '';
    if (id === 'funnel') return num(r.fn[0]) + ' criticals a year become ' + num(r.fn[5], 2) + ' compromises';
    if (id === 'routes') return 'first compromise of the year, by route';
    if (id === 'surv') return pctS(r.p) + ' chance of compromise within 12 months';
    if (id === 'torn') return 'ranked by effect on the ' + (METRIC === 'p' ? 'compromise' : 'incident') + ' rate';
    if (id === 'sweep') return 'what happens if the exploit clock compresses further';
    if (id === 'severity') return 'CISA KEV against the scored CVE population';
    if (id === 'volume') return C.volume.curYearRunRate.year + ' run-rate against ' + C.volume.prevYear.year + ' actual';
    return '';
  }
  function chartTitle(id) {
    var card = $(id).closest('.panel');
    var h3 = card ? card.querySelector('h3') : null;
    return h3 ? h3.textContent.trim() : 'Exposure Race';
  }
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }
  function wireExport(id) {
    var svg = $(id);
    if (!svg) return;
    var render = function () { return CH.toPNG(svg, exportOpts(chartTitle(id), subtitleFor(id))); };
    var dl = document.querySelector('[data-dl="' + id + '"]');
    var cp = document.querySelector('[data-copy="' + id + '"]');
    if (dl) dl.addEventListener('click', function () {
      render().then(function (bl) { download(bl, 'exposure-race-' + id + '.png'); toast('PNG saved'); })
        .catch(function () { toast('Could not render PNG'); });
    });
    if (cp) cp.addEventListener('click', function () {
      render().then(function (bl) {
        if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
          return navigator.clipboard.write([new ClipboardItem({ 'image/png': bl })])
            .then(function () { toast('Chart copied to clipboard'); });
        }
        download(bl, 'exposure-race-' + id + '.png');
        toast('Clipboard unavailable. PNG saved instead');
      }).catch(function () { toast('Could not render PNG'); });
    });
  }

  /* ── anchors ───────────────────────────────────────────────────────────── */
  var TAG = { measured: 'm', reported: 'r', assumed: 'a' };
  function anchorRow(host, label, kind, value, note) {
    var wrap = E('div');
    var dt = E('dt');
    add(dt, document.createTextNode(label + ' '), E('span', 'tag ' + TAG[kind], kind));
    var dd = E('dd', kind, value);
    add(wrap, dt, dd, E('span', 'anchor-note', note));
    host.appendChild(wrap);
  }
  function renderAnchors() {
    var host = empty($('anchors'));
    var crit = C.exploitation.bands.filter(function (x) { return x.band === '9.0-10.0'; })[0];
    anchorRow(host, 'Criticals that ever get a public working exploit', 'measured',
      C.armed.pPoCCritical + '%',
      'CyberMon · ExploitDB + Metasploit + Nuclei against cvelistV5, CY' + C.armed.window);
    anchorRow(host, 'Criticals confirmed exploited in the wild', 'measured',
      crit.pExploited + '%', 'CyberMon · CISA KEV ' + C.snapshot.kev + ' against the scored population');
    anchorRow(host, 'Days from publication to a public exploit (median)', 'measured',
      C.pocTiming.latest.medianDays + ' d',
      'CyberMon · ' + C.pocTiming.latest.year + ', 90-day horizon' +
      (C.pocTiming.latest.provisional ? ', provisional, right-censored' : ''));
    anchorRow(host, 'Exploits that appear before the patch does', 'measured',
      C.pocTiming.latest.pctBefore + '%', 'CyberMon · ' + C.pocTiming.latest.year + ' arming series');
    anchorRow(host, 'Criticals published worldwide, ' + C.volume.curYearRunRate.year + ' run-rate', 'measured',
      thou(C.volume.curYearRunRate.critical),
      'CyberMon · cvelistV5, ' + num(C.yearElapsed * 100) + '% of the year elapsed');
    anchorRow(host, 'Confirmed-exploited CVEs added worldwide per year', 'measured',
      C.inWild.kevAddedRunRate + ' (' + C.volume.curYearRunRate.year + ' run-rate)',
      'CyberMon · CISA KEV additions');
    anchorRow(host, 'CVEs NVD has stopped analysing', 'measured',
      thou(C.nvd.deferred) + ' (' + C.nvd.deferredShare.toFixed(1) + '%)',
      'CyberMon · NVD API status labels');
    /* cited figures first, then the pure judgement calls — a reader scanning
     * for what to argue with should reach the weakest material last, not first */
    var keys = Object.keys(M.ASSUMED);
    /* The key is an identifier, not a label: showing `breakoutMedian` to a
     * reader asked them to decode the source to read their own provenance
     * panel. Every coefficient names itself in prose now. */
    keys.filter(function (k) { return M.ASSUMED[k].src; }).forEach(function (k) {
      var a = M.ASSUMED[k];
      anchorRow(host, a.l || k, 'reported', a.v + '   (range ' + a.lo + ' to ' + a.hi + ')',
        a.src + '. ' + a.why);
    });
    keys.filter(function (k) { return !M.ASSUMED[k].src; }).forEach(function (k) {
      var a = M.ASSUMED[k];
      anchorRow(host, a.l || k, 'assumed', a.v + '   (range ' + a.lo + ' to ' + a.hi + ')', a.why);
    });
  }

  function renderEvidence() {
    var body = empty($('ev-body'));
    [['9.0-10.0', 'Critical'], ['7.0-8.9', 'High'], ['4.0-6.9', 'Medium'], ['0.1-3.9', 'Low']]
      .forEach(function (n) {
        var r = C.exploitation.bands.filter(function (y) { return y.band === n[0]; })[0];
        if (!r) return;
        var tr = E('tr');
        var td0 = E('td', null, n[1] + ' ');
        td0.appendChild(E('span', 'band-range', n[0]));
        add(tr, td0, E('td', 'n', thou(r.population)), E('td', 'n', thou(r.inKev)),
          E('td', 'n' + (n[1] === 'Critical' ? ' hi' : ''), r.pExploited.toFixed(3) + '%'));
        body.appendChild(tr);
      });
    var f = empty($('ev-foot'));
    add(f, b(num(C.exploitation.kevBelowCritical) + '%'),
      ' of confirmed-exploited vulnerabilities are rated below Critical, and ',
      b(C.exploitation.criticalEpssBelow1pct + '%'),
      ' of Critical-rated CVEs carry less than a 1% chance of exploitation. Critical is only ',
      b(C.exploitation.criticalVsHigh + '×'),
      ' High. That is a weak signal, not a filter, which is why this model is driven by exploit availability rather than by severity band.');
  }

  /* ── masthead clock ────────────────────────────────────────────────────── */
  /* The three figures the whole argument rests on, read off the vendored
   * snapshot at render time. Typed into the prose they would go stale the
   * first time the corpus was refreshed. */
  function clockRow(host, label, value) {
    var wrap = E('div');
    add(wrap, E('dt', null, label), E('dd', null, value));
    host.appendChild(wrap);
  }
  function renderClock() {
    var host = empty($('clock'));
    clockRow(host, 'Median days from publication to public exploit code, ' +
      C.pocTiming.latest.year, C.pocTiming.latest.medianDays + ' d');
    clockRow(host, 'Exploits that arrive before the patch does',
      C.pocTiming.latest.pctBefore + '%');
    clockRow(host, 'Criticals that ever get a public working exploit',
      C.armed.pPoCCritical + '%');
  }

  /* ── reveal, dock and contents ─────────────────────────────────────────── */
  /* One observer per job, all of them optional: with no IntersectionObserver
   * the page loses a reveal, a docked readout and a highlighted contents entry,
   * and keeps everything it is actually for. */
  function observeReveal() {
    if (!ANIM || !window.IntersectionObserver) {
      document.documentElement.classList.remove('anim');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.classList.add('in');
        io.unobserve(el);
        /* Chart interiors animate on the pass that first brings them into
         * view, never on init: eight charts are drawn before a reader has
         * scrolled to any of them, and an animation nobody sees is only a
         * cost. */
        if (DRAG) return;
        el.querySelectorAll('.chart').forEach(function (c) {
          c.classList.add('fresh');
          setTimeout(function () { c.classList.remove('fresh'); }, 1500);
        });
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.02 });
    document.querySelectorAll('.stats, .clock, .two, .results > .panel')
      .forEach(function (el) { io.observe(el); });
  }

  function observeDock() {
    var stats = document.querySelector('.stats'), dock = $('dock');
    if (!stats || !dock || !window.IntersectionObserver) return;
    new IntersectionObserver(function (e) {
      dock.classList.toggle('up', !e[0].isIntersecting && e[0].boundingClientRect.top < 0);
    }, { threshold: 0 }).observe(stats);
  }

  function observeToc() {
    var secs = document.querySelectorAll('.results [id]');
    var links = {};
    document.querySelectorAll('.toc a').forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });
    if (!window.IntersectionObserver) return;
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { seen[en.target.id] = en.isIntersecting; });
      /* All of them, not the first: chapters 05 and 06 sit side by side above
       * 1180px, so picking one meant the other could never light and its
       * contents entry looked broken. aria-current goes on the first, which is
       * the one a reader jumping there would land on. */
      var onScreen = [];
      secs.forEach(function (x) { if (seen[x.id] && links[x.id]) onScreen.push(x.id); });
      Object.keys(links).forEach(function (k) {
        var on = onScreen.indexOf(k) >= 0;
        links[k].classList.toggle('cur', on);
        if (k === onScreen[0]) links[k].setAttribute('aria-current', 'true');
        else links[k].removeAttribute('aria-current');
      });
    }, { rootMargin: '-42% 0px -48% 0px' });
    secs.forEach(function (x) { if (links[x.id]) io.observe(x); });
  }

  /* ── init ──────────────────────────────────────────────────────────────── */
  function init() {
    try {
      var stored = localStorage.getItem('er-theme');
      if (stored) document.documentElement.setAttribute('data-theme', stored);
    } catch (e) { /* ignore */ }
    $('theme-btn').textContent = currentTheme() === 'dark' ? 'Light' : 'Dark';

    fromURL();
    buildControls(M.SPEC.def, $('cd'), $('cd-adv'));
    buildControls(M.SPEC.att, $('ca'), $('ca-adv'));

    buildShapeUI();
    document.querySelectorAll('[data-metric]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        METRIC = btn.dataset.metric;
        syncMetric();
        heavy();
      });
    });
    $('theme-btn').addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
    $('share-btn').addEventListener('click', function () {
      var url = toURL();
      /* Stamp the address bar before saying anything about it. The URL is
       * otherwise only written at the end of a settle, so for the ~280ms after
       * a control moves it still describes the previous estate — and BOTH
       * fallback messages below assert that the URL bar carries the link the
       * reader just asked for. The copied string is always correct, because
       * toURL() is computed fresh here rather than read off location, so this
       * is about making the claim true rather than about the link. */
      pushURL();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { toast('Link copied, including current settings'); },
          function () { toast('Copy failed. The URL bar carries the same link'); });
      } else { toast('The URL bar already carries your settings'); }
    });
    $('reset-btn').addEventListener('click', function () {
      /* Every piece of shape state, not just the ones that existed when this
       * handler was written. Leaving EXP and ATTN behind did not merely light
       * a stale rung: toURL() still emitted exp=/attn=, so a link copied after
       * a reset reproduced the pre-reset estate rather than the baseline the
       * sender was looking at, and the next selector click re-derived the
       * sliders from the rung the reader thought they had cleared. */
      EXP = M.DEFAULT_EXPOSURE; ATTN = M.DEFAULT_ATTENTION;
      ON = []; MAT = 'typical'; DET = null;
      P = M.defaults();
      syncAll();
      refreshSelectors();
      schedule();
    });

    /* The metric toggle is markup-default "Compromise"; a shared link may say
     * otherwise, and the chart would then disagree with its own button. */
    syncMetric();

    ['race', 'funnel', 'routes', 'surv', 'torn', 'sweep', 'severity', 'volume'].forEach(wireExport);

    document.querySelectorAll('[data-snapshot]').forEach(function (e) {
      e.textContent = C.generatedAt.slice(0, 10);
    });
    document.querySelectorAll('[data-curyear]').forEach(function (e) {
      e.textContent = String(C.currentYear);
    });
    /* The coverage claim is stated in three places — beside the headline, on
     * the routes chart and in the footer — and is written in none of them.
     * A share that is typed into copy drifts from the model that reports it
     * the first time either moves. */
    document.querySelectorAll('[data-scope-share]').forEach(function (e) {
      e.textContent = pctS(M.SCOPE.vulnShareOfBreaches);
    });
    document.querySelectorAll('[data-scope-src]').forEach(function (e) {
      e.textContent = M.SCOPE.src;
    });
    document.querySelectorAll('[data-scope-excluded]').forEach(function (e) {
      e.textContent = M.SCOPE.excludedShort.charAt(0).toLowerCase() +
        M.SCOPE.excludedShort.slice(1);
    });

    renderAnchors();
    renderEvidence();
    renderClock();
    bindPrint();
    observeReveal();
    observeDock();
    observeToc();

    /* Scrolling to a div does not move focus into it, so a keyboard reader
     * following the skip link landed back at the top of the tab order on the
     * next Tab. The target carries tabindex="-1" for this. */
    var skip = document.querySelector('.skip');
    if (skip) skip.addEventListener('click', function () {
      var t = $('results');
      if (t) setTimeout(function () { t.focus({ preventScroll: true }); }, 0);
    });

    /* blur and visibilitychange as well as the pointer events: a pointer
     * released outside the window, or a tab switched away mid-drag, would
     * otherwise leave DRAG latched and every later change painting without
     * its settle. */
    ['pointerup', 'pointercancel', 'blur'].forEach(function (ev) {
      window.addEventListener(ev, function () { DRAG = false; });
    });
    document.addEventListener('visibilitychange', function () { DRAG = false; });

    var resizeT = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(redrawAll, 140);
    });
    /* There was a prefers-color-scheme listener here that redrew the charts
     * when the OS theme changed and no explicit choice had been made. It could
     * never fire: index.html ships `<html data-theme="dark">`, so the attribute
     * it tested for is always present. That is deliberate and documented —
     * DESIGN.md calls light the definitional baseline and dark the default
     * experience — so the dead branch goes rather than the markup. The
     * stylesheet's prefers-color-scheme block stays: it is the Single
     * Definition Rule, and CI enforces it. */

    fast();
    drawEvidence(palette());
    /* Let the first frame paint and the entry animations commit before the
     * settle pass takes the main thread. An animation that has already started
     * runs on the compositor and is unaffected; one that has not simply
     * arrives late, which is what a reader sees as the page hesitating on
     * load.
     *
     * The two frames are an optimisation and MUST NOT be the only route in.
     * requestAnimationFrame does not fire at all in a background tab, an
     * embedded pane, or a power-saving mode, and some of those still report
     * visibilityState "visible". Measured in one such pane: rAF never ran, so
     * the sensitivity, sweep, severity and volume charts were never drawn at
     * all, the prioritised-actions list stayed empty, the credible bands never
     * appeared, and the page sat on its 4,000-trial estimate indefinitely —
     * every one of those a permanent blank rather than a late arrival. The
     * scheduler and the stat tween both carry a timer backstop for exactly
     * this reason; the first pass, which is the one every reader gets, had
     * none. Whichever route arrives first runs, and `once` retires the other. */
    var started = false;
    var startHeavy = function () {
      if (started) return;
      started = true;
      heavy();
    };
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { setTimeout(startHeavy, 60); });
    });
    setTimeout(startHeavy, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
