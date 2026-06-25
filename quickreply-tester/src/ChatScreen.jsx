import { useEffect, useMemo, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { useConversation } from "./useConversation";
import { getFns } from "./firebase";
import { buildTimeline, reconciledIds, classify, fmtTime, fmtFull, dayLabel, toMillis, genId } from "./utils";
import { N8N_WEBHOOK_URL, TESTER_KEY, BOT_NAME, WINDOW_MS } from "./config";

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

export default function ChatScreen({ session, onBack, onReopenWhatsApp }) {
  const { events, status, reconnect } = useConversation(session.docId);
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

  // The bridge is "connected" once any real event for this phone exists in
  // Firestore — i.e. the user's "Hi" (or any later message) has flowed through
  // QuickReply → n8n and been mirrored into qr_conversations/{phone}/events.
  const bridgeConnected = events.length > 0;

  // Send a follow-up as the CUSTOMER → n8n (USER_TEXT). Shows on the right.
  const sendCustomer = async (raw) => {
    const body = (raw || "").trim();
    if (!body) return;
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
  const clearChat = async () => {
    if (clearing) return;
    if (!window.confirm(`Clear all messages for ${session.phoneE164}?\n\nThis deletes the saved history so the bot starts a fresh conversation.`)) return;
    const fns = getFns();
    if (!fns) return showToast("Firebase not configured — can't clear", true);
    setClearing(true);
    try {
      const res = await httpsCallable(fns, "qrTestClear")({
        to: session.phoneE164,
        ...(TESTER_KEY ? { testerKey: TESTER_KEY } : {}),
      });
      setPending([]);
      setLastSentAt(null);
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

  // 24h window opens on the LAST inbound customer message (USER_* → "out") and
  // expires 24h later. Sync the indicator to that real message time.
  const lastCustomerAt = useMemo(() => {
    let max = 0;
    for (const e of events) {
      if (classify(e.type) === "out") max = Math.max(max, toMillis(e.savedAt));
    }
    return max;
  }, [events]);
  const windowExpiresAt = lastCustomerAt ? lastCustomerAt + WINDOW_MS : 0;
  const windowLeft = windowExpiresAt ? fmtCountdown(windowExpiresAt - now) : null;

  const waitingReply =
    !!lastSentAt &&
    !events.some((e) => classify(e.type) === "in" && toMillis(e.savedAt) > toMillis(lastSentAt));

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

  // Header subtitle: live status + window countdown (once connected).
  let subtitle = statusText(status);
  if (bridgeConnected) {
    if (windowLeft) subtitle = `window ${windowLeft} left`;
    else if (windowExpiresAt) subtitle = "window closed";
  }

  return (
    <section className="screen chat">
      <header className="chat-header">
        <button className="icon-btn" onClick={onBack} title="Back">‹</button>
        <div className="avatar">{(BOT_NAME[0] || "S").toUpperCase()}</div>
        <div className="meta">
          <div className="name">{BOT_NAME}</div>
          <div className="status">
            <span className={"dot" + (online ? "" : " off")} />
            {subtitle} · {session.phoneE164}
          </div>
        </div>
        <button className="icon-btn" onClick={clearChat} disabled={clearing} title="Clear conversation history">🗑️</button>
        <button className="icon-btn" onClick={reconnect} title="Reconnect">⟳</button>
      </header>

      {!bridgeConnected ? (
        <div className="bridge-wait">
          <div className="bridge-card">
            <div className="bridge-spinner" />
            <h3>Waiting for the bridge…</h3>
            <p>
              Open WhatsApp and send <b>“Hi”</b> to start the chat. As soon as your
              message reaches the bot, this connects automatically.
            </p>
            <button className="btn-primary" onClick={onReopenWhatsApp}>
              <span>💬</span><span>Open WhatsApp again</span>
            </button>
            <div className="bridge-status">
              <span className={"dot" + (online ? "" : " off")} />
              {statusText(status)} · watching {session.phoneE164}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="messages" ref={scrollRef}>
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
                placeholder="Type a follow-up…"
              />
            </div>
            <button className="send" onClick={onSendClick} title="Send">➤</button>
          </div>
        </>
      )}

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
