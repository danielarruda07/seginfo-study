import { describe, expect, it, vi } from 'vitest';

vi.mock('./proxmox.js', () => ({ proxmoxGet: vi.fn(), proxmoxFaltando: () => [] }));
vi.mock('./fortigate.js', () => ({ fortigateGet: vi.fn(), fortigateFaltando: () => [] }));
vi.mock('./catalyst.js', () => ({ catalystExecutar: vi.fn(), catalystFaltando: () => [] }));

const { montarAtivos, lerSaidaSwitch } = await import('./descoberta.js');
type Coleta = Parameters<typeof montarAtivos>[0];

// Dados fictícios: endereços de documentação (192.0.2.0/24, 198.51.100.0/24) e MACs inventados.
const coleta: Coleta = {
  proxmox: {
    versao: '9.2',
    nos: [
      { no: 'pm01', status: 'online', cpus: 8, memoriaBytes: 16 * 1024 ** 3, ip: '192.0.2.11' },
      { no: 'pm03', status: 'offline', cpus: 4, memoriaBytes: 8 * 1024 ** 3, ip: '192.0.2.13' },
    ],
    storages: [
      { storage: 'nas-a', no: 'pm01', tipo: 'nfs', compartilhado: true, status: 'available', total: 100 * 1024 ** 3, usado: 40 * 1024 ** 3, conteudo: 'images,iso' },
      { storage: 'nas-a', no: 'pm03', tipo: 'nfs', compartilhado: true, status: 'unknown', total: 0, usado: 0, conteudo: 'images,iso' },
      { storage: 'local', no: 'pm01', tipo: 'dir', compartilhado: false, status: 'available', total: 1, usado: 0, conteudo: 'iso' },
    ],
    vms: [
      { vmid: 100, nome: 'app', no: 'pm01', tipo: 'qemu', status: 'running', modelo: false, cpus: 4, memoriaBytes: 4 * 1024 ** 3, pool: '', redes: ['virtio=BC:24:11:00:00:01,bridge=vmbr0'], ostype: 'l26', tags: ['producao'], ipsAgente: ['192.0.2.99'] },
      { vmid: 801, nome: 'kali', no: 'pm01', tipo: 'qemu', status: 'stopped', modelo: false, cpus: 2, memoriaBytes: 2 * 1024 ** 3, pool: 'RANGE', redes: ['virtio=BC:24:11:00:00:02,bridge=vmbr0,tag=81'], ostype: 'l26', tags: ['range'], ipsAgente: [] },
    ],
  },
  fortigate: {
    leases: [
      { mac: '00:11:22:33:44:01', ip: '198.51.100.20', hostname: 'MEUPC', interface: 'lan', vci: 'MSFT 5.0', reserved: false },
      { mac: '9a:11:22:33:44:02', ip: '198.51.100.21', hostname: '', interface: 'lan', vci: 'android-dhcp-14' },
      { mac: '00:aa:bb:cc:dd:01', ip: '192.0.2.111', hostname: 'ILO', interface: 'vlan10', vci: 'CPQRIB3' },
      { mac: '00:aa:bb:cc:dd:02', ip: '198.51.100.30', hostname: 'srv-hp', interface: 'lan', vci: '' },
      { mac: '00:de:ad:be:ef:01', ip: '198.51.100.40', hostname: '', interface: 'lan', vci: 'udhcp 1.30' },
    ],
    arp: [
      { mac: 'bc:24:11:00:00:02', ip: '192.0.2.81', interface: 'vlan81' },
      { mac: 'e0:23:ff:00:00:01', ip: '192.0.2.1', interface: 'vlan10' },
      { mac: '00:30:48:00:00:11', ip: '192.0.2.11', interface: 'vlan10' },
      { mac: '00:77:88:99:aa:01', ip: '192.0.2.254', interface: 'vlan10' },
      { mac: '00:77:88:99:aa:55', ip: '', interface: 'vlan70' },
      { mac: '00:55:66:77:88:01', ip: '203.0.113.1', interface: 'wan' },
    ],
    dispositivos: [{ mac: '00:11:22:33:44:01', hardware_vendor: 'Dell', os_name: 'Windows', os_version: '11', is_online: true }],
    macsProprios: [],
  },
  switch: {
    hostIp: '192.0.2.254',
    macs: [
      { vlan: '30', mac: '001122334401', porta: 'Fa0/5' },
      { vlan: '10', mac: '001122334401', porta: 'Gi0/1' },
      { vlan: '81', mac: 'bc2411000002', porta: 'Gi0/1' },
    ],
    descricoes: { 'Fa0/5': 'MEUPC' },
    trunks: ['Gi0/1'],
  },
};

