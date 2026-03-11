import { randomUUID } from "node:crypto";

export const CHAT_KIND = "chat.message";
export const ACK_KIND = "delivery.ack";

export const SYSTEM_KINDS = Object.freeze({
  error: "system.error",
  hello: "system.hello",
  history: "system.history",
  metrics: "system.metrics"
});

function requireObject(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Message payload must be an object");
  }

  return payload;
}

function requireString(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  return value;
}

function optionalString(value, fallback = "") {
  if (value === undefined || value === null) {
    return fallback;
  }

  return String(value);
}

function toUnsignedNsString(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return "0";
  }

  const parsed = BigInt(String(value));
  if (parsed < 0n) {
    throw new Error(`${fieldName} must be an unsigned integer`);
  }

  return parsed.toString();
}

function normalizeChatMessage(payload, context) {
  const text = requireString(payload.text, "text").trim();
  if (!text) {
    throw new Error("text must not be empty");
  }

  const username = optionalString(payload.username, context.clientId.slice(0, 8)).trim();
  if (!username) {
    throw new Error("username must not be empty");
  }

  return {
    schemaVersion: 1,
    kind: CHAT_KIND,
    room: context.room,
    messageId: optionalString(payload.messageId, randomUUID()),
    clientId: context.clientId,
    username,
    text,
    sentAtNs: toUnsignedNsString(payload.sentAtNs, "sentAtNs"),
    serverReceivedAtNs: toUnsignedNsString(payload.serverReceivedAtNs, "serverReceivedAtNs"),
    ackForMessageId: ""
  };
}

function normalizeDeliveryAck(payload, context) {
  const ackForMessageId = requireString(payload.ackForMessageId, "ackForMessageId").trim();
  if (!ackForMessageId) {
    throw new Error("ackForMessageId must not be empty");
  }

  return {
    schemaVersion: 1,
    kind: ACK_KIND,
    room: context.room,
    messageId: optionalString(payload.messageId, randomUUID()),
    clientId: context.clientId,
    username: "",
    text: "",
    sentAtNs: toUnsignedNsString(payload.sentAtNs, "sentAtNs"),
    serverReceivedAtNs: toUnsignedNsString(payload.serverReceivedAtNs, "serverReceivedAtNs"),
    ackForMessageId
  };
}

export function normalizeInboundMessage(payload, context) {
  const decoded = requireObject(payload);
  const kind = requireString(decoded.kind, "kind");

  if (kind === CHAT_KIND) {
    return normalizeChatMessage(decoded, context);
  }

  if (kind === ACK_KIND) {
    return normalizeDeliveryAck(decoded, context);
  }

  throw new Error(`Unsupported message kind: ${kind}`);
}

export function createDeliveryAckTemplate(clientId, room) {
  return {
    kind: ACK_KIND,
    room,
    clientId,
    ackForMessageId: "<chat-message-id>",
    sentAtNs: "0"
  };
}
