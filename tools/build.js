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

/* A closing tag inside an inlined script would end the block early. */
if (/<\/script\s*>/i.test(html.replace(/<\/script>\s*(<script>|<\/body>)/gi, ''))) {
  /* fine — the check below is the real one */
}
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
console.log('wrote dist/exposure-race.html   ' + kb(html));
console.log('  html      ' + kb(read('index.html')));
console.log('  css       ' + kb(css));
scripts.forEach((s) => console.log('  ' + s.replace('js/', '').padEnd(10) + kb(read(s))));
console.log('\n  snapshot  ' + cal.snapshot.cvelist);
console.log('  remote    Google Fonts only (page is legible without it)');
