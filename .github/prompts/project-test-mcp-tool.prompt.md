---
mode: agent
description: Test newly created MCP tools in the Blockbench MCP plugin.
tools: ['changes', 'codebase', 'fetch', 'problems', 'runCommands', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'usages', 'search_code', 'search_repositories', 'blockbench', 'websearch']
---

# Test an MCP tool

Test the following request with schema-valid parameters:

${input:chatPrompt}

Read root `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `VERSIONING.md` and the latest
changelog. Inspect the tool's complete Zod schema, output schema, annotations and
implementation. This plugin uses Bun and the official `@modelcontextprotocol/sdk`.
Verify native assumptions against the running version of `JannisX11/blockbench`;
type declarations alone are not proof of native behavior.

Discover the connected server's version and tools before testing. Client tool
prefixes vary. Use typed tools where possible, `risky_eval` for otherwise
unavailable native checks, and an available screenshot tool when visual evidence
is useful. For a local 1.2.0+ build, load/reload `dist/mcp.js` and compare
`get_project_capabilities` with `dist/build-info.json`. A URL installation receives
merged deployments, not unmerged checkout changes.

Run relevant automated tests and the documented build/docs/typecheck gates. Use
the applicable `tests/live/` suites and disposable projects for editor checks.
Exercise success, schema errors and native failure paths; check output identities,
bounds, pagination, Undo/Redo and rollback where relevant. For batch/revision
contracts also check retry deduplication, stale reads and changed-project rejection.
Do not simulate unsupported features as if native verification passed.

Preserve every unrelated project's compiled model, saved flag, Undo history and
selection, then restore the active project/mode/tool. Record the exact running
version/build, checks actually run and limitations, including optional plugins
that were unavailable. Separate existing type diagnostics from regressions. Keep
raw verification artifacts out of commits; retain historical tested versions in
reports. Apply root version/changelog rules if fixes change the shipped plugin.
