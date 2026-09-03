## Blockbench MCP Server

Maintained by **Josshy**, based on the original plugin by Jason J. Gardner.
Original contributor credits and the GPL-3.0 license are preserved.

Connect an MCP client to `http://127.0.0.1:3000/bb-mcp` while desktop Blockbench
is open. Configure the port and endpoint under **Settings > General** and reload
the plugin after changing them. The server accepts loopback connections only.

Use the MCP panel to inspect tools, resources and prompts and enable or disable
them. Experimental badges identify features needing further verification.
Hytale integration requires the Hytale Models plugin; reload MCP after changing
optional plugins.

See the [installation and client configuration guide](https://github.com/ItsJosshy/blockbench-mcp-plugin#plugin-installation)
and [changelog](https://github.com/ItsJosshy/blockbench-mcp-plugin/blob/main/CHANGELOG.md).
For development builds, load this checkout's `dist/mcp.js` and reload it after
rebuilding. The maintained deployment is
[nightly/mcp.js](https://itsjosshy.github.io/blockbench-mcp-plugin/nightly/mcp.js).
