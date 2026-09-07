# Architecture Philosophy & Approach

> How we structure, connect, and protect the system — zero dependencies, maximum resilience, modular by conviction.

---

## Core Conviction

**Simplicity is the ultimate sophistication.** This app is a zero-external-dependency Node.js ES Module server. No Express, no Axios, no Cheerio, no Lodash, no Dotenv, no Webpack, no React, no D3. Every line of code is owned, understood, and controllable. External dependencies are attack surface, maintenance debt, and philosophical compromise.

---

## The Zero-Dependency Constraint

The entire stack runs on native Node.js built-in modules:

| Module | Purpose |
|--------|---------|
| `node:http` | HTTP server and request handling |
| `node:fs` / `node:fs/promises` | File system I/O, caching, memo persistence |
| `node:path` | Path resolution and sanitization |
| `node:url` | URL parsing for query parameters |
| `node:crypto` | (Available if needed for hashing) |

**Why**: Dependencies introduce version conflicts, supply-chain vulnerabilities, breaking changes, and bloat. A zero-dependency architecture means the app starts instantly, deploys trivially, and runs identically on any Node.js 18+ environment without `npm install`.

**Package definition**: `package.json` declares `"type": "module"` for ES Module syntax and zero `dependencies` or `devDependencies`.

---

## Modular Separation of Concerns

The codebase follows a strict 4-layer architecture:

```
┌─────────────────────────────────────────────────┐
│  Transport Layer          server.js             │
│  (HTTP routing, static serving, body parsing)   │
├─────────────────────────────────────────────────┤
│  Domain Orchestrators                           │
│  compositeInvestor.js  institutionalDesk.js      │
│  expertsDesk.js                                 │
├─────────────────────────────────────────────────┤
│  Data Clients           lib/*Client.js          │
│  (Each owns its own caching, throttling,        │
│   rate limiting, and fallback logic)            │
├─────────────────────────────────────────────────┤
│  Presentation Layer     public/                 │
│  (Vanilla JS SPA, SVG charts, CSS design system)│
└─────────────────────────────────────────────────┘
```

### Layer 1: Transport (`server.js`)
- **Pure HTTP transport** — translates REST queries into service calls and serves static assets.
- **Security hardening**: Directory traversal prevention (normalizes file paths, enforces `safeFilePath.startsWith(PUBLIC_DIR)`), 2MB body size limit, input sanitization.
- **Resilience**: Port auto-increment retry logic — if port 3000 is occupied (`EADDRINUSE`), automatically increments up to 5 times.
- **No business logic** — routing only. All intelligence lives in the domain orchestrators.

### Layer 2: Domain Orchestrators (`lib/compositeInvestor.js`, `lib/institutionalDesk.js`, `lib/expertsDesk.js`, `lib/competitorEngine.js`)
- **CompositeInvestor**: The central brain. Ingests data from all clients, computes 4-pillar dossiers (Lynch, Fisher, Buffett, Damodaran), generates equity visuals (DCF, Snowflake, Sankey, Trends), produces macro dossiers, and formats Investment Memoranda.
- **InstitutionalDesk**: 6-stage autonomous trading desk simulation — specialist intelligence gathering → Bull/Bear debate → Research Manager synthesis → Trader order ticket → Tri-Party Risk Committee → Portfolio Manager sign-off.
- **ExpertsDesk**: 3-round multi-agent debate among Buffett, Lynch, Fisher, and Damodaran, arbitrated by Benjamin Graham.
- **CompetitorEngine**: Discovers direct industry rivals via SEC EDGAR 4-digit SIC codes, DuckDuckGo web searches, and curated sector benchmark maps; computes side-by-side financial matrices and relative valuation standings.
- Orchestrators compose multiple clients but never directly handle HTTP or DOM concerns.

### Layer 3: Data Clients (`lib/*Client.js`)
Each external integration is an **isolated, self-contained class** responsible for:
- Its own API endpoint management
- Request construction and authentication (API keys, cookies, crumbs, User-Agent headers)
- Response parsing and normalization
- Namespaced disk caching with appropriate TTLs
- Rate limiting and throttling (e.g., SEC EDGAR < 10 req/sec)
- Graceful fallback on failure (try live → try stale cache → return null/empty)

| Client | Data Source | Key Responsibility |
|--------|-----------|-------------------|
| `alphaVantageClient.js` | Alpha Vantage | Fundamentals, Lynch metrics, Buffett Owner Earnings, Damodaran R&D adjustments |
| `yahooFinanceClient.js` | Yahoo Finance | Keyless backup for quotes, overview, financial history |
| `edgarClient.js` | SEC EDGAR | Ticker-to-CIK resolution, 10-K/10-Q/DEF 14A links, XBRL lease liabilities |
| `fredClient.js` | FRED | Macro benchmarks ($R_f$, CPI, Credit Spreads, Yield Curve) |
| `damodaranClient.js` | NYU Stern | Implied ERP, Sector WACC, Synthetic Ratings, 3 P's Filter |
| `scuttlebuttClient.js` | GitHub / HN / Reddit / ImportYeti | Qualitative field intelligence, Fisher 5 Circles, 15 Points |
| `technicalAnalysis.js` | Alpha Vantage OHLCV | RSI, MACD, Bollinger Bands, ATR, SMA, Support/Resistance |
| `predictionMarkets.js` | Polymarket Gamma | Forward-looking event probabilities |
| `stocktwitsClient.js` | StockTwits | Retail sentiment ratio, message velocity |
| `perplexityClient.js` | Perplexity Sonar | Web-grounded scuttlebutt audits |
| `geminiClient.js` | Google Gemini | CIO executive synthesis |
| `exaClient.js` | Exa Neural Search | Supply chain & churn discovery |
| `duckduckgoClient.js` | DuckDuckGo | Keyless web search, Instant Answers, 4-vector Scuttlebutt |
| `nasdaqClient.js` | Nasdaq Data Link | Institutional macro series |

