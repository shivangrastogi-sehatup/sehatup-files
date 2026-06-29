import { useMemo, useState } from "react";
import Sidebar from "./Sidebar.jsx";
import ChatPanel from "./ChatPanel.jsx";
import { useConversations } from "./useConversations";
import { isFirebaseConfigured } from "./firebase";

export default function App() {
  const { conversations, status, reconnect } = useConversations();
  const [selectedId, setSelectedId] = useState(null);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) || null,
    [conversations, selectedId]
  );

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        status={status}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onReconnect={reconnect}
      />

      {selected ? (
        // key forces a clean remount (fresh listener + state) per conversation
        <ChatPanel key={selected.id} conversation={selected} />
      ) : (
        <main className="placeholder">
          <div className="placeholder-card">
            <div className="placeholder-logo">💬</div>
            <h2>All your WhatsApp conversations</h2>
            <p>Select a chat on the left to read the full thread, send a follow-up, or clear its history.</p>
            {!isFirebaseConfigured && (
              <div className="config-warn">
                <span>⚠️</span>
                <span><b>Firebase not configured.</b> Add your keys to <b>.env</b> to load conversations.</span>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
