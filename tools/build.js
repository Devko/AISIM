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

/* Inline the stylesheet. */
const css = read('css/app.css');
html = html.replace(
  /<link rel="stylesheet" href="css\/app\.css">/,
  '<style>\n' + css + '\n</style>'
);

/* Inline the scripts, in the order the page lists them. Using a function as
 * the replacement keeps `$&`-style sequences inside the source from being
 * interpreted as replacement patterns — model.js contains regex-ish strings. */
const scripts = ['js/calibration.js', 'js/model.js', 'js/charts.js', 'js/app.js'];
scripts.forEach((src) => {
  const code = read(src);
  const tag = new RegExp('<script src="' + src.replace(/[/.]/g, '\\$&') + '"></script>');
  if (!tag.test(html)) throw new Error('could not find script tag for ' + src);
  html = html.replace(tag, () => '<script>\n' + code + '\n</script>');
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
html = html.replace('<span>v3</span>', '<span>v3 · single file</span>');
html = html.replace('</head>',
  '<!-- Exposure Race, self-contained build.\n' +
  '     Calibrated to CyberMon ' + cal.snapshot.cvelist + ' (' + cal.generatedAt + ').\n' +
  '     Source: index.html + css/app.css + js/*.js — see README.md. -->\n</head>');

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
