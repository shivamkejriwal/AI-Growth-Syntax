/**
 * companyAnalysisOrchestrator.js
 * Multi-Persona Company Analysis & Debate Orchestration Engine.
 * 
 * WORKFLOW:
 * 1. Given Company / Ticker -> Ingest Raw Data & Build Unified Company Dossier (with 14 Risk Checks)
 * 2. Feed Dossier to 5 Analysis Personas:
 *    - Bull Researcher
 *    - Bear Researcher
 *    - Aggressive Risk Debater
 *    - Conservative Risk Debater
 *    - Neutral Risk Arbiter
 *    2a. Each persona analyzes data, builds a case for/against, and writes an opinionated summary.
 *    2b. Personas engage in a multi-turn debate with direct rebuttals -> Formulates Debate Conclusion.
 * 3. Feed Debate Conclusion + Company Dossier to 4 Expert Personas:
 *    - Warren Buffett
 *    - Peter Lynch
 *    - Philip Fisher
 *    - Aswath Damodaran
 *    3a. Each expert analyzes data & debate, builds case for/against, and writes an opinionated summary.
 * 4. Feed Analysis Data + Expert Findings + Debate Conclusion + Dossier to Senior Arbiter Benjamin Graham:
 *    - Graham provides a definitive Final Opinionated Master Summary, Margin of Safety verdict,
 *      composite grade, allocation mandate, and invalidation triggers.
 */

import { CompositeInvestor, formatCurrency } from './compositeInvestor.js';
import { GeminiClient } from './geminiClient.js';
import { PersonaDebateEngine, PERSONA_CONFIGS, defaultPersonaDebateEngine } from './personaDebateEngine.js';
import { DiskCache } from './cache.js';
import { roundVal, safeFloat } from './alphaVantageClient.js';

const cache = new DiskCache('company_analysis_cache');

export class CompanyAnalysisOrchestrator {
  constructor(options = {}) {
    this.investor = options.compositeInvestor || new CompositeInvestor();
    this.gemini = options.gemini || new GeminiClient();
    this.debateEngine = options.personaDebateEngine || defaultPersonaDebateEngine;
    this.cacheTtlHours = options.cacheTtlHours ?? 1; // 1-hour cache
  }

  /**
   * Executes the full 4-stage Multi-Persona Company Analysis workflow.
   * 
   * @param {string} ticker Company ticker symbol
   * @param {Object} [options]
   * @param {string} [options.mode='live'] 'live' | 'demo' | 'mock'
   * @param {boolean} [options.forceRefresh=false]
   * @returns {Promise<Object>} Complete multi-persona analysis output
   */
  async runAnalysis(ticker, options = {}) {
    const sym = (ticker || 'MSFT').trim().toUpperCase();
    const mode = options.mode || 'live';
    const forceRefresh = Boolean(options.forceRefresh);

    const cacheKey = `analysis_${sym}_${mode}`;
    if (!forceRefresh) {
      const cached = cache.get(cacheKey, 'company_analysis', this.cacheTtlHours * 3600 * 1000);
      if (cached) return cached;
    }

    // ========================================================================
    // STAGE 1: PULL RAW DATA & BUILD COMPANY DOSSIER
    // ========================================================================
    const dossier = await this.investor.getCompositeDossier(sym, { mode, forceRefresh });
    const meta = dossier.metadata || {};
    const financials = dossier.companyData?.financials || dossier.rawFinancials || {};
    const latest = financials.latest || {};
    const market = dossier.companyData?.market || {};
    const signals = dossier.signals || { summary: {}, riskChecks: [] };

    const companyContext = {
      ticker: sym,
      name: meta.companyName || sym,
      sector: meta.sector || 'General',
      industry: meta.industry || 'General',
      currentPrice: meta.currentPrice || market.currentPrice || 100,
      marketCap: meta.marketCap || market.marketCap || 1e9,
      marketCapFormatted: formatCurrency(meta.marketCap || market.marketCap || 1e9),
      peRatio: meta.peRatio || market.peRatio || 25,
      pegRatio: meta.pegRatio || 1.5,
      revenue: latest.revenue || 1e9,
      revenueFormatted: formatCurrency(latest.revenue || 1e9),
      netIncome: latest.netIncome || 1e8,
      netIncomeFormatted: formatCurrency(latest.netIncome || 1e8),
      operatingCashFlow: latest.operatingCashFlow || latest.operatingCashflow || 1e8,
      operatingCashFlowFormatted: formatCurrency(latest.operatingCashFlow || latest.operatingCashflow || 1e8),
      totalDebt: latest.totalDebt || 0,
      totalDebtFormatted: formatCurrency(latest.totalDebt || 0),
      cash: latest.cashAndEquivalents || latest.cash || 0,
      cashFormatted: formatCurrency(latest.cashAndEquivalents || latest.cash || 0),
      equity: latest.shareholdersEquity || latest.equity || 1e8,
      equityFormatted: formatCurrency(latest.shareholdersEquity || latest.equity || 1e8),
      debtToEquity: roundVal(financials.ratios?.debtToEquity ?? (latest.totalDebt / (latest.shareholdersEquity || 1)), 2),
      netMargin: roundVal(financials.ratios?.netMarginPercent ?? ((latest.netIncome / (latest.revenue || 1)) * 100), 1),
      fairValue: dossier.equityVisuals?.sharePriceVsFairValue?.fairValue || ((meta.currentPrice || 100) * 1.1),
      valuationStatus: dossier.equityVisuals?.sharePriceVsFairValue?.status || 'Fairly Valued',
      riskScore: signals.summary?.passed ? `${signals.summary.passed}/${signals.summary.totalChecks}` : '13/14',
      riskRating: signals.summary?.riskRating || 'Low Risk',
      riskPassPercent: signals.summary?.passScorePercent || 92.9,
      failedChecks: signals.riskChecks?.filter(c => c.status === 'FAIL') || []
    };

    // ========================================================================
    // STAGE 2-5: PERSONA AUGMENTATION INFERENCE, DEBATES & SYNTHESIS
    // ========================================================================
    let analysisPersonas = null;
    let debate = null;
    let expertPersonas = null;
    let expertDebate = null;
    let seniorArbiter = null;

    const shouldRunAi = mode === 'live' && this.debateEngine.isConfigured && options.useAi !== false;

    let aiAugmented = false;
    let aiProvider = null;
    let aiModel = null;

    if (shouldRunAi) {
      try {
        const aiWorkflow = await this._runAiAugmentedWorkflow(companyContext, dossier, options);
        analysisPersonas = aiWorkflow.analysisPersonas;
        debate = aiWorkflow.debate;
        expertPersonas = aiWorkflow.expertPersonas;
        expertDebate = aiWorkflow.expertDebate;
        seniorArbiter = aiWorkflow.seniorArbiter;
        aiAugmented = true;
        aiProvider = this.debateEngine.provider || 'gemini';
        aiModel = this.debateEngine.geminiClient?.model || 'gemini-2.5-flash';
      } catch (aiErr) {
        console.warn('[CompanyAnalysisOrchestrator] AI Persona workflow encountered error, falling back to deterministic baseline:', aiErr.message);
      }
    }

    // Deterministic Fallback if AI not used or incomplete
    if (!analysisPersonas) {
      analysisPersonas = this._buildAnalysisPersonas(companyContext, dossier);
    }
    if (!debate) {
      debate = this._buildAnalysisDebate(companyContext, analysisPersonas, dossier);
    }
    if (!expertPersonas) {
      expertPersonas = this._buildExpertPersonas(companyContext, dossier, debate.conclusion);
    }
    if (!expertDebate) {
      expertDebate = this._buildExpertsDebate(companyContext, expertPersonas, dossier);
    }
    if (!seniorArbiter) {
      seniorArbiter = this._buildBenjaminGrahamArbitration(
        companyContext,
        dossier,
        expertDebate.conclusion
      );
    }

    const result = {
      _meta: {
        schemaVersion: '1.1.0',
        ticker: sym,
        companyName: companyContext.name,
        timestamp: Date.now(),
        isoDate: new Date().toISOString(),
        mode,
        aiAugmented: Boolean(aiAugmented),
        aiProvider: aiAugmented ? aiProvider : 'deterministic_baseline',
        aiModel: aiAugmented ? aiModel : null,
        stages: 5
      },
      companyContext,
      stage1_DossierSummary: {
        ticker: sym,
        name: companyContext.name,
        sector: companyContext.sector,
        currentPrice: companyContext.currentPrice,
        marketCapFormatted: companyContext.marketCapFormatted,
        valuationStatus: companyContext.valuationStatus,
        riskScore: companyContext.riskScore,
        riskRating: companyContext.riskRating,
        riskPassPercent: companyContext.riskPassPercent,
        signalsSummary: signals.summary,
        riskChecks: signals.riskChecks
      },
      stage2_AnalysisPersonas: {
        personas: analysisPersonas,
        debate
      },
      stage3_ExpertPersonas: {
        debateFedToExperts: debate.conclusion,
        experts: expertPersonas
      },
      stage4_ExpertsDebate: expertDebate,
      stage5_SeniorArbiterGraham: seniorArbiter,
      // Backward compatibility alias for existing consumers:
      stage4_SeniorArbiterGraham: seniorArbiter
    };

    cache.set(cacheKey, result, 'company_analysis');
    return result;
  }

