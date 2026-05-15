// src/utils/shopify.js

/**
 * Utility to interact with Shopify Admin API via the local proxy.
 * The proxy handles the X-Shopify-Access-Token header.
 */

const API_BASE = '/api-shopify/admin/api/2024-10';

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
 * Fetch total customer count.
 * @returns {Promise<number>}
 */
export const getCustomersCount = async () => {
    try {
        const response = await fetch(`${API_BASE}/customers/count.json`);
        if (!response.ok) throw new Error(`Count failed: ${response.statusText}`);
        const data = await response.json();
        return data.count || 0;
    } catch (error) {
        console.error('Error getting customer count:', error);
        throw error;
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
