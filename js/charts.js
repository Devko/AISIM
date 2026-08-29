/* Exposure Race — chart rendering.
 *
 * Two rules make these charts work everywhere:
 *   1. Every chart is drawn at its container's REAL pixel width, so type is
 *      always ~11px. Nothing is scaled down into illegibility on a phone.
 *   2. Colours are passed in as literal hex, resolved once from CSS custom
 *      properties. CSS variables do not survive SVG serialisation, so a chart
 *      that referenced them directly would export to PNG as a black rectangle.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CHARTS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    return e;
  }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function path(pts) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  }
  /* Both stacks are literals rather than CSS tokens on purpose: charts are
   * serialised into a standalone SVG for PNG export, where no stylesheet
   * applies. A label with no font-family attribute rasterised as the
   * renderer's default serif — so every label carries its stack explicitly. */
  var SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

  /* No fill-opacity here on purpose. Two labels used to pass one and it was
   * silently dropped; wiring it up put 10px type at 3.8:1 in dark and 3.0:1
   * in light, under the floor DESIGN.md states and CI now enforces. Chart text
   * is de-emphasised by choosing a quieter token, never by fading a loud one. */
  function txt(svg, x, y, s, o) {
    o = o || {};
    var e = el('text', {
      x: x, y: y, 'font-size': o.fs || 11, 'text-anchor': o.a || 'start',
      fill: o.c, 'font-weight': o.w, 'letter-spacing': o.ls,
      'font-family': o.mono ? MONO : SANS, 'class': o.cls,
    });
    e.textContent = s;
    svg.appendChild(e);
    return e;
  }
  function frame(svg, w, h) {
    clear(svg);
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    return svg;
  }
  function ticks(a, b, n) {
    var step = (b - a) / (n || 7), p = Math.pow(10, Math.floor(Math.log10(step)));
    var s = [1, 2, 2.5, 5, 10].map(function (x) { return x * p; }).find(function (x) { return x >= step; }) || p * 10;
    var out = [];
    for (var v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) out.push(+v.toFixed(4));
    return out;
  }
  var pctS = function (v) { return (v * 100).toFixed(0) + '%'; };
  function fmtDays(d) {
    var x = Math.abs(d);
    return x < 1 ? Math.round(x * 24) + 'h' : x < 10 ? x.toFixed(1) + 'd' : Math.round(x) + 'd';
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * THE RACE — when an exploit exists vs when you have closed it.
   * ═══════════════════════════════════════════════════════════════════════ */
  function race(svg, w, d, pal) {
    var narrow = w < 620;
    /* The bottom gutter carries three stacked rows below the axis — tick
     * labels, the band name, then the scale caption. They get reserved slots
     * (BOT+18 / +36 / +50) rather than hand-tuned offsets, because two labels
     * anchored to the same edge will always eventually collide. */
    /* The narrow gutter carries one more row than the wide one: the
     * pre-disclosure readout cannot share a line with the band name at phone
     * width, so it drops beneath the cumulative caption. */
    var h = narrow ? 362 : 396;
    /* BOT is measured back from the bottom, so a fourth caption row has to
     * come out of the gutter rather than be added past the edge. */
    var L = 46, R = w - 14, T = narrow ? 44 : 38;
    var BOT = h - (narrow ? 76 : 62), MID = Math.round(T + (BOT - T) * 0.52);
    frame(svg, w, h);

    var defs = el('defs');
    /* Namespaced rather than a bare global `hx`: the defs live inside the
     * chart's own svg so the reference still resolves after toPNG deep-clones
     * it, and a second chart introducing a paint could not collide with it. */
    var hatchId = (svg.id || 'er') + '-hatch';
    var pat = el('pattern', { id: hatchId, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(48)' });
    pat.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: pal.bad, 'stroke-width': 2 }));
    defs.appendChild(pat);
    svg.appendChild(defs);

    var X = function (v) { return L + (R - L) * ((v - d.x0) / (d.x1 - d.x0)); };
    var Xi = function (i) { return X(d.x0 + (i + 0.5) * d.dx); };
    var x0px = X(0);
    /* Where day zero falls across the drawing, 0-1. The stylesheet draws the
     * cumulative curve at a constant rate, so this fraction is also the moment
     * the curve reaches the patch line — which is when the marker and its
     * readout are allowed to arrive, and not before. */
    svg.style.setProperty('--zt', Math.max(0, Math.min(1, (x0px - L) / (R - L))).toFixed(3));

    /* pre-disclosure zone */
    svg.appendChild(el('rect', { x: L, y: T, width: Math.max(0, x0px - L), height: BOT - T, fill: pal.zero, 'fill-opacity': 0.07 }));
    svg.appendChild(el('line', { x1: x0px, y1: T - 5, x2: x0px, y2: BOT + 4, stroke: pal.zero, 'stroke-width': 1.5 }));
    if (narrow) {
      txt(svg, x0px, T - 26, 'DAY 0 · PATCH AVAILABLE', { a: 'middle', c: pal.zero, fs: 10, ls: '.08em', mono: true });
      txt(svg, L, T - 10, '← exploit precedes patch', { c: pal.zero, fs: 10 });
    } else {
      txt(svg, x0px - 8, T - 12, '← EXPLOIT AVAILABLE BEFORE ANY PATCH', { a: 'end', c: pal.zero, fs: 10, ls: '.08em', mono: true });
      txt(svg, x0px + 8, T - 12, 'PATCH AVAILABLE · DAY 0', { c: pal.zero, fs: 10, ls: '.08em', mono: true });
    }

    ticks(d.x0, d.x1, narrow ? 5 : 8).forEach(function (t) {
      if (Math.abs(t) < 1e-9) return;
      var x = X(t);
      if (x < L - 1 || x > R + 1) return;
      svg.appendChild(el('line', { x1: x, y1: T, x2: x, y2: BOT, stroke: pal.rule }));
      txt(svg, x, BOT + 18, (t > 0 ? '+' : '') + Math.round(t) + 'd', { a: 'middle', c: pal.mut, fs: 10.5 });
    });
    svg.appendChild(el('line', { x1: L, y1: MID, x2: R, y2: MID, stroke: pal.rule2 }));

    /* defender density, drawn upward */
    var hUp = MID - T - 16;
    var dp = [[L, MID]];
    for (var i = 0; i < d.B; i++) dp.push([Xi(i), MID - d.D[i] * hUp]);
    dp.push([R, MID]);
    svg.appendChild(el('path', { 'class': 'ch-area', d: path(dp) + ' Z', fill: pal.def, 'fill-opacity': 0.14, stroke: pal.def, 'stroke-width': 2, 'stroke-linejoin': 'round' }));

    /* overlap = P(exploit already exists when you finally close it) */
    var sc = d.ovMax ? hUp / d.ovMax : 0;
    var op = [[L, MID]];
    for (var j = 0; j < d.B; j++) op.push([Xi(j), MID - d.ov[j] * sc]);
    op.push([R, MID]);
    svg.appendChild(el('path', { d: path(op) + ' Z', fill: 'url(#' + hatchId + ')', 'fill-opacity': 0.55, stroke: 'none' }));
    svg.appendChild(el('path', { d: path(op.slice(1, -1)), fill: 'none', stroke: pal.bad, 'stroke-width': 1.2, 'stroke-opacity': 0.85 }));

    /* Attacker side, drawn downward. The density alone is unreadable here: the
     * pre-disclosure mass is spread over weeks while the post-publication spike
     * lands in two days, so the shape that matters disappears. The cumulative
     * curve carries it — and it is the quantity the headline actually measures. */
    var hDn = BOT - MID - 12;
    var ap = [[L, MID]];
    for (var m = 0; m < d.B; m++) ap.push([Xi(m), MID + d.A[m] * hDn]);
    ap.push([R, MID]);
    svg.appendChild(el('path', { 'class': 'ch-area', d: path(ap) + ' Z', fill: pal.att, 'fill-opacity': 0.13, stroke: pal.att, 'stroke-width': 1, 'stroke-opacity': 0.45, 'stroke-linejoin': 'round' }));

    if (d.cum) {
      var cp = [];
      for (var q = 0; q < d.B; q++) cp.push([Xi(q), MID + d.cum[q] * hDn]);
      /* `pathLength` normalises the dash unit to 1 so the stylesheet can draw
       * this curve without knowing its length. The dash itself is CSS-only:
       * a dasharray attribute here would export a half-drawn line. */
      svg.appendChild(el('path', {
        'class': 'ch-line ch-draw', d: path(cp), fill: 'none', stroke: pal.att,
        'stroke-width': 2.4, 'stroke-linejoin': 'round', pathLength: 1,
      }));

      /* gridlines for the cumulative axis */
      [0.25, 0.5, 0.75, 1].forEach(function (f) {
        var y = MID + f * hDn;
        svg.appendChild(el('line', { x1: L, y1: y, x2: R, y2: y, stroke: pal.att, 'stroke-opacity': 0.16, 'stroke-dasharray': '2 4' }));
        txt(svg, L - 5, y + 3, Math.round(f * 100) + '%', { a: 'end', c: pal.att, fs: 10, mono: true });
      });

      /* the share already armed at day zero — the number the page is about */
      var atZero = d.beforeFrac;
      var yz = MID + atZero * hDn;
      svg.appendChild(el('circle', { 'class': 'ch-mark ch-late', cx: x0px, cy: yz, r: 4, fill: pal.att, stroke: pal.ink, 'stroke-width': 1.5 }));
      /* Clamped and shortened rather than left to run past the right edge:
       * the marker sits wherever day zero falls, which on a phone can be most
       * of the way across the drawing. */
      var zLab = narrow ? pctS(atZero) + ' exploitable' : pctS(atZero) + ' already exploitable';
      txt(svg, Math.min(x0px + 8, R - zLab.length * 6.2), yz + 4, zLab,
        { c: pal.att, fs: 10.5, w: 600, cls: 'ch-mark ch-late' });
    }

    /* Overflow: mass outside the drawn window is labelled, not folded into the
     * edge bins. Folding it in would make a spike that hides the real shape. */
    var of = d.overflow || { aBelow: 0, aAbove: 0, dAbove: 0 };
    var chip = function (x, y, anchor, colour, label) {
      var t = txt(svg, x, y, label, { a: anchor, c: colour, fs: 10, mono: true });
      t.setAttribute('opacity', '.95');
    };
    if (of.aBelow > 0.004) chip(L + 2, BOT - 4, 'start', pal.att, '◂ ' + pctS(of.aBelow) + ' earlier');
    if (of.aAbove > 0.004) chip(R - 2, BOT - 4, 'end', pal.att, pctS(of.aAbove) + ' later ▸');
    /* Clear of the headline badge, which is opaque, drawn later, and occupies
     * T+4 to T+64 against the right edge. */
    if (of.dAbove > 0.004) chip(R - 2, T + 80, 'end', pal.def, pctS(of.dAbove) + ' unremediated ▸');

    /* Narrow shortens both band names: the full strings run under the headline
     * badge and the day-zero readout at phone widths. */
    txt(svg, L, T + 12, narrow ? 'REMEDIATED' : 'WHEN REMEDIATION COMPLETES',
      { c: pal.def, fs: 10.5, ls: '.09em', mono: true });
    txt(svg, L, BOT + 36, narrow ? 'EXPLOIT AVAILABLE' : 'WHEN PUBLIC EXPLOIT CODE EXISTS',
      { c: pal.att, fs: 10.5, ls: '.09em', mono: true });
    if (d.cum) {
      txt(svg, L, BOT + 50, 'cumulative share of exploits available by day',
        { c: pal.att, fs: 10 });
    }

    /* headline badge */
    var bw = narrow ? 152 : 272, bh = 60, bx = R - bw - 2, by = T + 4;
    svg.appendChild(el('rect', { x: bx, y: by, width: bw, height: bh, rx: 8, fill: pal.sunk, stroke: pal.rule }));
    var n1 = el('text', {
      x: bx + 14, y: by + 32, 'font-size': 28, fill: pal.bad, 'font-weight': 800,
      'font-family': SANS,
    });
    n1.textContent = pctS(d.pLate);
    svg.appendChild(n1);
    txt(svg, bx + 14, by + 48, narrow ? 'EXPLOITED FIRST' : 'OF WEAPONISED VULNS, EXPLOITED FIRST',
      { c: pal.mut, fs: 10, ls: '.07em', mono: true });

    txt(svg, narrow ? L : R, BOT + (narrow ? 64 : 36),
      pctS(d.beforeFrac) + ' precede disclosure',
      { a: narrow ? 'start' : 'end', c: pal.mut, fs: 10.5 });
    return svg;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ATTRITION FUNNEL
   * ═══════════════════════════════════════════════════════════════════════ */
  function funnel(svg, w, r, labels, pal) {
    var narrow = w < 640;
    var rh = narrow ? 52 : 40;
    /* The narrow branch puts the label above its bar, which pushes the whole
     * stack down by one row's worth; the caption underneath then needs the
     * extra gutter or it is drawn past the bottom edge. */
    var h = labels.length * rh + (narrow ? 48 : 34);
    frame(svg, w, h);
    var L = narrow ? 8 : 300, R = w - 58, T = 10;
    var max = Math.max.apply(null, r.fn.concat([1e-3]));

    r.fn.forEach(function (v, i) {
      var y = T + i * rh + (narrow ? 16 : 0);
      var bw = Math.max(1.5, (R - L) * Math.sqrt(v / max));
      var col = i === 0 ? pal.dim : i < 2 ? pal.def : i < 4 ? pal.warn : pal.bad;
      var barY = narrow ? y + 2 : y;

      if (narrow) txt(svg, L, y - 4, labels[i], { c: i === 5 ? pal.txt : pal.mut, fs: 11.5 });
      else txt(svg, L - 12, y + 15, labels[i], { a: 'end', c: i === 5 ? pal.txt : pal.mut, fs: 11.5 });

      svg.appendChild(el('rect', { 'class': 'ch-track', x: L, y: barY, width: Math.max(0, R - L), height: 19, rx: 3, fill: pal.sunk }));
      svg.appendChild(el('rect', { 'class': 'ch-bar', style: '--i:' + i, x: L, y: barY, width: bw, height: 19, rx: 3, fill: col, 'fill-opacity': i === 5 ? 1 : 0.8 }));
      txt(svg, Math.min(R + 6, L + bw + 7), barY + 14, v < 1 ? v.toFixed(2) : v.toFixed(1), { c: col, fs: 12, w: 600, mono: true });

      if (i) {
        var drop = r.fn[i - 1] > 0 ? (1 - v / r.fn[i - 1]) * 100 : 0;
        /* Narrow puts the label above the bar, so the delta goes below it
         * rather than sharing the label's line — six of these labels are long
         * enough to reach the right edge at phone width. */
        txt(svg, narrow ? R : L - 12, narrow ? barY + 32 : y + 1,
          '−' + drop.toFixed(0) + '%', { a: 'end', c: pal.dim, fs: 10, mono: true });
      }
    });
    txt(svg, L, T + labels.length * rh + (narrow ? 26 : 16), 'per simulated year, bar width square-root scaled', { c: pal.dim, fs: 10 });
    return svg;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * ROUTES IN
   * ═══════════════════════════════════════════════════════════════════════ */
  function routes(svg, w, r, pal) {
    /* SVG text does not wrap, so the full labels run off the drawing below
     * roughly 430px. The short forms say the same thing in the space there
     * actually is. */
    var narrow = w < 400;
    var names = narrow ? [
      'Opportunistic exploitation',
      'Targeted campaign',
      'Supply chain',
    ] : [
      'Opportunistic: mass exploitation in the exposure window',
      'Targeted campaign against the exposed estate',
      'Supply chain: remediation cadence does not apply',
    ];
    var cols = [pal.att, pal.warn, pal.zero];
    var rh = 56, h = names.length * rh + 6;
    frame(svg, w, h);
    var L = 2, R = w - 4;
    r.routes.forEach(function (v, i) {
      var y = 20 + i * rh;
      txt(svg, L, y - 7, names[i], { c: pal.txt, fs: 11.5 });
      svg.appendChild(el('rect', { 'class': 'ch-track', x: L, y: y, width: R - L, height: 12, rx: 3, fill: pal.sunk }));
      svg.appendChild(el('rect', { 'class': 'ch-bar', style: '--i:' + i, x: L, y: y, width: Math.max(0, (R - L) * v), height: 12, rx: 3, fill: cols[i] }));
      txt(svg, L, y + 30, pctS(v), { c: cols[i], fs: 14, w: 700, mono: true });
    });
    return svg;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * SURVIVAL
   * ═══════════════════════════════════════════════════════════════════════ */
  function survival(svg, w, r, pal) {
    var h = 236;
    frame(svg, w, h);
    var L = 40, R = w - 10, T = 12, B = h - 34;
    for (var i = 0; i <= 4; i++) {
      var y = T + (B - T) * i / 4;
      svg.appendChild(el('line', { x1: L, y1: y, x2: R, y2: y, stroke: pal.rule }));
      txt(svg, L - 7, y + 4, (100 - i * 25) + '%', { a: 'end', c: pal.mut, fs: 10 });
    }
    /* The last tick sits exactly on the right edge, so it is anchored to it:
     * centred, half the label hangs outside the drawing and is cut off. */
    [0, 90, 180, 270, 365].forEach(function (d) {
      txt(svg, L + (R - L) * d / 365, B + 17, d ? d + 'd' : 'day 0',
        { a: d === 365 ? 'end' : 'middle', c: pal.mut, fs: 10 });
    });
    var pts = r.surv.map(function (v, i) { return [L + (R - L) * i / 365, T + (B - T) * (1 - v)]; });
    svg.appendChild(el('path', { 'class': 'ch-area', d: path(pts) + ' L ' + R + ' ' + B + ' L ' + L + ' ' + B + ' Z', fill: pal.def, 'fill-opacity': 0.10 }));
    svg.appendChild(el('path', { 'class': 'ch-line', d: path(pts), fill: 'none', stroke: pal.def, 'stroke-width': 2.2 }));

    var half = -1;
    for (var k = 0; k <= 365; k++) if (r.surv[k] <= 0.5) { half = k; break; }
    if (half > 0) {
      var x = L + (R - L) * half / 365;
      svg.appendChild(el('line', { x1: x, y1: T, x2: x, y2: B, stroke: pal.bad, 'stroke-dasharray': '3 3' }));
      txt(svg, x + 5, T + 11, 'day ' + half, { c: pal.bad, fs: 10.5, mono: true });
    }
    txt(svg, R, T + 11, pctS(r.surv[365]) + ' of years clean', { a: 'end', c: pal.mut, fs: 10.5 });
    return svg;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * TORNADO — ranked sensitivity, with the baseline drawn from the SAME
   * seed and trial count as the bars.
   * ═══════════════════════════════════════════════════════════════════════ */
  function tornado(svg, w, rows, base, pal) {
    var narrow = w < 560;
    var rh = narrow ? 34 : 25;
    /* The top gutter has to clear the baseline caption drawn above the first
     * row, and the bottom one the better/worse legend. Both were previously
     * saved by the letterboxing that came from measuring the chart too wide;
     * drawn at true width there is nothing to hide a label in. */
    var h = rows.length * rh + 54;
    frame(svg, w, h);
    var labelW = narrow ? 0 : Math.min(190, w * 0.36);
    var valW = 52;
    var CX = narrow ? (w - valW) / 2 : labelW + (w - labelW - valW) / 2;
    var half = narrow ? (w - valW) / 2 - 6 : (w - labelW - valW) / 2 - 8;
    var T = narrow ? 26 : 22;
    var span = Math.max(0.02, Math.max.apply(null, rows.map(function (r) {
      return Math.max(Math.abs(r.hi - base), Math.abs(base - r.lo));
    })));

    svg.appendChild(el('line', { x1: CX, y1: T - 6, x2: CX, y2: T + rows.length * rh, stroke: pal.rule2 }));
    rows.forEach(function (r, i) {
      var y = T + i * rh;
      if (narrow) txt(svg, 2, y - 5, r.l, { c: pal.txt, fs: 11 });
      else txt(svg, labelW - 10, y + 12, r.l, { a: 'end', c: pal.txt, fs: 11 });
      [[(r.lo - base) / span * half, pal.def], [(r.hi - base) / span * half, pal.att]].forEach(function (pair) {
        var dxv = pair[0], col = pair[1], bw = Math.abs(dxv);
        if (bw < 0.7) return;
        svg.appendChild(el('rect', {
          'class': dxv < 0 ? 'ch-bar ch-bar-r' : 'ch-bar', style: '--i:' + i,
          x: dxv < 0 ? CX - bw : CX, y: y + (narrow ? 1 : 3), width: bw, height: 13, rx: 2, fill: col, 'fill-opacity': 0.9,
        }));
      });
      txt(svg, w - 2, y + (narrow ? 12 : 13), pctS(r.lo) + '→' + pctS(r.hi), { a: 'end', c: pal.mut, fs: 10, mono: true });
    });
    var fy = T + rows.length * rh + 16;
    txt(svg, CX - 8, fy, '← better', { a: 'end', c: pal.def, fs: 10 });
    txt(svg, CX + 8, fy, 'worse →', { c: pal.att, fs: 10 });
    /* Centred, the caption lands on the first row's label once the labels move
     * to the left edge in the narrow branch. */
    txt(svg, narrow ? w - 2 : CX, T - 10, 'baseline ' + pctS(base),
      { a: narrow ? 'end' : 'middle', c: pal.mut, fs: 10, mono: true });
    return svg;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * COMPRESSION SWEEP
   * ═══════════════════════════════════════════════════════════════════════ */
  function sweep(svg, w, pts, curX, curY, pal) {
    var h = 236;
    frame(svg, w, h);
    var L = 40, R = w - 10, T = 12, B = h - 40;
    var max = Math.max.apply(null, [0.05].concat(pts.map(function (p) { return p[1]; }))) * 1.14;
    for (var i = 0; i <= 4; i++) {
      var y = T + (B - T) * i / 4;
      svg.appendChild(el('line', { x1: L, y1: y, x2: R, y2: y, stroke: pal.rule }));
      txt(svg, L - 7, y + 4, pctS(max * (1 - i / 4)), { a: 'end', c: pal.mut, fs: 10 });
    }
    [0, 25, 50, 75, 100].forEach(function (a) {
      txt(svg, L + (R - L) * a / 100, B + 17, a === 0 ? 'measured' : '+' + a,
        { a: a === 100 ? 'end' : 'middle', c: pal.mut, fs: 10 });
    });
    var XY = function (p) { return [L + (R - L) * p[0] / 100, T + (B - T) * (1 - p[1] / max)]; };
    var P2 = pts.map(XY);
    svg.appendChild(el('path', { 'class': 'ch-area', d: path(P2) + ' L ' + R + ' ' + B + ' L ' + L + ' ' + B + ' Z', fill: pal.att, 'fill-opacity': 0.10 }));
    svg.appendChild(el('path', { 'class': 'ch-line', d: path(P2), fill: 'none', stroke: pal.att, 'stroke-width': 2.2 }));
    var c = XY([curX, curY]);
    svg.appendChild(el('line', { x1: c[0], y1: T, x2: c[0], y2: B, stroke: pal.txt, 'stroke-dasharray': '3 3', 'stroke-opacity': 0.6 }));
    svg.appendChild(el('circle', { 'class': 'ch-mark', cx: c[0], cy: c[1], r: 4.5, fill: pal.txt }));
    txt(svg, Math.min(c[0] + 8, R - 60), Math.max(T + 12, c[1] - 9), 'current settings', { c: pal.txt, fs: 10.5 });
    txt(svg, L, B + 34, 'modelled exploit-clock compression →', { c: pal.dim, fs: 10 });
    return svg;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * SEVERITY EVIDENCE — exploitation rate by CVSS band. The chart that
   * justifies not using CVSS severity as the model's primitive.
   * ═══════════════════════════════════════════════════════════════════════ */
  function severity(svg, w, cal, pal) {
    var bands = cal.exploitation.bands;
    var narrow = w < 560;
    var rh = 46, h = bands.length * rh + (w < 620 ? 68 : 52);
    frame(svg, w, h);
    var L = narrow ? 66 : 96, R = w - 92, T = 20;
    var max = Math.max.apply(null, bands.map(function (b) { return b.pExploited; }));
    var names = { '9.0-10.0': 'Critical', '7.0-8.9': 'High', '4.0-6.9': 'Medium', '0.1-3.9': 'Low' };
    var order = ['9.0-10.0', '7.0-8.9', '4.0-6.9', '0.1-3.9'];

    /* Captions about the whole figure are set flush with the column's text
     * edge, not with the plot area, so they line up with the chapter's prose
     * rather than floating in from the label gutter. */
    txt(svg, 0, T - 6, narrow ? 'CONFIRMED EXPLOITED, BY BAND'
      : 'SHARE OF EACH SEVERITY BAND CONFIRMED EXPLOITED',
      { c: pal.mut, fs: 10, ls: '.08em', mono: true });

    order.forEach(function (key, i) {
      var b = bands.find(function (x) { return x.band === key; });
      if (!b) return;
      var y = T + i * rh + 6;
      var bw = Math.max(2, (R - L) * (b.pExploited / max));
      var col = i === 0 ? pal.bad : i === 1 ? pal.att : pal.mut;
      txt(svg, L - 10, y + 15, names[key], { a: 'end', c: pal.txt, fs: 12.5, w: 600 });
      txt(svg, L - 10, y + 28, key, { a: 'end', c: pal.dim, fs: 10, mono: true });
      svg.appendChild(el('rect', { 'class': 'ch-track', x: L, y: y, width: Math.max(0, R - L), height: 21, rx: 3, fill: pal.sunk }));
      svg.appendChild(el('rect', { 'class': 'ch-bar', style: '--i:' + i, x: L, y: y, width: bw, height: 21, rx: 3, fill: col, 'fill-opacity': 0.9 }));
      txt(svg, L + bw + 8, y + 15, b.pExploited.toFixed(2) + '%', { c: col, fs: 12.5, w: 700, mono: true });
      txt(svg, w - 2, y + 28, b.inKev.toLocaleString('en-US') + ' of ' + b.population.toLocaleString('en-US'),
        { a: 'end', c: pal.dim, fs: 10, mono: true });
    });

    /* SVG text does not wrap, so the closing sentence is broken by hand rather
     * than left to run off the right edge — which is what it did at every
     * column narrower than about 620px, including the paired-chart row. */
    var fy = T + bands.length * rh + 18;
    var a = 'Critical is only ' + cal.exploitation.criticalVsHigh + '× High, and ' +
      cal.exploitation.kevBelowCritical.toFixed(0) + '% of';
    var b2 = 'confirmed-exploited bugs are rated below Critical.';
    if (w < 620) {
      txt(svg, 0, fy, a, { c: pal.txt, fs: 11.5 });
      txt(svg, 0, fy + 16, b2, { c: pal.txt, fs: 11.5 });
    } else {
      txt(svg, 0, fy, a + ' ' + b2, { c: pal.txt, fs: 11.5 });
    }
    return svg;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * SEVERITY VOLUME — criticals published per year, the "is 2026 different"
   * question, answered from the snapshot.
   * ═══════════════════════════════════════════════════════════════════════ */
  function volume(svg, w, cal, pal) {
    var v = cal.volume;
    var rows = [
      { label: String(v.prevYear.year), pub: v.prevYear.published, crit: v.prevYear.critical, share: v.prevYear.criticalShare, partial: false },
      { label: v.curYearRunRate.year + ' run-rate', pub: v.curYearRunRate.published, crit: v.curYearRunRate.critical, share: v.curYearToDate.criticalShare, partial: true },
    ];
    var h = 190;
    frame(svg, w, h);
    var L = 4, R = w - 4, T = 26;
    var max = Math.max.apply(null, rows.map(function (r) { return r.pub; }));
    txt(svg, L, 12, w < 400 ? 'PUBLISHED CVES · CRITICAL SHARE'
      : 'PUBLISHED CVES AND THE CRITICAL-RATED SHARE',
      { c: pal.mut, fs: 10, ls: '.08em', mono: true });

    rows.forEach(function (r, i) {
      var y = T + i * 74;
      var bw = (R - L) * (r.pub / max);
      var cw = (R - L) * (r.crit / max);
      txt(svg, L, y + 11, r.label, { c: pal.txt, fs: 12.5, w: 600 });
      txt(svg, R, y + 11, r.pub.toLocaleString('en-US') + ' published', { a: 'end', c: pal.mut, fs: 11, mono: true });
      /* The published total is an outlined track rather than a solid fill, so
       * the critical figure printed over it reads against --sunk instead of
       * against a mid-tone bar. The run-rate row dashes its outline: it is an
       * extrapolation of a partial year, and should not look measured. */
      svg.appendChild(el('rect', {
        'class': 'ch-bar', style: '--i:' + (i * 2), x: L, y: y + 20, width: bw, height: 22, rx: 3,
        fill: pal.sunk, stroke: pal.rule2, 'stroke-dasharray': r.partial ? '4 3' : null,
      }));
      svg.appendChild(el('rect', { 'class': 'ch-bar', style: '--i:' + (i * 2 + 1), x: L, y: y + 20, width: Math.max(2, cw), height: 22, rx: 3, fill: pal.bad, 'fill-opacity': r.partial ? 0.75 : 1 }));
      txt(svg, L + Math.max(2, cw) + 8, y + 35,
        r.crit.toLocaleString('en-US') + ' critical · ' + r.share.toFixed(1) + '% of scored',
        { c: pal.bad, fs: 11.5, w: 600, mono: true });
      if (r.partial) txt(svg, L, y + 56, 'linear run-rate of a partial year, not a forecast', { c: pal.dim, fs: 10 });
    });
    txt(svg, L, h - 6, 'Criticals grew ' + cal.volume.growth.critical + '× against ' + cal.volume.growth.published + '× total volume.',
      { c: pal.txt, fs: 11.5 });
    return svg;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * EXPORT — serialise an SVG into a shareable PNG with a title and source
   * baked in, so the image stands alone when pasted somewhere else.
   * ═══════════════════════════════════════════════════════════════════════ */
  function toPNG(svg, opts) {
    opts = opts || {};
    var scale = opts.scale || 2;
    var pad = 22, headH = opts.title ? (opts.subtitle ? 62 : 42) : 0, footH = 30;
    var vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    var w = vb[2], h = vb[3];
    var W = w + pad * 2, Hh = h + headH + footH + pad * 2;
    /* The header and footer are laid out in the same box as the chart, so a
     * title longer than a narrow chart ran off the image. Estimated from the
     * glyph widths of the two stacks rather than measured, because measuring
     * needs a layout pass the export path does not have. */
    var fit = function (str, size, factor) {
      var want = String(str).length * size * factor;
      return want > W - pad * 2 ? Math.max(9, size * (W - pad * 2) / want) : size;
    };
    var titleSize = opts.title ? fit(opts.title, 19, 0.55) : 19;
    var subSize = opts.subtitle ? fit(opts.subtitle, 12.5, 0.52) : 12.5;
    var srcSize = opts.source ? fit(opts.source, 11, 0.60) : 11;

    var clone = svg.cloneNode(true);
    clone.setAttribute('x', pad);
    clone.setAttribute('y', pad + headH);

    var outer = document.createElementNS(NS, 'svg');
    outer.setAttribute('xmlns', NS);
    outer.setAttribute('width', W);
    outer.setAttribute('height', Hh);
    outer.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);

    outer.appendChild(el('rect', { x: 0, y: 0, width: W, height: Hh, fill: opts.bg || '#ffffff' }));
    if (opts.title) {
      var t1 = el('text', {
        x: pad, y: pad + 20, 'font-size': titleSize, 'font-weight': 700, fill: opts.fg || '#111',
        'font-family': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      });
      t1.textContent = opts.title;
      outer.appendChild(t1);
      if (opts.subtitle) {
        var t2 = el('text', {
          x: pad, y: pad + 42, 'font-size': subSize, fill: opts.mut || '#667',
          'font-family': 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        });
        t2.textContent = opts.subtitle;
        outer.appendChild(t2);
      }
    }
    outer.appendChild(clone);
    if (opts.source) {
      var t3 = el('text', {
        x: pad, y: Hh - pad + 4, 'font-size': srcSize, fill: opts.mut || '#667',
        'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
      });
      t3.textContent = opts.source;
      outer.appendChild(t3);
    }

    var svgStr = new XMLSerializer().serializeToString(outer);
    var blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = Math.round(W * scale);
        cv.height = Math.round(Hh * scale);
        var ctx = cv.getContext('2d');
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('canvas encode failed')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('svg decode failed')); };
      img.src = url;
    });
  }

  return {
    race: race, funnel: funnel, routes: routes, survival: survival,
    tornado: tornado, sweep: sweep, severity: severity, volume: volume,
    toPNG: toPNG, el: el, clear: clear, fmtDays: fmtDays,
  };
});
