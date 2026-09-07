# Data Storage Architecture & Unified Company JSON Specification

> **Comprehensive Guide to Data Persistence, Formats, Namespaces, and the Unified Company Dossier Model**  
> System: **AI-Growth-Syntax**  
> Workspace: `~/Documents/GitHub/AI-Growth-Syntax`

---

## Part 1: How Data Is Stored Right Now

The application uses a **Cache-First, DB-First, Source-Fallback** tiered architecture. Every data point ingested from external APIs or computed locally moves through three tiers:

```
[Incoming Request (key, namespace)]
               │
               ▼
      ┌─────────────────┐
      │  Tier 1: Cache  │  ─── Fast In-Memory Map + Local .cache/ disk files
      └─────────────────┘
         │             │
      (Miss)         (Hit) ──► Return in < 1ms
         ▼
      ┌─────────────────┐
      │  Tier 2: DB     │  ─── Local: SQLite (.data/growth_syntax.sqlite)
      └─────────────────┘  ─── Cloud: Firestore (growth_syntax_store collection)
         │             │
      (Miss)         (Hit) ──► Warm Cache + Return in 1-5ms
         ▼
      ┌─────────────────┐
      │  Tier 3: Source │  ─── Alpha Vantage, SEC EDGAR, Seeking Alpha, FRED, DDG, etc.
      └─────────────────┘
         │
      (Success) ─────────────► Dual-Write into BOTH Cache & DB with today's date stamp
```

---

### 1.1 Physical Storage Layers

#### Tier 1: L1 Cache (Disk & Memory)
- **Memory**: A high-speed `Map` instance kept in Node.js process memory for sub-millisecond retrieval.
- **Disk**: Hierarchical JSON files stored in `.cache/`:
  ```
  .cache/
  ├── alphavantage/
  │   ├── MSFT_OVERVIEW.json
  │   ├── MSFT_INCOME_STATEMENT.json
  │   └── MSFT_GLOBAL_QUOTE.json
  ├── seeking_alpha/
  │   ├── SA_FEED_MSFT.json
  │   └── SA_MARKET_NEWS.json
  ├── competitors/
  │   └── COMPETITOR_ANALYSIS_MSFT.json
  ├── duckduckgo/
  │   └── DDG_SCUTTLEBUTT_MSFT.json
  ├── edgar/
  │   └── CIK_MSFT.json
  └── fred/
      └── FRED_DGS10.json
  ```
- **File Format**: Standard formatted JSON. Expiration is validated by checking the file modification timestamp (`mtimeMs`) or stored date string against today's date.

#### Tier 2: L2 Database (SQLite & Firestore)

##### A. Local & MCP Mode (`APP_MODES.LOCAL` / `APP_MODES.MCP`)
- **Engine**: Node 22 built-in native SQLite (`node:sqlite`). Zero npm packages or binary bindings required.
- **Database File**: `.data/growth_syntax.sqlite` (configured with Write-Ahead Logging `WAL` mode for high-concurrency read/write performance).
- **Table Schema**:
  ```sql
  CREATE TABLE IF NOT EXISTS data_store (
    namespace   TEXT NOT NULL,       -- Domain/provider (e.g. 'seeking_alpha', 'competitors')
    key         TEXT NOT NULL,       -- Unique entity key (e.g. 'SA_FEED_AAPL')
    data        TEXT NOT NULL,       -- Serialized JSON payload
    date_str    TEXT NOT NULL,       -- Calendar date 'YYYY-MM-DD'
    updated_at  INTEGER NOT NULL,    -- Unix epoch timestamp in milliseconds
    PRIMARY KEY (namespace, key)
  );

  CREATE INDEX IF NOT EXISTS idx_data_store_ns_key ON data_store(namespace, key);
  ```

##### B. Deployed Mode (`APP_MODES.FIREBASE`)
- **Engine**: Google Cloud Firestore.
- **Collection**: `growth_syntax_store`.
- **Document ID Pattern**: `${namespace}__${key}` (e.g. `seeking_alpha__SA_FEED_AAPL`).
- **Document Fields**:
  ```json
  {
    "namespace": "seeking_alpha",
    "key": "SA_FEED_AAPL",
    "data": { ... },
    "date_str": "2026-09-07",
    "updated_at": 1788775200000
  }
  ```

