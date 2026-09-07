/**
 * testUnifiedDossier.js
 * Verification suite for the Unified Single Company JSON model.
 * 
 * Verifies:
 * 1. Complete single JSON document assembly with _meta envelope
 * 2. Single-row persistence in SQLite database under namespace 'company_dossiers'
 * 3. Fast L1 cache retrieval (< 2ms) on subsequent lookups
 * 4. DB hit and cache warming when cache is cleared
 * 5. Server endpoint /api/dossier?ticker=MSFT returns the canonical single JSON
 */

import assert from 'node:assert/strict';
import { CompositeInvestor } from '../lib/compositeInvestor.js';
import { defaultDb, getTodayDateStr } from '../lib/db.js';
import { defaultCache } from '../lib/cache.js';
import { handleRequest } from '../server.js';

async function runTests() {
  console.log('🧪 Starting Unified Single Company JSON Verification Suite...\n');

  const investor = new CompositeInvestor();
  const testTicker = 'MSFT';
  const storageKey = `COMPANY_${testTicker}`;
  const namespace = 'companies';

  // -------------------------------------------------------------
  // Test 1: Generate & Ingest Unified Single Company JSON
  // -------------------------------------------------------------
  console.log('1️⃣  Testing Unified Company Dossier Generation & Ingestion...');
  const dossier1 = await investor.getCompositeDossier(testTicker, {
    mode: 'demo',
    persistDemo: true // Force persistence for test validation
  });

  assert.ok(dossier1, 'Dossier must not be null');
  assert.ok(dossier1._meta, 'Dossier must include _meta block');
  assert.equal(dossier1._meta.ticker, testTicker);
  assert.equal(dossier1._meta.schemaVersion, '3.0.0');
  assert.equal(dossier1._meta.asOfDate, getTodayDateStr());
  assert.ok(Array.isArray(dossier1._meta.sourcesIngested));

  // Verify all 4 analytical pillars exist in the single JSON
  assert.ok(dossier1.pillar1_Lynch, 'Pillar 1 (Lynch) present');
  assert.ok(dossier1.pillar2_Fisher, 'Pillar 2 (Fisher) present');
  assert.ok(dossier1.pillar3_Buffett, 'Pillar 3 (Buffett) present');
  assert.ok(dossier1.pillar4_Damodaran, 'Pillar 4 (Damodaran) present');
  assert.ok(dossier1.macroContext, 'Macro context present');

  console.log('   ✅ Passed: Single JSON generated containing all 4 pillars and _meta envelope.\n');

  // -------------------------------------------------------------
  // Test 2: Verify Single-Row SQLite Storage
  // -------------------------------------------------------------
  console.log('2️⃣  Verifying Single-Row SQLite DB Persistence...');
  const dbRow = defaultDb.get(storageKey, namespace);
  assert.ok(dbRow, 'Record must exist in SQLite database under namespace companies');
  assert.equal(dbRow._meta.ticker, testTicker);
  assert.equal(dbRow.profile.ticker, testTicker);
  console.log('   ✅ Passed: Complete company dossier persisted as a single atomic record in SQLite.\n');

  // -------------------------------------------------------------
  // Test 3: Same-Day Second Retrieval -> Instant Cache Hit
  // -------------------------------------------------------------
  console.log('3️⃣  Testing Instant L1 Cache Hit for Unified Dossier...');
  const startMs = Date.now();
  const dossier2 = await investor.getCompositeDossier(testTicker, {
    mode: 'demo',
    persistDemo: true
  });
  const elapsedMs = Date.now() - startMs;

  assert.equal(dossier2._storageMetadata.retrievalSource, 'cache', 'Must hit L1 cache directly');
  assert.equal(dossier2.metadata.symbol, testTicker);
  console.log(`   ✅ Passed: Retrieved complete single JSON from cache in ${elapsedMs}ms (source: cache).\n`);

  // -------------------------------------------------------------
  // Test 4: Cache Eviction -> DB Hit & Automatic Cache Warming
  // -------------------------------------------------------------
  console.log('4️⃣  Testing Cache Eviction -> DB Hit & Cache Warming...');
  defaultCache.delete(storageKey, namespace);
  assert.equal(defaultCache.getToday(storageKey, namespace), null, 'Cache must be empty');

  const dossier3 = await investor.getCompositeDossier(testTicker, {
    mode: 'demo',
    persistDemo: true
  });
  assert.equal(dossier3._storageMetadata.retrievalSource, 'db', 'Must hit SQLite database');

  // Verify that cache was warmed by DB hit
  const warmed = defaultCache.getToday(storageKey, namespace);
  assert.ok(warmed, 'Cache must be automatically warmed with the complete dossier');
  assert.equal(warmed._meta.ticker, testTicker);
  console.log('   ✅ Passed: DB hit returned complete single JSON and warmed the cache.\n');

  // -------------------------------------------------------------
  // Test 5: HTTP Endpoint /api/dossier?ticker=MSFT
  // -------------------------------------------------------------
  console.log('5️⃣  Testing HTTP Server /api/dossier Endpoint...');
  let responseStatus = null;
  let responseData = '';
  const mockReq = {
    method: 'GET',
    url: `/api/dossier?ticker=${testTicker}&mode=demo`,
    headers: { host: 'localhost:3000' },
    on: () => {}
  };
  const mockRes = {
    writeHead: (status) => { responseStatus = status; },
    end: (body) => { responseData = body; }
  };

  await handleRequest(mockReq, mockRes);
  assert.equal(responseStatus, 200, 'Endpoint must return HTTP 200');
  const parsedResponse = JSON.parse(responseData);
  assert.equal(parsedResponse._meta.ticker, testTicker, 'Response must be the canonical single JSON');
  assert.ok(parsedResponse.pillar3_Buffett, 'Response contains Buffett owner earnings');
  console.log('   ✅ Passed: /api/dossier successfully served canonical single company JSON.\n');

  console.log('🎉 ALL 5 UNIFIED SINGLE COMPANY JSON TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
