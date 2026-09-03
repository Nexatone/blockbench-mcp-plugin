# Contributing to Blockbench MCP Plugin

Thank you for improving the Blockbench MCP plugin. This project uses TypeScript and Bun. Please keep changes focused, documented, and easy to verify inside Blockbench.

## Required contribution process

Read [AGENTS.md](AGENTS.md) and [VERSIONING.md](VERSIONING.md) before editing. Start
with the current Git state and latest [changelog](CHANGELOG.md); preserve existing
work and attribution. Implement and verify the requested behavior, then review
the diff and complete the PR template.

Every PR must explain its version impact. Bump `package.json` once per
plugin-affecting PR, record the changes in `CHANGELOG.md`, and regenerate the
prompt/API assets. Use patch for compatible fixes, minor for compatible additions,
and major for incompatible contracts. Documentation/test/CI-only changes can keep
the version if they do not alter plugin behavior; state that reason explicitly.
Recheck the target version against current `main` before publishing or merging.
See the versioning guide for exact commands, validation and update instructions.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/jasonjgardner/blockbench-mcp-plugin)

## Prerequisites
- Bun installed: https://bun.sh/
- Blockbench (desktop) for local testing.

## Setup & Development
```sh
bun install --frozen-lockfile # install locked deps with Bun 1.3.8
bun run dev                # build once with sourcemaps
bun run dev:watch          # rebuild on change (watch mode)
bun run build              # minified production build to dist/mcp.js
```

For MCP Inspector (optional):
```sh
bunx @modelcontextprotocol/inspector
```
Default server transport (when plugin is loaded): `http://localhost:3000/bb-mcp`.

Local testing in Blockbench: File → Plugins → Load Plugin from File → select `dist/mcp.js`.

## Automated Checks

### GitHub Actions and Pages deployment

The **Build and deploy** workflow uses Bun 1.3.8 and the frozen lockfile to run the
regression tests, build the production plugin, and generate the documentation.
PRs targeting `main` run these checks. Successful pushes to `main` also publish
the plugin under `nightly/` and documentation at the site root. The manual **Run
workflow** button deploys only when `main` is selected.

The existing Pages settings stay **Deploy from a branch → gh-pages → /(root)**.
The plugin URL remains
`https://itsjosshy.github.io/blockbench-mcp-plugin/nightly/mcp.js`.
After the Pages deployment finishes, reload the URL-installed MCP Server in
Blockbench and reconnect the MCP client.

PR previews, preview cleanup, bot comments and tag/release deployments are not
part of this workflow. Test unmerged changes by building and loading `dist/mcp.js`
locally. Existing unrelated files on `gh-pages` are preserved.

The build job has read-only repository access. Only the main-branch deploy job
gets `contents: write` and `pages: write`; the short-lived site artifact transfers
built files between those jobs. No extra secrets are needed. The deploy job
explicitly requests a Pages build because `GITHUB_TOKEN` pushes do not trigger
one automatically. GitHub's generated **pages-build-deployment** workflow remains
necessary to publish the existing branch-based site.

### Local checks

```sh
bun run test              # Bun regression tests, including real canvas/PNG checks
bun run typecheck         # full repository type check (existing errors remain)
bun run build             # production bundle
bun run docs:build        # documentation generation without starting a server
```

The texture tests use the development-only `@napi-rs/canvas` package for real
rendering and PNG decoding, with a small stand-in for Blockbench's Texture API.
They do not replace testing in the desktop editor. No lint command is currently
configured. See [texture dimensions verification](docs/texture-dimensions.md)
for the reproduction, local plugin loading, live checks, and known limitations.

Connection tests use real loopback TCP sockets and the MCP SDK to cover SSE
reconnects, response ordering, shutdown, heartbeat delivery and session expiry.
See the [repository bug review](docs/bug-review.md) for confirmed findings,
the implemented findings, connection verification steps and compatibility limits.

