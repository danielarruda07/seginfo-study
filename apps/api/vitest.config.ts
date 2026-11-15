import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Os testes usam o `@seginfo/shared` DESTA árvore (mesmo caminho do tsconfig e do Vite do web),
 * e não o link em node_modules. Sem isso, um worktree que compartilha node_modules testaria o
 * shared de outra pasta.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@seginfo/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
});
