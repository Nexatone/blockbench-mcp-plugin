import { resolveMaterialChannels, assignMaterialChannel, refreshMaterials } from "@/lib/material";
import { loadTextureImage } from "@/lib/textureImage";
import { textureSetSchema } from "@/lib/textureSet";
/// <reference types="three" />
/// <reference types="blockbench-types" />
import { z } from "zod";
import { requireIdleEdit } from "@/lib/editorExecution";
import { createTool, jsonResult, type ToolSpec } from "@/lib/factories";
import { projectRevision } from "@/lib/modelState";
import {
  getProjectTexture,
  imageContent,
  findElementOrThrow,
  findTextureOrThrow,
  findTextureGroupOrThrow,
  getChannelTextureInfo,
} from "@/lib/util";
import { STATUS_STABLE } from "@/lib/constants";
import {
  colorSchema,
  elementIdSchema,
  textureIdSchema,
  textureIdOptionalSchema,
  pbrChannelEnum,
  renderModeEnum,
  renderSidesEnum,
} from "@/lib/zodObjects";

// ============================================================================
// Texture Tool Parameter Schemas
// ============================================================================

export const createTextureParameters = z
  .object({
    name: z.string(),
    include_preview: z.boolean().default(true).describe("Return the existing texture image by default; false returns only metadata and UUIDs."),
    width: z.number().int().min(16).max(4096).default(16),
    height: z.number().int().min(16).max(4096).default(16),
    data: z
      .string()
      .optional()
      .describe("Path to the image file or data URL."),
    group: z.string().optional(),
    fill_color: colorSchema
      .optional()
      .describe("RGBA color to fill the texture, as tuple or HEX string."),
    layer_name: z
      .string()
      .optional()
      .describe(
        "Name of the texture layer. Required if fill_color is set."
      ),
    pbr_channel: pbrChannelEnum
      .optional()
      .describe(
        "PBR channel to use for the texture. Color, normal, height, or Metalness/Emissive/Roughness (MER) map."
      ),
    render_mode: renderModeEnum
      .optional()
      .default("default")
      .describe(
        "Render mode for the texture. Default, emissive, additive, or layered."
      ),
    render_sides: renderSidesEnum
      .optional()
      .default("auto")
      .describe("Render sides for the texture. Auto, front, or double."),
  })
  .refine((params) => !(params.data && params.fill_color), {
    message:
      "The 'data' and 'fill_color' properties cannot both be defined.",
    path: ["data", "fill_color"],
  })
  .refine((params) => !(params.fill_color && !params.layer_name), {
    message:
      "The 'layer_name' property is required when 'fill_color' is set.",
    path: ["layer_name", "fill_color"],
  })
  .refine(
    ({ pbr_channel, group }) => (pbr_channel && group) || !pbr_channel,
    {
      message:
        "The 'group' property is required when 'pbr_channel' is set.",
      path: ["group", "pbr_channel"],
    }
  );

export const applyTextureParameters = z.object({
  id: elementIdSchema.describe("ID or name of the element to apply the texture to."),
  texture: textureIdSchema.describe("ID or name of the texture to apply."),
  applyTo: z
    .enum(["all", "blank", "none"])
    .describe("Apply texture to element or group.")
    .optional()
    .default("blank"),
});

export const addTextureGroupParameters = z.object({
  name: z.string(),
  textures: z
    .array(z.string())
    .optional()
    .describe("Array of texture IDs or names to add to the group."),
  is_material: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether the texture group is a PBR material or not."),
});

export const listTexturesParameters = z.object({});

export const getTextureParameters = z.object({
  texture: textureIdOptionalSchema,
});

export const activateTextureParameters = z.object({
  texture: textureIdSchema.describe(
    "Texture ID, UUID, or name to activate in the texture panel."
  ),
});

