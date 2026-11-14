import type { FastifyInstance } from 'fastify';
import { AtivoSchema, type Ativo, type EstadoAtivo, type TipoAtivo } from '@seginfo/shared';
import type { AuthedRequest } from './auth.js';
import { proxmoxFaltando, proxmoxGet } from './proxmox.js';
import { fortigateFaltando, fortigateGet } from './fortigate.js';
import { catalystExecutar, catalystFaltando } from './catalyst.js';

/**
 * "Sincronizar com o ambiente" (Meu Ambiente): o servidor consulta o laboratório SÓ COM LEITURA e
 * devolve uma lista de ativos no formato do inventário. O navegador mostra a prévia e decide o que
 * aplicar; nada é gravado aqui (o inventário mora no navegador).
 *
 * Fontes: Proxmox (nós, storages compartilhados, VMs e containers, IP pelo agente QEMU),
 * FortiGate (concessões DHCP, ARP, detecção de dispositivos) e switch Catalyst (tabela MAC,
 * descrição das portas, comandos show). Cada fonte é opcional: sem configuração, fica de fora.
 *
 * Os identificadores seguem os dos scripts de descoberta do range (lab-<nó>, lab-stg-<storage>,
 * lab-vm-<vmid>, lab-dev-...), para a sincronização atualizar o que já foi importado por arquivo.
 *
 * Dividido em duas partes: `coletar` (rede) e `montarAtivos` (regras puras, testadas em descoberta.test.ts).
 */

type Rec = Record<string, unknown>;
const lista = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const resultados = (v: unknown): Rec[] => lista((v as { results?: unknown } | null)?.results);
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

export interface VmColetada {
  vmid: number; nome: string; no: string; tipo: 'qemu' | 'lxc'; status: string; modelo: boolean;
  cpus: number; memoriaBytes: number; pool: string;
  redes: string[]; ostype: string; tags: string[]; ipsAgente: string[];
}
export interface Coleta {
  proxmox?: {
    versao: string;
    nos: { no: string; status: string; cpus: number; memoriaBytes: number; ip: string }[];
    storages: { storage: string; no: string; tipo: string; compartilhado: boolean; status: string; total: number; usado: number; conteudo: string }[];
    vms: VmColetada[];
  };
  fortigate?: { leases: Rec[]; arp: Rec[]; dispositivos: Rec[]; macsProprios: string[] };
  switch?: { hostIp: string; macs: { vlan: string; mac: string; porta: string }[]; descricoes: Record<string, string>; trunks: string[] };
}
export interface Fonte { fonte: 'proxmox' | 'fortigate' | 'switch'; estado: 'ok' | 'parcial' | 'erro' | 'nao_configurado'; itens: number; detalhe?: string }

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** Roda as consultas de uma fonte; falha de uma consulta não derruba as outras. */
async function tentar<T>(erros: string[], rotulo: string, fn: () => Promise<T>, padrao: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    erros.push(`${rotulo}: ${mensagem(e)}`);
    return padrao;
  }
}

/** Executa `fn` sobre os itens com no máximo `n` chamadas simultâneas. */
async function emLotes<T, R>(itens: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = new Array(itens.length);
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (proximo < itens.length) {
      const i = proximo++;
      saida[i] = await fn(itens[i]);
    }
  }));
  return saida;
}

const ipv4Util = (ip: string) => /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !ip.startsWith('127.') && !ip.startsWith('169.254.');

