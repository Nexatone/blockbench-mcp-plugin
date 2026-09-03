import { z } from "zod";
import { createTool, jsonResult, type ToolContentResult, type ToolSpec } from "@/lib/factories";
import { withUndoEdit } from "@/lib/editorExecution";
import { outlinerTree } from "@/lib/geometry";
import { projectNodes, projectRevision, requireActiveProject, resolveUnique } from "@/lib/modelState";

const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const uv = z.tuple([z.number().finite(), z.number().finite()]);
const alias = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).refine(value => !["constructor", "prototype", "__proto__"].includes(value), "Reserved key");
const target = z.string().min(1).max(256);
const base = { ref: alias, name: z.string().min(1).max(256), parent: target.default("root") };
const groupInput = z.object({ ...base, origin: vector.default([0, 0, 0]), rotation: vector.default([0, 0, 0]) });
const cubeInput = z.object({ ...base, from: vector, to: vector, origin: vector.optional(), rotation: vector.optional(), texture: target.optional() });
const meshInput = z.object({ ...base, origin: vector.optional(), rotation: vector.optional(), vertices: z.record(alias, vector).refine(values => Object.keys(values).length >= 3 && Object.keys(values).length <= 20_000, "A mesh needs 3–20,000 vertices"), faces: z.array(z.object({ vertices: z.array(alias).min(3).max(4), uv: z.record(alias, uv).optional(), texture: target.optional() })).min(1).max(20_000) });
const patchInput = z.object({ id: target, name: z.string().min(1).max(256).optional(), from: vector.optional(), to: vector.optional(), origin: vector.optional(), rotation: vector.optional(), visibility: z.boolean().optional() });

export const applyModelBatchParameters = z.object({
  project_uuid: z.string(),
  expected_revision: z.string().optional().describe("Revision from inspection; fails before mutation if the project changed."),
  operation_id: z.string().min(1).max(128).optional().describe("Retry key. Identical requests replay the original result for 10 minutes; changed arguments with the same key fail."),
  label: z.string().min(1).max(100).default("Agent model batch"),
  groups: z.array(groupInput).max(256).default([]),
  cubes: z.array(cubeInput).max(256).default([]),
  meshes: z.array(meshInput).max(32).default([]),
  patches: z.array(patchInput).max(256).default([]),
  remove: z.array(target).max(256).default([]),
}).refine(args => args.groups.length + args.cubes.length + args.meshes.length + args.patches.length + args.remove.length > 0, "Provide at least one operation")
  .refine(args => args.groups.length + args.cubes.length + args.meshes.length <= 256, "At most 256 new objects per batch");
const batchOutput = z.object({ project_uuid: z.string(), revision: z.string(), created: z.record(z.string()), patched: z.array(z.string()), removed: z.array(z.string()).describe("Removed root UUIDs; descendants are counted without expanding the result."), removed_count: z.number(), replayed: z.boolean() });
export const modelBatchToolDocs: ToolSpec[] = [{
  name: "apply_model_batch",
  description: "Creates groups, cubes and complete meshes with faces/UVs, patches or removes elements in ONE native Undo edit. All targets validate first; failure rolls back. Parent '@ref' addresses a group in this batch (forward references allowed); otherwise use root or an existing UUID/unique name. Mesh vertex keys are local aliases. No implicit screenshot. Active project_uuid required.",
  annotations: { destructiveHint: true, openWorldHint: false }, parameters: applyModelBatchParameters, outputSchema: batchOutput, status: "stable",
}];

type Batch = z.infer<typeof applyModelBatchParameters>;
type GroupInput = z.infer<typeof groupInput>;
interface CachedOperation { digest: string; expires: number; result: ToolContentResult; bytes: number }
const operations = new Map<string, CachedOperation>();
const CACHE_BYTES = 1_048_576;

async function digestOperation(args: Batch): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("");
}
function pruneOperations(): void {
  for (const [key, value] of operations) if (value.expires < Date.now()) operations.delete(key);
  let bytes = [...operations.values()].reduce((sum, value) => sum + value.bytes, 0);
  for (const [key, value] of operations) {
    if (bytes <= CACHE_BYTES && operations.size <= 128) break;
    operations.delete(key); bytes -= value.bytes;
  }
}