describe('montarAtivos', () => {
  const ativos = montarAtivos(coleta, '2026-11-14');
  const porId = (id: string) => ativos.find((a) => a.id === id);

  it('cria os nós do Proxmox com os mesmos ids dos scripts e marca nó fora do ar', () => {
    expect(porId('lab-pm01')).toMatchObject({ tipo: 'host', endereco: '192.0.2.11', estado: 'ativo', nome: 'pm01 (Proxmox VE 9.2)' });
    expect(porId('lab-pm03')?.estado).toBe('atencao');
  });

  it('storage compartilhado vira um ativo só e aponta em qual nó está indisponível; storage local fica de fora', () => {
    const s = porId('lab-stg-nas-a')!;
    expect(s.estado).toBe('atencao');
    expect(s.detalhes['indisponível em']).toBe('pm03');
    expect(s.detalhes['nós']).toBe('pm01, pm03');
    expect(porId('lab-stg-local')).toBeUndefined();
  });

  it('VM usa o IP do agente QEMU; sem agente, o do ARP; parada fica desativada', () => {
    expect(porId('lab-vm-100')).toMatchObject({ tipo: 'vm', endereco: '192.0.2.99', estado: 'ativo' });
    expect(porId('lab-vm-100')?.tags).toContain('producao');
    const kali = porId('lab-vm-801')!;
    expect(kali).toMatchObject({ endereco: '192.0.2.81', estado: 'desativado' });
    expect(kali.detalhes.vlan).toBe('81');
    expect(kali.detalhes['IP obtido de']).toBe('ARP do FortiGate');
    expect(kali.detalhes['porta do switch']).toBeUndefined(); // só foi vista no trunk
  });

  it('classifica estação, celular com MAC aleatório, servidor com iLO e equipamento embarcado', () => {
    const pc = porId('lab-est-meupc')!;
    expect(pc).toMatchObject({ tipo: 'estacao', endereco: '198.51.100.20' });
    expect(pc.detalhes['porta do switch']).toBe('Fa0/5 (VLAN 30) · MEUPC');
    expect(pc.detalhes.sistema).toBe('Windows 11');

    const cel = ativos.find((a) => a.tipo === 'dispositivo' && a.nome === 'Android sem nome')!;
    expect(cel.detalhes.observacao).toMatch(/MAC aleatório/);

    const srv = porId('lab-srv-hp-ilo')!;
    expect(srv).toMatchObject({ tipo: 'servidor', endereco: '192.0.2.111' });
    expect(srv.detalhes['outras placas']).toBe('198.51.100.30 (lan)');

    const iot = ativos.find((a) => a.endereco === '198.51.100.40')!;
    expect(iot).toMatchObject({ tipo: 'dispositivo', estado: 'atencao' });
  });

  it('não lista o firewall, o nó do Proxmox nem o switch como dispositivo; gateway WAN vira host', () => {
    const enderecos = ativos.filter((a) => a.tipo === 'dispositivo').map((a) => a.endereco);
    expect(enderecos).not.toContain('192.0.2.1');
    expect(enderecos).not.toContain('192.0.2.11');
    expect(enderecos).not.toContain('192.0.2.254');
    expect(ativos.some((a) => a.detalhes.mac === '00:77:88:99:aa:55')).toBe(false); // mesmo prefixo do switch, outra VLAN
    expect(porId('lab-wan-gateway')).toMatchObject({ tipo: 'host', endereco: '203.0.113.1' });
  });

  it('todo ativo sai marcado como sincronizado e com a data da varredura', () => {
    expect(ativos.every((a) => a.tags.includes('sincronizado') && a.confirmadoEm === '2026-11-14')).toBe(true);
  });

  it('sem nenhuma fonte, não inventa nada', () => {
    expect(montarAtivos({}, '2026-11-14')).toEqual([]);
  });
});

describe('lerSaidaSwitch', () => {
  it('lê tabela MAC, trunks e descrições da saída do IOS', () => {
    const saida = [
      'SW#show interfaces trunk',
      'Port        Mode             Encapsulation  Status        Native vlan',
      'Gi0/1       on               802.1q         trunking      1',
      'SW#show mac address-table dynamic',
      '          Mac Address Table',
      '-------------------------------------------',
      'Vlan    Mac Address       Type        Ports',
      '----    -----------       --------    -----',
      '  30    0011.2233.4401    DYNAMIC     Fa0/5',
      '  10    00aa.bbcc.dd01    DYNAMIC     Gi0/1',
      'SW#show interfaces description',
      'Interface                      Status         Protocol Description',
      'Fa0/5                          up             up       MEUPC',
      'Fa0/24                         admin down     down     AP sala',
      'Gi0/1                          up             up       uplink-fw',
    ].join('\r\n');
    const r = lerSaidaSwitch(saida);
    expect(r.macs).toEqual([{ vlan: '30', mac: '001122334401', porta: 'Fa0/5' }, { vlan: '10', mac: '00aabbccdd01', porta: 'Gi0/1' }]);
    expect(r.trunks).toEqual(['Gi0/1']);
    expect(r.descricoes).toEqual({ 'Fa0/5': 'MEUPC', 'Fa0/24': 'AP sala', 'Gi0/1': 'uplink-fw' });
  });
});
