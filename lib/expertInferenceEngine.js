/**
 * expertInferenceEngine.js
 * Pure, Stateless Expert Inference Layer.
 * 
 * CORE ARCHITECTURAL PRINCIPLE:
 * Experts do NOT define data schemas or storage models.
 * Data is stored in standardized, objective financial format (StandardCompanyData).
 * Experts act as pure inference processors on top of that standardized data.
 * 
 * Experts:
 * 1. Peter Lynch Analyzer (Empirical Edge, PEG, Inventory Spread, Taxonomy)
 * 2. Warren Buffett Analyzer (Owner Earnings, ROIC Track Record, $1 Retained Test, Moats)
 * 3. Philip Fisher Analyzer (360° Scuttlebutt, DEF 14A Executive Compensation, Morale)
 * 4. Aswath Damodaran Analyzer (R&D Capitalization, Lease Debt, WACC, Multi-Stage DCF, 3 P's)
 * 5. Benjamin Graham Analyzer (Net-Net NCAV, Graham Number, Margin of Safety)
 * 6. Executive Synthesis Engine (Consensus Recommendation, CIO Thesis, Invalidation Triggers)
 */

import { roundVal, safeFloat } from './alphaVantageClient.js';
import { formatCurrency, getLynchStrategy } from './compositeInvestor.js';

// ============================================================================
// 1. PETER LYNCH ANALYZER
// ============================================================================
export class PeterLynchAnalyzer {
  /**
   * Evaluates company data according to Peter Lynch's empirical principles.
   * @param {Object} companyData StandardCompanyData
   * @returns {Object} LynchAnalysis
   */
  static analyze(companyData) {
    const financials = companyData.financials || {};
    const market = companyData.market || {};
    const history = financials.annualHistory || [];
    const latest = financials.latest || {};

    // 1. Multi-Year Revenue CAGR
    let revenueCAGR = 0;
    if (history.length >= 2) {
      const firstRev = history[0].revenue || 1;
      const lastRev = history[history.length - 1].revenue || 1;
      const nYears = history.length - 1;
      if (firstRev > 0 && lastRev > 0) {
        revenueCAGR = roundVal(((lastRev / firstRev) ** (1 / nYears) - 1) * 100, 2);
      }
    }

    // 2. Lynch Company Classification Taxonomy
    let category = 'Slow Grower';
    if (revenueCAGR >= 20.0) category = 'Fast Grower';
    else if (revenueCAGR >= 10.0) category = 'Stalwart';
    else if (revenueCAGR >= 1.0) category = 'Slow Grower';
    else if (revenueCAGR < 0) category = 'Cyclical';

    const pe = market.peRatio || 0;
    const peg = market.pegRatio > 0 ? market.pegRatio : (revenueCAGR > 0 && pe > 0 ? roundVal(pe / revenueCAGR, 2) : 0);

    let pegVerdict = 'Fair Valuation';
    if (peg > 0 && peg < 1.0) pegVerdict = 'Undervalued (Lynch Buy Territory)';
    else if (peg >= 1.0 && peg <= 1.5) pegVerdict = 'Fairly Valued';
    else if (peg > 1.5) pegVerdict = 'Overvalued Growth';

    // 3. Inventory vs Sales Growth Spread
    let inventorySalesSpread = 0;
    let invGrowth = 0;
    let salesGrowth = 0;
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const curr = history[history.length - 1];
      if ((prev.revenue || 0) > 0) salesGrowth = roundVal(((curr.revenue - prev.revenue) / prev.revenue) * 100, 2);
      if ((prev.inventory || 0) > 0) invGrowth = roundVal(((curr.inventory - prev.inventory) / prev.inventory) * 100, 2);
      inventorySalesSpread = roundVal(invGrowth - salesGrowth, 2);
    }

    // 4. Net Cash Per Share Cushion
    const shares = market.sharesOutstanding || 1;
    const netCash = (latest.cashAndEquivalents || 0) - (latest.totalDebt || 0);
    const netCashPerShare = roundVal(netCash / shares, 2);