---

### 1.2 The "Next-Day" TTL Invalidation Rule

Both the Cache and the Database share the **same daily expiration lifecycle**:
1. When data is pulled from a source on date `D` (e.g. `2026-09-07`), it is tagged with `date_str = "2026-09-07"`.
2. Any retrieval request made on the **same day** finds `record.date_str === todayDateStr`, returning the cached/DB data immediately.
3. Once midnight passes and the calendar date becomes `2026-09-08` (the **next day**), `record.date_str !== todayDateStr`. The data is treated as expired.
4. An automatic fresh pull is made to the source. Upon success, **both** Cache and DB are updated with the new date stamp.
5. **Offline/Failure Fallback**: If the source call fails on the next day (network down, rate limited, HTTP 429), the system falls back to the previous day's data with `{ isStale: true }`.

---

### 1.3 Logical Namespaces & Data Envelopes

Currently, raw data is stored in partitioned namespaces:

| Namespace | Example Key | Stored Content |
|---|---|---|
| `alphavantage` | `MSFT_OVERVIEW` | Company profile, industry, PE, Beta, 52-week range |
| `alphavantage` | `MSFT_INCOME_STATEMENT` | 5-year annual and quarterly revenues, COGS, net income |
| `alphavantage` | `MSFT_GLOBAL_QUOTE` | Real-time price, volume, trading day |
| `sec_edgar` | `MSFT_FACTS` | Raw SEC XBRL company facts (leases, debt covenants) |
| `seeking_alpha`| `SA_FEED_MSFT` | Parsed analyst articles, sentiment, co-mentioned peers |
| `competitors`  | `COMPETITOR_ANALYSIS_MSFT` | Curated peers, comparative matrix, relative valuation |
| `duckduckgo`   | `DDG_SCUTTLEBUTT_MSFT` | Web intelligence on competitors, customer churn, suppliers |
| `fred`         | `FRED_MACRO_SNAPSHOT` | 10-Yr Treasury yield ($R_f$), Fed Funds, CPI inflation |
| `fodda`        | `FODDA_EARNINGS_MSFT` | AI earnings divergence, guidance beat/miss analysis |
| `experts_desk` | `EXPERTS_MSFT` | Multi-legend debate synthesis (Buffett, Lynch, Fisher) |

---

## Part 2: Representing All Company Data as a Single JSON

### Can all data for a company be represented as a single JSON?

> **Yes, 100%.** Not only is it possible, it is **the recommended architectural design for the terminal**.

In fact, the platform's core engine already builds a unified composite object in memory: `CompositeInvestor.generateCompositeDossier(ticker)`.

By storing this entire object as a **Unified Company Dossier**, a single key lookup:
```javascript
store.retrieveOrFetch({
  key: 'DOSSIER_AAPL',
  namespace: 'company_dossiers',
  fetcher: () => buildCompleteCompanyDossier('AAPL')
});
```
can replace 8 to 12 fragmented queries, yielding massive performance and architectural benefits:
- **Zero Round-Trip Waterfall**: 1 database read returns 100% of the data needed to render the entire web dashboard.
- **Atomic Portability**: A single JSON file `AAPL_full_dossier.json` can be saved, exported, sent via email, or used as an offline demo dataset.
- **Snapshot Immutability**: All dimensions of the company (price, multiples, 10-K disclosures, peer rankings) are aligned to the exact same calendar timestamp.

---

### 2.1 The Canonical Single Company JSON Specification (`CompanyDossier.json`)

Here is the exact schema and structure for representing a company entirely in a single JSON document:

```json
{
  "_meta": {
    "schemaVersion": "2.0.0",
    "ticker": "MSFT",
    "name": "Microsoft Corporation",
    "cik": "0000789019",
    "sic": "7372",
    "sector": "Technology",
    "industry": "Services - Prepackaged Software",
    "asOfDate": "2026-09-07",
    "timestamp": 1788775200000,
    "isoTimestamp": "2026-09-07T10:45:00.000Z",
    "sourcesIngested": [
      "Alpha Vantage",
      "SEC EDGAR XBRL",
      "FRED Macro",
      "Seeking Alpha RSS",
      "DuckDuckGo Intelligence",
      "Damodaran NYU Stern",
      "Fodda AI MCP"
    ],
    "isStale": false,
    "retrievalSource": "cache"
  },

  "marketAndProfile": {
    "currentPrice": 448.20,
    "sharesOutstanding": 7430000000,
    "marketCap": 3330126000000,
    "enterpriseValue": 3365000000000,
    "beta": 1.15,
    "peRatio": 36.8,
    "forwardPe": 31.2,
    "pegRatio": 2.1,
    "priceToBook": 12.4,
    "priceToSales": 13.5,
    "dividendYieldPercent": 0.71,
    "week52High": 468.35,
    "week52Low": 366.50
  },

  "financialStatements": {
    "currency": "USD",
    "sortedYears": ["2022", "2023", "2024", "2025"],
    "latestYear": "2025",
    "summary": {
      "revenue": 245122000000,
      "grossProfit": 170700000000,
      "operatingIncome": 109433000000,
      "netIncome": 88136000000,
      "operatingCashFlow": 118548000000,
      "capex": 55700000000,
      "freeCashFlow": 62848000000,
      "cashAndEquivalents": 75500000000,
      "totalDebt": 102000000000,
      "stockholdersEquity": 268000000000
    },
    "history": [
      {
        "fiscalYear": "2024",
        "revenue": 245122000000,
        "operatingIncome": 109433000000,
        "netIncome": 88136000000,
        "operatingCashFlow": 118548000000,
        "freeCashFlow": 62848000000
      },
      {
        "fiscalYear": "2023",
        "revenue": 211915000000,
        "operatingIncome": 88523000000,
        "netIncome": 72361000000,
        "operatingCashFlow": 87582000000,
        "freeCashFlow": 59475000000
      }
    ]
  },

  "damodaranNormalization": {
    "capitalizedRnD": {
      "amortizationYears": 3,
      "unamortizedRnDAsset": 42500000000,
      "adjustedOperatingIncome": 114200000000
    },
    "operatingLeases": {
      "capitalizedLeaseDebt": 14200000000,
      "totalAdjustedDebt": 116200000000
    },
    "costOfCapital": {
      "riskFreeRate": 4.25,
      "impliedEquityRiskPremium": 4.60,
      "bottomUpBeta": 1.08,
      "costOfEquity": 9.22,
      "preTaxCostOfDebt": 4.85,
      "effectiveTaxRate": 18.2,
      "afterTaxCostOfDebt": 3.97,
      "equityWeightPercent": 96.6,
      "debtWeightPercent": 3.4,
      "wacc": 9.04
    }
  },

  "valuationPillars": {
    "buffett": {
      "ownerEarnings": 68400000000,
      "averageROIC": 28.5,
      "retainedEarningsDollarTest": 4.12,
      "economicMoatRating": "Wide Moat",
      "moatSources": ["High Switching Costs", "Intangible Assets", "Network Effects"]
    },
    "lynch": {
      "companyCategory": "Fast Grower",
      "historicalEarningsCAGR": 17.5,
      "lynchFairValue": 485.00,
      "inventoryToSalesRatio": 0.015,
      "netCashPerShare": -3.56
    },
    "damodaranDCF": {
      "forecastYears": 10,
      "terminalGrowthRate": 2.5,
      "terminalWacc": 8.50,
      "presentValueOfCashFlows": 842000000000,
      "presentValueOfTerminalValue": 2520000000000,
      "enterpriseValue": 3362000000000,
      "netDebt": 26500000000,
      "equityIntrinsicValue": 3335500000000,
      "intrinsicValuePerShare": 448.92,
      "currentPrice": 448.20,
      "marginOfSafetyPercent": 0.16,
      "valuationVerdict": "Fairly Valued"
    },
    "fisherScuttlebutt": {
      "score": 14,
      "maxScore": 15,
      "rating": "Exceptional Quality",
      "developerMoraleVerdict": "Bullish",
      "customerSatisfactionScore": 4.4,
      "supplyChainRisk": "Low"
    }
  },

  "competitiveLandscape": {
    "sicDescription": "Services-Prepackaged Software",
    "herfindahlHirschmanIndex": 1850,
    "concentrationRating": "Moderately Concentrated",
    "valuationRank": "Premium (85th percentile)",
    "qualityRank": "Leader (95th percentile)",
    "peers": [
      {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "marketCap": 3450000000000,
        "peRatio": 34.2,
        "operatingMargin": 30.5,
        "roic": 52.0,
        "rivalry": "Ecosystem, OS & Personal Computing"
      },
      {
        "ticker": "GOOGL",
        "name": "Alphabet Inc.",
        "marketCap": 2150000000000,
        "peRatio": 24.8,
        "operatingMargin": 31.0,
        "roic": 31.2,
        "rivalry": "Cloud Infrastructure (Azure vs GCP), AI & Enterprise SaaS"
      },
      {
        "ticker": "AMZN",
        "name": "Amazon.com Inc.",
        "marketCap": 1980000000000,
        "peRatio": 42.1,
        "operatingMargin": 9.2,
        "roic": 14.5,
        "rivalry": "Hyperscale Cloud (Azure vs AWS)"
      }
    ]
  },

  "qualitativeIntelligence": {
    "seekingAlpha": {
      "consensusSentiment": "Bullish",
      "bullishArticles": 7,
      "bearishArticles": 1,
      "neutralArticles": 2,
      "topHeadlines": [
        {
          "title": "Microsoft: Cloud & AI Compounding at Scale",
          "sentiment": "Bullish",
          "category": "Analyst Research",
          "timeAgo": "2h ago",
          "link": "https://seekingalpha.com/article/..."
        }
      ]
    },
    "duckduckgoScuttlebutt": {
      "competitorHeadwinds": "Intense enterprise price competition from GCP and AWS",
      "customerChurnSignals": "High retention across Office 365 E5 suites",
      "supplierDependency": "Dependent on TSMC and NVIDIA for advanced GPU allocation"
    },
    "macroContext": {
      "treasury10Y": 4.25,
      "fedFundsRate": 5.33,
      "cpiInflation": 2.7,
      "yieldCurveSpread": 0.15,
      "macroRegime": "Late Cycle Expansion"
    }
  },

  "executiveDecisionMemo": {
    "headline": "Tier-1 Wide-Moat Compounder Trading at Historical Fair Value",
    "recommendation": "ACCUMULATE ON DIP",
    "thesis": "Microsoft demonstrates fortress ROIC (28.5%) and enterprise switching costs...",
    "keyRisks": [
      "AI capex execution vs. monetization timeline",
      "Antitrust scrutiny in gaming and cloud bundling"
    ],
    "invalidationTriggers": [
      "Azure constant-currency growth falling below 20%",
      "Sustained compression in commercial gross margin below 65%"
    ]
  }
}
```

