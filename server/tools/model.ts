import { z } from "zod";
import { createTool, jsonResult, type ToolSpec } from "@/lib/factories";
import { nodeSummary, pageRows, projectNodes, projectRevision, requireActiveProject, resolveProject, resolveUnique, textureSummary } from "@/lib/modelState";
import { requireIdleEdit } from "@/lib/editorExecution";
import { BUILD_ID, VERSION } from "@/lib/constants";

const projectUuid = z.string().max(128).optional().describe("Project UUID; defaults to the active project for reads.");
const page = { limit: z.number().int().min(1).max(100).default(25), cursor: z.string().max(4096).optional() };
const envelope = { project_uuid: z.string(), revision: z.string() };
export const modelPageResult = z.object({ ...envelope, items: z.array(z.record(z.unknown())), total: z.number(), next_cursor: z.string().nullable() });
export const getProjectCapabilitiesParameters = z.object({ project_uuid: projectUuid });
export const queryModelParameters = z.object({
  project_uuid: projectUuid,
  kind: z.enum(["elements", "textures", "animations", "mesh_vertices", "mesh_faces", "texture_layers"]).default("elements"),
  owner_id: z.string().max(128).optional().describe("Mesh or texture UUID/unique name for components or layers."),
  type: z.string().max(64).optional().describe("Exact element type, e.g. cube, group, mesh, armature_bone."),
  name_contains: z.string().max(256).optional().describe("Literal case-insensitive name filter; no regex."),
  parent_uuid: z.string().max(128).optional().describe("Direct parent UUID, or root."),
  include_transform: z.boolean().default(false),
  ...page,
});
export const getElementParameters = z.object({ project_uuid: projectUuid, id: z.string().max(256), child_limit: z.number().int().min(0).max(100).default(20) });
export const validateModelParameters = z.object({ project_uuid: z.string(), severity: z.enum(["all", "error", "warning"]).default("all"), ...page });
export const selectProjectParameters = z.object({ project_uuid: z.string() });

export const modelToolDocs: ToolSpec[] = [
  { name: "get_project_capabilities", description: "Returns native format capabilities, available formats, project revision and exact plugin build identity. Use before choosing geometry/animation tools.", annotations: { readOnlyHint: true, openWorldHint: false }, parameters: getProjectCapabilitiesParameters, outputSchema: z.object({ ...envelope, plugin: z.record(z.unknown()), format: z.record(z.unknown()), formats: z.array(z.record(z.unknown())) }), status: "stable" },
  { name: "query_model", description: "Reads compact pages of project elements, textures, animations, mesh vertices/faces or texture layers. No bitmap/render graphs. Pages have a 16 KiB item budget; reuse next_cursor with identical filters. Editing invalidates cursors.", annotations: { readOnlyHint: true, openWorldHint: false }, parameters: queryModelParameters, outputSchema: modelPageResult, status: "stable" },
  { name: "get_element", description: "Reads one element's identity, transform, counts and bounded child IDs. Use query_model for full mesh geometry or additional children; avoids raw nodes:// rendering graphs.", annotations: { readOnlyHint: true, openWorldHint: false }, parameters: getElementParameters, outputSchema: z.object({ ...envelope, element: z.record(z.unknown()) }), status: "stable" },
  { name: "validate_model", description: "Runs native validation for the active project, waits for completion and returns a bounded problem page with check IDs. A cursor reads the completed validation snapshot; model edits invalidate it.", annotations: { readOnlyHint: true, openWorldHint: false }, parameters: validateModelParameters, outputSchema: modelPageResult.extend({ validated_at: z.string() }), status: "stable" },
  { name: "select_project", description: "Activates an existing project by UUID without closing others. Returns the active identity and revision; finish pending editor operations first.", annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }, parameters: selectProjectParameters, outputSchema: z.object(envelope), status: "stable" },
];

interface NativeValidationProblem { message: string }
interface NativeValidator {
  _timeout?: ReturnType<typeof setTimeout> | null;
  validate(): void;
  errors: NativeValidationProblem[];
  warnings: NativeValidationProblem[];
  checks: { id: string; errors: NativeValidationProblem[]; warnings: NativeValidationProblem[] }[];
}
declare const Validator: NativeValidator;
const validations = new WeakMap<ModelProject, { revision: string; time: string; rows: Record<string, unknown>[] }>();

