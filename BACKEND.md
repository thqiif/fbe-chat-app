# Backend Architecture

## Scope

The backend is implemented inside the existing `server` workspace and exposes a single-room WebSocket chat service on the same HTTP port as the Express API.

Core constraints:

- `ws` is the WebSocket transport
- chat state is fully in memory
- one room only: `main`
- every chat message is encoded and decoded in both JSON and FBE
- metrics are retained with each stored chat record

## Runtime Layout

- `/tmp/fbe-chat-app/server/server.js`
  Node entrypoint for the backend workspace
- `/tmp/fbe-chat-app/server/src/index.js`
  Express + HTTP + WebSocket composition
- `/tmp/fbe-chat-app/server/src/message-schema.js`
  canonical message normalization and validation
- `/tmp/fbe-chat-app/server/src/dual-metrics.js`
  side-by-side FBE and JSON encode/decode measurement
- `/tmp/fbe-chat-app/server/src/message-pool.js`
  bounded in-memory history and latency tracking
- `/tmp/fbe-chat-app/proto/chat.fbe`
  source schema for the shared envelope
- `/tmp/fbe-chat-app/proto/js/fbe-chat-model.js`
  local JavaScript FBE final-model codec used by the backend

## Architecture Decisions

### 1. One HTTP server, one WebSocket server

The WebSocket server is attached to the same Node HTTP server that backs Express. That keeps deployment simple and preserves the existing `/api/health` pattern while adding `/api/messages` for message inspection.

### 2. Dual broadcast is explicit

For each accepted `chat.message`, the backend broadcasts:

- one JSON text frame carrying the canonical chat payload
- one FBE binary frame carrying the same canonical chat payload
- one JSON `system.metrics` frame carrying the current comparison metrics

This is deliberate. The requirement is not just internal benchmarking; the server emits both wire representations so clients can compare them directly.

### 3. Metrics are computed from the same canonical payload

The message is normalized once, then encoded/decoded through both codecs from the same object. That removes input-shape drift from the comparison and makes size/time differences attributable to the encoding layer rather than validation differences.

### 4. Round-trip latency is ack-driven

`latency_ms` starts when the backend accepts the original `chat.message`. It is finalized only when the originating client sends `delivery.ack` for that `messageId`. That makes latency a real application round trip instead of a local processing timer.

### 5. Bounded in-memory pool

The message pool is capped by `MESSAGE_POOL_LIMIT`. Each stored chat record keeps:

- canonical message payload
- size metrics for FBE and JSON
- encode/decode timings for FBE and JSON
- latency once the ack arrives
- transport metadata and storage timestamp

No database or file persistence is used.

## Protocol

### Inbound

Clients may send either JSON text or FBE binary frames.

Supported logical kinds:

- `chat.message`
- `delivery.ack`

Example chat payload:

```json
{
  "kind": "chat.message",
  "username": "alice",
  "text": "hello",
  "sentAtNs": "1234567890"
}
```

Example ack payload:

```json
{
  "kind": "delivery.ack",
  "ackForMessageId": "MESSAGE_ID",
  "sentAtNs": "1234567999"
}
```

The server assigns `clientId` and forces all traffic into room `main`.

### Outbound control frames

- `system.hello`
  includes assigned `clientId`, room name, supported formats, and an ack template
- `system.history`
  sends the current in-memory chat records to newly connected clients
- `system.metrics`
  sends per-message metrics immediately after broadcast and again when latency is resolved
- `system.error`
  reports malformed or unsupported payloads

## FBE Notes

The shared schema is defined in [`proto/chat.fbe`](/tmp/fbe-chat-app/proto/chat.fbe), and the JavaScript codec lives in [`proto/js/fbe-chat-model.js`](/tmp/fbe-chat-app/proto/js/fbe-chat-model.js).

The codec uses an FBE final-model style frame:

- 8-byte root header
- little-endian fixed-width numeric fields
- final strings encoded as `uint32 length + UTF-8 bytes`

This matches the FastBinaryEncoding final-model layout described in the upstream FBE documentation and keeps the wire contract isolated in the shared `proto/js` area so it can be replaced with generated artifacts later if the full upstream toolchain is added to the repo.

## Operations

Backend workspace commands:

```bash
cd server
npm install
npm run start
```

Useful environment variables:

- `PORT` default `3001`
- `HOST` default `0.0.0.0`
- `MESSAGE_POOL_LIMIT` default `500`
