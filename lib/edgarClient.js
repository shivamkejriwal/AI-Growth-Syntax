/**
 * edgarClient.js
 * SEC EDGAR API Wrapper tailored to the Composite Investment Methodology.
 * 
 * Supports:
 * - SEC Fair-Access compliant User-Agent headers and <= 10 req/sec rate limiting.
 * - Automatic Ticker to 10-digit zero-padded CIK resolution via company_tickers.json.
 * - Submissions API (data.sec.gov/submissions/CIK{cik}.json) for official 10-K, 10-Q, DEF 14A, Form 4.
 * - Company Facts API (data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json) for structured XBRL data.
 * - Forensic 10-K reading protocol helper: direct SEC links to Footnotes, MD&A, Proxy executive compensation.
 * - Operating lease obligations extraction for Damodaran lease debt capitalization.
 * - Form 4 insider transaction discovery for Fisher scuttlebutt.
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';

export class EdgarClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.userAgent] SEC required format: "Name AdminEmail@domain.com"
   * @param {DiskCache} [options.cache]
   * @param {number} [options.cacheTtlMs]
   */
  constructor(options = {}) {
    this.userAgent = options.userAgent || process.env.SEC_EDGAR_USER_AGENT || 'ResearchAnalyst admin@researchprojects.local';
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days for regulatory data
    this.lastRequestTime = 0;
    this.minRequestIntervalMs = 120; // Enforces <= 8-10 req/sec to stay safely within SEC 10 req/s limit
  }

  /**
   * Rate-limited fetch enforcing SEC EDGAR Fair Access policy.
   */
  async _fetchSec(url, cacheKey, namespace = 'edgar', ttlMs = this.cacheTtlMs) {
    if (cacheKey) {
      const cached = this.cache.get(cacheKey, namespace, ttlMs);
      if (cached) return cached;
    }

    // Rate limiter throttle
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestIntervalMs) {
      await new Promise(res => setTimeout(res, this.minRequestIntervalMs - elapsed));
    }
    this.lastRequestTime = Date.now();

    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Encoding': 'gzip, deflate',
          'Host': new URL(url).host
        }
      });

      if (!res.ok) {
        if (res.status === 429) {
          console.warn('[SEC EDGAR] 429 Rate Limit encountered. Checking stale cache...');
          const stale = cacheKey ? this.cache.getStale(cacheKey, namespace) : null;
          if (stale) return stale;
        }
        throw new Error(`SEC EDGAR HTTP ${res.status}: ${res.statusText} (${url})`);
      }

      const data = await res.json();
      if (cacheKey) {
        this.cache.set(cacheKey, data, namespace);
      }
      return data;
    } catch (err) {
      console.warn(`[SEC EDGAR] Fetch error: ${err.message}`);
      if (cacheKey) {
        const stale = this.cache.getStale(cacheKey, namespace);
        if (stale) return stale;
      }
      return null;
    }
  }

  /**
   * Resolves a stock ticker (e.g. 'AAPL', 'MSFT') to a 10-digit zero-padded CIK string.
   */
  async lookupCIK(ticker) {
    const sym = ticker.trim().toUpperCase();
    const cacheKey = 'company_tickers';
    const url = 'https://www.sec.gov/files/company_tickers.json';

    let mapping = this.cache.get(cacheKey, 'edgar', 14 * 24 * 60 * 60 * 1000);
    if (!mapping) {
      mapping = await this._fetchSec(url, cacheKey, 'edgar', 14 * 24 * 60 * 60 * 1000);
    }

    if (mapping) {
      for (const entry of Object.values(mapping)) {
        if (entry.ticker && entry.ticker.toUpperCase() === sym) {
          const cikStr = String(entry.cik_str).padStart(10, '0');
          return {
            cik: cikStr,
            rawCik: entry.cik_str,
            ticker: entry.ticker,
            title: entry.title
          };
        }
      }
    }

    // Fallback known tickers
    const fallbacks = {
      AAPL: '0000320193',
      MSFT: '0000789019',
      GOOGL: '0001652044',
      AMZN: '0001018724',
      NVDA: '0001045810',
      META: '0001326801',
      BRK_B: '0001067983',
      BRK_A: '0001067983',
      TSLA: '0001318605'
    };

    if (fallbacks[sym]) {
      return { cik: fallbacks[sym], rawCik: parseInt(fallbacks[sym], 10), ticker: sym, title: sym };
    }

    return null;
  }

  /**
   * Searches for companies by ticker symbol or company name using SEC company_tickers.json.
   * Supports fuzzy/partial matches and ranks exact matches first.
   * @param {string} query Search term (e.g. 'Apple', 'MSFT', 'Tesla', 'NVDA')
   * @param {number} [limit=10]
   * @returns {Promise<Array<{ticker: string, title: string, cik: string}>>}
   */
  async searchCompanies(query, limit = 10) {
    if (!query || typeof query !== 'string' || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const qUpper = query.trim().toUpperCase();

    const cacheKey = 'company_tickers';
    const url = 'https://www.sec.gov/files/company_tickers.json';

    let mapping = this.cache.get(cacheKey, 'edgar', 14 * 24 * 60 * 60 * 1000);
    if (!mapping) {
      mapping = await this._fetchSec(url, cacheKey, 'edgar', 14 * 24 * 60 * 60 * 1000);
    }

    // Default built-in universe if network/cache empty
    const fallbackList = [
      { ticker: 'AAPL', title: 'Apple Inc.', cik_str: 320193 },
      { ticker: 'MSFT', title: 'Microsoft Corporation', cik_str: 789019 },
      { ticker: 'NVDA', title: 'NVIDIA Corporation', cik_str: 1045810 },
      { ticker: 'GOOGL', title: 'Alphabet Inc. (Google)', cik_str: 1652044 },
      { ticker: 'AMZN', title: 'Amazon.com Inc.', cik_str: 1018724 },
      { ticker: 'META', title: 'Meta Platforms Inc.', cik_str: 1326801 },
      { ticker: 'TSLA', title: 'Tesla, Inc.', cik_str: 1318605 },
      { ticker: 'BRK.B', title: 'Berkshire Hathaway Inc.', cik_str: 1067983 },
      { ticker: 'JPM', title: 'JPMorgan Chase & Co.', cik_str: 19617 },
      { ticker: 'V', title: 'Visa Inc.', cik_str: 1403161 }
    ];

    const entries = mapping ? Object.values(mapping) : fallbackList;
    const scored = [];

    for (const entry of entries) {
      if (!entry.ticker || !entry.title) continue;
      const t = entry.ticker.toUpperCase();
      const titleLower = entry.title.toLowerCase();

      let score = 0;
      if (t === qUpper) {
        score = 100; // Exact ticker
      } else if (titleLower === q) {
        score = 95; // Exact company title
      } else if (t.startsWith(qUpper)) {
        score = 80; // Ticker starts with
      } else if (titleLower.startsWith(q)) {
        score = 70; // Title starts with
      } else if (titleLower.split(/\s+/).some(word => word.startsWith(q))) {
        score = 60; // Any word in title starts with
      } else if (titleLower.includes(q)) {
        score = 50; // Substring in title
      } else if (t.includes(qUpper)) {
        score = 40; // Substring in ticker
      }

      if (score > 0) {
        scored.push({
          score,
          ticker: entry.ticker,
          title: entry.title,
          cik: String(entry.cik_str).padStart(10, '0')
        });
      }
    }

    // Sort by score desc, then by shorter ticker length
    scored.sort((a, b) => b.score - a.score || a.ticker.length - b.ticker.length);

    return scored.slice(0, limit).map(({ ticker, title, cik }) => ({ ticker, title, cik }));
  }


  /**
   * Fetches submission metadata for a company (all recent filings).
   */
  async getSubmissions(cikOrTicker) {
    let cik = cikOrTicker;
    if (typeof cikOrTicker === 'string' && cikOrTicker.length < 10) {
      const info = await this.lookupCIK(cikOrTicker);
      if (!info) throw new Error(`Could not resolve CIK for ticker ${cikOrTicker}`);
      cik = info.cik;
    }

    const cik10 = String(cik).padStart(10, '0');
    const url = `https://data.sec.gov/submissions/CIK${cik10}.json`;
    return this._fetchSec(url, `submissions_${cik10}`, 'edgar');
  }

  /**
   * Fetches structured XBRL facts for a company from data.sec.gov.
   */
  async getCompanyFacts(cikOrTicker) {
    let cik = cikOrTicker;
    if (typeof cikOrTicker === 'string' && cikOrTicker.length < 10) {
      const info = await this.lookupCIK(cikOrTicker);
      if (!info) throw new Error(`Could not resolve CIK for ticker ${cikOrTicker}`);
      cik = info.cik;
    }

    const cik10 = String(cik).padStart(10, '0');
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`;
    return this._fetchSec(url, `companyfacts_${cik10}`, 'edgar');
  }

  /**
   * Forensic 10-K Protocol:
   * Extracts direct links and accession details for the latest 10-K, 10-Q, DEF 14A, and Form 4s.
   */
  async getForensicFilings(cikOrTicker) {
    const cikInfo = await this.lookupCIK(cikOrTicker);
    if (!cikInfo) {
      return { error: `Ticker ${cikOrTicker} could not be resolved to a CIK.` };
    }

    const sub = await this.getSubmissions(cikInfo.cik);
    if (!sub || !sub.filings || !sub.filings.recent) {
      return { error: `No recent filings found for ${cikOrTicker}.` };
    }

    const recent = sub.filings.recent;
    const forms = recent.form || [];
    const dates = recent.filingDate || [];
    const accessions = recent.accessionNumber || [];
    const primaryDocs = recent.primaryDocument || [];
    const reportDates = recent.reportDate || [];
    const docDescriptions = recent.primaryDocDescription || [];

    const rawCik = parseInt(cikInfo.cik, 10);
    const result = {
      ticker: cikInfo.ticker,
      companyName: sub.name || cikInfo.title,
      cik: cikInfo.cik,
      sic: sub.sic,
      sicDescription: sub.sicDescription,
      fiscalYearEnd: sub.fiscalYearEnd,
      filings: {
        latest10K: null,
        latest10Q: null,
        latestDEF14A: null,
        recentForm4s: []
      }
    };

    const buildUrl = (acc, doc) => {
      const cleanAcc = acc.replace(/-/g, '');
      return `https://www.sec.gov/Archives/edgar/data/${rawCik}/${cleanAcc}/${doc}`;
    };

    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const acc = accessions[i];
      const doc = primaryDocs[i];
      const filingDate = dates[i];
      const reportDate = reportDates[i];
      const desc = docDescriptions[i];

      const item = {
        form,
        filingDate,
        reportDate,
        accessionNumber: acc,
        primaryDocument: doc,
        description: desc,
        filingUrl: buildUrl(acc, doc)
      };

      if (!result.filings.latest10K && form === '10-K') {
        result.filings.latest10K = {
          ...item,
          forensicReadingChecklist: [
            '1. Footnotes: Revenue Recognition & Segment Performance',
            '2. Footnotes: Operating Lease Commitments & Maturity Schedule',
            '3. Footnotes: Debt Covenants & Contingent Legal Liabilities',
            '4. MD&A: Pricing vs Volume Changes & Customer Concentration'
          ]
        };
      } else if (!result.filings.latest10Q && form === '10-Q') {
        result.filings.latest10Q = item;
      } else if (!result.filings.latestDEF14A && form === 'DEF 14A') {
        result.filings.latestDEF14A = {
          ...item,
          executiveCompensationAudit: [
            'Audit: Are CEO bonuses tied to ROIC or economic profit?',
            'Warning: Are incentives tied strictly to revenue vanity targets or adjusted EBITDA?',
            'Insider: Check executive stock ownership and unvested stock option overhang.'
          ]
        };
      } else if (form === '4' && result.filings.recentForm4s.length < 5) {
        result.filings.recentForm4s.push(item);
      }

      if (result.filings.latest10K && result.filings.latest10Q && result.filings.latestDEF14A && result.filings.recentForm4s.length >= 5) {
        break;
      }
    }

    return result;
  }

  /**
   * Extracts operating lease liabilities and commitments from XBRL data
   * (Essential for Damodaran's Lease Debt Capitalization).
   */
  async getLeaseCommitments(cikOrTicker) {
    const facts = await this.getCompanyFacts(cikOrTicker);
    if (!facts || !facts.facts || !facts.facts['us-gaap']) {
      return { status: 'No GAAP XBRL facts available' };
    }

    const gaap = facts.facts['us-gaap'];
    const leaseTags = [
      'OperatingLeaseLiability',
      'OperatingLeaseLiabilityCurrent',
      'OperatingLeaseLiabilityNoncurrent',
      'OperatingLeaseRightOfUseAsset',
      'OperatingLeaseCost'
    ];

    const extracted = {};

    for (const tag of leaseTags) {
      if (gaap[tag] && gaap[tag].units && gaap[tag].units.USD) {
        const entries = gaap[tag].units.USD
          .filter(e => e.form === '10-K' || e.form === '10-Q')
          .sort((a, b) => (b.end || '').localeCompare(a.end || ''));
        if (entries.length > 0) {
          extracted[tag] = entries.slice(0, 4).map(e => ({
            periodEnd: e.end,
            fiscalYear: e.fy,
            fiscalPeriod: e.fp,
            form: e.form,
            amount: e.val
          }));
        }
      }
    }

    // Estimate total operating lease liability to add to debt
    let totalLeaseDebt = 0;
    if (extracted.OperatingLeaseLiability && extracted.OperatingLeaseLiability.length > 0) {
      totalLeaseDebt = extracted.OperatingLeaseLiability[0].amount;
    } else {
      const cur = extracted.OperatingLeaseLiabilityCurrent?.[0]?.amount || 0;
      const nonCur = extracted.OperatingLeaseLiabilityNoncurrent?.[0]?.amount || 0;
      totalLeaseDebt = cur + nonCur;
    }

    return {
      totalLeaseDebt,
      damodaranAdjustment: `Add $${(totalLeaseDebt / 1e9).toFixed(2)}B to total debt obligations when computing Enterprise Value and Debt-to-Equity.`,
      details: extracted
    };
  }
}

