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

  // 9. Mock DuckDuckGo Retrieval from DB
  await test("MockDataManager: getMockDuckDuckGo retrieves instant answer and 4 investigation vectors", async () => {
    const ddg = await defaultMockDataManager.getMockDuckDuckGo("MSFT", defaultDb);
    assert.ok(ddg, "DDG mock object must exist");
    assert.strictEqual(ddg.symbol, "MSFT");
    assert.ok(ddg.instantAnswer, "instantAnswer must exist");
    assert.ok(ddg.instantAnswer.heading, "instantAnswer heading must exist");
    assert.ok(ddg.instantAnswer.abstract, "instantAnswer abstract must exist");
    assert.ok(Array.isArray(ddg.instantAnswer.relatedTopics), "relatedTopics must be an array");
    assert.ok(Array.isArray(ddg.investigationVectors), "investigationVectors must be an array");
    assert.strictEqual(ddg.investigationVectors.length, 4, "Must have 4 scuttlebutt vectors");
    const categories = ddg.investigationVectors.map(v => v.category);
    assert.ok(categories.includes("Competitors & Moat"));
    assert.ok(categories.includes("Customer Sentiment & Churn"));
    assert.ok(categories.includes("Supply Chain & Regulatory"));
    assert.ok(categories.includes("Recent News & Catalysts"));
  });

  // 10. Mock Seeking Alpha Feed Retrieval from DB
  await test("MockDataManager: getMockSeekingAlpha retrieves consensus, sentiment summary, and categorized articles", async () => {
    const sa = await defaultMockDataManager.getMockSeekingAlpha("MSFT", defaultDb);
    assert.ok(sa, "Seeking Alpha mock object must exist");
    assert.strictEqual(sa.ticker, "MSFT");
    assert.strictEqual(sa.consensusSentiment, "Bullish");
    assert.ok(sa.sentimentSummary, "sentimentSummary must exist");
    assert.ok(sa.sentimentSummary.bullish > 0, "bullish count must be > 0");
    assert.ok(Array.isArray(sa.coMentionedPeers), "coMentionedPeers must be an array");
    assert.ok(sa.coMentionedPeers.length > 0, "coMentionedPeers must have peer entries");
    assert.ok(Array.isArray(sa.articles), "articles must be an array");
    assert.ok(sa.articles.length > 0, "articles must not be empty");
    const firstArt = sa.articles[0];
    assert.ok(firstArt.title);
    assert.ok(firstArt.category);
    assert.ok(firstArt.sentiment);
    assert.ok(firstArt.timeAgo);
  });

  // 11. Scuttlebutt Completeness inside Composite Dossier (Mock Mode)
  await test("CompositeInvestor: dossier.pillar2_Fisher contains complete scuttlebutt intelligence", async () => {
    const investor = new CompositeInvestor();
    const dossier = await investor.getCompositeDossier("MSFT", { mode: "mock" });
    const p2 = dossier.pillar2_Fisher;
    assert.ok(p2, "pillar2_Fisher must exist");
    
    // DuckDuckGo
    assert.ok(p2.duckduckgoIntel, "duckduckgoIntel must exist");
    assert.ok(p2.duckduckgoIntel.instantAnswer, "instantAnswer must exist");
    assert.strictEqual(p2.duckduckgoIntel.investigationVectors.length, 4);

    // Seeking Alpha
    assert.ok(p2.seekingAlphaIntel, "seekingAlphaIntel must exist");
    assert.strictEqual(p2.seekingAlphaIntel.consensusSentiment, "Bullish");

    // Developer Moat & HN
    assert.ok(p2.techMoat_GitHub || p2.developerMoat);
    assert.ok(p2.engineerSentiment_HN || p2.engineeringSentiment);

    // Fisher Fieldwork & Checklist
    assert.ok(p2.fiveCirclesScript || p2.fiveCirclesInterviewScript);
    assert.ok(p2.fisher15Points || p2.fisher15PointChecklist);
  });

  console.log("\n====================================================");
  console.log("TEST RESULTS: " + passed + "/" + total + " PASSED");
  console.log("====================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
