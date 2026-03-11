import { startTransition, useEffect, useRef, useState } from 'react';
import { decodeFbeMessage, encodeFbeMessage } from '../lib/fbeCodec.js';
import { decodeJsonMessage, encodeJsonMessage } from '../lib/jsonCodec.js';
import { computeSavingsPercent, computeSessionMetrics, getByteLength, measure } from '../lib/metrics.js';

function deriveDefaultWsUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  if (import.meta.env.VITE_API_URL) {
    try {
      const url = new URL(import.meta.env.VITE_API_URL);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/ws';
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch {
      return 'ws://localhost:3001/ws';
    }
  }

  return 'ws://localhost:3001/ws';
}

const DEFAULT_WS_URL = deriveDefaultWsUrl();
const DEFAULT_AUTHOR = 'Metrics Pilot';

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `msg-${Math.random().toString(36).slice(2, 10)}`;
}

function createNotice(text, tone = 'info') {
  return {
    id: createId(),
    text,
    tone,
    at: new Date().toISOString(),
  };
}

function createLogicalMessage(message, metrics, direction) {
  return {
    id: message.messageId,
    messageId: message.messageId,
    sessionId: message.sessionId,
    authorId: message.authorId,
    author: message.author,
    text: message.text,
    sentAt: message.sentAt,
    sequence: message.sequence,
    direction,
    metrics,
    receipts: {
      json: false,
      fbe: false,
    },
  };
}