export const createPbrMaterialParameters = z.object({
  name: z.string().describe("Name of the material."),
  color_texture: z
    .string()
    .optional()
    .describe("Texture ID/name for the color (albedo) channel."),
  normal_texture: z
    .string()
    .optional()
    .describe("Texture ID/name for the normal map channel."),
  height_texture: z
    .string()
    .optional()
    .describe("Texture ID/name for the height/displacement map channel."),
  mer_texture: z
    .string()
    .optional()
    .describe(
      "Texture ID/name for the MER (Metalness/Emissive/Roughness) channel."
    ),
  color_value: z
    .array(z.number().min(0).max(255))
    .length(4)
    .optional()
    .describe(
      "Uniform RGBA color [R,G,B,A] when no color texture is provided."
    ),
  mer_value: z
    .array(z.number().min(0).max(255))
    .length(3)
    .optional()
    .describe(
      "Uniform MER values [Metalness, Emissive, Roughness] (0-255) when no MER texture is provided."
    ),
  subsurface_value: z
    .number()
    .min(0)
    .max(255)
    .optional()
    .describe(
      "Subsurface scattering value (0-255) for Bedrock 1.21.30+ materials."
    ),
});

export const configureMaterialParameters = z.object({
  material: z.string().describe("Material name or UUID to configure."),
  color_texture: z
    .string()
    .optional()
    .describe(
      "Texture ID/name for the color channel, or 'none' to use uniform color."
    ),
  normal_texture: z
    .string()
    .optional()
    .describe(
      "Texture ID/name for the normal map, or 'none' to remove."
    ),
  height_texture: z
    .string()
    .optional()
    .describe(
      "Texture ID/name for the height map, or 'none' to remove."
    ),
  mer_texture: z
    .string()
    .optional()
    .describe(
      "Texture ID/name for MER channel, or 'none' to use uniform values."
    ),
  color_value: z
    .array(z.number().min(0).max(255))
    .length(4)
    .optional()
    .describe("Uniform RGBA color [R,G,B,A] when no color texture."),
  mer_value: z
    .array(z.number().min(0).max(255))
    .length(3)
    .optional()
    .describe(
      "Uniform MER values [Metalness, Emissive, Roughness] (0-255)."
    ),
  subsurface_value: z
    .number()
    .min(0)
    .max(255)
    .optional()
    .describe("Subsurface scattering value (0-255)."),
});

export const listMaterialsParameters = z.object({});

export const getMaterialInfoParameters = z.object({
  material: z.string().describe("Material name or UUID."),
});

export const importTextureSetParameters = z.object({
  path: z
    .string()
    .describe(
      "Path to the .texture_set.json file to import."
    ),
});

export const assignTextureChannelParameters = z.object({
  material: z.string().describe("Material name or UUID."),
  texture: textureIdSchema.describe("Texture name or UUID to assign."),
  channel: pbrChannelEnum.describe("PBR channel to assign the texture to."),
});

export const saveMaterialConfigParameters = z.object({
  material: z.string().describe("Material name or UUID to save."),
});

// ============================================================================
// Texture Tool Docs
// ============================================================================

