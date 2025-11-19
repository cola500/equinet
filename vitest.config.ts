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
      reporter: ['text', 'json', 'html', 'lcov'],

      // Global coverage thresholds (Sprint 0 baseline)
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },

      // Files to include in coverage
      include: [
        'src/app/api/**/*.ts',
        'src/lib/**/*.ts',
        'src/domain/**/*.ts',
        'src/infrastructure/**/*.ts',
      ],

      exclude: [
        'node_modules/',
        'tests/',
        'e2e/',
        '**/*.config.{ts,js}',
        '**/types.ts',
        '**/*.d.ts',
        '.next/',
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/app/**/not-found.tsx',
        'src/components/**/*.tsx', // UI tested via E2E
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],

      // Enforce per-file coverage (fails build if any file below threshold)
      perFile: true,

      // Watermarks for coverage visualization (yellow/green)
      watermarks: {
        statements: [70, 80],
        functions: [70, 80],
        branches: [70, 80],
        lines: [70, 80],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
