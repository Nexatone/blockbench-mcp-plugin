/// <reference types="three" />
/// <reference types="blockbench-types" />
import { z } from "zod";
import { extrudeMesh, subdivideMesh, deleteMeshSelection } from "@/lib/meshEditing";
import { meshSelectionState, type MeshComponentSelection } from "@/lib/geometry";
import { createTool, type ToolSpec } from "@/lib/factories";
import {
  meshSchema,
  meshIdOptionalSchema,
  meshIdSchema,
  textureIdOptionalSchema,
  groupIdOptionalSchema,
  vector3Schema,
  meshSelectionModeEnum,
  selectionActionEnum,
} from "@/lib/zodObjects";
import { STATUS_EXPERIMENTAL, STATUS_STABLE } from "@/lib/constants";
import { getProjectTexture, getMeshOrSelected, findMeshOrThrow } from "@/lib/util";

// ============================================================================
// Mesh Tool Parameter Schemas
// ============================================================================

export const placeMeshParameters = z.object({
  elements: z
    .array(meshSchema)
    .min(1)
    .describe("Array of meshes to place."),
  texture: textureIdOptionalSchema.describe("Texture ID or name to apply to the mesh."),
  group: groupIdOptionalSchema.describe("Group/bone to which the mesh belongs."),
});

export const extrudeMeshParameters = z.object({
  mesh_id: meshIdOptionalSchema,
  distance: z.number().default(1).describe("Distance to extrude."),
  mode: z
    .enum(["faces", "edges", "vertices"])
    .default("faces")
    .describe("What to extrude: faces, edges, or vertices."),
});

export const subdivideMeshParameters = z.object({
  mesh_id: meshIdOptionalSchema,
  cuts: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(1)
    .describe("Number of subdivision cuts to make."),
});

export const createSphereParameters = z.object({
  elements: z
    .array(
      z.object({
        name: z.string().describe("Name of the sphere."),
        position: vector3Schema.describe("Position of the sphere center."),
        diameter: z
          .number()
          .min(1)
          .max(64)
          .default(16)
          .describe("Diameter of the sphere."),
        sides: z
          .number()
          .min(3)
          .max(48)
          .default(12)
          .describe(
            "Number of horizontal divisions (affects sphere quality)."
          ),
        rotation: vector3Schema
          .optional()
          .default([0, 0, 0])
          .describe("Rotation of the sphere."),
        align_edges: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether to align edges for better geometry."),
      })
    )
    .min(1)
    .describe("Array of spheres to create."),
  texture: textureIdOptionalSchema.describe("Texture ID or name to apply to the sphere."),
  group: groupIdOptionalSchema.describe("Group/bone to which the sphere belongs."),
});

export const selectMeshElementsParameters = z.object({
  mesh_id: meshIdSchema.describe("ID or name of the mesh to select elements from."),
  mode: meshSelectionModeEnum.describe("Selection mode."),
  elements: z
    .array(
      z.union([
        z
          .string()
          .describe("Vertex key, edge as 'vkey1-vkey2', or face key"),
        z.number().describe("Index of the element"),
      ])
    )
    .optional()
    .describe("Specific elements to select. If not provided, selects all."),
  action: selectionActionEnum
    .default("select")
    .describe(
      "Selection action: select (replace), add, remove, or toggle."
    ),
});

export const moveMeshVerticesParameters = z.object({
  mesh_id: meshIdOptionalSchema,
  offset: vector3Schema.describe("Offset to move vertices by [x, y, z]."),
  vertices: z
    .array(z.string())
    .optional()
    .describe(
      "Specific vertex keys to move. If not provided, moves all selected vertices."
    ),
});

export const deleteMeshElementsParameters = z.object({
  mesh_id: meshIdOptionalSchema,
  mode: z
    .enum(["vertices", "edges", "faces"])
    .default("faces")
    .describe("What to delete: vertices, edges, or faces."),
  keep_vertices: z
    .boolean()
    .default(false)
    .describe("When deleting faces/edges, whether to keep the vertices."),
});

export const mergeMeshVerticesParameters = z.object({
  mesh_id: meshIdSchema,
  threshold: z
    .number()
    .min(0)
    .max(10)
    .default(0.1)
    .describe("Maximum distance between vertices to merge."),
  selected_only: z
    .boolean()
    .default(true)
    .describe("Whether to only merge selected vertices."),
});

