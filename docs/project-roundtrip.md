# Project-free evaluation and Bedrock display round trips

## Confirmed causes and fixes

`risky_eval` previously started an Undo edit even for inspection, then called
`Undo.finishEdit` unconditionally in `finally`. On the start screen Undo is
undefined: even `6 * 7` failed, and the finalization error masked the original
error. The wrapper could also replace an existing edit or clear redo history.
Evaluation now runs without an implicit transaction. Editing scripts must supply
their own Undo aspects and finish their edits; exceptions become MCP tool errors.
Arbitrary script changes are not automatically rolled back on error.

`from_geo_json` created `Formats.bedrock` before calling the codec's `parse`
method, bypassing the native loader's selection of `bedrock_block` for geometry
containing `item_display_transforms`. Version selection checks
`Format.display_mode`: the wrong Entity format produced `1.12.0` despite display
transforms. The tool now selects Block when display transforms are present,
including an empty object. Other geometry retains the Entity/legacy codec paths.

Repeated imports also invoked native same-identifier tab reuse. Since inline
imports have empty export paths, importing the same identifier again closed the
new project and made the screenshot fail. Modern imports now pass
`switch_to_existing_tab: false`, keeping each import isolated.

The native `.bbmodel` exporter uses `DisplaySlot.export()`, which omits the GUI
`fit_to_frame` flag in Blockbench 5.1.6. A geometry import defaulted it to `true`,
but saving/reopening changed it to `false`. A scoped `save_project` listener now
copies that boolean into saved Bedrock Block GUI settings. It applies to native
saves and MCP exports, changes no other display fields or formats, and is removed
on plugin unload. Native loading already reads this field.

## Version and display normalization

This uses the native codec, not a lossless JSON editor. Blockbench **5.1.6**
exports **`1.21.110`** for Block models with display settings, even when the input
says `1.21.20`. We do not force an older version onto newer codec output. Targeting
older Minecraft versions still requires compatibility review.

Native normalization includes `225` degrees becoming `-135` (equivalent angles),
adding zero pivots, and writing the previously implicit `gui.fit_to_frame: true`.
These differences alone do not mean the transform changed. The missing flag
after `.bbmodel` reopening was a separate, confirmed loss.

Sources checked against the running Blockbench 5.1.6:

- [Bedrock loader, parseGeometry and getFormatVersion](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/formats/bedrock/bedrock.js)
- [DisplaySlot export and extend](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/display_mode/display_mode.js)
- [Project codec display export and save event](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/formats/bbmodel.js)
- [Minecraft 1.21.20 display transforms](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.21.20?view=minecraft-bedrock-stable)

## Verification and loading

Final checks: **52 tests pass**, production/development builds and docs generation
pass. Type checking retains the same **107 existing diagnostics** with no new
file/message pairs. No lint command is configured. The final local development
build passed the live suite in Blockbench 5.1.6, including saved GUI state and
preservation of both original tabs. The URL installation was restored afterward.

```sh
bun install --frozen-lockfile
bun run test
bun run typecheck
bun run build
bun run dev
bun run docs:build
bun tests/live/project-roundtrip.mjs
```

The new tests cover project-free evaluation, explicit Undo, active edit
preservation, script failures, format selection, unavailable formats, repeated
imports, cleanup and save-listener behavior. The original implementation failed
seven of the first nine tests; an additional test reproduced tab reuse. Native
save/reopen reproduced the GUI flag loss before the persistence hook was added.

The live script needs the patched plugin at `127.0.0.1:3000/bb-mcp`. It checks the
start screen, MCP errors, native codec output, a second geometry import,
`.bbmodel` compile/reopen and explicit Undo/Redo. It compares every original
project's compiled model, saved flag and Undo history/position, then restores the
selected tab. Run without simultaneous editor changes. Reports and exported
fixtures are written under ignored `.verification/`.

Use `EXPECT_BEFORE=1` against the old plugin for before-fix reproduction. That mode
cancels the old tool's implicit edit for inspection; do not use that workaround
with the patched plugin.

The fixture reproduces Grave display values but is not the original geometry
file. The open Grave project was inspected read-only; the original JSON is still
needed for a complete original-versus-exported diff. Minecraft in-game rendering
and every codec/display-slot combination are not claimed as verified.

Build with `bun run dev`, then use **File → Plugins → Load Plugin from File** and
choose this repository's `dist/mcp.js`. Uninstall the URL-loaded MCP Server first.
Reload after rebuilding and reconnect the client. Confirm the source is the
local file: version `1.6.1` alone does not identify this patch. The hosted nightly
URL changes after these fixes are merged and the main-branch deployment finishes.

For an existing URL installation, wait for that deployment, open **File → Plugins
→ Installed → MCP Server**, and click **Reload**. Blockbench fetches the plugin
again from its configured URL. Reconnect the MCP client afterward. If reinstalling
is necessary, use **Load Plugin from URL** with
`https://itsjosshy.github.io/blockbench-mcp-plugin/nightly/mcp.js`.

Before merging, the PR's deployment comment links to a temporary preview plugin.
Install that URL separately after uninstalling the current MCP Server if testing
the PR immediately. Switch back to the nightly URL after merging: PR preview
directories are removed when their PR closes.

Existing Entity projects are not automatically converted. Re-import the original
geometry using the patched tool to get a separate Block project; retain any
edited original until its work has been transferred and verified.

## Separate follow-up observations

The native exporter's treatment of identity/pivot-only slots, unsupported future
slots, and explicit older-version targeting deserves separate fixtures. These
are not expanded into a custom Bedrock serializer by this fix.
