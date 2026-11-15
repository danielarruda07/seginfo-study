import { fortigateFaltando, fortigateGet } from '../fortigate.js';
import { diferencaDeConjunto, listaCurta, type ContextoFonte, type FonteExposicao, type ItemFonte, type Mudanca, type ResultadoFonte, type SecaoFonte } from './tipos.js';

/**
 * Exposição esperada × vista: o que o FortiGate publica (VIPs usadas por policies ativas) comparado
 * com as portas que o Shodan viu no IP. Porta vista e não publicada = algo vazou (regra esquecida,
 * UPnP, serviço da própria ONT). A ONT repassa as portas públicas para a WAN do FortiGate com o
 * mesmo número, então a extport da VIP é tratada como a porta pública.
 */

type Linha = Record<string, unknown>;
const resultados = (d: unknown): Linha[] => {
  const r = (d as { results?: unknown })?.results;
  return Array.isArray(r) ? (r as Linha[]) : [];
};
const nomesDe = (x: unknown): string[] => (Array.isArray(x) ? (x as { name?: unknown }[]).map((m) => String(m?.name ?? '')).filter(Boolean) : []);

const MAX_FAIXA = 2048;

/** "80" → [80]; "8000-8002" → [8000, 8001, 8002]; faixas enormes são cortadas. */
export function expandirPortas(ext: unknown): number[] {
  const s = String(ext ?? '').trim();
  const m = /^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/.exec(s);
  if (!m) return [];
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  if (a < 1 || b > 65535 || b < a) return [];
  const out: number[] = [];
  for (let p = a; p <= Math.min(b, a + MAX_FAIXA - 1); p++) out.push(p);
  return out;
}

export interface PortaEsperada { porta: number; protocolo: string; vip: string; destino: string; policy: string; agenda?: string }

export interface Esperado {
  portas: PortaEsperada[];
  /** VIPs de NAT completo (sem port forwarding): qualquer porta pode estar exposta */
  natCompleto: string[];
}

/** Monta a exposição esperada a partir de VIPs, grupos de VIP e policies (dados crus da API). */
export function exposicaoEsperada(vips: Linha[], grupos: Linha[], policies: Linha[]): Esperado {
  const vipPorNome = new Map(vips.map((v) => [String(v.name ?? ''), v]));
  const grupoPorNome = new Map(grupos.map((g) => [String(g.name ?? ''), nomesDe(g.member)]));
  const portas = new Map<string, PortaEsperada>();
  const natCompleto = new Set<string>();

  for (const p of policies) {
    if (String(p.status ?? 'enable') !== 'enable') continue;
    if (String(p.action ?? 'accept') !== 'accept') continue;
    const policy = String(p.name || `policy ${String(p.policyid ?? '?')}`);
    const agenda = p.schedule && String(p.schedule) !== 'always' ? String(p.schedule) : undefined;
    for (const destino of nomesDe(p.dstaddr)) {
      for (const nomeVip of grupoPorNome.get(destino) ?? [destino]) {
        const v = vipPorNome.get(nomeVip);
        if (!v) continue;
        if (String(v.portforward ?? 'disable') !== 'enable') { natCompleto.add(nomeVip); continue; }
        const mapped = Array.isArray(v.mappedip)
          ? (v.mappedip as { range?: unknown }[]).map((m) => String(m?.range ?? '')).filter(Boolean).join(', ')
          : String(v.mappedip ?? '');
        const protocolo = String(v.protocol ?? 'tcp');
        const mappedport = String(v.mappedport ?? '');
        for (const porta of expandirPortas(v.extport)) {
          const chave = `${porta}/${protocolo}`;
          if (portas.has(chave)) continue;
          portas.set(chave, {
            porta, protocolo, vip: nomeVip, policy, agenda,
            destino: `${mapped}${mappedport && mappedport !== String(porta) ? `:${mappedport}` : ''}`,
          });
        }
      }
    }
  }
  return { portas: [...portas.values()].sort((a, b) => a.porta - b.porta), natCompleto: [...natCompleto].sort() };
}

