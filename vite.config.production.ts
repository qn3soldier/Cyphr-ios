import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    topLevelAwait(),
    wasm(),
    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // Brotli compression
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
    }),
    // Bundle analyzer (optional)
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  
  build: {
    // Production optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    
    // Output configuration
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    
    // Code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', '@radix-ui/react-avatar', '@radix-ui/react-switch', 'lucide-react'],
          'crypto-vendor': ['@noble/ciphers', '@noble/curves', '@noble/hashes', 'pqc-kyber'],
          'stellar-vendor': ['@stellar/stellar-sdk'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'socket-vendor': ['socket.io-client'],
        },
        
        // Asset naming
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (/\.(gif|jpe?g|png|svg)$/.test(name ?? '')) {
            return 'images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(name ?? '')) {
            return 'fonts/[name]-[hash][extname]';
          }
          if (/\.css$/.test(name ?? '')) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    
    // Performance thresholds
    chunkSizeWarningLimit: 1000,
    
    // CSS optimization
    cssCodeSplit: true,
    cssMinify: true,
    
    // Asset inlining
    assetsInlineLimit: 4096,
    
    // Target modern browsers
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    
    // Polyfill dynamic imports
    polyfillModulePreload: true,
    
    // Report compressed sizes
    reportCompressedSize: true,
  },
  
  // Server configuration for preview
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
  },
  
  // Define global constants
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'socket.io-client',
    ],
    exclude: ['@stellar/stellar-sdk'],
  },
  
  // Enable caching
  cacheDir: 'node_modules/.vite',
  
  // Production base URL
  base: '/',
});