import {expect,test} from "bun:test";
import {loadTextureImage} from "./textureImage";

test("an async native decoder failure rejects without waiting for image timeout", async () => {
  const image = new EventTarget();
  await expect(loadTextureImage({img:image,name:"broken.tga"} as unknown as Texture,async()=>{throw new Error("invalid TGA");})).rejects.toThrow("invalid TGA");
});
