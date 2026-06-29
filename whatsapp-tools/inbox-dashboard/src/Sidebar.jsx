import { useMemo, useState } from "react";
import { fmtRelative } from "./utils";

function statusText(s) {
  if (s === "online") return "live";
  if (s === "connecting") return "connecting…";
  if (s === "no-config") return "no config — add .env";
  if (s && s.startsWith("offline")) {
    return s.includes("permission") ? "offline — deploy rules" : "offline";
  }
  return s || "";
}

function initials(name, phone) {
  const src = (name || "").trim() || (phone || "");
  return (src[0] || "?").toUpperCase();
}

export default function Sidebar({ conversations, status, selectedId, onSelect, onReconnect }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => {
      const hay = `${c.name || ""} ${c.id || ""} ${c.phone || ""} ${c.lastUserMessage || ""} ${c.lastAiReply || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [conversations, q]);

  const online = status === "online";

  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <div className="sidebar-title">
          <span className="logo">💬</span>
          <div>
            <h1>Inbox</h1>
            <div className="sub">
              <span className={"dot" + (online ? "" : " off")} />
              {statusText(status)} · {conversations.length} chats
            </div>
          </div>
        </div>
        <button className="icon-btn" onClick={onReconnect} title="Reconnect">⟳</button>
      </header>

      <div className="search">
        <span className="search-icon">🔎</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, number, message…"
        />
        {q && <button className="clear-search" onClick={() => setQ("")} title="Clear">✕</button>}
      </div>

      <div className="conv-list">
        {filtered.length === 0 && (
          <div className="empty-list">
            {conversations.length === 0 ? "No conversations yet." : "No matches."}
          </div>
        )}
        {filtered.map((c) => {
          const name = (c.name || "").trim() || ("+" + c.id);
          const preview = c.lastUserMessage || c.lastAiReply || c.lastAgentReply || "—";
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              className={"conv-item" + (active ? " active" : "")}
              onClick={() => onSelect(c.id)}
            >
              <div className="conv-avatar">{initials(c.name, c.phone || c.id)}</div>
              <div className="conv-main">
                <div className="conv-top">
                  <span className="conv-name">{name}</span>
                  <span className="conv-time">{fmtRelative(c.lastUpdated)}</span>
                </div>
                <div className="conv-preview">{preview}</div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