export const createMeshFaceParameters = z.object({
  mesh_id: meshIdOptionalSchema,
  vertices: z
    .array(z.string())
    .min(3)
    .max(4)
    .describe("Vertex keys to create face from. Must be 3 or 4 vertices."),
  texture: textureIdOptionalSchema.describe("Texture ID or name to apply to the new face."),
});

export const createCylinderParameters = z.object({
  elements: z
    .array(
      z.object({
        name: z.string(),
        position: vector3Schema,
        height: z.number().min(1).max(64).default(16),
        diameter: z.number().min(1).max(64).default(16),
        sides: z.number().min(3).max(64).default(12),
        rotation: vector3Schema.optional().default([0, 0, 0]),
        capped: z.boolean().optional().default(true),
      })
    )
    .min(1),
  texture: textureIdOptionalSchema,
  group: groupIdOptionalSchema,
});

export const knifeToolParameters = z.object({
  mesh_id: meshIdSchema.describe("ID or name of the mesh to cut."),
  points: z
    .array(
      z.object({
        position: vector3Schema.describe("3D position of the cut point."),
        face: z
          .string()
          .optional()
          .describe("Face key to attach the point to."),
      })
    )
    .min(2)
    .describe("Points defining the cut path."),
});

// ============================================================================
// Mesh Tool Docs
// ============================================================================

export const meshToolDocs: ToolSpec[] = [
  {
    name: "place_mesh",
    description:
      "Places a mesh at the specified position. Texture and group are optional.",
    annotations: {
      title: "Place Mesh",
      destructiveHint: true,
    },
    parameters: placeMeshParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "extrude_mesh",
    description: "Extrudes selected faces or edges of a mesh.",
    annotations: {
      title: "Extrude Mesh",
      destructiveHint: true,
    },
    parameters: extrudeMeshParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "subdivide_mesh",
    description: "Subdivides selected faces of a mesh to create more geometry.",
    annotations: {
      title: "Subdivide Mesh",
      destructiveHint: true,
    },
    parameters: subdivideMeshParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "create_sphere",
    description:
      "Creates a sphere mesh at the specified position with the given parameters. The sphere is created as a mesh with vertices and faces using spherical coordinates.",
    annotations: {
      title: "Create Sphere",
      destructiveHint: true,
    },
    parameters: createSphereParameters,
    status: STATUS_STABLE,
  },
  {
    name: "select_mesh_elements",
    description:
      "Selects vertices, edges, or faces of a mesh for manipulation.",
    annotations: {
      title: "Select Mesh Elements",
      destructiveHint: true,
    },
    parameters: selectMeshElementsParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "move_mesh_vertices",
    description: "Moves selected vertices of a mesh by the specified offset.",
    annotations: {
      title: "Move Mesh Vertices",
      destructiveHint: true,
    },
    parameters: moveMeshVerticesParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "delete_mesh_elements",
    description: "Deletes selected vertices, edges, or faces from a mesh.",
    annotations: {
      title: "Delete Mesh Elements",
      destructiveHint: true,
    },
    parameters: deleteMeshElementsParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "merge_mesh_vertices",
    description:
      "Merges vertices that are within a specified distance of each other.",
    annotations: {
      title: "Merge Mesh Vertices",
      destructiveHint: true,
    },
    parameters: mergeMeshVerticesParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "create_mesh_face",
    description: "Creates a new face from selected vertices.",
    annotations: {
      title: "Create Mesh Face",
      destructiveHint: true,
    },
    parameters: createMeshFaceParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "create_cylinder",
    description: "Creates one or more cylinder meshes with optional end caps.",
    annotations: { title: "Create Cylinder", destructiveHint: true },
    parameters: createCylinderParameters,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "knife_tool",
    description: "Uses the knife tool to cut custom edges into mesh faces.",
    annotations: {
      title: "Knife Tool",
      destructiveHint: true,
    },
    parameters: knifeToolParameters,
    status: STATUS_EXPERIMENTAL,
  },
];

// ============================================================================
// Registration
// ============================================================================

