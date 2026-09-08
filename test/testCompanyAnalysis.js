/**
 * testCompanyAnalysis.js
 * Verification suite for the Multi-Persona Company Analysis Workflow:
 * Company -> Raw Data -> Dossier -> 5 Analysis Personas -> 4 Expert Personas -> Senior Arbiter Benjamin Graham
 */

import assert from 'node:assert/strict';
import { CompanyAnalysisOrchestrator } from '../lib/companyAnalysisOrchestrator.js';
import { handleRequest } from '../server.js';

async function runTests() {
  console.log('🧪 Starting Multi-Persona Company Analysis Verification Suite...\n');

  const orchestrator = new CompanyAnalysisOrchestrator();

  // -------------------------------------------------------------
  // Test 1: Full 4-Stage Workflow Execution for MSFT
  // -------------------------------------------------------------
  console.log('1️⃣  Testing Full 4-Stage Multi-Persona Workflow for MSFT...');
  const result = await orchestrator.runAnalysis('MSFT', { mode: 'demo', forceRefresh: true });

  assert.ok(result, 'Analysis result must not be null');
  assert.ok(result._meta, 'Must include _meta');
  assert.equal(result._meta.ticker, 'MSFT');

  // Stage 1: Dossier Summary
  console.log('   Auditing Stage 1: Company Dossier & Risk Checks Briefing...');
  assert.ok(result.stage1_DossierSummary, 'Stage 1 Dossier Summary must be present');
  assert.equal(result.stage1_DossierSummary.ticker, 'MSFT');
  assert.ok(result.stage1_DossierSummary.riskChecks.length >= 14, 'Must include 14 risk checks');
  console.log(`   ✅ Stage 1 OK: ${result.stage1_DossierSummary.riskScore} passed, Rating: ${result.stage1_DossierSummary.riskRating}`);

  // Stage 2: 5 Analysis Personas & Debate
  console.log('   Auditing Stage 2: 5 Analysis Personas (Cases, Summaries & Rebuttals)...');
  const stage2 = result.stage2_AnalysisPersonas;
  assert.ok(stage2.personas, 'Stage 2 personas must be present');

  const p = stage2.personas;
  assert.ok(p.bullResearcher, 'Bull Researcher present');
  assert.ok(p.bearResearcher, 'Bear Researcher present');
  assert.ok(p.aggressiveRiskDebater, 'Aggressive Risk Debater present');
  assert.ok(p.conservativeRiskDebater, 'Conservative Risk Debater present');
  assert.ok(p.neutralRiskArbiter, 'Neutral Risk Arbiter present');

  // Verify each persona has coreCase and opinionatedSummary
  for (const [key, persona] of Object.entries(p)) {
    assert.ok(persona.title, `${key} must have title`);
    assert.ok(Array.isArray(persona.coreCase) && persona.coreCase.length >= 3, `${key} must have detailed coreCase`);
    assert.ok(persona.opinionatedSummary && persona.opinionatedSummary.length > 50, `${key} must have rich opinionatedSummary`);
  }
  console.log('   ✅ All 5 Analysis Personas have robust cases and opinionated summaries.');

  // Verify multi-turn debate and rebuttals
  assert.ok(stage2.debate?.rounds?.length >= 3, 'Must have 3 debate rounds');
  assert.ok(stage2.debate?.conclusion, 'Must have debate conclusion');
  assert.ok(stage2.debate.conclusion.contestedBattleground, 'Must detail contested battleground');
  assert.ok(stage2.debate.conclusion.verdictToExperts, 'Must define verdict sent to experts');
  console.log('   ✅ Multi-turn debate with direct rebuttals and conclusion verified.');

  // Stage 3: 4 Expert Personas
  console.log('   Auditing Stage 3: 4 Legendary Expert Personas...');
  const stage3 = result.stage3_ExpertPersonas;
  assert.ok(stage3.debateFedToExperts, 'Debate conclusion must be fed to experts');
  assert.ok(stage3.experts, 'Experts must be present');

  const exp = stage3.experts;
  assert.ok(exp.warrenBuffett, 'Warren Buffett present');
  assert.ok(exp.peterLynch, 'Peter Lynch present');
  assert.ok(exp.philipFisher, 'Philip Fisher present');
  assert.ok(exp.aswathDamodaran, 'Aswath Damodaran present');

  for (const [key, expert] of Object.entries(exp)) {
    assert.ok(expert.name, `${key} must have name`);
    assert.ok(expert.philosophy, `${key} must have philosophy`);
    assert.ok(Array.isArray(expert.caseAnalysis) && expert.caseAnalysis.length >= 3, `${key} must have caseAnalysis`);
    assert.ok(expert.opinionatedSummary && expert.opinionatedSummary.length > 40, `${key} must have opinionatedSummary`);
  }
  console.log('   ✅ All 4 Expert Personas evaluated dossier + debate and generated opinionated summaries.');

  // Stage 4: Legendary Experts Debate
  console.log('   Auditing Stage 4: Legendary Experts Debate (Buffett vs Lynch vs Fisher vs Damodaran)...');
  const stage4 = result.stage4_ExpertsDebate;
  assert.ok(stage4, 'Stage 4 Experts Debate must be present');
  assert.ok(Array.isArray(stage4.rounds) && stage4.rounds.length >= 2, 'Experts Debate must contain at least 2 debate rounds');
  assert.ok(stage4.conclusion, 'Experts Debate must contain final conclusion');
  assert.ok(Array.isArray(stage4.conclusion.expertConsensusPoints), 'Conclusion must contain expert consensus points');
  assert.ok(stage4.conclusion.contestedBattleground, 'Conclusion must specify contested battleground');
  assert.ok(stage4.conclusion.verdictToSeniorArbiter, 'Conclusion must include mandate transmitted to Graham');
  console.log('   ✅ Stage 4 OK: Expert debate rounds and conclusion verified.');

  // Stage 5: Senior Arbiter Benjamin Graham
  console.log('   Auditing Stage 5: Senior Arbiter Benjamin Graham Master Adjudication...');
  const stage5 = result.stage5_SeniorArbiterGraham;
  assert.ok(stage5, 'Benjamin Graham output must be present');
  assert.equal(stage5.arbiterName, 'Benjamin Graham');
  assert.ok(stage5.compositeGrade, 'Must have composite grade');
  assert.ok(stage5.recommendation, 'Must have actionable recommendation');
  assert.ok(stage5.masterOpinionatedSummary && stage5.masterOpinionatedSummary.length > 150, 'Must have master opinionated essay');
  assert.ok(stage5.criticalInvalidationTriggers?.length >= 3, 'Must have critical invalidation triggers');
  // Check backward compatibility alias
  assert.ok(result.stage4_SeniorArbiterGraham, 'Must preserve stage4_SeniorArbiterGraham alias');
  console.log(`   ✅ Benjamin Graham Master Verdict: ${stage5.compositeGrade} (${stage5.recommendation})`);

  console.log('   🎯 Test 1 Passed: Complete 5-stage sequential workflow executed flawlessly!\n');

  // -------------------------------------------------------------
  // Test 2: Server API Endpoint /api/company-analysis
  // -------------------------------------------------------------
  console.log('2️⃣  Testing HTTP API Endpoint /api/company-analysis?ticker=MSFT...');
  let responseData = null;
  let statusCode = 0;

  const mockReq = {
    url: '/api/company-analysis?ticker=MSFT&mode=demo',
    method: 'GET',
    headers: { host: 'localhost:3000' }
  };

  const mockRes = {
    writeHead: (code, headers) => { statusCode = code; },
    end: (body) => {
      try {
        responseData = JSON.parse(body);
      } catch (e) {
        responseData = body;
      }
    }
  };

  await handleRequest(mockReq, mockRes);
  assert.equal(statusCode, 200, 'Endpoint must return HTTP 200');
  assert.ok(responseData, 'Response data must not be null');
  assert.equal(responseData._meta.ticker, 'MSFT');
  assert.ok(responseData.stage2_AnalysisPersonas.personas.bullResearcher, 'API payload contains Stage 2 Bull Researcher');
  assert.ok(responseData.stage3_ExpertPersonas.experts.warrenBuffett, 'API payload contains Stage 3 Warren Buffett');
  assert.ok(responseData.stage4_SeniorArbiterGraham.masterOpinionatedSummary, 'API payload contains Stage 4 Graham Summary');
  console.log('   ✅ HTTP /api/company-analysis successfully returned structured multi-persona JSON.\n');

  console.log('✨ All Multi-Persona Company Analysis Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});

