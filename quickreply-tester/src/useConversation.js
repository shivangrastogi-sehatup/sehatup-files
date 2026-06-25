import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "./firebase";
import { CONVERSATIONS_COLLECTION } from "./config";

// Live-subscribe to qr_conversations/{docId}/events ordered by savedAt.
// Returns { events, status } where status is "online" | "connecting" | "offline".
export function useConversation(docId) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(
    isFirebaseConfigured ? "connecting" : "no-config"
  );
  const [nonce, setNonce] = useState(0);

  const reconnect = () => setNonce((n) => n + 1);

  useEffect(() => {
    if (!docId) return;
    const db = getDb();
    if (!db) {
      setStatus("no-config");
      return;
    }
    setStatus("connecting");
    const q = query(
      collection(db, CONVERSATIONS_COLLECTION, docId, "events"),
      orderBy("savedAt")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStatus("online");
      },
      (err) => {
        console.error("Firestore listen error:", err);
        setStatus("offline:" + (err.code || "error"));
      }
    );
    return () => unsub();
  }, [docId, nonce]);

  return { events, status, reconnect };
}
