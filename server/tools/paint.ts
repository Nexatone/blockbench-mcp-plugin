import { editTextureSelection, strokePoints } from "@/lib/textureSelection";
import { validatePaintPoints, nativePaintStroke, blendPaintPixel, editPaintPixels } from "@/lib/paintOperations";
import { colorFillMask } from "@/lib/fillMask";
import { withUndoEdit } from "@/lib/editorExecution";
import { resolveUnique } from "@/lib/modelState";
/// <reference types="three" />
/// <reference types="blockbench-types" />
import { z } from "zod";
// Blockbench supplies tinycolor globally; importing it would request an unsupported native module.
declare const tinycolor: typeof import("tinycolor2");
import { createTool, type ToolSpec } from "@/lib/factories";
import { STATUS_STABLE } from "@/lib/constants";
import { getProjectTexture, getAndActivateTexture, setBarItemValue } from "@/lib/util";
import {
  textureIdOptionalSchema,
  hexColorSchema,
  opacitySchema,
  brushSizeSchema,
  brushSoftnessSchema,
  brushShapeEnum,
  blendModeEnum,
  layerBlendModeEnum,
  fillModeEnum,
  drawShapeEnum,
  copyBrushModeEnum,
  brushModifierEnum,
  axisEnum,
  coordinateSchema,
  brushSettingsSchema,
} from "@/lib/zodObjects";

export const paintFillToolParameters = z.object({
  texture_id: textureIdOptionalSchema,
  x: z.number().describe("X coordinate to start fill."),
  y: z.number().describe("Y coordinate to start fill."),
  color: hexColorSchema.describe("Fill color as hex string."),
  opacity: opacitySchema.describe("Fill opacity (0-255)."),
  tolerance: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Maximum RGBA channel distance in percent (0–100), for color/color_connected fills. Other fill modes ignore color tolerance."),
  fill_mode: fillModeEnum
    .optional()
    .default("color_connected")
    .describe("Fill mode."),
  blend_mode: blendModeEnum.optional().describe("Fill blend mode."),
});

export const drawShapeToolParameters = z.object({
  texture_id: textureIdOptionalSchema,
  shape: drawShapeEnum.describe("Shape to draw. '_h' suffix means hollow."),
  start: coordinateSchema.extend({
    x: z.number().describe("Start X coordinate."),
    y: z.number().describe("Start Y coordinate."),
  }),
  end: coordinateSchema.extend({
    x: z.number().describe("End X coordinate."),
    y: z.number().describe("End Y coordinate."),
  }),
  color: hexColorSchema.describe("Shape color as hex string."),
  line_width: z
    .number()
    .min(1)
    .max(50)
    .optional()
    .describe("Line width for hollow shapes."),
  opacity: opacitySchema.describe("Shape opacity (0-255)."),
  blend_mode: blendModeEnum.optional().describe("Shape blend mode."),
});

export const gradientToolParameters = z.object({
  texture_id: textureIdOptionalSchema,
  start: coordinateSchema.extend({
    x: z.number().describe("Gradient start X coordinate."),
    y: z.number().describe("Gradient start Y coordinate."),
  }),
  end: coordinateSchema.extend({
    x: z.number().describe("Gradient end X coordinate."),
    y: z.number().describe("Gradient end Y coordinate."),
  }),
  start_color: z.string().describe("Start color as hex string."),
  end_color: z.string().describe("End color as hex string."),
  opacity: opacitySchema.describe("Gradient opacity (0-255)."),
  blend_mode: blendModeEnum.optional().describe("Gradient blend mode."),
});

export const colorPickerToolParameters = z.object({
  texture_id: textureIdOptionalSchema,
  x: z.number().describe("X coordinate to pick color from."),
  y: z.number().describe("Y coordinate to pick color from."),
  set_as_secondary: z
    .boolean()
    .optional()
    .default(false)
    .describe("Set as secondary color instead of primary."),
  pick_opacity: z
    .boolean()
    .optional()
    .default(false)
    .describe("Also pick and apply the pixel's opacity."),
});

export const copyBrushToolParameters = z.object({
  texture_id: textureIdOptionalSchema,
  source: coordinateSchema.extend({
    x: z.number().describe("Source X coordinate to copy from."),
    y: z.number().describe("Source Y coordinate to copy from."),
  }),
  target: coordinateSchema.extend({
    x: z.number().describe("Target X coordinate to paste to."),
    y: z.number().describe("Target Y coordinate to paste to."),
  }),
  brush_size: brushSizeSchema.describe("Copy brush size."),
  opacity: opacitySchema.describe("Copy opacity (0-255)."),
  mode: copyBrushModeEnum.optional().default("copy").describe("Copy brush mode."),
});

