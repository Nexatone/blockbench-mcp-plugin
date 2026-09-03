import { expect, test } from "bun:test";
import { assignMaterialChannel } from "./material";

test("reassigning layered material textures preserves layers and other channels", () => {
  const layers = [{ name: "painted", pixels: [1, 2, 3, 255] }];
  // Native Texture.extend in 5.1.6 clears layers on partial updates and can
  // then throw on layers.find(selected_layer). Do not call it for these fields.
  const old = { group: "material", pbr_channel: "normal", layers, extend() { throw new Error("native layer bug"); } };
  const incoming = { group: "other", pbr_channel: "height", layers, extend: old.extend };
  const color = { group: "material", pbr_channel: "color", layers };
  const group = { uuid: "material", getTextures: () => [old, color] } as unknown as TextureGroup;
  assignMaterialChannel(group, incoming as unknown as Texture, "normal");
  expect(incoming).toMatchObject({ group: "material", pbr_channel: "normal", layers });
  expect(old.group).toBe("");
  expect(color.group).toBe("material");
  expect(incoming.layers).toBe(layers);
});
