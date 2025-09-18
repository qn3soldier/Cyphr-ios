import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill specific globals.
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@ui": path.resolve(__dirname, "./src/ui"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@crypto": path.resolve(__dirname, "./src/api/crypto")
    },
  },
  // WASM support for Kyber1024 post-quantum cryptography
  server: {
    fs: {
      allow: ['..', './node_modules/pqc-kyber']
    }
  },
  optimizeDeps: {
    exclude: ['pqc-kyber']
  },
  // Enable WASM in worker threads
  worker: {
    format: 'es'
  },
  // Ensure .wasm files are handled correctly
  assetsInclude: ['**/*.wasm']
})