async function coletarProxmox(fontes: Fonte[]): Promise<Coleta['proxmox']> {
  if (proxmoxFaltando().length) {
    fontes.push({ fonte: 'proxmox', estado: 'nao_configurado', itens: 0, detalhe: `falta ${proxmoxFaltando().join(', ')}` });
    return undefined;
  }
  const erros: string[] = [];
  const [versao, nos, status, storages, recursos] = await Promise.all([
    tentar(erros, 'versão', async () => str(((await proxmoxGet('/version')) as Rec | null)?.release), ''),
    tentar(erros, 'nós', async () => lista(await proxmoxGet('/nodes')), [] as Rec[]),
    tentar(erros, 'status do cluster', async () => lista(await proxmoxGet('/cluster/status')), [] as Rec[]),
    tentar(erros, 'storages', async () => lista(await proxmoxGet('/cluster/resources?type=storage')), [] as Rec[]),
    tentar(erros, 'VMs', async () => lista(await proxmoxGet('/cluster/resources?type=vm')), [] as Rec[]),
  ]);
  const ipDoNo = new Map(status.filter((s) => s.type === 'node').map((s) => [str(s.name), str(s.ip)]));

  const vms = await emLotes(recursos, 4, async (r): Promise<VmColetada> => {
    const tipo = r.type === 'lxc' ? 'lxc' : 'qemu';
    const no = str(r.node);
    const vmid = Number(r.vmid);
    const cfg = await tentar(erros, `config da ${vmid}`, async () => ((await proxmoxGet(`/nodes/${no}/${tipo}/${vmid}/config`)) ?? {}) as Rec, {} as Rec);
    let ipsAgente: string[] = [];
    if (tipo === 'qemu' && r.status === 'running' && /^(1|enabled=1)/.test(str(cfg.agent))) {
      // agente desligado na VM é normal: não conta como erro da fonte
      const ifs = await proxmoxGet(`/nodes/${no}/qemu/${vmid}/agent/network-get-interfaces`).catch(() => null);
      ipsAgente = lista((ifs as Rec | null)?.result)
        .flatMap((i) => lista(i['ip-addresses']).map((a) => str(a['ip-address'])))
        .filter(ipv4Util);
    }
    return {
      vmid, tipo, no, nome: str(r.name) || str(cfg.name) || str(cfg.hostname), status: str(r.status), modelo: Number(r.template) === 1,
      cpus: Number(r.maxcpu) || 0, memoriaBytes: Number(r.maxmem) || 0, pool: str(r.pool),
      redes: Object.keys(cfg).filter((k) => /^net\d+$/.test(k)).sort().map((k) => str(cfg[k])),
      ostype: str(cfg.ostype), tags: str(cfg.tags).split(/[;,\s]+/).filter(Boolean), ipsAgente,
    };
  });

  const total = nos.length + vms.length;
  fontes.push({
    fonte: 'proxmox', estado: erros.length === 0 ? 'ok' : total > 0 ? 'parcial' : 'erro', itens: total,
    ...(erros.length ? { detalhe: erros.slice(0, 3).join(' · ') } : {}),
  });
  if (total === 0 && erros.length) return undefined;
  return {
    versao,
    nos: nos.map((n) => ({ no: str(n.node), status: str(n.status), cpus: Number(n.maxcpu) || 0, memoriaBytes: Number(n.maxmem) || 0, ip: ipDoNo.get(str(n.node)) ?? '' })),
    storages: storages.map((s) => ({
      storage: str(s.storage), no: str(s.node), tipo: str(s.plugintype), compartilhado: Number(s.shared) === 1,
      status: str(s.status), total: Number(s.maxdisk) || 0, usado: Number(s.disk) || 0, conteudo: str(s.content),
    })),
    vms,
  };
}

