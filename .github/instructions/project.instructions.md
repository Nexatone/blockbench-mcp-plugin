---
applyTo: '**'
---

This project is a Blockbench plugin that integrates with the Model Context Protocol (MCP) to allow AI models to interact with Blockbench through commands or directly execute JavaScript code in its context.

Read and follow the root `AGENTS.md`, `CONTRIBUTING.md`, `VERSIONING.md` and latest
`CHANGELOG.md` entry before making changes. Those files are the shared agent and
contributor guidance; keep this entry point aligned with them.

For every PR, decide and explain version impact. Plugin changes require a
semantic version bump in `package.json` plus a changelog entry and regenerated
prompt/API assets. Docs/test/CI-only work may keep the version with an explicit
reason. Reuse one target version throughout a PR and recheck against current
`main` before publishing. Do not hard-code the version in runtime code.

Use the official `@modelcontextprotocol/sdk`, Bun, and Blockbench's native APIs.
Keep schemas free of Blockbench globals so documentation can build outside the
editor. Preserve unrelated model tabs and Undo history during live checks.
Describe actual validation and limitations; do not claim unperformed live tests.
Follow the user's existing authorization for remote actions and releases.

Follow the two-part schema/tool-spec registration pattern in `CONTRIBUTING.md`.
Prefer compact model tools and project-scoped resources with bounded output,
UUIDs and revisions. Tools share `lib/editorExecution.ts`; prepare asynchronous
work before a short owned Undo commit and recheck project/revision/cancellation.
Keep shared prompt metadata in `server/prompt-specs.ts` and regenerate API docs.

Compare the running `get_project_capabilities` build ID with `dist/build-info.json`
before claiming a specific local build was tested. Hosted URL installs receive
merged deployments; they do not automatically run an unmerged checkout. When
workflows change, also update README, CLAUDE, installation guidance and these
GitHub instruction/prompt entry points. Preserve historical verification results.
