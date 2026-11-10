import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'], restoreMocks: true },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@seginfo/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
    // Encaminha /api para o apps/api (Fastify) quando ele estiver rodando.
    // Sem a API no ar, a Biblioteca cai no fluxo manual (colar texto).
    proxy: {
      // 127.0.0.1 explícito: a API em dev ouve só em IPv4 loopback, e "localhost"
      // pode resolver para ::1 (IPv6) em algumas versões do Node.
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
});