function upsertMessage(collection, nextMessage) {
  const existingIndex = collection.findIndex((message) => message.id === nextMessage.id);

  if (existingIndex === -1) {
    return [...collection, nextMessage].sort(
      (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime(),
    );
  }

  const existing = collection[existingIndex];
  const merged = {
    ...existing,
    ...nextMessage,
    receipts: {
      ...existing.receipts,
      ...nextMessage.receipts,
    },
    metrics: {
      ...existing.metrics,
      size: {
        ...existing.metrics.size,
        ...nextMessage.metrics.size,
      },
      encodeMs: {
        ...existing.metrics.encodeMs,
        ...nextMessage.metrics.encodeMs,
      },
      decodeMs: {
        ...existing.metrics.decodeMs,
        ...nextMessage.metrics.decodeMs,
      },
      latencyMs: {
        ...existing.metrics.latencyMs,
        ...nextMessage.metrics.latencyMs,
      },
      bandwidthSavingsPercent:
        nextMessage.metrics.bandwidthSavingsPercent ?? existing.metrics.bandwidthSavingsPercent,
    },
  };

  const nextCollection = [...collection];
  nextCollection[existingIndex] = merged;
  return nextCollection;
}

async function decodeSocketFrame(data) {
  if (typeof data === 'string') {
    const decoded = measure(() => decodeJsonMessage(data));
    return {
      encoding: 'json',
      message: decoded.value,
      rawSize: getByteLength(data),
      decodeMs: decoded.durationMs,
    };
  }

  let bytes;
  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (data instanceof Blob) {
    bytes = new Uint8Array(await data.arrayBuffer());
  } else {
    return null;
  }

  const decoded = measure(() => decodeFbeMessage(bytes));
  return {
    encoding: 'fbe',
    message: decoded.value,
    rawSize: bytes.byteLength,
    decodeMs: decoded.durationMs,
  };
}

function buildComparisonMetrics(message, overrides = {}) {
  const jsonEncoded = measure(() => encodeJsonMessage(message));
  const fbeEncoded = measure(() => encodeFbeMessage(message));

  const jsonDecoded =
    overrides.decodeMs?.json != null ? { durationMs: overrides.decodeMs.json } : measure(() => decodeJsonMessage(jsonEncoded.value));
  const fbeDecoded =
    overrides.decodeMs?.fbe != null ? { durationMs: overrides.decodeMs.fbe } : measure(() => decodeFbeMessage(fbeEncoded.value));

  const jsonSize = overrides.size?.json ?? getByteLength(jsonEncoded.value);
  const fbeSize = overrides.size?.fbe ?? fbeEncoded.value.byteLength;

  return {
    size: {
      json: jsonSize,
      fbe: fbeSize,
    },
    encodeMs: {
      json: jsonEncoded.durationMs,
      fbe: fbeEncoded.durationMs,
    },
    decodeMs: {
      json: jsonDecoded.durationMs,
      fbe: fbeDecoded.durationMs,
    },
    latencyMs: {
      json: overrides.latencyMs?.json ?? null,
      fbe: overrides.latencyMs?.fbe ?? null,
    },
    bandwidthSavingsPercent: computeSavingsPercent(jsonSize, fbeSize),
  };
}

export function useChatSession() {
  const [status, setStatus] = useState('disconnected');
  const [connectionUrl, setConnectionUrl] = useState(DEFAULT_WS_URL);
  const [author, setAuthor] = useState(DEFAULT_AUTHOR);
  const [messages, setMessages] = useState([]);
  const [notices, setNotices] = useState([
    createNotice('Ready to compare binary and JSON payload performance.'),
  ]);

  const socketRef = useRef(null);
  const clientIdRef = useRef(createId());
  const sequenceRef = useRef(1);
  const pendingLatencyRef = useRef(new Map());

  function pushNotice(text, tone = 'info') {
    startTransition(() => {
      setNotices((current) => [...current.slice(-4), createNotice(text, tone)]);
    });
  }

  function storeMessage(message) {
    startTransition(() => {
      setMessages((current) => upsertMessage(current, message));
    });
  }

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  function disconnect() {
    if (socketRef.current) {
      socketRef.current.close(1000, 'Frontend disconnect');
      socketRef.current = null;
    }

    setStatus('disconnected');
    pushNotice('Socket disconnected.');
  }

  function connect() {
    if (!connectionUrl.trim()) {
      pushNotice('A WebSocket URL is required before connecting.', 'error');
      return;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setStatus('connecting');
    pushNotice(`Connecting to ${connectionUrl}...`);

    const socket = new WebSocket(connectionUrl);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      setStatus('connected');
      pushNotice(`Connected to ${connectionUrl}.`);
    };

    socket.onclose = () => {
      socketRef.current = null;
      setStatus('disconnected');
      pushNotice('Socket closed.');
    };

    socket.onerror = () => {
      pushNotice('WebSocket transport error encountered.', 'error');
    };

    socket.onmessage = async (event) => {
      try {
        const frame = await decodeSocketFrame(event.data);
        if (!frame) {
          return;
        }

        const latencyKey = `${frame.message.messageId}:${frame.encoding}`;
        const sentAt = pendingLatencyRef.current.get(latencyKey);
        const latencyMs = Number.isFinite(sentAt) ? performance.now() - sentAt : null;

        if (pendingLatencyRef.current.has(latencyKey)) {
          pendingLatencyRef.current.delete(latencyKey);
        }

        const metrics = buildComparisonMetrics(frame.message, {
          size: {
            [frame.encoding]: frame.rawSize,
          },
          decodeMs: {
            [frame.encoding]: frame.decodeMs,
          },
          latencyMs: {
            [frame.encoding]: latencyMs,
          },
        });

        storeMessage({
          ...createLogicalMessage(
            frame.message,
            metrics,
            frame.message.authorId === clientIdRef.current ? 'outgoing' : 'incoming',
          ),
          receipts: {
            json: frame.encoding === 'json',
            fbe: frame.encoding === 'fbe',
          },
        });
      } catch (error) {
        pushNotice(error instanceof Error ? error.message : 'Failed to decode socket frame.', 'error');
      }
    };

    socketRef.current = socket;
  }

  function sendMessage(rawText) {
    const text = rawText.trim();
    if (!text) {
      return false;
    }

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      pushNotice('Connect to the backend before sending.', 'error');
      return false;
    }

    const outboundMessage = {
      type: 'chat',
      messageId: createId(),
      sessionId: clientIdRef.current,
      authorId: clientIdRef.current,
      author: author.trim() || DEFAULT_AUTHOR,
      text,
      sentAt: new Date().toISOString(),
      sequence: sequenceRef.current,
    };

    sequenceRef.current += 1;

    const metrics = buildComparisonMetrics(outboundMessage);
    storeMessage(createLogicalMessage(outboundMessage, metrics, 'outgoing'));

    const jsonPayload = encodeJsonMessage(outboundMessage);
    const fbePayload = encodeFbeMessage(outboundMessage);

    try {
      pendingLatencyRef.current.set(`${outboundMessage.messageId}:json`, performance.now());
      socketRef.current.send(jsonPayload);
    } catch (error) {
      pushNotice(error instanceof Error ? error.message : 'Failed to send JSON frame.', 'error');
    }

    try {
      pendingLatencyRef.current.set(`${outboundMessage.messageId}:fbe`, performance.now());
      socketRef.current.send(fbePayload);
    } catch (error) {
      pushNotice(error instanceof Error ? error.message : 'Failed to send FBE frame.', 'error');
    }

    return true;
  }

  return {
    status,
    connectionUrl,
    setConnectionUrl,
    author,
    setAuthor,
    messages,
    notices,
    connect,
    disconnect,
    sendMessage,
    sessionMetrics: computeSessionMetrics(messages),
  };
}
