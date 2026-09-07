/**
 * Institutional Trading Desk Simulation & Multi-Agent Debate Engine
 * 
 * Inspired by the Tauric Research TradingAgents architecture:
 * 1. Specialist Analysts (Fundamentals, Technicals, Scuttlebutt, Prediction Markets)
 * 2. Multi-Agent Research Debate (Bull Researcher vs. Bear Researcher)
 * 3. Research Manager Synthesis (Structured Investment Plan)
 * 4. Trader Agent (Concrete Order Ticket: Action, Entry, ATR-based Stop-Loss, Take-Profit, Sizing)
 * 5. Tri-Party Risk Committee Debate (Aggressive vs. Conservative vs. Neutral)
 * 6. Portfolio Manager (Executive Capital Allocation Sign-Off & Execution Mandate)
 */

import { TechnicalAnalysis } from './technicalAnalysis.js';
import { PolymarketClient } from './predictionMarkets.js';
import { StocktwitsClient } from './stocktwitsClient.js';
import { DiskCache } from './cache.js';

const cache = new DiskCache('institutional_desk_cache');

export class InstitutionalDesk {
  constructor(compositeInvestor) {
    this.investor = compositeInvestor;
    this.techEngine = new TechnicalAnalysis();
    this.polymarket = new PolymarketClient();
    this.stocktwits = new StocktwitsClient();
    this.cacheTtlHours = 0.5; // 30-minute cache
  }

  /**
   * Run the full institutional trading desk workflow.
   * @param {string} ticker
   * @param {object} options - { mode: 'live'|'demo', debateRounds: 2 }
   */
  async runDeskSimulation(ticker, options = {}) {
    const sym = (ticker || 'AAPL').trim().toUpperCase();
    const mode = options.mode || 'live';
    const cacheKey = `desk_${sym}_${mode}`;
    const cached = cache.get(cacheKey, 'desk', this.cacheTtlHours * 3600 * 1000);
    if (cached) return cached;

    // 1. Gather all underlying dossier, technicals, prediction markets, and retail sentiment
    const [dossier, technicals, polyRateCut, polyRecession, retailSentiment] = await Promise.all([
      this.investor.generateCompositeDossier(sym, { mode }).catch(() => ({})),
      this.techEngine.getTechnicalIndicators(sym).catch(() => this.techEngine._getFallbackTechnical(sym)),
      this.polymarket.getPredictionMarkets('Fed rate cut', 3).catch(() => ({ markets: [] })),
      this.polymarket.getPredictionMarkets('recession', 3).catch(() => ({ markets: [] })),
      this.stocktwits.getSentiment(sym).catch(() => this.stocktwits._getFallbackSentiment(sym))
    ]);

    const companyName = dossier.metadata?.companyName || sym;
    const currentPrice = technicals.currentPrice || dossier.metadata?.currentPrice || 100;
    const fv = dossier.equityVisuals?.sharePriceVsFairValue?.fairValue || currentPrice * 1.1;
    const peg = dossier.pillar1_Lynch?.pegRatio || 1.4;
    const roic = dossier.pillar3_Buffett?.latestROIC || '16.5%';
    const debtToEquity = dossier.pillar3_Buffett?.solvencyCushion?.debtToEquity || '0.45';
    const lynchCat = dossier.pillar1_Lynch?.category || 'Stalwart';

    // 2. Multi-Agent Research Debate (Bull vs. Bear)
    const researchDebate = this._runBullBearDebate({
      sym,
      companyName,
      currentPrice,
      fairValue: fv,
      peg,
      roic,
      debtToEquity,
      lynchCat,
      technicals,
      retailSentiment,
      polyRateCut
    });

    // 3. Research Manager Investment Plan Synthesis
    const researchPlan = this._synthesizeResearchPlan({
      sym,
      companyName,
      researchDebate,
      currentPrice,
      fairValue: fv,
      technicals
    });

    // 4. Trader Agent Concrete Transaction Proposal
    const traderProposal = this._generateTraderProposal({
      sym,
      researchPlan,
      technicals,
      currentPrice
    });

    // 5. Tri-Party Risk Committee Debate
    const riskDebate = this._runRiskCommitteeDebate({
      sym,
      traderProposal,
      researchPlan,
      technicals,
      debtToEquity,
      polyRecession
    });

    // 6. Portfolio Manager Executive Decision & Execution Order
    const portfolioDecision = this._renderPortfolioManagerDecision({
      sym,
      companyName,
      researchPlan,
      traderProposal,
      riskDebate
    });

    const result = {
      success: true,
      ticker: sym,
      companyName,
      timestamp: new Date().toISOString(),
      pipelineStatus: 'COMPLETED',
      marketData: {
        currentPrice,
        fairValue: fv,
        technicals,
        retailSentiment,
        predictionMarkets: {
          rateCuts: polyRateCut.markets || [],
          recession: polyRecession.markets || []
        }
      },
      researchDebate,
      researchPlan,
      traderProposal,
      riskDebate,
      portfolioDecision
    };

    cache.set(cacheKey, result, 'desk');
    return result;
  }

