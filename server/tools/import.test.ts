import { afterEach, expect, test } from "bun:test";
import { getAllToolDefinitions } from "@/lib/factories";
import { registerImportTools } from "./import";

registerImportTools();
const globals = globalThis as unknown as Record<string, unknown>;
const keys = ["Project", "Formats", "Codecs", "newProject", "Canvas", "Preview", "requireNativeModule"];
const prior = Object.getOwnPropertyDescriptors(globalThis);
afterEach(() => {
  for (const key of keys) {
    if (prior[key]) Object.defineProperty(globalThis, key, prior[key]);
    else delete globals[key];
  }
});

function setup() {
  const original = { select() { globals.Project = original; } };
  const created: object[] = [];
  const parsed: string[] = [];
  const parseOptions: unknown[] = [];
  const formats = { bedrock: { id: "bedrock" }, bedrock_block: { id: "bedrock_block" } };
  Object.assign(globals, {
    Project: original, Formats: formats,
    newProject(format: object) {
      created.push(format);
      globals.Project = { selected: true, close: async () => { globals.Project = 0; } };
      return true;
    },
    Codecs: { bedrock: { parse(_model: unknown, _path: string, options: unknown) { parsed.push("bedrock"); parseOptions.push(options); } }, bedrock_old: { parse() { parsed.push("bedrock_old"); } } },
    Canvas: { updateAll() {}, withoutGizmos(fn: () => void) { fn(); } },
    Preview: { selected: { render() {}, canvas: { toDataURL: () => "data:image/png;base64,cG5n" } } },
  });
  return { original, created, parsed, parseOptions, formats };
}
const execute = (model: unknown) => getAllToolDefinitions().from_geo_json.execute({ geojson: JSON.stringify(model) });
const geometry = (display?: object) => ({ format_version: "1.21.20", "minecraft:geometry": [{
  description: { identifier: "geometry.display_fixture" }, bones: [],
  ...(display ? { item_display_transforms: display } : {}),
}] });

test("geometry with display transforms imports as Bedrock Block, including an empty transform object", async () => {
  const { created, formats, parsed } = setup();
  for (const display of [{ gui: { rotation: [30, 225, 0] } }, {}]) await execute(geometry(display));
  expect(created).toEqual([formats.bedrock_block, formats.bedrock_block]);
  expect(parsed).toEqual(["bedrock", "bedrock"]);
});

test("repeated imports disable native same-identifier tab reuse", async () => {
  const { parseOptions, created } = setup();
  await execute(geometry({ gui: {} }));
  await execute(geometry({ gui: {} }));
  expect(created).toHaveLength(2);
  expect(parseOptions).toEqual([{ switch_to_existing_tab: false }, { switch_to_existing_tab: false }]);
});

test("entity and legacy geometry retain their codec paths", async () => {
  const { created, parsed, formats } = setup();
  await execute(geometry());
  await execute({ format_version: "1.10.0", "geometry.legacy": { bones: [] } });
  expect(created).toEqual([formats.bedrock, formats.bedrock]);
  expect(parsed).toEqual(["bedrock", "bedrock_old"]);
});

test("missing block format fails before creating or changing projects", async () => {
  const { original, created } = setup();
  delete (globals.Formats as Record<string, unknown>).bedrock_block;
  await expect(execute(geometry({ gui: {} }))).rejects.toThrow("bedrock_block");
  expect(globals.Project).toBe(original);
  expect(created).toEqual([]);
});

test("failed import closes only its new project and reselects the original", async () => {
  const { original } = setup();
  (globals.Codecs as Record<string, unknown>).bedrock = { parse() { throw new Error("parse failed"); } };
  await expect(execute(geometry({ gui: {} }))).rejects.toThrow("parse failed");
  expect(globals.Project).toBe(original);
});
