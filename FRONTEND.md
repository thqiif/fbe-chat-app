# Frontend Architecture

## Scope

The frontend lives in `/client` as a Vite + React application focused on one job: compare the same chat payload sent over WebSocket as both binary FBE and JSON.

The UI surfaces:

- connection controls for the Node.js backend WebSocket
- a chat composer
- a merged message timeline
- per-message metrics
- overall session metrics

## Key Decisions

### 1. Vite + React over CRA

Vite was chosen because the repo already uses workspaces and Docker-based local development, and Vite gives the simplest dev server and production build path for that setup.

Relevant files:

- `/client/package.json`
- `/client/vite.config.js`
- `/client/index.html`

### 2. WebSocket-first transport

The app sends chat messages over a single WebSocket connection and emits two frames for every logical message:

1. one JSON text frame
2. one binary FBE frame

Both frames carry the same `messageId`, `sessionId`, and `sequence` so the frontend can correlate them into one logical message row and compare transport metrics cleanly.

The default socket URL is derived in this order:

1. `VITE_WS_URL`
2. `VITE_API_URL` converted to `ws://.../ws`
3. fallback `ws://localhost:3001/ws`

Relevant file:

- `/client/src/hooks/useChatSession.js`

### 3. Codec abstraction instead of hard-coupling to generated FBE today

The repo contains `/proto/js` as the future home for generated FBE JavaScript, and the frontend build now exposes that path via the `@proto` alias in `vite.config.js`.

At the moment, the shared generated FBE artifacts are not present, so the client uses a local deterministic binary codec in:

- `/client/src/lib/fbeCodec.js`

This codec is intentionally isolated so it can be replaced later with generated FBE code without rewriting the rest of the UI or metrics pipeline.

### 4. Metrics are computed per logical message, not per raw frame row

Each chat item in the UI represents one logical message. The JSON and FBE versions are merged into that item by `messageId`.

This keeps the UI readable and makes the comparison meaningful:

- payload size is shown as `FBE vs JSON`
- encode time is shown as `FBE vs JSON`
- decode time is shown as `FBE vs JSON`
- latency is shown as `FBE vs JSON`

Relevant files:

- `/client/src/lib/metrics.js`
- `/client/src/components/MessageCard.jsx`
- `/client/src/components/SessionMetrics.jsx`

## WebSocket Contract Assumptions

The current backend in `/server/src/index.js` does not yet expose a WebSocket endpoint. The frontend therefore assumes the backend will add one with the following behavior:

### Endpoint

- `ws://<server-host>:3001/ws`

### Outbound JSON frame shape

```json
{
  "protocol": "chat.v1",
  "encoding": "json",
  "type": "chat",
  "messageId": "uuid",
  "sessionId": "uuid",
  "authorId": "uuid",
  "author": "Metrics Pilot",
  "text": "hello",
  "sentAt": "2026-03-11T12:00:00.000Z",
  "sequence": 1
}
```

### Outbound binary frame shape

The local FBE-style binary envelope uses this field order:

1. `magic` = `FBE1`
2. `version` = `uint16`
3. `kind` = `uint8`
4. reserved byte
5. `sequence` = `uint32`
6. `sentAtMs` = `float64`
7. `messageId` = length-prefixed UTF-8 string
8. `sessionId` = length-prefixed UTF-8 string
9. `authorId` = length-prefixed UTF-8 string
10. `author` = length-prefixed UTF-8 string
11. `text` = length-prefixed UTF-8 string

Relevant file:

- `/client/src/lib/fbeCodec.js`

### Echo / broadcast expectation

For the latency and message-merging logic to work, the backend should either:

- echo both received frames back to the sender, or
- broadcast them to all connected clients unchanged at the payload level

At minimum, the echoed/broadcast payload must preserve:

- `messageId`
- `sessionId`
- `authorId`
- `author`
- `text`
- `sentAt`
- `sequence`

## Metrics Model

### Per-message metrics

Each message row stores:

- `size.json`
- `size.fbe`
- `encodeMs.json`
- `encodeMs.fbe`
- `decodeMs.json`
- `decodeMs.fbe`
- `latencyMs.json`
- `latencyMs.fbe`
- `bandwidthSavingsPercent`

Notes:

- encode/decode timings are measured in the browser with `performance.now()`
- latency is measured from frame send time until the matching frame is received back
- if only one encoding has been echoed so far, the other latency field remains empty

### Session metrics

The session summary aggregates across all logical messages:

- total message count
- total bytes for FBE
- total bytes for JSON
- bandwidth savings percentage
- average encode time improvement
- average decode time improvement
- average FBE vs JSON latency

Improvement percentage is computed as:

```text
(jsonValue - fbeValue) / jsonValue * 100
```

## UI Structure

The UI is split into four pieces:

### Connection panel

Handles socket URL, display name, connect, and disconnect.

File:

- `/client/src/components/ConnectionPanel.jsx`

### Composer

Sends one logical message as both JSON and FBE.

File:

- `/client/src/components/Composer.jsx`

### Message feed

Displays chat content and per-message metrics in a single card.

File:

- `/client/src/components/MessageCard.jsx`

### Session metrics panel

Displays cumulative totals and average improvements.

File:

- `/client/src/components/SessionMetrics.jsx`

## Styling

The visual direction avoids a default dashboard look:

- warm paper background with teal and amber accents
- serif display typography for headers
- glassy metric panels
- responsive two-column desktop layout collapsing to one column on mobile

Primary stylesheet:

- `/client/src/index.css`

## Running The Frontend

From the repo root:

```bash
npm run dev:client
```

From `/client` directly:

```bash
npm install
npm run dev
```

Production preview:

```bash
npm run build --workspace client
npm run start --workspace client
```

## Current Limitation

As of March 11, 2026, the frontend is ready, but the checked-in backend still exposes only HTTP health on `/api/health` and does not yet provide the required WebSocket endpoint. Until `/ws` is implemented server-side, the UI can build and render but cannot complete live chat round trips.
