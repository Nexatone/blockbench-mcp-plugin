/// <reference types="three" />
/// <reference types="blockbench-types" />
import { z } from "zod";
import { createTool, jsonResult, type ToolSpec } from "@/lib/factories";
import { captureScreenshot } from "@/lib/util";
import { readModelInput, readJsonInput } from "@/lib/modelInput";
import { projectRevision } from "@/lib/modelState";
import { requireIdleEdit } from "@/lib/editorExecution";
import { STATUS_STABLE } from "@/lib/constants";

export const fromGeoJsonParameters = z.object({
  include_preview: z.boolean().default(true).describe("Return the existing screenshot by default; false returns only created project metadata."),
  geojson: z
    .string()
    .describe(
      "Path to the GeoJSON file or data URL, or the GeoJSON string itself."
    ),
});

export const openProjectParameters = z.object({
  bbmodel: z.string().describe("Native .bbmodel JSON, local path/file URL, application/json data URL or HTTP(S) URL; maximum 16 MiB."),
  include_preview: z.boolean().default(false),
});
const importResult = z.object({project_uuid:z.string(),revision:z.string(),format:z.string(),name:z.string()});

export const importToolDocs: ToolSpec[] = [
  {
    name: "from_geo_json",
    description: "Imports Minecraft Bedrock geometry JSON into a new isolated project. Geometry with item_display_transforms uses Bedrock Block; otherwise uses Bedrock Entity. Accepts inline JSON, a local path/file URL, an application/json data URL, or HTTP(S). Existing projects are preserved. Exports use Blockbench's native format version and normalized display settings, not a byte-identical JSON round trip.",
    annotations: {
      title: "Import GeoJSON",
      destructiveHint: true,
    },
    parameters: fromGeoJsonParameters,
    outputSchema: importResult,
    status: STATUS_STABLE,
  },
  {
    name: "open_project",
    description: "Opens native .bbmodel data in a NEW isolated project, preserving existing tabs. Requires its model format to be installed. Returns project identity/revision; preview is opt-in. Use select_project to switch existing tabs and export_model with codec_id 'project' to save.",
    annotations: {title:"Open Project",destructiveHint:false,openWorldHint:true},
    parameters: openProjectParameters,
    outputSchema: importResult,
    status: STATUS_STABLE,
  },
];

function importedResult(project: ModelProject, preview: boolean) {
  const result = jsonResult({project_uuid:project.uuid,revision:projectRevision(project),format:project.format.id,name:project.name});
  // Preserve legacy image position while adding a text/structured identity.
  if (preview) result.content.unshift(...captureScreenshot().content);
  return result;
}

export function registerImportTools() {
  createTool(importToolDocs[0].name, {
    ...importToolDocs[0],
    parameters: fromGeoJsonParameters,
    async execute({ geojson, include_preview }, context) {
      const original = Project;
      const model = await readModelInput(geojson, path => {
        const fs = requireNativeModule("fs", { message: "Read the requested Bedrock geometry file" });
        if (!fs) throw new Error("File access was denied.");
        return fs.readFileSync(path, "utf8");
      }, context?.signal);
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
      context?.signal?.throwIfAborted();
      if (Project !== original) throw new Error("PROJECT_CHANGED: active project changed while reading the model; retry.");
      requireIdleEdit();
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
        return importedResult(imported!, include_preview);
      } catch (error) {
        await imported?.close(true);
        original?.select();
        throw error;
      }
    },
  }, importToolDocs[0].status);

  createTool(importToolDocs[1].name, {
    ...importToolDocs[1],
    parameters: openProjectParameters,
    async execute({bbmodel, include_preview}, context) {
      const original = Project;
      const model = await readJsonInput(bbmodel, path => {
        const fs = requireNativeModule("fs", {message:"Read the requested Blockbench project file"});
        if (!fs) throw new Error("File access was denied.");
        return fs.readFileSync(path,"utf8");
      }, context?.signal);
      const meta = model.meta as {model_format?:string;format_version?:string} | undefined;
      if (!meta || typeof meta !== "object" || typeof meta.model_format !== "string" || typeof meta.format_version !== "string" || !Array.isArray(model.elements)) {
        throw new Error("INVALID_PROJECT: expected native .bbmodel metadata and elements.");
      }
      const format = Formats[meta.model_format];
      if (!format || !Codecs.project?.parse) throw new Error(`UNSUPPORTED_FORMAT: install the ${meta.model_format} format before opening this project.`);
      context?.signal?.throwIfAborted();
      if (Project !== original) throw new Error("PROJECT_CHANGED: active project changed while reading the project; retry.");
      requireIdleEdit();
      if (!newProject(format)) throw new Error("Unable to create an import project.");
      const imported = Project!;
      try {
        // Native load() can reuse editor state; parse into our explicitly owned tab.
        Codecs.project.parse(model, "");
        Canvas.updateAll();
        return importedResult(imported,include_preview);
      } catch (error) {
        await imported.close(true);
        original?.select();
        throw error;
      }
    },
  }, importToolDocs[1].status);
}
