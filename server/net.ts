import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { EmptyResultSchema } from '@modelcontextprotocol/sdk/types.js'
import type { Server, Socket } from 'node:net'
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerToolsOnServer,
  registerResourcesOnServer,
  registerPromptsOnServer
} from '@/lib/factories'
import { createServer as createMcpServer } from '@/server/server'
import { sessionManager, type SessionConfig } from '@/lib/sessions'

export type NetServer = Server & { closeAllConnections: () => void }

/**
 * Keep-alive configuration. Layered approach — TCP, HTTP, SSE, and MCP-level
 * pings each catch different classes of dead/stale connections.
 */
interface KeepAliveConfig {
  /** Enable TCP keep-alive on accepted sockets */
  enabled: boolean
  /** Initial delay before sending first TCP keep-alive probe (ms) */
  initialDelay: number
  /**
   * Per-socket idle timeout (ms). If the socket sees no I/O for this long
   * it's destroyed at the OS level. 0 disables. Should exceed
   * sseHeartbeatIntervalMs and the session inactivity timeout to avoid
   * fighting application-level liveness.
   */
  idleTimeoutMs: number
  /**
   * Interval (ms) to write SSE comment heartbeats (`: keepalive\n\n`) during
   * a streaming response. Keeps connections alive through proxies/firewalls
   * that drop idle TCP. 0 disables.
   */
  sseHeartbeatIntervalMs: number
  /** Per-ping timeout (ms) for MCP-level server.ping() calls. */
  pingTimeoutMs: number
  /** HTTP Keep-Alive: timeout=N seconds advertised to clients. */
  httpKeepAliveTimeoutSec: number
}

const DEFAULT_KEEP_ALIVE: KeepAliveConfig = {
  enabled: true,
  initialDelay: 30000,           // 30s before first TCP probe
  idleTimeoutMs: 10 * 60 * 1000, // 10min hard socket timeout
  sseHeartbeatIntervalMs: 15000, // 15s SSE comment heartbeat
  pingTimeoutMs: 5000,           // 5s MCP ping timeout
  httpKeepAliveTimeoutSec: 75    // matches typical browser/proxy defaults
}

export type SessionTransports = Map<
  string,
  { transport: WebStandardStreamableHTTPServerTransport; server: McpServer }
>

function getStatusText (status: number): string {
  const texts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    400: 'Bad Request',
    403: 'Forbidden',
    413: 'Content Too Large',
    431: 'Request Header Fields Too Large',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    500: 'Internal Server Error'
  }
  return texts[status] || 'Unknown'
}

/**
 * Whether an HTTP request carries an MCP InitializeRequest. Only initialize
 * requests may create a new session — anything else without a session ID is
 * a client error, not a new connection. Per spec an InitializeRequest must
 * not be part of a JSON-RPC batch, so only a sole non-batched message counts.
 */
function isInitializeRequestBody (method: string, body: string): boolean {
  if (method !== 'POST' || !body) return false
  try {
    const parsed: unknown = JSON.parse(body)
    if (Array.isArray(parsed)) return false
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { method?: unknown }).method === 'initialize'
    )
  } catch {
    return false
  }
}

