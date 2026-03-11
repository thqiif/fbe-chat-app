const textEncoder = new TextEncoder();

export function measure(fn) {
  const startedAt = performance.now();
  const value = fn();
  return {
    value,
    durationMs: performance.now() - startedAt,
  };
}

export function getByteLength(payload) {
  if (typeof payload === 'string') {
    return textEncoder.encode(payload).byteLength;
  }

  if (payload instanceof ArrayBuffer) {
    return payload.byteLength;
  }

  if (ArrayBuffer.isView(payload)) {
    return payload.byteLength;
  }

  return 0;
}

export function computeSavingsPercent(jsonBytes, fbeBytes) {
  if (!jsonBytes) {
    return 0;
  }

  return ((jsonBytes - fbeBytes) / jsonBytes) * 100;
}

export function computeImprovementPercent(jsonValue, fbeValue) {
  if (!jsonValue) {
    return 0;
  }

  return ((jsonValue - fbeValue) / jsonValue) * 100;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return '--';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function formatDuration(durationMs) {
  if (!Number.isFinite(durationMs)) {
    return '--';
  }

  if (durationMs >= 1) {
    return `${durationMs.toFixed(2)} ms`;
  }

  return `${durationMs.toFixed(3)} ms`;
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${value.toFixed(1)}%`;
}

export function computeSessionMetrics(messages) {
  const totals = messages.reduce(
    (accumulator, message) => {
      accumulator.totalMessages += 1;
      accumulator.jsonBytes += message.metrics.size.json || 0;
      accumulator.fbeBytes += message.metrics.size.fbe || 0;
      accumulator.jsonEncodeMs += message.metrics.encodeMs.json || 0;
      accumulator.fbeEncodeMs += message.metrics.encodeMs.fbe || 0;
      accumulator.jsonDecodeMs += message.metrics.decodeMs.json || 0;
      accumulator.fbeDecodeMs += message.metrics.decodeMs.fbe || 0;

      if (Number.isFinite(message.metrics.latencyMs.json)) {
        accumulator.jsonLatencyMs += message.metrics.latencyMs.json;
        accumulator.jsonLatencySamples += 1;
      }

      if (Number.isFinite(message.metrics.latencyMs.fbe)) {
        accumulator.fbeLatencyMs += message.metrics.latencyMs.fbe;
        accumulator.fbeLatencySamples += 1;
      }

      return accumulator;
    },
    {
      totalMessages: 0,
      jsonBytes: 0,
      fbeBytes: 0,
      jsonEncodeMs: 0,
      fbeEncodeMs: 0,
      jsonDecodeMs: 0,
      fbeDecodeMs: 0,
      jsonLatencyMs: 0,
      fbeLatencyMs: 0,
      jsonLatencySamples: 0,
      fbeLatencySamples: 0,
    },
  );

  const divisor = totals.totalMessages || 1;
  const averageJsonEncodeMs = totals.jsonEncodeMs / divisor;
  const averageFbeEncodeMs = totals.fbeEncodeMs / divisor;
  const averageJsonDecodeMs = totals.jsonDecodeMs / divisor;
  const averageFbeDecodeMs = totals.fbeDecodeMs / divisor;

  return {
    totalMessages: totals.totalMessages,
    totalBytes: {
      json: totals.jsonBytes,
      fbe: totals.fbeBytes,
    },
    bandwidthSavingsPercent: computeSavingsPercent(totals.jsonBytes, totals.fbeBytes),
    averageEncodeMs: {
      json: averageJsonEncodeMs,
      fbe: averageFbeEncodeMs,
    },
    averageDecodeMs: {
      json: averageJsonDecodeMs,
      fbe: averageFbeDecodeMs,
    },
    averageLatencyMs: {
      json: totals.jsonLatencySamples ? totals.jsonLatencyMs / totals.jsonLatencySamples : null,
      fbe: totals.fbeLatencySamples ? totals.fbeLatencyMs / totals.fbeLatencySamples : null,
    },
    averageEncodeImprovementPercent: computeImprovementPercent(averageJsonEncodeMs, averageFbeEncodeMs),
    averageDecodeImprovementPercent: computeImprovementPercent(averageJsonDecodeMs, averageFbeDecodeMs),
  };
}
