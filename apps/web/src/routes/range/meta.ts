import type { RangeAlvo, RangeChecklistItem } from '@seginfo/shared';

/** Ícone de cada categoria de alvo do Range. */
export const CATEGORIA_ICON: Record<RangeAlvo['categoria'], string> = {
  vm_vitima: 'pi-desktop',
  vm_atacante: 'pi-bolt',
  servico_exposto: 'pi-globe',
  rede: 'pi-sitemap',
  ferramenta_analise: 'pi-search',
};

export const GRUPOS_PREPARACAO: RangeChecklistItem['grupo'][] = ['rede', 'firewall', 'vms', 'monitoramento', 'seguranca_operacional'];

export type FiltroFeito = 'todas' | 'pendentes' | 'concluidas';
export const FILTRO_FEITO_OPTS: { value: FiltroFeito; label: string }[] = [
  { value: 'todas', label: 'Todas' }, { value: 'pendentes', label: 'Pendentes' }, { value: 'concluidas', label: 'Concluídas' },
];

export type Progresso = Record<string, { concluido: boolean; concluidoEm?: string; notas: string }>;