After loading the development plugin, `bun run test:live` runs isolated geometry,
animation, painting, material, import and save/reopen checks. Run
`bun tests/live/connections.mjs` for SSE reconnect/heartbeat/reload checks. Both
use the local endpoint `http://127.0.0.1:3000/bb-mcp` and write reports under
ignored `.verification/`. They preserve existing projects; avoid simultaneous
manual model edits. Reload the local plugin after rebuilding. A matching version
number alone does not identify the running build.

`bun run test:stability:live` exercises promoted experimental tools, including
Undo/Redo, invalid-input atomicity, save/reopen, native normals and dialogs. It
requires the current build loaded and no unrelated dialogs or simultaneous
editor edits. It compares every original project's model, saved flag and Undo
history, and writes `.verification/experimental-stability-live.json` with build
provenance. See [the stability review](docs/experimental-review.md) for coverage
and the remaining promotion plan.

`bun run test:remaining:live` covers the second stabilization pass: curve and
batch animation operations, painting/settings/selections, and texture-set disk
operations. It verifies native results and project preservation and restores
the paint settings it changes. Hytale is explicitly deferred; these suites do
not install optional plugins.

The server accepts loopback access only. Network settings require plugin reload.
Development prompts come from the bundled generated manifest. `bun run dev:watch`
regenerates it before rebuilding after prompt edits; reload the plugin to load
the new bundle. Production falls back to bundled prompts when CDN access fails.

`bun run test:efficiency:live` verifies the exact build ID from
`dist/build-info.json`, compact discovery/query results, atomic geometry batches,
retry/staleness behavior, native selection, validation, imports and texture IDs.
It preserves original projects and writes `.verification/efficiency-live.json`.

## Project Structure
- `index.ts`: Plugin entry; registers server, UI, settings.
- `server/`: MCP server implementation.
  - `server.ts`: McpServer singleton (official MCP SDK).
  - `tools.ts`: Tool module aggregator importing domain-specific tools.
  - `tools/`: Tool implementations by domain, including compact inspection in `model.ts` and geometry transactions in `model-batch.ts`.
  - `resources.ts`: MCP resource definitions.
  - `prompts.ts`: MCP prompts with argument schemas.
  - `prompt-specs.ts`: Shared prompt metadata for runtime and generated docs.
  - `resources/model.ts`: Compact project-scoped element/texture resource specs and handlers.
  - `net.ts`: HTTP server and transport handling.
- `ui/`: Panel, settings, and status bar UI.
- `lib/`: Shared utilities, factories (`createTool`, `createResource`, `createPrompt`), and Zod schemas.
  `editorExecution.ts` owns the shared tool queue and Undo helpers;
  `modelState.ts` owns revisions, query cursors and bounded serialization.
- `prompts/`: Markdown fragments and generated manifest; loaded by `lib/promptLoader.ts`.
- `dist/`: Ignored build outputs (`mcp.js`, maps, copied assets, `build-info.json`).

## Adding Tools
Use `createTool()` from `lib/factories.ts`. Tools are organized by domain in `server/tools/` (e.g., `animation.ts`, `paint.ts`, `mesh.ts`). Each domain file exports a registration function that is called from `server/tools.ts`.

Example tool in a domain file (e.g., `server/tools/example.ts`):
```ts
import { z } from "zod";
import { createTool, jsonResult, type ToolSpec } from "@/lib/factories";

export const exampleParameters = z.object({
  name: z.string().max(256).describe("Name to greet."),
});
export const exampleOutput = z.object({ greeting: z.string() });
export const exampleToolDocs: ToolSpec[] = [{
  name: "example",
  description: "Returns a greeting for the supplied name.",
  annotations: { title: "Example", readOnlyHint: true, openWorldHint: false },
  parameters: exampleParameters,
  outputSchema: exampleOutput,
  status: "stable",
}];

export function registerExampleTools() {
  createTool(exampleToolDocs[0].name, {
    ...exampleToolDocs[0],
    parameters: exampleParameters,
    async execute({ name }) {
      return jsonResult({ greeting: `Hello, ${name}!` });
    },
  }, exampleToolDocs[0].status);
}
```
Import and call the registration function in `server/tools.ts`. Import the
`exampleToolDocs` array into `build/docs-manifest.ts` and add it to `toolManifest`
under the appropriate category. Regenerate docs with `bun run docs:build`.