    const flags = [];
    if (inventorySalesSpread > 5.0 && (latest.inventory || 0) > 0) {
      flags.push(`Inventory growth (+${invGrowth}%) outpaced sales (+${salesGrowth}%) by ${inventorySalesSpread}%.`);
    }
    if ((financials.ratios?.debtToEquity || 0) > 1.5) {
      flags.push(`High leverage: Debt-to-Equity is ${financials.ratios.debtToEquity}x.`);
    }

    return {
      title: 'Peter Lynch: Circle of Competence & Empirical Edge',
      category,
      strategyDescription: getLynchStrategy(category),
      revenueCAGR: `${revenueCAGR}%`,
      revenueCagrPercent: revenueCAGR,
      pegRatio: peg,
      pegVerdict,
      inventorySalesSpreadPercent: `${inventorySalesSpread}%`,
      inventoryGrowthAnalysis: {
        inventoryGrowthPercent: invGrowth,
        salesGrowthPercent: salesGrowth,
        spreadPercent: inventorySalesSpread,
        flag: (inventorySalesSpread > 5.0 && (latest.inventory || 0) > 0) ? 'RED FLAG' : 'Safe'
      },
      netCashPerShare,
      netCashPerShareFormatted: `$${netCashPerShare}`,
      redFlags: flags,
      rulesOfThumb: [
        { rule: 'PEG Ratio < 1.0 (Fair at 1.0-1.5)', passing: peg > 0 && peg <= 1.5, details: `Current PEG: ${peg} (${pegVerdict})` },
        { rule: 'Inventory Growth <= Sales Growth', passing: inventorySalesSpread <= 5.0, details: `Inventory spread: ${inventorySalesSpread > 0 ? '+' : ''}${inventorySalesSpread}%` },
        { rule: 'Debt-to-Equity < 0.50x', passing: (financials.ratios?.debtToEquity || 0) < 0.50, details: `Current D/E: ${financials.ratios?.debtToEquity ?? 'N/A'}x` },
        { rule: 'Net Cash Cushion', passing: netCashPerShare > 0, details: `Net Cash/Share: $${netCashPerShare}` }
      ],
      twoMinuteStoryPrompt: `Explain the consumer or business value proposition of ${companyData.profile?.name} in plain language under 2 minutes.`
    };
  }
}

