import { useDeferredValue } from 'react';
import Composer from './components/Composer.jsx';
import ConnectionPanel from './components/ConnectionPanel.jsx';
import MessageCard from './components/MessageCard.jsx';
import SessionMetrics from './components/SessionMetrics.jsx';
import { useChatSession } from './hooks/useChatSession.js';

function NoticeStrip({ notices }) {
  return (
    <section className="notice-strip">
      {notices.map((notice) => (
        <div key={notice.id} className={`notice notice-${notice.tone}`}>
          <span>{new Date(notice.at).toLocaleTimeString()}</span>
          <p>{notice.text}</p>
        </div>
      ))}
    </section>
  );
}

export default function App() {
  const {
    author,
    connectionUrl,
    connect,
    disconnect,
    messages,
    notices,
    sendMessage,
    sessionMetrics,
    setAuthor,
    setConnectionUrl,
    status,
  } = useChatSession();

  const visibleMessages = useDeferredValue(messages);

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-one" />
      <div className="backdrop backdrop-two" />

      <header className="hero">
        <div>
          <p className="eyebrow">React Frontend Architect</p>
          <h1>FBE vs JSON Chat Console</h1>
        </div>
        <p className="hero-copy">
          Track payload size, codec timing, and transport latency for the same chat message encoded two different ways over one WebSocket session.
        </p>
      </header>

      <main className="layout">
        <aside className="sidebar">
          <ConnectionPanel
            author={author}
            connectionUrl={connectionUrl}
            onAuthorChange={setAuthor}
            onConnectionUrlChange={setConnectionUrl}
            onConnect={connect}
            onDisconnect={disconnect}
            status={status}
          />
          <SessionMetrics metrics={sessionMetrics} />
          <NoticeStrip notices={notices} />
        </aside>

        <section className="chat-column">
          <Composer disabled={status !== 'connected'} onSend={sendMessage} />
          <section className="message-feed">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Message Feed</p>
                <h2>Chat Timeline</h2>
              </div>
              <span className="message-count">{visibleMessages.length} tracked</span>
            </div>

            <div className="message-list">
              {visibleMessages.length ? (
                visibleMessages.map((message) => <MessageCard key={message.id} message={message} />)
              ) : (
                <div className="empty-state">
                  <p>No messages yet.</p>
                  <span>Connect to the backend and send a message to start the comparison run.</span>
                </div>
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
