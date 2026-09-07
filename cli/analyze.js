#!/usr/bin/env node
/**
 * cli/analyze.js
 * Interactive CLI runner for the Composite Investment Methodology.
 * 
 * Usage:
 *   node cli/analyze.js MSFT
 *   node cli/analyze.js AAPL --export-md
 *   node cli/analyze.js DEMO --demo
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CompositeInvestor, formatCurrency } from '../lib/compositeInvestor.js';
import { getDemoFinancials } from '../lib/demoData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage:
  node cli/analyze.js <TICKER> [options]

Options:
  --demo            Run using pre-loaded offline financial data (no API key needed)
  --export-md       Generate and save Investment Decision Memorandum markdown file
  --company-data    Output purely standardized objective company financials (no experts)
  --json            Output canonical Single Company JSON to stdout
  --refresh         Bypass Cache and DB to force fresh live pull
  --rnd-years <N>   Number of years to amortize R&D (default: 3)
  --help            Show this help menu

Examples:
  node cli/analyze.js MSFT
  node cli/analyze.js MSFT --company-data
  node cli/analyze.js AAPL --export-md
  node cli/analyze.js NVDA --json
  node cli/analyze.js DEMO --demo --export-md
`);
    process.exit(0);
  }

  const ticker = args[0].toUpperCase();
  const isDemo = args.includes('--demo') || ticker === 'DEMO';
  const exportMd = args.includes('--export-md');
  const asJson = args.includes('--json');
  const showCompanyData = args.includes('--company-data');
  const forceRefresh = args.includes('--refresh');
  const showScuttlebutt = args.includes('--scuttlebutt');
  const showDamodaran = args.includes('--damodaran');
  const repoIdx = args.indexOf('--repo');
  const customRepo = repoIdx > -1 && args[repoIdx + 1] ? args[repoIdx + 1] : null;
  const rndYearsIdx = args.indexOf('--rnd-years');
  const rndYears = rndYearsIdx > -1 && args[rndYearsIdx + 1] ? parseInt(args[rndYearsIdx + 1], 10) : null;

  if (!asJson && !showCompanyData) {
    console.log(`\n==============================================================================`);
    console.log(` COMPOSITE INVESTMENT METHODOLOGY AUDIT: ${ticker}`);
    console.log(` Synthesis: Lynch | Fisher | Buffett | Damodaran`);
    console.log(` Mode: ${isDemo ? 'Offline Demo Data' : 'Live Data (Cache-First -> DB-First -> Live Multilateral Feed)'}`);
    console.log(`==============================================================================\n`);
  }

  const investor = new CompositeInvestor();

  try {
    const options = {
      rndYears,
      repo: customRepo,
      forceRefresh,
      offlineData: isDemo ? getDemoFinancials(ticker) : null
    };

    if (showCompanyData) {
      const companyData = await investor.getStandardCompanyData(ticker, options);
      console.log(JSON.stringify(companyData, null, 2));
      process.exit(0);
    }

    const dossier = await investor.getCompositeDossier(ticker, options);

    if (asJson) {
      console.log(JSON.stringify(dossier, null, 2));
      process.exit(0);
    }

    // Terminal Summary
    console.log(`Company: ${dossier.metadata.companyName} (${dossier.metadata.symbol})`);
    console.log(`Market Price: $${dossier.metadata.currentPrice?.toFixed(2)} | Market Cap: ${formatCurrency(dossier.metadata.marketCap)}`);
    console.log(`Sector: ${dossier.metadata.sector}\n`);

    console.log(`------------------------------------------------------------------------------`);
    console.log(`[Pillar 1: Peter Lynch Empirical Edge]`);
    console.log(`  Classification:     ${dossier.pillar1_Lynch.category} (5-Yr Rev CAGR: ${dossier.pillar1_Lynch.revenueCAGR})`);
    console.log(`  PEG Ratio:          ${dossier.pillar1_Lynch.pegRatio || 'N/A'} (${dossier.pillar1_Lynch.lynchPEGEvaluation})`);
    console.log(`  Net Cash Per Share: ${dossier.pillar1_Lynch.netCashPerShare}`);
    console.log(`  Inventory Divergence Spread: ${dossier.pillar1_Lynch.inventorySalesSpreadPercent}`);
    if (dossier.pillar1_Lynch.redFlags.length > 0) {
      dossier.pillar1_Lynch.redFlags.forEach(f => console.log(`  ⚠️  ${f}`));
    } else {
      console.log(`  ✅  No inventory/sales growth divergence detected.`);
    }

    console.log(`\n------------------------------------------------------------------------------`);
    console.log(`[Pillar 2: Philip Fisher Scuttlebutt & Regulatory Audit]`);
    console.log(`  SEC EDGAR CIK:      ${dossier.pillar2_Fisher.companyCIK}`);
    console.log(`  Form 10-K URL:      ${dossier.pillar2_Fisher.secFilings?.latest10K?.filingUrl || 'N/A'}`);
    console.log(`  Proxy DEF 14A URL:  ${dossier.pillar2_Fisher.secFilings?.latestDEF14A?.filingUrl || 'N/A'}`);
    console.log(`  Recent Form 4s:     ${dossier.pillar2_Fisher.recentInsiderFilingsCount} filings recorded`);

    if (dossier.pillar2_Fisher.developerMoat) {
      console.log(`  Developer Moat:     ${dossier.pillar2_Fisher.developerMoat.repository} (⭐ ${dossier.pillar2_Fisher.developerMoat.stars?.toLocaleString()} stars, Score: ${dossier.pillar2_Fisher.developerMoat.developerMomentumScore}/100)`);
      console.log(`  Traction Verdict:   ${dossier.pillar2_Fisher.developerMoat.developerTractionVerdict}`);
    }
    if (dossier.pillar2_Fisher.engineeringSentiment) {
      console.log(`  Hacker News Mood:   ${dossier.pillar2_Fisher.engineeringSentiment.engineerSentimentVerdict}`);
    }
    if (dossier.pillar2_Fisher.customerAndCrowdSentiment) {
      console.log(`  Reddit Sentiment:   ${dossier.pillar2_Fisher.customerAndCrowdSentiment.crowdSentimentVerdict}`);
    }
    if (dossier.pillar2_Fisher.supplyChainAudit) {
      console.log(`  Customs Audit:      ${dossier.pillar2_Fisher.supplyChainAudit.importYetiSearchUrl}`);
    }

    if (showScuttlebutt && dossier.pillar2_Fisher.fiveCirclesInterviewScript) {
      console.log(`\n  [Fisher 5-Circles Field Interview Questions]`);
      const circles = dossier.pillar2_Fisher.fiveCirclesInterviewScript;
      console.log(`   • Competitors:  ${circles.circle1_Competitors.keyQuestions[0]}`);
      console.log(`   • Customers:    ${circles.circle2_Customers.keyQuestions[0]}`);
      console.log(`   • Suppliers:    ${circles.circle3_Suppliers.keyQuestions[0]}`);
      console.log(`   • Ex-Employees: ${circles.circle4_ExEmployees.keyQuestions[0]}`);
    }

    console.log(`\n------------------------------------------------------------------------------`);
    console.log(`[Pillar 3: Warren Buffett Moats & Owner Earnings]`);
    console.log(`  Latest Owner Cash:  ${dossier.pillar3_Buffett.latestOwnerEarningsFormatted}`);
    console.log(`  Average ROIC:       ${dossier.pillar3_Buffett.averageROIC} (Moat status: ${dossier.pillar3_Buffett.isHighMoatROIC ? 'DURABLE MOAT (>15%)' : 'MODERATE (<15%)'})`);
    console.log(`  $1 Retained Test:   $${dossier.pillar3_Buffett.retainedEarningsTest?.valueCreatedPerDollarRetained || 'N/A'} market value created per $1 retained (${dossier.pillar3_Buffett.retainedEarningsTest?.passedBuffettTest ? 'PASSED' : 'FAILED'})`);
    console.log(`  Solvency Cushion:   Cash ${dossier.pillar3_Buffett.financialResilience.totalCash} vs Debt ${dossier.pillar3_Buffett.financialResilience.totalDebt}`);

    console.log(`\n------------------------------------------------------------------------------`);
    console.log(`[Pillar 4: Aswath Damodaran Modern Accounting & Online Portal Benchmarks]`);
    console.log(`  R&D Asset Value:    ${dossier.pillar4_Damodaran.rndCapitalization.capitalizedRndAssetValue ? formatCurrency(dossier.pillar4_Damodaran.rndCapitalization.capitalizedRndAssetValue) : 'N/A'} (Lifespan: ${dossier.pillar4_Damodaran.damodaranOnlinePortal.rndAmortizationLifespanApplied})`);
    console.log(`  GAAP ROIC -> Adj:   ${dossier.pillar4_Damodaran.rndCapitalization.reportedROIC ?? 'N/A'}% -> ${dossier.pillar4_Damodaran.rndCapitalization.adjustedROIC ?? 'N/A'}%`);
    console.log(`  Operating Lease:    ${dossier.pillar4_Damodaran.operatingLeaseDebt}`);
    console.log(`  NYU Stern Sector:   ${dossier.pillar4_Damodaran.damodaranOnlinePortal.sectorBenchmark} (Unlevered Beta: ${dossier.pillar4_Damodaran.damodaranOnlinePortal.industryUnleveredBeta})`);
    console.log(`  Implied ERP:        ${dossier.pillar4_Damodaran.damodaranOnlinePortal.impliedERP}`);
    console.log(`  Synthetic Rating:   ${dossier.pillar4_Damodaran.costOfCapital?.syntheticDebtRating} (Pre-Tax Debt Cost: ${dossier.pillar4_Damodaran.costOfCapital?.preTaxCostOfDebtPercent}%)`);
    console.log(`  Company WACC:       ${dossier.pillar4_Damodaran.costOfCapital?.waccPercent}% (Equity: ${dossier.pillar4_Damodaran.costOfCapital?.costOfEquityPercent}%)`);
    console.log(`  Risk-Free Rate Rf:  ${dossier.pillar4_Damodaran.macroBenchmarks.riskFreeRateRf}`);
    console.log(`  Terminal Growth:    Ceiling <= ${dossier.pillar4_Damodaran.macroBenchmarks.terminalGrowthCeiling}`);
    console.log(`  Yield Curve Regime: ${dossier.pillar4_Damodaran.macroBenchmarks.yieldCurveRegime}`);

    if (showDamodaran && dossier.pillar4_Damodaran.threePsRealityFilter) {
      console.log(`\n  [Damodaran 3 P's Reality Filter (Story to Numbers)]`);
      const p = dossier.pillar4_Damodaran.threePsRealityFilter;
      console.log(`   • Possible:  ${p.possible.status} — ${p.possible.verdict}`);
      console.log(`   • Plausible: ${p.plausible.status} — ${p.plausible.verdict}`);
      console.log(`   • Probable:  ${p.probable.status} — ${p.probable.verdict}`);
    }

    if (exportMd) {
      const markdown = investor.generateMarkdownMemorandum(dossier);
      const outputDir = path.join(__dirname, '..', 'decision_memos');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${ticker}_memorandum.md`);
      fs.writeFileSync(outputPath, markdown, 'utf8');
      console.log(`\n📄 [Exported] Investment Memorandum saved to:\n   ${outputPath}`);
    }

    console.log(`\n==============================================================================\n`);
  } catch (err) {
    console.error(`\n[Execution Error] ${err.message}`);
    process.exit(1);
  }
}

main();

