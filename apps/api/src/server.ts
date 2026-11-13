import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { extractUrl } from './extract.js';
import { registerStateRoutes } from './routes.js';
import { registerIngestRoutes } from './ingest.js';
import { iniciarRetencao } from './radar.js';
import { iniciarBackupAutomatico } from './backup.js';
import { iniciarLimpezaMemorias } from './memorias.js';
import { requireIdentity } from './auth.js';
import { VERSAO } from '@seginfo/shared';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

// CORS liberado para o dev server do Vite (ajuste a origem em produção).
await app.register(cors, {
  origin: (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(','),
  allowedHeaders: ['Content-Type'],
});

// versao: o rodapé do front compara com a dele para saber se os dois containers foram atualizados
const health = async () => ({ ok: true, service: 'seginfo-api', versao: VERSAO, time: new Date().toISOString() });
app.get('/health', health);
// O frontend e o proxy de produção acessam a API sob /api/.
app.get('/api/health', health);

// rotas de estado do usuário (persistência PostgreSQL via Prisma)
await app.register(registerStateRoutes);

// ingestão de eventos por coletores (token de máquina; fora do hook de usuário)
await app.register(registerIngestRoutes);

// retenção dos eventos de ataque (ATAQUES_RETENCAO_DIAS, padrão 90)
iniciarRetencao(app);

// backup automático diário para o OneDrive (BACKUP_AUTOMATICO=true)
iniciarBackupAutomatico(app);

// apaga de vez as memórias da lixeira cuja carência de 7 dias venceu
iniciarLimpezaMemorias(app);

const ExtractBody = z.object({ url: z.string().url() });

/**
 * Busca uma URL server-side e devolve título/descrição/texto limpo.
 * O resumo/categoria continua sendo feito no front (textProcess), mantendo
 * compatibilidade com o que já existe. Opção C (IA) pode entrar aqui depois.
 */
app.post('/api/extract', {
  // Em produção exige identidade verificada (é um proxy de fetch, não deve ser público).
  // Em dev continua aberto, para a Biblioteca funcionar sem banco nem DEV_USER_EMAIL.
  preHandler: async (req, reply) => {
    if (process.env.NODE_ENV !== 'production') return;
    const email = await requireIdentity(req, reply);
    if (!email) return reply;
  },
}, async (req, reply) => {
  const parsed = ExtractBody.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: 'Informe uma URL válida.' });
  }
  try {
    const result = await extractUrl(parsed.data.url);
    return result;
  } catch (e) {
    const err = e as Error & { statusCode?: number };
    return reply.status(err.statusCode ?? 500).send({ error: err.message });
  }
});

const port = Number(process.env.PORT ?? 3001);
// Em produção (container) precisa ouvir em todas as interfaces para o Nginx alcançar.
// Em dev ouve só no loopback: não expõe a API (nem o /api/extract aberto) à LAN.
const host = process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
app
  .listen({ port, host })
  .then(() => app.log.info(`SegInfo API em http://localhost:${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
