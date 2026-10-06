import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules') < 0) return undefined
          if (id.indexOf('react') >= 0) return 'react'
          if (id.indexOf('genlayer-js') >= 0) return 'genlayer'
          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      '/genlayer-rpc': {
        target: 'https://studio.genlayer.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/api',
      },
    },
  },
})
