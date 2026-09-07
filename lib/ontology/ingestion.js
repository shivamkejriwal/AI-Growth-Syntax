/**
 * ingestion.js
 * Declarative Semantic Ingestion & Objectification Pipeline.
 * 
 * Transforms normalized company data, external feeds, and financial statements
 * into canonical Ontological Nodes and Directed Edges.
 */

import { EntityTypes, RelationTypes, FinancialInvariants } from './schema.js';
import { defaultOntologyGraph } from './graphStore.js';

export class SemanticIngestionPipeline {
  /**
   * @param {Object} [options]
   * @param {OntologyGraphStore} [options.graph]
   */
  constructor(options = {}) {
    this.graph = options.graph || defaultOntologyGraph;
  }

  /**
   * Ingests a full StandardCompanyData object into the Ontology Graph.
   * 
   * @param {Object} companyData Output of buildStandardCompanyData()
   * @returns {Object} Ingestion report with created nodes and edges
   */
  ingestCompanyData(companyData) {
    if (!companyData || !companyData.profile || !companyData.profile.ticker) {
      throw new Error('[SemanticIngestionPipeline] Invalid companyData: missing profile.ticker');
    }

    const ticker = companyData.profile.ticker.toUpperCase().trim();
    const companyNodeId = `company:${ticker}`;
    const createdNodes = [];
    const createdEdges = [];
    const invariantWarnings = [];

    // 1. Ingest Core Company Node
    const companyNode = this.graph.addNode({
      id: companyNodeId,
      type: EntityTypes.COMPANY,
      name: companyData.profile.name || ticker,
      properties: {
        ticker,
        sector: companyData.profile.sector || 'General',
        industry: companyData.profile.industry || 'General',
        description: companyData.profile.description || '',
        cik: companyData.secFilings?.companyCIK || 'N/A',
        currentPrice: companyData.market?.currentPrice || 0,
        marketCap: companyData.market?.marketCap || 0,
        sharesOutstanding: companyData.market?.sharesOutstanding || 0,
        beta: companyData.market?.beta || 1.0,
        peRatio: companyData.market?.peRatio || 0,
        pegRatio: companyData.market?.pegRatio || 0,
        dividendYieldPercent: companyData.market?.dividendYieldPercent || 0,
        ratios: companyData.financials?.ratios || {}
      },
      validFrom: companyData._meta?.asOfDate
    });
    createdNodes.push(companyNode.id);

    // 2. Ingest Financial Statements (Annual History)
    const annualHistory = companyData.financials?.annualHistory || [];
    for (const stmt of annualHistory) {
      const year = stmt.fiscalYear;
      if (!year) continue;

      const statementNodeId = `statement:${ticker}:${year}`;

      // Invariant check on statement
      const fcfCheck = FinancialInvariants.validateFreeCashFlow({
        operatingCashFlow: stmt.operatingCashFlow,
        capitalExpenditures: stmt.capitalExpenditures,
        freeCashFlow: stmt.freeCashFlow
      });
      if (!fcfCheck.valid) {
        invariantWarnings.push({ statementId: statementNodeId, warning: fcfCheck.error });
      }

      const stmtNode = this.graph.addNode({
        id: statementNodeId,
        type: EntityTypes.FINANCIAL_STATEMENT,
        name: `${ticker} FY${year} Statement`,
        properties: {
          ticker,
          fiscalYear: year,
          fiscalDate: stmt.fiscalDate,
          revenue: stmt.revenue,
          grossProfit: stmt.grossProfit,
          operatingIncome: stmt.operatingIncome,
          netIncome: stmt.netIncome,
          ebitda: stmt.ebitda,
          dilutedEPS: stmt.dilutedEPS,
          rnd: stmt.researchAndDevelopment,
          operatingCashFlow: stmt.operatingCashFlow,
          capex: stmt.capitalExpenditures,
          freeCashFlow: stmt.freeCashFlow,
          cashAndEquivalents: stmt.cashAndEquivalents,
          totalDebt: stmt.totalDebt,
          shareholdersEquity: stmt.shareholdersEquity,
          workingCapital: stmt.workingCapital,
          fcfInvariantValid: fcfCheck.valid
        },
        validFrom: stmt.fiscalDate
      });
      createdNodes.push(stmtNode.id);

      // Edge: Company -> reportsStatement -> FinancialStatement
      const stmtEdge = this.graph.addEdge({
        from: companyNodeId,
        to: statementNodeId,
        relation: RelationTypes.REPORTS_STATEMENT,
        properties: { fiscalYear: year }
      });
      createdEdges.push(stmtEdge.id);
    }

    // 3. Ingest Competitors & Peer Edges
    const peers = companyData.competitors?.peers || [];
    for (const peer of peers) {
      const peerTicker = (typeof peer === 'string' ? peer : peer.ticker || '').toUpperCase().trim();
      if (!peerTicker || peerTicker === ticker) continue;

      const peerNodeId = `company:${peerTicker}`;
      // Add or get peer node (if not already fully ingested, create stub)
      if (!this.graph.hasNode(peerNodeId)) {
        const peerNode = this.graph.addNode({
          id: peerNodeId,
          type: EntityTypes.COMPANY,
          name: peer.name || peerTicker,
          properties: {
            ticker: peerTicker,
            isStub: true,
            marketCap: peer.marketCap || 0,
            peRatio: peer.peRatio || 0
          }
        });
        createdNodes.push(peerNode.id);
      }

      // Bidirectional Competitor Edge
      const compEdge = this.graph.addEdge({
        from: companyNodeId,
        to: peerNodeId,
        relation: RelationTypes.COMPETES_WITH,
        properties: {
          confidence: 0.9,
          discoveredVia: 'SIC/SeekingAlpha'
        }
      });
      createdEdges.push(compEdge.id);
    }

    // 4. Ingest Macro Environment Factors & Sensitivities
    const macro = companyData.macroEnvironment || {};
    const macroFactors = [
      { id: 'macro:US10Y', name: '10-Year Treasury Yield', value: macro.riskFreeRatePercent, unit: '%' },
      { id: 'macro:FEDFUNDS', name: 'Effective Fed Funds Rate', value: macro.effectiveFedFundsRate, unit: '%' },
      { id: 'macro:CPI', name: 'YoY CPI Inflation', value: macro.yoyCPIInflationPercent, unit: '%' },
      { id: 'macro:CREDIT_SPREAD', name: 'BBB Corporate Credit Spread', value: macro.bbbCorporateCreditSpreadPercent, unit: '%' }
    ];

    for (const factor of macroFactors) {
      if (factor.value === undefined || factor.value === null) continue;

      const factorNode = this.graph.addNode({
        id: factor.id,
        type: EntityTypes.MACRO_FACTOR,
        name: factor.name,
        properties: {
          code: factor.id.replace('macro:', ''),
          currentValue: factor.value,
          unit: factor.unit
        }
      });
      createdNodes.push(factorNode.id);

      // Edge: Company -> exposedToMacro -> MacroFactor
      const macroEdge = this.graph.addEdge({
        from: companyNodeId,
        to: factor.id,
        relation: RelationTypes.EXPOSED_TO_MACRO,
        properties: {
          beta: companyData.market?.beta || 1.0
        }
      });
      createdEdges.push(macroEdge.id);
    }

    return {
      success: true,
      ticker,
      companyNodeId,
      nodesCreatedOrUpdated: createdNodes.length,
      edgesCreatedOrUpdated: createdEdges.length,
      invariantWarnings
    };
  }
}

export const defaultIngestionPipeline = new SemanticIngestionPipeline();

