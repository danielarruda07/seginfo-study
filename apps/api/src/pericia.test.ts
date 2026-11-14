import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const db = vi.hoisted(() => ({ pericias: [] as Record<string, any>[] }));
vi.mock('./db.js', () => ({
  prisma: {
    pericia: {
      upsert: async ({ where, update, create }: any) => {
        const k = where.usuarioId_alvo_janelaFim;
        const i = db.pericias.findIndex((p) => p.alvo === k.alvo && +p.janelaFim === +k.janelaFim);
        if (i >= 0) { db.pericias[i] = { ...db.pericias[i], ...update }; return { id: db.pericias[i].id }; }
        const p = { id: `p${db.pericias.length + 1}`, ...create };
        db.pericias.push(p);
        return { id: p.id };
      },
    },
  },
  resolveUsuario: async (email: string) => ({ id: 'u1', email }),
}));

import { registerIngestRoutes } from './ingest.js';
import { resumirPericia } from './pericia.js';
import { PericiaInSchema } from '@seginfo/shared';

process.env.INGEST_TOKEN = 'token-de-teste';
process.env.INGEST_OWNER_EMAIL = 'dono@exemplo.com';

const SHA = 'a'.repeat(64);
const LAUDO = {
  alvo: 'alvo-linux', vmid: 821, sistema: 'linux', sensor: 'sensor-ssh',
  janelaInicio: '2026-11-14T03:00:00Z', janelaFim: '2026-11-14T09:00:00Z',
  arquivos: [
    { caminho: '/root/.16', tamanho: 2_100_000, sha256: SHA, tipo: 'elf', executavel: true },
    { caminho: '/var/log/auth.log', tamanho: 9000, tipo: 'outro', executavel: false },
  ],
  persistencia: [{ tipo: 'cron', onde: '/var/spool/cron/crontabs/root', conteudo: '* * * * * /root/.16' }],
  saidas: [
    { destino: '198.51.100.9', porta: 80, protocolo: 'tcp', tentativas: 12, primeira: '2026-11-14T04:00:00Z', ultima: '2026-11-14T05:00:00Z' },
    { destino: '198.51.100.9', porta: 3333, protocolo: 'tcp', tentativas: 3, primeira: '2026-11-14T04:00:00Z', ultima: '2026-11-14T05:00:00Z' },
  ],
  amostras: [{ sha256: SHA, caminho: '/root/.16', tamanho: 2_100_000, guardada: true }],
};

async function app() {
  const a = Fastify();
  await a.register(registerIngestRoutes);
  return a;
}

describe('laudo dos alvos reais', () => {
  beforeEach(() => { db.pericias.length = 0; });

  it('resume contagens do laudo', () => {
    const r = resumirPericia(PericiaInSchema.parse(LAUDO));
    expect(r).toMatchObject({ arquivos: 2, executaveis: 1, persistencia: 1, saidasBloqueadas: 15, destinos: 1, amostras: 1, erros: 0 });
  });

  it('exige o token do coletor', async () => {
    const a = await app();
    const r = await a.inject({ method: 'POST', url: '/api/ingest/pericia', payload: LAUDO });
    expect(r.statusCode).toBe(401);
    expect(db.pericias).toHaveLength(0);
  });

  it('grava, e o reenvio da mesma janela substitui em vez de duplicar', async () => {
    const a = await app();
    const h = { 'x-ingest-token': 'token-de-teste' };
    expect((await a.inject({ method: 'POST', url: '/api/ingest/pericia', headers: h, payload: LAUDO })).statusCode).toBe(200);
    const r = await a.inject({ method: 'POST', url: '/api/ingest/pericia', headers: h, payload: { ...LAUDO, persistencia: [] } });
    expect(r.json().ok).toBe(true);
    expect(db.pericias).toHaveLength(1);
    expect(db.pericias[0].resumo.persistencia).toBe(0);
  });

  it('recusa laudo malformado (hash inválido, sistema desconhecido)', async () => {
    const a = await app();
    const h = { 'x-ingest-token': 'token-de-teste' };
    expect((await a.inject({ method: 'POST', url: '/api/ingest/pericia', headers: h, payload: { ...LAUDO, sistema: 'mac' } })).statusCode).toBe(400);
    expect((await a.inject({ method: 'POST', url: '/api/ingest/pericia', headers: h,
      payload: { ...LAUDO, amostras: [{ sha256: 'xyz', caminho: '/x', tamanho: 1, guardada: true }] } })).statusCode).toBe(400);
    expect(db.pericias).toHaveLength(0);
  });
});
