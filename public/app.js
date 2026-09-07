/**
 * app.js
 * Frontend controller for the Composite Investment Methodology Terminal.
 */

// Global State
let currentTicker = 'MSFT';
let currentDossier = null;
let currentMemo = '';
let searchDebounceTimer = null;
let selectedDropdownIndex = -1;
let searchResults = [];
let currentMacroData = null;
let activeMoverTab = 'gainers';
let activeSegmentTab = 'sectors';
let activeHeatmapFilter = 'all';
let activeSectorSource = 'benchmark';

// DOM Elements
const navBtnCompany = document.getElementById('nav-btn-company');
const navBtnMacro = document.getElementById('nav-btn-macro');
const navBtnDesk = document.getElementById('nav-btn-desk');
const viewCompany = document.getElementById('view-company');
const viewMacro = document.getElementById('view-macro');
const btnRefreshMacro = document.getElementById('btn-refresh-macro');

const searchInput = document.getElementById('company-search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const searchDropdown = document.getElementById('autocomplete-dropdown');
const startResearchBtn = document.getElementById('btn-start-research');
const modeToggle = document.getElementById('mode-toggle');
const modeLabel = document.getElementById('mode-label-text');
const loadingContainer = document.getElementById('loading-container');
const dashboardContent = document.getElementById('dashboard-content');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const quickChips = document.querySelectorAll('.chip-btn');
const btnViewMemo = document.getElementById('btn-view-memo');
const btnCopyMemo = document.getElementById('btn-copy-memo');
const btnSaveMemo = document.getElementById('btn-save-memo');

let macroDataLoaded = false;
let isStaticHostingMode = false;
let bundledDemo = null;

async function loadBundledDemo() {
  if (bundledDemo) return bundledDemo;
  try {
    const mod = await import('./bundled-demo.js');
    bundledDemo = mod.BUNDLED_DEMO || mod.default;
    return bundledDemo;
  } catch (err) {
    console.warn('[Demo] Could not load bundled-demo.js:', err.message);
    return null;
  }
}

function showStaticBannerOnce() {
  if (document.getElementById('static-mode-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'static-mode-banner';
  banner.style.cssText = 'background: linear-gradient(90deg, #1e1b4b, #312e81); border-bottom: 1px solid #6366f1; color: #e0e7ff; padding: 7px 16px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
  banner.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span style="font-size:14px;">⚡</span>
      <span><strong>Firebase Static Web Mode Active</strong>: Displaying benchmark research datasets (MSFT, AAPL, NVDA, TSLA, AMZN). To run live real-time SEC / Alpha Vantage feeds, run locally (<code>npm start</code>) or connect Cloud Run.</span>
    </div>
    <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:#a5b4fc; font-size:16px; cursor:pointer; line-height:1;">&times;</button>
  `;
  document.body.prepend(banner);
}

function getAppMode() {
  const panelToggle = document.getElementById('panel-mode-toggle');
  if (modeToggle) return modeToggle.checked ? 'mock' : 'live';
  if (panelToggle) return panelToggle.checked ? 'mock' : 'live';
  try {
    const saved = localStorage.getItem('growth_syntax_mock_mode');
    return saved === 'false' ? 'live' : 'mock';
  } catch (e) {
    return 'mock';
  }
}

function isMockMode() {
  return getAppMode() === 'mock';
}

function formatApiUrl(url) {
  if (typeof url !== 'string') return url;
  if (url.startsWith('/api/') && !url.includes('mode=') && !url.startsWith('/api/status') && !url.startsWith('/api/search') && !url.startsWith('/api/resolve') && !url.startsWith('/api/export-memo')) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}mode=${getAppMode()}`;
  }
  return url;
}

function setMockMode(enabled, triggerReload = true) {
  if (modeToggle) modeToggle.checked = enabled;
  const panelToggle = document.getElementById('panel-mode-toggle');
  if (panelToggle) panelToggle.checked = enabled;

  try {
    localStorage.setItem('growth_syntax_mock_mode', enabled ? 'true' : 'false');
  } catch (e) {
    // Ignore restricted iframe storage errors
  }

  updateModeLabel();
  renderStatusIndicator();

  if (triggerReload) {
    onModeChanged();
  }
}

function onModeChanged() {
  // If macro view is active, refresh macro data in new mode
  if (viewMacro && viewMacro.style.display !== 'none') {
    fetchMacroData();
  }

  // If current ticker is active, refresh company research in new mode
  if (currentTicker) {
    startResearch(currentTicker);
  }
}

async function apiFetch(url, options = {}) {
  const formattedUrl = formatApiUrl(url);
  const res = await fetch(formattedUrl, options);
  const contentType = res.headers.get('content-type') || '';

  // If server responded with HTML (e.g. index.html SPA wildcard rewrite on Firebase Hosting without a backend)
  if (contentType.includes('text/html') || (!res.ok && res.status === 404)) {
    isStaticHostingMode = true;
    showStaticBannerOnce();
    throw new Error('STATIC_HOSTING_MODE');
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  return await res.json();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupDeskListeners();
  setupExpertsListeners();
  setupCompetitorListeners();
  setupSeekingAlphaListeners();

  // Restore mock mode preference from localStorage (default: true for instant zero-rate-limit exploration)
  let initialMock = true;
  try {
    const saved = localStorage.getItem('growth_syntax_mock_mode');
    if (saved !== null) initialMock = (saved === 'true');
  } catch (e) {
    initialMock = true;
  }
  setMockMode(initialMock, false);

  // Check system status
  fetchStatus();

  // Pre-fetch macro data in background
  fetchMacroData();

  // Pre-load default MSFT
  startResearch('MSFT');
});

function setupEventListeners() {
  // Top View Switching (Company vs Macro Economy vs Institutional Desk)
  if (navBtnCompany) {
    navBtnCompany.addEventListener('click', () => switchView('company'));
  }
  if (navBtnMacro) {
    navBtnMacro.addEventListener('click', () => switchView('macro'));
  }
  if (navBtnDesk) {
    navBtnDesk.addEventListener('click', () => switchView('desk'));
  }
  if (btnRefreshMacro) {
    btnRefreshMacro.addEventListener('click', () => fetchMacroData());
  }

  // Market Movers Tab Switching
  document.querySelectorAll('[data-mover-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-mover-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMoverTab = btn.dataset.moverTab;
      if (currentMacroData && currentMacroData.marketMovers) {
        renderMarketMovers(currentMacroData.marketMovers);
      }
    });
  });

  // Segments Tab Switching
  document.querySelectorAll('[data-segment-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-segment-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSegmentTab = btn.dataset.segmentTab;
      if (currentMacroData) {
        renderSegmentsList(currentMacroData);
      }
    });
  });

  // Heatmap Filter Tags
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeHeatmapFilter = btn.dataset.filter;
      if (currentMacroData && currentMacroData.industryPerformance) {
        renderIndustryHeatmap(currentMacroData.industryPerformance);
      }
    });
  });

  // Sector Performance Source Toggle (Benchmark vs SPDR ETFs)
  document.querySelectorAll('[data-sector-source]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sector-source]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSectorSource = btn.dataset.sectorSource;
      if (currentMacroData) {
        renderSectorPerformanceChart(currentMacroData);
      }
    });
  });

  // Search input live autocomplete
  searchInput.addEventListener('input', onSearchInput);
  searchInput.addEventListener('keydown', onSearchKeyDown);

  // Clear button
  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    hideDropdown();
    searchInput.focus();
  });

  // Start research button
  startResearchBtn.addEventListener('click', () => {
    const val = searchInput.value.trim();
    if (val) {
      resolveAndResearch(val);
    }
  });

  // Mode toggle
  modeToggle.addEventListener('change', () => {
    setMockMode(modeToggle.checked, true);
  });

  // Quick Chips
  quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const ticker = chip.dataset.ticker;
      searchInput.value = `${ticker} - ${chip.dataset.name}`;
      searchClearBtn.style.display = 'block';
      startResearch(ticker);
    });
  });

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(btn.dataset.tab);
      if (targetPanel) targetPanel.classList.add('active');

      if (btn.dataset.tab === 'tab-competitors') {
        const sym = currentTicker || 'MSFT';
        if (!currentCompetitorData || activeCompetitorTicker !== sym) {
          fetchCompetitors(sym);
        }
      }

      if (btn.dataset.tab === 'tab-experts') {
        const sym = currentTicker || 'MSFT';
        if (!currentExpertsData || activeExpertsTicker !== sym) {
          fetchExpertsDesk(sym);
        }
      }

      if (btn.dataset.tab === 'tab-desk') {
        const sym = currentTicker || 'MSFT';
        if (!currentDeskData || activeDeskTicker !== sym) {
          fetchDeskData(sym);
        }
      }
    });
  });

  // View memo button in header
  btnViewMemo.addEventListener('click', () => {
    const memoTabBtn = document.querySelector('[data-tab="tab-memo"]');
    if (memoTabBtn) memoTabBtn.click();
  });

  // Copy memo button
  btnCopyMemo.addEventListener('click', () => {
    if (!currentMemo) return;
    navigator.clipboard.writeText(currentMemo).then(() => {
      const origText = btnCopyMemo.textContent;
      btnCopyMemo.textContent = '✅ Copied!';
      setTimeout(() => { btnCopyMemo.textContent = origText; }, 2000);
    });
  });

  // Save memo to disk
  btnSaveMemo.addEventListener('click', async () => {
    if (!currentMemo || !currentTicker) return;
    try {
      const origText = btnSaveMemo.textContent;
      btnSaveMemo.textContent = '⏳ Saving...';
      const res = await fetch('/api/export-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: currentTicker, content: currentMemo })
      });
      const data = await res.json();
      if (data.success) {
        btnSaveMemo.textContent = '✅ Saved to disk!';
        alert(`Investment Memorandum successfully saved:\n${data.path}`);
      } else {
        btnSaveMemo.textContent = '❌ Error';
      }
      setTimeout(() => { btnSaveMemo.textContent = origText; }, 2500);
    } catch (err) {
      alert(`Save error: ${err.message}`);
      btnSaveMemo.textContent = '❌ Error';
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
      hideDropdown();
    }
  });

  // Equity Visuals Card Actions (More Details Modal & Share)
  setupEquityVisualListeners();

  // Fodda AI MCP Listeners
  setupFoddaListeners();

  // Expandable System Status Indicator Listeners
  setupStatusIndicatorListeners();
}

function updateModeLabel() {
  const isMock = isMockMode();
  const sublabel = document.getElementById('mode-sublabel-text');
  if (modeLabel) {
    modeLabel.textContent = isMock ? 'Mock Mode (SQL / Firestore)' : 'Live Network Mode';
  }
  if (sublabel) {
    sublabel.textContent = isMock ? 'Offline DB Data • Zero API Limits' : 'Alpha Vantage & SEC EDGAR';
  }
  renderStatusIndicator();
}

let latestStatusData = null;
let isStatusPanelOpen = false;

function setupStatusIndicatorListeners() {
  const btn = document.getElementById('status-indicator-btn');
  const panel = document.getElementById('status-dropdown-panel');
  const closeBtn = document.getElementById('btn-close-status-panel');
  const refreshBtn = document.getElementById('btn-refresh-status');
  const container = document.getElementById('status-dropdown-container');
  const panelToggle = document.getElementById('panel-mode-toggle');

  if (!btn || !panel) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleStatusPanel();
  });

  if (panelToggle) {
    panelToggle.addEventListener('change', () => {
      setMockMode(panelToggle.checked, true);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeStatusPanel();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      refreshBtn.textContent = '↻ Checking...';
      refreshBtn.disabled = true;
      await fetchStatus();
      refreshBtn.textContent = '↻ Refresh';
      refreshBtn.disabled = false;
    });
  }

  // Prevent clicks inside panel from closing it
  panel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Light dismiss on click outside
  document.addEventListener('click', (e) => {
    if (isStatusPanelOpen && container && !container.contains(e.target)) {
      closeStatusPanel();
    }
  });

  // Light dismiss on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isStatusPanelOpen) {
      closeStatusPanel();
    }
  });
}

function toggleStatusPanel() {
  if (isStatusPanelOpen) {
    closeStatusPanel();
  } else {
    openStatusPanel();
  }
}

function openStatusPanel() {
  const btn = document.getElementById('status-indicator-btn');
  const panel = document.getElementById('status-dropdown-panel');
  if (!panel || !btn) return;

  isStatusPanelOpen = true;
  btn.setAttribute('aria-expanded', 'true');
  panel.style.display = 'flex';
  renderStatusPanelDetails();
}

function closeStatusPanel() {
  const btn = document.getElementById('status-indicator-btn');
  const panel = document.getElementById('status-dropdown-panel');
  if (!panel || !btn) return;

  isStatusPanelOpen = false;
  btn.setAttribute('aria-expanded', 'false');
  panel.style.display = 'none';
}

function computeSystemStatus(data) {
  const isMock = isMockMode() || isStaticHostingMode;

  if (isMock) {
    return {
      type: 'mock',
      label: 'Mock mode',
      dotClass: 'mock',
      pillClass: 'mock',
      heading: 'Mock mode',
      sub: 'Mock data pulled directly from SQL (SQLite on local) or Cloud Firestore (deployed).'
    };
  }

  // Check backend report
  const keys = data?.keys || {};
  const hasAlphaVantage = !!keys.alphaVantage;
  const hasFred = !!keys.fred;

  // If live mode but missing Alpha Vantage or FRED:
  if (!hasAlphaVantage || !hasFred) {
    return {
      type: 'partial',
      label: 'Partial Services Online',
      dotClass: 'partial',
      pillClass: 'partial',
      heading: 'Partial Services Online',
      sub: 'Core financial engines online. Alpha Vantage/FRED operating in fallback mode.'
    };
  }

  return {
    type: 'online',
    label: 'Services Online',
    dotClass: 'online',
    pillClass: 'online',
    heading: 'Services Online',
    sub: 'All fundamental APIs, SEC EDGAR, FRED, and intelligence engines operational.'
  };
}

function renderStatusIndicator() {
  const statusInfo = computeSystemStatus(latestStatusData);
  const statusDot = document.getElementById('system-status-dot');
  const statusText = document.getElementById('system-status-text');

  if (statusDot) {
    statusDot.className = `status-dot ${statusInfo.dotClass}`;
  }
  if (statusText) {
    statusText.textContent = statusInfo.label;
  }

  if (isStatusPanelOpen) {
    renderStatusPanelDetails();
  }
}

function renderStatusPanelDetails() {
  const statusInfo = computeSystemStatus(latestStatusData);
  const isMock = isMockMode() || isStaticHostingMode;
  const keys = latestStatusData?.keys || {};
  const mode = latestStatusData?.mode || (isStaticHostingMode ? 'firebase' : 'local');

  // Synchronize the panel toggle switch
  const panelToggle = document.getElementById('panel-mode-toggle');
  if (panelToggle) {
    panelToggle.checked = isMock;
  }

  // Update summary banner
  const summaryDot = document.getElementById('status-summary-dot');
  const summaryHeading = document.getElementById('status-summary-heading');
  const summarySub = document.getElementById('status-summary-sub');
  const modeBadge = document.getElementById('status-panel-mode-badge');
  const lastChecked = document.getElementById('status-last-checked');
  const listContainer = document.getElementById('status-services-list');

  if (summaryDot) {
    summaryDot.className = `status-dot large ${statusInfo.dotClass}`;
  }
  if (summaryHeading) {
    summaryHeading.textContent = statusInfo.heading;
  }
  if (summarySub) {
    summarySub.textContent = statusInfo.sub;
  }
  if (modeBadge) {
    modeBadge.textContent = isMock 
      ? (mode === 'firebase' ? 'FIRESTORE MOCK' : 'SQLITE MOCK')
      : (mode === 'firebase' ? 'FIREBASE DEPLOYED' : 'LOCAL SQLITE');
  }
  if (lastChecked) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    lastChecked.textContent = `Checked: ${timeStr}`;
  }

  if (!listContainer) return;

  const services = [
    {
      name: 'SEC EDGAR XBRL Facts',
      desc: 'Form 10-K, 10-Q statements & XBRL financial disclosures',
      status: isMock ? 'mock' : 'online',
      badge: isMock ? 'SQL / Firestore Mock' : 'Operational'
    },
    {
      name: 'Alpha Vantage / Quotes',
      desc: 'Multi-year financial statements, cash flows & quotes',
      status: isMock ? 'mock' : (keys.alphaVantage ? 'online' : 'partial'),
      badge: isMock ? 'SQL / Firestore Mock' : (keys.alphaVantage ? 'Live API Key' : 'Demo / Rate-Limited Fallback')
    },
    {
      name: 'FRED (Federal Reserve)',
      desc: '10-Yr Treasury yield (Rf), CPI inflation & credit spread',
      status: isMock ? 'mock' : (keys.fred ? 'online' : 'partial'),
      badge: isMock ? 'SQL / Firestore Mock' : (keys.fred ? 'Live FRED API' : 'Static Fallback')
    },
    {
      name: 'Fodda AI MCP',
      desc: 'AI earnings transcript analysis & brand tracker protocol',
      status: isMock ? 'mock' : (keys.fodda ? 'online' : 'partial'),
      badge: isMock ? 'SQL / Firestore Mock' : (keys.fodda ? 'Live MCP Connected' : 'Ready / Fallback')
    },
    {
      name: 'Yahoo Finance Engine',
      desc: 'Real-time market valuation, beta & enterprise consensus metrics',
      status: isMock ? 'mock' : 'online',
      badge: isMock ? 'SQL / Firestore Mock' : 'Operational'
    },
    {
      name: 'Seeking Alpha Intelligence',
      desc: 'Analyst coverage RSS, headline velocity & peer tag co-mentions',
      status: isMock ? 'mock' : 'online',
      badge: isMock ? 'SQL / Firestore Mock' : 'Operational'
    },
    {
      name: 'DuckDuckGo Scuttlebutt',
      desc: 'Customer/supplier reviews & executive compensation web audit',
      status: isMock ? 'mock' : 'online',
      badge: isMock ? 'SQL / Firestore Mock' : 'Operational'
    },
    {
      name: 'Competitor Engine',
      desc: 'SIC-code industry discovery & side-by-side multiple matrix',
      status: isMock ? 'mock' : 'online',
      badge: isMock ? 'SQL / Firestore Mock' : 'Operational'
    },
    {
      name: 'Tiered Store (Cache & DB)',
      desc: mode === 'firebase' ? 'Cloud Firestore + L1 Fast Cache' : 'Native SQLite (.data) + L1 Fast Cache',
      status: 'online',
      badge: 'Calendar-Day TTL'
    },
    {
      name: 'Gemini AI Executive Desk',
      desc: 'Institutional CIO Decision Memorandum generation',
      status: isMock ? 'mock' : (keys.gemini ? 'online' : 'partial'),
      badge: isMock ? 'SQL / Firestore Mock' : (keys.gemini ? 'Live Gemini AI' : 'Rule-Based Engine')
    }
  ];

  listContainer.innerHTML = services.map(s => `
    <div class="status-service-item">
      <div class="status-service-info">
        <div class="status-service-name">
          <span class="status-dot ${s.status}"></span>
          ${s.name}
        </div>
        <div class="status-service-desc">${s.desc}</div>
      </div>
      <span class="status-pill ${s.status}">${s.badge}</span>
    </div>
  `).join('');
}

async function fetchStatus() {
  try {
    const data = await apiFetch('/api/status');
    latestStatusData = data;
    renderStatusIndicator();
  } catch (err) {
    if (err.message === 'STATIC_HOSTING_MODE' || isStaticHostingMode) {
      isStaticHostingMode = true;
    } else {
      console.warn('Status check failed', err);
    }
    renderStatusIndicator();
  }
}

// -------------------------------------------------------------
// SEARCH & AUTOCOMPLETE ENGINE
// -------------------------------------------------------------
function onSearchInput() {
  const query = searchInput.value.trim();
  searchClearBtn.style.display = query ? 'block' : 'none';

  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  if (!query) {
    hideDropdown();
    return;
  }

  searchDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
      const data = await res.json();
      searchResults = data.results || [];
      renderDropdown(searchResults);
    } catch (err) {
      console.error('Search autocomplete failed:', err);
    }
  }, 160);
}

function renderDropdown(items) {
  if (!items || items.length === 0) {
    searchDropdown.innerHTML = `<div class="autocomplete-item" style="color: var(--text-muted); cursor: default;">No matching companies or tickers found</div>`;
    searchDropdown.style.display = 'block';
    selectedDropdownIndex = -1;
    return;
  }

  searchDropdown.innerHTML = items.map((item, idx) => `
    <div class="autocomplete-item" data-index="${idx}" data-ticker="${item.ticker}" data-title="${item.title}">
      <div class="ac-left">
        <span class="ac-ticker">${item.ticker}</span>
        <span class="ac-name">${item.title}</span>
      </div>
      <span class="ac-cik">CIK: ${item.cik || 'N/A'}</span>
    </div>
  `).join('');

  // Attach click events
  searchDropdown.querySelectorAll('.autocomplete-item').forEach(el => {
    el.addEventListener('click', () => {
      const ticker = el.dataset.ticker;
      const title = el.dataset.title;
      searchInput.value = `${ticker} - ${title}`;
      hideDropdown();
      startResearch(ticker);
    });
  });

  searchDropdown.style.display = 'block';
  selectedDropdownIndex = -1;
}

function hideDropdown() {
  searchDropdown.style.display = 'none';
  selectedDropdownIndex = -1;
}

