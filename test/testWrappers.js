/**
 * test/testWrappers.js
 * Comprehensive automated test suite for Alpha Vantage, SEC EDGAR, FRED, and CompositeInvestor.
 */

import assert from 'node:assert';
import { loadEnv } from '../lib/env.js';
import { DiskCache } from '../lib/cache.js';
import { AlphaVantageClient, safeFloat, roundVal } from '../lib/alphaVantageClient.js';
import { YahooFinanceClient } from '../lib/yahooFinanceClient.js';
import { EdgarClient } from '../lib/edgarClient.js';
import { FredClient } from '../lib/fredClient.js';
import { ScuttlebuttClient } from '../lib/scuttlebuttClient.js';
import { DamodaranClient } from '../lib/damodaranClient.js';
import { CompositeInvestor, formatCurrency } from '../lib/compositeInvestor.js';

async function runTests() {
  console.log('====================================================');
  console.log(' COMPOSITE INVESTOR WRAPPERS TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
    }
  }

  // 1. Environment & Utilities
  test('Env loader discovers parent .env file', () => {
    const envPath = loadEnv();
    assert.ok(envPath !== undefined, 'Env loader should return path or null');
  });

  test('FormatCurrency formats numbers correctly', () => {
    assert.strictEqual(formatCurrency(1500000000000), '$1.50T');
    assert.strictEqual(formatCurrency(4500000000), '$4.50B');
    assert.strictEqual(formatCurrency(12000000), '$12.00M');
    assert.strictEqual(formatCurrency(3500), '$3.50K');
    assert.strictEqual(formatCurrency(24.50), '$24.50');
  });

  test('DiskCache stores, retrieves, and handles keys', () => {
    const testCache = new DiskCache();
    testCache.set('test_sample_key', { foo: 'bar' }, 'test_ns');
    const val = testCache.get('test_sample_key', 'test_ns');
    assert.deepStrictEqual(val, { foo: 'bar' });
    const staleVal = testCache.getStale('test_sample_key', 'test_ns');
    assert.deepStrictEqual(staleVal, { foo: 'bar' });
  });

  // 2. Alpha Vantage Methodology Math Tests
  const mockFinancials = {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    currentPrice: 400.0,
    sharesOutstanding: 7430000000,
    marketCap: 400.0 * 7430000000,
    peRatio: 32.0,
    pegRatio: 2.1,
    sortedYears: ['2020', '2024'],
    yearsMap: {
      '2020': {
        revenue: 143000000000,
        netIncome: 44000000000,
        operatingIncome: 53000000000,
        rnd: 19000000000,
        retainedEarnings: 34000000000,
        inventory: 1900000000,
        workingCapital: 100000000000,
        cash: 136000000000,
        totalDebt: 70000000000,
        equity: 118000000000,
        capex: 15000000000,
        operatingCashflow: 60000000000,
        fcf: 45000000000,
        depreciationAndAmortization: 12000000000
      },
      '2024': {
        revenue: 245000000000,
        netIncome: 88000000000,
        operatingIncome: 109000000000,
        rnd: 29000000000,
        retainedEarnings: 110000000000,
        inventory: 2300000000,
        workingCapital: 85000000000,
        cash: 111000000000,
        totalDebt: 75000000000,
        equity: 268000000000,
        capex: 44000000000,
        operatingCashflow: 118000000000,
        fcf: 74000000000,
        depreciationAndAmortization: 15000000000
      }
    },
    latestYear: '2024',
    latest: {
      revenue: 245000000000,
      netIncome: 88000000000,
      operatingIncome: 109000000000,
      rnd: 29000000000,
      cash: 111000000000,
      totalDebt: 75000000000,
      equity: 268000000000,
      inventory: 2300000000,
      workingCapital: 85000000000
    }
  };

  const avClient = new AlphaVantageClient();

  test('Peter Lynch Metrics: Taxonomy & PEG evaluation', () => {
    const lynch = avClient.calculateLynchMetrics(mockFinancials);
    assert.ok(['Fast Grower', 'Stalwart', 'Slow Grower'].includes(lynch.category));
    assert.strictEqual(typeof lynch.pegRatio, 'number');
    assert.strictEqual(typeof lynch.inventorySalesSpread, 'number');
    assert.strictEqual(typeof lynch.netCashPerShare, 'number');
  });

  test('Warren Buffett: Owner Earnings & $1 Retained test', () => {
    const buffettOE = avClient.calculateBuffettOwnerEarnings(mockFinancials);
    assert.ok(buffettOE.latestOwnerEarnings > 0, 'Owner earnings should be positive');
    assert.ok(buffettOE.averageROIC > 0, 'Average ROIC should be positive');

    const buffettRetained = avClient.calculateBuffettRetainedEarningsTest(mockFinancials);
    assert.strictEqual(typeof buffettRetained.passedBuffettTest, 'boolean');
    assert.ok(buffettRetained.totalRetainedAccumulated > 0);
  });

  test('Aswath Damodaran: R&D Capitalization & Modern Invested Capital', () => {
    const damodaran = avClient.calculateDamodaranAdjustments(mockFinancials, { rndYears: 3 });
    assert.ok(damodaran.hasRndExpense, 'Should recognize R&D expense');
    assert.ok(damodaran.capitalizedRndAssetValue > 0, 'Capitalized R&D asset value should be positive');
    assert.ok(damodaran.adjustedInvestedCapital > 0, 'Adjusted Invested capital should be positive');
  });

  // 3. SEC EDGAR Client Tests
  const edgarClient = new EdgarClient();

  await testAsync('SEC EDGAR: CIK Lookup for known tickers', async () => {
    const msft = await edgarClient.lookupCIK('MSFT');
    assert.strictEqual(msft.cik, '0000789019');

    const aapl = await edgarClient.lookupCIK('AAPL');
    assert.strictEqual(aapl.cik, '0000320193');
  });

  await testAsync('SEC EDGAR: Search companies by name and ticker', async () => {
    const appleMatches = await edgarClient.searchCompanies('Apple', 5);
    assert.ok(appleMatches.length > 0);
    assert.strictEqual(appleMatches[0].ticker, 'AAPL');

    const msftMatches = await edgarClient.searchCompanies('MSFT', 5);
    assert.ok(msftMatches.length > 0);
    assert.strictEqual(msftMatches[0].ticker, 'MSFT');

    const nvidiaMatches = await edgarClient.searchCompanies('NVIDIA', 5);
    assert.ok(nvidiaMatches.length > 0);
    assert.strictEqual(nvidiaMatches[0].ticker, 'NVDA');
  });


  // 4. FRED Client Tests
  const fredClient = new FredClient();

  await testAsync('FRED: Risk-Free Rate (DGS10) observation', async () => {
    const rf = await fredClient.getRiskFreeRate();
    assert.strictEqual(rf.seriesId, 'DGS10');
    assert.ok(rf.riskFreeRatePercent > 0, 'Rf should be > 0%');
  });

  await testAsync('FRED: Macro Snapshot unified generation', async () => {
    const macro = await fredClient.getMacroSnapshot();
    assert.ok(macro.riskFreeRatePercent > 0);
    assert.ok(macro.effectiveFedFundsRate > 0);
    assert.ok(macro.yieldCurveRegime !== undefined);
  });

  // 5. Scuttlebutt Client Tests
  const scuttlebutt = new ScuttlebuttClient();

  test('Scuttlebutt: Generates Fisher 5-Circles Interview Script', () => {
    const script = scuttlebutt.generate5CirclesScript('MSFT', 'Microsoft Corporation', 'Technology');
    assert.ok(script.circle1_Competitors.keyQuestions.length > 0);
    assert.ok(script.circle2_Customers.keyQuestions.length > 0);
    assert.ok(script.circle3_Suppliers.keyQuestions.length > 0);
    assert.ok(script.circle4_ExEmployees.keyQuestions.length > 0);
    assert.ok(script.circle5_Scientists.keyQuestions.length > 0);
  });

  test('Scuttlebutt: Evaluates Fisher 15-Point qualitative checklist', () => {
    const points = scuttlebutt.evaluateFisher15Points('MSFT', mockFinancials, {
      engineerSentimentVerdict: 'Positive',
      github: { developerMomentumScore: 82, developerTractionVerdict: 'Tier-1 Industry Standard' }
    });
    assert.strictEqual(points.length, 15);
    assert.ok(points[0].status);
    assert.ok(points[10].status.includes('TECH MOAT'));
  });

  test('Scuttlebutt: Supply chain ImportYeti search query generation', () => {
    const recon = scuttlebutt.getSupplyChainRecon('Apple Inc');
    assert.ok(recon.importYetiSearchUrl.includes('importyeti.com'));
    assert.ok(recon.customsInspectionProtocol.length >= 4);
  });

  // 6. Damodaran Online Portal Client Tests
  const damodaran = new DamodaranClient();

  await testAsync('Damodaran Portal: Implied ERP retrieval', async () => {
    const erp = await damodaran.getImpliedERP();
    assert.strictEqual(typeof erp.impliedERPPercent, 'number');
    assert.ok(erp.impliedERPPercent > 3.0 && erp.impliedERPPercent < 8.0);
  });

  test('Damodaran Portal: Sector Cost of Capital & Beta lookup', () => {
    const software = damodaran.getIndustryBenchmarks('Software');
    assert.strictEqual(software.sectorName, 'Software (System & Application)');
    assert.ok(software.unleveredBeta > 0);
    assert.strictEqual(software.rndAmortizationYears, 3);

    const pharma = damodaran.getIndustryBenchmarks('Pharma');
    assert.strictEqual(pharma.rndAmortizationYears, 5);
  });

  test('Damodaran Portal: Synthetic Credit Rating calculation', () => {
    // High coverage -> AAA rating
    const highCov = damodaran.calculateSyntheticRating(10000000000, 500000000); // 20x coverage
    assert.strictEqual(highCov.syntheticRating, 'AAA');
    assert.strictEqual(highCov.defaultSpreadPercent, 0.59);

    // Moderate coverage -> BBB rating
    const modCov = damodaran.calculateSyntheticRating(270000000, 100000000); // 2.7x coverage
    assert.strictEqual(modCov.syntheticRating, 'BBB');
  });

  await testAsync('Damodaran Portal: Company WACC computation', async () => {
    const waccResult = await damodaran.calculateCostOfCapital(mockFinancials, 4.25);
    assert.ok(waccResult.waccPercent > 5.0 && waccResult.waccPercent < 15.0);
    assert.strictEqual(typeof waccResult.costOfEquityPercent, 'number');
    assert.ok(waccResult.syntheticDebtRating);
  });

  test('Damodaran Portal: The 3 Ps Reality Filter evaluation', () => {
    const threePs = damodaran.evaluate3Ps('MSFT', 'Secular AI and Cloud expansion', {
      revenueCAGR: '14.4%',
      roic: '56.9%'
    });
    assert.strictEqual(threePs.possible.status, 'PASSED');
    assert.strictEqual(threePs.plausible.status, 'PLAUSIBLE');
    assert.strictEqual(threePs.probable.status, 'HIGH PROBABILITY');
  });

  // 7. Composite Investor End-to-End Test
  const investor = new CompositeInvestor();

  await testAsync('CompositeInvestor: Generates 4-Pillar dossier & Markdown memo with Scuttlebutt & Damodaran Portal', async () => {
    const dossier = await investor.generateCompositeDossier('MSFT', {
      offlineData: mockFinancials
    });

    assert.strictEqual(dossier.metadata.symbol, 'MSFT');
    assert.ok(dossier.pillar1_Lynch.category);
    assert.ok(dossier.pillar2_Fisher.scuttlebuttProtocol);
    assert.ok(dossier.pillar2_Fisher.fiveCirclesInterviewScript);
    assert.ok(dossier.pillar2_Fisher.fisher15PointChecklist.length === 15);
    assert.ok(dossier.pillar3_Buffett.latestOwnerEarningsFormatted);
    assert.ok(dossier.pillar4_Damodaran.macroBenchmarks.riskFreeRateRf);
    assert.ok(dossier.pillar4_Damodaran.damodaranOnlinePortal.impliedERP);
    assert.ok(dossier.pillar4_Damodaran.costOfCapital.waccPercent);
    assert.ok(dossier.pillar4_Damodaran.threePsRealityFilter);

    // Verify Equity Visuals integration
    assert.ok(dossier.equityVisuals, 'dossier should have equityVisuals');
    assert.ok(dossier.equityVisuals.snowflakeScores, 'should have snowflakeScores');
    assert.ok(dossier.equityVisuals.snowflakeScores.totalScore > 0, 'snowflake total score should be > 0');
    assert.ok(dossier.equityVisuals.sharePriceVsFairValue.fairValue > 0, 'should have positive DCF fair value');
    assert.ok(dossier.equityVisuals.revenueExpensesFlow.nodes.length >= 5, 'should have revenue flow nodes');
    assert.ok(dossier.equityVisuals.financialHealth.length >= 2, 'should have financial health multi-year trend');
    assert.ok(dossier.equityVisuals.earningsTrend.length >= 2, 'should have earnings trend multi-year');
    assert.ok(dossier.equityVisuals.managementAllocation.length >= 2, 'should have capital allocation multi-year');
    assert.ok(dossier.equityVisuals.dividendChartData.length >= 2, 'should have dividend chart data');

    const memo = investor.generateMarkdownMemorandum(dossier);
    assert.ok(memo.includes('Investment Decision Memorandum: MSFT'));
    assert.ok(memo.includes('Peter Lynch Empirical Reconnaissance'));
    assert.ok(memo.includes('Philip Fisher Scuttlebutt & Regulatory Audit'));
    assert.ok(memo.includes('Warren Buffett Moat & Owner Earnings Audit'));
    assert.ok(memo.includes('Aswath Damodaran Modern Valuation & Online Portal Benchmarks'));
    assert.ok(memo.includes('Company Cost of Capital (WACC Engine)'));
    assert.ok(memo.includes('The 3 P\'s Reality Filter'));
  });

  // 8. Yahoo Finance Backup Provider Tests
  const yf = new YahooFinanceClient();

  await testAsync('YahooFinanceClient: Fetches real-time quote for AAPL', async () => {
    const quote = await yf.getQuote('AAPL');
    assert.ok(quote, 'Should return a quote object');
    assert.strictEqual(quote.symbol, 'AAPL');
    assert.ok(quote.price > 0, `Price should be positive, got ${quote.price}`);
    assert.ok(quote.changePercent, 'Should include changePercent');
    assert.strictEqual(quote.isLive, true);
  });

  await testAsync('YahooFinanceClient: Ingests multi-year normalized financials', async () => {
    const fin = await yf.extractNormalizedFinancials('AAPL');
    assert.ok(fin, 'Should return normalized financials');
    assert.strictEqual(fin.symbol, 'AAPL');
    assert.ok(fin.sortedYears.length >= 2, `Should have at least 2 years, got ${fin.sortedYears.length}`);
    assert.ok(fin.peRatio > 0, `PE Ratio should be positive, got ${fin.peRatio}`);
    assert.ok(fin.marketCap > 0, `Market cap should be positive, got ${fin.marketCap}`);
    assert.strictEqual(fin.source, 'YahooFinance');
  });

  await testAsync('AlphaVantageClient: Automatically falls back to Yahoo Finance when API key is empty/demo', async () => {
    const avDemo = new AlphaVantageClient({ apiKey: 'demo' });
    const quote = await avDemo.getGlobalQuote('AAPL');
    assert.ok(quote?.['Global Quote'], 'Should return Global Quote');
    assert.ok(parseFloat(quote['Global Quote']['05. price']) > 0, 'Price should be > 0');

    const fin = await avDemo.extractNormalizedFinancials('AAPL');
    assert.ok(fin, 'Should return normalized financials via fallback');
    assert.ok(fin.sortedYears.length >= 2, 'Should have >= 2 years');
    assert.strictEqual(fin.source, 'YahooFinance');

    const movers = await avDemo.getMarketMovers();
    assert.ok(movers, 'Should return market movers');
    assert.ok(movers.gainers && movers.gainers.length > 0, 'Should have gainers');
  });

  console.log(`\n====================================================`);
  console.log(`TEST RESULTS: ${passed}/${total} PASSED`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
