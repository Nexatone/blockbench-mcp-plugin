# Repository context

Read [AGENTS.md](AGENTS.md), [README.md](README.md),
[CONTRIBUTING.md](CONTRIBUTING.md), [VERSIONING.md](VERSIONING.md), and the latest
[CHANGELOG.md](CHANGELOG.md) entry before editing. These are the shared workflow
and compatibility rules for every agent; this file grants no publishing rights.

This is Josshy's maintained Blockbench MCP plugin, based on Jason J. Gardner's
original work. Preserve the GPL-3.0 license and contributor attribution.

The plugin entry is `index.ts`; tool registrations are in `server/tools/`.
Export schemas and tool specs without accessing Blockbench globals at import
time. Register implementations with `createTool` and include specs in
`build/docs-manifest.ts`. Verify native Blockbench APIs against the actual editor
version: the installed `blockbench-types` declarations are incomplete.

Use Bun 1.3.8 and `bun install --frozen-lockfile`. Run `bun run test`,
`bun run typecheck`, `bun run build`, and `bun run docs:build`. Tests include
real canvas/PNG and loopback MCP checks. Compare TypeScript diagnostics with a
fresh baseline; historic counts are not a passing gate. There is no lint command.
Ordinary builds preserve other `dist/` verification artifacts.

`package.json` is the version source. Regenerate bundled prompts and API docs
after a bump. Build output is `dist/mcp.js` and must not be committed.
Prompt loading uses `lib/promptLoader.ts` and `prompts/manifest.json`;
there is no `macros/readPrompt.ts`.

The current stability decisions and remaining work are in
[docs/experimental-review.md](docs/experimental-review.md). Preserve unrelated
projects during live checks. Run `bun run test:stability:live` only with the
intended local build loaded at `http://127.0.0.1:3000/bb-mcp`, without unrelated
dialogs or simultaneous editor changes.