---

## Part 3: Recommended Next Step — Unifying Under `tieredStore`

With the `TieredDataStore` now in place, we can store this complete JSON directly under:
- **`namespace`**: `'company_dossiers'`
- **`key`**: `'DOSSIER_' + ticker` (e.g. `DOSSIER_AAPL`)

### Retrieval Pattern:
```javascript
import { defaultTieredStore } from './tieredStore.js';
import { CompositeInvestor } from './compositeInvestor.js';

const investor = new CompositeInvestor();

export async function getCompanyDossier(ticker, options = {}) {
  const sym = ticker.toUpperCase().trim();
  const cacheKey = `DOSSIER_${sym}`;

  const result = await defaultTieredStore.retrieveOrFetch({
    key: cacheKey,
    namespace: 'company_dossiers',
    forceRefresh: options.forceRefresh || false,
    fetcher: async () => {
      // Pulls from all APIs and builds the canonical unified JSON
      return await investor.generateCompositeDossier(sym, options);
    }
  });

  return result.data;
}
```

### Result:
- **First Call Today**: Pulls from APIs $\rightarrow$ saves the single unified JSON to SQLite & disk cache.
- **Any Subsequent Call Today**: Instantly served from Cache or SQLite in **under 2 milliseconds**.
- **Tomorrow**: Automatically pulls new data and refreshes the document.