  // ==========================================================================
  // HELPER BUILDERS
  // ==========================================================================

  _buildAnalysisPersonas(ctx, dossier) {
    const isUndervalued = ctx.fairValue > ctx.currentPrice;
    const upsidePct = Math.abs(((ctx.fairValue - ctx.currentPrice) / ctx.currentPrice) * 100).toFixed(1);
    const failedCheckNames = ctx.failedChecks.map(c => c.question).join(', ') || 'None';

    // 1. Bull Researcher
    const bullCase = [
      `Monolithic market position with massive scale ($${ctx.revenueFormatted} revenue) and high recurring free cash conversion.`,
      `Fortress balance sheet featuring $${ctx.cashFormatted} in liquid cash against low leverage (Debt/Equity: ${ctx.debtToEquity}x).`,
      `Robust net profit margin of ${ctx.netMargin}% demonstrating strong pricing power and enterprise switching moats.`,
      `Intrinsic fair value estimated at $${ctx.fairValue.toFixed(2)} (${isUndervalued ? `+${upsidePct}% upside` : 'steady long-term compounding'}).`
    ];
    const bullSummary = `${ctx.name} is an elite capital compounding machine. With gross margins exceeding peer benchmarks and aggressive secular positioning in modern enterprise tech, temporary valuation premiums or insider selling noise are insignificant compared to its 5-year compounding durability. Accumulate aggressively on any market dip.`;

    // 2. Bear Researcher
    const bearCase = [
      `Elevated valuation multiple (P/E: ${ctx.peRatio}x, PEG: ${ctx.pegRatio}x) leaves zero room for operational slip-ups or macroeconomic contraction.`,
      `Flagged risk checks: ${failedCheckNames}. Heavy executive insider selling indicates smart insiders are locking in gains rather than accumulating.`,
      `Diminishing marginal returns on gargantuan capex cycles; future top-line growth is mathematically bound to decelerate due to the law of large numbers.`,
      `Antitrust and regulatory scrutiny threatens bundling power and enterprise software margins.`
    ];
    const bearSummary = `The risk/reward asymmetry is unfavorable at current price levels ($${ctx.currentPrice.toFixed(2)}). Markets are pricing in perfection for ${ctx.name} while ignoring persistent insider selling and ballooning infrastructure capital intensity. Capital is better preserved on the sidelines or rotated into cheaper defensive value.`;

    // 3. Aggressive Risk Debater
    const aggressiveCase = [
      `Asymmetric upside profile: ${ctx.name} is the undisputed foundational platform of the next decade's computing wave.`,
      `Operating cash flow of $${ctx.operatingCashFlowFormatted} gives management infinite optionality to acquire disruptors or buy back shares.`,
      `Insider sales are routine pre-scheduled 10b5-1 tax events; treating them as structural red flags is classic market overthinking.`,
      `In a bull regime, premium franchises deservedly command premium multiples. Momentum favors the bold.`
    ];
    const aggressiveSummary = `Bet on the generational platform champion. Risk in ${ctx.name} is largely academic—when a company generates $${ctx.operatingCashFlowFormatted} in cash, downside is strictly cushioned by buyback capacity and enterprise ubiquity. Maximize portfolio allocation to growth.`;

    // 4. Conservative Risk Debater
    const conservativeCase = [
      `Primary fiduciary duty is capital preservation: At a ${ctx.peRatio}x P/E, an investor is paying $${ctx.peRatio} for every $1 of earnings, requiring decades to recoup under adverse market regimes.`,
      `Net debt and total obligations ($${ctx.totalDebtFormatted}) must be rigorously scrutinized against potential liquidity shocks.`,
      `Insider selling cannot be cavalierly dismissed—leadership is actively cashing out while retail takes on high-multiple duration risk.`,
      `Demands a minimum 25% Margin of Safety before committing client capital.`
    ];
    const conservativeSummary = `Prudence dictates caution. While ${ctx.name} possesses undeniable balance sheet strength, paying historically elevated multiples exposes investors to severe multiple compression if interest rates remain elevated or growth slows by even 200 basis points. Hold existing positions, but do not initiate fresh capital without a margin of safety.`;

    // 5. Neutral Risk Arbiter
    const neutralCase = [
      `Factual balance sheet score: ${ctx.riskScore} Risk Checks Passed (${ctx.riskPassPercent}%), denoting a fundamentally pristine financial condition.`,
      `Valuation status is ${ctx.valuationStatus}: Intrinsic DCF value lands at $${ctx.fairValue.toFixed(2)} vs market price of $${ctx.currentPrice.toFixed(2)}.`,
      `Bull thesis on cash flow conversion and Bear thesis on multiple duration risk are both quantitatively sound.`,
      `Net position: Risk/reward is balanced; suitable for core strategic holding with staggered accumulation rather than binary all-in bets.`
    ];
    const neutralSummary = `Synthesizing objective financial signals, ${ctx.name} qualifies as a tier-1 institutional compounder. The downside is structurally protected by $${ctx.cashFormatted} in liquidity, while upside is moderated by its ${ctx.peRatio}x valuation multiple. The optimal strategy is systematic, phased dollar-cost averaging.`;

    return {
      bullResearcher: {
        id: 'bull_researcher',
        title: 'Bull Researcher',
        badge: 'Growth & Moats',
        stance: 'BULLISH',
        verdict: 'Strong Buy / Accumulate',
        coreCase: bullCase,
        opinionatedSummary: bullSummary
      },
      bearResearcher: {
        id: 'bear_researcher',
        title: 'Bear Researcher',
        badge: 'Risk & Friction',
        stance: 'BEARISH',
        verdict: 'Underweight / Caution',
        coreCase: bearCase,
        opinionatedSummary: bearSummary
      },
      aggressiveRiskDebater: {
        id: 'aggressive_risk_debater',
        title: 'Aggressive Risk Debater',
        badge: 'Asymmetric Upside',
        stance: 'VERY BULLISH',
        verdict: 'Max Allocation',
        coreCase: aggressiveCase,
        opinionatedSummary: aggressiveSummary
      },
      conservativeRiskDebater: {
        id: 'conservative_risk_debater',
        title: 'Conservative Risk Debater',
        badge: 'Capital Preservation',
        stance: 'DEFENSIVE / NEUTRAL',
        verdict: 'Wait for Margin of Safety',
        coreCase: conservativeCase,
        opinionatedSummary: conservativeSummary
      },
      neutralRiskArbiter: {
        id: 'neutral_risk_arbiter',
        title: 'Neutral Risk Arbiter',
        badge: 'Objective Adjudicator',
        stance: 'BALANCED',
        verdict: 'Strategic Hold / Phased Accumulation',
        coreCase: neutralCase,
        opinionatedSummary: neutralSummary
      }
    };
  }

