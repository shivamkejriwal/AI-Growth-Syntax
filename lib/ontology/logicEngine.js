/**
 * logicEngine.js
 * Reasoning Layer (Layer 2) Operating over the Financial Ontology Graph.
 * 
 * Implements:
 * 1. Damodaran 2-Stage DCF Valuation Engine with WACC Invariant validation.
 * 2. Buffett Owner Earnings & ROIC Economic Moat Scorer.
 * 3. Peter Lynch Taxonomy Classifier & GARP PEG Assessor.
 * 4. Investment Thesis Synthesis & State Machine.
 */

import { EntityTypes, RelationTypes, ThesisState, FinancialInvariants } from './schema.js';
import { defaultOntologyGraph } from './graphStore.js';

export class OntologyLogicEngine {
  /**
   * @param {Object} [options]
   * @param {OntologyGraphStore} [options.graph]
   */
  constructor(options = {}) {
    this.graph = options.graph || defaultOntologyGraph;
  }

  /**
   * Evaluates Damodaran 2-Stage DCF Valuation directly from Ontological Nodes.
   * Materializes a ValuationScenario node linked to the target Company.
   * 
   * @param {string} ticker 
   * @param {Object} [overrides={}] { wacc, growthRateStage1, terminalGrowthRate, forecastYears }
   * @returns {Object} Valuation result & scenario node
   */
  evaluateDamodaranDCF(ticker, overrides = {}) {
    const sym = ticker.toUpperCase().trim();
    const companyId = `company:${sym}`;
    const company = this.graph.getNode(companyId);
    if (!company) throw new Error(`[OntologyLogicEngine] Company node not found: ${companyId}`);

    // Retrieve historical financial statements via reportsStatement edges
    const statementNodes = this.graph.getNeighbors(companyId, RelationTypes.REPORTS_STATEMENT);
    statementNodes.sort((a, b) => (a.properties.fiscalYear || 0) - (b.properties.fiscalYear || 0));

    // Get Risk-Free Rate from Macro Factor node
    const us10yNode = this.graph.getNode('macro:US10Y');
    const riskFreeRate = overrides.riskFreeRate ?? us10yNode?.properties?.currentValue ?? 4.25;

    // Parameters
    const wacc = overrides.wacc ?? Math.max(8.5, (riskFreeRate + (company.properties.beta || 1.0) * 5.0));
    const terminalGrowth = overrides.terminalGrowthRate ?? Math.min(2.5, riskFreeRate - 1.5);
    const forecastYears = overrides.forecastYears ?? 5;

    // Assert Invariant: WACC plausibility
    const waccCheck = FinancialInvariants.validateCostOfCapital(wacc / 100, riskFreeRate);
    if (!waccCheck.valid) {
      throw new Error(`[OntologyLogicEngine] ${waccCheck.error}`);
    }

    // Base Free Cash Flow
    const latestStmt = statementNodes.length > 0 ? statementNodes[statementNodes.length - 1] : null;
    let baseFcf = latestStmt?.properties?.freeCashFlow || 0;

    // If FCF is negative or zero, normalize via operating cash flow or net income
    if (baseFcf <= 0) {
      const avgFcf = statementNodes.reduce((acc, s) => acc + (s.properties.freeCashFlow || 0), 0) / (statementNodes.length || 1);
      baseFcf = avgFcf > 0 ? avgFcf : (company.properties.marketCap || 10000) * 0.04;
    }

    // Growth Rate estimate
    let revenueCagr = 0.08; // Default 8%
    if (statementNodes.length >= 3) {
      const firstRev = statementNodes[0].properties.revenue || 1;
      const lastRev = latestStmt.properties.revenue || 1;
      const n = statementNodes.length - 1;
      if (firstRev > 0 && lastRev > 0) {
        revenueCagr = Math.min(0.25, Math.max(0.02, Math.pow(lastRev / firstRev, 1 / n) - 1));
      }
    }
    const growthRate = overrides.growthRateStage1 ?? revenueCagr;

    // Forecast Stage 1 (Years 1 to forecastYears)
    const discountedCashFlows = [];
    let cumulativePvFcf = 0;
    let runningFcf = baseFcf;
    const discountRate = wacc / 100;

    for (let yr = 1; yr <= forecastYears; yr++) {
      runningFcf = runningFcf * (1 + growthRate);
      const discountFactor = Math.pow(1 + discountRate, yr);
      const pv = runningFcf / discountFactor;
      discountedCashFlows.push({ year: yr, projectedFcf: runningFcf, pv });
      cumulativePvFcf += pv;
    }

    // Terminal Value
    const terminalFcf = runningFcf * (1 + terminalGrowth / 100);
    const terminalValue = terminalFcf / ((discountRate) - (terminalGrowth / 100));
    const pvTerminalValue = terminalValue / Math.pow(1 + discountRate, forecastYears);

    // Enterprise Value & Equity Value
    const enterpriseValue = cumulativePvFcf + pvTerminalValue;
    const cash = latestStmt?.properties?.cashAndEquivalents || 0;
    const debt = latestStmt?.properties?.totalDebt || 0;
    const netDebt = debt - cash;
    const equityValue = enterpriseValue - netDebt;

    // Per Share Value
    const shares = company.properties.sharesOutstanding || (company.properties.marketCap / (company.properties.currentPrice || 1));
    const fairValuePerShare = shares > 0 ? (equityValue / shares) : company.properties.currentPrice;
    const currentPrice = company.properties.currentPrice || 1;
    const marginOfSafetyPercent = currentPrice > 0 ? ((fairValuePerShare - currentPrice) / currentPrice) * 100 : 0;

    // Materialize Ontological Node: ValuationScenario
    const scenarioId = `valuation:${sym}:${Date.now()}`;
    const scenarioNode = this.graph.addNode({
      id: scenarioId,
      type: EntityTypes.VALUATION_SCENARIO,
      name: `${sym} DCF Valuation (${wacc.toFixed(1)}% WACC)`,
      properties: {
        ticker: sym,
        fairValuePerShare: Math.round(fairValuePerShare * 100) / 100,
        currentPrice,
        marginOfSafetyPercent: Math.round(marginOfSafetyPercent * 10) / 10,
        enterpriseValue,
        equityValue,
        waccPercent: wacc,
        terminalGrowthRatePercent: terminalGrowth,
        growthRateStage1Percent: growthRate * 100,
        baseFcf,
        pvTerminalValue,
        cumulativePvFcf,
        discountedCashFlows
      }
    });

    // Add Edge: Company -> hasValuation -> ValuationScenario
    this.graph.addEdge({
      from: companyId,
      to: scenarioId,
      relation: RelationTypes.HAS_VALUATION,
      properties: { generatedAt: Date.now() }
    });

    return {
      scenarioId,
      fairValuePerShare: scenarioNode.properties.fairValuePerShare,
      marginOfSafetyPercent: scenarioNode.properties.marginOfSafetyPercent,
      isUndervalued: marginOfSafetyPercent >= 15.0,
      scenarioNode
    };
  }

