import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Cada archivo levanta su propio jsdom y la suite completa satura una
    // máquina con poca memoria: tests que pasan aislados se pasaban de los
    // 5s por defecto al correr todos juntos. El límite alto evita fallas
    // intermitentes que no son del código.
    testTimeout: 20000,
  },
});