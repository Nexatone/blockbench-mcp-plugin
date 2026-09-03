# Blockbench MCP Installation

This file helps AI assistants configure the Blockbench MCP server connection.

## Prerequisites

Reuse a working connection and settings already supplied by the user. Check the
available MCP connection before asking for missing information or changing client
configuration. Desktop Blockbench must be open with the MCP Server plugin loaded.

- Normal installation: File > Plugins > Load from URL:
  `https://itsjosshy.github.io/blockbench-mcp-plugin/nightly/mcp.js`.
- Unmerged development: build and load this checkout's `dist/mcp.js`; URL installs
  receive changes only after a successful deployment from `main`.
- Default endpoint: `http://127.0.0.1:3000/bb-mcp`. Read configured values under
  Settings > General > MCP Server Port / MCP Server Endpoint when available.

Follow [README](README.md) for changing plugin source and client-specific setup.
Discover the connected version and tools instead of assuming the checkout is live.
On 1.2.0+, use `get_project_capabilities` to compare the build ID with
`dist/build-info.json` for local verification; prefer `query_model`, `get_element`
and `apply_model_batch` for bounded inspection and edits. Preserve unrelated tabs
and Undo history when checking the connection.

## Configuration

If the client still needs configuration, add the MCP server using its existing
settings. The examples below use placeholders for the port and endpoint:

### Cline

Add to `cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "blockbench": {
      "url": "http://localhost:{PORT}/{ENDPOINT}",
      "type": "streamableHttp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### VS Code

Create `.vscode/mcp.json`:
```json
{
  "servers": {
    "blockbench": {
      "url": "http://localhost:{PORT}/{ENDPOINT}",
      "type": "http"
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "blockbench": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:{PORT}/{ENDPOINT}"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add blockbench --transport http http://localhost:{PORT}/{ENDPOINT}
```

### Antigravity

```json
{
  "mcpServers": {
    "blockbench": {
      "serverUrl": "http://localhost:{PORT}/{ENDPOINT}"
    }
  }
}
```

Replace `{PORT}` with the port number (default: `3000`) and `{ENDPOINT}` with the endpoint path (default: `bb-mcp`).
