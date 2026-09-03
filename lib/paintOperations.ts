type Point = { x: number; y: number };
type Pixel = { r: number; g: number; b: number; a: number };
const paintRuntime = () => Painter as typeof Painter & { paint_stroke_canceled?: boolean; brushChanges: boolean; current: Record<string, any> };

export function validatePaintPoints(texture: Texture, points: Point[]): void {
  if (!points.length) throw new Error("Provide at least one paint coordinate.");
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x >= texture.width || p.y >= texture.height)) {
    throw new Error("Paint coordinates must be finite and inside the texture.");
  }
  if (Undo.current_save) throw new Error("Finish the current edit before painting.");
}

/** Native paint owns Undo; a canceled or zero-change stroke leaves no pending edit. */
export function nativePaintStroke(texture: Texture, point: Point, draw: () => void): void {
  const painter = paintRuntime(), previous = painter.current;
  try {
    painter.current = {};
    Painter.startPaintTool(texture, point.x, point.y, undefined, { shiftKey: false });
    if (painter.paint_stroke_canceled) throw new Error("Painting was canceled by the editor; check stylus-only settings or the active pointer operation.");
    draw();
    Painter.stopPaintTool();
    if (Undo.current_save) Undo.cancelEdit();
  } catch (error) {
    painter.brushChanges = false;
    if (Undo.current_save) Undo.cancelEdit();
    Painter.stopPaintTool();
    throw error;
  } finally { painter.current = previous; }
}

export function blendPaintPixel(base: Pixel, color: Pixel, opacity: number, mode: string): Pixel {
  if (mode !== "set_opacity" && (!opacity || !color.a)) return base;
  const result = mode === "set_opacity" ? { ...color, a: color.a * opacity } :
    mode === "default" ? Painter.combineColors(base, { ...color }, opacity) : Painter.blendColors(base, { ...color }, opacity, mode);
  if (Painter.lock_alpha) result.a = base.a;
  return result;
}

/** Deterministic texture-space operations, respecting the selected layer/mask. */
export function editPaintPixels(texture: Texture, label: string, edit: (base: Pixel, x: number, y: number) => Pixel): void {
  if (Undo.current_save) throw new Error("Finish the current edit before painting.");
  const painter = paintRuntime(), previous = painter.current;
  Undo.initEdit({ textures: [texture], bitmap: true });
  try {
    painter.current = {};
    texture.edit((canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d")!;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const offset = painter.current.offset ?? [0, 0];
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const tx = x + offset[0], ty = y + offset[1];
        if (tx < 0 || ty < 0 || tx >= texture.width || ty >= texture.height || !texture.selection.get(tx, ty)) continue;
        const i = (y * canvas.width + x) * 4;
        const pixel = edit({ r: data.data[i], g: data.data[i + 1], b: data.data[i + 2], a: data.data[i + 3] / 255 }, tx, ty);
        data.data.set([pixel.r, pixel.g, pixel.b, pixel.a * 255], i);
      }
      ctx.putImageData(data, 0, 0);
    }, { no_undo: true });
    Undo.finishEdit(label);
  } catch (error) { Undo.cancelEdit(); throw error; }
  finally { painter.current = previous; }
  Canvas.updateAll();
}
