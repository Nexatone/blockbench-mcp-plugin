# MCP efficiency implementation and live verification

Implemented 2026-09-03, **1.1.0 → 1.2.0 (Unreleased)**, on the maintained
TypeScript plugin. The [original audit](efficiency-review.md) and
[complete inventory](efficiency-inventory.md) remain historical 1.1.0 evidence.
This report distinguishes implemented work from the audit's longer-term proposals.

The in-process architecture is retained. The measured bottlenecks were model
payloads, resource discovery and multi-call editing, rather than a need for an
entirely different server runtime. No dependencies, license or attribution changed.

## Implemented behavior

| Area | Result |
| --- | --- |
| Discovery | One-pass slug/collision indexing replaces repeated sibling scans; existing URIs and legacy resource payloads are preserved. |
| Compact reads | `query_model` pages elements, textures, animations, mesh vertices/faces and layers. `get_element` returns transforms and bounded child IDs. Two project-scoped `model://` templates return metadata without render graphs or images. |
| Identity and freshness | New reads return project UUID/revision. Cursors bind to project, revision and query. `get_project_capabilities` returns native format flags and exact plugin build identity. `validate_model` waits for native validation and pages its completed snapshot. |
| Complete edits | `apply_model_batch` creates groups, cubes and meshes with faces/UVs, patches elements and removes subtrees. Forward local group references are supported. Targets validate before one native Undo edit and one targeted preview update. Removed root IDs and a total count avoid expanding a large deleted subtree in the response. |
| Retry and concurrency | All tool execution shares an editor queue across clients. New batches support expected revisions and operation IDs with bounded ten-minute retention. Queued project changes and existing Undo edits are rejected. Cancellation is checked before queued work and new commits; request progress is forwarded where supported. |
| Transaction cleanup | An ownership-aware synchronous helper uses `cancelEdit(true)` and clears its own leftover native selection save on failure. Batch geometry, brush painting, batch keyframe operations and layer management use it. |
| Correctness | Multibone/additive selection works; invalid names do not clear selection. Mesh component selection does not dirty the model. Invalid regex and missing parent/format requests fail before mutation. |
| Project workflow | `open_project` opens `.bbmodel` data in an isolated tab; `select_project` selects an existing UUID. Existing Bedrock imports and texture creation add structured identities and an optional preview switch while retaining their image defaults. Layer management accepts an explicit layer UUID/unique name. |
| Other hot paths | Vertex deletion builds a used-vertex set once. Export skips discarded base64 encoding, encodes only the needed prefix, and rejects project switches during asynchronous compilation. |
| Agent guidance | All eleven prompt fragments were revised. The default modeling strategy is useful without arguments. Native module/eval and Hytale examples were corrected. Shared prompt specs drive registration and docs; advertised Hytale collection URIs are registered when available. |
| Development | The instructions setting reaches MCP initialization. Builds generate prompts before bundling, expose a build ID and handle transient Windows output locks. Watch ignores generated/test directories and survives failed rebuilds. API docs include structured result fields. Repository context files describe the actual workflow. |

Seven tools were added. Documentation now contains **113 tools, six prompts and
21 resource definitions**; the installed configuration exposes **101 tools,
nine output schemas and six resource templates**. Twelve Hytale tools remain
conditional. Existing tools remain available.

## Measurements

The final locally tested bundle was **Blockbench 5.1.6 / plugin 1.2.0**, build ID
`c08befe6-9c7f-4b95-8e85-7329284d5701`, loaded from this checkout's `dist/mcp.js`.
The capability response matched `dist/build-info.json`. Unlike the earlier audit,
this verification established the intended local build identity. Sanitized results
are in [efficiency-implementation-measurements.json](efficiency-implementation-measurements.json).

| Observation | Audit baseline | Implemented build |
| --- | ---: | ---: |
| Resource listing, four local samples | 1,289 ms median | **9.22 ms median** (5.89–17.24 ms) |
| Single legacy render-node response / new compact element response | 17,759,807 bytes | **433 bytes** |
| Native and eval reference prompt text combined | 14,166 bytes | **2,226 bytes** |
| Full tool catalogue | 94 tools; 89,239 bytes | 101 tools; **103,285 bytes** |
| Production bundle | 626,969 bytes | **626,275 bytes** |

Resource listing was about **140× faster in this local comparison** on the same
open models. Its response size is still about 134 KB because the legacy catalogue
is preserved. The compact element response is a different, deliberately smaller
representation; it does not contain the legacy rendering graph.

One complete batch containing two groups, one cube, one quad mesh with UVs and
an existing-element patch took **18.76 ms** and created **one Undo entry**. This is
a single observation, not a distribution or a claimed speedup over equivalent
legacy calls. The earlier 8.2× cube batching result remains historical evidence.

The expanded full tool catalogue is larger and its eight-sample listing median
was 11.77 ms. No reduction in full-catalogue tokens is claimed. The new workflow
reduces intermediate lookups and model payloads; actual LLM token/task savings
still require a pinned client/model evaluation. Timings exclude model inference,
and byte counts are not tokenizer measurements. The audit's running 1.1.0 binary
was not proven identical to its checkout; treat before/after as observed local
versions, not an isolated microbenchmark.

## Validation

- Frozen dependency install: passed, no dependency changes.
- Automated suite: **66 passed, zero failed, 424 assertions, 19 files**.
- TypeScript: **67 existing diagnostics**, down from 72. Comparing diagnostic
  file/code/message multisets found **zero new diagnostics**. This is not a passing
  typecheck. The reduced SDK adapter instantiation and corrected types removed
  five baseline errors.
