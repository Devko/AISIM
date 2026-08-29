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
  var ON = [], MAT = 'typical', DET = null;   /* ON = selected traits, multi-select */
  var SEED = 1234, SEED_SENS = 7;
  /* N_HEAVY is set by the credible interval, not by the point estimate: the
   * variance decomposition needs ~150 blocks with enough trials in each. The
   * point estimate is settled long before this. ~116ms on a laptop. */
  var N_FAST = 4000, N_HEAVY = 60000, N_SENS = 5000;

  /* Sliders shown up front. Detection is driven by the posture selector, so the
   * two knobs behind it live in "more" — the reader picks a stack, not a dwell
   * time they have no way to estimate. */
  var BASIC = { exposed: 1, edge: 1, cadence: 1, stackVulns: 1, ai: 1 };

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
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('er-theme', t); } catch (e) { /* private mode */ }
    $('theme-btn').textContent = t === 'dark' ? 'Light' : 'Dark';
    redrawAll();
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
  function toURL() {
    var d = M.defaults(), parts = [];
    Object.keys(d).forEach(function (k) { if (P[k] !== d[k]) parts.push(k + '=' + P[k]); });
    if (METRIC !== 'p') parts.push('m=' + METRIC);
    if (ON.length) parts.push('traits=' + ON.join(','));
    if (MAT !== 'typical') parts.push('mat=' + MAT);
    if (DET) parts.push('det=' + DET);
    var q = parts.join('&');
    return location.origin + location.pathname + (q ? '?' + q : '');
  }
  function fromURL() {
    var q = new URLSearchParams(location.search), d = M.defaults();
    if (q.get('traits')) {
      ON = q.get('traits').split(',').filter(function (t) { return M.TRAITS[t]; });
    }
    if (M.MATURITY[q.get('mat')]) MAT = q.get('mat');
    if (M.DETECTION[q.get('det')]) DET = q.get('det');
    applyShape();
    Object.keys(d).forEach(function (k) {
      if (!q.has(k)) return;
      var v = parseFloat(q.get(k));
      if (!isFinite(v)) return;
      var s = spec(k);
      if (s) v = Math.min(s.max, Math.max(s.min, v));
      P[k] = v;
    });
    if (q.get('m') === 'incident') METRIC = 'incident';
  }
  function pushURL() {
    try { history.replaceState(null, '', toURL()); } catch (e) { /* file:// */ }
  }
  function spec(k) {
    return M.SPEC.def.concat(M.SPEC.att).filter(function (s) { return s.k === k; })[0];
  }

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
    var pct = (input.value - s.min) / (s.max - s.min) * 100;
    input.style.setProperty('--fill', Math.max(0, Math.min(100, pct)).toFixed(2) + '%');
  }

  function syncAll() {
    M.SPEC.def.concat(M.SPEC.att).forEach(function (s) {
      var i = $('i-' + s.k);
      if (i) { i.value = P[s.k]; setVal(s); setFill(i, s); }
    });
  }

  /* ── shape: traits x maturity x detection posture ─────────────────────── */
  function applyShape() {
    P = M.compose({ traits: ON, maturity: MAT, detection: DET, ai: P.ai });
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
      P.stackVulns + ' criticals/yr in your stack',
      P.cadence + '-day patch cycle',
      P.edrCoverage + '% on telemetry',
    ];
    if (P.supply >= 0.3) bits.push(P.supply.toFixed(2) + ' supply-chain hits/yr');
    return bits.join(' · ');
  }

  /* Each trait carries a paragraph explaining what it does to the estate, and
   * until now the only way to read one was to hover a mouse over the chip —
   * unreachable on a touch screen and by keyboard. The descriptions of the
   * traits actually selected are shown instead, so the reasoning behind the
   * numbers is on the page rather than behind a pointer. */
  function renderTraitNotes() {
    var host = $('trait-notes');
    if (!host) return;
    empty(host);
    ON.forEach(function (k) {
      var t = M.TRAITS[k];
      if (!t || !t.d) return;
      var row = E('div');
      add(row, E('b', null, t.l), document.createTextNode(' ' + t.d));
      host.appendChild(row);
    });
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
        ' — closest match to your current dwell time and coverage'));
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
    [['sel-maturity', MAT], ['sel-detection', det]].forEach(function (pair) {
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
    var dm = $('desc-maturity');
    if (dm) dm.textContent = M.MATURITY[MAT] ? M.MATURITY[MAT].d : '';
    renderTraitNotes();
    $('desc-profile').textContent = ON.length
      ? estateSummary()
      : 'No attributes selected. Generic mid-size estate: ' + estateSummary();
    $('desc-detection').textContent = M.DETECTION[det] ? M.DETECTION[det].d : '';
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
  var LEVERS = [
    { k: 'stackVulns', lo: 8,    hi: 90,  l: 'Vulns in your stack' },
    { k: 'exposed',    lo: 25,   hi: 400, l: 'Exposed systems' },
    { k: 'edge',       lo: 0,    hi: 70,  l: 'Edge appliance share' },
    { k: 'inventory',  lo: 100,  hi: 86,  l: 'Inventory coverage' },
    { k: 'detect',     lo: 0.25, hi: 45,  l: 'Time to detect' },
    { k: 'cadence',    lo: 2,    hi: 60,  l: 'Routine remediation cycle' },
    { k: 'awareH',     lo: 4,    hi: 240, l: 'Triage to applicability' },
    { k: 'emergH',     lo: 12,   hi: 0,   l: 'Out-of-band remediation' },
    { k: 'emergHit',   lo: 95,   hi: 25,  l: 'Out-of-band trigger rate' },
    { k: 'virtual',    lo: 70,   hi: 0,   l: 'WAF / virtual patching' },
    { k: 'campaigns',  lo: 0,    hi: 30,  l: 'Targeted campaigns' },
    { k: 'supply',     lo: 0,    hi: 1,   l: 'Supply-chain hits' },
    { k: 'ai',         lo: 0,    hi: 80,  l: 'Exploit-clock compression' },
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
    ai:         ['Outside defender control', 'Plan the remediation timeline against it rather than assuming the adversary timeline holds constant.'],
  };

  function over(k, v) { var o = {}; Object.keys(P).forEach(function (x) { o[x] = P[x]; }); o[k] = v; return o; }
  function sim(params, n, seed, wantSurv) {
    return M.simulate(params, n, seed, { surv: !!wantSurv, spread: 1 });
  }
  function sensitivity() {
    return LEVERS.map(function (t) {
      var lo = sim(over(t.k, t.lo), N_SENS, SEED_SENS)[METRIC];
      var hi = sim(over(t.k, t.hi), N_SENS, SEED_SENS)[METRIC];
      return { k: t.k, l: t.l, lo: lo, hi: hi, span: Math.abs(hi - lo) };
    }).sort(function (a, b2) { return b2.span - a.span; });
  }

  /* ── render ────────────────────────────────────────────────────────────── */
  var lastHeavy = null, lastSens = null, lastDens = null;

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
  var statAt = {}, statRaf = {};
  function paintStat(el, text, unit) {
    empty(el);
    add(el, document.createTextNode(text), E('span', 'u', unit));
  }
  function setStat(id, value, fmt, unit, ci) {
    var el = $(id), ciEl = $(id + '-ci');
    if (ciEl) ciEl.textContent = ci;
    if (statRaf[id]) { cancelAnimationFrame(statRaf[id]); statRaf[id] = 0; }

    var from = statAt[id];
    statAt[id] = value;
    if (!ANIM || live() || value === null || typeof from !== 'number' || from === value) {
      paintStat(el, fmt(value), unit);
      return;
    }
    var t0 = 0, span = value - from;
    var step = function (now) {
      if (!t0) t0 = now;
      var k = Math.min(1, (now - t0) / 320);
      var e = 1 - Math.pow(1 - k, 3);
      paintStat(el, fmt(from + span * e), unit);
      if (k < 1) statRaf[id] = requestAnimationFrame(step);
      else statRaf[id] = 0;
    };
    statRaf[id] = requestAnimationFrame(step);
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
    }
    if (r.bandReliable) {
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
    var v = $('dock-v');
    if (!v) return;
    v.textContent = pctS(r.p);
    $('dock-ci').textContent = lastBand.p;
    $('dock-est').textContent = estateSummary();
  }

  function drawRace() {
    var d = M.densities(P, 30000);
    lastDens = d;
    CH.race($('race'), width('race'), d, palette());
    var n = empty($('race-note'));
    add(n, 'Measured ' + C.pocTiming.latest.year + ' clock: median ',
      b(CH.fmtDays(d.median)), ' from publication to public exploit code, ',
      b(pctS(d.beforeFrac)), ' of it ahead of patch availability.');
    if (P.ai > 0) add(n, ' Compression is at ', b('+' + P.ai), ', scaling that clock by ×' + d.scale.toFixed(2) + '.');
  }

  function drawMain(r) {
    var pal = palette();
    drawRace();
    CH.funnel($('funnel'), width('funnel'), r, M.FUNNEL, pal);
    CH.routes($('routes'), width('routes'), r, pal);
    CH.survival($('surv'), width('surv'), r, pal);
    updateWild(r);
  }
  function redrawAll() {
    if (!lastHeavy) return;
    var pal = palette();
    drawMain(lastHeavy);
    CH.severity($('severity'), width('severity'), C, pal);
    CH.volume($('volume'), width('volume'), C, pal);
    if (lastSens) {
      CH.tornado($('torn'), width('torn'), lastSens.rows, lastSens.base, pal);
      CH.sweep($('sweep'), width('sweep'), lastSens.sweep, P.ai, lastSens.sweepCur, pal);
    }
  }

  function fast() {
    var r = sim(P, N_FAST, SEED, true);
    lastHeavy = r;
    renderHead(r);
    drawMain(r);
  }

  function heavy() {
    var r = sim(P, N_HEAVY, SEED, true);
    lastHeavy = r;
    renderHead(r);
    drawMain(r);

    /* Baseline computed with EXACTLY the seed and trial count the bars use, so
     * a bar can never be offset against a mismatched base. */
    var base = sim(P, N_SENS, SEED_SENS)[METRIC];
    var rows = sensitivity();
    var sweepPts = [];
    for (var a = 0; a <= 100; a += 10) sweepPts.push([a, sim(over('ai', a), N_SENS, SEED_SENS)[METRIC]]);
    var sweepCur = sim(over('ai', P.ai), N_SENS, SEED_SENS)[METRIC];
    lastSens = { base: base, rows: rows, sweep: sweepPts, sweepCur: sweepCur };

    var pal = palette();
    CH.tornado($('torn'), width('torn'), rows, base, pal);
    CH.sweep($('sweep'), width('sweep'), sweepPts, P.ai, sweepCur, pal);
    CH.severity($('severity'), width('severity'), C, pal);
    CH.volume($('volume'), width('volume'), C, pal);
    renderActions(rows, base);
    pushURL();
  }

  function updateWild(r) {
    var n = empty($('wild-note'));
    add(n, 'Of the ', b(num(r.fn[2], 2)), ' weaponised vulnerabilities a year, ', b(num(r.wild, 2)),
      ' (' + pctS(r.wildShare) + ') are confirmed exploited against live targets. The remainder still attract ' +
      'opportunistic traffic at a fraction of the hazard rate.');
  }

  function renderActions(rows, base) {
    var host = empty($('acts'));
    var items = rows.filter(function (r) { return base - r.lo > 0.004 && ADVICE[r.k]; }).slice(0, 5);
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
        var t = E('div', 'a-t');
        add(t, b(a[0]), E('span', null, a[1]));
        add(li, t, E('div', 'a-d', '−' + ((base - r.lo) * 100).toFixed(1) + ' pts'));
        host.appendChild(li);
      });
    }
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
    var r = lastHeavy;
    if (!r) return '';
    /* Read the drawn figure, never a fresh sample: a second 8,000-trial pass
     * would put a different percentage in the caption than the one printed
     * inside the image it captions. */
    if (id === 'race') return lastDens
      ? pctS(lastDens.pLate) + ' of armed bugs have a working exploit before the hole is closed' : '';
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
    anchorRow(host, 'Confirmed-exploited vulns added worldwide per year', 'measured',
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
          setTimeout(function () { c.classList.remove('fresh'); }, 1300);
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
      var cur = null;
      secs.forEach(function (x) { if (seen[x.id] && !cur) cur = x.id; });
      Object.keys(links).forEach(function (k) {
        var on = k === cur;
        links[k].classList.toggle('cur', on);
        if (on) links[k].setAttribute('aria-current', 'true');
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
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { toast('Link copied, including current settings'); },
          function () { toast('Copy failed. The URL bar carries the same link'); });
      } else { toast('The URL bar already carries your settings'); }
    });
    $('reset-btn').addEventListener('click', function () {
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
    document.querySelectorAll('[data-prevyear]').forEach(function (e) {
      e.textContent = String(C.volume.prevYear.year);
    });

    renderAnchors();
    renderEvidence();
    renderClock();
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

    window.addEventListener('pointerup', function () { DRAG = false; });
    window.addEventListener('pointercancel', function () { DRAG = false; });

    var resizeT = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(redrawAll, 140);
    });
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () {
      if (!document.documentElement.getAttribute('data-theme')) redrawAll();
    });

    fast();
    /* Let the first frame paint and the entry animations commit before the
     * heavy pass takes the main thread for the better part of a second. An
     * animation that has already started runs on the compositor and is
     * unaffected by the block; one that has not simply arrives late, which is
     * what a reader sees as the page hesitating on load. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { setTimeout(heavy, 60); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
