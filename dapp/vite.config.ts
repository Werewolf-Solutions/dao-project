import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('react-router')) return 'react-vendor';
            if (id.includes('wagmi') || id.includes('@wagmi')) return 'wagmi-vendor';
            if (id.includes('viem')) return 'viem-vendor';
            if (id.includes('@tanstack')) return 'query-vendor';
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('unified') || id.includes('micromark') || id.includes('mdast')) return 'markdown-vendor';
          }
        },
      },
    },
  },
})
