# Investment Philosophy & Approach

> The intellectual framework behind every analysis — a 4-Pillar Composite Method that synthesizes the greatest investment minds into a unified, modern research discipline.

---

## Core Conviction

**No single investment framework is sufficient.** Peter Lynch sees what individual investors can observe in the real world. Philip Fisher digs deeper than anyone into qualitative fieldwork. Warren Buffett identifies durable economic moats and demands owner-level cash generation. Aswath Damodaran bridges narrative and numbers with institutional-grade valuation mechanics. The Composite Approach synthesizes all four into a framework that is greater than the sum of its parts, arbitrated by the founding principles of Benjamin Graham.

---

## The 4-Pillar Composite Framework

### Pillar 1: Peter Lynch — Ground-Level Reconnaissance & Business Taxonomy

**Philosophy**: "Know what you own and know why you own it." The best investment ideas come from firsthand observation — the products you use, the stores you visit, the trends you see before Wall Street notices.

**Key Mechanics**:
- **Circle of Competence Screen**: Immediate rejection if the business falls outside your understanding. If you can't explain the company in 2 minutes, you don't understand it.
- **The 2-Minute Story**: Before any spreadsheet, articulate the investment thesis in plain language. If the story doesn't hold up in 120 seconds, the numbers won't save it.
- **6 Business Categories**: Every company is classified into exactly one taxonomy:
  1. *Fast Grower* — Earnings growth > 20%, small-to-mid cap with runway
  2. *Stalwart* — Steady 10-12% growth, large cap, reliable compounder
  3. *Slow Grower* — Mature, single-digit growth, dividend-focused
  4. *Cyclical* — Tied to economic cycles (autos, housing, commodities)
  5. *Turnaround* — Distressed company with potential recovery catalyst
  6. *Asset Play* — Hidden assets not reflected in market price
- **PEG Ratio**: $\text{PEG} = \frac{P/E}{\text{EPS Growth Rate}}$. Below 1.0 is a bargain, 1.0–1.6 is fair, above 1.6 is overextended.
- **Red Flags**: Inventory growing faster than sales (spread > 5%), customer concentration > 20%, diworseification (acquisitions outside core competence).
- **Net Cash per Share**: Cash and equivalents minus total debt, divided by shares outstanding — the balance sheet safety cushion.

---

### Pillar 2: Philip Fisher — Relentless Scuttlebutt Fieldwork

**Philosophy**: "The best investments are found through legwork, not spreadsheets." Qualitative investigation across the entire business ecosystem reveals what financial statements cannot.

**Key Mechanics**:
- **The 5 Investigative Circles** (interviewed in order, management LAST):
  1. *Competitors* — "Who is winning new RFPs? Where is the company vulnerable?" Systematically mapped through our **Competitor Discovery & Peer Benchmarking Engine** (SEC EDGAR SIC codes + DuckDuckGo web recon) to establish direct rivalry vectors and relative valuation spreads.
  2. *Customers* — "What % of operating budget goes to this vendor? How costly to switch?"
  3. *Suppliers* — "Is this customer growing or shrinking their orders?"
  4. *Ex-Employees* — "Why did you leave? What's the engineering culture really like?"
  5. *Scientists/Engineers* — "Is the R&D pipeline credible or performative?"
- **Management Interviewed Last**: Gather independent facts first. Only then verify management's candor against what the ecosystem reveals. Does management admit problems openly, or blame external factors?
- **Competitor & Peer Relative Valuation**: Evaluates whether the target company earns superior returns on invested capital (ROIC) and operating margins relative to its direct peer group median, and whether its P/E multiple represents a justified premium or an attractive discount.
- **Fisher 15-Point Qualitative Checklist**: Evaluates sales organization quality, R&D commercialization track record, profit margins relative to industry, employee relations, management depth, accounting integrity, and long-range growth outlook.
- **Modern Digital Scuttlebutt Channels**:
  - GitHub commit velocity and star trajectory → Developer Momentum Index
  - Glassdoor/Blind 24-month sentiment tracking → Employee Morale
  - Hacker News discussion sentiment → Engineering Community Signal
  - Reddit public forums → Customer Dissatisfaction and Churn
  - ImportYeti customs bill-of-lading search → Supply Chain Verification
  - G2/TrustRadius → Customer Stickiness and NPS Proxies
