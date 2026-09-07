/**
 * Unit & Integration Test Suite for Experts Desk & Multi-Agent Debate Engine
 */

import assert from 'node:assert';
import { CompositeInvestor } from '../lib/compositeInvestor.js';
import { ExpertsDesk } from '../lib/expertsDesk.js';

console.log('====================================================');
console.log(' EXPERTS DESK & MULTI-AGENT LEGENDS TEST SUITE');
console.log('====================================================\n');

async function runTests() {
  let passed = 0;
  const investor = new CompositeInvestor();
  const expertsDesk = new ExpertsDesk(investor);

  // Test 1: Run Experts Debate for MSFT
  try {
    const result = await expertsDesk.runExpertsDebate('MSFT', { mode: 'demo' });
    assert(result.success === true, 'Result should succeed');
    assert.strictEqual(result.ticker, 'MSFT', 'Ticker should be MSFT');
    assert(result.arbiterSynthesis, 'Should have Benjamin Graham arbiter synthesis');
    assert(result.scorecardMatrix, 'Should have scorecard matrix');
    assert(result.debate, 'Should have multi-turn debate');

    // Verify Arbiter
    assert.strictEqual(result.arbiterSynthesis.arbiterName, 'Benjamin Graham', 'Arbiter should be Benjamin Graham');
    assert(result.arbiterSynthesis.qualityGrade, 'Should have quality grade');
    assert(result.arbiterSynthesis.consensusScore, 'Should have consensus score');
    assert(result.arbiterSynthesis.marginOfSafety, 'Should have margin of safety');
    assert(result.arbiterSynthesis.recommendedAllocation, 'Should have recommended allocation');

    console.log('✅ PASS: Experts Desk: Generates Benjamin Graham arbiter synthesis & margin of safety');
    passed++;
  } catch (err) {
    console.error('❌ FAIL: Experts Desk arbiter synthesis failed:', err);
  }

  // Test 2: 4-Legend Scorecard Matrix
  try {
    const result = await expertsDesk.runExpertsDebate('MSFT', { mode: 'demo' });
    const matrix = result.scorecardMatrix;
    assert(Array.isArray(matrix), 'Matrix should be an array');
    assert.strictEqual(matrix.length, 4, 'Matrix should contain all 4 legends');

    const legendIds = matrix.map(m => m.expertId);
    assert(legendIds.includes('buffett'), 'Should include Warren Buffett');
    assert(legendIds.includes('lynch'), 'Should include Peter Lynch');
    assert(legendIds.includes('fisher'), 'Should include Philip Fisher');
    assert(legendIds.includes('damodaran'), 'Should include Aswath Damodaran');

    matrix.forEach(m => {
      assert(m.primaryMetric, `Legend ${m.name} should have primary metric`);
      assert(m.stance, `Legend ${m.name} should have stance`);
      assert(m.holdingPeriod, `Legend ${m.name} should have holding period`);
      assert(m.targetWeight, `Legend ${m.name} should have target weight`);
    });

    console.log('✅ PASS: Experts Desk: Generates comprehensive 4-Legend Scorecard Matrix (Buffett, Lynch, Fisher, Damodaran)');
    passed++;
  } catch (err) {
    console.error('❌ FAIL: 4-Legend Scorecard Matrix failed:', err);
  }

  // Test 3: Multi-Turn Debate Turns Structure
  try {
    const result = await expertsDesk.runExpertsDebate('NVDA', { mode: 'demo' });
    const debate = result.debate;
    assert(debate.turns && Array.isArray(debate.turns), 'Debate should have turns');
    assert.strictEqual(debate.turns.length, 12, 'Debate should contain 12 turns (3 rounds x 4 legends)');

    // Verify Rounds 1, 2, 3
    const r1 = debate.turns.filter(t => t.round === 1);
    const r2 = debate.turns.filter(t => t.round === 2);
    const r3 = debate.turns.filter(t => t.round === 3);
    assert.strictEqual(r1.length, 4, 'Round 1 should have 4 opening arguments');
    assert.strictEqual(r2.length, 4, 'Round 2 should have 4 cross-rebuttals');
    assert.strictEqual(r3.length, 4, 'Round 3 should have 4 final allocation votes');

    debate.turns.forEach(t => {
      assert(t.speaker, 'Turn should have speaker');
      assert(t.quote, 'Turn should have quote');
      assert(t.argument && t.argument.length > 50, 'Turn should have in-depth argument');
    });

    console.log('✅ PASS: Experts Desk: Generates 3-round multi-turn clash with first principles, cross-rebuttal & final votes');
    passed++;
  } catch (err) {
    console.error('❌ FAIL: Multi-turn debate turns failed:', err);
  }

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ALL ${passed}/3 EXPERTS DESK TESTS PASSED`);
  console.log('====================================================\n');
  if (passed !== 3) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

