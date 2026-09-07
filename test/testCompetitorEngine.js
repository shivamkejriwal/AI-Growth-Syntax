/**
 * test/testCompetitorEngine.js
 * Unit and integration tests for CompetitorEngine.
 */

import assert from 'node:assert';
import { CompetitorEngine, CURATED_PEER_MAP } from '../lib/competitorEngine.js';

async function runCompetitorEngineTests() {
  console.log('====================================================');
  console.log(' COMPETITOR ENGINE UNIT TESTS');
  console.log('====================================================\n');

  const engine = new CompetitorEngine();

  // Test 1: Curated map sanity
  assert.ok(CURATED_PEER_MAP.MSFT);
  assert.ok(CURATED_PEER_MAP.NVDA);
  assert.ok(CURATED_PEER_MAP.AAPL);
  assert.ok(CURATED_PEER_MAP.MSFT.peers.length >= 4);
  console.log('✅ PASS: Curated peer mapping covers major enterprise tickers (MSFT, NVDA, AAPL)');

  // Test 2: MSFT competitor analysis
  const msft = await engine.getCompetitorAnalysis('MSFT', 'Microsoft Corporation');
  assert.ok(msft);
  assert.strictEqual(msft.targetSymbol, 'MSFT');
  assert.ok(msft.sicCode);
  assert.ok(Array.isArray(msft.peers));
  assert.ok(msft.peers.length >= 3);
  assert.ok(msft.targetMetrics);
  assert.ok(typeof msft.targetMetrics.peRatio === 'number');
  assert.ok(msft.benchmarks.peerMedianPE > 0);
  assert.ok(msft.executiveTakeaway);
  console.log(`✅ PASS: getCompetitorAnalysis('MSFT') -> ${msft.peers.length} peers, median P/E: ${msft.benchmarks.peerMedianPE}x`);

  // Test 3: NVDA competitor analysis & semiconductor rivalry
  const nvda = await engine.getCompetitorAnalysis('NVDA', 'NVIDIA Corporation');
  assert.ok(nvda);
  assert.strictEqual(nvda.targetSymbol, 'NVDA');
  assert.ok(nvda.peers.some(p => p.ticker === 'AMD'));
  assert.ok(nvda.peers.some(p => p.ticker === 'INTC'));
  console.log("✅ PASS: getCompetitorAnalysis('NVDA') accurately identifies AMD and INTC as rivals");

  // Test 4: Arbitrary ticker resolution & fallback
  const arbitrary = await engine.getCompetitorAnalysis('PLTR', 'Palantir Technologies');
  assert.ok(arbitrary);
  assert.strictEqual(arbitrary.targetSymbol, 'PLTR');
  assert.ok(Array.isArray(arbitrary.peers));
  assert.ok(arbitrary.peers.length > 0);
  console.log(`✅ PASS: getCompetitorAnalysis('PLTR') dynamically produced ${arbitrary.peers.length} peers with comparison metrics`);

  console.log('\n====================================================');
  console.log(' ALL COMPETITOR ENGINE TESTS PASSED');
  console.log('====================================================\n');
}

runCompetitorEngineTests().catch(err => {
  console.error('❌ Competitor Engine Test Failed:', err);
  process.exit(1);
});
