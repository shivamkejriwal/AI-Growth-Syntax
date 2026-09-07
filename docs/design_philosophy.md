# Design Philosophy & Approach

> How we present complexity with clarity — an institutional dark-terminal aesthetic that respects the density of financial data while guiding the researcher's eye.

---

## Core Conviction

**Financial research demands information density, not simplification.** The design language draws from Bloomberg Terminal, FactSet, and TradingView — professional tools built for people who need to see many data points simultaneously and make decisions under uncertainty. The aesthetic is dark, precise, and deliberately institutional — not consumer-friendly pastel dashboards, but obsidian surfaces glowing with carefully hierarchized data.

---

## Visual Language

### Color Palette — Dark Institutional Terminal

The palette is built on layered dark surfaces with high-contrast semantic accents:

| Token | Value | Purpose |
|-------|-------|---------|
| `--bg-main` | `#070a11` | Deepest background — the void |
| `--bg-surface` | `#0e1526` | Elevated surface panels |
| `--bg-card` | `#131c31` | Card containers |
| `--bg-card-hover` | `#19243d` | Interactive card hover state |
| `--border-subtle` | `#1f2d4a` | Structural borders |
| `--border-active` | `#3b82f6` | Active/focused element borders |
| `--text-primary` | `#f1f5f9` | Primary text — high contrast |
| `--text-secondary` | `#94a3b8` | Supporting labels and descriptions |
| `--text-muted` | `#64748b` | De-emphasized metadata |

### Semantic Accent Colors

Each accent carries meaning — never decorative:

| Color | Token | Meaning |
|-------|-------|---------|
| Emerald | `#10b981` | Positive / bullish / healthy / live status |
| Blue | `#3b82f6` | Active state / selected / informational |
| Amber | `#f59e0b` | Caution / mixed signal / moderate |
| Red | `#ef4444` | Negative / bearish / danger / sell signal |
| Purple | `#8b5cf6` | Premium / qualitative / Fisher scuttlebutt |

### Expert Legend Colors (Experts Desk)

Each investment legend has a distinct brand color for instant visual identification in debates:

| Legend | Color | Rationale |
|--------|-------|-----------|
| Warren Buffett | Amber | Warm, authoritative, classic value |
| Peter Lynch | Emerald | Growth-oriented, retail accessibility |
| Philip Fisher | Purple | Qualitative depth, intellectual rigor |
| Aswath Damodaran | Cyan | Academic precision, quantitative clarity |
| Benjamin Graham (Arbiter) | Blue | Judicial authority, foundational wisdom |

---

## Typography

A deliberate dual-font system separates narrative from numerical data:

| Font | Usage |
|------|-------|
| **Plus Jakarta Sans** | Body text, labels, descriptions, narrative content |
| **JetBrains Mono** | Financial figures, tickers, CIK numbers, ratios, percentages, code-like identifiers |

**Principle**: Monospace fonts convey precision and machine-readability. When a user sees JetBrains Mono, they know it's a data point, not prose.

---

## Component Patterns

