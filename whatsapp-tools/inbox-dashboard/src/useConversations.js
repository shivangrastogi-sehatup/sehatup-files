import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { CONVERSATIONS_COLLECTION } from "./config";
import { toMillis } from "./utils";

// Live-subscribe to the WHOLE qr_conversations collection. Each doc is one user's
// conversation summary: { phone, name, lastUserMessage, lastAiReply, lastAgentReply,
// lastUpdated }. Returns the list sorted by most-recent activity.
//
// We deliberately do NOT use a Firestore orderBy("lastUpdated") query: a doc that
// happens to be missing that field would be silently excluded from the result.
// Sorting client-side keeps every conversation visible.
export function useConversations() {
  const [conversations, setConversations] = useState([]);
  const [status, setStatus] = useState(
    isFirebaseConfigured ? "connecting" : "no-config"
  );
  const [nonce, setNonce] = useState(0);

  const reconnect = () => setNonce((n) => n + 1);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setStatus("no-config");
      return;
    }
    setStatus("connecting");
    const unsub = onSnapshot(
      collection(db, CONVERSATIONS_COLLECTION),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => toMillis(b.lastUpdated) - toMillis(a.lastUpdated));
        setConversations(list);
        setStatus("online");
      },
      (err) => {
        console.error("Firestore listen error:", err);
        setStatus("offline:" + (err.code || "error"));
      }
    );
    return () => unsub();
  }, [nonce]);

  return { conversations, status, reconnect };
}
