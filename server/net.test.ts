import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as net from "node:net";
import { once } from "node:events";
import { z } from "zod";
import createNetServer, { type NetServer, type SessionTransports } from "./net";
import { createTool } from "@/lib/factories";
import { sessionManager } from "@/lib/sessions";

let releaseTool: () => void;
let toolStarted: () => void;
createTool("connection_test_wait", {
  description: "Test fixture for ordered HTTP responses",
  parameters: z.object({}),
  async execute() {
    toolStarted();
    await new Promise<void>((resolve) => { releaseTool = resolve; });
    return "finished";
  },
});

let server: NetServer;
let transports: SessionTransports;
let port: number;
let accepted: net.Socket[];
let clients: net.Socket[];
let nextId = 0;
const originalSessionConfig = sessionManager.getConfig();

beforeEach(async () => {
  accepted = [];
  clients = [];
  [server, transports] = createNetServer(net, {
    port: 0,
    endpoint: "/bb-mcp",
    keepAlive: { sseHeartbeatIntervalMs: 20 },
    sessionConfig: { pingIntervalMs: 0, inactivityTimeoutMs: 60_000 },
  });
  server.on("connection", (socket) => accepted.push(socket));
  await once(server, "listening");
  port = (server.address() as net.AddressInfo).port;
});

