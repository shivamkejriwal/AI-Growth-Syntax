/**
 * analysis.js
 * Frontend Controller for Multi-Persona Company Analysis & Forensic Consensus.
 */

const searchInput = document.getElementById('analysis-search-input');
const btnRun = document.getElementById('btn-run-analysis');
const quickChips = document.querySelectorAll('.chip-btn');
const loadingEl = document.getElementById('analysis-loading');
const loadingText = document.getElementById('loading-step-text');
const contentEl = document.getElementById('analysis-content');

// Pipeline Step Elements
const step1 = document.getElementById('pipe-step-1');
const step2 = document.getElementById('pipe-step-2');
const step3 = document.getElementById('pipe-step-3');
const step4 = document.getElementById('pipe-step-4');
const step5 = document.getElementById('pipe-step-5');

// Target Sections
const secDossier = document.getElementById('section-dossier');
const secAnalysis = document.getElementById('section-analysis-personas');
const secExperts = document.getElementById('section-expert-personas');
const secExpertsDebate = document.getElementById('section-experts-debate');
const secGraham = document.getElementById('section-graham');

// Pipeline Navigation Click Handlers
if (step1) step1.addEventListener('click', () => scrollToSection(secDossier, step1));
if (step2) step2.addEventListener('click', () => scrollToSection(secAnalysis, step2));
if (step3) step3.addEventListener('click', () => scrollToSection(secExperts, step3));
if (step4) step4.addEventListener('click', () => scrollToSection(secExpertsDebate, step4));
if (step5) step5.addEventListener('click', () => scrollToSection(secGraham, step5));

function scrollToSection(el, stepEl) {
  if (!el) return;
  [step1, step2, step3, step4, step5].forEach(s => s?.classList.remove('active'));
  stepEl?.classList.add('active');
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Quick Chip Handlers
quickChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const ticker = chip.dataset.ticker;
    if (ticker && searchInput) {
      searchInput.value = ticker;
      runCompanyAnalysis(ticker);
    }
  });
});

const btnForceRefresh = document.getElementById('btn-force-ai-refresh');
if (btnForceRefresh) {
  btnForceRefresh.addEventListener('click', () => {
    const ticker = (searchInput?.value || 'MSFT').trim().toUpperCase();
    if (ticker) runCompanyAnalysis(ticker, true);
  });
}

if (btnRun) {
  btnRun.addEventListener('click', () => {
    const ticker = (searchInput?.value || 'MSFT').trim().toUpperCase();
    if (ticker) runCompanyAnalysis(ticker);
  });
}

if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const ticker = (searchInput.value || 'MSFT').trim().toUpperCase();
      if (ticker) runCompanyAnalysis(ticker);
    }
  });
}

// Main Fetcher & Orchestration Invocation
async function runCompanyAnalysis(ticker, forceRefresh = false) {
  const refreshQuery = forceRefresh ? '&refresh=true' : '';
  showLoading(true, forceRefresh 
    ? `Running live Google Gemini AI Persona inference & debate for ${ticker}...`
    : `Pulling ${ticker} company dossier and evaluating 14 risk checks...`
  );

  try {
    const res = await fetch(`/api/company-analysis?ticker=${encodeURIComponent(ticker)}&mode=live${refreshQuery}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch company analysis`);
    }

    const data = await res.json();
    renderAnalysisData(data);
  } catch (err) {
    console.warn(`[Analysis] Live fetch failed, attempting demo fallback:`, err.message);
    try {
      const demoRes = await fetch(`/api/company-analysis?ticker=${encodeURIComponent(ticker)}&mode=demo`);
      if (demoRes.ok) {
        const demoData = await demoRes.json();
        renderAnalysisData(demoData);
        return;
      }
    } catch (demoErr) {
      console.warn(`[Analysis] API demo fallback failed:`, demoErr);
    }

    // Static hosting / offline fallback from bundled-demo.js
    try {
      const mod = await import('./bundled-demo.js');
      const bundled = mod.BUNDLED_DEMO || mod.default;
      if (bundled?.companyAnalysis?.[ticker]) {
        console.log(`[Analysis] Loaded precompiled analysis for ${ticker} from bundled-demo.js`);
        renderAnalysisData(bundled.companyAnalysis[ticker]);
        return;
      }
    } catch (bundleErr) {
      console.warn(`[Analysis] Bundled demo fallback failed:`, bundleErr);
    }

    alert(`Could not load analysis for ${ticker}: ${err.message}`);
  } finally {
    showLoading(false);
  }
}

