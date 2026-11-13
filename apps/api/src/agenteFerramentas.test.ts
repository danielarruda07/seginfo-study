import { describe, expect, it, vi } from 'vitest';

/**
 * Testes do REGISTRO de ferramentas: resumo correto na tela de aprovação, validação de entrada,
 * e que cada ferramenta nova chama o cliente certo com os parâmetros certos. Rede real nunca é
 * usada: fortigate.js e catalyst.js são mockados, como proxmox.js já é no agenteRuntime.test.ts.
 */

const fortigate = vi.hoisted(() => ({ get: vi.fn(async () => ({ results: [] })), alterar: vi.fn(async () => ({ status: 'success' })) }));
const catalyst = vi.hoisted(() => ({ executar: vi.fn(async () => 'switch# ') }));

vi.mock('./fortigate.js', () => ({ fortigateGet: fortigate.get, fortigateAlterar: fortigate.alterar, fortigateFaltando: () => [] }));
vi.mock('./catalyst.js', () => ({ catalystExecutar: catalyst.executar, catalystFaltando: () => [] }));
vi.mock('./proxmox.js', () => ({ proxmoxGet: vi.fn(async () => []), proxmoxAlterar: vi.fn(async () => 'ok'), proxmoxFaltando: () => [] }));
vi.mock('./memorias.js', () => ({ buscarNaBase: async () => [] }));

const { REGISTRO } = await import('./agenteFerramentas.js');
const ctx = { usuarioId: 'u1', config: {} as never };
const porNome = (nome: string) => REGISTRO.find((f) => f.nome === nome)!;

describe('ferramentas do FortiGate', () => {
  it('fortigate_criar_policy valida a entrada e resume o que vai criar', () => {
    const f = porNome('fortigate_criar_policy');
    expect(f.permissao).toBe('escrita');
    const resumo = f.resumir({
      nome: 'RANGE-DENY-WAN', origemInterface: 'vlan80', destinoInterface: 'wan1',
      origemEndereco: 'RANGE-NET', destinoEndereco: 'all', servico: 'ALL', acao: 'deny',
    });
    expect(resumo).toContain('RANGE-DENY-WAN');
    expect(resumo).toContain('negar');
    expect(resumo).toContain('desativada para revisão');
  });

  it('fortigate_criar_policy rejeita entrada com aspas (poderia escapar o JSON)', () => {
    const f = porNome('fortigate_criar_policy');
    expect(() => f.resumir({
      nome: 'teste"malicioso', origemInterface: 'a', destinoInterface: 'b',
      origemEndereco: 'c', destinoEndereco: 'd', servico: 'e', acao: 'accept',
    })).toThrow(/Entrada inválida/);
  });

  it('fortigate_definir_status_policy chama o PUT certo', async () => {
    const f = porNome('fortigate_definir_status_policy');
    await f.rodar(ctx, { policyId: 42, ativar: false });
    expect(fortigate.alterar).toHaveBeenCalledWith('PUT', '/api/v2/cmdb/firewall/policy/42', { status: 'disable' });
  });

  it('ferramentas de leitura do FortiGate não exigem aprovação', () => {
    expect(porNome('fortigate_listar_policies').permissao).toBe('leitura');
    expect(porNome('fortigate_listar_interfaces').permissao).toBe('leitura');
  });
});

describe('ferramentas do Catalyst 2960', () => {
  it('catalyst_criar_vlan resume e envia os comandos IOS exatos, nunca texto livre do modelo', async () => {
    const f = porNome('catalyst_criar_vlan');
    expect(f.permissao).toBe('escrita');
    expect(f.resumir({ vlanId: 80, nome: 'RANGE' })).toContain('VLAN 80');
    await f.rodar(ctx, { vlanId: 80, nome: 'RANGE' });
    expect(catalyst.executar).toHaveBeenCalledWith(['configure terminal', 'vlan 80', 'name RANGE', 'exit', 'exit', 'show vlan brief']);
  });

  it('catalyst_adicionar_vlan_ao_trunk usa "add" para nunca substituir as VLANs já permitidas', async () => {
    const f = porNome('catalyst_adicionar_vlan_ao_trunk');
    await f.rodar(ctx, { interface: 'GigabitEthernet0/1', vlanId: 80 });
    expect(catalyst.executar).toHaveBeenCalledWith(expect.arrayContaining(['switchport trunk allowed vlan add 80']));
  });

  it('rejeita nome de interface com caracteres fora do padrão (não pode injetar outro comando)', () => {
    const f = porNome('catalyst_configurar_porta_access');
    expect(() => f.resumir({ interface: 'Gi0/1; reload', vlanId: 80 })).toThrow(/Entrada inválida/);
  });

  it('catalyst_configurar_span remove a sessão antiga antes de recriar', async () => {
    const f = porNome('catalyst_configurar_span');
    await f.rodar(ctx, { sessao: 1, vlanOrigem: 80, interfaceDestino: 'GigabitEthernet0/24' });
    const ultimaChamada = catalyst.executar.mock.calls.at(-1) as unknown as [string[]];
    const comandos = ultimaChamada[0];
    expect(comandos[0]).toBe('configure terminal');
    expect(comandos).toContain('no monitor session 1');
    expect(comandos).toContain('monitor session 1 source vlan 80');
  });

  it('ferramentas de leitura do Catalyst não exigem aprovação', () => {
    expect(porNome('catalyst_mostrar_vlans').permissao).toBe('leitura');
  });
});

describe('ferramentasDoId', () => {
  it('cada id novo do catálogo resolve para as ferramentas certas', async () => {
    const { ferramentasDoId } = await import('./agenteFerramentas.js');
    expect(ferramentasDoId('fortigate-leitura').map((f) => f.nome)).toContain('fortigate_listar_policies');
    expect(ferramentasDoId('fortigate-escrita').map((f) => f.nome)).toContain('fortigate_criar_policy');
    expect(ferramentasDoId('catalyst-leitura').map((f) => f.nome)).toContain('catalyst_mostrar_vlans');
    expect(ferramentasDoId('catalyst-escrita').map((f) => f.nome)).toContain('catalyst_criar_vlan');
  });
});