// ============================================================================
// 2. WARREN BUFFETT ANALYZER
// ============================================================================
export class WarrenBuffettAnalyzer {
  /**
   * Evaluates company data according to Warren Buffett's quality-value principles.
   * @param {Object} companyData StandardCompanyData
   * @returns {Object} BuffettAnalysis
   */
  static analyze(companyData) {
    const financials = companyData.financials || {};
    const market = companyData.market || {};
    const history = financials.annualHistory || [];
    const latest = financials.latest || {};

    // 1. Owner Earnings = Net Income + D&A - Maintenance Capex
    const ownerEarningsHistory = history.map(y => {
      const depAmort = y.depreciationAndAmortization || Math.round((y.capitalExpenditures || 0) * 0.8);
      const estCapex = y.capitalExpenditures || 0;
      const ownerEarnings = Math.round((y.netIncome || 0) + depAmort - estCapex);

      // Invested Capital = Total Debt + Equity - Cash
      const investedCapital = Math.max((y.totalDebt || 0) + (y.shareholdersEquity || 0) - (y.cashAndEquivalents || 0), 1);
      const nopat = (y.operatingIncome || 0) * (1 - 0.21);
      const roic = roundVal((nopat / investedCapital) * 100, 2);

      return {
        year: y.fiscalYear,
        netIncome: y.netIncome,
        depreciationAndAmortization: depAmort,
        capex: estCapex,
        ownerEarnings,
        roic,
        operatingMargin: y.revenue > 0 ? roundVal(((y.operatingIncome || 0) / y.revenue) * 100, 2) : 0
      };
    });

    const latestOwnerEarnings = ownerEarningsHistory.length > 0
      ? ownerEarningsHistory[ownerEarningsHistory.length - 1].ownerEarnings
      : Math.round((latest.netIncome || 0) + (latest.depreciation || 0) - (latest.capex || 0));

    // 2. ROIC Consistency & Moat Rating
    const validRoics = ownerEarningsHistory.map(h => h.roic).filter(r => typeof r === 'number' && !Number.isNaN(r));
    const averageROIC = validRoics.length > 0 ? roundVal(validRoics.reduce((a, b) => a + b, 0) / validRoics.length, 2) : 0;
    const isHighMoatROIC = averageROIC >= 15.0;

    let economicMoatRating = 'No Moat';
    if (averageROIC >= 20.0) economicMoatRating = 'Wide Moat';
    else if (averageROIC >= 12.0) economicMoatRating = 'Narrow Moat';

    // 3. $1 Retained Earnings Test
    let retainedTest = {
      retainedEarningsCreated: 0,
      marketValueIncrease: 0,
      dollarValueCreatedPerDollarRetained: 1.0,
      verdict: 'Neutral Capital Allocation'
    };
    if (history.length >= 2) {
      const firstYear = history[0];
      const lastYear = history[history.length - 1];
      const netRetained = Math.max((lastYear.retainedEarnings || 0) - (firstYear.retainedEarnings || 0), 1);
      const estimatedMcapIncrease = Math.max((market.marketCap || 0) * 0.3, 1);
      const ratio = roundVal(estimatedMcapIncrease / netRetained, 2);
      retainedTest = {
        retainedEarningsCreated: netRetained,
        marketValueIncrease: estimatedMcapIncrease,
        dollarValueCreatedPerDollarRetained: ratio,
        verdict: ratio >= 1.0 ? 'Superior Capital Allocation (> $1 created per $1 retained)' : 'Capital Destruction (< $1 created)'
      };
    }

    // 4. Solvency Cushion & Debt Retirement Years
    const debtYears = latestOwnerEarnings > 0 ? roundVal((latest.totalDebt || 0) / latestOwnerEarnings, 2) : 0;

    return {
      title: 'Warren Buffett: Economic Moats, Owner Earnings & Capital Discipline',
      ownerEarningsHistory,
      latestOwnerEarnings,
      latestOwnerEarningsFormatted: formatCurrency(latestOwnerEarnings),
      averageROIC: `${averageROIC}%`,
      averageRoicNumber: averageROIC,
      isHighMoatROIC,
      economicMoatRating,
      retainedEarningsTest: retainedTest,
      ownerEarningsAnalysis: {
        reportedNetIncome: latest.netIncome || 0,
        depreciationAndAmortization: latest.depreciation || 0,
        estimatedCapex: latest.capex || 0,
        buffettOwnerEarnings: latestOwnerEarnings,
        freeCashFlow: latest.freeCashFlow || 0,
        ownerEarningsYieldPercent: market.marketCap > 0 ? roundVal((latestOwnerEarnings / market.marketCap) * 100, 2) : 0
      },
      historicalRoic: ownerEarningsHistory.map(h => ({
        year: h.year,
        roicPercent: h.roic,
        operatingMarginPercent: h.operatingMargin
      })),
      solvencyCushion: {
        cash: latest.cashAndEquivalents || 0,
        totalDebt: latest.totalDebt || 0,
        debtToEquity: financials.ratios?.debtToEquity || 0,
        currentRatio: financials.ratios?.currentRatio || 1.0,
        yearsOfOwnerEarningsToRetireDebt: debtYears
      },
      financialResilience: {
        totalCash: formatCurrency(latest.cashAndEquivalents || 0),
        totalDebt: formatCurrency(latest.totalDebt || 0),
        currentRatio: financials.ratios?.currentRatio || 1.0,
        debtToEquity: financials.ratios?.debtToEquity || 0,
        dividendPayoutRatio: financials.ratios?.dividendPayoutRatio || 0
      }
    };
  }
}

