/**
 * testMockMode.js
 * Verification test suite for AI-Growth-Syntax Mock Mode.
 */

import assert from "node:assert";
import { defaultMockDataManager } from "../lib/mockDataManager.js";
import { defaultDb } from "../lib/db.js";
import { CompositeInvestor } from "../lib/compositeInvestor.js";

console.log("====================================================");
console.log(" AI-GROWTH-SYNTAX: MOCK MODE TEST SUITE");
console.log("====================================================\n");

let passed = 0;
let total = 0;

async function test(desc, fn) {
  total++;
  try {
    await fn();
    console.log("✅ PASS: " + desc);
    passed++;
  } catch (err) {
    console.error("❌ FAIL: " + desc);
    console.error(err);
  }
}

async function runTests() {
  // 1. MockDataManager Seeding
  await test("MockDataManager: seeds all mock datasets into DB", async () => {
    const seeded = await defaultMockDataManager.ensureMockDataSeeded(defaultDb);
    assert.strictEqual(seeded, true);
  });

  // 2. Mock Company Data Retrieval from DB
  await test("MockDataManager: getMockCompanyData retrieves MSFT from DB with storage metadata", async () => {
    const data = await defaultMockDataManager.getMockCompanyData("MSFT", defaultDb);
    assert.ok(data);
    assert.strictEqual(data._meta.ticker, "MSFT");
    assert.strictEqual(data.profile.ticker, "MSFT");
    assert.ok(data.financials && data.financials.annualHistory && data.financials.annualHistory.length > 0);
    assert.ok(data._storageMetadata);
    assert.strictEqual(data._storageMetadata.isMock, true);
    assert.ok(["sql_mock", "firestore_mock"].includes(data._storageMetadata.retrievalSource));
  });

  // 3. CompositeInvestor getStandardCompanyData in mock mode
  await test("CompositeInvestor: getStandardCompanyData pulls mock data from DB in mock mode", async () => {
    const investor = new CompositeInvestor();
    const standard = await investor.getStandardCompanyData("MSFT", { mode: "mock" });
    assert.ok(standard);
    assert.strictEqual(standard.profile.ticker, "MSFT");
    assert.ok(standard._storageMetadata);
    assert.strictEqual(standard._storageMetadata.isMock, true);
  });

  // 4. CompositeInvestor getCompositeDossier in mock mode renders all visuals
  await test("CompositeInvestor: getCompositeDossier generates full visuals for complete app rendering", async () => {
    const investor = new CompositeInvestor();
    const dossier = await investor.getCompositeDossier("MSFT", { mode: "mock" });
    assert.ok(dossier);
    assert.strictEqual(dossier.metadata.symbol, "MSFT");

    // Overview visuals
    assert.ok(dossier.equityVisuals, "dossier.equityVisuals must exist");
    assert.ok(dossier.equityVisuals.snowflakeScores, "snowflakeScores must exist");
    assert.strictEqual(typeof dossier.equityVisuals.snowflakeScores.totalScore, "number");
    assert.ok(dossier.equityVisuals.sharePriceVsFairValue, "sharePriceVsFairValue must exist");
    assert.ok(dossier.equityVisuals.revenueExpensesFlow, "revenueExpensesFlow must exist");
    assert.ok(dossier.equityVisuals.financialHealth, "financialHealth must exist");

    // 4-Pillars
    assert.ok(dossier.pillar1_Lynch, "pillar1_Lynch must exist");
    assert.ok(dossier.pillar2_Fisher, "pillar2_Fisher must exist");
    assert.ok(dossier.pillar3_Buffett, "pillar3_Buffett must exist");
    assert.ok(dossier.pillar4_Damodaran, "pillar4_Damodaran must exist");

    // Additional modules
    assert.ok(dossier.grahamValuation, "grahamValuation must exist");
    assert.ok(dossier.competitorAnalysis, "competitorAnalysis must exist");
    assert.ok(dossier.rawFinancials, "rawFinancials must exist");
  });

  // 5. Mock Macro Retrieval from DB
  await test("MockDataManager: getMockMacro retrieves macro dataset from DB", async () => {
    const macro = await defaultMockDataManager.getMockMacro(defaultDb);
    assert.ok(macro);
    assert.ok(macro.riskFreeRatePercent !== undefined);
    assert.ok(macro.effectiveFedFundsRate !== undefined);
    assert.ok(macro.yoyCPIInflationPercent !== undefined);
  });

  // 6. Mock Competitors Retrieval from DB
  await test("MockDataManager: getMockCompetitors retrieves competitor peer matrix from DB", async () => {
    const comps = await defaultMockDataManager.getMockCompetitors("MSFT", defaultDb);
    assert.ok(comps);
    assert.ok(comps.targetSymbol || comps.targetTicker);
    assert.ok(comps.peers && comps.peers.length > 0);
  });

  // 7. Mock Institutional Desk Retrieval from DB
  await test("MockDataManager: getMockInstitutional retrieves desk simulation from DB", async () => {
    const desk = await defaultMockDataManager.getMockInstitutional("MSFT", defaultDb);
    assert.ok(desk);
    assert.ok(desk.success || desk.status === "success");
    assert.ok(desk.traderProposal);
    assert.ok(desk.portfolioDecision);
    assert.ok(desk.researchDebate);
    assert.ok(desk.researchPlan);
    assert.ok(desk.riskDebate);
  });

  // 8. Mock Experts Desk Retrieval from DB
  await test("MockDataManager: getMockExpertsDesk retrieves legends debate from DB", async () => {
    const debate = await defaultMockDataManager.getMockExpertsDesk("MSFT", defaultDb);
    assert.ok(debate);
    assert.ok(debate.success || debate.status === "success");
    assert.ok(debate.arbiterSynthesis);
    assert.ok(debate.scorecardMatrix);
    assert.ok(debate.debate && (Array.isArray(debate.debate) ? debate.debate.length > 0 : debate.debate.turns?.length > 0));
  });

  console.log("\n====================================================");
  console.log("TEST RESULTS: " + passed + "/" + total + " PASSED");
  console.log("====================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
