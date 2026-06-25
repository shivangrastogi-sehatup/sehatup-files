// src/utils/shopify.js

/**
 * Utility to interact with Shopify Admin API via the local proxy.
 * The proxy handles the X-Shopify-Access-Token header.
 */

const API_BASE = '/shopify-v2';

/**
 * Search for customers by name or phone number.
 * @param {string} queryStr - The name or phone to search for.
 * @returns {Promise<Array>} - List of customers.
 */
export const searchCustomers = async (queryStr) => {
    try {
        let shopifyQuery = queryStr;
        // If it's a number, search specifically for phone
        if (/^\d+$/.test(queryStr)) {
            shopifyQuery = `phone:${queryStr}*`;
        } else {
            // Broad search for names/emails
            shopifyQuery = `${queryStr}*`;
        }

        const response = await fetch(`${API_BASE}/customers/search.json?query=${encodeURIComponent(shopifyQuery)}`);
        if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);
        const data = await response.json();
        return data.customers || [];
    } catch (error) {
        console.error('Error searching customers:', error);
        throw error;
    }
};

/**
 * Fetch all customers with pagination.
 * @param {Object} params - { limit, page_info }
 * @returns {Promise<Object>} - { customers, nextPage, prevPage }
 */
export const getCustomers = async (params = {}) => {
    try {
        const { limit = 50, page_info = '' } = params;
        let url = `${API_BASE}/customers.json?limit=${limit}&order=created_at%20desc`;
        if (page_info) {
            // Note: when using page_info, other params like 'order' should not be included 
            // as they are encoded within the page_info itself.
            url = `${API_BASE}/customers.json?limit=${limit}&page_info=${page_info}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        
        const linkHeader = response.headers.get('Link');
        let nextInfo = '';
        let prevInfo = '';
        
        if (linkHeader) {
            const matches = linkHeader.matchAll(/<[^>]*page_info=([^>&]*)>; rel="([^"]*)"/g);
            for (const match of matches) {
                if (match[2] === 'next') nextInfo = match[1];
                if (match[2] === 'previous') prevInfo = match[1];
            }
        }

        const data = await response.json();
        return { 
            customers: data.customers || [], 
            nextPage: nextInfo,
            prevPage: prevInfo
        };
    } catch (error) {
        console.error('Error fetching customers:', error);
        throw error;
    }
};

/**
 * Fetch orders from Shopify.
 * @param {Object} params - { limit, status }
 * @returns {Promise<Array>} - List of orders.
 */
export const getOrders = async (params = {}) => {
    try {
        const { limit = 50, status = 'any' } = params;
        const url = `${API_BASE}/orders.json?status=${status}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch orders failed: ${response.statusText}`);
        const data = await response.json();
        return data.orders || [];
    } catch (error) {
        console.error('Error fetching orders:', error);
        throw error;
    }
};

/**
 * Fetch ALL orders by following Shopify's cursor (page_info) pagination.
 * Returns the full array (capped by `max` for safety). Enables client-side
 * pagination with arbitrary "jump to page".
 * @param {Object} params - { status, max, perPage }
 * @returns {Promise<Array>}
 */
export const getAllOrders = async ({ status = 'any', max = 2000, perPage = 250 } = {}) => {
    const all = [];
    let pageInfo = '';
    for (let i = 0; i < 50 && all.length < max; i++) {
        // When paginating with page_info, Shopify forbids other filters (status etc.) —
        // they're already encoded in the cursor.
        const url = pageInfo
            ? `${API_BASE}/orders.json?limit=${perPage}&page_info=${encodeURIComponent(pageInfo)}`
            : `${API_BASE}/orders.json?status=${status}&limit=${perPage}`;
        const response = await fetch(url);
        if (!response.ok) break;
        const linkHeader = response.headers.get('Link') || '';
        const data = await response.json();
        all.push(...(data.orders || []));

        let next = '';
        if (linkHeader) {
            const matches = linkHeader.matchAll(/<[^>]*page_info=([^>&]*)[^>]*>;\s*rel="([^"]*)"/g);
            for (const m of matches) { if (m[2] === 'next') next = m[1]; }
        }
        if (!next) break;
        pageInfo = next;
    }
    return all.slice(0, max);
};

/**
 * Fetch the sales-channel of every order via GraphQL (the channel is NOT in the
 * REST orders.json payload). Returns a Map of legacy numeric order id (string) ->
 * channel label, e.g. "shopify_oneclick" or "Custom". Batched through the
 * paginated `orders` query, so it costs only ~1 GraphQL call per 250 orders.
 * @param {Object} params - { max, perPage }
 * @returns {Promise<Map<string,string>>}
 */
export const getOrdersChannelMap = async ({ max = 2000, perPage = 250 } = {}) => {
    const map = new Map();
    let cursor = null;
    const query = `
      query($cursor: String) {
        orders(first: ${perPage}, after: $cursor, sortKey: CREATED_AT, reverse: true) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              legacyResourceId
              app { name }
              channelInformation {
                channelDefinition { handle channelName }
              }
            }
          }
        }
      }`;
    try {
        for (let i = 0; i < 50 && map.size < max; i++) {
            const res = await fetch('/shopify-v2/graphql.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables: { cursor } }),
            });
            if (!res.ok) break;
            const json = await res.json();
            const conn = json?.data?.orders;
            if (!conn) break;
            for (const { node } of conn.edges || []) {
                const cd = node.channelInformation?.channelDefinition;
                // Prefer the channel handle ("shopify_oneclick"), then its display
                // name ("Custom"), then the app name as a last resort.
                const label = cd?.handle || cd?.channelName || node.app?.name || '';
                if (node.legacyResourceId) map.set(String(node.legacyResourceId), label);
            }
            if (!conn.pageInfo?.hasNextPage) break;
            cursor = conn.pageInfo.endCursor;
        }
    } catch (e) {
        console.error('Error fetching order channel map:', e);
    }
    return map;
};

/**
 * Fetch a single order by Shopify internal numeric ID.
 * @param {string|number} orderId
 * @returns {Promise<object|null>}
 */
export const getOrderById = async (orderId) => {
    try {
        const url = `${API_BASE}/orders/${orderId}.json`;
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Fetch order ${orderId} failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.order || null;
    } catch (error) {
        console.error(`Error fetching order ${orderId}:`, error);
        return null;
    }
};

/**
 * Fetch a single order by its order_number (e.g. "#1738" or "1738").
 * Uses the orders.json?name= search since Shopify's by-id endpoint only takes
 * the internal numeric id.
 * @param {string|number} orderNumber
 * @returns {Promise<object|null>}
 */
export const getOrderByNumber = async (orderNumber) => {
    try {
        const n = String(orderNumber).trim().replace(/^#+/, '');
        // Shopify accepts the name parameter with or without "#"; we try both.
        const candidates = [`#${n}`, n];
        for (const name of candidates) {
            const url = `${API_BASE}/orders.json?status=any&name=${encodeURIComponent(name)}&limit=1`;
            const r = await fetch(url);
            if (!r.ok) continue;
            const data = await r.json();
            if (data.orders?.length) return data.orders[0];
        }
        return null;
    } catch (error) {
        console.error(`Error fetching order #${orderNumber}:`, error);
        return null;
    }
};

