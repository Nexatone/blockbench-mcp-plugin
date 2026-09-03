# Complete MCP efficiency inventory

Review date: 2026-09-03; package 1.1.0; source commit `056eca5e120d48064302d881e0f016001927e97f`. See the [architecture review](efficiency-review.md) for priorities, compatibility rules, native-source citations and validation.

This is the historical baseline inventory. See the [1.2.0 implementation report](efficiency-implementation.md)
for completed changes and the [generated API](api.json) for current contracts.

All **106 tools, 16 resource definitions and 6 registered prompts** are accounted for below, followed by all **11 bundled prompt fragments**. Every tool received source review. **Live** means the stated limited scenario was exercised in this review; it does not certify the entire tool. **Source** means the recommendation is based on implementation inspection, not a new live test. Experimental status is preserved. Hytale and reference-model integrations were unavailable in the connected editor.

The common proposed contract applies throughout: explicit project/UUID targeting, bounded reads, preflight validation, owned transactions, structured IDs/counts, and accurate effect annotations. Reuse native operations and the existing regression tests. Add capabilities and deprecations compatibly; changing old defaults, fields or schemas may require a major version.

## Tools (106)

### Cubes (2)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`place_cube`](../server/tools/cubes.ts#L102) · stable | Keep + optimize; Live | Already accepts multiple cubes: measured 8.20x faster for 25 cubes in one call, with working batch Undo/Redo. Preserve native construction; validate parent/texture before Undo, bound batch size, return an ID map and flush preview once. |
| [`modify_cube`](../server/tools/cubes.ts#L113) · stable | Extend; Source | Keep cube-property editing; add an explicit per-UUID patch batch. Duplicate names can currently target multiple cubes. Define ambiguous-name behavior and preserve selected-set semantics for the legacy call. |

### Camera & Screenshots (3)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`capture_screenshot`](../server/tools/camera.ts#L24) · stable | Keep; Live | Useful final visual verification; 205 KB / 24 ms sample. Add optional size/crop controls and avoid automatic repetition between small mutations. Coordinate temporary project switching. |
| [`capture_app_screenshot`](../server/tools/camera.ts#L34) · stable | Keep; Live | Useful for dialog/UI diagnosis; 234 KB / 117 ms sample. Keep separate from viewport capture and use only when UI context is necessary. |
| [`set_camera_angle`](../server/tools/camera.ts#L44) · stable | Keep + extend; Source | Uses native camera state and returns a screenshot. Offer optional preview suppression in a compatible extension and batch view setup before one capture. Preserve projection/target precedence. |

### Animation (7)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`create_animation`](../server/tools/animation.ts#L257) · stable | Keep + extend; Source | Native Animator loading is a valuable whole-animation path. Preflight bone targets and format support, report animation UUIDs and unsupported inputs, and return structured counts instead of requiring discovery. |
| [`manage_keyframes`](../server/tools/animation.ts#L267) · stable | Keep + optimize; Source | Useful point editing; share validated keyframe operations with the batch tool. Prefer explicit animation/animator IDs; recompute length/preview once where native contracts permit. |
| [`animation_graph_editor`](../server/tools/animation.ts#L278) · stable | Keep + optimize; Source | Retain native curve/easing behavior; make affected-keyframe selection explicit and share resolution/collision handling. Large operation schema is a candidate for targeted discovery, not a reason to remove functionality. |
| [`bone_rigging`](../server/tools/animation.ts#L289) · experimental | Rework; remain experimental; Source | Ad-hoc rig construction needs native IK/controller and hierarchy verification, complete Undo aspects and parent-cycle guards. Do not present it as production-equivalent to native rig workflows until those cases pass. |
| [`animation_timeline`](../server/tools/animation.ts#L300) · stable | Keep; Source | Appropriate editor-state control. Report actual time/playback/selection; coordinate with model edits and distinguish preview/playback changes from model Undo. |
| [`batch_keyframe_operations`](../server/tools/animation.ts#L311) · stable | Keep + fix/optimize; Source | Good batching surface with existing bake limits. Fix cancelEdit-without-revert failure handling; index collisions by animator/channel, avoid repeated length work and use one owned commit. |
| [`animation_copy_paste`](../server/tools/animation.ts#L321) · stable | Keep + isolate; Source | Retain copy/paste utility; clipboard is shared application state. Add explicit clipboard handles/project provenance for deterministic multi-client use, and define replacement/collision behavior. |

### Armature (16)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`list_armatures`](../server/tools/armature.ts#L279) · stable | Keep + bound; Source | Good domain discovery. Add compact field selection/pagination for large scenes and report format support separately from an empty list. |
| [`get_armature`](../server/tools/armature.ts#L290) · stable | Keep + bound; Source | Keep direct UUID lookup; return compact hierarchy IDs/counts by default in the new result contract and make deep bone expansion explicit. Reject ambiguous prefixes. |
| [`add_armature`](../server/tools/armature.ts#L301) · stable | Keep + batch; Live | Native construction worked in scratch testing. Fold optional initial bones into a declarative rig batch and return local-reference-to-UUID mappings. |
| [`remove_armature`](../server/tools/armature.ts#L312) · stable | Keep + guard; Source | Preflight the full subtree and affected mesh associations before mutation; return removed counts/IDs and verify Undo restores weights and relationships. |
| [`update_armature`](../server/tools/armature.ts#L322) · stable | Keep + batch; Source | Reuse native property changes; integrate with a rig patch batch, resolve IDs unambiguously and refresh only affected bones/meshes. |
| [`list_armature_bones`](../server/tools/armature.ts#L332) · stable | Keep + bound; Source | Useful hierarchy inspection; allow a root/depth/field limit rather than serializing large rigs on every call. Include stable UUIDs. |
| [`get_armature_bone`](../server/tools/armature.ts#L343) · stable | Keep; Source | Useful targeted read. Keep the result compact, separate large weight payloads, and enforce unique ID/name resolution. |
| [`add_armature_bone`](../server/tools/armature.ts#L353) · stable | Keep + batch; Live | Two native bones created successfully. Add hierarchy creation with local parent aliases so agents avoid one round trip per bone. |
| [`remove_armature_bone`](../server/tools/armature.ts#L364) · stable | Keep + guard; Source | Resolve full affected hierarchy and weight relationships first. Verify native child handling and complete Undo aspects on removal rather than assuming an element-only save covers everything. |
| [`update_armature_bone`](../server/tools/armature.ts#L374) · stable | Keep + batch; Source | Share property validation and native update behavior with the existing batch variant; return actual affected IDs and refresh only dependent meshes. |
| [`update_armature_bones_batch`](../server/tools/armature.ts#L384) · stable | Keep + harden; Source | Already offers the right granularity. Preflight all bones/properties before Undo, reject duplicates or define ordering, and use the shared owned transaction helper. |
| [`select_armature_bones`](../server/tools/armature.ts#L394) · stable | Fix first; Live | Two requested bones produced only the last selection; invalid ID cleared selection before error. Resolve/deduplicate first, apply native additive selection and report actual selected UUIDs. |
| [`get_vertex_weights`](../server/tools/armature.ts#L405) · stable | Redesign result additively; Source | Scans bones x vertices and keys output by bone name, allowing duplicate-name overwrite. Offer sparse UUID-keyed records, vertex/bone filters and pagination. |
| [`set_vertex_weight`](../server/tools/armature.ts#L416) · stable | Keep; Source | Useful small native edit; steer multi-vertex work to the batch call. Validate mesh/armature/bone association explicitly and keep native weight-key semantics. |
| [`set_vertex_weights_batch`](../server/tools/armature.ts#L426) · stable | Keep + harden; Source | Right granularity for skinning. Validate every target before mutation, bound estimated work, and refresh dependent geometry once. |
| [`clear_vertex_weights`](../server/tools/armature.ts#L436) · stable | Keep + clarify; Source | Retain scoped clear operations, but make the target mesh/bone/vertices explicit and report counts. Preserve native weight namespaces and ensure Undo covers all changed bones. |

### Elements (9)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`remove_element`](../server/tools/element.ts#L145) · stable | Extend; Source | Add a prevalidated multi-UUID remove operation to reduce calls and intermediate selection. Include subtree effects and one Undo boundary; keep legacy single-element behavior. |
| [`add_group`](../server/tools/element.ts#L155) · stable | Keep + fix/batch; Source | Parent resolution happens after Undo begins; resolve first. Add hierarchy creation with local aliases and sensible optional transform defaults through compatible schema changes. |
| [`list_outline`](../server/tools/element.ts#L165) · stable | Keep + emphasize filters; Live | Default result was 99,644 B; groups-only depth-2 was 333 B. Existing filters are valuable immediately. Add field selection, project scope and paginated element queries rather than forcing a full recursive tree. |
| [`duplicate_element`](../server/tools/element.ts#L176) · stable | Keep + batch; Source | Preserve native duplicate behavior and explicit partial-object cleanup. A multi-element operation should handle shared hierarchy, return old/new IDs and refresh once. |
| [`rename_element`](../server/tools/element.ts#L184) · stable | Keep + optimize; Source | Useful identity operation; avoid full-scene refresh for a name-only change, invalidate name/slug indexes, and offer multi-UUID renaming. |
| [`find_elements_by_criteria`](../server/tools/element.ts#L191) · stable | Fix first + extend; Live | Invalid regex was ignored and an unrelated match returned. Reject invalid filters; retain limit support and add cursor, exact UUID/name options and projected fields. |
| [`select_all_of_type`](../server/tools/element.ts#L202) · stable | Keep + verify state; Source | Retain convenience selection but route groups, meshes and elements through a consistent native selection adapter. Return actual selection IDs/counts, with a compact option. |
| [`filter_by_material`](../server/tools/element.ts#L213) · stable | Keep + index; Source | Useful query/selection by texture/material. Resolve material identity consistently, distinguish filtering from selection mutation, and index face references for repeated large queries. |
| [`get_selection`](../server/tools/element.ts#L224) · stable | Keep; Live | Compact 402 B baseline result. Use as the selection entry point; extend with explicit project/revision and bounded mesh sub-selection details if needed. |

### Export (2)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`list_export_formats`](../server/tools/export.ts#L50) · stable | Keep + clarify; Live | Compact discovery at about 4.3 KB. only_current_format filters codec identity, not all compatible exporters despite its description. Clarify that distinction and include verified capabilities; cache stable metadata carefully. |
| [`export_model`](../server/tools/export.ts#L61) · stable | Keep + optimize; Source | Preserve native codecs, permission-gated paths and existing limits. Skip discarded base64 when output content is disabled; recheck project identity after async compilation and return path/size/content references. |

### History (4)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`undo`](../server/tools/history.ts#L52) · stable | Keep + guard; Live | Batched cube Undo restored zero cubes. Serialize against pending model commits and require project/revision in the new contract so another client does not undo the wrong work. |
| [`redo`](../server/tools/history.ts#L63) · stable | Keep + guard; Live | Batched cube Redo restored all 25 cubes. Apply the same pending-edit/project checks as Undo and report the resulting revision. |
| [`get_undo_stack`](../server/tools/history.ts#L74) · stable | Keep; Live | Existing limit works; limit 5 returned about 1.3 KB. Keep summaries bounded and distinguish native history metadata from durable snapshots. |
| [`save_checkpoint`](../server/tools/history.ts#L85) · stable | Keep + clarify; Source | An Undo marker is not a saved project snapshot or a general transaction rollback. Document the distinction and offer true project snapshots separately if needed. |

### Import/Export (1)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`from_geo_json`](../server/tools/import.ts#L19) · stable | Keep + extend results; Source | Efficient whole-model Bedrock import with bounded inputs and staged project creation. Preserve rollback/restoration; return project/element IDs alongside optional preview. Add .bbmodel import separately. |

### Material Instances (5)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`get_face_material_instances`](../server/tools/material-instances.ts#L99) · stable | Keep + bound; Source | Targeted face inspection is useful. Add explicit face filters/limits and compact material identifiers for large meshes. |
| [`set_face_material_instance`](../server/tools/material-instances.ts#L110) · stable | Keep; Source | Keep atomic face assignment and native format semantics; steer multiple targets toward bulk_set_material_instances and validate all references before Undo. |
| [`list_material_instances`](../server/tools/material-instances.ts#L121) · stable | Keep + cache carefully; Source | Useful aggregate query; avoid repeated whole-model scans with a revision-scoped material index. Preserve distinction from PBR texture-group materials. |
| [`bulk_set_material_instances`](../server/tools/material-instances.ts#L132) · stable | Keep + harden; Source | Good existing batch surface. Prevalidate every element/face and use one complete Undo save and targeted refresh. |
| [`clear_material_instances`](../server/tools/material-instances.ts#L143) · stable | Keep + clarify; Source | Retain scoped clearing; return affected counts and validate the complete requested scope before editing to prevent partial failure. |

### Mesh Editing (11)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`place_mesh`](../server/tools/mesh.ts#L198) · stable | Extend substantially; Live | Three input vertices created zero faces, as the vertex-only input permits. Add faces, UVs and local vertex aliases in one creation operation; return vertex/face key maps. |
| [`extrude_mesh`](../server/tools/mesh.ts#L209) · stable | Keep + optimize; Source | Preserve topology and UV behavior in the native/helper path. Bound predicted output geometry, validate selected faces first and avoid duplicate preview refreshes. |
| [`subdivide_mesh`](../server/tools/mesh.ts#L219) · stable | Keep + optimize; Source | Retain the existing face-growth limit and edge cache. Check output budgets before allocation; benchmark large topology and ensure UV seams/Undo stay equivalent. |
| [`create_sphere`](../server/tools/mesh.ts#L229) · stable | Keep + harden; Source | Already accepts a batch. Bound combined generated vertices/faces before allocating, validate parent/texture once and return compact IDs. |
| [`select_mesh_elements`](../server/tools/mesh.ts#L240) · stable | Fix history semantics; Live | Selection created a model Undo entry. Use a native selection adapter; validate all keys before changing state and replace repeated membership scans with sets. |
| [`move_mesh_vertices`](../server/tools/mesh.ts#L251) · stable | Keep + batch; Source | Keep explicit vertex edits and current transform semantics. Resolve vertex sets once, permit grouped deltas and coalesce geometry/selection refreshes. |
| [`delete_mesh_elements`](../server/tools/mesh.ts#L261) · stable | Keep + optimize; Source | Preserve native topology/UV cleanup. Build a used-vertex set instead of scanning all faces for each candidate; stage requested key validation before Undo. |
| [`merge_mesh_vertices`](../server/tools/mesh.ts#L271) · stable | Keep + optimize; Source | Current distance matching can be quadratic and face rewrites repeated. Use spatial indexing only with tests preserving greedy merge order, face validity and UV seams. |
| [`create_mesh_face`](../server/tools/mesh.ts#L282) · stable | Keep + batch; Source | Useful atomic face operation; add multi-face inputs with shared vertex aliases as part of complete mesh creation. Return new face keys. |
| [`create_cylinder`](../server/tools/mesh.ts#L292) · stable | Keep + harden; Source | Preserve native construction and batched elements; validate total geometry budget and shared targets before mutation, then refresh once. |
| [`knife_tool`](../server/tools/mesh.ts#L299) · experimental | Rework; remain experimental; Source | Synthetic interactive knife context and transaction ownership need native-version verification. Prefer an explicit mesh-cut contract with reproducible topology outcomes before promotion. |

### Paint Tools (12)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`paint_fill_tool`](../server/tools/paint.ts#L292) · stable | Keep + optimize; Source | Preserve layer, selection, alpha-lock and native fill semantics. Avoid duplicate whole-image reads and excessive per-pixel allocations; add work budgets and a paint batch. |
| [`draw_shape_tool`](../server/tools/paint.ts#L302) · stable | Keep + batch; Source | Good declarative paint operation. Share layer/texture validation, bound work, and combine multiple shapes into one pixel edit and texture refresh. |
| [`gradient_tool`](../server/tools/paint.ts#L312) · stable | Keep + batch; Source | Retain native gradient blending and active-layer behavior. Add explicit layer identity and support one paint plan with other strokes/shapes. |
| [`color_picker_tool`](../server/tools/paint.ts#L322) · stable | Correct metadata; Source | Read-only annotation conflicts with texture activation and brush color/opacity changes. Split pure sampling from state application or describe/annotate the current stateful behavior accurately. |
| [`copy_brush_tool`](../server/tools/paint.ts#L333) · stable | Keep + clarify; Source | Keep native clone/copy behavior; make source and target texture/layer state explicit and validate before a pixel transaction. |
| [`eraser_tool`](../server/tools/paint.ts#L343) · stable | Keep + batch; Source | Preserve alpha-lock, layer and brush semantics. Reuse a bounded paint plan rather than separate Undo/refresh per short stroke. |
| [`paint_settings`](../server/tools/paint.ts#L353) · stable | Keep + simplify workflow; Source | Useful for persistent editor settings, but many brush calls already accept their own settings. Prefer inline per-operation options and avoid extra setup calls for one stroke. |
| [`paint_with_brush`](../server/tools/paint.ts#L363) · stable | Keep + fix/batch; Source | Retain actual native brush behavior. Fix error rollback ownership, bound point x brush-area work and defer texture updates across a validated stroke batch. |
| [`create_brush_preset`](../server/tools/paint.ts#L374) · stable | Keep + complete discovery; Source | Creates persistent editor state. Add deterministic naming/replace semantics and preset listing; do not require preset creation for one-off paint operations. |
| [`load_brush_preset`](../server/tools/paint.ts#L384) · stable | Keep + complete discovery; Source | Useful when preset identity is known. Add list/lookup output and return the applied settings so the agent need not infer state. |
| [`texture_selection`](../server/tools/paint.ts#L394) · stable | Keep + optimize; Source | Retain the tested mask/morphology helpers. Build summed-area data only for operations using it, expose resulting bounds/count and preserve active texture/layer identity. |
| [`texture_layer_management`](../server/tools/paint.ts#L405) · stable | Extend targeting; Source | Operations depend on the selected layer and return limited identity information. Add list/select or explicit layer UUID arguments and return created/current layer IDs. |

### Project (2)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`create_project`](../server/tools/project.ts#L19) · stable | Keep + extend; Live | Created seven disposable free projects successfully; the audit closed them separately. Validate format availability before newProject, add capability discovery and return created-project IDs in a common structured envelope. |
| [`get_project_info`](../server/tools/project.ts#L30) · stable | Keep; preferred entry point; Live | About 686 B and 1.43 ms median. Add capability/revision data compactly; use this before large outline/resource reads. |

### Textures (13)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`create_texture`](../server/tools/texture.ts#L240) · stable | Extend results + guard; Live | 16x16 creation succeeded but returned image content without a texture UUID. Retain staged decode/project checks; recheck Undo ownership before commit and return identity/dimensions with optional image. |
| [`apply_texture`](../server/tools/texture.ts#L251) · stable | Keep + optimize; Source | Native assignment with selection restoration is valuable. Validate all face targets, avoid duplicate native/full-scene refresh and support batched assignments. |
| [`add_texture_group`](../server/tools/texture.ts#L262) · stable | Keep + extend; Source | Retain native group handling; return group UUID and resolve group identity consistently with creation/import tools. |
| [`list_textures`](../server/tools/texture.ts#L272) · stable | Keep; preferred metadata query; Live | Only 186 B in the baseline scene versus 21.1 KB for textures://. Add dimensions/channel/group metadata compactly, with optional paging. |
| [`get_texture`](../server/tools/texture.ts#L282) · stable | Keep + separate payloads; Source | Useful explicit image retrieval. Offer metadata/image/content-reference choices, optional downscaling and bounds instead of forcing image data for every inspection. |
| [`create_pbr_material`](../server/tools/texture.ts#L293) · stable | Keep + harden; Source | Already composes channel textures and a material group. Preserve native PBR helpers, preflight all channels and return material/texture UUIDs in one result. |
| [`configure_material`](../server/tools/texture.ts#L304) · stable | Keep; Source | Retain native material-property semantics. Resolve UUIDs consistently and update only affected group/material previews. |
| [`list_materials`](../server/tools/texture.ts#L315) · stable | Keep + bound; Source | Useful PBR discovery distinct from face material instances. Return compact channel references and add pagination when material counts grow. |
| [`get_material_info`](../server/tools/texture.ts#L326) · stable | Keep; Source | Targeted native PBR inspection is the right granularity. Include stable material/channel IDs and omit bitmap payloads unless explicitly requested. |
| [`import_texture_set`](../server/tools/texture.ts#L337) · stable | Keep; use as pattern; Source | Staged loading and project/Undo rechecks are a stronger transaction pattern already present. Preserve them and return a complete channel/group identity map. |
| [`assign_texture_channel`](../server/tools/texture.ts#L349) · stable | Keep + batch; Source | Retain channel semantics; allow complete channel maps in a material operation so several channels do not require repeated discovery and refresh. |
| [`save_material_config`](../server/tools/texture.ts#L360) · stable | Keep + clarify effects; Source | Persisting material settings should report what was saved and where/state scope. Keep explicit permission/path behavior and avoid embedding unrelated image content. |
| [`activate_texture`](../server/tools/texture.ts#L372) · stable | Keep; Source | Useful explicit state selection; preserve its idempotent semantics. Use SDK ToolAnnotations typing, which the current narrower ToolSpec does not fully represent. |

### UI Interaction (4)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`trigger_action`](../server/tools/ui.ts#L90) · stable | Keep as fallback; Source | Broad native action access fills gaps but depends on editor mode/selection/dialog state. Add action discovery/availability and report resulting state; do not generically wrap actions in another Undo edit. |
| [`risky_eval`](../server/tools/ui.ts#L101) · stable | Keep as explicit escape hatch; Live | Used for bounded inspection and scratch-test preservation. Regex exclusions are not isolation and reject valid strings/comments too. Prefer typed batches; document plugin privileges, async state hazards and lack of a hard synchronous timeout. |
| [`emulate_clicks`](../server/tools/ui.ts#L113) · experimental | Remain experimental fallback; Source | Synthetic UI events and drag state are sensitive to layout and native behavior. Use only when no native tool exists; return useful failure context and make screenshots intentional. |
| [`fill_dialog`](../server/tools/ui.ts#L124) · stable | Keep as fallback; Source | Useful for native workflows exposing only dialogs. Validate field IDs/types against the open dialog, preserve native form behavior and return enough state to avoid blind follow-up. |

### UV Mapping (3)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`set_mesh_uv`](../server/tools/uv.ts#L61) · stable | Keep + batch; Source | Preserve face/vertex keyed native UV semantics. Accept multiple faces in one operation, validate all keys before Undo and update UV preview once. |
| [`auto_uv_mesh`](../server/tools/uv.ts#L71) · stable | Keep + optimize carefully; Source | Retain the verified native unwrap integration. Scope temporary mesh selection once where safe rather than per face; protect selection restoration and Undo. |
| [`rotate_mesh_uv`](../server/tools/uv.ts#L81) · stable | Keep + batch; Source | Keep native rotation semantics and actual face targeting. Coalesce multiple UV edits into one transaction and avoid repeated preview work. |

### Hytale Integration (12)

| Tool / current status | Decision / evidence | Specific assessment |
| --- | --- | --- |
| [`hytale_get_format_info`](../server/tools/hytale.ts#L126) · experimental | Keep behind capability gate; Source only; optional plugin absent | Useful native integration discovery. Pin supported plugin/format versions, report actual capability availability and avoid hard-coded claims drifting from the plugin. |
| [`hytale_validate_model`](../server/tools/hytale.ts#L137) · experimental | Keep + verify; Source only; optional plugin absent | Provide authoritative format validation with stable rule IDs and explicit freshness; compare custom node/count rules with a pinned Hytale plugin before claiming equivalence. |
| [`hytale_set_cube_properties`](../server/tools/hytale.ts#L148) · experimental | Keep + batch/verify; Source only; optional plugin absent | Batch shading/double-sided properties with native format checks, complete Undo and UUID results. Verify saved/exported properties against the actual plugin. |
| [`hytale_get_cube_properties`](../server/tools/hytale.ts#L159) · experimental | Keep + verify; Source only; optional plugin absent | Useful compact read; enforce real format availability and return actual native defaults with cube identity. |
| [`hytale_create_quad`](../server/tools/hytale.ts#L169) · experimental | Keep + batch/verify; Source only; optional plugin absent | Useful format-specific creation. Verify quad face/orientation/UV conventions and export roundtrip, then include in declarative geometry batches. |
| [`hytale_list_attachments`](../server/tools/hytale.ts#L180) · experimental | Keep + bound; Source only; optional plugin absent | Useful compact discovery; prefer it over undocumented collection URIs until resource registration is corrected. Include stable bone/attachment IDs. |
| [`hytale_set_attachment_piece`](../server/tools/hytale.ts#L190) · experimental | Keep + batch/verify; Source only; optional plugin absent | Validate hierarchy and plugin-specific attachment/piece constraints before committing; return actual affected identities and verify native export. |
| [`hytale_list_attachment_pieces`](../server/tools/hytale.ts#L201) · experimental | Keep + bound; Source only; optional plugin absent | Retain explicit attachment-scoped queries; add pagination/field projection for large hierarchies and consistent identity resolution. |
| [`hytale_create_visibility_keyframe`](../server/tools/hytale.ts#L211) · experimental | Keep + batch/verify; Source only; optional plugin absent | Verify the actual native channel and animator contract; integrate with animation batches instead of a round trip per visibility keyframe. |
| [`hytale_set_animation_loop`](../server/tools/hytale.ts#L222) · experimental | Keep + verify; Source only; optional plugin absent | Useful focused property edit; confirm plugin loop serialization and Undo, return animation UUID and applied value. |
| [`hytale_set_cube_stretch`](../server/tools/hytale.ts#L233) · experimental | Keep + batch/verify; Source only; optional plugin absent | Preserve distinction between native stretch and geometric resizing. Verify UV/export behavior and include in cube-property batches. |
| [`hytale_get_cube_stretch`](../server/tools/hytale.ts#L244) · experimental | Keep + verify; Source only; optional plugin absent | Useful targeted read; return cube UUID and native values without redundant full cube serialization. |

## Resources (16 definitions)

Four entries are explicit collection registrations; templates can expand into hundreds of live instances. Counts are definitions, not the number of model objects. Shared implementations: [core](../server/resources.ts), [validator](../server/resources/validator.ts), [Hytale](../server/resources/hytale.ts), [URI helper](../lib/resourceUri.ts).

| Definition / URI | Evidence | Assessment |
| --- | --- | --- |
| `projects-collection` · `projects://` | Live | Keep compact project summaries; 8,469 B for 19 projects. Add paging if needed. Explicit project selection/loading tools would reduce eval use. |
| `textures-collection` · `textures://` | Live | Source data URLs are included; 21,100 B versus 186 B for list_textures. Add a metadata-only collection and keep pixel/image reads explicit; preserve legacy shape until migrated. |
| `reference_models-collection` · `reference_models://` | Source; plugin absent | Keep optional registration. Check enabled/usable state as well as installed identity and bound potentially large model lists; verify against the plugin when available. |
| `validator-checks-collection` · `validator://checks` | Live | Keep discoverable check summaries; 2,264 B sample. Separate rule definitions from cached results and report validation freshness. |
| `projects` · `projects://{id}` | Source | Useful whitelisted summary. Preserve UUID/name/slug compatibility; introduce project-scoped revision metadata and unique lookup semantics. |
| `nodes` · `nodes://{id}` | Live | Highest priority result redesign: one read returned 17,759,807 B because parent/children rendering objects are serialized. Add a compact editor DTO with explicit child IDs and bounded expansion. Index collision slugs once when listing. |
| `textures` · `textures://{id}` | Source | Preserve explicit metadata/image access but separate source bitmap bytes from ordinary property inspection. Add content references and project scope in a new contract. |
| `reference_models` · `reference_models://{id}` | Source; plugin absent | Keep optional targeted inspection; whitelist metadata and make full geometry opt-in. Validate actual provider methods and unavailable/disabled plugin behavior. |
| `validator-status` · `validator://status` | Live | Compact 503 B sample. This reads cached native validation state rather than running validation; add timestamp/project revision and an explicit validate operation. |
| `validator-checks` · `validator://checks/{id}` | Source | Keep direct rule inspection. Stable rule IDs should be authoritative; return associated result counts without duplicating full error lists. |
| `validator-warnings` · `validator://warnings` | Live | 216 B empty/small sample; payload can grow through repeated grouped copies. Add limit/filter and normalized references; English message regex matching is not a reliable identity source. |
| `validator-errors` · `validator://errors` | Live | 210 B empty/small sample. Apply the same bounded normalized result model and freshness tracking as warnings; expose links to precise elements/rules. |
| `hytale-format` · `hytale://format` | Source; plugin absent | Keep a compact capability resource, but derive supported features and limits from a pinned native plugin adapter. Align with the format-info tool. |
| `hytale-attachments` · `hytale://attachments/{id}` | Source; plugin absent | Collection branch exists in the reader, but no collectionUri registers the plain collection URL advertised by prompts. Register a compatible collection explicitly; bound hierarchy reads. |
| `hytale-pieces` · `hytale://pieces/{id}` | Source; plugin absent | Same missing plain collection registration as attachments. Add project/attachment scope and stable UUID results; validate actual native piece relationships. |
| `hytale-cubes` · `hytale://cubes/{id}` | Source; plugin absent | Keep format-specific cube reads compact. A reader collection branch is not itself a registered collection; explicitly register any intended collection URI and document it consistently. |

## Registered prompts (6)

Prompt text is optional client context, not enforced execution policy. Registration: [core](../server/prompts.ts), [Hytale](../server/prompts/hytale.ts). Bundled text comes from the prompt loader/manifest; Hytale generators can add further content.

| Prompt | Evidence | Assessment |
| --- | --- | --- |
| `blockbench_native_apis` | Live + Source | 7,586 text bytes. Keep a short native-module reference pinned to supported Blockbench versions. Correct unsupported module advice and make permission examples consistent with real requireNativeModule behavior. |
| `blockbench_code_eval_safety` | Live + Source | 6,580 text bytes overlapping native guidance. Replace repeated tutorials with a concise eval contract and links/targeted examples. Examples must pass the actual eval validation; do not describe regex checks as a sandbox. |
| `model_creation_strategy` | Live + Source | No arguments produced empty text. Provide a useful compact default: project info, capabilities, scoped inspection, declarative/batched native edits, one preview, validation and export. Return a relevant format addendum when supplied. |
| `hytale_model_creation` | Source; plugin absent | Bundled workflow says create a bedrock project although Hytale tools require Hytale format. Align supported formats, texture guidance and creation examples with a pinned Hytale adapter before enabling the recommendation. |
| `hytale_animation_workflow` | Source; plugin absent | Generated/bundled instructions must match keyframe channels, interpolation enums and actual plugin loop/visibility serialization. Current smooth interpolation advice conflicts with the exposed enum; exercise examples before promotion. |
| `hytale_attachments` | Source; plugin absent | References plain attachment/piece resource collections that are not registered. Correct resource links and validate attachment/piece hierarchy and export workflows against the real plugin. |

## Bundled prompt fragments (11 files)

These are not eleven separate MCP prompts. Inspect the generated manifest only as a build artifact; edit Markdown sources and regenerate it when implementing changes.

| Fragment | Assessment |
| --- | --- |
| [`blockbench_native_apis.md`](../prompts/blockbench_native_apis.md) | Used by the native-API prompt; condense and correct module availability. Preserve actual permission boundaries. |
| [`blockbench_code_eval_safety.md`](../prompts/blockbench_code_eval_safety.md) | Used by the eval prompt; remove contradictory examples and distinguish execution privileges from syntax restrictions. |
| [`java_block.md`](../prompts/java_block.md) | Used by the strategy format addendum. Pin constraints to the native format/game version; use capabilities and native validation instead of universal hard-coded rules. |
| [`bedrock_block.md`](../prompts/bedrock_block.md) | Selected for format bedrock, but wording mixes Bedrock block/entity concepts. Make the supported target explicit and align codec/format constraints. |
| [`model_creation_ui.md`](../prompts/model_creation_ui.md) | Used for the UI approach. Prefer compact project info and batch/native tools first; keep UI actions as a concrete fallback when required. |
| [`model_creation_programmatic.md`](../prompts/model_creation_programmatic.md) | Used for the programmatic approach. Currently emphasizes eval and console inspection despite eval restrictions. Teach existing cube/import batches and complete typed operations first. |
| [`model_creation_import.md`](../prompts/model_creation_import.md) | Used for import; too brief to convey bounded inputs, returned project identity, validation and export/reopen. Supply one executable current-schema example. |
| [`model_creation_geometry.md`](../prompts/model_creation_geometry.md) | Bundled but not selected by the registered strategy. Either wire it into a supported approach or remove the dead fragment through the normal bundled-prompt version process. |
| [`hytale_model_creation.md`](../prompts/hytale_model_creation.md) | Loaded by the Hytale generator. Correct the bedrock creation step and verify texture-size versus pixel-density guidance; maintain one authoritative workflow. |
| [`hytale_animation_workflow.md`](../prompts/hytale_animation_workflow.md) | Loaded by the Hytale generator. Align interpolation/channel examples with schemas and pin integration version before advertising reliability. |
| [`hytale_attachments.md`](../prompts/hytale_attachments.md) | Loaded by the Hytale generator. Use registered resource URIs and actual native hierarchy/attachment operations, without duplicating inconsistent instructions. |

## Coverage and implementation boundary

The inventory was checked against every name in the generated API document and every prompt Markdown filename. A reviewed entry is not automatically a validated integration: only the marked live cases were exercised. The report recommends retaining most native implementations, adding shared contracts and improving a small number of unsuitable interfaces. It does not authorize deleting legacy tools or silently changing their outputs. No plugin behavior was edited for this audit.
