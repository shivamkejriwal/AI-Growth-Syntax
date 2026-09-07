/**
 * compositeInvestor.js
 * Master Composite Investment Research Engine.
 * 
 * Orchestrates:
 * 1. Alpha Vantage Fundamentals Engine (Pillars 1 & 3 & 4)
 * 2. SEC EDGAR Regulatory & XBRL Engine (Pillars 2 & 4)
 * 3. FRED Macroeconomic Benchmark Engine (Pillar 4 & Macro Regime)
 * 
 * Synthesizes research into the 4-Pillar Composite Framework:
 * - Peter Lynch: 6 Categories, PEG, Inventory Red Flags, Net Cash
 * - Philip Fisher: 360-degree Scuttlebutt, 10-K Footnotes, DEF 14A Executive Alignment, Form 4 Insiders
 * - Warren Buffett: Owner Earnings, Moat ROIC (> 15%), $1 Retained Earnings Test, Solvency
 * - Aswath Damodaran: R&D Capitalization, Operating Lease Debt, FRED Rf Benchmark, DCF Parameters
 * 
 * Generates an immutable Investment Decision Memorandum conforming to Composite_Investment_Approach.md.
 */

import { AlphaVantageClient, roundVal } from './alphaVantageClient.js';
import { EdgarClient } from './edgarClient.js';
import { FredClient } from './fredClient.js';
import { ScuttlebuttClient } from './scuttlebuttClient.js';
import { DamodaranClient } from './damodaranClient.js';
import { PerplexityClient } from './perplexityClient.js';
import { GeminiClient } from './geminiClient.js';
import { NasdaqClient } from './nasdaqClient.js';
import { ExaClient } from './exaClient.js';
import { DuckDuckGoClient } from './duckduckgoClient.js';
import { CompetitorEngine } from './competitorEngine.js';
import { FoddaClient } from './foddaClient.js';
import { SeekingAlphaClient } from './seekingAlphaClient.js';
import { defaultTieredStore } from './tieredStore.js';
import { buildStandardCompanyData } from './companyDataBuilder.js';
import { ExpertInferenceEngine } from './expertInferenceEngine.js';
import { getDemoFinancials, DEMO_DATASETS, DEMO_SECTOR_PERFORMANCE, DEMO_SPDR_SECTOR_ETFS, DEMO_INDUSTRY_PERFORMANCE } from './demoData.js';

