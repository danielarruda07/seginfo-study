import type { EstadoAtivo, Lab, StatusEstudo, TipoAtivo } from '@seginfo/shared';

export const STATUS_COLOR = {
  ok: '#22c55e', // verde
  warn: '#f59e0b', // laranja
  crit: '#ef4444', // vermelho
} as const;

export type StatusTone = keyof typeof STATUS_COLOR;

/** Converte um percentual (0-100) em um tom de status. */
export function usageTone(pct: number): StatusTone {
  if (pct >= 85) return 'crit';
  if (pct >= 60) return 'warn';
  return 'ok';
}

/** Tom de progresso: quanto MAIOR o progresso, melhor (verde). */
export function progressTone(pct: number): StatusTone {
  if (pct >= 70) return 'ok';
  if (pct >= 30) return 'warn';
  return 'crit';
}

/** Selo de referência -> rótulo e cor da pill. */
export const REFERENCIA_LABEL: Record<string, { label: string; color: string }> = {
  gartner_leader: { label: 'Líder Gartner', color: '#7c3aed' },
  owasp: { label: 'OWASP', color: '#0ea5e9' },
  nist: { label: 'NIST', color: '#0d9488' },
  open_source: { label: 'Open Source', color: '#16a34a' },
  mercado: { label: 'Padrão de mercado', color: '#64748b' },
};

/** Estado operacional do ativo -> cor da pill. */
export const ESTADO_ATIVO_COLOR: Record<EstadoAtivo, string> = {
  ativo: STATUS_COLOR.ok,
  atencao: STATUS_COLOR.warn,
  critico: STATUS_COLOR.crit,
  planejado: '#64748b',
  desativado: '#94a3b8',
};

/** Domínio do lab -> rótulo e cor da pill. */
export const DOMINIO_LAB: Record<Lab['dominio'], { label: string; color: string }> = {
  red: { label: 'Red Team', color: '#ef4444' },
  blue: { label: 'Blue Team', color: '#0ea5e9' },
  purple: { label: 'Purple Team', color: '#7c3aed' },
  infra: { label: 'Infra', color: '#64748b' },
};

/** Status de estudo -> rótulo. */
export const STATUS_ESTUDO_LABEL: Record<StatusEstudo, string> = {
  a_estudar: 'A estudar',
  estudando: 'Estudando',
  concluido: 'Concluído',
};

/** Opções de status de estudo para Dropdowns. */
export const STATUS_ESTUDO_OPTS = (Object.keys(STATUS_ESTUDO_LABEL) as StatusEstudo[]).map((value) => ({
  label: STATUS_ESTUDO_LABEL[value],
  value,
}));

/** Tipo de ativo -> rótulo (pills e chips de filtro do inventário). */
export const TIPO_ATIVO_LABEL: Record<TipoAtivo, string> = {
  host: 'Host',
  vm: 'VM',
  container: 'Container',
  storage: 'Storage',
  vlan: 'VLAN',
  rede: 'Rede',
  switch: 'Switch',
  rota: 'Rota',
  firewall_policy: 'Firewall',
  servico: 'Serviço',
};
