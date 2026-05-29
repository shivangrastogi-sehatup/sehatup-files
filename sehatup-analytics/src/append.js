const fs = require('fs');

const code = `
export function parseCSV(text) {
  if (text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html')) throw new Error('HTML_RESPONSE');
  const rows = []; let field = ''; let row = []; let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; } else if (ch === ',') { row.push(field); field = ''; } else if (ch === '\\n' || ch === '\\r') { if (ch === '\\r' && text[i + 1] === '\\n') i++; row.push(field); field = ''; if (row.some(c => c !== '')) rows.push(row); row = []; } else { field += ch; }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); if (row.some(c => c !== '')) rows.push(row); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) { obj[headers[j]] = (rows[i][j] || '').trim(); }
    result.push(obj);
  }
  return result;
}

function CRMOrders({ setRoute, openCustomer }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyMyOrders, setShowOnlyMyOrders] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vSL_HNjTH0rykbrl-q3GwYZ6SDYrskbsCa-VxgtA2qVTXkxIl8r4SpLF_ne95EHK8wfcqYNFwjNMPqI/pub?output=csv');
      const text = await res.text();
      setOrders(parseCSV(text).reverse());
    } catch (err) {
      console.error('Failed to fetch CRM orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const myName = window.SehatData?.me?.name || '';
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (showOnlyMyOrders) { list = list.filter(o => o['Updated By'] === myName); }
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(o => 
      (o['First Name'] || '').toLowerCase().includes(q) ||
      (o['Last Name'] || '').toLowerCase().includes(q) ||
      (o['Phone Number'] || '').toLowerCase().includes(q) ||
      (o['District/City'] || '').toLowerCase().includes(q) ||
      (o['State'] || '').toLowerCase().includes(q)
    );
  }, [orders, search, showOnlyMyOrders, myName]);

  return (
    <div className='col fade-in'>
      <div className='page-head'>
        <div>
          <h1 className='page-title'>CRM orders</h1>
          <p className='page-sub'>Orders created manually from the CRM and stored in Google Sheets</p>
        </div>
        <div className='page-head-actions'>
          <button className='btn' onClick={fetchOrders} disabled={isLoading}>
            <Icon name='refresh' /> {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button className='btn primary' onClick={() => setRoute && setRoute('order_create')}>
            <Icon name='plus' /> New order
          </button>
        </div>
      </div>
      <div className='card' style={{ marginBottom: 16 }}>
        <div className='hstack-12'>
          <div className='topbar-search' style={{ flex: 1, margin: 0, maxWidth: 'none', background: 'var(--surface)' }}>
            <Icon name='search' />
            <input placeholder='Search by name, phone, city, state...' value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type='checkbox' checked={showOnlyMyOrders} onChange={e => setShowOnlyMyOrders(e.target.checked)} />
            Show only my orders
          </label>
        </div>
      </div>
      <div className='card' style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading && orders.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <Icon name='refresh' className='spin' />
            <div style={{ marginTop: 12 }}>Loading CRM orders...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            <Icon name='clipboard' size={40} />
            <div className='fw6' style={{ marginTop: 12, color: 'var(--fg)' }}>No CRM orders found</div>
            <div style={{ fontSize: 13 }}>Try adjusting your search or create a new order.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className='tbl'>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone Number</th>
                  <th>Address</th>
                  <th>City/State</th>
                  <th>Last Updated</th>
                  <th>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, i) => (
                  <tr key={i}>
                    <td className='fw6'>
                      {o['First Name'] || ''} {o['Last Name'] || ''}
                    </td>
                    <td className='num'>{o['Phone Number'] || '-'}</td>
                    <td>
                      <div className='stack-2'>
                        <div>{o['Address'] || '-'}</div>
                        <div className='muted' style={{ fontSize: 11 }}>{o['Landmark'] ? 'Landmark: ' + o['Landmark'] : ''}</div>
                      </div>
                    </td>
                    <td>
                      <div className='stack-2'>
                        <div>{o['District/City'] || '-'}</div>
                        <div className='muted num' style={{ fontSize: 11 }}>{o['State']} {o['Pin Code']}</div>
                      </div>
                    </td>
                    <td className='muted num'>{o['Last Updated'] || '-'}</td>
                    <td>
                      {o['Updated By'] ? <Badge tone='low'>{o['Updated By']}</Badge> : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', fontSize: 12, borderTop: '1px solid var(--border)', color: 'var(--muted)' }}>
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;

const path = 'D:/firebase/sehatupfirebase-main/sehatup-analytics/src/NewUI.jsx';
let content = fs.readFileSync(path, 'utf8');

// Insert it right before OrdersHistory
content = content.replace('function OrdersHistory', code + '\nfunction OrdersHistory');
fs.writeFileSync(path, content, 'utf8');
console.log('Appended successfully');
