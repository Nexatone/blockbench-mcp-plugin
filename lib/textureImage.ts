/** Wait for native image decoding before returning a preview or saving metadata. */
export function loadTextureImage(texture: Texture, start: () => unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      texture.img.removeEventListener("load", loaded);
      texture.img.removeEventListener("error", failed);
    };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error(`Unable to load texture image "${texture.name}".`)); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error("Texture image loading timed out.")); }, 10000);
    texture.img.addEventListener("load", loaded);
    texture.img.addEventListener("error", failed);
    try { Promise.resolve(start()).catch(error => { cleanup(); reject(error); }); } catch (error) { cleanup(); reject(error); }
  });
}
