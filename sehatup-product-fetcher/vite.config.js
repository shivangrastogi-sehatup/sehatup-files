import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-sehatup': {
        target: 'https://sehatup.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-sehatup/, ''),
      }
    }
  }
})