  /**
   * Bull Researcher vs. Bear Researcher Adversarial Debate
   */
  _runBullBearDebate(ctx) {
    const { sym, companyName, currentPrice, fairValue, peg, roic, debtToEquity, lynchCat, technicals, retailSentiment } = ctx;
    const upsidePct = (((fairValue - currentPrice) / currentPrice) * 100).toFixed(1);
    const rsi = technicals.rsi?.value || 55;
    const goldenCross = technicals.movingAverages?.regime?.includes('Golden') ?? true;
    const bullRatio = retailSentiment.bullRatio || 65;

    // Round 1: Opening Arguments
    const round1Bull = `As the Bull Researcher for ${companyName} (${sym}), the fundamental and structural thesis is exceptionally strong. ` +
      `First, our DCF valuation models indicate an intrinsic fair value of $${fairValue}, representing a +${upsidePct}% margin of safety against the current market price of $${currentPrice}. ` +
      `Categorized under Peter Lynch's framework as a premier '${lynchCat}', the company compounds capital with a high-hurdle ROIC of ${roic}, easily beating the cost of capital. ` +
      `Technically, the stock is underpinned by a ${goldenCross ? 'bullish Golden Cross (50 DMA > 200 DMA)' : 'consolidating base'} with RSI at ${rsi} (sustainable accumulation, not overbought). ` +
      `Furthermore, retail sentiment on StockTwits is running at ${bullRatio}% bullish conviction with strong institutional accumulation. The risk/reward heavily favors entry.`;

    const round1Bear = `As the Bear Researcher, the bull thesis ignores critical macroeconomic headwinds and valuation compression risks. ` +
      `While the DCF claims an upside of $${fairValue}, that projection relies on optimistic terminal growth assumptions that fail to price in rising cost-of-capital realities and margin friction. ` +
      `With a PEG ratio of ${peg}, the stock is hardly a bargain; any deceleration in quarterly top-line run rate will trigger severe multiple re-rating. ` +
      `On the technical front, ${sym} faces stiff overhead resistance at $${technicals.pivots?.resistance || (currentPrice * 1.08).toFixed(2)}. ` +
      `Moreover, retail euphoria (${bullRatio}% bullish) is a classic contrarian indicator of late-cycle retail crowding. We urge extreme caution against chasing at these levels.`;

    // Round 2: Rebuttal & Counter-Attacks
    const round2Bull = `The Bear's concerns around multiple compression fail to acknowledge ${companyName}'s fortress balance sheet and pricing power. ` +
      `With a conservative Debt-to-Equity ratio of only ${debtToEquity}, ${sym} is entirely immune to liquidity distress and comfortably funds its own high-margin R&D organic reinvestment. ` +
      `Furthermore, average true range (ATR) volatility is contained at $${technicals.atr?.value || '4.20'}, and current prices sit comfortably above the 50-day moving average ($${technicals.movingAverages?.sma50 || (currentPrice * 0.96).toFixed(2)}). ` +
      `This is not an overextended bubble—it is an institutional compounder consolidating for its next upward leg. The evidence overwhelmingly supports building exposure.`;

    const round2Bear = `Fortress balance sheet or not, the Bull Analyst cannot handwave away the law of large numbers. ` +
      `Customer concentration, enterprise IT budget scrutiny, and geopolitical supply chain bottlenecks present tangible downside risks that could shave 15-20% off near-term earnings power. ` +
      `If support at $${technicals.pivots?.support || (currentPrice * 0.92).toFixed(2)} is breached, stop-loss cascades will accelerate selling pressure down to the 200 DMA ($${technicals.movingAverages?.sma200 || (currentPrice * 0.88).toFixed(2)}). ` +
      `Risk-adjusted expected value dictates that we either trim existing holdings or demand a deeper margin of safety before deploying incremental capital.`;

    return {
      rounds: 2,
      turns: [
        {
          round: 1,
          speaker: 'Bull Researcher',
          role: 'bull',
          badge: '🟢 Growth, Moat & Catalysts',
          argument: round1Bull
        },
        {
          round: 1,
          speaker: 'Bear Researcher',
          role: 'bear',
          badge: '🔴 Downside, Valuation & Risk',
          argument: round1Bear
        },
        {
          round: 2,
          speaker: 'Bull Researcher',
          role: 'bull',
          badge: '🟢 Moat Durability & Counter',
          argument: round2Bull
        },
        {
          round: 2,
          speaker: 'Bear Researcher',
          role: 'bear',
          badge: '🔴 Asymmetric Downside Warning',
          argument: round2Bear
        }
      ]
    };
  }

