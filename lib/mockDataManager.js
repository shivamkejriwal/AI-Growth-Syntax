/**
 * mockDataManager.js
 * Comprehensive Mock Data Seeder and Retrieval Engine for AI-Growth-Syntax.
 * 
 * CORE CAPABILITY:
 * When the user chooses Mock Mode:
 * - Pulls mock data directly from SQL (SQLite in Local/MCP mode) or Cloud Firestore (in Deployed mode).
 * - The mock data is 100% complete and renders EVERY part of the app:
 *   - Overview (Snowflake Scorecard, Fair Value DCF, Sankey Flows, Health Lines)
 *   - 4-Pillars (Peter Lynch, Philip Fisher, Warren Buffett, Aswath Damodaran)
 *   - Benjamin Graham Net-Net & Graham Number Safety Screens
 *   - Executive Decision Memorandum
 *   - Macroeconomic Research Dashboard (FRED 10Y Yield, CPI, Yield Curve, SPDR ETFs)
 *   - Institutional 6-Stage Research Desk Pipeline
 *   - Legends Debate Panel
 *   - Competitor Peer Matrix & Relative Multiples
 *   - Fodda AI Earnings Intelligence & Brand Tracker
 *   - Seeking Alpha RSS & Analyst Intelligence
 *   - DuckDuckGo Scuttlebutt Primary Checks
 */

import { defaultDb } from './db.js';
import { buildStandardCompanyData } from './companyDataBuilder.js';
import { DEMO_DATASETS, DEMO_SPDR_SECTOR_ETFS, DEMO_SECTOR_PERFORMANCE, DEMO_INDUSTRY_PERFORMANCE } from './demoData.js';
import { InstitutionalDesk } from './institutionalDesk.js';
import { ExpertsDesk } from './expertsDesk.js';
import { CompetitorEngine } from './competitorEngine.js';

export class MockDataManager {
  constructor(db = defaultDb) {
    this.db = db;
    this.seeded = false;
  }

  /**
   * Returns list of supported mock tickers.
   */
  getSupportedTickers() {
    return Object.keys(DEMO_DATASETS);
  }

  /**
   * Ensures mock datasets are populated in SQL (SQLite) or Cloud Firestore.
   * @param {Object} [db]
   * @returns {Promise<boolean>}
   */
  async ensureMockDataSeeded(db = this.db) {
    const checkKey = 'MOCK_SEEDED_STATUS_V3';
    const namespace = 'mock_system';

    const status = await (db.getStale ? db.getStale(checkKey, namespace) : db.get(checkKey, namespace));
    if (status && status.seeded) {
      this.seeded = true;
      return true;
    }

    const desk = new InstitutionalDesk();
    const exp = new ExpertsDesk();
    const compEngine = new CompetitorEngine();

    // 1. Seed Companies
    for (const [sym, mockFinancials] of Object.entries(DEMO_DATASETS)) {
      const companyData = this._buildFullMockCompanyData(sym, mockFinancials);
      await db.set(`COMPANY_${sym}`, companyData, 'mock_companies');
    }

    // 2. Seed Macro Snapshot
    const macroSnapshot = this._buildMockMacroSnapshot();
    await db.set('MACRO_SNAPSHOT', macroSnapshot, 'mock_macro');

    // 3. Seed Competitors
    for (const sym of Object.keys(DEMO_DATASETS)) {
      let compData;
      try {
        compData = await compEngine.getCompetitorAnalysis(sym);
      } catch {
        compData = this._buildFallbackCompetitorAnalysis(sym);
      }
      await db.set(`COMPETITORS_${sym}`, compData, 'mock_competitors');
    }

    // 4. Seed Institutional Desk
    for (const sym of Object.keys(DEMO_DATASETS)) {
      let deskData;
      try {
        deskData = await desk.runDeskSimulation(sym, { mode: 'demo' });
      } catch {
        deskData = this._buildFallbackInstitutionalDesk(sym);
      }
      await db.set(`INSTITUTIONAL_${sym}`, deskData, 'mock_institutional');
    }

    // 5. Seed Experts Debate
    for (const sym of Object.keys(DEMO_DATASETS)) {
      let debateData;
      try {
        debateData = await exp.runExpertsDebate(sym, { mode: 'demo' });
      } catch {
        debateData = this._buildFallbackExpertsDebate(sym);
      }
      await db.set(`EXPERTS_DESK_${sym}`, debateData, 'mock_experts_desk');
    }

    // 6. Seed Fodda Earnings
    for (const sym of Object.keys(DEMO_DATASETS)) {
      const foddaData = this._buildMockFoddaEarnings(sym);
      await db.set(`FODDA_${sym}`, foddaData, 'mock_fodda');
    }

    // 7. Seed Seeking Alpha Feed
    for (const sym of Object.keys(DEMO_DATASETS)) {
      const saData = this._buildMockSeekingAlphaFeed(sym);
      await db.set(`SA_${sym}`, saData, 'mock_seeking_alpha');
    }

    // Mark seeded
    await db.set(checkKey, { seeded: true, timestamp: new Date().toISOString() }, namespace);
    this.seeded = true;
    return true;
  }

