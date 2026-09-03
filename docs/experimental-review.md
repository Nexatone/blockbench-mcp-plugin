# Experimental feature review — 1.1.0

Review date: 2026-09-03. Base: clean `main`, plugin 1.0.0. This is an unreleased
minor update: existing names and required inputs remain, with 52 newly stable
tools and compatible reliability fixes. No publication is implied.

## Scope, research and promotion criteria

Reviewed all **67 experimental tools and three experimental prompts**, their
registration/schema patterns, shared helpers, generated documentation and context
files. The original 106-tool inventory had 39 stable tools; it now has **91 stable
and 15 experimental tools**. Status controls panel metadata/filtering, not access
authorization. Hytale's four companion resources were also reviewed.

Promotion requires a coherent documented contract, validation before known
failure paths mutate state, correct native Undo aspects, and live evidence for
the supported behavior. This review uses **desktop Blockbench 5.1.6**, not just
the incomplete `blockbench-types` 5.0.6 stubs. It does not certify every older
Blockbench version, third-party codec, or game engine renderer.

The implementation sequence was: inventory and baseline; source research;
geometry/UV and material fixes; animation/history/painting/dialog fixes; isolated
live tests and regression fixes; status promotion and generated assets.

Primary sources:

- [Undo snapshots and group restoration](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/undo.js): groups require explicit `groups` snapshots in addition to the outliner; `keep_saved` prevents checkpoint creation from dirtying the project.
- [Native UV operations](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/uv/uv.js): APIs consume current mesh selection, and view projection owns an Undo transaction.
- [Keyframe selection, copies and reflection](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/animations/keyframe.js): selecting without modifiers clears prior picks; `flip` reflects rotations on the other two axes and adjusts value handles.
- [Texture extension](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/textures.js): partial `extend` calls can empty layers and call `find` with a layer object. Direct Property assignments avoid reconstructing layers.
- [Armature weight storage](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/outliner/types/armature_bone.ts), [camera presets](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/preview/preview.js), [painting](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/painter.js), [layers](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/layers.js), and [actions](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/interface/actions.ts).
- Hytale upstream [validation](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/validation.ts), [main-shape/quad rules](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/util.ts), [quad construction](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/element.ts), [visibility animation](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/animations.ts), and [format capabilities](https://github.com/JannisX11/hytale-blockbench-plugin/blob/main/src/formats.ts), inspected on the review date. These upstream links are moving references; pin a plugin revision before further implementation.

## Initial promotions — 41 tools

| Tools | Evidence and corrections |
| --- | --- |
| `set_camera_angle` | Native perspective/orthographic/unset and degree-based rotation; real screenshots. Target precedence and lack of model Undo documented. |
| `manage_keyframes`, `animation_timeline`, `animation_copy_paste` | Nonselected animation edits; create/edit/delete/multi-select; time, FPS, length, loop and playback; Undo/Redo; save/reopen. Clipboard detaches complete native data and preserves Molang and Bezier handles; native mirror semantics verified. Selection creates no model edit; invalid timestamps fail before mutation. |
| `remove_armature`, `remove_armature_bone`, `update_armature_bones_batch`, `set_vertex_weights_batch`, `clear_vertex_weights` | Native free-format hierarchy and weight tests, reparent/preserve or remove children, Undo/Redo and reopen. Batch validation happens before writes. Weight clearing handles both legacy keys and stale mesh-prefixed keys. Fixed the prerequisite `add_armature` root-parent argument. |
| `remove_element`, `duplicate_element`, `rename_element` | Cube/mesh/group operations, nested group Undo/Redo and round trips. Explicit group snapshots fix missing group restoration/removal; prerequisite `add_group` receives the same correction. |
| `export_model` | Native project export, bounded content, errors, real save/reopen; existing automated tests cover async codecs, typed-array byte offsets and exact file bytes. Third-party codec behavior remains the codec's responsibility. |
| `save_checkpoint` | Named native history entry, Undo/Redo and saved-flag checks. Rejects an active edit. It discards redo like any new history entry and is not a persistent backup. |
| `set_face_material_instance`, `bulk_set_material_instances`, `clear_material_instances` | Native face metadata, failed-batch atomicity, Undo/Redo and reopen. Prototype-like names work in reports and batch lookups. |
| `place_mesh`, `extrude_mesh`, `subdivide_mesh`, `select_mesh_elements`, `move_mesh_vertices`, `delete_mesh_elements`, `merge_mesh_vertices`, `create_mesh_face`, `create_cylinder` | Explicit target isolation, vertex/edge/face selection and extrusion, subdivision counts, merge/delete, Undo/Redo and reopen. Validate references before edits; scope face UV initialization; require mesh-capable formats. Native normal vectors exposed inward cylinder faces; corrected winding is tested. |
| `set_mesh_uv`, `auto_uv_mesh`, `rotate_mesh_uv` | All four mapping modes and all three rotation choices, target isolation and Undo/Redo. Reject missing faces/vertices before opening Undo; projection no longer nests a second transaction. |
| `create_texture`, `add_texture_group`, `create_pbr_material`, `configure_material`, `assign_texture_channel` | Real PNG regression tests plus native image/layer/group/channel tests and reopen. Partial group/channel assignments preserve painted layers. |
| `paint_with_brush`, `color_picker_tool`, `create_brush_preset`, `load_brush_preset`, `texture_layer_management` | Pixel checks, connected strokes, soft circle brush, secondary color and exact alpha, preset load, all nine layer operations, Undo/Redo and reopen. Prevent bottom-layer merge; picker no longer reports the wrong color slot or loses an alpha unit. |
| `trigger_action`, `fill_dialog` | Disposable native actions/dialogs. Conditions checked; non-action widgets and non-object JSON rejected. An existing dialog is never auto-confirmed by another action. Auto-confirm applies only to a new synchronous dialog; async dialogs require a later fill call. |

## Follow-up promotions — 11 more tools

The maintainer requested continuation of the same unreleased change set, so the
version remains **1.1.0**. The two passes promote **52 of the original 67**
experimental tools. The following contracts and limitations are now explicit in
tool schemas/descriptions.

| Tools | Corrections and evidence |
| --- | --- |
| `animation_graph_editor` | Validated ordered ranges, finite normalized custom controls, nonempty key sets and numeric values for generated easing. All seven actions have native interpolation checks, plus per-axis handles, Molang preservation/rejection and Undo/Redo. Native interpolation type is shared across axes; `axis` only scopes generated handles. Ranges select complete keyframes and can affect adjacent segments. |
| `batch_keyframe_operations` | Complete active-animation selection includes collapsed animators. Preflight rejects negative times, nonpositive time scale and same-channel collisions. Offsets include both pre/post values; scale changes Bezier time handles; reverse swaps handles and data points; reflection uses native `flip`. Bake evaluates Molang numerically and replaces the full sampled channel span, including its endpoint. All selections and six operations tested with sampling, Undo/Redo and reopen. Reverse follows native keyframe semantics, not a guarantee of analytical reversal of every stepped/Molang curve. |
| `draw_shape_tool`, `copy_brush_tool`, `eraser_tool` | Native paint owns its single Undo edit. Tool selection precedes per-tool settings; `NumSlider.setValue` fixes discarded numeric inputs. Tests cover four shapes, copy/sample/pattern, connected/disconnected erasing, softness, opacity including zero, cancellation and Undo/Redo. |
| `gradient_tool`, `paint_fill_tool` | Two-color gradients honor both endpoint colors, blend modes, alpha lock, selected layers and binary masks. Color fill supports global/four-connected matching and max-channel RGBA tolerance; transparent RGB is ignored when both alpha values are zero. Tests cover all fill modes, tolerance/barriers, blend modes, offsets and Undo/Redo. These explicit pixel operations do not apply mirror or color-erase flags; native non-color fill modes retain native behavior. |
| `paint_settings` | Supplied axes replace previous axes; empty clears them. Explicit false and disabled mirror options are applied. Native flags, toggles and stylus settings tested; the suite restores prior settings after testing. |
| `texture_selection` | Maintainer accepted deprecating `feather_selection` while retaining its explicit unsupported error. Seven supported binary operations remain available, including composition and morphology. Unit/live tests cover masks, bounds, invalid input, and absence of model Undo edits. |
| `import_texture_set`, `save_material_config` | Import preflights structure and files, stages PNG/TGA decoding, checks project identity, then commits one Undo edit. Repeated image paths are rejected rather than silently creating empty materials through native deduplication. Tests cover constants, PNG/TGA, missing/corrupt/duplicate files, Undo/Redo and reopen. Desktop material save is synchronous in 5.1.6; validate its output path and read back JSON before reporting success. |

Additional native sources: [numeric slider storage](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/interface/actions.ts),
[reverse-keyframe semantics](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/animations/keyframe.js),
[interpolation and IK](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/animations/timeline_animators.js),
[texture-set import/save](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/texture_groups.js),
and [image loading/deduplication](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/textures.js).
Their matching 5.1.6 source was inspected locally alongside live execution.

## Remaining experiments — complete list and next steps

These 15 tools retain their experimental marker. The 12 Hytale tools and three
Hytale prompts are **deferred at the maintainer's explicit request on 2026-09-03**;
do not install that integration or resume its implementation without a new request. A source review or a passing
default-path test alone is insufficient for promotion.

| Tool(s) | Blocker and next implementation/verification step |
| --- | --- |
| `bone_rigging` | IK writes ad-hoc group fields, mirror changes pivots without a complete native hierarchy reflection, rename repurposes `children[0]`, and Undo/parent validation is incomplete. Define native IK targets, validate cycles and IDs, use explicit groups/elements/animations snapshots, and test each action. |
| `knife_tool` | Fabricates a native interactive knife context from only position/face; point/topology metadata and native transaction ownership are not established. Adapt the native point representation and verify crossing edges, concave faces, invalid paths and cancellation. |
| `emulate_clicks` | Synthetic events are untrusted; pointer capture, target changes during drag, focus and right/middle click behavior depend on the UI. Keep coordinate automation experimental until representative editor interactions are verified. |
| `hytale_get_format_info`, `hytale_get_cube_properties`, `hytale_get_cube_stretch` | Optional plugin absent. Pin its version; validate capabilities/defaults against live objects and exported files rather than hard-coded feature claims. |
| `hytale_validate_model` | Node counting is heuristic, omits main-shape/export/collection rules, and the dimension check wrongly treats pixel density as a mandatory atlas width. Align with native exporter and UV dimensions; test excluded nodes, attachments, rotated main shapes and limits. |
| `hytale_set_cube_properties`, `hytale_set_cube_stretch` | Require live plugin Property serialization, viewport refresh and Undo/Redo/reopen tests; property availability must be checked after unload/reload. |
| `hytale_create_quad` | Positive and negative normals currently produce identical cube geometry with all faces present. Upstream quads enable one matching face and disable the others. Implement all six directions and verify `.blockymodel` shape export. |
| `hytale_list_attachments`, `hytale_list_attachment_pieces` | Verify actual Collection membership and piece serialization, including duplicate names and reload behavior. Collection `children` counts are not established against the installed plugin API. |
| `hytale_set_attachment_piece` | Needs explicit group-property Undo capture and live serialization of `is_piece`, plus the main-model/attachment workflow. |
| `hytale_create_visibility_keyframe` | Writes `{visible}` but upstream consumes `{visibility}`; animator creation also occurs before Undo capture. Fix payload and transaction boundary, then verify false/true at runtime and `.blockyanim` export. |
| `hytale_set_animation_loop` | Plugin absent; verify all advertised loop modes and saved/exported behavior. The description currently omits the accepted `once` mode. |

The experimental prompts `hytale_model_creation`, `hytale_animation_workflow`
and `hytale_attachments` depend on the above work. In particular, pixel density
does not establish a fixed atlas width, the animation guide uses `smooth` where
the tool schema uses `catmullrom`, and attachment instructions need an exported
modular-model fixture. Revise and replay all three guides against a pinned plugin.

Hytale resources `hytale-format`, `hytale-attachments`, `hytale-pieces` and
`hytale-cubes` share these assumptions, and currently have no stability field in
the resource spec. Verify them with the same fixtures; their absence from the
experimental-tool count is not a claim of certification. Optional Reference
Models resources likewise need that plugin installed. Both integrations are
registered at MCP load; reload MCP after enabling or disabling them.

The next active engineering work is `bone_rigging`, `knife_tool` and
`emulate_clicks`. For rigging, native IK uses Null Object controllers with UUID
targets/source bones, not ad-hoc Group fields. Design an additive controller
contract, a proper rename field, cycle checks and complete group/animation Undo
before testing every action. Knife work needs native point/edge metadata and
transaction ownership; pointer emulation needs representative drag/focus/capture
fixtures. They remain experimental because those behaviors are not verified.

The only user decisions requested in this follow-up were Hytale deferral and
retaining a deprecated feather action; both are recorded above. There is no
additional user-input blocker for the current completed promotions.

## Verification and use

Follow-up: all **60 tests pass (372 assertions)**. The production build and
documentation generation pass. Typecheck still reports **72 existing diagnostics**,
down from this pass's baseline of 96; comparison by file/diagnostic message finds
no newly introduced diagnostics. Native Blockbench 5.1.6 passes all seven
follow-up scenario groups, the initial seven stabilization groups, the existing
seven-group regression suite and the project round-trip suite. All **19 original
projects** retain model data, saved flags and Undo history. The final production
SHA-256 is recorded in the ignored live reports under `.verification/`.

Historical initial pass: baseline 52 tests/107 TypeScript diagnostics, ending at
56 tests (361 assertions)/96 diagnostics with no newly introduced diagnostics.
No lint command exists. No multi-hour
connection soak, optional-plugin live tests, or in-game rendering is claimed.

Historical initial-pass production build and documentation generation passed. Its bundle
`496de5223cb476efcdef7572886494941e2b40abd0bd495225bcc30ecc8d7c55`
(SHA-256) passed all seven new live scenario groups, the existing seven-group
`test:live` regression suite, and `tests/live/project-roundtrip.mjs`. All 19
pre-existing projects passed preservation checks. Initial fixture input errors
were corrected before these final runs; a transient transport failure in an
earlier run did not recur in the final suites.

The suites `tests/live/experimental-stability.mjs` and
`tests/live/remaining-experiments.mjs` use the current loopback
MCP connection and record plugin path, version and local bundle SHA-256. They
create disposable projects, check actual native state/pixels and compare all
19 pre-existing projects' compiled models, saved flags and Undo histories. They
restore the active tab and temporary presets/colors; the follow-up suite also
restores settings, per-tool brush values and mirror options. Do not run alongside manual
model editing or with unrelated dialogs open. Saved snapshots/reports are under
ignored `.verification/`.

```sh
bun install --frozen-lockfile
bun run test
bun run typecheck
bun run build
bun run docs:build
bun run dev
# Load this checkout's dist/mcp.js in Blockbench, then:
bun run test:stability:live
bun run test:remaining:live
bun run test:live
```

The local plugin is prepared as **1.1.0**; the public nightly URL changes only
after a separate authorized publication. Load `dist/mcp.js` using **File > Plugins
> Load Plugin from File**, then reload that plugin after rebuilding and reconnect
the client. After testing, the original nightly URL installation was restored
and reconnected as 1.0.0; the verified 1.1.0 production bundle remains in `dist/`.
No version tag or GitHub release is required for this metadata change.

Context cleanup covers `CLAUDE.md`, `llms.txt`, installation pointers and
`about.md`: they previously disagreed with the actual tests, license, maintainer,
endpoint or prompt loader. Historical review reports retain their original
verification versions and counts.
