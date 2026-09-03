---
mode: agent
description: This is a Blockbench plugin that integrates with the Model Context Protocol (MCP) to allow AI models to interact with Blockbench (JannisX11/blockbench) through commands or directly execute JavaScript code in its context.
tools: ['githubRepo', 'get_commit', 'get_file_contents', 'list_branches', 'search_code', 'search_repositories', 'blockbench']
---

# Create or improve an MCP tool

Implement the following request:

${input:chatPrompt}

Read root `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `VERSIONING.md` and the latest
changelog first. Inspect Git state and preserve existing work. Improve an existing
tool when it already covers the request; follow the user's authorization without
asking again for work already authorized.

This plugin uses TypeScript, Bun and the official `@modelcontextprotocol/sdk` in
desktop Blockbench. Verify native behavior against the relevant version of
`JannisX11/blockbench`; use `modelcontextprotocol/typescript-sdk` for SDK behavior.

Follow the two-part example in `CONTRIBUTING.md`: export globals-free input/output
schemas and a tool-docs array, then register through `createTool`. Include the
registration in `server/tools.ts` and specs in `build/docs-manifest.ts`. Preserve
full-object refinements and choose effect annotations from actual behavior.
Prefer bounded structured IDs/counts/revisions, pagination and optional previews.

Tools share the editor queue. Preflight references and native format support;
prepare asynchronous data before a short synchronous `withUndoEdit` commit,
rechecking project/revision and cancellation. Never await while owning Undo or
wrap an action that owns its own transaction. Refresh affected preview data only.

Apply the version/changelog rules once for the whole PR. Update relevant prompts,
README and agent context. Run `bun run test`, `bun run typecheck`, `bun run build`
and `bun run docs:build`; report existing type diagnostics separately from new ones.

Use the connected tools as actually exposed by the client; registered names have
no automatic prefix. Prefer typed tools for live checks. Use `risky_eval` only for
native inspection or verification unavailable through typed tools. Before claiming
a local build was tested, load/reload `dist/mcp.js` and compare the build ID from
`get_project_capabilities` with `dist/build-info.json`. Preserve unrelated projects,
saved flags, Undo history and selections. Report behavior, version impact,
validation, limitations and loading instructions; do not publish beyond the user's
authorization.