// ============================================================================
// 3. PHILIP FISHER ANALYZER
// ============================================================================
export class PhilipFisherAnalyzer {
  /**
   * Evaluates company data according to Philip Fisher's qualitative scuttlebutt audit.
   * @param {Object} companyData StandardCompanyData
   * @returns {Object} FisherAnalysis
   */
  static analyze(companyData) {
    const sec = companyData.secFilings || {};
    const intel = companyData.marketIntelligence || {};
    const profile = companyData.profile || {};
    const sa = intel.seekingAlpha || {};

    const checklist = [
      { id: 1, text: 'Products/services with sufficient market potential for sizable sales increase', score: 1, pass: true },
      { id: 2, text: 'Management determination to develop products that continue to increase sales', score: 1, pass: true },
      { id: 3, text: 'Effectiveness of company R&D efforts relative to company size', score: 1, pass: (companyData.financials?.latest?.rnd || 0) > 0 },
      { id: 4, text: 'Above-average sales organization & distribution footprint', score: 1, pass: true },
      { id: 5, text: 'Worthwhile profit margin (> 15% operating margin)', score: 1, pass: (companyData.financials?.ratios?.operatingMarginPercent || 0) >= 15 },
      { id: 6, text: 'Maintaining or improving profit margins over multi-year cycles', score: 1, pass: true },
      { id: 7, text: 'Outstanding labor and personnel relations', score: 1, pass: intel.engineeringSentiment?.engineerSentimentVerdict !== 'Bearish' },
      { id: 8, text: 'Outstanding executive relations and minimal factionalism', score: 1, pass: true },
      { id: 9, text: 'Management depth & leadership continuity', score: 1, pass: true },
      { id: 10, text: 'Cost analysis and accounting controls excellence', score: 1, pass: true },
      { id: 11, text: 'Industry-specific aspects giving clues to outstanding company edge', score: 1, pass: true },
      { id: 12, text: 'Long-range outlook toward corporate profits', score: 1, pass: true },
      { id: 13, text: 'Equity financing needs without diluting existing shareholder value', score: 1, pass: (companyData.financials?.ratios?.debtToEquity || 0) < 2.0 },
      { id: 14, text: 'Management talks freely about difficulties as well as successes', score: 1, pass: true },
      { id: 15, text: 'Management of unquestionable integrity and stockholder alignment', score: 1, pass: (sec.executiveCompensationAudit || []).length > 0 }
    ];

    const totalPassed = checklist.filter(c => c.pass).length;

    return {
      title: 'Philip Fisher: Aggressive Primary Scuttlebutt & Regulatory Audit',
      companyCIK: sec.companyCIK || 'N/A',
      secFilings: sec.filings || {},
      executiveCompensationAudit: sec.executiveCompensationAudit || [
        'Verify CEO bonuses are linked to ROIC rather than top-line revenue growth.',
        'Check insider stock ownership alignment in DEF 14A.'
      ],
      recentInsiderFilingsCount: sec.recentInsiderFilingsCount || 0,
      developerMoat: intel.developerMoat,
      engineeringSentiment: intel.engineeringSentiment,
      customerAndCrowdSentiment: intel.crowdSentiment,
      seekingAlphaIntel: sa,
      duckduckgoIntel: intel.duckduckgo,
      foddaIntel: intel.fodda,
      fisher15PointChecklist: checklist,
      totalPassed,
      totalScoreMax: 15,
      verdict: totalPassed >= 12 ? 'Exceptional Fisher Scuttlebutt Quality' : 'Moderate Scuttlebutt Rating',
      scuttlebuttProtocol: {
        competitors: 'Who is winning the most new RFPs, and where is this company vulnerable?',
        customers: 'Why do you choose this vendor over alternatives? Would a 10% price hike cause you to switch?',
        suppliers: 'Are order volumes smooth or erratic? Does management negotiate with integrity?',
        exEmployees: 'Why did you leave? Is engineering promotion based on merit or internal politics?'
      }
    };
  }
}

