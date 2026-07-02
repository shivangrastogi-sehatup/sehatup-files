/* ---------------------------------------------------------------
   Data layer: read the public Google Sheet (fast, via gviz) and
   write edits back through the Apps Script Web App endpoint.
----------------------------------------------------------------*/

export const HEADERS = [
  'Date & Time (UTC)', 'Message ID', 'Conversation ID', 'Phone', 'Direction',
  'Message Type', 'Message Content', 'Delivery Status', 'Failure Reason',
  'Template ID', 'Template Category', 'Amount Charged', 'Automation Source Type',
  'Automation Source ID', 'Channel Type', 'Replied', 'Button Clicks', 'CTA Link Clicks'
]

export const DEFAULTS = {
  sheetId: '1B123vu0X7hlLoISdYMgQ0d_43zCfbgdkPkFx7OaoNwo',
  // Static_Messages holds the real, editable rows (Consolidated_Messages is a broken #REF! formula tab)
  tab: 'Static_Messages',
  group: 'phone',
  writeUrl: 'https://script.google.com/macros/s/AKfycbzwO2COVWyQmuWkz7-xurqnS2B-TzutzDHTbQHlwCouzTC7wHPDB4Sbk7ABUFupBe9y/exec'
}

const norm = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')

const AVATAR_COLORS = ['#0088cc', '#e17055', '#6c5ce7', '#00b894', '#e84393', '#fdcb6e',
  '#0984e3', '#d63031', '#00cec9', '#a29bfe', '#fd79a8', '#55a3ff']

export function colorFor(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
export function initials(name) {
  const p = String(name || '').replace(/^\+/, '').trim()
  return (p.slice(-2) || '?').toUpperCase()
}

export function parseDate(v) {
  if (v == null || v === '') return null
  const m = String(v).match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/)
  if (m) return new Date(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
  const d = new Date(v)
  return isNaN(d) ? null : d
}
export function fmtTime(d) {
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}

// whole-day difference between date d and today (0 = today, 1 = yesterday, …)
function dayDiff(d) {
  const a = new Date(d); a.setHours(0, 0, 0, 0)
  const b = new Date(); b.setHours(0, 0, 0, 0)
  return Math.round((b - a) / 86400000)
}

// Chat date separators — WhatsApp style:
// Today · Yesterday · weekday name (last 7 days) · full date (older)
export function fmtDay(d) {
  if (!d) return 'Unknown date'
  const diff = dayDiff(d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff >= 2 && diff <= 6) return d.toLocaleDateString([], { weekday: 'long' })      // Monday
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })    // 14 June 2026
}

// Conversation-list stamp — WhatsApp style:
// time (today) · Yesterday · short weekday (last 7 days) · short date (older)
export function fmtListStamp(d) {
  if (!d) return ''
  const diff = dayDiff(d)
  if (diff === 0) return fmtTime(d)
  if (diff === 1) return 'Yesterday'
  if (diff >= 2 && diff <= 6) return d.toLocaleDateString([], { weekday: 'short' })       // Mon
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' })  // 14/06/26
}

function mkMsg(cell, rowNumber) {
  const id = String(cell('Message ID'))
  return {
    key: id || ('r' + rowNumber),
    rowNumber,
    date: parseDate(cell('Date & Time (UTC)')),
    id,
    conversationId: String(cell('Conversation ID')),
    phone: String(cell('Phone')),
    direction: String(cell('Direction')),
    type: String(cell('Message Type')),
    content: String(cell('Message Content')),
    status: String(cell('Delivery Status')),
    failure: String(cell('Failure Reason')),
    templateId: String(cell('Template ID')),
    templateCat: String(cell('Template Category')),
    amount: cell('Amount Charged'),
    autoType: String(cell('Automation Source Type')),
    autoId: String(cell('Automation Source ID')),
    channel: String(cell('Channel Type')),
    replied: String(cell('Replied')),
    buttonClicks: String(cell('Button Clicks')),
    ctaClicks: String(cell('CTA Link Clicks'))
  }
}

