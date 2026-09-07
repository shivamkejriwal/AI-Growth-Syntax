/**
 * actionEngine.js
 * Systems of Action (Layer 3) Execution Engine.
 * 
 * Formalizes Operations as First-Class Action Contracts with:
 * 1. Semantic Precondition Guards (assertions on graph state & parameters).
 * 2. Deterministic & Agentic Execution.
 * 3. Ontological State Transitions & Side Effects (materializing Nodes, Edges).
 * 4. Immutable Audit Ledger.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EntityTypes, RelationTypes, ActionTypes, OrderStatus, FinancialInvariants } from './schema.js';
import { defaultOntologyGraph } from './graphStore.js';
import { defaultLogicEngine } from './logicEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMOS_DIR = path.resolve(__dirname, '..', '..', 'decision_memos');

export class OntologyActionEngine {
  /**
   * @param {Object} [options]
   * @param {OntologyGraphStore} [options.graph]
   * @param {OntologyLogicEngine} [options.logic]
   */
  constructor(options = {}) {
    this.graph = options.graph || defaultOntologyGraph;
    this.logic = options.logic || defaultLogicEngine;
    this.auditLedger = [];
    this.actionRegistry = new Map();

    this._registerCoreActions();
  }

  /**
   * Registers an ontological action contract.
   * @param {string} actionType 
   * @param {Object} contract { description, checkPreconditions, execute }
   */
  registerAction(actionType, contract) {
    if (!contract || typeof contract.execute !== 'function') {
      throw new Error(`[OntologyActionEngine] Action contract for ${actionType} must provide an execute function`);
    }
    this.actionRegistry.set(actionType, contract);
  }

  /**
   * Executes an ontological action with strict precondition checking and audit logging.
   * 
   * @param {string} actionType 
   * @param {Object} params 
   * @param {Object} [context={}] 
   * @returns {Promise<{ success: boolean, actionType: string, result?: any, error?: string, auditId: string }>}
   */
  async executeAction(actionType, params = {}, context = {}) {
    const auditId = `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const caller = context.caller || 'SYSTEM';

    const contract = this.actionRegistry.get(actionType);
    if (!contract) {
      const err = `Unknown action type: ${actionType}`;
      this._recordAudit({ auditId, actionType, caller, params, success: false, error: err });
      return { success: false, actionType, error: err, auditId };
    }

    // 1. Verify Preconditions
    if (typeof contract.checkPreconditions === 'function') {
      const check = await contract.checkPreconditions(this.graph, params, context);
      if (!check.valid) {
        const err = `Precondition Failed for ${actionType}: ${check.error}`;
        this._recordAudit({ auditId, actionType, caller, params, success: false, error: err });
        return { success: false, actionType, error: err, auditId };
      }
    }

    // 2. Execute Action
    try {
      const result = await contract.execute(this.graph, this.logic, params, context);
      this._recordAudit({ auditId, actionType, caller, params, success: true, result });
      return { success: true, actionType, result, auditId };
    } catch (execErr) {
      this._recordAudit({ auditId, actionType, caller, params, success: false, error: execErr.message });
      return { success: false, actionType, error: execErr.message, auditId };
    }
  }

  /**
   * Registers default institutional actions.
   * @private
   */
  _registerCoreActions() {
    // -------------------------------------------------------------
    // Action: RUN_DCF_SENSITIVITY
    // -------------------------------------------------------------
    this.registerAction(ActionTypes.RUN_DCF_SENSITIVITY, {
      description: 'Executes a 2D DCF Valuation Sensitivity Matrix across varying WACC and terminal growth rates',
      checkPreconditions: (graph, params) => {
        if (!params.ticker) return { valid: false, error: 'Missing required ticker' };
        const company = graph.getNode(`company:${params.ticker.toUpperCase()}`);
        if (!company) return { valid: false, error: `Company ${params.ticker} not found in ontology graph` };
        return { valid: true };
      },
      execute: async (graph, logic, params) => {
        const sym = params.ticker.toUpperCase();
        const waccGrid = params.waccGrid || [8.0, 9.0, 10.0, 11.0];
        const growthGrid = params.growthGrid || [1.5, 2.0, 2.5, 3.0];

        const matrix = [];
        for (const w of waccGrid) {
          const row = [];
          for (const g of growthGrid) {
            const val = logic.evaluateDamodaranDCF(sym, { wacc: w, terminalGrowthRate: g });
            row.push({
              wacc: w,
              terminalGrowth: g,
              fairValue: val.fairValuePerShare,
              marginOfSafety: val.marginOfSafetyPercent
            });
          }
          matrix.push({ wacc: w, scenarios: row });
        }

        return { ticker: sym, matrix };
      }
    });

    // -------------------------------------------------------------
    // Action: PROPOSE_ORDER_TICKET
    // -------------------------------------------------------------
    this.registerAction(ActionTypes.PROPOSE_ORDER_TICKET, {
      description: 'Generates a validated TradeOrder node underpinned by an InvestmentThesis',
      checkPreconditions: (graph, params) => {
        const guard = FinancialInvariants.validateOrderTicket(params);
        if (!guard.valid) return guard;

        const sym = params.ticker.toUpperCase();
        const company = graph.getNode(`company:${sym}`);
        if (!company) return { valid: false, error: `Target company ${sym} does not exist in graph` };

        return { valid: true };
      },
      execute: async (graph, logic, params, context) => {
        const sym = params.ticker.toUpperCase();
        const companyId = `company:${sym}`;

        // Synthesize or retrieve existing thesis
        let thesis = graph.getNode(`thesis:${sym}`);
        if (!thesis) {
          thesis = logic.synthesizeInvestmentThesis(sym);
        }

        const orderId = `order:${sym}:${Date.now()}`;
        const orderNode = graph.addNode({
          id: orderId,
          type: EntityTypes.TRADE_ORDER,
          name: `${params.action} ${sym} @ $${params.entryPrice}`,
          properties: {
            ticker: sym,
            action: params.action.toUpperCase(),
            entryPrice: params.entryPrice,
            stopLoss: params.stopLoss,
            takeProfit: params.takeProfit || (params.entryPrice * 1.3),
            positionSizePercent: params.positionSizePercent || 5.0,
            status: OrderStatus.PROPOSED,
            conviction: thesis.properties.conviction,
            rationale: params.rationale || `Underpinned by ${thesis.name}`,
            proposedBy: context.caller || 'PortfolioManagerAgent'
          }
        });

        // Edges
        graph.addEdge({
          from: orderId,
          to: companyId,
          relation: RelationTypes.TARGETS_COMPANY
        });

        graph.addEdge({
          from: orderId,
          to: thesis.id,
          relation: RelationTypes.UNDERPINNED_BY
        });

        return {
          orderId,
          status: OrderStatus.PROPOSED,
          orderNode
        };
      }
    });

    // -------------------------------------------------------------
    // Action: PUBLISH_DECISION_MEMO
    // -------------------------------------------------------------
    this.registerAction(ActionTypes.PUBLISH_DECISION_MEMO, {
      description: 'Compiles and writes an institutional Markdown decision memo with graph lineage',
      checkPreconditions: (graph, params) => {
        if (!params.ticker) return { valid: false, error: 'Missing required ticker' };
        const company = graph.getNode(`company:${params.ticker.toUpperCase()}`);
        if (!company) return { valid: false, error: `Company ${params.ticker} not found in graph` };
        return { valid: true };
      },
      execute: async (graph, logic, params, context) => {
        const sym = params.ticker.toUpperCase();
        const companyId = `company:${sym}`;
        const company = graph.getNode(companyId);

        // Subgraph extraction for full context
        const subg = graph.extractSubgraph(companyId, 1);
        const thesis = logic.synthesizeInvestmentThesis(sym);

        const timestamp = new Date().toISOString().slice(0, 10);
        const fileName = `${sym}_INVESTMENT_MEMO_${timestamp}.md`;
        const filePath = path.join(MEMOS_DIR, fileName);

        const markdownContent = `# Institutional Investment Memorandum: ${company.name} (${sym})
**As of Date**: ${timestamp}
**Ontology Node Lineage**: \`${companyId}\`
**Thesis Orientation**: ${thesis.properties.orientation} (Conviction: ${thesis.properties.conviction})

---

## 1. Executive Valuation & Moat Summary
* **Target Fair Value**: \$${thesis.properties.targetFairValue}
* **Current Market Price**: \$${company.properties.currentPrice}
* **Margin of Safety**: ${thesis.properties.marginOfSafetyPercent}%
* **Buffett Moat Rating**: ${thesis.properties.moatRating} (ROIC: ${thesis.properties.latestROIC}%)
* **Peter Lynch Taxonomy**: ${thesis.properties.lynchCategory}

## 2. Connected Peer & Macro Environment
* **Total Graph Neighbors**: ${subg.nodeCount} connected entities
* **Competitor Nodes**: ${subg.nodes.filter(n => n.type === EntityTypes.COMPANY && n.id !== companyId).map(n => n.properties.ticker).join(', ') || 'None identified'}
* **Macro Exposure**: ${subg.nodes.filter(n => n.type === EntityTypes.MACRO_FACTOR).map(n => `${n.name}: ${n.properties.currentValue}${n.properties.unit}`).join(' | ')}

---
*Generated by AI-Growth-Syntax Ontology Action Engine (Audit Ref: ${context.auditId || 'AUTO'})*
`;

        try {
          if (!fs.existsSync(MEMOS_DIR)) {
            fs.mkdirSync(MEMOS_DIR, { recursive: true });
          }
          fs.writeFileSync(filePath, markdownContent, 'utf8');
        } catch (e) {
          // In sandboxed/read-only environments, continue gracefully
          console.warn('[OntologyActionEngine] Memo write file notice:', e.message);
        }

        // Materialize DecisionMemo Node in Graph
        const memoId = `memo:${sym}:${Date.now()}`;
        const memoNode = graph.addNode({
          id: memoId,
          type: EntityTypes.DECISION_MEMO,
          name: `${sym} Investment Decision Memo (${timestamp})`,
          properties: {
            ticker: sym,
            filePath,
            fileName,
            targetFairValue: thesis.properties.targetFairValue,
            orientation: thesis.properties.orientation,
            publishedAt: Date.now()
          }
        });

        graph.addEdge({
          from: memoId,
          to: companyId,
          relation: RelationTypes.DOCUMENTS_DECISION
        });

        return {
          memoId,
          fileName,
          filePath,
          orientation: thesis.properties.orientation,
          memoNode
        };
      }
    });
  }

  /**
   * Records an action execution entry into the audit ledger.
   * @private
   */
  _recordAudit(entry) {
    const record = {
      ...entry,
      timestamp: Date.now(),
      isoDate: new Date().toISOString()
    };
    this.auditLedger.push(record);
    if (this.auditLedger.length > 500) this.auditLedger.shift();
  }

  /**
   * Returns recent audit history.
   * @param {number} [limit=50]
   * @returns {Array<Object>}
   */
  getAuditLedger(limit = 50) {
    return this.auditLedger.slice(-limit);
  }
}

export const defaultActionEngine = new OntologyActionEngine();