export function registerModelBatchTools(): void {
  createTool(modelBatchToolDocs[0].name, {
    ...modelBatchToolDocs[0], parameters: applyModelBatchParameters, async execute(args, context) {
      const digest = args.operation_id ? await digestOperation(args) : "";
      const cacheKey = `${args.project_uuid}:${args.operation_id}`;
      pruneOperations();
      const cached = args.operation_id ? operations.get(cacheKey) : undefined;
      if (cached) {
        if (cached.digest !== digest) throw new Error("OPERATION_ID_CONFLICT: use a new operation_id for changed arguments.");
        return jsonResult({ ...cached.result.structuredContent!, replayed: true });
      }
      const project = requireActiveProject(args.project_uuid, args.expected_revision);
      const nodes = projectNodes(project);
      const refs = new Set<string>();
      for (const input of [...args.groups, ...args.cubes, ...args.meshes]) {
        if (refs.has(input.ref)) throw new Error(`Duplicate local ref: ${input.ref}`);
        refs.add(input.ref);
      }
      if (args.meshes.length && !project.format.meshes) throw new Error("UNSUPPORTED_FORMAT: this format does not support meshes.");
      const geometrySize = args.meshes.reduce((sum, input) => sum + Object.keys(input.vertices).length + input.faces.length, 0);
      if (geometrySize > 50_000) throw new Error("BUDGET_EXCEEDED: batch geometry exceeds 50,000 vertices plus faces.");
      const definitions = new Map(args.groups.map(input => [input.ref, input]));
      const existingParents = new Map<string, Group | "root">([["root", "root"]]);
      const orderedGroups: GroupInput[] = [];
      const visiting = new Set<string>(), visited = new Set<string>();
      function validateParent(id: string): void {
        if (id.startsWith("@")) {
          const input = definitions.get(id.slice(1));
          if (!input) throw new Error(`Unknown group ref: ${id}`);
          visit(input);
        } else if (!existingParents.has(id)) {
          existingParents.set(id, resolveUnique(project.groups, id, "parent group"));
        }
      }
      function visit(input: GroupInput): void {
        if (visiting.has(input.ref)) throw new Error(`Parent cycle at @${input.ref}`);
        if (visited.has(input.ref)) return;
        visiting.add(input.ref); validateParent(input.parent); visiting.delete(input.ref);
        visited.add(input.ref); orderedGroups.push(input);
      }
      args.groups.forEach(visit);
      for (const input of [...args.cubes, ...args.meshes]) validateParent(input.parent);
      const textures = new Map<string, Texture>();
      function resolveTexture(id?: string): Texture | undefined {
        if (!id) return undefined;
        if (!textures.has(id)) textures.set(id, resolveUnique(project.textures, id, "texture"));
        return textures.get(id);
      }
      for (const input of args.cubes) resolveTexture(input.texture);
      for (const input of args.meshes) for (const face of input.faces) {
        if (new Set(face.vertices).size !== face.vertices.length) throw new Error("Mesh faces require distinct vertices.");
        for (const key of face.vertices) if (!Object.hasOwn(input.vertices, key)) throw new Error(`Unknown vertex ${key} in mesh ${input.ref}`);
        for (const key of Object.keys(face.uv ?? {})) if (!face.vertices.includes(key)) throw new Error(`UV key ${key} does not belong to its face.`);
        resolveTexture(face.texture);
      }
      const patches = args.patches.map(({ id, ...properties }) => {
        const node = resolveUnique(nodes, id, "element");
        if (!(node instanceof Group || node instanceof Cube || node instanceof Mesh)) throw new Error("Patches currently support groups, cubes and meshes.");
        if (!(node instanceof Cube) && (properties.from || properties.to)) throw new Error("from/to patches require cubes.");
        return { node, properties };
      });
      if (new Set(patches.map(p => p.node.uuid)).size !== patches.length) throw new Error("Duplicate patch target.");
      const removedNodes = new Set(args.remove.flatMap(id => outlinerTree(resolveUnique(nodes, id, "element"))));
      for (const { node } of patches) if (removedNodes.has(node)) throw new Error("Cannot patch and remove the same subtree in one batch.");
      for (const parent of existingParents.values()) if (parent !== "root" && removedNodes.has(parent)) throw new Error("Cannot create children under a removed parent.");
      const removeRoots = [...removedNodes].filter(node => typeof node.parent !== "object" || !removedNodes.has(node.parent));
      const tracked = new Set<OutlinerNode>([...removedNodes, ...patches.map(p => p.node)]);
      const elements = [...tracked].filter((node): node is OutlinerElement => !(node instanceof Group));
      const groups = [...tracked].filter((node): node is Group => node instanceof Group);
      const local = new Map<string, OutlinerNode>();
      const resultIds: Record<string, string> = Object.create(null);
      const selected = Outliner.selected.map(node => node.uuid);
      const aspects: UndoAspects = { elements, groups, outliner: true, selection: true, ...(removedNodes.size ? { animations: project.animations } : {}) };
      function parentFor(id: string): Group | "root" { return id.startsWith("@") ? local.get(id.slice(1)) as Group : existingParents.get(id)!; }
      function remember(ref: string, node: OutlinerNode): void {
        tracked.add(node); local.set(ref, node); resultIds[ref] = node.uuid;
        if (node instanceof Group) groups.push(node); else elements.push(node as OutlinerElement);
      }
      context?.signal?.throwIfAborted();
      requireActiveProject(project.uuid, args.expected_revision);
      try {
        withUndoEdit(args.label, aspects, () => {
          try {
            for (const input of orderedGroups) {
              const group = new Group({ name: input.name, origin: input.origin, rotation: input.rotation });
              remember(input.ref, group); group.addTo(parentFor(input.parent)).init();
            }
            for (const input of args.cubes) {
              const cube = new Cube({ name: input.name, from: input.from, to: input.to, origin: input.origin, rotation: input.rotation });
              remember(input.ref, cube); cube.addTo(parentFor(input.parent)).init();
              const texture = resolveTexture(input.texture);
              if (texture) cube.applyTexture(texture, true);
            }
            for (const input of args.meshes) {
              const mesh = new Mesh({ name: input.name, vertices: input.vertices, origin: input.origin, rotation: input.rotation });
              remember(input.ref, mesh);
              for (const face of input.faces) mesh.addFaces(new MeshFace(mesh, { vertices: face.vertices, uv: face.uv ?? {}, texture: resolveTexture(face.texture)?.uuid }));
              mesh.addTo(parentFor(input.parent)).init();
            }
            for (const { node, properties } of patches) node.extend(properties);
            for (const node of removeRoots) node.remove();
          } finally {
            // Undo's before data is detached; its aspects must describe the actual
            // post-state for both finishEdit and cancelEdit(true), including removals.
            elements.splice(0, elements.length, ...project.elements.filter(node => tracked.has(node)));
            groups.splice(0, groups.length, ...project.groups.filter(node => tracked.has(node)));
          }
          Canvas.updateView({ elements, groups, element_aspects: { geometry: true, transform: true, faces: true, uv: true, visibility: true }, selection: true });
        });
      } catch (error) {
        if (Project === project) {
          unselectAllElements();
          for (const node of projectNodes(project)) if (selected.includes(node.uuid)) node.markAsSelected(false);
          updateSelection();
        }
        throw error;
      }
      context?.reportProgress({ progress: 1, total: 1 });
      const result = jsonResult({ project_uuid: project.uuid, revision: projectRevision(project), created: resultIds, patched: patches.map(p => p.node.uuid), removed: removeRoots.map(node => node.uuid), removed_count: removedNodes.size, replayed: false });
      if (args.operation_id) {
        operations.set(cacheKey, { digest, expires: Date.now() + 600_000, result, bytes: Buffer.byteLength(JSON.stringify(result)) }); pruneOperations();
      }
      return result;
    }
  });
}
