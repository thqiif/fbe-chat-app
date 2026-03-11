import { useState } from 'react';

export default function Composer({ disabled, onSend }) {
  const [draft, setDraft] = useState('');

  function submit() {
    if (!draft.trim()) {
      return;
    }

    const sent = onSend(draft);
    if (sent) {
      setDraft('');
    }
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      submit();
    }
  }

  return (
    <section className="panel panel-elevated composer">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Composer</p>
          <h2>Send A Dual-Encoded Message</h2>
        </div>
      </div>

      <textarea
        rows="4"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write a message and send it as both FBE binary and JSON..."
      />

      <div className="actions">
        <button type="button" className="button button-primary" onClick={submit} disabled={disabled}>
          Send Message
        </button>
        <p className="panel-note">Use Ctrl/Cmd + Enter to send.</p>
      </div>
    </section>
  );
}