/* ---- read via Google Visualization API (public sheet, no auth) or Apps Script endpoint ---- */
export async function loadMessages({ sheetId, tab, writeUrl }) {
  const cleanSheetId = String(sheetId || '').trim()
  const cleanTab = String(tab || '').trim()
  let labels = []
  let dataRows = []

  if (writeUrl) {
    const scriptUrl = writeUrl.trim().replace(/\/+$/, '') + '?tab=' + encodeURIComponent(cleanTab)
    try {
      const res = await fetch(scriptUrl)
      const json = await res.json()
      if (json.ok && Array.isArray(json.headers) && Array.isArray(json.rows)) {
        labels = json.headers.map(h => String(h || ''))
        dataRows = json.rows.map(r => {
          const c = (r.values || []).map(v => {
            if (v === '' || v == null) return null
            return { v }
          })
          return { rowNumber: r.rowNumber, c }
        })
      } else if (json.ok === false) {
        throw new Error(json.error || 'Apps Script returned an error')
      }
    } catch (err) {
      console.warn('Apps Script read failed, falling back to public sheet fetch', err)
    }
  }

  if (!labels.length || !dataRows.length) {
    const url = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(cleanTab)}`
    const res = await fetch(url)
    const text = await res.text()
    if (!res.ok || res.url.includes('ServiceLogin') || /ServiceLogin|accounts\.google\.com|Sign in/.test(text)) {
      throw new Error('Sheet access blocked: make sure the sheet is shared publicly (Anyone with the link) and does not require Google login.')
    }
    const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1))
    const table = json.table
    if (!table) throw new Error('No data returned — check Sheet ID, tab name and sharing.')

    labels = table.cols.map(c => c.label)
    dataRows = table.rows
    if (labels.every(l => !l)) {
      labels = table.rows[0].c.map(c => (c ? (c.f || c.v) : ''))
      dataRows = table.rows.slice(1)
    }
  }
  const idx = {}
  HEADERS.forEach(h => { idx[h] = labels.findIndex(l => norm(l) === norm(h)) })

  const out = []
  dataRows.forEach((r, i) => {
    const cell = h => {
      const j = idx[h]; if (j < 0 || j == null) return ''
      const c = r.c[j]; return c ? (c.v != null ? c.v : (c.f != null ? c.f : '')) : ''
    }
    if (String(cell('Message Content')).trim() === '' && String(cell('Phone')).trim() === '') return
    out.push(mkMsg(cell, i + 2))
  })
  return out
}

/* ---- group messages into WhatsApp-style conversations ---- */
export function groupMessages(messages, groupBy) {
  const map = new Map()
  for (const m of messages) {
    const key = groupBy === 'conversation'
      ? (m.conversationId || m.phone || 'unknown')
      : (m.phone || m.conversationId || 'unknown')
    let g = map.get(key)
    if (!g) { g = { key, phone: m.phone, title: key, msgs: [], convIds: new Set() }; map.set(key, g) }
    g.msgs.push(m)
    if (m.conversationId) g.convIds.add(m.conversationId)
    if (!g.phone && m.phone) g.phone = m.phone
  }
  const groups = [...map.values()]
  for (const g of groups) {
    g.msgs.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
    g.last = g.msgs[g.msgs.length - 1]
    g.title = g.phone || g.key
    g.searchText = (g.title + ' ' + g.msgs.map(m => m.content).join(' ')).toLowerCase()
  }
  groups.sort((a, b) => (b.last?.date?.getTime() || 0) - (a.last?.date?.getTime() || 0))
  return groups
}

/* ---- write one edit back through Apps Script ---- */
export async function saveMessage({ writeUrl, tab, message, content }) {
  const res = await fetch(writeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'update', tab,
      messageId: message.id, rowNumber: message.rowNumber, content
    })
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'unknown error')
  return json
}

/* ---- delete one or many messages (rows) through Apps Script ---- */
export async function deleteMessages({ writeUrl, tab, messageIds }) {
  const res = await fetch(writeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'delete', tab, messageIds })
  })
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'unknown error')
  return json
}
