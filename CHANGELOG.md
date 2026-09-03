# Changelog

Record user-visible changes by plugin version. See [VERSIONING.md](VERSIONING.md)
for bump rules and publication handling. Original license and contributor credits
remain in the repository; historical reviews describe their original test builds.

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
