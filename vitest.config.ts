import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      '**/*.{test,spec}.?(c|m)[jt]s?(x)'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/crypto-security-benchmark.test.js' // requires WASM loader; not runtime-critical
    ],
  },
})


