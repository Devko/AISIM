/* GENERATED FILE — do not edit by hand.
 * Produced by tools/derive-calibration.js from the CyberMon snapshot in data/cybermon/.
 * Snapshot: cve_2026-11-17_1000Z · EPSS v2026.06.15 · KEV 2026.11.13
 * Generated at: 2026-11-17T11:07:38Z
 * Refresh with:  node tools/refresh-data.js && node tools/derive-calibration.js
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CALIBRATION = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return {
  "generatedAt": "2026-11-17T11:07:38Z",
  "snapshot": {
    "cvelist": "cve_2026-11-17_1000Z",
    "cveCount": 426227,
    "epss": "v2026.06.15",
    "epssDate": "2026-11-16",
    "kev": "2026.11.13",
    "kevCount": 1781
  },
  "currentYear": 2026,
  "yearElapsed": 0.879,
  "source": "https://cybermon.einblick.dev/",
  "volume": {
    "prevYear": {
      "year": 2025,
      "published": 48150,
      "critical": 4112,
      "high": 15761,
      "medium": 23719,
      "low": 1603,
      "unscored": 2955,
      "criticalShare": 9.098,
      "highPlusShare": 43.972
    },
    "curYearToDate": {
      "year": 2026,
      "published": 98175,
      "critical": 10707,
      "high": 39860,
      "medium": 38583,
      "low": 3909,
      "unscored": 5116,
      "criticalShare": 11.506,
      "highPlusShare": 54.339
    },
    "curYearRunRate": {
      "year": 2026,
      "published": 111632,
      "critical": 12181,
      "high": 45347,
      "medium": 43894,
      "low": 4447
    },
    "growth": {
      "published": 2.32,
      "critical": 2.96,
      "high": 2.88,
      "medium": 1.85
    },
    "note": "Run-rate is linear extrapolation of a partial year — calendar arithmetic, not a forecast.",
    "src": "https://cybermon.einblick.dev/cve.html#flood"
  },
  "exploitation": {
    "bands": [
      {
        "band": "0.0-3.9",
        "population": 10271,
        "inKev": 10,
        "pExploited": 0.097
      },
      {
        "band": "4.0-6.9",
        "population": 107262,
        "inKev": 212,
        "pExploited": 0.198
      },
      {
        "band": "7.0-8.9",
        "population": 91568,
        "inKev": 932,
        "pExploited": 1.018
      },
      {
        "band": "9.0-10.0",
        "population": 24564,
        "inKev": 627,
        "pExploited": 2.553
      }
    ],
    "allBands": {
      "population": 233665,
      "inKev": 1781,
      "pExploited": 0.762
    },
    "criticalVsHigh": 2.51,
    "kevBelowCritical": 64.795,
    "criticalEpssBelow1pct": 65.4,
    "src": "https://cybermon.einblick.dev/cve.html#reality"
  },
  "armed": {
    "window": 2025,
    "byBand": [
      {
        "band": "0.0-3.9",
        "total": 1603,
        "withPoC": 4,
        "pct": 0.2
      },
      {
        "band": "4.0-6.9",
        "total": 23719,
        "withPoC": 72,
        "pct": 0.3
      },
      {
        "band": "7.0-8.9",
        "total": 15761,
        "withPoC": 182,
        "pct": 1.2
      },
      {
        "band": "9.0-10.0",
        "total": 4112,
        "withPoC": 206,
        "pct": 5
      }
    ],
    "pPoCCritical": 5,
    "worldwidePoCPerYear": 464,
    "catalog": {
      "exploitdb": {
        "entries": 47182,
        "with_cve": 27434,
        "cves": 25095,
        "dated_cves": 25095
      },
      "metasploit": {
        "modules": 7267,
        "with_cve": 3145,
        "exploit_modules_with_cve": 2431,
        "cves": 2601,
        "other_cves": 645,
        "dated_cves": 0,
        "disclosure_dated_cves": 3082
      },
      "nuclei": {
        "templates": 4668,
        "cves": 4668
      },
      "exploit_cves": 26014,
      "union_cves": 29854,
      "dated_cves": 25095,
      "matched_in_corpus": 25968
    },
    "src": "https://cybermon.einblick.dev/exploits.html"
  },
  "inWild": {
    "pKevCritical": 2.553,
    "pInWildGivenPoC": 28.7,
    "pInWildNoPoC": 1.2,
    "pctPoCFirst": 56.2,
    "kevAddedPrevYear": 245,
    "kevAddedCurYTD": 297,
    "kevAddedRunRate": 338,
    "src": "https://cybermon.einblick.dev/kev.html"
  },
  "pocTiming": {
    "observedThrough": "2026-08-19",
    "horizonDays": 90,
    "series": [
      {
        "year": 2015,
        "n": 539,
        "medianDays": -1,
        "pctWithinWeek": 77.6,
        "pctBefore": 56.6,
        "provisional": false
      },
      {
        "year": 2016,
        "n": 378,
        "medianDays": -1,
        "pctWithinWeek": 78.8,
        "pctBefore": 51.3,
        "provisional": false
      },
      {
        "year": 2017,
        "n": 996,
        "medianDays": 0,
        "pctWithinWeek": 83.4,
        "pctBefore": 45.8,
        "provisional": false
      },
      {
        "year": 2018,
        "n": 902,
        "medianDays": 1,
        "pctWithinWeek": 80.8,
        "pctBefore": 40.2,
        "provisional": false
      },
      {
        "year": 2019,
        "n": 557,
        "medianDays": 0,
        "pctWithinWeek": 80.1,
        "pctBefore": 42,
        "provisional": false
      },
      {
        "year": 2020,
        "n": 252,
        "medianDays": 4.5,
        "pctWithinWeek": 57.9,
        "pctBefore": 11.9,
        "provisional": false
      },
      {
        "year": 2021,
        "n": 186,
        "medianDays": 4.5,
        "pctWithinWeek": 59.1,
        "pctBefore": 11.3,
        "provisional": false
      },
      {
        "year": 2022,
        "n": 134,
        "medianDays": 7,
        "pctWithinWeek": 53.7,
        "pctBefore": 21.6,
        "provisional": false
      },
      {
        "year": 2023,
        "n": 213,
        "medianDays": 7,
        "pctWithinWeek": 50.2,
        "pctBefore": 26.8,
        "provisional": false
      },
      {
        "year": 2024,
        "n": 42,
        "medianDays": 11,
        "pctWithinWeek": 42.9,
        "pctBefore": 23.8,
        "provisional": false
      },
      {
        "year": 2025,
        "n": 134,
        "medianDays": 10,
        "pctWithinWeek": 36.6,
        "pctBefore": 4.5,
        "provisional": true
      },
      {
        "year": 2026,
        "n": 83,
        "medianDays": 34,
        "pctWithinWeek": 12,
        "pctBefore": 9.6,
        "provisional": true
      }
    ],
    "latest": {
      "year": 2026,
      "medianDays": 34,
      "pctWithinWeek": 12,
      "pctBefore": 9.6,
      "provisional": true
    },
    "lastSettled": {
      "year": 2024,
      "medianDays": 11,
      "pctWithinWeek": 42.9,
      "pctBefore": 23.8
    },
    "settled": {
      "years": [
        2020,
        2021,
        2022,
        2023,
        2024
      ],
      "n": 827,
      "medianDays": 5.879,
      "pctWithinWeek": 54.744,
      "pctBefore": 17.779,
      "note": "n-weighted over the settled years listed. Shares pool exactly; the median is a weighted mean of per-year medians, which is an approximation forced by the published summaries. The per-year medians in the window run from 4.5 to 11 days, and the true pooled median lies in the same range."
    },
    "recordLag": {
      "worstYear": 2002,
      "worstMedianDays": -57.5,
      "worstPctBefore": 95.6,
      "yearsWithImpossibleMedian": 5,
      "firstYear": 2000,
      "firstPctBefore": 98.5,
      "note": "Years whose median exploit date precedes CVE publication by more than a week. An exploit cannot predate its vulnerability, so the negative tail of this series measures CVE-record lag rather than adversary pre-disclosure."
    },
    "caveat": "Recent years are right-censored: PoCs are still arriving for them. Provisional years understate speed and understate the pre-publication share.",
    "coverageCaveat": "Exploit-DB is the only source that dates exploit code. Its dated sample fell from 996 CVEs in 2017 to 42 in 2024 while CVE publication grew 2.7x. Exploit code moved off the public catalogues rather than becoming rarer, so the weaponised share is a floor, and the timing describes the small, self-selected cohort this instrument can still see.",
    "sampleTrend": [
      {
        "year": 2015,
        "n": 539
      },
      {
        "year": 2016,
        "n": 378
      },
      {
        "year": 2017,
        "n": 996
      },
      {
        "year": 2018,
        "n": 902
      },
      {
        "year": 2019,
        "n": 557
      },
      {
        "year": 2020,
        "n": 252
      },
      {
        "year": 2021,
        "n": 186
      },
      {
        "year": 2022,
        "n": 134
      },
      {
        "year": 2023,
        "n": 213
      },
      {
        "year": 2024,
        "n": 42
      },
      {
        "year": 2025,
        "n": 134
      },
      {
        "year": 2026,
        "n": 83
      }
    ],
    "src": "https://cybermon.einblick.dev/exploits.html"
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
        "n": 297,
        "medianDays": 12,
        "p25": 1,
        "p75": 126,
        "pctBefore": 1.3
      }
    ],
    "buckets": [
      {
        "bucket": "before_publish",
        "n": 26,
        "pct": 2.8
      },
      {
        "bucket": "0-7d",
        "n": 364,
        "pct": 39.8
      },
      {
        "bucket": "8-30d",
        "n": 113,
        "pct": 12.3
      },
      {
        "bucket": "31-90d",
        "n": 95,
        "pct": 10.4
      },
      {
        "bucket": "91-365d",
        "n": 119,
        "pct": 13
      },
      {
        "bucket": "1-3y",
        "n": 75,
        "pct": 8.2
      },
      {
        "bucket": "3-5y",
        "n": 44,
        "pct": 4.8
      },
      {
        "bucket": "5-10y",
        "n": 49,
        "pct": 5.4
      },
      {
        "bucket": "10y+",
        "n": 30,
        "pct": 3.3
      }
    ],
    "within7d": 42.6,
    "cisaDeadlineDays": 3,
    "src": "https://cybermon.einblick.dev/kev.html"
  },
  "nvd": {
    "statuses": [
      {
        "status": "Modified",
        "n": 245714
      },
      {
        "status": "Analyzed",
        "n": 79901
      },
      {
        "status": "Deferred",
        "n": 63314
      },
      {
        "status": "Rejected",
        "n": 19175
      },
      {
        "status": "Awaiting Analysis",
        "n": 11616
      },
      {
        "status": "Received",
        "n": 5215
      },
      {
        "status": "Undergoing Analysis",
        "n": 1387
      }
    ],
    "corpus": 426227,
    "deferred": 63314,
    "deferredShare": 14.855,
    "backlogTotal": 18218,
    "backlogFirst": {
      "date": "2026-07-09",
      "backlog_total": 2242,
      "awaiting_analysis": 1479
    },
    "backlogLast": {
      "date": "2026-11-17",
      "backlog_total": 18218,
      "awaiting_analysis": 11616
    },
    "backlogGrowth": 8.13,
    "src": "https://cybermon.einblick.dev/cve.html#decay"
  }
};
});
