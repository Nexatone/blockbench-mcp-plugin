---
applyTo: '**/*.ts'
---

The code is written in TypeScript and follows a consistent style. It uses modern JavaScript features and adheres to best practices for readability and maintainability.

- Use `const` for constants and `let` for variables that may change.
- Use `async/await` for asynchronous operations, and handle errors with `try/catch`.
- Avoid using `if/else` statements for flow control; prefer early returns to reduce nesting.
- Never use `any` type; always specify a more specific type.
- Prefer TypeScript interfaces over types for defining object shapes.
- Never implement placeholder functions, always provide a complete implementation.

This project uses Bun to compile the code into JavaScript for Blockbench's desktop environment. It uses the official `@modelcontextprotocol/sdk` for MCP. Follow root `AGENTS.md` for tool registration, tests, versioning and lifecycle rules.

When adding Blockbench-related features, reference the applicable Blockbench source version for missing types and API behavior. Use official MCP SDK sources for transport/tool behavior. Existing Blockbench plugins may provide examples, but verify their assumptions against the running editor.

#githubRepo JannisX11/blockbench-plugins
#githubRepo JannisX11/blockbench
#githubRepo modelcontextprotocol/typescript-sdk

Blockbench TypeScript support is incomplete, so some workarounds are necessary:
- Prefer narrow, documented runtime guards or local interfaces for missing types.
  Use targeted TypeScript suppressions only for a verified native API that cannot
  be represented by the installed declarations; do not hide unrelated errors.