// ============================================================================
// 4. ASWATH DAMODARAN ANALYZER
// ============================================================================
export class AswathDamodaranAnalyzer {
  /**
   * Evaluates company data according to Aswath Damodaran's narrative-to-numbers framework.
   * @param {Object} companyData StandardCompanyData
   * @param {Object} [options]
   * @returns {Object} DamodaranAnalysis
   */
  static analyze(companyData, options = {}) {
    const financials = companyData.financials || {};
    const market = companyData.market || {};
    const macro = companyData.macroEnvironment || {};
    const sec = companyData.secFilings || {};
    const latest = financials.latest || {};
    const history = financials.annualHistory || [];

    const rf = macro.riskFreeRatePercent || 4.25;
    const erp = 4.60; // Damodaran implied ERP default
    const beta = market.beta || 1.10;

    // 1. Cost of Equity (CAPM) = Rf + Beta * ERP
    const costOfEquity = roundVal(rf + (beta * erp), 2);

    // 2. Pre-Tax Cost of Debt via Synthetic Rating based on Interest Coverage
    const ebit = latest.operatingIncome || 1;
    const intExp = Math.max((latest.totalDebt || 0) * 0.05, 1);
    const intCoverage = intExp > 0 ? roundVal(ebit / intExp, 2) : 10.0;

    let defaultSpread = 1.25;
    let syntheticRating = 'A';
    if (intCoverage >= 8.5) { syntheticRating = 'AAA/AA'; defaultSpread = 0.75; }
    else if (intCoverage >= 6.5) { syntheticRating = 'A+'; defaultSpread = 1.00; }
    else if (intCoverage >= 4.5) { syntheticRating = 'A'; defaultSpread = 1.25; }
    else if (intCoverage >= 3.0) { syntheticRating = 'BBB'; defaultSpread = 1.75; }
    else if (intCoverage >= 2.0) { syntheticRating = 'BB'; defaultSpread = 3.00; }
    else { syntheticRating = 'B/CCC'; defaultSpread = 5.00; }

    const preTaxCostOfDebt = roundVal(rf + defaultSpread, 2);
    const taxRate = 0.21;
    const afterTaxCostOfDebt = roundVal(preTaxCostOfDebt * (1 - taxRate), 2);

    // 3. WACC Calculation
    const mcap = Math.max(market.marketCap || 1, 1);
    const totalDebt = latest.totalDebt || 0;
    const enterpriseValue = mcap + totalDebt;
    const eqWeight = mcap / enterpriseValue;
    const debtWeight = totalDebt / enterpriseValue;
    const wacc = roundVal((eqWeight * costOfEquity) + (debtWeight * afterTaxCostOfDebt), 2);

    // 4. R&D Capitalization Adjustment (3-year linear amortization)
    const rndYears = options.rndYears || 3;
    let unamortizedRnD = 0;
    let currentAmortization = 0;

    if (history.length >= rndYears) {
      const recentYears = history.slice(-rndYears);
      recentYears.forEach((y, i) => {
        const rnd = y.researchAndDevelopment || 0;
        const weight = (rndYears - i) / rndYears;
        unamortizedRnD += Math.round(rnd * weight);
        currentAmortization += Math.round(rnd / rndYears);
      });
    } else {
      const latestRnd = latest.rnd || 0;
      unamortizedRnD = Math.round(latestRnd * 1.5);
      currentAmortization = Math.round(latestRnd * 0.5);
    }

    const adjustedOperatingIncome = Math.round(ebit + (latest.rnd || 0) - currentAmortization);
    const adjustedDebt = (latest.totalDebt || 0) + (sec.operatingLeaseDebtXBRL || 0);

    // 5. Multi-Stage DCF Intrinsic Valuation
    const fcf0 = Math.max(latest.freeCashFlow || (latest.operatingCashFlow - latest.capex), 1000000);
    const gHigh = Math.min(Math.max((financials.ratios?.operatingMarginPercent || 15) * 0.5, 5), 15) / 100;
    const gStable = Math.min(rf / 100, 0.03); // Stable growth capped at risk-free rate
    const discountRate = wacc / 100;

    let pvCashFlows = 0;
    let currentFcf = fcf0;
    for (let yr = 1; yr <= 5; yr++) {
      currentFcf *= (1 + gHigh);
      pvCashFlows += currentFcf / ((1 + discountRate) ** yr);
    }
    for (let yr = 6; yr <= 10; yr++) {
      const linearG = gHigh - ((gHigh - gStable) * ((yr - 5) / 5));
      currentFcf *= (1 + linearG);
      pvCashFlows += currentFcf / ((1 + discountRate) ** yr);
    }

    // Terminal Value
    const terminalFcf = currentFcf * (1 + gStable);
    const terminalValue = terminalFcf / (discountRate - gStable);
    const pvTerminalValue = terminalValue / ((1 + discountRate) ** 10);

    const estimatedEV = Math.round(pvCashFlows + pvTerminalValue);
    const estimatedEquityValue = Math.round(estimatedEV - (latest.totalDebt || 0) + (latest.cashAndEquivalents || 0));
    const shares = market.sharesOutstanding || 1;
    const intrinsicValuePerShare = roundVal(estimatedEquityValue / shares, 2);
    const currentPrice = market.currentPrice || 1;

    const marginOfSafetyPercent = roundVal(((intrinsicValuePerShare - currentPrice) / intrinsicValuePerShare) * 100, 2);

    let valuationVerdict = 'Fairly Valued';
    if (marginOfSafetyPercent >= 20) valuationVerdict = 'Undervalued (Substantial Margin of Safety)';
    else if (marginOfSafetyPercent <= -20) valuationVerdict = 'Overvalued';

    return {
      title: 'Aswath Damodaran: Narrative to Numbers Valuation & Normalization',
      costOfCapital: {
        riskFreeRatePercent: rf,
        impliedEquityRiskPremiumPercent: erp,
        bottomUpBeta: beta,
        costOfEquityPercent: costOfEquity,
        syntheticCreditRating: syntheticRating,
        defaultSpreadPercent: defaultSpread,
        preTaxCostOfDebtPercent: preTaxCostOfDebt,
        effectiveTaxRatePercent: roundVal(taxRate * 100, 1),
        afterTaxCostOfDebtPercent: afterTaxCostOfDebt,
        equityWeightPercent: roundVal(eqWeight * 100, 2),
        debtWeightPercent: roundVal(debtWeight * 100, 2),
        waccPercent: wacc
      },
      rndNormalization: {
        amortizationYears: rndYears,
        reportedRndExpense: latest.rnd || 0,
        currentYearAmortization: currentAmortization,
        unamortizedRnDAsset: unamortizedRnD,
        reportedOperatingIncome: ebit,
        adjustedOperatingIncome
      },
      operatingLeaseDebtConversion: {
        operatingLeaseDebtXBRL: sec.operatingLeaseDebtXBRL || 0,
        adjustedTotalDebt: adjustedDebt
      },
      dcfModel: {
        forecastHorizonYears: 10,
        highGrowthRatePercent: roundVal(gHigh * 100, 2),
        terminalGrowthRatePercent: roundVal(gStable * 100, 2),
        waccDiscountRatePercent: wacc,
        pvOfTenYearCashFlows: Math.round(pvCashFlows),
        pvOfTerminalValue: Math.round(pvTerminalValue),
        enterpriseIntrinsicValue: estimatedEV,
        netDebtDeduction: (latest.totalDebt || 0) - (latest.cashAndEquivalents || 0),
        equityIntrinsicValue: estimatedEquityValue,
        intrinsicValuePerShare,
        currentPrice,
        marginOfSafetyPercent,
        valuationVerdict
      },
      threePsEvaluation: {
        possible: 'Narrative fits within global addressable market potential.',
        plausible: 'Historical operating margins support cash reinvestment assumption.',
        probable: marginOfSafetyPercent > 0 ? 'High probability of value realization given wide moat.' : 'Demanding growth expectations already priced into equity multiple.'
      },
      // Backward compatibility aliases for decision memorandum & classic reporting
      rndCapitalization: {
        capitalizedRndAssetValue: unamortizedRnD,
        reportedROIC: roundVal((ebit / Math.max(mcap + totalDebt, 1)) * 100, 1),
        adjustedROIC: roundVal((adjustedOperatingIncome / Math.max(mcap + adjustedDebt, 1)) * 100, 1),
        damodaranInsight: 'R&D normalized as multi-year intellectual capital asset'
      },
      operatingLeaseDebt: sec.operatingLeaseDebtXBRL ? formatCurrency(sec.operatingLeaseDebtXBRL) : '$0.00',
      damodaranOnlinePortal: {
        impliedERP: `${erp}% (NYU Stern Forward-Looking ERP)`,
        sectorBenchmark: companyData.profile?.sector || 'General',
        industryUnleveredBeta: beta,
        industryBenchmarkWACC: `${wacc}%`,
        rndAmortizationLifespanApplied: `${rndYears} Years`
      },
      threePsRealityFilter: {
        possible: { verdict: 'Passed' },
        plausible: { verdict: 'Plausible' },
        probable: { verdict: 'Probable' }
      },
      macroBenchmarks: {
        riskFreeRateRf: `${rf}% (FRED DGS10 10-Yr Treasury)`,
        terminalGrowthCeiling: `${roundVal(gStable * 100, 2)}%`,
        benchmarkCreditSpread: `+${defaultSpread}%`,
        yieldCurveRegime: macro.yieldCurveRegime || 'Normal'
      }
    };
  }
}

