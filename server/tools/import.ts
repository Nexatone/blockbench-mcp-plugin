/// <reference types="three" />
/// <reference types="blockbench-types" />
import { z } from "zod";
import { createTool, type ToolSpec } from "@/lib/factories";
import { captureScreenshot } from "@/lib/util";
import { readModelInput } from "@/lib/modelInput";
import { STATUS_STABLE } from "@/lib/constants";

export const fromGeoJsonParameters = z.object({
  geojson: z
    .string()
    .describe(
      "Path to the GeoJSON file or data URL, or the GeoJSON string itself."
    ),
});

export const importToolDocs: ToolSpec[] = [
  {
    name: "from_geo_json",
    description: "Imports Minecraft Bedrock geometry JSON into a new isolated project. Geometry with item_display_transforms uses Bedrock Block; otherwise uses Bedrock Entity. Accepts inline JSON, a local path/file URL, an application/json data URL, or HTTP(S). Existing projects are preserved. Exports use Blockbench's native format version and normalized display settings, not a byte-identical JSON round trip.",
    annotations: {
      title: "Import GeoJSON",
      destructiveHint: true,
    },
    parameters: fromGeoJsonParameters,
    status: STATUS_STABLE,
  },
];

export function registerImportTools() {
  createTool(importToolDocs[0].name, {
    ...importToolDocs[0],
    async execute({ geojson }) {
      const model = await readModelInput(geojson, path => {
        const fs = requireNativeModule("fs", { message: "Read the requested Bedrock geometry file" });
        if (!fs) throw new Error("File access was denied.");
        return fs.readFileSync(path, "utf8");
      });
      const geometries = model["minecraft:geometry"];
      const modern = Array.isArray(geometries);
      // Match the native Bedrock loader's display-transform detection. Calling
      // parse directly skips load(), so we must choose the correct format first.
      const formatId = modern && geometries[0]?.item_display_transforms
        ? "bedrock_block" : "bedrock";
      const format = Formats[formatId];
      const codec = modern ? Codecs.bedrock : Codecs.bedrock_old;
      if (!format) throw new Error(`This Blockbench version does not support the ${formatId} format.`);
      if (!codec?.parse) throw new Error("This Blockbench version does not support this geometry format.");
      const original = Project;
      if (!newProject(format)) throw new Error("Unable to create a Bedrock import project.");
      const imported = Project;
      try {
        if (modern) {
          // Native parsing otherwise closes the new project and selects a tab
          // with the same identifier/path, violating this tool's isolation.
          const parse = codec.parse as (model: unknown, path: string, options: { switch_to_existing_tab: boolean }) => void;
          parse.call(codec, model, "", { switch_to_existing_tab: false });
        } else {
          codec.parse(model, "");
        }
        Canvas.updateAll();
        return captureScreenshot();
      } catch (error) {
        await imported?.close(true);
        original?.select();
        throw error;
      }
    },
  }, importToolDocs[0].status);
}
