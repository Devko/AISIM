#!/usr/bin/env node
/* Inlines index.html + css + js into one self-contained file.
 *
 *   node tools/build.js
 *   -> dist/exposure-race.html
 *
 * Why bother: the multi-file version is the readable one, but a single file is
 * what actually travels — it opens from a download, attaches to an email, and
 * publishes anywhere that serves static HTML, with no build step and no
 * loader-order surprises. The only remote reference left is the webfont, and
 * the page is designed to look right without it (charts already use system
 * fonts so PNG export is faithful).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('index.html');

/* Every substitution below goes through here, and every one of them throws on
 * a miss. A build step whose replacements fail quietly does not produce a
 * worse page, it produces a CONVINCING one: the stylesheet link was inlined by
 * an unguarded .replace(), so renaming css/app.css would have shipped a 240KB
 * single file - complete and correct in every other respect, with no styling
 * at all - and the dist-freshness gate would have certified it as current. A
 * third replacement here targeted markup that no longer exists and had been
 * doing nothing for some time; that is this failure mode already arrived.
 *
 * The replacement is always a FUNCTION. Passing the file's text as a string
 * would let a `$&` or `$'` inside it be read as a replacement pattern and
 * corrupt the output - model.js carries regex-ish strings, and CSS is one
 * `content: "$&"` away from the same trap. */
function replaceOnce(hay, pattern, replacement, what) {
  const found = typeof pattern === 'string' ? hay.indexOf(pattern) >= 0 : pattern.test(hay);
  if (!found) throw new Error('could not find ' + what + ' in index.html');
  return hay.replace(pattern, () => replacement);
}

/* Inline the stylesheet. */
const css = read('css/app.css');
html = replaceOnce(html, /<link rel="stylesheet" href="css\/app\.css">/,
  '<style>\n' + css + '\n</style>', 'the stylesheet link');

/* Inline the scripts, in the order the page lists them. */
const scripts = ['js/calibration.js', 'js/model.js', 'js/charts.js', 'js/deck.js', 'js/app.js'];
scripts.forEach((src) => {
  const tag = new RegExp('<script src="' + src.replace(/[/.]/g, '\\$&') + '"></script>');
  html = replaceOnce(html, tag, '<script>\n' + read(src) + '\n</script>',
    'the script tag for ' + src);
});

/* A closing tag inside an inlined source file would end its block early and
 * silently truncate the build, so the open/close counts have to match. */
const scriptBlocks = html.split('<script').length - 1;
const scriptCloses = html.split('</script>').length - 1;
if (scriptBlocks !== scriptCloses) {
  throw new Error('unbalanced script tags after inlining (' + scriptBlocks + ' open, ' + scriptCloses + ' close)');
}

/* Stamp the build so a stray copy can be traced back to its snapshot. */
const cal = JSON.parse(
  read('js/calibration.js').replace(/^[\s\S]*?return /, '').replace(/;\s*\}\);\s*$/, '')
);
/* There was a third replacement here, stamping a '. single file' marker onto
 * a `<span>v3</span>` in the masthead. That span is not in index.html and has
 * not been for some time, so the line had been a silent no-op - which is the
 * whole argument for replaceOnce() above. The provenance it reached for is
 * carried by the head comment below, stamped unconditionally, which cannot go
 * stale the same way. */
html = replaceOnce(html, '</head>',
  '<!-- Exposure Race, self-contained build.\n' +
  '     Calibrated to CyberMon ' + cal.snapshot.cvelist + ' (' + cal.generatedAt + ').\n' +
  '     Source: index.html + css/app.css + js/*.js — see README.md. -->\n</head>',
  'the closing head tag');

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const out = path.join(ROOT, 'dist', 'exposure-race.html');
fs.writeFileSync(out, html);

const kb = (s) => (s.length / 1024).toFixed(0) + ' KB';
/* Width is measured, not guessed: 'calibration.js' is fourteen characters and
 * a hardcoded pad of ten put one row of the size table out of column. */
const parts = [['html', read('index.html')], ['css', css]]
  .concat(scripts.map((s) => [s.replace('js/', ''), read(s)]));
const nameW = Math.max(...parts.map((p) => p[0].length)) + 2;
console.log('wrote dist/exposure-race.html   ' + kb(html));
parts.forEach(([name, src]) => console.log('  ' + name.padEnd(nameW) + kb(src)));
console.log('\n  snapshot  ' + cal.snapshot.cvelist);
console.log('  remote    Google Fonts only (page is legible without it)');
