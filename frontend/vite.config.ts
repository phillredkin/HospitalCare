import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'BACKEND_');
  const proxy: Record<string, ProxyOptions> = {
    '/api': {
      target: process.env.BACKEND_URL ?? env.BACKEND_URL ?? 'http://localhost:5007',
      changeOrigin: true,
      configure(proxy) {
        proxy.on('error', (_error, _request, response) => {
          if ('writeHead' in response && !response.headersSent) {
            response.writeHead(503, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ code: 'backend_unavailable' }));
          }
        });
      },
    },
  };
  return { plugins: [react()], server: { proxy }, preview: { proxy } };
});
