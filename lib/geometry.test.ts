import { describe, expect, test } from "bun:test";
import { validateMeshComponents } from "./geometry";

describe("mesh component validation", () => {
  const mesh = { name: "target", vertices: { a: [0, 0, 0], b: [1, 0, 0] }, faces: { face: {} } } as unknown as Mesh;
  test("deduplicates valid keys without accepting inherited names", () => {
    expect(validateMeshComponents(mesh, ["a", "b", "a"], "vertices")).toEqual(["a", "b"]);
    expect(() => validateMeshComponents(mesh, ["a", "toString"], "vertices")).toThrow("Unknown");
    expect(() => validateMeshComponents(mesh, [], "faces")).toThrow("No faces");
    expect(() => validateMeshComponents(mesh, ["missing"], "faces")).toThrow("Unknown");
    expect(Object.keys(mesh.vertices)).toEqual(["a", "b"]);
  });
});
