# Contributing to Blockbench MCP Plugin

Thank you for improving the Blockbench MCP plugin. This project uses TypeScript and Bun. Please keep changes focused, documented, and easy to verify inside Blockbench.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/jasonjgardner/blockbench-mcp-plugin)

## Prerequisites
- Bun installed: https://bun.sh/
- Blockbench (desktop) for local testing.

## Setup & Development
```sh
bun install                # install deps
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

The server accepts loopback access only. Network settings require plugin reload.
Development prompts come from the bundled generated manifest; re-run `bun run dev`
after prompt edits. Production falls back to bundled prompts when CDN access fails.

## Project Structure
- `index.ts`: Plugin entry; registers server, UI, settings.
- `server/`: MCP server implementation.
  - `server.ts`: McpServer singleton (official MCP SDK).
  - `tools.ts`: Tool module aggregator importing domain-specific tools.
  - `tools/`: Tool implementations by domain (animation, camera, cubes, element, import, mesh, paint, project, texture, ui, uv).
  - `resources.ts`: MCP resource definitions.
  - `prompts.ts`: MCP prompts with argument schemas.
  - `net.ts`: HTTP server and transport handling.
- `ui/`: Panel, settings, and status bar UI.
- `lib/`: Shared utilities, factories (`createTool`, `createResource`, `createPrompt`), and Zod schemas.
- `macros/`: Build-time macros (e.g., prompt embedding).
- `dist/`: Build outputs (`mcp.js`, maps, copied assets).

## Adding Tools
Use `createTool()` from `lib/factories.ts`. Tools are organized by domain in `server/tools/` (e.g., `animation.ts`, `paint.ts`, `mesh.ts`). Each domain file exports a registration function that is called from `server/tools.ts`.

Example tool in a domain file (e.g., `server/tools/example.ts`):
```ts
import { z } from "zod";
import { createTool } from "@/lib/factories";

export function registerExampleTools() {
  createTool("example", {
    description: "Does something useful",
    annotations: { title: "Example" },
    parameters: z.object({ name: z.string() }),
    async execute({ name }) {
      return `Hello, ${name}!`;
    },
  });
}
```
Then import and call the registration function in `server/tools.ts`.

- Naming: Tools are registered with the name you provide (no automatic prefix).
- Validate inputs with `zod`. Avoid blocking UI during execution.

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
See existing `projects`, `nodes`, and `textures` examples in `server/resources.ts`.

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
See `server/prompts.ts` for examples using the `readPrompt` macro to embed prompt text files.

## Style & Commits
- TypeScript strict mode; ESNext modules; use the `@/*` path alias.
- 2-space indentation; explicit return types where reasonable.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. Be specific.

## Pull Requests
- Describe scope and intent, link related issues.
- Add repro and verification steps; include screenshots/GIFs for UI changes.
- Call out new tools, resources, settings, or breaking changes.

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
- Resources: In Inspector, resolve a sample URI (e.g., `nodes://<id>` or `textures://<name>`); confirm autocompletion and returned data.
- Prompts: Load the prompt; check argument autocompletion and that `load` returns content without errors.
- UI: Sanity check layout in light/dark themes; verify tool status badges and descriptions render and truncate gracefully.
