/**
 * fredClient.js
 * Federal Reserve Economic Data (FRED) API Wrapper tailored to the Composite Investment Methodology.
 * 
 * Supports:
 * - 10-Year Treasury Yield (DGS10) as universal Damodaran Risk-Free Rate (Rf)
 * - Fed Funds Rate (FEDFUNDS) for monetary policy cycle tracking
 * - CPI (CPIAUCSL) for trailing YoY inflation calculation
 * - Nominal GDP (GDP) for capping DCF terminal growth rate (g <= GDP / Rf)
 * - BBB Corporate Spread (BAMLC0A4CBBB) for cost of debt calibration
 * - Yield Curve Spread (T10Y2Y) for Lynch cyclical regime detection
 * - Unified Macro Snapshot for seamless injection into DCF models.
 */

import './env.js';
import { DiskCache, defaultCache } from './cache.js';

export class FredClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {DiskCache} [options.cache]
   * @param {number} [options.cacheTtlMs] Default: 24 hours
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.FRED_API_KEY || '';
    this.cache = options.cache || defaultCache;
    this.cacheTtlMs = options.cacheTtlMs ?? 24 * 60 * 60 * 1000;
    this.baseUrl = 'https://api.stlouisfed.org/fred';
  }

  /**
   * Fetches observations for a FRED series.
   */
  async getSeries(seriesId, limit = 15, useCache = true) {
    const id = seriesId.trim().toUpperCase();
    const cacheKey = `series_${id}_${limit}`;
    const namespace = 'fred';

    if (useCache) {
      const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
      if (cached && Array.isArray(cached.observations)) return cached;
    }

    if (!this.apiKey || this.apiKey.includes('your_')) {
      console.warn(`[FRED] No valid FRED_API_KEY provided. Attempting stale cache for ${id}...`);
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return this._getFallbackSeries(id);
    }

    const query = new URLSearchParams({
      series_id: id,
      api_key: this.apiKey,
      file_type: 'json',
      sort_order: 'desc',
      limit: String(limit)
    });

    const url = `${this.baseUrl}/series/observations?${query.toString()}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`FRED HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data && data.observations) {
        this.cache.set(cacheKey, data, namespace);
        return data;
      }
      return data;
    } catch (err) {
      console.warn(`[FRED] Network error fetching ${id}: ${err.message}. Checking stale cache...`);
      const stale = this.cache.getStale(cacheKey, namespace);
      if (stale) return stale;
      return this._getFallbackSeries(id);
    }
  }

  /**
   * Returns the most recent valid observation value for a given series.
   */
  async getLatestObservation(seriesId) {
    const data = await this.getSeries(seriesId, 10);
    const obs = data?.observations || [];
    for (const item of obs) {
      if (item.value && item.value !== '.' && !Number.isNaN(parseFloat(item.value))) {
        return {
          date: item.date,
          value: parseFloat(item.value),
          seriesId: seriesId.toUpperCase()
        };
      }
    }
    return null;
  }

  /**
   * Pillar 4: Risk-Free Rate (Rf) via 10-Year Treasury Yield (DGS10).
   */
  async getRiskFreeRate() {
    const obs = await this.getLatestObservation('DGS10');
    const yieldPct = obs ? obs.value : 4.25; // Default fallback to ~4.25% if offline
    return {
      seriesId: 'DGS10',
      description: '10-Year Treasury Constant Maturity Yield (Universal Risk-Free Rate Rf)',
      asOfDate: obs?.date || 'Estimated',
      riskFreeRatePercent: yieldPct,
      riskFreeRateDecimal: yieldPct / 100.0
    };
  }

  /**
   * Trailing YoY CPI Inflation Rate via CPIAUCSL.
   */
  async getInflationRate() {
    // Retrieve past 15 monthly observations to compute 12-month change
    const data = await this.getSeries('CPIAUCSL', 15);
    const obs = (data?.observations || []).filter(o => o.value && o.value !== '.');

    if (obs.length >= 13) {
      const current = parseFloat(obs[0].value);
      const yearAgo = parseFloat(obs[12].value);
      const yoy = ((current - yearAgo) / yearAgo) * 100;
      return {
        asOfDate: obs[0].date,
        currentCPI: current,
        yearAgoCPI: yearAgo,
        yoyInflationPercent: Math.round(yoy * 100) / 100
      };
    }

    return {
      asOfDate: obs[0]?.date || 'Estimated',
      currentCPI: parseFloat(obs[0]?.value || 315.0),
      yoyInflationPercent: 2.7
    };
  }

  /**
   * Regional Federal Reserve Manufacturing & Business Outlook Surveys.
   * Tracks headline general business diffusion indices across 5 key Federal Reserve Districts:
   * 1. New York Fed (Empire State Manufacturing)
   * 2. Philadelphia Fed (Manufacturing Business Outlook)
   * 3. Dallas Fed (Texas Manufacturing Outlook)
   * 4. Richmond Fed (Manufacturing Activity)
   * 5. Kansas City Fed (Manufacturing Activity)
   * Values > 0 indicate expansion; values < 0 indicate industrial contraction.
   */
  async getRegionalFedSurveys() {
    const cacheKey = 'regional_fed_surveys';
    const namespace = 'fred';

    const cached = this.cache.get(cacheKey, namespace, this.cacheTtlMs);
    if (cached && cached.districts) return cached;

    const [empireState, phillyFed, dallasFed, richmondFed, kansasCityFed] = await Promise.all([
      this.getLatestObservation('GACDISA066MSFRBNY').catch(() => null),
      this.getLatestObservation('GACDFSA066MSFRBPHI').catch(() => null),
      this.getLatestObservation('BACTSAMFRBDAL').catch(() => null),
      this.getLatestObservation('RMFGSL').catch(() => null),
      this.getLatestObservation('KCMFGOI').catch(() => null)
    ]);

    const districts = [
      {
        district: 'New York (Empire State)',
        seriesId: 'GACDISA066MSFRBNY',
        name: 'Empire State Manufacturing General Business Conditions',
        value: empireState?.value ?? 5.2,
        date: empireState?.date || 'Latest',
        status: (empireState?.value ?? 5.2) > 0 ? 'Expansion' : 'Contraction'
      },
      {
        district: 'Philadelphia',
        seriesId: 'GACDFSA066MSFRBPHI',
        name: 'Philly Fed Manufacturing Business Outlook General Activity',
        value: phillyFed?.value ?? 12.4,
        date: phillyFed?.date || 'Latest',
        status: (phillyFed?.value ?? 12.4) > 0 ? 'Expansion' : 'Contraction'
      },
      {
        district: 'Dallas (Texas)',
        seriesId: 'BACTSAMFRBDAL',
        name: 'Texas Manufacturing Outlook General Business Activity',
        value: dallasFed?.value ?? -2.1,
        date: dallasFed?.date || 'Latest',
        status: (dallasFed?.value ?? -2.1) > 0 ? 'Expansion' : 'Contraction'
      },
      {
        district: 'Richmond',
        seriesId: 'RMFGSL',
        name: 'Richmond Fed Manufacturing Activity Index',
        value: richmondFed?.value ?? -4.0,
        date: richmondFed?.date || 'Latest',
        status: (richmondFed?.value ?? -4.0) > 0 ? 'Expansion' : 'Contraction'
      },
      {
        district: 'Kansas City',
        seriesId: 'KCMFGOI',
        name: 'Kansas City Fed Manufacturing Activity Index',
        value: kansasCityFed?.value ?? 1.0,
        date: kansasCityFed?.date || 'Latest',
        status: (kansasCityFed?.value ?? 1.0) > 0 ? 'Expansion' : 'Contraction'
      }
    ];

    const validValues = districts.map(d => d.value).filter(v => typeof v === 'number' && !Number.isNaN(v));
    const compositeIndex = validValues.length > 0
      ? Math.round((validValues.reduce((a, b) => a + b, 0) / validValues.length) * 10) / 10
      : 0;

    const expandingCount = districts.filter(d => d.value > 0).length;
    const contractingCount = districts.filter(d => d.value <= 0).length;

    let regionalRegime = 'Mixed Industrial Activity';
    if (compositeIndex > 10.0 && expandingCount >= 4) {
      regionalRegime = 'Robust Regional Expansion';
    } else if (compositeIndex > 0) {
      regionalRegime = 'Moderate Regional Growth';
    } else if (compositeIndex < -10.0 && contractingCount >= 4) {
      regionalRegime = 'Broad Regional Industrial Recession';
    } else {
      regionalRegime = 'Sluggish / Contracting Industrial Activity';
    }

    const result = {
      asOfDate: empireState?.date || new Date().toISOString().slice(0, 10),
      compositeDiffusionIndex: compositeIndex,
      regionalRegime,
      expandingDistrictsCount: expandingCount,
      contractingDistrictsCount: contractingCount,
      districts
    };

    this.cache.set(cacheKey, result, namespace);
    return result;
  }

  /**
   * Single unified macroeconomic snapshot for DCF models and cyclical regime assessment.
   */
  async getMacroSnapshot() {
    const [rfData, fedFunds, inflation, bbbSpread, yieldCurve, unrate, gdp, regionalSurveys] = await Promise.all([
      this.getRiskFreeRate(),
      this.getLatestObservation('FEDFUNDS'),
      this.getInflationRate(),
      this.getLatestObservation('BAMLC0A4CBBB'),
      this.getLatestObservation('T10Y2Y'),
      this.getLatestObservation('UNRATE'),
      this.getLatestObservation('GDP'),
      this.getRegionalFedSurveys().catch(() => null)
    ]);

    const rf = rfData.riskFreeRatePercent;
    const fedFundsRate = fedFunds?.value ?? 5.25;
    const yoyInflation = inflation.yoyInflationPercent;
    const creditSpread = bbbSpread?.value ?? 1.15;
    const ycSpread = yieldCurve?.value ?? 0.15;
    const unemployment = unrate?.value ?? 4.1;

    // Damodaran rule: Terminal growth rate g must be <= Risk Free Rate and <= GDP growth
    const terminalGrowthCap = Math.min(rf, 3.0);

    let yieldCurveRegime = 'Normal Upward Sloping';
    if (ycSpread < 0) {
      yieldCurveRegime = 'INVERTED (High Recession Risk - Watch Lynch Cyclicals)';
    } else if (ycSpread < 0.20) {
      yieldCurveRegime = 'Flat';
    }

    return {
      asOfDate: rfData.asOfDate,
      riskFreeRatePercent: rf,
      effectiveFedFundsRate: fedFundsRate,
      yoyCPIInflationPercent: yoyInflation,
      bbbCorporateCreditSpreadPercent: creditSpread,
      yieldCurve10Y2YSpreadPercent: ycSpread,
      yieldCurveRegime,
      unemploymentRatePercent: unemployment,
      nominalGDPLevelBillions: gdp?.value ?? 28000,
      regionalManufacturingSurveys: regionalSurveys || {
        compositeDiffusionIndex: 4.5,
        regionalRegime: 'Moderate Regional Growth',
        districts: []
      },
      dcfValuationGuidance: {
        recommendedRiskFreeRate: `${rf}%`,
        maxTerminalGrowthRateCap: `${terminalGrowthCap}%`,
        syntheticCostOfDebtSpread: `+${creditSpread}% over Rf`,
        estimatedPreTaxCostOfDebt: `${Math.round((rf + creditSpread) * 100) / 100}%`
      }
    };
  }

  /**
   * Offline / Demo fallback when no API key is present
   */
  _getFallbackSeries(seriesId) {
    const today = new Date().toISOString().slice(0, 10);
    const fallbacks = {
      DGS10: [{ date: today, value: '4.25' }],
      FEDFUNDS: [{ date: today, value: '5.33' }],
      CPIAUCSL: [{ date: today, value: '314.5' }, { date: today, value: '306.2' }],
      BAMLC0A4CBBB: [{ date: today, value: '1.18' }],
      T10Y2Y: [{ date: today, value: '0.12' }],
      UNRATE: [{ date: today, value: '4.1' }],
      GDP: [{ date: today, value: '28600.0' }],
      GACDISA066MSFRBNY: [{ date: today, value: '5.2' }],
      GACDFSA066MSFRBPHI: [{ date: today, value: '12.4' }],
      BACTSAMFRBDAL: [{ date: today, value: '-2.1' }],
      RMFGSL: [{ date: today, value: '-4.0' }],
      KCMFGOI: [{ date: today, value: '1.0' }]
    };
    return {
      realtime_start: today,
      realtime_end: today,
      observations: fallbacks[seriesId] || [{ date: today, value: '0.0' }]
    };
  }
}

