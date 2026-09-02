import { expect, test } from "bun:test";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createTool, createResource, getAllToolDefinitions, registerToolsOnServer, registerResourcesOnServer } from "./factories";
import { createServer, getServer } from "@/server/server";

let calls = 0;
createTool("review_validation_fixture", {
  description: "Validation regression fixture",
  annotations: { readOnlyHint: true, destructiveHint: false },
  parameters: z.object({ nested: z.object({ width: z.number().default(64) }).default({}), fill: z.boolean().default(false), layer: z.string().optional() })
    .refine(data => !data.fill || Boolean(data.layer), { message: "layer required for fill" }),
  async execute(args, context) { context!.reportProgress({ progress: 1, total: 1 }); calls++; return JSON.stringify(args); },
});
createResource("review-resource-fixture", {
  uriTemplate: "review://items/{id}", collectionUri: "review://items", description: "Collection test",
  async readCallback(uri, { id }) { return { contents: [{ uri: uri.href, text: JSON.stringify({ id: id ?? null }) }] }; },
});

test("UI execution applies nested defaults and rejects cross-field errors before mutation", async () => {
  const tool = getAllToolDefinitions().review_validation_fixture;
  expect(JSON.parse(await tool.execute({}) as string)).toEqual({ nested: { width: 64 }, fill: false });
  const before = calls;
  await expect(tool.execute({ fill: true })).rejects.toThrow("layer required");
  expect(calls).toBe(before);
});

for (const reconstructed of [false, true]) test(`SDK registration retains validation, annotations and collection reads (${reconstructed ? "session" : "singleton"})`, async () => {
  const server = reconstructed ? createServer() : getServer();
  if (reconstructed) { registerToolsOnServer(server); registerResourcesOnServer(server); }
  const client = new Client({ name: "review-tests", version: "1" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const listed = await client.listTools();
    expect(listed.tools.find(tool => tool.name === "review_validation_fixture")?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    const before = calls;
    const invalid = await client.callTool({ name: "review_validation_fixture", arguments: { fill: true } });
    expect(invalid.isError).toBe(true);
    expect(calls).toBe(before);
    const valid = await client.callTool({ name: "review_validation_fixture", arguments: {} });
    expect(JSON.parse((valid.content as { text: string }[])[0].text).nested.width).toBe(64);
    const collection = await client.readResource({ uri: "review://items" });
    expect(JSON.parse((collection.contents[0] as { text: string }).text).id).toBe(null);
    const item = await client.readResource({ uri: "review://items/cube" });
    expect(JSON.parse((item.contents[0] as { text: string }).text).id).toBe("cube");
  } finally { await client.close(); await server.close(); }
});
