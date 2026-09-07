/**
 * alphaVantageClient.js
 * Comprehensive Alpha Vantage Client tailored to the Composite Investment Methodology.
 * 
 * Supports:
 * - Direct fundamental statement fetching (Income Statement, Balance Sheet, Cash Flow, Overview, Quote)
 * - Peter Lynch: PEG ratio, inventory vs sales growth spread, net cash/share, taxonomy classifier
 * - Warren Buffett: Owner Earnings, $1 Retained Earnings test, multi-year ROIC/ROE, capital allocation
 * - Aswath Damodaran: R&D capitalization (amortization schedule, adjusted invested capital, modern ROIC)
 * - Persistent disk caching to respect API call quotas with stale cache fallback.
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';
import { defaultYahooFinanceClient, YahooFinanceClient } from './yahooFinanceClient.js';
import { DEMO_MARKET_MOVERS, DEMO_SPDR_SECTOR_ETFS } from './demoData.js';

export function safeFloat(val, defaultVal = 0.0) {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'number') return Number.isFinite(val) ? val : defaultVal;
  const s = String(val).trim();
  if (!s || ['none', 'null', 'n/a', '-', ''].includes(s.toLowerCase())) return defaultVal;
  const parsed = Number.parseFloat(s);
  return Number.isNaN(parsed) ? defaultVal : parsed;
}

export function roundVal(val, decimals = 2) {
  if (typeof val !== 'number' || Number.isNaN(val)) return 0;
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

export class AlphaVantageClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {DiskCache} [options.cache]
   * @param {number} [options.cacheTtlMs] Default: 24 hours
   * @param {YahooFinanceClient} [options.yahooFinance] Live backup client
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.ALPHA_VANTAGE_API_KEY || 'demo';
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000;
    this.baseUrl = 'https://www.alphavantage.co/query';
    this.yahooFinance = options.yahooFinance || defaultYahooFinanceClient;
  }

  /**
   * Fetches an Alpha Vantage endpoint with caching and error handling.
   */
  async fetchEndpoint(func, symbol, extraParams = {}, useCache = true) {
    const sym = symbol.toUpperCase();
    const cacheKey = `${sym}_${func}`;
    const namespace = 'alphavantage';

    if (useCache) {
      const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
      if (cached && !cached.Note && !cached.Information && !cached['Error Message']) {
        return cached;
      }
    }

    const query = new URLSearchParams({
      function: func,
      symbol: sym,
      apikey: this.apiKey,
      ...extraParams
    });

    const url = `${this.baseUrl}?${query.toString()}`;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CompositeInvestmentApp/1.0' }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data = await res.json();

      if (data.Note || data.Information) {
        const msg = data.Note || data.Information;
        console.warn(`[AlphaVantage Warning] ${sym} (${func}): ${msg}`);
        const stale = this.cache.getStale(cacheKey, namespace);
        if (stale) return stale;
      } else if (data['Error Message']) {
        console.error(`[AlphaVantage Error] ${sym} (${func}): ${data['Error Message']}`);
      } else {
        this.cache.set(cacheKey, data, namespace);
      }

      return data;
    } catch (err) {
      console.warn(`[AlphaVantage] Network error for ${sym} (${func}): ${err.message}. Checking cache...`);
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return {};
    }
  }

  // --- Core API Methods ---

  async getOverview(symbol) {
    if (this.apiKey && this.apiKey !== 'demo') {
      const avOverview = await this.fetchEndpoint('OVERVIEW', symbol);
      if (avOverview && avOverview.Symbol && !avOverview.Note && !avOverview.Information) {
        return avOverview;
      }
    }
    // Live Yahoo Finance fallback
    try {
      const yfOverview = await this.yahooFinance.getOverview(symbol);
      if (yfOverview && yfOverview.Symbol) {
        return yfOverview;
      }
    } catch (err) {
      console.warn(`[YahooFinance Fallback] Overview error for ${symbol}: ${err.message}`);
    }
    return this.fetchEndpoint('OVERVIEW', symbol);
  }

  async getIncomeStatement(symbol) {
    return this.fetchEndpoint('INCOME_STATEMENT', symbol);
  }

  async getBalanceSheet(symbol) {
    return this.fetchEndpoint('BALANCE_SHEET', symbol);
  }

  async getCashFlow(symbol) {
    return this.fetchEndpoint('CASH_FLOW', symbol);
  }

  async getGlobalQuote(symbol) {
    // Shorter TTL for real-time quotes (10 minutes)
    const sym = symbol.toUpperCase();
    const cached = this.cache.get(`${sym}_GLOBAL_QUOTE`, 'alphavantage', 10 * 60 * 1000);
    if (cached && cached['Global Quote']) return cached;

    if (this.apiKey && this.apiKey !== 'demo') {
      const res = await this.fetchEndpoint('GLOBAL_QUOTE', symbol, {}, false);
      if (res && res['Global Quote'] && res['Global Quote']['05. price']) {
        return res;
      }
    }

    // Live Yahoo Finance quote fallback
    try {
      const yfQuote = await this.yahooFinance.getQuote(symbol);
      if (yfQuote && yfQuote.price) {
        const mapped = {
          'Global Quote': {
            '01. symbol': yfQuote.symbol,
            '05. price': String(yfQuote.price),
            '08. previous close': String(yfQuote.previousClose),
            '09. change': String(yfQuote.change),
            '10. change percent': yfQuote.changePercent,
            '06. volume': String(yfQuote.volume),
            source: 'YahooFinance',
            isLive: true
          }
        };
        this.cache.set(`${sym}_GLOBAL_QUOTE`, mapped, 'alphavantage');
        return mapped;
      }
    } catch (err) {
      console.warn(`[YahooFinance Fallback] Quote error for ${symbol}: ${err.message}`);
    }

    return this.fetchEndpoint('GLOBAL_QUOTE', symbol, {}, false);
  }

  async getTimeSeriesDailyAdjusted(symbol, outputsize = 'compact') {
    return this.fetchEndpoint('TIME_SERIES_DAILY_ADJUSTED', symbol, { outputsize });
  }

  async getEarnings(symbol) {
    return this.fetchEndpoint('EARNINGS', symbol);
  }

  /**
   * Retrieves US market top gainers, losers, and most active tickers.
   * Uses Alpha Vantage TOP_GAINERS_LOSERS with disk caching, Yahoo Finance live backup, and demo fallback.
   */
  async getMarketMovers() {
    const cacheKey = 'MARKET_TOP_GAINERS_LOSERS';
    const namespace = 'alphavantage';
    const cached = this.cache.get(cacheKey, namespace, 15 * 60 * 1000);
    if (cached && (cached.top_gainers || cached.gainers)) {
      return this._formatMarketMovers(cached);
    }

    if (this.apiKey && this.apiKey !== 'demo') {
      try {
        const url = `${this.baseUrl}?function=TOP_GAINERS_LOSERS&apikey=${this.apiKey}`;
        const res = await fetch(url, { headers: { 'User-Agent': 'CompositeInvestmentApp/1.0' } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.top_gainers) && data.top_gainers.length > 0) {
            this.cache.set(cacheKey, data, namespace);
            return this._formatMarketMovers(data);
          }
        }
      } catch (err) {
        console.warn(`[AlphaVantage] Failed to fetch TOP_GAINERS_LOSERS: ${err.message}. Trying backup...`);
      }
    }

    // Live Yahoo Finance Screener fallback
    try {
      const yfMovers = await this.yahooFinance.getMarketMovers();
      if (yfMovers && (yfMovers.gainers?.length > 0 || yfMovers.losers?.length > 0)) {
        return yfMovers;
      }
    } catch (err) {
      console.warn(`[YahooFinance Fallback] Market movers error: ${err.message}`);
    }

    const stale = this.cache.getStale(cacheKey, namespace);
    if (stale && (stale.top_gainers || stale.gainers)) {
      return this._formatMarketMovers(stale);
    }

    return DEMO_MARKET_MOVERS;
  }

  _formatMarketMovers(data) {
    if (data.gainers && Array.isArray(data.gainers)) {
      return data;
    }

    const mapItem = (item) => {
      const price = parseFloat(item.price) || 0;
      let chg = item.change_percentage || '0.00%';
      if (!chg.endsWith('%')) chg += '%';
      if (!chg.startsWith('+') && !chg.startsWith('-')) chg = `+${chg}`;
      const isNegative = chg.startsWith('-');
      const volNum = parseFloat(item.volume) || 0;
      let volStr = '';
      if (volNum >= 1e9) volStr = `${(volNum / 1e9).toFixed(1)}B`;
      else if (volNum >= 1e6) volStr = `${(volNum / 1e6).toFixed(1)}M`;
      else if (volNum >= 1e3) volStr = `${(volNum / 1e3).toFixed(1)}K`;
      else if (volNum > 0) volStr = `${volNum}`;

      return {
        ticker: item.ticker,
        close: price,
        change: chg,
        changeType: isNegative ? 'negative' : 'positive',
        volume: volStr
      };
    };

    const gainers = Array.isArray(data.top_gainers) ? data.top_gainers.slice(0, 10).map(mapItem) : DEMO_MARKET_MOVERS.gainers;
    const losers = Array.isArray(data.top_losers) ? data.top_losers.slice(0, 10).map(mapItem) : DEMO_MARKET_MOVERS.losers;
    const active = Array.isArray(data.most_actively_traded) ? data.most_actively_traded.slice(0, 10).map(mapItem) : DEMO_MARKET_MOVERS.active;

    return {
      gainers,
      losers,
      active,
      advancers: data.advancers || 2242,
      decliners: data.decliners || 1856,
      unchanged: data.unchanged || 142
    };
  }

  /**
   * Fetches real-time market data for the 11 Select Sector SPDR ETFs.
   * Leverages live market feeds with disk caching, Yahoo Finance live backup, and demo fallback.
   * @returns {Promise<Array<{ticker: string, name: string, fundName: string, price: number, change: string, changeNum: number, changeType: string, icon: string, isLive?: boolean}>>}
   */
  async getLiveSpdrSectorETFs() {
    // 1. Check Yahoo Finance direct ETF method
    try {
      const yfEtfs = await this.yahooFinance.getSpdrSectorETFs();
      if (yfEtfs && Array.isArray(yfEtfs) && yfEtfs.length === 11) {
        return yfEtfs;
      }
    } catch (err) {
      console.warn(`[YahooFinance Fallback] Sector ETF error: ${err.message}`);
    }

    const cacheKey = 'SPDR_SECTOR_ETFS_LIVE';
    const namespace = 'alphavantage';
    const cached = this.cache.get(cacheKey, namespace, 10 * 60 * 1000);
    if (cached && Array.isArray(cached) && cached.length === 11) {
      return cached;
    }

    const etfMetaList = [
      { ticker: 'XLK', name: 'Technology', fundName: 'Technology Select Sector SPDR Fund', icon: '⚡' },
      { ticker: 'XLC', name: 'Communication Services', fundName: 'Communication Services Select Sector SPDR', icon: '💬' },
      { ticker: 'XLF', name: 'Financial Services', fundName: 'Financial Select Sector SPDR Fund', icon: '🏛️' },
      { ticker: 'XLY', name: 'Consumer Cyclical', fundName: 'Consumer Discretionary Select Sector SPDR', icon: '🛒' },
      { ticker: 'XLV', name: 'Health Care', fundName: 'Health Care Select Sector SPDR Fund', icon: '🏥' },
      { ticker: 'XLU', name: 'Utilities', fundName: 'Utilities Select Sector SPDR Fund', icon: '💡' },
      { ticker: 'XLI', name: 'Industrials', fundName: 'Industrial Select Sector SPDR Fund', icon: '🏭' },
      { ticker: 'XLP', name: 'Consumer Defensive', fundName: 'Consumer Staples Select Sector SPDR Fund', icon: '🛡️' },
      { ticker: 'XLRE', name: 'Real Estate', fundName: 'Real Estate Select Sector SPDR Fund', icon: '🏢' },
      { ticker: 'XLB', name: 'Basic Materials', fundName: 'Materials Select Sector SPDR Fund', icon: '🧱' },
      { ticker: 'XLE', name: 'Energy', fundName: 'Energy Select Sector SPDR Fund', icon: '🔥' }
    ];

    try {
      const results = await Promise.all(etfMetaList.map(async (meta) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${meta.ticker}?interval=1d`;
          const res = await fetch(url, { headers: { 'User-Agent': 'CompositeInvestmentApp/1.0' } });
          if (res.ok) {
            const json = await res.json();
            const chartMeta = json.chart?.result?.[0]?.meta;
            const price = chartMeta?.regularMarketPrice || 0;
            const prevClose = chartMeta?.chartPreviousClose || price;
            const diff = price - prevClose;
            const pct = prevClose ? (diff / prevClose) * 100 : 0;
            return {
              ticker: meta.ticker,
              name: meta.name,
              fundName: meta.fundName,
              price: roundVal(price, 2),
              change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
              changeNum: Math.round(pct * 100) / 100,
              changeType: pct >= 0 ? 'positive' : 'negative',
              icon: meta.icon,
              isLive: true
            };
          }
        } catch (err) {
          // Fall through to fallback
        }

        const fallback = DEMO_SPDR_SECTOR_ETFS.find(d => d.ticker === meta.ticker);
        return fallback || {
          ticker: meta.ticker,
          name: meta.name,
          fundName: meta.fundName,
          price: 100.0,
          change: '0.00%',
          changeNum: 0.0,
          changeType: 'positive',
          icon: meta.icon,
          isLive: false
        };
      }));

      if (results && results.length === 11) {
        this.cache.set(cacheKey, results, namespace);
        return results;
      }
    } catch (err) {
      console.warn(`[SectorETFs] Live query failed: ${err.message}. Checking cache...`);
    }

    const stale = this.cache.getStale(cacheKey, namespace);
    if (stale && Array.isArray(stale) && stale.length === 11) {
      return stale;
    }

    return DEMO_SPDR_SECTOR_ETFS;
  }

  /**
   * Searches symbols using Alpha Vantage SYMBOL_SEARCH with Yahoo Finance search fallback.
   * @param {string} keywords
   * @returns {Promise<Array<{ticker: string, title: string, type: string, region?: string}>>}
   */
  async searchSymbol(keywords) {
    if (!keywords || typeof keywords !== 'string' || !keywords.trim()) return [];
    const cleanKw = keywords.trim();
    const cacheKey = `SEARCH_${cleanKw.toUpperCase()}`;
    const cached = this.cache.get(cacheKey, 'alphavantage', 7 * 24 * 60 * 60 * 1000);
    if (cached && Array.isArray(cached.bestMatches)) {
      return cached.bestMatches.map(m => ({
        ticker: m['1. symbol'],
        title: m['2. name'],
        type: m['3. type'],
        region: m['4. region'],
        currency: m['8. currency']
      }));
    }

    if (this.apiKey && this.apiKey !== 'demo') {
      try {
        const query = new URLSearchParams({
          function: 'SYMBOL_SEARCH',
          keywords: cleanKw,
          apikey: this.apiKey
        });
        const res = await fetch(`${this.baseUrl}?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.bestMatches) && data.bestMatches.length > 0) {
            this.cache.set(cacheKey, data, 'alphavantage');
            return data.bestMatches.map(m => ({
              ticker: m['1. symbol'],
              title: m['2. name'],
              type: m['3. type'],
              region: m['4. region'],
              currency: m['8. currency']
            }));
          }
        }
      } catch {
        // Fall through to Yahoo Finance
      }
    }

    // Live Yahoo Finance fallback
    try {
      const yfResults = await this.yahooFinance.searchSymbols(cleanKw, 10);
      if (yfResults && yfResults.length > 0) {
        return yfResults;
      }
    } catch (err) {
      console.warn(`[YahooFinance Fallback] Search error for ${cleanKw}: ${err.message}`);
    }

    return [];
  }

  async getLatestPrice(symbol) {
    const quoteData = await this.getGlobalQuote(symbol);
    const quote = quoteData?.['Global Quote'] || {};
    const priceStr = quote['05. price'] || quote.price;
    if (priceStr) {
      const p = safeFloat(priceStr);
      if (p > 0) return p;
    }
    const overview = await this.getOverview(symbol);
    if (overview?.['50DayMovingAverage'] || overview?.CurrentPrice) {
      return safeFloat(overview['50DayMovingAverage'] || overview.CurrentPrice);
    }
    try {
      const yfQuote = await this.yahooFinance.getQuote(symbol);
      if (yfQuote && yfQuote.price > 0) return yfQuote.price;
    } catch {
      // Ignore
    }
    return 0.0;
  }

  /**
   * Ingests financial statements and normalizes them into chronological multi-year arrays.
   * Leverages Alpha Vantage when valid, and automatically falls back to Yahoo Finance live data.
   */
  async extractNormalizedFinancials(symbol) {
    const sym = symbol.toUpperCase().trim();

    // 1. If Alpha Vantage has an active API key, query Alpha Vantage first
    if (this.apiKey && this.apiKey !== 'demo') {
      try {
        const [overview, incData, balData, cfData, currentPrice] = await Promise.all([
          this.getOverview(sym),
          this.getIncomeStatement(sym),
          this.getBalanceSheet(sym),
          this.getCashFlow(sym),
          this.getLatestPrice(sym)
        ]);

        const annualInc = (incData.annualReports || []).slice().sort((a, b) => (a.fiscalDateEnding || '').localeCompare(b.fiscalDateEnding || ''));
        const annualBal = (balData.annualReports || []).slice().sort((a, b) => (a.fiscalDateEnding || '').localeCompare(b.fiscalDateEnding || ''));
        const annualCf = (cfData.annualReports || []).slice().sort((a, b) => (a.fiscalDateEnding || '').localeCompare(b.fiscalDateEnding || ''));

        if (annualInc.length >= 2) {
          const yearsMap = {};

          for (const rep of annualInc) {
            const year = (rep.fiscalDateEnding || '').slice(0, 4);
            if (!year) continue;
            yearsMap[year] = yearsMap[year] || {};
            yearsMap[year].fiscalDate = rep.fiscalDateEnding;
            yearsMap[year].revenue = safeFloat(rep.totalRevenue);
            yearsMap[year].grossProfit = safeFloat(rep.grossProfit);
            yearsMap[year].operatingIncome = safeFloat(rep.operatingIncome);
            yearsMap[year].netIncome = safeFloat(rep.netIncome);
            yearsMap[year].rnd = safeFloat(rep.researchAndDevelopment);
            yearsMap[year].ebitda = safeFloat(rep.ebitda);
            yearsMap[year].dilutedEPS = safeFloat(rep.dilutedEPS);
          }

          for (const rep of annualBal) {
            const year = (rep.fiscalDateEnding || '').slice(0, 4);
            if (!year || !yearsMap[year]) continue;
            const cash = safeFloat(rep.cashAndCashEquivalentsAtCarryingValue || rep.cashAndShortTermInvestments);
            const shortDebt = safeFloat(rep.shortTermDebt || rep.currentDebt);
            const longDebt = safeFloat(rep.longTermDebt || rep.longTermDebtNoncurrent);
            const totalDebt = shortDebt + longDebt;
            const equity = safeFloat(rep.totalShareholderEquity);
            const currentAssets = safeFloat(rep.totalCurrentAssets);
            const currentLiabilities = safeFloat(rep.totalCurrentLiabilities);
            const retainedEarnings = safeFloat(rep.retainedEarnings);
            const inventory = safeFloat(rep.inventory);
            const netPPE = safeFloat(rep.propertyPlantEquipmentNet);

            yearsMap[year].cash = cash;
            yearsMap[year].shortDebt = shortDebt;
            yearsMap[year].longDebt = longDebt;
            yearsMap[year].totalDebt = totalDebt;
            yearsMap[year].equity = equity;
            yearsMap[year].currentAssets = currentAssets;
            yearsMap[year].currentLiabilities = currentLiabilities;
            yearsMap[year].workingCapital = currentAssets - currentLiabilities;
            yearsMap[year].retainedEarnings = retainedEarnings;
            yearsMap[year].inventory = inventory;
            yearsMap[year].netPPE = netPPE;
          }

          for (const rep of annualCf) {
            const year = (rep.fiscalDateEnding || '').slice(0, 4);
            if (!year || !yearsMap[year]) continue;
            const cfo = safeFloat(rep.operatingCashflow);
            const capex = Math.abs(safeFloat(rep.capitalExpenditures));
            const ncfi = safeFloat(rep.cashflowFromInvestment);
            const divs = Math.abs(safeFloat(rep.dividendPayments));
            const sbc = safeFloat(rep.stockBasedCompensation);
            const depAmort = safeFloat(rep.depreciationAndAmortization || rep.depreciationDepletionAndAmortization);

            yearsMap[year].operatingCashflow = cfo;
            yearsMap[year].capex = capex;
            yearsMap[year].fcf = cfo - capex;
            yearsMap[year].ncfi = ncfi;
            yearsMap[year].dividendsPaid = divs;
            yearsMap[year].sbc = sbc;
            yearsMap[year].depreciationAndAmortization = depAmort;
          }

          const sortedYears = Object.keys(yearsMap).sort();
          const latestYear = sortedYears[sortedYears.length - 1] || '';
          const latest = yearsMap[latestYear] || {};

          const sharesOutstanding = safeFloat(overview.SharesOutstanding, 1.0);
          const peRatio = safeFloat(overview.PERatio);
          const pegRatio = safeFloat(overview.PEGRatio);
          const dividendYield = safeFloat(overview.DividendYield);
          const beta = safeFloat(overview.Beta, 1.0);
          const marketCap = currentPrice > 0 && sharesOutstanding > 0 ? currentPrice * sharesOutstanding : safeFloat(overview.MarketCapitalization);

          return {
            symbol: sym,
            name: overview.Name || sym,
            sector: overview.Sector || 'General',
            industry: overview.Industry || 'General',
            description: overview.Description || '',
            currentPrice,
            marketCap,
            sharesOutstanding,
            peRatio,
            pegRatio,
            dividendYield,
            beta,
            sortedYears,
            yearsMap,
            latestYear,
            latest,
            overviewRaw: overview,
            source: 'AlphaVantage',
            isLive: true
          };
        }
      } catch (err) {
        console.warn(`[AlphaVantage] Statements unavailable for ${sym}: ${err.message}. Trying Yahoo Finance live backup...`);
      }
    }

    // 2. Automatic Live Backup: Yahoo Finance
    try {
      const yfFin = await this.yahooFinance.extractNormalizedFinancials(sym);
      if (yfFin && yfFin.sortedYears && yfFin.sortedYears.length >= 2) {
        return yfFin;
      }
    } catch (err) {
      console.warn(`[YahooFinance Fallback] Financial extraction error for ${sym}: ${err.message}`);
    }

    return null;
  }

  // ============================================================================
  // METHODOLOGY PILLAR 1: PETER LYNCH (Edge, Inventory Audit, Taxonomy)
  // ============================================================================

  /**
   * Computes Peter Lynch empirical metrics:
   * 1. PEG Ratio
   * 2. Inventory Growth vs Sales Growth Spread (Red Flag Check)
   * 3. Net Cash Per Share (Asset Play Check)
   * 4. Business Category Classification (Fast Grower, Stalwart, Cyclical, etc.)
   */
  calculateLynchMetrics(financials) {
    const { sortedYears, yearsMap, latest, sharesOutstanding, currentPrice, peRatio, pegRatio } = financials;
    if (sortedYears.length < 2) {
      return {
        category: 'Insufficient Data',
        pegRatio,
        inventorySalesSpread: 0,
        netCashPerShare: 0,
        flags: ['Less than 2 years of financial statements']
      };
    }

    const prevYear = sortedYears[sortedYears.length - 2];
    const prev = yearsMap[prevYear] || {};

    // 1. Inventory vs Sales growth
    const revGrowth = prev.revenue > 0 ? (latest.revenue - prev.revenue) / prev.revenue : 0;
    const invGrowth = prev.inventory > 0 ? (latest.inventory - prev.inventory) / prev.inventory : 0;
    const inventorySalesSpread = roundVal((invGrowth - revGrowth) * 100, 2); // > 0 means inventory grew faster than sales

    // Multi-year Revenue CAGR
    const firstYear = sortedYears[0];
    const periods = sortedYears.length - 1;
    const firstRev = yearsMap[firstYear]?.revenue || 0;
    const revCAGR = (firstRev > 0 && latest.revenue > 0 && periods > 0)
      ? ((latest.revenue / firstRev) ** (1 / periods) - 1)
      : revGrowth;

    // 2. Net cash per share
    const netCash = (latest.cash || 0) - (latest.totalDebt || 0);
    const netCashPerShare = sharesOutstanding > 0 ? roundVal(netCash / sharesOutstanding, 2) : 0;
    const netCashToPriceRatio = currentPrice > 0 ? roundVal(netCashPerShare / currentPrice, 3) : 0;

    // 3. Lynch 6-Category Classification
    let category = 'Stalwart';
    const flags = [];

    if (inventorySalesSpread > 5.0 && latest.inventory > 0) {
      flags.push(`RED FLAG: Inventory growth (+${roundVal(invGrowth * 100)}%) exceeded revenue growth (+${roundVal(revGrowth * 100)}%) by ${inventorySalesSpread}%`);
    }

    if (netCashToPriceRatio > 0.35) {
      category = 'Asset Play';
    } else if (revCAGR >= 0.20) {
      category = 'Fast Grower';
    } else if (revCAGR >= 0.08 && revCAGR < 0.20) {
      category = 'Stalwart';
    } else if (revCAGR >= 0.01 && revCAGR < 0.08) {
      category = 'Slow Grower';
    } else if (latest.netIncome < 0 && prev.netIncome < 0) {
      category = 'Turnaround';
    } else {
      category = 'Cyclical / Undetermined';
    }

    const lynchPEGEvaluation = pegRatio > 0
      ? (pegRatio <= 0.5 ? 'Exceptional Bargain (PEG <= 0.5)' : pegRatio <= 1.0 ? 'Attractive (PEG <= 1.0)' : pegRatio <= 1.5 ? 'Fair' : 'Overvalued')
      : 'N/A';

    return {
      category,
      revenueCAGR: roundVal(revCAGR * 100, 2),
      pegRatio,
      lynchPEGEvaluation,
      inventorySalesSpread,
      inventoryGrowth: roundVal(invGrowth * 100, 2),
      salesGrowth: roundVal(revGrowth * 100, 2),
      netCashPerShare,
      netCashToPriceRatio,
      flags
    };
  }


  // ============================================================================
  // METHODOLOGY PILLAR 3: WARREN BUFFETT (Owner Earnings, $1 Retained, Moats)
  // ============================================================================

  /**
   * Computes Warren Buffett's Owner Earnings:
   * Owner Earnings = Reported Net Income + D&A - Maintenance Capex - Change in Working Capital
   *
   * As an institutional approximation, Maintenance Capex is estimated as 60-80% of D&A
   * or based on historical Net PPE depreciation run-rate.
   */
  calculateBuffettOwnerEarnings(financials, maintenanceCapexRatio = 0.70) {
    const { sortedYears, yearsMap } = financials;
    const history = [];

    for (let i = 0; i < sortedYears.length; i++) {
      const year = sortedYears[i];
      const cur = yearsMap[year];
      if (!cur) continue;
      const prevYear = i > 0 ? sortedYears[i - 1] : null;
      const prev = prevYear ? yearsMap[prevYear] : null;

      const netIncome = cur.netIncome || 0;
      const da = cur.depreciationAndAmortization || (cur.operatingCashflow ? cur.operatingCashflow - (cur.fcf || 0) : 0);
      const maintCapex = da > 0 ? da * maintenanceCapexRatio : (cur.capex || 0) * 0.5;

      const deltaWC = prev && cur.workingCapital !== undefined && prev.workingCapital !== undefined
        ? cur.workingCapital - prev.workingCapital
        : 0;

      const ownerEarnings = netIncome + da - maintCapex - deltaWC;

      // Return on Invested Capital (ROIC) = Operating Income * (1 - 21% tax) / (Equity + Debt - Cash)
      const nopat = (cur.operatingIncome || 0) * (1 - 0.21);
      const investedCap = Math.max(1, (cur.equity || 0) + (cur.totalDebt || 0) - (cur.cash || 0));
      const roic = roundVal((nopat / investedCap) * 100, 2);
      const roe = cur.equity > 0 ? roundVal((netIncome / cur.equity) * 100, 2) : 0;

      history.push({
        year,
        netIncome: roundVal(netIncome),
        depreciationAndAmortization: roundVal(da),
        estimatedMaintenanceCapex: roundVal(maintCapex),
        deltaWorkingCapital: roundVal(deltaWC),
        ownerEarnings: roundVal(ownerEarnings),
        fcf: roundVal(cur.fcf || 0),
        roic,
        roe
      });
    }

    const latestOE = history[history.length - 1]?.ownerEarnings || 0;
    const avgROIC = history.length > 0 ? roundVal(history.reduce((a, b) => a + b.roic, 0) / history.length, 2) : 0;

    return {
      history,
      latestOwnerEarnings: latestOE,
      averageROIC: avgROIC,
      isHighMoatROIC: avgROIC >= 15.0 // Buffett hurdle rate > 15%
    };
  }

  /**
   * Warren Buffett's $1 Retained Earnings Test:
   * Over a rolling 5-year period, every $1.00 of retained earnings must create
   * at least $1.00 of market value.
   */
  calculateBuffettRetainedEarningsTest(financials) {
    const { sortedYears, yearsMap, marketCap, currentPrice, sharesOutstanding } = financials;
    if (sortedYears.length < 2) {
      return { status: 'Insufficient historical years' };
    }

    const startYear = sortedYears[0];
    const endYear = sortedYears[sortedYears.length - 1];
    const startRetained = yearsMap[startYear]?.retainedEarnings || 0;
    const endRetained = yearsMap[endYear]?.retainedEarnings || 0;

    // Total retained earnings accumulated over the period
    const totalRetainedAccumulated = endRetained - startRetained;

    // Estimate initial market cap:
    // If historical price isn't stored, estimate from PE and Net Income or shares
    const startNetIncome = yearsMap[startYear]?.netIncome || 1;
    const endNetIncome = yearsMap[endYear]?.netIncome || 1;
    const startMarketCapEst = (endNetIncome > 0 && marketCap > 0)
      ? (marketCap * (startNetIncome / endNetIncome))
      : marketCap * 0.6;

    const marketValueCreated = marketCap - startMarketCapEst;
    const ratio = totalRetainedAccumulated > 0 ? roundVal(marketValueCreated / totalRetainedAccumulated, 2) : 1.0;

    return {
      period: `${startYear} - ${endYear}`,
      totalRetainedAccumulated: roundVal(totalRetainedAccumulated),
      marketValueCreated: roundVal(marketValueCreated),
      valueCreatedPerDollarRetained: ratio,
      passedBuffettTest: ratio >= 1.0
    };
  }

  // ============================================================================
  // METHODOLOGY PILLAR 4: ASWATH DAMODARAN (R&D & Accounting Normalization)
  // ============================================================================

  /**
   * Modernizes accounting according to Aswath Damodaran's methodology:
   * 1. Capitalizes R&D outlays into an amortizable asset over rndYears (default: 3 years for Tech, 5 for Pharma).
   * 2. Adds R&D Asset to Balance Sheet (increasing Invested Capital).
   * 3. Amortizes R&D and adds back current R&D expense to Operating Income.
   * 4. Computes True Adjusted ROIC.
   */
  calculateDamodaranAdjustments(financials, { rndYears = 3 } = {}) {
    const { sortedYears, yearsMap, latest } = financials;
    if (sortedYears.length === 0) return {};

    // Collect past R&D expenditures
    const rndHistory = sortedYears.map(y => ({ year: y, rnd: yearsMap[y]?.rnd || 0 }));
    const currentRnd = latest.rnd || 0;

    // If company doesn't report or have R&D, return baseline
    if (currentRnd === 0 && !rndHistory.some(h => h.rnd > 0)) {
      return {
        hasRndExpense: false,
        note: 'No material R&D reported to capitalize.'
      };
    }

    // Straight-line amortization schedule
    // Year - 0: Unamortized 100%, Year - 1: Unamortized (N-1)/N, ..., Year - N: 0
    let totalRndAsset = 0;
    let currentAmortization = 0;
    const n = rndYears;

    const recentYears = sortedYears.slice(-n);
    for (let i = 0; i < recentYears.length; i++) {
      const idxFromEnd = recentYears.length - 1 - i; // 0 for current year, 1 for previous, etc.
      const year = recentYears[i];
      const outlay = yearsMap[year]?.rnd || 0;
      const unamortizedFraction = (n - idxFromEnd) / n;
      totalRndAsset += outlay * unamortizedFraction;
      currentAmortization += outlay / n;
    }

    // Adjusted Operating Income:
    // Adjusted EBIT = Reported EBIT + Current R&D Expense - Current Year R&D Amortization
    const reportedEbit = latest.operatingIncome || 0;
    const adjustedEbit = reportedEbit + currentRnd - currentAmortization;
    const taxRate = 0.21;
    const adjustedNOPAT = adjustedEbit * (1 - taxRate);

    // Adjusted Invested Capital = Net PPE + Working Capital + Capitalized R&D Asset
    const baselineInvestedCap = Math.max(1, (latest.equity || 0) + (latest.totalDebt || 0) - (latest.cash || 0));
    const adjustedInvestedCap = baselineInvestedCap + totalRndAsset;

    const reportedROIC = roundVal(((reportedEbit * (1 - taxRate)) / baselineInvestedCap) * 100, 2);
    const adjustedROIC = roundVal((adjustedNOPAT / adjustedInvestedCap) * 100, 2);

    return {
      hasRndExpense: true,
      amortizationLifespanYears: n,
      currentYearRndExpense: roundVal(currentRnd),
      capitalizedRndAssetValue: roundVal(totalRndAsset),
      currentYearRndAmortization: roundVal(currentAmortization),
      reportedOperatingIncome: roundVal(reportedEbit),
      adjustedOperatingIncome: roundVal(adjustedEbit),
      reportedROIC,
      adjustedROIC,
      adjustedInvestedCapital: roundVal(adjustedInvestedCap),
      damodaranInsight: adjustedROIC > reportedROIC
        ? 'R&D capitalization reveals higher true underlying operating profitability than reported GAAP.'
        : 'R&D capitalization indicates heavy reinvestment requirement, moderating reported ROIC.'
    };
  }
}
