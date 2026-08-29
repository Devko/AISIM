#!/usr/bin/env node
/* Checks the palette in css/app.css against the floor DESIGN.md states.
 *
 *   node tools/check-contrast.js
 *
 * Why this exists: DESIGN.md quotes specific contrast ratios and calls them
 * "the floor a change must not regress". A number in a design document rots
 * the first time somebody nudges a hex and does not re-run the arithmetic. So
 * the arithmetic runs in CI, next to the calibration and dist-freshness gates,
 * for the same reason those do — the page's authority is that anyone can
 * check it.
 *
 * It also enforces two structural rules the stylesheet depends on:
 *   - dark is defined twice, by preference and by explicit data-theme, with
 *     byte-identical values, so an explicit toggle wins in both directions;
 *   - no colour is defined ONLY in a dark block. js/app.js reads all thirteen
 *     palette tokens off :root at draw time and hands them straight to SVG
 *     attributes, so a token missing from the light baseline paints nothing
 *     and exports a blank PNG.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');

/* Text tokens, each of which must clear 4.5:1 on the surfaces it renders on. */
const TEXT = ['txt', 'mut', 'dim', 'att', 'def', 'bad', 'zero', 'warn'];
/* Surfaces text is set on. --sunk is deliberately absent: see EXCEPTIONS. */
const SURFACES = ['ink', 'panel'];
/* Boundaries a reader can act on, which must clear the 3:1 non-text floor. */
const BOUNDARIES = ['rule2'];

const TEXT_MIN = 4.5;
const NONTEXT_MIN = 3;

/* The one documented shortfall, stated here so it is visible rather than
 * silently excluded. --sunk backs chart tracks and inline code only, and the
 * type that lands on it is 10px chart labelling. */
const EXCEPTIONS = { surface: 'sunk', min: 4.3 };

function block(re, label) {
  const m = CSS.match(re);
  if (!m) throw new Error('could not find the ' + label + ' token block in css/app.css');
  const out = {};
  for (const d of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})/g)) out[d[1]] = d[2].toLowerCase();
  return out;
}

const light = block(/:root\s*\{([\s\S]*?)\n\}/, 'light :root');
const darkPref = block(
  /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}/,
  'preference dark');
const darkAttr = block(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/, 'explicit dark');

function lum(hex) {
  const c = hex.replace('#', '');
  const v = [0, 2, 4].map((i) => parseInt(c.substr(i, 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function ratio(a, b) {
  const l = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l[0] + 0.05) / (l[1] + 0.05);
}

const fails = [];
const rows = [];

/* ── structure ─────────────────────────────────────────────────────────── */
const prefKeys = Object.keys(darkPref).sort();
const attrKeys = Object.keys(darkAttr).sort();
if (prefKeys.join() !== attrKeys.join()) {
  fails.push('the two dark blocks define different token sets — an explicit toggle would ' +
    'disagree with the preference: ' + prefKeys.join(',') + ' vs ' + attrKeys.join(','));
} else {
  for (const k of prefKeys) {
    if (darkPref[k] !== darkAttr[k]) {
      fails.push('--' + k + ' differs between the two dark blocks (' +
        darkPref[k] + ' by preference, ' + darkAttr[k] + ' by data-theme)');
    }
  }
}
for (const k of prefKeys) {
  if (!(k in light)) {
    fails.push('--' + k + ' is defined only in a dark block. palette() reads it off :root, ' +
      'so it resolves to an empty string in light and paints nothing.');
  }
}

/* ── contrast ──────────────────────────────────────────────────────────── */
for (const [themeName, tokens] of [['light', light], ['dark', Object.assign({}, light, darkAttr)]]) {
  for (const fg of TEXT) {
    for (const bg of SURFACES.concat([EXCEPTIONS.surface])) {
      if (!tokens[fg] || !tokens[bg]) continue;
      const r = ratio(tokens[fg], tokens[bg]);
      const min = bg === EXCEPTIONS.surface ? EXCEPTIONS.min : TEXT_MIN;
      rows.push([themeName, '--' + fg, 'on --' + bg, r.toFixed(2), r >= min ? 'ok' : 'FAIL']);
      if (r < min) {
        fails.push(themeName + ': --' + fg + ' on --' + bg + ' is ' + r.toFixed(2) +
          ':1, under the ' + min + ':1 floor');
      }
    }
  }
  for (const fg of BOUNDARIES) {
    for (const bg of SURFACES) {
      if (!tokens[fg] || !tokens[bg]) continue;
      const r = ratio(tokens[fg], tokens[bg]);
      rows.push([themeName, '--' + fg, 'on --' + bg, r.toFixed(2), r >= NONTEXT_MIN ? 'ok' : 'FAIL']);
      if (r < NONTEXT_MIN) {
        fails.push(themeName + ': --' + fg + ' on --' + bg + ' is ' + r.toFixed(2) +
          ':1, under the ' + NONTEXT_MIN + ':1 floor for a boundary a reader can act on');
      }
    }
  }
  /* No reversed-pair check here, deliberately. ::selection and `button.on`
   * paint --ink ON an accent — the opposite direction to the loop above, which
   * sets each accent on a surface. It is tempting to add rows for it, and one
   * was added and then removed: WCAG contrast is symmetric, and ratio() sorts
   * its two luminances, so ratio(ink, def) is the SAME NUMBER as ratio(def,
   * ink), which the TEXT x SURFACES loop already asserts against the same
   * floor. Rows for it would restate a passing assertion and inflate the pair
   * count while adding no coverage. The reversed usage is certified by the
   * forward check; there is nothing further to compute. */
}

const w = [0, 1, 2, 3].map((i) => Math.max.apply(null, rows.map((r) => r[i].length)));
rows.forEach((r) => {
  console.log(r.slice(0, 4).map((c, i) => c.padEnd(w[i])).join('  ') + '  ' + r[4]);
});

if (fails.length) {
  console.error('\n' + fails.length + ' palette failure(s):');
  fails.forEach((f) => console.error('  - ' + f));
  console.error('\nDESIGN.md quotes these ratios as the floor. Either fix the token or ' +
    'change the floor there deliberately.');
  process.exit(1);
}
console.log('\nOK — ' + rows.length + ' pairs, both themes.');
