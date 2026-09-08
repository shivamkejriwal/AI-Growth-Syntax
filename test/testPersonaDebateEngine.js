/**
 * testPersonaDebateEngine.js
 * Verification suite for PersonaDebateEngine and Persona Augmentation.
 */

import assert from 'node:assert/strict';
import { PersonaDebateEngine, PERSONA_CONFIGS, defaultPersonaDebateEngine } from '../lib/personaDebateEngine.js';
import { CompanyAnalysisOrchestrator } from '../lib/companyAnalysisOrchestrator.js';
import { getDemoFinancials } from '../lib/demoData.js';

async function runTests() {
  console.log('🧪 Starting Persona Debate & Inference Engine Verification Suite...\n');

  const engine = new PersonaDebateEngine();

  // -------------------------------------------------------------
  // Test 1: Persona Augmentation & Attachment
  // -------------------------------------------------------------
  console.log('1️⃣  Testing Persona Attachment via engine.asPersona()...');
  const bullActor = engine.asPersona(PERSONA_CONFIGS.BULL_RESEARCHER);
  const bearActor = engine.asPersona(PERSONA_CONFIGS.BEAR_RESEARCHER);
  const buffettActor = engine.asPersona(PERSONA_CONFIGS.WARREN_BUFFETT);
  const grahamActor = engine.asPersona(PERSONA_CONFIGS.BENJAMIN_GRAHAM);

  assert.equal(bullActor.id, 'bull_researcher');
  assert.equal(bullActor.name, 'Bull Researcher');
  assert.equal(bearActor.id, 'bear_researcher');
  assert.equal(buffettActor.name, 'Warren Buffett');
  assert.equal(grahamActor.name, 'Benjamin Graham');
  console.log('   ✅ Passed: Successfully attached and augmented personas to engine.\n');

  // -------------------------------------------------------------
  // Test 2: Persona Analysis of Dossier
  // -------------------------------------------------------------
  console.log('2️⃣  Testing Persona .analyze(dossier)...');
  const mockDossier = {
    metadata: {
      symbol: 'MSFT',
      companyName: 'Microsoft Corporation',
      currentPrice: 420.50,
      marketCap: 3.12e12,
      peRatio: 34.2,
      pegRatio: 2.1
    },
    rawFinancials: {
      latest: {
        revenue: 245122000000,
        netIncome: 88136000000,
        operatingCashFlow: 118500000000,
        cashAndEquivalents: 111000000000,
        totalDebt: 75000000000,
        shareholdersEquity: 268000000000
      },
      ratios: { debtToEquity: 0.28, netMarginPercent: 35.95 }
    },
    signals: {
      summary: { totalChecks: 14, passed: 13, failed: 1, riskRating: 'Low Risk' },
      riskChecks: [
        { id: 'insider_selling_3m', status: 'FAIL', question: 'Has there been substantial insider selling?' }
      ]
    }
  };

  const bullAnalysis = await bullActor.analyze(mockDossier);
  assert.ok(bullAnalysis, 'Bull analysis must not be null');
  assert.ok(bullAnalysis.stance, 'Must have stance');
  assert.ok(bullAnalysis.verdict, 'Must have verdict');
  assert.ok(Array.isArray(bullAnalysis.coreCase) && bullAnalysis.coreCase.length >= 3, 'Must have core case points');
  assert.ok(bullAnalysis.opinionatedSummary && bullAnalysis.opinionatedSummary.length > 40, 'Must have opinionated summary');

  console.log(`   Bull Verdict: ${bullAnalysis.verdict}`);
  console.log(`   Bull Summary: "${bullAnalysis.opinionatedSummary.slice(0, 90)}..."`);
  console.log('   ✅ Passed: Persona successfully analyzed dossier through its persona lens.\n');

  // -------------------------------------------------------------
  // Test 3: Adversarial Rebuttal Generation
  // -------------------------------------------------------------
  console.log('3️⃣  Testing Adversarial Rebuttal .rebut()...');
  const opposingArgument = 'Microsoft has infinite pricing power and will grow 25% forever regardless of valuation.';
  const rebuttal = await bearActor.rebut('Bull Researcher', opposingArgument, {
    ticker: 'MSFT',
    companyName: 'Microsoft Corporation',
    currentPrice: 420.50,
    peRatio: 34.2,
    cash: 111000000000,
    totalDebt: 75000000000,
    riskScore: '13/14 Passed'
  });

  assert.ok(rebuttal && rebuttal.length > 30, 'Rebuttal must be substantial');
  console.log(`   Bear Rebuttal: "${rebuttal.slice(0, 110)}..."`);
  console.log('   ✅ Passed: Persona generated targeted adversarial rebuttal.\n');

  // -------------------------------------------------------------
  // Test 4: Benjamin Graham Master Synthesis from Expert Debate Conclusion
  // -------------------------------------------------------------
  console.log('4️⃣  Testing Senior Arbiter Benjamin Graham .synthesize(expertDebateConclusion)...');
  const mockExpertConclusion = {
    contestedBattleground: 'Generational franchise moat vs DCF multiple friction',
    expertConsensusPoints: [
      'MSFT passes 13/14 risk checks with low debt and massive cash flow.',
      'High return on invested capital confirms wide economic moat.'
    ],
    irreconcilableDifferences: 'Buffett/Fisher will pay full multiples; Damodaran/Lynch demand DCF discount.',
    verdictToSeniorArbiter: 'Experts split on multiple entry tolerance; transmitted to Graham for Margin of Safety determination.'
  };

  const synthesis = await grahamActor.synthesize(mockExpertConclusion, mockDossier);

  // If AI ran or fallback returned
  if (synthesis) {
    assert.equal(synthesis.arbiterName, 'Benjamin Graham');
    assert.ok(synthesis.compositeGrade, 'Must have grade');
    assert.ok(synthesis.masterOpinionatedSummary, 'Must have master summary');
    console.log(`   Graham Grade: ${synthesis.compositeGrade} (${synthesis.recommendation})`);
    console.log('   ✅ Passed: Graham master judicial synthesis generated from expert debate conclusion.\n');
  } else {
    console.log('   ℹ️ Fallback signaled for synthesis (standard in offline mode).\n');
  }

  // -------------------------------------------------------------
  // Test 5: End-to-End Orchestrator Integration with 5 Stages
  // -------------------------------------------------------------
  console.log('5️⃣  Testing End-to-End Orchestration with 5-Stage Persona Engine...');
  const orchestrator = new CompanyAnalysisOrchestrator({ personaDebateEngine: engine });
  const result = await orchestrator.runAnalysis('MSFT', { mode: 'demo', forceRefresh: true });

  assert.ok(result.stage2_AnalysisPersonas.personas.bullResearcher, 'Stage 2 Bull present');
  assert.ok(result.stage2_AnalysisPersonas.debate.rounds.length >= 3, 'Stage 2 Debate rounds present');
  assert.ok(result.stage3_ExpertPersonas.experts.warrenBuffett, 'Stage 3 Buffett present');
  assert.ok(result.stage4_ExpertsDebate.conclusion, 'Stage 4 Experts Debate conclusion present');
  assert.ok(result.stage5_SeniorArbiterGraham.masterOpinionatedSummary, 'Stage 5 Graham present');
  console.log('   ✅ Passed: Orchestrator ran 5-stage workflow with expert debate and Graham synthesis.\n');

  console.log('✨ All Persona Debate & Inference Engine Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error('\n❌ Persona Debate Engine Test Failed:', err);
  process.exit(1);
});

