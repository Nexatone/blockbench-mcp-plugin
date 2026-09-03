import type { ToolSpec, ResourceSpec } from "../lib/factories";

// Tool docs imports — each file exports schemas at module level with zero Blockbench deps
import { cameraToolDocs } from "../server/tools/camera";
import { cubeToolDocs } from "../server/tools/cubes";
import { elementToolDocs } from "../server/tools/element";
import { importToolDocs } from "../server/tools/import";
import { meshToolDocs } from "../server/tools/mesh";
import { paintToolDocs } from "../server/tools/paint";
import { projectToolDocs } from "../server/tools/project";
import { textureToolDocs } from "../server/tools/texture";
import { armatureToolDocs } from "../server/tools/armature";
import { animationToolDocs } from "../server/tools/animation";
import { uiToolDocs } from "../server/tools/ui";
import { hytaleToolDocs } from "../server/tools/hytale";
import { materialInstanceToolDocs } from "../server/tools/material-instances";
import { uvToolDocs } from "../server/tools/uv";
import { historyToolDocs } from "../server/tools/history";
import { exportToolDocs } from "../server/tools/export";
import { modelToolDocs } from "../server/tools/model";
import { modelBatchToolDocs } from "../server/tools/model-batch";
import { modelResourceDocs } from "../server/resources/model";

export interface CategoryGroup {
  category: string;
  tools: ToolSpec[];
}

export const toolManifest: CategoryGroup[] = [
  { category: "Cubes", tools: cubeToolDocs },
  { category: "Camera & Screenshots", tools: cameraToolDocs },
  { category: "Animation", tools: animationToolDocs },
  { category: "Armature", tools: armatureToolDocs },
  { category: "Elements", tools: elementToolDocs },
  { category: "Export", tools: exportToolDocs },
  { category: "History", tools: historyToolDocs },
  { category: "Import/Export", tools: importToolDocs },
  { category: "Material Instances", tools: materialInstanceToolDocs },
  { category: "Mesh Editing", tools: meshToolDocs },
  { category: "Paint Tools", tools: paintToolDocs },
  { category: "Project", tools: projectToolDocs },
  { category: "Textures", tools: textureToolDocs },
  { category: "UI Interaction", tools: uiToolDocs },
  { category: "UV Mapping", tools: uvToolDocs },
  { category: "Hytale Integration", tools: hytaleToolDocs },
  { category: "Model Workflows", tools: [...modelToolDocs,...modelBatchToolDocs] },
];

export { promptDocs } from "../server/prompt-specs";

// Resource specs defined inline — server/resources.ts uses Blockbench globals at module level
export const resourceDocs: ResourceSpec[] = [
  ...modelResourceDocs,
  ...["attachments", "pieces", "cubes"].map(kind => ({name:`hytale-${kind}-collection`,uriTemplate:`hytale://${kind}`,title:`Hytale ${kind} collection`,description:`Lists ${kind} in the current Hytale project. Requires the Hytale plugin.`})),
  { name: "projects-collection", uriTemplate: "projects://", title: "All Projects", description: "Lists all open projects and the active project." },
  { name: "textures-collection", uriTemplate: "textures://", title: "All Textures", description: "Lists textures in the active project, including actual bitmap dimensions." },
  { name: "reference_models-collection", uriTemplate: "reference_models://", title: "All Reference Models", description: "Lists reference models when the Reference Models plugin is installed at MCP load time." },
  { name: "validator-checks-collection", uriTemplate: "validator://checks", title: "All Validator Checks", description: "Lists all registered validator checks." },
  {
    name: "projects",
    uriTemplate: "projects://{id}",
    title: "Blockbench Projects",
    description:
      "Returns information about available projects. List URIs use the slugified project name (e.g. `projects://my-character`) when unique, or `projects://<slug>~<uuid-prefix>` on collision. Reads accept UUID, exact name, or slug.",
  },
  {
    name: "nodes",
    uriTemplate: "nodes://{id}",
    title: "Blockbench Nodes",
    description:
      "Returns the current 3D nodes in the editor. List URIs use slugified names (e.g. `nodes://head`) when unique, with `~<uuid-prefix>` on collision. Reads accept UUID, exact name, or slug.",
  },
  {
    name: "textures",
    uriTemplate: "textures://{id}",
    title: "Blockbench Textures",
    description:
      "Returns information about textures. List URIs use slugified names (e.g. `textures://skin`) when unique, with `~<uuid-prefix>` on collision. Reads accept UUID, exact name, slug, or short numeric texture id.",
  },
  {
    name: "reference_models",
    uriTemplate: "reference_models://{id}",
    title: "Reference Models",
    description:
      "Returns reference models in the current project. Requires the Reference Models plugin. List URIs use slugified names (e.g. `reference_models://turntable`) with `~<uuid-prefix>` on collision. Reads accept UUID, exact name, or slug.",
  },
  {
    name: "validator-status",
    uriTemplate: "validator://status",
    title: "Validator Status",
    description:
      "Returns the current validation status including error/warning counts and a summary of all problems.",
  },
  {
    name: "validator-checks",
    uriTemplate: "validator://checks/{id}",
    title: "Validator Checks",
    description:
      "Returns information about registered validator checks. Use without an ID to list all checks, or provide a check ID to get details about a specific check.",
  },
  {
    name: "validator-warnings",
    uriTemplate: "validator://warnings",
    title: "Validator Warnings",
    description:
      "Returns all current validation warnings with element references where available.",
  },
  {
    name: "validator-errors",
    uriTemplate: "validator://errors",
    title: "Validator Errors",
    description:
      "Returns all current validation errors with element references where available.",
  },
  {
    name: "hytale-format",
    uriTemplate: "hytale://format",
    title: "Hytale Format Information",
    description:
      "Returns comprehensive information about the current Hytale format, including format type, block size, node limits, and feature support.",
  },
  {
    name: "hytale-attachments",
    uriTemplate: "hytale://attachments/{id}",
    title: "Hytale Attachments",
    description:
      "Returns information about attachment collections. List URIs use slugified collection names (e.g. `hytale://attachments/helmet`) with `~<uuid-prefix>` on collision. Reads accept UUID, exact name, or slug.",
  },
  {
    name: "hytale-pieces",
    uriTemplate: "hytale://pieces/{id}",
    title: "Hytale Attachment Pieces",
    description:
      "Returns groups marked as attachment pieces — they connect to like-named bones in the main model. List URIs use slugified bone names (e.g. `hytale://pieces/hand-right`) with `~<uuid-prefix>` on collision.",
  },
  {
    name: "hytale-cubes",
    uriTemplate: "hytale://cubes/{id}",
    title: "Hytale Cubes",
    description:
      "Returns cubes with Hytale-specific properties (shading_mode, double_sided, stretch). List URIs use slugified cube names (e.g. `hytale://cubes/torso`) with `~<uuid-prefix>` on collision.",
  },
];
