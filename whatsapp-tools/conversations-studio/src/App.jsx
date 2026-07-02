import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ChatPane from './components/ChatPane.jsx'
import { SettingsModal, SetupModal, ConfirmModal } from './components/Modals.jsx'
import { DEFAULTS, loadMessages, groupMessages, saveMessage, deleteMessages } from './lib/sheet.js'

const LS = 'sehatup_wa_studio_cfg'
const RK = 'sehatup_wa_studio_reviewed'
const loadCfg = () => ({ ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS) || '{}') })
const loadReviewed = () => new Set(JSON.parse(localStorage.getItem(RK) || '[]'))

export default function App() {
  const [cfg, setCfg] = useState(loadCfg)
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState('all')
  const [activeKey, setActiveKey] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [toasts, setToasts] = useState([])
  const [saveStatus, setSaveStatus] = useState({}) // message.key -> queued | saving | saved | error | local
  const [reviewed, setReviewed] = useState(loadReviewed) // Set of conversation keys marked reviewed
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set()) // selected message keys
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [delChat, setDelChat] = useState(null) // conversation title when deleting a whole chat

  const enterSelect = useCallback((key) => { setSelectMode(true); setSelected(new Set([key])) }, [])
  const startSelect = useCallback(() => { setSelectMode(true); setSelected(new Set()) }, []) // ⋮ "Select messages"
  // left-panel caret ▸ "Delete chat" — selects every message in the conversation, then confirms
  const deleteChat = useCallback((group) => {
    setSelected(new Set(group.msgs.map(m => m.key)))
    setDelChat(group.title)
    setConfirmDel(true)
  }, [])
  const closeConfirm = useCallback(() => { setConfirmDel(false); setDelChat(null) }, [])
  const toggleSelect = useCallback((key) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      if (next.size === 0) setSelectMode(false)
      return next
    })
  }, [])
  const clearSelect = useCallback(() => { setSelectMode(false); setSelected(new Set()) }, [])
  const selectConversation = useCallback((key) => { setSelectMode(false); setSelected(new Set()); setActiveKey(key) }, [])

  const toggleReviewed = useCallback((key) => {
    setReviewed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem(RK, JSON.stringify([...next]))
      return next
    })
  }, [])

  // FIFO save queue (refs so it survives re-renders without re-triggering effects)
  const queue = useRef([])
  const processing = useRef(false)

  const toast = useCallback((msg, type = 'info', ms = 2600) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ms)
  }, [])

  const setStat = useCallback((key, val) => setSaveStatus(s => ({ ...s, [key]: val })), [])
  const clearStat = useCallback((key, delay = 1600) => setTimeout(
    () => setSaveStatus(s => { const n = { ...s }; delete n[key]; return n }), delay), [])

  const reload = useCallback(async () => {
    setStatus('loading')
    try {
      const msgs = await loadMessages(cfg)
      setMessages(msgs)
      setStatus('ready')
      toast(`Loaded ${msgs.length.toLocaleString()} messages`, 'ok')
    } catch (e) {
      console.error(e); setError(e.message); setStatus('error')
      toast('Could not load sheet — check ID / tab / sharing', 'err', 4200)
    }
  }, [cfg, toast])

  useEffect(() => { reload() }, [reload])
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 180); return () => clearTimeout(t) }, [search])

  // ---- drain the queue one job at a time, in order ----
  const processQueue = useCallback(async () => {
    if (processing.current) return
    processing.current = true
    while (queue.current.length) {
      const job = queue.current[0]
      job.started = true
      setStat(job.message.key, 'saving')
      try {
        await saveMessage({ writeUrl: cfg.writeUrl, tab: cfg.tab, message: job.message, content: job.content })
        setStat(job.message.key, 'saved'); clearStat(job.message.key)
      } catch (e) {
        console.error(e)
        setStat(job.message.key, 'error')
        const blocked = /failed to fetch|networkerror|load failed/i.test(e.message)
        toast(blocked
          ? 'Save blocked — redeploy the Apps Script with “Who has access: Anyone”. See 🔗.'
          : 'Save failed: ' + e.message, 'err', 5000)
      }
      queue.current.shift()
    }
    processing.current = false
  }, [cfg.writeUrl, cfg.tab, setStat, clearStat, toast])

  // ---- called by a message bubble; returns immediately so editing never blocks ----
  const enqueueSave = useCallback((m, content, force = false) => {
    if (!force && content === m.content) return
    // optimistic UI update
    setMessages(prev => prev.map(x => x.key === m.key ? { ...x, content } : x))

    if (!cfg.writeUrl) {
      setStat(m.key, 'local'); clearStat(m.key, 2500)
      return
    }
    // coalesce: if an un-started job for this message is already queued, just update its content
    const pending = queue.current.find(j => j.key === m.key && !j.started)
    if (pending) pending.content = content
    else queue.current.push({ key: m.key, message: { ...m, content }, content })

    setStat(m.key, 'queued')
    processQueue()
  }, [cfg.writeUrl, setStat, clearStat, processQueue])

  // ---- delete the currently selected messages (rows) ----
  const doDelete = useCallback(async () => {
    const keys = new Set(selected)
    const victims = messages.filter(m => keys.has(m.key))
    const ids = victims.map(m => m.id).filter(Boolean)

    if (!cfg.writeUrl) {
      setMessages(prev => prev.filter(m => !keys.has(m.key)))
      toast(`Removed ${victims.length} locally — connect a save endpoint (🔗) to delete from the sheet`, 'info', 4000)
      closeConfirm(); clearSelect(); return
    }
    setDeleting(true)
    try {
      const res = await deleteMessages({ writeUrl: cfg.writeUrl, tab: cfg.tab, messageIds: ids })
      setMessages(prev => prev.filter(m => !keys.has(m.key)))
      toast(`Deleted ${res.deleted ?? victims.length} message(s) from the sheet ✓`, 'ok')
      closeConfirm(); clearSelect()
    } catch (e) {
      console.error(e)
      const blocked = /failed to fetch|networkerror|load failed/i.test(e.message)
      const noDeleteAction = /row not found|no message content column|no ids/i.test(e.message)
      toast(
        blocked ? 'Delete blocked — the Apps Script needs “Who has access: Anyone”.'
          : noDeleteAction ? 'This Save endpoint has no delete action. Redeploy the Apps Script as a NEW version with the delete code, and set that URL in ⚙️ Settings.'
            : 'Delete failed: ' + e.message,
        'err', 7000)
    } finally {
      setDeleting(false)
    }
  }, [selected, messages, cfg.writeUrl, cfg.tab, toast, clearSelect, closeConfirm])

  const groups = useMemo(() => groupMessages(messages, cfg.group), [messages, cfg.group])

  const filtered = useMemo(() => {
    const s = debounced.trim().toLowerCase()
    return groups.filter(g => {
      if (s && !g.searchText.includes(s)) return false
      if (filter === 'reviewed') return reviewed.has(g.key)
      if (filter === 'unreviewed') return !reviewed.has(g.key)
      if (filter === 'all') return true
      return g.msgs.some(m => {
        switch (filter) {
          case 'inbound': return /in/i.test(m.direction)
          case 'outbound': return /out/i.test(m.direction)
          case 'template': return /template/i.test(m.type) || m.templateId
          case 'failed': return /fail/i.test(m.status) || m.failure
          default: return true
        }
      })
    })
  }, [groups, debounced, filter, reviewed])

  const activeGroup = useMemo(() => groups.find(g => g.key === activeKey) || null, [groups, activeKey])

  const stats = useMemo(() => {
    let inb = 0, out = 0, amt = 0
    for (const m of messages) {
      if (/in/i.test(m.direction)) inb++; else if (/out/i.test(m.direction)) out++
      amt += parseFloat(m.amount) || 0
    }
    return [['Chats', groups.length.toLocaleString()], ['Messages', messages.length.toLocaleString()],
      ['Inbound', inb.toLocaleString()], ['Outbound', out.toLocaleString()], ['Spend', '₹' + amt.toFixed(2)]]
  }, [messages, groups.length])

  const pending = useMemo(
    () => Object.values(saveStatus).filter(v => v === 'queued' || v === 'saving').length,
    [saveStatus])

  function saveSettings(next) {
    const nextCfg = {
      ...next,
      sheetId: next.sheetId.trim(),
      tab: next.tab.trim(),
      writeUrl: next.writeUrl.trim()
    }
    setCfg(nextCfg)
    localStorage.setItem(LS, JSON.stringify(nextCfg))
    setShowSettings(false)
    setActiveKey(null)
  }

  const chatOpen = !!activeKey

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="logo">💬</div>
          <div className="brand-text">SehatUP · Conversations Studio
            <small>WhatsApp chatbot message explorer &amp; editor</small>
          </div>
        </div>
        <div className="stat-strip">
          {stats.map(([l, v]) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>)}
        </div>
        <div className="top-actions">
          {pending > 0 && <span className="sync-chip"><span className="spin" />Saving {pending}…</span>}
          <button className="icon-btn" title="Reload" onClick={reload}>⟳</button>
          <button className="icon-btn" title="Enable saving" onClick={() => setShowSetup(true)}>🔗</button>
          <button className="icon-btn" title="Settings" onClick={() => setShowSettings(true)}>⚙️</button>
        </div>
      </header>

      <div className={`app${chatOpen ? ' chat-open' : ''}`}>
        {status === 'loading' && (
          <div className="cover"><div><div className="loader" /><p>Loading messages from Google Sheet…</p></div></div>
        )}
        {status === 'error' && (
          <div className="cover"><div><div className="big">⚠️</div><h3>Couldn’t load the sheet</h3>
            <p>{error}<br /><br />Check the Sheet ID &amp; tab in ⚙️ Settings and that it’s shared “Anyone with the link”.</p>
            <button className="primary" onClick={reload} style={{ marginTop: 16 }}>Retry</button></div></div>
        )}
        {status === 'ready' && (
          <>
            <Sidebar
              groups={filtered} totalMessages={messages.length} activeKey={activeKey}
              onSelect={selectConversation} search={search} setSearch={setSearch}
              filter={filter} setFilter={setFilter} live={!!cfg.writeUrl}
              reviewed={reviewed} reviewedCount={reviewed.size}
              onDeleteChat={deleteChat} onToggleReviewed={toggleReviewed}
            />
            <ChatPane group={activeGroup} onBack={() => { clearSelect(); setActiveKey(null) }}
              onSave={enqueueSave} saveStatus={saveStatus}
              reviewed={activeGroup ? reviewed.has(activeGroup.key) : false}
              onToggleReviewed={toggleReviewed}
              selectMode={selectMode} selected={selected}
              onEnterSelect={enterSelect} onToggleSelect={toggleSelect}
              onClearSelect={clearSelect} onRequestDelete={() => { setDelChat(null); setConfirmDel(true) }}
              onStartSelect={startSelect} />
          </>
        )}
      </div>

      <SettingsModal open={showSettings} cfg={cfg} onClose={() => setShowSettings(false)} onSave={saveSettings} />
      <SetupModal open={showSetup} onClose={() => setShowSetup(false)} toast={toast} />
      <ConfirmModal open={confirmDel} count={selected.size} chatName={delChat} busy={deleting}
        onCancel={closeConfirm} onConfirm={doDelete} />

      <div className="toast-wrap">
        {toasts.map(t => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}
      </div>
    </div>
  )
}
