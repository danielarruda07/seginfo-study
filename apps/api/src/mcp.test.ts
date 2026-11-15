import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';

/**
 * Servidor MCP do homelab e classificação leve/destrutiva das ferramentas.
 * Banco, modelo e Proxmox simulados; fora de produção a camada do Cloudflare Access não se aplica.
 */

const banco = vi.hoisted(() => ({ agentes: [] as Record<string, unknown>[], execucoes: [] as Record<string, unknown>[] }));
const proxmox = vi.hoisted(() => ({
  get: vi.fn(async (_c: string): Promise<unknown> => [{ node: 'pm01', status: 'online' }]),
  alterar: vi.fn(async () => 'Tarefa concluída com sucesso.'),
}));

vi.mock('./db.js', () => ({
  resolveUsuario: async (email: string) => ({ id: 'u1', email }),
  prisma: {
    agente: {
      findFirst: async ({ where }: { where: { nome: string } }) => banco.agentes.find((a) => a.nome === where.nome) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => { const a = { id: 'mcp1', ...data }; banco.agentes.push(a); return a; },
    },
    agenteExecucao: {
      create: async ({ data }: { data: Record<string, unknown> }) => { banco.execucoes.push(data); return data; },
      findMany: async () => [],
      count: async () => 0,
      updateMany: async () => ({ count: 0 }),
    },
  },
}));
vi.mock('./ia.js', () => ({ MODELO: 'modelo-de-teste', ErroIA: class extends Error {}, iaConfigurada: () => true, traduzirErro: (e: unknown) => { throw e; }, cliente: () => ({}) }));
vi.mock('./memorias.js', () => ({ buscarNaBase: async () => [] }));
vi.mock('./proxmox.js', () => ({
  proxmoxGet: proxmox.get, proxmoxAlterar: proxmox.alterar, proxmoxFaltando: () => [],
  proxmoxExecutarNoConvidado: async () => ({ codigo: 0, saida: 'ok', terminou: true }),
}));

const { registerMcpRoutes, definicaoMcp, ferramentasMcp } = await import('./mcp.js');
const { REGISTRO } = await import('./agenteFerramentas.js');
const { consultaDeAlertas } = await import('./wazuhIndexador.js');

const ferramenta = (nome: string) => REGISTRO.find((f) => f.nome === nome)!;
const VM = { no: 'pm01', tipo: 'qemu', vmid: 101 };

async function subir() {
  const app = Fastify();
  await registerMcpRoutes(app);
  return app;
}
const rpc = (app: Awaited<ReturnType<typeof subir>>, corpo: unknown, token = 'segredo-mcp') =>
  app.inject({ method: 'POST', url: '/api/mcp', headers: { authorization: `Bearer ${token}` }, payload: corpo as object });

beforeEach(() => {
  process.env.MCP_TOKEN = 'segredo-mcp';
  process.env.MCP_OWNER_EMAIL = 'dono@example.test';
  delete process.env.MCP_DESTRUTIVAS;
  banco.agentes.length = 0;
  banco.execucoes.length = 0;
  proxmox.get.mockClear();
  proxmox.alterar.mockClear();
});