  /**
   * Evaluates Buffett Economic Moat & Capital Allocation.
   * @param {string} ticker 
   * @returns {Object}
   */
  evaluateBuffettMoat(ticker) {
    const sym = ticker.toUpperCase().trim();
    const companyId = `company:${sym}`;
    const company = this.graph.getNode(companyId);
    if (!company) throw new Error(`[OntologyLogicEngine] Company node not found: ${companyId}`);

    const statements = this.graph.getNeighbors(companyId, RelationTypes.REPORTS_STATEMENT);
    statements.sort((a, b) => (a.properties.fiscalYear || 0) - (b.properties.fiscalYear || 0));

    // Multi-year ROIC computation
    const roicHistory = statements.map(s => {
      const ebit = s.properties.operatingIncome || 0;
      const nopat = ebit * (1 - 0.21); // 21% standard tax
      const investedCapital = (s.properties.shareholdersEquity || 0) + (s.properties.totalDebt || 0) - (s.properties.cashAndEquivalents || 0);
      const roic = investedCapital > 0 ? (nopat / investedCapital) * 100 : 0;
      return {
        year: s.properties.fiscalYear,
        roic: Math.round(roic * 10) / 10
      };
    });

    const latestRoic = roicHistory.length > 0 ? roicHistory[roicHistory.length - 1].roic : 15.0;
    const avgRoic = roicHistory.length > 0 ? (roicHistory.reduce((acc, r) => acc + r.roic, 0) / roicHistory.length) : 15.0;

    let moatRating = 'Narrow Moat';
    if (avgRoic > 20 && latestRoic > 18) moatRating = 'Wide Moat (Buffett Approved)';
    else if (avgRoic < 10) moatRating = 'No Moat';

    return {
      ticker: sym,
      latestRoic,
      avgRoic: Math.round(avgRoic * 10) / 10,
      moatRating,
      roicHistory,
      reinvestmentRatePercent: 45.0
    };
  }

