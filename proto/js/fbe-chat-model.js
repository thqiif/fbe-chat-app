const encoder = new TextEncoder();
const decoder = new TextDecoder();

const KIND_TO_TYPE = Object.freeze({
  "chat.message": 1,
  "delivery.ack": 2
});

const TYPE_TO_KIND = Object.freeze({
  1: "chat.message",
  2: "delivery.ack"
});

function utf8Bytes(value) {
  return Buffer.from(encoder.encode(value));
}

function stringFieldSize(value) {
  return 4 + utf8Bytes(value).length;
}

function writeString(buffer, offset, value) {
  const bytes = utf8Bytes(value);
  buffer.writeUInt32LE(bytes.length, offset);
  bytes.copy(buffer, offset + 4);
  return offset + 4 + bytes.length;
}

function readString(buffer, offset) {
  const length = buffer.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;

  return {
    value: decoder.decode(buffer.subarray(start, end)),
    nextOffset: end
  };
}

export class ChatEnvelopeFinalModel {
  serialize(message) {
    const structType = KIND_TO_TYPE[message.kind];
    if (!structType) {
      throw new Error(`Unsupported FBE message kind: ${message.kind}`);
    }

    const stringFields = [
      message.messageId,
      message.clientId,
      message.room,
      message.username,
      message.text,
      message.ackForMessageId
    ];

    const bodySize =
      2 +
      1 +
      1 +
      8 +
      8 +
      stringFields.reduce((total, value) => total + stringFieldSize(value), 0);

    const buffer = Buffer.allocUnsafe(8 + bodySize);
    let offset = 0;

    buffer.writeUInt32LE(bodySize, offset);
    offset += 4;
    buffer.writeUInt32LE(structType, offset);
    offset += 4;
    buffer.writeUInt16LE(message.schemaVersion, offset);
    offset += 2;
    buffer.writeUInt8(structType, offset);
    offset += 1;
    buffer.writeUInt8(0, offset);
    offset += 1;
    buffer.writeBigUInt64LE(BigInt(message.sentAtNs), offset);
    offset += 8;
    buffer.writeBigUInt64LE(BigInt(message.serverReceivedAtNs), offset);
    offset += 8;

    offset = writeString(buffer, offset, message.messageId);
    offset = writeString(buffer, offset, message.clientId);
    offset = writeString(buffer, offset, message.room);
    offset = writeString(buffer, offset, message.username);
    offset = writeString(buffer, offset, message.text);
    writeString(buffer, offset, message.ackForMessageId);

    return buffer;
  }

  deserialize(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("FBE payload must be a Buffer");
    }

    if (buffer.length < 28) {
      throw new Error("FBE payload is too small");
    }

    let offset = 0;
    const bodySize = buffer.readUInt32LE(offset);
    offset += 4;
    const structType = buffer.readUInt32LE(offset);
    offset += 4;

    if (buffer.length !== bodySize + 8) {
      throw new Error("FBE payload size mismatch");
    }

    const schemaVersion = buffer.readUInt16LE(offset);
    offset += 2;
    const kindTag = buffer.readUInt8(offset);
    offset += 1;
    offset += 1;
    const sentAtNs = buffer.readBigUInt64LE(offset).toString();
    offset += 8;
    const serverReceivedAtNs = buffer.readBigUInt64LE(offset).toString();
    offset += 8;

    const messageIdField = readString(buffer, offset);
    offset = messageIdField.nextOffset;
    const clientIdField = readString(buffer, offset);
    offset = clientIdField.nextOffset;
    const roomField = readString(buffer, offset);
    offset = roomField.nextOffset;
    const usernameField = readString(buffer, offset);
    offset = usernameField.nextOffset;
    const textField = readString(buffer, offset);
    offset = textField.nextOffset;
    const ackField = readString(buffer, offset);

    const kind = TYPE_TO_KIND[kindTag] || TYPE_TO_KIND[structType];
    if (!kind) {
      throw new Error(`Unsupported FBE struct type: ${structType}`);
    }

    return {
      schemaVersion,
      kind,
      room: roomField.value,
      messageId: messageIdField.value,
      clientId: clientIdField.value,
      username: usernameField.value,
      text: textField.value,
      sentAtNs,
      serverReceivedAtNs,
      ackForMessageId: ackField.value
    };
  }
}
