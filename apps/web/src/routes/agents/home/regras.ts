import type { AgenteStatus } from '@seginfo/shared';
import type { Tone } from '@/theme/status';
import type { AgenteResumo } from '@/services/agentes';

export const STATUS_LABEL: Record<AgenteStatus, string> = {
  rascunho: 'Rascunho', teste: 'Em teste', ativo: 'Ativo', arquivado: 'Arquivado',
};

/** Selo do status: estado normal fica neutro (guia de UI: cor só onde há ação). */
export const STATUS_PILL: Record<AgenteStatus, { tone: Tone; icon: string }> = {
  rascunho: { tone: 'muted', icon: 'pi-pencil' },
  teste: { tone: 'info', icon: 'pi-play' },
  ativo: { tone: 'ok', icon: 'pi-check-circle' },
  arquivado: { tone: 'muted', icon: 'pi-inbox' },
};

/** Abaixo disso a avaliação não conta como aprovada. */
export const TAXA_MINIMA = 80;

export const taxaOk = (a: Pick<AgenteResumo, 'avaliacoes'>): number | null =>
  a.avaliacoes.total ? Math.round((a.avaliacoes.ok / a.avaliacoes.total) * 100) : null;

// ---------- ciclo de vida ----------

export interface Etapa { rotulo: string; feita: boolean; dica: string }

/** As 4 etapas que um agente atravessa até ser confiável: projetar, executar, avaliar, ativar. */
export function etapas(a: AgenteResumo): Etapa[] {
  const taxa = taxaOk(a);
  return [
    { rotulo: 'Projeto', feita: !!a.revisao && a.revisao.erros === 0, dica: 'Configuração sem pendências graves' },
    { rotulo: 'Execução', feita: !!a.ultimaExecucao, dica: 'Rodou ao menos uma vez no playground' },
    { rotulo: 'Avaliação', feita: taxa !== null && taxa >= TAXA_MINIMA, dica: `${TAXA_MINIMA}% ou mais dos casos de teste ok` },
    { rotulo: 'Ativo', feita: a.status === 'ativo', dica: 'Liberado para uso' },
  ];
}

export type DestinoPasso = 'editor' | 'playground' | 'aprovacao' | 'avaliacoes';

export interface ProximoPasso {
  rotulo: string;
  detalhe: string;
  tone: Tone;
  icon: string;
  destino: DestinoPasso;
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios.replace('#', String(n)));

/**
 * O que fazer agora com este agente, na ordem em que importa: decisão humana pendente,
 * configuração quebrada, nunca executado, sem testes, taxa baixa, pronto para ativar.
 * null = nada a fazer (ativo e em dia, ou arquivado).
 */
export function proximoPasso(a: AgenteResumo): ProximoPasso | null {
  if (a.status === 'arquivado') return null;
  const pend = a.aguardandoAprovacao?.total ?? 0;
  if (pend > 0) {
    return {
      rotulo: plural(pend, 'Decidir uma ação pendente', 'Decidir # ações pendentes'),
      detalhe: 'O agente pausou numa ação de escrita e espera a sua aprovação.',
      tone: 'serious', icon: 'pi-hourglass', destino: 'aprovacao',
    };
  }
  if (!a.revisao) {
    return {
      rotulo: 'Revisar a configuração',
      detalhe: 'O formato salvo mudou desde a última edição. Abra e salve de novo.',
      tone: 'danger', icon: 'pi-exclamation-circle', destino: 'editor',
    };
  }
  if (a.revisao.erros > 0) {
    return {
      rotulo: plural(a.revisao.erros, 'Resolver uma pendência grave', 'Resolver # pendências graves'),
      detalhe: 'Sem isso ele não pode ser ativado.',
      tone: 'danger', icon: 'pi-exclamation-circle', destino: 'editor',
    };
  }
  if (!a.ultimaExecucao) {
    return {
      rotulo: 'Testar no playground',
      detalhe: 'Converse com ele e veja cada passo do laço.',
      tone: 'info', icon: 'pi-play', destino: 'playground',
    };
  }
  const taxa = taxaOk(a);
  if (taxa === null) {
    return {
      rotulo: 'Registrar casos de teste',
      detalhe: 'Sem avaliação não dá para saber se ele funciona.',
      tone: 'warning', icon: 'pi-check-square', destino: 'avaliacoes',
    };
  }
  if (taxa < TAXA_MINIMA) {
    return {
      rotulo: 'Melhorar a taxa de acerto',
      detalhe: `${taxa}% ok em ${a.avaliacoes.total} caso(s); a meta é ${TAXA_MINIMA}%.`,
      tone: 'warning', icon: 'pi-chart-line', destino: 'avaliacoes',
    };
  }
  if (a.status !== 'ativo') {
    return {
      rotulo: 'Pronto para ativar',
      detalhe: 'Testado e sem pendências graves.',
      tone: 'ok', icon: 'pi-check-circle', destino: 'editor',
    };
  }
  if (a.revisao.avisos > 0) {
    return {
      rotulo: plural(a.revisao.avisos, 'Revisar um aviso', 'Revisar # avisos'),
      detalhe: 'Não bloqueia, mas vale olhar.',
      tone: 'muted', icon: 'pi-info-circle', destino: 'editor',
    };
  }
  return null;
}

/** Precisa de você = algo que bloqueia ou espera decisão. */
export const precisaDeVoce = (a: AgenteResumo) => {
  const p = proximoPasso(a);
  return !!p && (p.tone === 'danger' || p.tone === 'serious');
};

// ---------- filtro e ordem ----------

export type FiltroStatus = AgenteStatus | 'todos';

export interface FiltroAgentes {
  status: FiltroStatus;
  busca: string;
  soPendentes: boolean;
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarAgentes(lista: AgenteResumo[], f: FiltroAgentes): AgenteResumo[] {
  const termo = normalizar(f.busca.trim());
  return lista.filter((a) => {
    if (f.status === 'todos' ? a.status === 'arquivado' : a.status !== f.status) return false;
    if (f.soPendentes && !precisaDeVoce(a)) return false;
    if (!termo) return true;
    return normalizar([a.nome, a.resumo, ...a.baseTags].join(' ')).includes(termo);
  });
}

/** O que pede você primeiro; o resto mantém a ordem da API (editado mais recente primeiro). */
export function ordenarAgentes(lista: AgenteResumo[]): AgenteResumo[] {
  const peso = (a: AgenteResumo) => (precisaDeVoce(a) ? 0 : 1);
  return lista.map((a, i) => ({ a, i })).sort((x, y) => peso(x.a) - peso(y.a) || x.i - y.i).map((x) => x.a);
}

export function contarPorStatus(lista: AgenteResumo[]): Record<FiltroStatus, number> {
  const c: Record<FiltroStatus, number> = { todos: 0, ativo: 0, teste: 0, rascunho: 0, arquivado: 0 };
  for (const a of lista) {
    c[a.status]++;
    if (a.status !== 'arquivado') c.todos++;
  }
  return c;
}

// ---------- texto ----------

/** "agora", "há 5 min", "há 3 h", "há 2 dias" ou a data (dd/mm/aaaa) depois de 30 dias. */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  const s = Math.max(0, (agora.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `há ${Math.floor(s / 3600)} h`;
  const dias = Math.floor(s / 86_400);
  if (dias <= 30) return dias === 1 ? 'ontem' : `há ${dias} dias`;
  return d.toLocaleDateString('pt-BR');
}
