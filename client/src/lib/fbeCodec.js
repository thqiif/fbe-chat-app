const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const MAGIC = [0x46, 0x42, 0x45, 0x31];
const VERSION = 1;
const KIND_CHAT = 1;
const HEADER_SIZE = 4 + 2 + 1 + 1 + 4 + 8;

function encodeString(value) {
  return textEncoder.encode(value || '');
}

function writeBytes(target, offset, source) {
  target.set(source, offset);
  return offset + source.byteLength;
}

function writeField(target, view, offset, source) {
  view.setUint32(offset, source.byteLength, true);
  offset += 4;
  return writeBytes(target, offset, source);
}

function readField(bytes, view, offset) {
  const length = view.getUint32(offset, true);
  offset += 4;

  const end = offset + length;
  if (end > bytes.byteLength) {
    throw new Error('Invalid FBE field length');
  }

  return {
    value: textDecoder.decode(bytes.slice(offset, end)),
    offset: end,
  };
}

export function encodeFbeMessage(message) {
  const messageIdBytes = encodeString(message.messageId);
  const sessionIdBytes = encodeString(message.sessionId);
  const authorIdBytes = encodeString(message.authorId);
  const authorBytes = encodeString(message.author);
  const textBytes = encodeString(message.text);

  const totalSize =
    HEADER_SIZE +
    4 +
    messageIdBytes.byteLength +
    4 +
    sessionIdBytes.byteLength +
    4 +
    authorIdBytes.byteLength +
    4 +
    authorBytes.byteLength +
    4 +
    textBytes.byteLength;

  const bytes = new Uint8Array(totalSize);
  const view = new DataView(bytes.buffer);

  let offset = 0;
  MAGIC.forEach((byte) => {
    view.setUint8(offset, byte);
    offset += 1;
  });

  view.setUint16(offset, VERSION, true);
  offset += 2;
  view.setUint8(offset, KIND_CHAT);
  offset += 1;
  view.setUint8(offset, 0);
  offset += 1;
  view.setUint32(offset, message.sequence || 0, true);
  offset += 4;
  view.setFloat64(offset, Date.parse(message.sentAt), true);
  offset += 8;

  offset = writeField(bytes, view, offset, messageIdBytes);
  offset = writeField(bytes, view, offset, sessionIdBytes);
  offset = writeField(bytes, view, offset, authorIdBytes);
  offset = writeField(bytes, view, offset, authorBytes);
  writeField(bytes, view, offset, textBytes);

  return bytes;
}

export function decodeFbeMessage(payload) {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.byteLength < HEADER_SIZE) {
    throw new Error('Incomplete FBE payload');
  }

  MAGIC.forEach((byte, index) => {
    if (view.getUint8(index) !== byte) {
      throw new Error('Unknown FBE message header');
    }
  });

  const version = view.getUint16(4, true);
  const kind = view.getUint8(6);
  if (version !== VERSION || kind !== KIND_CHAT) {
    throw new Error('Unsupported FBE message version');
  }

  let offset = HEADER_SIZE;
  const sequence = view.getUint32(8, true);
  const sentAtMs = view.getFloat64(12, true);

  const messageIdField = readField(bytes, view, offset);
  offset = messageIdField.offset;
  const sessionIdField = readField(bytes, view, offset);
  offset = sessionIdField.offset;
  const authorIdField = readField(bytes, view, offset);
  offset = authorIdField.offset;
  const authorField = readField(bytes, view, offset);
  offset = authorField.offset;
  const textField = readField(bytes, view, offset);

  return {
    type: 'chat',
    messageId: messageIdField.value,
    sessionId: sessionIdField.value,
    authorId: authorIdField.value,
    author: authorField.value || 'Anonymous',
    text: textField.value,
    sentAt: new Date(sentAtMs).toISOString(),
    sequence,
  };
}
