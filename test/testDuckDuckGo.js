/**
 * test/testDuckDuckGo.js
 * Unit and integration tests for DuckDuckGoClient.
 */

import assert from 'node:assert';
import { DuckDuckGoClient } from '../lib/duckduckgoClient.js';

async function runDuckDuckGoTests() {
  console.log('====================================================');
  console.log(' DUCKDUCKGO CLIENT UNIT TESTS');
  console.log('====================================================\n');

  const client = new DuckDuckGoClient();

  // Test 1: isConfigured (should always be true)
  assert.strictEqual(client.isConfigured, true);
  console.log('✅ PASS: DuckDuckGo isConfigured is true (keyless integration)');

  // Test 2: Instant answer fallback/live
  const ia = await client.getInstantAnswer('Microsoft');
  assert.ok(ia !== null, 'Instant Answer should return an object');
  assert.ok(ia.heading.includes('Microsoft'));
  assert.ok(typeof ia.abstract === 'string');
  console.log(`✅ PASS: getInstantAnswer('Microsoft') -> ${ia.heading} (${ia.abstractSource})`);

  // Test 3: Search fallback/live
  const searchResults = await client.search('Microsoft competitors cloud computing', 3);
  assert.ok(Array.isArray(searchResults));
  assert.ok(searchResults.length > 0);
  assert.ok(searchResults[0].title);
  assert.ok(searchResults[0].url);
  console.log(`✅ PASS: search('Microsoft competitors') returned ${searchResults.length} results`);

  // Test 4: Comprehensive Scuttlebutt Audit
  const audit = await client.conductScuttlebuttAudit('Apple Inc', 'AAPL');
  assert.ok(audit);
  assert.strictEqual(audit.symbol, 'AAPL');
  assert.ok(audit.source.includes('DuckDuckGo'));
  assert.ok(Array.isArray(audit.investigationVectors));
  assert.strictEqual(audit.investigationVectors.length, 4);

  const categories = audit.investigationVectors.map(v => v.category);
  assert.ok(categories.includes('Competitors & Moat'));
  assert.ok(categories.includes('Customer Sentiment & Churn'));
  assert.ok(categories.includes('Supply Chain & Regulatory'));
  assert.ok(categories.includes('Recent News & Catalysts'));
  console.log('✅ PASS: conductScuttlebuttAudit returned all 4 Fisher Scuttlebutt investigation vectors');

  console.log('\n====================================================');
  console.log(' ALL DUCKDUCKGO TESTS PASSED');
  console.log('====================================================\n');
}

runDuckDuckGoTests().catch(err => {
  console.error('❌ DuckDuckGo Test Failed:', err);
  process.exit(1);
});