export const eraserToolParameters = z.object({
  texture_id: textureIdOptionalSchema,
  coordinates: z
    .array(
      coordinateSchema.extend({
        x: z.number().describe("X coordinate to erase at."),
        y: z.number().describe("Y coordinate to erase at."),
      })
    )
    .describe("Array of coordinates to erase at."),
  brush_size: brushSizeSchema.describe("Eraser brush size."),
  opacity: opacitySchema.describe("Eraser opacity (0-255)."),
  softness: brushSoftnessSchema.describe("Eraser softness percentage."),
  shape: brushShapeEnum.optional().describe("Eraser shape."),
  connect_strokes: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to connect erase strokes with lines."),
});

export const paintSettingsParameters = z.object({
  mirror_painting: z
    .object({
      enabled: z.boolean().describe("Enable mirror painting. Supplied options are updated even when disabled."),
      axis: z.array(axisEnum).optional().describe("Replaces enabled mirror axes; an empty array disables all axes. Omit to preserve them."),
      texture: z.boolean().optional().describe("Enable texture mirroring."),
      texture_center: coordinateSchema
        .extend({
          x: z.number().describe("X coordinate of texture mirror center."),
          y: z.number().describe("Y coordinate of texture mirror center."),
        })
        .optional()
        .describe("Texture mirror center."),
    })
    .optional()
    .describe("Mirror painting settings."),
  lock_alpha: z
    .boolean()
    .optional()
    .describe("Lock alpha channel while painting."),
  pixel_perfect: z
    .boolean()
    .optional()
    .describe("Enable pixel perfect drawing."),
  paint_side_restrict: z
    .boolean()
    .optional()
    .describe("Restrict painting to current face side."),
  color_erase_mode: z
    .boolean()
    .optional()
    .describe("Enable color erase mode."),
  brush_opacity_modifier: brushModifierEnum
    .optional()
    .describe("Brush opacity modifier for stylus."),
  brush_size_modifier: brushModifierEnum
    .optional()
    .describe("Brush size modifier for stylus."),
  paint_with_stylus_only: z
    .boolean()
    .optional()
    .describe("Only allow painting with stylus input."),
  pick_color_opacity: z
    .boolean()
    .optional()
    .describe("Pick opacity when using color picker."),
  pick_combined_color: z
    .boolean()
    .optional()
    .describe("Pick combined layer colors."),
});

export const paintWithBrushParameters = z.object({
  texture_id: textureIdOptionalSchema,
  coordinates: z
    .array(
      coordinateSchema.extend({
        x: z.number().describe("X coordinate on texture."),
        y: z.number().describe("Y coordinate on texture."),
      })
    )
    .describe("Array of coordinates to paint at."),
  brush_settings: brushSettingsSchema,
  connect_strokes: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to connect paint strokes with lines."),
});

export const createBrushPresetParameters = z.object({
  name: z.string().describe("Name of the brush preset."),
  size: brushSizeSchema,
  opacity: opacitySchema,
  softness: brushSoftnessSchema,
  shape: brushShapeEnum.optional().describe("Brush shape."),
  color: hexColorSchema.describe("Brush color as hex string."),
  blend_mode: blendModeEnum.optional().describe("Brush blend mode."),
  pixel_perfect: z
    .boolean()
    .optional()
    .describe("Enable pixel perfect drawing."),
});

export const loadBrushPresetParameters = z.object({
  preset_name: z.string().describe("Name of the brush preset to load."),
});

export const textureSelectionParameters = z.object({
  action: z
    .enum([
      "select_rectangle",
      "select_ellipse",
      "select_all",
      "clear_selection",
      "invert_selection",
      "expand_selection",
      "contract_selection",
      "feather_selection",
    ])
    .describe("Binary selection action. feather_selection is deprecated and returns an explicit unsupported-operation error; use brush softness for soft edges."),
  texture_id: textureIdOptionalSchema,
  coordinates: z
    .object({
      x1: z.number().describe("Start X coordinate."),
      y1: z.number().describe("Start Y coordinate."),
      x2: z.number().describe("End X coordinate."),
      y2: z.number().describe("End Y coordinate."),
    })
    .optional()
    .describe("Selection area coordinates."),
  radius: z
    .number()
    .optional()
    .describe("Radius for expand/contract/feather operations."),
  mode: z
    .enum(["create", "add", "subtract", "intersect"])
    .optional()
    .default("create")
    .describe("Selection mode."),
});