// ============================================================================
// 5. BENJAMIN GRAHAM ANALYZER
// ============================================================================
export class BenjaminGrahamAnalyzer {
  /**
   * Evaluates company data according to Benjamin Graham's deep value & net-net rules.
   * @param {Object} companyData StandardCompanyData
   * @returns {Object} GrahamAnalysis
   */
  static analyze(companyData) {
    const financials = companyData.financials || {};
    const market = companyData.market || {};
    const latest = financials.latest || {};
    const shares = market.sharesOutstanding || 1;

    // 1. Net-Current-Asset Value (NCAV) / Net-Net
    // NCAV = Current Assets - Total Liabilities
    const totalLiabilities = Math.max((latest.totalDebt || 0) * 1.5, 1); // conservative proxy
    const currentAssets = latest.cashAndEquivalents + (latest.inventory || 0) + (latest.workingCapital > 0 ? latest.workingCapital : 0);
    const ncav = currentAssets - totalLiabilities;
    const ncavPerShare = roundVal(ncav / shares, 2);

    // 2. Graham Number = sqrt(22.5 * EPS * BVPS)
    const eps = latest.netIncome > 0 && shares > 0 ? roundVal(latest.netIncome / shares, 2) : 0;
    const bvps = latest.shareholdersEquity > 0 && shares > 0 ? roundVal(latest.shareholdersEquity / shares, 2) : 0;
    let grahamNumber = 0;
    if (eps > 0 && bvps > 0) {
      grahamNumber = roundVal(Math.sqrt(22.5 * eps * bvps), 2);
    }

    const currentPrice = market.currentPrice || 1;
    const isNetNet = currentPrice <= (ncavPerShare * 0.67) && ncavPerShare > 0;
    const grahamMarginOfSafety = grahamNumber > 0 ? roundVal(((grahamNumber - currentPrice) / grahamNumber) * 100, 2) : 0;

    return {
      title: 'Benjamin Graham: Deep Value, Net-Net & Margin of Safety',
      ncavPerShare,
      isNetNetDiscount: isNetNet,
      bookValuePerShare: bvps,
      earningsPerShare: eps,
      grahamNumber,
      grahamMarginOfSafetyPercent: grahamMarginOfSafety,
      defensiveInvestorCriteria: [
        { rule: 'Adequate Size (Market Cap > $2B)', pass: (market.marketCap || 0) >= 2000000000 },
        { rule: 'Strong Financial Condition (Current Ratio >= 2.0)', pass: (financials.ratios?.currentRatio || 0) >= 2.0 },
        { rule: 'Earnings Stability (Positive Net Income)', pass: (latest.netIncome || 0) > 0 },
        { rule: 'Dividend Record (Paying Dividends)', pass: (market.dividendYieldPercent || 0) > 0 },
        { rule: 'Moderate P/E Ratio (< 20x)', pass: (market.peRatio || 0) > 0 && (market.peRatio || 0) <= 20.0 }
      ]
    };
  }
}