async function coletarFortigate(fontes: Fonte[]): Promise<Coleta['fortigate']> {
  if (fortigateFaltando().length) {
    fontes.push({ fonte: 'fortigate', estado: 'nao_configurado', itens: 0, detalhe: `falta ${fortigateFaltando().join(', ')}` });
    return undefined;
  }
  const erros: string[] = [];
  const [leases, arp, dispositivos, interfaces] = await Promise.all([
    tentar(erros, 'DHCP', async () => resultados(await fortigateGet('/api/v2/monitor/system/dhcp')), [] as Rec[]),
    tentar(erros, 'ARP', async () => resultados(await fortigateGet('/api/v2/monitor/network/arp')), [] as Rec[]),
    tentar(erros, 'dispositivos', async () => resultados(await fortigateGet('/api/v2/monitor/user/device/query')), [] as Rec[]),
    tentar(erros, 'interfaces', async () => ((await fortigateGet('/api/v2/monitor/system/interface?include_vlan=true')) as Rec | null)?.results ?? {}, {} as unknown),
  ]);
  const macsProprios = Object.values((interfaces ?? {}) as Record<string, Rec>).map((i) => normMac(str(i?.mac))).filter((m) => m.length === 12);
  const total = leases.length + arp.length + dispositivos.length;
  fontes.push({
    fonte: 'fortigate', estado: erros.length === 0 ? 'ok' : total > 0 ? 'parcial' : 'erro', itens: total,
    ...(erros.length ? { detalhe: erros.slice(0, 3).join(' · ') } : {}),
  });
  return total > 0 ? { leases, arp, dispositivos, macsProprios } : undefined;
}

/** Lê a saída dos comandos show do switch (texto do IOS). Exportado para teste. */
export function lerSaidaSwitch(saida: string): Omit<NonNullable<Coleta['switch']>, 'hostIp'> {
  const macs: { vlan: string; mac: string; porta: string }[] = [];
  const descricoes: Record<string, string> = {};
  const trunks = new Set<string>();
  for (const linha of saida.split(/\r?\n/)) {
    const m = /^\s*(\d+)\s+([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4})\s+DYNAMIC\s+(\S+)/i.exec(linha);
    if (m) { macs.push({ vlan: m[1], mac: normMac(m[2]), porta: m[3] }); continue; }
    const t = /^((?:Fa|Gi|Te|Po)\S*\d)\s+(on|desirable|auto)\s+\S+\s+trunking/i.exec(linha);
    if (t) { trunks.add(t[1]); continue; }
    const d = /^((?:Fa|Gi|Te|Po)\d+(?:\/\d+)*)\s+(?:admin down|up|down)\s+(?:up|down)\s+(\S.*)$/i.exec(linha.trimEnd());
    if (d) descricoes[d[1]] = d[2].trim();
  }
  return { macs, descricoes, trunks: [...trunks] };
}

async function coletarSwitch(fontes: Fonte[]): Promise<Coleta['switch']> {
  if (catalystFaltando().length) {
    fontes.push({ fonte: 'switch', estado: 'nao_configurado', itens: 0, detalhe: `falta ${catalystFaltando().join(', ')}` });
    return undefined;
  }
  try {
    // só comandos show (e terminal length 0, que vale para esta sessão e evita a paginação)
    const saida = await catalystExecutar(['terminal length 0', 'show interfaces trunk', 'show mac address-table dynamic', 'show interfaces description']);
    const lido = lerSaidaSwitch(saida);
    fontes.push({ fonte: 'switch', estado: lido.macs.length ? 'ok' : 'parcial', itens: lido.macs.length, ...(lido.macs.length ? {} : { detalhe: 'nenhum MAC lido na saída' }) });
    return { ...lido, hostIp: process.env.CATALYST_HOST ?? '' };
  } catch (e) {
    fontes.push({ fonte: 'switch', estado: 'erro', itens: 0, detalhe: mensagem(e) });
    return undefined;
  }
}

export async function coletar(): Promise<{ coleta: Coleta; fontes: Fonte[] }> {
  const fontes: Fonte[] = [];
  const [proxmox, fortigate, sw] = await Promise.all([coletarProxmox(fontes), coletarFortigate(fontes), coletarSwitch(fontes)]);
  const ordem = ['proxmox', 'fortigate', 'switch'];
  fontes.sort((a, b) => ordem.indexOf(a.fonte) - ordem.indexOf(b.fonte));
  return { coleta: { proxmox, fortigate, switch: sw }, fontes };
}

// ---------------------------------------------------------------- regras (puras)