export const textureLayerManagementParameters = z.object({
  action: z
    .enum([
      "create_layer",
      "delete_layer",
      "duplicate_layer",
      "merge_down",
      "set_opacity",
      "set_blend_mode",
      "move_layer",
      "rename_layer",
      "flatten_layers",
    ])
    .describe("Layer management action."),
  texture_id: textureIdOptionalSchema,
  layer_name: z.string().optional().describe("Name of the layer."),
  layer_id: z.string().optional().describe("Exact layer UUID or unique name on the requested texture; defaults to its selected layer. Inspect IDs with query_model kind texture_layers."),
  opacity: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Layer opacity percentage."),
  blend_mode: layerBlendModeEnum.optional().describe("Layer blend mode."),
  target_index: z
    .number()
    .optional()
    .describe("Target position for moving layers."),
});

export const paintToolDocs: ToolSpec[] = [
  {
    name: "paint_fill_tool",
    description: "Fills the active texture layer. Color modes match RGBA pixels globally or through four-connected neighbors, respecting selection and alpha lock; they do not mirror strokes or use color-erase mode. Other modes use native 2D fill behavior: face/element use the texture selection without a viewport face; selected_elements uses selected model UVs. One Undo step.",
    annotations: {
      title: "Paint Fill Tool",
      destructiveHint: true,
    },
    parameters: paintFillToolParameters,
    status: STATUS_STABLE,
  },
  {
    name: "draw_shape_tool",
    description: "Draws geometric shapes on textures.",
    annotations: {
      title: "Draw Shape Tool",
      destructiveHint: true,
    },
    parameters: drawShapeToolParameters,
    status: STATUS_STABLE,
  },
  {
    name: "gradient_tool",
    description: "Applies a linear two-color gradient in texture coordinates to the active layer and selection. Endpoints are pixel coordinates; colors extend beyond them. Honors opacity, blend mode and alpha lock. Does not mirror strokes or use color-erase mode. One Undo step.",
    annotations: {
      title: "Gradient Tool",
      destructiveHint: true,
    },
    parameters: gradientToolParameters,
    status: STATUS_STABLE,
  },
  {
    name: "color_picker_tool",
    description:
      "Picks colors from textures and sets them as the active color.",
    annotations: {
      title: "Color Picker Tool",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
    },
    parameters: colorPickerToolParameters,
    status: STATUS_STABLE,
  },
  {
    name: "copy_brush_tool",
    description: "Uses the copy/clone brush to copy texture areas.",
    annotations: {
      title: "Copy Brush Tool",
      destructiveHint: true,
    },
    parameters: copyBrushToolParameters,
    status: STATUS_STABLE,
  },
  {
    name: "eraser_tool",
    description: "Erases parts of textures with customizable settings.",
    annotations: {
      title: "Eraser Tool",
      destructiveHint: true,
    },
    parameters: eraserToolParameters,
    status: STATUS_STABLE,
  },
  {
    name: "paint_settings",
    description: "Configures paint mode settings and preferences.",
    annotations: {
      title: "Paint Settings",
      destructiveHint: true,
    },
    parameters: paintSettingsParameters,
    status: STATUS_STABLE,
  },
  {
    name: "paint_with_brush",
    description:
      "Paints on textures using the brush tool with customizable settings.",
    annotations: {
      title: "Paint with Brush",
      destructiveHint: true,
    },
    parameters: paintWithBrushParameters,
    status: STATUS_STABLE,
  },
  {
    name: "create_brush_preset",
    description: "Creates a custom brush preset with specified settings.",
    annotations: {
      title: "Create Brush Preset",
      destructiveHint: true,
    },
    parameters: createBrushPresetParameters,
    status: STATUS_STABLE,
  },
  {
    name: "load_brush_preset",
    description: "Loads and applies a brush preset by name.",
    annotations: {
      title: "Load Brush Preset",
      destructiveHint: true,
    },
    parameters: loadBrushPresetParameters,
    status: STATUS_STABLE,
  },
  {
    name: "texture_selection",
    description:
      "Creates and modifies binary texture selections without a bitmap Undo entry. feather_selection is deprecated and returns an explicit unsupported-operation error; use brush softness for soft edges.",
    annotations: {
      title: "Texture Selection",
      destructiveHint: true,
    },
    parameters: textureSelectionParameters,
    status: STATUS_STABLE,
  },
  {
    name: "texture_layer_management",
    description: "Creates, manages, and manipulates texture layers.",
    annotations: {
      title: "Texture Layer Management",
      destructiveHint: true,
    },
    parameters: textureLayerManagementParameters,
    status: STATUS_STABLE,
  },
];

