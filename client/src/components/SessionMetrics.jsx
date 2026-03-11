import { computeImprovementPercent, formatBytes, formatDuration, formatPercent } from '../lib/metrics.js';

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

export default function SessionMetrics({ metrics }) {
  return (
    <section className="panel panel-elevated">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Session Metrics</p>
          <h2>Aggregate Performance</h2>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard
          label="Messages"
          value={metrics.totalMessages}
          detail="Logical chat messages tracked this session"
        />
        <MetricCard
          label="Payload Size"
          value={`${formatBytes(metrics.totalBytes.fbe)} vs ${formatBytes(metrics.totalBytes.json)}`}
          detail={`Bandwidth savings ${formatPercent(metrics.bandwidthSavingsPercent)}`}
        />
        <MetricCard
          label="Encode Time"
          value={`${formatDuration(metrics.averageEncodeMs.fbe)} vs ${formatDuration(metrics.averageEncodeMs.json)}`}
          detail={`FBE improvement ${formatPercent(metrics.averageEncodeImprovementPercent)}`}
        />
        <MetricCard
          label="Decode Time"
          value={`${formatDuration(metrics.averageDecodeMs.fbe)} vs ${formatDuration(metrics.averageDecodeMs.json)}`}
          detail={`FBE improvement ${formatPercent(metrics.averageDecodeImprovementPercent)}`}
        />
        <MetricCard
          label="Latency"
          value={`${formatDuration(metrics.averageLatencyMs.fbe)} vs ${formatDuration(metrics.averageLatencyMs.json)}`}
          detail={`FBE delta ${formatPercent(computeImprovementPercent(metrics.averageLatencyMs.json || 0, metrics.averageLatencyMs.fbe || 0))}`}
        />
      </div>
    </section>
  );
}
