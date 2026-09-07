# Data Philosophy & Approach

> How we source, validate, cache, and gracefully degrade data — ensuring institutional-grade research without institutional-grade subscriptions.

---

## Core Conviction

**Rigorous fundamental research does not require multi-thousand-dollar terminal subscriptions.** The public internet offers an institutional-grade data infrastructure — SEC EDGAR, FRED, Alpha Vantage, Yahoo Finance, Polymarket, GitHub, Hacker News — if you know where to look and how to orchestrate it. The app proves that a free-first, multi-source data architecture can rival Bloomberg and FactSet for deep equity research.

---

## The Free-First Data Hierarchy

Data is organized into four tiers, ordered by authority and cost:

### Tier 1 — Primary Fundamental & Market Engine
- **Alpha Vantage Fundamentals API**: Standardized multi-year income statements, balance sheets, cash flows, valuation multiples, beta, and adjusted daily price series. Endpoints: `OVERVIEW`, `INCOME_STATEMENT`, `BALANCE_SHEET`, `CASH_FLOW`, `EARNINGS`, `TIME_SERIES_DAILY_ADJUSTED`, `GLOBAL_QUOTE`.
- **SEC EDGAR API**: The single source of truth. 10-K footnotes, MD&A, Proxy DEF 14A (executive incentives & ROIC alignment), Form 4 (insider transactions), Company Facts XBRL API (operating lease liabilities for Damodaran debt capitalization). Enforced rate limit: < 10 req/sec with custom User-Agent header.
- **FRED (Federal Reserve Bank of St. Louis)**: Macroeconomic benchmarks — 10-Year Treasury yield (`DGS10`) for Risk-Free Rate $R_f$, Fed Funds Rate (`FEDFUNDS`), CPI (`CPIAUCSL`) for inflation, BBB Corporate Spread (`BAMLC0A4CBBB`), Yield Curve slope (`T10Y2Y`), Unemployment (`UNRATE`), GDP.

### Tier 2 — Keyless Live Backup Feeds
- **Yahoo Finance**: Zero-key live fallback for Alpha Vantage. Manages auth cookie and crumb tokens automatically. Provides real-time quotes, market cap, multiples, and normalized multi-year financial statements. Activated automatically when Alpha Vantage is unconfigured or rate-limited.
- **DuckDuckGo Instant Answers & Web Intelligence**: Zero-key, privacy-preserving search engine integration. Provides Instant Answer knowledge cards (Wikipedia abstracts, company profiles, related topics) and targeted 4-vector Scuttlebutt web search (competitors, customer churn, supply chain logistics, strategic news). Requires zero API keys.

### Tier 3 — Zero-Cost Qualitative Scuttlebutt Channels
- **DuckDuckGo Web Search**: Keyless deep ecosystem searches across competitive landscape, customer complaints, and vendor dependencies.
- **GitHub REST API**: Stars, forks, issues, commit velocity → Developer Momentum Index.
- **Hacker News Algolia API**: Unfiltered developer and engineering morale sentiment.
- **Reddit Public JSON**: Customer dissatisfaction, churn signals, retail crowding.
- **ImportYeti**: Customs bill-of-lading search for supply chain verification and supplier reliance.
- **Glassdoor / Blind**: Employee morale and cultural health (manual channel).
- **G2 / TrustRadius / Gartner Peer Insights**: Customer stickiness, NPS proxies, 1-star and 2-star churn indicators.
- **StockTwits Public Stream**: Retail investor sentiment ratio (Bullish vs Bearish %), message velocity.
- **Polymarket Gamma API**: Forward-looking event probabilities (Fed rate cuts, recession odds, sector disruptions).

### Tier 4 — AI-Augmented Intelligence
- **Perplexity Sonar API**: Web-grounded 360° scuttlebutt audits across employee morale, customer churn, supply chain viability.
- **Google Gemini 1.5 Flash**: CIO-grade executive synthesis evaluating economic moats, growth friction, and thesis invalidation triggers.
- **Exa Neural Search**: Semantic discovery of supply chain disruptions and customer churn patterns.

