import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { agenteConfigVazio } from '@seginfo/shared';

/**
 * Fluxo de aprovação de ponta a ponta, com o banco, o modelo e o Proxmox simulados.
 * O que precisa valer sempre: ferramenta de escrita nunca roda antes da decisão, roda uma única
 * vez com os parâmetros guardados no servidor, e ação negada não roda.
 */

// ---------- simulações ----------

type Linha = Record<string, unknown> & { id: string };
const banco = vi.hoisted(() => ({ agente: null as Record<string, unknown> | null, execucoes: [] as Linha[] }));
const respostasDoModelo = vi.hoisted(() => [] as unknown[]);
const proxmox = vi.hoisted(() => ({ alterar: vi.fn(async () => 'Tarefa concluída com sucesso.'), get: vi.fn(async () => []) }));

vi.mock('./db.js', () => {
  const casaValor = (valor: unknown, cond: unknown): boolean => {
    if (cond && typeof cond === 'object' && 'gte' in (cond as Record<string, unknown>)) {
      const limite = (cond as { gte: Date }).gte;
      return valor instanceof Date ? valor >= limite : new Date(valor as string) >= limite;
    }
    return valor === cond;
  };
  const casa = (l: Linha, where: Record<string, unknown>): boolean => Object.entries(where).every(([k, v]) =>
    (k === 'NOT' ? !casa(l, v as Record<string, unknown>) : casaValor(l[k], v)));
  return {
    prisma: {
      agente: { findFirst: async () => banco.agente },
      agenteExecucao: {
        count: async ({ where }: { where: Record<string, unknown> }) => banco.execucoes.filter((l) => casa(l, where)).length,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const l = { id: `exec${banco.execucoes.filter((x) => x.id.startsWith('exec')).length + 1}`, status: 'rodando', passos: [], pendencia: null, resposta: '', erro: '', tokensEntrada: 0, tokensSaida: 0, duracaoMs: 0, ...structuredClone(data) };
          banco.execucoes.push(l);
          return l;
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const l = banco.execucoes.find((x) => x.id === where.id) as Linha;
          Object.assign(l, structuredClone(data));
          return l;
        },
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          const alvo = banco.execucoes.filter((l) => casa(l, where));
          for (const l of alvo) Object.assign(l, { ...data, ...('pendencia' in data ? { pendencia: null } : {}) });
          return { count: alvo.length };
        },
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          const l = banco.execucoes.find((x) => casa(x, where));
          return l ? structuredClone(l) : null;
        },
        findMany: async () => banco.execucoes,
      },
    },
  };
});

vi.mock('./ia.js', () => {
  class ErroIA extends Error {}
  return {
    MODELO: 'modelo-de-teste',
    ErroIA,
    iaConfigurada: () => true,
    traduzirErro: (e: unknown) => { throw e; },
    cliente: () => ({ beta: { messages: { create: async () => {
      const r = respostasDoModelo.shift();
      if (!r) throw new Error('o teste não previu esta chamada ao modelo');
      return r;
    } } } }),
  };
});
vi.mock('./memorias.js', () => ({ buscarNaBase: async () => [] }));
vi.mock('./proxmox.js', () => ({ proxmoxAlterar: proxmox.alterar, proxmoxGet: proxmox.get, proxmoxFaltando: () => [] }));

const { registerExecucaoRoutes } = await import('./agenteRuntime.js');

// ---------- apoio ----------

const uso = { input_tokens: 10, output_tokens: 5 };
const pedeFerramentas = (...usos: { id: string; name: string; input: unknown }[]) => ({
  stop_reason: 'tool_use', usage: uso, content: usos.map((u) => ({ type: 'tool_use', ...u })),
});
const terminaCom = (texto: string) => ({ stop_reason: 'end_turn', usage: uso, content: [{ type: 'text', text: texto }] });
const VM = { no: 'pm01', tipo: 'qemu', vmid: 101 };

async function subir() {
  const app = Fastify();
  app.addHook('preHandler', async (req) => { (req as unknown as { usuarioId: string }).usuarioId = 'u1'; });
  await registerExecucaoRoutes(app);
  return app;
}
const exec = () => banco.execucoes.find((l) => l.id.startsWith('exec'))!;
/** espera o laço em segundo plano chegar a um estado de parada */
async function assentar() {
  await vi.waitFor(() => expect(exec().status).not.toBe('rodando'));
}

