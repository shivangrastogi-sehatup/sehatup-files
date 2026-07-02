import { useState, useRef } from 'react'
import { fmtTime } from '../lib/sheet.js'

const LONG_PRESS_MS = 450

function typeTag(type) {
  const t = (type || '').toUpperCase()
  if (!type) return null
  let cls = 'msg-type-tag'
  if (/TEMPLATE/.test(t)) return <div className="msg-type-tag tag-template">📋 {type}</div>
  if (/AGENT/.test(t)) cls += ' tag-agent'
  else if (/USER/.test(t)) cls += ' tag-user'
  return <div className={cls}>{type}</div>
}

function Tick({ m }) {
  if (!/out/i.test(m.direction)) return null
  const s = (m.status || '').toUpperCase()
  if (/READ/.test(s)) return <span className="tick read">✓✓</span>
  if (/DELIVER/.test(s)) return <span className="tick grey">✓✓</span>
  if (/FAIL/.test(s)) return <span className="tick failed">⚠</span>
  if (/SENT/.test(s)) return <span className="tick grey">✓</span>
  return null
}

// small sync indicator shown on a saved/queued/failed edit
function SaveDot({ status, onRetry }) {
  if (!status) return null
  if (status === 'queued') return <span className="save-dot queued" title="Queued to save">⏳</span>
  if (status === 'saving') return <span className="save-dot"><span className="spin" /></span>
  if (status === 'saved') return <span className="save-dot ok" title="Saved to sheet">✓ saved</span>
  if (status === 'local') return <span className="save-dot ok" title="Saved locally">✓ local</span>
  if (status === 'error') return <span className="save-dot err" title="Save failed — click to retry" onClick={onRetry}>⚠ retry</span>
  return null
}

export default function Bubble({ m, onSave, status, selectMode = false, selected = false, onEnterSelect, onToggleSelect }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(m.content)
  const pressTimer = useRef(null)
  const longFired = useRef(false)

  const side = /out/i.test(m.direction) ? 'out' : 'in'
  const amount = (m.amount && parseFloat(m.amount) > 0) ? `₹${m.amount}` : null
  const showTmpl = m.templateId || m.templateCat
  const clicks = (+m.buttonClicks > 0 || +m.ctaClicks > 0)

  function doSave() {
    onSave(m, val)        // fire-and-forget: queued in the background
    setEditing(false)     // editor closes instantly so you can keep working
  }
  function startEdit() { setVal(m.content); setEditing(true) }

  // ---- tap-and-hold (long press) to start / extend selection ----
  function pressStart() {
    if (editing) return
    longFired.current = false
    pressTimer.current = setTimeout(() => {
      longFired.current = true
      if (navigator.vibrate) navigator.vibrate(15)
      selectMode ? onToggleSelect(m.key) : onEnterSelect(m.key)
    }, LONG_PRESS_MS)
  }
  function pressEnd() { clearTimeout(pressTimer.current) }
  function handleClick(e) {
    if (longFired.current) { e.preventDefault(); e.stopPropagation(); longFired.current = false; return }
    if (selectMode) onToggleSelect(m.key)
  }
  function handleContextMenu(e) {           // right-click on desktop
    if (editing) return
    e.preventDefault()
    selectMode ? onToggleSelect(m.key) : onEnterSelect(m.key)
  }

  return (
    <div className={`msg ${side}${selectMode ? ' selectable' : ''}${selected ? ' selected' : ''}`}
      onPointerDown={pressStart} onPointerUp={pressEnd} onPointerLeave={pressEnd}
      onClick={handleClick} onContextMenu={handleContextMenu}>
      {selectMode && <span className={`select-box${selected ? ' on' : ''}`}>{selected ? '✓' : ''}</span>}
      <div className={`bubble${editing ? ' editing' : ''}`}>
        {typeTag(m.type)}
        {editing ? (
          <>
            <textarea value={val} autoFocus onChange={e => setVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') setEditing(false)
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) doSave()
              }} />
            <div className="edit-actions">
              <button className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-save" onClick={doSave}>💾 Save</button>
            </div>
          </>
        ) : (
          <>
            <span className="content">{m.content || <i style={{ opacity: .5 }}>— empty —</i>}</span>
            {showTmpl && (
              <div className="tmpl-chip">📋 {m.templateId}{m.templateCat ? ' · ' + m.templateCat : ''}</div>
            )}
            {m.failure && <div className="fail-reason">⚠ {m.failure}</div>}
            {clicks && (
              <div className="cta-line">👆 {(+m.buttonClicks || 0)} button · {(+m.ctaClicks || 0)} link clicks</div>
            )}
            <div className="meta">
              <SaveDot status={status} onRetry={() => onSave(m, m.content, true)} />
              {amount && <span className="amount">{amount}</span>}
              <span>{fmtTime(m.date)}</span>
              <Tick m={m} />
            </div>
          </>
        )}
      </div>
      {!editing && !selectMode && (
        <div className="pencil" title="Edit message" onClick={e => { e.stopPropagation(); startEdit() }}>✏️</div>
      )}
    </div>
  )
}
