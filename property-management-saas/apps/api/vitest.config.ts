import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    /* Global test settings */
    globals: true,
    environment: 'node',
    /* Test file patterns */
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    /* Timeout for each test (ms) */
    testTimeout: 10_000,
    /* Setup files to run before tests */
    setupFiles: ['./tests/setup.ts'],
    /* Coverage configuration */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
