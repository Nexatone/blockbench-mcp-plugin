---
mode: agent
description: Implements an MCP feature request from a GitHub issue using the standardized feature request template.
tools: ['githubRepo', 'get_file_contents', 'search_code', 'blockbench']
---

# Implement MCP Feature Request

Implement the feature described below, following root `AGENTS.md`, `README.md`,
`CONTRIBUTING.md`, `VERSIONING.md` and the latest changelog. Inspect Git state first
and preserve existing work. The issue is the feature specification; follow the
user's current authorization for scope and remote actions.

## Issue Content

${input:issueContent}

## Implementation

Extract the requested feature type, name, domain, inputs, output contract and edge
cases. Check existing tools/resources/prompts before adding another entry point.
Infer effect annotations from the implementation: Undo support alone does not
make deletion non-destructive or repeated creation idempotent.

| Domain | File |
| --- | --- |
| Animation | `server/tools/animation.ts` |
| Camera | `server/tools/camera.ts` |
| Cubes | `server/tools/cubes.ts` |
| Elements | `server/tools/element.ts` |
| Import/Export | `server/tools/import.ts`, `server/tools/export.ts` |
| Mesh | `server/tools/mesh.ts` |
| Model inspection/validation | `server/tools/model.ts` |
| Atomic geometry batches | `server/tools/model-batch.ts` |
| Paint | `server/tools/paint.ts` |
| Project | `server/tools/project.ts` |
| Texture | `server/tools/texture.ts` |
| UI | `server/tools/ui.ts` |
| UV | `server/tools/uv.ts` |

Use the official `@modelcontextprotocol/sdk` and the two-part tool registration
example in `CONTRIBUTING.md`: globals-free Zod schemas plus exported tool specs,
then `createTool` registration. Add domain registration in `server/tools.ts` and
specs in `build/docs-manifest.ts`. Prefer bounded structured outputs with UUIDs,
counts and revisions; paginate large data and make images optional. Preserve
existing names, defaults and payload contracts unless intentionally versioned.

For resources, use `createResource`, share globals-free specs where possible and
register advertised collection URIs. For prompts, use `createPrompt`, shared
metadata in `server/prompt-specs.ts` and `getPromptContent` for bundled fragments.
Keep runtime and generated documentation consistent.

Verify Blockbench APIs against the relevant `JannisX11/blockbench` source version.
Preflight references and format support before mutation. All tools share the
editor queue; prepare asynchronous work before a short synchronous `withUndoEdit`
commit and recheck project/revision/cancellation. Never await while owning Undo
or nest a transaction around a native action that owns one. Refresh only affected
preview data when supported. Return actionable errors without partial edits.

## Verification and delivery

- Verify inputs, structured results, effect annotations and relevant related tools.
- Exercise Undo/Redo and rollback for edits; check retry and revision behavior
  where the contract supports it. Use disposable models and preserve unrelated
  tabs, saved flags, Undo histories and selections.
- Run `bun run test`, `bun run typecheck`, `bun run build` and `bun run docs:build`.
  Record existing type diagnostics separately from regressions.
- Load/reload the local bundle and compare `get_project_capabilities` with
  `dist/build-info.json` before claiming exact-build live verification. Discover
  tool names as exposed by the client; prefer typed tools, using `risky_eval`
  only for native inspection/verification unavailable through them.
- Apply one version bump and changelog entry for the complete plugin-affecting
  PR, rechecking the target version against current `main`. Regenerate tracked
  assets and update relevant README, contributor and agent context.
- Report behavior, compatibility, old/new version, actual validation, remaining
  limitations and URL/file loading instructions. Follow the user's authorization
  for commits, pushes, PRs, merges and releases.
