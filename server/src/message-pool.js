export class MessagePool {
  constructor(limit) {
    this.limit = limit;
    this.records = [];
    this.byId = new Map();
    this.pendingLatency = new Map();
  }

  storeChat({ message, metrics, wire }) {
    const record = {
      message,
      metrics: {
        size_bytes: { ...metrics.size_bytes },
        encode_time_ns: { ...metrics.encode_time_ns },
        decode_time_ns: { ...metrics.decode_time_ns },
        latency_ms: metrics.latency_ms
      },
      wire,
      storedAt: new Date().toISOString()
    };

    this.records.push(record);
    this.byId.set(message.messageId, record);

    while (this.records.length > this.limit) {
      const oldest = this.records.shift();
      if (!oldest) {
        break;
      }

      this.byId.delete(oldest.message.messageId);
      this.pendingLatency.delete(oldest.message.messageId);
    }

    return record;
  }

  startLatency(messageId, clientId, startedAtNs) {
    this.pendingLatency.set(messageId, {
      clientId,
      startedAtNs
    });
  }

  finishLatency(messageId, clientId, finishedAtNs) {
    const pending = this.pendingLatency.get(messageId);
    if (!pending || pending.clientId !== clientId) {
      return null;
    }

    this.pendingLatency.delete(messageId);

    const record = this.byId.get(messageId);
    if (!record) {
      return null;
    }

    record.metrics.latency_ms = Number(finishedAtNs - pending.startedAtNs) / 1e6;
    return record;
  }

  list() {
    return [...this.records];
  }
}
