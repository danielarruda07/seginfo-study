import { CANAIS_ENTRADA_DE_TERCEIROS, type AgenteConfig, type AvaliacaoResultado, type CanalAgente, type ExecucaoStatus } from '@seginfo/shared';
import type { Tone } from '@/theme/status';
import type { FerramentaCatalogo, Risco } from '@/data/agentesFerramentas';
import type { AcaoAuditoria, Avaliacao, RuntimeInfo } from '@/services/agentes';

/**
 * Regras puras da seção Agents fora da home: rótulos com tom (nunca hex), formatação,
 * resumo dos 8 pilares e cruzamentos usados pelas fichas laterais.
 */

export interface Meta { rotulo: string; tone: Tone; icon: string }

export const STATUS_EXEC: Record<ExecucaoStatus, Meta> = {
  rodando: { rotulo: 'Rodando', tone: 'info', icon: 'pi-spin pi-spinner' },
  aguardando_aprovacao: { rotulo: 'Aguardando aprovação', tone: 'serious', icon: 'pi-hourglass' },
  concluida: { rotulo: 'Concluída', tone: 'muted', icon: 'pi-check' },
  limite: { rotulo: 'Parou no limite', tone: 'warning', icon: 'pi-stopwatch' },
  recusada: { rotulo: 'Recusada', tone: 'warning', icon: 'pi-ban' },
  erro: { rotulo: 'Erro', tone: 'danger', icon: 'pi-times-circle' },
};

export const RESULTADO_META: Record<AvaliacaoResultado, Meta> = {
  ok: { rotulo: 'Ok', tone: 'ok', icon: 'pi-check' },
  parcial: { rotulo: 'Parcial', tone: 'warning', icon: 'pi-minus-circle' },
  falha: { rotulo: 'Falha', tone: 'danger', icon: 'pi-times' },
};

/** Risco baixo fica neutro (cor só onde pede atenção). */
export const RISCO_TONE: Record<Risco, Tone> = { baixo: 'muted', medio: 'warning', alto: 'danger' };

export const DECISAO_META: Record<AcaoAuditoria['decisao'], Meta> = {
  automatica: { rotulo: 'Leitura (automática)', tone: 'muted', icon: 'pi-eye' },
  aprovada: { rotulo: 'Escrita aprovada', tone: 'info', icon: 'pi-check' },
  negada: { rotulo: 'Escrita negada', tone: 'muted', icon: 'pi-ban' },
  autonoma: { rotulo: 'Escrita leve (autônoma)', tone: 'info', icon: 'pi-bolt' },
};

export const CANAL_LABEL: Record<CanalAgente, string> = {
  chat: 'Conversa', web: 'Aplicação web', api: 'API', slack: 'Slack', discord: 'Discord',
  telegram: 'Telegram', whatsapp: 'WhatsApp', email: 'E-mail',
};

// ---------- formatação ----------

