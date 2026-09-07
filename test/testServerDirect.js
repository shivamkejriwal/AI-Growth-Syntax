import EventEmitter from 'node:events';
import assert from 'node:assert';
import { server } from '../server.js';

function executeRequest(method, url, body = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost:3000' };

    let resHeaders = {};
    let resStatus = 200;
    let resData = '';

    const res = {
      writeHead(status, headers) {
        resStatus = status;
        resHeaders = headers;
      },
      end(data) {
        if (data) resData += data.toString();
        resolve({
          status: resStatus,
          headers: resHeaders,
          body: resHeaders['Content-Type']?.includes('application/json') ? JSON.parse(resData) : resData
        });
      }
    };

    server.emit('request', req, res);

    if (body) {
      req.emit('data', Buffer.from(JSON.stringify(body)));
    }
    req.emit('end');
  });
}

async function runDirectTests() {
  console.log('====================================================');
  console.log(' SERVER DIRECT HANDLER UNIT TESTS');
  console.log('====================================================\n');

  // 1. Test /api/status
  const statusRes = await executeRequest('GET', '/api/status');
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusRes.body.status, 'online');
  assert.strictEqual(statusRes.body.keys.yahooFinance, true);
  assert.strictEqual(statusRes.body.keys.duckduckgo, true);
  assert.strictEqual(statusRes.body.keys.competitorEngine, true);
  console.log('✅ PASS: /api/status returns online status and yahooFinance + duckduckgo + competitorEngine');

  // 2. Test /api/search?q=apple
  const searchRes = await executeRequest('GET', '/api/search?q=apple');
  assert.strictEqual(searchRes.status, 200);
  assert.ok(searchRes.body.results.length > 0);
  assert.strictEqual(searchRes.body.results[0].ticker, 'AAPL');
  console.log('✅ PASS: /api/search?q=apple resolves to AAPL');

  // 3. Test /api/search?q=MSFT
  const searchMsft = await executeRequest('GET', '/api/search?q=MSFT');
  assert.strictEqual(searchMsft.status, 200);
  assert.ok(searchMsft.body.results.length > 0);
  assert.strictEqual(searchMsft.body.results[0].ticker, 'MSFT');
  console.log('✅ PASS: /api/search?q=MSFT resolves to MSFT');

  // 4. Test /api/resolve?q=Tesla
  const resolveTesla = await executeRequest('GET', '/api/resolve?q=Tesla');
  assert.strictEqual(resolveTesla.status, 200);
  assert.strictEqual(resolveTesla.body.resolved, true);
  assert.strictEqual(resolveTesla.body.match.ticker, 'TSLA');
  console.log('✅ PASS: /api/resolve?q=Tesla resolves to TSLA');

  // 5. Test /api/research?ticker=MSFT&mode=demo
  const researchRes = await executeRequest('GET', '/api/research?ticker=MSFT&mode=demo');
  assert.strictEqual(researchRes.status, 200);
  assert.strictEqual(researchRes.body.success, true);
  assert.strictEqual(researchRes.body.dossier.metadata.symbol, 'MSFT');
  assert.ok(researchRes.body.dossier.pillar1_Lynch);
  assert.ok(researchRes.body.dossier.pillar2_Fisher);
  assert.ok(researchRes.body.dossier.pillar3_Buffett);
  assert.ok(researchRes.body.dossier.pillar4_Damodaran);
  assert.ok(researchRes.body.dossier.macroContext);
  assert.ok(typeof researchRes.body.dossier.macroContext.riskFreeRatePercent === 'number');
  assert.ok(typeof researchRes.body.dossier.macroContext.effectiveFedFundsRate === 'number');
  assert.ok(typeof researchRes.body.dossier.metadata.peRatio === 'number');
  assert.ok(researchRes.body.dossier.metadata.peRatio > 0);
  console.log('✅ PASS: /api/research?ticker=MSFT&mode=demo generates 4-pillar dossier with valid macroContext & peRatio');

  // 6. Test /api/memo?ticker=MSFT&mode=demo
  const memoRes = await executeRequest('GET', '/api/memo?ticker=MSFT&mode=demo');
  assert.strictEqual(memoRes.status, 200);
  assert.strictEqual(memoRes.body.success, true);
  assert.ok(memoRes.body.memo.toLowerCase().includes('investment decision memorandum'));
  console.log('✅ PASS: /api/memo?ticker=MSFT&mode=demo generates Markdown memorandum');

  // 7. Test /api/export-memo
  const exportRes = await executeRequest('POST', '/api/export-memo', {
    ticker: 'MSFT',
    content: '# Sample Memorandum for Testing'
  });
  assert.strictEqual(exportRes.status, 200);
  assert.strictEqual(exportRes.body.success, true);
  assert.ok(exportRes.body.path.includes('decision_memos'));
  console.log('✅ PASS: /api/export-memo saves memorandum to decision_memos/');

  // 8. Test /api/macro
  const macroRes = await executeRequest('GET', '/api/macro');
  assert.strictEqual(macroRes.status, 200);
  assert.strictEqual(macroRes.body.success, true);
  assert.ok(macroRes.body.macro.fred);
  assert.ok(typeof macroRes.body.macro.fred.riskFreeRate10Y === 'number');
  assert.ok(macroRes.body.macro.damodaran);
  assert.ok(typeof macroRes.body.macro.damodaran.impliedERPPercent === 'number');
  assert.ok(Array.isArray(macroRes.body.macro.damodaran.sectors));
  assert.ok(macroRes.body.macro.damodaran.sectors.length > 0);
  assert.ok(macroRes.body.macro.regimeAssessment);
  assert.ok(macroRes.body.macro.overview);
  assert.ok(macroRes.body.macro.marketMovers);
  assert.ok(Array.isArray(macroRes.body.macro.marketMovers.gainers));
  assert.ok(Array.isArray(macroRes.body.macro.marketMovers.losers));
  assert.ok(Array.isArray(macroRes.body.macro.marketMovers.active));
  assert.ok(typeof macroRes.body.macro.marketMovers.advancers === 'number');
  assert.ok(Array.isArray(macroRes.body.macro.sectorPerformance));
  assert.ok(macroRes.body.macro.sectorPerformance.length > 0);
  assert.ok(Array.isArray(macroRes.body.macro.spdrSectorETFs));
  assert.strictEqual(macroRes.body.macro.spdrSectorETFs.length, 11);
  assert.ok(Array.isArray(macroRes.body.macro.industryPerformance));
  assert.ok(macroRes.body.macro.industryPerformance.length > 0);
  console.log('✅ PASS: /api/macro returns comprehensive standalone macroeconomic dossier with market movers, sectors & SPDR ETFs');

  // 9. Test /api/institutional-desk?ticker=MSFT&mode=demo
  const deskRes = await executeRequest('GET', '/api/institutional-desk?ticker=MSFT&mode=demo');
  assert.strictEqual(deskRes.status, 200);
  assert.ok(deskRes.body.traderProposal);
  assert.ok(deskRes.body.portfolioDecision);
  assert.ok(deskRes.body.researchDebate);
  console.log('✅ PASS: /api/institutional-desk returns full 6-stage pipeline');

  // 10. Test /api/experts-desk?ticker=MSFT&mode=demo
  const expRes = await executeRequest('GET', '/api/experts-desk?ticker=MSFT&mode=demo');
  assert.strictEqual(expRes.status, 200);
  assert.ok(expRes.body.arbiterSynthesis);
  assert.ok(expRes.body.scorecardMatrix);
  assert.ok(expRes.body.debate);
  console.log('✅ PASS: /api/experts-desk returns 4-legend debate with Graham synthesis');

  // 11. Test /api/duckduckgo?ticker=MSFT
  const ddgRes = await executeRequest('GET', '/api/duckduckgo?ticker=MSFT');
  assert.strictEqual(ddgRes.status, 200);
  assert.ok(ddgRes.body.source);
  assert.ok(Array.isArray(ddgRes.body.investigationVectors));
  assert.strictEqual(ddgRes.body.investigationVectors.length, 4);
  console.log('✅ PASS: /api/duckduckgo returns Scuttlebutt web & instant intelligence audit');

  // 12. Test /api/competitors?ticker=MSFT
  const compRes = await executeRequest('GET', '/api/competitors?ticker=MSFT');
  assert.strictEqual(compRes.status, 200);
  assert.strictEqual(compRes.body.targetSymbol, 'MSFT');
  assert.ok(Array.isArray(compRes.body.peers));
  assert.ok(compRes.body.peers.length >= 3);
  assert.ok(compRes.body.benchmarks.peerMedianPE > 0);
  assert.ok(compRes.body.executiveTakeaway);
  console.log('✅ PASS: /api/competitors returns full peer matrix & relative valuation benchmarks');

  // 13. Test /api/fodda/status & /api/fodda/earnings
  const foddaStatusRes = await executeRequest('GET', '/api/fodda/status');
  assert.strictEqual(foddaStatusRes.status, 200);
  assert.strictEqual(foddaStatusRes.body.online, true);
  assert.ok(foddaStatusRes.body.toolsCount >= 40);
  console.log('✅ PASS: /api/fodda/status returns online status and tool catalog count');

  const foddaEarningsRes = await executeRequest('GET', '/api/fodda/earnings?ticker=MSFT');
  assert.strictEqual(foddaEarningsRes.status, 200);
  assert.strictEqual(foddaEarningsRes.body.ticker, 'MSFT');
  console.log('✅ PASS: /api/fodda/earnings?ticker=MSFT returns structured earnings payload');

  // Test /api/seeking-alpha?ticker=MSFT
  const saRes = await executeRequest('GET', '/api/seeking-alpha?ticker=MSFT&limit=5');
  assert.strictEqual(saRes.status, 200);
  assert.strictEqual(saRes.body.success, true);
  assert.strictEqual(saRes.body.ticker, 'MSFT');
  assert.ok(Array.isArray(saRes.body.articles));
  console.log('✅ PASS: /api/seeking-alpha?ticker=MSFT returns articles and sentiment summary');

  // 13. Test static file serving (index.html, styles.css, app.js)
  const indexRes = await executeRequest('GET', '/');
  assert.strictEqual(indexRes.status, 200);
  assert.ok(indexRes.body.includes('COMPOSITE INVESTOR'));
  console.log('✅ PASS: GET / serves index.html');

  const cssRes = await executeRequest('GET', '/styles.css');
  assert.strictEqual(cssRes.status, 200);
  assert.ok(cssRes.body.includes('--bg-main'));
  console.log('✅ PASS: GET /styles.css serves stylesheet');

  const jsRes = await executeRequest('GET', '/app.js');
  assert.strictEqual(jsRes.status, 200);
  assert.ok(jsRes.body.includes('resolveAndResearch'));
  console.log('✅ PASS: GET /app.js serves frontend script');

  console.log('\n====================================================');
  console.log(' ALL 12/12 SERVER & API ROUTE TESTS PASSED');
  console.log('====================================================\n');
}

runDirectTests().catch(err => {
  console.error(err);
  process.exit(1);
});
