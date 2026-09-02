# Repository Guidelines

## Required Agent Workflow

1. Read this file, `README.md`, `CONTRIBUTING.md`, `VERSIONING.md`, and the latest
   `CHANGELOG.md` entry before changing the project. Inspect Git status, the
   working branch and remotes; preserve existing work, license and attribution.
2. Identify the affected MCP tools, Blockbench APIs and user-visible behavior.
   Follow the existing registration/schema patterns. Verify native API behavior
   against the relevant Blockbench version instead of guessing from type stubs.
3. Implement the requested scope and choose the version impact using
   `VERSIONING.md`. Every plugin-affecting PR must update `package.json` and its
   changelog entry; docs/test/CI-only changes must explain why no bump is needed.
   Bump once for the whole PR, not once per commit. Recheck against current `main`
   before publishing to avoid reusing another merged PR's version.
4. Regenerate affected tracked assets, run the applicable checks below and test
   changed behavior. Preserve unrelated open projects during live testing. Report
   pre-existing failures separately; do not claim a live check that was not run.
5. Review the final diff. Report behavior changes, old/new version (or no-bump
   reason), validation, limitations and loading instructions. Follow the user's
   current authorization for commits, pushes, PRs, merges and releases; this file
   does not grant additional permission to publish or merge.

## Version and Compatibility Rules

- `package.json` is the only editable source of the plugin version. Runtime code
  must use `VERSION` from `lib/constants.ts`; generators read the package version.
- Regenerate `prompts/manifest.json`, `docs/api.json` and `docs/index.html` after a
  bump. Build `dist/mcp.js` to verify the version, but do not commit `dist/`.
- Use semantic versioning for MCP schemas/results, settings, saved data and
  runtime behavior. See `VERSIONING.md` for the decision table and exact sequence.
- The maintainer-requested `1.6.1` → `1.0.0` reset starts Josshy's version line.
  It is a one-time exception, not permission for future agents to reset versions.
- Keep historical verification versions unchanged and label them as historical.
- Use `CHANGELOG.md` for concise user-facing changes and migration notes. Do not
  create version tags or GitHub releases just to update package metadata.

## Project Structure & Module Organization
- `index.ts`: Blockbench plugin entry (registers MCP server and UI).
- `server/`: MCP server glue (`server.ts`), `tools/`, `resources.ts`, `prompts.ts`.
- `ui/`: Panel UI and settings (`index.ts`, `settings.ts`).
- `lib/`: Shared utilities and factories (`constants.ts`, `factories.ts`, `util.ts`, `zodObjects.ts`).
- `prompts/` and `macros/`: Prompt templates and helpers.
- `dist/`: Build output (`mcp.js`, maps, copied assets like `icon.svg`, `about.md`).
- `docs/`: Auto-generated documentation (`api.json`, `index.html`, `style.css`).
- `build/`: Build scripts (`index.ts`, `utils.ts`, `plugins.ts`, `docs.ts`, `docs-manifest.ts`).

## Build, Test, and Development Commands
- `bun install --frozen-lockfile`: Install the locked dependencies (Bun 1.3.8).
- `bun run test`: Run the Bun regression suite.
- `bun run typecheck`: Run TypeScript checks; compare failures to the baseline.
- `bun run dev`: Build once with sourcemaps.
- `bun run dev:watch`: Rebuild on change (watch mode).
- `bun run build`: Minified production build to `dist/mcp.js`.
- `bun run ./build --clean`: Clean build output; use only if `dist/` contains no
  verification artifacts that need preserving. Ordinary builds do not need it.
- `bun run prompts:build`: Regenerate the bundled prompt manifest.
- `bun run docs:build`: Generate API documentation from Zod schemas to `docs/`.
- `bun run docs:serve`: Serve the generated docs locally with Tailwind processing.
- `bunx @modelcontextprotocol/inspector`: Launch MCP Inspector for local testing.

## Adding New Tools

Every tool file in `server/tools/` follows a two-part pattern:

1. **Export parameter schemas and a `toolDocs` array** at module level (no Blockbench globals):
```ts
import { z } from "zod";
import { createTool, type ToolSpec } from "@/lib/factories";

export const myToolParameters = z.object({
  name: z.string().describe("Name of the thing."),
});

export const myToolDocs: ToolSpec[] = [
  {
    name: "my_tool",
    description: "Does something useful.",
    annotations: { title: "My Tool", destructiveHint: true },
    parameters: myToolParameters,
    status: "stable",
  },
];
```

2. **Register with `createTool()`** inside a `registerXxxTools()` function, spreading from the spec:
```ts
export function registerMyTools() {
  createTool(myToolDocs[0].name, {
    ...myToolDocs[0],
    async execute({ name }) {
      // Blockbench globals (Undo, Canvas, etc.) are safe here
      return `Hello, ${name}!`;
    },
  }, myToolDocs[0].status);
}
```

3. **Update the docs manifest** in `build/docs-manifest.ts`:
   - Import the `toolDocs` array from your tool file.
   - Add it to `toolManifest` with the appropriate category.

4. **Register in `server/tools.ts`**: Import and call your `registerXxxTools()` function.

5. **Regenerate docs**: Run `bun run docs:build` to update `docs/api.json` and `docs/index.html` without starting a server.

### Critical Rule: No Blockbench Globals in Schemas

Parameter schemas are imported at build time by the doc generator, which runs outside Blockbench. **Never use Blockbench runtime globals** (e.g., `BarItems`, `Formats`, `Plugins`) in schema construction. Use `z.string().describe("...")` instead of dynamic enums, and do runtime validation inside `execute()`.

## Documentation System

Documentation is auto-generated from Zod schemas at build time:

- **`build/docs-manifest.ts`**: Imports all `toolDocs` arrays from tool files plus inline prompt/resource specs. This is the single source of truth for what appears in the docs.
- **`build/docs.ts`**: Reads the manifest, converts Zod schemas to JSON Schema via `zod-to-json-schema`, and outputs `docs/api.json` (machine-readable) and `docs/index.html` (Tailwind-styled page).
- **`lib/factories.ts`**: Defines `ToolSpec`, `PromptSpec`, and `ResourceSpec` interfaces used by both tool files and the manifest.

Prompt and resource specs are defined **inline in the manifest** (not imported from their source files) because `server/prompts.ts` uses Bun macros and `server/resources.ts` accesses Blockbench globals at module level.

## Coding Style & Naming Conventions
- Language: TypeScript (strict), ESNext modules, CJS output for the plugin.
- Paths: Use alias `@/*` (see `tsconfig.json`).
- Indentation: 2 spaces; prefer explicit return types and narrow types.
- Keep UI text concise; avoid blocking calls in plugin lifecycle hooks.
- Schema naming: `{camelCaseToolName}Parameters` (e.g., `placeCubeParameters`).
- Docs array naming: `{domainName}ToolDocs` (e.g., `cubeToolDocs`).

## Testing Guidelines
- Automated tests use Bun and include real canvas/PNG and loopback MCP checks.
- Run `bun run test`, the applicable typecheck, production build and docs build.
  There is no configured lint command. Typecheck has known existing diagnostics;
  record current results rather than treating a historic count as a passing gate.
- Validate builds with Blockbench by loading `dist/mcp.js` and exercising changed tools/resources.
- When adding tests, prefer Bun's test runner or Vitest; co-locate near source or use `tests/`.

## Commit & Pull Request Guidelines
- Commits: Use conventional prefixes (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Avoid vague "update"; be specific (e.g., `feat: add mesh selection tools`).
- PRs: Include scope/summary, linked issues, screenshots/GIFs for UI changes, and steps to reproduce/test. Note any new tools, resources, settings, or breaking changes.
- Complete the PR template's version/changelog and validation sections. Apply
  `VERSIONING.md` even when the user's request does not explicitly mention a bump.

## Security & Configuration Tips
- Server config lives in Blockbench Settings: MCP port and endpoint (defaults `:3000/bb-mcp`).
- Do not commit secrets. Keep network calls behind tools; validate all inputs (use `zod`).
- Keep bundle lean: add only necessary deps; prefer tree-shakeable utilities.
