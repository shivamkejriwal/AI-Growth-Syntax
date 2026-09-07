# Comprehensive Architecture & Thought Process: Ontology-Driven AI-Growth-Syntax
### Designing an Institutional-Grade, Neuro-Symbolic Equity Research & Trading Operating System

---

## 1. Executive Summary & Philosophical Shift

### The Core Problem with Current AI Financial Systems
Most modern AI financial platforms (including previous iterations of **AI-Growth-Syntax**) operate on a **Procedural Pipeline Model**:
1. APIs fetch raw numbers (Alpha Vantage, Zacks, SEC EDGAR, Seeking Alpha).
2. Data is dumped into loosely typed JSON objects or flat tables.
3. Procedural code computes mathematical ratios (DCF, ROIC, PEG).
4. Raw metrics and text dumps are prompted into an LLM (Gemini, Claude) to produce summaries.

**Why this breaks at scale:**
* **Semantic Loss**: The system knows that `AAPL.revenue = $391B`, but it has no structural representation of *how* Foxconn's supply delays propagate to iPhone revenue, or *why* a 50 bps Fed rate cut alters the terminal growth rate in Damodaran's DCF.
* **Unguarded Actions**: Trading desk proposals, order tickets, or valuation adjustments are generated via heuristic prompt text rather than strictly validated state transitions.
* **Ephemeral Memory**: Each query runs in isolation; the system does not construct a living, cumulative digital twin of public markets.

### The Solution: The Ontology-Driven Architecture (ODA)
In an **Ontology-Driven Architecture**, the **Financial Ontology** is the central, authoritative semantic middleware:
* **Data Sources (What the System Knows)** ground real-world truth into strongly-typed ontological entities and edges.
* **Logic Sources (How the System Thinks)** traverse the knowledge graph, combining deterministic mathematical formulas (symbolic logic) with LLM agents (statistical reasoning).
* **Systems of Action (What the System Does)** execute bounded mutations (order tickets, memo publications, scenario stress tests) protected by semantic preconditions and cryptographic audit trails.

---

## 2. The Minimum Viable 3-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   3. SYSTEMS OF ACTION                                          │
│                                  (The Execution Layer)                                          │
│                                                                                                 │
│   [Order Ticket Generator]   [Valuation Scenario Runner]   [Memo Publisher]   [Alert Dispatch]  │
└───────────────────────────────────────────────▲─────────────────────────────────────────────────┘
                                                │ Bound Action Contracts
                                                │ (Preconditions, Invariants & Rollbacks)
┌───────────────────────────────────────────────┴─────────────────────────────────────────────────┐
│                                 THE FINANCIAL ONTOLOGY KERNEL                                   │
│                                     (The Semantic Glue)                                         │
│                                                                                                 │
│  • ENTITIES (Nodes):                                                                            │
│    - Company, FinancialStatement, BusinessSegment, Competitor, Executive, MacroFactor         │
│  • RELATIONS (Edges):                                                                           │
│    - competesWith, suppliesTo, exposedToFactor, reportsSegment, underpinsThesis                 │
│  • INVARIANTS & CONSTRAINTS:                                                                    │
│    - Assets == Liabilities + Equity | FCF == OCF - CapEx | DiscountRate > RiskFreeRate          │
│  • ACTION DEFINITIONS:                                                                          │
│    - RunSensitivityMatrix, ExecuteDeskDebate, ProposeOrderTicket, FlagThesisViolation           │
└───────────────────────────────────────────────▲─────────────────────────────────────────────────┘
                    Grounds Queries & State     │ Drives Neuro-Symbolic Evaluation
┌───────────────────────────────────────────────┴─────────────────────────────────────────────────┐
│                                    2. LOGIC SOURCES                                             │
│                                  (The Reasoning Layer)                                          │
│                                                                                                 │
│   ┌───────────────────────────────┐               ┌─────────────────────────────────────────┐   │
│   │   DETERMINISTIC / SYMBOLIC    │               │         AGENTIC / STATISTICAL           │   │
│   │  • Damodaran 2-Stage DCF      │               │  • Bull vs. Bear Debate Agents          │   │
│   │  • Buffett ROIC / Compounding │               │  • Fisher Scuttlebutt Synthesizer       │   │
│   │  • Lynch GARP Classification  │               │  • Risk Committee Multi-Agent Council   │   │
│   │  • DuPont ROE Decomposition   │               │  • Qualitative Moat Auditor             │   │
│   └───────────────────────────────┘               └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────▲─────────────────────────────────────────────────┘
                                                │ Declarative Objectification Ingestion
┌───────────────────────────────────────────────┴─────────────────────────────────────────────────┐
│                                    1. DATA SOURCES                                              │
│                                (The World Model Inputs)                                         │
│                                                                                                 │
│   [Alpha Vantage]  [SEC EDGAR XBRL]  [FRED Macro]  [Seeking Alpha RSS]  [Zacks]  [Polymarket]   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Breakdown of the 3 Layers

