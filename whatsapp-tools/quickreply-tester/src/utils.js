// Classify an event type into how it renders.
//   AI_REPLY / AGENT_TEXT -> incoming bot bubble (left)
//   USER_* / CUSTOMER     -> outgoing bubble (right)
//   STATUS / anything else -> centered system pill
export function classify(type) {
  const t = (type || "").toUpperCase();
  if (t === "AI_REPLY" || t === "AGENT_TEXT" || t === "BOT") return "in";
  if (t.startsWith("USER") || t === "CUSTOMER") return "out";
  return "status";
}

// Unified conversations/{convId}/messages schema. From the CUSTOMER's point of view:
//   direction 'in'  = customer → business (their own message) → right bubble ("out")
//   direction 'out' = business → customer (AI or human agent)  → left bubble  ("in")
export function classifyMsg(m) {
  if (m.direction === "in") return "out";
  if (m.direction === "out") return "in";
  return "status";
}

// Message text, or the placeholder label when QuickReply gave us no content
// (human-agent / bot messages arrive text-less as AGENT_PLACEHOLDER / BOT_PLACEHOLDER).
export function msgText(m) {
  if (m.text) return m.text;
  if (m.placeholder) return m.placeholder;
  return "";
}

// savedAt / msgTime can be a Firestore Timestamp, an ISO string, or a number of
// millis. Normalize any of them to epoch millis (0 if unparseable).
export function toMillis(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  }
  if (typeof v.toMillis === "function") return v.toMillis();          // Firestore Timestamp
  if (typeof v.toDate === "function") return v.toDate().getTime();    // Firestore Timestamp (alt)
  if (typeof v.seconds === "number") return v.seconds * 1000 + (v.nanoseconds || 0) / 1e6;
  if (typeof v._seconds === "number") return v._seconds * 1000 + (v._nanoseconds || 0) / 1e6;
  return 0;
}

export function fmtTime(v) {
  const ms = toMillis(v);
  if (!ms) return "";
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

// Full date + time for tooltips, e.g. "24 Jun 2026, 11:12:05 am"
export function fmtFull(v) {
  const ms = toMillis(v);
  if (!ms) return "";
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function dayLabel(v) {
  const ms = toMillis(v);
  if (!ms) return "";
  const d = new Date(ms);
  return d.toDateString() === new Date().toDateString() ? "Today" : d.toDateString();
}

export function genId() {
  return "web_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

// Merge live Firestore events with optimistic (still-sending) messages.
// Dedup is by msgId (our customer sends store the id we generated), so repeated
// identical text never collapses or disappears. A
// pending bubble shows immediately and is replaced by the real event once it
// arrives in Firestore carrying the same msgId.
export function buildTimeline(messages, pending, locals = []) {
  const items = messages.map((m) => ({
    key: m.id,
    kind: classifyMsg(m),
    text: msgText(m),
    ts: m.msgTime != null ? m.msgTime : (m.createdAt || 0),
    type: m._type,
  }));

  // local-only messages carry their own explicit kind ("in" | "out" | "status")
  for (const l of locals) {
    items.push({ key: l.id, kind: l.kind, text: l.text, ts: l.ts, type: l.type });
  }

  // A customer's sent id becomes the message doc id (CF stores doc(String(b.id))),
  // so once the real message lands its optimistic twin is dropped.
  const knownIds = new Set(messages.map((m) => m.id).filter(Boolean));

  for (const p of pending) {
    if (knownIds.has(p.id)) continue; // real message exists, skip the optimistic one
    items.push({ key: p.id, kind: p.kind, text: p.text, ts: p.ts, pending: true });
  }

  items.sort((a, b) => toMillis(a.ts) - toMillis(b.ts));
  return items;
}

// ids of pending messages that now have a real Firestore event (used to prune state)
export function reconciledIds(messages, pending) {
  const known = new Set(messages.map((m) => m.id).filter(Boolean));
  return pending.filter((p) => known.has(p.id)).map((p) => p.id);
}
