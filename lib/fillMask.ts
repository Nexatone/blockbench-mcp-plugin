/** Four-connected or global color matching; tolerance is max RGBA distance in percent. */
export function colorFillMask(pixels: Uint8ClampedArray, width: number, height: number, x: number, y: number, tolerance: number, connected: boolean, allowed: (x: number, y: number) => boolean): Uint8Array {
  const mask = new Uint8Array(width * height);
  if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100) throw new Error("Fill tolerance must be 0–100.");
  if (x < 0 || y < 0 || x >= width || y >= height || !allowed(x, y)) return mask;
  const source = (y * width + x) * 4, threshold = tolerance * 255 / 100;
  const matches = (i: number) => {
    if (!allowed(i % width, Math.floor(i / width))) return false;
    const p = i * 4;
    if (pixels[p + 3] === 0 && pixels[source + 3] === 0) return true;
    return [0, 1, 2, 3].every(channel => Math.abs(pixels[p + channel] - pixels[source + channel]) <= threshold);
  };
  if (!connected) {
    for (let i = 0; i < mask.length; i++) mask[i] = Number(matches(i));
    return mask;
  }
  const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length);
  let head = 0, tail = 1;
  queue[0] = y * width + x; seen[queue[0]] = 1;
  while (head < tail) {
    const i = queue[head++];
    if (!matches(i)) continue;
    mask[i] = 1;
    const px = i % width, py = Math.floor(i / width);
    const visit = (next: number) => { if (!seen[next]) { seen[next] = 1; queue[tail++] = next; } };
    if (px > 0) visit(i - 1);
    if (px + 1 < width) visit(i + 1);
    if (py > 0) visit(i - width);
    if (py + 1 < height) visit(i + width);
  }
  return mask;
}
