import { http } from './http';
import type { RelatorioExport, SecaoRelatorio } from './exportarRelatorio';

/** Espelho de apps/api/src/codescan.ts. */
export type SevCodigo = 'critica' | 'alta' | 'media' | 'baixa' | 'info';
export type ModoVarredura = 'codebase' | 'changes' | 'attack-surface';
export type EsforcoVarredura = 'low' | 'medium' | 'high';
export type StatusVarredura = 'fila' | 'executando' | 'concluido' | 'erro';

export interface AchadoCodigo {
  id: string;
  regra: string;
  titulo: string;
  severidade: SevCodigo;
  cwe: string[];
  arquivo: string | null;
  linha: number | null;
  mensagem: string;
  recomendacao: string | null;
  confianca: string | null;
}

export interface PatchCodigo { nome: string; conteudo: string; nota: string | null }

export interface VarreduraResumo {
  id: string;
  repoUrl: string;
  branch: string | null;
  modo: ModoVarredura;
  esforco: EsforcoVarredura;
  status: StatusVarredura;
  commit: string | null;
  resumo: Partial<Record<SevCodigo, number>>;
  erro: string | null;
  criadoEm: string;
  iniciadoEm: string | null;
  concluidoEm: string | null;
}

export interface VarreduraDetalhe extends VarreduraResumo {
  achados: AchadoCodigo[];
  relatorioMd: string | null;
  patches: PatchCodigo[];
}

export const MODO_ROTULO: Record<ModoVarredura, string> = {
  codebase: 'Repositório inteiro',
  changes: 'Só as mudanças da branch',
  'attack-surface': 'Superfície de ataque (auditoria profunda, 1–2,5 h)',
};
export const ESFORCO_ROTULO: Record<EsforcoVarredura, string> = { low: 'Baixo', medium: 'Médio', high: 'Alto' };
export const STATUS_ROTULO: Record<StatusVarredura, string> = { fila: 'Na fila', executando: 'Executando', concluido: 'Concluída', erro: 'Erro' };

export const pedirVarredura = (p: { repoUrl: string; branch?: string; modo: ModoVarredura; esforco: EsforcoVarredura }) =>
  http.post<{ id: string }>('/codigo/varreduras', p).then((r) => r.data);
export const listarVarreduras = () => http.get<VarreduraResumo[]>('/codigo/varreduras').then((r) => r.data);
export const getVarredura = (id: string) => http.get<VarreduraDetalhe>(`/codigo/varreduras/${encodeURIComponent(id)}`).then((r) => r.data);
export const apagarVarredura = (id: string) => http.delete(`/codigo/varreduras/${encodeURIComponent(id)}`).then(() => undefined);

export const totalAchados = (r: Partial<Record<SevCodigo, number>>) =>
  (r.critica ?? 0) + (r.alta ?? 0) + (r.media ?? 0) + (r.baixa ?? 0) + (r.info ?? 0);

/** Relatório exportável (HTML/PDF) de uma revisão de código. */
export function relatorioDaRevisao(v: VarreduraDetalhe): RelatorioExport {
  const secoes: SecaoRelatorio[] = [
    {
      titulo: `Achados (${v.achados.length})`,
      texto: v.achados.length ? undefined : ['Nenhum achado reportado pelo plugin nesta varredura.'],
      itens: v.achados.map((a) => ({
        severidade: a.severidade,
        titulo: `${a.id} — ${a.titulo}${a.cwe.length ? ` (${a.cwe.join(', ')})` : ''}`,
        local: a.arquivo ? `${a.arquivo}${a.linha ? `:${a.linha}` : ''}` : undefined,
        detalhe: `${a.mensagem}${a.confianca ? ` · confiança: ${a.confianca}` : ''}`,
        recomendacao: a.recomendacao ?? undefined,
      })),
    },
  ];
  if (v.patches.length) {
    secoes.push({ titulo: `Patches sugeridos (${v.patches.length})`, texto: ['Aplicar um por vez, revisado, em PR próprio: git apply <arquivo>.patch'],
      tabela: { colunas: ['Arquivo', 'Nota'], linhas: v.patches.map((p) => [p.nome, (p.nota ?? '').slice(0, 300)]) } });
  }
  if (v.relatorioMd) secoes.push({ titulo: 'Relatório original do plugin (Markdown)', codigo: v.relatorioMd });
  return {
    titulo: 'Revisão de segurança de código',
    subtitulo: v.repoUrl,
    confidencial: true,
    meta: [
      ['Repositório', v.repoUrl], ['Branch', v.branch ?? 'padrão'], ['Commit', v.commit ?? '—'],
      ['Modo', MODO_ROTULO[v.modo]], ['Esforço', ESFORCO_ROTULO[v.esforco]],
      ['Concluída em', v.concluidoEm ? new Date(v.concluidoEm).toLocaleString('pt-BR') : '—'],
      ['Ferramenta', 'Plugin oficial claude-security, executado em sandbox Linux (sem rede além do modelo)'],
    ],
    resumo: { critica: v.resumo.critica ?? 0, alta: v.resumo.alta ?? 0, media: v.resumo.media ?? 0, baixa: v.resumo.baixa ?? 0, info: v.resumo.info ?? 0 },
    secoes,
  };
}

// ---------- varredura local (Claude Code na máquina do operador) ----------

export interface ArquivoLido { nome: string; texto: string }
export interface PacoteImportacao { sarif: unknown; relatorioMd?: string; patches: { nome: string; conteudo: string }[]; avisos: string[] }

/** Separa os arquivos do diretório CLAUDE-SECURITY-<ts> escolhidos pelo operador. Pura. */
export function montarImportacao(arquivos: ArquivoLido[]): PacoteImportacao {
  const avisos: string[] = [];
  let sarif: unknown;
  let relatorioMd: string | undefined;
  const patches: { nome: string; conteudo: string }[] = [];
  for (const a of arquivos) {
    const nome = a.nome.split(/[\/]/).pop() ?? a.nome;
    if (/\.sarif(\.json)?$/i.test(nome)) {
      try { sarif = JSON.parse(a.texto); } catch { avisos.push(`${nome}: não é JSON válido.`); }
    } else if (/\.md$/i.test(nome)) {
      // prefere o relatório principal se vierem vários .md
      if (!relatorioMd || /RESULTS/i.test(nome)) relatorioMd = a.texto;
    } else if (/\.patch$/i.test(nome)) {
      patches.push({ nome, conteudo: a.texto });
    } else {
      avisos.push(`${nome}: ignorado (use .sarif, .md ou .patch).`);
    }
  }
  if (sarif === undefined) avisos.unshift('Falta o arquivo CLAUDE-SECURITY-RESULTS.sarif.');
  return { sarif, relatorioMd, patches, avisos };
}

export const importarVarredura = (p: { nome: string; modo: ModoVarredura; esforco: EsforcoVarredura; commit?: string; sarif: unknown; relatorioMd?: string; patches: { nome: string; conteudo: string }[] }) =>
  http.post<{ id: string; achados: number }>('/codigo/varreduras/importar', p).then((r) => r.data);
