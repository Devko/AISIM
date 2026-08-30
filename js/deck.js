/* Exposure Race — deck export.
 *
 * Produces two PDFs from the live page: a LinkedIn carousel (portrait, public
 * register) and an internal deck (16:9, full method apparatus). Both are PDFs
 * because that is what LinkedIn actually accepts — a carousel is a PDF document
 * post, one page per slide — so this is one engine with two geometries and two
 * copy budgets, rather than two exporters.
 *
 * Why a hand-rolled PDF writer: PRODUCT.md commits to no runtime dependency,
 * and the page's authority rests on being reproducible offline. Pulling jsPDF
 * or pptxgenjs off a CDN to ship a slide deck would trade that commitment for
 * convenience on a secondary surface. The subset needed here — pages carrying
 * one JPEG each, plus an invisible Helvetica text layer — is small enough to
 * own outright.
 *
 * Why each slide is rasterised rather than drawn as PDF vector content: the
 * slide IS an SVG, so layout is computed once and the deck cannot drift from
 * the design system the way a second, PDF-native layout pass would. The cost
 * is selectable text, which is bought back with the invisible text layer — the
 * same trick a scanned-PDF OCR layer uses. That matters more here than it
 * looks: this page exists to stop numbers being misquoted, and a figure you
 * can copy is a figure nobody retypes.
 *
 * Nothing in this file states a number of its own. Every figure is read from
 * the calibration module or from a run the page has already published, for the
 * same reason index.html does not hardcode them: a slide that quotes a stale
 * corpus is worse than one that quotes none, because it travels without the
 * page that would have corrected it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DECK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

  /* ═══════════════════════════════════════════════════════════════════════
   * PDF — pages of JPEG XObjects with an invisible text layer over each.
   * ═══════════════════════════════════════════════════════════════════════ */

  /* PDF strings are bytes, not UTF-16. Every chunk goes through here so the
   * xref offsets below are counted in the units the file is written in — an
   * offset computed from String.length would be wrong the moment a byte lands
   * above 0x7F, which for a JPEG is immediately. */
  function bytes(str) {
    var a = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) a[i] = str.charCodeAt(i) & 0xFF;
    return a;
  }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }

  /* The visible glyph is in the raster; this layer only has to be findable and
   * pasteable. Characters outside WinAnsi are therefore transliterated rather
   * than dropped — someone searching the deck for "<= 1 day" or pasting "2.4x"
   * gets something usable, which a literal U+2264 in a Helvetica text layer
   * would not have given them. */
  var XLIT = {
    '≤': '<=', '≥': '>=', '−': '-', '≈': '~',
    '×': 'x', '→': '->', '─': '-', '▶': '>',
    '—': '-', '–': '-', '·': '-', '’': "'",
    '“': '"', '”': '"',
  };
  function latin1(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (XLIT[ch]) { out += XLIT[ch]; continue; }
      out += ch.charCodeAt(0) <= 0xFF ? ch : '?';
    }
    return out;
  }
  var ESCAPE = /[\\()]/g;
  function pdfStr(s) {
    return latin1(s).replace(ESCAPE, function (m) { return '\\' + m; });
  }

  /* Pages are fixed-size and each carries exactly one full-bleed image, so the
   * content stream is the same shape every time and object numbers are
   * arithmetic rather than bookkept. */
  function PDF(W, H, meta) {
    var pages = [];
    return {
      addPage: function (jpeg, runs) { pages.push({ jpeg: jpeg, runs: runs || [] }); },
      count: function () { return pages.length; },
      blob: function () {
        var chunks = [], len = 0;
        function put(x) {
          var b = typeof x === 'string' ? bytes(x) : x;
          chunks.push(b);
          len += b.length;
        }
        var offsets = [0];
        function obj(n, body, stream) {
          offsets[n] = len;
          put(n + ' 0 obj\n' + body + '\n');
          if (stream) { put('stream\n'); put(stream); put('\nendstream\n'); }
          put('endobj\n');
        }

        put('%PDF-1.4\n');
        /* The binary comment is what tells transfer agents to treat this as
         * binary. Without it a well-meaning mail gateway can newline-translate
         * the JPEG payloads and hand over a file that opens to blank pages. */
        put('%âãÏÓ\n');

        var kids = pages.map(function (_, i) { return (4 + i * 3) + ' 0 R'; }).join(' ');
        obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
        obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>');
        obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

        pages.forEach(function (p, i) {
          var pn = 4 + i * 3, cn = pn + 1, imn = pn + 2;
          obj(pn, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + ']' +
            ' /Resources << /XObject << /Im0 ' + imn + ' 0 R >> /Font << /F1 3 0 R >> >>' +
            ' /Contents ' + cn + ' 0 R >>');

          /* Image first, then the text layer over it. `3 Tr` is render mode
           * "neither fill nor stroke": the run is laid out, selectable and
           * searchable, and paints nothing. PDF's origin is bottom-left and
           * the compositor works top-left, hence H - y. */
          var cs = 'q ' + W + ' 0 0 ' + H + ' 0 0 cm /Im0 Do Q\n';
          p.runs.forEach(function (r) {
            cs += 'BT /F1 ' + r.size.toFixed(2) + ' Tf 3 Tr 1 0 0 1 ' +
              r.x.toFixed(2) + ' ' + (H - r.y).toFixed(2) + ' Tm (' +
              pdfStr(r.text) + ') Tj ET\n';
          });
          obj(cn, '<< /Length ' + bytes(cs).length + ' >>', cs);

          obj(imn, '<< /Type /XObject /Subtype /Image /Width ' + p.jpeg.w +
            ' /Height ' + p.jpeg.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8' +
            ' /Filter /DCTDecode /Length ' + p.jpeg.data.length + ' >>', p.jpeg.data);
        });

        var infoN = 4 + pages.length * 3;
        obj(infoN, '<< /Title (' + pdfStr(meta.title) + ') /Author (' + pdfStr(meta.author) +
          ') /Subject (' + pdfStr(meta.subject) + ') /Creator (Exposure Race)' +
          ' /Producer (Exposure Race deck export) /CreationDate (' + meta.date + ') >>');

        var total = infoN + 1;
        var xref = len;
        var x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
        for (var n = 1; n < total; n++) {
          x += ('0000000000' + offsets[n]).slice(-10) + ' 00000 n \n';
        }
        put(x);
        put('trailer\n<< /Size ' + total + ' /Root 1 0 R /Info ' + infoN + ' 0 R >>\n' +
          'startxref\n' + xref + '\n%%EOF\n');

        return new Blob(chunks, { type: 'application/pdf' });
      },
    };
  }

  function pdfDate(d) {
    var p = function (n) { return ('0' + n).slice(-2); };
    return 'D:' + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) +
      p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + 'Z';
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * FORMATS — the two geometries, and the type scale each one can carry.
   *
   * These are not one scale multiplied by two numbers. A carousel slide is
   * read at thumb distance on a phone with no presenter, so it gets fewer
   * words at much larger sizes; a projected 16:9 slide has someone in the room
   * talking over it and can carry a denser argument. `words` is the budget the
   * copy is written against, not a limit enforced at runtime.
   * ═══════════════════════════════════════════════════════════════════════ */
  var FORMATS = {
    carousel: {
      w: 1080, h: 1350, pad: 84, scale: 1.6, words: 28,
      eyebrow: 23, eyebrowGap: 40,
      title: 60, titleLh: 70, titleGap: 30,
      body: 29, bodyLh: 42, bodyGap: 26,
      stat: 168, statLh: 168, statLab: 27,
      row: 27, rowLh: 46, tag: 17, note: 22, noteLh: 32, foot: 20,
    },
    /* 1280x720 rather than PowerPoint's 960x540 points. Same 16:9 ratio and
     * the same physical size once a viewer scales it to the page, but the
     * charts are cloned at a fixed 840-unit viewBox, so the slide's coordinate
     * space decides what fraction of natural size they land at. At 960 wide a
     * chart came out around a third of natural and took its 11px labels down
     * with it — an illustration of a chart rather than one you can read. */
    internal: {
      w: 1280, h: 720, pad: 66, scale: 1.5, words: 65,
      eyebrow: 17, eyebrowGap: 32,
      title: 44, titleLh: 53, titleGap: 21,
      body: 22, bodyLh: 33, bodyGap: 20,
      stat: 118, statLh: 120, statLab: 20,
      row: 21, rowLh: 36, tag: 13, note: 17, noteLh: 25, foot: 14,
    },
  };

  /* A cloned chart is only worth a slide if it lands near natural size. These
   * are drawn for an 840-unit box at roughly 11px type, so one squeezed to
   * half width takes every label with it. Below this the slide keeps its
   * argument and drops the illustration. */
  var CHART_MIN_SCALE = 0.6;

  /* ═══════════════════════════════════════════════════════════════════════
   * COMPOSITOR — one slide, built as an SVG, recording its text runs as it
   * goes so the PDF layer is a by-product of layout rather than a second pass
   * that can disagree with it.
   * ═══════════════════════════════════════════════════════════════════════ */

  var measureCtx = null;
  function measure(text, size, weight, mono) {
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = (weight || 400) + ' ' + size + 'px ' + (mono ? MONO : SANS);
    return measureCtx.measureText(text).width;
  }

  /* Greedy wrap. Long single tokens are left to overflow rather than broken:
   * every one of them here is a figure or a product name, and a hyphenated
   * "2.8p-t" is a worse slide than a slightly wide line. */
  function wrap(text, width, size, weight) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var next = cur ? cur + ' ' + w : w;
      if (cur && measure(next, size, weight) > width) { lines.push(cur); cur = w; }
      else cur = next;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  /* How tall a note will be, needed before it is drawn: the chart above it has
   * to be given its room first, and a chart sized without allowing for the
   * note underneath it printed the note over the footer rule. */
  function wrapCount(text, fmt) {
    return wrap(text, fmt.w - fmt.pad * 2, fmt.note, 400).length;
  }

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    return e;
  }

  function Slide(fmt, pal) {
    var svg = el('svg', {
      xmlns: NS, width: fmt.w, height: fmt.h, viewBox: '0 0 ' + fmt.w + ' ' + fmt.h,
    });
    svg.appendChild(el('rect', { x: 0, y: 0, width: fmt.w, height: fmt.h, fill: pal.ink }));

    var runs = [];
    var inner = fmt.w - fmt.pad * 2;
    var y = fmt.pad;

    /* Flowed content is appended to `host`; anything pinned to the page edge —
     * the fence band, the footer — is appended to `svg` directly, so moving
     * the block cannot move them with it. */
    var host = svg, block = null, blockRun0 = 0;

    /* Every text node goes through here, so nothing can reach the raster
     * without also reaching the searchable layer. */
    function text(s, o) {
      o = o || {};
      var size = o.size || fmt.body;
      var x = o.x === undefined ? fmt.pad : o.x;
      var base = o.baseline === undefined ? y + size * 0.8 : o.baseline;
      var node = el('text', {
        x: x, y: base, 'font-size': size, 'font-weight': o.weight || 400,
        'font-family': o.mono ? MONO : SANS, fill: o.fill || pal.txt,
        'text-anchor': o.anchor, 'letter-spacing': o.ls,
      });
      node.textContent = s;
      (o.pin ? svg : host).appendChild(node);
      /* An anchored run's x is its anchor point, not its left edge; the text
       * layer needs the left edge or a selection lands off the glyphs. */
      var w = o.anchor ? measure(s, size, o.weight, o.mono) : 0;
      runs.push({
        text: s, size: size, y: base,
        x: o.anchor === 'end' ? x - w : o.anchor === 'middle' ? x - w / 2 : x,
      });
      return node;
    }

    var api = {
      svg: svg,
      runs: runs,
      inner: inner,
      get y() { return y; },
      set y(v) { y = v; },

      space: function (n) { y += n; return api; },

      rule: function (colour) {
        host.appendChild(el('rect', {
          x: fmt.pad, y: y, width: inner, height: 1, fill: colour || pal.rule,
        }));
        y += 1;
        return api;
      },

      eyebrow: function (s) {
        text(String(s).toUpperCase(), {
          size: fmt.eyebrow, fill: pal.mut, mono: true, ls: fmt.eyebrow * 0.12,
        });
        y += fmt.eyebrowGap;
        return api;
      },

      title: function (s) {
        wrap(s, inner, fmt.title, 700).forEach(function (line) {
          text(line, { size: fmt.title, weight: 700 });
          y += fmt.titleLh;
        });
        y += fmt.titleGap;
        return api;
      },

      body: function (s, colour) {
        if (!s) return api;
        wrap(s, inner, fmt.body, 400).forEach(function (line) {
          text(line, { size: fmt.body, fill: colour || pal.mut });
          y += fmt.bodyLh;
        });
        y += fmt.bodyGap;
        return api;
      },

      /* The figure and its epistemic tag are one unit and are drawn as one, so
       * there is no layout in which the number survives to a screenshot and
       * the tag does not. That is the whole reason the tag exists. */
      stat: function (value, label, tag) {
        text(value, { size: fmt.stat, weight: 700, fill: pal.txt, baseline: y + fmt.stat * 0.76 });
        y += fmt.statLh;
        var lw = 0;
        if (label) {
          text(label, { size: fmt.statLab, fill: pal.mut });
          lw = measure(label, fmt.statLab, 400);
        }
        if (tag) api.tag(tag, fmt.pad + lw + fmt.statLab * 0.7, y + fmt.statLab * 0.1);
        y += fmt.statLab * 1.9;
        return api;
      },

      tag: function (kind, x, ty) {
        var colour = kind === 'measured' ? pal.def : kind === 'reported' ? pal.zero : pal.warn;
        var size = fmt.tag;
        var label = kind.toUpperCase();
        var w = measure(label, size, 400, true) + size * 1.4;
        var h = size * 1.9;
        host.appendChild(el('rect', {
          x: x, y: ty, width: w, height: h, rx: size * 0.4,
          fill: 'none', stroke: colour, 'stroke-width': 1,
        }));
        text(label, {
          x: x + size * 0.7, size: size, fill: colour, mono: true,
          ls: size * 0.1, baseline: ty + h * 0.7,
        });
        return api;
      },

      /* The headline readout, as the page draws it: four figures side by side,
       * each with its label above and its interval below. Rows would have
       * worked and would have been wrong — this is the bank a reader
       * screenshots off the page, and it reads as a bank because the four
       * figures are meant to be compared at a glance rather than looked up one
       * at a time. Two columns on the carousel, four across on landscape. */
      tiles: function (list) {
        var perRow = fmt.w > fmt.h ? 4 : 2;
        var gap = fmt.bodyGap;
        var cw = (inner - gap * (perRow - 1)) / perRow;
        var vSize = Math.min(fmt.stat * 0.52, cw * 0.34);
        var labSize = fmt.statLab * 0.82, subSize = fmt.statLab * 0.76;
        var labLh = labSize * 1.28, subLh = subSize * 1.28;

        /* Labels and sub-lines are wrapped to the COLUMN, not to the slide.
         * Drawn as single lines they simply ran past their column and into
         * the next tile's label — four captions overprinting each other in
         * one grey stripe, on the one slide whose whole job is four figures
         * a reader can tell apart. The tallest label decides where every
         * value sits, so the four numbers stay on one baseline. */
        var labs = list.map(function (t) { return wrap(t.l, cw, labSize, 400); });
        var subs = list.map(function (t) { return t.sub ? wrap(t.sub, cw, subSize, 400) : []; });
        var labMax = labs.reduce(function (a, l) { return Math.max(a, l.length); }, 1);
        var subMax = subs.reduce(function (a, l) { return Math.max(a, l.length); }, 0);
        var rowH = labMax * labLh + vSize * 1.16 + subMax * subLh + fmt.bodyGap;

        list.forEach(function (t, i) {
          var col = i % perRow, row = Math.floor(i / perRow);
          var x = fmt.pad + col * (cw + gap);
          var y0 = y + row * rowH;
          labs[i].forEach(function (line, n) {
            text(line, { x: x, size: labSize, fill: pal.mut, baseline: y0 + labSize + n * labLh });
          });
          var vy = y0 + labMax * labLh + vSize;
          text(t.v, {
            x: x, size: vSize, weight: 700, fill: t.lead ? pal.att : pal.txt, baseline: vy,
          });
          subs[i].forEach(function (line, n) {
            text(line, {
              x: x, size: subSize, fill: pal.dim,
              baseline: vy + subSize * 1.5 + n * subLh,
            });
          });
        });
        y += Math.ceil(list.length / perRow) * rowH;
        return api;
      },

      /* Label-left, value-right rows. Used for the band table and the estate
       * summary, where the comparison is between the values and a paragraph
       * would bury it. */
      rows: function (list) {
        list.forEach(function (r) {
          text(r.l, { size: fmt.row, fill: r.strong ? pal.txt : pal.mut, weight: r.strong ? 700 : 400 });
          text(r.v, {
            x: fmt.w - fmt.pad, size: fmt.row, anchor: 'end', mono: true,
            weight: r.strong ? 700 : 400, fill: r.strong ? pal.txt : pal.mut,
          });
          y += fmt.rowLh;
        });
        y += fmt.bodyGap;
        return api;
      },

      /* A clone of a chart the page has already drawn. It arrives as an inner
       * <svg> with its own viewBox, so width/height/x/y scale it — the same
       * mechanism CHARTS.toPNG relies on. A chart never drawn carries no
       * viewBox; that is not an error here, it is a slide that omits it. */
      /* The recommendations, each as a headline, the figure it buys, and the
       * reason. Rows would have dropped the reason, which is the half that
       * stops "reduce exposed footprint" reading as a platitude — and on the
       * carousel there is no presenter to supply it. The reason is dropped
       * only when the slide genuinely cannot fit it. */
      actions: function (list, withDetail, room) {
        /* Measured before anything is drawn, and the reasons are dropped
         * wholesale if they will not fit. They ran past the footer rule and
         * printed the last recommendation over the source line — five items
         * with two lines of reasoning each is more than a landscape slide
         * holds once a title and a paragraph are above them. Better to lose
         * every reason than to lose the fifth recommendation, so this is
         * all-or-nothing rather than a truncation partway down the list. */
        var titleH = fmt.rowLh, gapY = fmt.bodyGap * 0.7;
        var details = list.map(function (a) {
          if (!a.detail) return [];
          var vw = measure(a.value, fmt.row, 700, true) + fmt.row;
          return wrap(a.detail, inner - vw, fmt.note, 400);
        });
        var need = function (withD) {
          return list.reduce(function (a, _, i) {
            return a + titleH + (i ? gapY : 0) + (withD ? details[i].length * fmt.noteLh : 0);
          }, 0);
        };
        var showDetail = withDetail && (!room || need(true) <= room);

        list.forEach(function (a, i) {
          if (i) y += gapY;
          text(a.title, { size: fmt.row * 1.12, weight: 700, fill: pal.txt });
          text(a.value, {
            x: fmt.w - fmt.pad, size: fmt.row * 1.12, anchor: 'end', mono: true,
            weight: 700, fill: pal.def,
          });
          y += titleH;
          if (showDetail) {
            details[i].forEach(function (line) {
              text(line, { size: fmt.note, fill: pal.mut });
              y += fmt.noteLh;
            });
          }
        });
        y += fmt.bodyGap;
        return api;
      },

      /* The configured link. Mono, on its own rule, because it is the one
       * thing on the slide a reader is meant to type or click rather than
       * read — and a URL set in the body face inside a paragraph is a URL
       * nobody notices is a URL. */
      link: function (url) {
        api.rule(pal.rule2);
        y += fmt.bodyGap * 0.6;
        var size = fmt.note;
        /* Long enough to need breaking: a configured link carries the whole
         * estate in its query string. Broken on width rather than truncated,
         * because a link with an ellipsis in it is not a link. */
        var chunks = [];
        var s = String(url);
        while (s.length) {
          var take = s.length;
          while (take > 1 && measure(s.slice(0, take), size, 400, true) > inner) take--;
          chunks.push(s.slice(0, take));
          s = s.slice(take);
        }
        chunks.forEach(function (line) {
          text(line, { size: size, fill: pal.def, mono: true });
          y += size * 1.5;
        });
        y += fmt.bodyGap;
        return api;
      },

      /* What fraction of its natural size the chart would be drawn at in the
       * room available. Read before drawing, so a slide can decide whether the
       * chart is worth its place at that size. Zero for a chart never drawn:
       * it carries no viewBox and there is nothing to place. */
      chartScale: function (node, room) {
        if (!node) return 0;
        var vbAttr = node.getAttribute('viewBox');
        var vb = vbAttr ? vbAttr.trim().split(/[\s,]+/).map(Number) : [];
        if (!isFinite(vb[2]) || !isFinite(vb[3]) || vb[2] <= 0 || vb[3] <= 0) return 0;
        var h = Math.min(room, inner * vb[3] / vb[2]);
        return (h * vb[2] / vb[3]) / vb[2];
      },

      /* Consumes the whole room it is given and sits centred inside it. A
       * chart is wider than it is tall, so at full width it rarely reaches the
       * bottom of the space left for it; letting it top-align there left a
       * band of empty page above the footer that read as a slide that had
       * failed to finish rather than one that was composed. */
      chart: function (node, room) {
        if (!node) return api;
        var vbAttr = node.getAttribute('viewBox');
        var vb = vbAttr ? vbAttr.trim().split(/[\s,]+/).map(Number) : [];
        if (!isFinite(vb[2]) || !isFinite(vb[3]) || vb[2] <= 0 || vb[3] <= 0) return api;
        var h = Math.min(room, inner * vb[3] / vb[2]);
        var w = h * vb[2] / vb[3];
        var clone = node.cloneNode(true);
        clone.setAttribute('x', fmt.pad + (inner - w) / 2);
        clone.setAttribute('y', y + (room - h) / 2);
        clone.setAttribute('width', w);
        clone.setAttribute('height', h);
        clone.removeAttribute('class');
        clone.removeAttribute('style');
        host.appendChild(clone);
        y += room;
        return api;
      },

      note: function (s, colour) {
        if (!s) return api;
        wrap(s, inner, fmt.note, 400).forEach(function (line) {
          text(line, { size: fmt.note, fill: colour || pal.dim });
          y += fmt.noteLh;
        });
        return api;
      },

      /* Where the flowed block starts. Everything after this can be moved as
       * one unit once its final height is known, which is the only way to
       * compose vertically in SVG: there is no layout pass to ask, so the
       * block is laid out from the top and then translated into place. */
      begin: function () {
        block = el('g');
        svg.appendChild(block);
        host = block;
        blockRun0 = runs.length;
        return api;
      },

      /* Drops the block so it ends at `bottom`. Used on slides that carry no
       * chart to absorb the slack: an eyebrow at the top and the argument
       * sitting on the footer rule reads as composition, where the same words
       * top-aligned read as a slide two thirds of the way through loading. */
      anchorBottom: function (bottom) {
        if (!block) return api;
        var dy = bottom - y;
        if (dy <= 1) return api;
        block.setAttribute('transform', 'translate(0 ' + dy.toFixed(2) + ')');
        /* The text layer carries absolute coordinates and does not inherit the
         * transform, so it is moved by the same amount or every selection on
         * the slide lands where the text used to be. */
        for (var i = blockRun0; i < runs.length; i++) runs[i].y += dy;
        y += dy;
        return api;
      },

      /* Pinned to the page rather than to the flow, so a slide that ran long
       * does not push its provenance off the bottom edge. */
      foot: function (left, right) {
        host = svg;
        var fy = fmt.h - fmt.pad;
        svg.appendChild(el('rect', {
          x: fmt.pad, y: fy - fmt.foot * 2.4, width: inner, height: 1, fill: pal.rule,
        }));
        if (left) text(left, { size: fmt.foot, fill: pal.dim, mono: true, baseline: fy, pin: true });
        if (right) {
          text(right, {
            x: fmt.w - fmt.pad, size: fmt.foot, fill: pal.dim, mono: true,
            anchor: 'end', baseline: fy, pin: true,
          });
        }
        return api;
      },

      footTop: function () { return fmt.h - fmt.pad - fmt.foot * 3.4; },

      /* The fence. A configured figure that reaches a board pack without this
       * band around it is exactly the failure PRODUCT.md forbids, so it is a
       * full-bleed change of ground rather than a caption: the slide stops
       * looking like the argument slides before it is read. */
      fenceTop: function (label, colour) {
        var band = fmt.pad * 0.62;
        svg.appendChild(el('rect', { x: 0, y: 0, width: fmt.w, height: band, fill: colour }));
        text(label.toUpperCase(), {
          x: fmt.pad, size: fmt.eyebrow, mono: true, weight: 700,
          fill: pal.ink, ls: fmt.eyebrow * 0.14, baseline: band * 0.68,
        });
        svg.appendChild(el('rect', { x: 0, y: fmt.h - 6, width: fmt.w, height: 6, fill: colour }));
        y = band + fmt.pad * 0.8;
        return api;
      },
    };
    return api;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * RASTERISE — SVG to JPEG bytes, via the same serialise-decode-canvas route
   * CHARTS.toPNG uses. JPEG rather than PNG because PDF embeds DCTDecode data
   * verbatim, where a PNG would have to be re-deflated with a predictor — a
   * compressor this file would then have to carry for no visible gain.
   * ═══════════════════════════════════════════════════════════════════════ */
  function rasterise(svg, fmt) {
    var str = new XMLSerializer().serializeToString(svg);
    var url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var cv = document.createElement('canvas');
        cv.width = Math.round(fmt.w * fmt.scale);
        cv.height = Math.round(fmt.h * fmt.scale);
        var ctx = cv.getContext('2d');
        ctx.setTransform(fmt.scale, 0, 0, fmt.scale, 0, 0);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        var data = cv.toDataURL('image/jpeg', 0.92);
        var comma = data.indexOf(',');
        if (comma < 0 || data.slice(0, 11) !== 'data:image/') {
          reject(new Error('canvas encode failed'));
          return;
        }
        resolve({ data: b64ToBytes(data.slice(comma + 1)), w: cv.width, h: cv.height });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('svg decode failed')); };
      img.src = url;
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * CONTENT — the argument, as slides.
   *
   * The spine is fixed and identical between the two builds: the same claims
   * in the same order, because the deck is the page's argument travelling
   * without the page, and a carousel that argued something else would be a
   * second position to keep in step with the first. What differs is register —
   * `short` for the carousel's copy budget, `long` where a presenter is in the
   * room — and which slides are included at all.
   * ═══════════════════════════════════════════════════════════════════════ */

  function pct(n, dp) { return n.toFixed(dp === undefined ? 1 : dp) + '%'; }
  function num(n, dp) { return Number(n).toFixed(dp === undefined ? 1 : dp); }
  function thou(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  /* " pts", with the space, because that is how the page prints the same
   * quantity — a deck that abbreviates differently reads as a second source. */
  function pts(n) { return (n >= 0 ? '+' : '−') + Math.abs(n * 100).toFixed(1) + ' pts'; }
  /* A margin a control BUYS, stated as the reduction it is. Signed pts() reads
   * backwards here: "−9.3 pts of incidents" is a gain, and a slide that has to
   * be reasoned about before it can be read is a slide that gets misquoted. */
  function gain(n) { return (n * 100).toFixed(1) + ' pts'; }
  /* Counts read from the model land in running prose, and the page's style
   * writes small counts as words. */
  var NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six',
    'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function countWord(n, capital) {
    var s = NUM_WORDS[n] || String(n);
    return capital ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function band(cal, name) {
    var found = cal.exploitation.bands.filter(function (b) { return b.band === name; })[0];
    return found || { pExploited: 0, population: 0, inKev: 0 };
  }


  function slides(ctx) {
    var cal = ctx.cal, run = ctx.run, sens = ctx.sens, scope = ctx.scope || {};
    var isP = ctx.metric === 'p';
    var list = [];
    if (!run) return list;

    var headline = isP ? run.p : run.incident;
    var lo = isP ? run.pLo : run.incLo;
    var hi = isP ? run.pHi : run.incHi;
    var bandLine = run.bandReliable
      ? '90% band ' + pct(100 * lo) + ' to ' + pct(100 * hi)
      : 'headline figure; the uncertainty band has not settled';
    var excluded = scope.excludedShort || 'Denial of service, fraud without intrusion, and physical premises access';
    var trialsN = (ctx.trials || 0).toLocaleString('en-GB');
    var blocksN = String(ctx.blocks || 0);
    /* Read from the model, never restated. The deck named three routes in four
     * places; every one of them was wrong the moment a fourth was added, and
     * the deck is the surface where a stale claim travels furthest. */
    var modelled = scope.modelled || [];
    var classList = modelled.map(function (l) { return l.toLowerCase(); }).join('; ');

    /* ── 00 · what was simulated ───────────────────────────────────────── */
    list.push({
      id: 'cover',
      eyebrow: 'exposure race · simulated ' + (ctx.dateLabel || ''),
      title: isP
        ? 'How likely is this estate to be compromised in the next 12 months?'
        : 'How likely is this estate to suffer an incident in the next 12 months?',
      short: ctx.estate,
      long: 'A Monte Carlo simulation of exploit availability against this estate\'s remediation, run over ' +
        trialsN + ' simulated years and calibrated to a dated public dataset. What follows is the configuration, the result, and what moves it most.',
      estate: ctx.estate,
      note: 'Calibrated to CyberMon ' + cal.snapshot.cvelist + '. Reproducible offline.',
    });

    /* ── 01 · the estate as configured ─────────────────────────────────── */
    list.push({
      id: 'estate',
      eyebrow: 'what was configured',
      title: 'The estate this reports on',
      short: 'The estate as configured on the page. Everything that follows is derived from these answers.',
      long: 'The shape controls, as they were set. These describe your estate rather than measure it, which is why every figure downstream is tagged assumed.',
      rows: ctx.config || [],
      tag: 'assumed',
    });

    /* ── 02 · the numbers behind them ──────────────────────────────────── */
    list.push({
      id: 'inputs',
      only: 'internal',
      eyebrow: 'the resulting parameters',
      title: 'What those answers produce',
      long: 'The controls above stack with diminishing returns, and the order they are set in makes no difference. These are the values the simulation actually ran on, and every one of them stays editable on the page. The identity controls gate the five access classes where no vulnerability is involved.',
      rows: ctx.params || [],
      tag: 'assumed',
    });

    /* ── 03 · the answer ───────────────────────────────────────────────── */
    list.push({
      id: 'headline',
      eyebrow: 'the result',
      title: isP ? 'Chance of compromise in 12 months' : 'Chance of an incident in 12 months',
      stat: { v: pct(100 * headline), l: bandLine, tag: 'assumed' },
      keepStat: true,
      /* The simulated classes are NAMED, never counted, and the list is read
       * from the model. This slide once read "Three access routes only —
       * phishing, credential abuse and insider action are not counted": two
       * lists of three either side of a dash, which parses as those three
       * BEING the routes and states the reverse of what the model does. It
       * then went stale a second time when three classes became eight. Naming
       * them from SCOPE fixes both failure modes at once. */
      short: countWord(modelled.length, true) + ' access classes, simulated for this estate. ' +
        excluded + ' are not counted, so real risk is higher than this.',
      long: 'Across ' + trialsN + ' simulated years for this estate, with the uncertain inputs redrawn ' +
        blocksN + ' times. The headline figure settles long before that; the uncertainty band does not. ' +
        countWord(modelled.length, true) + ' access classes are simulated: ' + classList + '. ' +
        excluded + ' are not counted, so this remains a lower bound rather than a complete picture.',
      note: 'Not a risk assessment for a named organisation. The inputs are judgement, not measurement.',
      chart: 'surv',
    });

    /* ── 04 · the rest of the readout ──────────────────────────────────── */
    list.push({
      id: 'readout',
      eyebrow: 'the readout',
      title: 'The four figures, together',
      /* In both decks now. This was internal-only, on the reasoning that a
       * carousel wants one number per slide — but this bank IS one thing: the
       * four figures are read against each other, and the gap between
       * compromise and incident is the argument detection rests on. Splitting
       * them across slides loses exactly the comparison they exist to make. */
      tiles: [
        { l: 'Probability of compromise, 12-month window', v: pct(100 * run.p),
          sub: run.bandReliable ? pct(100 * run.pLo) + ' to ' + pct(100 * run.pHi) : 'point estimate',
          lead: isP },
        { l: 'Probability of an incident, 12-month window', v: pct(100 * run.incident),
          sub: run.bandReliable ? pct(100 * run.incLo) + ' to ' + pct(100 * run.incHi) : 'point estimate',
          lead: !isP },
        { l: 'Expected intrusions per year', v: num(run.events, 2),
          sub: 'one per campaign, however many systems it reaches' },
        { l: 'Median time to first compromise',
          v: run.med == null ? '>12' : String(Math.round(run.med)),
          sub: run.med == null ? 'months, no compromise in most years' : 'days, across simulated years' },
      ],
      short: 'Compromise and incident are different questions. Detection moves the second and cannot move the first.',
      long: 'Compromise and incident are different questions: detection cannot change whether you were compromised, only whether anyone reached it in time. That is why both are reported, and why the gap between them is where the detection argument later in this deck lives.',
      tag: 'assumed',
    });

    /* ── 05 · how it gets there ────────────────────────────────────────── */
    if (ctx.funnel && ctx.funnel.length) {
      list.push({
        id: 'funnel',
        eyebrow: 'how the number is arrived at',
        title: 'From published vulnerabilities to compromises',
        short: ctx.funnel[0].v + ' published vulnerabilities a year in this stack become ' +
          ctx.funnel[ctx.funnel.length - 1].v + ' compromises.',
        long: 'Each stage is a filter on the one above it. The stream is every severity band, scaled from the critical count set on the page. The middle stages are measured against the published record: how many ever get public exploit code, and how many are confirmed exploited. The outer stages are properties of this estate.',
        rows: ctx.funnel,
        chart: 'funnel',
      });
    }

    /* ── 06 · where it comes from ──────────────────────────────────────── */
    if (ctx.routeRows && ctx.routeRows.length) {
      list.push({
        id: 'routes',
        eyebrow: 'where the compromise comes from',
        title: 'First compromise of the year, by access class',
        short: 'One of these classes turns fully on patching faster. Seven do not.',
        long: 'Only opportunistic exploitation turns fully on your change window. A targeted campaign turns partly on it. A supplier, a phishing lure, a stolen credential, a misconfiguration, an insider and a lost laptop are indifferent to it. That is why the ranking of drivers in this deck is not simply "patch faster".',
        rows: ctx.routeRows,
        note: 'Not counted at all: ' + excluded.toLowerCase() +
          '. The ' + cal.currentYear + ' DBIR attributes ' + pct(100 * (scope.vulnShareOfBreaches || 0), 0) +
          ' of breaches to vulnerability exploitation: a minority of routes, and not the largest.',
        chart: 'routes',
      });
    }

    /* ── 07 · what moves it ────────────────────────────────────────────── */
    if (sens && sens.rows && sens.rows.length) {
      list.push({
        id: 'drivers',
        eyebrow: 'what moves this number',
        title: 'Ranked by effect on this estate',
        short: 'Each parameter swept across its full range, against this configuration.',
        long: 'Each parameter varied on its own across its full stated range, against this configuration, with everything else held fixed. The bar is the whole span. The recommended actions in this deck report only what is gained by moving each parameter in the direction that helps.',
        chart: 'torn',
        needs: 'torn',
        /* The fallback the two-pass compose reaches for when the chart cannot
         * be drawn legibly. The sensitivity chart grows a row per lever and is
         * now taller than it is wide, so on a landscape slide it lands around
         * half its natural size — small enough that its own labels stop being
         * readable, which is worse than not drawing it. The top rows carry the
         * same ranking in a form that does not care about the aspect. */
        rows: (sens.rows || []).slice()
          .sort(function (a, b) { return b.span - a.span; })
          .slice(0, 8)
          .map(function (r, i) {
            return { l: r.l, v: pts(r.hi - r.lo), strong: i < 3 };
          }),
        tag: 'assumed',
      });
    }

    /* ── 08 · what to do ───────────────────────────────────────────────── */
    var acts = ctx.actions || [];
    list.push({
      id: 'actions',
      eyebrow: 'what to do about it',
      title: acts.length ? 'Where the points are' : 'No defender parameter moves this materially',
      short: acts.length
        ? 'Ranked by the reduction each buys on this estate, not by general advice.'
        : 'At these settings the outcome is driven by routes remediation does not reach.',
      long: acts.length
        ? 'Ranked by the reduction each buys on this estate. Each figure is what is gained by moving that parameter in the direction that helps, holding everything else fixed, so it is what the change is worth here rather than in general.'
        : 'At these settings the outcome is driven by routes the remediation process does not reach. See the route split in this deck: the levers that remain are the ones that close routes needing no vulnerability at all.',
      acts: acts,
      note: acts.length ? 'Each figure is the reduction in the annual probability of ' +
        (isP ? 'compromise' : 'an incident') + ' for this estate, from moving that one parameter alone.' : null,
    });

    /* ── 09 · what detection is worth here ─────────────────────────────── */
    if (ctx.soc) {
      list.push({
        id: 'detection',
        eyebrow: 'what detection buys this estate',
        title: 'Detection cannot stop a compromise. It decides whether one matters.',
        stat: {
          v: gain(ctx.soc.reported),
          l: 'incident rate that 24/7 detection buys this estate, at reported tempo',
          tag: 'assumed',
        },
        short: 'Against an adversary at full post-exploitation tempo the same investment is worth ' +
          gain(ctx.soc.full) + '.',
        long: 'Moving this estate from no detection to a 24/7 SOC is worth ' + gain(ctx.soc.reported) +
          ' of incident rate against a reported-tempo adversary, and ' + gain(ctx.soc.full) +
          ' against one at full tempo. A faster adversary does not beat detection on any single intrusion. It devalues the investment. This is the figure most sensitive to an assumption, and the assumption is adversary speed.',
      });
    }

    /* ── 10 · what would change it ─────────────────────────────────────── */
    var dial = (sens && sens.sweep) ? sens.sweep.map(function (s) {
      var end = s.pts.length ? s.pts[s.pts.length - 1][1] : sens.base;
      return { k: s.k, l: s.l, worth: end - sens.base };
    }) : [];
    if (dial.length) {
      var worst = dial.reduce(function (a, b) { return b.worth > a.worth ? b : a; });
      list.push({
        id: 'scenario',
        eyebrow: 'what would change it',
        title: countWord(dial.length, true) + ' adversary scenarios, against this same estate',
        short: 'Worst case here is ' + worst.l.toLowerCase() + ', at ' + pts(worst.worth) + '.',
        long: 'Each dial moved on its own from the measured record to its full range, against this configuration. These are scenarios, not forecasts: the measured exploit clock has not accelerated, which is why compression sits behind a dial rather than in the baseline.',
        rows: dial.map(function (d) {
          return { l: d.l, v: pts(d.worth), strong: d.k === worst.k };
        }),
        chart: 'sweep',
        needs: 'sweep',
        tag: 'assumed',
      });
    }

    /* ── 11 · method ───────────────────────────────────────────────────── */
    list.push({
      id: 'method',
      only: 'internal',
      eyebrow: 'method and scope',
      title: 'What this is, and what it is not',
      long: 'Every figure in this deck is tagged by how well it is evidenced. The estate is judgement. The exploit and exploitation rates are measured against the vulnerability data shipped with the page. Adversary timings are reported by named third parties. The inputs behind the access classes that need no vulnerability are judgement throughout, because no public data answers them the way the CVE record answers the exploit clock.',
      rows: [
        { l: 'Simulated access classes', v: String(modelled.length), strong: true },
        { l: 'Not counted', v: excluded.toLowerCase(), strong: true },
        { l: 'Simulated years', v: trialsN + ' years, inputs redrawn ' + blocksN + ' times' },
        { l: 'Data snapshot', v: cal.snapshot.cvelist },
        { l: 'KEV catalogue', v: thou(cal.snapshot.kevCount) + ' · ' + cal.snapshot.kev },
        { l: 'Criticals confirmed exploited', v: pct(band(cal, '9.0-10.0').pExploited, 2) + ' (measured)' },
      ],
      note: 'Never present this output as a risk assessment for a named organisation.',
    });

    /* ── 12 · check it ─────────────────────────────────────────────────── */
    list.push({
      id: 'reproduce',
      eyebrow: 'check it yourself',
      title: 'This configuration is a link',
      short: 'Open it, change an assumption you disagree with, and watch the number move.',
      long: 'The link below carries the exact configuration this deck reports. Open it, change any assumption you disagree with, and the model reruns. The vulnerability data ships with the page and the calibration is generated from it, so every measured figure here can be reproduced offline.',
      link: ctx.url,
      rows: [
        { l: 'Data source', v: cal.source.replace(/^https?:\/\//, '') },
        { l: 'Snapshot', v: cal.snapshot.cvelist },
      ],
    });

    /* ── the reading order ───────────────────────────────────────────────
     *
     * Declared here rather than left to the order the pushes happen in, for
     * two reasons. It is the deck's argument and belongs somewhere a reader
     * of this file can see it in one glance; and the slides are built in the
     * order their DATA becomes convenient, which is not the order anybody
     * should read them in.
     *
     * The result leads. An earlier version opened with the configuration —
     * defensible, and wrong for what this is: somebody handed the PDF wants
     * the number and the recommendations, and will accept the estate summary
     * afterwards as the thing that qualifies them. The evidence that explains
     * the number follows it, then the configuration that produced it, then
     * method, then the link.
     *
     * A slide named here but never built is skipped silently; a slide built
     * but not named here would vanish, so the filter below keeps it and puts
     * it before the closing pair rather than dropping work on the floor. */
    var ORDER = [
      'cover',                                    /* what this is */
      'headline', 'readout', 'actions',           /* the results */
      'drivers', 'routes', 'funnel',              /* why those results */
      'detection', 'scenario',                    /* what changes them */
      'estate', 'inputs', 'method',               /* what produced them */
      'reproduce',                                /* check it yourself */
    ];
    var rank = {};
    ORDER.forEach(function (id, i) { rank[id] = i; });
    var tail = ORDER.indexOf('estate');
    list.sort(function (a, b) {
      var ra = rank[a.id] === undefined ? tail : rank[a.id];
      var rb = rank[b.id] === undefined ? tail : rank[b.id];
      return ra - rb;
    });
    return list;
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * BUILD
   * ═══════════════════════════════════════════════════════════════════════ */

  /* The carousel drops the two method slides: a public post has no presenter
   * to hold a method discussion open, and the scope limit still travels
   * because it is printed on the fence slide where the configured number is,
   * rather than on a slide of its own that a reader can swipe past. */
  var INCLUDE = {
    carousel: function (s) { return s.only !== 'internal'; },
    internal: function () { return true; },
  };

  function build(kind, ctx) {
    var fmt = FORMATS[kind];
    if (!fmt) return Promise.reject(new Error('unknown deck format: ' + kind));
    var pal = ctx.pal, cal = ctx.cal;
    var all = slides(ctx).filter(INCLUDE[kind]);
    /* A slide whose chart was never drawn keeps its argument and loses its
     * illustration; a slide that exists only to carry one is dropped, so the
     * deck never shows an empty frame. */
    var deck = all.filter(function (s) {
      return !s.needs || (ctx.charts && ctx.charts[s.needs] && ctx.charts[s.needs].getAttribute('viewBox'));
    });

    /* The scope limit rides the footer of every slide rather than sitting on
     * a slide of its own. A deck is read one page at a time and reshared a
     * page at a time, so a caveat that lives on page 11 is a caveat that does
     * not travel with page 3 — and page 3 is the one with the percentage on
     * it. Slides are pulled out of decks; footers come with them. */
    var excluded = (ctx.scope && ctx.scope.excludedShort) ||
      'Denial of service, fraud without intrusion, and physical premises access';
    var source = 'Lower bound · ' + excluded.toLowerCase() + ' not counted';
    var pdf = PDF(fmt.w, fmt.h, {
      /* Named for what it reports, not for the tool that made it. This is the
       * string a colleague sees in a mail attachment and a tab title, and
       * "briefing deck" tells them nothing about which run it is. */
      title: 'Exposure Race: simulated result for a configured estate',
      author: 'Exposure Race',
      subject: 'Monte Carlo simulation of exploit availability against remediation for one configured estate. ' +
        'Lower bound: ' + excluded.toLowerCase() + ' are not counted. Not a risk assessment for a named ' +
        'organisation. Calibrated to CyberMon ' + cal.snapshot.cvelist + '.',
      date: pdfDate(ctx.now || new Date()),
    });

    /* Laid out once with the chart and, if the chart could not be given a
     * legible size, once again without it. Layout is cheap — only the raster
     * costs anything — so a trial pass is a better way to decide than a rule
     * guessing at how long the copy will run. */
    function compose(spec, i, chartNode) {
      var s = Slide(fmt, pal);
      /* A slide showing a chart says less in words and normally drops its
       * headline figure: the chart is the same evidence, and on a landscape
       * slide there is room for one of them, not both.
       *
       * `keepStat` is the exception, and the result slide is why it exists.
       * That slide dropped its percentage in favour of a survival curve, which
       * is the trade exactly backwards — the number is the thing the reader
       * opened the deck for, and the curve is the illustration of it. Where a
       * slide's figure IS the slide, the chart is what gives way. */
      var keep = spec.keepStat && spec.stat;
      var copy = (kind === 'carousel' || !chartNode)
        ? (kind === 'carousel' ? (spec.short || spec.long) : (spec.long || spec.short))
        : (spec.short || spec.long);
      var stat = spec.stat && (keep || kind === 'carousel' || !chartNode) ? spec.stat : null;

      /* The fence band and the eyebrow are page furniture and sit outside the
       * movable block; everything carrying the argument goes in it. */
      if (spec.fence) s.fenceTop(spec.fence, pal.warn);
      /* The ordinal comes from the slide's POSITION, not from its copy. The
       * eyebrows carried their own numbers until the deck was reordered, at
       * which point every one of them was wrong — and a numbered slide that
       * disagrees with its own page number is worse than an unnumbered one.
       * The cover and the closing slide keep their named eyebrows. */
      if (spec.eyebrow) {
        s.eyebrow(i > 0 && i < deck.length - 1
          ? ('0' + i).slice(-2) + ' · ' + spec.eyebrow
          : spec.eyebrow);
      }
      s.begin();
      if (spec.title) s.title(spec.title);
      if (stat) s.stat(stat.v, stat.l, stat.tag);
      if (copy) s.body(copy);
      if (spec.estate) s.note(spec.estate, pal.txt).space(fmt.bodyGap);
      if (spec.acts && spec.acts.length) {
        var actNoteH = spec.note ? wrapCount(spec.note, fmt) * fmt.noteLh + fmt.bodyGap : 0;
        s.actions(spec.acts.map(function (a) {
          return { title: a.title, detail: a.detail, value: '−' + (a.gain * 100).toFixed(1) + 'pt' };
        }), kind === 'internal' || spec.acts.length <= 3, s.footTop() - s.y - actNoteH);
      }
      if (spec.tiles && spec.tiles.length) s.tiles(spec.tiles);
      /* Rows give way to the chart, not the other way round. A slide carrying
       * both spent its vertical room on a table and then had nothing left to
       * draw the chart at a legible size, so the chart was dropped and the
       * slide silently became the table — on the access-class and sensitivity
       * slides, whose charts are the point. They show the same data, so where
       * both are available the picture wins and the table is the fallback for
       * when the picture would not have been readable anyway. */
      if (spec.rows && spec.rows.length && !spec.estate && !chartNode) s.rows(spec.rows);
      if (spec.link) s.link(spec.link);

      /* Charts take whatever room is left above the footer, so a slide whose
       * copy ran long shortens its chart rather than printing one over the
       * source line. The slack goes to the block when no chart is drawn, which
       * is why this is settled before the anchor. */
      var noteH = spec.note ? wrapCount(spec.note, fmt) * fmt.noteLh + fmt.bodyGap : 0;
      var room = s.footTop() - s.y - noteH;
      s.drew = false;
      if (chartNode && s.chartScale(chartNode, room) >= CHART_MIN_SCALE) {
        s.chart(chartNode, room);
        s.drew = true;
      }
      if (spec.note) s.note(spec.note, spec.fence ? pal.txt : pal.dim);
      if (!s.drew) s.anchorBottom(s.footTop());
      s.foot(source, (i + 1) + ' / ' + deck.length);
      return s;
    }

    return deck.reduce(function (chain, spec, i) {
      return chain.then(function () {
        var node = spec.chart && ctx.charts ? ctx.charts[spec.chart] : null;
        var s = compose(spec, i, node);
        if (node && !s.drew) s = compose(spec, i, null);
        return rasterise(s.svg, fmt).then(function (jpeg) { pdf.addPage(jpeg, s.runs); });
      });
    }, Promise.resolve()).then(function () {
      return { blob: pdf.blob(), pages: pdf.count() };
    });
  }

  /* The two underscored names are the surface tools/check-deck.js tests
   * against, and nothing else reads them. They are exported because a module
   * that needs a DOM to run has no other way to be checked headlessly — the
   * same reason tools/check-layout.js exists — not as an invitation to build
   * on them. */
  return { build: build, FORMATS: FORMATS, _PDF: PDF, _slides: slides };
});