beforeEach(() => {
  const config = agenteConfigVazio();
  config.instrucoes.instrucoes = 'opere o proxmox';
  config.ferramentas = [
    { id: 'proxmox-leitura', nome: 'leitura', permissao: 'leitura', exigeAprovacao: false, observacao: '' },
    { id: 'proxmox-escrita', nome: 'escrita', permissao: 'escrita', exigeAprovacao: true, observacao: '' },
  ];
  banco.agente = { id: 'a1', usuarioId: 'u1', nome: 'Operador', status: 'rascunho', config };
  banco.execucoes.length = 0;
  respostasDoModelo.length = 0;
  proxmox.alterar.mockClear();
  proxmox.get.mockClear();
});

// ---------- testes ----------

describe('aprovação de ferramentas de escrita', () => {
  it('pausa antes de executar, executa uma vez depois de aprovado e retoma o laço', async () => {
    const app = await subir();
    respostasDoModelo.push(pedeFerramentas({ id: 't1', name: 'proxmox_ligar_vm', input: VM }));
    const r = await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'ligue a 101' } });
    expect(r.statusCode).toBe(202);
    await assentar();

    expect(exec().status).toBe('aguardando_aprovacao');
    expect(proxmox.alterar).not.toHaveBeenCalled();
    const visto = (await app.inject({ method: 'GET', url: '/api/agentes/a1/execucoes/exec1' })).json();
    expect(visto.pendentes).toEqual([{ id: 't1', nome: 'proxmox_ligar_vm', entrada: VM, resumo: 'Ligar: VM 101 no nó pm01' }]);

    respostasDoModelo.push(terminaCom('VM ligada.'));
    const d = await app.inject({ method: 'POST', url: '/api/agentes/a1/execucoes/exec1/decidir', payload: { decisoes: [{ id: 't1', aprovar: true }] } });
    expect(d.statusCode).toBe(202);
    await assentar();

    expect(proxmox.alterar).toHaveBeenCalledTimes(1);
    expect(proxmox.alterar).toHaveBeenCalledWith('POST', 'pm01', '/nodes/pm01/qemu/101/status/start');
    expect(exec().status).toBe('concluida');
    expect(exec().resposta).toBe('VM ligada.');
    expect(exec().pendencia).toBeNull();
    const passo = (exec().passos as { tipo: string; decisao?: string }[]).find((p) => p.tipo === 'ferramenta');
    expect(passo?.decisao).toBe('aprovada');

    // decidir de novo não executa de novo
    const repetida = await app.inject({ method: 'POST', url: '/api/agentes/a1/execucoes/exec1/decidir', payload: { decisoes: [{ id: 't1', aprovar: true }] } });
    expect(repetida.statusCode).toBe(409);
    expect(proxmox.alterar).toHaveBeenCalledTimes(1);
  });

  it('ação negada não é executada e o modelo é avisado', async () => {
    const app = await subir();
    respostasDoModelo.push(pedeFerramentas({ id: 't1', name: 'proxmox_desligar_vm', input: { ...VM, forcar: true } }));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'desligue' } });
    await assentar();
    expect((await app.inject({ method: 'GET', url: '/api/agentes/a1/execucoes/exec1' })).json().pendentes[0].resumo).toContain('À FORÇA');

    respostasDoModelo.push(terminaCom('Não desliguei.'));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/execucoes/exec1/decidir', payload: { decisoes: [{ id: 't1', aprovar: false }] } });
    await assentar();

    expect(proxmox.alterar).not.toHaveBeenCalled();
    expect(exec().status).toBe('concluida');
    const mensagens = exec().mensagens as { role: string; content: { type: string; is_error?: boolean; content?: string }[] }[];
    const resultado = mensagens[mensagens.length - 2].content[0];
    expect(resultado).toMatchObject({ type: 'tool_result', is_error: true });
    expect(resultado.content).toContain('negou');
  });

  it('no mesmo turno: leitura roda na hora, escrita espera, e a decisão precisa cobrir todas as ações', async () => {
    const app = await subir();
    respostasDoModelo.push(pedeFerramentas(
      { id: 'l1', name: 'proxmox_listar_vms', input: {} },
      { id: 'e1', name: 'proxmox_criar_snapshot', input: { ...VM, nome: 'antes' } },
      { id: 'e2', name: 'proxmox_reiniciar_vm', input: VM },
    ));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'snapshot e reinicie' } });
    await assentar();
    expect(proxmox.get).toHaveBeenCalledTimes(1);
    expect(proxmox.alterar).not.toHaveBeenCalled();

    // decisão incompleta, com id inventado ou repetido: recusada, nada roda
    for (const decisoes of [[{ id: 'e1', aprovar: true }], [{ id: 'e1', aprovar: true }, { id: 'x', aprovar: true }], [{ id: 'e1', aprovar: true }, { id: 'e1', aprovar: true }]]) {
      const r = await app.inject({ method: 'POST', url: '/api/agentes/a1/execucoes/exec1/decidir', payload: { decisoes } });
      expect(r.statusCode).toBe(400);
    }
    expect(proxmox.alterar).not.toHaveBeenCalled();
    expect(exec().status).toBe('aguardando_aprovacao');

    respostasDoModelo.push(terminaCom('Snapshot criado; reinício negado.'));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/execucoes/exec1/decidir', payload: { decisoes: [{ id: 'e1', aprovar: true }, { id: 'e2', aprovar: false }] } });
    await assentar();

    expect(proxmox.alterar).toHaveBeenCalledTimes(1);
    expect(proxmox.alterar).toHaveBeenCalledWith('POST', 'pm01', '/nodes/pm01/qemu/101/snapshot', { snapname: 'antes' });
    // os três resultados voltam juntos e na ordem em que o modelo pediu
    const mensagens = exec().mensagens as { role: string; content: { tool_use_id?: string }[] }[];
    expect(mensagens[mensagens.length - 2].content.map((c) => c.tool_use_id)).toEqual(['l1', 'e1', 'e2']);
  });

  it('entrada inválida numa ferramenta de escrita vira erro, sem pedir aprovação', async () => {
    const app = await subir();
    respostasDoModelo.push(
      pedeFerramentas({ id: 't1', name: 'proxmox_ligar_vm', input: { no: '../../access', tipo: 'qemu', vmid: 101 } }),
      terminaCom('Parâmetro inválido.'),
    );
    await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'ligue' } });
    await assentar();
    expect(exec().status).toBe('concluida');
    expect(proxmox.alterar).not.toHaveBeenCalled();
  });

  it('bloqueia nova execução ao atingir o teto diário de custo (não conta continuação de conversa)', async () => {
    const app = await subir();
    // Pré-popula o banco com execuções "de hoje" até o teto, para não precisar rodar o laço 60 vezes.
    const LIMITE = 60; // valor padrão de LIMITES.execucoesPorDia quando a env var não está definida
    for (let i = 0; i < LIMITE; i++) banco.execucoes.push({ id: `antiga${i}`, usuarioId: 'u1', agenteId: 'a1', status: 'concluida', passos: [], pendencia: null, criadoEm: new Date() } as unknown as Linha);

    const r = await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'mais uma' } });
    expect(r.statusCode).toBe(429);
    expect(r.json().error).toContain('Limite diário');
  });

  it('bloqueia aprovação ao atingir o teto diário de escritas aprovadas', async () => {
    const app = await subir();
    const LIMITE_ESCRITAS = 30; // valor padrão de LIMITES.escritasAprovadasPorDia
    const decididoEm = new Date().toISOString();
    const passosAntigos = Array.from({ length: LIMITE_ESCRITAS }, (_, i) => ({ tipo: 'ferramenta', nome: 'x', entrada: {}, saida: 'ok', erro: false, ms: 1, decisao: 'aprovada', decididoEm }));
    banco.execucoes.push({ id: 'velha1', usuarioId: 'u1', agenteId: 'a1', status: 'concluida', passos: passosAntigos, pendencia: null, criadoEm: new Date(), atualizadoEm: new Date() } as unknown as Linha);

    respostasDoModelo.push(pedeFerramentas({ id: 't1', name: 'proxmox_ligar_vm', input: VM }));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'ligue a 101' } });
    await assentar();
    expect(exec().status).toBe('aguardando_aprovacao');

    const d = await app.inject({ method: 'POST', url: '/api/agentes/a1/execucoes/exec1/decidir', payload: { decisoes: [{ id: 't1', aprovar: true }] } });
    expect(d.statusCode).toBe(429);
    expect(d.json().error).toContain('escrita aprovadas');
    expect(proxmox.alterar).not.toHaveBeenCalled();
    // ainda aguardando: a tentativa bloqueada não consumiu a pendência
    expect(exec().status).toBe('aguardando_aprovacao');
  });

  it('agente sem a escrita ligada não recebe as ferramentas de escrita', async () => {
    const app = await subir();
    const config = (banco.agente as { config: ReturnType<typeof agenteConfigVazio> }).config;
    config.ferramentas = config.ferramentas.map((f) => ({ ...f, permissao: 'leitura' as const }));
    respostasDoModelo.push(pedeFerramentas({ id: 't1', name: 'proxmox_ligar_vm', input: VM }), terminaCom('Não tenho essa ferramenta.'));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'ligue' } });
    await assentar();
    expect(exec().status).toBe('concluida');
    expect(proxmox.alterar).not.toHaveBeenCalled();
    const passo = (exec().passos as { tipo: string; erro?: boolean; saida?: string }[]).find((p) => p.tipo === 'ferramenta');
    expect(passo).toMatchObject({ erro: true });
    expect(passo?.saida).toContain('não está ligada');
  });
});

