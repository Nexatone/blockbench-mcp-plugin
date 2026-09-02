const MAX_MODEL_BYTES = 16 * 1024 * 1024;

export async function readModelInput(input: string, readFile: (path: string) => string): Promise<Record<string, unknown>> {
  let content = input.trim();
  if (content.startsWith("data:")) {
    const match = /^data:application\/json(?:;charset=utf-8)?(;base64)?,(.*)$/s.exec(content);
    if (!match) throw new Error("Expected an application/json data URL.");
    content = match[1] ? Buffer.from(match[2], "base64").toString("utf8") : decodeURIComponent(match[2]);
  } else if (/^https?:\/\//i.test(content)) {
    const response = await fetch(content, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > MAX_MODEL_BYTES) throw new Error("Model exceeds 16 MiB.");
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (!reader) throw new Error("Model download returned no body.");
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_MODEL_BYTES) throw new Error("Model exceeds 16 MiB.");
        chunks.push(value);
      }
    } finally { await reader.cancel(); reader.releaseLock(); }
    content = Buffer.concat(chunks).toString("utf8");
  } else if (!content.startsWith("{") && !content.startsWith("[")) {
    let path = content;
    if (/^file:/i.test(path)) {
      const url = new URL(path);
      if (url.hostname && url.hostname !== "localhost") throw new Error("Only local file URLs are supported.");
      path = decodeURIComponent(url.pathname).replace(/^\/([A-Za-z]:\/)/, "$1");
    } else if (/^[a-z][\w+.-]*:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) throw new Error("Unsupported model URL protocol.");
    content = readFile(path);
  }
  if (Buffer.byteLength(content) > MAX_MODEL_BYTES) throw new Error("Model exceeds 16 MiB.");
  const model: unknown = JSON.parse(content);
  if (!model || typeof model !== "object" || Array.isArray(model) ||
      (!Array.isArray((model as Record<string, unknown>)["minecraft:geometry"]) && !Object.keys(model).some(key => key.startsWith("geometry.")))) {
    throw new Error("Expected a Minecraft Bedrock geometry JSON object.");
  }
  const result = model as Record<string, unknown>;
  const geometries = result["minecraft:geometry"];
  if (Array.isArray(geometries) && (geometries.length !== 1 || !geometries[0] || typeof geometries[0] !== "object")) {
    throw new Error("Provide exactly one Bedrock geometry per import; split multi-geometry files first.");
  }
  if (!Array.isArray(geometries) && Object.keys(result).filter(key => key.startsWith("geometry.")).length !== 1) {
    throw new Error("Provide exactly one legacy Bedrock geometry per import.");
  }
  return result;
}