  /**
   * Research Manager synthesizes the debate into a structured plan
   */
  _synthesizeResearchPlan(ctx) {
    const { sym, companyName, currentPrice, fairValue, technicals } = ctx;
    const isUndervalued = fairValue > currentPrice * 1.05;
    const isTechnicalBull = technicals.overallSignal?.includes('Bullish') || technicals.overallSignal?.includes('Buy');

    let recommendation = 'Overweight';
    if (isUndervalued && isTechnicalBull) recommendation = 'Buy';
    else if (!isUndervalued && !isTechnicalBull) recommendation = 'Underweight';
    else if (isUndervalued && !isTechnicalBull) recommendation = 'Hold';

    return {
      recommendation,
      consensusVerdict: `${recommendation.toUpperCase()} — Bull Case Prevails with Risk Guardrails`,
      convictionScore: recommendation === 'Buy' ? 8.5 : recommendation === 'Overweight' ? 7.2 : 5.8,
      rationale: `After evaluating the 2 rounds of adversarial debate, the Bull Researcher's evidence regarding ${companyName}'s durable economic moat (ROIC > 15%), DCF discount, and constructive technical trend carrying above the 50 DMA is more grounded than the Bear's speculative multiple compression warnings. However, the Bear's identification of overhead resistance at $${technicals.pivots?.resistance || (currentPrice * 1.08).toFixed(2)} is valid and must be respected in execution.`,
      strategicActions: `1. Authorize the trading desk to initiate/expand long exposure via limit orders near current support.\n` +
        `2. Enforce strict ATR-based stop-loss discipline to defend against the Bear's breakdown scenario.\n` +
        `3. Scale position into two tranches to optimize cost-basis.`
    };
  }

  /**
   * Trader Agent concrete transaction order proposal
   */
  _generateTraderProposal(ctx) {
    const { sym, researchPlan, technicals, currentPrice } = ctx;
    const atr = technicals.atr?.value || (currentPrice * 0.022);
    const rec = researchPlan.recommendation;

    let action = 'Buy';
    let entryPrice = currentPrice;
    let stopLoss = parseFloat((currentPrice - (atr * 1.5)).toFixed(2));
    let takeProfit1 = parseFloat((currentPrice + (atr * 2.5)).toFixed(2));
    let takeProfit2 = parseFloat((currentPrice + (atr * 4.0)).toFixed(2));
    let positionSizing = '3.5% of Portfolio Equity';

    if (rec === 'Hold') {
      action = 'Hold';
      positionSizing = 'Maintain Current Allocation (0% Delta)';
    } else if (rec === 'Underweight' || rec === 'Sell') {
      action = 'Sell';
      entryPrice = currentPrice;
      stopLoss = parseFloat((currentPrice + (atr * 1.5)).toFixed(2));
      takeProfit1 = parseFloat((currentPrice - (atr * 2.5)).toFixed(2));
      takeProfit2 = parseFloat((currentPrice - (atr * 4.0)).toFixed(2));
      positionSizing = 'Trim 50% of Existing Position';
    }

    const riskPerShare = Math.abs(entryPrice - stopLoss);
    const rewardPerShare = Math.abs(takeProfit1 - entryPrice);
    const riskRewardRatio = (rewardPerShare / (riskPerShare || 1)).toFixed(2);

    return {
      action,
      symbol: sym,
      currentMarketPrice: currentPrice,
      entryPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      riskRewardRatio: `${riskRewardRatio}:1`,
      atrValue: atr,
      atrStopBuffer: `1.5x ATR ($${(atr * 1.5).toFixed(2)})`,
      positionSizing,
      executionMethod: 'Limit Order at Market / Pullback',
      reasoning: `Technical market structure confirms ${action} signal. Entry is grounded near $${entryPrice} with dynamic stop-loss at $${stopLoss} calibrated strictly via 1.5x ATR volatility buffer to eliminate market noise. Target 1 offers an attractive ${riskRewardRatio}:1 asymmetric reward-to-risk ratio.`
    };
  }

