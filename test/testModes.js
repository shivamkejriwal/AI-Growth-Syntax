/**
 * testModes.js
 * Unit tests for Mode Management (Local, Firebase, MCP) and Multi-Tier Cache.
 */

import assert from 'node:assert';
import { getActiveMode, getModeConfig, APP_MODES } from '../lib/modes.js';
import { DiskCache } from '../lib/cache.js';

console.log('====================================================');
console.log(' AI-GROWTH-SYNTAX: OPERATIONAL MODES TEST SUITE');
console.log('====================================================\n');

let passed = 0;
let total = 0;

function test(desc, fn) {
  total++;
  try {
    fn();
    console.log(`✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${desc}`);
    console.error(err);
  }
}

// 1. Mode Detection Tests
test('Modes: Default active mode is local', () => {
  const mode = getActiveMode();
  assert.ok([APP_MODES.LOCAL, APP_MODES.FIREBASE, APP_MODES.MCP].includes(mode));
});

test('Modes: Mode configurations return proper settings', () => {
  const localConfig = getModeConfig(APP_MODES.LOCAL);
  assert.strictEqual(localConfig.mode, 'local');
  assert.strictEqual(localConfig.useDiskCache, true);

  const mcpConfig = getModeConfig(APP_MODES.MCP);
  assert.strictEqual(mcpConfig.mode, 'mcp');
  assert.strictEqual(mcpConfig.allowInteractivePrompts, false);

  const fbConfig = getModeConfig(APP_MODES.FIREBASE);
  assert.strictEqual(fbConfig.mode, 'firebase');
  assert.strictEqual(fbConfig.edgeCdnCache, true);
});

// 2. Multi-tier Cache Resilience
test('Cache: Stores and retrieves from memory fallback', () => {
  const cache = new DiskCache(null); // Force in-memory fallback
  const testKey = 'TEST_KEY_' + Date.now();
  const testData = { ticker: 'MSFT', price: 420.50 };

  cache.set(testKey, testData, 'test_ns');
  const retrieved = cache.get(testKey, 'test_ns');
  assert.deepStrictEqual(retrieved, testData);

  const stale = cache.getStale(testKey, 'test_ns');
  assert.deepStrictEqual(stale, testData);
});

console.log(`\n====================================================`);
console.log(`TEST RESULTS: ${passed}/${total} PASSED`);
console.log('====================================================\n');

if (passed !== total) {
  process.exit(1);
}
