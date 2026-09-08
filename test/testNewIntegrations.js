/**
 * test/testNewIntegrations.js
 * Comprehensive automated verification for:
 * 1. CongressionalClient (House & Senate Stock Trades)
 * 2. InstitutionalHoldingsClient (SEC 13F Whale Watching)
 * 3. FredClient.getRegionalFedSurveys (Regional Federal Reserve Surveys)
 * 4. Integration into StandardCompanyData and CompositeDossier
 */

import { CongressionalClient } from '../lib/congressionalClient.js';
import { InstitutionalHoldingsClient } from '../lib/institutionalHoldingsClient.js';
import { FredClient } from '../lib/fredClient.js';
import { CompositeInvestor } from '../lib/compositeInvestor.js';

async function runTests() {
  console.log('================================================================');
  console.log('TEST SUITE: Congressional Trades, 13F Whales & Regional Fed');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Regional Federal Reserve Surveys (FRED)
  // -------------------------------------------------------------
  console.log('--- 1. Testing Regional Fed Surveys (FredClient) ---');
  try {
    const fred = new FredClient();
    const surveys = await fred.getRegionalFedSurveys();

    assert(surveys && typeof surveys === 'object', 'getRegionalFedSurveys returns an object');
    assert(typeof surveys.compositeDiffusionIndex === 'number', `Composite index computed: ${surveys.compositeDiffusionIndex}`);
    assert(typeof surveys.regionalRegime === 'string', `Regional regime detected: ${surveys.regionalRegime}`);
    assert(Array.isArray(surveys.districts) && surveys.districts.length === 5, 'Contains 5 Federal Reserve districts');

    const nyFed = surveys.districts.find(d => d.district.includes('New York'));
    const phillyFed = surveys.districts.find(d => d.district.includes('Philadelphia'));
    const dallasFed = surveys.districts.find(d => d.district.includes('Dallas'));

    assert(nyFed && typeof nyFed.value === 'number', `NY Fed Empire State value: ${nyFed?.value}`);
    assert(phillyFed && typeof phillyFed.value === 'number', `Philly Fed value: ${phillyFed?.value}`);
    assert(dallasFed && typeof dallasFed.value === 'number', `Dallas Fed value: ${dallasFed?.value}`);
  } catch (err) {
    assert(false, `Regional Fed Surveys threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 2: Congressional Stock Trades (House & Senate)
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Congressional Stock Trades (CongressionalClient) ---');
  try {
    const congress = new CongressionalClient();
    const trades = await congress.getCongressionalTrades('NVDA', 10);

    assert(trades && trades.symbol === 'NVDA', 'getCongressionalTrades returns valid symbol NVDA');
    assert(typeof trades.netCongressionalSentiment === 'string', `Net sentiment: ${trades.netCongressionalSentiment}`);
    assert(typeof trades.convictionSummary === 'object', 'convictionSummary is present');
    assert(typeof trades.convictionSummary.buyTradesCount === 'number', `Buy trades count: ${trades.convictionSummary.buyTradesCount}`);
    assert(Array.isArray(trades.recentTransactions), `Recent transactions array count: ${trades.recentTransactions.length}`);
    if (trades.recentTransactions.length > 0) {
      const sample = trades.recentTransactions[0];
      assert(sample.politician && sample.chamber && sample.party, `Sample trade: ${sample.politician} (${sample.chamber}, ${sample.party}) -> ${sample.transactionType}`);
    }
  } catch (err) {
    assert(false, `Congressional Trades threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 3: SEC Form 13F Institutional Holdings ("Whale Watching")
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing 13F Institutional Holdings (InstitutionalHoldingsClient) ---');
  try {
    const inst = new InstitutionalHoldingsClient();
    const holdings = await inst.getInstitutionalHoldings('AAPL', 10);

    assert(holdings && holdings.symbol === 'AAPL', 'getInstitutionalHoldings returns valid symbol AAPL');
    assert(typeof holdings.institutionalOwnershipPercent === 'number', `Ownership %: ${holdings.institutionalOwnershipPercent}%`);
    assert(typeof holdings.netSmartMoneySentiment === 'string', `Smart Money Sentiment: ${holdings.netSmartMoneySentiment}`);
    assert(Array.isArray(holdings.topHolders) && holdings.topHolders.length > 0, `Top holders count: ${holdings.topHolders.length}`);
    assert(typeof holdings.superinvestorCount === 'number', `Superinvestor Whales count: ${holdings.superinvestorCount}`);
    assert(Array.isArray(holdings.superinvestorWhales), 'Superinvestor whales array populated');

    const topWhale = holdings.topHolders.find(h => h.isSuperinvestorWhale);
    assert(topWhale !== undefined, `Identified superinvestor whale in top holders: ${topWhale?.holderName}`);
  } catch (err) {
    assert(false, `Institutional Holdings threw error: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 4: End-to-End Dossier & StandardCompanyData Integration
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing End-to-End Dossier Integration (CompositeInvestor) ---');
  try {
    const investor = new CompositeInvestor();
    const dossier = await investor.getCompositeDossier('AAPL', { mode: 'demo' });

    assert(dossier && dossier.metadata?.symbol === 'AAPL', 'Composite dossier retrieved for AAPL');
    assert(dossier.congressionalTrading !== undefined, 'Dossier includes congressionalTrading block');
    assert(dossier.institutionalOwnership !== undefined, 'Dossier includes institutionalOwnership block');
    assert(dossier.macroContext?.regionalManufacturingSurveys !== undefined, 'Dossier macroContext includes regionalManufacturingSurveys');

    const congressSentiment = dossier.congressionalTrading?.netSentiment;
    const instSentiment = dossier.institutionalOwnership?.smartMoneySentiment;
    const regionalRegime = dossier.macroContext?.regionalManufacturingSurveys?.regionalRegime;

    console.log(`    • Congressional Sentiment: ${congressSentiment}`);
    console.log(`    • Institutional Sentiment: ${instSentiment}`);
    console.log(`    • Regional Fed Regime:     ${regionalRegime}`);

    assert(congressSentiment !== undefined, 'congressionalTrading netSentiment is valid');
    assert(instSentiment !== undefined, 'institutionalOwnership smartMoneySentiment is valid');
  } catch (err) {
    assert(false, `End-to-End Dossier threw error: ${err.message}`);
  }

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

