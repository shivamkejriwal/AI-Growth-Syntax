/**
 * companyDataBuilder.js
 * Standardized Company Financial & Market Data Ingestion Builder.
 * 
 * CORE PRINCIPLE:
 * This module ingests, normalizes, and packages objective company data.
 * It is 100% INDEPENDENT of any expert opinions, investor philosophies,
 * or qualitative biases.
 * 
 * Stored in Cache and Database under:
 * - Namespace: 'companies'
 * - Key: 'COMPANY_<TICKER>'
 */

import { safeFloat, roundVal } from './alphaVantageClient.js';
import { getTodayDateStr } from './db.js';

/**
 * Builds the canonical, standardized company financial profile from raw API sources.
 * 
 * @param {Object} params
 * @param {string} params.ticker Target stock ticker
 * @param {Object} params.financials Raw normalized statements from Alpha Vantage / Yahoo Finance
 * @param {Object} [params.edgarFilings] SEC EDGAR 10-K, DEF 14A, Form 4 filings
 * @param {Object} [params.leaseFacts] SEC XBRL lease commitments
 * @param {Object} [params.macroSnapshot] FRED macroeconomic benchmark indicators
 * @param {Object} [params.competitorAnalysis] Peer matrix & industry concentration
 * @param {Object} [params.scuttlebuttData] Seeking Alpha, DuckDuckGo, and web signals
 * @returns {Object} StandardCompanyData
 */
