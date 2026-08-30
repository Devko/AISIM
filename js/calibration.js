/* GENERATED FILE — do not edit by hand.
 * Produced by tools/derive-calibration.js from the CyberMon snapshot in data/cybermon/.
 * Snapshot: cve_2026-08-27_0300Z · EPSS v2026.06.15 · KEV 2026.08.26
 * Generated at: 2026-08-27T04:29:47Z
 * Refresh with:  node tools/refresh-data.js && node tools/derive-calibration.js
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CALIBRATION = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
  "generatedAt": "2026-08-27T04:29:47Z",
  "snapshot": {
    "cvelist": "cve_2026-08-27_0300Z",
    "cveCount": 383416,
    "epss": "v2026.06.15",
    "epssDate": "2026-08-26",
    "kev": "2026.08.26",
    "kevCount": 1682
  },
  "currentYear": 2026,
  "yearElapsed": 0.655,
  "source": "https://devko.github.io/CyberMon/",
  "volume": {
    "prevYear": {
      "year": 2025,
      "published": 48154,
      "critical": 4110,
      "high": 15765,
      "medium": 23721,
      "low": 1603,
      "unscored": 2955,
      "criticalShare": 9.093,
      "highPlusShare": 43.972
    },
    "curYearToDate": {
      "year": 2026,
      "published": 56454,
      "critical": 6534,
      "high": 22457,
      "medium": 22272,
      "low": 2213,
      "unscored": 2978,
      "criticalShare": 12.219,
      "highPlusShare": 54.213
    },
    "curYearRunRate": {
      "year": 2026,
      "published": 86216,
      "critical": 9976,
      "high": 34285,
      "medium": 34003,
      "low": 3379
    },
    "growth": {
      "published": 1.79,
      "critical": 2.43,
      "high": 2.17,
      "medium": 1.43
    },
    "note": "Run-rate is linear extrapolation of a partial year — calendar arithmetic, not a forecast.",
    "src": "https://devko.github.io/CyberMon/cve.html#flood"
  },
  "exploitation": {
    "bands": [
      {
        "band": "0.1-3.9",
        "population": 8576,
        "inKev": 7,
        "pExploited": 0.082
      },
      {
        "band": "4.0-6.9",
        "population": 91045,
        "inKev": 203,
        "pExploited": 0.223
      },
      {
        "band": "7.0-8.9",
        "population": 74163,
        "inKev": 888,
        "pExploited": 1.197
      },
      {
        "band": "9.0-10.0",
        "population": 20355,
        "inKev": 584,
        "pExploited": 2.869
      }
    ],
    "allBands": {
      "population": 194139,
      "inKev": 1682,
      "pExploited": 0.866
    },
    "criticalVsHigh": 2.4,
    "kevBelowCritical": 65.279,
    "criticalEpssBelow1pct": 63.2,
    "src": "https://devko.github.io/CyberMon/cve.html#reality"
  },
  "armed": {
    "window": 2025,
    "byBand": [
      {
        "band": "0.1-3.9",
        "total": 1603,
        "withPoC": 11,
        "pct": 0.7
      },
      {
        "band": "4.0-6.9",
        "total": 23721,
        "withPoC": 250,
        "pct": 1.1
      },
      {
        "band": "7.0-8.9",
        "total": 15765,
        "withPoC": 336,
        "pct": 2.1
      },
      {
        "band": "9.0-10.0",
        "total": 4110,
        "withPoC": 339,
        "pct": 8.2
      }
    ],
    "pPoCCritical": 8.2,
    "worldwidePoCPerYear": 936,
    "catalog": {
      "exploitdb": {
        "entries": 47136,
        "with_cve": 27402,
        "cves": 25058,
        "dated_cves": 25058
      },
      "metasploit": {
        "modules": 7158,
        "with_cve": 3101,
        "cves": 3195,
        "dated_cves": 3033
      },
      "nuclei": {
        "templates": 4355,
        "cves": 4355
      },
      "union_cves": 29507,
      "dated_cves": 26218,
      "matched_in_corpus": 29455
    },
    "src": "https://devko.github.io/CyberMon/exploits.html"
  },
  "inWild": {
    "pKevCritical": 2.869,
    "pInWildGivenPoC": 28.4,
    "pInWildNoPoC": 0.6,
    "pctPoCFirst": 81.2,
    "kevAddedPrevYear": 245,
    "kevAddedCurYTD": 198,
    "kevAddedRunRate": 302,
    "src": "https://devko.github.io/CyberMon/kev.html"
  },
  "pocTiming": {
    "observedThrough": "2026-05-29",
    "horizonDays": 90,
    "series": [
      {
        "year": 2015,
        "n": 542,
        "medianDays": -2,
        "pctWithinWeek": 82.8,
        "pctBefore": 62.9,
        "provisional": false
      },
      {
        "year": 2016,
        "n": 397,
        "medianDays": -1,
        "pctWithinWeek": 80.9,
        "pctBefore": 54.7,
        "provisional": false
      },
      {
        "year": 2017,
        "n": 1019,
        "medianDays": 0,
        "pctWithinWeek": 85.5,
        "pctBefore": 48.9,
        "provisional": false
      },
      {
        "year": 2018,
        "n": 925,
        "medianDays": 0,
        "pctWithinWeek": 83.6,
        "pctBefore": 44.4,
        "provisional": false
      },
      {
        "year": 2019,
        "n": 584,
        "medianDays": 0,
        "pctWithinWeek": 85.8,
        "pctBefore": 49,
        "provisional": false
      },
      {
        "year": 2020,
        "n": 354,
        "medianDays": 1,
        "pctWithinWeek": 75.7,
        "pctBefore": 35.6,
        "provisional": false
      },
      {
        "year": 2021,
        "n": 267,
        "medianDays": 1,
        "pctWithinWeek": 74.5,
        "pctBefore": 33,
        "provisional": false
      },
      {
        "year": 2022,
        "n": 205,
        "medianDays": 1,
        "pctWithinWeek": 69.3,
        "pctBefore": 41.5,
        "provisional": false
      },
      {
        "year": 2023,
        "n": 326,
        "medianDays": 0,
        "pctWithinWeek": 67.5,
        "pctBefore": 34.7,
        "provisional": false
      },
      {
        "year": 2024,
        "n": 146,
        "medianDays": 0,
        "pctWithinWeek": 80.1,
        "pctBefore": 41.8,
        "provisional": false
      },
      {
        "year": 2025,
        "n": 220,
        "medianDays": 1,
        "pctWithinWeek": 67.3,
        "pctBefore": 22.3,
        "provisional": true
      },
      {
        "year": 2026,
        "n": 94,
        "medianDays": 3.5,
        "pctWithinWeek": 53.2,
        "pctBefore": 21.3,
        "provisional": true
      }
    ],
    "latest": {
      "year": 2026,
      "medianDays": 3.5,
      "pctWithinWeek": 53.2,
      "pctBefore": 21.3,
      "provisional": true
    },
    "lastSettled": {
      "year": 2024,
      "medianDays": 0,
      "pctWithinWeek": 80.1,
      "pctBefore": 41.8
    },
    "settled": {
      "years": [
        2020,
        2021,
        2022,
        2023,
        2024
      ],
      "n": 1298,
      "medianDays": 0.636,
      "pctWithinWeek": 72.878,
      "pctBefore": 36.468,
      "note": "n-weighted over the settled years listed. Shares pool exactly; the median is a weighted mean of per-year medians, which is an approximation forced by the published summaries — every year in the window reports 0 or 1 day."
    },
    "recordLag": {
      "worstYear": 2002,
      "worstMedianDays": -57,
      "worstPctBefore": 95.7,
      "yearsWithImpossibleMedian": 5,
      "firstYear": 2000,
      "firstPctBefore": 98.5,
      "note": "Years whose median exploit date precedes CVE publication by more than a week. An exploit cannot predate its vulnerability, so the negative tail of this series measures CVE-record lag rather than adversary pre-disclosure."
    },
    "caveat": "Recent years are right-censored: PoCs are still arriving for them. Provisional years understate speed and understate the pre-publication share.",
    "coverageCaveat": "The dated sample fell from over a thousand CVEs a year to the low hundreds while CVE publication tripled. Exploit code moved off the public catalogues rather than becoming rarer, so the weaponised share is a floor, and the near-zero median describes the fast tail this instrument can still see.",
    "sampleTrend": [
      {
        "year": 2015,
        "n": 542
      },
      {
        "year": 2016,
        "n": 397
      },
      {
        "year": 2017,
        "n": 1019
      },
      {
        "year": 2018,
        "n": 925
      },
      {
        "year": 2019,
        "n": 584
      },
      {
        "year": 2020,
        "n": 354
      },
      {
        "year": 2021,
        "n": 267
      },
      {
        "year": 2022,
        "n": 205
      },
      {
        "year": 2023,
        "n": 326
      },
      {
        "year": 2024,
        "n": 146
      },
      {
        "year": 2025,
        "n": 220
      },
      {
        "year": 2026,
        "n": 94
      }
    ],
    "src": "https://devko.github.io/CyberMon/exploits.html"
  },
  "kevLatency": {
    "byYear": [
      {
        "year": 2023,
        "n": 187,
        "medianDays": 12,
        "p25": 1,
        "p75": 335.5,
        "pctBefore": 5.3
      },
      {
        "year": 2024,
        "n": 186,
        "medianDays": 21.5,
        "p25": 1,
        "p75": 309.8,
        "pctBefore": 2.7
      },
      {
        "year": 2025,
        "n": 245,
        "medianDays": 26,
        "p25": 1,
        "p75": 304,
        "pctBefore": 2.9
      },
      {
        "year": 2026,
        "n": 198,
        "medianDays": 17,
        "p25": 1,
        "p75": 248.2,
        "pctBefore": 0.5
      }
    ],
    "buckets": [
      {
        "bucket": "before_publish",
        "n": 23,
        "pct": 2.8
      },
      {
        "bucket": "0-7d",
        "n": 313,
        "pct": 38.4
      },
      {
        "bucket": "8-30d",
        "n": 95,
        "pct": 11.6
      },
      {
        "bucket": "31-90d",
        "n": 84,
        "pct": 10.3
      },
      {
        "bucket": "91-365d",
        "n": 111,
        "pct": 13.6
      },
      {
        "bucket": "1-3y",
        "n": 72,
        "pct": 8.8
      },
      {
        "bucket": "3y+",
        "n": 118,
        "pct": 14.5
      }
    ],
    "within7d": 41.2,
    "cisaDeadlineDays": 14,
    "src": "https://devko.github.io/CyberMon/kev.html"
  },
  "nvd": {
    "statuses": [
      {
        "status": "Modified",
        "n": 243358
      },
      {
        "status": "Analyzed",
        "n": 69269
      },
      {
        "status": "Deferred",
        "n": 44050
      },
      {
        "status": "Rejected",
        "n": 18075
      },
      {
        "status": "Received",
        "n": 5274
      },
      {
        "status": "Awaiting Analysis",
        "n": 2720
      },
      {
        "status": "Undergoing Analysis",
        "n": 674
      }
    ],
    "corpus": 383416,
    "deferred": 44050,
    "deferredShare": 11.489,
    "backlogTotal": 8668,
    "backlogFirst": {
      "date": "2026-07-09",
      "backlog_total": 2242,
      "awaiting_analysis": 1479
    },
    "backlogLast": {
      "date": "2026-08-27",
      "backlog_total": 8668,
      "awaiting_analysis": 2720
    },
    "backlogGrowth": 3.87,
    "src": "https://devko.github.io/CyberMon/cve.html#decay"
  }
};
});
