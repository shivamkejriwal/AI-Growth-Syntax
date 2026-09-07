/**
 * testOntologyEngine.js
 * Comprehensive automated test suite for the Ontology-Driven Architecture.
 * 
 * Tests:
 * 1. OntologyGraphStore: In-memory O(1) indexing, edge traversal, and subgraph extraction
 * 2. FinancialInvariants: Balance sheet equality, FCF identity, WACC bounds, order sizing
 * 3. SemanticIngestionPipeline: Objectification of standard company data into graph nodes/edges
 * 4. OntologyLogicEngine: Damodaran DCF, Buffett Moat, Lynch GARP, and thesis synthesis
 * 5. OntologyActionEngine: Precondition enforcement, action execution, and audit ledger
 */

import assert from 'node:assert/strict';
import {
  EntityTypes,
  RelationTypes,
  ActionTypes,
  OrderStatus,
  FinancialInvariants,
  OntologyGraphStore,
  SemanticIngestionPipeline,
  OntologyLogicEngine,
  OntologyActionEngine
} from '../lib/ontology/index.js';

async function runTests() {
  console.log('🧪 Starting Financial Ontology Engine Verification Suite...\n');

  // =============================================================
  // 1. Financial Invariants
  // =============================================================
  console.log('1️⃣  Testing Financial Invariants...');

  // 1a. Balance Sheet
  const validBs = FinancialInvariants.validateBalanceSheet({
    totalAssets: 1000,
    totalLiabilities: 600,
    shareholdersEquity: 400
  });
  assert.equal(validBs.valid, true, 'Balance sheet equality should pass');

  const invalidBs = FinancialInvariants.validateBalanceSheet({
    totalAssets: 1000,
    totalLiabilities: 300,
    shareholdersEquity: 400
  });
  assert.equal(invalidBs.valid, false, 'Mismatched balance sheet must fail');
  assert.ok(invalidBs.error.includes('Invariant Violated'));

  // 1b. Free Cash Flow
  const validFcf = FinancialInvariants.validateFreeCashFlow({
    operatingCashFlow: 120,
    capitalExpenditures: 30,
    freeCashFlow: 90
  });
  assert.equal(validFcf.valid, true, 'FCF = OCF - CapEx should pass');

  const invalidFcf = FinancialInvariants.validateFreeCashFlow({
    operatingCashFlow: 120,
    capitalExpenditures: 30,
    freeCashFlow: 50 // Should be 90
  });
  assert.equal(invalidFcf.valid, false, 'Violated FCF must fail');

  // 1c. Cost of Capital (WACC)
  const validWacc = FinancialInvariants.validateCostOfCapital(0.09, 4.25);
  assert.equal(validWacc.valid, true, 'WACC > Rf should pass');

  const invalidWacc = FinancialInvariants.validateCostOfCapital(0.02, 4.25);
  assert.equal(invalidWacc.valid, false, 'WACC < Rf must fail');

  // 1d. Order Ticket
  const validOrder = FinancialInvariants.validateOrderTicket({
    ticker: 'AAPL',
    action: 'BUY',
    entryPrice: 220,
    stopLoss: 200,
    positionSizePercent: 8.0
  });
  assert.equal(validOrder.valid, true, 'Valid order ticket should pass');

  const invalidOrder = FinancialInvariants.validateOrderTicket({
    ticker: 'AAPL',
    action: 'BUY',
    entryPrice: 220,
    stopLoss: 230 // Stop loss above entry on BUY!
  });
  assert.equal(invalidOrder.valid, false, 'Stop loss >= entry price must fail');
  console.log('   ✅ Financial Invariants assertions passed.\n');

  // =============================================================
  // 2. OntologyGraphStore Indexing & Traversal
  // =============================================================
  console.log('2️⃣  Testing OntologyGraphStore Indexing & Traversal...');
  const graph = new OntologyGraphStore({ persist: false });

  // Add Company Node
  graph.addNode({
    id: 'company:AAPL',
    type: EntityTypes.COMPANY,
    name: 'Apple Inc.',
    properties: { ticker: 'AAPL', currentPrice: 225, marketCap: 3400000 }
  });

  // Add Competitor Node
  graph.addNode({
    id: 'company:MSFT',
    type: EntityTypes.COMPANY,
    name: 'Microsoft Corp.',
    properties: { ticker: 'MSFT', currentPrice: 420, marketCap: 3100000 }
  });

  // Add Edge
  graph.addEdge({
    from: 'company:AAPL',
    to: 'company:MSFT',
    relation: RelationTypes.COMPETES_WITH,
    weight: 0.85
  });

  assert.equal(graph.hasNode('company:AAPL'), true);
  assert.equal(graph.hasNode('company:MSFT'), true);
  assert.equal(graph.getNode('company:AAPL').name, 'Apple Inc.');

  const peers = graph.getNeighbors('company:AAPL', RelationTypes.COMPETES_WITH);
  assert.equal(peers.length, 1);
  assert.equal(peers[0].id, 'company:MSFT');

  // Subgraph extraction
  const subg = graph.extractSubgraph('company:AAPL', 1);
  assert.equal(subg.centerId, 'company:AAPL');
  assert.equal(subg.nodeCount, 2);
  assert.equal(subg.edgeCount, 1);
  console.log('   ✅ Graph store indexing and subgraph extraction passed.\n');

  // =============================================================
  // 3. Semantic Ingestion Pipeline
  // =============================================================
  console.log('3️⃣  Testing Semantic Ingestion Pipeline...');
  const ingestion = new SemanticIngestionPipeline({ graph });

  const mockCompanyData = {
    _meta: { asOfDate: '2026-09-07' },
    profile: {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      industry: 'Consumer Electronics'
    },
    market: {
      currentPrice: 220,
      marketCap: 3300000,
      sharesOutstanding: 15000,
      beta: 1.15,
      peRatio: 30.5,
      pegRatio: 1.45
    },
    financials: {
      annualHistory: [
        {
          fiscalYear: '2023',
          fiscalDate: '2023-09-30',
          revenue: 383285,
          operatingIncome: 114301,
          operatingCashFlow: 110543,
          capitalExpenditures: 10959,
          freeCashFlow: 99584,
          cashAndEquivalents: 29965,
          totalDebt: 111088,
          shareholdersEquity: 62146
        },
        {
          fiscalYear: '2024',
          fiscalDate: '2024-09-28',
          revenue: 391035,
          operatingIncome: 123216,
          operatingCashFlow: 118264,
          capitalExpenditures: 11500,
          freeCashFlow: 106764,
          cashAndEquivalents: 35000,
          totalDebt: 105000,
          shareholdersEquity: 70000
        }
      ]
    },
    competitors: {
      peers: [{ ticker: 'GOOGL', name: 'Alphabet Inc.' }, { ticker: 'MSFT', name: 'Microsoft Corp.' }]
    },
    macroEnvironment: {
      riskFreeRatePercent: 4.25,
      effectiveFedFundsRate: 5.33,
      yoyCPIInflationPercent: 2.7,
      bbbCorporateCreditSpreadPercent: 1.2
    }
  };

  const ingestRes = ingestion.ingestCompanyData(mockCompanyData);
  assert.equal(ingestRes.success, true);
  assert.ok(ingestRes.nodesCreatedOrUpdated >= 4, 'Should create company, statements, peers, macro');

  // Verify statement nodes attached
  const statements = graph.getNeighbors('company:AAPL', RelationTypes.REPORTS_STATEMENT);
  assert.equal(statements.length, 2, 'Should have 2 annual statements connected');

  // Verify macro factor attached
  const macroFactors = graph.getNeighbors('company:AAPL', RelationTypes.EXPOSED_TO_MACRO);
  assert.ok(macroFactors.length >= 3, 'Should be connected to macro factors');
  console.log('   ✅ Semantic Ingestion successfully objectified standard company data.\n');

  // =============================================================
  // 4. Ontology Logic Engine
  // =============================================================
  console.log('4️⃣  Testing Ontology Logic Engine (Reasoning Layer)...');
  const logic = new OntologyLogicEngine({ graph });

  // 4a. Damodaran DCF
  const dcf = logic.evaluateDamodaranDCF('AAPL');
  assert.ok(dcf.fairValuePerShare > 0, 'Fair value must be calculated');
  assert.ok(graph.hasNode(dcf.scenarioId), 'ValuationScenario node must be materialized in graph');
  assert.equal(graph.getNeighbors('company:AAPL', RelationTypes.HAS_VALUATION).length, 1);

  // 4b. Buffett Moat & Lynch GARP
  const moat = logic.evaluateBuffettMoat('AAPL');
  assert.ok(moat.latestRoic > 0, 'ROIC should be calculated');
  assert.ok(moat.moatRating, 'Moat rating should be assigned');

  const lynch = logic.evaluateLynchGARP('AAPL');
  assert.ok(lynch.lynchCategory, 'Lynch category should be assigned');

  // 4c. Investment Thesis Synthesis
  const thesis = logic.synthesizeInvestmentThesis('AAPL');
  assert.equal(thesis.type, EntityTypes.INVESTMENT_THESIS);
  assert.ok(['LONG', 'SHORT', 'NEUTRAL'].includes(thesis.properties.orientation));
  console.log(`   ✅ DCF Fair Value: $${dcf.fairValuePerShare}, Moat: ${moat.moatRating}, Thesis: ${thesis.properties.orientation}\n`);

  // =============================================================
  // 5. Systems of Action & Execution Contracts
  // =============================================================
  console.log('5️⃣  Testing Systems of Action (Execution Layer)...');
  const actions = new OntologyActionEngine({ graph, logic });

  // 5a. Action: RUN_DCF_SENSITIVITY
  const sensRes = await actions.executeAction(ActionTypes.RUN_DCF_SENSITIVITY, { ticker: 'AAPL' });
  assert.equal(sensRes.success, true);
  assert.ok(sensRes.result.matrix.length > 0);

  // 5b. Precondition Failure Test
  const failAction = await actions.executeAction(ActionTypes.PROPOSE_ORDER_TICKET, {
    ticker: 'AAPL',
    action: 'BUY',
    entryPrice: 220,
    stopLoss: 250 // Invalid stop loss
  });
  assert.equal(failAction.success, false, 'Precondition violation must block action');
  assert.ok(failAction.error.includes('Precondition Failed'));

  // 5c. Valid Action: PROPOSE_ORDER_TICKET
  const orderRes = await actions.executeAction(ActionTypes.PROPOSE_ORDER_TICKET, {
    ticker: 'AAPL',
    action: 'BUY',
    entryPrice: 220,
    stopLoss: 198,
    takeProfit: 275,
    positionSizePercent: 6.5
  });
  assert.equal(orderRes.success, true);
  assert.equal(orderRes.result.status, OrderStatus.PROPOSED);
  assert.ok(graph.hasNode(orderRes.result.orderId));

  // 5d. Action: PUBLISH_DECISION_MEMO
  const memoRes = await actions.executeAction(ActionTypes.PUBLISH_DECISION_MEMO, { ticker: 'AAPL' });
  assert.equal(memoRes.success, true);
  assert.ok(graph.hasNode(memoRes.result.memoId));

  // 5e. Verify Audit Ledger
  const audit = actions.getAuditLedger();
  assert.ok(audit.length >= 4, 'Audit ledger must record all action attempts');
  console.log(`   ✅ Actions executed and audited. Total audit entries: ${audit.length}\n`);

  console.log('🎉 ALL ONTOLOGY-DRIVEN ARCHITECTURE TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test Suite Failed:', err);
  process.exit(1);
});