export function registerPaintTools() {
  createTool(
    paintToolDocs[0].name,
    {
      ...paintToolDocs[0],
      async execute({
        texture_id,
        x,
        y,
        color,
        opacity,
        tolerance,
        fill_mode,
        blend_mode,
      }) {
        const texture = getAndActivateTexture(texture_id);

        validatePaintPoints(texture, [{ x, y }]);
        if (fill_mode === "color" || fill_mode === "color_connected") {
          const active = texture.getActiveCanvas();
          const { canvas, ctx } = active;
          const offset = (active as typeof active & { offset: number[] }).offset ?? [0, 0];
          const source = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          const mask = colorFillMask(source, canvas.width, canvas.height, Math.floor(x - offset[0]), Math.floor(y - offset[1]), tolerance ?? 0, fill_mode === "color_connected", (px, py) => Boolean(texture.selection.get(px + offset[0], py + offset[1])));
          const fill = tinycolor(color).toRgb();
          editPaintPixels(texture, "Fill texture", (base, px, py) => mask[(py - offset[1]) * canvas.width + px - offset[0]] ? blendPaintPixel(base, fill, opacity / 255, blend_mode ?? "default") : base);
          return `Filled area at (${x}, ${y}) on texture "${texture.name}"`;
        }
        (BarItems.fill_tool as Tool).select();
        // Apply settings to the selected tool, whose slider values are per-tool.
        if (color) {
          ColorPanel.set(color);
        }
        if (opacity !== undefined) {
          setBarItemValue("slider_brush_opacity", opacity);
        }
        if (fill_mode) {
          setBarItemValue("fill_mode", fill_mode);
        }
        if (blend_mode) {
          setBarItemValue("blend_mode", blend_mode);
        }

        nativePaintStroke(texture, { x, y }, () => {});
        Canvas.updateAll();

        return `Filled area at (${x}, ${y}) on texture "${texture.name}"`;
      },
    },
    paintToolDocs[0].status
  );

  createTool(
    paintToolDocs[1].name,
    {
      ...paintToolDocs[1],
      async execute({
        texture_id,
        shape,
        start,
        end,
        color,
        line_width,
        opacity,
        blend_mode,
      }) {
        const texture = getAndActivateTexture(texture_id);

        validatePaintPoints(texture, [start, end]);
        (BarItems.draw_shape_tool as Tool).select();
        // Apply settings
        if (color) {
          ColorPanel.set(color);
        }
        if (opacity !== undefined) {
          setBarItemValue("slider_brush_opacity", opacity);
        }
        if (line_width !== undefined) {
          setBarItemValue("slider_brush_size", line_width);
        }
        if (blend_mode) {
          setBarItemValue("blend_mode", blend_mode);
        }

        // Set shape type
        setBarItemValue("draw_shape_type", shape);

        nativePaintStroke(texture, start, () => Painter.useShapeTool(texture, end.x, end.y, {}));
        Canvas.updateAll();

        return `Drew ${shape} from (${start.x}, ${start.y}) to (${end.x}, ${end.y}) on texture "${texture.name}"`;
      },
    },
    paintToolDocs[1].status
  );

  createTool(
    paintToolDocs[2].name,
    {
      ...paintToolDocs[2],
      async execute({
        texture_id,
        start,
        end,
        start_color,
        end_color,
        opacity,
        blend_mode,
      }) {
        const texture = getAndActivateTexture(texture_id);

        validatePaintPoints(texture, [start, end]);
        const first = tinycolor(start_color), last = tinycolor(end_color);
        if (!first.isValid() || !last.isValid()) throw new Error("Both gradient colors must be valid colors.");
        const dx = end.x - start.x, dy = end.y - start.y, length2 = dx * dx + dy * dy;
        if (!length2) throw new Error("Gradient start and end must differ.");
        const a = first.toRgb(), b = last.toRgb();
        editPaintPixels(texture, "Apply gradient", (base, x, y) => {
          const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / length2));
          const color = { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t, a: a.a + (b.a - a.a) * t };
          return blendPaintPixel(base, color, opacity / 255, blend_mode ?? "default");
        });

        return `Applied gradient from (${start.x}, ${start.y}) to (${end.x}, ${end.y}) on texture "${texture.name}"`;
      },
    },
    paintToolDocs[2].status
  );

  createTool(
    paintToolDocs[3].name,
    {
      ...paintToolDocs[3],
      async execute({ texture_id, x, y, set_as_secondary, pick_opacity }) {
        const texture = getAndActivateTexture(texture_id);
        if (![x,y].every(Number.isFinite) || x < 0 || y < 0 || x >= texture.width || y >= texture.height) throw new Error("Pick coordinates must be inside the texture.");
        const layer = texture.selected_layer;
        const readPixel = (ctx: CanvasRenderingContext2D, px: number, py: number) => ctx.getImageData(Math.floor(px), Math.floor(py), 1, 1).data;
        let pixel = layer && Settings.get("pick_combined_color") === false
          ? readPixel(texture.getActiveCanvas().ctx, x - layer.offset[0], y - layer.offset[1])
          : readPixel(texture.ctx, x, y);
        if (pixel[3] === 0 && layer) pixel = readPixel(texture.ctx, x, y);
        const picked = tinycolor({ r: pixel[0], g: pixel[1], b: pixel[2], a: pixel[3] / 255 });
        ColorPanel.set(picked, set_as_secondary, false);
        const color = ColorPanel.get(set_as_secondary);

        if (pick_opacity) {
          // Get pixel color with alpha
          const opacity = pixel[3];

          // Apply opacity to brush tools
          for (let id in BarItems) {
            const tool = BarItems[id];
            // @ts-ignore
            if (tool.tool_settings && tool.tool_settings.brush_opacity >= 0) {
              // @ts-ignore
              tool.tool_settings.brush_opacity = opacity;
            }
          }
          (BarItems.slider_brush_opacity as NumSlider).update();

          return `Picked color ${color} with opacity ${opacity} from (${x}, ${y}) on texture "${texture.name}"`;
        }

        return `Picked color ${color} from (${x}, ${y}) on texture "${texture.name}"`;
      },
    },
    paintToolDocs[3].status
  );

  createTool(
    paintToolDocs[4].name,
    {
      ...paintToolDocs[4],
      async execute({ texture_id, source, target, brush_size, opacity, mode }) {
        const texture = getAndActivateTexture(texture_id);

        validatePaintPoints(texture, [source, target]);
        (BarItems.copy_brush as Tool).select();
        // Apply settings
        if (brush_size !== undefined) {
          setBarItemValue("slider_brush_size", brush_size);
        }
        if (opacity !== undefined) {
          setBarItemValue("slider_brush_opacity", opacity);
        }
        if (mode) {
          setBarItemValue("copy_brush_mode", mode);
        }

        // Set source point (Ctrl+click equivalent)
        Painter.startPaintTool(texture, source.x, source.y, undefined, {
          ctrlOrCmd: true,
        });
        Painter.stopPaintTool();

        // Apply at target point
        nativePaintStroke(texture, target, () => {});
        Canvas.updateAll();

        return `Copied from (${source.x}, ${source.y}) to (${target.x}, ${target.y}) on texture "${texture.name}"`;
      },
    },
    paintToolDocs[4].status
  );

  createTool(
    paintToolDocs[5].name,
    {
      ...paintToolDocs[5],
      async execute({
        texture_id,
        coordinates,
        brush_size,
        opacity,
        softness,
        shape,
        connect_strokes,
      }) {
        const texture = getAndActivateTexture(texture_id);

        validatePaintPoints(texture, coordinates);
        (BarItems.eraser as Tool).select();
        // Apply settings
        if (brush_size !== undefined) {
          setBarItemValue("slider_brush_size", brush_size);
        }
        if (opacity !== undefined) {
          setBarItemValue("slider_brush_opacity", opacity);
        }
        if (softness !== undefined) {
          setBarItemValue("slider_brush_softness", softness);
        }
        if (shape !== undefined) {
          setBarItemValue("brush_shape", shape);
        }

        nativePaintStroke(texture, coordinates[0], () => {
          for (const coord of coordinates.slice(1)) Painter.movePaintTool(texture, coord.x, coord.y, {}, !connect_strokes);
        });
        Canvas.updateAll();

        return `Erased ${coordinates.length} points on texture "${texture.name}"`;
      },
    },
    paintToolDocs[5].status
  );

  createTool(
    paintToolDocs[6].name,
    {
      ...paintToolDocs[6],
      async execute({
        mirror_painting,
        lock_alpha,
        pixel_perfect,
        paint_side_restrict,
        color_erase_mode,
        brush_opacity_modifier,
        brush_size_modifier,
        paint_with_stylus_only,
        pick_color_opacity,
        pick_combined_color,
      }) {
        const messages: string[] = [];

        const requestedSettings = { paint_side_restrict, brush_opacity_modifier, brush_size_modifier, paint_with_stylus_only, pick_color_opacity, pick_combined_color };
        for (const [key, value] of Object.entries(requestedSettings)) {
          if (value !== undefined && !settings[key]) throw new Error("Setting unavailable: " + key);
        }
        // Mirror painting
        if (mirror_painting !== undefined) {
          setBarItemValue("mirror_painting", mirror_painting.enabled);
          Painter.mirror_painting = mirror_painting.enabled;
          messages.push(`Mirror painting: ${mirror_painting.enabled}`);

          {
            // @ts-ignore
            const options = Painter.mirror_painting_options;
            if (mirror_painting.axis) {
              for (const axis of ["x", "y", "z"] as const) options[axis] = mirror_painting.axis.includes(axis);
            }
            if (mirror_painting.texture !== undefined) {
              options.texture = mirror_painting.texture;
            }
            if (mirror_painting.texture_center) {
              options.texture_center = [
                mirror_painting.texture_center.x,
                mirror_painting.texture_center.y,
              ];
            }
            messages.push(`Mirror options updated`);
          }
        }

        // Lock alpha
        if (lock_alpha !== undefined) {
          Painter.lock_alpha = lock_alpha;
          messages.push(`Lock alpha: ${lock_alpha}`);
        }

        // Pixel perfect
        if (pixel_perfect !== undefined) {
          setBarItemValue("pixel_perfect_drawing", pixel_perfect);
          messages.push(`Pixel perfect: ${pixel_perfect}`);
        }

        // Color erase mode
        if (color_erase_mode !== undefined) {
          setBarItemValue("color_erase_mode", color_erase_mode);
          Painter.erase_mode = color_erase_mode;
          messages.push(`Color erase mode: ${color_erase_mode}`);
        }

        // Settings that require accessing the settings object
        if (paint_side_restrict !== undefined) {
          // @ts-ignore
          settings.paint_side_restrict.set(paint_side_restrict);
          messages.push(`Paint side restrict: ${paint_side_restrict}`);
        }

        if (brush_opacity_modifier !== undefined) {
          // @ts-ignore
          settings.brush_opacity_modifier.set(brush_opacity_modifier);
          messages.push(`Brush opacity modifier: ${brush_opacity_modifier}`);
        }

        if (brush_size_modifier !== undefined) {
          // @ts-ignore
          settings.brush_size_modifier.set(brush_size_modifier);
          messages.push(`Brush size modifier: ${brush_size_modifier}`);
        }

        if (paint_with_stylus_only !== undefined) {
          // @ts-ignore
          settings.paint_with_stylus_only.set(paint_with_stylus_only);
          messages.push(`Paint with stylus only: ${paint_with_stylus_only}`);
        }

        if (pick_color_opacity !== undefined) {
          // @ts-ignore
          settings.pick_color_opacity.set(pick_color_opacity);
          messages.push(`Pick color opacity: ${pick_color_opacity}`);
        }

        if (pick_combined_color !== undefined) {
          // @ts-ignore
          settings.pick_combined_color.set(pick_combined_color);
          messages.push(`Pick combined color: ${pick_combined_color}`);
        }

        Settings.save();
        return `Updated paint settings: ${messages.join(", ")}`;
      },
    },
    paintToolDocs[6].status
  );

  createTool(
    paintToolDocs[7].name,
    {
      ...paintToolDocs[7],
      async execute({
        texture_id,
        coordinates,
        brush_settings,
        connect_strokes,
      }) {
        const texture = getAndActivateTexture(texture_id);

        const points = strokePoints(coordinates, connect_strokes);
        const color = tinycolor(brush_settings?.color ?? "#000000");
        if (!color.isValid()) throw new Error("Invalid brush color.");
        const rgba = color.toRgb();
        const opacity = (brush_settings?.opacity ?? 255) / 255;
        const size = brush_settings?.size ?? 1;
        const softness = (brush_settings?.softness ?? 0) / 100;
        const shape = brush_settings?.shape ?? "square";
        const blendMode = brush_settings?.blend_mode ?? "default";
        const paintState = Painter as unknown as { current: Record<string, any> };
        const previousPaint = paintState.current;
        try {
          paintState.current = {};
          withUndoEdit("Paint with brush", { textures: [texture], bitmap: true }, () => {
          texture.edit((canvas: HTMLCanvasElement) => {
            const ctx = canvas.getContext("2d")!;
            for (const point of points) {
              const blend = (base: any, falloff: number) => {
                if (blendMode === "set_opacity") return { ...rgba, a: opacity * rgba.a * falloff };
                if (!opacity || !rgba.a || !falloff) return base;
                return blendMode === "default" ? Painter.combineColors(base, { ...rgba }, opacity * falloff) :
                  Painter.blendColors(base, { ...rgba }, opacity * falloff, blendMode);
              };
              const offset = Painter.current.offset ?? [0, 0];
              if (shape === "circle") Painter.editCircle(ctx, point.x - offset[0], point.y - offset[1], size, softness, blend);
              else Painter.editSquare(ctx, point.x - offset[0], point.y - offset[1], size, softness, blend);
            }
          }, { no_undo: true });
          });
        } finally { paintState.current = previousPaint; }
        Canvas.updateAll();

        return `Painted ${coordinates.length} points on texture "${texture.name}"`;
      },
    },
    paintToolDocs[7].status
  );

  createTool(
    paintToolDocs[8].name,
    {
      ...paintToolDocs[8],
      async execute({
        name,
        size,
        opacity,
        softness,
        shape,
        color,
        blend_mode,
        pixel_perfect,
      }) {
        const preset = {
          name,
          size: size ?? null,
          opacity: opacity ?? null,
          softness: softness ?? null,
          shape: shape || "square",
          color: color || null,
          blend_mode: blend_mode || "default",
          pixel_perfect: pixel_perfect || false,
        };

        // @ts-ignore
        StateMemory.brush_presets.push(preset);
        // @ts-ignore
        StateMemory.save("brush_presets");

        return `Created brush preset "${name}" with settings: ${JSON.stringify(
          preset
        )}`;
      },
    },
    paintToolDocs[8].status
  );

  createTool(
    paintToolDocs[9].name,
    {
      ...paintToolDocs[9],
      async execute({ preset_name }) {
        // @ts-ignore
        const preset = StateMemory.brush_presets.find(
          (p) => p.name === preset_name
        );

        if (!preset) {
          throw new Error(`Brush preset "${preset_name}" not found.`);
        }

        // @ts-ignore
        Painter.loadBrushPreset(preset);

        return `Loaded brush preset "${preset_name}"`;
      },
    },
    paintToolDocs[9].status
  );

  createTool(
    paintToolDocs[10].name,
    {
      ...paintToolDocs[10],
      async execute({ action, texture_id, coordinates, radius, mode }) {
        const texture = getAndActivateTexture(texture_id);

        // Selection is editor state, not a texture bitmap edit.
        editTextureSelection(texture.selection, { action, coordinates, radius, mode });
        UVEditor.updateSelectionOutline();
        UVEditor.vue.updateTexture();

        return `Applied ${action} to texture "${texture.name}"`;
      },
    },
    paintToolDocs[10].status
  );

  createTool(
    paintToolDocs[11].name,
    {
      ...paintToolDocs[11],
      async execute({
        action,
        texture_id,
        layer_name,
        layer_id,
        opacity,
        blend_mode,
        target_index,
      }) {
        const texture = texture_id ? getProjectTexture(texture_id) : Texture.selected ?? Texture.getDefault();
        if (!texture) throw new Error("Texture not found. Use list_textures or create_texture first.");
        const selectedLayer = layer_id ? resolveUnique(texture.layers, layer_id, "layer") : texture.selected_layer;

        if (!["create_layer", "flatten_layers"].includes(action) && !selectedLayer) throw new Error("No layer selected on the requested texture.");
        if (action === "set_opacity" && opacity === undefined) throw new Error("Opacity value required.");
        if (action === "set_blend_mode" && !blend_mode) throw new Error("Blend mode required.");
        if (action === "rename_layer" && !layer_name) throw new Error("New layer name required.");
        if (action === "move_layer" && (target_index === undefined || target_index < 0 || target_index >= texture.layers.length)) throw new Error("Target layer index is out of range.");
        if (action === "flatten_layers" && !texture.layers_enabled) throw new Error("Texture has no layers to flatten.");
        if (action === "merge_down" && texture.layers.indexOf(selectedLayer!) <= 0) throw new Error("No layer below the selected layer to merge into.");

        texture.select();
        selectedLayer?.select();
        const result = withUndoEdit(`Layer management: ${action}`, {
          textures: [texture],
          bitmap: true,
        }, () => {

        let result = "";

        switch (action) {
          case "create_layer":
            if (!texture.layers_enabled) {
              texture.activateLayers(false);
            }
            const newLayer = new TextureLayer(
              {
                name: layer_name || `Layer ${texture.layers.length + 1}`,
              },
              texture
            );
            newLayer.setSize(texture.width, texture.height);
            newLayer.addForEditing();
            result = `Created layer "${newLayer.name}"`;
            break;

          case "delete_layer":
            if (!TextureLayer.selected) {
              throw new Error("No layer selected.");
            }
            const layerToDelete = TextureLayer.selected;
            layerToDelete.remove();
            result = `Deleted layer "${layerToDelete.name}"`;
            break;

          case "duplicate_layer":
            if (!TextureLayer.selected) {
              throw new Error("No layer selected.");
            }
            const layerToDuplicate = TextureLayer.selected;
            const duplicatedLayer = new TextureLayer(layerToDuplicate.getUndoCopy(true), texture);
            duplicatedLayer.addForEditing();
            duplicatedLayer.name = `${layerToDuplicate.name} copy`;
            result = `Duplicated layer "${duplicatedLayer.name}"`;
            break;

          case "merge_down":
            if (!TextureLayer.selected) {
              throw new Error("No layer selected.");
            }
            TextureLayer.selected.mergeDown(false);
            result = "Merged layer down";
            break;

          case "set_opacity":
            if (!TextureLayer.selected) {
              throw new Error("No layer selected.");
            }
            if (opacity === undefined) {
              throw new Error("Opacity value required.");
            }
            TextureLayer.selected.opacity = opacity;
            texture.updateChangesAfterEdit();
            result = `Set layer opacity to ${opacity}%`;
            break;

          case "set_blend_mode":
            if (!TextureLayer.selected) {
              throw new Error("No layer selected.");
            }
            if (!blend_mode) {
              throw new Error("Blend mode required.");
            }
            TextureLayer.selected.blend_mode = blend_mode;
            texture.updateChangesAfterEdit();
            result = `Set layer blend mode to ${blend_mode}`;
            break;

          case "move_layer":
            if (!TextureLayer.selected) {
              throw new Error("No layer selected.");
            }
            if (target_index === undefined) {
              throw new Error("Target index required.");
            }
            const layerToMove = TextureLayer.selected;
            texture.layers.remove(layerToMove);
            texture.layers.splice(target_index, 0, layerToMove);
            result = `Moved layer to position ${target_index}`;
            break;

          case "rename_layer":
            if (!TextureLayer.selected) {
              throw new Error("No layer selected.");
            }
            if (!layer_name) {
              throw new Error("New layer name required.");
            }
            const oldName = TextureLayer.selected.name;
            TextureLayer.selected.name = layer_name;
            result = `Renamed layer from "${oldName}" to "${layer_name}"`;
            break;

          case "flatten_layers":
            if (!texture.layers_enabled) {
              throw new Error("Texture has no layers to flatten.");
            }
            texture.updateLayerChanges(true);
            texture.layers_enabled = false;
            texture.selected_layer = null;
            texture.layers.empty();
            UVEditor.vue.layer = null;
            result = "Flattened all layers";
            break;
        }

        texture.updateLayerChanges(true);
        texture.updateChangesAfterEdit();
        return result;
        });
        updateInterfacePanels();

        return result;
      },
    },
    paintToolDocs[11].status
  );
}
