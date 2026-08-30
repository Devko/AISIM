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
  /* The two identity ladders. Null until the reader picks one, exactly like
   * DET: a null means "whichever rung the sliders currently resemble", so
   * moving a slider by hand does not leave a contradicting button lit. */
  var IDN = null, PPL = null;
  var SEED = 1234, SEED_SENS = 7;
  /* N_HEAVY is set by the credible interval, not by the point estimate: the
   * variance decomposition needs ~150 blocks with enough trials in each. The
   * point estimate is settled long before this. ~116ms on a laptop. */
  /* N_SENS was 5,000, which could not resolve its own output: measured across
   * eight seeds the one-sided gain a lever prints wandered by 2-3pt, while
   * several of the levers being ranked have gains of 1.2-2.1pt in total. The
   * chart was ordering things it could not tell apart. 12,000 halves that, and
   * the rows are staged one per turn so the cost does not land on a frame. */
  var N_FAST = 4000, N_HEAVY = 60000, N_SENS = 12000;
  /* Below this, a lever's measured gain is not distinguishable from the noise
   * on measuring it at N_SENS, so the advice list must not print a number for
   * it. Set from the seed-to-seed spread above, with margin. */
  var SENS_FLOOR = 0.025;

  /* Sliders shown up front. Detection is driven by the posture selector, so the
   * two knobs behind it live in "more" — the reader picks a stack, not a dwell
   * time they have no way to estimate. */
  /* staff and mfa join the up-front set: they are the denominator and the
   * principal gate for the five non-vulnerability classes, so an identity card
   * whose every slider sat behind a disclosure would have hidden the two
   * controls the card exists for. */
  var BASIC = { exposed: 1, edge: 1, cadence: 1, stackVulns: 1, ai: 1, weap: 1, tempo: 1,
                discovery: 1, staff: 1, mfa: 1 };

  /* The scenario dials drawn together in chapter 07, in the order the chapter
   * argues them: the clock everyone means by "AI" first, then the ones that
   * turn out to matter more. Colours are the shared palette tokens, so the
   * curve and its slider are never a guess apart.
   *
   * `discovery` is last because it is the chapter's closing move, not because
   * it is least: it is the largest of the four on this estate, and the one no
   * version of this page could express until it existed. An autonomous
   * capability that finds bugs raises the SIZE of the stream rather than the
   * speed of anything, and the argument is only complete once a reader can see
   * that beside the clock the phrase is usually about. */
  var CLOCKS = [
    { k: 'ai',        l: 'Exploit arrival speed',      c: 'warn' },
    { k: 'weap',      l: 'Share of bugs weaponised',   c: 'att' },
    { k: 'tempo',     l: 'Post-exploitation tempo',    c: 'zero' },
    { k: 'discovery', l: 'Vulnerability discovery rate', c: 'bad' },
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
  /* Never lets rounding contradict the number: a probability that exists is
   * not shown as 0%, and one short of certainty is not shown as 100%. */
  var pctS = function (v) {
    var p = v * 100;
    if (p > 0 && p < 0.5) return '<1%';
    if (p >= 99.5 && p < 100) return '>99%';
    return p.toFixed(0) + '%';
  };
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
    if (IDN) parts.push('idn=' + IDN);
    if (PPL) parts.push('ppl=' + PPL);
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
    if (owns(M.IDENTITY, q.get('idn'))) IDN = q.get('idn');
    if (owns(M.PEOPLE, q.get('ppl'))) PPL = q.get('ppl');
    applyShape();
    Object.keys(d).forEach(function (k) {
      if (!q.has(k)) return;
      var v = parseFloat(q.get(k));
      if (!isFinite(v)) return;
      /* The model's own clamp, not a local range check. This clamped to
       * [min,max] and stopped, so a value off the slider's step survived into
       * P while syncAll() handed the input element a value the browser then
       * snapped — the reading on screen and the number being simulated were
       * different, silently, for the rest of the session. */
      P[k] = M.clampTo(k, v);
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
  /* Both slider tables as one list, concatenated once rather than on every
   * call — syncAll() rebuilt it on every trait click. KEYS gives the race
   * chart's memoisation signature a stable order to build from.
   *
   * A `spec(k)` lookup and its backing index used to live here too. Its last
   * caller was the range clamp in fromURL(), which now defers to the model's
   * own clampTo() so that the snapping arithmetic has one definition instead
   * of two — and with that caller gone the index had none. */
  var ALL_SPEC = M.SPEC.def.concat(M.SPEC.att, M.SPEC.idn);

  /* The eight access classes, in the order the model tallies them, with a
   * short form for narrow charts. Derived from M.ACCESS rather than restated,
   * so a class added to the model cannot go missing from the chart or arrive
   * with a label that disagrees with the one the deck prints. */
  var ACCESS_SHORT = {
    opportunistic: 'Opportunistic', targeted: 'Targeted campaign', supply: 'Supply chain',
    phishing: 'Phishing', credential: 'Credential abuse', misconfig: 'Misconfiguration',
    insider: 'Insider', physical: 'Device loss',
  };
  var ACCESS_ROWS = Object.keys(M.ACCESS).map(function (k) {
    return { key: k, label: M.ACCESS[k].l, short: ACCESS_SHORT[k] || M.ACCESS[k].l,
             tier: M.ACCESS[k].tier, d: M.ACCESS[k].d };
  });
  /* The five non-vulnerability routes with the control chain that gates each —
   * the caption the gates figure prints beside the route name. Filtered from
   * ACCESS_ROWS for the same reason ACCESS_ROWS is derived from ACCESS: a
   * hand-restated route list is a route list that drifts. */
  var GATE_CHAIN = {
    phishing: 'filtering → authentication',
    credential: 'authentication → privilege',
    misconfig: 'configuration assurance',
    insider: 'personnel and least privilege',
    physical: 'device encryption',
  };
  var GATE_ROWS = ACCESS_ROWS.filter(function (r) { return !M.ACCESS[r.key].vuln; })
    .map(function (r) { return { key: r.key, label: r.label, short: r.short, gate: GATE_CHAIN[r.key] || '' }; });
  var IDN_KEYS = Object.keys(M.IDENTITY);
  var KEYS = ALL_SPEC.map(function (s) { return s.k; });

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

  /* Chapter 07 argues four dials by name and the dials are in the rail,
   * thousands of pixels up the page. The rail used to answer that by pinning
   * the card that holds them, which kept the promise only on a tall desktop
   * and cost the other card a second scrollbar and 71% of its content. The
   * sentence carries the reader to the dial instead.
   *
   * The rail is scrolled directly rather than through scrollIntoView, which
   * walks *every* scrollable ancestor and would take the document with it —
   * moving the reader off the paragraph that sent them, which is the one
   * thing this must not do. Below 1041px the rail is a static grid and has no
   * scrollport of its own, so there the page genuinely does have to move and
   * scrollIntoView is the fallback rather than the method.
   *
   * Neither call asks for smooth. See the note on .rail in app.css: a smooth
   * programmatic scroll is silently dropped, not merely unanimated, wherever
   * the engine is not ticking one. The flash below is the orientation cue,
   * and unlike the travel it survives reduced motion. */
  var flashed = null, flashTimer = 0;
  function jumpToControl(k) {
    var input = $('i-' + k);
    if (!input) return;
    var ctrl = input.closest ? input.closest('.ctrl') : null;
    if (!ctrl) ctrl = input.parentNode;
    /* An advanced dial sits inside a collapsed <details>, which has no box to
     * scroll to until it is open. */
    var det = ctrl.closest && ctrl.closest('details');
    if (det && !det.open) det.open = true;

    var rail = document.querySelector('.rail');
    if (rail && rail.scrollHeight > rail.clientHeight + 1) {
      /* A third of the way down the scrollport rather than centred: the card
       * title is sticky at the top of it, and a dial that lands underneath
       * the title is a dial the reader was not shown. Offsets come off
       * bounding rects rather than offsetTop, which is measured against
       * whichever ancestor happens to be positioned. */
      var delta = ctrl.getBoundingClientRect().top - rail.getBoundingClientRect().top;
      rail.scrollTop = Math.max(0, rail.scrollTop + delta - rail.clientHeight / 3);
    } else if (ctrl.scrollIntoView) {
      ctrl.scrollIntoView({ block: 'center' });
    }

    /* Arriving is not enough: twelve sliders look alike, so the one the
     * sentence meant has to say so, and it has to say so to a keyboard reader
     * too — hence the focus, which also leaves the dial ready to be arrowed.
     * preventScroll because focus() would otherwise scroll the dial into view
     * on its own terms, undoing the third-of-the-scrollport placement above
     * and dropping it back under the sticky title. */
    if (flashed) flashed.classList.remove('flash');
    clearTimeout(flashTimer);
    /* Forces a reflow between remove and add so that a second press of the
     * same link replays the animation instead of doing nothing. */
    void ctrl.offsetWidth;
    ctrl.classList.add('flash');
    flashed = ctrl;
    flashTimer = setTimeout(function () {
      ctrl.classList.remove('flash');
      if (flashed === ctrl) flashed = null;
    }, 1800);
    input.focus({ preventScroll: true });
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
                 maturity: MAT, detection: DET, identity: IDN, people: PPL };
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
  /* The same question for the two identity ladders. Every coefficient a rung
   * writes is on the same 0-100 scale, so plain Euclidean distance over the
   * rung's own keys is the right metric here — no log term, because none of
   * these is a duration. */
  function closestOf(table) {
    var best = null, bestD = Infinity;
    Object.keys(table).forEach(function (k) {
      var p = table[k].p, d = 0;
      Object.keys(p).forEach(function (key) { d += Math.pow(P[key] - p[key], 2); });
      if (d < bestD) { bestD = d; best = k; }
    });
    return best;
  }
  function closestIdentity() { return closestOf(M.IDENTITY); }
  function closestPeople() { return closestOf(M.PEOPLE); }

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
      /* The estate is no longer only its systems. Four of the eight access
       * classes scale with headcount, and authentication strength gates the
       * two largest of those, so a summary omitting both would describe an
       * estate the model is not simulating. */
      M.fmtN(P.staff) + ' people with access',
      P.mfa + '% authentication strength',
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

  /* `nearOf` names what the derived match was derived FROM. It was hardcoded
   * to "your current dwell time and coverage", which is true of the detection
   * ladder and of nothing else — the two identity ladders inherited it and
   * told a screen-reader user that an authentication rung had been matched on
   * dwell time. Each caller now says what its own rungs are matched on. */
  function buildToggles(hostId, table, isOn, onPick, meta, nearOf) {
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
        ', closest match to your current ' + (nearOf || 'settings')));
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
    /* Three ladders can now be derived rather than chosen, so the flag is
     * carried in the row instead of tested against one id. Adding the identity
     * ladders to the list without this would have drawn a derived match as a
     * click the reader never made. */
    [['sel-exposure', EXP, false], ['sel-attention', ATTN, false],
     ['sel-maturity', MAT, false], ['sel-detection', det, !DET],
     ['sel-identity', IDN || closestIdentity(), !IDN],
     ['sel-people', PPL || closestPeople(), !PPL]].forEach(function (pair) {
      /* Moving a slider behind a ladder clears the explicit choice and lights
       * whichever posture the numbers now resemble. Shown identically to a
       * click, that reads as a selection the reader never made — so a derived
       * match is drawn as a match, and reports itself unpressed. */
      var derived = pair[2];
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
    var idn = IDN || closestIdentity(), ppl = PPL || closestPeople();
    setDesc($('desc-identity'), M.IDENTITY[idn] ? M.IDENTITY[idn].d : '');
    setDesc($('desc-people'), M.PEOPLE[ppl] ? M.PEOPLE[ppl].d : '');
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
      }, 'dwell time and coverage');
    /* Same treatment for the two identity ladders: each reports the strength
     * it writes, so a reader can see that "phishing-resistant" means 93 rather
     * than having to open the sliders behind it to find out. */
    buildToggles('sel-identity', M.IDENTITY,
      function (k) { return k === (IDN || closestIdentity()); },
      function (k) { IDN = k; applyShape(); syncAll(); refreshSelectors(); schedule(); },
      function (k) { return M.IDENTITY[k].p.mfa + '%'; }, 'authentication strength');
    buildToggles('sel-people', M.PEOPLE,
      function (k) { return k === (PPL || closestPeople()); },
      function (k) { PPL = k; applyShape(); syncAll(); refreshSelectors(); schedule(); },
      function (k) { return M.PEOPLE[k].p.awareness + '%'; }, 'filtering and personnel settings');
    refreshSelectors();
  }

  /* ── sensitivity ───────────────────────────────────────────────────────── */
  /* `lo` is the good end of each range and `hi` the bad one, which is what lets
   * renderActions() print the one-sided gain from moving a parameter the right
   * way. Ranges are plausible operating bounds, not slider extremes.
   *
   * Two levers were absent from this list for reasons that did not survive
   * being checked. `agentSkill` — access that needs no vulnerability — is the
   * LARGEST term in the entire model on the compromise metric, and a
   * sensitivity chart that omits its own largest term is not a sensitivity
   * chart. (It was second when it was added, behind supply-chain hits, and
   * the rebalanced attention ladder moved it past. The rank is measured, not
   * remembered: re-check it before restating it here or in the advice below.) `edrCoverage` reads as a flat zero on compromise, which
   * is exactly why it belongs: it is the clearest case the page has of a
   * control that is worthless on one metric and decisive on the other, and it
   * only makes that argument if it is drawn on both.
   *
   * One thing this chart cannot tell you, and should not be read as telling
   * you: how long a bar is depends on the RANGE chosen for it below, and those
   * ranges are judgement. `agentSkill` outranks every other lever at any range
   * that has been tried, down to 0.5-5%, so the ORDER at the top is a property
   * of the model. The 5x gap between its bar and the exposure bar is a property
   * of the range. Read the ranking, not the ratio. */
  var LEVERS = [
    { k: 'stackVulns',  lo: 8,    hi: 90,  l: 'Criticals in your stack' },
    { k: 'exposed',     lo: 25,   hi: 400, l: 'Exposed systems' },
    { k: 'edge',        lo: 0,    hi: 70,  l: 'Edge appliance share' },
    { k: 'inventory',   lo: 100,  hi: 70,  l: 'Inventory coverage' },
    { k: 'detect',      lo: 0.25, hi: 45,  l: 'Time to detect' },
    { k: 'edrCoverage', lo: 100,  hi: 0,   l: 'Endpoint telemetry coverage' },
    { k: 'cadence',     lo: 2,    hi: 60,  l: 'Routine remediation cycle' },
    { k: 'awareH',      lo: 4,    hi: 240, l: 'Triage to applicability' },
    { k: 'emergH',      lo: 12,   hi: 0,   l: 'Out-of-band remediation' },
    { k: 'emergHit',    lo: 95,   hi: 25,  l: 'Out-of-band trigger rate' },
    { k: 'virtual',     lo: 70,   hi: 0,   l: 'WAF / virtual patching' },
    { k: 'campaigns',   lo: 0,    hi: 30,  l: 'Targeted campaigns' },
    { k: 'agentSkill',  lo: 0.5,  hi: 40,  l: 'Campaign success without a vulnerability' },
    /* The identity and people controls. They enter the ranking on the same
     * terms as everything else — swept across their own declared travel — so
     * whether phishing-resistant authentication outranks patch cadence is
     * something the model answers rather than something the page asserts. */
    { k: 'mfa',         lo: 100,  hi: 0,   l: 'Authentication strength' },
    { k: 'awareness',   lo: 100,  hi: 0,   l: 'Filtering and user reporting' },
    { k: 'pam',         lo: 100,  hi: 0,   l: 'Privileged access management' },
    { k: 'configAssurance', lo: 100, hi: 0, l: 'Configuration assurance' },
    { k: 'insiderCtl',  lo: 100,  hi: 0,   l: 'Personnel and least privilege' },
    { k: 'deviceCtl',   lo: 100,  hi: 0,   l: 'Device encryption and management' },
    /* Swept over a range proportionate to the other scale terms, not over the
     * slider's full travel. `exposed` moves 25 to 400, about sixteenfold;
     * 100 to 5000 is fifty, and a lever given a wider range than its
     * neighbours ranks above them for that reason alone. The tornado compares
     * levers, so the ranges have to be comparable. */
    { k: 'staff',       lo: 200,  hi: 3000, l: 'People with access' },
    { k: 'supply',      lo: 0,    hi: 1,   l: 'Supply-chain hits' },
    { k: 'ai',          lo: 0,    hi: 80,  l: 'Exploit arrival speed' },
    { k: 'weap',        lo: 0,    hi: 80,  l: 'Share of bugs weaponised' },
    { k: 'tempo',       lo: 0,    hi: 80,  l: 'Post-exploitation tempo' },
    { k: 'discovery',   lo: 0,    hi: 80,  l: 'Vulnerability discovery rate' },
  ];
  var ADVICE = {
    stackVulns: ['Reduce edge software footprint', 'Each exposed product commits you to its vulnerability stream, and it is the one input here that scales with how much software you chose to run rather than with how well you run it.'],
    exposed:    ['Reduce the exposed attack surface', 'Fewer reachable systems reduces every other factor at the same time.'],
    edge:       ['Reduce or segment edge appliances', 'They remediate slower, support no endpoint agent, and are the asset class where mass exploitation begins at day zero.'],
    inventory:  ['Close the asset inventory gap', 'A system in no remediation cycle stays exposed for months rather than days.'],
    detect:     ['Reduce time to detect', 'This does not prevent compromise. It determines whether a compromise escalates to an incident, and no other parameter comes close on that metric.'],
    cadence:    ['Shorten the routine remediation cycle', 'Effective, but floored: around a fifth of exploitation precedes patch availability entirely.'],
    awareH:     ['Shorten triage to applicability', 'Once remediation runs in hours, triage is the entire timeline.'],
    emergH:     ['Establish an out-of-band remediation path', 'Without one, every urgent vulnerability inherits the routine cadence.'],
    emergHit:   ['Fix the trigger, not the speed', 'Remediating in hours has no effect if applicability is never established.'],
    virtual:    ['Front exposed services with enforceable rulesets', 'Recovers the exposure window while the permanent fix is tested. Does not cover appliances.'],
    campaigns:  ['Instrument the edge for enumeration', 'Targeted campaigns are distinguishable from background scanning where telemetry exists.'],
    supply:     ['Verify software provenance and integrity', 'Remediation cadence has no effect on this route.'],
    edrCoverage: ['Extend telemetry across the estate', 'Worth nothing against being compromised and a great deal against it becoming an incident. Appliances take no agent, so this has a ceiling you do not set.'],
    /* The one action on this list whose mechanism the model does not simulate.
     * It moves the residual rate at which a campaign succeeds with no
     * vulnerability to use, which is where phishing, credential abuse and
     * misconfiguration live — so the advice names the controls rather than
     * implying the model has costed them. */
    /* This entry used to read "close the routes that need no vulnerability"
     * and describe them as unsimulated — it was the model's apology for its
     * own biggest gap. Those routes are simulated now, each with its own
     * control below, so this no longer stands in for them and names only what
     * is genuinely left. */
    agentSkill: ['Raise the cost of a determined adversary', 'Segmentation, egress control and blast-radius limits. This sets what a targeted adversary achieves when no remediation window is open for them to use.'],
    mfa: ['Move to phishing-resistant authentication', 'Origin-bound credentials with no fallback path, including for the service desk, which is where this control is usually undone. It gates the two largest non-vulnerability routes at once.'],
    awareness: ['Improve filtering and shorten reporting time', 'Fewer credible lures reaching somebody who acts, and faster escalation when one does. This acts on arrival rather than on what happens afterwards, so it composes with authentication rather than overlapping it.'],
    pam: ['Reduce what a valid account reaches', 'Just-in-time privilege, vaulting and session brokering. The only control here that acts after an adversary already holds working credentials.'],
    configAssurance: ['Close reachable misconfiguration', 'Baselines, drift detection and external attack-surface monitoring. The one route here that no patch cycle can close, because there is nothing to patch.'],
    insiderCtl: ['Tighten personnel and least privilege', 'Joiner-mover-leaver rigour, least privilege and egress monitoring. Deliberately the weakest control effect here: an authorised person acting within their access is the hardest case in this model.'],
    deviceCtl: ['Complete device encryption and enrolment', 'Full-disk encryption, MDM and remote wipe. Small in absolute terms, and close to solved wherever it is done at all.'],
    staff: ['Reduce standing access', 'Four of the eight routes scale with how many people can authenticate. This is a denominator, not a headcount recommendation: fewer standing accounts and narrower access reduce it without anyone leaving.'],
  };

  function copyOf(src) { var o = {}; Object.keys(src).forEach(function (x) { o[x] = src[x]; }); return o; }
  function over(k, v, base) { var o = copyOf(base || P); o[k] = v; return o; }
  function sim(params, n, seed, wantSurv) {
    return M.simulate(params, n, seed, { surv: !!wantSurv, spread: 1 });
  }
  /* ── render ────────────────────────────────────────────────────────────── */
  var lastRun = null, lastSens = null, lastDens = null, lastLadder = null;
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
  /* Corrects each chart's pre-draw reservation for the CURRENT width. The
   * markup can only carry one height per chart and carries the wide one, so
   * on a narrow layout the box reserved before any script ran is wrong for
   * four of the eight charts, and the document shifted by the difference when
   * the settle pass finally drew them. Setting the drawn height here, at
   * boot, moves that correction from seconds in to script load. The
   * arithmetic is js/charts.js's own, so the two cannot drift. */
  function reserveHeights() {
    [['race'], ['funnel', M.FUNNEL.length], ['gates', GATE_ROWS.length],
     ['ladder', IDN_KEYS.length], ['routes', ACCESS_ROWS.length],
     ['surv'], ['torn', LEVERS.length], ['sweep'],
     ['severity', C.exploitation.bands.length], ['volume'],
    ].forEach(function (p) {
      var svg = $(p[0]);
      if (!svg) return;
      var h = CH.chartHeight(p[0], width(p[0]), p[1]);
      if (h) svg.setAttribute('height', h);
    });
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
  function setStat(id, value, fmt, unit, ci, straight, onSettle) {
    var el = $(id), ciEl = $(id + '-ci');
    if (!el) return;
    /* The interval used to be painted right here, before the value's settle had
     * even started. The settle runs on rAF, and the heavy pass that follows a
     * change can starve it for most of a second, so the pair sat on screen
     * visibly contradicting itself: a compromise probability of 27% beside a
     * 90% band of 81% to 85%. Neither figure was wrong. Showing them together
     * was, on a page whose whole claim is that its numbers are defensible.
     * The interval and anything else belonging to the same reading are now
     * painted by whichever branch paints the final value, so a reader never
     * sees half of one result against half of another. */
    var settle = function () {
      if (ciEl) ciEl.textContent = ci;
      if (onSettle) onSettle();
    };
    stopStat(id);

    var from = statAt[id];
    statAt[id] = value;
    if (!ANIM || straight || live() || value === null || !isFinite(value) ||
        typeof from !== 'number' || !isFinite(from) || from === value) {
      paintStat(el, fmt(value), unit);
      settle();
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
      settle();
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
      settle();
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
    var bandP = null, bandI = null;
    if (r.bandReliable) {
      lastBand.p = '90% band ' + pctS(r.pLo) + ' to ' + pctS(r.pHi);
      lastBand.i = '90% band ' + pctS(r.incLo) + ' to ' + pctS(r.incHi);
      /* The rail under the figure is the same reading as the interval beside
       * it, so it lands when the figure lands rather than ahead of it. */
      bandP = function () { setBand('s-p-band', r.pLo, r.pHi); };
      bandI = function () { setBand('s-i-band', r.incLo, r.incHi); };
    }
    setStat('s-p', r.p, fmtPct, 'of years', lastBand.p, false, bandP);
    setStat('s-i', r.incident, fmtPct, 'of years', lastBand.i, false, bandI);
    /* One unit. This used to add one per compromised SYSTEM on the mass
     * exploitation route and one per INTRUSION on every other, so the figure
     * was a sum of two different quantities and the caption had to say so.
     * Systems are reported beside it instead of mixed into it. */
    setStat('s-n', r.events, fmtEvents, 'intrusions',
      r.systems > r.events * 1.05
        ? fmtEvents(r.systems) + ' systems reached across them'
        : 'one response each, however many systems a campaign takes');
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

  function drawRace(r) {
    var d = raceDensities();
    CH.race($('race'), width('race'), d, palette());
    var n = empty($('race-note'));
    /* The clock the MODEL runs on: the pooled settled years, not the most
     * recent row. Naming `latest` here while simulating something else put two
     * different clocks in one sentence. */
    add(n, 'Measured clock, ' + C.pocTiming.settled.years[0] + '-' +
      C.pocTiming.settled.years[C.pocTiming.settled.years.length - 1] + ': median ',
      b(CH.fmtDays(d.median)), ' from publication to public exploit code.');
    if (P.ai > 0) {
      add(n, ' Modelled at ', b('+' + P.ai), ' compression, scaling that clock by ×' +
        d.scale.toFixed(2) + ': ', b(pctS(d.beforeFrac)),
        ' of exploits are already public when the CVE record lands.');
    } else {
      add(n, ' ', b(pctS(d.beforeFrac)), ' of exploits are already public when the CVE record lands.');
    }
    /* The scope of the figure, beside the figure. This chapter and the funnel
     * under it draw the mass-exploitation route and nothing else, and on most
     * estates that route is a minority of first compromises — exactly the
     * miscalibration the page argues against, so the two chapters that could
     * recreate it have to carry their own share, live. */
    if (r) {
      add(n, ' This figure and the funnel below cover the mass-exploitation route alone — ',
        b(pctS(r.routes[0])),
        ' of first compromises on this estate. The routes that need no vulnerability are gated in chapter 03.');
    }
  }

  function drawMain(r) {
    var pal = palette();
    drawRace(r);
    CH.funnel($('funnel'), width('funnel'), r, M.FUNNEL, pal);
    CH.gates($('gates'), width('gates'), r, pal, GATE_ROWS);
    CH.routes($('routes'), width('routes'), r, pal, M.SCOPE, ACCESS_ROWS);
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
    if (lastLadder) CH.ladder($('ladder'), width('ladder'), lastLadder, pal);
  }

  function fast() {
    var r = sim(P, N_FAST, SEED, true);
    lastRun = r;
    renderHead(r);
    drawMain(r);
  }

  /* The settle pass is the heaviest arithmetic on the page: a 60,000-trial run,
   * then two N_SENS-trial runs for each of the LEVERS rows, then one for each
   * point of each curve in CLOCKS. Run as one block it holds the main thread
   * for all of it — scrolling stops, hover states stick, and the theme button
   * does not answer until it ends.
   *
   * It is therefore cut into stages that yield to the browser between them:
   * six slices of the main run, the render, the baseline, one stage per lever,
   * the tornado, one stage per sweep point, and the sweep — which is 45 at the
   * present sizes of those two tables. The counts are deliberately not written
   * out as literals here; an earlier version of this comment said 26 runs and
   * 11 sweep points, and was describing a page that had since grown to 34 and
   * 18. No stage runs more than 10,000 trials or one lever, which measured
   * 55ms as the longest remaining block against 260ms for the unsliced pass.
   * Nothing is approximated: the
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

  /* Every control in the console reports within a frame, because schedule()
   * runs a 4,000-trial fast pass on the next rAF and only then queues the
   * settle. The metric toggle is the one control with nothing to put in that
   * frame: compromise and incident differ ONLY in the sensitivity bars, the
   * prioritised actions and the sweep, and all three are computed at the very
   * end of a settle — measured at 6.0s for the bars and 9.2s for the sweep.
   * Everything the fast pass would repaint is metric-independent and repaints
   * identically, so for six seconds the page answered a press with nothing at
   * all and the toggle was reported as a dead button. What it can honestly
   * offer in that frame is the fact that it heard the press. */
  function pendingHost(id) {
    var el = $(id);
    return el ? el.closest('.panel') : null;
  }
  function markPending(ids) {
    ids.forEach(function (id) {
      var p = pendingHost(id);
      if (!p || p.classList.contains('pending')) return;
      p.classList.add('pending');
      p.setAttribute('aria-busy', 'true');
    });
  }
  function clearPending(ids) {
    ids.forEach(function (id) {
      var p = pendingHost(id);
      if (!p) return;
      p.classList.remove('pending');
      p.removeAttribute('aria-busy');
    });
  }

  /* A queued MessageChannel task cannot be cancelled, so the generation
   * counter is what actually stops a superseded pass: a stale stage sees a
   * gen that no longer matches and returns without doing any work. The timer
   * handle is cleared too, for the fallback path. */
  var heavyGen = 0, heavyTimer = null;
  /* Held so a reader who presses both buttons in quick succession queues one
   * pass rather than two: the second press cancels the first press's waiting
   * frame instead of letting it start a settle that cancelHeavy would then
   * immediately abandon.
   *
   * Two handles, not one, for the reason schedule() carries two: a frame is
   * the right moment to start, but requestAnimationFrame does not fire at all
   * in a tab the browser is not painting. Gated on the frame alone, a metric
   * pressed in a background tab never started its pass — and the mark it had
   * already set stayed on three dimmed panels indefinitely, while the button
   * claimed a reading the charts below it were not showing. */
  var metricRaf = 0, metricTimer = null;

  /* The sensitivity bars and the sweep are chapters 03 and 07. Together they
   * are 75 of the settle's 76 simulations — about 27 of its 28 seconds — and a
   * reader at the top of the page has not asked for either yet. They are held
   * back until one of those panels comes within a screen and a half, which is
   * far enough ahead that a reader scrolling normally arms them before the
   * panel is on screen.
   *
   * Armed once, armed for the session: after a reader has been near either
   * chapter, every settle computes everything, because from then on they are
   * operating controls whose effect they expect to see there.
   *
   * This is a deferral, not a saving. A reader who scrolls straight to chapter
   * 03 waits the same time they always did — the work is the work. What it
   * buys is that the reader who never goes there does not pay for it, and that
   * the top of the page reaches its final numbers without 75 simulations
   * queued in front of them. */
  var sensArmed = false;
  function armSens() {
    if (sensArmed) return;
    sensArmed = true;
    /* Nothing to continue from before the first settle has produced a run;
     * that settle will include the tail itself, because it reads sensArmed
     * when it builds its stages. */
    if (!lastRun) return;
    markPending(['torn', 'acts', 'sweep']);
    heavy({ keepRun: true });
  }
  function runMetricPass() {
    if (metricRaf) { cancelAnimationFrame(metricRaf); metricRaf = 0; }
    if (metricTimer) { clearTimeout(metricTimer); metricTimer = null; }
    heavy({ keepRun: true });
  }
  function cancelHeavy() {
    heavyGen++;
    if (heavyTimer) { clearTimeout(heavyTimer); heavyTimer = null; }
  }
  /* One slice of the settle, in trials. It was 10,000, described as "~15ms of
   * the 92ms the full run costs" — true when it was written. That run now
   * costs 1,358ms in a browser, so the slice had quietly become 226ms and the
   * mechanism built to keep the page responsive was handing it four-frame
   * stalls instead. A figure sized against a measurement has to be re-measured
   * when the measurement moves, so this one is stated in trials and the cost
   * is quoted below rather than embedded in the number.
   *
   * Measured in a browser, not in node: the same 6,000-trial pass is 66ms
   * under node and 148ms in a browser, and sizing a responsiveness budget
   * against the faster of the two sizes it against a runtime no reader uses.
   * The test suite's own budget measures node, and can be green while this is
   * not.
   *
   * At 1,000 the whole sensitivity-and-sweep tail costs 3.1s of blocking time
   * across its 25 seconds, with a worst task of 94ms. Before slicing it was
   * 27.1s of blocking and a worst task of 1,011ms — a page that could not be
   * scrolled while it computed. Smaller slices are close to free: 1,000 and
   * 1,500 finish the tail within 200ms of each other, because what is added is
   * MessageChannel turns rather than arithmetic.
   *
   * The slicing does not approximate anything — see createRun in js/model.js:
   * the accumulators and the RNG live in the run, so a sliced run and a whole
   * one visit the same trials in the same order and produce bit-identical
   * results. That is asserted, not assumed: see the slicing test. */
  var SLICE_TRIALS = 1000;

  /* Every sensitivity and sweep figure used to be one atomic M.simulate call.
   * The settle makes 76 of them at 12,000 trials each, so 91% of the work on
   * the page bypassed the slicing entirely: 57 long tasks, 27 seconds of
   * blocked main thread, a median task of 544ms — one lever's two endpoints
   * back to back. The charts were not slow to arrive so much as the page was
   * unusable while they computed.
   *
   * This pushes one simulation as several stages over a run that is advanced a
   * slice at a time, which is what the main run has always done. `left` is
   * carried across the closures so a trial count that is not a whole multiple
   * of the slice cannot overshoot into a second pass over the tail. */
  function pushSlicedSim(stages, params, n, seed, opts, done) {
    var run = null, left = n;
    var slice = function () {
      var take = Math.min(SLICE_TRIALS, left);
      if (take > 0) { run.advance(take); left -= take; }
    };
    stages.push(function () { run = M.createRun(params, n, seed, opts); slice(); });
    for (var c = SLICE_TRIALS; c < n; c += SLICE_TRIALS) stages.push(slice);
    stages.push(function () { done(run.result()); });
  }
  /* `spread: 0` pins every assumption at its central value. A tornado measures
   * what moving a LEVER does; drawing the assumptions afresh on each endpoint
   * adds parameter noise to a bar that is supposed to isolate one parameter,
   * and at these trial counts that noise was reordering the chart. The credible
   * interval on the headline is where parameter uncertainty belongs, and it is
   * still drawn there.
   *
   * Every endpoint, the baseline and every sweep point MUST share this, and
   * that is why it is one object rather than a literal at each of the 76 call
   * sites: `base` and the bar ends were briefly out of step, and a gain of
   * base-minus-lo across two different conventions is not a gain, it is a
   * subtraction. Each also reseeds from SEED_SENS independently, so a figure
   * does not depend on which figures were computed before it — which is what
   * lets the settle compute them a slice at a time without moving any of
   * them. */
  var SENS_OPTS = { surv: false, spread: 0 };

  function heavy(opts) {
    cancelHeavy();
    var gen = heavyGen;
    /* A metric change moves nothing the main run reports. renderHead and
     * drawMain read no metric at all, so re-running 60,000 trials to arrive
     * at the same four headline figures spent 560ms of an already-long wait
     * and then re-tweened the stats to the values they were already showing —
     * motion in the one place that had not changed, while the three panels
     * that had sat untouched. Reuse the run and go straight to the arithmetic
     * the toggle actually alters. */
    var keepRun = !!(opts && opts.keepRun) && !!lastRun;

    /* One coherent estate for the whole pass. Every stage reads this rather
     * than the live parameters: a control moved mid-pass abandons the pass
     * outright, so no stage should ever be in a position to answer half about
     * one estate and half about another. */
    var snap = copyOf(P);
    /* The metric is part of that snapshot. Every stage read the live METRIC
     * while reading the estate from `snap`, which was safe only because a
     * metric change happens to cancel the pass — one guarantee standing on
     * another, in a function whose stated discipline is that no stage can
     * answer half about one reading and half about another. */
    var metric = METRIC;
    var run = keepRun ? null : M.createRun(snap, N_HEAVY, SEED, { surv: true, spread: 1 });

    var base = null, rows = [], sweepSeries = [];
    var stages = [];
    if (keepRun) {
      /* The URL is still stamped: the metric is part of the shared link, so a
       * reader who hands a colleague the address bar has to hand them the
       * reading they were looking at. */
      stages.push(function () { pushURL(); });
    } else {
      for (var c = 0; c < N_HEAVY; c += SLICE_TRIALS) {
        stages.push(function () { run.advance(SLICE_TRIALS); });
      }
      stages.push(function () {
        var r = run.result();
        lastRun = r;
        renderHead(r);
        drawMain(r);
        pushURL();
      });
    }

    /* Chapter 03's authentication ladder: the same estate at each identity
     * rung, weakest path in. Runs in every settle pass — the chapter sits
     * well above the sensitivity fold, so it cannot wait for armSens — and
     * re-runs on a metric change because the reading IS the metric. Four
     * short runs on the sensitivity settings: the ladder compares rungs
     * against each other, so what matters is that all four share a seed and
     * a trial count, not that they match the headline's. */
    var ladderVals = [];
    IDN_KEYS.forEach(function (rk) {
      var o = copyOf(snap);
      Object.keys(M.IDENTITY[rk].p).forEach(function (pk) { o[pk] = M.IDENTITY[rk].p[pk]; });
      pushSlicedSim(stages, o, N_SENS, SEED_SENS, SENS_OPTS, function (r2) {
        ladderVals.push({ k: rk, l: M.IDENTITY[rk].l, v: r2[metric] });
      });
    });
    stages.push(function () {
      var cur = closestIdentity();
      ladderVals.forEach(function (rw) { rw.cur = rw.k === cur; });
      lastLadder = ladderVals;
      CH.ladder($('ladder'), width('ladder'), ladderVals, palette());
      var nn = empty($('ladder-note'));
      add(nn, 'Annual probability of ' + (metric === 'p' ? 'compromise' : 'an incident') +
        ' for this estate, recomputed at each rung with everything else held. ' +
        'The highlighted rung is where the current authentication settings sit.');
    });

    /* Everything from here is chapters 04 and 08. Built only once a reader is
     * heading for them — see armSens. The stages already queued above are the
     * headline figures and the charts above the fold, which every reader
     * gets regardless. */
    if (!sensArmed) { runStages(stages, gen, metric); return; }

    /* Baseline computed with EXACTLY the seed and trial count the bars use, so
     * a bar can never be offset against a mismatched base. */
    pushSlicedSim(stages, snap, N_SENS, SEED_SENS, SENS_OPTS,
      function (r) { base = r[metric]; });
    /* One lever, both ends, as two sliced simulations and a stage that reads
     * them. This was sensitivityRow(), one stage doing both — which is what
     * made the median blocking task 544ms rather than 273ms: a lever is the
     * only place in the settle that ran two full simulations without yielding
     * between them. Each end reseeds from SEED_SENS independently, exactly as
     * before, so the pairing that makes the span meaningful is unchanged. */
    LEVERS.forEach(function (t) {
      var lo = null, hi = null;
      pushSlicedSim(stages, over(t.k, t.lo, snap), N_SENS, SEED_SENS, SENS_OPTS,
        function (r) { lo = r[metric]; });
      pushSlicedSim(stages, over(t.k, t.hi, snap), N_SENS, SEED_SENS, SENS_OPTS,
        function (r) { hi = r[metric]; });
      stages.push(function () {
        rows.push({ k: t.k, l: t.l, lo: lo, hi: hi, span: Math.abs(hi - lo) });
      });
    });
    stages.push(function () {
      rows.sort(function (x, y) { return y.span - x.span; });
      CH.tornado($('torn'), width('torn'), rows, base, palette());
      renderActions(rows, base, metric);
      /* Cleared per panel as that panel's own numbers land, not once at the
       * end of the pass: the bars are ready a full three seconds before the
       * sweep is, and holding the mark on a panel that is already showing the
       * new reading would teach the reader to ignore it.
       *
       * Guarded on the metric this pass was computed for. The mark belongs to
       * a metric change, but ANY pass repaints these panels — so an in-flight
       * pass that predates the press, finishing on the old metric, used to
       * clear a mark it had not answered and leave the page claiming one
       * reading while showing the other. */
      if (metric === METRIC) clearPending(['torn', 'acts']);
      /* Published with the bars, not eleven stages later with the sweep. A
       * redraw in that gap — a theme toggle, the resize debounce, beforeprint —
       * read lastSens and repainted the tornado with the PREVIOUS estate's
       * numbers, over bars that had already been redrawn with these. `sweep`
       * stays null until its points exist, so the same redraw leaves the sweep
       * chart alone rather than drawing it from a half-filled array. */
      lastSens = { base: base, rows: rows, sweep: null };
    });
    /* One curve per dial at six grid points each, rather than one curve at
     * eleven. Each is swept over its own travel with the others held where the
     * reader left them, so what the chart compares is four mechanisms against
     * one estate. Six points is enough: every one of these curves is smooth and
     * monotone, and the shape being compared is which of them is steepest. */
    CLOCKS.forEach(function (cl) {
      var pts = [];
      var cur = snap[cl.k] || 0;
      sweepSeries.push({ k: cl.k, l: cl.l, c: cl.c, cur: cur, pts: pts });
      /* The grid, plus the dial's exact current value when it sits between
       * grid points: the "you are here" marker is placed at that value, and on
       * a convex curve a marker between two sampled points would hang off the
       * drawn chord. */
      var samples = [0, 20, 40, 60, 80, 100];
      if (samples.indexOf(cur) < 0) samples.push(cur);
      samples.sort(function (x, y) { return x - y; });
      samples.forEach(function (v) {
        /* Points land in sweep order because the stages run in order, so the
         * curve does not have to be sorted back into shape afterwards. */
        pushSlicedSim(stages, over(cl.k, v, snap), N_SENS, SEED_SENS, SENS_OPTS,
          function (r) { pts.push([v, r[metric]]); });
      });
    });
    stages.push(function () {
      /* Every curve's marker sits at the baseline height, because each dial is
       * swept from the snapshot the baseline was computed from — so at its
       * current value each curve passes through exactly that number. It was a
       * further simulation of a figure already in hand. */
      sweepSeries.forEach(function (s2) { s2.curY = base; });
      lastSens = { base: base, rows: rows, sweep: sweepSeries };
      CH.sweep($('sweep'), width('sweep'), sweepSeries, palette());
      if (metric === METRIC) clearPending(['sweep']);
    });

    runStages(stages, gen, metric);
  }

  /* Drains a built stage list one turn at a time. Extracted from heavy() so
   * the pass can be started from more than one place in it — a settle that
   * stops after the main run, because chapters 03 and 07 have not been armed
   * yet, runs the same loop as one that carries the whole tail. */
  function runStages(stages, gen, metric) {
    var i = 0;
    var step = function () {
      heavyTimer = null;
      if (gen !== heavyGen) return;
      var stage = stages[i++];
      /* A throw in any one stage used to abandon the whole pass, and the pass
       * is where the tornado, the prioritised actions, the sweep and both
       * credible bands come from — so a single bad stage left four charts
       * showing the previous estate indefinitely, with nothing in the console
       * naming which one failed. These stages are independent pieces of
       * arithmetic over a snapshot that is already taken; losing one is not a
       * reason to lose the ones behind it. */
      try {
        stage();
      } catch (err) {
        if (window.console && console.error) {
          console.error('Exposure Race: settle stage ' + i + '/' + stages.length + ' failed', err);
        }
      }
      if (i < stages.length) heavyTimer = yieldTo(step);
      /* The mark is cleared by the stage that repaints each panel, and that
       * stage can throw — the catch above keeps the pass alive, which would
       * otherwise leave a panel dimmed and aria-busy with nothing left to
       * come. A pass that reaches its end owes the reader an un-marked page
       * whether or not every stage in it succeeded. */
      else if (metric === METRIC) clearPending(['torn', 'acts', 'sweep']);
    };
    heavyTimer = yieldTo(step);
  }

  function updateWild(r) {
    var n = empty($('wild-note'));
    add(n, 'Of the ', b(num(r.fn[2], 2)), ' vulnerabilities a year in your stack that acquire a working exploit, ',
      b(num(r.wild, 2)), ' (' + pctS(r.wildShare) + ') are confirmed exploited against live targets. ',
      b(num(r.critWild, 2)), ' of those are Critical-rated, roughly a third of what is actually ' +
      'exploited. The rest still draw opportunistic attack traffic, at a lower rate.');
    var nv = 0;
    ACCESS_ROWS.forEach(function (c, i) { if (!M.ACCESS[c.key].vuln) nv += r.routes[i]; });
    add(n, ' This funnel is one route of eight: the five that need no vulnerability carry ',
      b(pctS(nv)), ' of first compromises here, and are gated in the next chapter.');
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

  /* rows arrive ranked by the full span of the sensitivity bar, but what is
   * reported is the one-sided reduction from moving the parameter the good
   * way. Ranking by one number and printing another gave a list that read
   * −8.1, −7.9, −4.7, −1.7, −6.0.
   *
   * Shared with the deck export rather than reimplemented there. The deck's
   * recommendations slide is the page's list travelling without the page, so
   * a second copy of this ranking is a second answer waiting to disagree with
   * the first — and the reader would have no way to tell which was current. */
  function rankActions(rows, base) {
    return rows.filter(function (r) { return base - r.lo > SENS_FLOOR && ADVICE[r.k]; })
      .map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { o[k] = r[k]; });
        o.gain = base - r.lo; return o; })
      .sort(function (x, y) { return y.gain - x.gain; })
      .slice(0, 5);
  }

  function renderActions(rows, base, metric) {
    var acts = $('acts');
    var before = actPositions(acts);
    var host = empty(acts);
    var items = rankActions(rows, base);
    if (!items.length) {
      var li0 = E('li');
      var t0 = E('div', 'a-t');
      add(t0, b('No defender parameter moves this materially.'),
        E('span', null, 'At these settings the outcome is driven by routes the remediation process does not reach. See how the first compromise arrives, below.'));
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
    $('acts-metric').textContent = metric === 'p'
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
    if (id === 'funnel') return num(r.fn[0]) + ' published vulnerabilities a year become ' +
      num(r.fn[5], 2) + ' compromises';
    if (id === 'routes') return 'first compromise of the year, by route';
    if (id === 'surv') return pctS(r.p) + ' chance of compromise within 12 months';
    if (id === 'torn') return 'ranked by effect on the ' + (METRIC === 'p' ? 'compromise' : 'incident') + ' rate';
    /* Four dials, not one. This read 'what happens if the exploit clock
     * compresses further' — true of the chart before the AI slider was split,
     * and afterwards a caption that named the flattest of the curves and
     * silently attributed the rest to it. The exported PNG travels without
     * the chapter around it, so its caption has to carry the comparison. */
    if (id === 'sweep') return 'each scenario dial swept alone, against the same estate';
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
    /* Ten pairs of buttons reading "Copy" and "PNG" say nothing about what they
     * act on or what the difference is, and a screen reader meets them as ten
     * identical names. The visible label stays short; the accessible name and
     * the tooltip carry the chart and the verb. */
    var what = chartTitle(id);
    if (dl) {
      dl.title = 'Download the ' + what.toLowerCase() + ' chart as a PNG file';
      dl.setAttribute('aria-label', dl.title);
    }
    if (cp) {
      cp.title = 'Copy the ' + what.toLowerCase() + ' chart to the clipboard as an image';
      cp.setAttribute('aria-label', cp.title);
    }
    if (dl) dl.addEventListener('click', function () {
      render().then(function (bl) { download(bl, 'exposure-race-' + id + '.png'); toast('PNG saved'); })
        .catch(function () { toast('Could not render PNG'); });
    });
    if (cp) cp.addEventListener('click', function () {
      var blobP = render();
      var saveInstead = function (msg) {
        blobP.then(function (bl) { download(bl, 'exposure-race-' + id + '.png'); toast(msg); })
          .catch(function () { toast('Could not render PNG'); });
      };
      if (!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write)) {
        saveInstead('Clipboard unavailable. PNG saved instead');
        return;
      }
      /* The ClipboardItem is constructed inside the click, with the PNG
       * supplied as a promise: Safari rejects a write whose payload resolved
       * after the user gesture ended, and that failure used to land in the
       * render catch and report "Could not render PNG" for a render that had
       * succeeded. A clipboard refusal now falls back to the download. */
      var write;
      try {
        write = navigator.clipboard.write([new ClipboardItem({ 'image/png': blobP })]);
      } catch (e) {
        write = blobP.then(function (bl) {
          return navigator.clipboard.write([new ClipboardItem({ 'image/png': bl })]);
        });
      }
      write.then(function () { toast('Chart copied to clipboard'); })
        .catch(function () { saveInstead('Clipboard refused the image. PNG saved instead'); });
    });
  }

  /* ── deck export ───────────────────────────────────────────────────────── */
  /* Two PDFs reporting the run currently on screen: what was configured, what
   * came out, and what to do about it. js/deck.js owns the slides and the PDF;
   * this owns the reading they report, so neither can quote a figure the other
   * did not compute.
   *
   * The deck reports the reader's own estate rather than the page's general
   * argument. That is a deliberate reversal: a deck of the fixed argument is
   * something the page already is, and the thing a reader cannot otherwise
   * take out of here is their own number with the working behind it. The
   * scope limit travels on every slide that carries a figure — not as a
   * disclaimer at the end, because that is the slide people delete. */

  /* The tempo chapter's claim, computed rather than asserted: what 24/7
   * detection buys against a reported-tempo adversary, and what the same
   * investment buys against one at full tempo. Four runs at the sensitivity
   * trial count on one seed, so the two margins are comparable to each other
   * rather than each to its own noise. Only the detection pair and `tempo`
   * move — everything else stays on the reader's estate, so the margin the
   * slide reports is the one THEY would be buying. */
  function socMargin() {
    var at = function (tempo, posture) {
      var o = copyOf(P);
      o.tempo = tempo;
      o.detect = posture.detect;
      o.edrCoverage = posture.edrCoverage;
      return sim(o, N_SENS, SEED_SENS).incident;
    };
    var none = M.DETECTION.none.p, managed = M.DETECTION.managed.p;
    return { reported: at(0, none) - at(0, managed), full: at(100, none) - at(100, managed) };
  }

  /* The five shape controls, read back as the reader set them. These are the
   * questions the page asked, so the deck reprints the questions and not just
   * the resulting coefficients — a slide listing `edge 25%, detect 3` is a
   * dump of the model's internals, where "Internet-facing product / EDR +
   * tuned SIEM" is the estate the reader would recognise as theirs. */
  var DECK_PARAMS = [
    { k: 'exposed',     l: 'Exposed systems' },
    { k: 'staff',       l: 'People with access' },
    { k: 'stackVulns',  l: 'Criticals a year in your stack' },
    { k: 'edge',        l: 'Edge appliance share', u: '%' },
    { k: 'cadence',     l: 'Routine remediation cycle', u: ' days' },
    { k: 'inventory',   l: 'Inventory coverage', u: '%' },
    { k: 'detect',      l: 'Median time to detect', u: ' days' },
    { k: 'edrCoverage', l: 'Endpoint telemetry coverage', u: '%' },
    /* The identity half of the estate. A deck listing only the patch-side
     * parameters would describe an estate the model is no longer simulating —
     * five of its eight access classes are gated by these four. */
    { k: 'mfa',         l: 'Authentication strength', u: '%' },
    { k: 'awareness',   l: 'Filtering and user reporting', u: '%' },
    { k: 'pam',         l: 'Privileged access management', u: '%' },
    { k: 'configAssurance', l: 'Configuration assurance', u: '%' },
  ];
  function deckConfig() {
    var det = DET || closestDetection();
    var idn = IDN || closestIdentity(), ppl = PPL || closestPeople();
    var rows = [
      { l: 'What strangers can reach', v: M.EXPOSURE[EXP] ? M.EXPOSURE[EXP].l : 'not set' },
      { l: 'Adversary attention', v: M.ATTENTION[ATTN] ? M.ATTENTION[ATTN].l : 'not set' },
      { l: 'Remediation maturity', v: M.MATURITY[MAT] ? M.MATURITY[MAT].l : 'not set' },
      { l: 'Detection posture', v: M.DETECTION[det] ? M.DETECTION[det].l : 'not set' },
      { l: 'Authentication', v: M.IDENTITY[idn] ? M.IDENTITY[idn].l : 'not set' },
      { l: 'People and process', v: M.PEOPLE[ppl] ? M.PEOPLE[ppl].l : 'not set' },
    ];
    if (ON.length) {
      rows.splice(1, 0, { l: 'Also true of this estate',
        v: ON.map(function (k) { return M.TRAITS[k] ? M.TRAITS[k].l : k; }).join(' · ') });
    }
    /* Named only when moved. A scenario dial at zero is the measured record,
     * and listing three "as measured" rows on every deck would bury the one
     * that was actually turned up. */
    M.SCENARIO.forEach(function (k) {
      if (P[k]) rows.push({ l: SCEN_LABEL[k] + ' (scenario)', v: '+' + P[k] + ' of 100', scenario: true });
    });
    return rows;
  }
  function deckParams() {
    return DECK_PARAMS.map(function (d) {
      return { l: d.l, v: M.fmtN(P[d.k]) + (d.u || '') };
    });
  }
  var SCEN_LABEL = { ai: 'Exploit arrival speed', weap: 'Share of bugs weaponised',
                     tempo: 'Post-exploitation tempo',
                     discovery: 'Vulnerability discovery rate' };

  /* The same list the page prints, from the same ranking, so the deck cannot
   * recommend anything the panel above it does not. */
  function deckActions() {
    if (!lastSens || !lastSens.rows) return [];
    return rankActions(lastSens.rows, lastSens.base).map(function (r) {
      return { k: r.k, title: ADVICE[r.k][0], detail: ADVICE[r.k][1], gain: r.gain };
    });
  }

  /* The funnel and the route split, as rows. Built here rather than in
   * js/deck.js so the deck needs no handle on the model: it is handed the
   * stages the page drew, already labelled, and cannot fall out of step with
   * M.FUNNEL by carrying its own copy of the labels. */
  /* fmtEvents, not M.fmtN: the latter formats SLIDER values, where everything
   * under 1000 is already an integer, and it printed a funnel stage as
   * 34.01538333333333. Funnel stages are simulation output and need the
   * page's own rule — two decimals below ten, whole numbers above. */
  function deckFunnel(r) {
    if (!r || !r.fn) return [];
    return M.FUNNEL.map(function (l, i) {
      return { l: l, v: fmtEvents(r.fn[i]), strong: i === 0 || i === M.FUNNEL.length - 1 };
    });
  }
  /* Read off the model rather than restated here. This was a literal three-name
   * array against a route list the model owns, so every route added past the
   * third rendered as "undefined" in the deck and on the narrow-viewport routes
   * chart — the failure mode the FUNNEL and SCOPE lists were already derived to
   * avoid. `ACCESS` is the one definition of both the order and the names. */
  var ROUTE_LABEL = M.ROUTES.map(function (k) { return M.ACCESS[k].l; });
  function deckRoutes(r) {
    if (!r || !r.routes) return [];
    return r.routes.map(function (share, i) {
      return { l: ROUTE_LABEL[i], v: pctS(share) };
    });
  }

  /* Charts are passed as the live nodes rather than as data: the deck clones
   * whatever the page has actually drawn, so a chart cannot appear in a slide
   * in a state the reader never saw. A chart that has not been drawn yet has
   * no viewBox, and the deck drops it rather than framing an empty box. */
  function deckContext() {
    var charts = {};
    ['race', 'funnel', 'routes', 'surv', 'torn', 'sweep', 'severity', 'volume']
      .forEach(function (id) { var n = $(id); if (n) charts[id] = n; });
    return {
      pal: palette(), cal: C, run: lastRun, sens: lastSens, metric: METRIC,
      estate: estateSummary(), config: deckConfig(), params: deckParams(),
      actions: deckActions(), charts: charts, soc: socMargin(),
      funnel: deckFunnel(lastRun), routeRows: deckRoutes(lastRun),
      /* The trial and block counts the deck's method slides state. Passed
       * rather than retyped there, for the reason in that file's header:
       * nothing in the deck states a number of its own. */
      trials: N_HEAVY, blocks: M.coeffDrawsFor(N_HEAVY),
      /* Straight from the model's own scope declaration, so the caveat the
       * deck carries on every slide is the same string the page shows and
       * cannot be edited into something softer here. */
      scope: M.SCOPE,
      /* When the run was made, not when the corpus was cut — those are two
       * different dates and a deck that shows only the second invites the
       * reader to treat a six-month-old simulation as current. */
      dateLabel: new Date().toLocaleDateString('en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' }),
      /* The full URL, state and all. A colleague handed the deck can open the
       * exact configuration it reports rather than an empty page they then
       * have to reconstruct from the estate slide. */
      url: location.href,
    };
  }

  function wireDeck(id, kind, label, file) {
    var btn = $(id);
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      if (!window.DECK) { toast('Deck export is unavailable'); return; }
      var was = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Building…';
      /* Deferred so the disabled state and the label actually paint: the four
       * sensitivity runs and the first slide's layout are synchronous and
       * would otherwise block the paint they were meant to announce.
       *
       * A timer rather than requestAnimationFrame, for the reason schedule()
       * gives above — rAF does not fire in a background tab or an embedded
       * pane. There it is an optimisation with a backstop; here it would have
       * been the only path to the work, so a reader who clicked and switched
       * tabs came back to a button reading "Building…" and a deck that had
       * never started. A timer is clamped in that state, never skipped. */
      setTimeout(function () {
        window.DECK.build(kind, deckContext()).then(function (out) {
          download(out.blob, file);
          toast(out.pages + '-slide ' + label + ' saved');
        }, function (e) {
          toast('Could not build the ' + label);
          if (window.console) console.error(e);
        }).then(function () {
          btn.disabled = false;
          btn.textContent = was;
        });
      });
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
    /* Both rows report the pooled settled anchor, because that is what the
     * model is calibrated to. The most recent row is still worth showing — it
     * is the newest evidence a reader has — so it goes underneath, marked
     * provisional, instead of standing in for the anchor. */
    var sw = C.pocTiming.settled;
    anchorRow(host, 'Days from publication to a public exploit (median)', 'measured',
      num(sw.medianDays, 1) + ' d',
      'CyberMon · ' + sw.years[0] + '-' + sw.years[sw.years.length - 1] +
      ' complete years pooled, ' + thou(sw.n) + ' records, 90-day window');
    anchorRow(host, 'Exploits already public when the CVE record lands', 'measured',
      num(sw.pctBefore, 1) + '%',
      'CyberMon · same pooled window. Mostly NVD publication lag rather than pre-disclosure exploitation: the same series reads ' +
      C.pocTiming.recordLag.firstPctBefore + '% in ' + C.pocTiming.recordLag.firstYear +
      ', with a median as deep as ' + Math.abs(C.pocTiming.recordLag.worstMedianDays) +
      ' days before publication in ' + C.pocTiming.recordLag.worstYear);
    anchorRow(host, 'Most recent year, still collecting exploits', 'measured',
      C.pocTiming.latest.medianDays + ' d median · ' + C.pocTiming.latest.pctBefore + '% before',
      'CyberMon · ' + C.pocTiming.latest.year + ', ' +
      C.pocTiming.series[C.pocTiming.series.length - 1].n + ' records' +
      (C.pocTiming.latest.provisional ? '. Incomplete year, still collecting, not used to calibrate' : ''));
    /* The instrument's own coverage, stated beside what it measured. Every
     * row above this one is read off a catalogue whose sample per year has
     * fallen by roughly six sevenths since 2017 while CVE publication tripled,
     * and a reader who takes "median under a day" away from this panel is
     * entitled to know which population it is a median OF. This is the one
     * caveat on the page that qualifies the argument rather than the estate. */
    var trend = C.pocTiming.sampleTrend || [];
    var tPeak = trend.reduce(function (a, b) { return b.n > a.n ? b : a; }, trend[0] || { n: 0, year: 0 });
    var tLast = trend.filter(function (y) { return y.year <= 2024; }).pop() || tPeak;
    anchorRow(host, 'Exploit-catalogue coverage, peak year against latest complete year', 'measured',
      thou(tPeak.n) + ' → ' + thou(tLast.n) + ' CVEs a year',
      'CyberMon · ' + tPeak.year + ' vs ' + tLast.year +
      '. The sample shrank as CVE volume grew, so the weaponised share above is a floor');
    anchorRow(host, 'Criticals published worldwide, ' + C.volume.curYearRunRate.year + ' run-rate', 'measured',
      thou(C.volume.curYearRunRate.critical),
      'CyberMon · cvelistV5, ' + num(C.yearElapsed * 100) + '% of the year elapsed');
    anchorRow(host, 'Confirmed-exploited CVEs added worldwide per year', 'measured',
      C.inWild.kevAddedRunRate + ' (' + C.volume.curYearRunRate.year + ' run-rate)',
      'CyberMon · CISA KEV additions');
    anchorRow(host, 'CVEs NVD has stopped analysing', 'measured',
      thou(C.nvd.deferred) + ' (' + C.nvd.deferredShare.toFixed(1) + '%)',
      'CyberMon · NVD API status labels');
    /* The one anchor the non-vulnerability half has. No single rate on those
     * routes has a public measurement, so the aggregate they produce is what
     * gets held to a source — and the provenance panel has to say so, because
     * this is where a reader comes to ask what the people routes stand on. */
    anchorRow(host, 'Initial-access mix the non-vulnerability rates are tuned to', 'reported',
      ACCESS_ROWS.length + ' classes, ±' + Math.round(M.SCOPE.accessMix.tolerance * 100) + 'pt each',
      M.SCOPE.accessMix.src + '. No single rate on the routes that need no vulnerability has a ' +
      'public measurement, so the mix they produce is anchored instead — asserted in CI, and drawn ' +
      'against this estate in chapter 06');
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
      ' of Critical-rated CVEs carry an EPSS score below 1%. That is a probability of exploitation ' +
      'activity in the next 30 days, not over the life of the vulnerability. Critical is only ',
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
  /* Reports the anchor the MODEL runs on — the pooled settled years — not the
   * newest row. This is the masthead: the three figures the whole argument
   * rests on. Naming the 2026 row here while simulating the settled record put
   * the page's loudest claim and its own simulation on two different clocks. */
  function renderClock() {
    var host = empty($('clock'));
    var sw = C.pocTiming.settled;
    clockRow(host, 'Median days from publication to public exploit code, ' +
      sw.years[0] + '-' + sw.years[sw.years.length - 1],
      num(sw.medianDays, 1) + ' d');
    /* NOT "before the patch does". This is the share of the arming series with
     * a negative publication-to-exploit interval, and most of it is a late CVE
     * record standing in front of exploit code that is already public — the
     * same series reads 98.5% negative in 2000, at a median of 44 days before
     * publication, which is impossible as a statement about adversaries and
     * unremarkable as one about NVD. The masthead is where the page makes its
     * three strongest claims, so it is the last place to leave that reading
     * standing. See MODEL.MEASURED.preIsRecordLag. */
    clockRow(host, 'Exploits already public when the CVE record lands',
      num(sw.pctBefore, 1) + '%');
    /* A floor, and labelled as one: measured against three catalogues whose
     * dated sample fell from 1,019 CVEs a year to 94 while publication tripled. */
    clockRow(host, 'Criticals with public exploit code in three catalogues',
      C.armed.pPoCCritical + '% or more');
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

  /* Arms chapters 03 and 07 when a reader heads for them. A screen and a half
   * of margin, so the work starts before the panel is on screen rather than
   * when it arrives — the reader still waits, but they wait less.
   *
   * With no IntersectionObserver there is no way to know where a reader is, so
   * the deferral is dropped entirely rather than guessed at: the page computes
   * everything, exactly as it did before, which is the same bargain every
   * other observer here makes. */
  function observeSens() {
    if (!window.IntersectionObserver) { sensArmed = true; return; }
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      armSens();
    }, { rootMargin: '1200px 0px 1200px 0px' });
    ['p-torn', 'p-sweep'].forEach(function (id) {
      var el = $(id);
      if (el) io.observe(el);
    });
    /* Two ways to need these figures without having scrolled to them. Printing
     * lays out the whole document, and the deck quotes the prioritised actions
     * off lastSens. Neither can be served synchronously — the arithmetic is
     * twenty seconds long — so arming here does not make an immediate export
     * complete. It makes the second one complete, and it is the difference
     * between a figure that is late and a figure that never arrives. */
    window.addEventListener('beforeprint', armSens);
    ['deck-carousel', 'deck-internal'].forEach(function (id) {
      var b = $(id);
      if (b) b.addEventListener('click', armSens);
    });
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

    reserveHeights();
    fromURL();
    buildControls(M.SPEC.def, $('cd'), $('cd-adv'));
    buildControls(M.SPEC.att, $('ca'), $('ca-adv'));
    buildControls(M.SPEC.idn, $('ci'), $('ci-adv'));

    buildShapeUI();

    document.querySelectorAll('[data-ctl]').forEach(function (b) {
      b.addEventListener('click', function () { jumpToControl(b.dataset.ctl); });
    });
    document.querySelectorAll('[data-metric]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.dataset.metric === METRIC) return;
        METRIC = btn.dataset.metric;
        syncMetric();
        markPending(['torn', 'acts', 'sweep']);
        /* Marked, then given a frame to be SEEN before the settle takes the
         * thread. heavy() reaches its first 12,000-trial stage through a
         * MessageChannel task, which is soon enough to starve the rendering
         * update that would have painted the mark — so the class landed, the
         * button lit, and the three panels it describes went on looking
         * exactly as they had. Two frames: the first schedules the paint, the
         * second runs after it. The pass a reader is waiting on is six
         * seconds long; it can start 16ms later. */
        if (metricRaf) cancelAnimationFrame(metricRaf);
        if (metricTimer) clearTimeout(metricTimer);
        metricRaf = requestAnimationFrame(function () {
          metricRaf = requestAnimationFrame(runMetricPass);
        });
        metricTimer = setTimeout(runMetricPass, 90);
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
      ON = []; MAT = 'typical'; DET = null; IDN = null; PPL = null;
      P = M.defaults();
      syncAll();
      refreshSelectors();
      schedule();
    });

    /* The metric toggle is markup-default "Compromise"; a shared link may say
     * otherwise, and the chart would then disagree with its own button. */
    syncMetric();

    ['race', 'funnel', 'routes', 'surv', 'torn', 'sweep', 'severity', 'volume'].forEach(wireExport);
    wireDeck('deck-carousel', 'carousel', 'carousel', 'exposure-race-carousel.pdf');
    wireDeck('deck-internal', 'internal', 'briefing deck', 'exposure-race-briefing.pdf');

    document.querySelectorAll('[data-snapshot]').forEach(function (e) {
      e.textContent = C.generatedAt.slice(0, 10);
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
    /* The simulated list and its count, written from the model for the same
     * reason as everything else here: the page said "three routes" for as
     * long as there were three, and kept saying it for exactly as long as it
     * took somebody to notice there were now eight. */
    var COUNT_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
      'nine', 'ten'];
    document.querySelectorAll('[data-scope-count]').forEach(function (e) {
      var n = M.SCOPE.modelled.length;
      var word = COUNT_WORD[n] || String(n);
      e.textContent = word.charAt(0).toUpperCase() + word.slice(1);
    });
    document.querySelectorAll('[data-scope-modelled]').forEach(function (e) {
      e.textContent = M.SCOPE.modelled.map(function (l) { return l.toLowerCase(); }).join('; ');
    });
    /* How many of those classes need a published vulnerability. Read off the
     * ACCESS table rather than typed, so adding a ninth route cannot leave the
     * headline note claiming a split that no longer holds. */
    document.querySelectorAll('[data-scope-independence]').forEach(function (e) {
      e.textContent = M.SCOPE.routeIndependenceNote;
    });
    document.querySelectorAll('[data-scope-vulncount]').forEach(function (e) {
      var n = Object.keys(M.ACCESS).filter(function (k) { return M.ACCESS[k].vuln; }).length;
      var word = COUNT_WORD[n] || String(n);
      e.textContent = word.charAt(0).toUpperCase() + word.slice(1);
    });
    /* Trial and redraw counts for the method note, from the constants that
     * set them. See MODEL.coeffDrawsFor — not blocksFor, which understates
     * the redraw count by the partial block at the end of the run. */
    document.querySelectorAll('[data-n-heavy]').forEach(function (e) {
      e.textContent = N_HEAVY.toLocaleString('en-GB');
    });
    document.querySelectorAll('[data-n-fast]').forEach(function (e) {
      e.textContent = N_FAST.toLocaleString('en-GB');
    });
    document.querySelectorAll('[data-blocks]').forEach(function (e) {
      e.textContent = String(M.coeffDrawsFor(N_HEAVY));
    });

    renderAnchors();
    renderEvidence();
    renderClock();
    bindPrint();
    observeReveal();
    observeSens();
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
