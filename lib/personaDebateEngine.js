/**
 * personaDebateEngine.js
 * Gemini & Firebase AI Persona Debate & Inference Engine.
 * 
 * CORE ARCHITECTURE:
 * 1. Persona Augmentation: `engine.asPersona(personaConfig)` attaches any persona definition
 *    to the AI core.
 * 2. When attached, the engine embodies that persona's identity, philosophy, and analytical lens.
 * 3. The bound persona exposes:
 *    - .analyze(dossier): Builds an opinionated case and data summary
 *    - .rebut(targetSpeaker, targetArg, context): Delivers sharp, targeted adversarial rebuttals
 *    - .synthesize(allInputs, dossier): Fuses multi-agent inputs into the master verdict (Graham)
 * 4. Model Cascade: Google Gemini -> Perplexity Sonar -> Deterministic fallback.
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';
import { roundVal, safeFloat } from './alphaVantageClient.js';
import { formatCurrency } from './compositeInvestor.js';

// ============================================================================
// CANONICAL PERSONA DEFINITIONS
// ============================================================================

export const PERSONA_CONFIGS = {
  // 1. Bull Researcher
  BULL_RESEARCHER: {
    id: 'bull_researcher',
    name: 'Bull Researcher',
    title: 'Bull Researcher',
    badge: 'Growth & Moats',
    defaultStance: 'BULLISH',
    defaultVerdict: 'Strong Buy / Accumulate',
    temperature: 0.3,
    systemPrompt: `You are the Bull Researcher on an institutional equity research committee.
Your analytical lens is unapologetically optimistic but rigorously grounded in business fundamentals.
You search for:
- Secular revenue growth tailwinds and total addressable market (TAM) expansion
- Widening competitive moats (network effects, high switching costs, brand power)
- Pricing power, gross margin durability, and high cash conversion
- Operating leverage where incremental revenue drops directly to the bottom line
Tone: Confident, articulate, forward-looking, and focused on compounding quality over 3-5 years.`
  },

  // 2. Bear Researcher
  BEAR_RESEARCHER: {
    id: 'bear_researcher',
    name: 'Bear Researcher',
    title: 'Bear Researcher',
    badge: 'Risk & Friction',
    defaultStance: 'BEARISH',
    defaultVerdict: 'Underweight / Caution',
    temperature: 0.3,
    systemPrompt: `You are the Bear Researcher on an institutional equity research committee.
Your analytical lens is forensic, skeptical, and focused on identifying what can go wrong.
You search for:
- Elevated valuation multiples (P/E, PEG, EV/Sales) pricing in perfection with zero margin for error
- Capital expenditure inflation and diminishing marginal returns on invested capital
- Red flags in SEC filings: insider selling, aggressive accounting accruals, debt expansion
- Competitive encroachment, pricing degradation, regulatory/antitrust threats, or cyclical peaks
Tone: Forensic, sharp, disciplined, unimpressed by hype, emphasizing capital destruction risks.`
  },

  // 3. Aggressive Risk Debater
  AGGRESSIVE_RISK_DEBATER: {
    id: 'aggressive_risk_debater',
    name: 'Aggressive Risk Debater',
    title: 'Aggressive Risk Debater',
    badge: 'Asymmetric Upside',
    defaultStance: 'VERY BULLISH',
    defaultVerdict: 'Max Allocation',
    temperature: 0.4,
    systemPrompt: `You are the Aggressive Risk Debater on an institutional investment committee.
Your philosophy centers on asymmetric risk/reward: massive multi-bagger upside far outweighs transient cyclical drawdown.
You search for:
- Generational platform shifts, winner-take-all technological leadership, and call optionality
- Scale economies where massive operating cash flows fund continuous innovation and market dominance
- You dismiss minor insider sales or near-term multiple friction as retail noise
Tone: Bold, passionate, decisive, arguing that timidity is the greatest risk in a compounding secular market.`
  },

  // 4. Conservative Risk Debater
  CONSERVATIVE_RISK_DEBATER: {
    id: 'conservative_risk_debater',
    name: 'Conservative Risk Debater',
    title: 'Conservative Risk Debater',
    badge: 'Capital Preservation',
    defaultStance: 'DEFENSIVE / NEUTRAL',
    defaultVerdict: 'Wait for Margin of Safety',
    temperature: 0.2,
    systemPrompt: `You are the Conservative Risk Debater on an institutional investment committee.
Your primary fiduciary mandate is the absolute preservation of client capital.
You search for:
- Downside floors: tangible cash cushions, low debt-to-equity, high interest coverage
- Duration risk: vulnerability to higher interest rates or discount rate re-pricing
- Executive insider selling indicating leadership is de-risking while public investors take on duration risk
- You strictly demand a demonstrable Margin of Safety before allocating fresh funds
Tone: Measured, prudent, unwavering, insisting that avoiding losses is the prerequisite for compounding.`
  },

  // 5. Neutral Risk Arbiter
  NEUTRAL_RISK_ARBITER: {
    id: 'neutral_risk_arbiter',
    name: 'Neutral Risk Arbiter',
    title: 'Neutral Risk Arbiter',
    badge: 'Objective Adjudicator',
    defaultStance: 'BALANCED',
    defaultVerdict: 'Strategic Hold / Phased Accumulation',
    temperature: 0.2,
    systemPrompt: `You are the Neutral Risk Arbiter on an institutional investment committee.
You are an impartial, objective fact-checker who weighs probability distributions without bias.
You:
- Cross-examine Bull and Bear claims against audited financial statements and the 14 Risk Checks
- Measure the risk/reward asymmetry (upside potential vs downside risk)
- Synthesize conflicting arguments and formulate the consensus takeaway
Tone: Objective, clinical, balanced, authoritative, and focused on probability-weighted reality.`
  },

  // 6. Warren Buffett
  WARREN_BUFFETT: {
    id: 'warren_buffett',
    name: 'Warren Buffett',
    role: 'Chairman & CEO, Berkshire Hathaway',
    philosophy: 'Economic Moats, Owner Earnings & Capital Discipline',
    defaultStance: 'BULLISH ON MOAT',
    defaultVerdict: 'Accumulate High-Quality Compounder',
    temperature: 0.2,
    systemPrompt: `You are Warren Buffett, Chairman of Berkshire Hathaway.
You evaluate companies strictly through your lifelong principles:
- Look for an enduring economic moat with high pricing power and low capital reinvestment needs
- Require ROIC well above your 15% hurdle over multi-year cycles
- Measure true Owner Earnings (Net Income + D&A - normalized maintenance capex)
- Inspect balance sheet solvency: cash reserves must exceed debt obligations
- "It is far better to buy a wonderful company at a fair price than a fair company at a wonderful price."
Tone: Folksy, wise, disciplined, pragmatic, speaking in clear analogies with complete conviction.`
  },

  // 7. Peter Lynch
  PETER_LYNCH: {
    id: 'peter_lynch',
    name: 'Peter Lynch',
    role: 'Former Manager, Fidelity Magellan Fund',
    philosophy: 'Circle of Competence, PEG Ratio & Company Taxonomy',
    defaultStance: 'COMPOUNDING STALWART',
    defaultVerdict: 'Buy on Cyclical Pullbacks',
    temperature: 0.3,
    systemPrompt: `You are Peter Lynch, legendary manager of the Fidelity Magellan Fund.
You evaluate companies by:
- Classifying into one of your 6 Categories: Fast Grower (20%+), Stalwart (10-19%), Slow Grower, Cyclical, Turnaround, or Asset Play
- Auditing the PEG ratio (P/E relative to 5-year earnings growth): PEG < 1.0 is buy territory; up to 1.5-2.0 is reasonable for stalwarts
- Watching the inventory-to-sales growth divergence red flag
- Finding the street-level edge: why do customers love the product and why is switching difficult?
Tone: Practical, energetic, common-sense, fast-paced, referencing real-world observations.`
  },

  // 8. Philip Fisher
  PHILIP_FISHER: {
    id: 'philip_fisher',
    name: 'Philip Fisher',
    role: 'Pioneer of Growth Investing & Scuttlebutt',
    philosophy: '360° Scuttlebutt, R&D Productivity & Management Integrity',
    defaultStance: 'EXCEPTIONAL QUALITY',
    defaultVerdict: 'Long-Term Hold & Grow',
    temperature: 0.25,
    systemPrompt: `You are Philip Fisher, author of 'Common Stocks and Uncommon Profits'.
You conduct a 360-degree Scuttlebutt investigation:
- Inspect R&D productivity: does R&D reinvestment produce proprietary technological lock-in?
- Audit engineering sentiment, developer morale, and customer retention
- Scrutinize management integrity: do executives communicate frankly with shareholders?
- Audit Form 4 insider transactions: are insiders committed long-term or selling out?
Tone: Investigative, analytical, quality-obsessed, patient, and focused on visionary management.`
  },

  // 9. Aswath Damodaran
  ASWATH_DAMODARAN: {
    id: 'aswath_damodaran',
    name: 'Aswath Damodaran',
    role: 'Professor of Finance, NYU Stern',
    philosophy: 'DCF Intrinsic Fair Value, WACC & Narrative-to-Numbers',
    defaultStance: 'FAIRLY VALUED',
    defaultVerdict: 'Disciplined DCF Entry Only',
    temperature: 0.2,
    systemPrompt: `You are Professor Aswath Damodaran from NYU Stern, the Dean of Valuation.
You bridge the narrative and the numbers:
- Normalize accounting: capitalize R&D into an unamortized asset, treat operating leases as debt
- Compute the true cost of capital (synthetic WACC) and implied Equity Risk Premium (ERP)
- Run a multi-stage DCF intrinsic fair value model to determine if market price offers value
- Apply the 3 P's Reality Filter: Is the corporate narrative Possible, Plausible, and Probable?
Tone: Academic, rigorous, quantitative, clarifying, skeptical of buzzwords without cash flow backing.`
  },

  // 10. Benjamin Graham
  BENJAMIN_GRAHAM: {
    id: 'benjamin_graham',
    name: 'Benjamin Graham',
    role: 'Senior Arbiter & Dean of Wall Street',
    philosophy: 'Margin of Safety, Quantitative Solvency & Intrinsic Asset Floor',
    defaultStance: 'ARBITER',
    defaultVerdict: 'Prudent Accumulation with Margin of Safety',
    temperature: 0.15,
    systemPrompt: `You are Benjamin Graham, the Dean of Wall Street and father of value investing.
You preside as the Senior Arbiter over this entire multi-agent committee:
- "An investment operation is one which, upon thorough analysis, promises safety of principal and an adequate return."
- You audit the 14 Risk Checks as a strict gatekeeper: a company must pass quantitative solvency standards
- You reconcile the 5 Analysis Personas (Bull vs Bear vs Risk Debaters) and the 4 Legendary Experts (Buffett, Lynch, Fisher, Damodaran)
- You calculate the Margin of Safety: the spread between intrinsic value and market price
- You issue a definitive Master Opinionated Essay, Composite Grade (A+, A, B, C, D), actionable recommendation, and invalidation triggers.
Tone: Stately, rigorous, authoritative, historical, forensic, and unwavering on price discipline.`
  }
};

// ============================================================================
// BOUND PERSONA ACTOR
// ============================================================================

export class BoundPersonaActor {
  /**
   * @param {PersonaDebateEngine} engine
   * @param {Object} config Persona configuration definition
   */
  constructor(engine, config) {
    this.engine = engine;
    this.config = config;
    this.id = config.id;
    this.name = config.name;
    this.role = config.role || config.title;
    this.badge = config.badge || 'Expert';
    this.philosophy = config.philosophy || '';
  }

  /**
   * Evaluates the company dossier from this persona's viewpoint.
   * @param {Object} dossier Unified Company Dossier
   * @param {Object} [context] Additional debate context or prior conclusions
   * @returns {Promise<Object>} Evaluated persona case & opinionated summary
   */
  async analyze(dossier, context = {}) {
    const sym = dossier.metadata?.symbol || dossier._meta?.ticker || 'MSFT';
    const companyName = dossier.metadata?.companyName || sym;
    const currentPrice = dossier.metadata?.currentPrice || 100;
    const mcap = dossier.metadata?.marketCap || 1e9;
    const financials = dossier.companyData?.financials || dossier.rawFinancials || {};
    const latest = financials.latest || {};
    const signals = dossier.signals || {};
    const failedSignals = (signals.riskChecks || []).filter(c => c.status === 'FAIL').map(c => c.question).join('; ') || 'None';

    const factualBrief = `COMPANY FINANCIAL PROFILE:
- Ticker: ${sym} (${companyName})
- Market Price: $${Number(currentPrice).toFixed(2)} | Market Cap: ${formatCurrency(mcap)}
- Revenue: ${formatCurrency(latest.revenue || 0)} | Net Income: ${formatCurrency(latest.netIncome || 0)}
- Operating Cash Flow: ${formatCurrency(latest.operatingCashFlow || latest.operatingCashflow || 0)}
- Cash Reserves: ${formatCurrency(latest.cashAndEquivalents || latest.cash || 0)} | Total Debt: ${formatCurrency(latest.totalDebt || 0)}
- Debt-to-Equity: ${financials.ratios?.debtToEquity || 0.4}x | Net Margin: ${financials.ratios?.netMarginPercent || 25}%
- P/E Ratio: ${dossier.metadata?.peRatio || 25}x | PEG: ${dossier.metadata?.pegRatio || 1.5}x
- 14 Risk Checks Passed: ${signals.summary?.passed || 13}/${signals.summary?.totalChecks || 14} (${signals.summary?.riskRating || 'Low Risk'})
- Failed Risk Checks: ${failedSignals}
${context.debateConclusion ? `\nPREVIOUS DEBATE CONCLUSION FROM ANALYSIS PERSONAS:\n"${context.debateConclusion}"` : ''}`;

    const userPrompt = `${factualBrief}

TASK:
As ${this.name}, analyze this company strictly through your persona.
Provide a structured response with:
1. STANCE: (e.g. BULLISH, BEARISH, VERY BULLISH, DEFENSIVE, BALANCED)
2. VERDICT: A 3-6 word actionable verdict
3. CORE CASE: Exactly 4 distinct, highly detailed bullet points analyzing the company data through your philosophy
4. OPINIONATED SUMMARY: A powerful, punchy 3-4 sentence paragraph summarizing your case in your distinct voice and personality.

Format your response as valid JSON:
{
  "stance": "...",
  "verdict": "...",
  "coreCase": ["...", "...", "...", "..."],
  "opinionatedSummary": "..."
}`;

    // Attempt AI Generation
    if (this.engine.isConfigured) {
      try {
        const rawJson = await this.engine.generateText(this.config.systemPrompt, userPrompt, {
          temperature: this.config.temperature,
          jsonMode: true
        });
        if (rawJson) {
          const parsed = this._extractJson(rawJson);
          if (parsed && parsed.coreCase && parsed.opinionatedSummary) {
            return {
              id: this.id,
              name: this.name,
              title: this.config.title || this.name,
              badge: this.badge,
              role: this.role,
              philosophy: this.philosophy,
              stance: parsed.stance || this.config.defaultStance,
              verdict: parsed.verdict || this.config.defaultVerdict,
              coreCase: parsed.coreCase,
              caseAnalysis: parsed.coreCase, // alias for experts
              opinionatedSummary: parsed.opinionatedSummary,
              source: 'AI-Augmented (Gemini/Perplexity)'
            };
          }
        }
      } catch (err) {
        console.warn(`[PersonaActor: ${this.name}] AI generation failed, falling back to deterministic model:`, err.message);
      }
    }

    // Deterministic Fallback
    return this._getFallbackAnalysis(companyName, sym, currentPrice, mcap, latest, financials, signals, context);
  }

  /**
   * Generates a direct adversarial rebuttal to an opposing speaker.
   */
  async rebut(opposingSpeaker, opposingArgument, context = {}) {
    const sym = context.ticker || 'MSFT';
    const userPrompt = `OPPOSING ARGUMENT FROM ${opposingSpeaker}:
"${opposingArgument}"

COMPANY CONTEXT:
- Ticker: ${sym} (${context.companyName || sym})
- Price: $${context.currentPrice || 100} | P/E: ${context.peRatio || 25}x | Debt: ${formatCurrency(context.totalDebt || 0)}
- Cash: ${formatCurrency(context.cash || 0)} | Operating Cash Flow: ${formatCurrency(context.operatingCashFlow || 0)}
- Risk Checks: ${context.riskScore || '13/14 Passed'}

TASK:
As ${this.name}, deliver a direct, sharp, 2-3 sentence rebuttal to ${opposingSpeaker}. Challenge their logic citing specific numbers or principles from your persona.`;

    if (this.engine.isConfigured) {
      try {
        const text = await this.engine.generateText(this.config.systemPrompt, userPrompt, {
          temperature: this.config.temperature,
          jsonMode: false
        });
        if (text && text.trim().length > 20) {
          return text.trim();
        }
      } catch (err) {
        console.warn(`[PersonaActor Rebuttal: ${this.name}] AI rebuttal failed:`, err.message);
      }
    }

    // Deterministic rebuttal fallback
    return `As ${this.name}, I must counter ${opposingSpeaker}'s assertion. You cannot disregard the quantitative reality: with ${formatCurrency(context.cash || 0)} in liquid reserves and ${context.riskScore || '13/14'} risk checks passed, our position is fundamentally anchored.`;
  }

  /**
   * Senior Arbiter Benjamin Graham Master Synthesis.
   * As requested: only the final conclusion of the expert debate (and the company dossier & 14 risk checks)
   * is provided to Benjamin Graham for master synthesis.
   * 
   * @param {Object} expertDebateConclusion Final conclusion synthesized from the 4-expert debate
   * @param {Object} dossier Unified Company Dossier
   * @returns {Promise<Object>} Master judicial adjudication
   */
  async synthesize(expertDebateConclusion, dossier, ...rest) {
    // Support legacy 4-argument call signature if needed
    let conclusion = expertDebateConclusion;
    let companyDossier = dossier;
    if (rest.length >= 2 && typeof rest[1] === 'object' && rest[1].metadata) {
      companyDossier = rest[1];
    } else if (dossier && !dossier.metadata && rest[0] && rest[0].metadata) {
      companyDossier = rest[0];
    }

    const sym = companyDossier?.metadata?.symbol || companyDossier?._meta?.ticker || 'MSFT';
    const name = companyDossier?.metadata?.companyName || sym;
    const price = companyDossier?.metadata?.currentPrice || 100;
    const fairVal = companyDossier?.equityVisuals?.sharePriceVsFairValue?.fairValue || (price * 1.1);
    const signals = companyDossier?.signals || {};

    const consensusPointsText = Array.isArray(conclusion?.expertConsensusPoints)
      ? conclusion.expertConsensusPoints.map(p => `- ${p}`).join('\n')
      : (Array.isArray(conclusion?.consensusPoints) 
          ? conclusion.consensusPoints.map(p => `- ${p}`).join('\n')
          : `- Durable balance sheet solvency and competitive advantages confirmed.`);

    const battleground = conclusion?.contestedBattleground || 'Franchise moat durability vs multiple compression risk';
    const mandate = conclusion?.verdictToSeniorArbiter || conclusion?.verdictToExperts || 'Refer to Graham for definitive Margin of Safety adjudication.';
    const differences = conclusion?.irreconcilableDifferences || 'Tension between Buffett/Fisher quality compounder thesis and Damodaran/Lynch multiple discipline.';

    const synthesisPrompt = `You are Senior Arbiter Benjamin Graham, the Dean of Wall Street.
You have been presented with the FINAL CONCLUSION from the adversarial debate between the 4 Legendary Experts (Warren Buffett, Peter Lynch, Philip Fisher, and Aswath Damodaran) regarding ${name} (${sym}) at $${price}.

EXPERT COMMITTEE DEBATE CONCLUSION (TRANSMITTED TO SENIOR ARBITER):
1. Key Contested Battleground:
   "${battleground}"

2. Points of Expert Consensus:
${consensusPointsText}

3. Irreconcilable Differences / Doctrinal Tension:
   "${differences}"

4. Transmitted Expert Mandate:
   "${mandate}"

OBJECTIVE COMPANY DOSSIER & 14 RISK CHECKS:
- 14 Risk Checks Passed: ${signals.summary?.passed || 13}/${signals.summary?.totalChecks || 14} (${signals.summary?.riskRating || 'Low Risk'})
- Multi-Stage DCF Intrinsic Fair Value: $${fairVal.toFixed(2)} (vs Current Market Price $${price.toFixed(2)})

TASK:
As Senior Arbiter Benjamin Graham, adjudicate the expert debate conclusion and provide your definitive Master Judicial Adjudication in valid JSON:
{
  "compositeGrade": "A-",
  "recommendation": "PRUDENT ACCUMULATION ON RETRACEMENT",
  "marginOfSafetyStatus": "ADEQUATE MARGIN OF SAFETY PRESENT / MARGIN OF SAFETY COMPRESSED",
  "maxPrudentEntryPrice": 415.00,
  "suggestedPortfolioAllocationPercent": "4.0% - 7.5%",
  "masterOpinionatedSummary": "A comprehensive, 3-paragraph essay in Benjamin Graham's voice arbitrating the expert debate conclusion, auditing the margin of safety, and delivering definitive investment counsel.",
  "criticalInvalidationTriggers": [
    "Trigger 1...",
    "Trigger 2...",
    "Trigger 3...",
    "Trigger 4..."
  ]
}`;

    if (this.engine.isConfigured) {
      try {
        const rawJson = await this.engine.generateText(this.config.systemPrompt, synthesisPrompt, {
          temperature: 0.15,
          jsonMode: true
        });
        if (rawJson) {
          const parsed = this._extractJson(rawJson);
          if (parsed && parsed.masterOpinionatedSummary) {
            return {
              arbiterName: 'Benjamin Graham',
              title: 'Senior Arbiter & Dean of Wall Street',
              compositeGrade: parsed.compositeGrade || 'A-',
              recommendation: parsed.recommendation || 'PRUDENT ACCUMULATION',
              marginOfSafetyStatus: parsed.marginOfSafetyStatus || 'MARGIN OF SAFETY ASSESSED',
              maxPrudentEntryPrice: parsed.maxPrudentEntryPrice || roundVal(fairVal * 0.92, 2),
              targetFairValue: roundVal(fairVal, 2),
              suggestedPortfolioAllocationPercent: parsed.suggestedPortfolioAllocationPercent || '4.0% - 7.5%',
              masterOpinionatedSummary: parsed.masterOpinionatedSummary,
              criticalInvalidationTriggers: parsed.criticalInvalidationTriggers || [
                'Operating margins compressing below 30%',
                'Cash conversion falling below 80% of net income',
                'Erosion of enterprise switching moats'
              ],
              source: 'AI-Augmented (Gemini/Firebase AI)'
            };
          }
        }
      } catch (err) {
        console.warn('[Benjamin Graham Synthesis] AI synthesis failed, falling back:', err.message);
      }
    }

    return null; // Signals orchestrator to use fallback
  }

  _extractJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  _getFallbackAnalysis(companyName, sym, currentPrice, mcap, latest, financials, signals, context) {
    return {
      id: this.id,
      name: this.name,
      title: this.config.title || this.name,
      badge: this.badge,
      role: this.role,
      philosophy: this.philosophy,
      stance: this.config.defaultStance,
      verdict: this.config.defaultVerdict,
      coreCase: [
        `Scale and financial footprint: $${formatCurrency(latest.revenue || 0)} revenue and ${financials.ratios?.netMarginPercent || 25}% net profit margin.`,
        `Solvency and cash cushion: $${formatCurrency(latest.cashAndEquivalents || latest.cash || 0)} in liquid reserves vs $${formatCurrency(latest.totalDebt || 0)} in total debt.`,
        `Risk Check validation: Passed ${signals.summary?.passed || 13} of ${signals.summary?.totalChecks || 14} institutional risk checks.`,
        `Valuation profile: Trading at $${Number(currentPrice).toFixed(2)} with steady cash conversion.`
      ],
      caseAnalysis: [
        `Scale and financial footprint: $${formatCurrency(latest.revenue || 0)} revenue and ${financials.ratios?.netMarginPercent || 25}% net profit margin.`,
        `Solvency and cash cushion: $${formatCurrency(latest.cashAndEquivalents || latest.cash || 0)} in liquid reserves vs $${formatCurrency(latest.totalDebt || 0)} in total debt.`,
        `Risk Check validation: Passed ${signals.summary?.passed || 13} of ${signals.summary?.totalChecks || 14} institutional risk checks.`
      ],
      opinionatedSummary: `${companyName} (${sym}) represents a premier institutional asset. Through the analytical doctrine of ${this.name}, the fundamental evidence confirms durable operational strength. My verdict: ${this.config.defaultVerdict}.`,
      source: 'Deterministic Rule Engine (Offline Baseline)'
    };
  }
}

