import type { FerramentaCatalogo, Lab, RangeAlvo } from '@seginfo/shared';
import { alvosComFerramenta, labsDaFerramenta } from '../pratica/relacoes';

/** Contagens que o cartão e os filtros do Arsenal usam (testado em resumo.test.ts). */
export interface ResumoFerramenta { registros: number; pendencias: number; labs: number; alvos: number }

export function resumirFerramenta(
  f: FerramentaCatalogo,
  experiencias: readonly { ferramentaId: string; tipo: string }[],
  labs: readonly Lab[],
  alvos: readonly RangeAlvo[],
): ResumoFerramenta {
  const minhas = experiencias.filter((e) => e.ferramentaId === f.id);
  return {
    registros: minhas.length,
    pendencias: minhas.filter((e) => e.tipo === 'pendencia').length,
    labs: labsDaFerramenta(f, labs).length,
    alvos: alvosComFerramenta(f, alvos).length,
  };
}

export type FiltroUso = 'registro' | 'pendencia' | 'kali' | 'range';

export const FILTRO_USO_LABEL: Record<FiltroUso, string> = {
  registro: 'Com registro seu', pendencia: 'Com pendência', kali: 'Vem no Kali', range: 'Prevista no Range',
};

export function passaFiltroUso(f: FerramentaCatalogo, r: ResumoFerramenta, filtro: FiltroUso | undefined): boolean {
  if (!filtro) return true;
  if (filtro === 'registro') return r.registros > 0;
  if (filtro === 'pendencia') return r.pendencias > 0;
  if (filtro === 'kali') return f.kali;
  return r.alvos > 0;
}
