import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { createCanvas, loadImage, type Canvas as RasterCanvas } from "@napi-rs/canvas";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tinycolor from "tinycolor2";
import { getAllToolDefinitions } from "@/lib/factories";
import { createTextureParameters, registerTextureTools } from "./texture";

// Model only the Texture API used by create_texture. Blockbench 5.1.6 creates
// a 16x16 canvas regardless of constructor width/height, then updates metadata
// from the loaded image. Rendering and PNG encoding/decoding here are real.
// https://github.com/JannisX11/blockbench/blob/v5.1.6/js/texturing/textures.js
class TestTexture {
  static all: TestTexture[] = [];
  name: string;
  width: number;
  height: number;
  canvas = createCanvas(16, 16);
  ctx = this.canvas.getContext("2d");
  source = "";
  internal = true;
  layers_enabled = false;
  layers: { name: string; canvas: RasterCanvas }[] = [];
  img = new EventTarget();
  loaded: Promise<void> = Promise.resolve();
  importedFile?: { name: string; path: string };

  constructor({ name, width, height }: { name: string; width: number; height: number }) {
    this.name = name;
    // Native dimensions are populated by image decoding, not these options.
    this.width = 0;
    this.height = 0;
  }

  getActiveCanvas(): this {
    return this;
  }

  updateSource(source: string): this {
    this.source = source;
    return this.load();
  }

  load(): this {
    this.loaded = loadImage(this.source).then((image) => {
      this.width = this.canvas.width = image.width;
      this.height = this.canvas.height = image.height;
      this.ctx.drawImage(image, 0, 0);
      this.img.dispatchEvent(new Event("load"));
    });
    return this;
  }

  fromFile(file: { name: string; path: string }): this {
    this.importedFile = file;
    this.name = file.name;
    this.source = file.path;
    this.internal = false;
    return this;
  }

  fillParticle(): void {}
  activateLayers(): void {
    const canvas = createCanvas(this.width, this.height);
    canvas.getContext("2d").drawImage(this.canvas, 0, 0);
    this.layers_enabled = true;
    this.layers.push({ name: "layer", canvas });
  }
  updateLayerChanges(): void {} // No layers on a newly constructed texture.

  add(): this {
    TestTexture.all.push(this);
    return this;
  }

  getDataURL(): string {
    return this.internal ? this.source : this.canvas.toDataURL("image/png");
  }
}

interface TextureAspects {
  textures: TestTexture[];
  bitmap?: boolean;
}

let initialAspects: TextureAspects;
let undoBefore: string[];
let undoAfter: string[];
const project = { texture_width: 16, texture_height: 16 };
const globals = {
  Texture: TestTexture,
  tinycolor,
  Project: project,
  Canvas: { updateAll(): void {} },
  Undo: {
    initEdit(aspects: TextureAspects): void {
      initialAspects = aspects;
      undoBefore = aspects.textures.map((texture) => texture.source);
    },
    finishEdit(_label: string, aspects = initialAspects): void {
      undoAfter = aspects.textures.map((texture) => texture.source);
    },
  },
};
const previousGlobals = Object.fromEntries(
  Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
);
Object.assign(globalThis, globals);
registerTextureTools();
const createTexture = getAllToolDefinitions().create_texture;
const temporaryDirectory = mkdtempSync(join(tmpdir(), "texture-dimensions-"));