### Tier 5 — Optional Paid Fallbacks
- **Nasdaq Data Link**: Institutional macro and benchmark series.
- **Aswath Damodaran NYU Stern Portal**: Implied ERP, industry sector WACC tables, R&D amortizable lifespans, synthetic rating lookup tables.
- **Zacks Institutional / Expert Call Networks**: Strictly backup.

---

## Transparent Fallback Architecture

Every data path implements a **4-level graceful degradation chain**:

```
Live External API  →  Keyless Backup Feed  →  Stale Disk Cache  →  Pre-compiled Demo Dataset
     (Tier 1)            (Tier 2)               (Tier 3)              (Tier 4)
```

**Principle**: The app must never crash, display empty screens, or throw unrecoverable errors due to network failures, rate limits, or missing API keys. Every external call is wrapped in try/catch with automatic fallback to the next tier.

- If Alpha Vantage returns HTTP 429 or is unconfigured → Yahoo Finance takes over seamlessly.
- If live network is unavailable → `getStale()` serves the last cached response regardless of TTL expiry.
- If no cache exists → Pre-compiled demo datasets (`demoData.js`) covering MSFT, AAPL, NVDA, 11 SPDR Sector ETFs, and macroeconomic indicators provide a fully functional experience.
- If Alpha Vantage returns truncated history for an ETF or unlisted entity → the engine synthesizes a baseline balance sheet rather than failing.

---

## Strict Caching Discipline

Every external call is wrapped in a namespaced `DiskCache` with tailored TTLs reflecting data volatility:

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| SEC EDGAR regulatory filings | 7–14 days | Quarterly filing cycles |
| Annual/Quarterly financial statements | 24 hours | Daily staleness acceptable |
| FRED macroeconomic indicators | 24 hours | Published monthly/quarterly |
| Real-time stock quotes & ETF prices | 5–10 minutes | Intraday relevance |
| Trading desk & expert debates | 30 minutes | AI-generated, contextual |
| Polymarket prediction odds | 1 hour | Event-driven, semi-volatile |
| StockTwits sentiment stream | 15 minutes | High-frequency retail chatter |

**Cache layout**: Hierarchical disk structure at `.cache/<namespace>/<sanitized-key>.json` with filesystem `mtime` for TTL validation. No database required.

---

## Live vs. Demo Mode Duality

The entire app is seamlessly toggleable between **Live** and **Demo** modes:

- **UI toggle**: Switch in the search hero section of Company Research.
- **CLI flag**: `--demo` on the interactive CLI runner.
- **Behavior**: Even in Live mode, if an API fails or returns insufficient data, the system silently falls back to demo data for that specific dimension — partial live, partial demo is acceptable and transparent.

**Principle**: A researcher should be able to explore the full app experience offline, on a plane, or without any API keys configured. Demo mode is not a toy — it contains high-fidelity 5-year financial statements for reference companies.

---

## Forensic 10-K Reading Protocol

Data is not just ingested — it is forensically audited. The app enforces a strict reading order for SEC filings:

1. **Footnotes** — Revenue recognition policies, debt covenants, off-balance-sheet commitments, contingent liabilities.
2. **Cash Flow Statement** — CFO vs. Net Income reconciliation, maintenance vs. growth capex separation, working capital swings.
3. **MD&A Deep Dive** — Management's own margin trend analysis, segment-level metrics, pricing vs. volume decomposition.
4. **Proxy DEF 14A** — Executive compensation incentive structures, ROIC alignment, insider transaction patterns (Form 4).

---

## Data Integrity Principles

1. **Authority over convenience**: SEC EDGAR filings are the ultimate source of truth, not third-party aggregators.
2. **Multi-year context**: No metric is meaningful in isolation — always ingest 3–5 years of history for trend analysis.
3. **Normalization before comparison**: R&D is capitalized, operating leases are converted to debt, SBC is treated as real cash expense — accounting adjustments are applied before any valuation metric is computed.
4. **Rate-limit respect**: SEC EDGAR's fair access policy (< 10 req/sec), Alpha Vantage quotas, and Yahoo Finance crumb token management are all enforced programmatically.
5. **Immutability of inputs**: Raw API responses are cached as-is; all transformations happen downstream in the analysis layer, never corrupting source data.

---

*This document evolves as new data sources are discovered, fallback hierarchies are refined, or caching strategies are optimized.*