export const normMac = (m: string) => m.toLowerCase().replace(/[^0-9a-f]/g, '');
const fmtMac = (m: string) => (m.match(/.{2}/g) ?? []).join(':');
const gbTxt = (bytes: number) => `${Math.round((bytes / 1024 ** 3) * 10) / 10} GB`;
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** MAC localmente administrado (aleatório de celular, VM): nunca agrupa com outro. */
const macLocal = (m: string) => (parseInt(m[1] ?? '0', 16) & 2) === 2;
/** OUIs da Fortinet, para não listar as interfaces do próprio firewall como dispositivo. */
const OUI_FORTINET = ['e023ff', '000910', '00090f', '085b0e', '04d590', '704ca5', '906cac', 'e81cba', 'd476a0', '94f392'];

interface InfoMac {
  ip?: string; hostname?: string; interface?: string; dhcp?: string; vci?: string; online?: boolean;
  fabricante?: string; familia?: string; categoria?: string; sistema?: string; versaoSistema?: string; visto?: string;
}

export function montarAtivos(c: Coleta, hoje: string): Ativo[] {
  const ativos: Ativo[] = [];
  const add = (a: { id: string; tipo: TipoAtivo; nome: string; endereco?: string; funcao: string; estado?: EstadoAtivo; detalhes: Record<string, string | undefined>; tags: string[]; fonte: string }) => {
    ativos.push({
      id: a.id, ambiente: 'criecomia', tipo: a.tipo, nome: a.nome, endereco: a.endereco ?? '', funcao: a.funcao, estado: a.estado ?? 'ativo',
      detalhes: Object.fromEntries(Object.entries(a.detalhes).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '')),
      tags: ['sincronizado', ...a.tags], labsRelacionados: [], confirmadoEm: hoje, fonte: a.fonte,
    });
  };

  // ---- Proxmox: nós e storages compartilhados
  const p = c.proxmox;
  if (p) {
    for (const n of p.nos) {
      add({
        id: `lab-${n.no}`, tipo: 'host', nome: `${n.no} (Proxmox VE${p.versao ? ` ${p.versao}` : ''})`, endereco: n.ip,
        funcao: 'Nó do cluster Proxmox', estado: n.status === 'online' ? 'ativo' : 'atencao',
        detalhes: { status: n.status, cpu: `${n.cpus} núcleos`, memoria: gbTxt(n.memoriaBytes), 'porta de gerência': '8006' },
        tags: ['proxmox', 'cluster'], fonte: 'API do Proxmox',
      });
    }
    const porStorage = new Map<string, typeof p.storages>();
    for (const s of p.storages.filter((x) => x.compartilhado)) porStorage.set(s.storage, [...(porStorage.get(s.storage) ?? []), s]);
    for (const [nome, lst] of porStorage) {
      const fora = lst.filter((s) => s.status !== 'available').map((s) => s.no).sort();
      const ref = lst.reduce((a, b) => (b.total > a.total ? b : a));
      add({
        id: `lab-stg-${nome}`, tipo: 'storage', nome, funcao: `Storage ${ref.tipo} compartilhado do cluster`, estado: fora.length ? 'atencao' : 'ativo',
        detalhes: {
          tipo: ref.tipo, conteudo: ref.conteudo, total: ref.total ? gbTxt(ref.total) : undefined,
          livre: ref.total ? gbTxt(ref.total - ref.usado) : undefined, 'nós': lst.map((s) => s.no).sort().join(', '),
          'indisponível em': fora.join(', ') || undefined,
        },
        tags: ['proxmox', 'storage'], fonte: 'API do Proxmox',
      });
    }
  }

  // ---- Rede: junta DHCP, ARP e detecção do FortiGate por MAC
  const f = c.fortigate;
  const info = new Map<string, InfoMac>();
  const de = (mac: string) => { const k = normMac(mac); if (!info.has(k)) info.set(k, {}); return info.get(k)!; };
  for (const l of f?.leases ?? []) {
    if (normMac(str(l.mac)).length !== 12) continue;
    const i = de(str(l.mac));
    Object.assign(i, {
      ip: str(l.ip) || i.ip, hostname: str(l.hostname) || i.hostname, interface: str(l.interface) || i.interface,
      dhcp: l.reserved ? 'reserva fixa' : 'concessão dinâmica', vci: str(l.vci) || i.vci,
    });
  }
  for (const a of f?.arp ?? []) {
    if (normMac(str(a.mac)).length !== 12) continue;
    const i = de(str(a.mac));
    i.ip ??= str(a.ip) || undefined;
    i.interface ??= str(a.interface) || undefined;
    i.online = true;
  }
  for (const d of f?.dispositivos ?? []) {
    if (normMac(str(d.mac)).length !== 12) continue;
    const i = de(str(d.mac));
    i.ip ??= str(d.ipv4_address) || undefined;
    i.interface ??= str(d.detected_interface) || undefined;
    i.hostname ||= str(d.hostname) || undefined;
    i.fabricante ||= str(d.hardware_vendor) || undefined;
    i.familia ||= str(d.hardware_family) || undefined;
    i.categoria ||= str(d.hardware_type) || undefined;
    i.sistema ||= str(d.os_name) || undefined;
    i.versaoSistema ||= str(d.os_version) || undefined;
    if (typeof d.last_seen === 'number') i.visto = new Date(d.last_seen * 1000).toISOString().slice(0, 16).replace('T', ' ');
    if (d.is_online) i.online = true;
  }

  // ---- porta do switch por MAC (ignora trunks: lá aparece tudo o que passa pelo uplink)
  const sw = c.switch;
  const trunks = new Set(sw?.trunks ?? []);
  const portaDe = new Map<string, string>();
  for (const m of sw?.macs ?? []) {
    if (trunks.has(m.porta) || trunks.has(m.porta.replace(/^GigabitEthernet/i, 'Gi').replace(/^FastEthernet/i, 'Fa'))) continue;
    portaDe.set(m.mac, `${m.porta} (VLAN ${m.vlan})${sw?.descricoes[m.porta] ? ` · ${sw.descricoes[m.porta]}` : ''}`);
  }

  // ---- o que não é "dispositivo": VMs (têm ativo próprio), o firewall, os nós e o switch
  const vmPorMac = new Map<string, VmColetada>();
  for (const v of p?.vms ?? []) {
    for (const r of v.redes) {
      const m = /([0-9a-f]{2}(?::[0-9a-f]{2}){5})/i.exec(r);
      if (m) vmPorMac.set(normMac(m[1]), v);
    }
  }
  const ipsIgnorados = new Set([...(p?.nos ?? []).map((n) => n.ip), sw?.hostIp ?? ''].filter(Boolean));
  const proprios = new Set(f?.macsProprios ?? []);
  const prefixoSwitch = [...info.entries()].find(([, i]) => sw?.hostIp && i.ip === sw.hostIp)?.[0].slice(0, 10);
  const ignorar = (mac: string, i: InfoMac) =>
    vmPorMac.has(mac) || proprios.has(mac) || OUI_FORTINET.some((o) => mac.startsWith(o)) ||
    (!!prefixoSwitch && mac.startsWith(prefixoSwitch)) || (!!i.ip && ipsIgnorados.has(i.ip));

  const detalhesRede = (mac: string, i: InfoMac): Record<string, string | undefined> => ({
    mac: fmtMac(mac), fabricante: i.fabricante, sistema: [i.sistema, i.versaoSistema].filter(Boolean).join(' ') || undefined,
    'interface no FortiGate': i.interface, dhcp: i.dhcp, 'identificação DHCP (vci)': i.vci, 'porta do switch': portaDe.get(mac),
    'visto por último': i.visto, 'online agora': i.online ? 'sim' : 'não (só concessão DHCP)',
  });

  // placas do mesmo equipamento (mesmos 5 primeiros octetos, ex.: iLO + placa do servidor) viram um ativo só
  const grupos = new Map<string, string[]>();
  for (const [mac, i] of info) {
    if (ignorar(mac, i)) continue;
    const chave = macLocal(mac) ? mac : mac.slice(0, 10);
    grupos.set(chave, [...(grupos.get(chave) ?? []), mac]);
  }
  let servidoresIlo = 0;
  const fonteRede = `FortiGate (DHCP, ARP, detecção)${sw ? ' e tabela MAC do switch' : ''}`;
  for (const [chave, macs] of grupos) {
    const i: InfoMac = {};
    for (const m of macs) for (const [k, v] of Object.entries(info.get(m)!)) if ((i as Rec)[k] === undefined) (i as Rec)[k] = v;
    const mac = macs[0];
    const host = (i.hostname ?? '').trim();
    const vci = (i.vci ?? '').toLowerCase();
    const ident = slug(host || chave) || chave;
    const det = detalhesRede(mac, i);
    const ilo = macs.find((m) => /cpqrib/i.test(info.get(m)?.vci ?? '') || (info.get(m)?.hostname ?? '').toUpperCase() === 'ILO');

    if (ilo) {
      const ipIlo = info.get(ilo)?.ip;
      const outros = macs.filter((m) => m !== ilo).map((m) => `${info.get(m)?.ip ?? 'sem IP'} (${info.get(m)?.interface ?? '?'})`);
      add({
        id: servidoresIlo++ === 0 ? 'lab-srv-hp-ilo' : `lab-srv-hp-ilo-${ident}`, tipo: 'servidor', nome: 'Servidor HP ProLiant (iLO)', endereco: ipIlo,
        funcao: 'Servidor físico HP com placa de gerência iLO',
        detalhes: { ...det, mac: macs.map(fmtMac).join(', '), 'gerência (iLO)': ipIlo, 'outras placas': outros.join(', ') || undefined },
        tags: ['servidor', 'hp', 'ilo'], fonte: fonteRede,
      });
    } else if (/nas/i.test(i.familia ?? '') || /^stg/i.test(host)) {
      add({ id: `lab-nas-${ident}`, tipo: 'storage', nome: `NAS ${i.fabricante ?? ''} ${host}`.replace(/\s+/g, ' ').trim(), endereco: i.ip, funcao: 'NAS de armazenamento', detalhes: det, tags: ['nas', 'storage'], fonte: fonteRede });
    } else if (vci.includes('ubnt') || /^uap/i.test(host) || /access point/i.test(i.categoria ?? '')) {
      add({ id: `lab-ap-${ident}`, tipo: 'ap', nome: vci.includes('ubnt') || /^uap/i.test(host) ? `Ubiquiti ${host}`.trim() : host || `Ponto de acesso ${fmtMac(mac)}`, endereco: i.ip, funcao: 'Ponto de acesso Wi-Fi', detalhes: det, tags: ['wifi'], fonte: fonteRede });
    } else if (vci.startsWith('msft') || /windows/i.test(i.sistema ?? '')) {
      add({ id: `lab-est-${ident}`, tipo: 'estacao', nome: host || `Estação Windows ${fmtMac(mac)}`, endereco: i.ip, funcao: 'Estação de trabalho Windows', detalhes: det, tags: ['estacao', 'windows'], fonte: fonteRede });
    } else if (vci.includes('android') || /^(iphone|ipad|galaxy|sm-)/i.test(host) || /^(android|ios)/i.test(i.sistema ?? '')) {
      const relogio = /^sm-r/i.test(host);
      add({
        id: host ? `lab-dev-${ident}-${mac.slice(-4)}` : `lab-dev-${chave}`, tipo: 'dispositivo',
        nome: host || (vci.includes('android') ? 'Android sem nome' : `Celular ${fmtMac(mac)}`), endereco: i.ip,
        funcao: relogio ? 'Relógio inteligente' : 'Celular',
        detalhes: { ...det, observacao: macLocal(mac) ? 'MAC aleatório (privacidade do sistema): pode mudar com o tempo e reaparecer como outro item.' : undefined },
        tags: ['movel', relogio ? 'relogio' : 'celular'], fonte: fonteRede,
      });
    } else if ((i.interface ?? '').toLowerCase().startsWith('wan')) {
      add({ id: 'lab-wan-gateway', tipo: 'host', nome: 'Roteador do provedor (gateway WAN)', endereco: i.ip, funcao: 'Saída para a internet; lado WAN do FortiGate', detalhes: det, tags: ['wan', 'internet'], fonte: fonteRede });
    } else {
      add({
        id: `lab-dev-${ident}`, tipo: 'dispositivo', nome: host || `Dispositivo não identificado (${fmtMac(mac)})`, endereco: i.ip,
        funcao: 'Dispositivo na rede', estado: 'atencao',
        detalhes: { ...det, observacao: vci.includes('udhcp') ? 'Equipamento embarcado (cliente DHCP udhcp): TV, IoT ou similar. Identificar.' : 'Não identificado.' },
        tags: ['nao-identificado'], fonte: fonteRede,
      });
    }
  }

  // ---- VMs e containers, com IP (agente QEMU ou ARP) e porta do switch
  for (const v of p?.vms ?? []) {
    const mac = [...vmPorMac.entries()].find(([, x]) => x === v)?.[0];
    const i = mac ? info.get(mac) ?? {} : {};
    const ip = v.ipsAgente[0] ?? i.ip ?? '';
    const vlan = /tag=(\d+)/.exec(v.redes.join(' '))?.[1];
    const hostname = i.hostname && i.hostname.toLowerCase() !== v.nome.toLowerCase() ? ` · ${i.hostname}` : '';
    add({
      id: `lab-vm-${v.vmid}`, tipo: v.tipo === 'qemu' ? 'vm' : 'container', nome: `${v.nome || 'sem nome'}${hostname} (VMID ${v.vmid})`, endereco: ip,
      funcao: v.modelo ? 'Modelo (template) de VM' : v.tipo === 'qemu' ? 'Máquina virtual' : 'Container LXC',
      estado: v.status === 'running' ? 'ativo' : 'desativado',
      detalhes: {
        ...(mac ? detalhesRede(mac, i) : {}), 'online agora': undefined,
        'nó': v.no, status: v.status, cpu: `${v.cpus} vCPU`, memoria: gbTxt(v.memoriaBytes), 'tipo de sistema (Proxmox)': v.ostype || undefined,
        rede: v.redes.join('; ') || undefined, vlan: vlan ?? (v.redes.length ? 'sem tag (VLAN nativa da bridge)' : undefined), pool: v.pool || undefined,
        'IP obtido de': v.ipsAgente.length ? 'agente QEMU' : ip ? 'ARP do FortiGate' : 'nenhuma fonte (sem IP visível)',
        'outros IPs': v.ipsAgente.slice(1).join(', ') || undefined,
      },
      tags: ['proxmox', v.tipo, ...v.tags.map(slug).filter(Boolean)], fonte: 'API do Proxmox' + (mac && (i.ip || portaDe.has(mac)) ? ' e rede' : ''),
    });
  }

  // nunca devolve algo que o inventário recusaria
  return AtivoSchema.array().parse(ativos);
}

export async function registerDescobertaRoutes(app: FastifyInstance) {
  // GET: só lê o ambiente e devolve a prévia; quem grava é o navegador, depois que você aplica.
  app.get('/api/ambiente/descoberta', async (req) => {
    void (req as AuthedRequest).usuarioId;
    const inicio = Date.now();
    const { coleta, fontes } = await coletar();
    const ativos = montarAtivos(coleta, new Date().toISOString().slice(0, 10));
    req.log.info({ fontes: fontes.map((f) => `${f.fonte}:${f.estado}:${f.itens}`), ativos: ativos.length, ms: Date.now() - inicio }, 'descoberta do ambiente');
    return { geradoEm: new Date().toISOString(), duracaoMs: Date.now() - inicio, fontes, ativos };
  });
}
