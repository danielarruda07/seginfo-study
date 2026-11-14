import { useQuery } from '@tanstack/react-query';
import { getAnotacoes, getRevisoes, listTopicos, progressoPorTrilha } from '@/services/catalog';
import { listMetas, listSessoes } from '@/services/sessoes';
import { todayISO } from '@/services/store';
import { useInvalidate } from '@/hooks/useInvalidate';

/** Todas as chaves de query que mostram dados de estudo (painel, trilhas, tópicos, sessões, metas). */
const CHAVES_ESTUDO = ['topicos', 'resumo-topicos', 'dashboard', 'trilhas', 'sessoes', 'metas', 'estudo'];

/** Depois de mudar status, sessão, meta, revisão ou anotação: atualiza todas as telas de estudo. */
export function useInvalidarEstudo() {
  const invalidate = useInvalidate();
  return () => invalidate(...CHAVES_ESTUDO);
}

function lerBase() {
  return {
    hoje: todayISO(),
    sessoes: listSessoes(),
    metas: listMetas(),
    revisoes: getRevisoes(),
    anotacoes: getAnotacoes(),
    topicos: listTopicos({ rows: 10_000 }).items,
    progresso: progressoPorTrilha(),
  };
}
export type BaseEstudo = ReturnType<typeof lerBase>;

/** Dados locais usados pelas fichas laterais (leitura síncrona do armazenamento local). */
export function useBaseEstudo(): BaseEstudo {
  return useQuery({ queryKey: ['estudo', 'base'], queryFn: lerBase, initialData: lerBase }).data;
}