/** 850 ms · 1,2 s · 2 min 5 s */
export function duracao(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1).replace('.', ',')} s`;
  const min = Math.floor(s / 60);
  const resto = Math.round(s - min * 60);
  return resto ? `${min} min ${resto} s` : `${min} min`;
}

export const numero = (n: number) => n.toLocaleString('pt-BR');

export const truncar = (s: string, max: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Texto para um bloco de código: objeto vira JSON indentado; string que é JSON também. */
export function formatarJson(v: unknown): string {
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return v; }
    }
    return v;
  }
  if (v === undefined) return '';
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

// ---------- placar das avaliações ----------

export interface Placar { total: number; ok: number; parcial: number; falha: number; pct: number | null; latMedia: number | null; comLatencia: number }

export function placar(itens: Pick<Avaliacao, 'resultado' | 'latenciaMs'>[]): Placar {
  const conta = (r: AvaliacaoResultado) => itens.filter((i) => i.resultado === r).length;
  const ok = conta('ok');
  const lat = itens.map((i) => i.latenciaMs).filter((x): x is number => x !== null);
  return {
    total: itens.length, ok, parcial: conta('parcial'), falha: conta('falha'),
    pct: itens.length ? Math.round((ok / itens.length) * 100) : null,
    latMedia: lat.length ? Math.round(lat.reduce((s, x) => s + x, 0) / lat.length) : null,
    comLatencia: lat.length,
  };
}

// ---------- os 8 pilares de um agente ----------

export interface PilarResumo { numero: number; titulo: string; ok: boolean; texto: string }

const vazio = (s: string) => s.trim().length === 0;
const primeiraLinha = (s: string, max = 110) => truncar(s.split('\n').find((l) => l.trim()) ?? '', max);

/** Uma linha por pilar: o que está decidido e se falta algo importante. */
export function resumoPilares(c: AgenteConfig): PilarResumo[] {
  const escrita = c.ferramentas.filter((f) => f.permissao === 'escrita');
  const semAprovacao = escrita.filter((f) => !f.exigeAprovacao).length;
  const memorias = ([['episodica', 'episódica'], ['trabalho', 'de trabalho'], ['vetorial', 'vetorial'], ['sql', 'SQL'], ['arquivos', 'arquivos']] as const)
    .filter(([k]) => c.memoria[k]).map(([, r]) => r);
  const persistente = c.memoria.episodica || c.memoria.vetorial || c.memoria.sql || c.memoria.arquivos;
  const terceiros = c.interface.canais.some((x) => CANAIS_ENTRADA_DE_TERCEIROS.includes(x));
  const base = c.conhecimento.tags.length ? ` · base: ${c.conhecimento.tags.map((t) => `#${t}`).join(' ')}` : '';

  return [
    { numero: 1, titulo: 'Propósito', ok: !vazio(c.proposito.casoDeUso), texto: primeiraLinha(c.proposito.casoDeUso) || 'Caso de uso não descrito' },
    {
      numero: 2, titulo: 'Instruções', ok: !vazio(c.instrucoes.instrucoes),
      texto: vazio(c.instrucoes.instrucoes) ? 'Sem instruções do sistema'
        : `${primeiraLinha(c.instrucoes.papel, 70) || 'Papel não definido'} · ${numero(c.instrucoes.instrucoes.length)} caracteres`,
    },
    { numero: 3, titulo: 'Modelo', ok: !vazio(c.modelo.nome), texto: vazio(c.modelo.nome) ? 'Modelo não escolhido' : `${c.modelo.nome} · temperatura ${c.modelo.temperatura}` },
    {
      numero: 4, titulo: 'Ferramentas', ok: semAprovacao === 0,
      texto: c.ferramentas.length === 0 ? 'Nenhuma (só conversa)'
        : `${c.ferramentas.length - escrita.length} de leitura, ${escrita.length} de escrita${semAprovacao ? ` (${semAprovacao} sem aprovação)` : ''}`,
    },
    {
      numero: 5, titulo: 'Memória', ok: !persistente || !vazio(c.memoria.privacidade),
      texto: `${memorias.length ? `Memória ${memorias.join(', ')}` : 'Sem memória'}${base}`,
    },
    { numero: 6, titulo: 'Orquestração', ok: !vazio(c.orquestracao.tratamentoErros), texto: primeiraLinha(c.orquestracao.fluxo) || 'Fluxo não descrito' },
    {
      numero: 7, titulo: 'Interface', ok: !(terceiros && c.ferramentas.length > 0),
      texto: c.interface.canais.length ? c.interface.canais.map((x) => CANAL_LABEL[x]).join(', ') : 'Nenhum canal',
    },
    {
      numero: 8, titulo: 'Supervisão', ok: escrita.length === 0 || (!vazio(c.supervisao.decisoesCriticas) && c.supervisao.registroAuditoria),
      texto: `${c.supervisao.registroAuditoria ? 'Com registro de auditoria' : 'Sem registro de auditoria'}${vazio(c.supervisao.decisoesCriticas) ? '' : ' · decisões críticas listadas'}`,
    },
  ];
}

// ---------- ferramentas: servidor e uso ----------

export type EstadoServidor = 'pronta' | 'falta-config' | 'so-projeto';

export interface FerramentaNoServidor {
  estado: EstadoServidor;
  /** ferramentas reais que o servidor executa para este id do catálogo */
  reais: RuntimeInfo['ferramentas'];
  faltando: string[];
}

export function noServidor(runtime: RuntimeInfo['ferramentas'] | undefined, id: string): FerramentaNoServidor {
  const reais = (runtime ?? []).filter((r) => r.id === id);
  const faltando = [...new Set(reais.flatMap((r) => r.faltando))];
  const estado: EstadoServidor = reais.length === 0 ? 'so-projeto' : faltando.length ? 'falta-config' : 'pronta';
  return { estado, reais, faltando };
}

export const ESTADO_SERVIDOR: Record<EstadoServidor, Meta> = {
  pronta: { rotulo: 'Executa no servidor', tone: 'ok', icon: 'pi-server' },
  'falta-config': { rotulo: 'Falta configurar', tone: 'serious', icon: 'pi-exclamation-triangle' },
  'so-projeto': { rotulo: 'Só no projeto', tone: 'muted', icon: 'pi-file-edit' },
};

export interface UsoFerramenta { agenteId: string; agenteNome: string; permissao: 'leitura' | 'escrita'; exigeAprovacao: boolean }

/** Quais agentes ligaram esta ferramenta do catálogo, e com que permissão. */
export function agentesQueUsam(agentes: { id: string; nome: string; config: AgenteConfig }[], ferramentaId: string): UsoFerramenta[] {
  return agentes.flatMap((a) => a.config.ferramentas
    .filter((f) => f.id === ferramentaId)
    .map((f) => ({ agenteId: a.id, agenteNome: a.nome, permissao: f.permissao, exigeAprovacao: f.exigeAprovacao })));
}

export type AcaoComId = AcaoAuditoria & { id: string };

/**
 * A auditoria não tem id por ação (uma execução pode ter várias). O id usa a ordem da ação
 * dentro da execução, que não muda quando o filtro muda.
 */
export function comIds(acoes: AcaoAuditoria[]): AcaoComId[] {
  const vistos = new Map<string, number>();
  return acoes.map((a) => {
    const n = vistos.get(a.execucaoId) ?? 0;
    vistos.set(a.execucaoId, n + 1);
    return { ...a, id: `${a.execucaoId}#${n}` };
  });
}

// ---------- catálogo de ferramentas: filtro ----------

export interface FiltroFerramentas {
  categoria?: FerramentaCatalogo['categoria'];
  risco?: Risco;
  /** só as que o servidor executa mas faltam variáveis */
  faltaConfig?: boolean;
  busca: string;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filtrarFerramentas(lista: FerramentaCatalogo[], f: FiltroFerramentas, runtime?: RuntimeInfo['ferramentas']): FerramentaCatalogo[] {
  const termo = semAcento(f.busca.trim());
  return lista.filter((x) => {
    if (f.categoria && x.categoria !== f.categoria) return false;
    if (f.risco && x.risco !== f.risco) return false;
    if (f.faltaConfig && noServidor(runtime, x.id).estado !== 'falta-config') return false;
    return !termo || semAcento(`${x.nome} ${x.descricao} ${x.cuidados}`).includes(termo);
  });
}
