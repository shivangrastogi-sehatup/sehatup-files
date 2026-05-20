// OrderCreationCRM.jsx
// Lead-list view + right-panel <OrderForm /> for the CRM/order-creation role.
// The form itself is implemented in OrderForm.jsx so other roles (Tele-Sales,
// Doctor, etc.) can reuse the exact same flow via OrderModal.

import React, { useState, useEffect, useCallback } from 'react';
import OrderForm from './OrderForm';
import { parseCSV } from './OrderFormShared';

// ─── Apps Script default URL ────────────────────────────────────────────────
// This is the production URL used to sync customer + last-order rows back to
// the leads Google Sheet. A per-browser override can be set via the gear (⚙)
// panel below — that value (in localStorage 'crm_gscript_url') takes priority.
//
// ┌────────────────────────────────────────────────────────────────────────┐
// │ ACTION REQUIRED: paste your deployed Apps Script Web App URL below.   │
// │ Until this is set, every agent's browser must enter their own URL in   │
// │ the ⚙ panel; new agents will see "Sheet sync disabled" by default.    │
// │ Deploy template: https://script.google.com (see comment block below).  │
// └────────────────────────────────────────────────────────────────────────┘
export const DEFAULT_GSCRIPT_URL = '/api/leads';   // ← e.g. 'https://script.google.com/macros/s/AKfycb.../exec'

// Apps Script doPost reference (paste into Apps Script editor, deploy as Web App):
//
//   function doPost(e) {
//     try {
//       const d = JSON.parse(e.postData.contents);
//       const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
//       const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
//       const phoneCol = headers.indexOf('Phone Number') + 1;
//       if (phoneCol === 0) throw new Error("Phone Number column not found");
//       const lastRow = sheet.getLastRow();
//       let updateRow = -1;
//       if (lastRow > 1) {
//         const phoneData = sheet.getRange(2, phoneCol, lastRow - 1, 1).getValues();
//         for (let i = 0; i < phoneData.length; i++) {
//           if (phoneData[i][0].toString().replace(/\D/g,'') === d.phone) { updateRow = i + 2; break; }
//         }
//       }
//       if (updateRow === -1) {
//         updateRow = lastRow + 1;
//         if (updateRow > sheet.getMaxRows()) sheet.insertRowAfter(sheet.getMaxRows());
//       }
//       Object.keys(d.updates).forEach(h => { const c = headers.indexOf(h)+1; if(c) sheet.getRange(updateRow,c).setValue(d.updates[h]); });
//       let luCol = headers.indexOf('Last Updated')+1; if(!luCol){sheet.getRange(1,headers.length+1).setValue('Last Updated');luCol=headers.length+1;}
//       let ubCol = headers.indexOf('Updated By')+1; if(!ubCol){sheet.getRange(1,headers.length+2).setValue('Updated By');ubCol=headers.length+2;}
//       sheet.getRange(updateRow,luCol).setValue(new Date().toLocaleString('en-IN'));
//       sheet.getRange(updateRow,ubCol).setValue(d.updatedBy);
//       return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
//     } catch(err) {
//       return ContentService.createTextOutput(JSON.stringify({error: err.message})).setMimeType(ContentService.MimeType.JSON);
//     }
//   }

// ─── Component ──────────────────────────────────────────────────────────────