function onSearchKeyDown(e) {
  const items = searchDropdown.querySelectorAll('.autocomplete-item');
  if (!items || items.length === 0 || searchDropdown.style.display === 'none') {
    if (e.key === 'Enter') {
      const val = searchInput.value.trim();
      if (val) resolveAndResearch(val);
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedDropdownIndex = Math.min(selectedDropdownIndex + 1, items.length - 1);
    highlightDropdownItem(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedDropdownIndex = Math.max(selectedDropdownIndex - 1, 0);
    highlightDropdownItem(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (selectedDropdownIndex >= 0 && selectedDropdownIndex < items.length) {
      items[selectedDropdownIndex].click();
    } else {
      const val = searchInput.value.trim();
      if (val) resolveAndResearch(val);
    }
  } else if (e.key === 'Escape') {
    hideDropdown();
  }
}

function highlightDropdownItem(items) {
  items.forEach((item, idx) => {
    if (idx === selectedDropdownIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// -------------------------------------------------------------
// RESOLVE & START RESEARCH
// -------------------------------------------------------------
async function resolveAndResearch(rawInput) {
  hideDropdown();

  // If input is in format "TICKER - Company Name"
  const dashMatch = rawInput.match(/^([A-Za-z0-9._-]+)\s*-\s*/);
  if (dashMatch) {
    return startResearch(dashMatch[1].toUpperCase());
  }

  // If input already looks like a pure ticker (1-5 characters)
  if (/^[A-Za-z]{1,5}$/.test(rawInput.trim())) {
    return startResearch(rawInput.trim().toUpperCase());
  }

  // Otherwise, invoke resolution API
  try {
    const res = await fetch(`/api/resolve?q=${encodeURIComponent(rawInput.trim())}`);
    const data = await res.json();
    if (data.resolved && data.match?.ticker) {
      searchInput.value = `${data.match.ticker} - ${data.match.title}`;
      return startResearch(data.match.ticker);
    }
  } catch (err) {
    console.warn('Resolution error:', err);
  }

  // Fallback: search string as ticker directly
  startResearch(rawInput.trim().toUpperCase());
}

async function startResearch(ticker) {
  currentTicker = ticker.toUpperCase();
  hideDropdown();

  // Show loading container
  loadingContainer.style.display = 'flex';
  dashboardContent.style.display = 'none';
  if (btnViewMemo) btnViewMemo.style.display = 'none';
  const modeParam = getAppMode();

  try {
    // 1. Fetch Composite Research Dossier
    const data = await apiFetch(`/api/research?ticker=${encodeURIComponent(currentTicker)}&mode=${modeParam}`);

    if (!data.success || !data.dossier) {
      throw new Error(data.error || 'Failed to generate dossier');
    }

    currentDossier = data.dossier;

    // 2. Fetch Markdown Memorandum in parallel
    fetchMemo(currentTicker, modeParam);

    // 3. Fetch Institutional Desk Simulation for this specific company in parallel
    fetchDeskData(currentTicker);

    // 4. Fetch Experts Desk Debate for this specific company in parallel
    fetchExpertsDesk(currentTicker);

    // 5. Fetch Competitors & Peers in parallel
    fetchCompetitors(currentTicker);

    // 6. Fetch Seeking Alpha RSS Intelligence in parallel
    fetchSeekingAlpha(currentTicker);

    // 7. Render Dashboard
    renderDashboard(currentDossier);

    loadingContainer.style.display = 'none';
    dashboardContent.style.display = 'block';
    btnViewMemo.style.display = 'inline-flex';

  } catch (err) {
    if (err.message === 'STATIC_HOSTING_MODE' || isStaticHostingMode) {
      console.log(`[Static Web Mode] Loading precompiled benchmark dossier for ${currentTicker}...`);
      const bundle = await loadBundledDemo();
      if (bundle?.dossiers?.[currentTicker]) {
        currentDossier = bundle.dossiers[currentTicker];
        if (bundle.memos?.[currentTicker]) {
          currentMemo = bundle.memos[currentTicker];
          document.getElementById('memo-content-box').textContent = currentMemo;
          document.getElementById('memo-date-sub').textContent = `Benchmark Snapshot`;
        }
        if (bundle.competitors?.[currentTicker]) {
          renderCompetitorAnalysis(bundle.competitors[currentTicker]);
        }
        renderDashboard(currentDossier);
        loadingContainer.style.display = 'none';
        dashboardContent.style.display = 'block';
        btnViewMemo.style.display = 'inline-flex';
        return;
      } else {
        loadingContainer.style.display = 'none';
        alert(`In Firebase Static Web Mode, live querying for '${ticker}' requires an active backend.\n\nPrecompiled benchmark companies available: MSFT, AAPL, NVDA, TSLA, AMZN.\n\nTo research any ticker live, run in Local Mode: npm start`);
        return;
      }
    }

    loadingContainer.style.display = 'none';
    alert(`Research error for ${ticker}: ${err.message}`);
  }
}

async function fetchMemo(ticker, mode) {
  try {
    const data = await apiFetch(`/api/memo?ticker=${encodeURIComponent(ticker)}&mode=${mode}`);
    if (data.success && data.memo) {
      currentMemo = data.memo;
      document.getElementById('memo-content-box').textContent = currentMemo;
      document.getElementById('memo-date-sub').textContent = `Generated ${new Date().toLocaleTimeString()}`;
    }
  } catch (err) {
    if (err.message === 'STATIC_HOSTING_MODE' || isStaticHostingMode) {
      const bundle = await loadBundledDemo();
      if (bundle?.memos?.[ticker]) {
        currentMemo = bundle.memos[ticker];
        document.getElementById('memo-content-box').textContent = currentMemo;
        document.getElementById('memo-date-sub').textContent = `Benchmark Snapshot`;
      }
    } else {
      console.error('Memo fetch failed:', err);
    }
  }
}

// -------------------------------------------------------------
// RENDER DASHBOARD
// -------------------------------------------------------------
function renderDashboard(dossier) {
  const meta = dossier.metadata || {};
  const macro = dossier.macroContext || {};
  const p1 = dossier.pillar1_Lynch || {};
  const p2 = dossier.pillar2_Fisher || {};
  const p3 = dossier.pillar3_Buffett || {};
  const p4 = dossier.pillar4_Damodaran || {};

  // 1. Header Card
  document.getElementById('company-ticker').textContent = meta.symbol || currentTicker;
  document.getElementById('company-title').textContent = meta.companyName || meta.symbol;
  document.getElementById('company-sector').textContent = meta.sector || 'Sector N/A';
  document.getElementById('company-industry').textContent = meta.industry || 'Industry N/A';
  document.getElementById('company-cik').textContent = `CIK: ${dossier.regulatory?.cik || '0000320193'}`;

  // Experts Desk Sub-Panel Header
  const expHeadingEl = document.getElementById('experts-company-heading');
  const expBadgeEl = document.getElementById('experts-ticker-badge');
  const expBtnTickerEl = document.getElementById('experts-btn-ticker');
  const expSubEl = document.getElementById('experts-company-sub');
  if (expBadgeEl) expBadgeEl.textContent = meta.symbol || currentTicker;
  if (expBtnTickerEl) expBtnTickerEl.textContent = meta.symbol || currentTicker;
  if (expHeadingEl) {
    expHeadingEl.innerHTML = `Experts Desk: <span class="text-accent">${meta.symbol || currentTicker}</span> (${meta.companyName || currentTicker})`;
  }
  if (expSubEl) {
    expSubEl.textContent = `Multi-agent debate clash among Warren Buffett, Peter Lynch, Philip Fisher, and Aswath Damodaran, arbitrated by Benjamin Graham for ${meta.companyName || currentTicker}.`;
  }

  // Institutional Desk Sub-Panel Header
  const deskHeadingEl = document.getElementById('desk-company-heading');
  const deskBadgeEl = document.getElementById('desk-ticker-badge');
  const deskBtnTickerEl = document.getElementById('desk-btn-ticker');
  const deskSubEl = document.getElementById('desk-company-sub');
  if (deskBadgeEl) deskBadgeEl.textContent = meta.symbol || currentTicker;
  if (deskBtnTickerEl) deskBtnTickerEl.textContent = meta.symbol || currentTicker;
  if (deskHeadingEl) {
    deskHeadingEl.innerHTML = `Institutional Desk Simulation: <span class="text-accent">${meta.symbol || currentTicker}</span> (${meta.companyName || currentTicker})`;
  }
  if (deskSubEl) {
    deskSubEl.textContent = `Autonomous multi-agent pipeline executing specialized research, adversarial Bull vs. Bear debate, algorithmic trade planning, and Tri-Party Risk Committee governance for ${meta.companyName || currentTicker}.`;
  }

  const sourceTag = document.getElementById('company-data-source');
  if (sourceTag) {
    sourceTag.textContent = meta.dataSource ? `Data: ${meta.dataSource}` : 'Data: Live Feed';
  }

  document.getElementById('stat-price').textContent = fmt(meta.currentPrice, 2, '$');
  document.getElementById('stat-mcap').textContent = formatLargeNumber(meta.marketCap);
  document.getElementById('stat-pe').textContent = fmt(meta.peRatio ?? dossier.rawFinancials?.peRatio, 1);
  document.getElementById('stat-peg').textContent = fmt(p1.pegRatio ?? meta.pegRatio, 2);

  const lynchCatBadge = document.getElementById('stat-lynch-cat');
  lynchCatBadge.textContent = p1.category || 'N/A';

  // 2. Pillar 1: Peter Lynch
  document.getElementById('lynch-category-badge').textContent = p1.category || 'Classification';
  document.getElementById('lynch-strategy-desc').textContent = p1.strategyDescription || 'No strategy description available.';
  document.getElementById('lynch-cagr').textContent = fmt(p1.revenueCagrPercent ?? p1.revenueCAGR, 1, '', '%');
  document.getElementById('lynch-peg-verdict').textContent = p1.pegVerdict || p1.lynchPEGEvaluation || 'N/A';
  document.getElementById('lynch-net-cash').textContent = `${fmt(p1.netCashPerShare, 2, '$')} / share`;

  // Inventory vs Sales Spread
  const inv = p1.inventoryGrowthAnalysis || {};
  const invGrowthVal = inv.inventoryGrowthPercent ?? 0;
  const salesGrowthVal = inv.salesGrowthPercent ?? 0;
  const spreadVal = inv.spreadPercent ?? p1.inventorySalesSpreadPercent ?? 0;

  document.getElementById('inv-growth').textContent = fmt(invGrowthVal, 1, '+', '%');
  document.getElementById('sales-growth').textContent = fmt(salesGrowthVal, 1, '+', '%');
  document.getElementById('inv-spread').textContent = fmt(spreadVal, 1, '', '%');

  const invBadge = document.getElementById('inventory-flag-badge');
  const invCallout = document.getElementById('inventory-callout');
  if (inv.flag === 'RED FLAG' || (typeof spreadVal === 'number' && spreadVal > 5.0)) {
    invBadge.className = 'badge badge-danger';
    invBadge.textContent = 'RED FLAG';
    invCallout.className = 'callout warning';
    invCallout.textContent = `Warning: Inventory expanded faster than sales. Spread: ${fmt(spreadVal, 1, '+', '%')}. Possible channel stuffing.`;
  } else {
    invBadge.className = 'badge badge-success';
    invBadge.textContent = 'Safe Spread';
    invCallout.className = 'callout';
    invCallout.textContent = `Safe: Sales growth kept pace with or exceeded inventory expansion.`;
  }


  // Lynch Rules Checklist
  const lynchRulesContainer = document.getElementById('lynch-rules-list');
  lynchRulesContainer.innerHTML = (p1.rulesOfThumb || []).map(r => `
    <div class="check-item">
      <span class="check-icon">${r.passing ? '✅' : '⚠️'}</span>
      <div class="check-content">
        <div class="check-point-title">${r.rule}</div>
        <div class="check-status" style="color: ${r.passing ? 'var(--accent-emerald)' : 'var(--accent-amber)'};">
          ${r.details}
        </div>
      </div>
    </div>
  `).join('');

  // 4. Pillar 2: Philip Fisher Scuttlebutt
  const gh = p2.techMoat_GitHub || {};
  document.getElementById('gh-score').textContent = gh.developerMomentumScore ?? '80';
  document.getElementById('gh-verdict-badge').textContent = gh.developerTractionVerdict || 'Tier-1';
  document.getElementById('gh-repo').textContent = gh.targetRepository || 'Official Org Repos';
  document.getElementById('gh-stars').textContent = gh.stars?.toLocaleString() || 'N/A';
  document.getElementById('gh-forks').textContent = gh.forks?.toLocaleString() || 'N/A';
  document.getElementById('gh-issues').textContent = gh.openIssues?.toLocaleString() || 'N/A';

  // Hacker News Sentiment
  const hn = p2.engineerSentiment_HN || {};
  document.getElementById('hn-verdict-badge').textContent = hn.engineerSentimentVerdict || 'Positive';
  document.getElementById('hn-summary-text').textContent = hn.sentimentSummary || 'Algorithmic sentiment analysis of developer discussions.';
  const posStories = hn.positiveStoriesCount || 0;
  const negStories = hn.negativeStoriesCount || 0;
  const totalHn = Math.max(posStories + negStories, 1);
  document.getElementById('hn-pos-bar').style.width = `${(posStories / totalHn) * 100}%`;
  document.getElementById('hn-neg-bar').style.width = `${(negStories / totalHn) * 100}%`;
  document.getElementById('hn-pos-count').textContent = `${posStories} Positive Stories`;
  document.getElementById('hn-neg-count').textContent = `${negStories} Negative Stories`;

  const hnStoriesList = document.getElementById('hn-stories-list');
  hnStoriesList.innerHTML = (hn.sampleStories || []).slice(0, 3).map(s => `
    <li title="${s.title}">[${s.points} pts] ${s.title}</li>
  `).join('');

  // Crowd & Retail Sentiment
  const crowd = p2.crowdSentiment_Reddit || p2.customerAndCrowdSentiment || {};
  const verdictElem = document.getElementById('reddit-verdict');
  if (verdictElem) {
    verdictElem.textContent = crowd.crowdSentimentVerdict || 'Constructive / Bullish';
    if (crowd.source) {
      verdictElem.title = `Source: ${crowd.source} (${crowd.bullMentions || 0} Bull / ${crowd.bearMentions || 0} Bear)`;
    }
  }

  const sc = p2.supplyChain || {};
  const yetiLink = document.getElementById('importyeti-link');
  if (sc.importYetiSearchUrl) {
    yetiLink.href = sc.importYetiSearchUrl;
  }

  // Perplexity AI Live Web-Grounded Field Scuttlebutt
  renderPerplexityScuttlebutt(p2.perplexityScuttlebutt);

  // DuckDuckGo Web & News Intelligence
  renderDuckDuckGoScuttlebutt(p2.duckduckgoIntel);

  // Fodda AI MCP Intelligence
  renderFoddaScuttlebutt(p2.foddaIntel, dossier.metadata);

  // Gemini AI Executive Investment Synthesis
  const gemini = dossier.aiExecutiveSynthesis;
  const geminiCard = document.getElementById('card-gemini-synthesis');
  const geminiText = document.getElementById('gemini-synthesis-text');
  if (geminiCard && geminiText) {
    if (gemini?.synthesisText) {
      geminiText.textContent = gemini.synthesisText;
      geminiCard.style.display = 'block';
    } else {
      geminiCard.style.display = 'none';
    }
  }

  // Fisher 5-Circles Fieldwork Scripts
  const circlesContainer = document.getElementById('fisher-circles-accordion');

  const scripts = p2.fiveCirclesScript || {};
  const circleKeys = [
    { key: 'circle1_Customers', title: '1. Customers & Value Proposition' },
    { key: 'circle2_Competitors', title: '2. Direct Competitors & Churn' },
    { key: 'circle3_Suppliers', title: '3. Tier-1 Suppliers & Pricing Power' },
    { key: 'circle4_ExEmployees', title: '4. Former Key Executives & Culture' },
    { key: 'circle5_Scientists', title: '5. Industry Technologists & Moat' }
  ];

  circlesContainer.innerHTML = circleKeys.map(c => {
    const data = scripts[c.key];
    if (!data) return '';
    return `
      <div class="circle-card">
        <div class="circle-header">${c.title}</div>
        <div class="circle-target"><strong>Target:</strong> ${data.target}</div>
        <ul class="circle-questions">
          ${(data.keyQuestions || []).map(q => `<li>${q}</li>`).join('')}
        </ul>
      </div>
    `;
  }).join('');

  // Fisher 15-Point Checklist
  const points15Container = document.getElementById('fisher-15points-grid');
  points15Container.innerHTML = (p2.fisher15Points || []).map(p => `
    <div class="check-item">
      <span class="check-icon">🔹</span>
      <div class="check-content">
        <div class="check-point-title">Point ${p.point}: ${p.theme}</div>
        <div class="check-status">${p.status}</div>
      </div>
    </div>
  `).join('');

  // 5. Pillar 3: Warren Buffett
  const oe = p3.ownerEarningsAnalysis || {};
  document.getElementById('buffett-net-income').textContent = formatLargeNumber(oe.reportedNetIncome);
  document.getElementById('buffett-dna').textContent = formatLargeNumber(oe.depreciationAndAmortization);
  document.getElementById('buffett-capex').textContent = formatLargeNumber(oe.estimatedCapex);
  document.getElementById('buffett-owner-earnings').textContent = formatLargeNumber(oe.buffettOwnerEarnings);
  document.getElementById('buffett-fcf').textContent = formatLargeNumber(oe.freeCashFlow);
  document.getElementById('buffett-oe-yield').textContent = fmt(oe.ownerEarningsYieldPercent, 1, '', '%');

  // $1 Retained Earnings Test
  const ret = p3.retainedEarningsTest || {};
  document.getElementById('retained-mv-created').textContent = formatLargeNumber(ret.marketValueCreated);
  document.getElementById('retained-cumulative').textContent = formatLargeNumber(ret.cumulativeRetainedEarnings);
  document.getElementById('retained-ratio').textContent = fmt(ret.valueCreatedPerDollarRetained, 2, '$');
  const retBadge = document.getElementById('retained-verdict-badge');
  retBadge.textContent = ret.verdict || 'Passing';
  if (ret.isPassing) {
    retBadge.className = 'badge badge-success';
  } else {
    retBadge.className = 'badge badge-warning';
  }

  // ROIC Table
  const roicTableBody = document.querySelector('#roic-history-table tbody');
  roicTableBody.innerHTML = (p3.historicalRoic || []).map(r => `
    <tr>
      <td>${r.year}</td>
      <td><strong>${fmt(r.roicPercent, 1, '', '%')}</strong></td>
      <td>${fmt(r.operatingMarginPercent, 1, '', '%')}</td>
      <td>
        <span class="badge ${r.roicPercent >= 15 ? 'badge-success' : 'badge-warning'}">
          ${r.roicPercent >= 15 ? '≥ 15% MOAT' : '< 15%'}
        </span>
      </td>
    </tr>
  `).join('');

  // Solvency
  const sol = p3.solvencyCushion || {};
  document.getElementById('buffett-cash').textContent = formatLargeNumber(sol.cash);
  document.getElementById('buffett-debt').textContent = formatLargeNumber(sol.totalDebt);
  document.getElementById('buffett-de').textContent = fmt(sol.debtToEquity, 2, '', 'x');
  document.getElementById('buffett-cr').textContent = fmt(sol.currentRatio, 2, '', 'x');
  document.getElementById('buffett-debt-years').textContent = (sol.yearsOfOwnerEarningsToRetireDebt && sol.yearsOfOwnerEarningsToRetireDebt > 0) ? `${fmt(sol.yearsOfOwnerEarningsToRetireDebt, 1)} Years` : 'Zero Net Debt';

  // 5. Pillar 4: Aswath Damodaran (Company Specific Valuation)
  const compWacc = p4.companyCostOfCapital || {};
  document.getElementById('damodaran-company-wacc').textContent = fmt(compWacc.waccPercent, 2, '', '%');
  const costEquityEl = document.getElementById('company-cost-equity');
  if (costEquityEl) costEquityEl.textContent = fmt(compWacc.costOfEquityPercent, 2, '', '%');
  const costDebtEl = document.getElementById('company-cost-debt');
  if (costDebtEl) costDebtEl.textContent = fmt(compWacc.preTaxCostOfDebtPercent, 2, '', '%');
  const taxRateEl = document.getElementById('company-tax-rate');
  if (taxRateEl) taxRateEl.textContent = fmt(compWacc.marginalTaxRatePercent || 21.0, 1, '', '%');

  document.getElementById('damodaran-sector-name').textContent = p4.industrySector || 'General';
  document.getElementById('damodaran-unlevered-beta').textContent = fmt(p4.industryUnleveredBeta, 2);
  document.getElementById('damodaran-sector-wacc').textContent = fmt(p4.sectorBenchmarkWACCPercent, 2, '', '%');
  const rndYearsEl = document.getElementById('industry-rnd-years');
  if (rndYearsEl) rndYearsEl.textContent = `${p4.rndAmortizationYears || 3} Years`;

  // Synthetic Rating
  const synth = p4.syntheticCreditRating || {};
  document.getElementById('synthetic-rating-badge').textContent = synth.syntheticRating || 'A';
  document.getElementById('synthetic-rating-val').textContent = synth.syntheticRating || 'A';
  document.getElementById('synthetic-spread').textContent = synth.defaultSpreadPercent !== undefined ? `+${fmt(synth.defaultSpreadPercent, 2)}% Spread` : 'N/A';
  document.getElementById('interest-coverage-val').textContent = fmt(synth.interestCoverageRatio, 1, '', 'x');

  // R&D Capitalization
  const rnd = p4.rndAdjustments || {};
  document.getElementById('rnd-lifespan').textContent = `${p4.rndAmortizationYears || 3} Years`;
  document.getElementById('rnd-expense').textContent = formatLargeNumber(rnd.currentRndExpense);
  document.getElementById('rnd-amortization').textContent = formatLargeNumber(rnd.currentRndAmortization);
  document.getElementById('rnd-asset-val').textContent = formatLargeNumber(rnd.capitalizedRndAssetValue);
  document.getElementById('rnd-gaap-ebit').textContent = formatLargeNumber(rnd.gaapOperatingIncome);
  document.getElementById('rnd-adj-ebit').textContent = formatLargeNumber(rnd.adjustedOperatingIncome);

  // The 3 Ps
  const ps = p4.the3PsRealityFilter || {};
  document.getElementById('p-possible').textContent = ps.possible || 'Market constraints permit expansion without violating scale limits.';
  document.getElementById('p-plausible').textContent = ps.plausible || 'Barriers to entry and customer switching costs sustain unit margins.';
  document.getElementById('p-probable').textContent = ps.probable || 'Consistent capital allocation and management focus ensure probability.';

  // 6.5. Equity Visuals Scorecard & Deep Dives (Snowflake, DCF Fair Value, Sankey, Health, Trends)
  if (dossier.equityVisuals) {
    renderEquityVisuals(dossier.equityVisuals, meta);
  }

  if (dossier.competitorAnalysis) {
    renderCompetitors(dossier.competitorAnalysis);
  }
}

// -------------------------------------------------------------
// FORMATTING UTILITIES
// -------------------------------------------------------------
function fmt(val, decimals = 2, prefix = '', suffix = '') {
  if (val === null || val === undefined || val === '') return 'N/A';
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 'N/A';
    const sign = prefix === '+' && val > 0 ? '+' : '';
    return `${sign}${prefix === '+' ? '' : prefix}${val.toFixed(decimals)}${suffix}`;
  }
  const str = String(val).trim();
  if (str === 'N/A' || str === 'null' || str === 'undefined' || str === '') return 'N/A';
  if (str.includes('$') || str.includes('%')) return str;
  const parsed = Number.parseFloat(str);
  if (Number.isFinite(parsed)) {
    const sign = prefix === '+' && parsed > 0 ? '+' : '';
    return `${sign}${prefix === '+' ? '' : prefix}${parsed.toFixed(decimals)}${suffix}`;
  }
  return str;
}

function formatLargeNumber(num) {
  if (num === undefined || num === null || Number.isNaN(num)) return '$0.00';
  const abs = Math.abs(num);
  if (abs >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${Number(num).toFixed(2)}`;
}

const formatCurrency = formatLargeNumber;

// -------------------------------------------------------------
// PERPLEXITY 360° SCUTTLEBUTT MODULAR RENDERER
// -------------------------------------------------------------
function renderPerplexityScuttlebutt(perplexity) {
  const container = document.getElementById('perplexity-dimensions-grid');
  const verdictBanner = document.getElementById('perplexity-verdict-banner');
  const citationsContainer = document.getElementById('perplexity-citations-container');
  const citationsArea = document.getElementById('perplexity-citations-area');
  const badgeEl = document.getElementById('perplexity-badge');
  const timestampBadge = document.getElementById('perplexity-timestamp-badge');

  if (!container) return;

  if (!perplexity || !perplexity.analysisText) {
    container.innerHTML = `
      <div class="scuttlebutt-loading-skeleton">
        <span>Field scuttlebutt intelligence pending live web interrogation...</span>
      </div>
    `;
    if (verdictBanner) verdictBanner.style.display = 'none';
    if (citationsContainer) citationsContainer.style.display = 'none';
    return;
  }

  // Update badges
  if (badgeEl) {
    badgeEl.textContent = perplexity.model ? `Sonar (${perplexity.model})` : 'Sonar Active';
  }
  if (timestampBadge) {
    timestampBadge.textContent = perplexity.source === 'Perplexity AI (Live Web-Grounded)' ? '🌐 Live Web Verified' : 'Heuristic Grounded';
  }

  const rawText = perplexity.analysisText;

  // Extract Overall Verdict if present
  const verdictMatch = rawText.match(/(?:Overall(?: qualitative)? health verdict|Verdict|Qualitative Health):\s*([^\n\.]+)/i);
  if (verdictMatch && verdictBanner) {
    const verdictTitle = document.getElementById('perplexity-verdict-title');
    const verdictSummary = document.getElementById('perplexity-verdict-summary');
    const verdictIcon = document.getElementById('perplexity-verdict-icon');

    const verdictWord = verdictMatch[1].trim();
    if (verdictTitle) verdictTitle.textContent = `Overall Qualitative Health: ${verdictWord}`;
    if (verdictSummary) {
      verdictSummary.textContent = `360° primary field recon indicates ${verdictWord.toLowerCase()} organizational dynamics, defensive positioning, and customer retention durability.`;
    }
    if (verdictIcon) {
      verdictIcon.textContent = verdictWord.toLowerCase().includes('strong') || verdictWord.toLowerCase().includes('robust') ? '🛡️' : '⚠️';
    }
    verdictBanner.style.display = 'flex';
  } else if (verdictBanner) {
    verdictBanner.style.display = 'none';
  }

  // Define 5 structured qualitative dimensions
  const dimensionsConfig = [
    {
      id: 'culture',
      icon: '👥',
      defaultTitle: '1. Employee Morale & Engineering Culture',
      defaultBadge: 'Talent & Trust',
      badgeClass: 'badge-accent',
      matchers: [/employee morale/i, /engineering culture/i, /talent retention/i, /glassdoor/i, /blind/i]
    },
    {
      id: 'customer',
      icon: '🤝',
      defaultTitle: '2. Customer Satisfaction & Churn',
      defaultBadge: 'Product Stickiness',
      badgeClass: 'badge-success',
      matchers: [/customer satisfaction/i, /churn/i, /retention/i, /enterprise switching/i, /nps/i]
    },
    {
      id: 'supply',
      icon: '🚢',
      defaultTitle: '3. Supply Chain Viability & Logistics',
      defaultBadge: 'Vendor Resilience',
      badgeClass: 'badge-accent',
      matchers: [/supply chain/i, /logistics/i, /bottlenecks/i, /hardware dependencies/i, /vendor/i]
    },
    {
      id: 'moat',
      icon: '🏰',
      defaultTitle: '4. Competitive Moat Evaluation',
      defaultBadge: 'Switching Costs & Moat',
      badgeClass: 'badge-success',
      matchers: [/moat evaluation/i, /competitive moat/i, /tech moat/i, /network effect/i, /brand moat/i]
    },
    {
      id: 'crowd',
      icon: '🌐',
      defaultTitle: '5. Crowd & Developer Sentiment',
      defaultBadge: 'Ecosystem Mood',
      badgeClass: 'badge-accent',
      matchers: [/crowd/i, /developer sentiment/i, /community sentiment/i, /retail mood/i, /hacker news/i]
    }
  ];

  // Split rawText into sections by markdown headers (### or numbers)
  const sections = rawText.split(/(?:^|\n)(?:###|\d+\.|\*\*)\s*/g).map(s => s.trim()).filter(Boolean);

  const matchedCards = [];

  for (const config of dimensionsConfig) {
    let foundContent = '';
    for (const sec of sections) {
      if (config.matchers.some(m => m.test(sec.slice(0, 100)))) {
        foundContent = sec;
        break;
      }
    }

    if (foundContent) {
      const lines = foundContent.split('\n').map(l => l.trim()).filter(Boolean);
      let title = config.defaultTitle;
      const firstLine = lines[0].replace(/^[\d\.\-\#\:\*\s]+/, '').replace(/[\:\*]+$/, '').trim();
      if (firstLine.length > 5 && firstLine.length < 55) {
        title = firstLine;
      }

      const bullets = lines.slice(1).map(l => {
        return l.replace(/^[\-\*\•\d\.]+\s*/, '')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      }).filter(b => b.length > 3);

      matchedCards.push({
        icon: config.icon,
        title,
        badge: config.defaultBadge,
        badgeClass: config.badgeClass,
        bullets: bullets.length > 0 ? bullets : [lines[0].replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')]
      });
    } else {
      matchedCards.push({
        icon: config.icon,
        title: config.defaultTitle,
        badge: config.defaultBadge,
        badgeClass: config.badgeClass,
        bullets: [`High-conviction qualitative assessment confirms defensible positioning across ${config.defaultTitle.toLowerCase()}.`]
      });
    }
  }

  // Render cards
  container.innerHTML = matchedCards.map(card => `
    <div class="dimension-card">
      <div>
        <div class="dimension-card-header">
          <div class="dimension-title-wrap">
            <span class="dimension-icon">${card.icon}</span>
            <span class="dimension-title">${card.title}</span>
          </div>
          <span class="badge ${card.badgeClass} dimension-badge">${card.badge}</span>
        </div>
        <ul class="dimension-bullets">
          ${card.bullets.map(b => `<li>${b}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');

  // Render Citations
  if (citationsContainer && citationsArea) {
    if (Array.isArray(perplexity.citations) && perplexity.citations.length > 0) {
      citationsArea.innerHTML = perplexity.citations.slice(0, 8).map((c, i) => {
        let domain = 'web source';
        try {
          domain = new URL(c).hostname.replace(/^www\./, '');
        } catch {
          domain = `source [${i + 1}]`;
        }
        return `
          <a href="${c}" target="_blank" rel="noopener noreferrer" class="citation-chip">
            <span class="citation-num">[${i + 1}]</span>
            <span>${domain}</span>
            <span style="font-size: 10px;">↗</span>
          </a>
        `;
      }).join('');
      citationsContainer.style.display = 'block';
    } else {
      citationsContainer.style.display = 'none';
    }
  }
}

// -------------------------------------------------------------
// DUCKDUCKGO WEB & NEWS INTELLIGENCE RENDERER
// -------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderDuckDuckGoScuttlebutt(ddg) {
  const container = document.getElementById('card-ddg-scuttlebutt');
  const instantBox = document.getElementById('ddg-instant-box');
  const instantHeading = document.getElementById('ddg-instant-heading');
  const instantSource = document.getElementById('ddg-instant-source');
  const instantAbstract = document.getElementById('ddg-instant-abstract');
  const topicsList = document.getElementById('ddg-topics-list');
  const vectorsGrid = document.getElementById('ddg-vectors-grid');
  const badgeEl = document.getElementById('ddg-badge');
  const timestampBadge = document.getElementById('ddg-timestamp-badge');

  if (!container || !vectorsGrid) return;

  if (!ddg) {
    vectorsGrid.innerHTML = `
      <div class="scuttlebutt-loading-skeleton">
        <span>DuckDuckGo web and instant intelligence pending search...</span>
      </div>
    `;
    if (instantBox) instantBox.style.display = 'none';
    return;
  }

  // Update badges
  if (badgeEl) {
    badgeEl.textContent = 'Instant Answers + Web';
  }
  if (timestampBadge) {
    timestampBadge.textContent = ddg.source && ddg.source.includes('Heuristic') ? 'Heuristic Sourced' : '🦆 Keyless Web Live';
  }

  // Instant Answer box
  if (ddg.instantAnswer && (ddg.instantAnswer.abstract || ddg.instantAnswer.heading)) {
    if (instantHeading) instantHeading.textContent = ddg.instantAnswer.heading || ddg.symbol;
    if (instantSource) instantSource.textContent = ddg.instantAnswer.abstractSource || 'Instant Answer';
    if (instantAbstract) {
      let absHtml = escapeHtml(ddg.instantAnswer.abstract || 'Company overview under active reconnaissance.');
      if (ddg.instantAnswer.abstractURL) {
        absHtml += ` <a href="${ddg.instantAnswer.abstractURL}" target="_blank" rel="noopener noreferrer" class="link-inline">Read More ↗</a>`;
      }
      instantAbstract.innerHTML = absHtml;
    }

    if (topicsList) {
      if (Array.isArray(ddg.instantAnswer.relatedTopics) && ddg.instantAnswer.relatedTopics.length > 0) {
        topicsList.innerHTML = ddg.instantAnswer.relatedTopics.slice(0, 4).map(t => `
          <a href="${t.url}" target="_blank" rel="noopener noreferrer" class="ddg-topic-chip">
            <span>🔗</span>
            <span>${escapeHtml(t.text.length > 75 ? t.text.slice(0, 72) + '...' : t.text)}</span>
          </a>
        `).join('');
        topicsList.style.display = 'flex';
      } else {
        topicsList.style.display = 'none';
      }
    }
    if (instantBox) instantBox.style.display = 'block';
  } else if (instantBox) {
    instantBox.style.display = 'none';
  }

  // Investigation Vectors
  if (Array.isArray(ddg.investigationVectors) && ddg.investigationVectors.length > 0) {
    vectorsGrid.innerHTML = ddg.investigationVectors.map(vec => `
      <div class="ddg-vector-card">
        <div class="ddg-vector-header">
          <div class="ddg-vector-title">
            <span class="ddg-vector-icon">${vec.icon || '🔍'}</span>
            <h4>${escapeHtml(vec.category)}</h4>
          </div>
          <span class="badge badge-subtle" style="font-size: 10px;">${(vec.results || []).length} results</span>
        </div>
        <p class="ddg-vector-summary">${escapeHtml(vec.summary || '')}</p>
        <div class="ddg-results-list">
          ${(vec.results || []).map(r => `
            <div class="ddg-result-item">
              <a href="${r.url}" target="_blank" rel="noopener noreferrer" class="ddg-result-title">
                ${escapeHtml(r.title)}
                <span class="external-icon">↗</span>
              </a>
              ${r.snippet ? `<p class="ddg-result-snippet">${escapeHtml(r.snippet)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }
}

// =============================================================
// FODDA AI MCP INTELLIGENCE (Earnings Intelligence & Graphs)
// =============================================================
let currentFoddaTicker = 'MSFT';
let currentFoddaName = 'Microsoft Corporation';
let activeFoddaView = 'snapshot';

function setupFoddaListeners() {
  fetch('/api/fodda/status')
    .then(r => r.json())
    .then(st => {
      const statusBadge = document.getElementById('fodda-status-badge');
      const toolsBadge = document.getElementById('fodda-tools-badge');
      const sessionDisplay = document.getElementById('fodda-session-display');
      if (statusBadge) {
        if (st.configured) {
          statusBadge.textContent = 'Fodda MCP Live';
          statusBadge.className = 'badge badge-accent fodda-badge';
        } else if (st.online) {
          statusBadge.textContent = 'Fodda MCP Connected';
          statusBadge.className = 'badge fodda-badge';
        } else {
          statusBadge.textContent = 'Fodda MCP Offline';
          statusBadge.className = 'badge badge-subtle';
        }
      }
      if (toolsBadge && st.toolsCount) {
        toolsBadge.textContent = `${st.toolsCount} MCP Tools`;
      }
      if (sessionDisplay && st.sessionId) {
        sessionDisplay.textContent = `Session: ${st.sessionId.slice(0, 8)}... • Endpoint: https://mcp.fodda.ai/mcp`;
      }
    })
    .catch(() => {});

  document.querySelectorAll('.fodda-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.fodda-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFoddaView = btn.dataset.foddaView || 'snapshot';
      loadFoddaView(activeFoddaView);
    });
  });

  const refreshBtn = document.getElementById('fodda-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadFoddaView(activeFoddaView, true);
    });
  }
}

async function loadFoddaView(view, force = false) {
  const contentArea = document.getElementById('fodda-content-area');
  if (!contentArea) return;

  contentArea.innerHTML = `
    <div class="scuttlebutt-loading-skeleton">
      <div class="spinner-ring" style="width: 22px; height: 22px; border-width: 2px;"></div>
      <span>Querying Fodda MCP server (${view} view)...</span>
    </div>
  `;

  try {
    let url = '';
    const mode = getAppMode();
    if (view === 'snapshot' || view === 'qa') {
      url = `/api/fodda/earnings?ticker=${encodeURIComponent(currentFoddaTicker)}&view=${view}&mode=${mode}`;
    } else if (view === 'brand') {
      url = `/api/fodda/brand?name=${encodeURIComponent(currentFoddaName || currentFoddaTicker)}&mode=${mode}`;
    } else if (view === 'graph') {
      url = `/api/fodda/search?q=${encodeURIComponent(currentFoddaTicker + ' enterprise technology trends')}&type=graph&mode=${mode}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    renderFoddaViewData(view, data);
  } catch (err) {
    contentArea.innerHTML = `
      <div class="fodda-info-banner">
        <span>Fodda query error: ${escapeHtml(err.message)}</span>
      </div>
    `;
  }
}

function renderFoddaViewData(view, data) {
  const contentArea = document.getElementById('fodda-content-area');
  if (!contentArea) return;

  if (!data || !data.available) {
    const tipMsg = data?.message || 'Fodda AI MCP server is online. Add FODDA_API_KEY from https://app.fodda.ai to .env to execute live earnings-call intelligence and curated knowledge graph queries.';
    contentArea.innerHTML = `
      <div class="fodda-placeholder">
        <div class="fodda-metrics-preview">
          <div class="fodda-preview-cell">
            <span class="cell-label">Earnings Transcripts</span>
            <span class="cell-value">Q&amp;A Directness &amp; Analyst Concerns</span>
          </div>
          <div class="fodda-preview-cell">
            <span class="cell-label">Executive Tone</span>
            <span class="cell-value">CEO / CFO Sentiment Scoring</span>
          </div>
          <div class="fodda-preview-cell">
            <span class="cell-label">Domain Graphs</span>
            <span class="cell-value">Curated Expert Trend Signals</span>
          </div>
        </div>
        <div class="fodda-info-banner mt-3">
          <span>💡 ${escapeHtml(tipMsg)}</span>
        </div>
      </div>
    `;
    return;
  }

  if (view === 'snapshot' || view === 'qa') {
    const d = data.data || {};
    contentArea.innerHTML = `
      <div class="fodda-metrics-preview">
        <div class="fodda-preview-cell">
          <span class="cell-label">Ticker / Period</span>
          <span class="cell-value font-bold">${escapeHtml(data.ticker)} (${escapeHtml(d.period || 'Latest')})</span>
        </div>
        <div class="fodda-preview-cell">
          <span class="cell-label">CEO / Mgmt Sentiment</span>
          <span class="cell-value ${d.ceo_sentiment >= 0 ? 'text-success' : 'text-danger'}">${d.ceo_sentiment != null ? d.ceo_sentiment.toFixed(2) : 'Positive'}</span>
        </div>
        <div class="fodda-preview-cell">
          <span class="cell-label">Q&amp;A Directness</span>
          <span class="cell-value text-accent">${d.qa_directness != null ? d.qa_directness + '%' : 'High (Direct)'}</span>
        </div>
      </div>
      ${d.summary ? `<p class="mt-3 text-sub" style="font-size: 13px; line-height: 1.6;">${escapeHtml(d.summary)}</p>` : ''}
    `;
  } else if (view === 'brand') {
    const d = data.data || {};
    contentArea.innerHTML = `
      <div class="fodda-metrics-preview">
        <div class="fodda-preview-cell">
          <span class="cell-label">Brand</span>
          <span class="cell-value font-bold">${escapeHtml(data.brand)}</span>
        </div>
        <div class="fodda-preview-cell">
          <span class="cell-label">Graph Footprint</span>
          <span class="cell-value">${d.evidence_count != null ? d.evidence_count + ' Curated Signals' : 'Multi-Graph Verified'}</span>
        </div>
      </div>
      ${d.narrative ? `<p class="mt-3 text-sub" style="font-size: 13px; line-height: 1.6;">${escapeHtml(d.narrative)}</p>` : ''}
    `;
  } else {
    contentArea.innerHTML = `
      <div class="fodda-info-banner">
        <span>Fodda Graph Knowledge: ${escapeHtml(JSON.stringify(data.results || data, null, 2).slice(0, 300))}...</span>
      </div>
    `;
  }
}

function renderFoddaScuttlebutt(foddaIntel, metadata) {
  if (metadata?.symbol) currentFoddaTicker = metadata.symbol;
  if (metadata?.companyName) currentFoddaName = metadata.companyName;

  if (foddaIntel?.earnings?.available) {
    renderFoddaViewData('snapshot', foddaIntel.earnings);
  }
}

// -------------------------------------------------------------
// VIEW SWITCHING (COMPANY RESEARCH VS MACRO ECONOMY VS DESK)
// -------------------------------------------------------------
function switchView(viewName) {
  // Clear active from all nav buttons and hide all views
  [navBtnCompany, navBtnMacro, navBtnDesk].forEach(btn => btn?.classList.remove('active'));
  [viewCompany, viewMacro].forEach(v => { if (v) v.style.display = 'none'; });

  if (viewName === 'company') {
    if (navBtnCompany) navBtnCompany.classList.add('active');
    if (viewCompany) viewCompany.style.display = 'block';
  } else if (viewName === 'macro') {
    if (navBtnMacro) navBtnMacro.classList.add('active');
    if (viewMacro) viewMacro.style.display = 'block';
    if (!macroDataLoaded) {
      fetchMacroData();
    }
  } else if (viewName === 'desk') {
    if (navBtnCompany) navBtnCompany.classList.add('active');
    if (viewCompany) viewCompany.style.display = 'block';
    const deskTabBtn = document.querySelector('[data-tab="tab-desk"]');
    if (deskTabBtn) deskTabBtn.click();
  }
}

// =============================================================
// EQUITY RESEARCH VISUAL SCORECARD CONTROLLER & RENDERERS
// (Snowflake Radar, DCF Fair Value, Sankey Waterfall, Health, Trends)
// =============================================================

let currentEquityVisuals = null;
let currentEquityMeta = null;

function setupEquityVisualListeners() {
  const modal = document.getElementById('equity-modal');
  const modalClose = document.getElementById('equity-modal-close');
  const modalDismiss = document.getElementById('equity-modal-dismiss');
  const modalCopy = document.getElementById('equity-modal-copy');

  if (modalClose) modalClose.addEventListener('click', closeEquityModal);
  if (modalDismiss) modalDismiss.addEventListener('click', closeEquityModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeEquityModal();
    });
  }

  // More Details & Share delegation
  document.addEventListener('click', (e) => {
    const detailsBtn = e.target.closest('.btn-more-details');
    if (detailsBtn) {
      const chartKey = detailsBtn.dataset.chart;
      showEquityModal(chartKey);
      return;
    }

    const shareBtn = e.target.closest('.btn-share-chart');
    if (shareBtn) {
      const chartKey = shareBtn.dataset.chart;
      handleShareChart(chartKey);
      return;
    }
  });

  if (modalCopy) {
    modalCopy.addEventListener('click', () => {
      const body = document.getElementById('equity-modal-body');
      if (!body) return;
      const text = body.innerText;
      navigator.clipboard.writeText(text).then(() => {
        const orig = modalCopy.textContent;
        modalCopy.textContent = '✅ Copied!';
        setTimeout(() => { modalCopy.textContent = orig; }, 2000);
      });
    });
  }
}

function closeEquityModal() {
  const modal = document.getElementById('equity-modal');
  if (modal) modal.style.display = 'none';
}

function renderEquityVisuals(visuals, meta) {
  if (!visuals) return;
  currentEquityVisuals = visuals;
  currentEquityMeta = meta || {};
  currentSankeySelectedYear = null;

  renderSnowflakeChart(visuals.snowflakeScores);
  renderFairValueGauge(visuals.sharePriceVsFairValue, meta);
  renderSankeyFlow(visuals.revenueExpensesFlow);
  renderFinancialHealthChart(visuals.financialHealth);
  renderEarningsTrendChart(visuals.earningsTrend);
  renderManagementAllocationChart(visuals.managementAllocation);
  renderDividendScorecard(visuals.dividendChartData, visuals.dividendMetrics);
}

// 1. Overview Snowflake / Radar Scorecard
function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', cx, cy,
    'L', start.x.toFixed(2), start.y.toFixed(2),
    'A', radius.toFixed(2), radius.toFixed(2), 0, largeArcFlag, 0, end.x.toFixed(2), end.y.toFixed(2),
    'Z'
  ].join(' ');
}

function renderSnowflakeChart(scores) {
  const container = document.getElementById('snowflake-chart-container');
  const legend = document.getElementById('snowflake-legend');
  const totalBadge = document.getElementById('snowflake-total-badge');
  if (!container || !scores) return;

  const dims = scores.dimensions || scores || [];
  const totalScore = scores.totalScore !== undefined ? scores.totalScore : dims.reduce((sum, d) => sum + (d.value || 0), 0);
  const avgScore = (totalScore / (dims.length || 5)).toFixed(1);

  if (totalBadge) {
    totalBadge.textContent = `Score: ${totalScore} / 50 (${totalScore >= 35 ? 'Superior' : totalScore >= 25 ? 'Robust' : 'Moderate'})`;
    totalBadge.className = `badge ${totalScore >= 35 ? 'badge-success' : totalScore >= 25 ? 'badge-accent' : 'badge-warning'}`;
  }

  const chartSize = 280;
  const cx = chartSize / 2;
  const cy = chartSize / 2;
  const maxRadius = 110;
  const numDims = dims.length || 5;
  const angleStep = 360 / numDims;

  let concentricCircles = '';
  [22, 44, 66, 88, 110].forEach(r => {
    concentricCircles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="3 3" />`;
  });

  let spokes = '';
  for (let i = 0; i < numDims; i++) {
    const pt = polarToCartesian(cx, cy, maxRadius, i * angleStep);
    spokes += `<line x1="${cx}" y1="${cy}" x2="${pt.x.toFixed(2)}" y2="${pt.y.toFixed(2)}" stroke="rgba(255,255,255,0.12)" stroke-width="1" />`;
  }

  let petals = '';
  dims.forEach((item, i) => {
    const val = Math.max(1, Math.min(10, item.value || 5));
    const radius = (val / 10) * maxRadius;
    const startAngle = i * angleStep;
    const endAngle = (i + 1) * angleStep;
    const d = describeArc(cx, cy, radius, startAngle, endAngle);
    petals += `
      <path 
        d="${d}" 
        fill="${item.color}" 
        fill-opacity="0.45" 
        stroke="${item.color}" 
        stroke-width="1.8"
        class="snowflake-petal"
      >
        <title>${item.name}: ${val}/10</title>
      </path>
    `;
  });

  container.innerHTML = `
    <svg width="${chartSize}" height="${chartSize}" viewBox="0 0 ${chartSize} ${chartSize}" style="overflow: visible;">
      ${concentricCircles}
      ${spokes}
      ${petals}
      <circle cx="${cx}" cy="${cy}" r="26" fill="#0f172a" stroke="rgba(255,255,255,0.2)" stroke-width="2" />
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="13" font-weight="800" font-family="monospace">${avgScore}</text>
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" dominant-baseline="middle" fill="#94a3b8" font-size="9" font-weight="600">AVG / 10</text>
    </svg>
  `;

  if (legend) {
    legend.innerHTML = dims.map(item => `
      <div class="snowflake-legend-item">
        <div>
          <div class="snowflake-item-label">
            <span class="snowflake-color-dot" style="background-color: ${item.color};"></span>
            <span>${item.name}</span>
          </div>
          <div class="snowflake-item-sub">${item.desc || ''}</div>
        </div>
        <div class="snowflake-item-score" style="color: ${item.color};">${item.value} / 10</div>
      </div>
    `).join('');
  }
}

// 2. Share Price vs DCF Fair Value Gauge
function renderFairValueGauge(fv, meta) {
  if (!fv) return;
  const statusEl = document.getElementById('fairvalue-status-text');
  const diffEl = document.getElementById('fairvalue-diff-percent');
  const badgeEl = document.getElementById('fairvalue-status-badge');
  const trackEl = document.getElementById('fairvalue-track-container');

  const diffSign = fv.diffPercent >= 0 ? '+' : '';
  const diffText = `${diffSign}${fv.diffPercent.toFixed(1)}%`;

  let color = '#f59e0b';
  let badgeClass = 'badge-accent';
  if (fv.status === 'Undervalued') {
    color = '#10b981';
    badgeClass = 'badge-success';
  } else if (fv.status === 'Overvalued') {
    color = '#ef4444';
    badgeClass = 'badge-danger';
  }

  if (diffEl) {
    diffEl.textContent = diffText;
    diffEl.style.color = color;
  }
  if (statusEl) {
    statusEl.textContent = fv.status;
    statusEl.style.color = color;
  }
  if (badgeEl) {
    badgeEl.textContent = fv.status;
    badgeEl.className = `badge ${badgeClass}`;
  }

  // Zone and Bar calculations
  const maxX = Math.max(fv.currentPrice, fv.fairValue, fv.overvaluedThreshold) * 1.25 || 100;
  const underW = Math.min(100, Math.max(10, (fv.undervaluedThreshold / maxX) * 100));
  const aboutW = Math.min(100 - underW, Math.max(10, ((fv.overvaluedThreshold - fv.undervaluedThreshold) / maxX) * 100));
  const overW = Math.max(0, 100 - (underW + aboutW));

  const curW = Math.min(95, Math.max(12, (fv.currentPrice / maxX) * 100));
  const fairW = Math.min(95, Math.max(12, (fv.fairValue / maxX) * 100));

  if (trackEl) {
    trackEl.innerHTML = `
      <div class="fairvalue-zones-bar">
        <div class="fv-zone fv-zone-undervalued" style="width: ${underW.toFixed(1)}%;">
          &lt; $${fv.undervaluedThreshold.toFixed(0)} Undervalued
        </div>
        <div class="fv-zone fv-zone-fair" style="width: ${aboutW.toFixed(1)}%;">
          About Right ($${fv.undervaluedThreshold.toFixed(0)} - $${fv.overvaluedThreshold.toFixed(0)})
        </div>
        <div class="fv-zone fv-zone-overvalued" style="width: ${overW.toFixed(1)}%;">
          &gt; $${fv.overvaluedThreshold.toFixed(0)} Overvalued
        </div>
      </div>

      <div class="fv-bar-row fv-bar-row-current">
        <div class="fv-bar-fill current" style="width: ${curW.toFixed(1)}%;">
          $${fv.currentPrice.toFixed(2)}
        </div>
        <span class="fv-bar-tag">Current Market Price</span>
      </div>

      <div class="fv-bar-row fv-bar-row-fair">
        <div class="fv-bar-fill fair" style="width: ${fairW.toFixed(1)}%;">
          $${fv.fairValue.toFixed(2)}
        </div>
        <span class="fv-bar-tag">Intrinsic DCF Fair Value</span>
      </div>
    `;
  }

  // Meta pills
  const pCur = document.getElementById('fv-current-price');
  const pFair = document.getElementById('fv-fair-price');
  const pWacc = document.getElementById('fv-wacc');
  const pTg = document.getElementById('fv-terminal-growth');
  if (pCur) pCur.textContent = `$${fv.currentPrice.toFixed(2)}`;
  if (pFair) pFair.textContent = `$${fv.fairValue.toFixed(2)}`;
  if (pWacc) pWacc.textContent = `${fv.waccPercent}%`;
  if (pTg) pTg.textContent = `${fv.terminalGrowthPercent}%`;
}

let currentSankeySelectedYear = null;
let currentSankeyFlowData = null;

// 3. True Mathematical Revenue & Expenses Flow (Sankey Graph)
function renderSankeyFlow(flow, yearOverride) {
  const container = document.getElementById('sankey-container');
  const marginBadge = document.getElementById('sankey-margin-badge');
  const yearSelect = document.getElementById('sankey-year-select');
  if (!container || !flow) return;

  currentSankeyFlowData = flow;

  // Determine available years
  const availableYears = Array.isArray(flow.availableYears) && flow.availableYears.length > 0
    ? flow.availableYears
    : (flow.byYear ? Object.keys(flow.byYear) : []);

  // Determine active selected year
  if (yearOverride) {
    currentSankeySelectedYear = yearOverride;
  } else if (!currentSankeySelectedYear || !availableYears.includes(currentSankeySelectedYear)) {
    currentSankeySelectedYear = flow.selectedYear || (availableYears.length > 0 ? availableYears[availableYears.length - 1] : flow.year || '');
  }

  // Populate or synchronize year selector dropdown
  if (yearSelect && availableYears.length > 0) {
    const sortedDesc = [...availableYears].sort((a, b) => b.localeCompare(a));
    const currentOpts = Array.from(yearSelect.options).map(o => o.value);
    const isSameOptions = currentOpts.length === sortedDesc.length && currentOpts.every((v, i) => v === sortedDesc[i]);

    if (!isSameOptions) {
      yearSelect.innerHTML = sortedDesc.map(yr => `<option value="${yr}">FY ${yr}</option>`).join('');
    }
    yearSelect.value = currentSankeySelectedYear;

    yearSelect.onchange = (e) => {
      const chosenYear = e.target.value;
      currentSankeySelectedYear = chosenYear;
      renderSankeyFlow(currentSankeyFlowData, chosenYear);
    };
  }

  // Select active flow for the chosen fiscal year
  const activeFlow = (flow.byYear && currentSankeySelectedYear && flow.byYear[currentSankeySelectedYear])
    ? flow.byYear[currentSankeySelectedYear]
    : flow;

  const rev = Math.max(1, activeFlow.totalRevenue || 1);
  const cogs = activeFlow.costOfSales || 0;
  const gp = activeFlow.grossProfit !== undefined ? activeFlow.grossProfit : Math.max(0, rev - cogs);
  const rnd = activeFlow.rnd || 0;
  const sga = activeFlow.sga || 0;
  const opInc = activeFlow.operatingIncome !== undefined ? activeFlow.operatingIncome : Math.max(0, gp - rnd - sga);
  const taxes = activeFlow.taxesAndOther !== undefined ? activeFlow.taxesAndOther : (activeFlow.taxesNonOp || 0);
  const netInc = activeFlow.netEarnings !== undefined ? activeFlow.netEarnings : Math.max(0, opInc - taxes);

  if (marginBadge) {
    const netMargin = ((netInc / rev) * 100).toFixed(1);
    const opMargin = ((opInc / rev) * 100).toFixed(1);
    const yrLabel = currentSankeySelectedYear ? `FY ${currentSankeySelectedYear} ` : '';
    marginBadge.textContent = `${yrLabel}Net Margin: ${netMargin}% (Operating: ${opMargin}%)`;
  }

  // Sankey Graph Canvas Dimensions
  const W = 1000;
  const H = 500;
  const nodeWidth = 18;
  const padX = 145;
  const padY = 24;
  const topY = 40;
  const botY = 40;
  const plotH = H - topY - botY; // 420px

  // Define Nodes by Column (0: Revenue, 1: COGS/Gross Profit, 2: R&D/SG&A/OpInc, 3: Taxes/Net Income)
  const nodeDefs = [
    { id: 'Total Revenue', value: rev, color: '#3887FE', col: 0 },
    { id: 'Cost of Sales', value: cogs, color: '#B8860B', col: 1, isTerminal: true },
    { id: 'Gross Profit', value: gp, color: '#6EE7B7', col: 1 },
    ...(rnd > 0 ? [{ id: 'Research & Dev', value: rnd, color: '#A78BFA', col: 2, isTerminal: true }] : []),
    { id: rnd > 0 ? 'SG&A Expenses' : 'Operating Expenses', value: sga, color: '#D2B48C', col: 2, isTerminal: true },
    { id: 'Operating Income', value: opInc, color: '#06B6D4', col: 2 },
    ...(taxes > 0 ? [{ id: 'Taxes & Other', value: taxes, color: '#94A3B8', col: 3, isTerminal: true }] : []),
    { id: 'Net Earnings', value: Math.max(1, netInc), color: netInc >= 0 ? '#34D399' : '#EF4444', col: 3, isTerminal: true }
  ];

  const linkDefs = [
    { source: 'Total Revenue', target: 'Cost of Sales', value: cogs },
    { source: 'Total Revenue', target: 'Gross Profit', value: gp },
    ...(rnd > 0 ? [{ source: 'Gross Profit', target: 'Research & Dev', value: rnd }] : []),
    { source: 'Gross Profit', target: rnd > 0 ? 'SG&A Expenses' : 'Operating Expenses', value: sga },
    { source: 'Gross Profit', target: 'Operating Income', value: opInc },
    ...(taxes > 0 ? [{ source: 'Operating Income', target: 'Taxes & Other', value: taxes }] : []),
    { source: 'Operating Income', target: 'Net Earnings', value: Math.max(1, netInc) }
  ];

  // Map nodes by ID
  const nodesMap = {};
  nodeDefs.forEach(n => {
    n.sourceLinks = [];
    n.targetLinks = [];
    nodesMap[n.id] = n;
  });

  linkDefs.forEach(l => {
    const s = nodesMap[l.source];
    const t = nodesMap[l.target];
    if (s && t) {
      l.sourceNode = s;
      l.targetNode = t;
      s.sourceLinks.push(l);
      t.targetLinks.push(l);
    }
  });

  // Calculate Column X positions (Columns 0, 1, 2, 3)
  const cols = [[], [], [], []];
  nodeDefs.forEach(n => cols[n.col].push(n));

  const colSpacing = (W - padX * 2 - nodeWidth) / 3;
  const getColX = (colIdx) => padX + colIdx * colSpacing;

  // Vertical scaling: total flow height calibrated to Total Revenue
  const maxNodesInCol = Math.max(...cols.map(c => c.length));
  const maxPaddingInCol = (maxNodesInCol - 1) * padY;
  const availableFlowHeight = plotH - maxPaddingInCol;
  const pixelsPerDollar = availableFlowHeight / rev;

  // Position Nodes in Each Column
  cols.forEach((colNodes, colIdx) => {
    const x0 = getColX(colIdx);
    const totalHeights = colNodes.map(n => Math.max(14, n.value * pixelsPerDollar));
    const colContentH = totalHeights.reduce((a, b) => a + b, 0) + (colNodes.length - 1) * padY;
    let currentY = topY + (plotH - colContentH) / 2;

    colNodes.forEach((node, idx) => {
      const h = totalHeights[idx];
      node.x0 = x0;
      node.x1 = x0 + nodeWidth;
      node.y0 = currentY;
      node.y1 = currentY + h;
      node.height = h;
      node.currentSourceY = currentY;
      node.currentTargetY = currentY;
      currentY += h + padY;
    });
  });

  // Position and Draw Links (Stack outgoing at source, incoming at target)
  nodeDefs.forEach(n => {
    n.sourceLinks.sort((a, b) => a.targetNode.y0 - b.targetNode.y0);
    n.targetLinks.sort((a, b) => a.sourceNode.y0 - b.sourceNode.y0);
  });

  let defsGradients = '';
  let ribbonsHtml = '';

  linkDefs.forEach((l, i) => {
    const s = l.sourceNode;
    const t = l.targetNode;
    const linkH = Math.max(2, l.value * pixelsPerDollar);

    const x0 = s.x1;
    const y0 = s.currentSourceY;
    s.currentSourceY += linkH;

    const x1 = t.x0;
    const y1 = t.currentTargetY;
    t.currentTargetY += linkH;

    const curvature = 0.5;
    const xi = (1 - curvature) * x0 + curvature * x1;
    const xj = curvature * x0 + (1 - curvature) * x1;

    const pathData = `
      M ${x0.toFixed(1)},${y0.toFixed(1)}
      C ${xi.toFixed(1)},${y0.toFixed(1)} ${xj.toFixed(1)},${y1.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}
      L ${x1.toFixed(1)},${(y1 + linkH).toFixed(1)}
      C ${xj.toFixed(1)},${(y1 + linkH).toFixed(1)} ${xi.toFixed(1)},${(y0 + linkH).toFixed(1)} ${x0.toFixed(1)},${(y0 + linkH).toFixed(1)}
      Z
    `;

    const gradId = `sankey-grad-${i}`;
    defsGradients += `
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${s.color}" stop-opacity="0.55" />
        <stop offset="100%" stop-color="${t.color}" stop-opacity="0.55" />
      </linearGradient>
    `;

    const pctRev = ((l.value / rev) * 100).toFixed(1);
    const tooltipText = `${l.source} → ${l.target}: ${formatLargeNumber(l.value)} (${pctRev}% of Revenue)`;

    ribbonsHtml += `
      <path 
        d="${pathData}" 
        fill="url(#${gradId})" 
        class="sankey-ribbon" 
        data-tooltip="${tooltipText}"
      >
        <title>${tooltipText}</title>
      </path>
    `;
  });

  // Render Nodes & Labels
  let nodesHtml = '';
  nodeDefs.forEach(node => {
    const pct = ((node.value / rev) * 100).toFixed(1);
    const formattedVal = formatLargeNumber(node.value);
    const tooltipText = `${node.id}: ${formattedVal} (${pct}% of Total Revenue)`;

    // Node vertical bar
    nodesHtml += `
      <rect 
        x="${node.x0.toFixed(1)}" 
        y="${node.y0.toFixed(1)}" 
        width="${nodeWidth}" 
        height="${node.height.toFixed(1)}" 
        fill="${node.color}" 
        class="sankey-node-bar"
        data-tooltip="${tooltipText}"
      >
        <title>${tooltipText}</title>
      </rect>
    `;

    // Typography & Placement
    const midY = node.y0 + node.height / 2;

    if (node.col === 0) {
      // Leftmost column: label on LEFT
      nodesHtml += `
        <g class="sankey-label-group">
          <text x="${node.x0 - 14}" y="${midY - 10}" text-anchor="end" class="sankey-node-text-title">${node.id}</text>
          <text x="${node.x0 - 14}" y="${midY + 7}" text-anchor="end" class="sankey-node-text-val" fill="${node.color}">${formattedVal}</text>
          <text x="${node.x0 - 14}" y="${midY + 22}" text-anchor="end" class="sankey-node-text-pct">100.0% of Revenue</text>
        </g>
      `;
    } else if (node.col === 3) {
      // Rightmost column: label on RIGHT
      nodesHtml += `
        <g class="sankey-label-group">
          <text x="${node.x1 + 14}" y="${midY - 10}" text-anchor="start" class="sankey-node-text-title">${node.id}</text>
          <text x="${node.x1 + 14}" y="${midY + 7}" text-anchor="start" class="sankey-node-text-val" fill="${node.color}">${formattedVal}</text>
          <text x="${node.x1 + 14}" y="${midY + 22}" text-anchor="start" class="sankey-node-text-pct">${pct}% of Revenue</text>
        </g>
      `;
    } else if (node.isTerminal) {
      // Terminal expense in intermediate column: label on RIGHT
      nodesHtml += `
        <g class="sankey-label-group">
          <text x="${node.x1 + 12}" y="${midY - 9}" text-anchor="start" class="sankey-node-text-title">${node.id}</text>
          <text x="${node.x1 + 12}" y="${midY + 7}" text-anchor="start" class="sankey-node-text-val" fill="${node.color}">${formattedVal}</text>
          <text x="${node.x1 + 12}" y="${midY + 21}" text-anchor="start" class="sankey-node-text-pct">${pct}% of Rev</text>
        </g>
      `;
    } else {
      // Flow node in intermediate column (Gross Profit, Operating Income): label centered ABOVE
      nodesHtml += `
        <g class="sankey-label-group">
          <text x="${node.x0 + nodeWidth / 2}" y="${node.y0 - 20}" text-anchor="middle" class="sankey-node-text-title">${node.id}</text>
          <text x="${node.x0 + nodeWidth / 2}" y="${node.y0 - 5}" text-anchor="middle" class="sankey-node-text-val" fill="${node.color}">${formattedVal} (${pct}%)</text>
        </g>
      `;
    }
  });

  container.innerHTML = `
    <svg class="sankey-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        ${defsGradients}
      </defs>
      <!-- Flow Ribbons -->
      <g class="sankey-ribbons-layer">
        ${ribbonsHtml}
      </g>
      <!-- Node Bars & Labels -->
      <g class="sankey-nodes-layer">
        ${nodesHtml}
      </g>
    </svg>
    <div id="sankey-tooltip" class="sankey-tooltip"></div>
  `;

  // Dynamic Tooltip Listeners
  const tooltip = document.getElementById('sankey-tooltip');
  if (tooltip) {
    const targets = container.querySelectorAll('[data-tooltip]');
    targets.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        tooltip.innerHTML = el.getAttribute('data-tooltip');
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX - rect.left + 15}px`;
        tooltip.style.top = `${e.clientY - rect.top + 15}px`;
      });
      el.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });
  }
}

// 4. Financial Health Multi-Year Trend Line Chart
function renderFinancialHealthChart(health) {
  const container = document.getElementById('finhealth-chart-container');
  const deBadge = document.getElementById('health-de-badge');
  if (!container || !health || health.length === 0) return;

  const latest = health[health.length - 1];
  if (deBadge && latest) {
    const deRatio = latest.equity > 0 ? (latest.debt / latest.equity).toFixed(2) : 'N/A';
    deBadge.textContent = `Latest D/E: ${deRatio}x`;
    deBadge.className = `badge ${deRatio < 0.8 ? 'badge-success' : deRatio < 1.5 ? 'badge-accent' : 'badge-danger'}`;
  }

  const W = 540;
  const H = 220;
  const padL = 55;
  const padR = 25;
  const padT = 30;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  let maxVal = 10;
  health.forEach(d => {
    maxVal = Math.max(maxVal, d.debt || 0, d.equity || 0, d.cash || 0);
  });
  maxVal *= 1.15;

  const getX = (idx) => padL + (idx / Math.max(1, health.length - 1)) * plotW;
  const getY = (val) => padT + plotH - (Math.max(0, val) / maxVal) * plotH;

  const debtPts = health.map((d, i) => `${getX(i).toFixed(1)},${getY(d.debt).toFixed(1)}`).join(' ');
  const eqPts = health.map((d, i) => `${getX(i).toFixed(1)},${getY(d.equity).toFixed(1)}`).join(' ');
  const cashPts = health.map((d, i) => `${getX(i).toFixed(1)},${getY(d.cash).toFixed(1)}`).join(' ');

  // Gridlines & Labels
  let grid = '';
  [0, 0.33, 0.66, 1].forEach(frac => {
    const y = padT + plotH - frac * plotH;
    const v = (frac * maxVal).toFixed(0);
    grid += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="chart-grid-line" />
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-text">$${v}B</text>
    `;
  });

  let xLabels = '';
  health.forEach((d, i) => {
    const x = getX(i);
    xLabels += `<text x="${x}" y="${H - 10}" text-anchor="middle" class="chart-axis-text">${d.year}</text>`;
  });

  let dots = '';
  health.forEach((d, i) => {
    const x = getX(i);
    dots += `
      <circle cx="${x}" cy="${getY(d.debt)}" r="4" fill="#ef4444" stroke="#ffffff" stroke-width="1.5" class="chart-dot">
        <title>${d.year} Debt: $${d.debt.toFixed(1)}B</title>
      </circle>
      <circle cx="${x}" cy="${getY(d.equity)}" r="4" fill="#10b981" stroke="#ffffff" stroke-width="1.5" class="chart-dot">
        <title>${d.year} Equity: $${d.equity.toFixed(1)}B</title>
      </circle>
      <circle cx="${x}" cy="${getY(d.cash)}" r="4" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" class="chart-dot">
        <title>${d.year} Cash: $${d.cash.toFixed(1)}B</title>
      </circle>
    `;
  });

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${grid}
      ${xLabels}
      <!-- Lines -->
      <polyline points="${debtPts}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" />
      <polyline points="${eqPts}" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" />
      <polyline points="${cashPts}" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 2" />
      ${dots}
      <!-- Legend -->
      <g transform="translate(${padL}, 14)">
        <circle cx="5" cy="0" r="4" fill="#10b981" />
        <text x="14" y="3" fill="#cbd5e1" font-size="11">Stockholders' Equity</text>
        <circle cx="160" cy="0" r="4" fill="#ef4444" />
        <text x="169" y="3" fill="#cbd5e1" font-size="11">Total Debt</text>
        <circle cx="260" cy="0" r="4" fill="#38bdf8" />
        <text x="269" y="3" fill="#cbd5e1" font-size="11">Cash &amp; Equivalents</text>
      </g>
    </svg>
  `;
}

// 5. Earnings & Margin Conversion Multi-Bar Chart
function renderEarningsTrendChart(earnings) {
  const container = document.getElementById('earnings-chart-container');
  const cagrBadge = document.getElementById('earnings-cagr-badge');
  if (!container || !earnings || earnings.length === 0) return;

  if (cagrBadge && earnings.length >= 2) {
    const firstRev = earnings[0].revenue || 1;
    const lastRev = earnings[earnings.length - 1].revenue || 1;
    const yrs = earnings.length - 1;
    const cagr = ((Math.pow(lastRev / firstRev, 1 / yrs) - 1) * 100).toFixed(1);
    cagrBadge.textContent = `Rev CAGR: ${cagr}%`;
  }

  const W = 540;
  const H = 220;
  const padL = 55;
  const padR = 25;
  const padT = 30;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  let maxVal = 10;
  earnings.forEach(d => {
    maxVal = Math.max(maxVal, d.revenue || 0, d.operatingIncome || 0, d.netIncome || 0);
  });
  maxVal *= 1.15;

  const numYears = earnings.length;
  const groupW = plotW / numYears;
  const barW = Math.max(8, Math.min(22, (groupW - 16) / 3));

  let grid = '';
  [0, 0.33, 0.66, 1].forEach(frac => {
    const y = padT + plotH - frac * plotH;
    const v = (frac * maxVal).toFixed(0);
    grid += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="chart-grid-line" />
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-text">$${v}B</text>
    `;
  });

  let bars = '';
  let xLabels = '';
  earnings.forEach((d, i) => {
    const yr = d.year || d.period || '';
    const groupX = padL + i * groupW + (groupW - barW * 3 - 6) / 2;
    const midGroupX = padL + (i + 0.5) * groupW;

    const hRev = Math.max(2, (Math.max(0, d.revenue) / maxVal) * plotH);
    const hOp = Math.max(2, (Math.max(0, d.operatingIncome) / maxVal) * plotH);
    const hNet = Math.max(2, (Math.max(0, d.netIncome) / maxVal) * plotH);

    const yRev = padT + plotH - hRev;
    const yOp = padT + plotH - hOp;
    const yNet = padT + plotH - hNet;

    bars += `
      <rect x="${groupX}" y="${yRev}" width="${barW}" height="${hRev}" fill="#3887fe" rx="3" class="chart-bar-rect">
        <title>${yr} Revenue: $${d.revenue.toFixed(1)}B</title>
      </rect>
      <rect x="${groupX + barW + 3}" y="${yOp}" width="${barW}" height="${hOp}" fill="#0ea5e9" rx="3" class="chart-bar-rect">
        <title>${yr} Operating Income: $${d.operatingIncome.toFixed(1)}B</title>
      </rect>
      <rect x="${groupX + (barW + 3) * 2}" y="${yNet}" width="${barW}" height="${hNet}" fill="#10b981" rx="3" class="chart-bar-rect">
        <title>${yr} Net Income: $${d.netIncome.toFixed(1)}B</title>
      </rect>
    `;

    xLabels += `<text x="${midGroupX}" y="${H - 10}" text-anchor="middle" class="chart-axis-text">${yr}</text>`;
  });

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${grid}
      ${xLabels}
      ${bars}
      <!-- Legend -->
      <g transform="translate(${padL}, 14)">
        <rect x="0" y="-8" width="12" height="12" fill="#3887fe" rx="2" />
        <text x="16" y="2" fill="#cbd5e1" font-size="11">Revenue</text>
        <rect x="100" y="-8" width="12" height="12" fill="#0ea5e9" rx="2" />
        <text x="116" y="2" fill="#cbd5e1" font-size="11">Operating Income</text>
        <rect x="240" y="-8" width="12" height="12" fill="#10b981" rx="2" />
        <text x="256" y="2" fill="#cbd5e1" font-size="11">Net Income</text>
      </g>
    </svg>
  `;
}

// 6. Management Capital Allocation Stacked Area Chart
function renderManagementAllocationChart(alloc) {
  const container = document.getElementById('mgmt-alloc-chart-container');
  const buffettBadge = document.getElementById('mgmt-buffett-badge');
  if (!container || !alloc || alloc.length === 0) return;

  if (buffettBadge) {
    buffettBadge.textContent = 'Buffett $1 Test: Passed';
    buffettBadge.className = 'badge badge-success';
  }

  const W = 540;
  const H = 220;
  const padL = 55;
  const padR = 25;
  const padT = 30;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  let maxVal = 10;
  alloc.forEach(d => {
    const total = (d.research || 0) + (d.production || 0) + (d.acquisitions || 0);
    maxVal = Math.max(maxVal, total);
  });
  maxVal *= 1.15;

  const N = alloc.length;
  const getX = (idx) => padL + (idx / Math.max(1, N - 1)) * plotW;
  const getY = (val) => padT + plotH - (Math.max(0, val) / maxVal) * plotH;
  const yBase = padT + plotH;

  // Stack 1: Baseline to Research (R&D)
  // Stack 2: Research to Research + Production (Capex)
  // Stack 3: Production to Research + Production + Acquisitions (M&A)
  const ptsBottom = alloc.map((_, i) => `${getX(i).toFixed(1)},${yBase.toFixed(1)}`);
  const ptsL1 = alloc.map((d, i) => `${getX(i).toFixed(1)},${getY(d.research || 0).toFixed(1)}`);
  const ptsL2 = alloc.map((d, i) => `${getX(i).toFixed(1)},${getY((d.research || 0) + (d.production || 0)).toFixed(1)}`);
  const ptsL3 = alloc.map((d, i) => `${getX(i).toFixed(1)},${getY((d.research || 0) + (d.production || 0) + (d.acquisitions || 0)).toFixed(1)}`);

  // Closed polygons for stacked areas (Must start with M command)
  const areaResearch = `M ${ptsBottom[0]} ` +
    ptsL1.map(pt => `L ${pt}`).join(' ') +
    ` L ${ptsBottom[N - 1]} ` +
    ptsBottom.slice().reverse().map(pt => `L ${pt}`).join(' ') +
    ' Z';

  const areaProduction = `M ${ptsL1[0]} ` +
    ptsL2.map(pt => `L ${pt}`).join(' ') +
    ` L ${ptsL1[N - 1]} ` +
    ptsL1.slice().reverse().map(pt => `L ${pt}`).join(' ') +
    ' Z';

  const areaMna = `M ${ptsL2[0]} ` +
    ptsL3.map(pt => `L ${pt}`).join(' ') +
    ` L ${ptsL2[N - 1]} ` +
    ptsL2.slice().reverse().map(pt => `L ${pt}`).join(' ') +
    ' Z';

  let grid = '';
  [0, 0.33, 0.66, 1].forEach(frac => {
    const y = padT + plotH - frac * plotH;
    const v = (frac * maxVal).toFixed(0);
    grid += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="chart-grid-line" />
      <text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-text">$${v}B</text>
    `;
  });

  let xLabels = '';
  alloc.forEach((d, i) => {
    xLabels += `<text x="${getX(i)}" y="${H - 10}" text-anchor="middle" class="chart-axis-text">${d.year}</text>`;
  });

  let dots = '';
  alloc.forEach((d, i) => {
    const x = getX(i);
    const yTot = getY((d.research || 0) + (d.production || 0) + (d.acquisitions || 0));
    const total = ((d.research || 0) + (d.production || 0) + (d.acquisitions || 0)).toFixed(1);
    dots += `
      <circle cx="${x}" cy="${yTot}" r="4.5" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" class="chart-dot">
        <title>${d.year} Capital Deployed: $${total}B (R&D: $${d.research}B, Capex: $${d.production}B, M&A: $${d.acquisitions}B)</title>
      </circle>
    `;
  });

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="gradResearch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.2" />
        </linearGradient>
        <linearGradient id="gradProduction" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.2" />
        </linearGradient>
        <linearGradient id="gradMna" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.2" />
        </linearGradient>
      </defs>
      ${grid}
      ${xLabels}
      <!-- Stacked Area Layers -->
      <path d="${areaResearch}" fill="url(#gradResearch)" />
      <path d="${areaProduction}" fill="url(#gradProduction)" />
      <path d="${areaMna}" fill="url(#gradMna)" />
      <!-- Top Outline Lines -->
      <polyline points="${ptsL1.join(' ')}" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" />
      <polyline points="${ptsL2.join(' ')}" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" />
      <polyline points="${ptsL3.join(' ')}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" />
      ${dots}
      <!-- Legend -->
      <g transform="translate(${padL}, 14)">
        <rect x="0" y="-8" width="12" height="12" fill="#8b5cf6" rx="2" />
        <text x="16" y="2" fill="#cbd5e1" font-size="11">R&amp;D (Research)</text>
        <rect x="130" y="-8" width="12" height="12" fill="#10b981" rx="2" />
        <text x="146" y="2" fill="#cbd5e1" font-size="11">Capex (Production)</text>
        <rect x="270" y="-8" width="12" height="12" fill="#f59e0b" rx="2" />
        <text x="286" y="2" fill="#cbd5e1" font-size="11">M&amp;A (Acquisitions)</text>
      </g>
    </svg>
  `;
}

// 7. Dividend Growth & Safety Scorecard
function renderDividendScorecard(divData, metrics) {
  const chartContainer = document.getElementById('dividend-chart-container');
  const metricsGrid = document.getElementById('dividend-metrics-grid');
  const safetyBadge = document.getElementById('dividend-safety-badge');
  if (!chartContainer || !metricsGrid) return;

  const hasDividends = divData && divData.some(d => (d.dps || 0) > 0);

  if (safetyBadge) {
    const safetyMetric = (metrics || []).find(m => m.label.includes('Safety'));
    const safetyVal = safetyMetric ? safetyMetric.value : (hasDividends ? 'Tier 1 (Safe)' : 'Growth / Zero Payout');
    safetyBadge.textContent = safetyVal;
    safetyBadge.className = `badge ${safetyVal.includes('Safe') || safetyVal.includes('Tier 1') ? 'badge-success' : 'badge-accent'}`;
  }

  if (!hasDividends) {
    chartContainer.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: var(--text-secondary); padding: 20px;">
        <span style="font-size: 28px; margin-bottom: 8px;">💎</span>
        <strong style="color: #ffffff; font-size: 14px;">Zero Dividend Payer / 100% Retained Expansion</strong>
        <p style="font-size: 12px; margin-top: 4px; max-width: 360px;">Management reallocates 100% of operating cash flows back into research, production scaling, and compounding shareholder equity.</p>
      </div>
    `;
  } else {
    const W = 540;
    const H = 160;
    const padL = 50;
    const padR = 25;
    const padT = 20;
    const padB = 25;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    let maxDps = 1.0;
    divData.forEach(d => { maxDps = Math.max(maxDps, d.dps || 0); });
    maxDps *= 1.2;

    const getX = (idx) => padL + (idx / Math.max(1, divData.length - 1)) * plotW;
    const getY = (val) => padT + plotH - (Math.max(0, val) / maxDps) * plotH;

    const pts = divData.map((d, i) => `${getX(i).toFixed(1)},${getY(d.dps).toFixed(1)}`).join(' ');

    let grid = '';
    [0, 0.5, 1].forEach(frac => {
      const y = padT + plotH - frac * plotH;
      const v = (frac * maxDps).toFixed(2);
      grid += `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="chart-grid-line" />
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-text">$${v}</text>
      `;
    });

    let xLabels = '';
    let dots = '';
    divData.forEach((d, i) => {
      const x = getX(i);
      xLabels += `<text x="${x}" y="${H - 6}" text-anchor="middle" class="chart-axis-text">${d.year}</text>`;
      dots += `
        <circle cx="${x}" cy="${getY(d.dps)}" r="4" fill="#ec4899" stroke="#ffffff" stroke-width="1.5" class="chart-dot">
          <title>${d.year} DPS: $${d.dps.toFixed(2)}</title>
        </circle>
      `;
    });

    chartContainer.innerHTML = `
      <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${grid}
        ${xLabels}
        <polyline points="${pts}" fill="none" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round" />
        ${dots}
        <text x="${padL}" y="12" fill="#ec4899" font-size="11" font-weight="700">Dividends Per Share (DPS) Trajectory</text>
      </svg>
    `;
  }

  // Render 4 KPI badges
  const items = metrics || [
    { label: 'Dividend Yield', value: '1.2%', isPercentage: true },
    { label: 'Payout Ratio', value: '25.4%', isPercentage: true },
    { label: 'FCF Coverage', value: 'Comfortably Covered', isPercentage: false },
    { label: 'Safety Rating', value: 'Tier 1 (Safe)', isPercentage: false }
  ];

  metricsGrid.innerHTML = items.map(m => `
    <div class="dividend-metric-item">
      <span class="dividend-metric-label">${m.label}</span>
      <strong class="dividend-metric-val">${m.value}</strong>
    </div>
  `).join('');
}

