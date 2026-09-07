# Inference Philosophy & Approach

> How the app draws conclusions — multi-pillar triangulation, adversarial debate synthesis, heuristic scoring, and disciplined execution guardrails.

---

## Core Conviction

**No single metric, model, or perspective should drive an investment decision.** The app draws conclusions through structured multi-dimensional triangulation: quantitative metrics are stress-tested across multiple frameworks, qualitative signals are cross-referenced across independent channels, and final recommendations are forged through adversarial debate — not consensus-seeking, but thesis-challenging. Every conclusion carries explicit invalidation criteria.

---

## Inference Layer 1: Heuristic Scoring & Quantitative Benchmarks

The app computes and benchmarks a battery of financial metrics, each mapped to a specific pillar's intellectual framework:

### Lynch Metrics
| Metric | Formula | Signal |
|--------|---------|--------|
| PEG Ratio | $P/E \div \text{EPS Growth Rate}$ | < 1.0 bargain · 1.0–1.6 fair · > 1.6 overextended |
| Inventory-Sales Spread | $\text{Inventory Growth} - \text{Revenue Growth}$ | > 5% → red flag (unsold inventory building) |
| Net Cash per Share | $(\text{Cash} - \text{Total Debt}) \div \text{Shares}$ | Positive = balance sheet cushion |
| Lynch Category | Rule-based classifier | One of 6 categories drives expectations |

### Buffett Metrics
| Metric | Formula | Signal |
|--------|---------|--------|
| Owner Earnings | $\text{Net Income} + \text{D\&A} - \text{Maintenance Capex (70\%)} - \Delta\text{WC}$ | Must be ≥ 80% of Net Income |
| ROIC | $\frac{\text{NOPAT}}{\text{Invested Capital}}$ | Consistently > 15% without leverage tricks |
| \$1 Retained Earnings | $\frac{\Delta\text{Market Cap (5yr)}}{\text{Cumulative Retained Earnings (5yr)}}$ | > \$1.00 = value-creating management |
| Solvency Cushion | Current Ratio, Quick Ratio, Net Debt/EBITDA | Survive a recession |

### Damodaran Metrics
| Metric | Formula | Signal |
|--------|---------|--------|
| R&D-Adjusted ROIC | $\frac{\text{NOPAT}}{\text{Adjusted IC (Net PP\&E + Cap. R\&D + WC)}}$ | True operating return after capitalizing R&D |
| Synthetic Credit Rating | Interest Coverage → Rating tier → Default spread | Assesses unrated firms |
| WACC | $w_e K_e + w_d K_d(1-t)$ via CAPM + Hamada Beta | Hurdle rate for value creation |
| DCF Fair Value | 2-stage model with fade factor and bounded terminal growth | Intrinsic value anchor |
| Margin of Safety | $\frac{\text{Fair Value} - \text{Market Price}}{\text{Fair Value}}$ | ≥ 20–40% required depending on uncertainty |

### Fisher Metrics (Qualitative → Quantitative)
| Channel | Source | Signal |
|---------|--------|--------|
| Developer Momentum | GitHub stars, forks, commits | Rising trajectory = tech moat strengthening |
| Engineer Morale | Hacker News discussion sentiment | Positive = healthy culture, negative = talent drain |
| Customer Churn Risk | Reddit complaints, G2 reviews | High dissatisfaction = switching risk |
| Supply Chain Integrity | ImportYeti customs data | Diversified sourcing = resilient |
| 15-Point Score | Fisher checklist evaluation | Qualitative quality gate |

---

## Inference Layer 2: The Snowflake Radar — 5-Dimension Composite Score

The Snowflake Radar synthesizes multiple metrics into a single visual quality assessment, scored 1-to-10 on each dimension:

| Dimension | Components | Scoring Logic |
|-----------|-----------|---------------|
| **Health** | Debt-to-Equity, Current Ratio | Low leverage + high liquidity → 10 |
| **Value** | PEG Ratio, DCF gap (Fair Value vs. Market Price) | Deep discount + reasonable PEG → 10 |
| **Performance** | ROIC, Revenue CAGR | High returns + strong growth → 10 |
| **Dividend** | Dividend Yield, Payout Ratio | Sustainable, growing dividends → 10 |
| **Management** | \$1 Retained Earnings Test, Positive Owner Earnings | Value-creating capital allocation → 10 |