  /**
   * Retrieves mock company data directly from SQL or Firestore.
   */
  async getMockCompanyData(ticker, db = this.db) {
    const sym = (ticker || 'MSFT').toUpperCase().trim();
    const effectiveSym = DEMO_DATASETS[sym] ? sym : 'MSFT';
    const key = `COMPANY_${effectiveSym}`;
    const namespace = 'mock_companies';

    let data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    if (!data) {
      await this.ensureMockDataSeeded(db);
      data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    }

    if (data) {
      return {
        ...data,
        _storageMetadata: {
          retrievalSource: db.type === 'firestore' ? 'firestore_mock' : 'sql_mock',
          dbType: db.type || 'sqlite',
          isMock: true,
          retrievedAt: new Date().toISOString()
        }
      };
    }

    // Fallback build if DB read failed
    return this._buildFullMockCompanyData(effectiveSym, DEMO_DATASETS[effectiveSym]);
  }

  /**
   * Retrieves mock macro snapshot directly from SQL or Firestore.
   */
  async getMockMacro(db = this.db) {
    const key = 'MACRO_SNAPSHOT';
    const namespace = 'mock_macro';

    let data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    if (!data) {
      await this.ensureMockDataSeeded(db);
      data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    }

    return data || this._buildMockMacroSnapshot();
  }

  /**
   * Retrieves mock competitors directly from SQL or Firestore.
   */
  async getMockCompetitors(ticker, db = this.db) {
    const sym = (ticker || 'MSFT').toUpperCase().trim();
    const effectiveSym = DEMO_DATASETS[sym] ? sym : 'MSFT';
    const key = `COMPETITORS_${effectiveSym}`;
    const namespace = 'mock_competitors';

    let data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    if (!data) {
      await this.ensureMockDataSeeded(db);
      data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    }

    return data || this._buildFallbackCompetitorAnalysis(effectiveSym);
  }

  /**
   * Retrieves mock institutional desk simulation directly from SQL or Firestore.
   */
  async getMockInstitutional(ticker, db = this.db) {
    const sym = (ticker || 'MSFT').toUpperCase().trim();
    const effectiveSym = DEMO_DATASETS[sym] ? sym : 'MSFT';
    const key = `INSTITUTIONAL_${effectiveSym}`;
    const namespace = 'mock_institutional';

    let data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    if (!data) {
      await this.ensureMockDataSeeded(db);
      data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    }

    return data || this._buildFallbackInstitutionalDesk(effectiveSym);
  }

  /**
   * Retrieves mock experts debate directly from SQL or Firestore.
   */
  async getMockExpertsDesk(ticker, db = this.db) {
    const sym = (ticker || 'MSFT').toUpperCase().trim();
    const effectiveSym = DEMO_DATASETS[sym] ? sym : 'MSFT';
    const key = `EXPERTS_DESK_${effectiveSym}`;
    const namespace = 'mock_experts_desk';

    let data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    if (!data) {
      await this.ensureMockDataSeeded(db);
      data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    }

    return data || this._buildFallbackExpertsDebate(effectiveSym);
  }