- **Time Horizon**: 5+ year compound growth cycles. Fisher explicitly rejects short-term quarterly inventory trading.

---

### Pillar 3: Warren Buffett — Economic Moats, Owner Earnings & Capital Discipline

**Philosophy**: "It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price." Seek businesses with durable competitive advantages that generate real cash for owners and allocate capital rationally.

**Key Mechanics**:
- **5 Durable Economic Moats**:
  1. *Brand Pricing Power* — Can the company raise prices without losing customers?
  2. *Switching Costs* — How expensive/painful is it for customers to leave?
  3. *Network Effects* — Does the product become more valuable as more people use it?
  4. *Cost Advantage* — Structural cost leadership (scale, location, process)
  5. *Efficient Scale* — Market too small for a second entrant to earn adequate returns
- **Owner Earnings** (not reported GAAP earnings):
  
  $$\text{Owner Earnings} = \text{Net Income} + \text{D\&A} - \text{Maintenance Capex (70\%)} - \Delta\text{Working Capital}$$
  
  Owner Earnings conversion must be ≥ 80% of Net Income. If the company reports profits but generates no free cash, it's an accounting illusion.
- **The \$1 Retained Earnings Test**: For every \$1 of earnings retained (not paid as dividend), the market value of the company should increase by at least \$1 over time. If management is retaining earnings but market cap isn't growing proportionally, capital allocation is destroying value.
- **ROIC Hurdle**: Consistently > 15% without excessive leverage. $\text{ROIC} = \frac{\text{NOPAT}}{\text{Invested Capital}}$. If ROIC < WACC, the company is destroying economic value even if reporting positive accounting income.
- **Capital Allocation Hierarchy**:
  1. Reinvest in the business at high-ROIC opportunities
  2. Accretive M&A (only within circle of competence)
  3. Dividends (if insufficient reinvestment opportunities)
  4. Share repurchases (strictly below intrinsic fair value — never at inflated prices)
- **Solvency Cushion**: Net Debt/EBITDA < 3.5x for cyclicals. The balance sheet should survive a recession.

---

### Pillar 4: Aswath Damodaran — Modernizing Value Analysis

**Philosophy**: "Every number in a valuation has a narrative behind it, and every narrative must convert to a number." Valuation is not an exercise in spreadsheet precision — it's about mapping qualitative stories onto quantitative DCF parameters and stress-testing them against reality.

**Key Mechanics**:
- **The 3 P's Reality Filter**: Every narrative assumption must survive three gates:
  1. *Possible* — Is it within the realm of physical and economic possibility?
  2. *Plausible* — Is there historical precedent or logical basis?
  3. *Probable* — Is it the most likely outcome given current evidence?
- **Modern Accounting Corrections** (before any valuation):
  - *R&D Capitalization*: Expense R&D over 3–5 year amortizable lifespan (software: 3 yrs, pharma: 5 yrs) instead of treating it as a current-year expense. Creates an R&D asset on the balance sheet, adjusts EBIT upward, and adds to Invested Capital for True Adjusted ROIC.
  - *Operating Lease Capitalization*: Convert operating leases into debt equivalents using XBRL `OperatingLeaseLiability` from SEC filings. Adjusts capital structure for honest WACC computation.
  - *Stock-Based Compensation*: Treated as real operating cash expense and real share dilution — not an "adjustment" to be added back.