export function formatCurrency(num) {
  if (typeof num !== 'number' || Number.isNaN(num)) return '$0.00';
  const abs = Math.abs(num);
  if (abs >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

export function getLynchStrategy(category) {

  switch (category) {
    case 'Fast Grower':
      return '20%+ annual earnings growth. Centerpiece of high-growth value portfolios. Look for low leverage and long expansion runways before market saturation.';
    case 'Stalwart':
      return '10% to 19% steady annual earnings growth. Dependable multibillion-dollar blue chips offering recession resilience and 30-50% gains on cyclical dips.';
    case 'Slow Grower':
      return '1% to 7% annual growth, mature cash-generative utilities or legacy staples with generous dividends. Hold primarily for yield.';
    case 'Cyclical':
      return 'Profits rise and fall predictably with macroeconomic cycles (semiconductors, autos, industrials). Buy near trough P/E disconnections.';
    case 'Turnaround':
      return 'Depressed franchise executing restructuring with sufficient liquidity to avoid insolvency.';
    case 'Asset Play':
      return 'Substantial unappreciated real estate, patents, cash cushion, or balance sheet holdings exceeding market capitalization.';
    default:
      return 'Analyze cash flows, competitive edge, and unit economics relative to valuation.';
  }
}

export function calculateEquityVisuals(financials, macroSnapshot = {}, companyWaccData = {}, lynchAnalysis = {}, buffettOwnerEarnings = {}, buffettRetainedTest = {}, damodaranAdjustments = {}) {
  const currentPrice = financials.currentPrice || 100.0;
  const sharesOut = financials.sharesOutstanding || 1e9;
  const lat = financials.latest || financials.yearsMap?.[financials.latestYear] || {};
  const wacc = Math.max(0.06, (companyWaccData?.waccPercent || 8.5) / 100);
  const rf = (macroSnapshot?.riskFreeRatePercent || 4.25) / 100;
  const terminalGrowth = Math.min(0.03, Math.max(0.015, rf * 0.65));

  // 1. Share Price vs DCF Fair Value calculation (2-stage DCF)
  const latestFCF = Math.max(1e6, financials.latest?.fcf || buffettOwnerEarnings?.latestOwnerEarnings || (financials.latest?.operatingCashflow ? financials.latest.operatingCashflow * 0.75 : 0) || (financials.latest?.netIncome || 1e8));
  const historicalCAGR = (lynchAnalysis?.revenueCAGR || 10) / 100;
  const growthRate = Math.min(0.25, Math.max(0.04, historicalCAGR));

  let pvFCF = 0;
  let runningFCF = latestFCF;
  for (let yr = 1; yr <= 5; yr++) {
    runningFCF *= (1 + growthRate * Math.pow(0.95, yr - 1));
    pvFCF += runningFCF / Math.pow(1 + wacc, yr);
  }
  const terminalValue = (runningFCF * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, 5);
  const enterpriseValue = pvFCF + pvTerminalValue;
  const netDebt = (financials.latest?.totalDebt || 0) - (financials.latest?.cash || 0);
  const equityValue = Math.max(1e6, enterpriseValue - netDebt);
  const rawFairValue = sharesOut > 0 ? equityValue / sharesOut : currentPrice;
  const fairValue = roundVal(rawFairValue, 2);

  const diffPct = fairValue > 0 ? roundVal(((currentPrice - fairValue) / fairValue) * 100, 1) : 0;
  const undervaluedThreshold = roundVal(fairValue * 0.80, 2);
  const overvaluedThreshold = roundVal(fairValue * 1.20, 2);

  let valuationStatus = 'Fairly Valued';
  let statusColor = 'text-amber-500';
  if (currentPrice < undervaluedThreshold) {
    valuationStatus = 'Undervalued';
    statusColor = 'text-emerald-500';
  } else if (currentPrice > overvaluedThreshold) {
    valuationStatus = 'Overvalued';
    statusColor = 'text-red-500';
  }

  const sharePriceVsFairValue = {
    currentPrice: roundVal(currentPrice, 2),
    fairValue,
    diffPercent: diffPct,
    status: valuationStatus,
    statusColor,
    undervaluedThreshold,
    overvaluedThreshold,
    currencySymbol: '$',
    waccPercent: roundVal(wacc * 100, 2),
    terminalGrowthPercent: roundVal(terminalGrowth * 100, 2)
  };

  // 2. Overview Snowflake / Radar Scorecard (5 dimensions, 1 to 10 scale)
  let healthScore = 5;
  const de = financials.debtToEquity ?? (financials.latest?.equity > 0 ? (financials.latest.totalDebt || 0) / financials.latest.equity : 0.5);
  if (de < 0.3) healthScore += 3;
  else if (de < 0.6) healthScore += 2;
  else if (de > 1.5) healthScore -= 2;

  const cr = financials.currentRatio || 1.5;
  if (cr >= 2.0) healthScore += 2;
  else if (cr < 1.0) healthScore -= 2;
  healthScore = Math.max(1, Math.min(10, healthScore));

  let valueScore = 5;
  const peg = lynchAnalysis?.pegRatio || financials.pegRatio || 1.8;
  if (peg > 0 && peg <= 1.0) valueScore += 3;
  else if (peg <= 1.5) valueScore += 2;
  else if (peg > 2.5) valueScore -= 2;
  if (diffPct < -20) valueScore += 2;
  else if (diffPct > 20) valueScore -= 2;
  valueScore = Math.max(1, Math.min(10, valueScore));

  let perfScore = 5;
  const roic = buffettOwnerEarnings?.averageROIC || 15;
  if (roic >= 25) perfScore += 3;
  else if (roic >= 15) perfScore += 2;
  else if (roic < 8) perfScore -= 2;
  if (historicalCAGR >= 0.15) perfScore += 2;
  else if (historicalCAGR < 0.03) perfScore -= 2;
  perfScore = Math.max(1, Math.min(10, perfScore));

  let divScore = 4;
  const divYield = financials.dividendYield || 0;
  const payout = financials.payoutRatio || 0.2;
  if (divYield > 0.03) divScore += 3;
  else if (divYield > 0.01) divScore += 2;
  else if (divYield === 0) divScore = 3;
  if (payout > 0 && payout <= 0.6) divScore += 2;
  else if (payout > 0.9) divScore -= 2;
  divScore = Math.max(1, Math.min(10, divScore));

  let mgmtScore = 5;
  if (buffettRetainedTest?.passedBuffettTest) mgmtScore += 3;
  if (buffettOwnerEarnings?.latestOwnerEarnings > 0) mgmtScore += 2;
  mgmtScore = Math.max(1, Math.min(10, mgmtScore));
  const totalScore = healthScore + valueScore + perfScore + divScore + mgmtScore;
  const dimensions = [
    { name: 'Health', value: healthScore, color: '#10b981', desc: `D/E: ${roundVal(de, 2)}x, Current Ratio: ${roundVal(cr, 2)}` },
    { name: 'Value', value: valueScore, color: '#3887fe', desc: `PEG: ${roundVal(peg, 2)}, DCF: ${diffPct >= 0 ? '+' : ''}${diffPct}%` },
    { name: 'Performance', value: perfScore, color: '#8b5cf6', desc: `Avg ROIC: ${roundVal(roic, 1)}%, Rev CAGR: ${roundVal(historicalCAGR * 100, 1)}%` },
    { name: 'Dividend', value: divScore, color: '#ec4899', desc: `Yield: ${(divYield * 100).toFixed(2)}%, Payout: ${(payout * 100).toFixed(1)}%` },
    { name: 'Management', value: mgmtScore, color: '#f59e0b', desc: `Retained Value: ${buffettRetainedTest?.valueCreatedPerDollarRetained || 1.0}x` }
  ];
  const snowflakeScores = {
    totalScore,
    averageScore: roundVal(totalScore / 5, 1),
    maxScore: 10,
    dimensions
  };

  // 3. Revenue & Expenses Flow (Sankey / Waterfall) - Multi-Year Support
  function buildSankeyFlowForRow(row, yr) {
    const rev = Math.max(1, row.revenue || (financials.marketCap ? financials.marketCap * 0.20 : 100000000));
    const gp = row.grossProfit !== undefined ? row.grossProfit : (row.cogs !== undefined ? Math.max(0, rev - row.cogs) : rev * 0.50);
    const cogs = row.cogs !== undefined ? row.cogs : Math.max(0, rev - gp);
    const rnd = row.rnd || 0;
    const opInc = row.operatingIncome !== undefined ? row.operatingIncome : rev * 0.20;
    const opexTotal = Math.max(0, gp - opInc);
    const sga = Math.max(0, opexTotal - rnd);
    const netInc = row.netIncome !== undefined ? row.netIncome : rev * 0.15;
    const taxesNonOp = Math.max(0, opInc - netInc);

    const nodes = [
      { id: 'Total Revenue', value: rev, color: '#3887FE', col: 0 },
      { id: 'Cost of Sales', value: cogs, color: '#B8860B', col: 1, isExpense: true },
      { id: 'Gross Profit', value: gp, color: '#6EE7B7', col: 1 }
    ];

    const links = [
      { source: 'Total Revenue', target: 'Cost of Sales', value: cogs, color: '#B8860B' },
      { source: 'Total Revenue', target: 'Gross Profit', value: gp, color: '#6EE7B7' }
    ];

    if (rnd > 0) {
      nodes.push({ id: 'Research & Dev', value: rnd, color: '#A78BFA', col: 2, isExpense: true });
      links.push({ source: 'Gross Profit', target: 'Research & Dev', value: rnd, color: '#A78BFA' });
    }

    const sgaLabel = rnd > 0 ? 'SG&A Expenses' : 'Operating Expenses';
    nodes.push({ id: sgaLabel, value: sga, color: '#D2B48C', col: 2, isExpense: true });
    links.push({ source: 'Gross Profit', target: sgaLabel, value: sga, color: '#D2B48C' });

    nodes.push({ id: 'Operating Income', value: opInc, color: '#06B6D4', col: 2 });
    links.push({ source: 'Gross Profit', target: 'Operating Income', value: opInc, color: '#06B6D4' });

    if (taxesNonOp > 0) {
      nodes.push({ id: 'Taxes & Other', value: taxesNonOp, color: '#94A3B8', col: 3, isExpense: true });
      links.push({ source: 'Operating Income', target: 'Taxes & Other', value: taxesNonOp, color: '#94A3B8' });
    }

    const netColor = netInc >= 0 ? '#34D399' : '#EF4444';
    nodes.push({ id: 'Net Earnings', value: Math.max(1, netInc), color: netColor, col: 3 });
    links.push({ source: 'Operating Income', target: 'Net Earnings', value: Math.max(1, netInc), color: netColor });

    return {
      year: yr,
      totalRevenue: rev,
      costOfSales: cogs,
      grossProfit: gp,
      rnd,
      sga,
      operatingExpenses: opexTotal,
      operatingIncome: opInc,
      taxesAndOther: taxesNonOp,
      netEarnings: netInc,
      nodes,
      links
    };
  }

  const sortedYears = (financials.sortedYears || []).slice();
  const byYear = {};
  sortedYears.forEach(yr => {
    const row = financials.yearsMap?.[yr] || {};
    byYear[yr] = buildSankeyFlowForRow(row, yr);
  });

  const latestYear = financials.latestYear || (sortedYears.length > 0 ? sortedYears[sortedYears.length - 1] : 'Latest');
  const latestFlow = byYear[latestYear] || buildSankeyFlowForRow(financials.latest || {}, latestYear);
  if (!byYear[latestYear]) {
    byYear[latestYear] = latestFlow;
  }
  if (!sortedYears.includes(latestYear) && latestYear !== 'Latest') {
    sortedYears.push(latestYear);
  }

  const revenueExpensesFlow = {
    ...latestFlow,
    selectedYear: latestYear,
    availableYears: sortedYears.length > 0 ? sortedYears : [latestYear],
    byYear
  };

  // 4. Financial Health Line Chart (Debt, Equity, Cash)
  const financialHealth = (financials.sortedYears || []).map(yr => {
    const row = financials.yearsMap?.[yr] || {};
    return {
      year: yr,
      debt: roundVal((row.totalDebt || 0) / 1e9, 2),
      equity: roundVal((row.equity || 0) / 1e9, 2),
      cash: roundVal((row.cash || 0) / 1e9, 2)
    };
  });

  // 5. Earnings Trend (Revenue vs Net Income)
  const earningsTrend = (financials.sortedYears || []).map(yr => {
    const row = financials.yearsMap?.[yr] || {};
    return {
      year: yr,
      period: yr,
      revenue: roundVal((row.revenue || 0) / 1e9, 2),
      operatingIncome: roundVal((row.operatingIncome || 0) / 1e9, 2),
      netIncome: roundVal((row.netIncome || 0) / 1e9, 2)
    };
  });

  // 6. Management Capital Allocation (R&D, Capex, M&A)
  const managementAllocation = (financials.sortedYears || []).map(yr => {
    const row = financials.yearsMap?.[yr] || {};
    const rndVal = row.rnd || 0;
    const capexVal = row.capex || (row.operatingCashflow ? row.operatingCashflow * 0.25 : 0);
    const acqVal = row.acquisitions || (row.ncfi ? Math.max(0, Math.abs(row.ncfi) - capexVal) : (capexVal * 0.15));
    return {
      year: yr,
      research: roundVal(rndVal / 1e9, 2),
      production: roundVal(capexVal / 1e9, 2),
      acquisitions: roundVal(acqVal / 1e9, 2)
    };
  });

  // 7. Dividend Analysis & Metrics
  const dividendChartData = (financials.sortedYears || []).map(yr => {
    const row = financials.yearsMap?.[yr] || {};
    const dps = sharesOut > 0 && row.dividendsPaid ? roundVal(row.dividendsPaid / sharesOut, 2) : roundVal((financials.dividendYield || 0) * currentPrice, 2);
    return { year: yr, dps };
  });

  const dividendMetrics = [
    { label: 'Dividend Yield', value: `${((divYield || 0) * 100).toFixed(2)}%`, isPercentage: true },
    { label: 'Payout Ratio', value: `${((payout || 0.2) * 100).toFixed(1)}%`, isPercentage: true },
    { label: 'FCF Coverage', value: (lat.fcf || 0) > 0 ? 'Comfortably Covered' : 'Moderate', isPercentage: false },
    { label: 'Safety Rating', value: (payout < 0.6 && de < 1.0) ? 'Tier 1 (Safe)' : 'Tier 2 (Monitored)', isPercentage: false },
    { label: 'DPS (Latest Annual)', value: `$${dividendChartData[dividendChartData.length - 1]?.dps || 0.00}`, isPercentage: false }
  ];

  return {
    snowflakeScores,
    sharePriceVsFairValue,
    revenueExpensesFlow,
    financialHealth,
    earningsTrend,
    managementAllocation,
    dividendChartData,
    dividendMetrics
  };
}

export class CompositeInvestor {

  constructor(options = {}) {
    this.store = options.store || defaultTieredStore;
    this.alphaVantage = new AlphaVantageClient(options.alphaVantage);
    this.edgar = new EdgarClient(options.edgar);
    this.fred = new FredClient(options.fred);
    this.scuttlebutt = new ScuttlebuttClient(options.scuttlebutt);
    this.damodaran = new DamodaranClient(options.damodaran);
    this.perplexity = new PerplexityClient(options.perplexity);
    this.gemini = new GeminiClient(options.gemini);
    this.nasdaq = new NasdaqClient(options.nasdaq);
    this.exa = new ExaClient(options.exa);
    this.duckduckgo = new DuckDuckGoClient(options.duckduckgo);
    this.competitors = new CompetitorEngine(options.competitors);
    this.fodda = new FoddaClient(options.fodda);
    this.seekingAlpha = new SeekingAlphaClient(options.seekingAlpha);
  }

  /**
   * Retrieves the Standardized, Objective Company Financial Profile (Pure Data, zero expert opinions).
   * Follows the Cache-First -> DB-First -> Live Source Pull pipeline.
   * Stored under:
   * - Namespace: 'companies'
   * - Key: 'COMPANY_' + ticker
   * 
   * @param {string} ticker
   * @param {Object} [options]
   * @param {boolean} [options.forceRefresh=false]
   * @returns {Promise<Object>} StandardCompanyData
   */
  async getStandardCompanyData(ticker, options = {}) {
    const sym = (ticker || '').toUpperCase().trim();
    if (!sym) throw new Error('Ticker is required to retrieve company data');

    // If offlineData provided, build directly without store
    if (options.offlineData || (options.mode === 'demo' && !options.persistDemo)) {
      return this.buildStandardCompanyData(sym, options);
    }

    const cacheKey = `COMPANY_${sym}`;
    const namespace = 'companies';

    const result = await this.store.retrieveOrFetch({
      key: cacheKey,
      namespace,
      forceRefresh: options.forceRefresh || false,
      fetcher: async () => {
        return this.buildStandardCompanyData(sym, options);
      }
    });

    return {
      ...result.data,
      _storageMetadata: {
        retrievalSource: result.source,
        isStale: result.isStale,
        retrievedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Builds the objective, standardized company financial profile from raw API sources.
   * ZERO expert inferences are calculated here.
   */
  async buildStandardCompanyData(ticker, options = {}) {
    const sym = (ticker || '').toUpperCase().trim();

    // 1. Ingest Alpha Vantage / Yahoo Finance normalized financials
    let financials;
    if (options.offlineData) {
      financials = options.offlineData;
    } else if (options.mode === 'demo' && DEMO_DATASETS[sym]) {
      financials = getDemoFinancials(sym);
    } else {
      financials = await this.alphaVantage.extractNormalizedFinancials(sym);
      if ((!financials || !financials.sortedYears || financials.sortedYears.length < 2) && DEMO_DATASETS[sym]) {
        financials = getDemoFinancials(sym);
      }
    }

    if (!financials) {
      const [ov, currentPrice] = await Promise.all([
        this.alphaVantage.getOverview(sym).catch(() => ({})),
        this.alphaVantage.getLatestPrice(sym).catch(() => 0)
      ]);
      const price = currentPrice || ov?.CurrentPrice || 100.0;
      const shares = ov?.SharesOutstanding || 100000000;
      const mcap = ov?.MarketCapitalization || (price * shares);
      const yr = new Date().getFullYear();
      const prevYr = String(yr - 1);
      const prev2Yr = String(yr - 2);

      financials = {
        symbol: sym,
        name: ov?.Name || ov?.name || sym,
        sector: ov?.Sector || ov?.sector || 'General',
        industry: ov?.Industry || ov?.industry || 'General',
        description: ov?.Description || '',
        currentPrice: price,
        sharesOutstanding: shares,
        peRatio: ov?.PERatio || 20.0,
        pegRatio: ov?.PEGRatio || 1.5,
        dividendYield: ov?.DividendYield || 0.0,
        beta: ov?.Beta || 1.0,
        marketCap: mcap,
        sortedYears: [prev2Yr, prevYr],
        yearsMap: {
          [prev2Yr]: { revenue: mcap * 0.20, grossProfit: mcap * 0.10, operatingIncome: mcap * 0.04, netIncome: mcap * 0.03, cash: mcap * 0.05, totalDebt: mcap * 0.02, equity: mcap * 0.20, workingCapital: mcap * 0.05, retainedEarnings: mcap * 0.10, operatingCashflow: mcap * 0.04, capex: mcap * 0.01, fcf: mcap * 0.03 },
          [prevYr]: { revenue: mcap * 0.22, grossProfit: mcap * 0.11, operatingIncome: mcap * 0.045, netIncome: mcap * 0.035, cash: mcap * 0.06, totalDebt: mcap * 0.02, equity: mcap * 0.23, workingCapital: mcap * 0.06, retainedEarnings: mcap * 0.12, operatingCashflow: mcap * 0.045, capex: mcap * 0.012, fcf: mcap * 0.033 }
        },
        latestYear: prevYr,
        latest: { revenue: mcap * 0.22, grossProfit: mcap * 0.11, operatingIncome: mcap * 0.045, netIncome: mcap * 0.035, cash: mcap * 0.06, totalDebt: mcap * 0.02, equity: mcap * 0.23, workingCapital: mcap * 0.06, retainedEarnings: mcap * 0.12, operatingCashflow: mcap * 0.045, capex: mcap * 0.012, fcf: mcap * 0.033 },
        currentRatio: ov?.CurrentRatio || 1.5,
        debtToEquity: ov?.DebtToEquity || 0.4,
        payoutRatio: 0.15,
        dataSource: 'Estimated Baseline',
        isLive: false
      };
    }

    // 2. Ingest SEC Regulatory Filings & XBRL Facts
    const [edgarFilings, leaseFacts] = await Promise.all([
      this.edgar.getForensicFilings(sym).catch(err => ({ error: err.message })),
      this.edgar.getLeaseCommitments(sym).catch(err => ({ error: err.message }))
    ]);

    // 3. Ingest FRED Macro Benchmarks
    const macroSnapshot = await this.fred.getMacroSnapshot().catch(() => ({
      riskFreeRatePercent: 4.25,
      effectiveFedFundsRate: 5.33,
      yoyCPIInflationPercent: 2.7,
      bbbCorporateCreditSpreadPercent: 1.18,
      yieldCurve10Y2YSpreadPercent: 0.15,
      yieldCurveRegime: 'Normal'
    }));

    // 4. Ingest Scuttlebutt & Competitors
    const [competitorAnalysis, seekingAlphaFeed, ddgAudit] = await Promise.all([
      this.competitors.getCompetitorAnalysis(sym, financials.name || sym).catch(() => null),
      this.seekingAlpha.getTickerFeed(sym, 10).catch(() => null),
      this.duckduckgo.conductScuttlebuttAudit(financials.name || sym, sym).catch(() => null)
    ]);

    const scuttlebuttData = {
      seekingAlpha: seekingAlphaFeed,
      duckduckgo: ddgAudit
    };

    return buildStandardCompanyData({
      ticker: sym,
      financials,
      edgarFilings,
      leaseFacts,
      macroSnapshot,
      competitorAnalysis,
      scuttlebuttData
    });
  }

  /**
   * High-Performance Retrieval: Fetches the Complete Research Dossier.
   * 1. Retrieves the Standardized Company Data from TieredStore (Cache/DB/Source).
   * 2. Executes pure, stateless ExpertInferenceEngine on top of the factual data.
   * 
   * @param {string} ticker
   * @param {Object} [options]
   * @param {boolean} [options.forceRefresh=false]
   * @returns {Promise<Object>} Unified Research Dossier
   */
  async getCompositeDossier(ticker, options = {}) {
    const sym = (ticker || '').toUpperCase().trim();
    if (!sym) throw new Error('Ticker is required to retrieve company dossier');

    // 1. Retrieve objective, standardized company facts & statements
    const companyData = await this.getStandardCompanyData(sym, options);

    // 2. Run Pure Expert Inference Engine on top of standardized data
    const inference = ExpertInferenceEngine.runAll(companyData, options);

    // 3. Synthesize into composite research dossier
    return {
      _meta: companyData._meta,
      companyData,
      metadata: {
        symbol: sym,
        companyName: companyData.profile?.name || sym,
        sector: companyData.profile?.sector || 'General',
        industry: companyData.profile?.industry || 'General',
        analysisDate: companyData._meta?.asOfDate,
        currentPrice: companyData.market?.currentPrice || 0,
        marketCap: companyData.market?.marketCap || 0,
        sharesOutstanding: companyData.market?.sharesOutstanding || 0,
        peRatio: companyData.market?.peRatio || 0,
        pegRatio: companyData.market?.pegRatio || inference.experts?.peterLynch?.pegRatio || 0,
        dividendYield: (companyData.market?.dividendYieldPercent || 0) / 100,
        beta: companyData.market?.beta || 1.0,
        dataSource: 'StandardCompanyData (Tiered Cache/DB)',
        isLive: true
      },
      macroContext: companyData.macroEnvironment,
      experts: inference.experts,
      synthesis: inference.synthesis,
      // Backward-compatible aliases for existing dashboards and tests
      pillar1_Lynch: inference.pillar1_Lynch,
      pillar2_Fisher: inference.pillar2_Fisher,
      pillar3_Buffett: inference.pillar3_Buffett,
      pillar4_Damodaran: inference.pillar4_Damodaran,
      decisionMemo: inference.decisionMemo,
      _storageMetadata: companyData._storageMetadata
    };
  }

  /**
   * Generates a complete 4-Pillar Composite Research Dossier for a target company.
   * @param {string} ticker
   * @param {Object} [options]
   * @param {number} [options.rndYears=3]
   * @param {Object} [options.offlineData] Optional mock data for offline testing
   */
  async generateCompositeDossier(ticker, options = {}) {
    const sym = ticker.toUpperCase().trim();
    const rndYears = options.rndYears || 3;

    // 1. Ingest Alpha Vantage Fundamentals
    let financials;
    if (options.offlineData) {
      financials = options.offlineData;
    } else if (options.mode === 'demo' && DEMO_DATASETS[sym]) {
      financials = getDemoFinancials(sym);
    } else {
      financials = await this.alphaVantage.extractNormalizedFinancials(sym);
      // If live fetching returned insufficient history and a demo fallback is available, use it
      if ((!financials || !financials.sortedYears || financials.sortedYears.length < 2) && DEMO_DATASETS[sym]) {
        financials = getDemoFinancials(sym);
      }
    }

    // Safety guard: If financials is still null (e.g. fund, ETF, or unlisted entity), construct a valid baseline object
    if (!financials) {
      const [ov, currentPrice] = await Promise.all([
        this.alphaVantage.getOverview(sym).catch(() => ({})),
        this.alphaVantage.getLatestPrice(sym).catch(() => 0)
      ]);
      const price = currentPrice || ov?.CurrentPrice || 100.0;
      const shares = ov?.SharesOutstanding || 100000000;
      const mcap = ov?.MarketCapitalization || (price * shares);
      const yr = new Date().getFullYear();
      const prevYr = String(yr - 1);
      const prev2Yr = String(yr - 2);

      financials = {
        symbol: sym,
        name: ov?.Name || ov?.name || sym,
        sector: ov?.Sector || ov?.sector || 'General',
        industry: ov?.Industry || ov?.industry || 'General',
        description: ov?.Description || '',
        currentPrice: price,
        sharesOutstanding: shares,
        peRatio: ov?.PERatio || 20.0,
        pegRatio: ov?.PEGRatio || 1.5,
        dividendYield: ov?.DividendYield || 0.0,
        beta: ov?.Beta || 1.0,
        marketCap: mcap,
        sortedYears: [prev2Yr, prevYr],
        yearsMap: {
          [prev2Yr]: {
            revenue: mcap * 0.20,
            grossProfit: mcap * 0.10,
            operatingIncome: mcap * 0.04,
            netIncome: mcap * 0.03,
            cash: mcap * 0.05,
            totalDebt: mcap * 0.02,
            equity: mcap * 0.20,
            workingCapital: mcap * 0.05,
            retainedEarnings: mcap * 0.10,
            operatingCashflow: mcap * 0.04,
            capex: mcap * 0.01,
            fcf: mcap * 0.03
          },
          [prevYr]: {
            revenue: mcap * 0.22,
            grossProfit: mcap * 0.11,
            operatingIncome: mcap * 0.045,
            netIncome: mcap * 0.035,
            cash: mcap * 0.06,
            totalDebt: mcap * 0.02,
            equity: mcap * 0.23,
            workingCapital: mcap * 0.06,
            retainedEarnings: mcap * 0.12,
            operatingCashflow: mcap * 0.045,
            capex: mcap * 0.012,
            fcf: mcap * 0.033
          }
        },
        latestYear: prevYr,
        latest: {
          revenue: mcap * 0.22,
          grossProfit: mcap * 0.11,
          operatingIncome: mcap * 0.045,
          netIncome: mcap * 0.035,
          cash: mcap * 0.06,
          totalDebt: mcap * 0.02,
          equity: mcap * 0.23,
          workingCapital: mcap * 0.06,
          retainedEarnings: mcap * 0.12,
          operatingCashflow: mcap * 0.045,
          capex: mcap * 0.012,
          fcf: mcap * 0.033
        },
        currentRatio: ov?.CurrentRatio || 1.5,
        debtToEquity: ov?.DebtToEquity || 0.4,
        payoutRatio: 0.15,
        dataSource: 'Estimated Baseline (Statements Limited)',
        isLive: false
      };
    }

    // 2. Ingest SEC Regulatory Filings & XBRL Facts
    const [edgarFilings, leaseFacts] = await Promise.all([
      this.edgar.getForensicFilings(sym).catch(err => ({ error: err.message })),
      this.edgar.getLeaseCommitments(sym).catch(err => ({ error: err.message }))
    ]);

    // 3. Ingest FRED Macro Benchmarks
    const macroSnapshot = await this.fred.getMacroSnapshot().catch(() => ({
      riskFreeRatePercent: 4.25,
      effectiveFedFundsRate: 5.33,
      yoyCPIInflationPercent: 2.7,
      bbbCorporateCreditSpreadPercent: 1.18,
      yieldCurve10Y2YSpreadPercent: 0.15,
      yieldCurveRegime: 'Normal'
    }));

    // 4. Ingest Scuttlebutt Qualitative Channels (Philip Fisher)
    const includeScuttlebutt = options.includeScuttlebutt !== false;
    let scuttlebuttData = {
      github: null,
      hackerNews: null,
      reddit: null,
      supplyChain: null,
      fiveCirclesScript: null,
      fisher15Points: [],
      fodda: null
    };

    if (includeScuttlebutt) {
      const repoTarget = options.repo || this.scuttlebutt.getDefaultRepoForTicker(sym);
      const [ghStats, hnStats, redditStats, perplexityAudit, exaResults, duckduckgoAudit, foddaEarnings, foddaBrand, seekingAlphaFeed] = await Promise.all([
        repoTarget
          ? (typeof repoTarget === 'object'
              ? this.scuttlebutt.getGitHubRepoStats(repoTarget.owner, repoTarget.repo)
              : this.scuttlebutt.getGitHubRepoStats(...repoTarget.split('/')))
          : Promise.resolve(null),
        this.scuttlebutt.getHackerNewsSentiment(financials.name || sym, 5).catch(() => null),
        this.scuttlebutt.getRedditSentiment(sym, 'stocks', 5).catch(() => null),
        this.perplexity.conductScuttlebuttAudit(financials.name || sym, sym).catch(() => null),
        this.exa.search(`${financials.name || sym} supply chain customer churn`, 3).catch(() => []),
        this.duckduckgo.conductScuttlebuttAudit(financials.name || sym, sym).catch(() => null),
        this.fodda.getCompanyEarnings(sym).catch(() => null),
        this.fodda.getBrandTracker(financials.name || sym).catch(() => null),
        this.seekingAlpha.getTickerFeed(sym, 10).catch(() => null)
      ]);

      const supplyChain = this.scuttlebutt.getSupplyChainRecon(financials.name || sym);
      const fiveCirclesScript = this.scuttlebutt.generate5CirclesScript(sym, financials.name || sym, financials.sector);
      const qualitativeSummary = {
        github: ghStats,
        engineerSentimentVerdict: hnStats?.engineerSentimentVerdict,
        crowdSentimentVerdict: redditStats?.crowdSentimentVerdict,
        perplexityAudit,
        duckduckgoAudit
      };
      const fisher15Points = this.scuttlebutt.evaluateFisher15Points(sym, financials, qualitativeSummary);

      scuttlebuttData = {
        github: ghStats,
        hackerNews: hnStats,
        reddit: redditStats,
        perplexity: perplexityAudit,
        exa: exaResults,
        duckduckgo: duckduckgoAudit,
        seekingAlpha: seekingAlphaFeed,
        supplyChain,
        fiveCirclesScript,
        fisher15Points,
        fodda: {
          earnings: foddaEarnings,
          brand: foddaBrand
        }
      };
    }


    // 5. Damodaran Portal Benchmarks & Cost of Capital
    const sectorBenchmark = this.damodaran.getIndustryBenchmarks(financials.sector || financials.industry);
    const effectiveRndYears = options.rndYears || sectorBenchmark.rndAmortizationYears || 3;

    const [impliedErpData, companyWaccData, competitorAnalysis] = await Promise.all([
      this.damodaran.getImpliedERP(),
      this.damodaran.calculateCostOfCapital(financials, macroSnapshot.riskFreeRatePercent),
      this.competitors.getCompetitorAnalysis(sym, financials.name || sym).catch(() => null)
    ]);

    // 6. Compute Methodology Pillars
    const lynchAnalysis = this.alphaVantage.calculateLynchMetrics(financials);
    const buffettOwnerEarnings = this.alphaVantage.calculateBuffettOwnerEarnings(financials);
    const buffettRetainedTest = this.alphaVantage.calculateBuffettRetainedEarningsTest(financials);
    const damodaranAdjustments = this.alphaVantage.calculateDamodaranAdjustments(financials, { rndYears: effectiveRndYears });

    // Combine lease liability into Damodaran adjustments if available
    if (leaseFacts?.totalLeaseDebt > 0) {
      damodaranAdjustments.operatingLeaseDebtXBRL = leaseFacts.totalLeaseDebt;
      damodaranAdjustments.leaseAdjustedTotalDebt = (financials.latest?.totalDebt || 0) + leaseFacts.totalLeaseDebt;
    }

    const threePs = this.damodaran.evaluate3Ps(sym, options.thesisNarrative, {
      revenueCAGR: `${lynchAnalysis.revenueCAGR}%`,
      roic: `${buffettOwnerEarnings.averageROIC}%`
    });

    // P/E Ratio: Use report figure or compute from price / EPS
    let calculatedPe = financials.peRatio;
    if ((!calculatedPe || calculatedPe <= 0) && financials.currentPrice > 0 && financials.sharesOutstanding > 0 && (financials.latest?.netIncome || 0) > 0) {
      const eps = financials.latest.netIncome / financials.sharesOutstanding;
      if (eps > 0) {
        calculatedPe = roundVal(financials.currentPrice / eps, 2);
      }
    }

    // Compute Equity Visualizations & Visual Breakdown Scorecard
    const equityVisuals = calculateEquityVisuals(
      financials,
      macroSnapshot,
      companyWaccData,
      lynchAnalysis,
      buffettOwnerEarnings,
      buffettRetainedTest,
      damodaranAdjustments
    );

    const dossier = {
      metadata: {
        symbol: sym,
        companyName: financials.name || sym,
        sector: financials.sector || 'General',
        industry: financials.industry || 'General',
        analysisDate: new Date().toISOString().slice(0, 10),
        currentPrice: financials.currentPrice,
        marketCap: financials.marketCap,
        sharesOutstanding: financials.sharesOutstanding,
        peRatio: calculatedPe,
        pegRatio: financials.pegRatio || lynchAnalysis.pegRatio,
        dividendYield: financials.dividendYield,
        beta: financials.beta,
        dataSource: financials.source || (financials.isLive ? 'Live Market Feed' : 'Offline Baseline'),
        isLive: !!financials.isLive
      },
      macroContext: macroSnapshot,
      pillar1_Lynch: {

        title: 'Peter Lynch: Circle of Competence, Ground-Level Edge & Taxonomy',
        category: lynchAnalysis.category,
        strategyDescription: getLynchStrategy(lynchAnalysis.category),
        revenueCAGR: `${lynchAnalysis.revenueCAGR}%`,
        revenueCagrPercent: lynchAnalysis.revenueCAGR,
        pegRatio: lynchAnalysis.pegRatio,
        pegVerdict: lynchAnalysis.lynchPEGEvaluation,
        lynchPEGEvaluation: lynchAnalysis.lynchPEGEvaluation,
        inventorySalesSpreadPercent: `${lynchAnalysis.inventorySalesSpread}%`,
        inventoryGrowthAnalysis: {
          inventoryGrowthPercent: lynchAnalysis.inventoryGrowth ?? 0,
          salesGrowthPercent: lynchAnalysis.salesGrowth ?? 0,
          spreadPercent: lynchAnalysis.inventorySalesSpread ?? 0,
          flag: (lynchAnalysis.inventorySalesSpread > 5.0 && (financials.latest?.inventory || 0) > 0) ? 'RED FLAG' : 'Safe'
        },
        netCashPerShare: lynchAnalysis.netCashPerShare,
        netCashPerShareFormatted: `$${lynchAnalysis.netCashPerShare}`,
        redFlags: lynchAnalysis.flags,
        rulesOfThumb: [
          { rule: 'PEG Ratio < 1.0 (Fair at 1.0-1.5)', passing: lynchAnalysis.pegRatio > 0 && lynchAnalysis.pegRatio <= 1.5, details: `Current PEG: ${lynchAnalysis.pegRatio || 'N/A'} (${lynchAnalysis.lynchPEGEvaluation})` },
          { rule: 'Inventory Growth <= Sales Growth', passing: lynchAnalysis.inventorySalesSpread <= 5.0, details: `Inventory spread: ${lynchAnalysis.inventorySalesSpread > 0 ? '+' : ''}${lynchAnalysis.inventorySalesSpread}%` },
          { rule: 'Debt-to-Equity < 0.50x', passing: (financials.debtToEquity || 0) < 0.50, details: `Current D/E: ${financials.debtToEquity ? financials.debtToEquity.toFixed(2) + 'x' : 'N/A'}` },
          { rule: 'Net Cash Cushion', passing: lynchAnalysis.netCashPerShare > 0, details: `Net Cash/Share: $${lynchAnalysis.netCashPerShare}` }
        ],
        twoMinuteStoryPrompt: `Explain the core consumer or business value proposition of ${financials.name} in plain language under 2 minutes.`
      },
      pillar2_Fisher: {
        title: 'Philip Fisher: Aggressive Primary Scuttlebutt & Regulatory Audit',
        secFilings: edgarFilings.filings || {},
        companyCIK: edgarFilings.cik || 'N/A',
        executiveCompensationAudit: edgarFilings.filings?.latestDEF14A?.executiveCompensationAudit || [
          'Verify CEO bonuses are linked to ROIC rather than top-line revenue growth.',
          'Check insider stock ownership alignment in DEF 14A.'
        ],
        recentInsiderFilingsCount: (edgarFilings.filings?.recentForm4s || []).length,
        developerMoat: scuttlebuttData.github,
        engineeringSentiment: scuttlebuttData.hackerNews,
        customerAndCrowdSentiment: scuttlebuttData.reddit,
        crowdSentiment_Reddit: scuttlebuttData.reddit,
        perplexityScuttlebutt: scuttlebuttData.perplexity,
        exaIntel: scuttlebuttData.exa,
        duckduckgoIntel: scuttlebuttData.duckduckgo,
        foddaIntel: scuttlebuttData.fodda,
        seekingAlphaIntel: scuttlebuttData.seekingAlpha,
        supplyChainAudit: scuttlebuttData.supplyChain,
        fiveCirclesInterviewScript: scuttlebuttData.fiveCirclesScript,
        fisher15PointChecklist: scuttlebuttData.fisher15Points,
        scuttlebuttProtocol: {
          competitors: 'Who is winning the most new RFPs, and where is this company vulnerable?',
          customers: 'Why do you choose this vendor over alternatives? Would a 10% price hike cause you to switch?',
          suppliers: 'Are order volumes smooth or erratic? Does management negotiate with integrity?',
          exEmployees: 'Why did you leave? Is engineering promotion based on merit or internal politics?'
        }
      },

      pillar3_Buffett: {
        title: 'Warren Buffett: Economic Moats, Owner Earnings & Capital Discipline',
        ownerEarningsHistory: buffettOwnerEarnings.history,
        latestOwnerEarnings: buffettOwnerEarnings.latestOwnerEarnings,
        latestOwnerEarningsFormatted: formatCurrency(buffettOwnerEarnings.latestOwnerEarnings),
        averageROIC: `${buffettOwnerEarnings.averageROIC}%`,
        isHighMoatROIC: buffettOwnerEarnings.isHighMoatROIC,
        retainedEarningsTest: buffettRetainedTest,
        ownerEarningsAnalysis: {
          reportedNetIncome: financials.latest?.netIncome || 0,
          depreciationAndAmortization: Math.max((financials.latest?.operatingCashflow || 0) - (financials.latest?.fcf || 0), 0) || Math.round((financials.latest?.capex || 0) * 0.8),
          estimatedCapex: financials.latest?.capex || 0,
          buffettOwnerEarnings: buffettOwnerEarnings.latestOwnerEarnings || 0,
          freeCashFlow: financials.latest?.fcf || 0,
          ownerEarningsYieldPercent: financials.marketCap > 0 ? ((buffettOwnerEarnings.latestOwnerEarnings || 0) / financials.marketCap) * 100 : 0
        },
        historicalRoic: (buffettOwnerEarnings.history || []).map(h => ({
          year: h.year,
          roicPercent: h.roic,
          operatingMarginPercent: h.operatingMargin
        })),
        solvencyCushion: {
          cash: financials.latest?.cash || 0,
          totalDebt: financials.latest?.totalDebt || 0,
          debtToEquity: financials.debtToEquity || 0,
          currentRatio: financials.currentRatio || 1.0,
          yearsOfOwnerEarningsToRetireDebt: (buffettOwnerEarnings.latestOwnerEarnings || 0) > 0 ? roundVal((financials.latest?.totalDebt || 0) / buffettOwnerEarnings.latestOwnerEarnings, 2) : 0
        },
        financialResilience: {
          totalCash: formatCurrency(financials.latest?.cash || 0),
          totalDebt: formatCurrency(financials.latest?.totalDebt || 0),
          currentRatio: financials.currentRatio,
          debtToEquity: financials.debtToEquity,
          dividendPayoutRatio: financials.payoutRatio
        }
      },
      pillar4_Damodaran: {
        title: 'Aswath Damodaran: Modernized Value Analysis (Narrative to Numbers)',
        impliedERPPercent: impliedErpData.impliedERPPercent,
        industrySector: sectorBenchmark.sectorName,
        industryUnleveredBeta: sectorBenchmark.unleveredBeta,
        sectorBenchmarkWACCPercent: sectorBenchmark.waccPercent,
        companyCostOfCapital: companyWaccData,
        syntheticCreditRating: companyWaccData.syntheticRating || {
          syntheticRating: 'A',
          defaultSpreadPercent: 1.25,
          interestCoverageRatio: 12.0
        },
        rndAmortizationYears: effectiveRndYears,
        rndAdjustments: damodaranAdjustments,
        rndCapitalization: damodaranAdjustments,
        operatingLeaseDebt: leaseFacts?.totalLeaseDebt ? formatCurrency(leaseFacts.totalLeaseDebt) : 'N/A',
        damodaranOnlinePortal: {
          impliedERP: `${impliedErpData.impliedERPPercent}% (NYU Stern Forward-Looking ERP)`,
          sectorBenchmark: sectorBenchmark.sectorName,
          industryUnleveredBeta: sectorBenchmark.unleveredBeta,
          industryBenchmarkWACC: `${sectorBenchmark.waccPercent}%`,
          rndAmortizationLifespanApplied: `${effectiveRndYears} Years`
        },
        costOfCapital: companyWaccData,
        the3PsRealityFilter: threePs,
        threePsRealityFilter: threePs,
        macroBenchmarks: {
          riskFreeRateRf: `${macroSnapshot.riskFreeRatePercent}% (FRED DGS10 10-Yr Treasury)`,
          terminalGrowthCeiling: `${macroSnapshot.dcfValuationGuidance?.maxTerminalGrowthRateCap || '3.0%'}`,
          benchmarkCreditSpread: `+${macroSnapshot.bbbCorporateCreditSpreadPercent}% (ICE BofA BBB OAS)`,
          yieldCurveRegime: macroSnapshot.yieldCurveRegime,
          yoyInflation: `${macroSnapshot.yoyCPIInflationPercent}% (CPIAUCSL)`
        },
        dcfGuidance: {
          discountRateHurdle: `${companyWaccData.waccPercent}% (Damodaran Synthetic WACC)`,
          costOfEquity: `${companyWaccData.costOfEquityPercent}%`,
          costOfDebt: `${companyWaccData.preTaxCostOfDebtPercent}%`,
          terminalGrowthCap: macroSnapshot.dcfValuationGuidance?.maxTerminalGrowthRateCap || '3.0%'
        }
      },

      equityVisuals,
      competitorAnalysis,
      rawFinancials: financials
    };

    // 7. Executive Synthesis via Gemini AI
    if (this.gemini.isConfigured) {
      dossier.aiExecutiveSynthesis = await this.gemini.generateExecutiveSynthesis(dossier).catch(() => null);
    }

    return dossier;
  }

  /**
   * Generates a comprehensive Macro Economy Research Dossier.
   * Encapsulates all non-company macroeconomic variables:
   * - FRED interest rates, yield curve term structure, inflation, and credit spreads
   * - NYU Stern forward-looking Implied Equity Risk Premium (ERP)
   * - Cross-industry sector cost of capital & unlevered beta catalog
   * - Macro cycle assessment & positioning playbook
   */
  async generateMacroDossier() {
    const [macroSnapshot, erpData, marketMovers, spdrSectorETFs] = await Promise.all([
      this.fred.getMacroSnapshot().catch(() => ({
        asOfDate: new Date().toISOString().slice(0, 10),
        riskFreeRatePercent: 4.25,
        effectiveFedFundsRate: 5.33,
        yoyCPIInflationPercent: 2.7,
        bbbCorporateCreditSpreadPercent: 1.18,
        yieldCurve10Y2YSpreadPercent: 0.15,
        yieldCurveRegime: 'Normal Upward Sloping',
        unemploymentRatePercent: 4.1,
        nominalGDPLevelBillions: 28600.0,
        dcfValuationGuidance: {
          recommendedRiskFreeRate: '4.25%',
          maxTerminalGrowthRateCap: '3.0%',
          syntheticCostOfDebtSpread: '+1.18% over Rf',
          estimatedPreTaxCostOfDebt: '5.43%'
        }
      })),
      this.damodaran.getImpliedERP().catch(() => ({
        asOfDate: new Date().toISOString().slice(0, 10),
        impliedERPPercent: 4.60,
        tenYearAverageERP: 4.72,
        matureMarketBasePremium: 4.60,
        methodology: 'FCFE Cash Flow Implied Model'
      })),
      this.alphaVantage.getMarketMovers().catch(() => ({
        gainers: [],
        losers: [],
        active: [],
        advancers: 2242,
        decliners: 1856,
        unchanged: 142
      })),
      this.alphaVantage.getLiveSpdrSectorETFs().catch(() => DEMO_SPDR_SECTOR_ETFS)
    ]);

    const sectors = this.damodaran.getAllIndustryBenchmarks ? this.damodaran.getAllIndustryBenchmarks() : [];
    const ratingTiers = this.damodaran.getRatingTiers ? this.damodaran.getRatingTiers() : [];

    const rf = macroSnapshot.riskFreeRatePercent || 4.25;
    const erp = erpData.impliedERPPercent || 4.60;
    const expectedMarketReturn = Math.round((rf + erp) * 100) / 100;
    const ycSpread = macroSnapshot.yieldCurve10Y2YSpreadPercent ?? 0.15;

    let regimeSummary = '';
    let lynchAction = '';
    let buffettHurdle = `Baseline hurdle rate for equity investments is ${expectedMarketReturn}% (Rf ${rf}% + Implied ERP ${erp}%).`;

    if (ycSpread < 0) {
      regimeSummary = 'Inverted Yield Curve: Elevated recession risk. Short-term borrowing rates exceed long-term 10-year benchmark yields.';
      lynchAction = 'Avoid cyclical companies at peak earnings; favor recession-resilient Stalwarts and Fast Growers with conservative balance sheets.';
    } else if (ycSpread < 0.20) {
      regimeSummary = 'Flat Yield Curve: Transition phase between monetary tightening and rate stabilization.';
      lynchAction = 'Scrutinize inventory-to-sales spreads closely; prioritize companies with positive net cash per share.';
    } else {
      regimeSummary = 'Normal Upward Sloping Curve: Accommodative/expansionary term structure indicating healthy economic normalization.';
      lynchAction = 'Cyclicals can be evaluated near trough earnings multiples; Fast Growers benefit from predictable capital costs.';
    }

    const advancers = marketMovers.advancers || 2242;
    const decliners = marketMovers.decliners || 1856;
    const breadthTotal = advancers + decliners;
    const breadthRatio = breadthTotal > 0 ? Math.round((advancers / breadthTotal) * 1000) / 10 : 54.7;

    const sectorPerformance = Array.isArray(spdrSectorETFs) && spdrSectorETFs.length === 11
      ? spdrSectorETFs.map(etf => ({
          name: etf.name,
          change: etf.change,
          changeNum: etf.changeNum,
          changeType: etf.changeType,
          icon: etf.icon,
          isLive: etf.isLive ?? true
        }))
      : DEMO_SECTOR_PERFORMANCE;

    return {
      asOfDate: macroSnapshot.asOfDate || new Date().toISOString().slice(0, 10),
      overview: {
        globalMarketCap: { value: '$95.2 Trillion', change: '+0.8%', changeType: 'positive' },
        sp500: { value: '5,864.67', change: '+0.45%', changeType: 'positive' },
        nasdaq: { value: '20,530.12', change: '+0.72%', changeType: 'positive' },
        treasury10Y: { value: `${rf.toFixed(2)}%`, change: ycSpread >= 0 ? '+15 bps curve' : '-18 bps inverted', changeType: ycSpread >= 0 ? 'positive' : 'negative' },
        breadth: {
          advancers,
          decliners,
          ratio: breadthRatio,
          sentiment: breadthRatio >= 50 ? 'Bullish Breadth' : 'Bearish Breadth'
        }
      },
      marketMovers,
      sectorPerformance,
      spdrSectorETFs: spdrSectorETFs || DEMO_SPDR_SECTOR_ETFS,
      industryPerformance: DEMO_INDUSTRY_PERFORMANCE,
      fred: {
        riskFreeRate10Y: macroSnapshot.riskFreeRatePercent,
        effectiveFedFundsRate: macroSnapshot.effectiveFedFundsRate,
        yoyCPIInflation: macroSnapshot.yoyCPIInflationPercent,
        bbbCreditSpread: macroSnapshot.bbbCorporateCreditSpreadPercent,
        yieldCurve10Y2YSpread: macroSnapshot.yieldCurve10Y2YSpreadPercent,
        yieldCurveRegime: macroSnapshot.yieldCurveRegime,
        unemploymentRate: macroSnapshot.unemploymentRatePercent,
        nominalGDPBillions: macroSnapshot.nominalGDPLevelBillions,
        dcfValuationGuidance: macroSnapshot.dcfValuationGuidance
      },
      damodaran: {
        impliedERPPercent: erp,
        tenYearAverageERP: erpData.tenYearAverageERP,
        expectedMarketReturnPercent: expectedMarketReturn,
        terminalGrowthRateCap: macroSnapshot.dcfValuationGuidance?.maxTerminalGrowthRateCap || '3.0%',
        methodology: erpData.methodology,
        sectors,
        ratingTiers
      },
      regimeAssessment: {
        regimeSummary,
        lynchPlaybook: lynchAction,
        buffettHurdleRate: buffettHurdle,
        monetaryStance: macroSnapshot.effectiveFedFundsRate > 4.5 ? 'Restrictive Monetary Stance' : 'Accommodative / Neutral'
      }
    };
  }


  /**
   * Generates a formal Markdown Investment Memorandum matching Section 6 of Composite_Investment_Approach.md.
   */
  generateMarkdownMemorandum(dossier) {
    const { metadata, pillar1_Lynch, pillar2_Fisher, pillar3_Buffett, pillar4_Damodaran } = dossier;

    const latest10KUrl = pillar2_Fisher.secFilings?.latest10K?.filingUrl || 'https://www.sec.gov/edgar/searchedgar/companysearch';
    const latestProxyUrl = pillar2_Fisher.secFilings?.latestDEF14A?.filingUrl || 'https://www.sec.gov/edgar/searchedgar/companysearch';

    return `# Investment Decision Memorandum: ${metadata.symbol} — ${metadata.companyName}
* **Date:** ${metadata.analysisDate}
* **Current Market Price:** $${metadata.currentPrice?.toFixed(2) || '0.00'}
* **Market Capitalization:** ${formatCurrency(metadata.marketCap)}
* **Circle of Competence & Lynch Category:** **${pillar1_Lynch.category}** (Rev CAGR: ${pillar1_Lynch.revenueCAGR})

${dossier.aiExecutiveSynthesis ? `---

## Executive Investment Synthesis (Google Gemini AI)
${dossier.aiExecutiveSynthesis.synthesisText}
` : ''}
---

## 1. Peter Lynch Empirical Reconnaissance
* **Business Classification:** ${pillar1_Lynch.category}
* **PEG Ratio:** ${pillar1_Lynch.pegRatio || 'N/A'} — *${pillar1_Lynch.lynchPEGEvaluation}*
* **Net Cash Per Share:** ${pillar1_Lynch.netCashPerShare}
* **Inventory vs. Sales Growth Spread:** ${pillar1_Lynch.inventorySalesSpreadPercent}
${pillar1_Lynch.redFlags.length > 0 ? pillar1_Lynch.redFlags.map(f => `  * ⚠️ **${f}**`).join('\n') : '  * ✅ *No inventory-sales divergence red flags detected.*'}
* **The 2-Minute Story:**
  > *[Draft here: Briefly describe product stickiness, customer demand, and growth runway]*

---

## 2. Philip Fisher Scuttlebutt & Regulatory Audit
* **Official SEC EDGAR Filings:**
  * **Latest Form 10-K:** [Annual Report on SEC EDGAR](${latest10KUrl})
  * **Latest Proxy DEF 14A:** [Executive Compensation Proxy on SEC EDGAR](${latestProxyUrl})
* **Executive Compensation Audit Tenet:**
  * Ensure management incentives are tethered to economic ROIC rather than top-line revenue vanity targets.
${pillar2_Fisher.perplexityScuttlebutt ? `* **Perplexity AI 360° Scuttlebutt Intelligence:**
${pillar2_Fisher.perplexityScuttlebutt.analysisText}
` : ''}* **Developer & Tech Moat Reconnaissance (GitHub):**
  * ${pillar2_Fisher.developerMoat ? `Repository: \`${pillar2_Fisher.developerMoat.repository}\` | Stars: **${pillar2_Fisher.developerMoat.stars?.toLocaleString()}** | Forks: **${pillar2_Fisher.developerMoat.forks?.toLocaleString()}**\n  * Developer Traction: **${pillar2_Fisher.developerMoat.developerTractionVerdict}** (Score: ${pillar2_Fisher.developerMoat.developerMomentumScore}/100)` : 'No public flagship repository mapped.'}
* **Engineering Morale & Culture Sentiment (Hacker News):**
  * Verdict: **${pillar2_Fisher.engineeringSentiment?.engineerSentimentVerdict || 'Balanced'}**
  * Top Tech Discussion: ${pillar2_Fisher.engineeringSentiment?.topStories?.[0]?.title ? `"[${pillar2_Fisher.engineeringSentiment.topStories[0].title}](${pillar2_Fisher.engineeringSentiment.topStories[0].hnThreadUrl})" (${pillar2_Fisher.engineeringSentiment.topStories[0].points} points)` : 'N/A'}
* **Customer & Crowd Sentiment (Reddit):**
  * Sentiment Tone: **${pillar2_Fisher.customerAndCrowdSentiment?.crowdSentimentVerdict || 'Neutral'}** (${pillar2_Fisher.customerAndCrowdSentiment?.subreddit || 'r/stocks'})
* **Seeking Alpha Analyst Research & Insider Wire:**
  * Consensus Analyst Sentiment: **${pillar2_Fisher.seekingAlphaIntel?.consensusSentiment || 'Neutral'}** (${pillar2_Fisher.seekingAlphaIntel?.totalArticles || 0} active write-ups)
  * Recent Headline: ${pillar2_Fisher.seekingAlphaIntel?.articles?.[0]?.title ? `"[${pillar2_Fisher.seekingAlphaIntel.articles[0].title}](${pillar2_Fisher.seekingAlphaIntel.articles[0].link})" by ${pillar2_Fisher.seekingAlphaIntel.articles[0].author}` : 'N/A'}
* **Supply Chain Manifests:**
  * **ImportYeti Customs Audit Link:** [Search Shipping Bills of Lading](${pillar2_Fisher.supplyChainAudit?.importYetiSearchUrl || 'https://www.importyeti.com'})
* **Scuttlebutt Field Checks (5 Circles):**
  1. **Competitors:** *Who is winning new accounts, and where is ${metadata.symbol} vulnerable?*
  2. **Customers:** *Is pricing power durable? Would a 10% price hike drive churn?*
  3. **Suppliers:** *Are billings paid promptly and purchase orders predictable?*
  4. **Ex-Employees:** *Is internal promotion strictly meritocratic?*
  5. **Scientists:** *What 5-to-7-year paradigm shift could obsolete ${metadata.symbol}'s products?*


---

## 3. Warren Buffett Moat & Owner Earnings Audit
* **Latest Owner Earnings:** **${pillar3_Buffett.latestOwnerEarningsFormatted}**
  * *(Calculated as Reported Net Income + D&A - Maintenance Capex - Working Capital change)*
* **Average Return on Invested Capital (ROIC):** **${pillar3_Buffett.averageROIC}**
  * *Moat Status:* ${pillar3_Buffett.isHighMoatROIC ? '🛡️ **DURABLE MOAT CONFIRMED** (ROIC > 15%)' : '⚠️ **MODERATE / COMMODITIZED MOAT** (ROIC < 15%)'}
* **The $1 Retained Earnings Test (5-Yr):**
  * Market Value Created per $1 Retained: **$${pillar3_Buffett.retainedEarningsTest?.valueCreatedPerDollarRetained || '1.00'}**
  * *Result:* ${pillar3_Buffett.retainedEarningsTest?.passedBuffettTest ? '✅ **PASSED** (Created >= $1.00 market value)' : '⚠️ **FAILED** (Capital allocation value destructive)'}
* **Balance Sheet Resilience:**
  * Total Cash: ${pillar3_Buffett.financialResilience?.totalCash || 'N/A'} | Total Debt: ${pillar3_Buffett.financialResilience?.totalDebt || 'N/A'}
  * Current Ratio: ${pillar3_Buffett.financialResilience?.currentRatio != null ? pillar3_Buffett.financialResilience.currentRatio.toFixed(2) : 'N/A'} | Debt/Equity: ${pillar3_Buffett.financialResilience?.debtToEquity != null ? pillar3_Buffett.financialResilience.debtToEquity.toFixed(2) : 'N/A'}

---

## 4. Aswath Damodaran Modern Valuation & Online Portal Benchmarks
* **R&D Capitalization Adjustment:**
  * Amortizable R&D Asset Created: **${pillar4_Damodaran.rndCapitalization?.capitalizedRndAssetValue ? formatCurrency(pillar4_Damodaran.rndCapitalization.capitalizedRndAssetValue) : '$0.00'}** (${pillar4_Damodaran.damodaranOnlinePortal?.rndAmortizationLifespanApplied || '3 Years'} straight-line lifespan)
  * Reported GAAP ROIC: ${pillar4_Damodaran.rndCapitalization?.reportedROIC ?? 'N/A'}% $\rightarrow$ **Adjusted Modern ROIC: ${pillar4_Damodaran.rndCapitalization?.adjustedROIC ?? 'N/A'}%**
  * *Damodaran Insight:* ${pillar4_Damodaran.rndCapitalization?.damodaranInsight || 'N/A'}
* **Operating Lease Debt (XBRL):** ${pillar4_Damodaran.operatingLeaseDebt || 'N/A'}
* **Damodaran NYU Stern Valuation Benchmarks:**
  * **Implied Equity Risk Premium (ERP):** **${pillar4_Damodaran.damodaranOnlinePortal?.impliedERP || '4.60%'}**
  * **NYU Stern Industry Sector:** ${pillar4_Damodaran.damodaranOnlinePortal?.sectorBenchmark || 'General'}
  * **Industry Unlevered Beta:** ${pillar4_Damodaran.damodaranOnlinePortal?.industryUnleveredBeta || '1.00'} (Sector Benchmark WACC: ${pillar4_Damodaran.damodaranOnlinePortal?.industryBenchmarkWACC || '8.0%'})
* **Company Cost of Capital (WACC Engine):**
  * **Cost of Equity ($K_e$):** **${pillar4_Damodaran.costOfCapital?.costOfEquityPercent || 'N/A'}%** (CAPM using $\beta = ${pillar4_Damodaran.costOfCapital?.bottomUpBeta || pillar4_Damodaran.costOfCapital?.betaApplied || 1.1}$)
  * **Synthetic Debt Rating:** **${pillar4_Damodaran.costOfCapital?.syntheticDebtRating || pillar4_Damodaran.costOfCapital?.syntheticCreditRating || 'A'}** (Pre-Tax Cost of Debt: ${pillar4_Damodaran.costOfCapital?.preTaxCostOfDebtPercent || 'N/A'}%)
  * **Calculated WACC (Discount Rate Hurdle):** **${pillar4_Damodaran.costOfCapital?.waccPercent || 'N/A'}%**
* **The 3 P's Reality Filter (Story to Numbers):**
  * **Possible:** ✅ ${pillar4_Damodaran.threePsRealityFilter?.possible?.verdict || pillar4_Damodaran.threePsEvaluation?.possible || 'Passed'}
  * **Plausible:** 📊 ${pillar4_Damodaran.threePsRealityFilter?.plausible?.verdict || pillar4_Damodaran.threePsEvaluation?.plausible || 'Plausible'}
  * **Probable:** 🎯 ${pillar4_Damodaran.threePsRealityFilter?.probable?.verdict || pillar4_Damodaran.threePsEvaluation?.probable || 'Probable'}
* **Macroeconomic Valuation Inputs (FRED):**
  * **Risk-Free Rate ($R_f$):** **${pillar4_Damodaran.macroBenchmarks?.riskFreeRateRf || '4.25%'}**
  * **Terminal Growth Rate Ceiling ($g$):** $\le$ **${pillar4_Damodaran.macroBenchmarks?.terminalGrowthCeiling || '3.0%'}**
  * **Corporate Credit Spread:** ${pillar4_Damodaran.macroBenchmarks?.benchmarkCreditSpread || '+1.25%'}
  * **Yield Curve Regime:** ${pillar4_Damodaran.macroBenchmarks?.yieldCurveRegime || 'Normal'}

---

## 5. Valuation & Margin of Safety Execution
* **Estimated Fair Value Range:** $[Fair Value Low] - $[Fair Value High]
* **Target Margin of Safety:** 20% - 35%
* **Invalidation Triggers (When to Sell):**
  1. *Structural erosion of economic moat or pricing power failure.*
  2. *Divergence between CEO compensation incentives and economic ROIC.*
  3. *Extreme valuation bubble disconnection ($P / FV \\ge 1.60$).*
`;
  }

  generateDecisionMemorandum(dossier) {
    return this.generateMarkdownMemorandum(dossier);
  }
}
