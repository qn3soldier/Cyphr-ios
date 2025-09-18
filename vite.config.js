import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      include: /\.(jsx|tsx)$/,
      exclude: [/\.js$/, /node_modules/]
    }),
    wasm(),
    topLevelAwait()
  ],
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.jsx': 'jsx',
        '.tsx': 'tsx',
        '.js': 'js',
        '.ts': 'ts'
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: true
  },
  define: {
    global: 'globalThis',
    'process.env': {}
  }
}); 