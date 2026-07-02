import { useEffect, useRef, useState } from 'react'
import Bubble from './Bubble.jsx'
import { colorFor, initials, fmtDay } from '../lib/sheet.js'

export default function ChatPane({
  group, onBack, onSave, saveStatus = {}, reviewed = false, onToggleReviewed,
  selectMode = false, selected = new Set(), onEnterSelect, onToggleSelect, onClearSelect, onRequestDelete,
  onStartSelect
}) {
  const scrollRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [group?.key])

  if (!group) {
    return (
      <section className="chat">
        <div className="empty">
          <div>
            <div className="big">💬</div>
            <h3>SehatUP Conversations Studio</h3>
            <p>Pick a conversation on the left to view the full WhatsApp thread. Hover a message
              and tap the ✏️ pencil to edit it — edits push back to your Google Sheet.</p>
          </div>
        </div>
      </section>
    )
  }

  const convLbl = group.convIds.size ? `${group.convIds.size} conversation id(s) · ` : ''

  const items = []
  let lastDay = null
  for (const m of group.msgs) {
    const day = fmtDay(m.date)
    if (day !== lastDay) { items.push(<div className="day-sep" key={'d' + m.key}>{day}</div>); lastDay = day }
    items.push(
      <Bubble key={m.key} m={m} onSave={onSave} status={saveStatus[m.key]}
        selectMode={selectMode} selected={selected.has(m.key)}
        onEnterSelect={onEnterSelect} onToggleSelect={onToggleSelect} />
    )
  }

  return (
    <section className="chat">
      {selectMode ? (
        <div className="chat-head select-bar">
          <button className="mini-btn" onClick={onClearSelect} aria-label="Cancel selection">✕</button>
          <div className="head-text"><div className="h-name">{selected.size} selected</div></div>
          <div className="spacer" />
          <button className="del-btn" onClick={onRequestDelete} disabled={selected.size === 0}>🗑 Delete</button>
        </div>
      ) : (
        <div className="chat-head">
          <button className="mini-btn back" onClick={onBack} aria-label="Back">←</button>
          <div className="avatar" style={{ background: colorFor(group.title) }}>{initials(group.title)}</div>
          <div className="head-text">
            <div className="h-name">{group.title}</div>
            <div className="h-sub">{convLbl}{group.msgs.length} messages · long-press a message to select</div>
          </div>
          <div className="spacer" />
          <button className={`review-btn${reviewed ? ' on' : ''}`}
            onClick={() => onToggleReviewed(group.key)}
            title={reviewed ? 'Reviewed — click to unmark' : 'Mark this conversation as reviewed'}>
            {reviewed ? '✓ Reviewed' : 'Mark as reviewed'}
          </button>
          <div className="kebab-wrap">
            <button className="mini-btn" title="Menu" onClick={() => setMenuOpen(o => !o)}>⋮</button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="head-menu">
                  <button onClick={() => { onStartSelect(); setMenuOpen(false) }}>☑️ Select messages</button>
                  <button onClick={() => { onToggleReviewed(group.key); setMenuOpen(false) }}>
                    {reviewed ? '✓ Unmark reviewed' : '✓ Mark as reviewed'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`messages${selectMode ? ' selecting' : ''}`} ref={scrollRef}>{items}</div>
    </section>
  )
}
