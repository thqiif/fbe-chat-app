import { formatBytes, formatDuration, formatPercent } from '../lib/metrics.js';

function MetricLine({ label, fbeValue, jsonValue }) {
  return (
    <div className="metric-line">
      <span>{label}</span>
      <strong>FBE {fbeValue}</strong>
      <strong>JSON {jsonValue}</strong>
    </div>
  );
}

export default function MessageCard({ message }) {
  const receiptTokens = [];
  if (message.receipts.fbe) {
    receiptTokens.push('FBE ack');
  }
  if (message.receipts.json) {
    receiptTokens.push('JSON ack');
  }

  return (
    <article className={`message-card message-${message.direction}`}>
      <div className="message-header">
        <div>
          <p className="message-author">{message.author}</p>
          <span className="message-meta">
            {new Date(message.sentAt).toLocaleTimeString()} · seq {message.sequence}
          </span>
        </div>
        <div className="message-badges">
          <span className={`direction-pill direction-${message.direction}`}>{message.direction}</span>
          {receiptTokens.map((token) => (
            <span key={token} className="receipt-pill">
              {token}
            </span>
          ))}
        </div>
      </div>

      <p className="message-text">{message.text}</p>

      <div className="message-metrics">
        <MetricLine
          label="Payload"
          fbeValue={formatBytes(message.metrics.size.fbe)}
          jsonValue={formatBytes(message.metrics.size.json)}
        />
        <MetricLine
          label="Encode"
          fbeValue={formatDuration(message.metrics.encodeMs.fbe)}
          jsonValue={formatDuration(message.metrics.encodeMs.json)}
        />
        <MetricLine
          label="Decode"
          fbeValue={formatDuration(message.metrics.decodeMs.fbe)}
          jsonValue={formatDuration(message.metrics.decodeMs.json)}
        />
        <MetricLine
          label="Latency"
          fbeValue={formatDuration(message.metrics.latencyMs.fbe)}
          jsonValue={formatDuration(message.metrics.latencyMs.json)}
        />
      </div>

      <p className="message-footer">
        Bandwidth savings for this message: {formatPercent(message.metrics.bandwidthSavingsPercent)}
      </p>
    </article>
  );
}
