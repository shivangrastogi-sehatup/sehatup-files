// Classify an event type into how it renders.
//   AI_REPLY / AGENT_TEXT / BOT -> incoming bot/agent bubble (left)
//   USER_* / CUSTOMER           -> the customer's bubble (right)
//   STATUS / anything else       -> centered system pill
export function classify(type) {
  const t = (type || "").toUpperCase();
  if (t === "AI_REPLY" || t === "AGENT_TEXT" || t === "BOT" || t === "AGENT") return "in";
  if (t.startsWith("USER") || t === "CUSTOMER") return "out";
  return "status";
}

// savedAt / lastUpdated can be a Firestore Timestamp, an ISO string, or a number
// of millis. Normalize any of them to epoch millis (0 if unparseable).
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

// Compact "last activity" stamp for the conversation list: time if today,
// "Yesterday", or a short date otherwise.
export function fmtRelative(v) {
  const ms = toMillis(v);
  if (!ms) return "";
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(ms);
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function genId() {
  return "web_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

// Merge live Firestore events with optimistic (still-sending) messages.
// Dedup is by msgId (our sends store the id we generated), so repeated identical
// text never collapses. A pending bubble shows immediately and is replaced by the
// real event once it arrives in Firestore carrying the same msgId.
export function buildTimeline(events, pending) {
  const items = events.map((ev) => ({
    key: ev.id,
    kind: classify(ev.type),
    text: ev.text || ev.event || "",
    ts: ev.savedAt || "",
    type: ev.type,
  }));

  // ids already persisted in Firestore — their optimistic twins are dropped
  const knownIds = new Set(events.map((e) => e.msgId).filter(Boolean));

  for (const p of pending) {
    if (knownIds.has(p.id)) continue; // real event exists, skip the optimistic one
    items.push({ key: p.id, kind: p.kind, text: p.text, ts: p.ts, pending: true });
  }

  items.sort((a, b) => toMillis(a.ts) - toMillis(b.ts));
  return items;
}

// ids of pending messages that now have a real Firestore event (used to prune state)
export function reconciledIds(events, pending) {
  const known = new Set(events.map((e) => e.msgId).filter(Boolean));
  return pending.filter((p) => known.has(p.id)).map((p) => p.id);
}
