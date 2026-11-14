import type { Lab, StatusEstudo, Topico, Trilha } from '@seginfo/shared';
import type { ProgressoLab } from '@/services/inventario';

/** Montagem pura do portfólio (só progresso de estudo; nada do inventário). Testes em regras.test.ts. */

export type ItemPortfolio =
  | { id: string; tipo: 'trilha'; trilha: Trilha; topicos: Topico[] }
  | { id: string; tipo: 'lab'; lab: Lab; progresso: ProgressoLab }
  | { id: string; tipo: 'topico'; topico: Topico; trilha?: Trilha };

export const NIVEL_LABEL: Record<Topico['nivel'], string> = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };

export interface Portfolio {
  trilhas: Extract<ItemPortfolio, { tipo: 'trilha' }>[];
  labs: Extract<ItemPortfolio, { tipo: 'lab' }>[];
  topicos: Extract<ItemPortfolio, { tipo: 'topico' }>[];
  /** ordem de navegação ↑/↓ na ficha: trilhas, labs, tópicos */
  todos: ItemPortfolio[];
}

export function montarPortfolio(entrada: {
  trilhas: Trilha[];
  topicos: Topico[];
  status: Record<string, StatusEstudo>;
  labs: Lab[];
  progressoLab: (id: string) => ProgressoLab;
}): Portfolio {
  const concluido = (t: Topico) => entrada.status[t.id] === 'concluido';
  const trilhaPorId = new Map(entrada.trilhas.map((t) => [t.id, t]));

  const trilhas = [...entrada.trilhas].sort((a, b) => a.ordem - b.ordem).flatMap((tr) => {
    const doTr = entrada.topicos.filter((t) => t.trilhaId === tr.id);
    return doTr.length > 0 && doTr.every(concluido) ? [{ id: `trilha:${tr.id}`, tipo: 'trilha' as const, trilha: tr, topicos: doTr }] : [];
  });

  const labs = entrada.labs
    .map((lab) => ({ id: `lab:${lab.id}`, tipo: 'lab' as const, lab, progresso: entrada.progressoLab(lab.id) }))
    .filter((x) => x.progresso.status === 'concluido')
    .sort((a, b) => (b.progresso.concluidoEm ?? '').localeCompare(a.progresso.concluidoEm ?? ''));

  const topicos = entrada.topicos.filter(concluido)
    .map((t) => ({ id: `topico:${t.id}`, tipo: 'topico' as const, topico: t, trilha: trilhaPorId.get(t.trilhaId) }));

  return { trilhas, labs, topicos, todos: [...trilhas, ...labs, ...topicos] };
}
