import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from './db.js';
import type { AuthedRequest } from './auth.js';
import { cifrarSegredo } from './storage-crypto.js';
import {
  concluirAutorizacao, esquecerAccessToken, iniciarAutorizacao, nomeDoDrive, publicBase, variaveisFaltando,
} from './onedrive.js';
import { executarBackup } from './backup.js';

/**
 * Rotas do armazenamento externo. Registradas DENTRO do plugin de rotas de estado, então
 * herdam o hook que exige identidade verificada do Cloudflare Access.
 */

/** Em produção, requisições de navegador precisam vir da própria origem (proteção CSRF). */
export function origemOk(req: FastifyRequest): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  const origin = req.headers.origin;
  // As rotas de estado são chamadas pelo navegador; exigir Origin em produção
  // impede que um site externo use a sessão autenticada do usuário.
  if (!origin) {
    req.log.warn({ rota: req.url }, 'origem: requisição de escrita sem cabeçalho Origin');
    return false;
  }
  let recebida: URL;
  try {
    recebida = new URL(origin);
  } catch {
    return false;
  }
  // Origens configuradas (PUBLIC_BASE_URL e WEB_ORIGIN), comparadas já normalizadas: uma barra,
  // um caminho, aspas ou espaço a mais na variável não pode derrubar todas as gravações.
  if (origensConfiguradas().includes(recebida.origin)) return true;
  // Mesma origem do próprio Host: o navegador não deixa um site externo forjar o Host do pedido,
  // e o Nginx repassa o Host original. Vale também quando a variável está errada ou ausente.
  if (recebida.host === req.headers.host) return true;
  req.log.warn(
    { recebida: recebida.origin, host: req.headers.host, configuradas: origensConfiguradas() },
    'origem: requisição de escrita recusada',
  );
  return false;
}

function origensConfiguradas(): string[] {
  const brutas = [publicBase(), ...(process.env.WEB_ORIGIN ?? '').split(',')];
  return brutas.flatMap((b) => {
    try {
      return b ? [new URL(b.trim().replace(/^["']|["']$/g, '')).origin] : [];
    } catch {
      return [];
    }
  });
}

export async function registerStorageRoutes(app: FastifyInstance) {
  const uid = (req: unknown) => (req as AuthedRequest).usuarioId;

  app.get('/api/storage/status', async (req) => {
    const usuarioId = uid(req);
    const [conta, backups] = await Promise.all([
      prisma.armazenamentoConta.findUnique({
        where: { usuarioId },
        select: { contaNome: true, conectadoEm: true, ultimoBackupEm: true, ultimoErro: true },
      }),
      prisma.backupRegistro.findMany({
        where: { usuarioId },
        orderBy: { criadoEm: 'desc' },
        take: 20,
        select: { id: true, nomeArquivo: true, tamanhoBytes: true, status: true, erro: true, criadoEm: true },
      }),
    ]);
    const faltando = variaveisFaltando();
    return {
      configurado: faltando.length === 0,
      faltando,
      conectado: conta !== null,
      contaNome: conta?.contaNome ?? null,
      conectadoEm: conta?.conectadoEm ?? null,
      ultimoBackupEm: conta?.ultimoBackupEm ?? null,
      ultimoErro: conta?.ultimoErro ?? null,
      automatico: process.env.BACKUP_AUTOMATICO === 'true',
      retencao: Math.max(3, Number(process.env.BACKUP_RETENCAO ?? 14) || 14),
      backups,
    };
  });

  // Passo 1: o front pede a URL de autorização e navega até ela.
  app.get('/api/storage/onedrive/connect', async (req, reply) => {
    if (variaveisFaltando().length > 0) return reply.status(503).send({ error: 'Armazenamento não configurado.' });
    return { url: iniciarAutorizacao(uid(req)) };
  });

  // Passo 2: a Microsoft devolve o navegador aqui, ainda com a sessão do Access.
  app.get('/api/storage/onedrive/callback', async (req, reply) => {
    const q = z.object({ code: z.string().optional(), state: z.string().optional(), error: z.string().optional() })
      .safeParse(req.query);
    if (!q.success || q.data.error || !q.data.code || !q.data.state) {
      return reply.redirect('/armazenamento?erro=autorizacao');
    }
    try {
      const { refreshToken, accessToken } = await concluirAutorizacao(q.data.code, q.data.state, uid(req));
      const contaNome = await nomeDoDrive(accessToken);
      const refreshTokenCifrado = cifrarSegredo(refreshToken);
      await prisma.armazenamentoConta.upsert({
        where: { usuarioId: uid(req) },
        update: { refreshTokenCifrado, contaNome, ultimoErro: null, conectadoEm: new Date() },
        create: { usuarioId: uid(req), refreshTokenCifrado, contaNome },
      });
      return reply.redirect('/armazenamento?conectado=1');
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, 'storage: falha ao concluir a autorização');
      return reply.redirect('/armazenamento?erro=autorizacao');
    }
  });

  app.post('/api/storage/onedrive/disconnect', async (req, reply) => {
    if (!origemOk(req)) return reply.status(403).send({ error: 'Origem não permitida.' });
    await prisma.armazenamentoConta.deleteMany({ where: { usuarioId: uid(req) } });
    esquecerAccessToken(uid(req));
    return { ok: true };
  });

  app.post('/api/storage/backup', async (req, reply) => {
    if (!origemOk(req)) return reply.status(403).send({ error: 'Origem não permitida.' });
    const faltando = variaveisFaltando();
    if (faltando.length > 0) return reply.status(503).send({ error: 'Armazenamento não configurado.', faltando });
    try {
      const r = await executarBackup(uid(req));
      return { id: r.id, nomeArquivo: r.nomeArquivo, tamanhoBytes: r.tamanhoBytes, status: r.status };
    } catch (e) {
      req.log.warn({ err: (e as Error).message }, 'storage: backup falhou');
      return reply.status(502).send({ error: (e as Error).message });
    }
  });
}
