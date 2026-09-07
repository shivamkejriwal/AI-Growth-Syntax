/**
 * test/testFoddaClient.js
 * Unit and integration tests for FoddaClient (MCP Server: https://mcp.fodda.ai/mcp).
 */

import assert from 'node:assert';
import { FoddaClient } from '../lib/foddaClient.js';

async function runFoddaTests() {
  console.log('====================================================');
  console.log(' FODDA AI MCP CLIENT TESTS');
  console.log('====================================================\n');

  const client = new FoddaClient();

  // Test 1: Instantiation & defaults
  assert.ok(client);
  assert.strictEqual(client.baseUrl, 'https://mcp.fodda.ai/mcp');
  assert.strictEqual(typeof client.isConfigured, 'boolean');
  console.log('✅ PASS: FoddaClient instantiated with default endpoint https://mcp.fodda.ai/mcp');

  // Test 2: Server Status & MCP Handshake
  console.log('\n[Handshake] Connecting to Fodda MCP server...');
  const status = await client.getStatus();
  assert.strictEqual(status.online, true, 'Server should be online');
  assert.strictEqual(status.serverInfo?.name, 'fodda_mcp', 'Server name should be fodda_mcp');
  assert.ok(status.toolsCount >= 40, `Tools count should be at least 40 (got ${status.toolsCount})`);
  assert.ok(status.sessionId, 'Mcp-Session-Id should be populated');
  console.log(`✅ PASS: Status online with ${status.toolsCount} tools (Session: ${status.sessionId.slice(0, 8)}...)`);

  // Test 3: Tools Listing
  console.log('\n[Tools] Validating tool definitions...');
  const tools = await client.listTools();
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length >= 40);

  const toolNames = tools.map(t => t.name);
  assert.ok(toolNames.includes('get_company_earnings'), 'Must include get_company_earnings');
  assert.ok(toolNames.includes('brand_tracker'), 'Must include brand_tracker');
  assert.ok(toolNames.includes('search_graph'), 'Must include search_graph');
  assert.ok(toolNames.includes('search_statistics'), 'Must include search_statistics');
  assert.ok(toolNames.includes('search_insights'), 'Must include search_insights');
  console.log(`✅ PASS: Core intelligence tools verified (${toolNames.filter(t => t.includes('earnings') || t.includes('brand')).join(', ')})`);

  // Test 4: Earnings Method Fallback (Graceful without API Key)
  console.log('\n[Earnings] Testing company earnings method...');
  const earnings = await client.getCompanyEarnings('MSFT', { view: 'snapshot' });
  assert.ok(earnings);
  assert.strictEqual(earnings.ticker, 'MSFT');
  assert.strictEqual(earnings.source, 'fodda_mcp');
  console.log(`✅ PASS: getCompanyEarnings('MSFT') handled gracefully (available: ${earnings.available})`);

  // Test 5: Brand Tracker Fallback
  console.log('\n[Brand Tracker] Testing brand intelligence...');
  const brand = await client.getBrandTracker('Rocket Lab');
  assert.ok(brand);
  assert.strictEqual(brand.brand, 'Rocket Lab');
  assert.strictEqual(brand.source, 'fodda_mcp');
  console.log(`✅ PASS: getBrandTracker('Rocket Lab') handled gracefully (available: ${brand.available})`);

  console.log('\n====================================================');
  console.log(' ALL FODDA MCP TESTS PASSED');
  console.log('====================================================\n');
}

runFoddaTests().catch(err => {
  console.error('❌ Fodda Test Failed:', err);
  process.exit(1);
});

