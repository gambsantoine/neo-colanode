import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Unit tests that need neither Postgres nor Redis: the database, redis and
// storage modules are mocked inside the tests. Runs without Docker.
export default defineConfig({
  root: rootDir,
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@colanode/server': path.resolve(rootDir, 'src'),
      '@colanode/core': path.resolve(rootDir, '../../packages/core/src'),
      '@colanode/crdt': path.resolve(rootDir, '../../packages/crdt/src'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/lib/**/*.test.ts', 'test/api/wikis/**/*.test.ts'],
    exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
    env: {
      POSTGRES_URL: 'postgres://unit:unit@127.0.0.1:1/unit',
      REDIS_URL: 'redis://127.0.0.1:1',
    },
  },
});
