import type { Ativo, EstadoAtivo, TipoAtivo } from '@seginfo/shared';
import type { Tone } from '@/theme/status';
import { TIPO_ATIVO_LABEL } from '@/theme/status';

/** Regras puras da tela Meu Ambiente (testadas em regras.test.ts). */

export const TIPO_ICON: Record<TipoAtivo, string> = {
  host: 'pi-server',
  vm: 'pi-desktop',
  container: 'pi-box',
  storage: 'pi-database',
  vlan: 'pi-sitemap',
  rede: 'pi-globe',
  switch: 'pi-arrows-h',
  rota: 'pi-directions',
  firewall_policy: 'pi-shield',
  servico: 'pi-cog',
};

export const TIPO_OPTS = (Object.keys(TIPO_ATIVO_LABEL) as TipoAtivo[]).map((value) => ({
  value, label: TIPO_ATIVO_LABEL[value], icon: TIPO_ICON[value],
}));

/** Estado → rótulo humano, tom e ícone. "Em operação" fica neutro: cor só onde há ação. */
export const ESTADO_META: Record<EstadoAtivo, { label: string; tone?: Tone; icon: string }> = {
  critico: { label: 'Crítico', tone: 'danger', icon: 'pi-times-circle' },
  atencao: { label: 'Em atenção', tone: 'serious', icon: 'pi-exclamation-triangle' },
  ativo: { label: 'Em operação', icon: 'pi-check' },
  planejado: { label: 'Planejado', icon: 'pi-calendar' },
  desativado: { label: 'Desativado', tone: 'muted', icon: 'pi-power-off' },
};

export const ESTADO_OPTS = (['ativo', 'atencao', 'critico', 'planejado', 'desativado'] as EstadoAtivo[]).map((value) => ({
  value, label: ESTADO_META[value].label, icon: ESTADO_META[value].icon,
}));

/** Ordem da tabela: o que pede ação primeiro, histórico por último. */
const ORDEM: Record<EstadoAtivo, number> = { critico: 0, atencao: 1, ativo: 2, planejado: 3, desativado: 4 };
export function ordenarAtivos(items: Ativo[]): Ativo[] {
  return [...items].sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado] || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Escopo do SelectButton. */
export type Escopo = 'operacao' | 'fora' | 'todos';
export const ESCOPO_OPTS: { value: Escopo; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'operacao', label: 'Em operação' },
  { value: 'fora', label: 'Fora de operação' },
];
export function noEscopo(a: Ativo, escopo: Escopo): boolean {
  if (escopo === 'todos') return true;
  const fora = a.estado === 'planejado' || a.estado === 'desativado';
  return escopo === 'fora' ? fora : !fora;
}

/** Tom da linha da tabela: só crítico/atenção ganham barra; desativado fica secundário. */
export function linhaClasse(a: Ativo): string {
  const tone = ESTADO_META[a.estado].tone;
  if (tone === 'danger' || tone === 'serious') return `iv-row-alert tone-${tone}`;
  if (a.estado === 'desativado') return 'iv-row-muted';
  return '';
}

/** Contagem por tipo, maior primeiro (gráfico). Tipos sem ativos ficam de fora. */
export function contarPorTipo(items: Ativo[]): { tipo: TipoAtivo; total: number; nomes: string[] }[] {
  const map = new Map<TipoAtivo, Ativo[]>();
  for (const a of items) map.set(a.tipo, [...(map.get(a.tipo) ?? []), a]);
  return [...map.entries()]
    .map(([tipo, list]) => ({ tipo, total: list.length, nomes: list.map((x) => x.nome) }))
    .sort((a, b) => b.total - a.total || TIPO_ATIVO_LABEL[a.tipo].localeCompare(TIPO_ATIVO_LABEL[b.tipo], 'pt-BR'));
}

/** Rótulo e exemplo do campo "endereço" mudam conforme o tipo (exemplos fictícios, faixas de documentação). */
export function campoEndereco(tipo: TipoAtivo): { label: string; placeholder: string } {
  switch (tipo) {
    case 'vlan': case 'rede': return { label: 'Sub-rede / VLAN ID', placeholder: 'ex.: VLAN 30 · 192.0.2.0/24' };
    case 'servico': return { label: 'URL ou host:porta', placeholder: 'ex.: https://wazuh.lab.example:443' };
    case 'firewall_policy': return { label: 'Regra / interfaces', placeholder: 'ex.: LAB → DMZ, porta 443' };
    case 'rota': return { label: 'Destino → gateway', placeholder: 'ex.: 198.51.100.0/24 → 192.0.2.1' };
    case 'storage': return { label: 'Caminho / volume', placeholder: 'ex.: nfs://nas.lab.example/backups' };
    default: return { label: 'Endereço IP / hostname', placeholder: 'ex.: 192.0.2.10 · pve-01.lab.example' };
  }
}

export interface AtivoErros { nome?: string; detalhes?: string }

/** Valida o rascunho. Retorna erros por campo e os detalhes já convertidos. */
export function validarAtivo(nome: string, detalhesRaw: string): { erros: AtivoErros; detalhes: Record<string, string> } {
  const erros: AtivoErros = {};
  let detalhes: Record<string, string> = {};
  if (!nome.trim()) erros.nome = 'Informe o nome do ativo.';
  const raw = detalhesRaw.trim();
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('não é objeto');
      detalhes = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
    } catch {
      erros.detalhes = 'Use JSON no formato {"chave": "valor"}.';
    }
  }
  return { erros, detalhes };
}