export default function createNetServer (
  {
    createServer
  }: { createServer: (callback: (socket: Socket) => void) => Server },
  {
    port,
    host = '127.0.0.1',
    endpoint,
    keepAlive = DEFAULT_KEEP_ALIVE,
    sessionConfig
  }: {
    endpoint: string
    port: number
    host?: string
    keepAlive?: Partial<KeepAliveConfig>
    sessionConfig?: Partial<SessionConfig>
  }
): [NetServer, SessionTransports] {
  // Remote access needs authentication; preserve the local native-module boundary.
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error('MCP host must be 127.0.0.1, localhost or ::1. Remote access is not supported.')
  }
  const bindHost = host === 'localhost' ? '127.0.0.1' : host
  const maxHeaderBytes = 16 * 1024
  const maxBodyBytes = 16 * 1024 * 1024
  const sessionTransports: SessionTransports = new Map()
  const sockets = new Set<Socket>()
  const keepAliveConfig = { ...DEFAULT_KEEP_ALIVE, ...keepAlive }

  // Apply session configuration if provided
  if (sessionConfig) {
    sessionManager.configure(sessionConfig)
  }

  // Set up ping callback for session keep-alive.
  // Sends a real MCP ping request to the client to verify the connection is alive.
  sessionManager.setPingCallback(async (sessionId: string) => {
    const session = sessionTransports.get(sessionId)
    if (!session) return false

    try {
      // Send a JSON-RPC ping and wait for the client's response (pong).
      // Bounded by pingTimeoutMs: if the client has no open SSE stream, the
      // SDK silently drops server→client requests and the ping would
      // otherwise wait for the SDK's 60s default request timeout, stacking
      // pending pings.
      await session.server.server.request(
        { method: 'ping' },
        EmptyResultSchema,
        { timeout: keepAliveConfig.pingTimeoutMs }
      )
      return true
    } catch {
      // Ping was not answered — undeliverable (no SSE stream) or client gone.
      // Either way this is informational only; the inactivity timeout reaps.
      return false
    }
  })

  // Register callback to close transport when sessionManager removes a session (e.g., timeout)
  sessionManager.setRemovalCallback(async (sessionId: string) => {
    const session = sessionTransports.get(sessionId)
    if (session) {
      console.log(`[MCP] Closing transport for session: ${sessionId.slice(0, 8)}...`)
      try {
        await session.transport.close()
      } catch (error) {
        console.error('[MCP] Error closing transport:', error)
      } finally {
        sessionTransports.delete(sessionId)
      }
    }
  })

  const httpServer = createServer((socket: Socket) => {
    sockets.add(socket)
    let buffer = Buffer.alloc(0)
    let socketEnded = false
    let processing = false
    let cancelStream: (() => void) | undefined

    // Configure TCP keep-alive for connection health
    if (keepAliveConfig.enabled) {
      socket.setKeepAlive(true, keepAliveConfig.initialDelay)
    }

    // OS-level idle timeout: if no I/O happens for this long, kill the
    // socket. This catches half-open connections that TCP keep-alive misses
    // (e.g., NAT entries silently dropped by intermediaries).
    if (keepAliveConfig.idleTimeoutMs > 0) {
      socket.setTimeout(keepAliveConfig.idleTimeoutMs)
      socket.on('timeout', () => {
        if (!socket.destroyed) {
          console.log('[MCP] Socket idle timeout — closing connection')
          socket.destroy()
        }
      })
    }

    socket.on('data', (chunk: Buffer) => {
      if (socketEnded) return
      buffer = Buffer.concat([buffer, chunk])
      if (buffer.length > maxBodyBytes + maxHeaderBytes) {
        rejectRequest(413, 'Request buffer limit exceeded')
        return
      }
      // A second TCP data event can arrive while a tool is still executing.
      // Keep one parser/response writer per connection to preserve HTTP order.
      if (processing) return
      processing = true
      processHttpRequests().catch(err => {
        console.error('[MCP] Unhandled error in processHttpRequests:', err)
        // Try to send error response if socket is still writable
        if (!socket.destroyed) {
          try {
            sendResponse(
              socket,
              500,
              { 'content-type': 'application/json' },
              JSON.stringify({ error: 'Internal server error' }),
              undefined
            )
          } catch (sendErr) {
            console.error('[MCP] Failed to send error response:', sendErr)
            socket.destroy()
          }
        }
      }).finally(() => { processing = false })
    })

    socket.on('error', (err: Error) => {
      // ECONNRESET is common when clients disconnect abruptly - don't spam logs
      if (err.message !== 'read ECONNRESET') {
        console.error('[MCP] Socket error:', err.message)
      }
      // Clean up the socket
      socket.destroy()
    })

    socket.on('close', () => {
      socketEnded = true
      buffer = Buffer.alloc(0)
      sockets.delete(socket)
      // Cancelling the body releases the SDK's standalone SSE slot. Without
      // this, a reconnect is rejected with 409 until the session expires.
      cancelStream?.()
    })

    async function processHttpRequests () {
      while (true) {
        // Stop processing if socket is no longer writable
        if (socketEnded || socket.destroyed || !socket.writable) {
          return
        }

        // Look for end of HTTP headers
        const headerEnd = buffer.indexOf('\r\n\r\n')
        if (headerEnd > maxHeaderBytes || (headerEnd === -1 && buffer.length > maxHeaderBytes)) {
          rejectRequest(431, 'HTTP headers too large')
          return
        }
        if (headerEnd === -1) return

        const headerSection = buffer.subarray(0, headerEnd).toString()
        const lines = headerSection.split('\r\n')
        const requestLine = /^(GET|POST|DELETE|HEAD|OPTIONS) (\/[^\s]*) HTTP\/1\.1$/.exec(lines[0])
        if (!requestLine || requestLine[2].startsWith('//')) {
          rejectRequest(400, 'Invalid HTTP request line')
          return
        }
        const [, method, path] = requestLine

        // Parse headers
        const headers: Record<string, string> = {}
        for (let i = 1; i < lines.length; i++) {
          const colonIdx = lines[i].indexOf(':')
          if (colonIdx > 0 && /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(lines[i].substring(0, colonIdx))) {
            const key = lines[i].substring(0, colonIdx).toLowerCase()
            const value = lines[i].substring(colonIdx + 1).trim()
            if ((key in headers && key !== 'accept') || /[\x00-\x08\x0a-\x1f\x7f]/.test(value)) {
              rejectRequest(400, 'Duplicate or invalid HTTP header')
              return
            }
            headers[key] = key === 'accept' && headers[key] ? `${headers[key]}, ${value}` : value
          } else {
            rejectRequest(400, 'Invalid HTTP header')
            return
          }
        }

        const address = httpServer.address()
        const boundPort = typeof address === 'object' && address ? address.port : port
        const authorities = ['localhost', '127.0.0.1', '[::1]'].map(name => name + ':' + boundPort)
        if (boundPort === 80) authorities.push('localhost', '127.0.0.1', '[::1]')
        const allowedOrigins = [...authorities.map(name => 'http://' + name),
          'http://localhost:6274', 'http://127.0.0.1:6274', 'http://[::1]:6274']
        if (!authorities.includes(headers.host?.toLowerCase()) ||
            (headers.origin !== undefined && !allowedOrigins.includes(headers.origin.toLowerCase()))) {
          rejectRequest(403, 'Only local MCP Host and Origin values are allowed')
          return
        }
        if ('transfer-encoding' in headers ||
            (headers['content-length'] !== undefined && !/^(0|[1-9][0-9]*)$/.test(headers['content-length']))) {
          rejectRequest(400, 'Use a single valid Content-Length; chunked requests are not supported')
          return
        }
        // Calculate body boundaries
        const bodyStart = headerEnd + 4
        const contentLength = Number(headers['content-length'] || '0')
        if (!Number.isSafeInteger(contentLength) || contentLength > maxBodyBytes) {
          rejectRequest(413, 'HTTP body too large')
          return
        }
        const requestEnd = bodyStart + contentLength

        // Wait for complete request body
        if (buffer.length < requestEnd) return

        const body = buffer.subarray(bodyStart, requestEnd).toString()
        buffer = buffer.subarray(requestEnd)

        // Build Web Standard Request
        const url = `http://localhost:${port}${path}`
        const webHeaders = new Headers()
        for (const [key, value] of Object.entries(headers)) {
          webHeaders.set(key, value)
        }

        const requestInit: RequestInit = {
          method,
          headers: webHeaders
        }

        // Add body for non-GET/HEAD requests
        if (method !== 'GET' && method !== 'HEAD' && body) {
          requestInit.body = body
        }

        const webRequest = new Request(url, requestInit)

        // Health check endpoint for monitoring
        const pathWithoutQuery = path.split('?')[0]
        if (pathWithoutQuery === '/health' || pathWithoutQuery === endpoint + '/health') {
          const healthStatus = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            sessions: {
              active: sessionManager.getCount(),
              config: sessionManager.getConfig()
            }
          }
          sendResponse(
            socket,
            200,
            { 'content-type': 'application/json' },
            JSON.stringify(healthStatus),
            headers['connection']
          )
          continue
        }

        // Ready check endpoint (lighter weight than health)
        if (pathWithoutQuery === '/ready' || pathWithoutQuery === endpoint + '/ready') {
          sendResponse(
            socket,
            200,
            { 'content-type': 'application/json' },
            JSON.stringify({ ready: true }),
            headers['connection']
          )
          continue
        }

        // Check endpoint - must match exactly or have query string/trailing content
        if (
          pathWithoutQuery !== endpoint &&
          !path.startsWith(endpoint + '/') &&
          !path.startsWith(endpoint + '?')
        ) {
          sendResponse(
            socket,
            404,
            { 'content-type': 'text/plain' },
            'Not Found',
            headers['connection']
          )
          continue
        }

        try {
          // Get or create transport for this session
          const sessionId = headers['mcp-session-id']
          let session = sessionId ? sessionTransports.get(sessionId) : null

          // Per MCP spec, an unknown or expired session ID gets 404 Not Found,
          // signalling spec-compliant clients to transparently start a new
          // session with a fresh InitializeRequest. (409 is not in the spec
          // and leaves clients stuck until restart.)
          if (sessionId && !session) {
            console.log(
              `[MCP] Unknown session ID: ${sessionId.slice(0, 8)}... (session expired or not found)`
            )
            sendResponse(
              socket,
              404,
              { 'content-type': 'application/json' },
              JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32001,
                  message: 'Session not found. Please reinitialize.'
                },
                id: null
              }),
              headers['connection']
            )
            continue
          }

          // Only an InitializeRequest may create a new session. Clients
          // (e.g., the SDK client inside mcp-remote) can send GETs,
          // notifications, or DELETEs without a session header while an
          // initialize is in flight — those must be rejected, not treated
          // as new connections.
          if (!session && !isInitializeRequestBody(method, body)) {
            sendResponse(
              socket,
              400,
              { 'content-type': 'application/json' },
              JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32000,
                  message: 'Bad Request: Mcp-Session-Id header is required'
                },
                id: null
              }),
              headers['connection']
            )
            continue
          }

          // No session yet and this is an initialize request: create a new
          // session with its own server and transport
          if (!session) {
            const sessionServer = createMcpServer()

            // Register all tools, resources, and prompts on this session's server
            registerToolsOnServer(sessionServer)
            registerResourcesOnServer(sessionServer)
            registerPromptsOnServer(sessionServer)

            // Filled in below before handleRequest runs; onsessioninitialized
            // (fired during handleRequest) closes over this object, which
            // avoids a shared temporary map key that concurrent initialize
            // requests could clobber.
            const newSession = { server: sessionServer } as {
              transport: WebStandardStreamableHTTPServerTransport
              server: McpServer
            }

            const transport = new WebStandardStreamableHTTPServerTransport({
              sessionIdGenerator: () => crypto.randomUUID(),
              enableJsonResponse: true,
              onsessioninitialized: (newSessionId: string) => {
                console.log(
                  `[MCP] Session initialized: ${newSessionId.slice(0, 8)}...`
                )
                sessionManager.add(newSessionId)
                sessionTransports.set(newSessionId, newSession)

                // Hook into oninitialized to capture client info
                const underlyingServer = sessionServer.server
                underlyingServer.oninitialized = () => {
                  const clientInfo = underlyingServer.getClientVersion()
                  if (clientInfo) {
                    sessionManager.updateClientInfo(
                      newSessionId,
                      clientInfo.name,
                      clientInfo.version
                    )
                  }
                }
              },
              onsessionclosed: (closedSessionId: string) => {
                console.log(
                  `[MCP] Session closed: ${closedSessionId.slice(0, 8)}...`
                )
                // Delete from sessionTransports BEFORE calling sessionManager.remove()
                // to prevent the removal callback from trying to close an already-closing transport
                sessionTransports.delete(closedSessionId)
                sessionManager.remove(closedSessionId)
              }
            })

            // Connect this session's server to its transport
            await sessionServer.connect(transport)

            newSession.transport = transport
            session = newSession
          }

          // Update session activity
          if (sessionId) {
            sessionManager.updateActivity(sessionId)
          }

          // Let the transport handle the MCP protocol
          if (sessionId) sessionManager.beginRequest(sessionId)
          let webResponse: Response
          try {
            webResponse = await session.transport.handleRequest(webRequest)
          } finally {
            if (sessionId) sessionManager.endRequest(sessionId)
          }

          // Convert Web Standard Response to HTTP
          const responseHeaders: Record<string, string> = {}
          webResponse.headers.forEach((value: string, key: string) => {
            responseHeaders[key] = value
          })

          const contentType = webResponse.headers.get('content-type') || ''

          // Ensure content-type is set for non-SSE responses (some clients require it)
          if (!contentType && webResponse.status !== 204) {
            responseHeaders['content-type'] = 'application/json'
          }

          // Handle SSE streams differently from regular responses
          if (contentType.includes('text/event-stream')) {
            // Send headers for SSE
            sendSSEHeaders(socket, webResponse.status, responseHeaders)

            // Stream the body
            if (webResponse.body) {
              const reader = webResponse.body.getReader()

              // SSE heartbeat — write a comment line during silent periods so
              // proxies/firewalls/NAT don't drop the idle TCP connection.
              // Comments (`:`-prefixed lines) are ignored by SSE parsers.
              // We only emit when there's been no real chunk for the full
              // interval, to avoid splitting partial events.
              let lastChunkAt = Date.now()
              const heartbeatMs = keepAliveConfig.sseHeartbeatIntervalMs
              const heartbeat = heartbeatMs > 0
                ? setInterval(() => {
                    if (socketEnded || socket.destroyed || !socket.writable) return
                    if (Date.now() - lastChunkAt < heartbeatMs) return
                    try {
                      socket.write(': keepalive\n\n')
                      lastChunkAt = Date.now()
                    } catch (err) {
                      console.error('[MCP] SSE heartbeat write failed:', err)
                    }
                  }, heartbeatMs)
                : null

              cancelStream = () => {
                if (heartbeat) clearInterval(heartbeat)
                void reader.cancel().catch(() => {})
              }
              // The client can disconnect while handleRequest is pending.
              if (socketEnded || socket.destroyed) cancelStream()

              try {
                while (true) {
                  // Check socket is still writable before each chunk
                  if (socketEnded || socket.destroyed || !socket.writable) break

                  const { done, value } = await reader.read()
                  if (done || socketEnded || socket.destroyed) break

                  if (!socket.write(value)) {
                    await new Promise<void>(resolve => {
                      const resume = () => {
                        socket.off('drain', resume)
                        socket.off('close', resume)
                        resolve()
                      }
                      socket.once('drain', resume)
                      socket.once('close', resume)
                    })
                  }
                  lastChunkAt = Date.now()
                }
              } catch (streamError) {
                console.error('[MCP] SSE stream error:', streamError)
              } finally {
                if (heartbeat) clearInterval(heartbeat)
                await reader.cancel().catch(() => {})
                reader.releaseLock()
                cancelStream = undefined
                socketEnded = true
                socket.end()
              }
            } else {
              socketEnded = true
              socket.end()
            }
          } else {
            // Regular response
            const responseBody = await webResponse.text()
            sendResponse(
              socket,
              webResponse.status,
              responseHeaders,
              responseBody,
              headers['connection']
            )
          }
        } catch (error) {
          console.error('[MCP] Request handler error:', error)
          sendResponse(
            socket,
            500,
            { 'content-type': 'application/json' },
            JSON.stringify({ error: String(error) }),
            headers['connection']
          )
        }
      }
    }

    function rejectRequest(status: number, message: string) {
      buffer = Buffer.alloc(0)
      sendResponse(socket, status, { 'content-type': 'text/plain' }, message, 'close')
    }

    function sendSSEHeaders (
      sock: Socket,
      status: number,
      headers: Record<string, string>
    ): boolean {
      // Don't write to an already-ended socket
      if (socketEnded || sock.destroyed || !sock.writable) {
        return false
      }

      let response = `HTTP/1.1 ${status} ${getStatusText(status)}\r\n`

      // Remove content-length for SSE streams
      delete headers['content-length']

      // Ensure proper SSE headers
      headers['cache-control'] = 'no-cache'
      // This adapter sends a close-delimited stream (no Content-Length or
      // chunk framing), so HTTP clients must not reuse this connection.
      headers['connection'] = 'close'

      for (const [key, value] of Object.entries(headers)) {
        response += `${key}: ${value}\r\n`
      }
      response += '\r\n'

      sock.write(response)
      return true
    }

    function sendResponse (
      sock: Socket,
      status: number,
      headers: Record<string, string>,
      body: string,
      connection?: string
    ): boolean {
      // Don't write to an already-ended socket
      if (socketEnded || sock.destroyed || !sock.writable) {
        return false
      }

      let response = `HTTP/1.1 ${status} ${getStatusText(status)}\r\n`

      // Ensure required HTTP headers
      const bodyBytes = Buffer.byteLength(body)
      headers['content-length'] = bodyBytes.toString()

      // Set connection header based on client request. HTTP/1.1 defaults to
      // keep-alive unless the client explicitly opted out with `close`.
      const keepAlive = connection?.toLowerCase() !== 'close'
      headers['connection'] = keepAlive ? 'keep-alive' : 'close'

      // Tell the client how long we'll hold an idle connection. Helps clients
      // size their pools and avoid sending requests on a socket we're about
      // to close.
      if (keepAlive && keepAliveConfig.httpKeepAliveTimeoutSec > 0) {
        headers['keep-alive'] = `timeout=${keepAliveConfig.httpKeepAliveTimeoutSec}`
      }

      // Add Date header for HTTP/1.1 compliance
      if (!headers['date']) {
        headers['date'] = new Date().toUTCString()
      }

      for (const [key, value] of Object.entries(headers)) {
        response += `${key}: ${value}\r\n`
      }
      response += '\r\n'
      response += body

      // Write response and wait for it to be flushed before closing
      if (!keepAlive) {
        socketEnded = true
        // Use callback to ensure data is flushed before closing
        sock.write(response, () => {
          sock.end()
        })
      } else {
        sock.write(response)
      }

      return true
    }
  })

  httpServer.listen(port, bindHost, () => {
    console.log(`[MCP] Server listening on http://localhost:${port}${endpoint}`)
  })

  httpServer.on('error', (err: Error) => {
    console.error('[MCP] Server error:', err)
    Blockbench.showQuickMessage(`MCP Server error: ${err.message}`, 3000)
  })

  return [Object.assign(httpServer, {
    closeAllConnections() {
      for (const socket of sockets) socket.destroy()
    }
  }), sessionTransports]
}
