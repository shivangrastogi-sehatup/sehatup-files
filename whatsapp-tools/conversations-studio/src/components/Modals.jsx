import { useState, useEffect } from 'react'

export function SettingsModal({ open, cfg, onClose, onSave }) {
  const [local, setLocal] = useState(cfg)
  useEffect(() => { if (open) setLocal(cfg) }, [open, cfg])
  if (!open) return null
  const set = (k, v) => setLocal(s => ({ ...s, [k]: v }))

  return (
    <div className="overlay show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>⚙️ Data source settings</h3><button className="mini-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="field">
            <label>Google Sheet ID</label>
            <input value={local.sheetId} onChange={e => set('sheetId', e.target.value)} />
            <div className="hint">Found in the sheet URL between <code>/d/</code> and <code>/edit</code>. Share as “Anyone with the link – Viewer”.</div>
          </div>
          <div className="field">
            <label>Tab / sheet name</label>
            <input value={local.tab} onChange={e => set('tab', e.target.value)} placeholder="ALL_DATA" />
            <div className="hint">Exact tab name — e.g. ALL_DATA, FINAL_TRAINING, CHATBOT_ONLY.</div>
          </div>
          <div className="field">
            <label>Group conversations by</label>
            <select value={local.group} onChange={e => set('group', e.target.value)}>
              <option value="phone">Phone number (recommended)</option>
              <option value="conversation">Conversation ID</option>
            </select>
          </div>
          <div className="field">
            <label>Save endpoint (Apps Script Web App URL)</label>
            <input value={local.writeUrl} onChange={e => set('writeUrl', e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
            <div className="hint">Leave blank for read-only. Must be deployed with <b>Who has access = Anyone</b>. See the 🔗 button for the script.</div>
          </div>
          <div className="modal-actions">
            <button className="ghost" onClick={onClose}>Cancel</button>
            <button className="primary" onClick={() => onSave(local)}>Save &amp; reload</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConfirmModal({ open, count, chatName, busy, onCancel, onConfirm }) {
  if (!open) return null
  const isChat = !!chatName
  return (
    <div className="overlay show" onClick={e => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="modal confirm">
        <div className="modal-body">
          <div className="confirm-icon">🗑️</div>
          <h3>{isChat ? `Delete chat ${chatName}?` : `Delete ${count} message${count === 1 ? '' : 's'}?`}</h3>
          <p>This permanently removes {isChat ? `all ${count} message${count === 1 ? '' : 's'} in this conversation` : (count === 1 ? 'this row' : 'these rows')} from the Google Sheet. This can’t be undone.</p>
          <div className="modal-actions">
            <button className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="danger" onClick={onConfirm} disabled={busy}>
              {busy ? 'Deleting…' : (isChat ? 'Delete chat' : `Delete ${count}`)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const APPS_SCRIPT = `function doGet(e){
  var tab = (e.parameter.tab)||'ALL_DATA';
  var sh  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
  if(!sh) return json({ok:false, error:'Tab not found: '+tab});
  var data = sh.getDataRange().getValues();
  var headers = data.shift();
  var rows = data.map(function(v,i){ return {rowNumber:i+2, values:v}; });
  return json({ok:true, headers:headers, rows:rows});
}
function doPost(e){
  try{
    var req = JSON.parse(e.postData.contents);
    var tab = req.tab||'ALL_DATA';
    var sh  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab);
    if(!sh) return json({ok:false, error:'Tab not found'});
    var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    var idIdx  = headers.indexOf('Message ID');
    var lastRow = sh.getLastRow();
    if(req.action==='delete'){
      if(idIdx<0) return json({ok:false, error:'No Message ID column'});
      var ids = req.messageIds||[]; if(req.messageId) ids.push(req.messageId);
      if(!ids.length) return json({ok:false, error:'No ids'});
      var want={}; ids.forEach(function(x){ want[String(x)]=true; });
      var col = lastRow>1 ? sh.getRange(2, idIdx+1, lastRow-1, 1).getValues() : [];
      var rows=[];
      for(var i=0;i<col.length;i++){ if(want[String(col[i][0])]) rows.push(i+2); }
      rows.sort(function(a,b){ return b-a; });
      for(var k=0;k<rows.length;k++) sh.deleteRow(rows[k]);
      return json({ok:true, deleted:rows.length});
    }
    var contentIdx = headers.indexOf('Message Content');
    if(contentIdx<0) return json({ok:false, error:'No Message Content column'});
    var row = 0;
    if(req.messageId && idIdx>=0 && lastRow>1){
      var hit = sh.getRange(2, idIdx+1, lastRow-1, 1)
        .createTextFinder(String(req.messageId)).matchEntireCell(true).findNext();
      if(hit) row = hit.getRow();
    }
    if(!row && req.rowNumber) row = req.rowNumber;
    if(!row) return json({ok:false, error:'Row not found'});
    sh.getRange(row, contentIdx+1).setValue(req.content);
    return json({ok:true, row:row});
  }catch(err){ return json({ok:false, error:String(err)}); }
}
function json(o){
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}`

export function SetupModal({ open, onClose, toast }) {
  if (!open) return null
  return (
    <div className="overlay show" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>🔗 Enable saving edits back to the sheet</h3><button className="mini-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="steps">
            <ol>
              <li>Open your Sheet → <b>Extensions ▸ Apps Script</b>.</li>
              <li>Paste the script below, click <b>Save</b> 💾.</li>
              <li><b>Deploy ▸ New deployment ▸ Web app</b>.</li>
              <li><b>Execute as: Me</b>, <b>Who has access: Anyone</b> → <b>Deploy</b> → authorize.</li>
              <li>Copy the URL → paste in <b>⚙️ Settings ▸ Save endpoint</b>.</li>
            </ol>
            <p className="warn">⚠ If saving fails, your deployment’s access is still restricted. Go to
              <b> Deploy ▸ Manage deployments ▸ ✏️ Edit</b> and set <b>Who has access = “Anyone”</b> (not “Anyone with Google account”).</p>
          </div>
          <div className="code-box">
            <button className="copy-code" onClick={() => { navigator.clipboard.writeText(APPS_SCRIPT); toast('Script copied ✓', 'ok') }}>Copy</button>
            <code>{APPS_SCRIPT}</code>
          </div>
        </div>
      </div>
    </div>
  )
}
