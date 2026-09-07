/**
 * testTieredStore.js
 * Test suite verifying Cache-First, DB-First, Source-Fallback retrieval system.
 * 
 * Tests:
 * 1. Cache Miss, DB Miss -> Source fetch -> Populates both Cache and DB
 * 2. Same-day retrieval -> Hits Cache directly (source and DB bypassed)
 * 3. Cache evicted -> Hits DB -> Automatically warms Cache
 * 4. Subsequent retrieval -> Hits warmed Cache directly
 * 5. Next-day rollover simulation -> Triggers new data pull from source
 * 6. Source failure degradation -> Falls back to stale DB/Cache with isStale: true
 * 7. Operational Mode compatibility (Local SQLite vs Firebase Firestore)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TieredDataStore } from '../lib/tieredStore.js';
import { DiskCache } from '../lib/cache.js';
import { SqliteStore, FirestoreStore, getTodayDateStr } from '../lib/db.js';
import { APP_MODES } from '../lib/modes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Starting TieredDataStore (Cache-First, DB-First) Verification Suite...\n');

  const testCacheDir = path.join(__dirname, '.test_cache');
  const testDbDir = path.join(__dirname, '.test_data');
  if (fs.existsSync(testCacheDir)) fs.rmSync(testCacheDir, { recursive: true, force: true });
  if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });
  fs.mkdirSync(testDbDir, { recursive: true });

  const testCache = new DiskCache(testCacheDir);
  const testDb = new SqliteStore(path.join(testDbDir, 'test_growth.sqlite'));
  const store = new TieredDataStore({ cache: testCache, db: testDb });

  const testKey = 'TEST_TICKER_AAPL';
  const testNs = 'test_namespace';

  let fetchCallCount = 0;
  const mockFetcher = async () => {
    fetchCallCount++;
    return {
      symbol: 'AAPL',
      price: 224.50,
      timestamp: Date.now(),
      fetchCount: fetchCallCount
    };
  };

  // -------------------------------------------------------------
  // Test 1: Full Miss -> Pull from Source -> Dual Populate Cache + DB
  // -------------------------------------------------------------
  console.log('1️⃣  Testing Cache Miss + DB Miss -> Fetch from Source & Dual Write...');
  const res1 = await store.retrieveOrFetch({
    key: testKey,
    namespace: testNs,
    fetcher: mockFetcher
  });

  assert.equal(res1.source, 'source', 'First retrieval must come from external source');
  assert.equal(res1.isStale, false, 'Initial retrieval is fresh');
  assert.equal(res1.data.symbol, 'AAPL');
  assert.equal(fetchCallCount, 1, 'Fetcher must be invoked exactly once');

  // Verify that both Cache and DB are populated
  const inCache1 = testCache.getToday(testKey, testNs);
  const inDb1 = testDb.get(testKey, testNs);
  assert.ok(inCache1, 'Cache must be populated after source pull');
  assert.ok(inDb1, 'DB must be populated after source pull');
  assert.equal(inCache1.price, 224.50);
  assert.equal(inDb1.price, 224.50);
  console.log('   ✅ Passed: Source called, Cache populated, DB populated.\n');

  // -------------------------------------------------------------
  // Test 2: Immediate Re-query on Same Day -> Hits Cache Directly
  // -------------------------------------------------------------
  console.log('2️⃣  Testing Immediate Retrieval -> Cache Hit (Sub-millisecond)...');
  const res2 = await store.retrieveOrFetch({
    key: testKey,
    namespace: testNs,
    fetcher: mockFetcher
  });

  assert.equal(res2.source, 'cache', 'Subsequent retrieval must hit L1 Cache');
  assert.equal(res2.isStale, false);
  assert.equal(fetchCallCount, 1, 'Fetcher must NOT be called on Cache Hit');
  console.log('   ✅ Passed: Cache hit successfully returned without calling DB or source.\n');

  // -------------------------------------------------------------
  // Test 3: Cache Miss (Evicted) -> DB Hit -> Warmed to Cache
  // -------------------------------------------------------------
  console.log('3️⃣  Testing Cache Eviction -> DB Hit & Automatic Cache Warming...');
  // Explicitly evict from cache only
  testCache.delete(testKey, testNs);
  assert.equal(testCache.getToday(testKey, testNs), null, 'Cache must be empty now');

  const res3 = await store.retrieveOrFetch({
    key: testKey,
    namespace: testNs,
    fetcher: mockFetcher
  });

  assert.equal(res3.source, 'db', 'Must hit L2 Database when Cache is empty');
  assert.equal(res3.isStale, false);
  assert.equal(fetchCallCount, 1, 'Fetcher must NOT be called on DB Hit');

  // Verify cache warming
  const warmedCache = testCache.getToday(testKey, testNs);
  assert.ok(warmedCache, 'Cache must be warmed automatically from DB hit');
  assert.equal(warmedCache.symbol, 'AAPL');
  console.log('   ✅ Passed: DB hit returned and automatically warmed the Cache.\n');

  // -------------------------------------------------------------
  // Test 4: Query After Cache Warming -> Hits Cache Again
  // -------------------------------------------------------------
  console.log('4️⃣  Testing Retrieval After Cache Warming -> Hits Cache Directly...');
  const res4 = await store.retrieveOrFetch({
    key: testKey,
    namespace: testNs,
    fetcher: mockFetcher
  });
  assert.equal(res4.source, 'cache', 'Must hit warmed Cache');
  assert.equal(fetchCallCount, 1, 'Fetcher remains uncalled');
  console.log('   ✅ Passed: Warmed cache served subsequent query directly.\n');

  // -------------------------------------------------------------
  // Test 5: Next-Day Rollover Simulation -> Pulls New Data
  // -------------------------------------------------------------
  console.log('5️⃣  Testing Next-Day Rollover -> Expires Cache & DB -> Triggers New Pull...');
  // Simulate data stored yesterday
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rolloverKey = 'ROLLOVER_KEY';
  const oldData = { symbol: 'MSFT', price: 400.00, day: 'yesterday' };

  // Set with yesterday's date
  testDb.set(rolloverKey, oldData, testNs, yesterday);
  // Cache check for today should return null
  assert.equal(testDb.get(rolloverKey, testNs), null, 'DB should consider yesterday record expired');

  let rolloverFetchCount = 0;
  const rolloverFetcher = async () => {
    rolloverFetchCount++;
    return { symbol: 'MSFT', price: 415.00, day: 'today' };
  };

  const res5 = await store.retrieveOrFetch({
    key: rolloverKey,
    namespace: testNs,
    fetcher: rolloverFetcher
  });

  assert.equal(res5.source, 'source', 'Next-day request must pull new data from source');
  assert.equal(res5.data.price, 415.00, 'Must return freshly pulled data');
  assert.equal(rolloverFetchCount, 1, 'Fetcher must be invoked for next day');

  // Check that new today's record is stored in both
  const freshDb = testDb.get(rolloverKey, testNs);
  const freshCache = testCache.getToday(rolloverKey, testNs);
  assert.equal(freshDb.price, 415.00, 'DB must now have today record');
  assert.equal(freshCache.price, 415.00, 'Cache must now have today record');
  console.log('   ✅ Passed: Next-day rollover triggered fresh pull and dual re-population.\n');

  // -------------------------------------------------------------
  // Test 6: Source Failure Resiliency -> Graceful Stale Fallback
  // -------------------------------------------------------------
  console.log('6️⃣  Testing Source Error Degradation -> Fallback to Stale DB...');
  const failingKey = 'FAILING_KEY';
  testDb.set(failingKey, { symbol: 'NVDA', price: 120.00 }, testNs, yesterday);
  testCache.delete(failingKey, testNs);

  const failingFetcher = async () => {
    throw new Error('Alpha Vantage Rate Limit Exceeded (HTTP 429)');
  };

  const res6 = await store.retrieveOrFetch({
    key: failingKey,
    namespace: testNs,
    fetcher: failingFetcher
  });

  assert.equal(res6.source, 'stale_db', 'Must fall back to stale DB when source fails');
  assert.equal(res6.isStale, true, 'isStale flag must be true');
  assert.equal(res6.data.symbol, 'NVDA');
  assert.ok(res6.error.includes('Rate Limit'), 'Error message preserved');
  console.log('   ✅ Passed: Stale DB fallback succeeded during source failure.\n');

  // -------------------------------------------------------------
  // Test 7: FirestoreStore Adapter (Deployed / Firebase Mode)
  // -------------------------------------------------------------
  console.log('7️⃣  Testing FirestoreStore Adapter Compatibility...');
  const firestoreStore = new FirestoreStore({ projectId: 'ai-growth-syntax' });
  await firestoreStore.set('FS_KEY', { status: 'deployed_ok' }, 'fs_ns');
  const fsData = await firestoreStore.get('FS_KEY', 'fs_ns');
  assert.ok(fsData, 'Firestore adapter must successfully retrieve stored item');
  assert.equal(fsData.status, 'deployed_ok');
  console.log('   ✅ Passed: Firestore adapter ready for deployed Firebase mode.\n');

  // Cleanup test directories
  testDb.close();
  if (fs.existsSync(testCacheDir)) fs.rmSync(testCacheDir, { recursive: true, force: true });
  if (fs.existsSync(testDbDir)) fs.rmSync(testDbDir, { recursive: true, force: true });

  console.log('🎉 ALL 7 TIERED DATA STORE TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

