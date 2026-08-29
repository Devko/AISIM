#!/usr/bin/env node
/* Re-fetches the CyberMon snapshot into data/cybermon/.
 *
 *   node tools/refresh-data.js
 *   node tools/derive-calibration.js     # then regenerate the anchors
 *
 * The snapshot is vendored rather than fetched at page load so the published
 * page has no runtime network dependency and every figure on it stays
 * reproducible offline, exactly as it was when published.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://devko.github.io/CyberMon/data/';
const OUT = path.join(__dirname, '..', 'data', 'cybermon');

const FILES = [
  'meta',                /* snapshot versions and freshness             */
  'nine_eight_flood',    /* CVEs per year bucketed by severity          */
  'volume_curve',        /* published vs rejected per year              */
  'severity_inflation',  /* median score drift, split by CVSS version   */
  'score_vs_reality',    /* CVSS x EPSS grid, plus KEV by band          */
  'time_to_poc',         /* days from publication to public exploit     */
  'kev_latency',         /* how long until a bug is known-exploited     */
  'kev_changelog',       /* KEV additions over time                     */
  'nvd_decay',           /* NVD analysis status and backlog             */
  'nvd_throughput',      /* queue movement, measured externally         */
  'cna_leaderboard',     /* who scores their own bugs how high          */
  'cna_concentration',   /* publication concentration                   */
  'advisory_quality',    /* missing CWE / CVSS / version data           */
  'cwe_distribution',    /* bug classes over time                       */
  'epss_report',         /* EPSS distribution                           */
];

function get(url, redirects) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'user-agent': 'exposure-race/refresh' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if ((redirects || 0) > 4) return reject(new Error('too many redirects'));
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString(), (redirects || 0) + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

(async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let ok = 0;
  const failed = [];

  for (const name of FILES) {
    const url = BASE + name + '.json';
    try {
      const buf = await get(url);
      /* Parse before writing: a truncated or HTML error page must never
       * silently replace a good snapshot file. */
      JSON.parse(buf.toString('utf8'));
      fs.writeFileSync(path.join(OUT, name + '.json'), buf);
      console.log('  ok   ' + name.padEnd(22) + (buf.length / 1024).toFixed(1) + ' KB');
      ok++;
    } catch (e) {
      failed.push(name);
      console.error('  FAIL ' + name.padEnd(22) + e.message);
    }
  }

  console.log('\n' + ok + '/' + FILES.length + ' refreshed');
  if (failed.length) {
    console.error('kept the previous copy for: ' + failed.join(', '));
  }
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'));
    console.log('snapshot: ' + meta.sources.cvelist.release + '  (' + meta.generated_at + ')');
  } catch (e) { /* meta may not have refreshed */ }
  console.log('\nnext:  node tools/derive-calibration.js && node test/model.test.js');
  process.exit(failed.length ? 1 : 0);
})();
