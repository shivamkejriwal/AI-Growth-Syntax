# AI-Growth-Syntax MCP Server Setup Guide

Connect your AI tools (Claude Desktop, Cursor, Antigravity, or custom LLM agents) directly to the **AI-Growth-Syntax** 4-pillar investment research engine using the official **Model Context Protocol (MCP)**.

---

## 1. What Capabilities are Exposed via MCP?

The MCP server exposes 5 specialized institutional investment tools:

| Tool Name | Parameters | Output |
| :--- | :--- | :--- |
| `analyze_company` | `ticker` (required), `mode` ("live" or "demo") | Complete 4-pillar JSON dossier: Peter Lynch taxonomy, Philip Fisher scuttlebutt & tech moat, Warren Buffett owner earnings & ROIC, Aswath Damodaran cost of capital, valuation scorecards, and executive synthesis. |
| `get_investment_memo` | `ticker` (required), `mode` ("live" or "demo") | Executive Markdown Investment Decision Memorandum formatted to Section 6 of the Composite Investment Approach framework. |
| `get_competitors` | `ticker` (required) | SEC SIC peer classification, direct rivals, and relative valuation comparison matrix. |
| `get_macro_snapshot` | none | Live FRED macroeconomic context (10Y yield, CPI, Fed Funds, BBB spreads, Damodaran ERP). |
| `simulate_trading_desk` | `ticker` (required) | 6-stage institutional desk debate: Specialist Analysts, Bull vs. Bear debate, Research Manager synthesis, Trader order proposal, Risk Committee, and PM sign-off. |

---

## 2. Configuration for AI Assistants

### A. Claude Desktop

Add the following to your `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "ai_growth_syntax": {
      "command": "node",
      "args": [
        "/Users/shivam/Documents/GitHub/AI-Growth-Syntax/mcp-server.js"
      ]
    }
  }
}
```

Restart Claude Desktop. You will see a hammer icon (`🛠️`) with `ai_growth_syntax` tools available.

### B. Cursor Editor

1. Open **Cursor Settings** (`Cmd + ,`) -> **Features** -> **MCP**.
2. Click **+ Add New MCP Server**.
3. Set:
   - **Name**: `ai_growth_syntax`
   - **Type**: `command`
   - **Command**: `node /Users/shivam/Documents/GitHub/AI-Growth-Syntax/mcp-server.js`

### C. Antigravity / Gemini CLI

In your project configuration (`.agents/plugins/project-mcp/mcp_config.json`):

```json
{
  "mcpServers": {
    "ai_growth_syntax": {
      "command": "node",
      "args": [
        "/Users/shivam/Documents/GitHub/AI-Growth-Syntax/mcp-server.js"
      ]
    }
  }
}
```

---

## 3. Command-Line Verification

You can test the MCP server directly from your terminal using standard JSON-RPC:

```bash
# Test initialization
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}' | node mcp-server.js

# List available tools
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | node mcp-server.js

# Call 4-pillar analysis for MSFT
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"analyze_company","arguments":{"ticker":"MSFT","mode":"demo"}}}' | node mcp-server.js
```
