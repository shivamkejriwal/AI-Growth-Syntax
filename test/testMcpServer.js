/**
 * testMcpServer.js
 * Comprehensive integration tests for MCP Server over stdio.
 */

import assert from 'node:assert';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MCP_PATH = path.join(__dirname, '..', 'mcp-server.js');

console.log('====================================================');
console.log(' AI-GROWTH-SYNTAX: MCP SERVER PROTOCOL TEST SUITE');
console.log('====================================================\n');

async function runTests() {
  const child = spawn('node', [MCP_PATH], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  const rl = readline.createInterface({
    input: child.stdout,
    terminal: false
  });

  const pendingRequests = new Map();

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.id !== undefined && pendingRequests.has(parsed.id)) {
        const { resolve } = pendingRequests.get(parsed.id);
        pendingRequests.delete(parsed.id);
        resolve(parsed);
      }
    } catch (err) {
      // ignore
    }
  });

  function sendRpc(message) {
    return new Promise((resolve) => {
      pendingRequests.set(message.id, { resolve });
      child.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  try {
    // 1. Test initialize
    const initRes = await sendRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' }
    });
    assert.strictEqual(initRes.jsonrpc, '2.0');
    assert.strictEqual(initRes.id, 1);
    assert.strictEqual(initRes.result.serverInfo.name, 'ai-growth-syntax-mcp');
    console.log('✅ PASS: MCP Server responds to initialize');

    // 2. Test tools/list
    const toolsRes = await sendRpc({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });
    assert.strictEqual(toolsRes.id, 2);
    assert.ok(Array.isArray(toolsRes.result.tools));
    assert.ok(toolsRes.result.tools.length >= 5);
    const toolNames = toolsRes.result.tools.map(t => t.name);
    assert.ok(toolNames.includes('analyze_company'));
    assert.ok(toolNames.includes('get_investment_memo'));
    assert.ok(toolNames.includes('get_competitors'));
    assert.ok(toolNames.includes('get_macro_snapshot'));
    assert.ok(toolNames.includes('simulate_trading_desk'));
    console.log(`✅ PASS: MCP Server lists ${toolsRes.result.tools.length} investment tools`);

    // 3. Test tools/call: analyze_company (demo mode)
    const callRes = await sendRpc({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'analyze_company',
        arguments: { ticker: 'MSFT', mode: 'demo' }
      }
    });
    assert.strictEqual(callRes.id, 3);
    assert.ok(callRes.result?.content?.[0]?.text);
    const parsedDossier = JSON.parse(callRes.result.content[0].text);
    assert.strictEqual(parsedDossier.metadata?.symbol, 'MSFT');
    assert.ok(parsedDossier.pillar1_Lynch);
    assert.ok(parsedDossier.pillar2_Fisher);
    assert.ok(parsedDossier.pillar3_Buffett);
    assert.ok(parsedDossier.pillar4_Damodaran);
    console.log('✅ PASS: MCP Server tools/call analyze_company returns full 4-pillar dossier');

    // 4. Test tools/call: get_macro_snapshot
    const macroRes = await sendRpc({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'get_macro_snapshot',
        arguments: {}
      }
    });
    assert.strictEqual(macroRes.id, 4);
    const parsedMacro = JSON.parse(macroRes.result.content[0].text);
    assert.ok(parsedMacro.riskFreeRatePercent !== undefined);
    console.log('✅ PASS: MCP Server tools/call get_macro_snapshot returns FRED benchmarks');

    // 5. Test tools/call: get_investment_memo
    const memoRes = await sendRpc({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'get_investment_memo',
        arguments: { ticker: 'MSFT', mode: 'demo' }
      }
    });
    assert.strictEqual(memoRes.id, 5);
    assert.ok(memoRes.result?.content?.[0]?.text.includes('Investment Decision Memorandum'));
    console.log('✅ PASS: MCP Server tools/call get_investment_memo returns markdown memo');

    console.log('\n====================================================');
    console.log('ALL MCP SERVER TESTS PASSED (5/5)');
    console.log('====================================================\n');
  } finally {
    child.kill();
  }
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