/** Cruza o esperado com as portas vistas por IP. Função pura, testável sem rede. */
export function cruzarExposicao(esperado: Esperado, portasPorIp: Record<string, number[]>, alvoTipo: string): ResultadoFonte {
  const numerosEsperados = new Set(esperado.portas.map((p) => p.porta));
  const porNumero = new Map<number, PortaEsperada>();
  for (const p of esperado.portas) if (!porNumero.has(p.porta)) porNumero.set(p.porta, p);
  const vistas = new Set<number>();
  const inesperadas: string[] = [];
  const vistasEsperadas: string[] = [];

  for (const [ip, lista] of Object.entries(portasPorIp)) {
    for (const porta of lista ?? []) {
      vistas.add(porta);
      if (numerosEsperados.has(porta) || esperado.natCompleto.length > 0) vistasEsperadas.push(`${ip}:${porta}`);
      else inesperadas.push(`${ip}:${porta}`);
    }
  }
  const naoVistas = [...numerosEsperados].filter((p) => !vistas.has(p)).sort((a, b) => a - b);

  const desc = (p: PortaEsperada) => `${p.vip} → ${p.destino || '?'} (${p.protocolo}, ${p.policy}${p.agenda ? `, agenda ${p.agenda}` : ''})`;
  const itensInesperadas: ItemFonte[] = inesperadas.map((x) => ({ texto: x, tom: 'alta', detalhe: 'nenhuma VIP ativa publica esta porta' }));
  const itensVistas: ItemFonte[] = vistasEsperadas.map((x) => {
    const p = porNumero.get(Number(x.split(':').pop()));
    return { texto: x, tom: 'ok', detalhe: p ? desc(p) : 'coberta por NAT completo' };
  });
  const itensNaoVistas: ItemFonte[] = naoVistas.map((n) => ({ texto: String(n), tom: 'info', detalhe: desc(porNumero.get(n)!) }));

  const secoes: SecaoFonte[] = [
    { titulo: 'Vistas e NÃO publicadas pelo FortiGate', itens: itensInesperadas, vazio: 'Nenhuma: tudo o que o Shodan viu está publicado por uma VIP ativa.' },
    { titulo: 'Publicadas e vistas', itens: itensVistas, vazio: 'Nenhuma porta publicada apareceu no Shodan ainda.' },
    { titulo: 'Publicadas e ainda não vistas', itens: itensNaoVistas, vazio: 'Todas as portas publicadas já apareceram no Shodan.' },
  ];
  if (esperado.natCompleto.length) {
    secoes.push({ titulo: 'VIPs de NAT completo (qualquer porta pode estar exposta)', itens: esperado.natCompleto.map((n) => ({ texto: n, tom: 'media' })) });
  }

  return {
    fonte: 'esperada-real',
    nome: 'Exposição esperada × vista',
    observacao: 'Esperado: VIPs do FortiGate usadas por policies ativas (a ONT repassa as portas com o mesmo número). '
      + 'Visto: Shodan, atualizado mais ou menos uma vez por semana, então porta recém-publicada demora a aparecer.'
      + (alvoTipo === 'ip' ? ' Só faz sentido se este IP for o da sua conexão.' : ''),
    destaques: [
      { rotulo: 'Inesperadas', valor: inesperadas.length, tom: inesperadas.length ? 'alta' : 'ok' },
      { rotulo: 'Publicadas vistas', valor: `${numerosEsperados.size - naoVistas.length}/${numerosEsperados.size}`, tom: 'info' },
    ],
    secoes,
    conjuntos: { inesperadas: [...inesperadas].sort(), naoVistas: naoVistas.map(String) },
  };
}

export function compararEsperadaReal(anterior: ResultadoFonte, atual: ResultadoFonte, ctx: ContextoFonte): Mudanca[] {
  // num IP qualquer o FortiGate pode não ter nada a ver: só o IP da conexão vira alerta alto
  const sev = ctx.alvo.tipo === 'ip-publico' ? 'alta' : 'media';
  return diferencaDeConjunto('esperada-real', anterior, atual, 'inesperadas',
    { tipo: 'exposicao-inesperada', severidade: sev, texto: (x) => `Porta vista na internet sem VIP ativa no FortiGate: ${listaCurta(x)}.` },
    { tipo: 'exposicao-inesperada-resolvida', severidade: 'info', texto: (x) => `Deixou de aparecer exposta sem VIP: ${listaCurta(x)}.` });
}

export const fontes: FonteExposicao[] = [{
  id: 'esperada-real',
  nome: 'Exposição esperada × vista',
  aplicaA: ['ip-publico', 'ip'],
  faltando: fortigateFaltando,
  async coletar(ctx) {
    if (!ctx.base.ips.length) return null;
    const [vips, grupos, policies] = await Promise.all([
      fortigateGet('/api/v2/cmdb/firewall/vip'),
      fortigateGet('/api/v2/cmdb/firewall/vipgrp').catch(() => ({ results: [] })),
      fortigateGet('/api/v2/cmdb/firewall/policy'),
    ]);
    return cruzarExposicao(exposicaoEsperada(resultados(vips), resultados(grupos), resultados(policies)), ctx.base.portasPorIp, ctx.alvo.tipo);
  },
  comparar: compararEsperadaReal,
}];