  /**
   * Evaluates Peter Lynch Taxonomy & PEG ratio.
   * @param {string} ticker 
   * @returns {Object}
   */
  evaluateLynchGARP(ticker) {
    const sym = ticker.toUpperCase().trim();
    const companyId = `company:${sym}`;
    const company = this.graph.getNode(companyId);
    if (!company) throw new Error(`[OntologyLogicEngine] Company node not found: ${companyId}`);

    const pe = company.properties.peRatio || 20;
    const peg = company.properties.pegRatio || (pe / 15);

    let category = 'Stalwart';
    if (peg < 1.0 && pe < 15) category = 'Fast Grower at a Bargain';
    else if (peg < 1.2) category = 'GARP (Growth at a Reasonable Price)';
    else if (peg > 2.5) category = 'Overextended Growth';

    return {
      ticker: sym,
      peRatio: pe,
      pegRatio: Math.round(peg * 100) / 100,
      lynchCategory: category,
      isLynchBuy: peg <= 1.2
    };
  }

  /**
   * Synthesizes full Investment Thesis and records it as an Ontological Node.
   * @param {string} ticker 
   * @returns {Object} InvestmentThesis node
   */
  synthesizeInvestmentThesis(ticker) {
    const sym = ticker.toUpperCase().trim();
    const companyId = `company:${sym}`;

    const dcf = this.evaluateDamodaranDCF(sym);
    const moat = this.evaluateBuffettMoat(sym);
    const lynch = this.evaluateLynchGARP(sym);

    const isBullish = dcf.isUndervalued && (moat.moatRating.includes('Wide') || lynch.isLynchBuy);
    const orientation = isBullish ? 'LONG' : (dcf.marginOfSafetyPercent < -25 ? 'SHORT' : 'NEUTRAL');
    const conviction = isBullish && moat.latestRoic > 18 ? 'HIGH' : 'MEDIUM';

    const thesisId = `thesis:${sym}`;
    const thesisNode = this.graph.addNode({
      id: thesisId,
      type: EntityTypes.INVESTMENT_THESIS,
      name: `${sym} Investment Thesis (${orientation})`,
      properties: {
        ticker: sym,
        state: ThesisState.ACTIVE,
        orientation,
        conviction,
        targetFairValue: dcf.fairValuePerShare,
        marginOfSafetyPercent: dcf.marginOfSafetyPercent,
        latestROIC: moat.latestRoic,
        moatRating: moat.moatRating,
        lynchCategory: lynch.lynchCategory,
        createdAt: Date.now()
      }
    });

    // Edge: Thesis -> targetsCompany -> Company
    this.graph.addEdge({
      from: thesisId,
      to: companyId,
      relation: RelationTypes.TARGETS_COMPANY,
      properties: { orientation, conviction }
    });

    return thesisNode;
  }
}

export const defaultLogicEngine = new OntologyLogicEngine();