afterEach(async () => {
  releaseTool?.();
  for (const socket of [...clients, ...accepted]) socket.destroy();
  await Promise.all([...transports.values()].map((s) => s.server.close()));
  transports.clear();
  sessionManager.clear();
  sessionManager.configure(originalSessionConfig);
  if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function post(method: string, params: object = {}, session?: string, headers: Record<string, string> = {}) {
  return fetch(`http://127.0.0.1:${port}/bb-mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(session ? { "mcp-session-id": session } : {}),
      ...headers,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++nextId, method, params }),
    signal: AbortSignal.timeout(2000),
  });
}

async function initialize() {
  const response = await post("initialize", {
    protocolVersion: "2025-03-26", capabilities: {},
    clientInfo: { name: "connection-tests", version: "1.0" },
  });
  expect(response.status).toBe(200);
  await response.json();
  return response.headers.get("mcp-session-id")!;
}

async function socket() {
  const client = net.connect({ host: "127.0.0.1", port });
  clients.push(client);
  await once(client, "connect");
  return client;
}

async function openSSE(session: string) {
  const client = await socket();
  const response = once(client, "data");
  client.write(`GET /bb-mcp HTTP/1.1\r\nHost: localhost:${port}\r\nAccept: text/event-stream\r\nMcp-Session-Id: ${session}\r\n\r\n`);
  const [chunk] = await response;
  return { client, header: chunk.toString(), peer: accepted.at(-1)! };
}

describe("MCP connection lifecycle", () => {
  test("accepts repeated Accept fields without weakening sensitive header checks", async () => {
    const session = await initialize();
    const client = await socket();
    const response = once(client, "data");
    client.write(`GET /bb-mcp HTTP/1.1\r\nHost: localhost:${port}\r\nAccept: application/json\r\nAccept: text/event-stream\r\nMcp-Session-Id: ${session}\r\n\r\n`);
    expect((await response)[0].toString()).toContain("HTTP/1.1 200");
  });

  test("in-flight tools hold their session alive beyond the inactivity timeout", async () => {
    sessionManager.configure({ inactivityTimeoutMs: 40 });
    const session = await initialize();
    const started = new Promise<void>(resolve => { toolStarted = resolve; });
    const response = post("tools/call", { name: "connection_test_wait", arguments: {} }, session);
    await started;
    await Bun.sleep(80);
    expect(sessionManager.has(session)).toBe(true);
    releaseTool();
    expect((await response).status).toBe(200);
    await (await response).text();
    expect(sessionManager.get(session)?.activeRequests).toBe(0);
  });

  test("binds to loopback and refuses unauthenticated remote binding", () => {
    expect((server.address() as net.AddressInfo).address).toBe("127.0.0.1");
    for (const host of ["0.0.0.0", "::", "192.168.1.10", "example.com"]) {
      expect(() => createNetServer(net, { host, port: 0, endpoint: "/bb-mcp" })).toThrow("Remote access");
    }
  });

  test("validates Host and Origin before routing or creating sessions", async () => {
    for (const origin of ["http://localhost:6274", "http://127.0.0.1:6274", "http://[::1]:6274", `http://localhost:${port}`]) {
      const response = await fetch(`http://127.0.0.1:${port}/ready`, { headers: { origin } });
      expect(response.status).toBe(200);
      await response.text();
    }
    for (const origin of ["", "null", "https://evil.example", "http://localhost:6274/", "http://evil@localhost:6274", "http://127.1:6274", "http://localhost:6275"]) {
      const response = await post("initialize", {}, undefined, { origin });
      expect(response.status).toBe(403);
      await response.text();
    }
    for (const host of ["evil.example", `localhost:${port}.evil`, `evil@localhost:${port}`, `localhost:${port}/`]) {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { headers: { host } });
      expect(response.status).toBe(403);
      await response.text();
    }
    expect(transports.size).toBe(0);
  });

  test("rejects duplicate headers and malformed framing and closes the pipeline", async () => {
    for (const headers of [
      `Host: evil.example\r\nHost: localhost:${port}`,
      `Host: localhost:${port}\r\nHost: evil.example`,
      `Host: localhost:${port}\r\nOrigin: http://localhost:6274\r\nOrigin: https://evil.example`,
      ...["-1", "1x", "1, 1", "1.5"].map(value => `Host: localhost:${port}\r\nContent-Length: ${value}`),
      `Host: localhost:${port}\r\nTransfer-Encoding: chunked`,
    ]) {
      const client = await socket();
      let response = "";
      client.on("data", data => { response += data.toString(); });
      const closed = once(client, "close");
      client.write(`POST /bb-mcp HTTP/1.1\r\n${headers}\r\n\r\nGET /ready HTTP/1.1\r\nHost: localhost:${port}\r\n\r\n`);
      await closed;
      expect(response).toContain("HTTP/1.1 400");
      expect(response).not.toContain("HTTP/1.1 200");
    }
    expect(transports.size).toBe(0);
  });

  test("supports an explicit IPv6 loopback listener", async () => {
    const [ipv6] = createNetServer(net, { host: "::1", port: 0, endpoint: "/bb-mcp" });
    try {
      await once(ipv6, "listening");
      const ipv6Port = (ipv6.address() as net.AddressInfo).port;
      const response = await fetch(`http://[::1]:${ipv6Port}/ready`);
      expect(response.status).toBe(200);
      await response.text();
      expect((ipv6.address() as net.AddressInfo).address).toBe("::1");
    } finally {
      ipv6.closeAllConnections();
      await new Promise<void>(resolve => ipv6.close(() => resolve()));
    }
  });

  test("a disconnected SSE client can reconnect to the same session", async () => {
    const session = await initialize();
    const first = await openSSE(session);
    expect(first.header).toContain("HTTP/1.1 200");
    const closed = once(first.peer, "close");
    first.client.destroy();
    await closed;
    const second = await openSSE(session);
    expect(second.header).toContain("HTTP/1.1 200");
    expect(sessionManager.has(session)).toBe(true);
  });

  test("HTTP responses stay in request order across separate TCP chunks", async () => {
    const session = await initialize();
    const started = new Promise<void>((resolve) => { toolStarted = resolve; });
    const client = await socket();
    let response = "";
    client.on("data", (chunk) => { response += chunk.toString(); });
    const request = (id: number, method: string, params: object) => {
      const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      return `POST /bb-mcp HTTP/1.1\r\nHost: localhost:${port}\r\nAccept: application/json, text/event-stream\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nMcp-Session-Id: ${session}\r\n\r\n${body}`;
    };
    client.write(request(1001, "tools/call", { name: "connection_test_wait", arguments: {} }));
    await started;
    client.write(request(1002, "ping", {}));
    await Bun.sleep(30);
    releaseTool();
    for (let attempts = 0; !(response.includes('"id":1001') && response.includes('"id":1002')) && attempts < 100; attempts++) await Bun.sleep(5);
    expect(response).toContain('"id":1001');
    expect(response).toContain('"id":1002');
    expect(response.indexOf('"id":1001')).toBeLessThan(response.indexOf('"id":1002'));
  });

  test("shutdown closes open SSE and idle sockets so the port can be reused", async () => {
    const session = await initialize();
    const stream = await openSSE(session);
    const idle = await socket();
    const closed = [once(stream.client, "close"), once(idle, "close")];
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all(closed);
    const replacement = net.createServer();
    replacement.listen(port, "127.0.0.1");
    await once(replacement, "listening");
    await new Promise<void>((resolve) => replacement.close(() => resolve()));
  });

  test("unknown and deleted sessions return 404 and a fresh initialize succeeds", async () => {
    const missing = await post("ping", {}, "expired-session");
    expect(missing.status).toBe(404);
    await missing.text();
    const session = await initialize();
    const removed = await fetch(`http://127.0.0.1:${port}/bb-mcp`, {
      method: "DELETE", headers: { "mcp-session-id": session },
    });
    expect(removed.status).toBe(200);
    await removed.text();
    const stale = await post("ping", {}, session);
    expect(stale.status).toBe(404);
    await stale.text();
    expect(await initialize()).not.toBe(session);
  });

  test("concurrent initializations keep independent sessions", async () => {
    const sessions = await Promise.all([initialize(), initialize(), initialize()]);
    expect(new Set(sessions).size).toBe(3);
    expect(transports.size).toBe(3);
    for (const session of sessions) {
      const response = await post("ping", {}, session);
      expect(response.status).toBe(200);
      await response.text();
    }
  });

  test("failed server pings do not evict a client without an SSE stream", async () => {
    const session = await initialize();
    for (let i = 0; i < 10; i++) sessionManager.recordPingFailed(session);
    expect(sessionManager.has(session)).toBe(true);
    const response = await post("ping", {}, session);
    expect(response.status).toBe(200);
    await response.text();
    expect(sessionManager.get(session)?.failedPings).toBe(0);
  });

  test("an inactive session expires and the client can initialize again", async () => {
    sessionManager.configure({ inactivityTimeoutMs: 50 });
    const session = await initialize();
    for (let i = 0; sessionManager.has(session) && i < 100; i++) await Bun.sleep(5);
    expect(sessionManager.has(session)).toBe(false);
    expect(transports.has(session)).toBe(false);
    const response = await post("ping", {}, session);
    expect(response.status).toBe(404);
    await response.text();
    expect(await initialize()).not.toBe(session);
  });

  test("an idle SSE connection receives heartbeats", async () => {
    const stream = await openSSE(await initialize());
    let data = stream.header;
    stream.client.on("data", (chunk) => { data += chunk.toString(); });
    for (let i = 0; !data.includes(": keepalive\n\n") && i < 100; i++) await Bun.sleep(5);
    expect(data).toContain(": keepalive\n\n");
    expect(data).toContain("connection: close");
  });
});