The radar is **not a buy/sell signal** — it's a diagnostic snapshot. A company can score 9/10 on Performance and 3/10 on Value (overvalued growth stock). The shape of the snowflake tells the story.

---

## Inference Layer 3: Multi-Expert Adversarial Debate

### Why Debate, Not Consensus

Traditional stock screeners output a single score or rating. This app deliberately avoids false consensus. Instead, it stages **adversarial debates** where experts with different frameworks challenge each other's conclusions. A bullish ROIC signal from Buffett is only meaningful if it survives Fisher's scuttlebutt challenge and Damodaran's DCF reality check.

### Experts Desk: The 4-Legend Debate Engine

**Structure**: 3 rounds, 12 turns total

| Round | Theme | Dynamic |
|-------|-------|---------|
| **Round 1** | First Principles & Opening Arguments | Each legend presents their analysis through their native framework |
| **Round 2** | Cross-Examination & Direct Rebuttal | Legends directly challenge each other's blind spots |
| **Round 3** | Final Stances, Allocation & Horizons | Each legend gives a final verdict: Buy/Hold/Avoid with conviction score, time horizon, and target allocation |

**Cross-Examination Tensions** (by design):
- *Buffett vs. Damodaran*: "Your WACC model is an academic exercise — I'd rather be approximately right than precisely wrong." vs. "Your moat rhetoric ignores quantifiable discount rates and implied risk."
- *Lynch vs. Fisher*: "Your scuttlebutt takes years — PEG tells you in seconds if growth is priced in." vs. "Your PEG ratio is a one-dimensional shortcut that misses qualitative compounding."
- *Fisher vs. Buffett*: "You'd miss the next Motorola waiting for a 'fair price' — great innovators are never cheap." vs. "Overpaying for 'quality' has destroyed more capital than buying mediocrity at bargain prices."

**Graham Arbitration**: Benjamin Graham synthesizes the debate as senior judge:
- **Quality Grade**: Class A / B / C based on moat breadth and earnings stability
- **Consensus Score**: $6.0 + (\text{bullish count} \times 0.9)$ out of 10
- **Margin of Safety**: Enforced against DCF fair value with uncertainty-calibrated thresholds
- **Recommended Allocation**: 4.0–5.0% if ≥ 3 bullish, otherwise 2.5–3.5%
- **Critical Invalidation Risks**: Explicit conditions that would kill the thesis

### Institutional Desk: The Trading Desk Simulation

**Structure**: 6-stage pipeline simulating institutional buy-side workflow

| Stage | Agent | Function |
|-------|-------|----------|
| 1 | Specialist Intelligence | Aggregates fundamentals, technicals, prediction markets, sentiment |
| 2 | Bull & Bear Researchers | 2-round structured debate (DCF upside vs. valuation risk, fortress balance sheet vs. overhead resistance) |
| 3 | Research Manager | Weighs fundamental undervaluation against technical confirmation → Buy/Overweight/Hold/Underweight with conviction score |
| 4 | Trader Agent | Builds ATR-calibrated order ticket: Entry, Stop-Loss ($1.5\times$ ATR), Take-Profit 1 ($2.5\times$ ATR), Take-Profit 2 ($4.0\times$ ATR), Risk/Reward ratio |
| 5 | Tri-Party Risk Committee | Aggressive (push to 5% for alpha) vs. Conservative (recession odds, credit spreads) vs. Neutral Arbiter (Kelly criterion compromise) |
| 6 | Portfolio Manager | Final sign-off with max drawdown threshold (-6.5%) and execution mandate |

---

## Inference Layer 4: The 3 P's Reality Filter

Every narrative assumption and valuation input must survive Damodaran's reality gates:

```
Possible  →  Plausible  →  Probable
```

- **Possible**: Is it within the realm of physical and economic possibility? (e.g., a company cannot grow faster than global GDP indefinitely)
- **Plausible**: Is there historical precedent or logical basis? (e.g., has any company in this industry sustained 40% margins?)
- **Probable**: Is it the most likely outcome given current evidence? (e.g., given current customer churn data, is 30% revenue growth next year realistic?)

**Terminal growth is bounded**: $g_{\text{terminal}} \le \min(3.0\%, \max(1.5\%, R_f \times 0.65))$. This is a hard mathematical constraint, not a judgment call.

---

