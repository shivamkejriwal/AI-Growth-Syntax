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
    const checkKey = 'MOCK_SEEDED_STATUS_V4';
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
      const compData = this._buildFallbackCompetitorAnalysis(sym);
      await db.set(`COMPETITORS_${sym}`, compData, 'mock_competitors');
    }

    // 4. Seed Institutional Desk Simulation
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

    // 8. Seed DuckDuckGo Scuttlebutt Audit
    for (const sym of Object.keys(DEMO_DATASETS)) {
      const ddgData = this._buildMockDuckDuckGoAudit(sym);
      await db.set(`DDG_${sym}`, ddgData, 'mock_duckduckgo');
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

  /**
   * Retrieves mock DuckDuckGo Scuttlebutt audit directly from SQL or Firestore.
   */
  async getMockDuckDuckGo(ticker, db = this.db) {
    const sym = (ticker || 'MSFT').toUpperCase().trim();
    const effectiveSym = DEMO_DATASETS[sym] ? sym : 'MSFT';
    const key = `DDG_${effectiveSym}`;
    const namespace = 'mock_duckduckgo';

    let data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    if (!data) {
      await this.ensureMockDataSeeded(db);
      data = await (db.getStale ? db.getStale(key, namespace) : db.get(key, namespace));
    }

    return data || this._buildMockDuckDuckGoAudit(effectiveSym);
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

    const mockDDG = this._buildMockDuckDuckGoAudit(sym);
    const mockSA = this._buildMockSeekingAlphaFeed(sym);
    const mockFodda = this._buildMockFoddaEarnings(sym);

    const githubStats = {
      targetRepository: sym === 'MSFT' ? 'microsoft/vscode' : `${sym.toLowerCase()}/core`,
      stars: 165000,
      forks: 31000,
      openIssues: 5400,
      developerMomentumScore: 92,
      developerTractionVerdict: 'Dominant Tier-1 Developer Moat',
      license: 'MIT',
      weeklyCommits: 145
    };

    const hnStats = {
      engineerSentimentVerdict: 'Very Bullish',
      sentimentSummary: 'Engineers highlight leading developer tooling, TypeScript/VS Code ubiquity, and rapid Copilot integration.',
      positiveStoriesCount: 14,
      negativeStoriesCount: 2,
      sampleStories: [
        { title: `${sym} cloud architecture and distributed scale reliability`, points: 412 },
        { title: `Deep dive into ${sym} open-source runtime performance`, points: 289 },
        { title: `${financials.name} developer ecosystem flywheel report`, points: 195 }
      ]
    };

    const redditStats = {
      crowdSentimentVerdict: 'Bullish Compounder',
      bullMentions: 128,
      bearMentions: 18,
      source: 'r/stocks & r/investing (Mock Mode)',
      sentimentScore: 86
    };

    const fiveCirclesScript = {
      circle1_Customers: {
        target: 'VP of IT Infrastructure & Enterprise Procurement',
        keyQuestions: [
          'How painful would it be to migrate away from core productivity and cloud infrastructure?',
          'What percentage of your departmental budget is locked into multi-year enterprise agreements?',
          'How do users react when evaluated on alternative lower-cost platforms?'
        ]
      },
      circle2_Competitors: {
        target: 'Chief Product Officer at Direct Peer Enterprise',
        keyQuestions: [
          'Where is the target most vulnerable to losing competitive RFPs?',
          'How aggressive is their bundle discounting when defending incumbent accounts?',
          'Which recent product launches are gaining actual developer traction?'
        ]
      },
      circle3_Suppliers: {
        target: 'Executive Account Director at Tier-1 Semiconductor / Datacenter Partner',
        keyQuestions: [
          'Are their capex procurement forecasts smooth or volatile quarter-to-quarter?',
          'Does procurement leverage volume pricing fairly, or do they squeeze supplier margins aggressively?',
          'How far in advance do they commit capital for long-lead manufacturing runs?'
        ]
      },
      circle4_ExEmployees: {
        target: 'Former Principal Engineer (Departed within last 12 months)',
        keyQuestions: [
          'Is engineering compensation and promotion based on technical excellence or bureaucracy?',
          'Are top researchers staying or leaving for venture-backed startups?',
          'How effectively does senior leadership execute on multi-year strategic roadmaps?'
        ]
      },
      circle5_Scientists: {
        target: 'Independent Academic Researcher & Industry Technologist',
        keyQuestions: [
          'Is their core technology architecture fundamentally defensible or easily replicated?',
          'What is the true switching cost of their developer tooling and data gravity?',
          'Where will open-source alternatives disrupt their margin profile in 3-5 years?'
        ]
      }
    };

    const fisher15Points = [
      { point: 1, theme: 'Products/services with sizable market potential', status: 'Strong Pass (Tier-1 TAM)' },
      { point: 2, theme: 'Management determination to continue product development', status: 'Strong Pass (Aggressive R&D)' },
      { point: 3, theme: 'Effectiveness of company R&D efforts relative to size', status: 'Strong Pass (>12% R&D/Rev)' },
      { point: 4, theme: 'Above-average sales organization & enterprise distribution', status: 'Strong Pass (Global Footprint)' },
      { point: 5, theme: 'Worthwhile profit margin (>15% operating margin)', status: 'Strong Pass (44% Op Margin)' },
      { point: 6, theme: 'Maintaining or improving profit margins over cycles', status: 'Strong Pass (Margin Expansion)' },
      { point: 7, theme: 'Outstanding labor & engineering personnel relations', status: 'Strong Pass (High Glassdoor Score)' },
      { point: 8, theme: 'Outstanding executive relations & lack of factionalism', status: 'Strong Pass (Stable Leadership)' },
      { point: 9, theme: 'Management depth & executive succession planning', status: 'Strong Pass (Deep Bench)' },
      { point: 10, theme: 'Cost analysis and accounting controls excellence', status: 'Strong Pass (Clean Audit)' },
      { point: 11, theme: 'Industry-specific clues giving outstanding competitive edge', status: 'Strong Pass (Network Effects)' },
      { point: 12, theme: 'Long-range outlook toward corporate profits', status: 'Strong Pass (10-Yr Horizon)' },
      { point: 13, theme: 'Financing growth without diluting shareholder equity', status: 'Strong Pass (Self-Funded FCF)' },
      { point: 14, theme: 'Management talks freely about difficulties and setbacks', status: 'Strong Pass (Transparent Calls)' },
      { point: 15, theme: 'Management of unquestionable integrity and alignment', status: 'Strong Pass (ROIC-Tied Incentives)' }
    ];

    const scuttlebuttData = {
      seekingAlpha: mockSA,
      duckduckgo: mockDDG,
      github: githubStats,
      developerMoat: githubStats,
      hackerNews: hnStats,
      engineeringSentiment: hnStats,
      reddit: redditStats,
      crowdSentiment: redditStats,
      perplexity: {
        model: 'sonar-pro (mock)',
        source: 'Perplexity AI (Mock Mode Grounded)',
        analysisText: `Overall qualitative health verdict: Strong Durability.
1. Customer Moat: 96% enterprise renewal rate, zero switching propensity across core commercial software.
2. Competitive Position: Dominant duopoly market share across core cloud and productivity suites.
3. Pricing Power: Proven ability to raise seat pricing +15% without churn.
4. Capital Allocation: Management returns 40%+ of FCF through buybacks and dividends while compounding ROIC above 25%.
5. Risk Assessment: Regulatory reviews concluded favorably; balance sheet fortress with net cash.`
      },
      fodda: {
        earnings: mockFodda,
        brand: {
          brand: financials.name,
          score: 94,
          sentiment: 'Positive',
          mentions: 12500
        }
      },
      supplyChain: {
        vendorDiversificationScore: 88,
        importYetiSearchUrl: `https://www.importyeti.com/company/${encodeURIComponent(financials.name || sym)}`
      },
      fiveCirclesScript,
      fiveCirclesInterviewScript: fiveCirclesScript,
      fisher15Points,
      fisher15PointChecklist: fisher15Points
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
    const dataset = DEMO_DATASETS[sym] || DEMO_DATASETS.MSFT;
    const name = dataset.name || 'Microsoft Corporation';

    const articles = [
      {
        title: `${sym}: Cloud Reacceleration And Generative AI Commercialization Drive Long-Term Upside`,
        link: `https://seekingalpha.com/symbol/${sym}`,
        guid: `mock-sa-${sym}-1`,
        pubDate: new Date(Date.now() - 3600 * 1000 * 3).toUTCString(),
        timeAgo: '3h ago',
        author: 'Compound Capital Research',
        category: 'Analyst Research',
        sentiment: 'Bullish',
        summary: `Comprehensive evaluation of ${sym}'s owner earnings, ROIC durability exceeding 25%, and multi-year runway in commercial software.`,
        relatedTickers: [sym, 'GOOGL', 'AMZN', 'AAPL'],
        relatedStocks: [
          { symbol: sym, companyName: name },
          { symbol: 'GOOGL', companyName: 'Alphabet Inc.' },
          { symbol: 'AMZN', companyName: 'Amazon.com Inc.' },
          { symbol: 'AAPL', companyName: 'Apple Inc.' }
        ]
      },
      {
        title: `${sym} Free Cash Flow Inflection: Capital Expenditures Are Generating 30%+ Marginal ROIC`,
        link: `https://seekingalpha.com/symbol/${sym}`,
        guid: `mock-sa-${sym}-2`,
        pubDate: new Date(Date.now() - 3600 * 1000 * 7).toUTCString(),
        timeAgo: '7h ago',
        author: 'Institutional Alpha Desk',
        category: 'Analyst Research',
        sentiment: 'Bullish',
        summary: `Dissecting the return on invested capital across infrastructure spend. Cash conversion remains top-decile among mega-cap compounders.`,
        relatedTickers: [sym, 'NVDA', 'META'],
        relatedStocks: [
          { symbol: sym, companyName: name },
          { symbol: 'NVDA', companyName: 'NVIDIA Corporation' },
          { symbol: 'META', companyName: 'Meta Platforms Inc.' }
        ]
      },
      {
        title: `${name} Reports Double-Digit Cloud Growth, Raising Full-Year Operating Margin Guidance`,
        link: `https://seekingalpha.com/symbol/${sym}`,
        guid: `mock-sa-${sym}-3`,
        pubDate: new Date(Date.now() - 3600 * 1000 * 14).toUTCString(),
        timeAgo: '14h ago',
        author: 'Seeking Alpha News Wire',
        category: 'Earnings & Filings',
        sentiment: 'Bullish',
        summary: `Quarterly filings indicate operating cash flow reached fresh historical records with commercial backlog expanding 24% year-over-year.`,
        relatedTickers: [sym],
        relatedStocks: [{ symbol: sym, companyName: name }]
      },
      {
        title: `Evaluating ${sym} Under Damodaran DCF: Margin Of Safety And Terminal Growth Sensitivity`,
        link: `https://seekingalpha.com/symbol/${sym}`,
        guid: `mock-sa-${sym}-4`,
        pubDate: new Date(Date.now() - 3600 * 1000 * 22).toUTCString(),
        timeAgo: '22h ago',
        author: 'Value Compounder Group',
        category: 'Analyst Research',
        sentiment: 'Neutral',
        summary: `While quality is unquestioned, valuation multiple requires steady 13% free cash flow growth over the next 5 years to justify current trading multiples.`,
        relatedTickers: [sym, 'ORCL'],
        relatedStocks: [
          { symbol: sym, companyName: name },
          { symbol: 'ORCL', companyName: 'Oracle Corporation' }
        ]
      },
      {
        title: `${sym} Form 4 Insider Filing: Executive Retains Long-Term Equity Grant In Compliance With Rule 10b5-1`,
        link: `https://seekingalpha.com/symbol/${sym}`,
        guid: `mock-sa-${sym}-5`,
        pubDate: new Date(Date.now() - 3600 * 1000 * 30).toUTCString(),
        timeAgo: '1d ago',
        author: 'SEC Edgar Watch',
        category: 'Insider Form 4',
        sentiment: 'Neutral',
        summary: `Scheduled vesting and retention filed with SEC under DEF 14A executive compensation guidelines. Insider alignment remains elevated.`,
        relatedTickers: [sym],
        relatedStocks: [{ symbol: sym, companyName: name }]
      },
      {
        title: `${sym} Versus Competitors: Market Share Shift And Enterprise Switching Costs`,
        link: `https://seekingalpha.com/symbol/${sym}`,
        guid: `mock-sa-${sym}-6`,
        pubDate: new Date(Date.now() - 3600 * 1000 * 48).toUTCString(),
        timeAgo: '2d ago',
        author: 'Tech Moat Analytics',
        category: 'Breaking News',
        sentiment: 'Bullish',
        summary: `Direct channel checks confirm customer churn remains below 3% annually, reinforcing wide economic moat status.`,
        relatedTickers: [sym, 'GOOGL', 'AMZN'],
        relatedStocks: [
          { symbol: sym, companyName: name },
          { symbol: 'GOOGL', companyName: 'Alphabet Inc.' },
          { symbol: 'AMZN', companyName: 'Amazon.com Inc.' }
        ]
      }
    ];

    const bullishCount = articles.filter(a => a.sentiment === 'Bullish').length;
    const bearishCount = articles.filter(a => a.sentiment === 'Bearish').length;
    const neutralCount = articles.filter(a => a.sentiment === 'Neutral').length;

    const coMentionedPeers = [
      { symbol: 'GOOGL', name: 'Alphabet Inc.', coOccurrenceCount: 4, coOccurrencePercent: 67, isLikelyCompetitor: true },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', coOccurrenceCount: 3, coOccurrencePercent: 50, isLikelyCompetitor: true },
      { symbol: 'AAPL', name: 'Apple Inc.', coOccurrenceCount: 2, coOccurrencePercent: 33, isLikelyCompetitor: true },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', coOccurrenceCount: 2, coOccurrencePercent: 33, isLikelyCompetitor: true },
      { symbol: 'ORCL', name: 'Oracle Corporation', coOccurrenceCount: 1, coOccurrencePercent: 17, isLikelyCompetitor: true }
    ];

    return {
      success: true,
      ticker: sym,
      source: 'Seeking Alpha RSS (Mock Mode)',
      fetchedAt: new Date().toISOString(),
      totalArticles: articles.length,
      consensusSentiment: 'Bullish',
      sentimentScore: 84,
      sentimentVerdict: 'Bullish Consensus',
      sentimentSummary: {
        bullish: bullishCount,
        bearish: bearishCount,
        neutral: neutralCount
      },
      coMentionedPeers,
      articles
    };
  }

  _buildMockDuckDuckGoAudit(sym) {
    const dataset = DEMO_DATASETS[sym] || DEMO_DATASETS.MSFT;
    const name = dataset.name || 'Microsoft Corporation';

    const ddgProfiles = {
      MSFT: {
        heading: 'Microsoft Corporation',
        abstract: 'Microsoft Corporation is an American multinational technology corporation headquartered in Redmond, Washington. Flagship products include Windows, Office 365, Microsoft Azure, Copilot AI, Xbox, and GitHub.',
        abstractSource: 'DuckDuckGo Instant Answer / Wikipedia',
        abstractURL: 'https://en.wikipedia.org/wiki/Microsoft',
        entity: 'Corporation',
        relatedTopics: [
          { text: 'Microsoft Azure Cloud Infrastructure and Enterprise Solutions', url: 'https://azure.microsoft.com' },
          { text: 'Microsoft Investor Relations & Annual SEC 10-K Reports', url: 'https://www.microsoft.com/en-us/investor' },
          { text: 'GitHub Developer Platform & Enterprise Ecosystem', url: 'https://github.com' },
          { text: 'Microsoft Copilot Generative AI Commercial Suite', url: 'https://copilot.microsoft.com' }
        ],
        vectors: [
          {
            category: 'Competitors & Moat',
            icon: '🏢',
            query: `${name} competitors market share moat analysis`,
            summary: 'Azure maintains #2 global cloud infrastructure share (24%) behind AWS and ahead of GCP. High enterprise switching costs and bundle pricing durability with Office 365 provide wide economic moat.',
            results: [
              {
                title: 'Microsoft Azure vs AWS vs Google Cloud Market Share Breakdown 2026',
                url: 'https://duckduckgo.com/?q=azure+market+share',
                snippet: 'Enterprise cloud spend analysis shows Microsoft Azure closing the gap with Amazon Web Services, driven by exclusive OpenAI GPT API hosting and Enterprise Agreement lock-in.'
              },
              {
                title: 'Gartner Magic Quadrant for Cloud Infrastructure and Platform Services',
                url: 'https://duckduckgo.com/?q=gartner+magic+quadrant+cips',
                snippet: 'Microsoft evaluated as a Leader for execution and completeness of vision across enterprise developer tooling, hybrid cloud, and generative AI infrastructure.'
              },
              {
                title: 'Enterprise Software Moats: The Power of the Commercial Office Graph',
                url: 'https://duckduckgo.com/?q=microsoft+365+enterprise+retention',
                snippet: 'Deep enterprise integration with Teams, SharePoint, and Entra ID yields net retention rates exceeding 110% across Fortune 500 accounts.'
              }
            ]
          },
          {
            category: 'Customer Sentiment & Churn',
            icon: '⭐',
            query: `${name} customer sentiment reviews churn complaints`,
            summary: 'Consistently high customer retention with enterprise multi-year contracts. Net Revenue Retention (NRR) benchmarks at 112%, with negligible enterprise churn.',
            results: [
              {
                title: 'G2 Enterprise Grid Report: Microsoft Azure and Microsoft 365',
                url: 'https://duckduckgo.com/?q=g2+microsoft+reviews',
                snippet: 'Rated 4.5/5 stars across 40,000+ verified enterprise reviews citing unmatched scalability, comprehensive compliance certifications, and hybrid reliability.'
              },
              {
                title: 'Enterprise CIO Spending Survey: Cloud & Security Priorities',
                url: 'https://duckduckgo.com/?q=cio+survey+cloud+spending',
                snippet: '78% of surveyed enterprise CIOs intend to expand Microsoft relationship over the next 24 months, citing vendor consolidation benefits.'
              },
              {
                title: 'TrustRadius Buyer Review: Microsoft Copilot Productivity Impact',
                url: 'https://duckduckgo.com/?q=trustradius+copilot+reviews',
                snippet: 'Verified customer feedback reports 20-30% time savings in Office productivity workflows, driving high willingness to pay premium seat licenses.'
              }
            ]
          },
          {
            category: 'Supply Chain & Regulatory',
            icon: '⛓️',
            query: `${name} supply chain risk suppliers logistics`,
            summary: 'Diversified data center supply chain with premier access to TSMC wafer allocation and Nvidia accelerators. FTC/EU regulatory scrutiny on Activision and AI partnerships largely resolved.',
            results: [
              {
                title: 'Microsoft Data Center Expansion & Semiconductor Allocation Strategy',
                url: 'https://duckduckgo.com/?q=microsoft+datacenter+semiconductor',
                snippet: 'Long-term supply agreements with NVIDIA for H100/Blackwell GPUs combined with in-house Maia AI accelerators insulate cloud capacity roadmaps.'
              },
              {
                title: 'European Commission Review of Big Tech AI Partnerships',
                url: 'https://duckduckgo.com/?q=eu+antitrust+microsoft+openai',
                snippet: 'EU antitrust authorities conclude preliminary review of OpenAI partnership without formal merger investigation, reducing near-term structural risk.'
              },
              {
                title: 'Microsoft Zero-Carbon Power Purchase Agreements for AI Datacenters',
                url: 'https://duckduckgo.com/?q=microsoft+nuclear+clean+energy+ppa',
                snippet: 'Multi-gigawatt clean energy contracts including Constellation Energy Three Mile Island restart secure long-term power supply for next-generation computing.'
              }
            ]
          },
          {
            category: 'Recent News & Catalysts',
            icon: '📰',
            query: `${name} strategic news catalysts expansion`,
            summary: 'Acceleration in commercial cloud revenue (+22% YoY) and rapid monetization of Microsoft 365 Copilot seats ($30/user/mo) drive earnings growth.',
            results: [
              {
                title: 'Microsoft Reports Q4 Fiscal Year Cloud Revenue Beat',
                url: 'https://duckduckgo.com/?q=microsoft+quarterly+earnings+report',
                snippet: 'Intelligent Cloud segment posts revenue of $28.5B, led by 29% Azure growth with 8 points directly contributed by AI services.'
              },
              {
                title: 'Enterprise Adoption of Microsoft Copilot Accelerates Across Fortune 500',
                url: 'https://duckduckgo.com/?q=copilot+enterprise+rollout',
                snippet: 'Over 60% of the Fortune 500 now deploy paid Microsoft Copilot seats, demonstrating rapid transition from proof-of-concept to production.'
              },
              {
                title: 'Microsoft and In-House Custom Silicon Roadmap Expansion',
                url: 'https://duckduckgo.com/?q=microsoft+maia+cobalt+chips',
                snippet: 'Deployment of Cobalt ARM-based CPUs delivers 40% better price-performance for general purpose compute workloads in Azure centers.'
              }
            ]
          }
        ]
      }
    };

    const profile = ddgProfiles[sym] || {
      heading: `${name} (${sym})`,
      abstract: `${name} is an active industry leader. Business operations, commercial moat, and qualitative channels under active Philip Fisher Scuttlebutt reconnaissance.`,
      abstractSource: 'DuckDuckGo Instant Answer / Corporate Recon',
      abstractURL: `https://duckduckgo.com/?q=${encodeURIComponent(name)}`,
      entity: 'Corporation',
      relatedTopics: [
        { text: `${name} Investor Relations & SEC Disclosures`, url: `https://duckduckgo.com/?q=${encodeURIComponent(name + ' investor relations')}` },
        { text: `${name} Market Share & Competitive Positioning`, url: `https://duckduckgo.com/?q=${encodeURIComponent(name + ' market share')}` }
      ],
      vectors: [
        {
          category: 'Competitors & Moat',
          icon: '🏢',
          query: `${name} competitors market share moat analysis`,
          summary: `High structural barriers to entry and strong pricing durability established across core operating markets.`,
          results: [
            { title: `${name} Competitive Dynamics & Moat Review`, url: `https://duckduckgo.com/?q=${encodeURIComponent(name + ' competitors')}`, snippet: `In-depth analysis of market share stability and pricing leverage relative to direct industry peers.` }
          ]
        },
        {
          category: 'Customer Sentiment & Churn',
          icon: '⭐',
          query: `${name} customer sentiment reviews churn complaints`,
          summary: `Favorable customer satisfaction metrics and multi-year contract renewals indicate strong brand equity.`,
          results: [
            { title: `${name} Customer Satisfaction Index`, url: `https://duckduckgo.com/?q=${encodeURIComponent(name + ' reviews')}`, snippet: `Survey data confirms customer loyalty and low substitution elasticity across primary revenue lines.` }
          ]
        },
        {
          category: 'Supply Chain & Regulatory',
          icon: '⛓️',
          query: `${name} supply chain risk suppliers logistics`,
          summary: `Diversified vendor footprint with managed counterparty dependencies and compliant governance structures.`,
          results: [
            { title: `${name} Operational Logistics & Vendor Audit`, url: `https://duckduckgo.com/?q=${encodeURIComponent(name + ' supply chain')}`, snippet: `Evaluation of tier-1 supplier stability, logistics redundancy, and regulatory compliance.` }
          ]
        },
        {
          category: 'Recent News & Catalysts',
          icon: '📰',
          query: `${name} strategic news catalysts expansion`,
          summary: `Active capital reinvestment and product pipeline catalysts support durable long-term compounding.`,
          results: [
            { title: `${name} Strategic Growth Milestones & Catalysts`, url: `https://duckduckgo.com/?q=${encodeURIComponent(name + ' news')}`, snippet: `Recent commercial milestones, strategic partnerships, and earnings performance summary.` }
          ]
        }
      ]
    };

    return {
      source: 'DuckDuckGo Web & Instant Intelligence (Mock Mode)',
      symbol: sym,
      companyName: name,
      instantAnswer: {
        heading: profile.heading,
        abstract: profile.abstract,
        abstractSource: profile.abstractSource,
        abstractURL: profile.abstractURL,
        entity: profile.entity,
        relatedTopics: profile.relatedTopics,
        timestamp: new Date().toISOString()
      },
      investigationVectors: profile.vectors,
      timestamp: new Date().toISOString()
    };
  }
}

export const defaultMockDataManager = new MockDataManager();
export default defaultMockDataManager;
