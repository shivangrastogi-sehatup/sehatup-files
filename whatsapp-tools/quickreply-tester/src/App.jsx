import { useState } from "react";
import PhoneEntry from "./PhoneEntry.jsx";
import ChatScreen from "./ChatScreen.jsx";

// The watched number is remembered on this device so we don't ask on every load.
const STORAGE_KEY = "qr_tester_phone";

function loadSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null; // private mode / storage disabled → just behave as not-saved
  }
}

export default function App() {
  // docId is the full phone (e.g. "919354049041"); null = show the entry screen.
  const [docId, setDocId] = useState(loadSaved);

  const onSubmit = (id) => {
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
    setDocId(id);
  };

  const onLogout = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setDocId(null);
  };

  return (
    <div className="phone">
      {docId ? (
        <ChatScreen
          key={docId}
          session={{ docId, phoneE164: "+" + docId }}
          onLogout={onLogout}
        />
      ) : (
        <PhoneEntry onSubmit={onSubmit} />
      )}
    </div>
  );
}
