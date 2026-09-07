/**
 * seedFirestoreMock.js
 * Script to populate Cloud Firestore database with complete Mock Mode datasets
 * for AI-Growth-Syntax.
 */

import { FirestoreStore } from "../lib/db.js";
import { MockDataManager } from "../lib/mockDataManager.js";

async function main() {
  console.log("====================================================");
  console.log(" POPULATING CLOUD FIRESTORE FOR AI-GROWTH-SYNTAX");
  console.log(" Target: projects/ai-growth-syntax/databases/(default)");
  console.log(" Collection: growth_syntax_store");
  console.log("====================================================\n");

  const firestoreDb = new FirestoreStore({ projectId: "ai-growth-syntax" });
  const manager = new MockDataManager(firestoreDb);

  const startTime = Date.now();
  console.log("⏳ Seeding Mock Mode datasets into Cloud Firestore...");
  
  // Force seed by clearing seed flag check in this run
  await firestoreDb.delete("MOCK_SEEDED_STATUS_V3", "mock_system");
  await manager.ensureMockDataSeeded(firestoreDb);

  console.log("✅ Seeding completed in " + (Date.now() - startTime) + "ms\n");

  console.log("🔍 Verifying Firestore persistence...");

  // 1. Verify MSFT Company Data
  const msft = await manager.getMockCompanyData("MSFT", firestoreDb);
  console.log("  - [mock_companies] MSFT:", msft?._meta?.ticker ? "✅ OK (Ticker: " + msft._meta.ticker + ", Name: " + msft.profile.name + ")" : "❌ FAIL");

  // 2. Verify Macro Snapshot
  const macro = await manager.getMockMacro(firestoreDb);
  console.log("  - [mock_macro] Snapshot:", macro?.riskFreeRatePercent ? "✅ OK (Rf: " + macro.riskFreeRatePercent + "%, CPI: " + macro.yoyCPIInflationPercent + "%)" : "❌ FAIL");

  // 3. Verify Competitors
  const comps = await manager.getMockCompetitors("MSFT", firestoreDb);
  console.log("  - [mock_competitors] MSFT:", comps?.peers?.length ? "✅ OK (" + comps.peers.length + " peers discovered)" : "❌ FAIL");

  // 4. Verify Institutional Desk
  const inst = await manager.getMockInstitutional("MSFT", firestoreDb);
  console.log("  - [mock_institutional] MSFT:", inst?.traderProposal ? "✅ OK (Conviction: " + inst.traderProposal.conviction + ", Action: " + inst.traderProposal.action + ")" : "❌ FAIL");

  // 5. Verify Experts Desk
  const exp = await manager.getMockExpertsDesk("MSFT", firestoreDb);
  console.log("  - [mock_experts_desk] MSFT:", exp?.arbiterSynthesis ? "✅ OK (Arbiter: " + exp.arbiterSynthesis.arbiterName + ", Grade: " + exp.arbiterSynthesis.qualityGrade + ")" : "❌ FAIL");

  // 6. Verify Fodda Earnings
  const fodda = await manager.getMockFodda("MSFT", firestoreDb);
  console.log("  - [mock_fodda] MSFT:", fodda?.quarter ? "✅ OK (" + fodda.quarter + ")" : "❌ FAIL");

  // 7. Verify Seeking Alpha
  const sa = await manager.getMockSeekingAlpha("MSFT", firestoreDb);
  console.log("  - [mock_seeking_alpha] MSFT:", sa?.articles?.length ? "✅ OK (" + sa.articles.length + " articles)" : "❌ FAIL");

  console.log("\n====================================================");
  console.log(" 🎉 CLOUD FIRESTORE SUCCESSFULLY POPULATED!");
  console.log(" Console: https://console.firebase.google.com/project/ai-growth-syntax/firestore/databases/-default-/data");
  console.log("====================================================");
}

main().catch(err => {
  console.error("❌ Fatal Error Seeding Firestore:", err);
  process.exit(1);
});
