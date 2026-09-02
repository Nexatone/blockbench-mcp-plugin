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
