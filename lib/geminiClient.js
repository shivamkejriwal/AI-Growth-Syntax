/**
 * geminiClient.js
 * Google Gemini AI Institutional Synthesis Engine.
 * 
 * Uses process.env.GEMINI_API_KEY or process.env.GOOGLE_API_KEY
 * to critique valuation assumptions, generate executive summaries,
 * and synthesize the 4-Pillar Composite Investment Decision Memorandum.
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';

export class GeminiClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {DiskCache} [options.cache]
   * @param {number} [options.cacheTtlMs]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 7 * 24 * 60 * 60 * 1000;
    this.model = 'gemini-3.6-flash';
  }

  get isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 15);
  }

  /**
   * Generates deep executive synthesis for an investment dossier.
   * @param {Object} dossier
   */
  async generateExecutiveSynthesis(dossier) {
    const sym = dossier.metadata?.symbol || 'UNKNOWN';
    const cacheKey = `GEMINI_SYNTHESIS_${sym}`;
    const namespace = 'gemini';

    const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
    if (cached) return cached;

    if (!this.isConfigured) {
      return this._getFallbackSynthesis(dossier);
    }

    const prompt = `You are the Chief Investment Officer applying the Composite Investment Methodology (Peter Lynch, Philip Fisher, Warren Buffett, and Aswath Damodaran).
Review this synthesized financial data for ${dossier.metadata?.companyName} (${sym}):
- Peter Lynch Category: ${dossier.pillar1_Lynch?.category}, PEG: ${dossier.pillar1_Lynch?.pegRatio}, Net Cash/Share: $${dossier.pillar1_Lynch?.netCashPerShare}
- Warren Buffett Owner Earnings: $${(dossier.pillar3_Buffett?.ownerEarningsAnalysis?.buffettOwnerEarnings / 1e9).toFixed(2)}B, Value per $1 Retained: $${dossier.pillar3_Buffett?.retainedEarningsTest?.valueCreatedPerDollarRetained}
- Aswath Damodaran Implied ERP: ${dossier.pillar4_Damodaran?.impliedERPPercent}%, Sector WACC: ${dossier.pillar4_Damodaran?.sectorBenchmarkWACCPercent}%, Synthetic Rating: ${dossier.pillar4_Damodaran?.syntheticCreditRating?.syntheticRating}
- Macro Risk-Free Rate: ${dossier.macroContext?.riskFreeRatePercent}%

Provide a concise 3-paragraph executive investment synthesis:
1. Economic Moat & Capital Allocation Quality (Buffett & Fisher)
2. Growth Runway & Valuation Friction (Lynch PEG vs Damodaran Cost of Capital)
3. Verdict & Critical Invalidation Risk (What would break this investment thesis?)`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
        })
      });

      if (!res.ok) {
        throw new Error(`Gemini API HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const result = {
        source: 'Google Gemini AI (Active Synthesis)',
        model: this.model,
        symbol: sym,
        synthesisText: text,
        timestamp: new Date().toISOString()
      };

      this.cache.set(cacheKey, result, namespace);
      return result;
    } catch (err) {
      // If Gemini fails (e.g. HTTP 403 service blocked), fall back to Perplexity AI if available
      if (process.env.PERPLEXITY_API_KEY && process.env.PERPLEXITY_API_KEY.startsWith('pplx-')) {
        try {
          const pplxRes = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [
                { role: 'system', content: 'You are an institutional Chief Investment Officer applying the 4-Pillar Composite Methodology.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.2
            })
          });

          if (pplxRes.ok) {
            const pplxData = await pplxRes.json();
            const pplxText = pplxData.choices?.[0]?.message?.content || '';
            if (pplxText) {
              const result = {
                source: 'Perplexity AI (CIO Executive Synthesis)',
                model: 'sonar',
                symbol: sym,
                synthesisText: pplxText,
                timestamp: new Date().toISOString()
              };
              this.cache.set(cacheKey, result, namespace);
              return result;
            }
          }
        } catch {
          // Proceed to heuristic fallback
        }
      }

      console.warn(`[AI Synthesis] Gemini API service unavailable for ${sym} (${err.message}). Using composite heuristic synthesis.`);
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return this._getFallbackSynthesis(dossier);
    }
  }

  _getFallbackSynthesis(dossier) {
    const sym = dossier.metadata?.symbol || 'Target';
    const name = dossier.metadata?.companyName || sym;
    const lynchCat = dossier.pillar1_Lynch?.category || 'Company';
    const peg = dossier.pillar1_Lynch?.pegRatio || 'N/A';
    const roic = dossier.pillar3_Buffett?.averageROIC || '15.0%';
    const wacc = dossier.pillar4_Damodaran?.sectorBenchmarkWACCPercent || '8.5%';
    const rating = dossier.pillar4_Damodaran?.syntheticCreditRating?.syntheticRating || 'A';
    const netCash = dossier.pillar1_Lynch?.netCashPerShare;

    return {
      source: 'Algorithmic Heuristic Synthesis',
      symbol: sym,
      synthesisText: `The composite analysis for ${name} (${sym}) evaluates its operating performance through the 4-Pillar framework. Under Warren Buffett and Philip Fisher's qualitative criteria, the business demonstrates average ROIC of ${roic}, reflecting its underlying economic moat and capital reinvestment efficiency across industry competitors.

Under Peter Lynch's taxonomy, ${name} is categorized as a ${lynchCat} with a PEG ratio of ${peg}. The balance sheet is supported by ${netCash && Number(netCash) > 0 ? `$${netCash} net cash per share` : 'disciplined leverage management'}, providing runway against cyclical demand swings and macro volatility.

From Aswath Damodaran's cost of capital perspective, the business operates against a benchmark sector WACC of ${wacc}% and a synthetic credit rating of ${rating}. The critical investment thesis invalidation trigger remains structural margin compression or declining returns on incremental invested capital.`,
      timestamp: new Date().toISOString()
    };
  }
}

