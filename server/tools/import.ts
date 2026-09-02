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
    description: "Imports Minecraft Bedrock geometry JSON into a new isolated project. Accepts inline JSON, a local path/file URL, an application/json data URL, or HTTP(S). Existing projects are preserved.",
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
      const original = Project;
      if (!newProject(Formats.bedrock)) throw new Error("Unable to create a Bedrock import project.");
      const imported = Project;
      try {
        const codec = Array.isArray(model["minecraft:geometry"]) ? Codecs.bedrock : Codecs.bedrock_old;
        if (!codec) throw new Error("This Blockbench version does not support this geometry format.");
        codec.parse!(model, "");
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