function showLoading(isLoading, text = '') {
  if (loadingEl) loadingEl.style.display = isLoading ? 'block' : 'none';
  if (contentEl) contentEl.style.display = isLoading ? 'none' : 'block';
  if (loadingText && text) loadingText.textContent = text;
}

// Render Master Analysis Data
function renderAnalysisData(data) {
  const meta = data._meta || {};
  const ctx = data.companyContext || {};
  const stage1 = data.stage1_DossierSummary || {};
  const stage2 = data.stage2_AnalysisPersonas || {};
  const stage3 = data.stage3_ExpertPersonas || {};
  const stage4 = data.stage4_ExpertsDebate || {};
  const stage5 = data.stage5_SeniorArbiterGraham || data.stage4_SeniorArbiterGraham || {};

  // Update Top Header Mode Badge
  const modeBadge = document.getElementById('analysis-mode-badge');
  if (modeBadge) {
    if (meta.aiAugmented) {
      modeBadge.textContent = `⚡ AI ENGINE: ${String(meta.aiProvider || 'GEMINI').toUpperCase()}`;
      modeBadge.style.color = '#10b981';
      modeBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      modeBadge.style.background = 'rgba(16, 185, 129, 0.12)';
    } else {
      modeBadge.textContent = `LOCAL CACHED / ${String(meta.mode || 'LIVE').toUpperCase()}`;
      modeBadge.style.color = '';
      modeBadge.style.borderColor = '';
      modeBadge.style.background = '';
    }
  }

  // Update Prominent Engine Status Banner
  const engineTitle = document.getElementById('engine-status-title');
  const engineSub = document.getElementById('engine-status-sub');
  const enginePillModel = document.getElementById('engine-pill-model');
  const enginePillSignals = document.getElementById('engine-pill-signals');
  const enginePulseDot = document.getElementById('engine-pulse-dot');

  if (meta.aiAugmented) {
    if (engineTitle) engineTitle.textContent = `⚡ Gemini 2.5 Flash Multi-Persona Engine: Active`;
    if (engineSub) engineSub.textContent = `5 Analysis Personas • Stage 2 Debate • 4 Legendary Experts • Stage 4 Expert Debate • Graham Master Synthesis`;
    if (enginePillModel) enginePillModel.textContent = `AI: ${String(meta.aiProvider || 'GEMINI').toUpperCase()}-${meta.aiModel || '2.5-FLASH'}`;
    if (enginePillSignals) enginePillSignals.textContent = `14 RISK SIGNALS: ${ctx.riskScore || '13/14'} PASSED`;
    if (enginePulseDot) {
      enginePulseDot.style.background = '#10b981';
      enginePulseDot.style.boxShadow = '0 0 10px #10b981';
    }
  } else {
    if (engineTitle) engineTitle.textContent = `⚙️ Multi-Persona Analysis Engine: Ready`;
    if (engineSub) engineSub.textContent = `Deterministic financial baseline loaded. Click "Force AI Re-Analysis" for live Gemini multi-agent debate.`;
    if (enginePillModel) enginePillModel.textContent = `MODE: ${String(meta.mode || 'LIVE').toUpperCase()}`;
    if (enginePillSignals) enginePillSignals.textContent = `14 RISK SIGNALS: ${ctx.riskScore || 'AUDITED'}`;
    if (enginePulseDot) {
      enginePulseDot.style.background = '#3b82f6';
      enginePulseDot.style.boxShadow = '0 0 10px #3b82f6';
    }
  }

  // -------------------------------------------------------------
  // STAGE 1: DOSSIER BRIEFING & 14 RISK CHECKS
  // -------------------------------------------------------------
  const nameEl = document.getElementById('dossier-company-name');
  if (nameEl) nameEl.textContent = `${ctx.name} (${ctx.ticker})`;

  const sectorEl = document.getElementById('dossier-sector');
  if (sectorEl) sectorEl.textContent = `${ctx.sector} • ${ctx.industry}`;

  const priceEl = document.getElementById('dossier-market-price');
  if (priceEl) priceEl.textContent = `$${Number(ctx.currentPrice).toFixed(2)}`;

  const capEl = document.getElementById('dossier-market-cap');
  if (capEl) capEl.textContent = `Market Cap: ${ctx.marketCapFormatted}`;

  const pePegEl = document.getElementById('dossier-pe-peg');
  if (pePegEl) pePegEl.textContent = `P/E: ${ctx.peRatio}x | PEG: ${ctx.pegRatio}x`;

  const valStatusEl = document.getElementById('dossier-val-status');
  if (valStatusEl) valStatusEl.textContent = ctx.valuationStatus;

  const cfDebtEl = document.getElementById('dossier-cf-debt');
  if (cfDebtEl) cfDebtEl.textContent = `Cash: $${ctx.cashFormatted} | Debt: $${ctx.totalDebtFormatted}`;

  const riskBadge = document.getElementById('dossier-risk-badge');
  if (riskBadge) riskBadge.textContent = `${ctx.riskScore} Passed (${ctx.riskRating})`;

  // Render 14 Risk Checks Detail
  const checksContainer = document.getElementById('risk-checks-detail-container');
  if (checksContainer) {
    const checks = stage1.riskChecks || [];
    checksContainer.innerHTML = checks.map(c => {
      const isPass = c.status === 'PASS';
      const color = isPass ? 'var(--accent-emerald)' : 'var(--accent-red)';
      const icon = isPass ? '✅ Pass' : '❌ Fail';
      return `
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div>
            <div style="font-size: 0.82rem; font-weight: 600; color: var(--text-primary);">${c.question}</div>
            <div style="font-size: 0.76rem; color: var(--text-secondary); margin-top: 2px;">${c.summary}</div>
          </div>
          <span style="font-size: 0.75rem; font-weight: 700; color: ${color}; white-space: nowrap;">${icon}</span>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // STAGE 2: 5 ANALYSIS PERSONAS & DEBATE
  // -------------------------------------------------------------
  const personasGrid = document.getElementById('personas-cards-grid');
  if (personasGrid && stage2.personas) {
    const p = stage2.personas;
    const personaList = [
      { key: 'bull', obj: p.bullResearcher, badgeClass: 'badge-bull', icon: '🐂' },
      { key: 'bear', obj: p.bearResearcher, badgeClass: 'badge-bear', icon: '🐻' },
      { key: 'aggressive', obj: p.aggressiveRiskDebater, badgeClass: 'badge-aggressive', icon: '🚀' },
      { key: 'conservative', obj: p.conservativeRiskDebater, badgeClass: 'badge-conservative', icon: '🛡️' },
      { key: 'neutral', obj: p.neutralRiskArbiter, badgeClass: 'badge-neutral', icon: '⚖️' }
    ];

    personasGrid.innerHTML = personaList.map(item => {
      const data = item.obj;
      if (!data) return '';
      const aiPill = meta.aiAugmented 
        ? `<span style="font-size: 0.68rem; color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; background: rgba(16,185,129,0.12); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.25);">⚡ AI Persona</span>`
        : '';
      return `
        <div class="persona-card">
          <div class="persona-header">
            <div class="persona-title-group">
              <span class="persona-name">${item.icon} ${data.title}</span>
              <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                <span class="persona-badge ${item.badgeClass}">${data.badge}</span>
                ${aiPill}
              </div>
            </div>
            <span style="font-size: 0.72rem; font-weight: 700; color: var(--accent-blue);">${data.stance}</span>
          </div>

          <div class="persona-verdict-banner">
            Verdict: ${data.verdict}
          </div>

          <ul class="persona-points-list">
            ${data.coreCase.map(point => `<li>${point}</li>`).join('')}
          </ul>

          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
            Opinionated Summary:
          </div>
          <div class="persona-summary-box">
            "${data.opinionatedSummary}"
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Debate Rounds
  const debateContainer = document.getElementById('debate-rounds-container');
  if (debateContainer && stage2.debate?.rounds) {
    debateContainer.innerHTML = stage2.debate.rounds.map(round => `
      <div class="debate-round">
        <div class="round-header">
          <span>⚔️</span> ${round.title}
        </div>
        ${round.turns.map(turn => {
          let avatar = '🎙️';
          if (turn.speaker.includes('Bull')) avatar = '🐂';
          else if (turn.speaker.includes('Bear')) avatar = '🐻';
          else if (turn.speaker.includes('Aggressive')) avatar = '🚀';
          else if (turn.speaker.includes('Conservative')) avatar = '🛡️';
          else if (turn.speaker.includes('Neutral')) avatar = '⚖️';

          const rebuttalBadge = turn.rebuttalTo 
            ? `<span class="speech-rebuttal-tag">Rebuttal to ${turn.rebuttalTo}</span>` 
            : '';

          const aiTurnBadge = meta.aiAugmented
            ? `<span style="font-size: 0.65rem; color: #10b981; font-weight: 600; margin-left: auto;">⚡ Gemini AI</span>`
            : '';

          return `
            <div class="debate-speech">
              <div class="speaker-avatar">${avatar}</div>
              <div class="speech-bubble">
                <div class="speaker-meta">
                  <span class="speaker-name">${turn.speaker}</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">(${turn.role})</span>
                  ${rebuttalBadge}
                  ${aiTurnBadge}
                </div>
                <div class="speech-text">
                  ${turn.argument || turn.ruling}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `).join('');
  }

  // Debate Conclusion
  const debateConclusionText = document.getElementById('debate-conclusion-text');
  if (debateConclusionText && stage2.debate?.conclusion) {
    const c = stage2.debate.conclusion;
    debateConclusionText.innerHTML = `
      <strong>Key Contested Battleground:</strong> ${c.contestedBattleground}<br><br>
      <strong>Consensus Mandate Sent to Experts:</strong> ${c.verdictToExperts}
    `;
  }

  // -------------------------------------------------------------
  // STAGE 3: 4 EXPERT PERSONAS (BUFFETT, LYNCH, FISHER, DAMODARAN)
  // -------------------------------------------------------------
  const expertsGrid = document.getElementById('experts-cards-grid');
  if (expertsGrid && stage3.experts) {
    const exp = stage3.experts;
    const expertList = [
      { obj: exp.warrenBuffett, icon: '🛡️', badge: 'Moats & ROIC' },
      { obj: exp.peterLynch, icon: '📈', badge: 'PEG & Stalwarts' },
      { obj: exp.philipFisher, icon: '🔍', badge: 'Scuttlebutt & Tech Moats' },
      { obj: exp.aswathDamodaran, icon: '🏛️', badge: 'DCF Intrinsic Fair Value' }
    ];

    expertsGrid.innerHTML = expertList.map(item => {
      const e = item.obj;
      if (!e) return '';
      const expertAiTag = meta.aiAugmented
        ? `<span style="font-size: 0.68rem; color: #10b981; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; background: rgba(16,185,129,0.12); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.25);">⚡ Gemini AI</span>`
        : '';
      return `
        <div class="persona-card" style="border-top: 3px solid var(--accent-blue);">
          <div class="persona-header">
            <div class="persona-title-group">
              <span class="persona-name">${item.icon} ${e.name}</span>
              <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                <span style="font-size: 0.72rem; color: var(--text-muted);">${e.role}</span>
                ${expertAiTag}
              </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <span class="persona-badge badge-neutral">${item.badge}</span>
              <span style="font-size: 0.68rem; color: var(--accent-blue); background: rgba(59,130,246,0.1); padding: 2px 6px; border-radius: 4px; font-weight: 600;">Audited 14 Risk Checks (${ctx.riskScore || 'Passed'})</span>
            </div>
          </div>

          <div style="font-size: 0.75rem; color: var(--accent-blue); font-weight: 600;">
            Philosophy: ${e.philosophy}
          </div>

          <div class="persona-verdict-banner">
            Stance: ${e.stance} • ${e.verdict}
          </div>

          <ul class="persona-points-list">
            ${e.caseAnalysis.map(pt => `<li>${pt}</li>`).join('')}
          </ul>

          <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
            Expert's Opinionated Summary:
          </div>
          <div class="persona-summary-box">
            "${e.opinionatedSummary}"
          </div>
        </div>
      `;
    }).join('');
  }

  // -------------------------------------------------------------
  // STAGE 4: LEGENDARY EXPERTS DEBATE (BUFFETT vs LYNCH vs FISHER vs DAMODARAN)
  // -------------------------------------------------------------
  const expDebateContainer = document.getElementById('experts-debate-rounds-container');
  if (expDebateContainer && stage4.rounds) {
    expDebateContainer.innerHTML = stage4.rounds.map(round => `
      <div class="debate-round">
        <div class="round-header">
          <span>⚔️</span> ${round.title}
        </div>
        ${round.turns.map(turn => {
          let avatar = '🎙️';
          if (turn.speaker.includes('Buffett')) avatar = '🛡️';
          else if (turn.speaker.includes('Lynch')) avatar = '📈';
          else if (turn.speaker.includes('Fisher')) avatar = '🔍';
          else if (turn.speaker.includes('Damodaran')) avatar = '🏛️';

          const rebuttalBadge = turn.rebuttalTo 
            ? `<span class="speech-rebuttal-tag" style="background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.3); color: #10b981;">Rebuttal to ${turn.rebuttalTo}</span>` 
            : '';

          const aiTurnBadge = meta.aiAugmented
            ? `<span style="font-size: 0.65rem; color: #10b981; font-weight: 600; margin-left: auto;">⚡ Gemini AI</span>`
            : '';

          return `
            <div class="debate-speech">
              <div class="speaker-avatar">${avatar}</div>
              <div class="speech-bubble" style="border-left: 3px solid rgba(16, 185, 129, 0.4);">
                <div class="speaker-meta">
                  <span class="speaker-name">${turn.speaker}</span>
                  <span style="font-size: 0.72rem; color: var(--text-muted);">(${turn.role})</span>
                  ${rebuttalBadge}
                  ${aiTurnBadge}
                </div>
                <div class="speech-text">
                  ${turn.argument || turn.rebuttal || turn.synthesis || ''}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `).join('');
  }

  // Experts Debate Conclusion
  const expDebateConclusionText = document.getElementById('experts-debate-conclusion-text');
  if (expDebateConclusionText && stage4.conclusion) {
    const c = stage4.conclusion;
    if (typeof c === 'string') {
      expDebateConclusionText.textContent = c;
    } else {
      const consensusList = Array.isArray(c.expertConsensusPoints)
        ? `<ul style="margin: 8px 0 12px 18px; padding: 0;">${c.expertConsensusPoints.map(pt => `<li>${pt}</li>`).join('')}</ul>`
        : '';
      expDebateConclusionText.innerHTML = `
        <strong>Unanimous Consensus Points:</strong>${consensusList}
        <strong>Key Contested Battleground:</strong> ${c.contestedBattleground || 'Valuation multiples vs compounding runway'}<br><br>
        <strong>Irreconcilable Doctrinal Friction:</strong> ${c.irreconcilableDifferences || 'Valuation multiple tolerance'}<br><br>
        <strong>Final Mandate Transmitted to Senior Arbiter Graham:</strong> ${c.verdictToSeniorArbiter || c.verdictToExperts || ''}
      `;
    }
  }

  // -------------------------------------------------------------
  // STAGE 5: BENJAMIN GRAHAM MASTER VERDICT
  // -------------------------------------------------------------
  const gradeEl = document.getElementById('graham-grade');
  if (gradeEl) gradeEl.textContent = `GRADE ${stage5.compositeGrade || 'A-'}`;

  const recEl = document.getElementById('graham-rec');
  if (recEl) recEl.textContent = stage5.recommendation || 'PRUDENT ACCUMULATION';

  const mosEl = document.getElementById('graham-mos');
  if (mosEl) mosEl.textContent = stage5.marginOfSafetyStatus || 'MARGIN OF SAFETY ASSESSED';

  const entryEl = document.getElementById('graham-entry');
  if (entryEl) entryEl.textContent = `$${Number(stage5.maxPrudentEntryPrice || 0).toFixed(2)}`;

  const allocEl = document.getElementById('graham-alloc');
  if (allocEl) allocEl.textContent = stage5.suggestedPortfolioAllocationPercent || '5.0%';

  const essayEl = document.getElementById('graham-essay');
  if (essayEl) {
    const aiPrefix = meta.aiAugmented ? `[⚡ Synthesized by Benjamin Graham Persona Engine (Gemini 2.5 Flash)]\n\n` : '';
    essayEl.textContent = `${aiPrefix}${stage5.masterOpinionatedSummary || 'Synthesis ready.'}`;
  }

  const invalidationList = document.getElementById('graham-invalidation-list');
  if (invalidationList && stage5.criticalInvalidationTriggers) {
    invalidationList.innerHTML = stage5.criticalInvalidationTriggers.map(t => `
      <li style="color: var(--text-secondary);">${t}</li>
    `).join('');
  }
}

// Auto-run MSFT on first page load
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tickerParam = urlParams.get('ticker') || 'MSFT';
  if (searchInput) searchInput.value = tickerParam;
  runCompanyAnalysis(tickerParam);
});

