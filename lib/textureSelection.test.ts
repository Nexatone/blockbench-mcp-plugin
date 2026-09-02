import { expect, test } from "bun:test";
import { editTextureSelection, strokePoints } from "./textureSelection";

// Binary mask semantics of Blockbench's IntMatrix, including override state.
class Mask {
  width = 64; height = 32;
  override: boolean | null = false;
  pixels = new Uint8Array(64 * 32);
  get(x: number, y: number) { return this.override ?? this.pixels[y * this.width + x]; }
  set(x: number, y: number, value: number) { this.pixels[y * this.width + x] = value; }
  setOverride(value: boolean | null) { this.override = value; if (value === null) this.pixels.fill(0); }
}

test("rectangle and ellipse selections compose beyond the former 16px area", () => {
  const mask = new Mask();
  const coordinates = { x1: 20, y1: 20, x2: 40, y2: 28 };
  editTextureSelection(mask, { action: "select_rectangle", coordinates });
  expect(mask.get(30, 24)).toBe(1); expect(mask.get(2, 2)).toBe(0); expect(mask.get(40, 28)).toBe(0);
  editTextureSelection(mask, { action: "select_ellipse", coordinates, mode: "subtract" });
  expect(mask.get(30, 24)).toBe(0); expect(mask.get(20, 20)).toBe(1);
  editTextureSelection(mask, { action: "select_rectangle", coordinates: { x1: 0, y1: 0, x2: 4, y2: 4 }, mode: "add" });
  expect(mask.get(2, 2)).toBe(1); expect(mask.get(20, 20)).toBe(1);
  editTextureSelection(mask, { action: "select_rectangle", coordinates, mode: "intersect" });
  expect(mask.get(2, 2)).toBe(0); expect(mask.get(20, 20)).toBe(1);
});

test("all, clear, inverse and morphology update real mask bits", () => {
  const mask = new Mask();
  editTextureSelection(mask, { action: "select_all" }); expect(mask.override).toBe(true);
  editTextureSelection(mask, { action: "contract_selection", radius: 2 });
  expect(mask.get(0, 0)).toBe(0); expect(mask.get(2, 2)).toBe(1); expect(mask.get(63, 31)).toBe(0);
  editTextureSelection(mask, { action: "expand_selection", radius: 2 }); expect(mask.get(0, 0)).toBe(1);
  editTextureSelection(mask, { action: "invert_selection" }); expect(mask.pixels.some(Boolean)).toBe(false);
  editTextureSelection(mask, { action: "clear_selection" }); expect(mask.override).toBe(false);
  expect(() => editTextureSelection(mask, { action: "feather_selection", radius: 1 })).toThrow("binary");
  expect(mask.override).toBe(false);
});

test("connected strokes cover midpoints and bound pathological input", () => {
  const points = [{ x: 20, y: 20 }, { x: 40, y: 20 }];
  expect(strokePoints(points, true)).toContainEqual({ x: 30, y: 20 });
  expect(strokePoints(points, false)).toEqual(points);
  expect(() => strokePoints([{ x: 0, y: 0 }, { x: 1e9, y: 0 }], true)).toThrow("100000");
});
