import { describe, expect, it, vi } from 'vitest';

/**
 * Testes do REGISTRO de ferramentas: resumo correto na tela de aprovação, validação de entrada,
 * e que cada ferramenta nova chama o cliente certo com os parâmetros certos. Rede real nunca é
 * usada: fortigate.js e catalyst.js são mockados, como proxmox.js já é no agenteRuntime.test.ts.
 */

const fortigate = vi.hoisted(() => ({ get: vi.fn(async () => ({ results: [] })), alterar: vi.fn(async () => ({ status: 'success' })) }));
const catalyst = vi.hoisted(() => ({ executar: vi.fn(async () => 'switch# ') }));
const proxmox = vi.hoisted(() => ({ get: vi.fn(async (_c: string): Promise<unknown> => []), alterar: vi.fn(async (..._a: unknown[]) => 'ok') }));

vi.mock('./fortigate.js', () => ({ fortigateGet: fortigate.get, fortigateAlterar: fortigate.alterar, fortigateFaltando: () => [] }));
vi.mock('./catalyst.js', () => ({ catalystExecutar: catalyst.executar, catalystFaltando: () => [] }));
vi.mock('./proxmox.js', () => ({ proxmoxGet: proxmox.get, proxmoxAlterar: proxmox.alterar, proxmoxFaltando: () => [] }));
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

describe('ferramentas do Proxmox: criar, clonar e apagar VM', () => {
  const criar = { no: 'pm03', vmid: 905, nome: 'lab-debian', memoriaMb: 2048, cores: 2, discoGb: 32, armazenamento: 'drbdstorage', bridge: 'vmbr0', vlan: 80, iso: 'nas:iso/debian-12.iso', sistema: 'linux' };

  it('proxmox_criar_vm resume tudo o que vai criar e monta os parâmetros da API só com a entrada validada', async () => {
    const f = porNome('proxmox_criar_vm');
    expect(f.permissao).toBe('escrita');
    const resumo = f.resumir(criar);
    expect(resumo).toContain('VM 905 "lab-debian" no nó pm03');
    expect(resumo).toContain('VLAN 80');
    await f.rodar(ctx, criar);
    expect(proxmox.alterar).toHaveBeenLastCalledWith('POST', 'pm03', '/nodes/pm03/qemu', expect.objectContaining({
      vmid: 905, name: 'lab-debian', memory: 2048, cores: 2, ostype: 'l26', scsi0: 'drbdstorage:32',
      net0: 'virtio,bridge=vmbr0,tag=80', ide2: 'nas:iso/debian-12.iso,media=cdrom', tags: 'criada-por-agente',
    }), 180);
  });

  it('proxmox_criar_vm recusa valores que poderiam virar outra opção da VM', () => {
    const f = porNome('proxmox_criar_vm');
    expect(() => f.resumir({ ...criar, bridge: 'vmbr0,firewall=0' })).toThrow(/Entrada inválida/);
    expect(() => f.resumir({ ...criar, armazenamento: 'drbd:1,cache=unsafe' })).toThrow(/Entrada inválida/);
    expect(() => f.resumir({ ...criar, iso: '../../etc/passwd' })).toThrow(/Entrada inválida/);
    expect(() => f.resumir({ ...criar, nome: 'nome com espaço' })).toThrow(/Entrada inválida/);
  });

  it('proxmox_clonar_vm faz cópia completa por padrão e espera até 5 minutos', async () => {
    const f = porNome('proxmox_clonar_vm');
    expect(f.resumir({ no: 'pm01', vmid: 9000, novoVmid: 906, nome: 'clone-a' })).toContain('cópia completa');
    await f.rodar(ctx, { no: 'pm01', vmid: 9000, novoVmid: 906, nome: 'clone-a', noDestino: 'pm03', armazenamento: 'drbdstorage' });
    expect(proxmox.alterar).toHaveBeenLastCalledWith('POST', 'pm01', '/nodes/pm01/qemu/9000/clone',
      { newid: 906, name: 'clone-a', full: 1, storage: 'drbdstorage', target: 'pm03' }, 300);
    expect(() => f.resumir({ no: 'pm01', vmid: 906, novoVmid: 906, nome: 'x' })).toThrow(/Entrada inválida/);
  });

  describe('proxmox_apagar_vm', () => {
    const pedido = { no: 'pm02', tipo: 'qemu', vmid: 905, nomeConfirmacao: 'lab-debian' };
    const estado = (config: Record<string, unknown>, status: string) => {
      proxmox.get.mockImplementation(async (c: string) => (c.endsWith('/config') ? config : { status }));
    };

    it('o resumo deixa claro que é definitivo', () => {
      expect(porNome('proxmox_apagar_vm').resumir(pedido)).toMatch(/APAGAR DEFINITIVAMENTE VM 905 .*"lab-debian"/);
    });

    it('apaga com purge quando tudo confere', async () => {
      estado({ name: 'lab-debian' }, 'stopped');
      await porNome('proxmox_apagar_vm').rodar(ctx, pedido);
      expect(proxmox.alterar).toHaveBeenLastCalledWith('DELETE', 'pm02', '/nodes/pm02/qemu/905?purge=1&destroy-unreferenced-disks=1', {}, 180);
    });

    it('recusa se o nome não confere, se está ligada ou com proteção', async () => {
      const f = porNome('proxmox_apagar_vm');
      proxmox.alterar.mockClear();
      estado({ name: 'outra-vm' }, 'stopped');
      await expect(f.rodar(ctx, pedido)).rejects.toThrow(/não confere/);
      estado({ name: 'lab-debian' }, 'running');
      await expect(f.rodar(ctx, pedido)).rejects.toThrow(/Desligue antes/);
      estado({ name: 'lab-debian', protection: 1 }, 'stopped');
      await expect(f.rodar(ctx, pedido)).rejects.toThrow(/proteção ligada/);
      expect(proxmox.alterar).not.toHaveBeenCalled();
    });

    it('recusa VMID da lista PROXMOX_VMS_PROTEGIDAS sem nem consultar o Proxmox', async () => {
      process.env.PROXMOX_VMS_PROTEGIDAS = '100, 905';
      proxmox.get.mockClear();
      try {
        await expect(porNome('proxmox_apagar_vm').rodar(ctx, pedido)).rejects.toThrow(/PROXMOX_VMS_PROTEGIDAS/);
        expect(proxmox.get).not.toHaveBeenCalled();
      } finally {
        delete process.env.PROXMOX_VMS_PROTEGIDAS;
      }
    });
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
