/**
 * testSignalsEngine.js
 * Verification suite for the Investment & Research Signals Engine.
 * 
 * Verifies:
 * 1. Derivation of all 14 canonical risk check signals for MSFT
 * 2. Exact match of verdicts (1 Fail: Insider Selling, 13 Passes)
 * 3. Dossier integration (dossier.signals and dossier.riskChecks)
 * 4. Extensibility: registering dynamic custom signals and storing unstructured data
 */

import assert from 'node:assert/strict';
import { SignalsEngine, SignalRegistry, defaultSignalsEngine } from '../lib/signalsEngine.js';
import { CompositeInvestor } from '../lib/compositeInvestor.js';

async function runTests() {
  console.log('🧪 Starting Investment & Research Signals Engine Verification Suite...\n');

  // -------------------------------------------------------------
  // Test 1: Verify all 14 canonical risk check signals for MSFT
  // -------------------------------------------------------------
  console.log('1️⃣  Testing Canonical 14 Risk Checks for MSFT...');
  const investor = new CompositeInvestor();
  const dossier = await investor.getCompositeDossier('MSFT', {
    mode: 'demo',
    persistDemo: false,
    customSignals: {
      researchThesis: 'Cloud + Enterprise AI compounder with high pricing power',
      esgRating: 'AAA',
      scuttlebuttNotes: ['High developer retention on Azure OpenAI', 'Strong Office 365 E5 upsell']
    }
  });

  assert.ok(dossier.signals, 'Dossier must include signals property');
  assert.ok(dossier.signals.summary, 'Dossier signals must include summary');
  assert.ok(Array.isArray(dossier.signals.riskChecks), 'Dossier signals must contain riskChecks array');
  assert.equal(dossier.signals.summary.totalChecks, 14, 'Must evaluate exactly 14 canonical risk checks');

  console.log(`   Total Checks: ${dossier.signals.summary.totalChecks}`);
  console.log(`   Passed: ${dossier.signals.summary.passed}`);
  console.log(`   Failed: ${dossier.signals.summary.failed}`);
  console.log(`   Risk Rating: ${dossier.signals.summary.riskRating} (${dossier.signals.summary.passScorePercent}%)\n`);

  // Map checks by id for detailed assertions
  const checksById = new Map(dossier.signals.riskChecks.map(c => [c.id, c]));

  // 1. Insider Selling
  const insiderCheck = checksById.get('insider_selling_3m');
  assert.ok(insiderCheck, 'insider_selling_3m check present');
  assert.equal(insiderCheck.status, 'FAIL');
  assert.equal(insiderCheck.verdict, 'Fail');
  assert.equal(insiderCheck.summary, 'Significant insider selling over the past 3 months');
  console.log('   ✅ Check 1 (Insider Selling): FAIL - Significant insider selling over the past 3 months');

  // 2. Financial Position
  const finPosCheck = checksById.get('financial_position');
  assert.ok(finPosCheck, 'financial_position check present');
  assert.equal(finPosCheck.status, 'PASS');
  assert.equal(finPosCheck.verdict, 'Pass');
  assert.equal(finPosCheck.summary, 'Debt level is low and not considered a risk');
  console.log('   ✅ Check 2 (Financial Position): PASS - Debt level is low and not considered a risk');

  // 3. Meaningful Market Capitalization
  const mcapCheck = checksById.get('meaningful_market_cap');
  assert.ok(mcapCheck, 'meaningful_market_cap check present');
  assert.equal(mcapCheck.status, 'PASS');
  assert.equal(mcapCheck.verdict, 'Pass');
  assert.ok(mcapCheck.summary.includes('Market cap is meaningful'));
  console.log(`   ✅ Check 3 (Market Cap): PASS - ${mcapCheck.summary}`);

  // 4. Negative Shareholders Equity
  const equityCheck = checksById.get('negative_shareholders_equity');
  assert.ok(equityCheck, 'negative_shareholders_equity check present');
  assert.equal(equityCheck.status, 'PASS');
  assert.equal(equityCheck.verdict, 'Pass');
  assert.equal(equityCheck.summary, 'MSFT does not have negative shareholders equity.');
  console.log('   ✅ Check 4 (Shareholders Equity): PASS - MSFT does not have negative shareholders equity.');

  // 5. Concerning Recent Events
  const eventsCheck = checksById.get('concerning_recent_events');
  assert.ok(eventsCheck, 'concerning_recent_events check present');
  assert.equal(eventsCheck.status, 'PASS');
  assert.equal(eventsCheck.verdict, 'Pass');
  assert.equal(eventsCheck.summary, 'No concerning events detected');
  console.log('   ✅ Check 5 (Recent Events): PASS - No concerning events detected');

  // 6. Share Price Liquid and Stable
  const stabilityCheck = checksById.get('liquid_and_stable_share_price');
  assert.ok(stabilityCheck, 'liquid_and_stable_share_price check present');
  assert.equal(stabilityCheck.status, 'PASS');
  assert.equal(stabilityCheck.verdict, 'Pass');
  assert.equal(stabilityCheck.summary, 'Share price has been stable over the past 3 months compared to the US market');
  console.log('   ✅ Check 6 (Price Stability): PASS - Share price has been stable over past 3 months');

  // 7. Profit Margins Improved
  const marginsCheck = checksById.get('profit_margins_improved');
  assert.ok(marginsCheck, 'profit_margins_improved check present');
  assert.equal(marginsCheck.status, 'PASS');
  assert.equal(marginsCheck.verdict, 'Pass');
  assert.equal(marginsCheck.summary, 'Profit margins improved or MSFT became profitable');
  console.log('   ✅ Check 7 (Profit Margins): PASS - Profit margins improved or MSFT became profitable');

  // 8. Sufficient Financial Data Available
  const dataCheck = checksById.get('sufficient_financial_data');
  assert.ok(dataCheck, 'sufficient_financial_data check present');
  assert.equal(dataCheck.status, 'PASS');
  assert.equal(dataCheck.verdict, 'Pass');
  assert.equal(dataCheck.summary, 'They have sufficient analyst coverage');
  console.log('   ✅ Check 8 (Data Availability): PASS - They have sufficient analyst coverage');

  // 9. Meaningful Levels of Revenue
  const revCheck = checksById.get('meaningful_revenue');
  assert.ok(revCheck, 'meaningful_revenue check present');
  assert.equal(revCheck.status, 'PASS');
  assert.equal(revCheck.verdict, 'Pass');
  assert.ok(revCheck.summary.includes('Revenue is meaningful'));
  console.log(`   ✅ Check 9 (Meaningful Revenue): PASS - ${revCheck.summary}`);

  // 10. Shareholders Diluted Over Past Year
  const dilutionCheck = checksById.get('shareholders_diluted');
  assert.ok(dilutionCheck, 'shareholders_diluted check present');
  assert.equal(dilutionCheck.status, 'PASS');
  assert.equal(dilutionCheck.verdict, 'Pass');
  assert.equal(dilutionCheck.summary, 'Shareholders have not been meaningfully diluted in the past year or recently listed');
  console.log('   ✅ Check 10 (Dilution): PASS - Shareholders have not been meaningfully diluted');

  // 11. Forecast to Achieve Profitability
  const profitCheck = checksById.get('forecast_profitability');
  assert.ok(profitCheck, 'forecast_profitability check present');
  assert.equal(profitCheck.status, 'PASS');
  assert.equal(profitCheck.verdict, 'Pass');
  assert.equal(profitCheck.summary, 'The company is currently profitable');
  console.log('   ✅ Check 11 (Profitability Forecast): PASS - The company is currently profitable');

  // 12. High Quality Earnings
  const qualityCheck = checksById.get('high_quality_earnings');
  assert.ok(qualityCheck, 'high_quality_earnings check present');
  assert.equal(qualityCheck.status, 'PASS');
  assert.equal(qualityCheck.verdict, 'Pass');
  assert.equal(qualityCheck.summary, 'The company’s earnings are high quality');
  console.log('   ✅ Check 12 (Quality Earnings): PASS - The company’s earnings are high quality');

  // 13. Revenue and Earnings Forecast to Grow
  const growthCheck = checksById.get('revenue_earnings_growth_forecast');
  assert.ok(growthCheck, 'revenue_earnings_growth_forecast check present');
  assert.equal(growthCheck.status, 'PASS');
  assert.equal(growthCheck.verdict, 'Pass');
  assert.ok(growthCheck.summary.includes('Earnings are forecast to grow'));
  console.log(`   ✅ Check 13 (Growth Forecast): PASS - ${growthCheck.summary}`);

  // 14. Dividend Sustainable
  const divCheck = checksById.get('dividend_sustainability');
  assert.ok(divCheck, 'dividend_sustainability check present');
  assert.equal(divCheck.status, 'PASS');
  assert.equal(divCheck.verdict, 'Pass');
  assert.equal(divCheck.summary, 'Dividend is too low to be a concern');
  console.log('   ✅ Check 14 (Dividend Sustainability): PASS - Dividend is too low to be a concern');

  assert.equal(dossier.signals.summary.passed, 13);
  assert.equal(dossier.signals.summary.failed, 1);
  console.log('\n   🎯 Passed: All 14 risk checks evaluate and match target expected verdicts!\n');

  // -------------------------------------------------------------
  // Test 2: Unstructured & Custom Research Signals Support
  // -------------------------------------------------------------
  console.log('2️⃣  Testing Unstructured & Custom Research Signals Store...');
  assert.ok(dossier.signals.customSignals, 'customSignals must exist');
  assert.equal(dossier.signals.customSignals.researchThesis, 'Cloud + Enterprise AI compounder with high pricing power');
  assert.equal(dossier.signals.customSignals.esgRating, 'AAA');
  assert.equal(dossier.signals.customSignals.scuttlebuttNotes.length, 2);
  console.log('   ✅ Passed: Arbitrary unstructured signals and notes successfully stored in dossier.\n');

  // -------------------------------------------------------------
  // Test 3: Dynamic Signal Registration Extensibility
  // -------------------------------------------------------------
  console.log('3️⃣  Testing Dynamic Signal Registration Extensibility...');
  const customEngine = new SignalsEngine();
  customEngine.registerSignal({
    id: 'ai_capex_efficiency',
    category: 'Future AI Signals',
    question: 'Is AI capital expenditure generating proportionate cloud gross margin?',
    evaluate: (data) => ({
      status: 'PASS',
      verdict: 'Pass',
      summary: 'Azure AI gross margin remains resilient above 68%',
      details: { azureMargin: 68.5 }
    })
  });

  const customResult = customEngine.evaluateAll({
    profile: { ticker: 'MSFT' },
    market: { marketCap: 3e12, beta: 1.1 },
    financials: { latest: { netIncome: 8e10, revenue: 2e11, totalDebt: 7e10, cashAndEquivalents: 1e11, shareholdersEquity: 2e11 } }
  });

  assert.equal(customResult.summary.totalChecks, 15, 'Should have 14 default + 1 new custom signal');
  const aiCheck = customResult.riskChecks.find(c => c.id === 'ai_capex_efficiency');
  assert.ok(aiCheck, 'Custom signal must be present in evaluated list');
  assert.equal(aiCheck.status, 'PASS');
  assert.equal(aiCheck.summary, 'Azure AI gross margin remains resilient above 68%');
  console.log('   ✅ Passed: Dynamically registered new signal evaluated without modifying core schemas.\n');

  console.log('✨ All Investment & Research Signals Engine Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error('\n❌ Signals Engine Test Failed:', err);
  process.exit(1);
});

