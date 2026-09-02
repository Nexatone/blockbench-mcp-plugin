# Changelog

Record user-visible changes by plugin version. See [VERSIONING.md](VERSIONING.md)
for bump rules and publication handling. Original license and contributor credits
remain in the repository; historical reviews describe their original test builds.

## [1.0.0] - Unreleased

### Changed

- Start Josshy's version line at 1.0.0, replacing the inherited 1.6.1 label while
  retaining the existing plugin functionality and fixes.
- Establish one version source, semantic version rules, a contributor checklist,
  and shared agent instructions for future changes.

### Included fixes

- Requested blank texture dimensions, fill/transparent pixels and saved layers.
- MCP connection validation, session lifecycle, disconnect/reconnect and cleanup.
- Project-free evaluation, isolated Bedrock imports and saved GUI display flags.
- Geometry, mesh, animation, painting and export fixes detailed in
  [the repository review](docs/bug-review.md) and
  [the Bedrock round-trip review](docs/project-roundtrip.md).

### Compatibility

- This is a deliberate version-number reset, not a rollback to older code.
  Reload URL-installed plugins explicitly after deployment.
- Existing contracts carry forward: `risky_eval` scripts manage their own Undo;
  Bedrock exports use native codec version/normalization rules. Existing Entity
  tabs are not automatically converted to Block projects.
- The nightly plugin URL and local MCP endpoint remain unchanged.