## Inference Layer 5: Multi-AI Synthesis

The app orchestrates multiple AI engines for different inference tasks:

| AI Engine | Inference Role |
|-----------|---------------|
| **Google Gemini 1.5 Flash** | CIO-grade executive synthesis: 3-paragraph evaluation of moat durability, growth friction, and thesis invalidation triggers |
| **Perplexity Sonar** | Web-grounded 360° scuttlebutt audit: real-time employee morale, customer churn, supply chain viability checks |
| **Exa Neural Search** | Semantic discovery: finding supply chain disruptions and churn signals that keyword search misses |

**Principle**: AI augments but never replaces the structured analytical framework. AI-generated insights are inputs to the debate, not final conclusions. The app uses AI for breadth (scanning many sources quickly) while the pillar frameworks provide depth (structured, repeatable analysis).

---

## Inference Layer 6: Execution Guardrails

Every conclusion is coupled with quantitative risk controls — conclusions without risk parameters are opinions, not investment decisions:

### Position-Level Guards
| Guard | Threshold | Trigger |
|-------|-----------|---------|
| Margin of Safety (Low Uncertainty) | ≥ 20% discount to DCF fair value | Don't buy without adequate discount |
| Margin of Safety (Medium Uncertainty) | ≥ 30% | Wider cushion for less predictable businesses |
| Margin of Safety (High Uncertainty) | ≥ 40% | Maximum cushion for speculative situations |
| ATR Stop-Loss | $1.5\times$ Average True Range below entry | Technical volatility buffer |
| ATR Take-Profit 1 | $2.5\times$ ATR above entry | Partial exit target |
| ATR Take-Profit 2 | $4.0\times$ ATR above entry | Full exit target |
| Risk/Reward Ratio | $\text{Reward} / \text{Risk} : 1$ | Must exceed 1.5:1 minimum |

### Portfolio-Level Guards
| Guard | Threshold | Purpose |
|-------|-----------|---------|
| Max Drawdown | -6.5% | Portfolio Manager mandate ceiling |
| Position Concentration | 15–20% max per position | Prevent single-stock catastrophic risk |
| Initial Allocation | 5.0–8.0% | Disciplined entry sizing |
| Total Portfolio Size | 8–15 positions | Concentration, not diversification |

### Sell Discipline (Rules, Not Feelings)
1. **Thesis Broken**: Moat erosion, management integrity failure → Sell immediately
2. **Superior Opportunity**: Another investment with wider margin of safety → Rotate capital
3. **Extreme Bubble**: $P / \text{Fair Value} \ge 1.60$ → Trim or exit
4. **Never sell** a compounding winner merely because it doubled — if ROIC and moat remain intact, let it compound

---

## The 100-Point Composite Scorecard

The final inference gate — a quantified checklist requiring ≥ 80 points to commit capital:

| Category | Max Points | What It Tests |
|----------|-----------|---------------|
| Lynch: Circle of Competence & Taxonomy | 15 | Do you understand this business? |
| Fisher: Scuttlebutt & R&D Rigor | 20 | What does the ecosystem reveal? |
| Buffett: Economic Moat & Pricing Power | 20 | Is the competitive advantage durable? |
| Management: Integrity & Capital Allocation | 15 | Is management acting in owners' interest? |
| Damodaran: Modern Value, Cash Conversion & 3 P's | 15 | Does the math work under realistic assumptions? |
| Valuation: Margin of Safety & Entry Price | 15 | Is the price right? |
| **Total** | **100** | **Must score ≥ 80 to commit capital** |

---

## Inference Anti-Patterns (What We Deliberately Avoid)

1. **Single-metric decisions**: Never buy/sell based on P/E alone, DCF alone, or any one number
2. **Consensus-seeking**: The debate engine forces tension, not agreement
3. **Precision theater**: A DCF to the penny is false precision — the range matters more than the point estimate
4. **Recency bias**: 5-year trend analysis, not last quarter's beat/miss
5. **Narrative without numbers**: Qualitative stories must convert to DCF parameters
6. **Numbers without narrative**: Spreadsheet models without business understanding are hallucinations
7. **Sunk cost loyalty**: The decision memorandum is immutable — if the thesis breaks, sell regardless of entry price

---

*This document evolves as scoring algorithms are refined, debate structures are enhanced, or new inference techniques are discovered.*

