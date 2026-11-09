import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configuração do Prisma CLI (Prisma 7).
 * A URL vem de DATABASE_URL (Secret no Coolify, .env em dev).
 *
 * `prisma generate` não conecta ao banco, mas o config é avaliado mesmo assim.
 * Por isso há um fallback inerte: se DATABASE_URL faltar, `generate` funciona e
 * `migrate` falha com erro claro de conexão, em vez de usar um alvo real por engano.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://invalid:invalid@127.0.0.1:1/invalid',
  },
});
