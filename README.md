# Blockbench MCP

Maintained by **Josshy**, based on the original plugin by Jason J. Gardner.
This repository starts with an independent import. Original contributor credits
and the GPL-3.0 license are preserved.

The maintained version line starts at **1.0.0**. Read the
[changelog](CHANGELOG.md) for versioned changes. Contributors and coding agents
must follow [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md), and the
[versioning guide](VERSIONING.md), including a version-impact decision for each PR.

https://github.com/user-attachments/assets/ab1b7e63-b6f0-4d5b-85ab-79d328de31db

## Plugin Installation

For the maintained deployment, open desktop Blockbench's **File → Plugins** and
use **Load Plugin from URL** with:

```text
https://itsjosshy.github.io/blockbench-mcp-plugin/nightly/mcp.js
```

If another MCP Server installation is present, uninstall that copy before changing
its source. After a successful `main` deployment, use **Reload** on the URL plugin
and reconnect your MCP client. Pull requests do not update the hosted plugin.

To test unmerged changes, build from the checked-out branch:

```sh
bun install --frozen-lockfile
bun run dev
```

1. In desktop Blockbench, open **File → Plugins → Installed**.
2. Select the current **MCP Server** plugin and click **Uninstall**.
3. Click **Load Plugin from File** (the file/code icon in the Plugins toolbar).
4. Select this checkout's `dist/mcp.js` and allow its required network access.
5. Confirm it displays **MCP Server — by Josshy**, then reconnect the MCP client
   to `http://127.0.0.1:3000/bb-mcp` (or the port/endpoint configured in Settings).

The local plugin is loaded from that file. Keep it in place; after rebuilding,
use **Reload** in the plugin card. For 1.2.0 and newer, compare the build ID from
`get_project_capabilities` with `dist/build-info.json` before live verification.
To return to URL updates, replace the file installation with the maintained URL
above. For tests and build details, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Model Context Protocol Server

Discover the connected server's tools and version first. The workflow below
requires **1.2.0 or newer**; a hosted build can lag an unmerged checkout.
For agent modeling, start with `get_project_info` and `get_project_capabilities`.
Use `query_model` for bounded pages and `get_element` for one compact element;
retain their UUIDs instead of repeatedly searching names. Raw `nodes://` resources
are legacy rendering data and can be very large.

Use `apply_model_batch` to create groups, cubes and complete meshes, or patch/remove
elements in one Undo step. Supply the project UUID and inspected revision. Local
`@ref` parents let a batch construct a hierarchy without intermediate lookups:

```json
{
  "project_uuid": "UUID from inspection",
  "expected_revision": "revision from inspection",
  "operation_id": "unique ID for this intended edit",
  "groups": [{"ref": "body", "name": "Body"}],
  "cubes": [{"ref": "box", "name": "Box", "parent": "@body", "from": [0,0,0], "to": [8,8,8]}]
}
```

The result maps local references to created UUIDs. While retained in the bounded
retry cache (up to ten minutes), identical retries with the same operation ID
return the original result without another edit; use a new ID for changed work.
Revisions, cursors and retry records reset on plugin reload.
Call `validate_model` and take a final screenshot when useful. `create_texture`
and `from_geo_json` accept `include_preview: false` to return identities without
an image. Texture layer management accepts `layer_id` from a `texture_layers` query.

Save with `export_model` using `codec_id: "project"`; pass `path` and
`max_content_length: 0` when a file is sufficient. `open_project` opens `.bbmodel`
data in a new tab, and `select_project` switches existing tabs by UUID.
See the [implementation and verification report](docs/efficiency-implementation.md)
for measured improvements, compatibility and remaining work.

Configure the MCP server under Blockbench settings: **Settings** > **General** > **MCP Server Port** and **MCP Server Endpoint**

The following examples use the default values of `:3000/bb-mcp`

### Installation

#### General

```bash
npx mcp-add --type http --url "http://localhost:3000/bb-mcp" --scope project
```

#### Codex

Keep desktop Blockbench open with the MCP Server plugin loaded, then run this
command on the same computer using the Codex CLI:

```sh
codex mcp add blockbench --url http://127.0.0.1:3000/bb-mcp
```

Alternatively, add the following to `~/.codex/config.toml`
(`%USERPROFILE%\.codex\config.toml` on Windows):

```toml
[mcp_servers.blockbench]
url = "http://127.0.0.1:3000/bb-mcp"
```

Replace the port and endpoint if you changed them in Blockbench settings. Restart
your Codex client after configuring it. Run `codex mcp list` to confirm the saved
configuration, or use `/mcp` inside the Codex CLI to check the active connection.
See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp/)
for more configuration options.

#### VS Code

**`.vscode/mcp.json`**

```json
{
  "servers": {
    "blockbench": {
      "url": "http://localhost:3000/bb-mcp",
      "type": "http"
    }
  }
}
```

#### Claude Desktop

**`claude_desktop_config.json`** (macOS/Linux)

```json
{
  "mcpServers": {
    "blockbench": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/bb-mcp"]
    }
  }
}
```

**`claude_desktop_config.json`** (Windows)

```json
{
  "mcpServers": {
    "blockbench": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "mcp-remote", "http://localhost:3000/bb-mcp"]
    }
  }
}
```

#### Claude Code

```bash
claude mcp add blockbench --transport http http://localhost:3000/bb-mcp
```

#### [Antigravity](https://antigravity.google/docs/mcp#connecting-custom-mcp-servers)

```json
{
  "mcpServers": {
    "blockbench": {
      "serverUrl": "http://localhost:3000/bb-mcp"
    }
  }
}
```

#### Cline

<img width="674" height="486" alt="Connecting to Blockbench MCP plugin through Cline" src="https://github.com/user-attachments/assets/f27f2304-dd56-4c60-b159-86fbd5af65ee" />

**`cline_mcp_settings.json`**

```json
{
  "mcpServers": {
    "blockbench": {
      "url": "http://localhost:3000/bb-mcp",
      "type": "streamableHttp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

#### Ollama

```bash
uvx ollmcp -u http://localhost:3000/bb-mcp
```

Recommended: [jonigl/mcp-client-for-ollama](https://github.com/jonigl/mcp-client-for-ollama)

#### OpenCode

```bash
opencode mcp add
```

<img width="504" height="300" alt="Connecting to Blockbench MCP plugin through OpenCode." src="https://github.com/user-attachments/assets/238971fc-0048-4b8d-95dd-6681604bbe90" />


## Usage

[See sample project](https://github.com/jasonjgardner/blockbench-mcp-project) for prompt examples.

### [Skills](https://skills.sh/jasonjgardner/blockbench-mcp-project)

Use Agent Skills to orchestrate tool usage.

## Plugin Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions on setting up the development environment and how to add new tools, resources, and prompts.

For the complete experimental feature inventory, stable promotions, native API
research and remaining work, see [the stability review](docs/experimental-review.md).