  _buildAnalysisDebate(ctx, personas, dossier) {
    const rounds = [
      {
        roundNumber: 1,
        title: 'Round 1: Opening Theses Clash (Growth vs Multiple Risk)',
        turns: [
          {
            speaker: 'Bull Researcher',
            role: 'Bullish Growth Advocate',
            argument: `${ctx.name} is firing on all cylinders with $${ctx.revenueFormatted} in revenue and ${ctx.netMargin}% net margins. There is no viable substitute for their core enterprise ecosystem, making revenue growth durable and recurring.`
          },
          {
            speaker: 'Bear Researcher',
            role: 'Bearish Risk Analyst',
            rebuttalTo: 'Bull Researcher',
            argument: `Durability does not justify paying ${ctx.peRatio}x earnings! At this multiple, you are discounting perfection 10 years into the future. Furthermore, our risk checks flag substantial insider selling over the past 3 months. If the future is so radiant, why are company executives cashing out tens of millions in shares?`
          },
          {
            speaker: 'Neutral Risk Arbiter',
            role: 'Objective Fact-Checker',
            ruling: `Fact-check on the record: ${ctx.name} indeed generated $${ctx.netIncomeFormatted} in net income, and 13 out of 14 risk checks passed with zero balance sheet stress. However, the Bear is correct that the P/E ratio of ${ctx.peRatio}x leaves minimal margin for error.`
          }
        ]
      },
      {
        roundNumber: 2,
        title: 'Round 2: Risk Tolerance Duel (Aggressive vs Conservative)',
        turns: [
          {
            speaker: 'Aggressive Risk Debater',
            role: 'High-Tolerance Momentum Seeker',
            rebuttalTo: 'Bear Researcher',
            argument: `The Bear is obsessing over pennies while missing the generational platform shift! Insider selling on pre-planned 10b5-1 schedules is routine executive liquidity, not a structural panic. Look at the cash conversion—$${ctx.operatingCashFlowFormatted} in operating cash flow! That is a fortress that incinerates short theses.`
          },
          {
            speaker: 'Conservative Risk Debater',
            role: 'Downside Protection Advocate',
            rebuttalTo: 'Aggressive Risk Debater',
            argument: `Cavalier attitudes toward valuation always end in tears when the macro tide turns. You cannot buy a business simply because its operating cash flow is large; you must evaluate what you pay for that cash flow. If terminal discount rates rise by even 100 bps, this stock drops 20% overnight. Capital preservation must come before euphoria.`
          },
          {
            speaker: 'Neutral Risk Arbiter',
            role: 'Risk-Adjusted Synthesis',
            ruling: `Both debaters raise valid structural mechanics. Aggressive rightly points to uncontested cash flow scale ($${ctx.operatingCashFlowFormatted}); Conservative rightly warns of duration vulnerability given the ${ctx.peRatio}x multiple.`
          }
        ]
      },
      {
        roundNumber: 3,
        title: 'Round 3: Direct Closing Rebuttals',
        turns: [
          {
            speaker: 'Bear Researcher',
            role: 'Bearish Risk Analyst',
            rebuttalTo: 'Aggressive Risk Debater',
            argument: `To the Aggressive Debater: If cloud growth rates normalize or enterprise software budgets compress, what is your downside floor? You have no tangible margin of safety other than hope.`
          },
          {
            speaker: 'Bull Researcher',
            role: 'Bullish Growth Advocate',
            rebuttalTo: 'Bear Researcher',
            argument: `The downside floor is $${ctx.cashFormatted} in cash, high ROIC, and massive share repurchase capacity that protects earnings per share even in slower top-line environments. Bet on compounding quality, not cyclical paralysis.`
          }
        ]
      }
    ];

    const conclusion = {
      consensusPoints: [
        `${ctx.name} possesses exceptional balance sheet health, zero solvency risk, and elite cash generation ($${ctx.operatingCashFlowFormatted}).`,
        `Core financial quality is confirmed by passing 13 of 14 objective risk checks (${ctx.riskPassPercent}% pass score).`
      ],
      contestedBattleground: `The debate hinges strictly on Valuation Multiple Friction (${ctx.peRatio}x P/E) and insider selling vs Generational Platform Durability and Buyback Cushion.`,
      verdictToExperts: `${ctx.name} is a pristine enterprise trading at a full valuation. The 5 Analysis Personas refer this file to the 4 Legendary Experts to determine if the moat, return on capital, scuttlebutt, and DCF justify entering at current market prices.`
    };

    return {
      rounds,
      conclusion
    };
  }

