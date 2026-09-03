interface PixelSelection {
  width: number;
  height: number;
  get(x: number, y: number): number | boolean;
  set(x: number, y: number, value: number): void;
  setOverride(value: boolean | null): void;
}
interface SelectionRequest {
  action: string;
  coordinates?: { x1: number; y1: number; x2: number; y2: number };
  radius?: number;
  mode?: "create" | "add" | "subtract" | "intersect";
}

/** Blockbench selections are binary masks. Rectangle bounds are half-open. */
export function editTextureSelection(selection: PixelSelection, request: SelectionRequest): void {
  const { action, coordinates, radius = 0, mode = "create" } = request;
  if (action === "feather_selection") throw new Error("feather_selection is deprecated: Blockbench uses binary selection masks; feathering is not supported. Use brush softness for a soft edge.");
  if (action === "select_all") { selection.setOverride(true); return; }
  if (action === "clear_selection") { selection.setOverride(false); return; }
  const shape = action === "select_rectangle" || action === "select_ellipse";
  if (shape && !coordinates) throw new Error("Coordinates are required for a selection shape.");
  if (coordinates && !Object.values(coordinates).every(Number.isFinite)) throw new Error("Selection coordinates must be finite.");
  if ((action === "expand_selection" || action === "contract_selection") && request.radius === undefined) throw new Error("Radius is required to expand or contract a selection.");
  if (!Number.isInteger(radius) || radius < 0 || radius > 128) throw new Error("Selection radius must be an integer from 0 to 128.");
  const { width, height } = selection;
  const before = Uint8Array.from({ length: width * height }, (_, i) => Number(Boolean(selection.get(i % width, Math.floor(i / width)))));
  const next = new Uint8Array(before.length);
  // Summed area table keeps expansion/contraction linear in pixel count.
  const stride = width + 1;
  const sums = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y + 1) * stride + x + 1;
    sums[i] = before[y * width + x] + sums[i - 1] + sums[i - stride] - sums[i - stride - 1];
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    let selected = false;
    if (shape && coordinates) {
      const left = Math.min(coordinates.x1, coordinates.x2), right = Math.max(coordinates.x1, coordinates.x2);
      const top = Math.min(coordinates.y1, coordinates.y2), bottom = Math.max(coordinates.y1, coordinates.y2);
      selected = x + 0.5 >= left && x + 0.5 < right && y + 0.5 >= top && y + 0.5 < bottom;
      if (selected && action === "select_ellipse") {
        selected = ((x + 0.5 - (left + right) / 2) / ((right - left) / 2)) ** 2 +
          ((y + 0.5 - (top + bottom) / 2) / ((bottom - top) / 2)) ** 2 <= 1;
      }
      if (mode === "add") selected ||= Boolean(before[i]);
      if (mode === "subtract") selected = Boolean(before[i]) && !selected;
      if (mode === "intersect") selected &&= Boolean(before[i]);
    } else if (action === "invert_selection") selected = !before[i];
    else {
      const x1 = Math.max(0, x - radius), x2 = Math.min(width, x + radius + 1);
      const y1 = Math.max(0, y - radius), y2 = Math.min(height, y + radius + 1);
      const count = sums[y2 * stride + x2] - sums[y1 * stride + x2] - sums[y2 * stride + x1] + sums[y1 * stride + x1];
      selected = action === "expand_selection" ? count > 0 : count === (2 * radius + 1) ** 2;
    }
    next[i] = Number(selected);
  }
  selection.setOverride(false);
  selection.setOverride(null);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) selection.set(x, y, next[y * width + x]);
}

export function strokePoints(points: { x: number; y: number }[], connect: boolean) {
  const result: { x: number; y: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    const point = points[i], previous = points[i - 1];
    const steps = connect && previous ? Math.ceil(Math.max(Math.abs(point.x - previous.x), Math.abs(point.y - previous.y))) : 0;
    if (result.length + steps + 1 > 100000) throw new Error("Stroke exceeds 100000 samples; split it into smaller strokes.");
    if (steps) for (let step = 1; step <= steps; step++) result.push({
      x: previous.x + (point.x - previous.x) * step / steps,
      y: previous.y + (point.y - previous.y) * step / steps,
    });
    else if (!previous || !connect) result.push(point);
  }
  return result;
}
