import { defineConfig } from 'tsup';

// Bundles everything into a single dist/index.js that only needs Node.js,
// so the MCP server can be used from any Claude client without installing.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  noExternal: [/.*/],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
