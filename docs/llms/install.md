## Installation

Use the [maintained plugin deployment](https://itsjosshy.github.io/blockbench-mcp-plugin/nightly/mcp.js).
For unmerged changes, build and load this checkout's `dist/mcp.js` instead.
See [README](../../README.md) for client configuration and loading instructions.
The default local endpoint is `http://127.0.0.1:3000/bb-mcp`.

Reuse an available MCP connection before changing configuration. Discover its
version and tools; the hosted URL does not contain unmerged changes. For local
1.2.0+ verification, compare `get_project_capabilities` with `dist/build-info.json`.
See [agent installation guidance](../../llms-install.md) and the README's compact
modeling workflow for inspection, edits and project preservation.