/**
 * Smart lookup — tries both order_number (search) and internal id (direct fetch).
 * Use this when you have a value extracted from Nimbus and don't know which it is.
 * @param {string} ref  Either "#1738", "1738", or "1779773265"
 * @returns {Promise<object|null>}
 */
export const findShopifyOrder = async (ref) => {
    if (!ref) return null;
    const s = String(ref).trim();
    const numeric = s.replace(/[^0-9]/g, '');
    const hadHash = s.startsWith('#');

    // Heuristic: short numbers (< 10 digits) or values with "#" are usually order_number.
    // Long numbers are usually the internal id. Try the most-likely-first, then fall back.
    const tryNumberFirst = hadHash || numeric.length < 10;
    if (tryNumberFirst) {
        const a = await getOrderByNumber(numeric);
        if (a) return a;
        return await getOrderById(numeric);
    } else {
        const b = await getOrderById(numeric);
        if (b) return b;
        return await getOrderByNumber(numeric);
    }
};

/**
 * Fetch total customer count.
 * @returns {Promise<number>}
 */
export const getCustomersCount = async () => {
    const runCount = async (query) => {
        const response = await fetch('/shopify-v2/graphql.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        if (!response.ok) throw new Error(`Count failed: ${response.statusText}`);
        const data = await response.json();
        if (data.errors) throw new Error(data.errors[0].message);
        return data.data.customersCount.count || 0;
    };
    try {
        // Shopify truncates `customersCount` at 10,000 unless `limit` is raised, so a
        // store with 11,055 customers would otherwise report 10,000. Pass a high limit
        // to get the real total; if the API version rejects it, fall back to the default.
        return await runCount("{ customersCount(limit: 1000000) { count } }");
    } catch (e) {
        console.warn('High-limit customersCount failed, falling back to default:', e.message);
        try {
            return await runCount("{ customersCount { count } }");
        } catch (error) {
            console.error('Error getting customer count:', error);
            throw error;
        }
    }
};

/**
 * Create a new customer in Shopify.
 * @param {Object} customerData - Customer details.
 * @returns {Promise<Object>} - The created customer object.
 */
export const createCustomer = async (customerData) => {
    try {
        const response = await fetch(`${API_BASE}/customers.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer: customerData })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors ? JSON.stringify(errorData.errors) : `Creation failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.customer;
    } catch (error) {
        console.error('Error creating customer:', error);
        throw error;
    }
};

/**
 * Create a new order in Shopify.
 * @param {Object} orderData - Order details.
 * @returns {Promise<Object>} - The created order object.
 */
export const createOrder = async (orderData) => {
    try {
        const response = await fetch(`${API_BASE}/orders.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: orderData })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors ? JSON.stringify(errorData.errors) : `Order creation failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.order;
    } catch (error) {
        console.error('Error creating order:', error);
        throw error;
    }
};

/**
 * Update an existing customer in Shopify.
 * @param {string} customerId - The Shopify customer ID.
 * @param {Object} customerData - Updated customer details.
 * @returns {Promise<Object>} - The updated customer object.
 */
export const updateCustomer = async (customerId, customerData) => {
    try {
        const response = await fetch(`${API_BASE}/customers/${customerId}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer: customerData })
        });
        if (!response.ok) throw new Error(`Update failed: ${response.statusText}`);
        const data = await response.json();
        return data.customer;
    } catch (error) {
        console.error('Error updating customer:', error);
        throw error;
    }
};

/**
 * Create a draft order in Shopify.
 * @param {Object} draftOrderData - Draft order details.
 * @returns {Promise<Object>} - The created draft order object.
 */
export const createDraftOrder = async (draftOrderData) => {
    try {
        const response = await fetch(`${API_BASE}/draft_orders.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft_order: draftOrderData })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors ? JSON.stringify(errorData.errors) : `Draft order failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.draft_order;
    } catch (error) {
        console.error('Error creating draft order:', error);
        throw error;
    }
};
