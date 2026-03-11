import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

import { ChatEnvelopeFinalModel } from "../../proto/js/fbe-chat-model.js";
import { config } from "./config.js";
import { measureDualEncoding } from "./dual-metrics.js";
import {
  ACK_KIND,
  CHAT_KIND,
  SYSTEM_KINDS,
  createDeliveryAckTemplate,
  normalizeInboundMessage
} from "./message-schema.js";
import { MessagePool } from "./message-pool.js";

const app = express();
const httpServer = createServer(app);
const websocketServer = new WebSocketServer({ server: httpServer });
const wireFbeModel = new ChatEnvelopeFinalModel();
const clients = new Map();
const messagePool = new MessagePool(config.messagePoolLimit);

function nowNs() {
  return process.hrtime.bigint();
}

function asBuffer(rawData) {
  if (Buffer.isBuffer(rawData)) {
    return rawData;
  }

  if (rawData instanceof ArrayBuffer) {
    return Buffer.from(rawData);
  }

  return Buffer.from(rawData);
}

function decodeIncomingPayload(rawData, isBinary) {
  if (isBinary) {
    return wireFbeModel.deserialize(asBuffer(rawData));
  }

  return JSON.parse(asBuffer(rawData).toString("utf8"));
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function sendBinary(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(payload, { binary: true });
}

function toMessageRecord(record) {
  return {
    kind: record.message.kind,
    room: record.message.room,
    messageId: record.message.messageId,
    clientId: record.message.clientId,
    username: record.message.username,
    text: record.message.text,
    sentAtNs: record.message.sentAtNs,
    serverReceivedAtNs: record.message.serverReceivedAtNs,
    metrics: record.metrics,
    wire: record.wire,
    storedAt: record.storedAt
  };
}

function broadcastJson(payload) {
  for (const socket of clients.keys()) {
    sendJson(socket, payload);
  }
}

function broadcastBinary(payload) {
  for (const socket of clients.keys()) {
    sendBinary(socket, payload);
  }
}

function broadcastMetrics(record) {
  broadcastJson({
    kind: SYSTEM_KINDS.metrics,
    room: record.message.room,
    messageId: record.message.messageId,
    metrics: record.metrics
  });
}

function sendError(socket, code, detail) {
  sendJson(socket, {
    kind: SYSTEM_KINDS.error,
    code,
    detail
  });
}

function handleChatMessage(normalizedMessage, inboundFormat) {
  const receivedAtNs = nowNs();
  const chatMessage = {
    ...normalizedMessage,
    serverReceivedAtNs: receivedAtNs.toString()
  };

  const dualEncoding = measureDualEncoding(chatMessage);
  const record = messagePool.storeChat({
    message: chatMessage,
    metrics: dualEncoding.metrics,
    wire: {
      inbound_format: inboundFormat,
      outbound_formats: ["json", "fbe"]
    }
  });

  messagePool.startLatency(chatMessage.messageId, chatMessage.clientId, receivedAtNs);
  broadcastJson(chatMessage);
  broadcastBinary(dualEncoding.fbeBuffer);
  broadcastMetrics(record);
}

function handleDeliveryAck(normalizedMessage, socket) {
  const updatedRecord = messagePool.finishLatency(
    normalizedMessage.ackForMessageId,
    normalizedMessage.clientId,
    nowNs()
  );

  if (!updatedRecord) {
    sendError(
      socket,
      "ACK_TARGET_NOT_FOUND",
      `No pending round-trip found for ${normalizedMessage.ackForMessageId}`
    );
    return;
  }

  broadcastMetrics(updatedRecord);
}

function attachWebSocketHandlers() {
  websocketServer.on("connection", (socket) => {
    const state = {
      clientId: randomUUID(),
      room: config.roomName
    };

    clients.set(socket, state);

    sendJson(socket, {
      kind: SYSTEM_KINDS.hello,
      room: state.room,
      clientId: state.clientId,
      protocol: {
        inbound: ["json", "fbe"],
        outbound: ["json", "fbe"],
        ackTemplate: createDeliveryAckTemplate(state.clientId, state.room)
      },
      messagePoolLimit: config.messagePoolLimit
    });

    sendJson(socket, {
      kind: SYSTEM_KINDS.history,
      room: state.room,
      messages: messagePool.list().map(toMessageRecord)
    });

    socket.on("message", (rawData, isBinary) => {
      try {
        const decoded = decodeIncomingPayload(rawData, isBinary);
        const normalizedMessage = normalizeInboundMessage(decoded, {
          clientId: state.clientId,
          room: state.room
        });

        if (normalizedMessage.kind === CHAT_KIND) {
          handleChatMessage(normalizedMessage, isBinary ? "fbe" : "json");
          return;
        }

        if (normalizedMessage.kind === ACK_KIND) {
          handleDeliveryAck(normalizedMessage, socket);
          return;
        }

        sendError(socket, "UNSUPPORTED_KIND", `Unsupported kind: ${normalizedMessage.kind}`);
      } catch (error) {
        sendError(socket, "BAD_MESSAGE", error.message);
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
    });

    socket.on("error", () => {
      clients.delete(socket);
    });
  });
}

function attachHttpHandlers() {
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "server",
      room: config.roomName,
      connections: clients.size,
      messagePoolSize: messagePool.list().length,
      fbeSchemaPath: config.schemaPath,
      fbeJsPath: config.protoJsDir
    });
  });

  app.get("/api/messages", (_req, res) => {
    res.json({
      room: config.roomName,
      count: messagePool.list().length,
      messages: messagePool.list().map(toMessageRecord)
    });
  });
}

export function startServer() {
  attachHttpHandlers();
  attachWebSocketHandlers();

  httpServer.listen(config.port, config.host, () => {
    console.log(`HTTP + WebSocket server listening on http://${config.host}:${config.port}`);
    console.log(`Single chat room: ${config.roomName}`);
    console.log(`FBE schema path: ${config.schemaPath}`);
    console.log(`FBE JavaScript path: ${config.protoJsDir}`);
  });

  return httpServer;
}
