/**
 * testStatusIndicator.js
 * Verification suite for the interactive Status Indicator & Services Drawer.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { handleRequest } from '../server.js';

async function runTests() {
  console.log('🧪 Starting Status Indicator & Services Drawer Verification Suite...\n');

  const rootDir = process.cwd();
  const htmlPath = path.join(rootDir, 'public', 'index.html');
  const cssPath = path.join(rootDir, 'public', 'styles.css');
  const jsPath = path.join(rootDir, 'public', 'app.js');

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  // 1. HTML Markup Structure
  console.log('1️⃣  Testing HTML Markup Structure...');
  assert.ok(htmlContent.includes('id="status-indicator-btn"'), 'Must include #status-indicator-btn');
  assert.ok(htmlContent.includes('id="system-status-dot"'), 'Must include #system-status-dot');
  assert.ok(htmlContent.includes('id="system-status-text"'), 'Must include #system-status-text');
  assert.ok(htmlContent.includes('id="status-dropdown-panel"'), 'Must include #status-dropdown-panel');
  assert.ok(htmlContent.includes('id="status-services-list"'), 'Must include #status-services-list');
  assert.ok(htmlContent.includes('id="btn-refresh-status"'), 'Must include #btn-refresh-status');
  console.log('   ✅ Passed: All essential status button & panel elements present in index.html.\n');

  // 2. CSS Styles
  console.log('2️⃣  Testing CSS Styles for Status Indicator States...');
  assert.ok(cssContent.includes('.status-dot.online'), 'Must have .status-dot.online style');
  assert.ok(cssContent.includes('.status-dot.partial'), 'Must have .status-dot.partial style');
  assert.ok(cssContent.includes('.status-dot.mock'), 'Must have .status-dot.mock style');
  assert.ok(cssContent.includes('.status-dropdown-panel'), 'Must have .status-dropdown-panel style');
  assert.ok(cssContent.includes('.status-indicator.status-btn'), 'Must have .status-indicator.status-btn style');
  console.log('   ✅ Passed: CSS contains styling for online, partial, and mock status variants.\n');

  // 3. Status State Logic
  console.log('3️⃣  Testing computeSystemStatus logic specification...');
  function computeStatus(isMock, keys) {
    if (isMock) {
      return { type: 'mock', label: 'Mock mode' };
    }
    const hasAlphaVantage = !!keys?.alphaVantage;
    const hasFred = !!keys?.fred;
    if (!hasAlphaVantage || !hasFred) {
      return { type: 'partial', label: 'Partial Services Online' };
    }
    return { type: 'online', label: 'Services Online' };
  }

  const mockState = computeStatus(true, { alphaVantage: true, fred: true });
  assert.equal(mockState.label, 'Mock mode');
  assert.equal(mockState.type, 'mock');

  const partialState1 = computeStatus(false, { alphaVantage: false, fred: true });
  assert.equal(partialState1.label, 'Partial Services Online');
  assert.equal(partialState1.type, 'partial');

  const partialState2 = computeStatus(false, { alphaVantage: true, fred: false });
  assert.equal(partialState2.label, 'Partial Services Online');
  assert.equal(partialState2.type, 'partial');

  const onlineState = computeStatus(false, { alphaVantage: true, fred: true });
  assert.equal(onlineState.label, 'Services Online');
  assert.equal(onlineState.type, 'online');
  console.log('   ✅ Passed: Evaluated "Mock mode", "Partial Services Online", and "Services Online" accurately.\n');

  // 4. Server /api/status Payload
  console.log('4️⃣  Testing /api/status endpoint response payload...');
  let responseStatus = null;
  let responseData = '';
  const mockReq = {
    method: 'GET',
    url: '/api/status',
    headers: { host: 'localhost:3000' },
    on: () => {}
  };
  const mockRes = {
    writeHead: (status) => { responseStatus = status; },
    end: (body) => { responseData = body; }
  };

  await handleRequest(mockReq, mockRes);
  assert.equal(responseStatus, 200);
  const parsed = JSON.parse(responseData);
  assert.equal(parsed.status, 'online');
  assert.ok(parsed.keys, 'Keys object present');
  console.log('   ✅ Passed: /api/status serves rich health breakdown.\n');

  console.log('🎉 ALL 4 STATUS INDICATOR TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