### Layer 4: Presentation (`public/`)
- **Single-page app** with vanilla JavaScript — no React, no Vue, no framework.
- **View switching**: Company Research vs. Macro Economy Research, plus tab switching within Company Research.
- **Pure mathematical SVG charting**: Radar/Snowflake, DCF gauge, Sankey flow, line/bar charts — all computed via native `polarToCartesian`, `describeArc`, and dynamic SVG path generation. Zero charting library dependencies.
- **CSS design system**: All visual language defined via CSS custom properties (see Design Philosophy).

---

## Environment Management

- **`.env` location**: Parent directory (`/Users/shivam/Documents/Research-Projects/.env`), not project root. The `lib/env.js` utility crawls up to 6 parent directories to find it — no `dotenv` package needed.
- **Keys managed**: `ALPHA_VANTAGE_API_KEY`, `FRED_API_KEY`, `SEC_EDGAR_USER_AGENT`, `GOOGLE_API_KEY` (Gemini), `PERPLEXITY_API_KEY`, `EXA_API_KEY`, `OLLAMA_BASE_URL` (local LLMs).
- **Graceful absence**: Every key is optional. Missing keys don't crash the app — they trigger fallback to the next data tier or demo mode.

---

## REST API Design

All endpoints follow a consistent pattern:

```
GET /api/<resource>?<params>&mode=<live|demo>
```

| Endpoint | Purpose |
|----------|---------|
| `GET /api/status` | System health audit — API key readiness, cache status |
| `GET /api/search?q=<query>&limit=10` | Unified ticker search (SEC EDGAR universe + Demo datasets) |
| `GET /api/resolve?q=<query>` | Company name → canonical ticker resolution |
| `GET /api/research?ticker=<sym>&mode=<live\|demo>` | Full 4-pillar composite dossier |
| `GET /api/macro` | Macro economy dossier (FRED, ERP, Sector ETFs, Movers) |
| `GET /api/memo?ticker=<sym>` | Markdown Investment Memorandum |
| `POST /api/export-memo` | Persist memorandum to `decision_memos/` |
| `GET /api/institutional-desk?ticker=<sym>` | 6-stage Institutional Desk simulation |
| `GET /api/experts-desk?ticker=<sym>` | 3-round 4-Legend debate with Graham arbitration |
| `GET /api/prediction-markets?topic=<query>` | Polymarket prediction odds |
| `GET /api/stocktwits?ticker=<sym>` | Retail sentiment stream |
| `GET /api/technical?ticker=<sym>` | Technical analysis matrix (RSI, MACD, BB, ATR, SMA) |
| `GET /api/duckduckgo?q=<query>&ticker=<sym>` | Keyless web search & 4-vector Scuttlebutt intelligence |
| `GET /api/competitors?ticker=<sym>` | Direct rival discovery, SEC SIC classification & peer comparison matrix |

---

## Dual Interface Parity

The app exposes two equivalent interfaces:

1. **Browser SPA** (`public/index.html` + `app.js` + `styles.css`) — Full visual dashboard with interactive charts, modals, and multi-tab navigation.
2. **CLI Runner** (`cli/analyze.js`) — Interactive terminal-based audit runner for Lynch, Fisher, Buffett, and Damodaran analyses. Scriptable, piping-friendly.

Both consume the same `CompositeInvestor` orchestrator and produce equivalent analytical outputs.

---

## Testing Strategy

Tests are self-contained and require no test framework (no Jest, no Mocha):

| Suite | Scope | Tests |
|-------|-------|-------|
| `testWrappers.js` | Unit & integration: data clients, math calculations | 22 tests |
| `testServerDirect.js` | HTTP endpoint integration | 10 tests |
| `testExpertsDesk.js` | ExpertsDesk debate structure & Graham synthesis | 3 tests |
| `testInstitutionalDesk.js` | InstitutionalDesk pipeline & risk committee | 4 tests |

Tests run with `node test/<file>.js` — no build step, no test runner configuration.

---

## Resilience Patterns

1. **Fail-open with degradation**: Every external call is wrapped in try/catch. Failures return partial data, never crash the process.
2. **Stale cache as safety net**: `cache.getStale(key, namespace)` ignores TTL expiry — if the network is down, serve the last known good response.
3. **Synthetic baselines**: If financial data is truncated (ETFs, unlisted entities), the engine synthesizes a baseline balance sheet rather than returning empty.
4. **Port collision handling**: Automatic port increment on `EADDRINUSE`.
5. **Rate-limit compliance**: SEC EDGAR fair access (< 10 req/sec with interval sleep), Alpha Vantage quotas, Yahoo Finance crumb token rotation.
6. **Body size protection**: 2MB incoming payload limit to prevent overflow attacks.

---

*This document evolves as the architecture grows, new modules are added, or structural decisions are revisited.*