### Cards
- Dark card containers (`--bg-card`) with subtle borders (`--border-subtle`)
- Hover state elevates with lighter background and border glow
- Consistent border radius system: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 16px`

### Status Indicators
- Live status dots with emerald glow: `box-shadow: 0 0 8px var(--accent-emerald)`
- Pill badges for categorical labels (Lynch Category, Data Source, Quality Grade)
- Color-coded metric values — green for positive, red for negative, amber for cautionary

### Information Density
- Multi-column grid layouts maximize data per viewport
- Summary badges and metric pills compress key figures into scannable rows
- Callout banners highlight critical findings (margin of safety triggers, red flag disqualifiers)
- Tabbed panels organize deep research without forcing page navigation

### Interactive Patterns
- Expandable "MORE DETAILS" buttons on chart cards — opens institutional breakdown modals explaining formulas, methodology insights, and raw variables
- Year selector dropdowns for multi-year Sankey flow traversal
- Round and legend filters for debate stream navigation (Experts Desk)
- Quick-chip ticker buttons for instant company switching

---

## Visualization Philosophy

### Pure Mathematical SVG — No Charting Libraries

All visualizations are computed mathematically using native SVG generation:

| Chart Type | Technique | Purpose |
|------------|-----------|---------|
| Snowflake Radar | `polarToCartesian()`, `describeArc()` | 5-dimension quality scoring (Health, Value, Performance, Dividend, Management) |
| DCF Fair Value Gauge | SVG arc paths with fill zones | Intrinsic value vs. market price with margin of safety bands |
| Revenue & Expenses Sankey | Multi-tier node-link flow diagram | Visualize where revenue flows through COGS, R&D, SG&A to net earnings |
| Earnings Trend Lines | Dynamic SVG path calculations | Multi-year Revenue vs. Net Income trajectory |
| Financial Health Bars | Proportional bar segments | Debt, Equity, Cash composition over time |
| Management Capital Allocation | Grouped bar charts | R&D, Capex, M&A spending patterns |

**Why no D3 / Chart.js / Highcharts**: These libraries add 200KB–500KB of JavaScript, introduce breaking version changes, and impose their own visual opinions. Hand-computed SVG is lighter, faster, fully customizable, and philosophically consistent with the zero-dependency constraint.

### Sankey Flow Innovation
The Revenue & Expenses Sankey is a standout visualization — it maps the full income statement waterfall:

```
Revenue → COGS + Gross Profit → R&D + SG&A → Operating Income → Taxes → Net Earnings
```

Multi-year traversal allows the researcher to see how the income waterfall evolves across fiscal years, revealing margin expansion, cost structure shifts, and operating leverage trends.

---

## Navigation Architecture

### Two-Mode System
1. **Company Research** — Deep single-company analysis with tabbed sub-panels
2. **Macro Economy Research** — Broad market context (FRED, Yield Curve, Sector ETFs, Market Movers)

### Company Research Tab Structure

| Tab | Content |
|-----|---------|
| Visual Scorecard | Snowflake Radar, DCF Gauge, Sankey Flow, Health, Earnings, Capital Allocation, Dividends |
| Peter Lynch | PEG analysis, 6-category taxonomy, inventory-sales spread, net cash |
| Philip Fisher | 360° Scuttlebutt — GitHub, HN, Reddit, ImportYeti, 15 Points, 5 Circles |
| Warren Buffett | Owner Earnings, ROIC history, $1 Retained Earnings Test, Solvency Cushion |
| Aswath Damodaran | R&D Capitalization, Lease Debt, Implied ERP, Sector WACC, Synthetic Rating, 3 P's |
| Experts Desk | 4-Legend Debate (Buffett, Lynch, Fisher, Damodaran) with Graham Arbitration |
| Institutional Desk | Bull/Bear Debate, Trade Plan, ATR Order Ticket, Risk Committee, PM Sign-Off |
| Memorandum | Markdown Investment Memorandum viewer and exporter |

### Design Intent
The tab structure mirrors the investment workflow: start with visual overview → dive into each pillar's analysis → synthesize through multi-agent debate → formalize in a decision memorandum. The UI is the methodology made navigable.

---

## Debate Visualization (Multi-Agent Panels)

### Experts Desk Design
- **Graham Arbiter Card**: Prominent top card with Quality Grade, Consensus Score, Margin of Safety, and executive synthesis
- **4-Legend Scorecard Matrix**: Grid of legend cards, each with stance badge, conviction score, and key argument summary
- **Multi-Turn Debate Arena**: Speech bubble cards with round and legend filters, color-coded by expert identity
- Distinct visual weight for each expert: amber for Buffett, emerald for Lynch, purple for Fisher, cyan for Damodaran

### Institutional Desk Design
- **Bull/Bear Debate Stream**: Alternating argument cards with bull (green) and bear (red) styling
- **Order Ticket**: Structured card showing entry, stop-loss, take-profit levels with risk/reward visualization
- **Tri-Party Risk Committee**: Three-column deliberation layout (Aggressive, Conservative, Neutral Arbiter)
- **PM Sign-Off**: Final mandate card with allocation approval and max drawdown threshold

---

## Responsive Principles

- **Desktop-first**: Financial research is primarily a desktop activity — optimize for wide viewports
- **Graceful narrowing**: Grid columns collapse and cards stack on narrower screens
- **Touch-friendly targets**: Buttons and interactive elements maintain adequate tap targets
- **No mobile-specific redesign**: The app is a professional tool, not a consumer product

---

## Educational Layer

Every chart and metric includes an accessible educational layer:

- **"MORE DETAILS" modals** explain the underlying formula, data sources, and methodology
- **Tooltips and labels** use precise financial terminology (not dumbed-down consumer language)
- **The app teaches as it researches** — a new analyst can learn Lynch's PEG ratio, Buffett's Owner Earnings formula, or Damodaran's R&D capitalization technique simply by exploring the interface

---

*This document evolves as new components are designed, color semantics are refined, or visualization techniques are improved.*

