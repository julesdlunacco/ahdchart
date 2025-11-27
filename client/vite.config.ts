import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Generate manifest.json for WP to read
    manifest: true,
    rollupOptions: {
      input: './src/main.tsx',
    },
    outDir: 'dist',
    assetsDir: 'assets',
  },
  base: process.env.NODE_ENV === 'production' 
    ? '/wp-content/plugins/ahd-charts/client/dist/' 
    : '/',
  server: {
    fs: { allow: ['..'] }
  },
  assetsInclude: ['**/*.wasm'],
  optimizeDeps: {
    exclude: ['swisseph-wasm']
  }
})
