import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**', '**/.next/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],

      // Global thresholds
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },

      exclude: [
        'node_modules/',
        'tests/',
        'e2e/',
        '**/*.config.{ts,js}',
        '**/types.ts',
        '.next/',
        'src/app/**/layout.tsx',  // Exclude Next.js layouts (tested via E2E)
        'src/app/**/page.tsx',    // UI pages tested via E2E
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