### Layer 1: Data Sources — The "World Model Inputs" (What the System Knows)

#### Objective
Convert noisy, uncoordinated external APIs into canonical, immutable, and versioned **Ontological Entities**.

#### Ingestion & Objectification Pipeline
Instead of passing raw payloads to the rest of the application, raw inputs pass through declarative **Semantic Adapters**:

```
Raw SEC XBRL / Alpha Vantage Payload
          │
          ▼
┌───────────────────────────────────┐
│   Semantic Validation Schema      │  <-- Asserts required fields & data types
└─────────────────┬─────────────────┘
                  │
                  ▼
┌───────────────────────────────────┐
│    Entity & Relationship Builder  │  <-- Instantiates Nodes & Graph Edges
└─────────────────┬─────────────────┘
                  │
                  ▼
┌───────────────────────────────────┐
│   Tiered Knowledge Store (L1/L2)  │  <-- Writes to In-Memory Graph & SQLite/Firestore
└───────────────────────────────────┘
```

#### Canonical Node Schema
Every node in the graph conforms to a standard interface:
```typescript
interface OntologyNode<TProps = Record<string, any>> {
  id: string;              // e.g. "company:AAPL", "macro:US10Y", "segment:AAPL:services"
  type: EntityType;        // 'Company' | 'Filing' | 'Segment' | 'MacroFactor' | 'Thesis'
  name: string;            // Human-readable label
  properties: TProps;      // Validated, strongly-typed attributes
  validFrom: string;       // ISO timestamp or calendar date (for point-in-time backtesting)
  sourceLineage: {
    provider: string;      // e.g. "SEC_EDGAR_XBRL", "ALPHA_VANTAGE"
    fetchedAt: number;
    rawDigest: string;     // SHA-256 hash of original payload for auditability
  };
}
```

#### Canonical Edge Schema
Relationships between financial entities are explicit, directed, and typed:
```typescript
interface OntologyEdge<TProps = Record<string, any>> {
  id: string;              // e.g. "edge:AAPL:competesWith:MSFT"
  from: string;            // Source node ID
  to: string;              // Target node ID
  relation: RelationType;  // 'competesWith' | 'suppliesTo' | 'exposedTo' | 'reportsSegment'
  weight?: number;         // e.g. correlation coefficient or supply chain revenue dependence %
  properties?: TProps;     // e.g. { category: 'Cloud Infrastructure', confidence: 0.95 }
}
```

---

### Layer 2: Logic Sources — The "Reasoning Layer" (How the System Thinks)

In financial analysis, **pure LLMs are dangerous** because they hallucinate calculations, while **pure formulas are blind** because they cannot assess qualitative moats, brand loyalty, or regulatory pressure.

The Ontology enables **Neuro-Symbolic Fusion**:

#### 1. Symbolic & Deterministic Reasoning Engines
* **Damodaran Valuation Engine**: Computes normalized FCF, WACC convergence across risk regimes, and solves for intrinsic value per share.
* **Buffett Moat Scorer**: Computes 5-year return on invested capital ($\text{ROIC} = \frac{\text{NOPAT}}{\text{Invested Capital}}$), reinvestment efficiency, and organic compounding rate.
* **Lynch GARP Classifier**: Evaluates PEG ratio, inventory-to-sales velocity, and classifies into 6 archetypes (Slow Grower, Stalwart, Fast Grower, Cyclical, Turnaround, Asset Play).
* **Financial Invariant Checker**: Enforces core accounting equalities:
  $$\text{Total Assets} \equiv \text{Total Liabilities} + \text{Shareholders' Equity}$$
  $$\text{Free Cash Flow} \equiv \text{Operating Cash Flow} - \text{Capital Expenditures}$$
  If an incoming statement violates these identities, the ontology raises a validation invariant error before logic execution.

#### 2. Agentic & Statistical Reasoning Engines (LLMs)
LLM agents (e.g. Bull/Bear researchers, Fisher scuttlebutt synthesizers, Tri-party risk committees) interact with the ontology using **Semantic Graph Tools**:
* `get_entity_subgraph(entityId, depth)`: Retrieves a company and its immediate suppliers, competitors, and macro sensitivities.
* `evaluate_pillar(entityId, pillarName)`: Executes deterministic pillar logic and returns verified scores.
* `query_peer_benchmarks(entityId, metric)`: Computes relative valuation percentiles against verified peer edges.

Because the LLM never generates raw financial figures from scratch, **hallucinations are mathematically prevented**.

---

### Layer 3: Systems of Action — The "Execution Layer" (What the System Does)

An ontology is not just a read-only database; it is an **actionable state machine**. In GrowthSyntax, actions are defined as formal contracts with explicit **Preconditions**, **Execution Procedures**, and **Ontological Side Effects**.

#### Core Ontological Action Contracts:

| Action Name | Target Node | Preconditions (Guards) | Execution Logic | Side Effects / Write-Back |
| :--- | :--- | :--- | :--- | :--- |
| `RunDCFSensitivity` | `Company` | Valid FCF history $\ge 3$ yrs; WACC $> 0$; Terminal Growth $<$ 10Y Treasury | Runs multi-variable Monte Carlo / matrix solver across growth and discount rates. | Creates a new `ValuationScenario` node linked to `Company`. |
| `SimulateInstitutionalDebate` | `Company` | Fundamental dossier present; Technical indicators computed | Initiates Bull Agent vs. Bear Agent debate rounds; Risk Committee synthesis. | Instantiates an `InvestmentDebate` node and updates `SentimentState`. |
| `ProposeOrderTicket` | `Company` | Fair value calculated; Intrinsic margin of safety $\ge 15\%$; ATR stop-loss defined | Portfolio manager sizes position based on Kelly criterion / risk limits ($\le 10\%$). | Instantiates a `TradeOrder` node with status `PROPOSED`. |
| `PublishInvestmentMemo` | `Company` | 4 pillars scored; Desk debate concluded; Order ticket generated | Renders institutional Markdown/HTML decision dossier with full cryptographic lineage. | Persists a `DecisionMemo` node; exports markdown file to `/decision_memos`. |
| `AssertThesisInvariants` | `Thesis` | Monitoring interval reached | Checks if current price $\le$ stopLoss or ROIC dropped $> 300$ bps. | Transitions `Thesis.state` from `ACTIVE` to `STOPPED_OUT` or `VIOLATED`. |

---

## 4. The Concrete Metamodel for AI-Growth-Syntax

### Entities (Graph Nodes)
1. **`Company`**: Ticker, CIK, name, sector, industry, current price, shares, beta.
2. **`FinancialStatement`**: Fiscal year, period, revenue, operating income, net income, FCF, net debt, ROIC.
3. **`BusinessSegment`**: Name, revenue contribution, operating margin, geographic exposure.
4. **`Competitor`**: Peer ticker, relative valuation, market share, SIC classification.
5. **`MacroFactor`**: Indicator code (US10Y, FEDFUNDS, CPI, BAA10Y), current value, regime.
6. **`InvestmentThesis`**: Target ticker, orientation (LONG/SHORT), target price, stop loss, conviction, pillar scores.
7. **`ValuationScenario`**: Discount rate, terminal growth rate, revenue CAGR, calculated fair value.
8. **`TradeOrder`**: Action (BUY/SELL), entry price, stop-loss, take-profit, position size, status (PROPOSED/EXECUTED/REJECTED).

### Relationships (Graph Edges)
* `[Company] ──reports──> [FinancialStatement]`
* `[Company] ──operatesSegment──> [BusinessSegment]`
* `[Company] ──competesWith──> [Company]` (weighted by peer similarity)
* `[Company] ──suppliesTo──> [Company]` (weighted by estimated revenue dependence)
* `[Company] ──sensitiveTo──> [MacroFactor]` (weighted by historical rate beta)
* `[InvestmentThesis] ──underpins──> [TradeOrder]`
* `[Company] ──hasValuation──> [ValuationScenario]`

---

## 5. Migration Roadmap & Implemented Modules

### 1. Metamodel & Schema (`lib/ontology/schema.js`)
* Formal definitions for `EntityTypes`, `RelationTypes`, `ActionTypes`, `OrderStatus`, and `ThesisState`.
* Invariant validators (`FinancialInvariants`): Balance Sheet equality, Free Cash Flow identity, WACC plausibility, Order Ticket risk limits.

### 2. Knowledge Graph Store (`lib/ontology/graphStore.js`)
* In-Memory graph engine with O(1) adjacency indexes and SQLite persistence backing (`.data/growth_syntax.sqlite`).
* Bounded subgraph extraction (`extractSubgraph`) for LLMs and Cytoscape/D3 visualizers.

### 3. Declarative Ingestion Pipeline (`lib/ontology/ingestion.js`)
* Maps normalized `StandardCompanyData` into `Company`, `FinancialStatement`, `Competitor`, and `MacroFactor` nodes with directed graph edges.

### 4. Logic Engine (`lib/ontology/logicEngine.js`)
* Damodaran 2-stage DCF, Buffett ROIC / Moat evaluation, Lynch GARP classification, and Investment Thesis synthesis operating directly on graph nodes.

### 5. Systems of Action (`lib/ontology/actionEngine.js`)
* Action contracts with precondition assertions, execution procedures, state mutations, and an immutable audit ledger (`getAuditLedger`).

### 6. MCP Server & REST API Integration
* Extended `mcp-server.js` with `get_ontology_subgraph` and `execute_ontology_action`.
* Added REST endpoints in `server.js`: `/api/ontology/graph`, `/api/ontology/action`, `/api/ontology/stats`.