- Production build and generated docs: passed; package, manifest, API docs and
  bundle report 1.2.0. The generated HTML handles nullable result fields.
- Final documentation/context sweep: updated installation guidance, contributor
  examples, root agent context and GitHub instructions/task/issue/PR templates.
  Checked 169 local Markdown links across 28 changed documents, generated version
  consistency and all eleven bundled prompt texts; no broken links or mismatches.
- Watch check: temporary prompt edit reached both manifest and bundle, restoration
  rebuilt correctly, and output settled without a generation loop. The first
  attempt exposed a Windows rename lock and directory events; these were fixed
  before the passing rerun.
- New live suite: **11 scenarios passed**, covering compact resources/output schemas,
  one-step geometry Undo/Redo, duplicate retries, stale revisions/cursors, invalid
  preflight inputs, injected native creation failure rollback, visibility and
  subtree removal, selection fixes, validation freshness, two-client serialization,
  queued project-switch rejection, viewport/save/reopen and texture/layer identities.
- Existing live suites: **seven scenarios each passed** in bug review,
  experimental stability and remaining experiments, on the final loaded build.
  Coverage includes mesh/UV/armature edits, animations/curves, painting and settings,
  materials and texture-set disk operations, dialogs, imports and exports.
- Preservation: **all 19 original projects** passed recorded model, saved-state,
  Undo/history and selection comparisons in the efficiency suite. It closed only
  its own disposable projects and restored the original active project/mode/tool.
  This does not assert equality of every transient UI field.

An early full-suite run hit a transient Windows IPv6 `ENOBUFS` socket error. Its
isolated rerun and the final full run passed; it was not suppressed. The first
live fixture omitted a required camera argument; correcting that test produced
a passing viewport check. Optional Hytale/reference plugins were absent, so their
changed metadata/guidance is source-reviewed, not live-certified.

## Compatibility and limits

New APIs use exact UUIDs or unique exact names and reject ambiguity. Legacy
targeting semantics and raw resource payloads remain unchanged. The compact query
budget is **16 KiB for page items**, not for the complete JSON-RPC result: structured
content plus the older-client text fallback duplicate those items. Child expansion
and query item counts are explicit; one oversized item fails rather than silently
truncating model data.

Revisions track native finished-edit, Undo and Redo events. `risky_eval` invalidates
revisions conservatively even when used to inspect. Third-party code changing data
without native events can evade revision tracking. Revisions, validation snapshots
and retry records are in-memory and reset on reload. A replay returns its original
result even after later edits/Undo; it is not a statement that the model is still
in that state. Use a new operation ID to make a new edit. Caches are bounded to
128 operations / 1 MiB and may evict earlier results under load.

The queue coordinates MCP/UI tool calls; it cannot stop a human or another plugin
from editing during asynchronous work. The changed import/export/texture paths
recheck their project before committing. Cancellation is cooperative and cannot
interrupt synchronous native JavaScript. `risky_eval` retains its explicit
privileged escape-hatch behavior and can bypass normal transaction safeguards.

## Remaining audit proposals

| Follow-up | Why it is separate |
| --- | --- |
| Current MCP protocol/SDK adapter | Requires a compatibility matrix for discovery, requests, caching and subscriptions while retaining existing clients. The current native bridge/SDK remains supported by this change; no unverified wire migration was applied. |
| Smaller fixed tool profile and host tool search | The complete catalogue deliberately remains available. Measure task success, actual tokens and client support before selecting/removing exposed tools. |
| Legacy result/targeting migration | Converting every old string result, changing duplicate-name behavior, or removing raw resource fields can break consumers. New workflow APIs provide an additive path first. |
| Remaining transaction conversions and richer paint/animation batches | Migrate each native path with its own ownership/Undo failure tests; some native actions already own transactions. No claim that every legacy mutation now rolls back every native exception. |
| Mesh spatial merge, animation collision indexes, paint regions and HTTP buffering/backpressure | These were source-level hypotheses, not measured bottlenecks. Require profiles and native output/Undo equivalence before replacing established implementations. |
| Metadata and inspection follow-ups | Legacy resource specs still have some duplication. Compact queries bound output but build their current row set linearly; revision-aware snapshots/indexes and preset discovery remain possible improvements. |
| Optional integrations and type debt | Test Hytale/reference integrations with explicitly installed, pinned plugins. Clear the remaining 67 diagnostics separately without hiding the baseline. |

The practical next evaluation corpus is the audit's mixed modeling tasks: large
hierarchies, duplicate names, complete meshes, layered painting, animation/weights,
concurrent project changes, retries and export/reopen. Measure fidelity and success
before tuning call counts, bytes, tokens or latency.

## Reproduce and load

Use Bun 1.3.8. Run `bun install --frozen-lockfile`, `bun run build`,
`bun run docs:build`, `bun run test` and `bun run typecheck`. Load `dist/mcp.js`
through Blockbench's file-plugin flow, then reconnect to
`http://127.0.0.1:3000/bb-mcp`. Compare `get_project_capabilities.plugin.build_id`
with `dist/build-info.json` before `bun run test:efficiency:live`. The existing
`test:live`, `test:stability:live` and `test:remaining:live` suites require the same
isolated live-testing conditions. Keep unrelated dialogs/edits inactive.

The local file build was loaded for this verification. Rebuilds require
Reload in its plugin card; restart the watcher after build-script/dependency/version
configuration changes. The running installation was subsequently restored to the
hosted URL plugin (1.1.0); all 19 original projects passed preservation checks again.
No merge, tag or release was created during verification.
Recheck the base version before publishing, as required by VERSIONING.md.
