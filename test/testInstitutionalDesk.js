/**
 * test/testInstitutionalDesk.js
 * Unit tests for TradingAgents capabilities:
 * - Polymarket prediction markets
 * - StockTwits retail sentiment
 * - Technical analysis indicator engine
 * - Institutional desk simulation & multi-agent debate
 */

import assert from 'node:assert';
import { PolymarketClient } from '../lib/predictionMarkets.js';
import { StocktwitsClient } from '../lib/stocktwitsClient.js';
import { TechnicalAnalysis } from '../lib/technicalAnalysis.js';
import { InstitutionalDesk } from '../lib/institutionalDesk.js';
import { CompositeInvestor } from '../lib/compositeInvestor.js';

async function runTests() {
  console.log('====================================================');
  console.log(' INSTITUTIONAL DESK & AGENTS TEST SUITE');
  console.log('====================================================\n');

  // Test 1: Polymarket Client
  const polymarket = new PolymarketClient();
  const polyData = await polymarket.getPredictionMarkets('Fed rate cut', 4);
  assert.ok(polyData.success, 'Polymarket should return success');
  assert.ok(Array.isArray(polyData.markets), 'Polymarket should return an array of markets');
  assert.ok(polyData.markets.length > 0, 'Polymarket should return at least one market');
  const m0 = polyData.markets[0];
  assert.ok(m0.question, 'Market should have a question');
  assert.ok(typeof m0.mainProbabilityPercent === 'number', 'Market should have mainProbabilityPercent');
  console.log('✅ PASS: Polymarket: Fetches forward-looking event contracts & probabilities');

  // Test 2: StockTwits Client
  const stocktwits = new StocktwitsClient();
  const twits = await stocktwits.getSentiment('AAPL', 15);
  assert.ok(twits.success, 'StockTwits should return success');
  assert.ok(typeof twits.bullRatio === 'number', 'StockTwits should calculate bullRatio');
  assert.ok(typeof twits.bearRatio === 'number', 'StockTwits should calculate bearRatio');
  assert.ok(twits.sentimentVerdict, 'StockTwits should return a sentimentVerdict');
  console.log('✅ PASS: StockTwits: Parses retail sentiment & message ratios');

  // Test 3: Technical Analysis Calculation Engine
  const techEngine = new TechnicalAnalysis();
  const sampleBars = [];
  let p = 150;
  for (let i = 0; i < 100; i++) {
    p += (Math.sin(i / 5) * 2) + ((i % 3) - 1);
    sampleBars.push({
      time: 1700000000000 + i * 86400000,
      open: p - 0.5,
      high: p + 1.8,
      low: p - 1.2,
      close: p,
      volume: 50000000
    });
  }
  const tech = techEngine.calculateIndicatorsFromBars(sampleBars, 'MSFT');
  assert.ok(tech.rsi.value >= 0 && tech.rsi.value <= 100, 'RSI should be between 0 and 100');
  assert.ok(typeof tech.macd.histogram === 'number', 'MACD histogram should be a number');
  assert.ok(tech.bollingerBands.upper > tech.bollingerBands.lower, 'Bollinger upper band should exceed lower band');
  assert.ok(tech.atr.value > 0, 'ATR value should be positive');
  assert.ok(tech.movingAverages.sma50 > 0, 'SMA 50 should be positive');
  assert.ok(tech.pivots.resistance >= tech.pivots.support, 'Resistance must be >= Support');
  console.log('✅ PASS: Technical Analysis: Calculates RSI, MACD, Bollinger Bands, ATR & SMAs');

  // Test 4: Institutional Desk End-to-End Simulation
  const investor = new CompositeInvestor();
  const desk = new InstitutionalDesk(investor);
  const deskResult = await desk.runDeskSimulation('MSFT', { mode: 'demo' });

  assert.ok(deskResult.success, 'Desk simulation should return success');
  assert.strictEqual(deskResult.pipelineStatus, 'COMPLETED');
  
  // Verify Bull vs Bear Debate
  assert.ok(deskResult.researchDebate.turns.length >= 4, 'Should have at least 4 debate turns (2 rounds)');
  assert.ok(deskResult.researchDebate.turns.some(t => t.role === 'bull'), 'Should contain bull researcher turns');
  assert.ok(deskResult.researchDebate.turns.some(t => t.role === 'bear'), 'Should contain bear researcher turns');

  // Verify Research Plan
  assert.ok(deskResult.researchPlan.recommendation, 'Should produce a structured recommendation');
  assert.ok(deskResult.researchPlan.rationale, 'Should produce a plan rationale');

  // Verify Trader Proposal
  const tp = deskResult.traderProposal;
  assert.ok(['Buy', 'Hold', 'Sell'].includes(tp.action), 'Trader action must be Buy, Hold, or Sell');
  assert.ok(tp.entryPrice > 0, 'Trader entry price must be positive');
  assert.ok(tp.stopLoss > 0, 'Trader stop-loss must be positive');
  assert.ok(tp.takeProfit1 > 0, 'Trader take profit must be positive');
  assert.ok(tp.atrValue > 0, 'Trader ATR value must be populated');

  // Verify Risk Committee Debate
  assert.strictEqual(deskResult.riskDebate.debators.length, 3, 'Risk committee must feature 3 debaters');
  assert.ok(deskResult.riskDebate.debators.some(d => d.role === 'aggressive'), 'Should have aggressive debater');
  assert.ok(deskResult.riskDebate.debators.some(d => d.role === 'conservative'), 'Should have conservative debater');
  assert.ok(deskResult.riskDebate.debators.some(d => d.role === 'neutral'), 'Should have neutral debater');

  // Verify Portfolio Manager Final Decision
  const pm = deskResult.portfolioDecision;
  assert.ok(pm.decisionBadge, 'Portfolio Manager must produce decision badge');
  assert.ok(pm.authorizedAllocation, 'Portfolio Manager must specify authorized allocation');
  assert.ok(pm.executiveSignOff, 'Portfolio Manager must provide executive sign-off');

  console.log('✅ PASS: Institutional Desk: Executes full pipeline from Analysts to Bull/Bear Debate, Trader Proposal, Risk Committee, and PM Sign-Off');

  console.log('\n====================================================');
  console.log('TEST RESULTS: ALL 4/4 DESK TESTS PASSED');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

