# Texture dimensions fix

`create_texture` now sizes the blank bitmap before filling or clearing it. Filled
and transparent textures honor the requested pixel width and height; omitted
dimensions still default to 16 independently. Project UV resolution is unchanged.
The creation edit also records the new texture so Undo removes it and Redo
restores its bitmap.

## Root cause

In [Blockbench 5.1.6's Texture implementation](https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/textures.js),
constructor width/height metadata does not size the backing canvas: it starts at
16×16. The old tool drew into that canvas and encoded it. Loading that PNG then
overwrote the texture metadata with the image's actual 16×16 dimensions.
`updateLayerChanges(true)` does not resize a new texture with layers disabled.

The fix sizes only the newly created blank texture's canvas, before setting the
fill style (resizing a canvas resets drawing state). File-path and data-URL imports
keep their original image dimensions and now await decoding before responding.
No UV rescaling or unrelated texture resizing occurs.

## Build and load locally

1. Run `bun install --frozen-lockfile`, `bun run test`, and `bun run dev` from the
   repository root. The local plugin is `dist/mcp.js`, with `dist/mcp.js.map`.
   `bun run build` produces the minified production version at the same path.
2. In desktop Blockbench, open File → Plugins → Load Plugin from File and select
   this checkout's `dist/mcp.js`. Replace the existing MCP plugin with the local
   copy; loading the hosted URL will not test this change. Keep unrelated project
   tabs open and use a new Bedrock Entity project for verification.
3. After rebuilding, reload the local MCP plugin and reconnect the MCP client.
   Confirm the plugin source is the local file. The version remains 1.6.1, so the
   version alone does not identify the patched build.
4. Connect to the configured endpoint (default `http://localhost:3000/bb-mcp`).
   `bunx @modelcontextprotocol/inspector` can be used as a client.

## Verification procedure

Call `create_project`:

```json
{"name":"texture_dimensions_repro","format":"bedrock"}
```

Call `create_texture`:

```json
{
  "name": "test_texture",
  "width": 64,
  "height": 64,
  "fill_color": "#34B6A0",
  "layer_name": "base"
}
```

- Decode the returned PNG. It must be 64×64 and every pixel, including (63,63),
  must be RGBA `[52,182,160,255]`.
- Repeat with 64×32 and with both dimensions omitted (16×16). Repeat each without
  `fill_color` and `layer_name`; every pixel must be transparent `[0,0,0,0]`.
- Confirm the texture canvas and loaded image dimensions match. The project's
  `texture_width` / `texture_height` can remain 16×16: these are UV units.
- Create a second texture with an existing cube and texture present. Confirm the
  first texture's pixels and dimensions and the cube's UV coordinates stay intact.
- Undo each creation and confirm only that texture is removed. Redo and confirm
  its dimensions and all pixels return.
- Export with `export_model` and `{"codec_id":"project"}`, save the returned
  content as a `.bbmodel`, and reopen it. Inspect each texture's `width`, `height`,
  and decoded `source` PNG. The top-level `resolution` is the project UV size.
- Import a distinct 40×24 PNG using both a file path and a data URL, with requested
  dimensions set to 64×64. After loading, the imported image should retain its
  original dimensions and pixels, including any transparent pixels.

## Verification recorded on 2026-09-02

- Windows, Bun 1.3.8, Blockbench 5.1.6, MCP plugin 1.6.1.
- Reproduced the original 64×64 request producing a 16×16 returned PNG, canvas,
  and exported texture. Pixels outside the old canvas were absent.
- Automated tests before the fix: 5 passed, 9 failed. After: all 14 passed.
  Tests cover real decoded pixels, defaults (including one omitted dimension),
  square/non-square filled and transparent images, unchanged existing textures,
  creation undo snapshots, and imports via data URL, file path, and file URL.
- Loaded the development bundle through Blockbench's local plugin loader and
  inspected the running handler to confirm the canvas assignments and undo fix.
- Live: all six filled/transparent size cases passed for the returned PNG,
  canvas, image metadata, saved texture copy, Undo/Redo, and `.bbmodel` export and
  reopen. Every decoded pixel was checked. Existing textures and cube UVs stayed
  unchanged; project UV resolution stayed 16×16.
- Live file-path and data-URL imports retained a 40×24 image and its transparent
  corner after loading and after Undo/Redo.
- Closed only the three isolated test projects and restored the original tab.
  Its compiled model, original undo entries/index, and unsaved state were unchanged.
- Development build, production build, and documentation generation passed.
  Full `tsc --noEmit` reports 161 existing diagnostics, identical before and after
  after accounting for shifted line numbers. No new diagnostics occurred in the
  implementation or tests. No lint script/configuration exists.

The automated suite uses a Texture stand-in; actual editor lifecycle behavior was
checked separately through live MCP calls. Verification artifacts are local,
ignored files under `dist/verification/`, including PNGs, the exported `.bbmodel`,
build/type-check logs, and running-handler/build provenance.

## Follow-up fixes in the bug-review branch

The later repository-wide implementation also awaits native image decoding for
blank/file/data-URL textures before returning or creating layers. Named base
layers now receive the actual bitmap, and creation captures bitmap Undo data so
layer pixels survive Undo/Redo. Pixel dimensions require integers; RGBA tuple
alpha uses the documented 0–255 scale. Rendering mode/sides are applied.

The final live suite checks named-layer pixels at (63,31), creation Undo/Redo,
and exported/reopened `.bbmodel` data. Native project loading includes deferred
image/layer work; tests wait for that work before reading pixels. The historical
14-test texture matrix above remains, with additional tests for the wider fixes.
See [the updated bug review](bug-review.md) for current total test counts,
TypeScript baseline, implemented findings and remaining compatibility checks.
