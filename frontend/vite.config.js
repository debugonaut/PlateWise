import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5188,
    host: true,
    // Proxy /api calls to the local Express backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Vercel limit is 50MB uncompressed; this keeps chunk sizes manageable
    chunkSizeWarningLimit: 800,
  },
});
