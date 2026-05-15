import { useState, useEffect } from 'react'
import { Search, Package, ArrowRight, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const PROXY_URL = '/api-sehatup'

function App() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // 1. Predictive Search (Debounced)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length > 1) {
        fetchProducts(query)
      } else {
        setResults([])
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  const fetchProducts = async (term) => {
    setIsLoading(true)
    try {
      // Fetching from Shopify Suggest API via proxy
      const response = await fetch(
        `${PROXY_URL}/search/suggest.json?q=${encodeURIComponent(term)}&resources[type]=product`
      )
      const data = await response.json()
      
      const products = data.resources.results.products.map(p => ({
        id: p.id,
        title: p.title,
        handle: p.handle,
        image: p.image,
        price: p.price
      }))

      setResults(products)
    } catch (error) {
      console.error('Fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 2. Fetch Detailed Variant Info
  const handleProductClick = async (handle) => {
    try {
      const response = await fetch(`${PROXY_URL}/products/${handle}.js`)
      const productData = await response.json()
      
      // Alerting the details as a demonstration
      const variantNames = productData.variants.map(v => `${v.title} (ID: ${v.id})`).join('\n')
      alert(`Product: ${productData.title}\n\nAvailable Variants:\n${variantNames}`)
    } catch (error) {
      alert('Error fetching variants')
    }
  }

  return (
    <div className="glass-card">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.5rem', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          SehatUp Product Fetcher
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '2.5rem' }}>
          Real-time product & variant data direct from sehatup.com
        </p>

        <div style={{ position: 'relative' }}>
          <Search 
            size={20} 
            style={{ position: 'absolute', left: '1.25rem', top: '1.25rem', color: '#6366f1' }} 
          />
          <input
            type="text"
            className="search-input"
            placeholder="Search for products (e.g. Amla, Ashwagandha)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: '3.5rem' }}
          />
          {isLoading && (
            <div style={{ position: 'absolute', right: '1.25rem', top: '1.25rem' }}>
              <Loader2 className="loading-spinner" />
            </div>
          )}
        </div>
      </motion.div>

      <div className="results-grid">
        <AnimatePresence mode='popLayout'>
          {results.map((product, index) => (
            <motion.div
              key={product.id}
              className="product-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleProductClick(product.handle)}
            >
              <img src={product.image} alt={product.title} className="product-image" />
              <div className="product-title">{product.title}</div>
              <div className="product-price">{product.price}</div>
              <div className="badge">
                <Package size={12} style={{ marginRight: '4px' }} />
                Click to view variants
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {query.length > 1 && results.length === 0 && !isLoading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ padding: '4rem', color: '#64748b' }}
        >
          No products found for "{query}"
        </motion.div>
      )}
    </div>
  )
}

export default App
