import { ChatEnvelopeFinalModel } from "../../proto/js/fbe-chat-model.js";

const fbeModel = new ChatEnvelopeFinalModel();

function measure(operation) {
  const startedAt = process.hrtime.bigint();
  const result = operation();
  const finishedAt = process.hrtime.bigint();

  return {
    result,
    durationNs: Number(finishedAt - startedAt)
  };
}

function comparableMessage(message) {
  return {
    schemaVersion: message.schemaVersion,
    kind: message.kind,
    room: message.room,
    messageId: message.messageId,
    clientId: message.clientId,
    username: message.username,
    text: message.text,
    sentAtNs: String(message.sentAtNs),
    serverReceivedAtNs: String(message.serverReceivedAtNs),
    ackForMessageId: message.ackForMessageId
  };
}

function assertParity(expected, actual, label) {
  const left = JSON.stringify(comparableMessage(expected));
  const right = JSON.stringify(comparableMessage(actual));

  if (left !== right) {
    throw new Error(`${label} decode parity check failed`);
  }
}

export function measureDualEncoding(message) {
  const canonical = comparableMessage(message);

  const encodedJson = measure(() => JSON.stringify(canonical));
  const encodedFbe = measure(() => fbeModel.serialize(canonical));
  const decodedJson = measure(() => JSON.parse(encodedJson.result));
  const decodedFbe = measure(() => fbeModel.deserialize(encodedFbe.result));

  assertParity(canonical, decodedJson.result, "JSON");
  assertParity(canonical, decodedFbe.result, "FBE");

  return {
    jsonPayload: encodedJson.result,
    fbeBuffer: encodedFbe.result,
    metrics: {
      size_bytes: {
        fbe: encodedFbe.result.length,
        json: Buffer.byteLength(encodedJson.result, "utf8")
      },
      encode_time_ns: {
        fbe: encodedFbe.durationNs,
        json: encodedJson.durationNs
      },
      decode_time_ns: {
        fbe: decodedFbe.durationNs,
        json: decodedJson.durationNs
      },
      latency_ms: null
    }
  };
}
