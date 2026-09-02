import { describe, expect, test } from "bun:test";
import { bakeTimes, handleVector, keyframeValues, setKeyframeValues } from "./animation";
import { batchKeyframeOperationsParameters } from "@/server/tools/animation";

describe("animation value and bake contracts", () => {
  test("preserves zero, expressions and uniform/nonuniform scale", () => {
    expect(keyframeValues(0)).toEqual({ x: 0, y: 0, z: 0 });
    expect(keyframeValues([1, "query.anim_time * 2", 3])).toEqual({ x: 1, y: "query.anim_time * 2", z: 3 });
    const frame = { uniform: true, data: { x: 0, y: 0, z: 0 }, set(axis: "x" | "y" | "z", value: number) {
      if (this.uniform) this.data = { x: value, y: value, z: value }; else this.data[axis] = value;
    } };
    setKeyframeValues(frame as unknown as _Keyframe, [4, 5, 6]);
    expect(frame.data).toEqual({ x: 4, y: 5, z: 6 });
    setKeyframeValues(frame as unknown as _Keyframe, 0);
    expect(frame.data).toEqual({ x: 0, y: 0, z: 0 });
    expect(handleVector(0.3)).toEqual([0.3, 0.3, 0.3]);
  });

  test("rejects unsafe intervals and excessive output before any editor mutation", () => {
    for (const interval of [-1, 0, Infinity, NaN]) {
      expect(() => bakeTimes(0, 1, interval)).toThrow();
      expect(batchKeyframeOperationsParameters.safeParse({ operation: "bake", parameters: { bake_interval: interval } }).success).toBe(false);
    }
    expect(() => bakeTimes(0, 100, 0.00001)).toThrow("exceeds");
    expect(() => bakeTimes(2, 1, 0.1)).toThrow("ordered");
    expect(bakeTimes(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});
