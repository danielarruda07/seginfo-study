import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

const state = vi.hoisted(() => ({
  owner: 'u1', projeto: { id: 'p1', condicao: 'atencao', avanco: 70 },
  informes: [] as any[], eventos: [] as any[],
}));
vi.mock('./db.js', () => {
  const prisma = {
    linkedinProjeto: {
      findFirst: async ({ where }: any) => where.id === state.projeto.id && where.usuarioId === state.owner ? { id: state.projeto.id } : null,
      update: async ({ data }: any) => Object.assign(state.projeto, data),
    },
    linkedinProjetoInforme: {
      findFirst: async ({ where }: any) => where.id
        ? state.informes.find((i) => i.id === where.id && i.projetoId === where.projetoId && i.excluidoEm === null) ?? null
        : [...state.informes].filter((i) => i.projetoId === where.projetoId && i.excluidoEm === null)
          .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm))[0] ?? null,
      findMany: async ({ where }: any) => state.informes.filter((i) => i.projetoId === where.projetoId && i.excluidoEm === null),
      create: async ({ data }: any) => { const i = { id: `i${state.informes.length + 1}`, criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(), excluidoEm: null, ...data }; state.informes.push(i); return i; },
      update: async ({ where, data }: any) => { const i = state.informes.find((x) => x.id === where.id); Object.assign(i, data); return i; },
    },
    linkedinProjetoMarco: { findMany: async () => [] },
    linkedinProjetoEvento: { findMany: async () => state.eventos, create: async ({ data }: any) => { state.eventos.push({ id: `e${state.eventos.length + 1}`, ...data }); } },
    usuario: { findMany: async () => [{ id: 'u1', email: 'usuario@example.com' }] },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => fn(prisma),
  };
  return { prisma };
});
import { registerLinkedinProjetoAndamentoRoutes } from './linkedinProjetoAndamento.js';

async function app(usuarioId = 'u1') {
  const a = Fastify(); a.addHook('onRequest', async (req) => { (req as any).usuarioId = usuarioId; });
  await a.register(registerLinkedinProjetoAndamentoRoutes);
  return a;
}

beforeEach(() => { state.informes = []; state.eventos = []; state.projeto.condicao = 'sem_avaliacao'; state.projeto.avanco = 0; });

describe('andamento dos projetos LinkedIn', () => {
  it('recusa leitura e escrita de projeto de outro usuário', async () => {
    const a = await app('u2');
    expect((await a.inject('/api/linkedin/projetos/p1/andamento')).statusCode).toBe(404);
    expect((await a.inject({ method: 'POST', url: '/api/linkedin/projetos/p1/informes', payload: { data: '2026-11-16', condicao: 'atencao', avanco: 40, resumo: 'Teste' } })).statusCode).toBe(404);
    await a.close();
  });

  it('usa o informe ativo mais recente após edição e exclusão lógica', async () => {
    const a = await app();
    const criar = (data: string, condicao: string, avanco: number) => a.inject({ method: 'POST', url: '/api/linkedin/projetos/p1/informes', payload: { data, condicao, avanco, resumo: 'Entrega confirmada' } });
    expect((await criar('2026-11-10', 'no_caminho', 30)).statusCode).toBe(200);
    expect((await criar('2026-11-16', 'atencao', 70)).statusCode).toBe(200);
    expect(state.projeto).toMatchObject({ condicao: 'atencao', avanco: 70 });
    expect((await a.inject({ method: 'PATCH', url: '/api/linkedin/projetos/p1/informes/i2', payload: { avanco: 75 } })).statusCode).toBe(200);
    expect(state.projeto.avanco).toBe(75);
    expect((await a.inject({ method: 'DELETE', url: '/api/linkedin/projetos/p1/informes/i2' })).statusCode).toBe(200);
    expect(state.projeto).toMatchObject({ condicao: 'no_caminho', avanco: 30 });
    const lista = (await a.inject('/api/linkedin/projetos/p1/andamento')).json();
    expect(lista.informes.map((i: any) => i.id)).toEqual(['i1']);
    expect(state.informes).toHaveLength(2);
    expect(state.eventos.at(-1)).toMatchObject({ acao: 'excluir', autorId: 'u1' });
    await a.close();
  });
});