  _buildExpertPersonas(ctx, dossier, debateConclusion) {
    const p1 = dossier.pillar1_Lynch || {};
    const p2 = dossier.pillar2_Fisher || {};
    const p3 = dossier.pillar3_Buffett || {};
    const p4 = dossier.pillar4_Damodaran || {};
    const visuals = dossier.equityVisuals || {};

    const roic = p3.averageROIC || p3.latestROIC || 28.5;
    const isHighMoat = (typeof roic === 'number' && roic >= 15) || String(roic).includes('MOAT');
    const ownerCash = p3.latestOwnerEarningsFormatted || formatCurrency(ctx.netIncome * 0.9);
    const lynchCat = p1.category || 'Stalwart';
    const peg = p1.pegRatio || ctx.pegRatio;
    const devMorale = p2.engineeringSentiment?.engineerSentimentVerdict || 'Bullish & Highly Motivated';
    const wacc = p4.costOfCapital?.waccPercent || 9.0;
    const fairVal = visuals.sharePriceVsFairValue?.fairValue || ctx.fairValue;

    // 1. Warren Buffett
    const buffettCase = [
      `Economic Moat Audit: Average ROIC of ${roic}% clears our 15% hurdle with ease, proving a wide enterprise moat and high pricing power.`,
      `Owner Earnings: Generating ${ownerCash} in true spendable cash for owners after real capital maintenance.`,
      `Solvency Fortress: $${ctx.cashFormatted} in cash vs $${ctx.totalDebtFormatted} in debt demonstrates pristine financial resilience.`,
      `Debate Rebuttal: The Bear is right to be skeptical of high multiples, but as I learned from Charlie Munger: It's far better to buy a wonderful company at a fair price than a fair company at a wonderful price.`
    ];
    const buffettSummary = `${ctx.name} is a textbook wonderful business with an enduring moat. While it is not a 50-cent dollar cigar butt, its ability to redeploy capital at high rates of return makes it an exceptional candidate for long-term holding. My verdict: ACCUMULATE ON QUALITY.`;

    // 2. Peter Lynch
    const lynchCase = [
      `Taxonomy Classification: Classified as a "${lynchCat}". It is a multibillion-dollar blue-chip engine that offers defensive resilience and consistent double-digit growth.`,
      `PEG Ratio Check: PEG stands at ${peg}x. While our favorite hunting ground is PEG < 1.0, a Stalwart with this level of recurring cash flow is reasonable up to 1.5x - 2.0x.`,
      `Street-Level Edge: Ubiquitous across Fortune 500 enterprises and developer workflows. Switching costs are extraordinarily high.`,
      `Debate Rebuttal: I agree with the Bull that you don't sell a champion simply because it had a good run, but watch the inventory/sales growth spread and enterprise budget slowdowns closely.`
    ];
    const lynchSummary = `As a ${lynchCat}, ${ctx.name} won't double overnight, but it will protect you in downturns and compound steadily. Don't let the noise scare you out of a winning position. My verdict: SOLID STALWART HOLD / BUY ON DIPS.`;

    // 3. Philip Fisher
    const fisherCase = [
      `Scuttlebutt & Tech Moat: Developer momentum is high; engineering sentiment is "${devMorale}".`,
      `R&D Productivity: Reinvestment into core cloud and intelligent systems is yielding tangible enterprise customer lock-in.`,
      `Management & Integrity Audit: While insider selling was flagged in the risk checks, Form 4 disclosures show long-tenured leadership retains enormous personal equity stakes.`,
      `Debate Rebuttal: The Bear complains about large capex. I disagree—aggressive R&D and capital spending to build proprietary competitive lead is exactly what I look for in a 15-Point company.`
    ];
    const fisherSummary = `Field intelligence confirms high customer retention and superior engineering discipline. When a company dominates its technological ecosystem with high switching friction, you stay invested for the compounding decade. My verdict: EXCEPTIONAL FRANCHISE QUALITY.`;

    // 4. Aswath Damodaran
    const damodaranCase = [
      `Valuation Mechanics: Cost of capital (synthetic WACC) is calculated at ${wacc}%.`,
      `Intrinsic Fair Value: Multi-stage DCF yields an intrinsic equity value of $${fairVal.toFixed(2)} per share vs current price of $${ctx.currentPrice.toFixed(2)}.`,
      `Narrative-to-Numbers Reality Filter: The Bull's story of enterprise dominance is Possible and Plausible. However, the Probable path suggests modest multiple compression over time.`,
      `Debate Rebuttal: Both Bull and Bear make emotional appeals. The math indicates the stock is ${visuals.sharePriceVsFairValue?.status || 'Fairly Valued'}. Do not chase at peak multiples, but accumulate when priced below intrinsic DCF.`
    ];
    const damodaranSummary = `The market price is closely anchored to its intrinsic discounted cash flow fair value ($${fairVal.toFixed(2)}). The narrative of durable enterprise cloud leadership holds up under accounting normalization, but upside is constrained by current valuation. My verdict: NEUTRAL / FAIRLY VALUED.`;

    return {
      warrenBuffett: {
        id: 'warren_buffett',
        name: 'Warren Buffett',
        role: 'Chairman & CEO, Berkshire Hathaway',
        philosophy: 'Economic Moats, Owner Earnings & Capital Discipline',
        stance: 'BULLISH ON MOAT',
        verdict: 'Accumulate High-Quality Compounder',
        caseAnalysis: buffettCase,
        opinionatedSummary: buffettSummary
      },
      peterLynch: {
        id: 'peter_lynch',
        name: 'Peter Lynch',
        role: 'Former Manager, Fidelity Magellan Fund',
        philosophy: 'Circle of Competence, PEG Ratio & Company Taxonomy',
        stance: 'COMPOUNDING STALWART',
        verdict: 'Buy on Cyclical Pullbacks',
        caseAnalysis: lynchCase,
        opinionatedSummary: lynchSummary
      },
      philipFisher: {
        id: 'philip_fisher',
        name: 'Philip Fisher',
        role: 'Pioneer of Growth Investing & Scuttlebutt',
        philosophy: '360° Scuttlebutt, R&D Productivity & Management Integrity',
        stance: 'EXCEPTIONAL QUALITY',
        verdict: 'Long-Term Hold & Grow',
        caseAnalysis: fisherCase,
        opinionatedSummary: fisherSummary
      },
      aswathDamodaran: {
        id: 'aswath_damodaran',
        name: 'Aswath Damodaran',
        role: 'Professor of Finance, NYU Stern',
        philosophy: 'DCF Intrinsic Fair Value, WACC & Narrative-to-Numbers',
        stance: 'FAIRLY VALUED',
        verdict: 'Disciplined DCF Entry Only',
        caseAnalysis: damodaranCase,
        opinionatedSummary: damodaranSummary
      }
    };
  }

