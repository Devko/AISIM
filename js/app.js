/* Exposure Race — UI wiring.
 *
 * Note on DOM construction: js/calibration.js is regenerated from a network
 * fetch (tools/refresh-data.js). Its contents are therefore treated as data,
 * never as markup — every dynamic value goes in through textContent. innerHTML
 * is used only to clear containers.
 */
(function () {
  'use strict';
  var M = window.MODEL, CH = window.CHARTS, C = window.CALIBRATION;

  /* ── state ─────────────────────────────────────────────────────────────── */
  var P = M.defaults();
  var METRIC = 'p';                 /* 'p' = compromise, 'incident' = incident */
  var ON = [], MAT = 'typical', DET = null;   /* ON = selected traits, multi-select */
  var SEED = 1234, SEED_SENS = 7;
  var N_FAST = 4000, N_HEAVY = 14000, N_SENS = 5000;

  /* Sliders shown up front. Detection is driven by the posture selector, so the
   * two knobs behind it live in "more" — the reader picks a stack, not a dwell
   * time they have no way to estimate. */
  var BASIC = { exposed: 1, edge: 1, cadence: 1, stackVulns: 1, ai: 1 };

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
    $('theme-btn').textContent = t === 'dark' ? '☀ Light' : '☾ Dark';
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

      input.addEventListener('input', function (e) {
        P[s.k] = +e.target.value;
        setVal(s);
        if (s.k === 'detect' || s.k === 'edrCoverage') DET = null;
        refreshSelectors();
        schedule();
      });
      setVal(s);
    });
  }
  function setVal(s) { var e = $('v-' + s.k); if (e) e.textContent = s.f(P[s.k]); }

  function syncAll() {
    M.SPEC.def.concat(M.SPEC.att).forEach(function (s) {
      var i = $('i-' + s.k);
      if (i) { i.value = P[s.k]; setVal(s); }
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

  function buildToggles(hostId, table, isOn, onPick) {
    var host = empty($(hostId));
    Object.keys(table).forEach(function (key) {
      var btn = E('button', null, table[key].l);
      btn.type = 'button';
      btn.dataset.key = key;
      if (table[key].d) btn.title = table[key].d;
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
      document.querySelectorAll('#' + pair[0] + ' button').forEach(function (b2) {
        var on = b2.dataset.key === pair[1];
        b2.classList.toggle('on', on);
        b2.setAttribute('aria-pressed', String(on));
      });
    });
    $('desc-profile').textContent = ON.length
      ? estateSummary()
      : 'Nothing picked — a generic mid-size estate. ' + estateSummary();
    $('desc-detection').textContent = M.DETECTION[det] ? M.DETECTION[det].d : '';
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
    buildToggles('sel-detection', M.DETECTION,
      function (k) { return k === (DET || closestDetection()); },
      function (k) { DET = k; applyShape(); syncAll(); refreshSelectors(); schedule(); });
    refreshSelectors();
  }

  /* ── sensitivity ───────────────────────────────────────────────────────── */
  var LEVERS = [
    { k: 'stackVulns', lo: 8,    hi: 90,  l: 'Vulns in your stack' },
    { k: 'exposed',    lo: 25,   hi: 400, l: 'Exposed systems' },
    { k: 'edge',       lo: 0,    hi: 70,  l: 'Edge appliance share' },
    { k: 'inventory',  lo: 100,  hi: 86,  l: 'Inventory coverage' },
    { k: 'detect',     lo: 0.25, hi: 45,  l: 'Time to detect' },
    { k: 'cadence',    lo: 2,    hi: 60,  l: 'Patch cycle' },
    { k: 'awareH',     lo: 4,    hi: 240, l: 'Time to know it is yours' },
    { k: 'emergH',     lo: 12,   hi: 0,   l: 'Emergency patching' },
    { k: 'emergHit',   lo: 95,   hi: 25,  l: 'Emergency trigger rate' },
    { k: 'virtual',    lo: 70,   hi: 0,   l: 'WAF / virtual patching' },
    { k: 'campaigns',  lo: 0,    hi: 30,  l: 'Targeted campaigns' },
    { k: 'supply',     lo: 0,    hi: 1,   l: 'Supply-chain hits' },
    { k: 'ai',         lo: 0,    hi: 80,  l: 'Exploit-clock compression' },
  ];
  var ADVICE = {
    stackVulns: ['Run less software at the edge', 'Every product you expose is a subscription to its vulnerability stream. This is the largest single term in the model.'],
    exposed:    ['Cut the exposed surface', 'Fewer reachable systems shrinks every other term at once.'],
    edge:       ['Reduce or ring-fence edge appliances', 'They patch slower, take no endpoint agent, and are the class where mass exploitation starts on day zero.'],
    inventory:  ['Close the inventory gap', 'A system in no patch cycle is exposed for months, not days.'],
    detect:     ['Detect faster', 'This does not stop a compromise. It decides whether the compromise becomes an incident — and on that metric nothing else comes close.'],
    cadence:    ['Shorten the routine cycle', 'Helps, but it has a floor: a fifth of exploitation predates the patch entirely.'],
    awareH:     ['Shorten the time to know it is yours', 'Once you can patch in hours, knowing is the whole clock.'],
    emergH:     ['Build a real out-of-band path', 'Without one, every urgent bug inherits the routine cadence.'],
    emergHit:   ['Fix the trigger, not the speed', 'Patching in hours does not help if you do not know the bug touches you.'],
    virtual:    ['Put exposed services where a rule ships in minutes', 'Buys the window back while the real fix is tested. Does not cover appliances.'],
    campaigns:  ['Instrument the edge for enumeration', 'Targeted campaigns look different from background scanning, if anyone is looking.'],
    supply:     ['Verify what you install', 'Nothing in your patch cadence touches this route.'],
    ai:         ['Not yours to move', 'Plan the defender clock around it rather than hoping the attacker clock holds still.'],
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
  var lastHeavy = null, lastSens = null;

  function width(id) {
    return Math.max(280, Math.floor($(id).parentNode.getBoundingClientRect().width));
  }
  function setStat(id, value, unit, ci) {
    var v = $(id);
    empty(v);
    add(v, document.createTextNode(value), E('span', 'u', unit));
    $(id + '-ci').textContent = ci;
  }
  function renderHead(r) {
    setStat('s-p', pctS(r.p), 'of years', '90% band ' + pctS(r.pLo) + '–' + pctS(r.pHi));
    setStat('s-i', pctS(r.incident), 'of years', '90% band ' + pctS(r.incLo) + '–' + pctS(r.incHi));
    setStat('s-n', r.events < 10 ? num(r.events, 2) : num(r.events), 'expected', 'compromised systems / yr');
    if (r.med == null) setStat('s-t', '—', 'not reached', 'most years stay clean');
    else setStat('s-t', num(r.med), 'days', 'median time to first compromise');
  }

  function drawRace() {
    var d = M.densities(P, 30000);
    CH.race($('race'), width('race'), d, palette());
    var n = empty($('race-note'));
    add(n, 'Measured ' + C.pocTiming.latest.year + ' clock: median ',
      b(CH.fmtDays(d.median)), ' from publication to a public exploit, ',
      b(pctS(d.beforeFrac)), ' of them before the patch exists.');
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
    add(n, 'Of the ', b(num(r.fn[2], 2)), ' armed bugs a year, ', b(num(r.wild, 2)),
      ' (' + pctS(r.wildShare) + ') are confirmed used against real targets. The rest still draw ' +
      'opportunistic traffic, at a fraction of the hazard.');
  }

  function renderActions(rows, base) {
    var host = empty($('acts'));
    var items = rows.filter(function (r) { return base - r.lo > 0.004 && ADVICE[r.k]; }).slice(0, 5);
    if (!items.length) {
      var li0 = E('li');
      var t0 = E('div', 'a-t');
      add(t0, b('Nothing on your side moves this much.'),
        E('span', null, 'At these settings the outcome is driven by routes your patch process does not touch. Look at the route split.'));
      add(li0, t0, E('div', 'a-d', '—'));
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
      ? 'annual chance of compromise' : 'annual chance of an incident';
  }

  /* ── scheduling ────────────────────────────────────────────────────────── */
  var raf = null, slow = null;
  function schedule() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fast);
    clearTimeout(slow);
    slow = setTimeout(heavy, 260);
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
      bg: pal.panel, fg: pal.txt, mut: pal.mut,
      source: 'Exposure Race · calibrated to CyberMon ' + C.snapshot.cvelist + ' · devko.github.io/CyberMon',
    };
  }
  function subtitleFor(id) {
    var r = lastHeavy;
    if (!r) return '';
    if (id === 'race') return pctS(M.densities(P, 8000).pLate) + ' of armed bugs have a working exploit before the hole is closed';
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
        toast('Clipboard unavailable — PNG saved instead');
      }).catch(function () { toast('Could not render PNG'); });
    });
  }

  /* ── anchors ───────────────────────────────────────────────────────────── */
  function anchorRow(host, label, kind, value, note) {
    var wrap = E('div');
    var dt = E('dt');
    add(dt, document.createTextNode(label + ' '), E('span', 'tag ' + (kind === 'measured' ? 'm' : 'a'), kind));
    var dd = E('dd', kind === 'measured' ? 'measured' : 'assumed', value);
    var sm = E('span', null, note);
    sm.style.fontSize = '11px';
    sm.style.color = 'var(--dim)';
    add(wrap, dt, dd, sm);
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
      (C.pocTiming.latest.provisional ? ' — provisional, right-censored' : ''));
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
    Object.keys(M.ASSUMED).forEach(function (k) {
      var a = M.ASSUMED[k];
      anchorRow(host, k, 'assumed', a.v + '   (range ' + a.lo + '–' + a.hi + ')', a.why);
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
        var sp = E('span', null, n[0]);
        sp.style.color = 'var(--dim)';
        sp.style.fontFamily = 'var(--mono)';
        sp.style.fontSize = '11px';
        td0.appendChild(sp);
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
      ' High. That is a nudge, not a filter — which is why this model runs on whether an exploit exists, not on what the label says.');
  }

  /* ── init ──────────────────────────────────────────────────────────────── */
  function init() {
    try {
      var stored = localStorage.getItem('er-theme');
      if (stored) document.documentElement.setAttribute('data-theme', stored);
    } catch (e) { /* ignore */ }
    $('theme-btn').textContent = currentTheme() === 'dark' ? '☀ Light' : '☾ Dark';

    fromURL();
    buildControls(M.SPEC.def, $('cd'), $('cd-adv'));
    buildControls(M.SPEC.att, $('ca'), $('ca-adv'));

    buildShapeUI();
    document.querySelectorAll('[data-metric]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        METRIC = btn.dataset.metric;
        document.querySelectorAll('[data-metric]').forEach(function (x) { x.classList.toggle('on', x === btn); });
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
          function () { toast('Link copied — it carries your settings'); },
          function () { toast('Copy failed — the URL bar already has it'); });
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
    document.querySelectorAll('[data-metric]').forEach(function (x) {
      x.classList.toggle('on', x.dataset.metric === METRIC);
    });

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
    setTimeout(heavy, 30);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