describe('classificação leve x destrutiva', () => {
  it('depende dos parâmetros da chamada', () => {
    expect(ferramenta('proxmox_ligar_vm').ehLeve(VM)).toBe(true);
    expect(ferramenta('proxmox_desligar_vm').ehLeve(VM)).toBe(true);
    expect(ferramenta('proxmox_desligar_vm').ehLeve({ ...VM, forcar: true })).toBe(false);
    expect(ferramenta('proxmox_apagar_vm').ehLeve({ ...VM, nomeConfirmacao: 'x' })).toBe(false);
    expect(ferramenta('proxmox_reverter_snapshot').ehLeve({ ...VM, nome: 'antes' })).toBe(false);
    expect(ferramenta('proxmox_executar_no_convidado').ehLeve({ no: 'pm01', vmid: 101, comando: 'whoami' })).toBe(false);
    expect(ferramenta('coolify_acao_recurso').ehLeve({ tipo: 'aplicacao', uuid: 'abc12345', acao: 'restart' })).toBe(true);
    expect(ferramenta('coolify_acao_recurso').ehLeve({ tipo: 'aplicacao', uuid: 'abc12345', acao: 'stop' })).toBe(false);
  });

  it('entrada inválida nunca é leve', () => {
    expect(ferramenta('proxmox_ligar_vm').ehLeve({ no: '../x', tipo: 'qemu', vmid: 101 })).toBe(false);
  });

  it('as dicas MCP refletem leitura e risco', () => {
    expect(definicaoMcp(ferramenta('proxmox_listar_vms')).annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(definicaoMcp(ferramenta('proxmox_apagar_vm')).annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(definicaoMcp(ferramenta('proxmox_ligar_vm')).annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });

  it('a busca na base de um agente fica fora do MCP', () => {
    expect(ferramentasMcp().some((f) => f.nome === 'buscar_base')).toBe(false);
  });
});

describe('POST /api/mcp', () => {
  it('recusa sem o token MCP', async () => {
    const app = await subir();
    expect((await rpc(app, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'errado')).statusCode).toBe(401);
  });

  it('recusa quando o servidor não tem MCP_TOKEN (fail-closed)', async () => {
    delete process.env.MCP_TOKEN;
    const app = await subir();
    expect((await rpc(app, { jsonrpc: '2.0', id: 1, method: 'tools/list' })).statusCode).toBe(503);
  });

  it('negocia a versão, lista ferramentas e aceita notificação sem resposta', async () => {
    const app = await subir();
    const ini = (await rpc(app, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } })).json();
    expect(ini.result.protocolVersion).toBe('2025-06-18');
    expect(ini.result.capabilities.tools).toBeDefined();

    expect((await rpc(app, { jsonrpc: '2.0', method: 'notifications/initialized' })).statusCode).toBe(202);

    const lista = (await rpc(app, { jsonrpc: '2.0', id: 2, method: 'tools/list' })).json();
    const nomes = lista.result.tools.map((t: { name: string }) => t.name);
    expect(nomes).toContain('proxmox_listar_vms');
    expect(nomes).toContain('proxmox_consultar_convidado');
    expect(nomes).toContain('coolify_listar_recursos');
  });

  it('executa uma consulta e registra na auditoria do agente "Acesso MCP"', async () => {
    const app = await subir();
    const r = (await rpc(app, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'proxmox_listar_nos', arguments: {} } })).json();
    expect(r.result.isError).toBeUndefined();
    expect(r.result.content[0].text).toContain('pm01');
    expect(banco.agentes).toHaveLength(1);
    expect(banco.execucoes).toHaveLength(1);
    expect(banco.execucoes[0]).toMatchObject({ modelo: 'mcp', status: 'concluida', entrada: 'MCP: proxmox_listar_nos' });
  });

  it('escrita leve roda e fica como autônoma; destrutiva pode ser bloqueada por variável', async () => {
    const app = await subir();
    const leve = (await rpc(app, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'proxmox_ligar_vm', arguments: VM } })).json();
    expect(leve.result.isError).toBeUndefined();
    expect(proxmox.alterar).toHaveBeenCalledTimes(1);
    expect((banco.execucoes[0].passos as { decisao?: string }[])[0].decisao).toBe('autonoma');

    process.env.MCP_DESTRUTIVAS = 'bloquear';
    const forte = (await rpc(app, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'proxmox_desligar_vm', arguments: { ...VM, forcar: true } } })).json();
    expect(forte.result.isError).toBe(true);
    expect(forte.result.content[0].text).toContain('bloqueadas');
    expect(proxmox.alterar).toHaveBeenCalledTimes(1);
  });

  it('ferramenta desconhecida e entrada inválida voltam como erro da ferramenta', async () => {
    const app = await subir();
    const x = (await rpc(app, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nao_existe', arguments: {} } })).json();
    expect(x.result.isError).toBe(true);
    const y = (await rpc(app, { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'proxmox_ligar_vm', arguments: { no: 'pm01' } } })).json();
    expect(y.result.isError).toBe(true);
    expect(proxmox.alterar).not.toHaveBeenCalled();
  });
});

describe('busca de alertas do Wazuh', () => {
  it('monta a consulta só com filtros validados', () => {
    const q = consultaDeAlertas({ horas: 6, nivelMinimo: 10, agente: 'range-hp-linux', limite: 5 }) as {
      size: number; query: { bool: { filter: unknown[]; must: unknown[] } };
    };
    expect(q.size).toBe(5);
    expect(q.query.bool.filter).toEqual([
      { range: { timestamp: { gte: 'now-6h' } } },
      { range: { 'rule.level': { gte: 10 } } },
      { term: { 'agent.name': 'range-hp-linux' } },
    ]);
    expect(q.query.bool.must).toEqual([]);
  });
});