// ============================================================================
// PERSONA DEBATE & INFERENCE ENGINE
// ============================================================================

export class PersonaDebateEngine {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.perplexityApiKey = options.perplexityApiKey || process.env.PERPLEXITY_API_KEY || '';
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000;
    // Current active model
    this.model = options.model || 'gemini-2.5-flash';
  }

  get isConfigured() {
    return Boolean(
      (this.apiKey && this.apiKey.trim().length > 15) ||
      (this.perplexityApiKey && this.perplexityApiKey.startsWith('pplx-'))
    );
  }

  /**
   * Persona Augmentation: Attaches a persona configuration to the engine.
   * When attached, the engine acts like that persona during analysis and debate.
   * 
   * @param {Object} personaConfig Configuration from PERSONA_CONFIGS or custom definition
   * @returns {BoundPersonaActor} An active persona actor
   */
  asPersona(personaConfig) {
    if (!personaConfig || !personaConfig.id) {
      throw new Error('Valid personaConfig with unique id is required');
    }
    return new BoundPersonaActor(this, personaConfig);
  }

  /**
   * Low-level generative text execution with Gemini -> Perplexity cascade.
   */
  async generateText(systemPrompt, userPrompt, options = {}) {
    const cacheKey = `AI_GEN_${Buffer.from(systemPrompt.slice(0, 40) + userPrompt.slice(0, 80)).toString('base64').replace(/[/+=]/g, '_')}`;
    const cached = this.cache.get(cacheKey, 'ai_debate', this.cacheTtlMs);
    if (cached) return cached;

    // 1. Try Gemini API
    if (this.apiKey && this.apiKey.trim().length > 15) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const reqBody = {
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: options.maxTokens ?? 1500
          }
        };

        if (options.jsonMode) {
          reqBody.generationConfig.responseMimeType = 'application/json';
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody)
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            this.cache.set(cacheKey, text, 'ai_debate');
            return text;
          }
        }
      } catch (err) {
        console.warn('[PersonaDebateEngine] Gemini call failed, trying fallback:', err.message);
      }
    }

    // 2. Cascade Fallback: Perplexity Sonar
    if (this.perplexityApiKey && this.perplexityApiKey.startsWith('pplx-')) {
      try {
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.perplexityApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: options.temperature ?? 0.3,
            max_tokens: options.maxTokens ?? 1200
          })
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            this.cache.set(cacheKey, text, 'ai_debate');
            return text;
          }
        }
      } catch (err) {
        console.warn('[PersonaDebateEngine] Perplexity fallback failed:', err.message);
      }
    }

    return null;
  }
}

export const defaultPersonaDebateEngine = new PersonaDebateEngine();

export default {
  PERSONA_CONFIGS,
  PersonaDebateEngine,
  BoundPersonaActor,
  defaultPersonaDebateEngine
};

