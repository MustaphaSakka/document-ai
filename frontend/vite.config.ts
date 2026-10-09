import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const BACKEND_URL = 'http://localhost:3000';

/**
 * The API is served under /api, and the prefix is stripped before forwarding.
 *
 * The SPA route `/documents` and the API path `/documents` would otherwise be
 * the same URL: the proxy would swallow the page navigation and return JSON
 * instead of index.html. Namespacing also mirrors what a reverse proxy does in
 * production (route /api to the backend, everything else to the static files).
 *
 * Proxying rather than enabling CORS keeps the browser on a single origin, so
 * the backend needs no change.
 */
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
