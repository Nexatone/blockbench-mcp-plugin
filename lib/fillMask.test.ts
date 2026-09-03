import {expect,test} from "bun:test";
import {colorFillMask} from "./fillMask";

test("fill connectivity, tolerance and selection barriers", () => {
  const pixels = new Uint8ClampedArray([100,0,0,255, 110,0,0,255, 255,255,255,255, 100,0,0,255]);
  const fill = (tolerance: number, connected: boolean, allowed = (x: number) => true) => [...colorFillMask(pixels,4,1,0,0,tolerance,connected,allowed)];
  expect(fill(0,true)).toEqual([1,0,0,0]);
  expect(fill(4,true)).toEqual([1,1,0,0]);
  expect(fill(4,false)).toEqual([1,1,0,1]);
  expect(fill(100,true,x=>x!==1)).toEqual([1,0,0,0]);
  expect(fill(100,false,x=>x!==1)).toEqual([1,0,1,1]);
  expect([...colorFillMask(pixels,4,1,-1,0,0,true,()=>true)]).toEqual([0,0,0,0]);
  expect(()=>fill(Infinity,true)).toThrow();
});

test("fill treats hidden RGB as equal when both pixels are fully transparent", () => {
  const pixels = new Uint8ClampedArray([10,20,30,0, 70,80,90,0, 10,20,30,1]);
  expect([...colorFillMask(pixels,3,1,0,0,0,true,()=>true)]).toEqual([1,1,0]);
});