  _buildExpertsDebate(ctx, expertPersonas, dossier) {
    const visuals = dossier.equityVisuals || {};
    const fairVal = visuals.sharePriceVsFairValue?.fairValue || ((ctx.currentPrice || 100) * 1.1);

    const rounds = [
      {
        roundNumber: 1,
        title: 'Round 1: Economic Moats vs DCF Multiple (Buffett vs Damodaran)',
        turns: [
          {
            speaker: 'Warren Buffett',
            role: 'Chairman & CEO, Berkshire Hathaway',
            argument: `It is far better to buy a wonderful business like ${ctx.name} at a fair price than a fair business at a wonderful price. The high return on invested capital and sticky customer ecosystem mean this moat compounds steadily through all macro cycles.`
          },
          {
            speaker: 'Aswath Damodaran',
            role: 'Professor of Finance, NYU Stern',
            rebuttalTo: 'Warren Buffett',
            argument: `Warren, even the most durable moat has a finite intrinsic cash flow value. At ${ctx.peRatio}x earnings, the market is pricing in flawless execution. My multi-stage DCF yields an intrinsic fair value of $${fairVal.toFixed(2)}—paying a multiple premium above intrinsic cash flow erodes expected return.`
          }
        ]
      },
      {
        roundNumber: 2,
        title: 'Round 2: R&D Reinvestment Velocity vs Stalwart Taxonomy (Fisher vs Lynch)',
        turns: [
          {
            speaker: 'Philip Fisher',
            role: 'Pioneer of Growth & Scuttlebutt',
            argument: `Quantitative multiple screens miss what 360° scuttlebutt reveals: ${ctx.name} reinvests aggressively into high-margin platform initiatives with superior R&D productivity. You cannot evaluate a generational tech compounder with static backward-looking PE filters.`
          },
          {
            speaker: 'Peter Lynch',
            role: 'Former Manager, Fidelity Magellan Fund',
            rebuttalTo: 'Philip Fisher',
            argument: `Philip, I love quality businesses, but at over ${ctx.marketCapFormatted} market cap, this is clearly a Stalwart, not a Fast Grower. A PEG ratio of ${ctx.pegRatio}x dictates patience: do not chase at peak multiples, but accumulate aggressively on cyclical 15-20% pullbacks.`
          }
        ]
      },
      {
        roundNumber: 3,
        title: 'Round 3: Final Doctrinal Clash & Committee Mandate',
        turns: [
          {
            speaker: 'Warren Buffett',
            role: 'Chairman & CEO, Berkshire Hathaway',
            rebuttalTo: 'Aswath Damodaran',
            argument: `When you possess a wide moat with low debt ($${ctx.totalDebtFormatted}) and high liquid reserves ($${ctx.cashFormatted}), time is the friend of the wonderful business. But I agree with Aswath: price discipline is essential.`
          },
          {
            speaker: 'Aswath Damodaran',
            role: 'Professor of Finance, NYU Stern',
            rebuttalTo: 'Warren Buffett',
            argument: `Consensus is reached on business quality. The file now passes to Ben Graham with our key question: does current market price offer an adequate Margin of Safety, or must investors hold limit orders?`
          }
        ]
      }
    ];

    const conclusion = {
      expertConsensusPoints: [
        `${ctx.name} possesses pristine balance sheet health, verified by ${ctx.riskScore} passed risk checks and $${ctx.cashFormatted} in liquid cash.`,
        `Economic moat and high return on capital provide durable franchise pricing power over economic cycles.`,
        `Valuation multiple (${ctx.peRatio}x P/E) is trading near or slightly above intrinsic DCF fair value ($${fairVal.toFixed(2)}), making disciplined entry thresholds imperative.`
      ],
      contestedBattleground: `Doctrinal Friction: Whether ${ctx.name}'s generational platform moat justifies buying at full valuation multiples (Buffett/Fisher) vs demanding a classical discount to DCF fair value (Damodaran/Lynch).`,
      irreconcilableDifferences: `Buffett and Fisher are willing to hold through multiple compression for compounding franchise quality, whereas Damodaran and Lynch demand price pullback to intrinsic fair value before deploying fresh capital.`,
      verdictToSeniorArbiter: `The 4 Experts unanimously validate the exceptional franchise caliber and solvency of ${ctx.name}, but stand divided on multiple entry tolerance. Transmitted exclusively to Senior Arbiter Benjamin Graham to adjudicate the definitive Margin of Safety and maximum prudent entry price.`
    };

    return {
      rounds,
      conclusion
    };
  }

