# 📚 App Philosophy & Plan Documentation

> **Living documentation** — This folder captures the evolving philosophies, design principles, and architectural decisions that shape this investment research platform. Documents here are updated as new learnings, frameworks, and design patterns are discovered and incorporated.

---

## Documents

| Document | Scope |
|----------|-------|
| [Data Philosophy](./data_philosophy.md) | How we source, validate, cache, and degrade data across live, stale, and demo tiers |
| [Architecture Philosophy](./architecture_philosophy.md) | Zero-dependency modularity, separation of concerns, resilience patterns |
| [Design Philosophy](./design_philosophy.md) | Institutional dark-terminal aesthetic, information density, pure SVG visualizations |
| [Investment Philosophy](./investment_philosophy.md) | The 4-Pillar Composite Framework (Lynch, Fisher, Buffett, Damodaran) with Graham arbitration |
| [Inference Philosophy](./inference_philosophy.md) | Multi-pillar triangulation, adversarial debate synthesis, disciplined execution guardrails |

---

## How This Folder Evolves

- **New learnings** — When a new design pattern, data source, or investment framework is discovered, the relevant document is updated with a dated entry.
- **Architecture changes** — Major structural decisions are recorded with rationale in `architecture_philosophy.md`.
- **Design iterations** — Visual language refinements, component patterns, and UX discoveries are logged in `design_philosophy.md`.
- **Investment insights** — New valuation techniques, expert frameworks, or risk models are added to `investment_philosophy.md`.
- **Inference refinements** — Improvements to scoring, consensus, or debate mechanics are captured in `inference_philosophy.md`.

---

## Changelog & Evolution History

- **September 2026 — DuckDuckGo Integration**: Added DuckDuckGo as a keyless Tier 2/3 Web & News Intelligence data source alongside Perplexity Sonar and Exa. Integrated `DuckDuckGoClient` (`lib/duckduckgoClient.js`), REST endpoint `GET /api/duckduckgo`, 4-vector Philip Fisher Scuttlebutt reconnaissance, and dark-terminal UI card in the Scuttlebutt tab.
- **September 2026 — Competitor Discovery & Peer Benchmarking**: Created dedicated `CompetitorEngine` (`lib/competitorEngine.js`), REST endpoint `GET /api/competitors`, SEC EDGAR 4-digit SIC regulatory peer classification, DuckDuckGo dynamic competitor discovery, side-by-side multi-metric financial benchmarking table, and one-click ticker pivoting in the `👥 Competitors & Peers` tab.

---

*Last updated: September 2026*