const OrderCreationCRM = ({ user, onLogout }) => {
    const agentName = user?.displayName || user?.email || 'CRM Agent';

    const [csvUrl] = useState('/api/leads');
    const [leads, setLeads] = useState([]);
    const [selectedLead, setSelectedLead] = useState(null);
    const [isManualEntry, setIsManualEntry] = useState(false);
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);

    // Sheet-sync URL: localStorage override wins; falls back to DEFAULT_GSCRIPT_URL.
    const [gscriptOverride, setGscriptOverride] = useState(() => {
        try { return localStorage.getItem('crm_gscript_url') || ''; }
        catch { return ''; }
    });
    const [showConfig, setShowConfig] = useState(false);

    const effectiveGscriptUrl = (gscriptOverride && gscriptOverride.trim())
        ? gscriptOverride.trim()
        : DEFAULT_GSCRIPT_URL;

    const saveGscriptOverride = (url) => {
        setGscriptOverride(url);
        try { localStorage.setItem('crm_gscript_url', url); }
        catch (e) { console.warn('[CRM] localStorage set failed', e); }
    };

    const clearGscriptOverride = () => {
        setGscriptOverride('');
        try { localStorage.removeItem('crm_gscript_url'); } catch {}
    };

    // ─── Leads ──────────────────────────────────────────────────────────────

    const fetchLeads = useCallback(async () => {
        if (!csvUrl) return;
        setIsLoadingLeads(true);
        try {
            const response = await fetch(csvUrl);
            const text = await response.text();
            const parsed = parseCSV(text);
            if (parsed.length > 0) console.log('[Leads] CSV columns:', Object.keys(parsed[0]));
            setLeads(parsed);
        } catch (error) {
            if (error.message === 'HTML_RESPONSE') {
                alert("Not a valid CSV URL. Go to your sheet → File → Share → Publish to web → Select 'CSV'.");
            } else {
                console.error('[Leads] Failed to fetch:', error);
            }
        } finally {
            setIsLoadingLeads(false);
        }
    }, [csvUrl]);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    // ─── Lead selection ─────────────────────────────────────────────────────

    const selectLead = (lead) => {
        // Force OrderForm remount so it re-applies the initialLead prefill.
        setSelectedLead(null);
        setIsManualEntry(false);
        setTimeout(() => setSelectedLead(lead), 0);
    };

    const startNewOrder = () => {
        setSelectedLead(null);
        setIsManualEntry(false);
        setTimeout(() => setIsManualEntry(true), 0);
    };

    // ─── Render ─────────────────────────────────────────────────────────────

    const showForm = selectedLead || isManualEntry;
    const formInitialLead = selectedLead || (isManualEntry ? {} : null);
    // key forces OrderForm remount (and state reset) on new lead / new manual.
    const formKey = selectedLead
        ? `lead-${leads.indexOf(selectedLead)}`
        : (isManualEntry ? `manual-${Date.now()}` : 'none');

    const usingDefault = !gscriptOverride.trim() && DEFAULT_GSCRIPT_URL;
    const sheetEnabled = !!effectiveGscriptUrl;

    return (
        <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial, sans-serif', color: '#e2e8f0', background: '#0a0f1e' }}>

            {/* LEFT: Leads */}
            <div style={{ width: '28%', minWidth: 260, borderRight: '1px solid #1e293b', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h2 style={{ color: '#fff', margin: 0, fontSize: 18 }}>Order Requests</h2>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={startNewOrder} style={{ ...refreshBtnStyle, background: '#3b82f6', color: '#fff' }} title="New Manual Order">+ New</button>
                        <button onClick={fetchLeads} disabled={isLoadingLeads} style={refreshBtnStyle}>
                            {isLoadingLeads ? '...' : '↻'}
                        </button>
                        <button onClick={() => setShowConfig(v => !v)} style={{ ...refreshBtnStyle, background: showConfig ? '#1e3a5f' : '#1e293b' }} title="Configure">⚙</button>
                    </div>
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: showConfig ? 10 : 12 }}>
                    Agent: {agentName}
                    {sheetEnabled
                        ? <span style={{ color: '#4ade80', marginLeft: 8 }}>· Sheet sync ON{usingDefault ? ' (default)' : ' (override)'}</span>
                        : <span style={{ color: '#f59e0b', marginLeft: 8 }}>· Sheet sync OFF</span>}
                </div>

                {showConfig && (
                    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 14, marginBottom: 14 }}>
                        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>Google Sheets Sync</div>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 8, lineHeight: 1.5 }}>
                            {DEFAULT_GSCRIPT_URL
                                ? 'Default URL is hard-coded in code. Paste an override here only if you need to point at a different Apps Script (e.g. a test sheet).'
                                : 'No default URL set in code (DEFAULT_GSCRIPT_URL is empty). Paste your Apps Script Web App URL here, or set the default in OrderCreationCRM.jsx.'}
                        </div>
                        <input
                            placeholder={DEFAULT_GSCRIPT_URL ? '(using default — paste here to override)' : 'https://script.google.com/macros/s/.../exec'}
                            value={gscriptOverride}
                            onChange={e => saveGscriptOverride(e.target.value)}
                            style={{ ...inputStyle, marginBottom: 6, fontSize: 11 }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                            <span style={{ color: sheetEnabled ? '#4ade80' : '#f59e0b' }}>
                                {sheetEnabled
                                    ? `✓ ${usingDefault ? 'Using default URL' : 'Using override URL'}`
                                    : '⚠ Sheet sync disabled — orders will NOT update the sheet'}
                            </span>
                            {gscriptOverride.trim() && (
                                <button onClick={clearGscriptOverride} style={{ background: 'transparent', border: '1px solid #1e293b', color: '#94a3b8', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: 11 }}>
                                    Reset to default
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>{leads.length} leads</div>

                <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 16 }}>
                    {leads.map((lead, i) => (
                        <div key={i} onClick={() => selectLead(lead)} style={{
                            padding: '12px',
                            background: selectedLead === lead ? '#1e293b' : 'transparent',
                            border: `1px solid ${selectedLead === lead ? '#3b82f6' : '#1e293b'}`,
                            marginBottom: 8, borderRadius: 8, cursor: 'pointer',
                        }}>
                            <strong style={{ color: selectedLead === lead ? '#38bdf8' : '#e2e8f0', fontSize: 14 }}>
                                {lead['First Name'] || lead['firstName']} {lead['Last Name'] || lead['lastName']}
                            </strong>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{lead['Phone Number'] || lead['phone']}</div>
                            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                {lead['District/City'] || lead['city']}, {lead['State'] || lead['state']}
                            </div>
                        </div>
                    ))}
                </div>

                {onLogout && (
                    <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #1e293b' }}>
                        <button
                            onClick={onLogout}
                            style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid #ef444455', color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#ef444415'; e.currentTarget.style.borderColor = '#ef4444'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#ef444455'; }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                            Log Out
                        </button>
                    </div>
                )}
            </div>

            {/* RIGHT: Order Form */}
            <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
                {!showForm ? (
                    <div style={{ color: '#334155', marginTop: 120, textAlign: 'center', fontSize: 18 }}>
                        ← Select a lead to create an order
                        <div style={{ marginTop: 24 }}>
                            <button onClick={startNewOrder} style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                + Create Manual Order
                            </button>
                        </div>
                    </div>
                ) : (
                    <OrderForm
                        key={formKey}
                        agentName={agentName}
                        initialLead={formInitialLead}
                        gscriptUrl={effectiveGscriptUrl}
                    />
                )}
            </div>
        </div>
    );
};

const inputStyle = { width: '100%', padding: '10px 12px', marginBottom: 10, border: '1px solid #1e293b', borderRadius: 6, boxSizing: 'border-box', background: '#0a0f1e', color: '#e2e8f0', fontSize: 13 };
const refreshBtnStyle = { padding: '6px 12px', background: '#1e293b', color: '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 };

export default OrderCreationCRM;
