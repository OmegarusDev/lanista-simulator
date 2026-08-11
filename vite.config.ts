import path from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/** Force a full page reload on any change under src/ (WebGL game; HMR is unreliable). */
function fullReloadOnSrcChange(): Plugin {
  return {
    name: 'full-reload-on-src-change',
    handleHotUpdate({ file, server }) {
      const normalized = file.replace(/\\/g, '/');
      if (!normalized.includes('/src/')) return;
      server.ws.send({ type: 'full-reload', path: file });
      return [];
    },
  };
}

export default defineConfig({
  // Project Pages URL: https://omegarusdev.github.io/lanista-simulator/
  base: '/lanista-simulator/',
  plugins: [fullReloadOnSrcChange()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5299,
    strictPort: true,
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
