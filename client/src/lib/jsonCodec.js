import { getByteLength } from './metrics.js';

export function encodeJsonMessage(message) {
  return JSON.stringify({
    protocol: 'chat.v1',
    encoding: 'json',
    type: message.type || 'chat',
    messageId: message.messageId,
    sessionId: message.sessionId,
    authorId: message.authorId,
    author: message.author,
    text: message.text,
    sentAt: message.sentAt,
    sequence: message.sequence || 0,
  });
}

export function decodeJsonMessage(payload) {
  const parsed = JSON.parse(payload);

  if ((parsed.type && parsed.type !== 'chat') || (!parsed.messageId && !parsed.id)) {
    throw new Error('Unsupported JSON message shape');
  }

  return {
    type: 'chat',
    messageId: parsed.messageId || parsed.id,
    sessionId: parsed.sessionId || 'unknown-session',
    authorId: parsed.authorId || parsed.sessionId || 'anonymous',
    author: parsed.author || 'Anonymous',
    text: parsed.text || '',
    sentAt: parsed.sentAt || new Date().toISOString(),
    sequence: parsed.sequence || 0,
  };
}

export function getJsonMessageSize(payload) {
  return getByteLength(payload);
}
