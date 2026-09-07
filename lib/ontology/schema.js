/**
 * schema.js
 * Core Metamodel & Schema Definitions for the Financial Ontology.
 * 
 * Defines:
 * 1. EntityTypes (Node types in the financial world model)
 * 2. RelationTypes (Directed edge types between entities)
 * 3. ActionTypes (First-class executable operations with preconditions)
 * 4. Invariant Validators (Accounting identities and financial integrity assertions)
 */

export const EntityTypes = Object.freeze({
  COMPANY: 'Company',
  FINANCIAL_STATEMENT: 'FinancialStatement',
  BUSINESS_SEGMENT: 'BusinessSegment',
  COMPETITOR: 'Competitor',
  MACRO_FACTOR: 'MacroFactor',
  VALUATION_SCENARIO: 'ValuationScenario',
  INVESTMENT_THESIS: 'InvestmentThesis',
  TRADE_ORDER: 'TradeOrder',
  DECISION_MEMO: 'DecisionMemo'
});

export const RelationTypes = Object.freeze({
  REPORTS_STATEMENT: 'reportsStatement',     // Company -> FinancialStatement
  OPERATES_SEGMENT: 'operatesSegment',       // Company -> BusinessSegment
  COMPETES_WITH: 'competesWith',             // Company -> Company / Competitor
  SUPPLIES_TO: 'suppliesTo',                 // Company -> Company
  EXPOSED_TO_MACRO: 'exposedToMacro',       // Company -> MacroFactor
  HAS_VALUATION: 'hasValuation',             // Company -> ValuationScenario
  UNDERPINNED_BY: 'underpinnedBy',           // TradeOrder -> InvestmentThesis
  TARGETS_COMPANY: 'targetsCompany',         // TradeOrder | InvestmentThesis -> Company
  DOCUMENTS_DECISION: 'documentsDecision'    // DecisionMemo -> Company
});

export const ActionTypes = Object.freeze({
  RUN_DCF_SENSITIVITY: 'RUN_DCF_SENSITIVITY',
  SIMULATE_DESK_DEBATE: 'SIMULATE_DESK_DEBATE',
  PROPOSE_ORDER_TICKET: 'PROPOSE_ORDER_TICKET',
  PUBLISH_DECISION_MEMO: 'PUBLISH_DECISION_MEMO',
  ASSERT_THESIS_INVARIANTS: 'ASSERT_THESIS_INVARIANTS'
});

export const OrderStatus = Object.freeze({
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  CANCELLED: 'CANCELLED'
});

export const ThesisState = Object.freeze({
  ACTIVE: 'ACTIVE',
  MONITORING: 'MONITORING',
  TARGET_REACHED: 'TARGET_REACHED',
  STOPPED_OUT: 'STOPPED_OUT',
  INVALIDATED: 'INVALIDATED'
});

/**
 * Invariant Validation Engine
 * Asserts structural and mathematical truths over ontological entities.
 */
export class FinancialInvariants {
  /**
   * Asserts fundamental balance sheet equality: Assets == Liabilities + Equity (within epsilon)
   * @param {Object} statementProps 
   * @param {number} [epsilon=1.0] Tolerance for rounding in millions/units
   * @returns {{ valid: boolean, error?: string, delta?: number }}
   */
  static validateBalanceSheet(statementProps, epsilon = 1.0) {
    const assets = Number(statementProps.totalAssets || statementProps.currentAssets || 0);
    const liabilities = Number(statementProps.totalLiabilities || statementProps.currentLiabilities || 0);
    const equity = Number(statementProps.shareholdersEquity || statementProps.equity || 0);

    if (assets === 0 && liabilities === 0 && equity === 0) {
      return { valid: true, note: 'Empty balance sheet properties skipped' };
    }

    const calculated = liabilities + equity;
    const delta = Math.abs(assets - calculated);

    if (delta > epsilon && assets > 0 && calculated > 0) {
      return {
        valid: false,
        delta,
        error: `Balance Sheet Invariant Violated: Assets (${assets}) != Liabilities (${liabilities}) + Equity (${equity}). Delta: ${delta}`
      };
    }

    return { valid: true, delta };
  }

  /**
   * Asserts Free Cash Flow identity: FCF == OCF - CapEx (within epsilon)
   * @param {Object} cashFlowProps 
   * @param {number} [epsilon=1.0]
   * @returns {{ valid: boolean, error?: string, delta?: number }}
   */
  static validateFreeCashFlow(cashFlowProps, epsilon = 1.0) {
    const ocf = Number(cashFlowProps.operatingCashFlow || cashFlowProps.ncfo || 0);
    const capex = Number(cashFlowProps.capitalExpenditures || cashFlowProps.capex || 0);
    const reportedFcf = Number(cashFlowProps.freeCashFlow || cashFlowProps.fcf || 0);

    if (ocf === 0 && capex === 0 && reportedFcf === 0) {
      return { valid: true, note: 'Zero cash flow properties skipped' };
    }

    const calculatedFcf = ocf - capex;
    const delta = Math.abs(reportedFcf - calculatedFcf);

    if (delta > epsilon && (ocf !== 0 || capex !== 0)) {
      return {
        valid: false,
        delta,
        error: `Free Cash Flow Invariant Violated: Reported FCF (${reportedFcf}) != OCF (${ocf}) - CapEx (${capex}). Delta: ${delta}`
      };
    }

    return { valid: true, delta };
  }

  /**
   * Asserts Discount Rate (WACC) plausibility: WACC > risk-free rate
   * @param {number} wacc 
   * @param {number} riskFreeRate 
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateCostOfCapital(wacc, riskFreeRate = 2.0) {
    if (typeof wacc !== 'number' || isNaN(wacc) || wacc <= 0) {
      return { valid: false, error: `Invalid WACC: ${wacc}. Must be a positive non-zero number.` };
    }
    if (wacc < (riskFreeRate / 100) && riskFreeRate > 0) {
      return { valid: false, error: `WACC (${wacc}) cannot be lower than the Risk-Free Rate (${riskFreeRate}%).` };
    }
    return { valid: true };
  }

  /**
   * Asserts Order Ticket sizing and safety bounds before execution.
   * @param {Object} orderProps 
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateOrderTicket(orderProps) {
    if (!orderProps.ticker) return { valid: false, error: 'Order must specify target ticker.' };
    if (!orderProps.action || !['BUY', 'SELL', 'HOLD'].includes(orderProps.action.toUpperCase())) {
      return { valid: false, error: `Invalid action: ${orderProps.action}. Must be BUY, SELL, or HOLD.` };
    }
    if (orderProps.action.toUpperCase() !== 'HOLD') {
      if (!orderProps.entryPrice || orderProps.entryPrice <= 0) {
        return { valid: false, error: 'Entry price must be positive.' };
      }
      if (!orderProps.stopLoss || orderProps.stopLoss <= 0) {
        return { valid: false, error: 'Stop loss must be specified and positive.' };
      }
      if (orderProps.action.toUpperCase() === 'BUY' && orderProps.stopLoss >= orderProps.entryPrice) {
        return { valid: false, error: `BUY order stop-loss (${orderProps.stopLoss}) must be below entry price (${orderProps.entryPrice}).` };
      }
      if (orderProps.positionSizePercent && (orderProps.positionSizePercent <= 0 || orderProps.positionSizePercent > 20)) {
        return { valid: false, error: `Position size (${orderProps.positionSizePercent}%) violates portfolio risk bounds (Max 20%).` };
      }
    }
    return { valid: true };
  }
}