- Naming: Tools are registered with the name you provide (no automatic prefix).
- Keep schemas and tool specs free of Blockbench globals; perform native checks
  inside `execute`. Validate the full Zod object, including refinements.
- Prefer bounded structured results and output schemas with UUIDs, counts and
  revisions. Paginate large collections and make image previews optional.
- All tool calls use the shared editor queue. Prepare asynchronous work before a
  short synchronous `withUndoEdit` commit, then recheck project/revision and
  cancellation. Never await while owning Undo or wrap a native action that already
  owns a transaction. Refresh only affected preview data where native APIs allow.
- Set effect annotations from actual behavior; Undo support does not make a
  delete operation non-destructive or a repeated creation idempotent.

## Adding Resources
Use `createResource()` from `lib/factories.ts` in `server/resources.ts`:
```ts
import { createResource } from "@/lib/factories";

createResource("example", {
  uriTemplate: "example://{id}",
  title: "Example Resource",
  description: "Description of the resource",
  async listCallback() {
    // Return list of available resources
    return { resources: [{ uri: "example://1", name: "Item 1" }] };
  },
  async readCallback(uri, { id }) {
    // Return resource content
    return { contents: [{ uri: uri.href, text: JSON.stringify({ id }) }] };
  },
});
```
Add matching metadata to `build/docs-manifest.ts`. Prefer the shared compact
resource specs in `server/resources/model.ts` for new model inspection. Legacy
`nodes://` payloads can contain large render graphs. Index names once per listed
collection, preserve URI compatibility, and register any advertised collection URI.

## Adding Prompts
Use `createPrompt()` from `lib/factories.ts` in `server/prompts.ts`:
```ts
import { z } from "zod";
import { createPrompt } from "@/lib/factories";

createPrompt("example_prompt", {
  description: "Description of the prompt",
  argsSchema: z.object({
    option: z.enum(["a", "b"]).optional(),
  }),
  async generate({ option }) {
    return {
      messages: [{ role: "user", content: { type: "text", text: `Selected: ${option}` } }],
    };
  },
});
```
Use `getPromptContent` from `lib/promptLoader.ts`. Put shared globals-free metadata
in `server/prompt-specs.ts` so runtime registration and docs agree.

## Style & Commits
- TypeScript strict mode; ESNext modules; use the `@/*` path alias.
- 2-space indentation; explicit return types where reasonable.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. Be specific.

## Pull Requests
- Describe scope and intent, link related issues.
- Add repro and verification steps; include screenshots/GIFs for UI changes.
- Call out new tools, resources, settings, or breaking changes.
- Update relevant README/agent installation guidance, CLAUDE and `.github`
  instructions/prompts/templates alongside the API docs. Preserve historical
  verification versions and link them to current guidance where necessary.

## Manual Verification Checklist

For project-free evaluation and Bedrock display round trips, run
`bun tests/live/project-roundtrip.mjs` with the patched plugin loaded. See
[the reproduction and loading guide](docs/project-roundtrip.md) for expected
version normalization, Undo behavior, saved-project checks and limitations.

- Build: `bun run build` (or `bun run dev`) and confirm `dist/mcp.js` updates.
- Load: In Blockbench → File → Plugins → Load Plugin from File → pick `dist/mcp.js`.
- Settings: Confirm MCP port/endpoint under Settings → General (defaults `3000` and `/bb-mcp`).
- Server: Open the MCP panel; ensure server shows connected when a client attaches.
- Tools: Verify new tool appears with a readable title. Using MCP Inspector, call the tool with a small sample payload; confirm no errors and expected side effects (and Undo works when applicable).
- Resources: In Inspector, list templates and read a concrete URI such as
  `model://<project UUID>/elements/<element UUID>`; verify bounded returned data.
  The factory does not implement resource argument completion.
- Prompts: Check listed arguments and that `prompts/get` returns useful content,
  including when every optional argument is omitted.
- UI: Sanity check layout in light/dark themes; verify tool status badges and descriptions render and truncate gracefully.
