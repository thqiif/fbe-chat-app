export default function ConnectionPanel({
  author,
  connectionUrl,
  onAuthorChange,
  onConnectionUrlChange,
  onConnect,
  onDisconnect,
  status,
}) {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  return (
    <section className="panel panel-elevated">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Transport</p>
          <h2>WebSocket Link</h2>
        </div>
        <span className={`status-pill status-${status}`}>{status}</span>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>WebSocket URL</span>
          <input
            type="text"
            value={connectionUrl}
            onChange={(event) => onConnectionUrlChange(event.target.value)}
            placeholder="ws://localhost:8080"
          />
        </label>

        <label className="field">
          <span>Display name</span>
          <input
            type="text"
            value={author}
            onChange={(event) => onAuthorChange(event.target.value)}
            placeholder="Metrics Pilot"
          />
        </label>
      </div>

      <div className="actions">
        <button type="button" className="button button-primary" onClick={onConnect} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect'}
        </button>
        <button type="button" className="button button-secondary" onClick={onDisconnect} disabled={!isConnected && !isConnecting}>
          Disconnect
        </button>
      </div>

      <p className="panel-note">
        Each send emits one JSON text frame and one binary FBE frame with the same message identifier so the client can compare payload size, codec cost, and round-trip latency.
      </p>
    </section>
  );
}
