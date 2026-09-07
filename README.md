# AI-Growth-Syntax 🚀
### AI-First Equity & Market Research Terminal • Composite Investment Engine

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![Zero-Dependency](https://img.shields.io/badge/Dependencies-Zero-blue.svg)](https://nodejs.org)
[![Architecture](https://img.shields.io/badge/Framework-4--Pillars-purple.svg)](#the-4-pillar-composite-framework)
[![MCP](https://img.shields.io/badge/Protocol-MCP%202024--11--05-indigo.svg)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-MIT-gray.svg)](LICENSE)

**AI-Growth-Syntax** is an institutional-grade, zero-dependency equity and macroeconomic research terminal. Built on native Node.js ES Modules and modern web standards, it synthesizes fundamental filings, primary channel reconnaissance, valuation frameworks, competitor discovery, and multi-agent intelligence into an actionable investment dashboard and decision memoranda.

---

## Architecture Overview

```
                                  User Search / Ticker (e.g., MSFT)
                                                  │
                                                  ▼
                                     AI-Growth-Syntax Server
                                           (server.js)
                                                  │
                ┌─────────────────────────────────┼─────────────────────────────────┐
                ▼                                 ▼                                 ▼
      4-Pillar Composite Engine       Competitor Discovery Matrix       Fodda AI MCP Intelligence
     (lib/compositeInvestor.js)        (lib/competitorEngine.js)           (lib/foddaClient.js)
                │                                 │                                 │
     ┌──────────┼──────────┐                      │                         [Earnings Truth Layer]
     ▼          ▼          ▼                      ▼                         [300+ Domain Graphs]
1. Lynch    2. Fisher   3. Buffett         [SEC SIC Peers]                  [Q&A Directness Score]
(PEG/Cash) (Scuttle)   (Owner Earn)        [Web Discovery]
     │          │          │               [Peer Benchmarks]
     └──────────┼──────────┘                      │
                ▼                                 │
           4. Damodaran                           │
        (WACC/R&D Capital)                        │
                │                                 │
                └────────────────┬────────────────┘
                                 │
                                 ▼
                      Single Page Dashboard UI
                      (public/ - Zero Frontend Dependencies)
             [Visual Scorecard • 4 Pillars • Peer Matrix • Memo]
```

---

## The 4-Pillar Composite Framework

AI-Growth-Syntax operationalizes the world's most proven fundamental investment philosophies:

### 1. Peter Lynch — Ground-Level Edge & Growth at a Reasonable Price
- **6 Lynch Categories**: Automatic categorization into *Fast Grower*, *Stalwart*, *Slow Grower*, *Cyclical*, *Turnaround*, or *Asset Play*.
- **PEG Ratio Meter**: True earnings growth vs. P/E multiple validation.
- **Inventory Sales Spread Monitor**: Math-driven detection of channel-stuffing anomalies ($\Delta \text{Inventory} - \Delta \text{Sales}$).
- **Net Cash Cushion**: Balance sheet liquidity per share backing each position.

### 2. Philip Fisher — 360° Primary Fieldwork Scuttlebutt
- **Developer Moat**: Real-time GitHub momentum score, star growth, fork velocity, and issue turnover.
- **Engineer Sentiment**: Algorithmic sentiment analysis of Hacker News technical discourse.
- **Retail & Crowd Pulse**: Sentiment auditing across Reddit (`r/stocks`, `r/investing`).
- **Supply Chain Recon**: Integrated ImportYeti customs and ocean freight bill of lading intelligence.
- **5-Circles Interview Protocol**: Pre-configured fieldwork scripts for Customers, Competitors, Suppliers, Ex-Employees, and Technologists.
- **Fisher 15-Point Qualitative Checklist**: Automated pass/fail assessment.

### 3. Warren Buffett — Economic Moats & Owner Earnings
- **True Owner Earnings Calculation**: $FCF + \text{D\&A} - \text{Maintenance Capex}$ contrasted against GAAP Net Income.
- **Berkshire \$1 Retained Earnings Test**: Multi-year market value creation per retained dollar.
- **Multi-Year ROIC Table**: Return on Invested Capital tracked against the 15% sustainable moat hurdle.
- **Solvency Runway**: Debt retirement capacity measured in years of Owner Earnings.

### 4. Aswath Damodaran — Valuation, Risk & Cost of Capital
- **Synthetic Credit Rating & Default Spreads**: Interest coverage ratio mapped into corporate default spreads.
- **R&D Capitalization Schedule**: Transforming expensed R&D into long-term intangible assets with multi-year amortization.
- **Implied Equity Risk Premium (ERP)**: FRED 10-Year Treasury Yield ($R_f = \text{DGS10}$) + current market ERP.
- **The 3 P's Reality Filter**: Systematic stress-testing: *Possible*, *Plausible*, and *Probable*.

---

## Specialized Intelligence Engines

### 👥 Competitor Discovery & Peer Benchmarking (`lib/competitorEngine.js`)
- **SEC EDGAR SIC Regulatory Matching**: Extracts the official 4-digit SIC code (e.g. `SIC 7372 Prepackaged Software`) to find true industry peers.
- **Dynamic Web Competitor Mining**: Keyless DuckDuckGo search integration that uncovers direct market rivals and emerging disruptors.
- **Side-by-Side Financial Matrix**: Instant comparison across Valuation (P/E, PEG, P/S), Profitability (ROIC, Margins), Growth, and Solvency.
- **One-Click Research Pivots**: Click any competitor ticker to instantly analyze that company.

### 🧠 Fodda AI Model Context Protocol (MCP) (`lib/foddaClient.js`)
- **Native JSON-RPC 2.0 / SSE Client**: Connects directly to `https://mcp.fodda.ai/mcp` with `Mcp-Session-Id` header state tracking.
- **50 Tools Available**:
  - `get_company_earnings`: Truth-layer quarterly records, executive sentiment, Q&A directness scoring, analyst concerns.
  - `brand_tracker`: 300+ domain knowledge graphs tracking brand health and trends.
  - `get_earnings_divergence`: Detects divergence between analyst consensus and executive guidance.
- **Integrated Disk Cache**: Namespaced caching optimizes API call quotas.

### 🏛️ Institutional Desk Simulation (`lib/institutionalDesk.js`)
- Simulates an institutional hedge fund investment committee through 6 stages:
  1. *Equity Analyst* (Fundamentals)
  2. *Risk Manager* (Position Sizing & Drawdowns)
  3. *Macro Strategist* (Yield Curve & Fed Regime)
  4. *Alternative Data Scout* (Customs, Sentiment, Web)
  5. *Devil's Advocate* (Short Thesis & Bear Scenarios)
  6. *Chief Investment Officer (CIO)* (Final Capital Allocation Verdict)

### 🎭 Legends Investment Debate (`lib/expertsDesk.js`)
- Generates an interactive multi-round debate between simulated personas of **Warren Buffett**, **Peter Lynch**, **Philip Fisher**, and **Aswath Damodaran**, with **Benjamin Graham** providing the final margin of safety synthesis.

---

## Quickstart

### Prerequisites
- Node.js 18.0.0 or higher.

### 1. Clone & Configure
```bash
git clone https://github.com/shivamkejriwal/AI-Growth-Syntax.git
cd AI-Growth-Syntax

# Create your .env from the template
cp .env.example .env
```

### 2. Configure API Keys (Optional but Recommended)
Open `.env` and add your API keys:
- `FODDA_API_KEY`: Get key at [app.fodda.ai](https://app.fodda.ai)
- `GEMINI_API_KEY`: Get key at [aistudio.google.com](https://aistudio.google.com)
- `ALPHA_VANTAGE_API_KEY`: Get key at [alphavantage.co](https://www.alphavantage.co)
- `FRED_API_KEY`: Get key at [stlouisfed.org](https://fred.stlouisfed.org)
- `PERPLEXITY_API_KEY`: Get key at [perplexity.ai](https://www.perplexity.ai)
- `EXA_API_KEY`: Get key at [exa.ai](https://exa.ai)

> *Note: AI-Growth-Syntax includes rich offline and demo datasets. If API keys are omitted, the application runs seamlessly in Demo Mode.*

### 3. Start the Server
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## Running Tests

AI-Growth-Syntax has a comprehensive test suite covering all modules:

```bash
# Run direct server integration tests
npm test

# Run all test suites (Server, Fodda MCP, Competitors)
npm run test:all

# Run individual tests
npm run test:fodda
npm run test:competitors
```

---

## REST API Reference

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/search?q=<query>` | `GET` | Autocompletes across 10,000+ SEC companies |
| `/api/resolve?q=<query>` | `GET` | Resolves company name to ticker symbol |
| `/api/research?ticker=<sym>&mode=<live\|demo>` | `GET` | Generates complete 4-pillar research dossier |
| `/api/competitors?ticker=<sym>` | `GET` | Returns peer matrix, SIC codes & relative valuation |
| `/api/fodda/status` | `GET` | Reports Fodda MCP connection & tools count |
| `/api/fodda/earnings?ticker=<sym>` | `GET` | Quarterly earnings records, Q&A directness & tone |
| `/api/fodda/brand?name=<brand>` | `GET` | Brand footprint across 300+ expert knowledge graphs |
| `/api/fodda/search?q=<query>` | `GET` | Semantic trend and statistics search |
| `/api/institutional-desk?ticker=<sym>` | `GET` | 6-stage institutional committee simulation |
| `/api/experts-desk?ticker=<sym>` | `GET` | 4-legend debate with Graham synthesis |
| `/api/macro` | `GET` | Macroeconomic barometer & yield curve status |
| `/api/memo?ticker=<sym>` | `GET` | Markdown Investment Decision Memorandum |
| `/api/export-memo` | `POST` | Saves memorandum to `decision_memos/` |
| `/api/status` | `GET` | Health check & API provider connection status |

---

## Design Principles

1. **Zero External Dependencies**: Standard Node.js ES Modules (`node:http`, `node:fs`, `node:path`) and pure client-side vanilla JavaScript/CSS. No bundlers, transpilers, or bloated frameworks required.
2. **Data Honesty & Fallback Resilience**: Every API failure cascades gracefully through secondary sources, disk caches, and offline baseline models.
3. **Institutional Aesthetics**: Bloomberg Terminal and TradingView-inspired dark obsidian theme (`#070a11`, `#0e1526`) with crisp typography and glassmorphism cards.

---

## License

MIT © [Shivam Kejriwal](https://github.com/shivamkejriwal)