  /**
   * Retrieves mock Fodda earnings directly from SQL or Firestore.
   */
  async getMockFodda(ticker, db = this.db) {
    const sym = (ticker || 'MSFT').toUpperCase().trim();
    const effectiveSym = DEMO_DATASETS[sym] ? sym : 'MSFT';
    const key = `FODDA_${effectiveSym}`;
    const namespace = 'mock_fodda';

    let data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    if (!data) {
      await this.ensureMockDataSeeded(db);
      data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    }

    return data || this._buildMockFoddaEarnings(effectiveSym);
  }

  /**
   * Retrieves mock Seeking Alpha feed directly from SQL or Firestore.
   */
  async getMockSeekingAlpha(ticker, db = this.db) {
    const sym = (ticker || 'MSFT').toUpperCase().trim();
    const effectiveSym = DEMO_DATASETS[sym] ? sym : 'MSFT';
    const key = `SA_${effectiveSym}`;
    const namespace = 'mock_seeking_alpha';

    let data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    if (!data) {
      await this.ensureMockDataSeeded(db);
      data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    }

    return data || this._buildMockSeekingAlphaFeed(effectiveSym);
  }

  // ==========================================================================
  // INTERNAL MOCK BUILDERS
  // ==========================================================================

  _buildFullMockCompanyData(sym, financials) {
    const latestYear = financials.sortedYears[financials.sortedYears.length - 1];
    const latest = financials.yearsMap[latestYear] || {};
    financials.latest = latest;
    financials.latestYear = latestYear;

    const competitorAnalysis = this._buildFallbackCompetitorAnalysis(sym);
    const macroSnapshot = {
      asOfDate: new Date().toISOString().slice(0, 10),
      riskFreeRatePercent: 4.25,
      effectiveFedFundsRate: 5.33,
      yoyCPIInflationPercent: 2.7,
      bbbCorporateCreditSpreadPercent: 1.18,
      yieldCurve10Y2YSpreadPercent: 0.15,
      yieldCurveRegime: 'Normal Upward Sloping'
    };

    const edgarFilings = {
      companyCIK: '0000789019',
      recentInsiderFilingsCount: 14,
      executiveCompensationAudit: [
        'CEO bonus pool tied 60% to ROIC exceeding 15% and 40% to operating cash flow.',
        'No repricing of stock options without shareholder approval.',
        'Insider ownership: Executives hold > 1.5% of outstanding float.'
      ],
      filings: [
        { form: '10-K', filingDate: `${latestYear}-08-01`, description: 'Annual Report for fiscal year ended June 30' },
        { form: '10-Q', filingDate: `${latestYear}-11-02`, description: 'Quarterly Report Q1' },
        { form: 'DEF 14A', filingDate: `${latestYear}-10-18`, description: 'Proxy Statement & Executive Compensation' }
      ]
    };

    const leaseFacts = {
      totalLeaseDebt: Math.round((latest.totalDebt || 1e10) * 0.22)
    };

    const scuttlebuttData = {
      seekingAlpha: {
        totalArticles: 15,
        bullishCount: 11,
        neutralCount: 3,
        bearishCount: 1,
        sentimentScore: 78,
        sentimentVerdict: 'Strong Bullish Consensus',
        articles: [
          { title: `${financials.name}: Moat Expansion & Capital Allocation Discipline`, author: 'Institutional Alpha', publishedAt: '2026-09-06' },
          { title: `${sym} Free Cash Flow Inflection Supports Premium Multiple`, author: 'Value Compounder', publishedAt: '2026-09-04' }
        ]
      },
      duckduckgo: {
        summary: 'Strong customer satisfaction scores, enterprise renewal rates > 96%, positive glassdoor engineering sentiment.',
        resultsCount: 8
      },
      developerMoat: {
        githubStars: '1.2M+',
        activeDevelopers: '250K+',
        verdict: 'Dominant Developer Moat'
      },
      engineeringSentiment: {
        engineerSentimentVerdict: 'Very Bullish',
        sentimentScore: 89
      },
      crowdSentiment: {
        crowdSentimentVerdict: 'Bullish'
      }
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

  _buildMockMacroSnapshot() {
    const today = new Date().toISOString().slice(0, 10);
    const rf = 4.25;
    const erp = 4.60;
    const expectedMarketReturn = Math.round((rf + erp) * 100) / 100;
    const ycSpread = 0.15;

    return {
      asOfDate: today,
      riskFreeRatePercent: rf,
      effectiveFedFundsRate: 5.33,
      yoyCPIInflationPercent: 2.7,
      bbbCorporateCreditSpreadPercent: 1.18,
      yieldCurve10Y2YSpreadPercent: ycSpread,
      yieldCurveRegime: 'Normal Upward Sloping',
      unemploymentRatePercent: 4.1,
      nominalGDPLevelBillions: 28600.0,
      dcfValuationGuidance: {
        recommendedRiskFreeRate: '4.25%',
        maxTerminalGrowthRateCap: '3.0%',
        syntheticCostOfDebtSpread: '+1.18% over Rf',
        estimatedPreTaxCostOfDebt: '5.43%'
      },
      overview: {
        globalMarketCap: { value: '$95.2 Trillion', change: '+0.8%', changeType: 'positive' },
        sp500: { value: '5,864.67', change: '+0.45%', changeType: 'positive' },
        nasdaq: { value: '20,530.12', change: '+0.72%', changeType: 'positive' },
        treasury10Y: { value: '4.25%', change: '+15 bps curve', changeType: 'positive' },
        breadth: {
          advancers: 2242,
          decliners: 1856,
          ratio: 54.7,
          sentiment: 'Bullish Breadth'
        }
      },
      marketMovers: {
        gainers: [
          { ticker: 'NVDA', close: 122.40, change: '+4.20%', changeType: 'positive', volume: '72.4M' },
          { ticker: 'MSFT', close: 420.50, change: '+2.15%', changeType: 'positive', volume: '24.1M' },
          { ticker: 'AAPL', close: 228.10, change: '+1.80%', changeType: 'positive', volume: '48.5M' }
        ],
        losers: [
          { ticker: 'INTC', close: 20.80, change: '-3.10%', changeType: 'negative', volume: '38.2M' },
          { ticker: 'WBA', close: 10.45, change: '-2.40%', changeType: 'negative', volume: '12.0M' }
        ],
        active: [
          { ticker: 'NVDA', volume: '72.4M' },
          { ticker: 'TSLA', volume: '65.2M' },
          { ticker: 'AAPL', volume: '48.5M' }
        ]
      },
      spdrSectorETFs: DEMO_SPDR_SECTOR_ETFS,
      sectorPerformance: DEMO_SECTOR_PERFORMANCE,
      industryPerformance: DEMO_INDUSTRY_PERFORMANCE,
      fred: {
        riskFreeRate10Y: rf,
        effectiveFedFundsRate: 5.33,
        yoyCPIInflation: 2.7,
        bbbCreditSpread: 1.18,
        yieldCurve10Y2YSpread: ycSpread,
        yieldCurveRegime: 'Normal Upward Sloping',
        unemploymentRate: 4.1,
        nominalGDPBillions: 28600.0,
        dcfValuationGuidance: {
          recommendedRiskFreeRate: '4.25%',
          maxTerminalGrowthRateCap: '3.0%',
          syntheticCostOfDebtSpread: '+1.18% over Rf',
          estimatedPreTaxCostOfDebt: '5.43%'
        }
      },
      damodaran: {
        impliedERPPercent: erp,
        tenYearAverageERP: 4.72,
        expectedMarketReturnPercent: expectedMarketReturn,
        terminalGrowthRateCap: 3.0,
        methodology: 'FCFE Cash Flow Implied Model'
      },
      regimeAssessment: {
        regimeSummary: 'Normal Upward Sloping Curve: Accommodative/expansionary term structure indicating healthy economic normalization.',
        lynchAction: 'Cyclicals can be evaluated near trough earnings multiples; Fast Growers benefit from predictable capital costs.',
        buffettHurdle: `Baseline hurdle rate for equity investments is ${expectedMarketReturn}% (Rf ${rf}% + Implied ERP ${erp}%).`
      }
    };
  }

  _buildFallbackCompetitorAnalysis(sym) {
    const peersMap = {
      MSFT: [
        { ticker: 'GOOGL', name: 'Alphabet Inc.', peRatio: 24.5, pegRatio: 1.4, priceToSales: 6.8, operatingMargin: 31.0, revenueGrowth: 14.2, roic: 28.5, moatRating: 'Wide Moat' },
        { ticker: 'AAPL', name: 'Apple Inc.', peRatio: 33.2, pegRatio: 2.3, priceToSales: 8.9, operatingMargin: 30.5, revenueGrowth: 8.5, roic: 52.0, moatRating: 'Wide Moat' },
        { ticker: 'AMZN', name: 'Amazon.com Inc.', peRatio: 42.0, pegRatio: 1.6, priceToSales: 3.4, operatingMargin: 9.2, revenueGrowth: 12.0, roic: 18.0, moatRating: 'Wide Moat' },
        { ticker: 'ORCL', name: 'Oracle Corporation', peRatio: 26.0, pegRatio: 1.8, priceToSales: 6.2, operatingMargin: 39.0, revenueGrowth: 7.8, roic: 19.5, moatRating: 'Narrow Moat' }
      ],
      AAPL: [
        { ticker: 'MSFT', name: 'Microsoft Corporation', peRatio: 34.2, pegRatio: 2.1, priceToSales: 12.5, operatingMargin: 44.5, revenueGrowth: 15.4, roic: 28.0, moatRating: 'Wide Moat' },
        { ticker: 'GOOGL', name: 'Alphabet Inc.', peRatio: 24.5, pegRatio: 1.4, priceToSales: 6.8, operatingMargin: 31.0, revenueGrowth: 14.2, roic: 28.5, moatRating: 'Wide Moat' },
        { ticker: 'SONY', name: 'Sony Group', peRatio: 18.5, pegRatio: 1.5, priceToSales: 1.2, operatingMargin: 11.2, revenueGrowth: 6.0, roic: 14.0, moatRating: 'Narrow Moat' }
      ],
      NVDA: [
        { ticker: 'AMD', name: 'Advanced Micro Devices', peRatio: 48.0, pegRatio: 1.9, priceToSales: 9.5, operatingMargin: 18.0, revenueGrowth: 16.0, roic: 14.2, moatRating: 'Narrow Moat' },
        { ticker: 'INTC', name: 'Intel Corporation', peRatio: 32.0, pegRatio: 2.8, priceToSales: 1.8, operatingMargin: 4.5, revenueGrowth: -2.0, roic: 3.5, moatRating: 'Narrow Moat' },
        { ticker: 'QCOM', name: 'Qualcomm Inc.', peRatio: 21.0, pegRatio: 1.2, priceToSales: 5.1, operatingMargin: 28.5, revenueGrowth: 11.0, roic: 32.0, moatRating: 'Wide Moat' }
      ],
      TSLA: [
        { ticker: 'RIVN', name: 'Rivian Automotive', peRatio: 0, pegRatio: 0, priceToSales: 2.4, operatingMargin: -85.0, revenueGrowth: 28.0, roic: -45.0, moatRating: 'None' },
        { ticker: 'BYD', name: 'BYD Company', peRatio: 20.5, pegRatio: 1.1, priceToSales: 1.1, operatingMargin: 6.5, revenueGrowth: 32.0, roic: 16.0, moatRating: 'Narrow Moat' },
        { ticker: 'GM', name: 'General Motors', peRatio: 5.4, pegRatio: 0.8, priceToSales: 0.3, operatingMargin: 6.8, revenueGrowth: 4.0, roic: 9.5, moatRating: 'None' }
      ],
      AMZN: [
        { ticker: 'MSFT', name: 'Microsoft Corporation', peRatio: 34.2, pegRatio: 2.1, priceToSales: 12.5, operatingMargin: 44.5, revenueGrowth: 15.4, roic: 28.0, moatRating: 'Wide Moat' },
        { ticker: 'WMT', name: 'Walmart Inc.', peRatio: 31.0, pegRatio: 2.4, priceToSales: 0.8, operatingMargin: 4.2, revenueGrowth: 5.5, roic: 13.0, moatRating: 'Wide Moat' },
        { ticker: 'BABA', name: 'Alibaba Group', peRatio: 12.0, pegRatio: 1.0, priceToSales: 1.6, operatingMargin: 15.0, revenueGrowth: 6.5, roic: 11.5, moatRating: 'Narrow Moat' }
      ]
    };

    const peers = peersMap[sym] || peersMap.MSFT;
    return {
      targetSymbol: sym,
      targetName: sym,
      industry: 'Enterprise Software & Technology',
      peers,
      benchmarks: {
        peerMedianPE: 26.0,
        peerMedianMargin: 30.5
      },
      valuationRanking: 'Premium compounder multiple backed by superior ROIC and pricing power'
    };
  }

  _buildFallbackInstitutionalDesk(sym) {
    return {
      success: true,
      ticker: sym,
      status: 'success',
      mode: 'mock',
      traderProposal: {
        conviction: 'High',
        action: 'ACCUMULATE',
        allocationPercent: 4.5
      },
      portfolioDecision: {
        approved: true,
        allocation: '4.5%'
      },
      researchDebate: [
        { speaker: 'Bull Researcher', text: `${sym} exhibits persistent competitive advantages and pricing durability.` }
      ],
      researchPlan: {
        focus: 'Capital Allocation and ROIC'
      },
      riskDebate: [
        { speaker: 'Chief Risk Officer', text: 'Downside risk contained by robust free cash flow and conservative balance sheet.' }
      ]
    };
  }

  _buildFallbackExpertsDebate(sym) {
    return {
      success: true,
      ticker: sym,
      status: 'success',
      arbiterSynthesis: {
        verdict: 'High Quality Stalwart with Sustainable Moat',
        overallConviction: 'High'
      },
      scorecardMatrix: [
        { expert: 'Warren Buffett', score: 9, verdict: 'Wide Economic Moat' },
        { expert: 'Peter Lynch', score: 8, verdict: 'Stalwart Compounder' }
      ],
      debate: [
        { legend: 'Warren Buffett', thesis: `Consistent 20%+ ROIC and owner earnings compound intrinsic value for ${sym}.` },
        { legend: 'Benjamin Graham', thesis: `Solvency hurdles satisfied, tangible protection in place.` }
      ]
    };
  }

  _buildMockFoddaEarnings(sym) {
    return {
      ticker: sym,
      quarter: 'Q4 Fiscal Year',
      available: true,
      revenueBeat: '+2.4%',
      epsBeat: '+4.1%',
      guidanceVerdict: 'Raised Fiscal Year Outlook',
      managementCommentary: 'Strong commercial cloud momentum, enterprise AI adoption expanding deal sizes.',
      brandTrackerScore: 92
    };
  }

  _buildMockSeekingAlphaFeed(sym) {
    return {
      ticker: sym,
      sentimentScore: 82,
      sentimentVerdict: 'Bullish',
      articles: [
        {
          title: `${sym}: High ROIC and Secular Tailwinds Justify Long-Term Holding`,
          author: 'Compound Capital',
          publishedAt: '2026-09-06',
          summary: 'Detailed examination of owner earnings growth, competitive advantage, and free cash flow conversion.'
        },
        {
          title: `${sym} Versus Competitors: Market Share Analysis`,
          author: 'Tech Analyst Desk',
          publishedAt: '2026-09-04',
          summary: 'Peer comparison matrix confirms market-leading margins and pricing leverage.'
        }
      ]
    };
  }
}

export const defaultMockDataManager = new MockDataManager();
export default defaultMockDataManager;
