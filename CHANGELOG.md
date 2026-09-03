# Changelog

Record user-visible changes by plugin version. See [VERSIONING.md](VERSIONING.md)
for bump rules and publication handling. Original license and contributor credits
remain in the repository; historical reviews describe their original test builds.

## [1.2.0] - Unreleased

### Added

- Compact, paginated `query_model`, `get_element`, project capabilities and native
  validation results with project UUIDs, revisions and typed output schemas.
  Project-scoped element/texture resources avoid serializing render graphs.
- `apply_model_batch` creates groups, cubes and complete meshes with faces/UVs,
  patches or removes elements in one native Undo edit. It preflights references,
  rolls back failures and supports bounded, ten-minute operation-ID deduplication.
- `open_project` imports native `.bbmodel` data into an isolated tab;
  `select_project` activates an existing tab by UUID.
- Structured project/texture identities on imports and texture creation, optional
  previews, and explicit layer IDs for texture layer management.

### Fixed

- Index resource slugs once per collection while preserving existing URIs.
- Serialize tool execution across clients, reject changed projects or pending
  edits, and pass cooperative cancellation/progress through the MCP factory.
- Preserve multibone/additive selection and reject invalid targets before clearing
  selection. Mesh component selection uses native selection history without
  dirtying model data. Invalid regular expressions now return actionable errors.
- Revert failed brush/keyframe/layer transactions with native Undo ownership
  checks. Avoid repeated face scans during vertex deletion and discarded binary
  encoding during export; reject a project switch while a codec compiles.
- Supply a useful default modeling prompt, correct native API and optional Hytale
  guidance, and share prompt specifications between registration and generated docs.
  Register advertised Hytale collection URIs when that integration is present.
- Align contributor examples, agent context and GitHub task templates with the
  current SDK, compact workflow, build verification and URL/file installation paths.
- Apply the MCP instructions setting to server initialization. Watch builds
  regenerate prompt content before bundling and ignore generated/test artifacts.
  Retry transient Windows output locks and keep watching after failed builds.
  Build identities allow verifying the exact locally loaded bundle.

### Compatibility

- Compatible additions: existing tool names, resource payloads and preview defaults
  remain available. `nodes://` remains potentially large; prefer the compact APIs.
  Invalid regex/parent/selection requests intentionally fail before edits.
- Revisions, cursors and retry caches are transient and reset on reload. A replay
  returns the original result; it does not redo a later Undo. Use a new operation
  ID for a new edit. Revisions follow native edit/Undo/Redo events and conservatively
  invalidate after `risky_eval`; plugins bypassing these events can evade detection.
- The existing SDK/HTTP protocol remains in use. Current-protocol migration,
  optional tool profiles and unmeasured CPU rewrites are separate follow-ups.
  Hytale remains experimental and was not live-tested without its optional plugin.

## [1.1.0] - Unreleased

### Changed

- Promote 52 experimental tools across geometry, UVs, armatures, animation,
  textures/materials, painting, history, camera, export and dialogs after native
  Blockbench 5.1.6 verification. See the complete
  [experimental feature review and remaining plan](docs/experimental-review.md).
- Correct context files, attribution/license guidance and installation URLs;
  add an isolated live stability suite.
- Stabilize the remaining paint tools, curve editor, batch keyframe operations,
  texture-set import and material saving after a second native verification pass.

### Fixed

- Track group creation, duplication, removal and renaming explicitly in Undo;
  create armatures at the native root and validate mesh references before edits.
- Scope new-face UVs to the requested mesh, avoid nested projection Undo edits,
  reject unsupported mesh formats, and point cylinder faces outward.
- Preserve texture layers when moving textures between groups or PBR channels.
  Handle arbitrary material instance names and validate weight batches atomically.
  Clear legacy and stale mesh vertex-weight entries.
- Preserve checkpoint saved state; make timeline property edits undoable and
  retain every selected keyframe.
- Copy complete detached animation keyframes and use native mirroring for
  rotation, position and Bezier handles. Reject invalid paste times before edits.
- Return the requested picked color and exact pixel opacity; reject merging a
  bottom layer. Do not confirm pre-existing dialogs when an action runs, and
  reject non-object dialog/event JSON.
- Use the native numeric-slider setter and a single paint transaction; preserve
  disconnected eraser strokes and zero opacity. Gradients use both supplied
  colors; color fills implement tolerance and layer/selection boundaries.
- Include collapsed animators in batch selections, preserve Bezier time handles
  and pre/post values, reject collisions before edits, and sample complete bake spans.
- Decode texture-set images before changing the project; reject missing, corrupt
  and duplicate image references. Verify material output on disk before success.

### Compatibility

- Compatible minor release for newly stable capabilities; tool names and required
  inputs are unchanged. Invalid component references, unavailable actions and
  negative keyframe times fail before edits instead of silently doing partial
  work. Mirrored rotations and cylinder winding correct previously wrong output.
- Checkpoints are transient history markers: they discard redo like any new edit
  and remain subject to the Undo limit. Animation clipboard data clears on plugin
  reload. Target takes precedence over camera rotation; rotation uses degrees.
- `feather_selection` remains as a deprecated action with an explicit error;
  supported binary selection actions are stable. No weighted-mask support is implied.
- Curve interpolation is shared across axes; axis scopes Bezier handles. Generated
  easing requires numeric affected values. Nonpositive time scaling is rejected;
  use reverse. Texture-set imports reject images already used in the project.
- 15 tools and three Hytale prompts remain experimental. Hytale work is deferred
  at the maintainer's request. Optional integrations
  and older Blockbench versions are not covered by the live promotion evidence.

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
