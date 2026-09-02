import { expect, test } from "bun:test";
import { readModelInput } from "./modelInput";

const model = { format_version: "1.12.0", "minecraft:geometry": [{ description: { identifier: "geometry.test" }, bones: [] }] };
const json = JSON.stringify(model);
const unused = () => { throw new Error("Unexpected file read"); };

test("Bedrock import accepts whitespace JSON and both JSON data URL encodings", async () => {
  for (const input of [` \n${json}`, `data:application/json,${encodeURIComponent(json)}`, `data:application/json;base64,${Buffer.from(json).toString("base64")}`]) {
    expect(await readModelInput(input, unused)).toEqual(model);
  }
});

test("Bedrock import reads local paths and decodes file URLs", async () => {
  for (const input of ["C:/models/my model.json", "file:///C:/models/my%20model.json"]) {
    expect(await readModelInput(input, path => { expect(path).toBe("C:/models/my model.json"); return json; })).toEqual(model);
  }
});

test("Bedrock import bounds downloads and rejects unsupported or ambiguous input", async () => {
  const server = Bun.serve({ port: 0, fetch: request => new Response(new URL(request.url).pathname === "/large" ? " ".repeat(17 * 1024 * 1024) : json) });
  try {
    expect(await readModelInput(`http://127.0.0.1:${server.port}/model`, unused)).toEqual(model);
    await expect(readModelInput(`http://127.0.0.1:${server.port}/large`, unused)).rejects.toThrow("16 MiB");
    for (const input of ["{}", "[]", ' {"minecraft:geometry":[]}', ' {"minecraft:geometry":[{},{}]}', "data:text/plain,hello", "ftp://host/file", "file://remote/share/model.json"]) {
      await expect(readModelInput(input, unused)).rejects.toThrow();
    }
  } finally { server.stop(true); }
});