- **Cost of Capital Mechanics**:
  - Risk-Free Rate $R_f$: 10-Year U.S. Treasury yield (`DGS10` from FRED)
  - Implied Equity Risk Premium (ERP): From Damodaran's NYU Stern forward-looking computation (currently ~4.60%)
  - Bottom-Up Beta: Hamada formula unlever/re-lever to isolate operating risk from financial leverage
  - Synthetic Credit Rating: Map Interest Coverage Ratio ($\frac{\text{EBIT}}{\text{Interest Expense}}$) to Moody's/S&P equivalent ratings and default spreads
  - WACC: $w_e \cdot K_e + w_d \cdot K_d(1-t)$ using market-value weights
  - Dynamic WACC Convergence: Current WACC fades toward industry average over 5–10 years (life cycle theory)
  - Terminal Growth: Strictly capped at $\min(3.0\%, \max(1.5\%, R_f \times 0.65))$ — no company outgrows the economy forever
- **2-Stage DCF**: 5-year explicit growth phase with annual fade factor ($0.95^{yr-1}$), then terminal value at converged WACC and bounded terminal growth.
- **The 4 Value Drivers**: Existing asset cash flow, value-accretive growth ($\text{ROIC} > \text{WACC}$), reinvestment efficiency (Sales-to-Capital ratio), and terminal risk.

---

## The Graham Arbitration Layer

**Benjamin Graham** serves as the senior arbiter across all expert analyses — not as a fifth pillar, but as the foundational judge of quality, safety, and discipline:

- **Quality Grading**: Class A (Wide-Moat Compounder), Class B (Quality Growth), Class C (Speculative)
- **Consensus Score**: Aggregates bullish/bearish stances across the 4 legends (out of 10)
- **Margin of Safety Enforcement**: Dynamic calibration based on business uncertainty:
  - Low Uncertainty: ≥ 20% discount to fair value
  - Medium Uncertainty: ≥ 30%
  - High Uncertainty: ≥ 40%
- **Capital Allocation Mandate**: ≥ 3 bullish legends → 4.0–5.0% allocation; otherwise 2.5–3.5%
- **Invalidation Risks**: Explicit triggers for thesis failure

---

## Portfolio Construction Rules

- **High-conviction concentration**: 8 to 15 wonderful businesses. Not 50 mediocre ones.
- **Position sizing**: Initial entry 5.0%–8.0%; maximum appreciation cap 15.0%–20.0%.
- **Cash discipline**: Hold cash when bargains are scarce. Never force capital into mediocre opportunities.
- **Sell discipline** (cold-blooded, rule-based):
  1. Thesis broken / moat erosion → Sell immediately
  2. Superior opportunity with wider margin of safety → Rotate
  3. Extreme bubble valuation: $P / \text{Fair Value} \ge 1.60$ → Trim or exit
  4. **Never** sell a compounder merely because it doubled, if ROIC and quality remain intact

---

## The "Too Hard" Pile — Mandatory Disqualifiers

Immediate rejection if any apply:
- Rapid technology obsolescence with no moat
- Unhedged commodity price-taker
- Promotional, stock-obsessed CEO
- Aggressive accounting gimmickry (adjusted EBITDA games, opaque off-balance items)
- Excessive leverage: Net Debt/EBITDA > 3.5x for cyclicals
- Severe customer concentration: > 25% of revenue from one customer

---

## The Immutable Decision Log

Before committing capital, a standardized markdown memorandum must be drafted:

| Field | Content |
|-------|---------|
| Ticker & Company | Canonical identifier |
| Lynch Category | Exactly one of the 6 classifications |
| 2-Minute Story | Plain-language thesis |
| Moat Sources | Which of the 5 moats apply and why |
| Scuttlebutt Findings | Key qualitative insights from fieldwork |
| Normalized Financials | Owner Earnings, ROIC, R&D-adjusted metrics |
| Fair Value Range | DCF-derived with sensitivity analysis |
| Current Price & Margin of Safety | Is the discount sufficient? |
| Position Size | Initial allocation |
| Invalidation Triggers | Exactly what would kill the thesis |

This memorandum is immutable — written before purchase, never retroactively edited to justify a losing position.

---

*This document evolves as new investment frameworks are studied, expert methodologies are refined, or portfolio construction rules are updated.*