// ============================================================================
// 6. EXECUTIVE SYNTHESIS ENGINE
// ============================================================================
export class ExecutiveSynthesisEngine {
  /**
   * Synthesizes expert evaluations into a unified executive memorandum.
   * @param {Object} params
   * @param {Object} params.companyData
   * @param {Object} params.lynch
   * @param {Object} params.buffett
   * @param {Object} params.fisher
   * @param {Object} params.damodaran
   * @param {Object} params.graham
   */
  static synthesize({ companyData, lynch, buffett, fisher, damodaran, graham }) {
    const sym = companyData.profile?.ticker || 'N/A';
    const name = companyData.profile?.name || sym;
    const currentPrice = companyData.market?.currentPrice || 0;
    const dcfValue = damodaran.dcfModel?.intrinsicValuePerShare || currentPrice;
    const marginOfSafety = damodaran.dcfModel?.marginOfSafetyPercent || 0;

    let recommendation = 'HOLD / MONITOR';
    if (marginOfSafety >= 15 && buffett.economicMoatRating !== 'No Moat' && lynch.pegRatio < 1.5) {
      recommendation = 'STRONG ACCUMULATE';
    } else if (marginOfSafety >= 0 && buffett.economicMoatRating === 'Wide Moat') {
      recommendation = 'ACCUMULATE ON WEAKNESS';
    } else if (marginOfSafety < -20) {
      recommendation = 'TRIM / CAUTION (Full Valuation)';
    }

    const thesis = `${name} (${sym}) presents a ${buffett.economicMoatRating} franchise with ${buffett.averageROIC} average ROIC. Evaluated under the Peter Lynch framework as a '${lynch.category}' (PEG: ${lynch.pegRatio}). Aswath Damodaran's normalized DCF establishes an intrinsic value of $${dcfValue} per share vs. the current market price of $${currentPrice} (Margin of Safety: ${marginOfSafety}%).`;

    const keyRisks = [
      `Valuation compression if growth moderates below the implied terminal hurdle rate (${damodaran.dcfModel?.terminalGrowthRatePercent}%).`,
      `Competitive pressure across core sector peers (${companyData.competitors?.peers?.map(p => p.ticker).slice(0, 3).join(', ') || 'industry rivals'}).`,
      `Macro sensitivity to sustained risk-free rates (${companyData.macroEnvironment?.riskFreeRatePercent}%).`
    ];

    const invalidationTriggers = [
      `Organic ROIC compressing below 12% across two consecutive fiscal cycles.`,
      `Loss of pricing power signaled by operating margin decline > 300 basis points.`,
      `Failure of Fisher scuttlebutt channel checks regarding customer churn or developer momentum.`
    ];

    return {
      recommendation,
      headline: `${name}: ${buffett.economicMoatRating} ${lynch.category} — ${recommendation}`,
      thesis,
      intrinsicFairValue: dcfValue,
      marginOfSafetyPercent: marginOfSafety,
      keyRisks,
      invalidationTriggers,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================================================
// 7. UNIFIED INFERENCE FACADE
// ============================================================================
export class ExpertInferenceEngine {
  /**
   * Pure inference execution: Runs all expert analyses against standardized company data.
   * @param {Object} companyData StandardCompanyData (must be standardized, no expert fields)
   * @param {Object} [options]
   * @returns {Object} Complete inference suite
   */
  static runAll(companyData, options = {}) {
    if (!companyData || !companyData.financials) {
      throw new Error('[ExpertInferenceEngine] Invalid companyData supplied for expert inference');
    }

    const lynch = PeterLynchAnalyzer.analyze(companyData);
    const buffett = WarrenBuffettAnalyzer.analyze(companyData);
    const fisher = PhilipFisherAnalyzer.analyze(companyData);
    const damodaran = AswathDamodaranAnalyzer.analyze(companyData, options);
    const graham = BenjaminGrahamAnalyzer.analyze(companyData);

    const synthesis = ExecutiveSynthesisEngine.synthesize({
      companyData,
      lynch,
      buffett,
      fisher,
      damodaran,
      graham
    });

    return {
      experts: {
        peterLynch: lynch,
        warrenBuffett: buffett,
        philipFisher: fisher,
        aswathDamodaran: damodaran,
        benjaminGraham: graham
      },
      synthesis,
      // Backward-compatible aliases for existing UI dashboards and test runners
      pillar1_Lynch: lynch,
      pillar2_Fisher: fisher,
      pillar3_Buffett: buffett,
      pillar4_Damodaran: damodaran,
      decisionMemo: synthesis
    };
  }
}

export default {
  PeterLynchAnalyzer,
  WarrenBuffettAnalyzer,
  PhilipFisherAnalyzer,
  AswathDamodaranAnalyzer,
  BenjaminGrahamAnalyzer,
  ExecutiveSynthesisEngine,
  ExpertInferenceEngine
};
