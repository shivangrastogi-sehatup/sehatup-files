import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-sehatup': {
        target: 'https://sehatup.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-sehatup/, ''),
      },
      '/api-shorten-tiny': {
        target: 'https://tinyurl.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-shorten-tiny/, ''),
      },
      '/api-shorten-isgd': {
        target: 'https://is.gd',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-shorten-isgd/, ''),
      },
      '/api-shorten-vgd': {
        target: 'https://v.gd',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-shorten-vgd/, ''),
      },
      '/api-shorten-ulvis': {
        target: 'https://ulvis.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-shorten-ulvis/, ''),
      },
      '/api-shorten-chilp': {
        target: 'https://chilp.it',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-shorten-chilp/, ''),
      },
    },
  },
})