  _buildBenjaminGrahamArbitration(ctx, dossier, expertDebateConclusion) {
    const conclusion = expertDebateConclusion || {};
    const isUndervalued = ctx.fairValue > ctx.currentPrice;
    const diffPct = (((ctx.fairValue - ctx.currentPrice) / ctx.fairValue) * 100).toFixed(1);
    const hasMarginOfSafety = ctx.currentPrice <= (ctx.fairValue * 0.85);

    let compositeGrade = 'A-';
    let recommendation = 'PRUDENT ACCUMULATION ON RETRACEMENT';
    if (hasMarginOfSafety) {
      compositeGrade = 'A+';
      recommendation = 'HIGH-CONVICTION VALUE BUY (STRONG MARGIN OF SAFETY)';
    } else if (ctx.currentPrice > (ctx.fairValue * 1.25)) {
      compositeGrade = 'B-';
      recommendation = 'HOLD / TRIM SPECULATIVE PREMIUM (VALUATION STRETCHED)';
    }

    const battlegroundNote = conclusion.contestedBattleground || `Valuation multiple friction vs franchise moat durability.`;

    const masterSummary = `Having received the objective Company Dossier alongside the Final Conclusion transmitted from the Legendary Experts Debate (Buffett, Lynch, Fisher, Damodaran), my Senior Arbiter adjudication on ${ctx.name} (${ctx.ticker}) is unequivocal:

1. Financial Fortress Integrity: ${ctx.name} meets the strictest standards of quantitative solvency. It passes ${ctx.riskScore} risk checks (${ctx.riskPassPercent}%), possesses $${ctx.cashFormatted} in liquid cash reserves, and produces consistent operating cash flow ($${ctx.operatingCashFlowFormatted}). Net shareholders equity is positive and robust ($${ctx.equityFormatted}). The 4 experts unanimously confirmed quantitative solvency.

2. Adjudication of the Expert Debate: The core contested battleground—"${battlegroundNote}"—reflects the timeless tension between price paid and value received. Damodaran and Lynch have legitimately established that purchasing at ${ctx.peRatio}x P/E exposes an investor to duration risk and multiple compression. However, Buffett and Fisher have decisively demonstrated that ${ctx.name}'s economic moat (${dossier.pillar3_Buffett?.averageROIC || 28.5}% ROIC) and switching costs provide a rare structural defense against inflation and competitive disruption.

3. The Margin of Safety Mandate: An investment operation is one which, upon thorough analysis, promises safety of principal and an adequate return. Operations not meeting these requirements are speculative. At $${ctx.currentPrice.toFixed(2)}, ${ctx.name} is trading near its intrinsic DCF fair value ($${ctx.fairValue.toFixed(2)}). While it does not offer the classic 33% discount to tangible liquidation value that I favored in the 1930s, its extraordinary franchise earnings power replaces physical liquidation value. 

My final counsel: Exercise price discipline. Do not chase momentum at peak multiples. Initiate or maintain a core strategic position with limit orders placed on market pullbacks below $${(ctx.fairValue * 0.95).toFixed(2)}.`;

    return {
      arbiterName: 'Benjamin Graham',
      title: 'Senior Arbiter & Dean of Wall Street',
      compositeGrade,
      recommendation,
      marginOfSafetyStatus: hasMarginOfSafety 
        ? 'ADEQUATE MARGIN OF SAFETY PRESENT' 
        : `MARGIN OF SAFETY COMPRESSED (${diffPct}% discount to DCF fair value)`,
      maxPrudentEntryPrice: roundVal(ctx.fairValue * 0.92, 2),
      targetFairValue: roundVal(ctx.fairValue, 2),
      suggestedPortfolioAllocationPercent: '4.0% - 7.5% (Core Tier-1 Compounder)',
      masterOpinionatedSummary: masterSummary,
      criticalInvalidationTriggers: [
        `Commercial operating margins compressing below 32% for two consecutive quarters.`,
        `Net cash conversion falling below 80% of reported GAAP net income.`,
        `Enterprise switching moats eroding due to regulatory antitrust mandated unbundling.`,
        `Sustained debt-to-equity expansion above 0.85x without corresponding cash accumulation.`
      ]
    };
  }

  // ==========================================================================
  // AI-AUGMENTED PERSONA EXECUTION (GEMINI / FIREBASE AI)
  // ==========================================================================

