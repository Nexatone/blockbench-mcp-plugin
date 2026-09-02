# Repository bug review — 2026-09-02

Reviewed commit `6b069e308fdfc9b0a1c15bc924ca78150815f143` plus the original
texture-dimensions fix. The branch is now `codex-bug-review`; the former
`codex/texture-dimensions` name was removed by renaming the branch. The changes
are published as one independent import on top of this repository's initial
commit, without upstream commit ancestry or an upstream remote. The plugin
byline is Josshy, with the original license and contributor credits retained.

All 20 numbered findings below now have implementations on this branch.
They are no longer an implementation backlog. The status table separates tests
that passed from compatibility checks that still need another environment.
“Live” means reproduced in Blockbench 5.1.6 through the local MCP endpoint.
“Source” means established from the checked-out implementation and relevant API
source, without executing that failure path in the editor. This is a repository
review, not a claim that every possible input or optional plugin was tested.

## Implemented fixes and evidence

| Item | Implementation | Verification |
| --- | --- | --- |
| 1 | Bind only to loopback; validate Host/Origin before routing; reject malformed/oversized framing. | Real TCP/SDK tests, including IPv6, rejected pipelines and repeated Accept headers. |
| 2 | Include created geometry in final Undo aspects; capture descendants and animators before removal. | Live cube creation/removal and mesh duplication Undo/Redo. Hytale is source-reviewed only. |
| 3 | Use axis-keyed values and `addKeyframe`; target animations independently of UI selection; preserve zero values. | Unit values tests and live nonselected-animation create/edit/Undo/Redo. |
| 4 | Await codec compilation; preserve typed-array offsets and byte counts. | Sync/async/binary/error unit cases and live glTF 2.0 export. |
| 5 | Use native duplication, preserving faces/UVs/materials and applying offsets once. | Live cube face equality and mesh face count, Undo/Redo. |
| 6 | Scope native UV operations to the requested mesh; implement explicit extrude/subdivide/delete geometry operations. | Live A-selected/B-requested isolation; cuts, extrusion distance and Undo. |
| 7 | Require finite positive bake intervals and ordered ranges; cap output at 5,000 keys before mutation. | Unit rejection/count tests and live invalid-input rejection and five-key bake. |
| 8 | Execute through full-schema validation; forward annotations through both registrations. | Real SDK `tools/call`/`tools/list`, nested defaults and cross-field rejection. |
| 9 | Install validated component selection after native mesh selection; implement selection composition. | Live never-selected mesh component persistence and subsequent operations. |
| 10 | Normalize brush alpha, interpolate strokes, apply softness/blending and restore painter state. | Live midpoint RGBA, alpha 0/128/255, multiply blending and Undo/Redo. |
| 11 | Use global Setting APIs without local shadowing; validate before changing and persist. | Live paint-side setting update and restoration. |
| 12 | Implement binary mask shapes/composition, invert and bounded expand/contract. | Unit mask pixels beyond 16x16 and live rectangle/invert/select-all. Feather explicitly rejects unsupported soft masks. |
| 13 | Use percent opacity and native layer copy/flatten semantics with bitmap Undo. | Live composited PNG equality, opacity, duplicate, flatten and Undo. |
| 14 | Edit vector handle components for the requested axis with relative curve coordinates. | Live axis preservation and `.bbmodel` handle save/reopen. |
| 15 | Permit omitted textures; reject explicit missing IDs before edits; apply texture on custom UV faces. | Live fresh-project cube and custom textured face; primitive paths source-reviewed. |
| 16 | Handle zero-length sphere vectors and clamp acos input. | Live finite UV values at the origin. |
| 17 | Register explicit collection URIs alongside item templates and document them. | SDK collection/item reads; live projects, textures and validator collections. Optional Reference Models remains untested. |
| 18 | Resolve explicit project IDs exactly and restore the original active tab. | Live captures in both tab orders with original project preservation. |
| 19 | Enforce one texture per material channel; snapshot displaced textures and newly created groups. | Live cross-material replacement, Undo/Redo and compiled texture-set save/reopen. |
| 20 | Route the test dialog through the shared validation/default wrapper, including a default progress context. | Shared UI entry-point tests and actual SDK calls. No automated dialog-click test. |

