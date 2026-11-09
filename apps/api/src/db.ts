import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7: conexão via driver adapter. DATABASE_URL precisa existir no ambiente
// (Secret no Coolify; .env em dev). Sem ela o pg cai em defaults e a auth falha.
//
// Conexão PREGUIÇOSA: o client só é criado no primeiro uso. Assim /health e
// /api/extract (Biblioteca) continuam funcionando mesmo sem banco configurado;
// só as rotas de estado exigem DATABASE_URL.
let client: PrismaClient | null = null;

function createClient(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definida. Configure no .env (dev) ou como Secret no Coolify.');
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    client ??= createClient();
    return Reflect.get(client, prop);
  },
});

/**
 * Resolve (ou cria) o usuário a partir do e-mail do Cloudflare Access.
 * Single-user na prática, mas modelado por e-mail para permitir mais de um futuramente.
 */
export async function resolveUsuario(email: string) {
  return prisma.usuario.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}