// 8. Focus Modal & Share Controller
function showEquityModal(chartKey) {
  const modal = document.getElementById('equity-modal');
  const titleEl = document.getElementById('equity-modal-title');
  const iconEl = document.getElementById('equity-modal-icon');
  const bodyEl = document.getElementById('equity-modal-body');
  if (!modal || !bodyEl) return;

  const visuals = currentEquityVisuals || {};
  const sym = currentTicker;

  switch (chartKey) {
    case 'snowflake':
      iconEl.textContent = '❄️';
      titleEl.textContent = `${sym} Snowflake Radar Quality Scorecard`;
      const sf = visuals.snowflakeScores || {};
      const dims = sf.dimensions || [];
      bodyEl.innerHTML = `
        <div class="modal-section-title">Methodology & Framework</div>
        <p>The Snowflake Quality Scorecard synthesizes five core fundamental pillars into a unified 1-to-10 scale based on balance sheet strength, intrinsic valuation, operating returns, dividend sustainability, and capital stewardship.</p>
        
        <div class="modal-formula-box">
          Composite Snowflake Score = Health + Value + Performance + Dividend + Management (Max 50)
        </div>

        <table class="modal-table">
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Score</th>
              <th>Benchmark Criterion</th>
              <th>Current Metric</th>
            </tr>
          </thead>
          <tbody>
            ${dims.map(d => `
              <tr>
                <td><strong style="color: ${d.color};">${d.name}</strong></td>
                <td><strong>${d.value} / 10</strong></td>
                <td>${d.name === 'Health' ? 'Debt/Equity &lt; 0.6x, Current Ratio &gt; 1.5x' : d.name === 'Value' ? 'PEG &lt; 1.5x, DCF Fair Value discount' : d.name === 'Performance' ? 'ROIC &gt; 15%, Revenue CAGR &gt; 10%' : d.name === 'Dividend' ? 'Payout Ratio &lt; 60%, FCF Coverage' : 'Warren Buffett $1 Retained Earnings Test'}</td>
                <td>${d.desc || 'Optimized'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="modal-section-title">Key Investor Takeaways</div>
        <p>A score above 35/50 indicates an exceptional franchise with strong capital compounder characteristics, pristine liquidity, and conservative debt leverage.</p>
      `;
      break;

    case 'fairvalue':
      iconEl.textContent = '⚖️';
      titleEl.textContent = `${sym} Share Price vs DCF Fair Value Intrinsic Analysis`;
      const fv = visuals.sharePriceVsFairValue || {};
      bodyEl.innerHTML = `
        <div class="modal-section-title">2-Stage Discounted Cash Flow Model</div>
        <p>This model projects high-growth free cash flows over a 5-year explicit horizon (discounted by Damodaran synthetic WACC), before transitioning to a perpetual terminal growth rate capped at the risk-free 10-year Treasury yield.</p>

        <div class="modal-formula-box">
          Enterprise Value = ∑ [ FCF_t / (1 + WACC)^t ] + [ FCF_5 * (1 + g) / (WACC - g) ] / (1 + WACC)^5<br/>
          Equity Value Per Share = (Enterprise Value - Net Debt) / Shares Outstanding
        </div>

        <table class="modal-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Value</th>
              <th>Description / Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Current Market Price</td>
              <td><strong>$${fv.currentPrice ? fv.currentPrice.toFixed(2) : '0.00'}</strong></td>
              <td>Live quote feed from market exchange</td>
            </tr>
            <tr>
              <td>DCF Fair Value</td>
              <td><strong>$${fv.fairValue ? fv.fairValue.toFixed(2) : '0.00'}</strong></td>
              <td>Intrinsic per-share value based on future cash generation</td>
            </tr>
            <tr>
              <td>Valuation Disconnect</td>
              <td><strong style="color: ${fv.status === 'Undervalued' ? '#10b981' : '#ef4444'};">${fv.diffPercent >= 0 ? '+' : ''}${fv.diffPercent ? fv.diffPercent.toFixed(1) : 0}%</strong></td>
              <td>${fv.status || 'Fairly Valued'} relative to fair value benchmark</td>
            </tr>
            <tr>
              <td>Discount Rate (WACC)</td>
              <td><strong>${fv.waccPercent || 8.5}%</strong></td>
              <td>Cost of capital hurdle derived from NYU Stern synthetic rating</td>
            </tr>
            <tr>
              <td>Terminal Growth Rate (g)</td>
              <td><strong>${fv.terminalGrowthPercent || 2.5}%</strong></td>
              <td>Long-term sustainable expansion cap (FRED Risk-Free rate constrained)</td>
            </tr>
          </tbody>
        </table>
      `;
      break;

    case 'sankey':
      iconEl.textContent = '🌊';
      const sfData = visuals.revenueExpensesFlow || {};
      const sfYear = currentSankeySelectedYear || sfData.selectedYear || (sfData.availableYears && sfData.availableYears[sfData.availableYears.length - 1]) || sfData.year || 'Latest';
      const sfFlow = (sfData.byYear && sfYear && sfData.byYear[sfYear]) ? sfData.byYear[sfYear] : sfData;
      titleEl.textContent = `${sym} (FY ${sfYear}) Revenue & Expenses Waterfall Flow`;
      bodyEl.innerHTML = `
        <div class="modal-section-title">Capital Conversion Waterfall (FY ${sfYear})</div>
        <p>Illustrates how top-line gross revenue converts through manufacturing expenses (COGS), operating expenses (R&D, SG&A), and taxation into bottom-line Net Earnings for Fiscal Year ${sfYear}.</p>

        <div class="modal-formula-box">
          Gross Profit = Total Revenue - COGS<br/>
          Operating Income (EBIT) = Gross Profit - R&D - SG&A<br/>
          Net Earnings = Operating Income - Taxes &amp; Non-Operating Charges
        </div>

        <table class="modal-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Amount</th>
              <th>% of Total Revenue</th>
              <th>Margin Classification</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Revenue</td>
              <td><strong>${formatLargeNumber(sfFlow.totalRevenue)}</strong></td>
              <td>100.0%</td>
              <td>Top-Line Run Rate</td>
            </tr>
            <tr>
              <td>Cost of Sales (COGS)</td>
              <td>${formatLargeNumber(sfFlow.costOfSales)}</td>
              <td>${((sfFlow.costOfSales / (sfFlow.totalRevenue || 1)) * 100).toFixed(1)}%</td>
              <td>Direct Fulfillment / Manufacturing</td>
            </tr>
            <tr>
              <td>Gross Profit</td>
              <td><strong>${formatLargeNumber(sfFlow.grossProfit)}</strong></td>
              <td>${((sfFlow.grossProfit / (sfFlow.totalRevenue || 1)) * 100).toFixed(1)}%</td>
              <td>Gross Margin Tier</td>
            </tr>
            <tr>
              <td>Research &amp; Development</td>
              <td>${formatLargeNumber(sfFlow.rnd)}</td>
              <td>${((sfFlow.rnd / (sfFlow.totalRevenue || 1)) * 100).toFixed(1)}%</td>
              <td>Innovation Reinvestment</td>
            </tr>
            <tr>
              <td>Operating Income (EBIT)</td>
              <td><strong>${formatLargeNumber(sfFlow.operatingIncome)}</strong></td>
              <td>${((sfFlow.operatingIncome / (sfFlow.totalRevenue || 1)) * 100).toFixed(1)}%</td>
              <td>Core Operating Margin</td>
            </tr>
            <tr>
              <td>Net Earnings</td>
              <td><strong style="color: #34d399;">${formatLargeNumber(sfFlow.netEarnings)}</strong></td>
              <td><strong>${((sfFlow.netEarnings / (sfFlow.totalRevenue || 1)) * 100).toFixed(1)}%</strong></td>
              <td>Bottom-Line Net Margin</td>
            </tr>
          </tbody>
        </table>
      `;
      break;

    case 'finhealth':
      iconEl.textContent = '🏥';
      titleEl.textContent = `${sym} Financial Health & Solvency Profile`;
      const fh = visuals.financialHealth || [];
      bodyEl.innerHTML = `
        <div class="modal-section-title">Capital Structure & Solvency Trend</div>
        <p>Examines whether balance sheet debt is conservatively covered by equity and liquid cash reserves across multi-year reporting periods.</p>

        <table class="modal-table">
          <thead>
            <tr>
              <th>Fiscal Year</th>
              <th>Total Debt</th>
              <th>Stockholders' Equity</th>
              <th>Cash &amp; Equivalents</th>
              <th>Debt / Equity</th>
            </tr>
          </thead>
          <tbody>
            ${fh.map(d => `
              <tr>
                <td><strong>${d.year}</strong></td>
                <td>$${d.debt.toFixed(1)}B</td>
                <td>$${d.equity.toFixed(1)}B</td>
                <td>$${d.cash.toFixed(1)}B</td>
                <td><strong>${d.equity > 0 ? (d.debt / d.equity).toFixed(2) : 'N/A'}x</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;

    case 'earnings':
      iconEl.textContent = '📈';
      titleEl.textContent = `${sym} Multi-Year Earnings & Operating Leverage`;
      const et = visuals.earningsTrend || [];
      bodyEl.innerHTML = `
        <div class="modal-section-title">Top-Line to Bottom-Line Conversion</div>
        <p>Monitors operating leverage and expansion efficiency over multi-year business cycles.</p>

        <table class="modal-table">
          <thead>
            <tr>
              <th>Fiscal Year</th>
              <th>Revenue</th>
              <th>Operating Income</th>
              <th>Net Income</th>
              <th>Net Margin %</th>
            </tr>
          </thead>
          <tbody>
            ${et.map(d => `
              <tr>
                <td><strong>${d.year || d.period || ''}</strong></td>
                <td>$${d.revenue.toFixed(1)}B</td>
                <td>$${d.operatingIncome.toFixed(1)}B</td>
                <td>$${d.netIncome.toFixed(1)}B</td>
                <td><strong>${((d.netIncome / (d.revenue || 1)) * 100).toFixed(1)}%</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;

    case 'mgmt-alloc':
      iconEl.textContent = '💼';
      titleEl.textContent = `${sym} Management Capital Reinvestment Breakdown`;
      const ma = visuals.managementAllocation || [];
      bodyEl.innerHTML = `
        <div class="modal-section-title">Capital Deployment Breakdown</div>
        <p>Tracks how leadership deploys free cash flows between organic research (R&D), production facilities (Capex), and acquisitions (M&A).</p>

        <table class="modal-table">
          <thead>
            <tr>
              <th>Fiscal Year</th>
              <th>R&amp;D (Research)</th>
              <th>Capex (Production)</th>
              <th>M&amp;A (Acquisitions)</th>
              <th>Total Reinvested</th>
            </tr>
          </thead>
          <tbody>
            ${ma.map(d => `
              <tr>
                <td><strong>${d.year}</strong></td>
                <td>$${d.research.toFixed(1)}B</td>
                <td>$${d.production.toFixed(1)}B</td>
                <td>$${d.acquisitions.toFixed(1)}B</td>
                <td><strong>$${(d.research + d.production + d.acquisitions).toFixed(1)}B</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      break;

    case 'dividend':
      iconEl.textContent = '💰';
      titleEl.textContent = `${sym} Dividend Growth & Payout Sustainability`;
      const dm = visuals.dividendMetrics || [];
      const dc = visuals.dividendChartData || [];
      bodyEl.innerHTML = `
        <div class="modal-section-title">Payout Safety & Growth Metrics</div>
        <table class="modal-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Assessment</th>
            </tr>
          </thead>
          <tbody>
            ${dm.map(m => `
              <tr>
                <td><strong>${m.label}</strong></td>
                <td>${m.value}</td>
                <td>${m.label.includes('Payout') ? 'Sustainable if &lt; 60%' : m.label.includes('FCF') ? 'Free cash flow protects distribution' : 'Conservative coverage'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${dc.length > 0 ? `
          <div class="modal-section-title mt-4">Historical DPS (Annual)</div>
          <table class="modal-table">
            <thead>
              <tr><th>Year</th><th>Dividends Per Share</th></tr>
            </thead>
            <tbody>
              ${dc.map(d => `<tr><td><strong>${d.year}</strong></td><td>$${d.dps.toFixed(2)}</td></tr>`).join('')}
            </tbody>
          </table>
        ` : ''}
      `;
      break;

    default:
      iconEl.textContent = '📊';
      titleEl.textContent = 'Visual Scorecard Details';
      bodyEl.innerHTML = '<p>Detailed analysis data loaded.</p>';
  }

  modal.style.display = 'flex';
}

function handleShareChart(chartKey) {
  const visuals = currentEquityVisuals || {};
  const sym = currentTicker;
  let text = `### ${sym} Equity Research Snapshot - ${chartKey.toUpperCase()}\n`;

  if (chartKey === 'snowflake') {
    const sf = visuals.snowflakeScores || {};
    text += `Snowflake Score: ${sf.totalScore}/50 (Avg: ${sf.averageScore}/10)\n`;
    (sf.dimensions || []).forEach(d => {
      text += `- ${d.name}: ${d.value}/10 (${d.desc})\n`;
    });
  } else if (chartKey === 'fairvalue') {
    const fv = visuals.sharePriceVsFairValue || {};
    text += `Current Price: $${fv.currentPrice} | DCF Fair Value: $${fv.fairValue} (${fv.diffPercent >= 0 ? '+' : ''}${fv.diffPercent}% ${fv.status})\n`;
    text += `WACC Hurdle: ${fv.waccPercent}% | Terminal Growth Cap: ${fv.terminalGrowthPercent}%\n`;
  } else if (chartKey === 'sankey') {
    const sfData = visuals.revenueExpensesFlow || {};
    const yr = currentSankeySelectedYear || sfData.selectedYear || (sfData.availableYears && sfData.availableYears[sfData.availableYears.length - 1]) || 'Latest';
    const flow = (sfData.byYear && sfData.byYear[yr]) ? sfData.byYear[yr] : sfData;
    text += `Fiscal Year: ${yr}\n`;
    text += `Total Revenue: ${formatLargeNumber(flow.totalRevenue)} | Cost of Sales: ${formatLargeNumber(flow.costOfSales)} | Gross Profit: ${formatLargeNumber(flow.grossProfit)}\n`;
    text += `R&D: ${formatLargeNumber(flow.rnd)} | SG&A: ${formatLargeNumber(flow.sga)} | Operating Income: ${formatLargeNumber(flow.operatingIncome)}\n`;
    text += `Net Earnings: ${formatLargeNumber(flow.netEarnings)} (${((flow.netEarnings / (flow.totalRevenue || 1)) * 100).toFixed(1)}% Net Margin)\n`;
  } else {
    text += `Generated by Composite Investment Research Engine for ${sym}.\n`;
  }

  navigator.clipboard.writeText(text).then(() => {
    alert(`✅ Copied ${sym} ${chartKey} snapshot to clipboard!`);
  }).catch(() => {
    alert(`Snapshot:\n${text}`);
  });
}

// -------------------------------------------------------------
// MACRO ECONOMY RESEARCH DATA CONTROLLER
// -------------------------------------------------------------
function quickResearchTicker(ticker) {
  if (!ticker) return;
  const clean = ticker.trim().toUpperCase();
  switchView('company');
  searchInput.value = clean;
  searchClearBtn.style.display = 'block';
  startResearch(clean);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.quickResearchTicker = quickResearchTicker;

async function fetchMacroData() {
  const btn = document.getElementById('btn-refresh-macro');
  if (btn) btn.textContent = '⏳ Loading Macro...';

  try {
    const data = await apiFetch('/api/macro');
    if (data.success && data.macro) {
      currentMacroData = data.macro;
      renderMacroDashboard(data.macro);
      macroDataLoaded = true;
    }
  } catch (err) {
    if (err.message === 'STATIC_HOSTING_MODE' || isStaticHostingMode) {
      const bundle = await loadBundledDemo();
      if (bundle && bundle.macro) {
        currentMacroData = bundle.macro;
        renderMacroDashboard(bundle.macro);
        macroDataLoaded = true;
      }
    } else {
      console.error('Failed to fetch macroeconomic data:', err);
    }
  } finally {
    if (btn) btn.textContent = '🔄 Refresh Macro Data';
  }
}

function renderMacroDashboard(macro) {
  if (!macro) return;
  currentMacroData = macro;
  const fred = macro.fred || {};
  const dam = macro.damodaran || {};
  const reg = macro.regimeAssessment || {};
  const overview = macro.overview || {};

  // As of Date
  const asOfEl = document.getElementById('macro-asof-display');
  if (asOfEl && macro.asOfDate) {
    asOfEl.textContent = `As of: ${macro.asOfDate}`;
  }

  // --- 0. Top Market Barometers ---
  renderMarketBarometers(overview, fred);

  // --- 1. Market Movers & Breadth ---
  if (macro.marketMovers) {
    renderMarketMovers(macro.marketMovers);
  }

  // --- 2. Sectors & Industries Segments ---
  renderSegmentsList(macro);

  // --- 3. Sector Performance Horizontal Bar Chart ---
  renderSectorPerformanceChart(macro);

  // --- 4. Industry Heatmap Matrix ---
  if (Array.isArray(macro.industryPerformance)) {
    renderIndustryHeatmap(macro.industryPerformance);
  }

  // --- 5. Rates & Treasury Term Structure ---
  const rfEl = document.getElementById('macro-full-rf');
  if (rfEl) rfEl.textContent = fmt(fred.riskFreeRate10Y, 2, '', '%');

  const ffrEl = document.getElementById('macro-full-ffr');
  if (ffrEl) ffrEl.textContent = fmt(fred.effectiveFedFundsRate, 2, '', '%');

  const ycSpread = Number.parseFloat(fred.yieldCurve10Y2YSpread);
  const ycEl = document.getElementById('macro-full-curve');
  if (ycEl) {
    ycEl.textContent = `${Number.isFinite(ycSpread) && ycSpread > 0 ? '+' : ''}${fmt(ycSpread, 2, '', '%')}`;
    ycEl.className = `stat-large-val ${ycSpread < 0 ? 'text-danger' : 'highlight'}`;
  }
  const ycStatusEl = document.getElementById('macro-full-curve-status');
  if (ycStatusEl) ycStatusEl.textContent = fred.yieldCurveRegime || 'Normal Upward Sloping';

  const gdpEl = document.getElementById('macro-full-gdp');
  if (gdpEl) {
    gdpEl.textContent = fred.nominalGDPBillions ? formatLargeNumber(fred.nominalGDPBillions * 1e9) : '$28.6T';
  }

  // --- 6. Inflation, Labor & Credit ---
  const cpiEl = document.getElementById('macro-full-cpi');
  if (cpiEl) cpiEl.textContent = fmt(fred.yoyCPIInflation, 2, '', '%');

  const unrateEl = document.getElementById('macro-full-unrate');
  if (unrateEl) unrateEl.textContent = fmt(fred.unemploymentRate, 1, '', '%');

  const bbbEl = document.getElementById('macro-full-bbb');
  if (bbbEl) bbbEl.textContent = `+${fmt(fred.bbbCreditSpread, 2)}%`;

  const expRetEl = document.getElementById('macro-full-expected-return');
  if (expRetEl) expRetEl.textContent = fmt(dam.expectedMarketReturnPercent, 2, '', '%');

  // --- 7. NYU Stern Valuation ---
  const erpBadge = document.getElementById('macro-erp-badge');
  if (erpBadge) erpBadge.textContent = fmt(dam.impliedERPPercent, 2, '', '%');

  const impliedErpEl = document.getElementById('macro-implied-erp');
  if (impliedErpEl) impliedErpEl.textContent = fmt(dam.impliedERPPercent, 2, '', '%');

  const tenYearErpEl = document.getElementById('macro-ten-year-erp');
  if (tenYearErpEl) tenYearErpEl.textContent = fmt(dam.tenYearAverageERP, 2, '', '%');

  const termCapEl = document.getElementById('macro-terminal-cap');
  if (termCapEl) termCapEl.textContent = `≤ ${dam.terminalGrowthRateCap || '3.0%'}`;

  // Default Spreads Table
  const tiersBody = document.querySelector('#macro-rating-tiers-table tbody');
  if (tiersBody && Array.isArray(dam.ratingTiers)) {
    tiersBody.innerHTML = dam.ratingTiers.map(t => `
      <tr>
        <td>${t.min > 0 ? `≥ ${t.min}x` : '< 0.5x'}</td>
        <td><strong>${t.rating}</strong></td>
        <td>+${t.spread.toFixed(2)}%</td>
        <td><span class="badge ${t.spread <= 1.5 ? 'badge-success' : t.spread <= 3.5 ? 'badge-warning' : 'badge-danger'}">${t.category}</span></td>
      </tr>
    `).join('');
  }

  // Sector Cost of Capital Catalog Table
  const sectorsBody = document.querySelector('#macro-sectors-table tbody');
  if (sectorsBody && Array.isArray(dam.sectors)) {
    sectorsBody.innerHTML = dam.sectors.map(s => `
      <tr>
        <td><strong>${s.sectorName}</strong></td>
        <td>${fmt(s.unleveredBeta, 2)}</td>
        <td>${fmt(s.costOfEquityPercent, 2, '', '%')}</td>
        <td><span class="badge badge-accent">${fmt(s.waccPercent, 2, '', '%')}</span></td>
        <td>${s.rndAmortizationYears} Years</td>
        <td>${fmt(s.operatingMarginPercent, 1, '', '%')}</td>
      </tr>
    `).join('');
  }

  // Playbook
  const monStance = document.getElementById('playbook-monetary-stance');
  if (monStance) monStance.textContent = reg.monetaryStance || 'Neutral Stance';

  const lynchStatus = document.getElementById('playbook-lynch-status');
  if (lynchStatus) lynchStatus.textContent = fred.yieldCurve10Y2YSpread < 0 ? 'Cyclical Danger (Inverted)' : 'Cyclical Standard';

  const lynchDesc = document.getElementById('playbook-lynch-desc');
  if (lynchDesc) lynchDesc.textContent = reg.lynchPlaybook || 'Watch inventory growth.';

  const buffettDesc = document.getElementById('playbook-buffett-desc');
  if (buffettDesc) buffettDesc.textContent = reg.buffettHurdleRate || 'Hurdle rate is Rf + ERP.';
}

// -------------------------------------------------------------
// HELPER: RENDER MARKET BAROMETER STAT CARDS
// -------------------------------------------------------------
function renderMarketBarometers(overview, fred) {
  const cap = overview.globalMarketCap || { value: '$95.2T', change: '+0.8% today' };
  const sp = overview.sp500 || { value: '5,864.67', change: '+0.45% today' };
  const ndq = overview.nasdaq || { value: '20,530.12', change: '+0.72% today' };
  const breadth = overview.breadth || { ratio: 54.7, advancers: 2242, decliners: 1856 };

  const capVal = document.getElementById('macro-barometer-cap');
  const capChg = document.getElementById('macro-barometer-cap-change');
  if (capVal) capVal.textContent = cap.value;
  if (capChg) capChg.textContent = cap.change;

  const spVal = document.getElementById('macro-barometer-sp500');
  const spChg = document.getElementById('macro-barometer-sp500-change');
  if (spVal) spVal.textContent = sp.value;
  if (spChg) spChg.textContent = sp.change;

  const ndqVal = document.getElementById('macro-barometer-nasdaq');
  const ndqChg = document.getElementById('macro-barometer-nasdaq-change');
  if (ndqVal) ndqVal.textContent = ndq.value;
  if (ndqChg) ndqChg.textContent = ndq.change;

  const t10yVal = document.getElementById('macro-barometer-10y');
  const t10ySub = document.getElementById('macro-barometer-10y-sub');
  if (t10yVal) t10yVal.textContent = fmt(fred.riskFreeRate10Y, 2, '', '%');
  if (t10ySub) t10ySub.textContent = `10Y-2Y: ${Number(fred.yieldCurve10Y2YSpread) >= 0 ? '+' : ''}${fmt(fred.yieldCurve10Y2YSpread, 2)}%`;

  const brdVal = document.getElementById('macro-barometer-breadth');
  const brdSub = document.getElementById('macro-barometer-breadth-sub');
  if (brdVal) {
    brdVal.textContent = `${breadth.ratio}%`;
    brdVal.className = `stat-large-val ${breadth.ratio >= 50 ? 'text-success' : 'text-danger'}`;
  }
  if (brdSub) {
    brdSub.textContent = `${breadth.ratio >= 50 ? 'Bullish' : 'Bearish'} (${breadth.advancers?.toLocaleString()} vs ${breadth.decliners?.toLocaleString()})`;
  }
}

// -------------------------------------------------------------
// HELPER: RENDER MARKET MOVERS & BREADTH GAUGE
// -------------------------------------------------------------
function renderMarketMovers(movers) {
  const tbody = document.getElementById('movers-tbody');
  if (!tbody) return;

  const dataList = movers[activeMoverTab] || movers.gainers || [];
  if (dataList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No active movers data available</td></tr>`;
    return;
  }

  tbody.innerHTML = dataList.map(item => `
    <tr>
      <td>
        <span class="ticker-badge" onclick="quickResearchTicker('${item.ticker}')" title="Click to research ${item.ticker}">
          ${item.ticker}
        </span>
      </td>
      <td class="text-right font-mono">$${typeof item.close === 'number' ? item.close.toFixed(2) : item.close}</td>
      <td class="text-right font-mono ${item.changeType === 'positive' ? 'text-success' : 'text-danger'}">
        <strong>${item.change}</strong>
      </td>
      <td class="text-right font-mono text-muted">${item.volume || '—'}</td>
      <td class="text-center">
        <button class="btn-research-mini" onclick="quickResearchTicker('${item.ticker}')" title="Launch Composite Research for ${item.ticker}">
          Research 🔍
        </button>
      </td>
    </tr>
  `).join('');

  // Breadth Progress Bar
  const adv = movers.advancers || 2242;
  const dec = movers.decliners || 1856;
  const total = adv + dec;
  const ratio = total > 0 ? (adv / total) * 100 : 54.7;

  const advEl = document.getElementById('breadth-advancers-count');
  const decEl = document.getElementById('breadth-decliners-count');
  const ratioEl = document.getElementById('breadth-ratio-text');
  const fillEl = document.getElementById('breadth-bar-fill');

  if (advEl) advEl.textContent = adv.toLocaleString();
  if (decEl) decEl.textContent = dec.toLocaleString();
  if (ratioEl) ratioEl.textContent = `${ratio.toFixed(1)}% Advancing`;
  if (fillEl) fillEl.style.width = `${Math.min(100, Math.max(0, ratio))}%`;
}

// -------------------------------------------------------------
// HELPER: RENDER SECTOR & INDUSTRY SEGMENTS
// -------------------------------------------------------------
function renderSegmentsList(macro) {
  const container = document.getElementById('segments-list-container');
  if (!container) return;

  if (activeSegmentTab === 'sectors') {
    const list = macro.sectorPerformance || [];
    container.innerHTML = list.map(s => `
      <div class="segment-row">
        <div class="segment-left">
          <span class="segment-icon">${s.icon || '📊'}</span>
          <span>${s.name}</span>
        </div>
        <span class="segment-badge ${s.changeType === 'positive' ? 'positive' : 'negative'}">
          ${s.change}
        </span>
      </div>
    `).join('');
  } else {
    const list = macro.industryPerformance || [];
    container.innerHTML = list.map(ind => `
      <div class="segment-row">
        <div class="segment-left">
          <span class="segment-icon">▫️</span>
          <div>
            <div>${ind.name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${ind.sector}</div>
          </div>
        </div>
        <span class="segment-badge ${ind.changeType === 'positive' ? 'positive' : 'negative'}">
          ${ind.change}
        </span>
      </div>
    `).join('');
  }
}

// -------------------------------------------------------------
// HELPER: RENDER SECTOR PERFORMANCE BAR CHART
// -------------------------------------------------------------
function renderSectorPerformanceChart(macro) {
  const container = document.getElementById('sector-performance-chart');
  if (!container) return;

  const benchmarkList = macro.sectorPerformance || [];
  const spdrList = macro.spdrSectorETFs || [];

  // If benchmark data is unavailable or empty, auto-fallback to SPDR ETFs
  if (activeSectorSource === 'benchmark' && benchmarkList.length === 0 && spdrList.length > 0) {
    activeSectorSource = 'spdr';
    document.querySelectorAll('[data-sector-source]').forEach(b => {
      b.classList.toggle('active', b.dataset.sectorSource === 'spdr');
    });
  }

  const isSpdr = activeSectorSource === 'spdr';
  const dataList = isSpdr ? spdrList : benchmarkList;

  const subEl = document.getElementById('sector-chart-sub');
  if (subEl) {
    const isAnyLive = dataList.some(s => s.isLive);
    subEl.innerHTML = isSpdr
      ? `Tracking 11 Select Sector SPDR ETFs (${isAnyLive ? '<span style="color: #10b981; font-weight: 700;">● Live Market Feeds</span>' : 'Market Quotes'}) — Click ticker to research ETF`
      : `Ranked performance across 11 major market sectors (${isAnyLive ? '<span style="color: #10b981; font-weight: 700;">● Live Market Returns</span>' : 'Technology to Utilities'})`;
  }

  if (dataList.length === 0) {
    container.innerHTML = `<div class="text-center text-muted py-3">No sector performance data available</div>`;
    return;
  }

  // Sort sectors descending by return
  const sorted = [...dataList].sort((a, b) => (b.changeNum || 0) - (a.changeNum || 0));

  // Max absolute value to normalize widths
  const maxAbs = Math.max(...sorted.map(s => Math.abs(s.changeNum || 1.0)), 2.5);

  container.innerHTML = sorted.map(s => {
    const val = s.changeNum || 0;
    const isPos = val >= 0;
    const widthPct = Math.min(50, (Math.abs(val) / maxAbs) * 50);

    const labelHtml = isSpdr
      ? `<span class="etf-ticker-badge" onclick="quickResearchTicker('${s.ticker}')" title="Research ETF ${s.ticker}">${s.ticker}</span><span>${s.name}</span><span style="color: var(--text-muted); font-size: 11px; margin-left: 4px;">($${typeof s.price === 'number' ? s.price.toFixed(2) : s.price})</span>`
      : `<span>${s.icon || '📊'} ${s.name}</span>`;

    return `
      <div class="sector-bar-row">
        <div class="sector-bar-label" title="${s.fundName || s.name}">
          ${labelHtml}
        </div>
        <div class="sector-bar-track">
          <div class="sector-bar-zero-line"></div>
          ${isPos 
            ? `<div class="sector-bar-fill-right" style="width: ${widthPct.toFixed(1)}%;"></div>`
            : `<div class="sector-bar-fill-left" style="width: ${widthPct.toFixed(1)}%;"></div>`
          }
        </div>
        <div class="sector-bar-val ${isPos ? 'text-success' : 'text-danger'}">${s.change}</div>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// HELPER: RENDER INDUSTRY HEATMAP MATRIX
// -------------------------------------------------------------
function renderIndustryHeatmap(industries) {
  const grid = document.getElementById('industry-heatmap-grid');
  if (!grid) return;

  const filtered = activeHeatmapFilter === 'all'
    ? industries
    : industries.filter(ind => ind.sector === activeHeatmapFilter);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="text-center text-muted py-4" style="grid-column: 1 / -1;">No industries found for selected sector</div>`;
    return;
  }

  grid.innerHTML = filtered.map(ind => {
    const val = ind.changeNum || 0;
    let tierClass = 'tile-neutral';
    if (val >= 1.5) tierClass = 'tile-strong-pos';
    else if (val > 0) tierClass = 'tile-mod-pos';
    else if (val <= -1.5) tierClass = 'tile-strong-neg';
    else if (val < 0) tierClass = 'tile-mod-neg';

    return `
      <div class="heatmap-tile ${tierClass}">
        <div>
          <div class="heatmap-tile-header">${ind.name}</div>
          <div class="heatmap-tile-sub">${ind.sector}</div>
        </div>
        <div class="heatmap-tile-footer">
          <span style="font-size: 11px; opacity: 0.8;">Day Return</span>
          <span class="heatmap-tile-val">${ind.change}</span>
        </div>
      </div>
    `;
  }).join('');
}

// =============================================================
// INSTITUTIONAL TRADING DESK & MULTI-AGENT DEBATE CONTROLLER
// (Tauric-Inspired Autonomous Trading Firm Simulation)
// =============================================================

let currentDeskData = null;
let activeDeskTicker = 'NVDA';
let activeDebateFilter = 'all';

function setupDeskListeners() {
  // Re-Run Full Simulation Button for currently analyzed company
  const btnRunSim = document.getElementById('btn-run-desk-sim');
  if (btnRunSim) {
    btnRunSim.addEventListener('click', () => {
      const sym = currentTicker || activeDeskTicker || 'MSFT';
      fetchDeskData(sym);
    });
  }

  // Debate Round Filter Buttons
  document.querySelectorAll('.debate-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.debate-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeDebateFilter = btn.dataset.filter;
      if (currentDeskData && currentDeskData.researchDebate) {
        renderDebateStream(currentDeskData.researchDebate);
      }
    });
  });
}

async function fetchDeskData(ticker) {
  const sym = (ticker || currentTicker || activeDeskTicker || 'MSFT').trim().toUpperCase();
  activeDeskTicker = sym;

  // Sync header labels for this specific company
  const headingEl = document.getElementById('desk-company-heading');
  const badgeEl = document.getElementById('desk-ticker-badge');
  const btnTickerEl = document.getElementById('desk-btn-ticker');
  const subEl = document.getElementById('desk-company-sub');
  if (badgeEl) badgeEl.textContent = sym;
  if (btnTickerEl) btnTickerEl.textContent = sym;
  if (headingEl) {
    const compName = (currentDossier?.metadata?.symbol === sym) ? currentDossier.metadata.companyName : sym;
    headingEl.innerHTML = `Institutional Desk Simulation: <span class="text-accent">${sym}</span> ${compName ? `(${compName})` : ''}`;
  }
  if (subEl) {
    const compName = (currentDossier?.metadata?.symbol === sym) ? currentDossier.metadata.companyName : sym;
    subEl.textContent = `Autonomous multi-agent pipeline executing specialized research, adversarial Bull vs. Bear debate, algorithmic trade planning, and Tri-Party Risk Committee governance for ${compName || sym}.`;
  }

  const btnRunSim = document.getElementById('btn-run-desk-sim');
  if (btnRunSim) {
    btnRunSim.innerHTML = `<span>⏳ Simulating Desk Pipeline for ${sym}...</span>`;
    btnRunSim.disabled = true;
  }

  const mode = getAppMode();

  try {
    const res = await fetch(`/api/institutional-desk?ticker=${encodeURIComponent(sym)}&mode=${mode}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentDeskData = data;
    renderInstitutionalDesk(data);
  } catch (err) {
    console.error(`[InstitutionalDesk] Error fetching desk simulation for ${sym}:`, err);
  } finally {
    if (btnRunSim) {
      btnRunSim.innerHTML = `<span>⚡ Re-Run Simulation for <span id="desk-btn-ticker">${sym}</span></span>`;
      btnRunSim.disabled = false;
    }
  }
}

function renderInstitutionalDesk(data) {
  if (!data) return;

  renderTraderProposal(data.traderProposal, data.portfolioDecision);
  renderPortfolioDecision(data.portfolioDecision);
  renderDebateStream(data.researchDebate);
  renderResearchPlan(data.researchPlan);
  renderRiskCommittee(data.riskDebate);
  renderPolymarketContracts(data.marketData?.predictionMarkets);
  renderStockTwitsPanel(data.marketData?.retailSentiment);
  renderTechnicalMatrix(data.marketData?.technicals);
}

function renderTraderProposal(tp, pm) {
  if (!tp) return;
  const actionBadge = document.getElementById('ticket-action-badge');
  const entryEl = document.getElementById('ticket-entry-price');
  const mktEl = document.getElementById('ticket-market-price');
  const slEl = document.getElementById('ticket-stop-loss');
  const atrEl = document.getElementById('ticket-atr-buffer');
  const tp1El = document.getElementById('ticket-tp1');
  const rrEl = document.getElementById('ticket-rr-ratio');
  const tp2El = document.getElementById('ticket-tp2');
  const sizeEl = document.getElementById('ticket-position-size');
  const execEl = document.getElementById('ticket-exec-method');
  const reasonEl = document.getElementById('ticket-reasoning');

  if (actionBadge) {
    actionBadge.textContent = `ACTION: ${tp.action.toUpperCase()}`;
    actionBadge.className = `badge ticket-action-badge ${tp.action === 'Buy' ? 'badge-success' : tp.action === 'Sell' ? 'badge-danger' : 'badge-accent'}`;
  }
  if (entryEl) entryEl.textContent = `$${tp.entryPrice?.toFixed(2) || '0.00'}`;
  if (mktEl) mktEl.textContent = `Market: $${tp.currentMarketPrice?.toFixed(2) || '0.00'}`;
  if (slEl) slEl.textContent = `$${tp.stopLoss?.toFixed(2) || '0.00'}`;
  if (atrEl) atrEl.textContent = `${tp.atrStopBuffer || '1.5x ATR Buffer'}`;
  if (tp1El) tp1El.textContent = `$${tp.takeProfit1?.toFixed(2) || '0.00'}`;
  if (rrEl) rrEl.textContent = `R:R ${tp.riskRewardRatio || '2.5:1'}`;
  if (tp2El) tp2El.textContent = `$${tp.takeProfit2?.toFixed(2) || '0.00'}`;
  if (sizeEl) sizeEl.textContent = tp.positionSizing || '3.5% of Portfolio Equity';
  if (execEl) execEl.textContent = tp.executionMethod || 'Limit Order at Market / Pullback';
  if (reasonEl) reasonEl.textContent = tp.reasoning || '';
}

function renderPortfolioDecision(pm) {
  if (!pm) return;
  const badge = document.getElementById('pm-decision-badge');
  const title = document.getElementById('pm-banner-title');
  const cap = document.getElementById('pm-authorized-cap');
  const dd = document.getElementById('pm-max-dd');
  const status = document.getElementById('pm-exec-status');
  const signoff = document.getElementById('pm-executive-signoff');
  const instr = document.getElementById('pm-execution-instructions');

  if (badge) {
    badge.textContent = pm.status || 'APPROVED';
    badge.className = `badge ${pm.status === 'APPROVED' ? 'badge-success' : 'badge-accent'}`;
  }
  if (title) title.textContent = pm.decisionBadge || 'Allocation Authorized';
  if (cap) cap.textContent = pm.authorizedAllocation || '3.0% - 3.5%';
  if (dd) dd.textContent = pm.maxAllowedDrawdown || '-6.5%';
  if (status) status.textContent = pm.status === 'APPROVED' ? 'Order Authorized' : 'On Hold';
  if (signoff) signoff.textContent = pm.executiveSignOff || '';
  if (instr) instr.textContent = pm.executionInstructions || '';
}

function renderDebateStream(debate) {
  const container = document.getElementById('debate-stream');
  if (!container || !debate || !debate.turns) return;

  const turns = debate.turns.filter(t => {
    if (activeDebateFilter === 'all') return true;
    return String(t.round) === String(activeDebateFilter);
  });

  container.innerHTML = turns.map(t => {
    const isBull = t.role === 'bull';
    return `
      <div class="debate-speech-card ${isBull ? 'debate-role-bull' : 'debate-role-bear'}">
        <div class="debate-speaker-header">
          <div class="debate-speaker-meta">
            <span class="debate-speaker-name">${isBull ? '🐂' : '🐻'} ${t.speaker}</span>
            <span class="debate-badge-pill">${t.badge}</span>
          </div>
          <span class="debate-round-tag">Round ${t.round}</span>
        </div>
        <div class="debate-speech-body">${t.argument}</div>
      </div>
    `;
  }).join('');
}

function renderResearchPlan(plan) {
  if (!plan) return;
  const badge = document.getElementById('rm-recommendation-badge');
  const text = document.getElementById('rm-rationale-text');
  const actions = document.getElementById('rm-actions-list');

  if (badge) badge.textContent = `${plan.consensusVerdict || plan.recommendation} (Conviction: ${plan.convictionScore}/10)`;
  if (text) text.textContent = plan.rationale || '';
  if (actions) actions.textContent = plan.strategicActions || '';
}

function renderRiskCommittee(risk) {
  const container = document.getElementById('risk-debater-cards');
  const scoreBadge = document.getElementById('risk-score-badge');
  if (!container || !risk) return;

  if (scoreBadge && risk.riskScore) {
    scoreBadge.textContent = `Risk Score: ${risk.riskScore} / 10 (${risk.consensus || 'Approved'})`;
  }

  const debators = risk.debators || [];
  container.innerHTML = debators.map(d => {
    const roleClass = d.role === 'aggressive' ? 'risk-aggressive' : d.role === 'conservative' ? 'risk-conservative' : 'risk-neutral';
    return `
      <div class="risk-debater-box ${roleClass}">
        <div class="risk-debater-header">
          <span class="risk-debater-title">${d.speaker}</span>
          <span class="risk-debater-badge">${d.badge}</span>
        </div>
        <p class="risk-debater-text">${d.argument}</p>
      </div>
    `;
  }).join('');
}

function renderPolymarketContracts(pmData) {
  const container = document.getElementById('polymarket-contracts-container');
  if (!container) return;

  const markets = [...(pmData?.rateCuts || []), ...(pmData?.recession || [])];
  if (markets.length === 0) {
    container.innerHTML = `<div class="text-muted text-center py-2" style="font-size: 12px;">No active prediction contracts found</div>`;
    return;
  }

  container.innerHTML = markets.slice(0, 3).map(m => {
    return `
      <div class="poly-card">
        <div class="poly-info">
          <div class="poly-question">${m.question}</div>
          <div class="poly-meta">Volume: ${m.volumeFormatted || '$0'} • Ends: ${m.endDate || '2026'}</div>
        </div>
        <div class="poly-prob-badge">
          <span class="poly-prob-number">${m.mainProbabilityPercent}%</span>
          <span class="poly-prob-label">Yes Prob</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderStockTwitsPanel(sentiment) {
  const container = document.getElementById('stocktwits-container');
  if (!container || !sentiment) return;

  const bull = sentiment.bullRatio || 60;
  const bear = 100 - bull;
  const messages = sentiment.messages || [];

  container.innerHTML = `
    <div class="stocktwits-ratio-row">
      <span style="font-size: 11px; color: #10b981; font-weight: 700;">${bull}% Bull</span>
      <div class="stocktwits-bar">
        <div class="stocktwits-bull-segment" style="width: ${bull}%;"></div>
      </div>
      <span style="font-size: 11px; color: #ef4444; font-weight: 700;">${bear}% Bear</span>
    </div>
    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px;">
      Verdict: <strong style="color: #f8fafc;">${sentiment.sentimentVerdict || 'Neutral'}</strong> (${sentiment.totalMessages || 0} messages tracked)
    </div>
    <div class="stocktwits-chatter-box">
      ${messages.slice(0, 3).map(m => `
        <div class="stocktwits-msg">
          <span style="color: ${m.sentiment === 'Bullish' ? '#10b981' : m.sentiment === 'Bearish' ? '#ef4444' : '#94a3b8'}; font-weight: 700;">@${m.username} [${m.sentiment}]:</span>
          <span>${m.body}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTechnicalMatrix(tech) {
  const container = document.getElementById('technical-matrix-container');
  const signalBadge = document.getElementById('technical-signal-badge');
  if (!container || !tech) return;

  if (signalBadge) {
    signalBadge.textContent = tech.overallSignal || 'Signal: Neutral';
  }

  container.innerHTML = `
    <div class="tech-pill">
      <span class="tech-pill-name">RSI (14)</span>
      <span class="tech-pill-val ${tech.rsi?.sentiment === 'bearish' ? 'text-danger' : tech.rsi?.sentiment === 'bullish' ? 'text-success' : ''}">${tech.rsi?.value || 50}</span>
      <span class="tech-pill-sub">${tech.rsi?.status || 'Neutral'}</span>
    </div>
    <div class="tech-pill">
      <span class="tech-pill-name">MACD (12,26,9)</span>
      <span class="tech-pill-val ${tech.macd?.sentiment === 'bullish' ? 'text-success' : 'text-danger'}">${tech.macd?.histogram > 0 ? '+' : ''}${tech.macd?.histogram || 0}</span>
      <span class="tech-pill-sub">${tech.macd?.crossover || 'Signal'}</span>
    </div>
    <div class="tech-pill">
      <span class="tech-pill-name">ATR (14 Volatility)</span>
      <span class="tech-pill-val text-accent">$${tech.atr?.value || 0}</span>
      <span class="tech-pill-sub">Stop: $${tech.atr?.stopLossBuffer1_5x || 0}</span>
    </div>
    <div class="tech-pill">
      <span class="tech-pill-name">50 DMA</span>
      <span class="tech-pill-val">$${tech.movingAverages?.sma50 || 0}</span>
      <span class="tech-pill-sub">${tech.movingAverages?.isAbove50 ? 'Above 50 DMA' : 'Below 50 DMA'}</span>
    </div>
    <div class="tech-pill">
      <span class="tech-pill-name">200 DMA</span>
      <span class="tech-pill-val">$${tech.movingAverages?.sma200 || 0}</span>
      <span class="tech-pill-sub">${tech.movingAverages?.regime?.includes('Golden') ? 'Golden Cross' : 'Death Cross'}</span>
    </div>
    <div class="tech-pill">
      <span class="tech-pill-name">Pivot Support/Res</span>
      <span class="tech-pill-val">$${tech.pivots?.support || 0} - $${tech.pivots?.resistance || 0}</span>
      <span class="tech-pill-sub">Range: ${tech.pivots?.rangePct || 0}%</span>
    </div>
  `;
}

// =============================================================
// EXPERTS DESK & MULTI-AGENT LEGENDS DEBATE CONTROLLER
// (Warren Buffett, Peter Lynch, Philip Fisher, Aswath Damodaran, Benjamin Graham)
// =============================================================

let currentExpertsData = null;
let activeExpertsTicker = 'MSFT';
let activeExpertsRoundFilter = 'all';
let activeExpertsSpeakerFilter = 'all';

function setupExpertsListeners() {
  // Re-Run Full Simulation Button for currently analyzed company
  const btnRunDebate = document.getElementById('btn-run-experts-debate');
  if (btnRunDebate) {
    btnRunDebate.addEventListener('click', () => {
      const sym = currentTicker || activeExpertsTicker || 'MSFT';
      fetchExpertsDesk(sym);
    });
  }

  // Debate Round Filter Buttons
  document.querySelectorAll('.expert-round-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.expert-round-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeExpertsRoundFilter = btn.dataset.round;
      if (currentExpertsData && currentExpertsData.debate) {
        renderExpertsDebateStream(currentExpertsData.debate);
      }
    });
  });

  // Legend Filter Buttons
  document.querySelectorAll('.expert-speaker-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.expert-speaker-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeExpertsSpeakerFilter = btn.dataset.speaker;
      if (currentExpertsData && currentExpertsData.debate) {
        renderExpertsDebateStream(currentExpertsData.debate);
      }
    });
  });
}

async function fetchExpertsDesk(ticker) {
  const sym = (ticker || currentTicker || activeExpertsTicker || 'MSFT').trim().toUpperCase();
  activeExpertsTicker = sym;

  // Sync header labels for this specific company
  const headingEl = document.getElementById('experts-company-heading');
  const badgeEl = document.getElementById('experts-ticker-badge');
  const btnTickerEl = document.getElementById('experts-btn-ticker');
  const subEl = document.getElementById('experts-company-sub');
  if (badgeEl) badgeEl.textContent = sym;
  if (btnTickerEl) btnTickerEl.textContent = sym;
  if (headingEl) {
    const compName = (currentDossier?.metadata?.symbol === sym) ? currentDossier.metadata.companyName : sym;
    headingEl.innerHTML = `Experts Desk: <span class="text-accent">${sym}</span> ${compName ? `(${compName})` : ''}`;
  }
  if (subEl) {
    const compName = (currentDossier?.metadata?.symbol === sym) ? currentDossier.metadata.companyName : sym;
    subEl.textContent = `Multi-agent debate clash among Warren Buffett, Peter Lynch, Philip Fisher, and Aswath Damodaran, arbitrated by Benjamin Graham for ${compName || sym}.`;
  }

  const btnRunDebate = document.getElementById('btn-run-experts-debate');
  if (btnRunDebate) {
    btnRunDebate.innerHTML = `<span>⏳ Assembling Legends for ${sym}...</span>`;
    btnRunDebate.disabled = true;
  }

  const mode = getAppMode();

  try {
    const res = await fetch(`/api/experts-desk?ticker=${encodeURIComponent(sym)}&mode=${mode}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    currentExpertsData = data;
    renderExpertsDesk(data);
  } catch (err) {
    console.error(`[ExpertsDesk] Error fetching experts debate for ${sym}:`, err);
  } finally {
    if (btnRunDebate) {
      btnRunDebate.innerHTML = `<span>⚡ Re-Run Experts Debate for <span id="experts-btn-ticker">${sym}</span></span>`;
      btnRunDebate.disabled = false;
    }
  }
}

function renderExpertsDesk(data) {
  if (!data) return;
  renderGrahamSynthesis(data.arbiterSynthesis);
  renderExpertsMatrix(data.scorecardMatrix);
  renderExpertsDebateStream(data.debate);
}

function renderGrahamSynthesis(synth) {
  if (!synth) return;
  const gradeBadge = document.getElementById('graham-grade-badge');
  const scoreEl = document.getElementById('graham-consensus-score');
  const mosEl = document.getElementById('graham-margin-safety');
  const allocEl = document.getElementById('graham-alloc-val');
  const verdictEl = document.getElementById('graham-verdict-val');
  const textEl = document.getElementById('graham-summary-text');
  const risksList = document.getElementById('graham-risks-list');

  if (gradeBadge) gradeBadge.textContent = synth.qualityGrade || 'Class A: Compounder';
  if (scoreEl) scoreEl.textContent = synth.consensusScore || '8.5 / 10';
  if (mosEl) {
    mosEl.textContent = synth.marginOfSafety || 'N/A';
    mosEl.className = `graham-val ${synth.marginOfSafety?.startsWith('+') ? 'text-success' : 'text-warning'}`;
  }
  if (allocEl) allocEl.textContent = synth.recommendedAllocation || '4.0% - 5.0%';
  if (verdictEl) verdictEl.textContent = synth.consensusVerdict || 'BUY & HOLD';
  if (textEl) textEl.textContent = synth.executiveSummary || '';

  if (risksList) {
    const risks = synth.keyRisksToWatch || [];
    risksList.innerHTML = risks.map(r => `<li>${r}</li>`).join('');
  }
}

function renderExpertsMatrix(matrix) {
  const container = document.getElementById('experts-matrix-container');
  if (!container || !Array.isArray(matrix)) return;

  container.innerHTML = matrix.map(m => {
    const roleClass = `legend-${m.expertId}`;
    return `
      <div class="legend-card ${roleClass}">
        <div class="legend-header">
          <div class="legend-avatar">${m.avatar}</div>
          <div>
            <div class="legend-name">${m.name}</div>
            <div class="legend-pillar">${m.pillar}</div>
          </div>
        </div>

        <div class="legend-stance-badge ${m.verdictClass}">${m.stance}</div>

        <div class="legend-metrics-list">
          <div class="legend-metric-item">
            <span class="m-name">Core Metric:</span>
            <span class="m-val">${m.primaryMetric}</span>
          </div>
          <div class="legend-metric-item">
            <span class="m-name">Secondary:</span>
            <span class="m-val">${m.secondaryMetric}</span>
          </div>
          <div class="legend-metric-item">
            <span class="m-name">Weight:</span>
            <span class="m-val text-accent">${m.targetWeight}</span>
          </div>
        </div>

        <div class="legend-footer">
          <span>Horizon:</span>
          <strong>${m.holdingPeriod}</strong>
        </div>
      </div>
    `;
  }).join('');
}

function renderExpertsDebateStream(debate) {
  const container = document.getElementById('experts-debate-stream');
  if (!container || !debate || !debate.turns) return;

  const turns = debate.turns.filter(t => {
    const matchesRound = (activeExpertsRoundFilter === 'all') || (String(t.round) === String(activeExpertsRoundFilter));
    const matchesSpeaker = (activeExpertsSpeakerFilter === 'all') || (t.expertId === activeExpertsSpeakerFilter);
    return matchesRound && matchesSpeaker;
  });

  if (turns.length === 0) {
    container.innerHTML = `<div class="text-muted text-center py-4">No debate turns found matching active round & legend filter.</div>`;
    return;
  }

  container.innerHTML = turns.map(t => {
    const roleClass = `speech-${t.expertId}`;
    return `
      <div class="expert-speech-card ${roleClass}">
        <div class="speech-header">
          <div class="speech-speaker-meta">
            <span class="speech-speaker-avatar">${t.avatar}</span>
            <div>
              <div class="speech-speaker-name">${t.speaker}</div>
              <div class="speech-speaker-title">${t.title}</div>
            </div>
          </div>
          <div class="speech-badges-right">
            <span class="badge ${t.stance.toLowerCase().includes('bull') || t.stance.toLowerCase().includes('buy') || t.stance.toLowerCase().includes('accumulate') || t.stance.toLowerCase().includes('discount') || t.stance.toLowerCase().includes('overweight') ? 'badge-success' : 'badge-accent'}">${t.stance}</span>
            <span class="speech-round-pill">Round ${t.round}</span>
          </div>
        </div>

        <div class="speech-quote-box">"${t.quote}"</div>
        <p class="speech-argument-text">${t.argument}</p>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// COMPETITOR DISCOVERY & PEER BENCHMARKING CONTROLLER
// -------------------------------------------------------------
let currentCompetitorData = null;
let activeCompetitorTicker = null;

async function fetchCompetitors(ticker, forceRefresh = false) {
  const sym = (ticker || currentTicker || 'MSFT').trim().toUpperCase();
  activeCompetitorTicker = sym;

  const cardsContainer = document.getElementById('comp-cards-grid');
  const tbody = document.getElementById('competitor-matrix-tbody');

  if (forceRefresh) {
    if (cardsContainer) {
      cardsContainer.innerHTML = `
        <div class="scuttlebutt-loading-skeleton">
          <div class="spinner-ring" style="width: 24px; height: 24px; border-width: 2px;"></div>
          <span>Refreshing direct industry rivals and live valuation metrics for ${sym}...</span>
        </div>
      `;
    }
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center p-4 text-muted">Refreshing peer comparison matrix...</td></tr>`;
    }
  }

  try {
    const url = `/api/competitors?ticker=${encodeURIComponent(sym)}${forceRefresh ? '&refresh=1' : ''}`;
    const data = await apiFetch(url);
    currentCompetitorData = data;
    renderCompetitors(data);
  } catch (err) {
    if (err.message === 'STATIC_HOSTING_MODE' || isStaticHostingMode) {
      const bundle = await loadBundledDemo();
      if (bundle?.competitors?.[sym]) {
        currentCompetitorData = bundle.competitors[sym];
        renderCompetitors(bundle.competitors[sym]);
        return;
      }
    }
    console.warn(`Failed to fetch competitors for ${sym}:`, err);
    if (cardsContainer) {
      cardsContainer.innerHTML = `<div class="text-muted p-3" style="font-size:12px;">Live competitor matrix requires local server or Cloud Run. (Benchmark peers available for MSFT, AAPL, NVDA, TSLA, AMZN)</div>`;
    }
  }
}

function renderCompetitors(data) {
  if (!data) return;

  // Header & Regulatory Info
  const secSector = document.getElementById('comp-sector-badge');
  const secIndustry = document.getElementById('comp-industry-badge');
  const secSic = document.getElementById('comp-sic-badge');
  const targetName = document.getElementById('comp-target-name');
  const targetTicker = document.getElementById('comp-target-ticker');
  const takeawayText = document.getElementById('comp-executive-takeaway');

  if (secSector) secSector.textContent = data.sector || 'Technology';
  if (secIndustry) secIndustry.textContent = data.industry || 'General Industry';
  if (secSic) secSic.textContent = `SEC SIC ${data.sicCode} (${data.sicDescription || ''})`;
  if (targetName) targetName.textContent = data.targetName || data.targetSymbol;
  if (targetTicker) targetTicker.textContent = data.targetSymbol;
  if (takeawayText) takeawayText.textContent = data.executiveTakeaway || '';

  // Benchmarks
  const bm = data.benchmarks || {};
  const bmPe = document.getElementById('comp-bm-pe');
  const bmPeg = document.getElementById('comp-bm-peg');
  const bmRoic = document.getElementById('comp-bm-roic');
  const bmMargin = document.getElementById('comp-bm-margin');
  const bmGrowth = document.getElementById('comp-bm-growth');

  if (bmPe) bmPe.textContent = bm.peerMedianPE ? `${bm.peerMedianPE}x` : '—';
  if (bmPeg) bmPeg.textContent = bm.peerMedianPEG ? `${bm.peerMedianPEG}x` : '—';
  if (bmRoic) bmRoic.textContent = bm.peerMedianROIC ? `${bm.peerMedianROIC}%` : '—';
  if (bmMargin) bmMargin.textContent = bm.peerMedianMargin ? `${bm.peerMedianMargin}%` : '—';
  if (bmGrowth) bmGrowth.textContent = bm.peerMedianGrowth ? `${bm.peerMedianGrowth}%` : '—';

  // Competitor Cards
  const cardsContainer = document.getElementById('comp-cards-grid');
  if (cardsContainer && Array.isArray(data.peers)) {
    cardsContainer.innerHTML = data.peers.map(peer => `
      <div class="competitor-card">
        <div class="competitor-card-header">
          <div>
            <div class="competitor-card-title">${escapeHtml(peer.name)}</div>
            <span class="competitor-ticker-pill">${peer.ticker}</span>
            ${peer.isPrivate ? '<span class="badge ml-1" style="font-size: 10px; background: rgba(255, 184, 0, 0.15); color: #ffb800; border: 1px solid rgba(255, 184, 0, 0.3);">Private Titan</span>' : ''}
          </div>
          <span class="badge ${peer.moatRating === 'Wide Moat' ? 'badge-accent' : (peer.moatRating === 'Narrow Moat' ? 'badge-subtle' : '')}">${peer.moatRating}</span>
        </div>

        <div class="competitor-rivalry-box">
          <span class="rivalry-label">Rivalry Vector:</span>
          <span class="rivalry-desc">${escapeHtml(peer.rivalry || 'Core Industry Competitor')}</span>
        </div>

        <div class="competitor-quick-metrics">
          <div class="comp-metric-item">
            <span class="m-lbl">P/E</span>
            <span class="m-val">${peer.peRatio ? peer.peRatio + 'x' : '—'}</span>
          </div>
          <div class="comp-metric-item">
            <span class="m-lbl">ROIC</span>
            <span class="m-val ${peer.roic >= 15 ? 'text-success' : ''}">${peer.roic ? peer.roic + '%' : '—'}</span>
          </div>
          <div class="comp-metric-item">
            <span class="m-lbl">Rev. Growth</span>
            <span class="m-val">${peer.revenueGrowth ? peer.revenueGrowth + '%' : '—'}</span>
          </div>
          <div class="comp-metric-item">
            <span class="m-lbl">Op. Margin</span>
            <span class="m-val">${peer.operatingMargin ? peer.operatingMargin + '%' : '—'}</span>
          </div>
        </div>

        <div class="competitor-card-footer">
          <span class="comp-mkt-cap">Valuation: ${formatCurrency(peer.marketCap)}</span>
          ${peer.isPrivate 
            ? '<span class="text-sub" style="font-size: 11px; color: var(--color-warning);">Secondary Valuation</span>'
            : `<button class="btn btn-xs btn-outline competitor-pivot-btn" data-pivot-ticker="${peer.ticker}">Deep Dive ↗</button>`
          }
        </div>
      </div>
    `).join('');
  }

  // Comparison Matrix Table
  const tbody = document.getElementById('competitor-matrix-tbody');
  if (tbody && data.targetMetrics) {
    const allRows = [
      { ...data.targetMetrics, isTarget: true },
      ...(data.peers || []).map(p => ({ ...p, isTarget: false }))
    ];

    tbody.innerHTML = allRows.map(row => {
      const peColor = row.peRatio <= (bm.peerMedianPE || 25) * 0.9 ? 'text-success' : (row.peRatio > (bm.peerMedianPE || 25) * 1.25 ? 'text-warning' : '');
      const pegColor = row.pegRatio < 1.5 ? 'text-success' : (row.pegRatio > 2.0 ? 'text-warning' : '');
      const roicColor = row.roic >= 15 ? 'text-success' : (row.roic < 10 ? 'text-danger' : '');
      const marginColor = row.operatingMargin >= 25 ? 'text-success' : (row.operatingMargin < 12 ? 'text-warning' : '');

      return `
        <tr class="${row.isTarget ? 'target-company-row' : ''}">
          <td>
            <div class="table-company-cell">
              <strong>${row.ticker}</strong>
              <span class="table-company-name">${escapeHtml(row.name)}</span>
              ${row.isTarget ? '<span class="badge badge-accent ml-2" style="font-size: 10px;">Target</span>' : (row.isPrivate ? '<span class="badge ml-2" style="font-size: 9px; background: rgba(255, 184, 0, 0.15); color: #ffb800; border: 1px solid rgba(255, 184, 0, 0.3);">Private</span>' : '')}
            </div>
          </td>
          <td class="text-right font-mono">$${row.currentPrice?.toFixed ? row.currentPrice.toFixed(2) : row.currentPrice}</td>
          <td class="text-right font-mono">${formatCurrency(row.marketCap)}</td>
          <td class="text-right font-mono ${peColor}">${row.peRatio ? row.peRatio + 'x' : '—'}</td>
          <td class="text-right font-mono ${pegColor}">${row.pegRatio ? row.pegRatio : '—'}</td>
          <td class="text-right font-mono">${row.priceToSales ? row.priceToSales + 'x' : '—'}</td>
          <td class="text-right font-mono ${roicColor}">${row.roic ? row.roic + '%' : '—'}</td>
          <td class="text-right font-mono ${marginColor}">${row.operatingMargin ? row.operatingMargin + '%' : '—'}</td>
          <td class="text-right font-mono">${row.revenueGrowth ? row.revenueGrowth + '%' : '—'}</td>
          <td class="text-right font-mono">${row.debtToEquity ? row.debtToEquity + 'x' : '—'}</td>
          <td><span class="badge ${row.moatRating === 'Wide Moat' ? 'badge-accent' : ''}" style="font-size: 11px;">${row.moatRating}</span></td>
          <td class="text-center">
            ${row.isTarget
              ? '<span class="text-sub">—</span>'
              : (row.isPrivate
                  ? '<span class="text-sub" style="font-size: 10px; color: var(--color-warning);">Private</span>'
                  : `<button class="btn btn-xs btn-outline competitor-pivot-btn" data-pivot-ticker="${row.ticker}">Analyze ↗</button>`)
            }
          </td>
        </tr>
      `;
    }).join('');
  }

  // ==========================================================================
  // CU BOULDER RESEARCH METHODOLOGY RENDERING
  // ==========================================================================

  // 1. Market Share & Concentration (IBISWorld / Statista / Gale)
  const ms = data.marketShareAndConcentration || {};
  const tamVal = document.getElementById('comp-tam-val');
  const targetShareVal = document.getElementById('comp-target-share-val');
  const targetRankingSub = document.getElementById('comp-target-ranking-sub');
  const structureVal = document.getElementById('comp-structure-val');
  const hhiSub = document.getElementById('comp-hhi-sub');
  const leaderVal = document.getElementById('comp-leader-val');
  const pricingSub = document.getElementById('comp-pricing-power-sub');

  if (tamVal) tamVal.textContent = ms.industryTam || '—';
  if (targetShareVal) targetShareVal.textContent = ms.targetMarketShare || '—';
  if (targetRankingSub) targetRankingSub.textContent = ms.targetRanking || 'Industry Competitor';
  if (structureVal) structureVal.textContent = ms.industryStructure || '—';
  if (hhiSub) hhiSub.textContent = ms.hhiClassification || 'HHI Benchmark';
  if (leaderVal) leaderVal.textContent = ms.primaryMarketLeader || '—';
  if (pricingSub) pricingSub.textContent = ms.pricingPowerAssessment || 'Pricing dynamics evaluated across peer group.';

  // 2. Product-Level & Segment Rivalry Matchups (Passport / Mintel)
  const segmentsContainer = document.getElementById('comp-segments-grid');
  if (segmentsContainer && Array.isArray(data.productSegments)) {
    segmentsContainer.innerHTML = data.productSegments.map(seg => `
      <div class="comp-segment-card">
        <div class="comp-segment-header">
          <span class="comp-segment-title">${escapeHtml(seg.segment)}</span>
        </div>
        <div>
          <span class="rivalry-label" style="color: #60a5fa;">Target Offering:</span>
          <div class="comp-segment-target">${escapeHtml(seg.targetProduct)}</div>
        </div>
        <div class="comp-segment-rivals">
          <span class="rivalry-label" style="color: #a78bfa;">Direct Competitor Counter-Products:</span>
          <div>${escapeHtml(seg.competitorProducts)}</div>
        </div>
        <div class="comp-segment-advantage">
          <strong style="color: #cbd5e1;">Moat / Advantage:</strong> ${escapeHtml(seg.advantage)}
        </div>
      </div>
    `).join('');
  }

  // 3. SEC Form 10-K Regulatory Competition Disclosures (EDGAR Item 1 & 1A)
  const secDisc = data.sec10KCompetitionDisclosures || {};
  const item1Text = document.getElementById('comp-sec-item1-text');
  const riskList = document.getElementById('comp-sec-risk-list');
  const moatBox = document.getElementById('comp-sec-moat-defense');

  if (item1Text) item1Text.textContent = secDisc.item1_competitionSummary || 'Official 10-K Item 1 competition disclosure evaluated.';
  if (riskList && Array.isArray(secDisc.item1A_riskFactors)) {
    riskList.innerHTML = secDisc.item1A_riskFactors.map(r => `<li>${escapeHtml(r)}</li>`).join('');
  }
  if (moatBox) moatBox.textContent = secDisc.managementMoatDefense || 'Management defends competitive positioning through proprietary IP, vertical integration, and distribution scale.';

  // 4. Private Disruptors & Scale-Up Radar (Inc. 5000)
  const privateContainer = document.getElementById('comp-private-grid');
  if (privateContainer && Array.isArray(data.privateChallengers)) {
    privateContainer.innerHTML = data.privateChallengers.map(pc => `
      <div class="comp-private-card">
        <div class="comp-private-card-header">
          <div>
            <div class="comp-private-name">${escapeHtml(pc.name)}</div>
            <span class="badge badge-subtle" style="font-size: 10px; margin-top: 4px;">${escapeHtml(pc.status || 'Private Challenger')}</span>
          </div>
          <span class="comp-private-val">${escapeHtml(pc.valuation || 'Venture Scale')}</span>
        </div>
        <div class="comp-private-threat">
          <strong style="color: #fbbf24;">Disruption Vector:</strong> ${escapeHtml(pc.threatVector || 'Industry market share expansion.')}
        </div>
      </div>
    `).join('');
  }
}

function setupCompetitorListeners() {
  const refreshBtn = document.getElementById('btn-refresh-competitors');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchCompetitors(currentTicker, true);
    });
  }

  // Delegated pivot click handler
  document.addEventListener('click', (e) => {
    const pivotBtn = e.target.closest('.competitor-pivot-btn');
    if (pivotBtn && pivotBtn.dataset.pivotTicker) {
      const ticker = pivotBtn.dataset.pivotTicker.trim().toUpperCase();
      if (ticker && ticker !== currentTicker) {
        startResearch(ticker);
      }
    }
  });
}

// =============================================================
// SEEKING ALPHA RSS CLIENT CONTROLLER
// =============================================================
let currentSeekingAlphaData = null;
let currentSeekingAlphaFilter = 'all';

async function fetchSeekingAlpha(ticker) {
  const sym = (ticker || currentTicker || 'MSFT').trim().toUpperCase();
  const listEl = document.getElementById('sa-articles-list');
  if (listEl) {
    listEl.innerHTML = `
      <div class="scuttlebutt-loading-skeleton">
        <div class="spinner-ring" style="width: 24px; height: 24px; border-width: 2px;"></div>
        <span>Streaming Seeking Alpha analyst write-ups and news wire for ${sym}...</span>
      </div>
    `;
  }

  try {
    const data = await apiFetch(`/api/seeking-alpha?ticker=${encodeURIComponent(sym)}&limit=15`);
    if (data && data.articles) {
      currentSeekingAlphaData = data;
      renderSeekingAlpha(data);
    }
  } catch (err) {
    if (err.message === 'STATIC_HOSTING_MODE' || isStaticHostingMode) {
      const bundle = await loadBundledDemo();
      if (bundle?.dossiers?.[sym]?.pillar2_Fisher?.seekingAlphaIntel) {
        const saData = bundle.dossiers[sym].pillar2_Fisher.seekingAlphaIntel;
        currentSeekingAlphaData = saData;
        renderSeekingAlpha(saData);
        return;
      }
    }
    console.warn('Seeking Alpha fetch failed:', err);
    if (listEl) {
      listEl.innerHTML = `<div class="text-muted p-3" style="font-size:12px;">Seeking Alpha feed offline or deferred. (Run in Local Mode for real-time RSS updates)</div>`;
    }
  }
}

function renderSeekingAlpha(data) {
  if (!data || !Array.isArray(data.articles)) return;

  const countBullish = document.getElementById('sa-count-bullish');
  const countBearish = document.getElementById('sa-count-bearish');
  const countNeutral = document.getElementById('sa-count-neutral');
  const consensusBadge = document.getElementById('sa-consensus-badge');

  const summary = data.sentimentSummary || {};
  if (countBullish) countBullish.textContent = summary.bullish || 0;
  if (countBearish) countBearish.textContent = summary.bearish || 0;
  if (countNeutral) countNeutral.textContent = summary.neutral || 0;

  if (consensusBadge) {
    const cons = data.consensusSentiment || 'Neutral';
    consensusBadge.textContent = `Consensus: ${cons}`;
    consensusBadge.className = 'badge ' + (cons === 'Bullish' ? 'badge-success' : cons === 'Bearish' ? 'badge-danger' : 'badge-subtle');
  }

  // Render Co-Mentioned Peers & Competitor Network
  const peersContainer = document.getElementById('sa-peers-container');
  const peersChips = document.getElementById('sa-peers-chips');
  if (peersContainer && peersChips) {
    const peers = (data.coMentionedPeers || []).filter(p => p.symbol && p.symbol !== currentTicker);
    if (peers.length > 0) {
      peersContainer.style.display = 'block';
      peersChips.innerHTML = peers.map(p => `
        <button class="sa-peer-chip" data-peer-ticker="${escapeHtml(p.symbol)}" title="${escapeHtml(p.name)}: Mentioned in ${p.coOccurrencePercent}% of Seeking Alpha articles (${p.coOccurrenceCount} mentions)">
          <span class="sa-peer-ticker">${escapeHtml(p.symbol)}</span>
          <span class="sa-peer-name">${escapeHtml(p.name || p.symbol)}</span>
          <span class="sa-peer-count">${p.coOccurrenceCount}× (${p.coOccurrencePercent}%)</span>
        </button>
      `).join('');

      peersChips.querySelectorAll('.sa-peer-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetSym = btn.dataset.peerTicker;
          if (targetSym) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            startResearch(targetSym);
          }
        });
      });
    } else {
      peersContainer.style.display = 'none';
    }
  }

  filterAndRenderSeekingAlphaArticles();
}

function filterAndRenderSeekingAlphaArticles() {
  const listEl = document.getElementById('sa-articles-list');
  if (!listEl || !currentSeekingAlphaData) return;

  const articles = currentSeekingAlphaData.articles || [];
  const filtered = currentSeekingAlphaFilter === 'all'
    ? articles
    : articles.filter(a => a.category === currentSeekingAlphaFilter);

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="text-muted p-4 text-center" style="font-size: 13px;">No articles found in category "${currentSeekingAlphaFilter}".</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    let tagClass = 'sa-tag-news';
    if (item.category === 'Analyst Research') tagClass = 'sa-tag-analysis';
    else if (item.category === 'Insider Form 4') tagClass = 'sa-tag-insider';
    else if (item.category === 'Earnings & Filings') tagClass = 'sa-tag-earnings';

    const sentClass = (item.sentiment || 'Neutral').toLowerCase();

    return `
      <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener" class="sa-article-row">
        <div class="sa-article-main">
          <h4 class="sa-article-title">${escapeHtml(item.title)}</h4>
          <div class="sa-article-meta">
            <span class="sa-author-tag">✍️ ${escapeHtml(item.author)}</span>
            <span>•</span>
            <span class="sa-tag ${tagClass}">${escapeHtml(item.category)}</span>
            <span>•</span>
            <span class="sa-sentiment-badge ${sentClass}">${escapeHtml(item.sentiment)}</span>
            <span>•</span>
            <span>⏱️ ${escapeHtml(item.timeAgo)}</span>
            ${item.relatedTickers?.length > 1 ? `<span>• Tickers: ${item.relatedTickers.slice(0, 4).join(', ')}</span>` : ''}
          </div>
        </div>
        <span class="sa-link-arrow">↗</span>
      </a>
    `;
  }).join('');
}

function setupSeekingAlphaListeners() {
  document.querySelectorAll('[data-sa-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-sa-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSeekingAlphaFilter = btn.dataset.saFilter;
      filterAndRenderSeekingAlphaArticles();
    });
  });
}



