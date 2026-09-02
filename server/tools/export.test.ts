import { expect, test } from "bun:test";
import { getAllToolDefinitions } from "@/lib/factories";
import { registerExportTools } from "./export";
registerExportTools();

test("exports synchronous text and awaited text/binary codecs with correct byte lengths", async () => {
  const globals = globalThis as unknown as Record<string, unknown>;
  const prior = { Project: globals.Project, Codecs: globals.Codecs, Format: globals.Format };
  Object.assign(globals, { Project: { name: "fixture" }, Format: {}, Codecs: {
    sync: { compile: () => "模型" },
    async: { compile: async () => ({ asset: { version: "2.0" } }) },
    binary: { compile: async () => new DataView(new Uint8Array([9, 1, 2, 8]).buffer, 1, 2) },
    failure: { compile: async () => { throw new Error("codec failed"); } },
  } });
  try {
    const exportModel = getAllToolDefinitions().export_model;
    const sync = JSON.parse(await exportModel.execute({ codec_id: "sync" }) as string);
    expect(sync.content).toBe("模型"); expect(sync.byte_length).toBe(6);
    const async = JSON.parse(await exportModel.execute({ codec_id: "async" }) as string);
    expect(JSON.parse(async.content).asset.version).toBe("2.0");
    expect(async.byte_length).toBe(Buffer.byteLength(async.content));
    const binary = JSON.parse(await exportModel.execute({ codec_id: "binary" }) as string);
    expect(binary.encoding).toBe("base64"); expect(binary.byte_length).toBe(2);
    expect([...Buffer.from(binary.content, "base64")]).toEqual([1, 2]);
    await expect(exportModel.execute({ codec_id: "failure" })).rejects.toThrow("codec failed");
  } finally { Object.assign(globals, prior); }
});
