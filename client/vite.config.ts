import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Plugin to fix import.meta.resolve calls in swisseph-wasm for browser compatibility.
 * The swisseph-wasm package uses import.meta.resolve which doesn't work correctly
 * after Vite bundling. This plugin replaces those calls with a working alternative.
 */
function fixSwissEphResolve(): Plugin {
  return {
    name: 'fix-swisseph-resolve',
    transform(code, id) {
      // Only transform the swisseph wsam module
      if (id.indexOf('swisseph-wasm') === -1 || id.indexOf('wsam') === -1) {
        return null;
      }
      
      // Replace import.meta.resolve("./swisseph.data") with a URL-based approach
      // that works correctly in bundled code
      let transformed = code;
      
      // Fix the data file resolution for browser
      // Original: import.meta.resolve ? import.meta.resolve("./swisseph.data") : "./swisseph.data"
      // Replace with: new URL("./swisseph.data", import.meta.url).href
      transformed = transformed.replace(
        /import\.meta\.resolve\s*\?\s*import\.meta\.resolve\s*\(\s*["']\.\/swisseph\.data["']\s*\)\s*:\s*["']\.\/swisseph\.data["']/g,
        'new URL("./swisseph.data", import.meta.url).href'
      );
      
      // Fix the WASM file resolution for browser - this pattern appears in findWasmBinary()
      // Original pattern in the code:
      // if (import.meta.resolve) try { e = import.meta.resolve("./swisseph.wasm") } catch { e = "./swisseph.wasm" } else e = "./swisseph.wasm"
      transformed = transformed.replace(
        /if\s*\(\s*import\.meta\.resolve\s*\)\s*try\s*\{\s*(\w+)\s*=\s*import\.meta\.resolve\s*\(\s*["']\.\/swisseph\.wasm["']\s*\)\s*\}\s*catch\s*\{\s*\1\s*=\s*["']\.\/swisseph\.wasm["']\s*\}\s*else\s*\1\s*=\s*["']\.\/swisseph\.wasm["']/g,
        '$1 = new URL("./swisseph.wasm", import.meta.url).href'
      );
      
      if (transformed !== code) {
        console.log('[fix-swisseph-resolve] Patched import.meta.resolve calls in:', id);
        return {
          code: transformed,
          map: null
        };
      }
      
      return null;
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    fixSwissEphResolve()
  ],
  build: {
    // Generate manifest.json for WP to read
    manifest: true,
    rollupOptions: {
      input: './src/main.tsx',
      output: {
        // Keep swisseph-wasm as a separate chunk so its import.meta works correctly
        manualChunks: {
          'swisseph': ['swisseph-wasm']
        }
      }
    },
    outDir: 'dist',
    assetsDir: 'assets',
    // Increase chunk size warning limit since WASM data is large
    chunkSizeWarningLimit: 15000,
  },
  // Use relative base so assets work regardless of WordPress install location.
  base: './',
  server: {
    fs: { allow: ['..'] }
  },
  assetsInclude: ['**/*.wasm', '**/*.data'],
  optimizeDeps: {
    exclude: ['swisseph-wasm']
  },
  // Ensure WASM files are handled correctly
  worker: {
    format: 'es'
  }
})