afterAll(() => {
  for (const [key, descriptor] of Object.entries(previousGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

beforeEach(() => {
  TestTexture.all = [];
  undoBefore = [];
  undoAfter = [];
  project.texture_width = project.texture_height = 16;
});

async function runCreate(args: Record<string, unknown>) {
  return createTexture.execute(createTextureParameters.parse(args));
}

async function expectPng(source: string, width: number, height: number, rgba: number[]): Promise<void> {
  const image = await loadImage(source);
  expect([image.width, image.height]).toEqual([width, height]);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const expected = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < expected.length; offset += 4) expected.set(rgba, offset);
  expect(pixels).toEqual(expected);
  // Explicit far-corner assertion catches a fill clipped to the old 16x16 area.
  expect(Array.from(ctx.getImageData(width - 1, height - 1, 1, 1).data)).toEqual(rgba);
}

describe("create_texture blank image dimensions", () => {
  const sizes = [
    { label: "omitted dimensions", args: {}, width: 16, height: 16 },
    { label: "64x64", args: { width: 64, height: 64 }, width: 64, height: 64 },
    { label: "64x32", args: { width: 64, height: 32 }, width: 64, height: 32 },
    { label: "omitted height", args: { width: 64 }, width: 64, height: 16 },
    { label: "omitted width", args: { height: 32 }, width: 16, height: 32 },
  ];
  for (const { label, args, width, height } of sizes) {
    for (const filled of [true, false]) {
      test(`${filled ? "filled" : "transparent"} ${label}`, async () => {
        const result = await runCreate({
          name: "test_texture",
          ...args,
          ...(filled ? { fill_color: "#34B6A0", layer_name: "base" } : {}),
        });
        if (typeof result === "string") throw new Error(result);
        const image = result.content[0];
        if (image.type !== "image") throw new Error("Expected an MCP image result");
        expect(image.mimeType).toBe("image/png");
        const rgba = filled ? [52, 182, 160, 255] : [0, 0, 0, 0];
        await expectPng(`data:image/png;base64,${image.data}`, width, height, rgba);
        const texture = TestTexture.all[0];
        expect([texture.canvas.width, texture.canvas.height]).toEqual([width, height]);
        expect([texture.width, texture.height]).toEqual([width, height]);
        await expectPng(texture.source, width, height, rgba);
        if (filled) {
          expect(texture.layers[0].name).toBe("base");
          await expectPng(texture.layers[0].canvas.toDataURL("image/png"), width, height, rgba);
        }
        expect(project).toEqual({ texture_width: 16, texture_height: 16 });
      });
    }
  }

  test("preserves an unrelated texture and records the created bitmap for undo/redo", async () => {
    const existing = new TestTexture({ name: "existing", width: 32, height: 16 });
    existing.canvas.width = 32;
    existing.ctx.fillStyle = "#FF0000";
    existing.ctx.fillRect(0, 0, 32, 16);
    existing.source = existing.canvas.toDataURL("image/png");
    existing.load();
    await existing.loaded;
    existing.add();
    const previous = existing.source;
    await runCreate({ name: "new", width: 64, height: 32, fill_color: "#34B6A0", layer_name: "base" });
    expect(TestTexture.all).toHaveLength(2);
    expect([existing.width, existing.height]).toEqual([32, 16]);
    expect(existing.getDataURL()).toBe(previous);
    expect(undoBefore).toEqual([]);
    expect(initialAspects.bitmap).toBe(true);
    expect(undoAfter).toHaveLength(1);
    await expectPng(undoAfter[0], 64, 32, [52, 182, 160, 255]);
  });
});

describe("create_texture imports", () => {
  for (const mode of ["data URL", "file path", "file URL"] as const) {
    test(`preserves ${mode} image dimensions and pixels`, async () => {
      const canvas = createCanvas(40, 24);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#34B6A0";
      ctx.fillRect(0, 0, 40, 24);
      ctx.clearRect(39, 23, 1, 1);
      const png = canvas.toDataURL("image/png");
      const path = join(temporaryDirectory, `${mode.replaceAll(" ", "-")}.png`);
      writeFileSync(path, canvas.toBuffer("image/png"));
      const data = mode === "data URL" ? png : mode === "file URL" ? `file://${path}` : path;
      await runCreate({ name: "imported", width: 64, height: 64, data });
      const texture = TestTexture.all[0];
      await texture.loaded; // Import loading is asynchronous in Blockbench.
      expect([texture.width, texture.height]).toEqual([40, 24]);
      expect([texture.canvas.width, texture.canvas.height]).toEqual([40, 24]);
      expect(texture.ctx.getImageData(0, 0, 40, 24).data).toEqual(ctx.getImageData(0, 0, 40, 24).data);
      if (mode === "data URL") expect(texture.source).toBe(png);
      else expect(texture.importedFile?.path).toBe(path);
      expect(texture.layers_enabled).toBe(false);
      expect(project).toEqual({ texture_width: 16, texture_height: 16 });
    });
  }
});