export function buildStandardCompanyData({
  ticker,
  financials,
  edgarFilings = {},
  leaseFacts = {},
  macroSnapshot = {},
  competitorAnalysis = {},
  scuttlebuttData = {},
  congressionalTrades = {},
  institutionalHoldings = {}
}) {
  const sym = (ticker || financials?.symbol || '').toUpperCase().trim();
  const today = getTodayDateStr();

  const latest = financials?.latest || {};
  const yearsMap = financials?.yearsMap || {};
  const sortedYears = financials?.sortedYears || [];

  // Multi-year standardized financial history
  const annualHistory = sortedYears.map(year => {
    const yData = yearsMap[year] || {};
    return {
      fiscalYear: year,
      fiscalDate: yData.fiscalDate || `${year}-12-31`,
      revenue: yData.revenue || 0,
      grossProfit: yData.grossProfit || 0,
      operatingIncome: yData.operatingIncome || 0,
      netIncome: yData.netIncome || 0,
      ebitda: yData.ebitda || 0,
      dilutedEPS: yData.dilutedEPS || 0,
      researchAndDevelopment: yData.rnd || 0,
      operatingCashFlow: yData.operatingCashflow || 0,
      capitalExpenditures: yData.capex || 0,
      freeCashFlow: yData.fcf || 0,
      cashAndEquivalents: yData.cash || 0,
      shortTermDebt: yData.shortDebt || 0,
      longTermDebt: yData.longDebt || 0,
      totalDebt: yData.totalDebt || 0,
      shareholdersEquity: yData.equity || 0,
      totalCurrentAssets: yData.currentAssets || 0,
      totalCurrentLiabilities: yData.currentLiabilities || 0,
      workingCapital: yData.workingCapital || 0,
      retainedEarnings: yData.retainedEarnings || 0,
      inventory: yData.inventory || 0,
      propertyPlantEquipmentNet: yData.netPPE || 0,
      dividendsPaid: yData.dividendPayments || 0,
      stockBasedCompensation: yData.sbc || 0,
      depreciationAndAmortization: yData.depAmort || 0
    };
  });

  // Calculate standardized financial ratios (neutral accounting metrics)
  const latestRev = latest.revenue || 1;
  const latestNetInc = latest.netIncome || 0;
  const latestEquity = latest.equity || 1;
  const latestAssets = latest.currentAssets || 1;

  const standardRatios = {
    grossMarginPercent: latestRev > 0 ? roundVal(((latest.grossProfit || 0) / latestRev) * 100, 2) : 0,
    operatingMarginPercent: latestRev > 0 ? roundVal(((latest.operatingIncome || 0) / latestRev) * 100, 2) : 0,
    netMarginPercent: latestRev > 0 ? roundVal((latestNetInc / latestRev) * 100, 2) : 0,
    fcfMarginPercent: latestRev > 0 ? roundVal(((latest.fcf || 0) / latestRev) * 100, 2) : 0,
    currentRatio: financials?.currentRatio ?? (latest.currentLiabilities > 0 ? roundVal(latest.currentAssets / latest.currentLiabilities, 2) : 1.0),
    debtToEquity: financials?.debtToEquity ?? (latestEquity > 0 ? roundVal((latest.totalDebt || 0) / latestEquity, 2) : 0),
    returnOnEquityPercent: latestEquity > 0 ? roundVal((latestNetInc / latestEquity) * 100, 2) : 0,
    dividendPayoutRatio: financials?.payoutRatio ?? 0,
    effectiveTaxRatePercent: 21.0
  };

  return {
    _meta: {
      schemaVersion: '3.0.0',
      dataType: 'StandardCompanyData',
      ticker: sym,
      asOfDate: today,
      timestamp: Date.now(),
      sourcesIngested: [
        'Alpha Vantage Fundamentals',
        'SEC EDGAR XBRL',
        'FRED Macroeconomic Benchmarks',
        'Seeking Alpha RSS',
        'DuckDuckGo Intelligence',
        'Competitor Benchmarking Matrix',
        'Congressional Trades (House & Senate)',
        'SEC Form 13F Institutional Whales'
      ]
    },

    profile: {
      ticker: sym,
      name: financials?.name || sym,
      sector: financials?.sector || 'General',
      industry: financials?.industry || 'General',
      description: financials?.description || '',
      currency: 'USD'
    },

    market: {
      currentPrice: financials?.currentPrice || 0,
      marketCap: financials?.marketCap || 0,
      sharesOutstanding: financials?.sharesOutstanding || 0,
      beta: financials?.beta || 1.0,
      peRatio: financials?.peRatio || 0,
      pegRatio: financials?.pegRatio || 0,
      dividendYieldPercent: financials?.dividendYield ? roundVal(financials.dividendYield * 100, 2) : 0
    },

    financials: {
      currency: 'USD',
      sortedYears,
      latestYear: financials?.latestYear || (sortedYears.length > 0 ? sortedYears[sortedYears.length - 1] : String(new Date().getFullYear() - 1)),
      latest: {
        revenue: latest.revenue || 0,
        grossProfit: latest.grossProfit || 0,
        operatingIncome: latest.operatingIncome || 0,
        netIncome: latest.netIncome || 0,
        operatingCashFlow: latest.operatingCashflow || 0,
        capex: latest.capex || 0,
        freeCashFlow: latest.fcf || 0,
        cashAndEquivalents: latest.cash || 0,
        shortTermDebt: latest.shortDebt || 0,
        longTermDebt: latest.longDebt || 0,
        totalDebt: latest.totalDebt || 0,
        shareholdersEquity: latest.equity || 0,
        workingCapital: latest.workingCapital || 0,
        retainedEarnings: latest.retainedEarnings || 0,
        inventory: latest.inventory || 0,
        rnd: latest.rnd || 0,
        sbc: latest.sbc || 0,
        depreciation: latest.depAmort || 0
      },
      annualHistory,
      ratios: standardRatios
    },

    secFilings: {
      companyCIK: edgarFilings.cik || 'N/A',
      filings: edgarFilings.filings || {},
      operatingLeaseDebtXBRL: leaseFacts?.totalLeaseDebt || 0,
      recentInsiderFilingsCount: (edgarFilings.filings?.recentForm4s || []).length,
      executiveCompensationAudit: edgarFilings.filings?.latestDEF14A?.executiveCompensationAudit || []
    },

    competitors: {
      peers: competitorAnalysis?.peers || [],
      seekingAlphaPeers: competitorAnalysis?.seekingAlphaPeers || [],
      benchmarks: competitorAnalysis?.benchmarks || {},
      marketShareAndConcentration: competitorAnalysis?.marketShareAndConcentration || {
        herfindahlHirschmanIndex: 1500,
        concentrationRating: 'Moderately Concentrated'
      }
    },

    marketIntelligence: {
      seekingAlpha: {
        consensusSentiment: scuttlebuttData?.seekingAlpha?.consensusSentiment || 'Neutral',
        articles: scuttlebuttData?.seekingAlpha?.articles || [],
        sentimentSummary: scuttlebuttData?.seekingAlpha?.sentimentSummary || { bullish: 0, bearish: 0, neutral: 0 },
        coMentionedPeers: scuttlebuttData?.seekingAlpha?.coMentionedPeers || []
      },
      duckduckgo: scuttlebuttData?.duckduckgo || null,
      developerMoat: scuttlebuttData?.github || scuttlebuttData?.developerMoat || null,
      engineeringSentiment: scuttlebuttData?.hackerNews || scuttlebuttData?.engineeringSentiment || null,
      crowdSentiment: scuttlebuttData?.reddit || scuttlebuttData?.crowdSentiment || null,
      fodda: scuttlebuttData?.fodda || null,
      perplexity: scuttlebuttData?.perplexity || null,
      fiveCirclesScript: scuttlebuttData?.fiveCirclesScript || null,
      fisher15Points: scuttlebuttData?.fisher15Points || null
    },

    macroEnvironment: {
      riskFreeRatePercent: macroSnapshot?.riskFreeRatePercent ?? 4.25,
      effectiveFedFundsRate: macroSnapshot?.effectiveFedFundsRate ?? 5.33,
      yoyCPIInflationPercent: macroSnapshot?.yoyCPIInflationPercent ?? 2.7,
      bbbCorporateCreditSpreadPercent: macroSnapshot?.bbbCorporateCreditSpreadPercent ?? 1.18,
      yieldCurve10Y2YSpreadPercent: macroSnapshot?.yieldCurve10Y2YSpreadPercent ?? 0.15,
      yieldCurveRegime: macroSnapshot?.yieldCurveRegime || 'Normal Upward Sloping',
      regionalManufacturingSurveys: macroSnapshot?.regionalManufacturingSurveys || null
    },

    congressionalTrading: {
      symbol: sym,
      netSentiment: congressionalTrades?.netCongressionalSentiment || 'Neutral Activity',
      totalDisclosedTrades: congressionalTrades?.totalDisclosedTrades || 0,
      convictionSummary: congressionalTrades?.convictionSummary || {},
      recentTransactions: congressionalTrades?.recentTransactions || []
    },

    institutionalOwnership: {
      symbol: sym,
      totalHolders: institutionalHoldings?.totalInstitutionalHolders || 0,
      totalShares: institutionalHoldings?.totalInstitutionalShares || 0,
      ownershipPercent: institutionalHoldings?.institutionalOwnershipPercent || 0,
      smartMoneySentiment: institutionalHoldings?.netSmartMoneySentiment || 'Neutral Accumulation',
      superinvestorCount: institutionalHoldings?.superinvestorCount || 0,
      superinvestorWhales: institutionalHoldings?.superinvestorWhales || [],
      topHolders: institutionalHoldings?.topHolders || []
    }
  };
}

export default {
  buildStandardCompanyData
};