describe('modo autônomo (leves-automaticas)', () => {
  const autonomo = () => {
    const config = (banco.agente as { config: ReturnType<typeof agenteConfigVazio> }).config;
    config.supervisao.autonomia = 'leves-automaticas';
  };

  it('ação leve roda sem parar e fica marcada como autônoma', async () => {
    autonomo();
    const app = await subir();
    respostasDoModelo.push(pedeFerramentas({ id: 't1', name: 'proxmox_ligar_vm', input: VM }), terminaCom('VM ligada.'));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'ligue a 101' } });
    await assentar();
    expect(exec().status).toBe('concluida');
    expect(proxmox.alterar).toHaveBeenCalledWith('POST', 'pm01', '/nodes/pm01/qemu/101/status/start');
    const passo = (exec().passos as { tipo: string; decisao?: string; decididoEm?: string }[]).find((p) => p.tipo === 'ferramenta');
    expect(passo?.decisao).toBe('autonoma');
    expect(passo?.decididoEm).toBeTruthy();
  });

  it('ação destrutiva continua pedindo aprovação, mesmo no modo autônomo', async () => {
    autonomo();
    const app = await subir();
    respostasDoModelo.push(pedeFerramentas(
      { id: 't1', name: 'proxmox_desligar_vm', input: { ...VM, forcar: true } },
      { id: 't2', name: 'proxmox_reiniciar_vm', input: VM },
    ));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'desligue à força e reinicie' } });
    await assentar();
    expect(exec().status).toBe('aguardando_aprovacao');
    // a leve do mesmo turno já rodou; só a destrutiva espera
    expect(proxmox.alterar).toHaveBeenCalledTimes(1);
    expect(proxmox.alterar).toHaveBeenCalledWith('POST', 'pm01', '/nodes/pm01/qemu/101/status/reboot');
    const visto = (await app.inject({ method: 'GET', url: '/api/agentes/a1/execucoes/exec1' })).json();
    expect(visto.pendentes.map((x: { id: string }) => x.id)).toEqual(['t1']);
  });

  it('sem folga no teto diário de escritas, a ação leve volta a pedir aprovação', async () => {
    autonomo();
    const decididoEm = new Date().toISOString();
    const passos = Array.from({ length: 30 }, () => ({ tipo: 'ferramenta', nome: 'x', entrada: {}, saida: 'ok', erro: false, ms: 1, decisao: 'autonoma', decididoEm }));
    banco.execucoes.push({ id: 'velha1', usuarioId: 'u1', agenteId: 'a1', status: 'concluida', passos, pendencia: null, criadoEm: new Date(), atualizadoEm: new Date() } as unknown as Linha);
    const app = await subir();
    respostasDoModelo.push(pedeFerramentas({ id: 't1', name: 'proxmox_ligar_vm', input: VM }));
    await app.inject({ method: 'POST', url: '/api/agentes/a1/executar', payload: { mensagem: 'ligue a 101' } });
    await assentar();
    expect(exec().status).toBe('aguardando_aprovacao');
    expect(proxmox.alterar).not.toHaveBeenCalled();
  });
});
