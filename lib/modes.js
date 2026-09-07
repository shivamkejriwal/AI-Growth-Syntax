/**
 * modes.js
 * Unified operational mode manager for AI-Growth-Syntax.
 * 
 * Supports three primary execution modes:
 * 1. LOCAL: Maximizes local resources, persistent disk cache, local Ollama, standalone server.
 * 2. FIREBASE: Designed for web app deployment, ephemeral storage, CDN edge caching, and client fallbacks.
 * 3. MCP: Model Context Protocol JSON-RPC server over stdio for AI agent ingestion.
 */

export const APP_MODES = {
  LOCAL: 'local',
  FIREBASE: 'firebase',
  MCP: 'mcp'
};

/**
 * Detects the active operational mode.
 * Priority: CLI flag > process.env.APP_MODE > default (local)
 * @returns {string} One of APP_MODES
 */
export function getActiveMode() {
  const args = process.argv || [];
  for (const arg of args) {
    if (arg === '--mode=mcp' || arg === '--mcp') return APP_MODES.MCP;
    if (arg === '--mode=firebase' || arg === '--firebase') return APP_MODES.FIREBASE;
    if (arg === '--mode=local' || arg === '--local') return APP_MODES.LOCAL;
  }

  const envMode = (process.env.APP_MODE || '').toLowerCase();
  if (envMode === 'mcp') return APP_MODES.MCP;
  if (envMode === 'firebase' || envMode === 'production' || process.env.K_SERVICE) return APP_MODES.FIREBASE;
  
  return APP_MODES.LOCAL;
}

/**
 * Returns configuration settings tailored to the active mode.
 * @param {string} [mode] Optional mode override
 */
export function getModeConfig(mode = getActiveMode()) {
  switch (mode) {
    case APP_MODES.MCP:
      return {
        mode: APP_MODES.MCP,
        name: 'Model Context Protocol Mode',
        description: 'JSON-RPC 2.0 stdio server providing structured dossiers and memos to AI tools',
        useDiskCache: true,
        allowInteractivePrompts: false,
        silentConsole: true, // stdout reserved for JSON-RPC
        edgeCdnCache: false,
        preferLocalModels: false
      };

    case APP_MODES.FIREBASE:
      return {
        mode: APP_MODES.FIREBASE,
        name: 'Firebase Cloud Web App Mode',
        description: 'Cloud-hosted web app with edge CDN caching and ephemeral/Firestore resilience',
        useDiskCache: false, // Ephemeral /tmp or in-memory
        allowInteractivePrompts: false,
        silentConsole: false,
        edgeCdnCache: true,
        preferLocalModels: false
      };

    case APP_MODES.LOCAL:
    default:
      return {
        mode: APP_MODES.LOCAL,
        name: 'Local Dedicated Terminal Mode',
        description: 'Runs entirely on user machine with aggressive local disk cache and local Ollama',
        useDiskCache: true,
        allowInteractivePrompts: true,
        silentConsole: false,
        edgeCdnCache: false,
        preferLocalModels: !!process.env.OLLAMA_BASE_URL
      };
  }
}

export default {
  APP_MODES,
  getActiveMode,
  getModeConfig
};