The original evidence below records behavior **before these implementations**;
line numbers refer to that reviewed snapshot. “Needed” describes the original
acceptance criteria, not an open task list. Limits and remaining checks follow
the findings.

## Coverage and API research

The sweep covered the plugin entry/lifecycle, all 16 tool modules, registration
factories and schemas, transport/session management, resource and prompt modules,
lookup/serialization helpers, Hytale integration, UI dialogs/settings/styles,
build scripts, documentation manifest, package/TypeScript configuration, contribution
instructions, prompt assets, and deployment workflow. Generated documentation was
checked against its manifest rather than treated as separate implementation code.

The official Blockbench **v5.1.6** source was downloaded into ignored
`dist/bug-review/blockbench-5.1.6/` to match the installed editor. Important API
references were checked against actual source, because the installed
`blockbench-types` declarations do not describe every runtime method:

- [Plugin lifecycle and local loading](https://blockbench.net/wiki/docs/plugin/)
  and [the v5.1.6 plugin loader](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/plugin_loader.ts).
- [Undo aspects and newly created elements](https://blockbench.net/wiki/docs/undo/)
  and [UndoSystem implementation](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/undo.js).
- [Texture canvas/loading](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/textures.js),
  [painting/IntMatrix](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/painter.js),
  and [texture layers](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/layers.js).
- [Keyframes](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/animations/keyframe.js),
  [timeline animators](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/animations/timeline_animators.js),
  [Bedrock animation loading](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/formats/bedrock/bedrock_animation.js),
  and [UV operations](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/uv/uv.js).
- [glTF codec](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/formats/standards/gltf.js),
  [armature weights](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/outliner/types/armature_bone.ts),
  [Hytale plugin documentation/source repository](https://github.com/JannisX11/hytale-blockbench-plugin),
  and [Blockbench reference documentation](https://web.blockbench.net/docs/index.html).
- [MCP HTTP transport/session requirements](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports),
  the installed MCP SDK's `webStandardStreamableHttp.js`, and
  [Node TCP server lifecycle](https://nodejs.org/api/net.html).

## Implemented connection fixes

1. **Release disconnected SSE streams.** The socket's close event previously
   cleared only its input buffer. The response reader remained pending, its
   heartbeat timer remained allocated, and the SDK retained the session's SSE
   slot. A replacement GET consequently returned **409 Conflict**. Socket close
   now cancels the reader; stream completion clears its timer and releases its
   lock. The session survives a stream disconnect so the client can reconnect.
2. **Preserve HTTP response order.** Each TCP `data` event previously started an
   independent asynchronous parser. A second request could overtake a slow tool
   request on the same connection. A per-socket processing guard now drains
   buffered requests in order. Separate sockets remain independent, including
   POST requests while a standalone SSE GET is open.
3. **Close accepted connections on unload.** `net.Server.close()` stops listening
   but does not terminate existing clients. The adapter now tracks accepted
   sockets and exposes `closeAllConnections()`; plugin unload calls it before
   closing the listener. This prevents old connections retaining the unloaded
   server implementation across reloads. SSE responses also correctly advertise
   `Connection: close`, matching their existing close-delimited HTTP body.

Implementation: `server/net.ts` and `index.ts`. Tests: `server/net.test.ts`, using
real loopback TCP sockets and the actual MCP SDK, not a mocked transport.

Initial focused run: **1 passed, 3 failed** (SSE reconnect, response ordering,
shutdown). At the original connection-only stage: **22 passed, 0 failed** — eight connection cases and
fourteen texture cases. Connection cases also cover concurrent initialization,
unknown/deleted/expired sessions, fresh initialization after expiry, heartbeat
delivery, and clients that cannot answer server pings because they have no SSE
stream.

The combined patched dev build was loaded and identified in **Blockbench 5.1.6**.
Live checks passed 20 disconnect/reconnect cycles on the same session, POST ping
while SSE stayed open, and actual heartbeat delivery. Disconnect processing was
observed before each reconnect; an immediate reconnect can still race a close
event, so clients should back off on a transient conflict. Reload with an open
SSE connection and an idle TCP socket closed both, restarted the listener, exposed
94 tools to a fresh session, and rejected the previous session ID. The original
project, undo history and saved state remained unchanged. The local record is
`dist/bug-review/live-connections.json`.

## Original findings, now addressed above

### 1. P1 — The local server is exposed on all interfaces without origin validation

**Live + source:** `server/net.ts`, `createNetServer()` and transport construction.
The `host` option is declared but never used; `listen(port)` listens on all
interfaces. `netstat` confirmed both `0.0.0.0:3000` and `[::]:3000`. A local test
request with `Host: untrusted.invalid:3000` and
`Origin: https://untrusted.invalid` received HTTP 200, a session, and a tool list
including `risky_eval`. No authentication was required. This establishes missing
server-side checks; external reachability still depends on the machine's firewall.

**Needed:** bind explicitly to loopback by default, honor/document any deliberate
remote binding, validate Host/Origin (including MCP Inspector's allowed local
origin), and design authentication before offering remote access. Test absent,
allowed, and rejected origins, IPv4/IPv6, and remote-binding configuration. The
installed SDK's DNS-rebinding protection defaults to false. This remains open;
the stability patch does not silently change client access policy.

### 2. P1 — Geometry undo does not capture created or removed elements

**Live + source:** `server/tools/cubes.ts:130`, `element.ts:325` and `:520`;
related creation/removal patterns occur in `mesh.ts`, `armature.ts`, and
`hytale.ts`. Empty `elements: []` is never populated for newly created geometry;
removal starts with an empty before-snapshot.

**Reproduction:** create a texture, `place_cube` with
`{"elements":[{"name":"created_cube"}]}`, then `undo`. The cube remained and the
outliner contained duplicate references. Removing a distinct cube and undoing
did not restore it.

**Needed:** retain created elements in the aspects array or supply them to
`finishEdit`; capture removed elements and affected descendants before removal.
Use one transaction owner when calling APIs that already create their own undo
edit. Test create/delete/duplicate → undo → redo → save/reopen, comparing the
element registry and outliner separately. The texture creation fix already uses
the correct post-edit texture snapshot.

### 3. P1 — Keyframe tools report success without applying requested values

**Live + source:** `server/tools/animation.ts:420`, `:463`, `:912`, `:951`.
`manage_keyframes` creates with `{values: [...]}` and edits with
`keyframe.set("values", ...)`. Blockbench's transform values are `x`, `y`, `z`
data-point fields. A requested `[4,5,6]` position became `[0,0,0]`; editing it to
`[7,8,9]` still returned `[0,0,0]` from `getArray()`, with an unused `values` field.

**Needed:** translate vectors/scalar scale into axis data, use `set(axis, value)`
or valid `data_points`, and apply the same conversion to batch/copy-paste paths.
Test numeric zero, expressions where supported, uniform/nonuniform scale,
exports, and undo. Separately, `create_animation` imports without creating an
undo entry and leaves the new animation unselected; follow-up tools cannot assume
it is selected. Explicit animation IDs must work independently of UI selection.

### 4. P1 — Async export codecs serialize a Promise instead of the model

**Live + source:** `server/tools/export.ts:204`. `codec.compile()` is not awaited.
`export_model` with `{"codec_id":"gltf","options":{"animations":false}}`
returned `content: "{}"`, `byte_length: 2`. Awaiting the real glTF codec produced
valid glTF with an `asset.version` of `2.0`.

**Needed:** await compile before classifying binary/text output and before any
filesystem write. Test synchronous project/OBJ and asynchronous glTF text/binary
codecs, failure propagation, byte lengths, and importability of saved output.

### 5. P1 — Duplication loses cube faces and partially creates broken meshes

**Live + source:** `server/tools/element.ts:451–512`. The cube clone omits face
properties. A source north face with UV `[2,3,6,7]`, rotation 90, tint 2 and a
texture became default UV `[0,0,1,1]`, rotation 0, tint -1 and no texture.
Mesh faces are a keyed object, so `mesh.faces.forEach` throws after a new mesh
has already been inserted. The live result left a three-vertex, zero-face copy.

**Needed:** use native duplication/save-copy APIs with correct undo ownership.
Preserve UV/face/material properties and rekey mesh UVs if generating vertex IDs.
Apply offsets once in the correct coordinate space; the current mesh code adds
the offset to both its origin and local vertices. Validate before mutation and
roll back a partially failed duplication.

### 6. P1 — UV tools can modify a different mesh from the requested target

**Live + source:** `server/tools/uv.ts:130–223`; analogous selection-dependent
action calls in `mesh.ts`. `getMeshOrSelected(id)` resolves but does not select
the mesh. `UVEditor.rotate` operates on `Mesh.selected`.

**Reproduction:** select mesh A with selected faces, call `rotate_mesh_uv` using
mesh B's UUID and face key. A's UVs changed, B's did not, while the response named
B. The outer undo snapshot captured B. `auto_uv_mesh` project/unwrap paths also
use global editor selection. Extrude/subdivide/delete action wrappers need the
same audit, including whether their extra `.click()` arguments are meaningful.

**Needed:** directly operate on resolved geometry where practical, or temporarily
set and restore all relevant selections around the native action. Snapshot the
actual affected mesh. Test A selected/B requested and multiple selected meshes.

### 7. P1 — Negative bake intervals can freeze the editor

**Source; deliberately not executed:** `server/tools/animation.ts:198` and
`:963–996`. The schema accepts a negative `bake_interval`. With two keyframes,
`for (time = start; time <= end; time += interval)` never reaches the end when
the interval is negative. Very small positive intervals can also allocate an
unbounded number of keys synchronously.

**Needed:** require a finite positive interval, validate range/order, precompute
and cap output key count, and yield/cancel long work. Test rejection before
`Undo.initEdit`; never reproduce the infinite loop in a user's editor.

### 8. P2 — Schema refinements and MCP annotations are dropped during registration

**Live + source:** `lib/factories.ts:101–111`, `:148–195`, `:260–270`.
`extractShape` unwraps object-level `ZodEffects`; callbacks execute without
parsing the full original schema. `create_texture` accepted a fill without the
schema-required `layer_name`. Field-level validation still works. All **94**
tools exposed by the installed non-Hytale runtime lacked MCP annotations,
despite source definitions containing read-only/destructive/open-world hints.

**Needed:** retain the full schema and validate through one execution wrapper
used by both server-registration paths and the UI. Forward annotations in both
paths. Test actual `tools/call` and `tools/list`, not only `.parse()` in unit tests.

### 9. P2 — Selecting mesh components can update a discarded object

**Live + source:** `server/tools/mesh.ts:555`. When no entry exists in
`Project.mesh_selection`, the fallback `{vertices,edges,faces}` is never assigned
back. The tool reported two selected vertices, but the project's mesh-selection
entry remained absent and subsequent operations had no component selection.

**Needed:** initialize selection using Blockbench's component-selection API or
store the entry before mutation. Test a never-selected mesh, add/remove/toggle,
and a subsequent vertex move that uses the selection.

### 10. P2 — Brush opacity and connected strokes do not match the request

**Live + source:** `server/tools/paint.ts:843–890`. The pixel callback supplies
alpha on a 0–255 scale, while `Painter.editSquare/editCircle` expects 0–1 and
multiplies by 255. Painting with opacity 128 produced fully opaque pixels.
`connect_strokes: true` painted only the two endpoints; the midpoint stayed
transparent. The callback also ignores the brush falloff argument and requested
blend mode.

**Needed:** normalize alpha, blend with existing pixels and falloff, and implement
stroke interpolation through supported painting APIs. Verify actual RGBA pixels
for alpha 0/128/255, soft edges, midpoint coverage and blend modes; restore any
temporary tool settings. A type error about a Painter method alone is not proof
that the method is absent: several such methods exist in v5.1.6 source.

### 11. P2 — Several paint settings cannot be updated

**Live + source:** `server/tools/paint.ts:731–817`. A local `settings: string[]`
shadows Blockbench's global settings registry. `paint_settings` with
`{"paint_side_restrict":true}` throws “Cannot set properties of undefined”.
The stylus and color-picking setting branches have the same problem.

**Needed:** rename the response-message array, use the real Setting APIs and
persist changes as appropriate. Validate all requested settings before changing
any of them so a later failure does not leave a partially applied configuration.

### 12. P2 — Texture selection actions use an incompatible API

**Live + source:** `server/tools/paint.ts:978–1067`. `IntMatrix.is_custom` is a
getter; coordinates written as `start_x/end_x` do not define its mask. In the
loaded bundle `select_all` reported success but `hasSelection()` remained false.
`invert_selection` threw because `invert()` does not exist; expand/contract/
feather also call absent methods. The action's `mode` parameter is unused.

**Needed:** use `setOverride(true/false/null)` and real mask pixels; implement only
supported selection operations and composition modes. Inspect masks, not return
strings. Define feathering deliberately because IntMatrix is an integer mask.

### 13. P2 — Layer operations have wrong opacity units and absent methods

**Live + source:** `server/tools/paint.ts:1129`, `:1149`, `:1195`. Opacity 50 is
stored as **0.5**, although TextureLayer uses percentages. Duplicate and flatten
throw `duplicate is not a function` and `flattenLayers is not a function`.

**Needed:** store percent opacity directly and follow the native layer actions
for cloning/flattening. Preserve layer bitmap/order/blend state and use one undo
transaction. Verify composited pixels as well as serialized layer metadata.

### 14. P2 — Bezier editing corrupts handle types and ignores the requested axis

**Live + source:** `server/tools/animation.ts:431–480`, `:571–601`.
Blockbench declares left/right handle times as three-component vectors. The
plugin writes scalars. After `ease_in` for axis X, the first key had scalar
handles `0` and `0.6`, while another key still had vector handles. `axis` does not
scope these writes.

**Needed:** update the requested components of the time/value vectors, preserve
other axes, and use valid relative handle coordinates. Verify interpolation at
intermediate times and save/reopen rather than checking only the assigned values.

### 15. P2 — Primitive creation unexpectedly requires an existing texture

**Live for cubes; source for other primitives:** `server/tools/cubes.ts:136–142`
and corresponding mesh/sphere/cylinder creation paths. A fresh-project
`place_cube` request without a texture fails with `No texture found for
"undefined"`, although its tool description says texture is optional.

**Needed:** permit untextured geometry when omitted; reject an explicitly named
missing texture. Custom cube UV faces should also receive the requested texture,
which their current branch omits. Test with no texture, explicit texture, custom
UVs and `faces: false`.

### 16. P2 — Spherical UV mapping produces NaN at the origin

**Live + source:** `server/tools/uv.ts:168–176`. A vertex at `[0,0,0]` divides by
zero in `acos(vertex[1] / length)`. Its V coordinate became NaN, serialized as
`null`, while the tool reported successful mapping.

**Needed:** define a finite UV for the zero-length case, clamp acos input against
roundoff, and validate all generated UVs before committing the edit.

### 17. P2 — Documented collection resource reads are unreachable

**Live + source:** `server/resources.ts` and `server/resources/validator.ts`.
The callbacks support a missing ID, but templates require one. Reads of
`projects://`, `validator://checks`, and `validator://checks/` all returned
“Resource … not found”. Individual resource-list entries still work.

**Needed:** explicitly register stable collection URIs in addition to item
templates, and align generated documentation with actual reachable URIs. Test
list → read for each family, collection reads, Unicode names and collisions.

### 18. P2 — Explicit screenshot project IDs can resolve to the active project

**Source:** `lib/util.ts:290–292`. The `.find()` condition combines requested
name/UUID with `p.selected`. An earlier active project wins over a later exact
match. Capturing an explicit other project also leaves it active.

**Needed:** resolve explicit IDs without a selected-project fallback; handle an
unknown ID as an error. Restore the original active project after capture. Test
two projects in both tab orders without closing either.

### 19. P2 — Material channel changes do not consistently replace or undo textures

**Source:** `server/tools/texture.ts`, `add_texture_group`, `create_pbr_material`,
`configure_material`, `assign_texture_channel`. New groups are not included in
post-edit undo aspects. Reassigning a channel can reset the previous texture to
`color` without removing it from the group, creating duplicate color candidates;
the previous texture is also omitted from the undo snapshot in the assign path.

**Needed:** choose an explicit one-texture-per-channel replacement policy,
capture every affected texture/group, and enroll new groups in the post-snapshot.
Test replacement from another material, compiled texture-set JSON and undo/redo.

### 20. P2 — The tool-test dialog bypasses validation and defaults

**Source:** `ui/toolTestDialog.ts:330`. It calls the raw execute function. Parsed
form text is not equivalent to Zod validation: empty optional/default fields can
arrive as missing values, nested defaults are not applied, and invalid values
reach handlers that assume validated input.

**Needed:** share the validated execution wrapper from finding 8 with the UI;
display validation issues before model mutation. Test a nested default and a
cross-field rejection through both UI and MCP paths.

## Additional improvements and remaining limits

- **HTTP/session stability — implemented:** 16 KiB header and 16 MiB body limits,
  strict framing (chunked requests explicitly rejected), SSE backpressure,
  active-request session pinning, nonoverlapping pings, and timer reconfiguration.
  Pongs extend liveness; `lastActivity` still records actual requests. Failed
  pings remain diagnostic and never independently evict a client without SSE.
  A hung tool can still hold its session; general safe cancellation is not added.
- **Network boundary — intentional compatibility change:** only loopback hosts
  are supported. Host must match the listener's local authority; Origin, when
  present, must match that authority or the MCP Inspector loopback origin on
  port 6274. No-Origin native clients work. Remote binding, reverse proxies and
  direct-browser CORS are not supported. Inspector's native proxy is supported.
- **Startup/lifecycle — implemented:** prompt fetching no longer delays startup;
  listen failure removes the normal server panel. Settings explain reload is
  required. CSS, session subscriptions and open tool/prompt dialogs are disposed
  on unload. Repeated live plugin reloads pass network lifecycle checks; style
  counts and every UI listener were not instrumented.
- **Imports — implemented:** `from_geo_json` accepts whitespace-prefixed inline
  JSON, local paths/file URLs, JSON data URLs and bounded HTTP(S) downloads. It
  parses input first, creates a separate project, and closes a failed import.
  One geometry per request is required; split multi-geometry files first.
  Unit cases cover input forms and limits; live populated-project isolation passes.
- **Texture contracts — implemented:** image decoding completes before response
  and layer creation. Integer dimensions, RGBA tuple alpha, rendering options and
  named base layers are honored. New layered textures capture bitmap Undo data.
  Blank dimensions, actual pixels, imports, Undo/Redo and saved layers are checked.
- **Mesh merging — implemented:** deduplicate remapped vertex IDs, preserve UVs
  for surviving vertices and remove collapsed polygon faces. Broader arbitrary
  nonmanifold topology repair is not part of this patch.
- **Input emulation — implemented:** hit-test the requested coordinates; dispatch
  bubbling pointer/mouse events with correct button numbers and drag movement.
  These are synthetic DOM events, not trusted OS input. Source-reviewed; no claim
  that every editor widget accepts synthetic events.
- **Offline prompts — implemented:** embed the generated manifest, use it on
  first/offline startup, validate caches and reject mismatched CDN versions.
  Development builds use bundled local prompts; production uses matching cache,
  then this repository's versioned CDN, then the bundle. Cache keys are separate
  from the upstream installation; user overrides are retained and have highest priority. A separate
  provenance UI remains a possible enhancement. Re-run `bun run dev` after prompt
  edits so the manifest is regenerated.
- **Build/CI — implemented:** frozen-lockfile install and test gate; fork-aware
  preview URLs; discoverable sourcemap adjusted for the prepended banner; watch
  rebuilds preserve existing `dist` files. No deployment was run. The existing
  TypeScript baseline needs further cleanup before a passing CI typecheck gate.
- **Optional integrations — verification remains:** Hytale and Reference Models
  are registered according to plugin availability at load. Reload MCP after
  enabling/disabling either. Their full lifecycle/format behavior requires those
  plugins installed. Armature-specific removal is source-reviewed, not live-proven.
- **Longer-term work:** multi-hour connection soak, sleep/resume, slow-reader
  stress, third-party client/proxy compatibility, exhaustive bezier interpolation
  and soft-brush tests, validator references independent of English messages,
  and explicit bounded schemas for large scene resource serialization.

## Verification and local loading

```sh
bun install --frozen-lockfile
bun run test
bun run typecheck
bun run dev
bun run docs:build
```

The final automated suite has **41 passing tests, zero failures**.
Frozen install, development build, production build and generated docs pass.
Type checking reports **107 existing diagnostics**, reduced from 161; comparing
file/message pairs while ignoring shifted line numbers found no new diagnostics.
Lint is not configured. One earlier package-runner invocation stalled; the final
normal `bun run dev` and `bun run build` commands both completed successfully.

Load `dist/mcp.js` in Blockbench via **File → Plugins → Load Plugin from File**.
After rebuilding, reload the local MCP plugin and reconnect clients. Plugin
version stays **1.6.1**; confirm the local file path, a new plugin lifecycle
function instance after reload, and the validated execution wrapper, not version
alone. `bun run build` creates a minified artifact at the same path; the final
artifact left locally is a development build with `dist/mcp.js.map`.

With that development plugin loaded on `127.0.0.1:3000/bb-mcp`, run:

```sh
bun run test:live
bun tests/live/connections.mjs
```

The live scripts use the development-only `risky_eval` tool for state assertions.
They create disposable projects, compare the original project's model/undo/saved
state and restore its tab. Do not run simultaneous edits or another live suite.
Reports are written under ignored `.verification/`. The connection report records
local build SHA-256, plugin path and reload provenance.

Live Blockbench **5.1.6** passes seven scenario groups: geometry, mesh editing,
nonselected animation editing, painting/layers, PBR materials, imports, and
exports/resources/screenshots. Checks include native `.bbmodel` save/reopen for
texture pixels/layers, animation handle vectors and material texture-set output.
The original open project, compiled model, undo entries/index and saved flag
remain unchanged. See [texture-dimensions.md](texture-dimensions.md) for the
original before/after image reproduction and full pixel matrix.

Connection verification exercises 20 same-session SSE disconnect/reconnects,
POST while SSE remains open, heartbeat delivery, plugin reload with SSE and idle
TCP sockets, stale-session rejection and fresh initialization. Clients should
back off on transient 409 responses while a prior close is still being processed.
No multi-hour soak, sleep/resume, remote-proxy or optional-plugin live success is
claimed. Older source snapshots and baseline evidence remain under ignored
`dist/bug-review/`; current reproducible live scripts are in `tests/live/`.
