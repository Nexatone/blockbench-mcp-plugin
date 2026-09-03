/** Runtime APIs verified against Blockbench 5.1.6, absent in blockbench-types 5.0.6. */
interface UndoAspects {
  texture_groups?: TextureGroup[];
  keep_saved?: boolean;
}
interface TextureGroupMaterialConfig {
  subsurface_value: number;
}
declare namespace Painter {
  function startPaintTool(texture: Texture, x: number, y: number, uvTag: unknown, event: Record<string, unknown>, data?: unknown): void;
  function stopPaintTool(): void;
  function movePaintTool(texture: Texture, x: number, y: number, event: Record<string, unknown>, newFace?: boolean, uv?: unknown): void;
  function useShapeTool(texture: Texture, x: number, y: number, event: Record<string, unknown>, uv?: unknown): void;
}
