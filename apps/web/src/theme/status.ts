import type { EstadoAtivo, FaseFerramenta, Lab, RangeAlvo, RangeChecklistItem, StatusEstudo, TipoAtivo } from '@seginfo/shared';

export const STATUS_COLOR = {
  ok: '#22c55e', // verde
  warn: '#f59e0b', // laranja
  crit: '#ef4444', // vermelho
} as const;

export type StatusTone = keyof typeof STATUS_COLOR;

/**
 * Tons de estado do guia de UI (docs/UI_GUIDE.md). A classe `tone-*` seta `--tone`.
 * danger = vencido/crítico · serious = urgente · warning = atenção · info · ok (pouco) · muted = inativo.
 */
export type Tone = 'danger' | 'serious' | 'warning' | 'info' | 'ok' | 'muted';

export const toneClass = (tone?: Tone) => (tone ? `tone-${tone}` : '');

/** Tons que pedem ação: só eles ganham destaque em KPI e linha de tabela. */
export const ACTION_TONES: readonly Tone[] = ['danger', 'serious', 'warning'];

/** KPI só ganha destaque se o tom pede ação e há algo a fazer (valor > 0). */
export function kpiAlert(tone: Tone | undefined, value: unknown): boolean {
  if (!tone || !ACTION_TONES.includes(tone)) return false;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n > 0 : false;
}

/** Converte a régua antiga (ok/warn/crit) no tom equivalente. */
export function toneFromStatus(s: StatusTone): Tone {
  return s === 'crit' ? 'danger' : s === 'warn' ? 'serious' : 'ok';
}

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

/** Categoria de alvo do range -> rótulo. */
export const CATEGORIA_RANGE_LABEL: Record<RangeAlvo['categoria'], string> = {
  vm_vitima: 'VM vítima',
  vm_atacante: 'VM atacante',
  servico_exposto: 'Serviço exposto',
  rede: 'Rede/segmento',
  ferramenta_analise: 'Ferramenta de análise',
};

/** Grupo de checklist do range -> rótulo. */
export const GRUPO_CHECKLIST_LABEL: Record<RangeChecklistItem['grupo'], string> = {
  rede: 'Rede/VLAN',
  vms: 'VMs',
  firewall: 'FortiGate',
  monitoramento: 'Monitoramento',
  seguranca_operacional: 'Segurança operacional',
  exercicio: 'Exercício',
};

/** Criticidade do item de checklist -> cor da pill. */
export const CRITICIDADE_COLOR: Record<RangeChecklistItem['criticidade'], string> = {
  alta: STATUS_COLOR.crit,
  media: STATUS_COLOR.warn,
  baixa: STATUS_COLOR.ok,
};

/** Fase do workflow -> rótulo (Arsenal de Ferramentas). */
export const FASE_FERRAMENTA_LABEL: Record<FaseFerramenta, string> = {
  reconhecimento: 'Reconhecimento & OSINT',
  varredura: 'Varredura de rede',
  vulnerabilidade: 'Avaliação de vulnerabilidade',
  web: 'Aplicações web',
  exploracao: 'Exploração',
  senha: 'Senhas',
  wireless: 'Segurança sem fio',
  forense: 'Perícia & resposta a incidentes',
  monitoramento: 'Logs & monitoramento',
  defesa: 'Segurança defensiva',
};

/** Ordem de exibição das fases: segue o fluxo de um exercício (recon → defesa). */
export const FASES_FERRAMENTA_ORDEM: FaseFerramenta[] = [
  'reconhecimento', 'varredura', 'vulnerabilidade', 'web', 'exploracao',
  'senha', 'wireless', 'forense', 'monitoramento', 'defesa',
];

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
