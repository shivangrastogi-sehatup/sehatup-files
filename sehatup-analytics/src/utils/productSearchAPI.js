/**
 * productSearchAPI.js
 * Standalone product search functionality extracted from OrderForm.jsx
 *
 * Uses Shopify Admin GraphQL API to search and fetch products with variants
 */

/**
 * Search products by term using GraphQL query
 * @param {string} term - Search term (product name, SKU, etc)
 * @returns {Promise<Array>} Array of products with variants
 */
export const searchProducts = async (term) => {
    try {
        const cleanTerm = term.replace(/"/g, '\\"');
        const query = `{
            products(first: 15, query: "${cleanTerm}*") {
                edges {
                    node {
                        id
                        title
                        handle
                        featuredImage { url }
                        variants(first: 50) {
                            edges {
                                node {
                                    id
                                    title
                                    price
                                }
                            }
                        }
                    }
                }
            }
        }`;

        const res = await fetch('/shopify-v2/graphql.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        });

        const data = await res.json();

        if (data.errors) {
            console.error('[Product search] GraphQL errors:', data.errors);
            return [];
        }

        // Transform GraphQL response into product objects
        const products = (data?.data?.products?.edges || []).map(edge => {
            const node = edge.node;
            return {
                id: parseInt(node.id.split('/').pop(), 10) || node.id,
                title: node.title,
                handle: node.handle,
                image: node.featuredImage?.url || null,
                variants: (node.variants?.edges || []).map(vEdge => {
                    const vNode = vEdge.node;
                    return {
                        id: parseInt(vNode.id.split('/').pop(), 10) || vNode.id,
                        title: vNode.title,
                        // Price in cents (e.g. 1999 for $19.99)
                        price: Math.round(parseFloat(vNode.price) * 100)
                    };
                })
            };
        });

        // Only return products that have variants
        return products.filter(p => p.variants && p.variants.length > 0);

    } catch (err) {
        console.error('[Product search] failed:', err);
        return [];
    }
};

/**
 * Custom hook for managing product search state
 * Usage in React components:
 *
 * const [searchTerm, setSearchTerm] = useState('');
 * const [searchResults, setSearchResults] = useState([]);
 * const [isSearching, setIsSearching] = useState(false);
 *
 * useEffect(() => {
 *     const t = setTimeout(() => {
 *         if (searchTerm.trim().length > 1) {
 *             setIsSearching(true);
 *             searchProducts(searchTerm)
 *                 .then(products => setSearchResults(products))
 *                 .finally(() => setIsSearching(false));
 *         } else {
 *             setSearchResults([]);
 *         }
 *     }, 500);
 *     return () => clearTimeout(t);
 * }, [searchTerm]);
 */

/**
 * Toggle variant selection for cart
 * @param {Object} selectedVariants - Current selected variants map
 * @param {Object} variant - Variant to toggle
 * @param {Object} product - Parent product object
 * @returns {Object} Updated variants map
 */
export const toggleVariantSelection = (selectedVariants, variant, product) => {
    const n = { ...selectedVariants };
    if (n[variant.id]) {
        delete n[variant.id];
    } else {
        n[variant.id] = { ...variant, productTitle: product.title };
    }
    return n;
};

/**
 * Toggle all variants of a product
 * @param {Object} selectedVariants - Current selected variants map
 * @param {Object} product - Product whose variants to toggle
 * @param {boolean} checked - Whether to check or uncheck all
 * @returns {Object} Updated variants map
 */
export const toggleAllVariants = (selectedVariants, product, checked) => {
    const n = { ...selectedVariants };
    product.variants.forEach(v => {
        if (checked) {
            n[v.id] = { ...v, productTitle: product.title };
        } else {
            delete n[v.id];
        }
    });
    return n;
};