export const textureToolDocs: ToolSpec[] = [
  {
    name: "create_texture",
    description: "Creates a new texture with the given name and size.",
    annotations: {
      title: "Create Texture",
      destructiveHint: true,
      openWorldHint: true,
    },
    parameters: createTextureParameters,
    outputSchema: z.object({project_uuid:z.string(),revision:z.string(),texture_uuid:z.string(),width:z.number(),height:z.number(),layer_ids:z.array(z.string())}),
    status: STATUS_STABLE,
  },
  {
    name: "apply_texture",
    description:
      "Applies the given texture to the element with the specified ID.",
    annotations: {
      title: "Apply Texture",
      destructiveHint: true,
    },
    parameters: applyTextureParameters,
    status: STATUS_STABLE,
  },
  {
    name: "add_texture_group",
    description: "Adds a new texture group with the given name.",
    annotations: {
      title: "Add Texture Group",
      destructiveHint: true,
    },
    parameters: addTextureGroupParameters,
    status: STATUS_STABLE,
  },
  {
    name: "list_textures",
    description: "Returns a list of all textures in the Blockbench editor.",
    annotations: {
      title: "List Textures",
      readOnlyHint: true,
    },
    parameters: listTexturesParameters,
    status: STATUS_STABLE,
  },
  {
    name: "get_texture",
    description:
      "Returns the image data of the given texture or default texture.",
    annotations: {
      title: "Get Texture",
      readOnlyHint: true,
    },
    parameters: getTextureParameters,
    status: STATUS_STABLE,
  },
  {
    name: "create_pbr_material",
    description:
      "Creates a new PBR material (texture group with is_material=true) and optionally assigns textures to PBR channels. Use this for Minecraft Bedrock resource packs or any format supporting PBR.",
    annotations: {
      title: "Create PBR Material",
      destructiveHint: true,
    },
    parameters: createPbrMaterialParameters,
    status: STATUS_STABLE,
  },
  {
    name: "configure_material",
    description:
      "Configures an existing PBR material's properties including channel assignments, uniform values, and subsurface scattering.",
    annotations: {
      title: "Configure Material",
      destructiveHint: true,
    },
    parameters: configureMaterialParameters,
    status: STATUS_STABLE,
  },
  {
    name: "list_materials",
    description:
      "Lists all PBR materials (texture groups with is_material=true) and their assigned textures per channel.",
    annotations: {
      title: "List Materials",
      readOnlyHint: true,
    },
    parameters: listMaterialsParameters,
    status: STATUS_STABLE,
  },
  {
    name: "get_material_info",
    description:
      "Gets detailed information about a PBR material including the compiled texture_set.json preview for Bedrock export.",
    annotations: {
      title: "Get Material Info",
      readOnlyHint: true,
    },
    parameters: getMaterialInfoParameters,
    status: STATUS_STABLE,
  },
  {
    name: "import_texture_set",
    description:
      "Imports a Minecraft Bedrock texture_set.json material. Validates constants and decodes referenced PNG/TGA images before adding the material in one Undo step. Missing/invalid images and image paths already used in the project or set are rejected without changing the model. Configure existing materials instead of importing their images again.",
    annotations: {
      title: "Import Texture Set",
      destructiveHint: true,
      openWorldHint: true,
    },
    parameters: importTextureSetParameters,
    status: STATUS_STABLE,
  },
  {
    name: "assign_texture_channel",
    description:
      "Assigns a texture to a specific PBR channel within a material.",
    annotations: {
      title: "Assign Texture Channel",
      destructiveHint: true,
    },
    parameters: assignTextureChannelParameters,
    status: STATUS_STABLE,
  },
  {
    name: "save_material_config",
    description:
      "Saves the material's texture_set.json file to disk (Bedrock format). Requires the color texture to have a valid file path.",
    annotations: {
      title: "Save Material Config",
      destructiveHint: true,
      openWorldHint: true,
    },
    parameters: saveMaterialConfigParameters,
    status: STATUS_STABLE,
  },
  {
    name: "activate_texture",
    description:
      "Activates the given texture in the Blockbench texture panel so that subsequent paint operations (draw_shape_tool, paint_with_brush, gradient_tool, etc.) target it. Most paint tools already call this internally when a texture_id is provided, but you can invoke it explicitly to pin the active texture across multiple calls.",
    annotations: {
      title: "Activate Texture",
      destructiveHint: false,
      idempotentHint: true,
    },
    parameters: activateTextureParameters,
    status: STATUS_STABLE,
  },
];

// ============================================================================
// Tool Registration
// ============================================================================

