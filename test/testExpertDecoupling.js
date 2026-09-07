/**
 * testExpertDecoupling.js
 * Verification suite demonstrating complete decoupling of:
 * 1. Standardized Company Financial Data (Stored in Cache & DB under namespace 'companies')
 * 2. Pure Expert Inference Engine (Stateless analytical processors: Lynch, Buffett, Fisher, Damodaran, Graham)
 */

import assert from 'node:assert/strict';
import { CompositeInvestor } from '../lib/compositeInvestor.js';
import { ExpertInferenceEngine } from '../lib/expertInferenceEngine.js';
import { defaultDb } from '../lib/db.js';
import { handleRequest } from '../server.js';

async function runTests() {
  console.log('🧪 Starting Expert Decoupling & Standardized Company Storage Test Suite...\n');

  const investor = new CompositeInvestor();
  const testTicker = 'MSFT';
  const companyKey = `COMPANY_${testTicker}`;
  const namespace = 'companies';

  // -------------------------------------------------------------
  // Test 1: Ingestion & Storage of Pure Company Data (Zero Expert Fields)
  // -------------------------------------------------------------
  console.log('1️⃣  Testing Standardized Company Data Ingestion (Pure Facts & Financials)...');
  const companyData = await investor.getStandardCompanyData(testTicker, {
    mode: 'demo',
    persistDemo: true
  });

  assert.ok(companyData, 'Company data must not be null');
  assert.equal(companyData._meta?.schemaVersion, '3.0.0');
  assert.equal(companyData._meta?.dataType, 'StandardCompanyData');
  assert.equal(companyData.profile?.ticker, testTicker);
  assert.equal(companyData.profile?.name, 'Microsoft Corporation');

  // Verify all standard factual sections exist
  assert.ok(companyData.profile, 'Profile section present');
  assert.ok(companyData.market, 'Market section present');
  assert.ok(companyData.financials, 'Financials section present');
  assert.ok(Array.isArray(companyData.financials.annualHistory), 'Annual history array present');
  assert.ok(companyData.financials.ratios, 'Standard financial ratios present');
  assert.ok(companyData.secFilings, 'SEC filings present');
  assert.ok(companyData.competitors, 'Competitors present');
  assert.ok(companyData.macroEnvironment, 'Macro environment present');

  // CRITICAL: Ensure ZERO expert-specific fields in the stored data
  assert.equal(companyData.pillar1_Lynch, undefined, 'Must NOT contain pillar1_Lynch');
  assert.equal(companyData.pillar2_Fisher, undefined, 'Must NOT contain pillar2_Fisher');
  assert.equal(companyData.pillar3_Buffett, undefined, 'Must NOT contain pillar3_Buffett');
  assert.equal(companyData.pillar4_Damodaran, undefined, 'Must NOT contain pillar4_Damodaran');
  assert.equal(companyData.peterLynch, undefined, 'Must NOT contain peterLynch');
  assert.equal(companyData.warrenBuffett, undefined, 'Must NOT contain warrenBuffett');
  assert.equal(companyData.decisionMemo, undefined, 'Must NOT contain decisionMemo');

  console.log('   ✅ Passed: Standardized Company Data verified with ZERO expert fields.\n');

  // -------------------------------------------------------------
  // Test 2: Verify SQLite DB Storage under namespace 'companies'
  // -------------------------------------------------------------
  console.log('2️⃣  Verifying SQLite DB Storage under namespace "companies"...');
  const dbRecord = defaultDb.get(companyKey, namespace);
  assert.ok(dbRecord, 'Record must exist in SQLite DB under namespace companies');
  assert.equal(dbRecord.profile.ticker, testTicker);
  assert.equal(dbRecord.pillar1_Lynch, undefined, 'DB record must be expert-free');
  console.log('   ✅ Passed: SQLite DB holds pure, objective company financials.\n');

  // -------------------------------------------------------------
  // Test 3: Run Pure Expert Inference on Stored Data
  // -------------------------------------------------------------
  console.log('3️⃣  Testing Pure Expert Inference Execution on Stored Company Data...');
  const inference = ExpertInferenceEngine.runAll(companyData);

  assert.ok(inference.experts, 'Experts object present');
  assert.ok(inference.experts.peterLynch, 'Peter Lynch analyzer output present');
  assert.ok(inference.experts.warrenBuffett, 'Warren Buffett analyzer output present');
  assert.ok(inference.experts.philipFisher, 'Philip Fisher analyzer output present');
  assert.ok(inference.experts.aswathDamodaran, 'Aswath Damodaran analyzer output present');
  assert.ok(inference.experts.benjaminGraham, 'Benjamin Graham analyzer output present');
  assert.ok(inference.synthesis, 'Executive synthesis present');

  // Verify Lynch computed metrics from standardized data
  assert.ok(inference.experts.peterLynch.category, 'Lynch classification computed');
  assert.ok(typeof inference.experts.peterLynch.pegRatio === 'number', 'Lynch PEG ratio computed');

  // Verify Buffett computed metrics
  assert.ok(inference.experts.warrenBuffett.averageROIC, 'Buffett average ROIC computed');
  assert.ok(inference.experts.warrenBuffett.economicMoatRating, 'Buffett Moat rating computed');

  // Verify Damodaran DCF and WACC
  assert.ok(inference.experts.aswathDamodaran.costOfCapital.waccPercent > 0, 'Damodaran WACC computed');
  assert.ok(inference.experts.aswathDamodaran.dcfModel.intrinsicValuePerShare > 0, 'Damodaran DCF intrinsic value computed');

  // Verify Graham Net-Net
  assert.ok(typeof inference.experts.benjaminGraham.ncavPerShare === 'number', 'Graham NCAV computed');

  console.log('   ✅ Passed: All 5 experts executed inference successfully as pure functions.\n');

  // -------------------------------------------------------------
  // Test 4: Data Invariance (Modifying Expert Options Doesn't Touch Stored Data)
  // -------------------------------------------------------------
  console.log('4️⃣  Testing Data Invariance (Tuning Experts without Touching DB)...');
  const customInference = ExpertInferenceEngine.runAll(companyData, { rndYears: 5 });
  assert.equal(customInference.experts.aswathDamodaran.rndNormalization.amortizationYears, 5);

  // Stored record in DB remains identical and untouched
  const dbRecordAfter = defaultDb.get(companyKey, namespace);
  assert.equal(dbRecordAfter.profile.ticker, testTicker);
  assert.equal(dbRecordAfter.pillar1_Lynch, undefined);
  console.log('   ✅ Passed: Stored company data is invariant to expert parameter changes.\n');

  // -------------------------------------------------------------
  // Test 5: HTTP Server Routes (/api/company and /api/experts)
  // -------------------------------------------------------------
  console.log('5️⃣  Testing HTTP Server Endpoints (/api/company and /api/experts)...');
  
  // Test /api/company
  let companyResStatus = null;
  let companyResData = '';
  await handleRequest(
    { method: 'GET', url: `/api/company?ticker=${testTicker}&mode=demo`, headers: { host: 'localhost:3000' }, on: () => {} },
    { writeHead: (s) => { companyResStatus = s; }, end: (b) => { companyResData = b; } }
  );
  assert.equal(companyResStatus, 200);
  const parsedCompany = JSON.parse(companyResData);
  assert.equal(parsedCompany.companyData.profile.ticker, testTicker);
  assert.equal(parsedCompany.companyData.pillar1_Lynch, undefined, '/api/company must be pure data');

  // Test /api/experts
  let expertsResStatus = null;
  let expertsResData = '';
  await handleRequest(
    { method: 'GET', url: `/api/experts?ticker=${testTicker}&mode=demo`, headers: { host: 'localhost:3000' }, on: () => {} },
    { writeHead: (s) => { expertsResStatus = s; }, end: (b) => { expertsResData = b; } }
  );
  assert.equal(expertsResStatus, 200);
  const parsedExperts = JSON.parse(expertsResData);
  assert.equal(parsedExperts.ticker, testTicker);
  assert.ok(parsedExperts.experts.warrenBuffett);
  assert.ok(parsedExperts.experts.aswathDamodaran);
  assert.ok(parsedExperts.synthesis);

  console.log('   ✅ Passed: /api/company serves pure data; /api/experts serves pure inference.\n');

  console.log('🎉 ALL 5 EXPERT DECOUPLING TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