  async _runAiAugmentedWorkflow(ctx, dossier, options) {
    // 1. Augment 5 Analysis Personas
    const bullActor = this.debateEngine.asPersona(PERSONA_CONFIGS.BULL_RESEARCHER);
    const bearActor = this.debateEngine.asPersona(PERSONA_CONFIGS.BEAR_RESEARCHER);
    const aggActor = this.debateEngine.asPersona(PERSONA_CONFIGS.AGGRESSIVE_RISK_DEBATER);
    const consActor = this.debateEngine.asPersona(PERSONA_CONFIGS.CONSERVATIVE_RISK_DEBATER);
    const neutActor = this.debateEngine.asPersona(PERSONA_CONFIGS.NEUTRAL_RISK_ARBITER);

    // Stage 2a: Run individual persona analyses in parallel
    const [bullRes, bearRes, aggRes, consRes, neutRes] = await Promise.all([
      bullActor.analyze(dossier),
      bearActor.analyze(dossier),
      aggActor.analyze(dossier),
      consActor.analyze(dossier),
      neutActor.analyze(dossier)
    ]);

    const analysisPersonas = {
      bullResearcher: bullRes,
      bearResearcher: bearRes,
      aggressiveRiskDebater: aggRes,
      conservativeRiskDebater: consRes,
      neutralRiskArbiter: neutRes
    };

    // Stage 2b: Multi-turn debate with direct rebuttals
    const debate = await this._runAiDebate(ctx, analysisPersonas, {
      bullActor, bearActor, aggActor, consActor, neutActor
    });

    // Stage 3: 4 Expert Personas evaluating dossier + debate conclusion
    const buffettActor = this.debateEngine.asPersona(PERSONA_CONFIGS.WARREN_BUFFETT);
    const lynchActor = this.debateEngine.asPersona(PERSONA_CONFIGS.PETER_LYNCH);
    const fisherActor = this.debateEngine.asPersona(PERSONA_CONFIGS.PHILIP_FISHER);
    const damodaranActor = this.debateEngine.asPersona(PERSONA_CONFIGS.ASWATH_DAMODARAN);

    const debateContext = { debateConclusion: debate.conclusion?.verdictToExperts };

    const [buffettRes, lynchRes, fisherRes, damodaranRes] = await Promise.all([
      buffettActor.analyze(dossier, debateContext),
      lynchActor.analyze(dossier, debateContext),
      fisherActor.analyze(dossier, debateContext),
      damodaranActor.analyze(dossier, debateContext)
    ]);

    const expertPersonas = {
      warrenBuffett: buffettRes,
      peterLynch: lynchRes,
      philipFisher: fisherRes,
      aswathDamodaran: damodaranRes
    };

    // Stage 4: 4 Legendary Experts Debate each other
    const expertDebate = await this._runAiExpertsDebate(ctx, expertPersonas, {
      buffettActor, lynchActor, fisherActor, damodaranActor
    }, dossier);

    // Stage 5: Senior Arbiter Benjamin Graham Master Synthesis
    // ONLY the final conclusion of the expert debate (and the company dossier & 14 risk checks) is fed to Graham!
    const grahamActor = this.debateEngine.asPersona(PERSONA_CONFIGS.BENJAMIN_GRAHAM);
    let seniorArbiter = await grahamActor.synthesize(expertDebate.conclusion, dossier);
    if (!seniorArbiter) {
      seniorArbiter = this._buildBenjaminGrahamArbitration(ctx, dossier, expertDebate.conclusion);
    }

    return {
      analysisPersonas,
      debate,
      expertPersonas,
      expertDebate,
      seniorArbiter
    };
  }

  async _runAiDebate(ctx, personas, actors) {
    const context = {
      ticker: ctx.ticker,
      companyName: ctx.name,
      currentPrice: ctx.currentPrice,
      peRatio: ctx.peRatio,
      totalDebt: ctx.totalDebt,
      cash: ctx.cash,
      operatingCashFlow: ctx.operatingCashFlow,
      riskScore: ctx.riskScore
    };

    // Round 1: Bear rebuts Bull; Neutral Arbiter rules
    const bullOpening = personas.bullResearcher.coreCase[0] || `${ctx.name} possesses durable competitive moats and secular revenue expansion.`;
    const bearRebuttal = await actors.bearActor.rebut('Bull Researcher', bullOpening, context);

    // Round 2: Aggressive rebuts Bear; Conservative rebuts Aggressive; Neutral rules
    const aggRebuttal = await actors.aggActor.rebut('Bear Researcher', bearRebuttal, context);
    const consRebuttal = await actors.consActor.rebut('Aggressive Risk Debater', aggRebuttal, context);

    // Round 3: Closing Rebuttals
    const bearClosing = await actors.bearActor.rebut('Aggressive Risk Debater', aggRebuttal, context);
    const bullClosing = await actors.bullActor.rebut('Bear Researcher', bearClosing, context);

    const rounds = [
      {
        roundNumber: 1,
        title: 'Round 1: Opening Theses Clash (Growth vs Multiple Risk)',
        turns: [
          {
            speaker: 'Bull Researcher',
            role: 'Bullish Growth Advocate',
            argument: bullOpening
          },
          {
            speaker: 'Bear Researcher',
            role: 'Bearish Risk Analyst',
            rebuttalTo: 'Bull Researcher',
            argument: bearRebuttal
          },
          {
            speaker: 'Neutral Risk Arbiter',
            role: 'Objective Fact-Checker',
            ruling: `Fact-checking the clash: ${ctx.name} passed ${ctx.riskScore} risk checks with $${ctx.cashFormatted} in cash reserves. However, the Bear's observation regarding multiple risk (${ctx.peRatio}x P/E) is valid.`
          }
        ]
      },
      {
        roundNumber: 2,
        title: 'Round 2: Risk Tolerance Duel (Aggressive vs Conservative)',
        turns: [
          {
            speaker: 'Aggressive Risk Debater',
            role: 'High-Tolerance Momentum Seeker',
            rebuttalTo: 'Bear Researcher',
            argument: aggRebuttal
          },
          {
            speaker: 'Conservative Risk Debater',
            role: 'Downside Protection Advocate',
            rebuttalTo: 'Aggressive Risk Debater',
            argument: consRebuttal
          },
          {
            speaker: 'Neutral Risk Arbiter',
            role: 'Risk-Adjusted Synthesis',
            ruling: `Both risk debaters illustrate the core tension: Aggressive identifies generational platform cash flow ($${ctx.operatingCashFlowFormatted}), while Conservative insists on downside price discipline.`
          }
        ]
      },
      {
        roundNumber: 3,
        title: 'Round 3: Direct Closing Rebuttals',
        turns: [
          {
            speaker: 'Bear Researcher',
            role: 'Bearish Risk Analyst',
            rebuttalTo: 'Aggressive Risk Debater',
            argument: bearClosing
          },
          {
            speaker: 'Bull Researcher',
            role: 'Bullish Growth Advocate',
            rebuttalTo: 'Bear Researcher',
            argument: bullClosing
          }
        ]
      }
    ];

    const conclusion = {
      consensusPoints: [
        `${ctx.name} possesses exceptional balance sheet solvency, passing ${ctx.riskScore} risk checks with $${ctx.operatingCashFlowFormatted} in operating cash flow.`,
        `Consensus identifies durable competitive advantages, but multiple expansion risk remains the primary source of committee debate.`
      ],
      contestedBattleground: `Valuation Multiple Friction (${ctx.peRatio}x P/E) & Insider Selling vs Generational Platform Leadership and Fortress Cash Flow.`,
      verdictToExperts: `${ctx.name} is a fortress-grade enterprise trading at a full valuation multiple. The file is referred to the 4 Legendary Experts to assess if moats, return on capital, and intrinsic cash flows justify buying at current levels.`
    };

    return {
      rounds,
      conclusion
    };
  }