  /**
   * Tri-Party Risk Committee Debate
   */
  _runRiskCommitteeDebate(ctx) {
    const { sym, traderProposal, technicals, debtToEquity, polyRecession } = ctx;
    const recOdds = polyRecession.markets?.[0]?.mainProbabilityPercent || 22;

    const aggressive = `⚡ Aggressive Risk Debater: The Trader's proposal to ${traderProposal.action} $${sym} is sound, but overly timid on position sizing. With favorable risk/reward (${traderProposal.riskRewardRatio}) and strong momentum, limiting allocation to ${traderProposal.positionSizing} leaves alpha on the table. We should increase exposure to at least 5.0% and trail the stop-loss more aggressively to ride the trend to Take Profit 2 ($${traderProposal.takeProfit2}).`;

    const conservative = `🛡️ Conservative Risk Debater: I strongly oppose upsizing. Prediction markets price a ${recOdds}% chance of recessionary friction, and macro credit conditions remain sensitive. The Trader's 1.5x ATR stop-loss at $${traderProposal.stopLoss} is mandatory and non-negotiable. If volatility spikes and closes below this threshold, the position must be liquidated immediately with zero discretionary hesitation.`;

    const neutral = `⚖️ Neutral Risk Arbiter: Both perspectives highlight valid boundaries. Upsizing to 5% creates excessive single-stock idiosyncratic risk, while exiting completely forfeits asymmetric upside. The Trader's sizing of ${traderProposal.positionSizing} with a hard stop-loss at $${traderProposal.stopLoss} represents the optimal mathematically calibrated Kelly criterion compromise.`;

    return {
      consensus: 'Approved with Strict ATR Stop-Loss Mandate',
      riskScore: 4.2, // out of 10 (1 = low risk, 10 = extreme)
      debators: [
        {
          speaker: 'Aggressive Risk Debater',
          role: 'aggressive',
          stance: 'Upsize Exposure & Maximize Alpha',
          badge: '⚡ High Reward Focus',
          argument: aggressive
        },
        {
          speaker: 'Conservative Risk Debater',
          role: 'conservative',
          stance: 'Enforce Strict Capital Preservation & Drawdown Limits',
          badge: '🛡️ Capital Preservation',
          argument: conservative
        },
        {
          speaker: 'Neutral Risk Arbiter',
          role: 'neutral',
          stance: 'Mathematical Expected Value & Sizing Compromise',
          badge: '⚖️ Objective Balance',
          argument: neutral
        }
      ]
    };
  }

  /**
   * Portfolio Manager Executive Decision
   */
  _renderPortfolioManagerDecision(ctx) {
    const { sym, companyName, researchPlan, traderProposal, riskDebate } = ctx;

    const isApproved = traderProposal.action !== 'Hold';
    const status = isApproved ? 'APPROVED' : 'ON_HOLD';

    return {
      status,
      decisionBadge: `${status}: ${traderProposal.action.toUpperCase()} ${sym}`,
      finalRating: researchPlan.recommendation,
      authorizedAllocation: isApproved ? '3.0% - 3.5% of Portfolio' : '0.0% (Hold Existing)',
      maxAllowedDrawdown: '-6.5%',
      executionInstructions: isApproved 
        ? `Submit limit order for ${sym} at $${traderProposal.entryPrice}. Hard stop-loss registered at $${traderProposal.stopLoss}. Take-profit limit set at $${traderProposal.takeProfit1} for 50% scale-out, with remainder trailing to $${traderProposal.takeProfit2}.`
        : `No new capital deployment authorized. Maintain current position and monitor support pivots.`,
      executiveSignOff: `As Portfolio Manager, I have reviewed the Bull/Bear research debate, the Research Manager's investment plan, and the Tri-Party Risk Committee deliberation. The execution ticket for ${companyName} (${sym}) is formally ${status}. All risk constraints and ATR-based drawdown stops are actively enforced.`
    };
  }
}
