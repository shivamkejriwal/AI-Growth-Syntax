/**
 * testOntologyApi.js
 * Verifies live server integration for Ontology REST endpoints:
 * 1. GET /api/ontology/graph
 * 2. POST /api/ontology/action
 * 3. GET /api/ontology/stats
 */

import assert from 'node:assert/strict';
import { handleRequest } from '../server.js';
import { ActionTypes } from '../lib/ontology/index.js';

function createMockReqRes(method, url, body = null) {
  let resData = '';
  let resHeaders = {};
  let statusCode = 200;

  const res = {
    writeHead: (code, headers) => {
      statusCode = code;
      resHeaders = headers || {};
    },
    end: (chunk) => {
      if (chunk) resData += chunk;
    }
  };

  const req = {
    method,
    url,
    headers: { host: 'localhost:3000' },
    on: (event, cb) => {
      if (event === 'data' && body) {
        cb(JSON.stringify(body));
      }
      if (event === 'end') {
        cb();
      }
    }
  };

  return {
    req,
    res,
    getResponse: () => ({
      statusCode,
      headers: resHeaders,
      data: resData ? JSON.parse(resData) : null
    })
  };
}

async function runApiTests() {
  console.log('🧪 Testing Ontology REST API endpoints in server.js...\n');

  // 1. GET /api/ontology/graph?ticker=MSFT&mode=demo
  console.log('1️⃣  GET /api/ontology/graph?ticker=MSFT&mode=demo');
  const mock1 = createMockReqRes('GET', '/api/ontology/graph?ticker=MSFT&mode=demo');
  await handleRequest(mock1.req, mock1.res);
  const resp1 = mock1.getResponse();
  assert.equal(resp1.statusCode, 200);
  assert.equal(resp1.data.success, true);
  assert.equal(resp1.data.ticker, 'MSFT');
  assert.ok(resp1.data.subgraph.nodeCount >= 1, 'Should extract subgraph for MSFT');
  console.log(`   ✅ Extracted subgraph with ${resp1.data.subgraph.nodeCount} nodes and ${resp1.data.subgraph.edgeCount} edges`);

  // 2. POST /api/ontology/action (RUN_DCF_SENSITIVITY)
  console.log('2️⃣  POST /api/ontology/action (RUN_DCF_SENSITIVITY)');
  const mock2 = createMockReqRes('POST', '/api/ontology/action', {
    actionType: ActionTypes.RUN_DCF_SENSITIVITY,
    params: { ticker: 'MSFT' }
  });
  await handleRequest(mock2.req, mock2.res);
  const resp2 = mock2.getResponse();
  assert.equal(resp2.statusCode, 200);
  assert.equal(resp2.data.success, true);
  assert.ok(resp2.data.result.matrix.length > 0);
  console.log(`   ✅ Successfully ran DCF Sensitivity Matrix over ontology graph`);

  // 3. GET /api/ontology/stats
  console.log('3️⃣  GET /api/ontology/stats');
  const mock3 = createMockReqRes('GET', '/api/ontology/stats');
  await handleRequest(mock3.req, mock3.res);
  const resp3 = mock3.getResponse();
  assert.equal(resp3.statusCode, 200);
  assert.equal(resp3.data.success, true);
  assert.ok(resp3.data.stats.totalNodes >= 1);
  assert.ok(resp3.data.recentAuditLedger.length >= 1);
  console.log(`   ✅ Ontology stats: ${resp3.data.stats.totalNodes} total nodes, audit entries: ${resp3.data.recentAuditLedger.length}`);

  console.log('\n🎉 ALL ONTOLOGY REST API ENDPOINTS VERIFIED SUCCESSFULLY!\n');
}

runApiTests().catch(err => {
  console.error('❌ Ontology API Test Failed:', err);
  process.exit(1);
});