export function registerTextureTools() {
  createTool(textureToolDocs[0].name, {
    ...textureToolDocs[0],
    parameters: createTextureParameters,
    async execute({
      name,
      width,
      height,
      data,
      pbr_channel,
      render_mode,
      render_sides,
      fill_color,
      group,
      layer_name,
      include_preview,
    }, context) {
      const targetProject = Project;
      if (!targetProject) throw new Error("Open a project before creating a texture.");
      let texture = new Texture({
        name,
        width,
        height,
        group,
        pbr_channel,
        render_mode,
        render_sides,
        internal: true,
      });

      if (data) {
        await loadTextureImage(texture, () => {
        if (data.startsWith("data:image/")) {
          texture.source = data;
          texture.width = width;
          texture.height = height;
        } else {
          texture = texture.fromFile({
            name: data.split(/[\/\\]/).pop() || data,
            path: data.replace(/^file:\/\//, ""),
          });
        }

        texture.load();
        });
        texture.fillParticle();
        texture.layers_enabled = false;
      } else {
        const { canvas, ctx } = texture.getActiveCanvas();
        // Texture constructor dimensions do not resize its default 16x16 canvas.
        // Size the bitmap before drawing; project UV resolution is independent.
        canvas.width = width;
        canvas.height = height;

        if (fill_color) {
          const color = Array.isArray(fill_color)
            // @ts-ignore - tinycolor is available globally in Blockbench
            ? tinycolor({
              r: Number(fill_color[0]),
              g: Number(fill_color[1]),
              b: Number(fill_color[2]),
              a: Number(fill_color[3] ?? 255) / 255,
            })
            // @ts-ignore - tinycolor ok
            : tinycolor(fill_color);

          ctx.fillStyle = color.toRgbString().toLowerCase();
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Layer creation reads native texture.width/height, which are populated
        // by image decoding rather than the constructor's options.
        await loadTextureImage(texture, () => texture.updateSource(ctx.canvas.toDataURL("image/png", 1)));
        texture.updateLayerChanges(true);
      }

      if (!data && layer_name) {
        texture.activateLayers(false);
        texture.layers[0].name = layer_name;
      }
      if (Project !== targetProject) throw new Error("The active project changed while the image loaded. Retry in the intended project.");
      context?.signal?.throwIfAborted();
      requireIdleEdit();
      Undo.initEdit({ textures: [], bitmap: true });
      texture.add();

      Undo.finishEdit("Agent created texture", { textures: [texture], bitmap: true });
      Canvas.updateAll();

      const result = jsonResult({project_uuid:targetProject.uuid,revision:projectRevision(targetProject),texture_uuid:texture.uuid,width:texture.width,height:texture.height,layer_ids:texture.layers.map(layer=>layer.uuid)});
      if (include_preview) result.content.unshift(...imageContent({url:texture.getDataURL()}).content);
      return result;
    },
  }, textureToolDocs[0].status);

  createTool(textureToolDocs[1].name, {
    ...textureToolDocs[1],
    async execute({ applyTo, id, texture }) {
      const element = findElementOrThrow(id);
      const projectTexture = texture
        ? findTextureOrThrow(texture)
        : Texture.getDefault();

      if (!projectTexture) {
        throw new Error(
          "No default texture available. Use the create_texture tool to create one first."
        );
      }

      // Resolve `id` to the concrete set of cubes/meshes to texture.
      // - Group → all descendant cubes + meshes
      // - Cube / Mesh → that single element
      const targets: Array<Cube | Mesh> = [];
      if (element instanceof Group) {
        const collectDescendants = (group: Group) => {
          for (const child of group.children ?? []) {
            if (child instanceof Cube || child instanceof Mesh) {
              targets.push(child);
              continue;
            }
            if (child instanceof Group) collectDescendants(child);
          }
        };
        collectDescendants(element);
      } else if (element instanceof Cube || element instanceof Mesh) {
        targets.push(element);
      } else {
        throw new Error(
          `Element "${id}" is not a cube, mesh, or group — cannot apply texture to it.`
        );
      }

      if (targets.length === 0) {
        throw new Error(
          `Element "${id}" resolved to no paintable cubes or meshes.`
        );
      }

      // Save prior selection so the call is non-destructive to UI state.
      const prevCubeSelection = [...Cube.selected];
      const prevMeshSelection = [...Mesh.selected];
      const prevGroup = Group.selected ?? null;

      // Undo must capture the element face-texture state, not just outliner.
      Undo.initEdit({
        elements: targets,
        outliner: false,
        collections: [],
      });

      try {
        // Replace selection with the resolved targets so Texture.apply()
        // operates on exactly this scope.
        Cube.all.forEach((c: Cube) => {
          if (c.selected) c.unselect?.();
        });
        Mesh.all.forEach((m: Mesh) => {
          if (m.selected) m.unselect?.();
        });
        for (const target of targets) {
          // @ts-ignore - select method available on outliner elements
          target.select?.({ shiftKey: true });
        }
        updateSelection();

        projectTexture.select();

        Texture.selected?.apply(
          applyTo === "none" ? false : applyTo === "all" ? true : "blank"
        );

        projectTexture.updateChangesAfterEdit();
      } finally {
        // Restore the caller's original selection.
        Cube.all.forEach((c: Cube) => {
          if (c.selected) c.unselect?.();
        });
        Mesh.all.forEach((m: Mesh) => {
          if (m.selected) m.unselect?.();
        });
        for (const c of prevCubeSelection) {
          // @ts-ignore - select method
          c.select?.({ shiftKey: true });
        }
        for (const m of prevMeshSelection) {
          // @ts-ignore - select method
          m.select?.({ shiftKey: true });
        }
        if (prevGroup) prevGroup.selected = true;
        updateSelection();
      }

      Undo.finishEdit("Agent applied texture");

      // Force face-level render refresh so the viewport matches the data.
      // Canvas.updateAll() alone sometimes doesn't push new face materials
      // into the THREE.js render targets.
      Canvas.updateView({
        elements: targets,
        element_aspects: { faces: true, uv: true, geometry: false },
      });
      Canvas.updateAll();

      return `Applied texture "${projectTexture.name}" to ${targets.length} element(s) scoped by "${id}" (${element instanceof Group ? "group" : element instanceof Cube ? "cube" : "mesh"}).`;
    },
  }, textureToolDocs[1].status);

  createTool(textureToolDocs[2].name, {
    ...textureToolDocs[2],
    async execute({ name, textures, is_material }) {
      const textureList: Texture[] = (textures ?? []).map(findTextureOrThrow);
      if (is_material && new Set(textureList.map(t => t.pbr_channel)).size !== textureList.length) {
        throw new Error("Material groups allow one texture per channel.");
      }
      const affectedGroups = TextureGroup.all.filter(g => textureList.some(t => t.group === g.uuid));
      Undo.initEdit({ texture_groups: affectedGroups, textures: textureList });
      const textureGroup = new TextureGroup({ name, is_material }).add();
      for (const texture of textureList) texture.group = textureGroup.uuid;
      refreshMaterials([...affectedGroups, textureGroup]);
      Undo.finishEdit("Agent added texture group", { texture_groups: [...affectedGroups, textureGroup], textures: textureList });
      Canvas.updateAll();

      return `Added texture group ${textureGroup.name} with ID ${textureGroup.uuid}`;
    },
  }, textureToolDocs[2].status);

  createTool(textureToolDocs[3].name, {
    ...textureToolDocs[3],
    async execute() {
      const textures = Project?.textures ?? Texture.all;

      return JSON.stringify(
        textures.map((texture) => ({
          name: texture.name,
          uuid: texture.uuid,
          id: texture.id,
          group: texture.group,
        }))
      );
    },
  }, textureToolDocs[3].status);

  createTool(textureToolDocs[4].name, {
    ...textureToolDocs[4],
    async execute({ texture }) {
      if (!texture) {
        const defaultTexture = Texture.getDefault();
        if (!defaultTexture) {
          throw new Error(
            "No default texture available. Use the create_texture tool to create one first, or specify a texture ID."
          );
        }
        return imageContent({ url: defaultTexture.getDataURL() });
      }

      const image = findTextureOrThrow(texture);
      return imageContent({ url: image.getDataURL() });
    },
  }, textureToolDocs[4].status);

  createTool(textureToolDocs[5].name, {
    ...textureToolDocs[5],
    async execute({
      name,
      color_texture,
      normal_texture,
      height_texture,
      mer_texture,
      color_value,
      mer_value,
      subsurface_value,
    }) {
      const channels = resolveMaterialChannels({ color: color_texture, normal: normal_texture, height: height_texture, mer: mer_texture });
      const texturesToAdd = channels.flatMap(entry => entry.texture ? [entry.texture] : []);
      const affectedGroups = TextureGroup.all.filter(g => texturesToAdd.some(t => t.group === g.uuid));
      Undo.initEdit({ texture_groups: affectedGroups, textures: texturesToAdd });

      // @ts-ignore - TextureGroup is globally available
      const textureGroup = new TextureGroup({
        name,
        is_material: true,
      });

      // Set material config values
      if (color_value) {
        textureGroup.material_config.color_value = color_value;
      }
      if (mer_value) {
        textureGroup.material_config.mer_value = mer_value;
      }
      if (subsurface_value !== undefined) {
        textureGroup.material_config.subsurface_value = subsurface_value;
      }
      textureGroup.material_config.saved = false;

      textureGroup.add();

      for (const { channel, texture } of channels) assignMaterialChannel(textureGroup, texture, channel);
      refreshMaterials([...affectedGroups, textureGroup]);
      Undo.finishEdit("Agent created PBR material", { texture_groups: [...affectedGroups, textureGroup], textures: texturesToAdd });
      Canvas.updateAll();

      return JSON.stringify({
        success: true,
        material: {
          name: textureGroup.name,
          uuid: textureGroup.uuid,
          is_material: true,
          channels: {
            color: color_texture ? true : !!color_value,
            normal: !!normal_texture,
            height: !!height_texture,
            mer: mer_texture ? true : !!mer_value,
          },
        },
      });
    },
  }, textureToolDocs[5].status);

  createTool(textureToolDocs[6].name, {
    ...textureToolDocs[6],
    async execute({
      material,
      color_texture,
      normal_texture,
      height_texture,
      mer_texture,
      color_value,
      mer_value,
      subsurface_value,
    }) {
      const textureGroup = findTextureGroupOrThrow(material);
      const channels = resolveMaterialChannels({ color: color_texture, normal: normal_texture, height: height_texture, mer: mer_texture });
      const textures = [...new Set([...textureGroup.getTextures(), ...channels.flatMap(entry => entry.texture ? [entry.texture] : [])])];
      const affectedGroups = TextureGroup.all.filter(g => g === textureGroup || textures.some(t => t.group === g.uuid));
      Undo.initEdit({ texture_groups: affectedGroups, textures });
      for (const { channel, texture } of channels) assignMaterialChannel(textureGroup, texture, channel);
      refreshMaterials(affectedGroups);

      // Update uniform values
      if (color_value) {
        textureGroup.material_config.color_value = color_value;
      }
      if (mer_value) {
        textureGroup.material_config.mer_value = mer_value;
      }
      if (subsurface_value !== undefined) {
        textureGroup.material_config.subsurface_value = subsurface_value;
      }

      textureGroup.material_config.saved = false;
      textureGroup.updateMaterial();

      Undo.finishEdit("Agent configured material");
      Canvas.updateAll();

      return `Configured material "${textureGroup.name}"`;
    },
  }, textureToolDocs[6].status);

  createTool(textureToolDocs[7].name, {
    ...textureToolDocs[7],
    async execute() {
      // @ts-ignore - TextureGroup is globally available
      const materials = TextureGroup.all.filter(
        (g: TextureGroup) => g.is_material
      );

      const result = materials.map((group: TextureGroup) => {
        const textures = group.getTextures();
        return {
          name: group.name,
          uuid: group.uuid,
          channels: {
            color: getChannelTextureInfo(textures, "color"),
            normal: getChannelTextureInfo(textures, "normal"),
            height: getChannelTextureInfo(textures, "height"),
            mer: getChannelTextureInfo(textures, "mer"),
          },
          config: {
            color_value: group.material_config.color_value,
            mer_value: group.material_config.mer_value,
            subsurface_value: group.material_config.subsurface_value,
            saved: group.material_config.saved,
          },
        };
      });

      return JSON.stringify(result, null, 2);
    },
  }, textureToolDocs[7].status);

  createTool(textureToolDocs[8].name, {
    ...textureToolDocs[8],
    async execute({ material }) {
      const textureGroup = findTextureGroupOrThrow(material);
      const textures = textureGroup.getTextures();

      // Get compiled texture_set.json
      let textureSetJson = null;
      try {
        textureSetJson = textureGroup.material_config.compileForBedrock();
      } catch {
        // Format might not support texture_set.json
      }

      const result = {
        name: textureGroup.name,
        uuid: textureGroup.uuid,
        is_material: textureGroup.is_material,
        textures: textures.map((tex: Texture) => ({
          name: tex.name,
          uuid: tex.uuid,
          pbr_channel: tex.pbr_channel,
          width: tex.width,
          height: tex.height,
          render_mode: tex.render_mode,
          render_sides: tex.render_sides,
        })),
        config: {
          color_value: textureGroup.material_config.color_value,
          mer_value: textureGroup.material_config.mer_value,
          subsurface_value: textureGroup.material_config.subsurface_value,
          saved: textureGroup.material_config.saved,
          file_path: textureGroup.material_config.getFilePath(),
        },
        texture_set_json: textureSetJson,
      };

      return JSON.stringify(result, null, 2);
    },
  }, textureToolDocs[8].status);

  createTool(textureToolDocs[9].name, {
    ...textureToolDocs[9],
    async execute({ path }) {
      // Validate path ends with texture_set.json
      if (!path.endsWith(".texture_set.json")) {
        throw new Error(
          "Path must end with '.texture_set.json'. Example: 'path/to/mytexture.texture_set.json'"
        );
      }

      const fs = requireNativeModule("fs");
      if (!fs) throw new Error("Filesystem access is unavailable.");
      if (!fs.existsSync(path)) {
        throw new Error(`File not found: ${path}`);
      }

      if (!Project || Undo.current_save) throw new Error("Open a project and finish its current edit before importing.");
      const targetProject = Project;
      const paths: typeof import("path") = requireNativeModule("path");
      const data = textureSetSchema.parse(JSON.parse(fs.readFileSync(path, "utf8")))["minecraft:texture_set"];
      const channelNames = {color:"color", normal:"normal", heightmap:"height", metalness_emissive_roughness:"mer", metalness_emissive_roughness_subsurface:"mer"} as const;
      const inputs = Object.entries(data).map(([key, value]) => {
        if (typeof value !== "string" || value.startsWith("#")) return {key,value};
        const candidates = [".png", ".tga"].map(extension=>paths.resolve(paths.dirname(path),value+extension));
        const file = candidates.find(candidate=>fs.existsSync(candidate));
        if (!file) throw new Error(`Missing image for texture-set channel ${key}: ${value}`);
        return {key,value,file,bytes:fs.readFileSync(file)};
      });
      const canonicalPath = (file: string) => paths.sep === "\\" ? paths.resolve(file).toLowerCase() : paths.resolve(file);
      const existingPaths = new Set(Texture.all.filter(texture=>texture.path).map(texture=>canonicalPath(texture.path!)));
      for (const input of inputs) if (input.file) {
        const key=canonicalPath(input.file);
        if (existingPaths.has(key)) throw new Error(`Texture image is already used in this project or texture set: ${input.file}. Configure the existing material instead.`);
        existingPaths.add(key);
      }
      const textureGroup = new TextureGroup({name:paths.basename(path).replace(".texture_set.json", ".png material"),is_material:true});
      const textures: Texture[] = [];
      for (const input of inputs) {
        if (input.file && input.bytes) {
          const texture = new Texture({name:paths.basename(input.file),pbr_channel:channelNames[input.key as keyof typeof channelNames]});
          if (input.file.endsWith(".tga")) {
            const decoder = (Texture as unknown as {file_formats:{tga:{decode(data:Uint8Array,texture:Texture):Promise<void>}}}).file_formats.tga;
            await loadTextureImage(texture,()=>decoder.decode(input.bytes!,texture));
          } else await loadTextureImage(texture,()=>{texture.fromDataURL("data:image/png;base64,"+input.bytes!.toString("base64"));});
          texture.path=input.file; texture.saved=true;
          texture.group=textureGroup.uuid;
          textures.push(texture);
        } else {
          let values: number[];
          if (typeof input.value === "string") {
            // Hex constants are a native texture-set convention.
            const hex=input.value.slice(1);
            if (![6,8].includes(hex.length)||!/^[\da-f]+$/i.test(hex)) throw new Error(`Invalid color constant for ${input.key}.`);
            values=hex.match(/../g)!.map(pair=>parseInt(pair,16));
            if (values.length===3) values.push(255);
          } else values=[...input.value];
          if (input.key==="color") textureGroup.material_config.color_value=[values[0],values[1],values[2],values[3]??255];
          else if (input.key.startsWith("metalness")) {
            textureGroup.material_config.mer_value=values.slice(0,3) as ArrayVector3;
            if (input.key.endsWith("subsurface")) textureGroup.material_config.subsurface_value=values[3]??0;
          } else throw new Error(`Channel ${input.key} requires an image reference.`);
        }
        if (input.key==="metalness_emissive_roughness_subsurface" && input.file) textureGroup.material_config.subsurface_value=1;
      }
      if (Project!==targetProject || Undo.current_save) throw new Error("The active project or edit changed during image loading; retry the import.");
      Undo.initEdit({textures:[],texture_groups:[]});
      try {
        textureGroup.add();
        for (const texture of textures) texture.add(false, true);
        textureGroup.updateMaterial();
        textureGroup.material_config.saved=true;
        Undo.finishEdit("Import texture set",{textures,texture_groups:[textureGroup]});
      } catch (error) {
        for (const texture of textures) if (Texture.all.includes(texture)) texture.remove();
        if (TextureGroup.all.includes(textureGroup)) textureGroup.remove();
        Undo.cancelEdit();throw error;
      }
      Canvas.updateAll();

      return `Imported texture set from "${path}". Check the textures panel for the new material.`;
    },
  }, textureToolDocs[9].status);

  createTool(textureToolDocs[10].name, {
    ...textureToolDocs[10],
    async execute({ material, texture, channel }) {
      const textureGroup = findTextureGroupOrThrow(material);
      const tex = findTextureOrThrow(texture);

      const textures = [...new Set([...textureGroup.getTextures(), tex])];
      const affectedGroups = TextureGroup.all.filter(g => g === textureGroup || g.uuid === tex.group);
      Undo.initEdit({ texture_groups: affectedGroups, textures });
      assignMaterialChannel(textureGroup, tex, channel);
      refreshMaterials(affectedGroups);

      Undo.finishEdit("Agent assigned texture channel");
      Canvas.updateAll();

      return `Assigned texture "${tex.name}" to ${channel} channel of material "${textureGroup.name}"`;
    },
  }, textureToolDocs[10].status);

  createTool(textureToolDocs[11].name, {
    ...textureToolDocs[11],
    async execute({ material }) {
      const textureGroup = findTextureGroupOrThrow(material);
      const filePath = textureGroup.material_config.getFilePath();
      const colorTexture = textureGroup.getTextures().find(texture => texture.pbr_channel === "color");
      const fs = requireNativeModule("fs");
      if (!fs) throw new Error("Filesystem access is unavailable.");
      const path: typeof import("path") = requireNativeModule("path");

      if (!filePath || !colorTexture?.path || !path.isAbsolute(filePath)) {
        throw new Error(
          "Cannot save: Material needs a color texture with a valid file path. Save the color texture first, then try again."
        );
      }
      if (!fs.statSync(path.dirname(filePath)).isDirectory()) throw new Error("Material output directory does not exist.");
      // Desktop 5.1.6 saves synchronously. A native early return must not be
      // reported as success, and saved state must only change after a write.
      const expected = textureGroup.material_config.compileForBedrock();
      textureGroup.material_config.save();
      const actual = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Saved material config does not match the current material.");

      return `Saved material config to "${filePath}"`;
    },
  }, textureToolDocs[11].status);

  createTool(textureToolDocs[12].name, {
    ...textureToolDocs[12],
    async execute({ texture }) {
      const target = findTextureOrThrow(texture);
      if (Texture.selected?.uuid !== target.uuid) {
        target.select();
      }
      return `Activated texture "${target.name}" (uuid: ${target.uuid}). Paint tools will now target it by default.`;
    },
  }, textureToolDocs[12].status);
}