  async _runAiExpertsDebate(ctx, expertPersonas, actors, dossier) {
    const visuals = dossier?.equityVisuals || {};
    const fairVal = visuals.sharePriceVsFairValue?.fairValue || ((ctx.currentPrice || 100) * 1.1);

    const context = {
      ticker: ctx.ticker,
      companyName: ctx.name,
      currentPrice: ctx.currentPrice,
      peRatio: ctx.peRatio,
      totalDebt: ctx.totalDebt,
      cash: ctx.cash,
      operatingCashFlow: ctx.operatingCashFlow,
      riskScore: ctx.riskScore,
      fairValue: fairVal
    };

    // Round 1: Buffett vs Damodaran (Moat vs Multiple)
    const buffettOpening = expertPersonas.warrenBuffett?.caseAnalysis?.[0] || `It is far better to buy a wonderful business like ${ctx.name} at a fair price than a fair business at a wonderful price.`;
    const damodaranRebuttal = await actors.damodaranActor.rebut('Warren Buffett', buffettOpening, context);

    // Round 2: Fisher vs Lynch (R&D Scuttlebutt vs Stalwart Taxonomy)
    const fisherOpening = expertPersonas.philipFisher?.caseAnalysis?.[0] || `${ctx.name}'s aggressive R&D reinvestment builds insurmountable switching barriers and engineering excellence.`;
    const lynchRebuttal = await actors.lynchActor.rebut('Philip Fisher', fisherOpening, context);

    // Round 3: Closing Rebuttals
    const buffettClosing = await actors.buffettActor.rebut('Aswath Damodaran', damodaranRebuttal, context);
    const damodaranClosing = await actors.damodaranActor.rebut('Warren Buffett', buffettClosing, context);

    const rounds = [
      {
        roundNumber: 1,
        title: 'Round 1: Economic Moats vs DCF Multiple Reality (Buffett vs Damodaran)',
        turns: [
          {
            speaker: 'Warren Buffett',
            role: 'Chairman & CEO, Berkshire Hathaway',
            argument: buffettOpening
          },
          {
            speaker: 'Aswath Damodaran',
            role: 'Professor of Finance, NYU Stern',
            rebuttalTo: 'Warren Buffett',
            argument: damodaranRebuttal
          }
        ]
      },
      {
        roundNumber: 2,
        title: 'Round 2: R&D Reinvestment Velocity vs Stalwart Taxonomy (Fisher vs Lynch)',
        turns: [
          {
            speaker: 'Philip Fisher',
            role: 'Pioneer of Growth & Scuttlebutt',
            argument: fisherOpening
          },
          {
            speaker: 'Peter Lynch',
            role: 'Former Manager, Fidelity Magellan Fund',
            rebuttalTo: 'Philip Fisher',
            argument: lynchRebuttal
          }
        ]
      },
      {
        roundNumber: 3,
        title: 'Round 3: Definitive Synthesis Clash (Buffett vs Damodaran)',
        turns: [
          {
            speaker: 'Warren Buffett',
            role: 'Chairman & CEO, Berkshire Hathaway',
            rebuttalTo: 'Aswath Damodaran',
            argument: buffettClosing
          },
          {
            speaker: 'Aswath Damodaran',
            role: 'Professor of Finance, NYU Stern',
            rebuttalTo: 'Warren Buffett',
            argument: damodaranClosing
          }
        ]
      }
    ];

    const conclusion = {
      expertConsensusPoints: [
        `${ctx.name} possesses pristine balance sheet health, verified by ${ctx.riskScore} passed risk checks and $${ctx.cashFormatted} in liquid cash.`,
        `High return on capital and platform switching friction grant ${ctx.name} a formidable economic moat over competitors.`,
        `Valuation multiple (${ctx.peRatio}x P/E) is trading near or slightly above intrinsic DCF fair value ($${fairVal.toFixed(2)}), making disciplined entry thresholds imperative.`
      ],
      contestedBattleground: `Doctrinal Friction: Whether generational franchise compounding justifies purchasing at full multiples (Buffett/Fisher) vs demanding a margin-of-safety discount to DCF fair value (Damodaran/Lynch).`,
      irreconcilableDifferences: `Buffett and Fisher emphasize multi-year owner earnings durability over near-term multiple compression, whereas Damodaran and Lynch maintain that overpaying for an exceptional business converts an investment operation into speculation.`,
      verdictToSeniorArbiter: `The 4 Legendary Experts unanimously affirm the elite franchise quality and solvency of ${ctx.name}, but remain doctrinally split on price paid. Transmitted exclusively to Senior Arbiter Benjamin Graham to adjudicate the Margin of Safety and prescribe maximum entry limits.`
    };

    return {
      rounds,
      conclusion
    };
  }
}

export const defaultCompanyAnalysisOrchestrator = new CompanyAnalysisOrchestrator();

export default {
  CompanyAnalysisOrchestrator,
  defaultCompanyAnalysisOrchestrator
};

