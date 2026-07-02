import { useState } from 'react'
import { colorFor, initials, fmtListStamp } from '../lib/sheet.js'

const FILTERS = [
  ['all', 'All'], ['reviewed', '✓ Reviewed'], ['unreviewed', 'To review'],
  ['inbound', 'Inbound'], ['outbound', 'Outbound'],
  ['template', 'Templates'], ['failed', 'Failed']
]
const CAP = 250

export default function Sidebar({
  groups, totalMessages, activeKey, onSelect,
  search, setSearch, filter, setFilter, live,
  reviewed = new Set(), reviewedCount = 0, onDeleteChat, onToggleReviewed
}) {
  const [menuKey, setMenuKey] = useState(null) // which conversation's caret menu is open
  const [menuUp, setMenuUp] = useState(false)
  const shown = groups.slice(0, CAP)
  const more = groups.length - shown.length

  function openMenu(e, key) {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    setMenuUp(window.innerHeight - r.bottom < 140) // flip up near the bottom of the list
    setMenuKey(k => (k === key ? null : key))
  }

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <div>
          <h2>Chats</h2>
          <div className="sub">{groups.length} conversations · {reviewedCount} reviewed</div>
        </div>
        <span className={`badge-status ${live ? 'live' : 'ro'}`}>
          <span className="dot" />{live ? 'Live · edits save' : 'Read-only'}
        </span>
      </div>

      <div className="search">
        <div className="box">
          <span className="ico">🔍</span>
          <input value={search} placeholder="Search name, phone or message"
            onChange={e => setSearch(e.target.value)} />
          {search && <button className="clear-x" onClick={() => setSearch('')}>✕</button>}
        </div>
      </div>

      <div className="filters">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      <div className="convo-list">
        {shown.length === 0 && <div className="empty small"><p>No conversations match.</p></div>}
        {shown.map(g => (
          <div key={g.key} className={`convo${g.key === activeKey ? ' active' : ''}${reviewed.has(g.key) ? ' reviewed' : ''}`} onClick={() => onSelect(g.key)}>
            <div className="avatar" style={{ background: colorFor(g.title) }}>
              {initials(g.title)}
              {reviewed.has(g.key) && <span className="rev-check" title="Reviewed">✓</span>}
            </div>
            <div className="convo-main">
              <div className="convo-top">
                <span className="convo-name">{g.title}</span>
                <span className="convo-time">{fmtListStamp(g.last?.date)}</span>
              </div>
              <div className="convo-bottom">
                <span className="convo-preview">
                  <span className="dir-ico">{/out/i.test(g.last?.direction) ? '↗' : '↙'}</span>
                  {(g.last?.content || '—').slice(0, 46)}
                </span>
                <span className="count-badge">{g.msgs.length}</span>
              </div>
            </div>

            <button className="convo-caret" title="Chat options" onClick={e => openMenu(e, g.key)}>⌄</button>
            {menuKey === g.key && (
              <>
                <div className="menu-backdrop" onClick={e => { e.stopPropagation(); setMenuKey(null) }} />
                <div className={`convo-menu${menuUp ? ' up' : ''}`} onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setMenuKey(null); onToggleReviewed(g.key) }}>
                    {reviewed.has(g.key) ? '✓ Unmark reviewed' : '✓ Mark as reviewed'}
                  </button>
                  <button className="danger-item" onClick={() => { setMenuKey(null); onDeleteChat(g) }}>
                    🗑️ Delete chat
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {more > 0 && (
          <div className="list-more">+{more} more — refine your search to narrow down</div>
        )}
      </div>
    </aside>
  )
}
