import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useConversation } from "./useConversation";
import { getFns } from "./firebase";
import { buildTimeline, reconciledIds, fmtTime, fmtFull, dayLabel, toMillis, genId } from "./utils";
import { N8N_WEBHOOK_URL, TESTER_KEY, WINDOW_MS } from "./config";
import exitIcon from "./assets/exit.png";

function statusText(s) {
  if (s === "online") return "online";
  if (s === "connecting") return "connecting…";
  if (s === "no-config") return "no live view — add .env";
  if (s && s.startsWith("offline")) {
    return s.includes("permission") ? "offline — deploy Firestore rules" : "offline";
  }
  return s || "";
}

// "23h 12m" / "12m" left until ms, or null if already past.
function fmtCountdown(msLeft) {
  if (msLeft <= 0) return null;
  const mins = Math.floor(msLeft / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ChatScreen({ session, onLogout }) {
  const title = (session.name || "").trim() || session.phoneE164;

  const { events, status } = useConversation(session.docId);
  const [pending, setPending] = useState([]);     // optimistic customer messages
  const [lastSentAt, setLastSentAt] = useState(null);
  const [text, setText] = useState("");
  const [toast, setToast] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [now, setNow] = useState(Date.now());     // ticks so the window timer counts down

  const sendingRef = useRef(false);   // re-entrancy lock: one webhook call at a time
  const scrollRef = useRef(null);
  const taRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = (msg, err = false) => {
    setToast({ msg, err });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  // Send a follow-up as the CUSTOMER → n8n (USER_TEXT). Shows on the right.
  const sendCustomer = async (raw) => {
    const body = (raw || "").trim();
    if (!body) return;
    if (!N8N_WEBHOOK_URL) return showToast("No webhook configured — set VITE_WEBHOOK_URL", true);
    if (sendingRef.current) return;      // guard against a duplicate fire of the same action
    sendingRef.current = true;

    const id = genId();
    const ts = new Date().toISOString();
    setPending((p) => [...p, { id, kind: "out", text: body, ts }]);
    setLastSentAt(ts);

    const payload = {
      id,
      phone: session.phoneE164,
      msg_time: Date.now(),
      payload: { _type: "USER_TEXT", text: body },
    };
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const respText = await res.text();
      console.log("n8n webhook response:", res.status, respText);
      if (!res.ok) showToast(`Webhook ${res.status}: ${respText.slice(0, 90)}`, true);
    } catch (e) {
      console.error(e);
      setPending((p) => p.filter((m) => m.id !== id)); // remove optimistic bubble on failure
      showToast("Network error sending message", true);
    } finally {
      sendingRef.current = false;
    }
  };

  // Wipe this phone's conversation history so the bot starts fresh (qrTestClear fn).
  // The view stays on the (now empty) chat — no "say Hi to reconnect" step.
  const clearChat = async () => {
    if (clearing) return;
    if (!window.confirm(`Clear all messages for ${session.phoneE164}?\n\nThis deletes the saved history so the bot starts a fresh conversation.`)) return;
    const fns = getFns();
    if (!fns) return showToast("Firebase not configured — can't clear", true);
    // Reset send state UP FRONT (before the await): the events get deleted via the
    // live listener almost immediately, so if we waited until after the call
    // returned, the "bot is typing…" animation would briefly hang over an empty
    // thread. Clearing lastSentAt now (plus the `!clearing` guard on waitingReply)
    // keeps that animation from ever showing during a delete.
    setPending([]);
    setLastSentAt(null);
    setClearing(true);
    try {
      const res = await httpsCallable(fns, "qrTestClear")({
        to: session.phoneE164,
        ...(TESTER_KEY ? { testerKey: TESTER_KEY } : {}),
      });
      showToast(`Cleared ${res.data?.deleted ?? 0} messages`);
    } catch (e) {
      console.error(e);
      showToast(e?.message || "Clear failed", true);
    } finally {
      setClearing(false);
    }
  };

  // once a pending message's real event lands in Firestore, drop the optimistic twin
  useEffect(() => {
    const done = reconciledIds(events, pending);
    if (done.length) setPending((p) => p.filter((m) => !done.includes(m.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // tick once a minute so the 24h window countdown stays fresh
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const timeline = useMemo(() => buildTimeline(events, pending), [events, pending]);

  // 24h window opens on the LAST inbound customer message (direction 'in') and
  // expires 24h later. Sync the indicator to that real message time.
  const lastCustomerAt = useMemo(() => {
    let max = 0;
    for (const e of events) {
      if (e.direction === "in") max = Math.max(max, toMillis(e.msgTime));
    }
    return max;
  }, [events]);
  const windowExpiresAt = lastCustomerAt ? lastCustomerAt + WINDOW_MS : 0;
  const windowLeft = windowExpiresAt ? fmtCountdown(windowExpiresAt - now) : null;

  // Waiting for a bot/agent reply = an outbound message newer than our last send.
  const waitingReply =
    !clearing &&
    !!lastSentAt &&
    !events.some((e) => e.direction === "out" && toMillis(e.msgTime) > toMillis(lastSentAt));

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline.length, waitingReply]);

  const onSendClick = () => {
    const t = text;
    setText("");
    if (taRef.current) taRef.current.style.height = "auto";
    sendCustomer(t);
  };

  const onKeyDown = (e) => {
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      onSendClick();
    }
  };

  const onInput = (e) => {
    setText(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 110) + "px";
  };

  const online = status === "online";
  let lastDay = "";

  // Header subtitle: live status + window countdown + phone.
  let subtitle = `${statusText(status)} · ${session.phoneE164}`;
  if (windowLeft) subtitle = `window ${windowLeft} left · ${session.phoneE164}`;
  else if (windowExpiresAt) subtitle = `window closed · ${session.phoneE164}`;

  return (
    <section className="screen chat">
      <header className="chat-header">
        <div className="avatar">{session.name ? session.name.trim()[0].toUpperCase() : "👤"}</div>
        <div className="meta">
          <div className="name">{title}</div>
          <div className="status">
            <span className={"dot" + (online ? "" : " off")} />
            {subtitle}
          </div>
        </div>
        <button className="icon-btn" onClick={clearChat} disabled={clearing} title="Clear conversation history">🗑️</button>
        <button className="logout-btn" onClick={onLogout} title="Logout / switch number" aria-label="Logout">
          <img src={exitIcon} alt="Logout" className="logout-icon" />
        </button>
      </header>

      <div className="messages" ref={scrollRef}>
        {timeline.length === 0 && status === "online" && (
          <div className="empty-hint">
            No messages yet. Once the user messages on WhatsApp, replies appear here live.
          </div>
        )}
        {timeline.map((it) => {
          const day = dayLabel(it.ts);
          const sep = day && day !== lastDay ? ((lastDay = day), day) : null;

          if (it.kind === "status") {
            return (
              <FragmentWithSep key={it.key} sep={sep}>
                <div className="status-pill">
                  {it.type ? `${it.type}${it.text ? ` · ${it.text}` : ""}` : it.text}
                </div>
              </FragmentWithSep>
            );
          }
          return (
            <FragmentWithSep key={it.key} sep={sep}>
              <div className={`bubble ${it.kind}${it.pending ? " pending" : ""}`} title={fmtFull(it.ts)}>
                <span className="body">{it.text}</span>
                <span className="ts">
                  {fmtTime(it.ts)}
                  {it.kind === "out" && (
                    <span className={"tick" + (it.pending ? "" : " read")}>
                      {it.pending ? "🕓" : "✓✓"}
                    </span>
                  )}
                </span>
              </div>
            </FragmentWithSep>
          );
        })}

        {waitingReply && (
          <div className="typing-wrap">
            <div className="typing"><span /><span /><span /></div>
            <div className="typing-note">bot replies in ~3 min (batched)</div>
          </div>
        )}
      </div>

      <div className="composer">
        <div className="input-wrap">
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder="Send a follow-up as the customer…"
          />
        </div>
        <button className="send" onClick={onSendClick} title="Send">➤</button>
      </div>

      {toast && <div className={"toast show" + (toast.err ? " err" : "")}>{toast.msg}</div>}
    </section>
  );
}

function FragmentWithSep({ sep, children }) {
  return (
    <>
      {sep && <div className="day-sep">{sep}</div>}
      {children}
    </>
  );
}