export function registerMeshTools() {
  createTool(meshToolDocs[0].name, {
    ...meshToolDocs[0],
    async execute({ elements, texture, group }, { reportProgress }) {
      const total = elements.length;

      const projectTexture = texture
        ? getProjectTexture(texture)
        : Texture.getDefault();

      if (texture && !projectTexture) {
        throw new Error(`No texture found for "${texture}".`);
      }

      // @ts-expect-error getAllGroups is a utility function that returns all groups in the project
      const groups = getAllGroups();
      const outlinerGroup = group === "root"
        ? "root"
        : groups.find((g: Group) => g.name === group || g.uuid === group) ?? "root";

      Undo.initEdit({ elements: [], outliner: true, collections: [] });
      const meshes = elements.map((element, progress) => {
        const mesh = new Mesh({
          name: element.name,
          vertices: {},
        }).init();

        element.vertices.forEach((vertex) => {
          mesh.addVertices(vertex as ArrayVector3);
        });

        mesh.addTo(outlinerGroup);
        if (projectTexture) mesh.applyTexture(projectTexture);

        reportProgress({
          progress,
          total,
        });

        return mesh;
      });

      Undo.finishEdit("Agent placed meshes", { elements: meshes, outliner: true });
      Canvas.updateAll();

      return await Promise.resolve(
        JSON.stringify(
          meshes.map((mesh) => `Added mesh ${mesh.name} with ID ${mesh.uuid}`)
        )
      );
    },
  }, meshToolDocs[0].status);

  createTool(meshToolDocs[1].name, {
    ...meshToolDocs[1],
    async execute({ mesh_id, distance, mode }) {
      const mesh = getMeshOrSelected(mesh_id);

      extrudeMesh(mesh, mode, distance);

      return `Extruded ${mode} of mesh "${mesh.name}" by ${distance} units`;
    },
  }, meshToolDocs[1].status);

  createTool(meshToolDocs[2].name, {
    ...meshToolDocs[2],
    async execute({ mesh_id, cuts }) {
      const mesh = getMeshOrSelected(mesh_id);

      subdivideMesh(mesh, cuts);

      return `Subdivided mesh "${mesh.name}" with ${cuts} cuts`;
    },
  }, meshToolDocs[2].status);

  createTool(meshToolDocs[3].name, {
    ...meshToolDocs[3],
    async execute({ elements, texture, group }, { reportProgress }) {
      const total = elements.length;

      const projectTexture = texture
        ? getProjectTexture(texture)
        : Texture.getDefault();

      if (texture && !projectTexture) {
        throw new Error(`No texture found for "${texture}".`);
      }

      // @ts-expect-error getAllGroups is a utility function that returns all groups in the project
      const groups = getAllGroups();
      const outlinerGroup = group === "root"
        ? "root"
        : groups.find((g: Group) => g.name === group || g.uuid === group) ?? "root";

      Undo.initEdit({ elements: [], outliner: true, collections: [] });
      const spheres = elements.map((element, progress) => {
        const mesh = new Mesh({
          name: element.name,
          vertices: {},
          origin: element.position as [number, number, number],
          rotation: (element.rotation || [0, 0, 0]) as [
            number,
            number,
            number
          ],
        }).init();

        // Create sphere vertices using spherical coordinates
        const radius = element.diameter / 2;
        const sides = Math.round(element.sides / 2) * 2; // Ensure even number for symmetry

        // Add top and bottom vertices
        const [bottom] = mesh.addVertices([0, -radius, 0]);
        const [top] = mesh.addVertices([0, radius, 0]);

        const rings: string[][] = [];
        const off_ang = element.align_edges ? 0.5 : 0;

        // Create rings of vertices
        for (let i = 0; i < element.sides; i++) {
          const circle_x = Math.sin(
            ((i + off_ang) / element.sides) * Math.PI * 2
          );
          const circle_z = Math.cos(
            ((i + off_ang) / element.sides) * Math.PI * 2
          );

          const vertices: string[] = [];
          for (let j = 1; j < sides / 2; j++) {
            const slice_x = Math.sin((j / sides) * Math.PI * 2) * radius;
            const x = circle_x * slice_x;
            const y = Math.cos((j / sides) * Math.PI * 2) * radius;
            const z = circle_z * slice_x;
            vertices.push(...mesh.addVertices([x, y, z]));
          }
          rings.push(vertices);
        }

        // Create faces
        for (let i = 0; i < element.sides; i++) {
          const this_ring = rings[i];
          const next_ring = rings[i + 1] || rings[0];

          for (let j = 0; j < sides / 2; j++) {
            if (j == 0) {
              // Connect to top vertex
              mesh.addFaces(
                new MeshFace(mesh, {
                  vertices: [this_ring[j], next_ring[j], top],
                  uv: {},
                })
              );
              continue;
            }

            if (!this_ring[j]) {
              // Connect to bottom vertex
              mesh.addFaces(
                new MeshFace(mesh, {
                  vertices: [next_ring[j - 1], this_ring[j - 1], bottom],
                  uv: {},
                })
              );
              continue;
            }

            // Connect ring segments
            mesh.addFaces(
              new MeshFace(mesh, {
                vertices: [
                  this_ring[j],
                  next_ring[j],
                  this_ring[j - 1],
                  next_ring[j - 1],
                ],
                uv: {},
              })
            );
          }
        }

        mesh.addTo(outlinerGroup);
        if (projectTexture) {
          mesh.applyTexture(projectTexture);
        }

        reportProgress({
          progress,
          total,
        });

        return mesh;
      });

      Undo.finishEdit("Agent created spheres", { elements: spheres, outliner: true });
      Canvas.updateAll();

      return await Promise.resolve(
        JSON.stringify(
          spheres.map(
            (sphere) => `Added sphere ${sphere.name} with ID ${sphere.uuid}`
          )
        )
      );
    },
  }, meshToolDocs[3].status);

  createTool(meshToolDocs[4].name, {
    ...meshToolDocs[4],
    async execute({ mesh_id, mode, elements, action }) {
      const mesh = findMeshOrThrow(mesh_id);

      const all = mode === "vertex" ? Object.keys(mesh.vertices) : mode === "face" ? Object.keys(mesh.faces) :
        [...new Set(Object.values(mesh.faces).flatMap(face => face.getEdges().map(edge => [...edge].sort().join("-"))))];
      const requested = (elements?.length ? elements.map(String) : all).map((key: string) => mode === "edge" ? key.split("-").sort().join("-") : key);
      for (const key of requested) if (!all.includes(key)) throw new Error("Unknown " + mode + " key: " + key);
      const previous = meshSelectionState()[mesh.uuid];
      const selection: MeshComponentSelection = previous ? structuredClone(previous) : { vertices: [], edges: [], faces: [] };
      const field = mode === "vertex" ? "vertices" : mode === "face" ? "faces" : "edges";
      const selected = new Set<string>(action === "select" ? [] : mode === "edge" ? selection.edges.map(edge => [...edge].sort().join("-")) : selection[field] as string[]);
      for (const key of requested) {
        if (action === "remove" || (action === "toggle" && selected.has(key))) selected.delete(key);
        else selected.add(key);
      }
      if (mode === "vertex") { selection.vertices = [...selected]; selection.edges = []; selection.faces = []; }
      else if (mode === "face") {
        selection.faces = [...selected]; selection.edges = [];
        selection.vertices = [...new Set(selection.faces.flatMap(key => mesh.faces[key].vertices))];
      } else {
        selection.edges = [...selected].map(key => key.split("-") as [string, string]); selection.faces = [];
        selection.vertices = [...new Set(selection.edges.flat())];
      }
      Undo.initEdit({ elements: [mesh], selection: true });
      // Selecting a mesh can clear component selection; install the mask afterwards.
      mesh.select();
      (BarItems.selection_mode as BarSelect<string>).set(mode);
      meshSelectionState()[mesh.uuid] = selection;
      Canvas.updateView({
        elements: [mesh],
        selection: true,
      });

      Undo.finishEdit("Select mesh elements");

      return JSON.stringify({
        mesh: mesh.name,
        mode,
        selected: {
          vertices: selection.vertices.length,
          edges: selection.edges.length,
          faces: selection.faces.length,
        },
      });
    },
  }, meshToolDocs[4].status);

  createTool(meshToolDocs[5].name, {
    ...meshToolDocs[5],
    async execute({ mesh_id, offset, vertices }) {
      const mesh = getMeshOrSelected(mesh_id);

      Undo.initEdit({
        elements: [mesh],
        element_aspects: {
          geometry: true,
          uv: true,
          faces: true,
        },
      });

      const verticesToMove = vertices || mesh.getSelectedVertices();

      verticesToMove.forEach((vkey) => {
        if (mesh.vertices[vkey]) {
          mesh.vertices[vkey][0] += offset[0];
          mesh.vertices[vkey][1] += offset[1];
          mesh.vertices[vkey][2] += offset[2];
        }
      });

      mesh.preview_controller.updateGeometry(mesh);

      Undo.finishEdit("Move mesh vertices");
      Canvas.updateView({
        elements: [mesh],
        element_aspects: {
          geometry: true,
          uv: true,
          faces: true,
        },
      });

      return `Moved ${verticesToMove.length} vertices of mesh "${mesh.name}"`;
    },
  }, meshToolDocs[5].status);

  createTool(meshToolDocs[6].name, {
    ...meshToolDocs[6],
    async execute({ mesh_id, mode, keep_vertices }) {
      const mesh = getMeshOrSelected(mesh_id);

      deleteMeshSelection(mesh, mode, keep_vertices);

      return `Deleted selected ${mode} from mesh "${mesh.name}"`;
    },
  }, meshToolDocs[6].status);

  createTool(meshToolDocs[7].name, {
    ...meshToolDocs[7],
    async execute({ mesh_id, threshold, selected_only }) {
      const mesh = findMeshOrThrow(mesh_id);

      Undo.initEdit({
        elements: [mesh],
        element_aspects: {
          geometry: true,
          uv: true,
          faces: true,
        },
      });

      const verticesToCheck = selected_only
        ? mesh.getSelectedVertices()
        : Object.keys(mesh.vertices);

      let mergedCount = 0;
      const mergeMap: Record<string, string> = {};

      // Find vertices to merge
      for (let i = 0; i < verticesToCheck.length; i++) {
        const vkey1 = verticesToCheck[i];
        if (mergeMap[vkey1]) continue;

        for (let j = i + 1; j < verticesToCheck.length; j++) {
          const vkey2 = verticesToCheck[j];
          if (mergeMap[vkey2]) continue;

          const v1 = mesh.vertices[vkey1];
          const v2 = mesh.vertices[vkey2];
          const distance = Math.sqrt(
            (v1[0] - v2[0]) ** 2 + (v1[1] - v2[1]) ** 2 + (v1[2] - v2[2]) ** 2
          );

          if (distance <= threshold) {
            mergeMap[vkey2] = vkey1;
            mergedCount++;
          }
        }
      }

      // Apply merges
      Object.entries(mergeMap).forEach(([oldKey, newKey]) => {
        // Update faces
        for (const fkey in mesh.faces) {
          const face = mesh.faces[fkey];
          const index = face.vertices.indexOf(oldKey);
          if (index !== -1) {
            face.vertices[index] = newKey;
            face.uv[newKey] ??= face.uv[oldKey] || [0, 0];
            delete face.uv[oldKey];
            face.vertices = [...new Set(face.vertices)];
            if (face.vertices.length < 3) delete mesh.faces[fkey];
          }
        }
        // Remove merged vertex
        delete mesh.vertices[oldKey];
      });

      mesh.preview_controller.updateGeometry(mesh);

      Undo.finishEdit("Merge mesh vertices");
      Canvas.updateView({
        elements: [mesh],
        element_aspects: {
          geometry: true,
          uv: true,
          faces: true,
        },
      });

      return `Merged ${mergedCount} vertices in mesh "${mesh.name}"`;
    },
  }, meshToolDocs[7].status);

  createTool(meshToolDocs[8].name, {
    ...meshToolDocs[8],
    async execute({ mesh_id, vertices, texture }) {
      const mesh = getMeshOrSelected(mesh_id);

      Undo.initEdit({
        elements: [mesh],
        element_aspects: {
          geometry: true,
          uv: true,
          faces: true,
        },
      });

      // Create the face
      const face = new MeshFace(mesh, {
        vertices,
        texture: texture ? getProjectTexture(texture)?.uuid : undefined,
      });

      const [faceKey] = mesh.addFaces(face);

      // Auto UV the new face
      UVEditor.setAutoSize(null, true, [faceKey]);

      mesh.preview_controller.updateGeometry(mesh);
      mesh.preview_controller.updateUV(mesh);

      Undo.finishEdit("Create mesh face");
      Canvas.updateView({
        elements: [mesh],
        element_aspects: {
          geometry: true,
          uv: true,
          faces: true,
        },
      });

      return `Created face with ${vertices.length} vertices in mesh "${mesh.name}"`;
    },
  }, meshToolDocs[8].status);

  createTool(meshToolDocs[9].name, {
    ...meshToolDocs[9],
    async execute({ elements, texture, group }, { reportProgress }) {
      const total = elements.length;
      const projectTexture = texture
        ? getProjectTexture(texture)
        : Texture.getDefault();
      if (texture && !projectTexture) throw new Error(`Texture "${texture}" not found.`);
      // @ts-expect-error getAllGroups is a utility function that returns all groups in the project
      const groups = getAllGroups();
      const outlinerGroup = group === "root"
        ? "root"
        : groups.find((g: Group) => g.name === group || g.uuid === group) ?? "root";
      Undo.initEdit({ elements: [], outliner: true, collections: [] });
      const cylinders = elements.map((element, progress) => {
        const mesh = new Mesh({
          name: element.name,
          vertices: {},
          origin: element.position as [number, number, number],
          rotation: (element.rotation || [0, 0, 0]) as [
            number,
            number,
            number
          ],
        }).init();
        const radius = element.diameter / 2;
        const height = element.height;
        const sides = Math.round(element.sides);
        // centres for the caps
        const topCenter = mesh.addVertices([0, height / 2, 0])[0];
        const bottomCenter = mesh.addVertices([0, -height / 2, 0])[0];
        const topRing: any[] = [];
        const bottomRing: any[] = [];
        for (let i = 0; i < sides; i++) {
          const ang = (i / sides) * Math.PI * 2;
          const x = Math.cos(ang) * radius;
          const z = Math.sin(ang) * radius;
          topRing.push(mesh.addVertices([x, height / 2, z])[0]);
          bottomRing.push(mesh.addVertices([x, -height / 2, z])[0]);
        }
        for (let i = 0; i < sides; i++) {
          const next = (i + 1) % sides;
          // side face
          mesh.addFaces(
            new MeshFace(mesh, {
              vertices: [
                bottomRing[i],
                bottomRing[next],
                topRing[next],
                topRing[i],
              ],
              uv: {},
            })
          );
          if (element.capped) {
            // top cap (triangle fan)
            mesh.addFaces(
              new MeshFace(mesh, {
                vertices: [topRing[i], topRing[next], topCenter],
                uv: {},
              })
            );
            // bottom cap
            mesh.addFaces(
              new MeshFace(mesh, {
                vertices: [bottomRing[next], bottomRing[i], bottomCenter],
                uv: {},
              })
            );
          }
        }
        mesh.addTo(outlinerGroup);
        if (projectTexture) mesh.applyTexture(projectTexture);
        reportProgress({ progress, total });
        return mesh;
      });
      Undo.finishEdit("Agent created cylinders", { elements: cylinders, outliner: true });
      Canvas.updateAll();
      return JSON.stringify(
        cylinders.map((c) => `Added cylinder ${c.name} (ID ${c.uuid})`)
      );
    },
  }, meshToolDocs[9].status);

  createTool(meshToolDocs[10].name, {
    ...meshToolDocs[10],
    async execute({ mesh_id, points }) {
      const mesh = findMeshOrThrow(mesh_id);

      Undo.initEdit({
        elements: [mesh],
        element_aspects: {
          geometry: true,
          uv: true,
          faces: true,
        },
      });

      // Create knife tool context
      // @ts-ignore
      const knifeContext = new KnifeToolContext(mesh);

      // Add points to the knife path
      points.forEach((point) => {
        knifeContext.points.push({
          position: new THREE.Vector3(...point.position),
          fkey: point.face,
          type: point.face ? "face" : "edge",
        });
      });

      // Apply the knife cut
      knifeContext.apply();

      Undo.finishEdit("Knife cut mesh");
      Canvas.updateView({
        elements: [mesh],
        element_aspects: {
          geometry: true,
          uv: true,
          faces: true,
        },
      });

      return `Applied knife cut to mesh "${mesh.name}" with ${points.length} points`;
    },
  }, meshToolDocs[10].status);
}
