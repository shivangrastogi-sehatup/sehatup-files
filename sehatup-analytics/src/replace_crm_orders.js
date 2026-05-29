const fs = require('fs');
const path = 'D:/firebase/sehatupfirebase-main/sehatup-analytics/src/NewUI.jsx';
let content = fs.readFileSync(path, 'utf8');

const newCRMOrders = `function CRMOrders({ setRoute, openCustomer }) {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyMyOrders, setShowOnlyMyOrders] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

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
            <table className='tbl' style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th style={{ whiteSpace: "nowrap" }}>Name</th>
                  <th style={{ whiteSpace: "nowrap" }}>Phone Number</th>
                  <th style={{ minWidth: 200 }}>Address</th>
                  <th style={{ whiteSpace: "nowrap" }}>Shopify Order</th>
                  <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>Items</th>
                  <th style={{ whiteSpace: "nowrap" }}>Amount</th>
                  <th style={{ whiteSpace: "nowrap" }}>Payment</th>
                  <th style={{ whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ whiteSpace: "nowrap" }}>CRM Last Updated</th>
                  <th style={{ whiteSpace: "nowrap" }}>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, i) => {
                  const oPhone = (o['Phone Number'] || '').replace(/\\D/g, '');
                  const shopifyOrder = window.SehatData?.ORDERS?.find(s => {
                    const cPhone = (s.customer?.phone || '').replace(/\\D/g, '');
                    return cPhone && oPhone && cPhone === oPhone;
                  });

                  return (
                    <tr key={i} style={{ opacity: shopifyOrder?.status === 'Cancelled' ? 0.6 : 1, textDecoration: shopifyOrder?.status === 'Cancelled' ? 'line-through' : 'none' }}>
                      <td className='fw6' style={{ whiteSpace: "nowrap" }}>
                        {o['First Name'] || ''} {o['Last Name'] || ''}
                      </td>
                      <td className='num' style={{ whiteSpace: "nowrap" }}>{o['Phone Number'] || '-'}</td>
                      <td>
                        <div className='stack-2' style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                          <div>{o['Address'] || '-'}</div>
                          <div className='muted' style={{ fontSize: 11 }}>
                            {o['Landmark'] ? 'Landmark: ' + o['Landmark'] + ' · ' : ''}
                            {o['District/City']} {o['State']} {o['Pin Code']}
                          </div>
                        </div>
                      </td>
                      <td className="mono num fw5" style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder ? \`#\${shopifyOrder.id}\` : '-'}
                      </td>
                      <td className="muted" style={{ textAlign: "center", position: "relative" }}>
                        {shopifyOrder && shopifyOrder.items ? (
                          <>
                            <button 
                              className="item-hover-btn" 
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer", fontWeight: "normal", padding: "4px 8px" }}
                              onClick={(e) => { e.stopPropagation(); setExpandedOrderId(expandedOrderId === i ? null : i); }}
                            >
                              <span className="num fw5" style={{ fontSize: 13 }}>{shopifyOrder.items.length}</span> {shopifyOrder.items.length === 1 ? 'item' : 'items'}
                              <Icon name={expandedOrderId === i ? "chevron_up" : "chevron_down"} size={14} className="muted" />
                            </button>
                            {expandedOrderId === i && (
                              <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.1)", zIndex: 100, padding: 16, minWidth: 320, textAlign: "left" }}>
                                <div className="fw6" style={{ marginBottom: 16, color: "var(--text)" }}>Items</div>
                                <div className="stack-12">
                                  {shopifyOrder.items.map((it, idx) => (
                                    <div key={idx} className="hstack-10">
                                      <div style={{ width: 44, height: 44, background: "var(--surface-2)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--border)", overflow: "hidden" }}>
                                        {it.image ? <img src={it.image} alt={it.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="package" size={20} className="muted" />}
                                      </div>
                                      <div className="stack-2" style={{ flex: 1, minWidth: 0 }}>
                                        <div className="fw5" style={{ fontSize: 13, color: "var(--text)", whiteSpace: "normal", wordBreak: "break-word", lineHeight: 1.3 }}>{it.name}</div>
                                      </div>
                                      <div className="muted fw5" style={{ fontSize: 13, flexShrink: 0 }}>x {it.qty}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : '-'}
                      </td>
                      <td className="num fw5" style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder ? \`Rs. \${shopifyOrder.amount.toLocaleString()}\` : '-'}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder && typeof PaymentStatusBadge !== 'undefined' ? <PaymentStatusBadge status={shopifyOrder.paymentMode || shopifyOrder.paymentStatus || 'Pending'} /> : '-'}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {shopifyOrder && typeof OrderStatusBadge !== 'undefined' ? <OrderStatusBadge status={shopifyOrder.status} /> : '-'}
                      </td>
                      <td className='muted num' style={{ whiteSpace: "nowrap" }}>{o['Last Updated'] || '-'}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {o['Updated By'] ? <Badge tone='low'>{o['Updated By']}</Badge> : '-'}
                      </td>
                    </tr>
                  );
                })}
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
}`;

const startIndex = content.indexOf('function CRMOrders({ setRoute, openCustomer }) {');
const endIndex = content.indexOf('function OrdersHistory({ setRoute, openCustomer }) {');

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newCRMOrders + '\n\n' + content.substring(endIndex);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Successfully replaced CRMOrders.');
} else {
  console.log('Could not find CRMOrders bounds.', { startIndex, endIndex });
}