export function registerModelTools(): void {
  createTool(modelToolDocs[0].name, {
    ...modelToolDocs[0], parameters: getProjectCapabilitiesParameters, async execute({ project_uuid }) {
      const project = resolveProject(project_uuid);
      const format = project.format as unknown as Record<string, unknown>;
      const flags = ["meshes", "bone_rig", "armature_rig", "animation_mode", "display_mode", "pbr", "single_texture", "box_uv", "optional_box_uv", "rotate_cubes", "rotation_limit", "integer_size"];
      return jsonResult({ project_uuid: project.uuid, revision: projectRevision(project), plugin: { version: VERSION, build_id: BUILD_ID, blockbench: Blockbench.version }, format: { id: project.format.id, name: project.format.name, ...Object.fromEntries(flags.map(key => [key, !!format[key]])) }, formats: Object.values(Formats).map(f => ({ id: f.id, name: f.name, meshes: !!f.meshes, animation: !!f.animation_mode })) });
    }
  });
  createTool(modelToolDocs[1].name, {
    ...modelToolDocs[1], parameters: queryModelParameters, async execute(args) {
      const project = resolveProject(args.project_uuid);
      let rows: Record<string, unknown>[];
      switch (args.kind) {
        case "elements": rows = projectNodes(project).filter(node => (!args.type || node.type === args.type) && (!args.parent_uuid || (typeof node.parent === "object" ? node.parent.uuid : "root") === args.parent_uuid)).map(node => nodeSummary(node, args.include_transform)); break;
        case "textures": rows = project.textures.map(textureSummary); break;
        case "animations": rows = project.animations.map(animation => ({ uuid: animation.uuid, name: animation.name, length: animation.length, loop: animation.loop })); break;
        case "texture_layers": {
          if (!args.owner_id) throw new Error("owner_id is required for texture layers.");
          const texture = resolveUnique(project.textures, args.owner_id, "texture");
          rows = texture.layers.map(layer => ({ uuid: layer.uuid, name: layer.name, visible: layer.visible, opacity: layer.opacity, selected: texture.selected_layer === layer })); break;
        }
        default: {
          if (!args.owner_id) throw new Error("owner_id is required for mesh components.");
          const mesh = resolveUnique(project.elements.filter((element): element is Mesh => element instanceof Mesh), args.owner_id, "mesh");
          rows = args.kind === "mesh_vertices" ? Object.entries(mesh.vertices).map(([key, position]) => ({ key, position })) : Object.entries(mesh.faces).map(([key, face]) => ({ key, vertices: face.vertices, uv: face.uv, texture: face.texture }));
        }
      }
      if (args.name_contains) { const name = args.name_contains.toLowerCase(); rows = rows.filter(row => String(row.name ?? "").toLowerCase().includes(name)); }
      const { cursor, limit, ...query } = args;
      return jsonResult({ project_uuid: project.uuid, revision: projectRevision(project), ...pageRows(rows, project, JSON.stringify(query), limit, cursor) });
    }
  });
  createTool(modelToolDocs[2].name, {
    ...modelToolDocs[2], parameters: getElementParameters, async execute({ project_uuid, id, child_limit }) {
      const project = resolveProject(project_uuid);
      const node = resolveUnique(projectNodes(project), id, "element");
      const children = (node as OutlinerNode & { children?: OutlinerNode[] }).children ?? [];
      return jsonResult({ project_uuid: project.uuid, revision: projectRevision(project), element: { ...nodeSummary(node, true), child_ids: children.slice(0, child_limit).map(child => child.uuid), children_truncated: children.length > child_limit } });
    }
  });
  createTool(modelToolDocs[3].name, {
    ...modelToolDocs[3], parameters: validateModelParameters, async execute({ project_uuid, severity, limit, cursor }, context) {
      const project = requireActiveProject(project_uuid);
      const revision = projectRevision(project);
      let snapshot = validations.get(project);
      if (!cursor) {
        Validator.validate();
        const deadline = Date.now() + 5000;
        while (Validator._timeout) {
          context?.signal?.throwIfAborted();
          requireActiveProject(project_uuid, revision);
          if (Date.now() > deadline) throw new Error("VALIDATION_PENDING: native validation did not finish; retry later.");
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        requireActiveProject(project_uuid, revision);
        const checks = new Map<NativeValidationProblem, string>();
        for (const check of Validator.checks) for (const problem of [...check.errors, ...check.warnings]) checks.set(problem, check.id);
        snapshot = { revision, time: new Date().toISOString(), rows: [...Validator.errors.map(p => ({ severity: "error", check_id: checks.get(p) ?? null, message: p.message })), ...Validator.warnings.map(p => ({ severity: "warning", check_id: checks.get(p) ?? null, message: p.message }))] };
        validations.set(project, snapshot);
      }
      if (!snapshot || snapshot.revision !== revision) throw new Error("STALE_CURSOR: run validation again without a cursor.");
      const rows = severity === "all" ? snapshot.rows : snapshot.rows.filter(row => row.severity === severity);
      return jsonResult({ project_uuid, revision, validated_at: snapshot.time, ...pageRows(rows, project, `validation:${severity}:${snapshot.time}`, limit, cursor) });
    }
  });
  createTool(modelToolDocs[4].name, {
    ...modelToolDocs[4], parameters: selectProjectParameters, async execute({ project_uuid }) {
      requireIdleEdit();
      const project = resolveProject(project_uuid);
      project.select();
      return jsonResult({ project_uuid: project.uuid, revision: projectRevision(project) });
    }
  });
}
