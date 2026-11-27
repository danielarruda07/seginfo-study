/**
 * Gerador PURO de relatório HTML autocontido (usado pelo navegador e pelos CLIs).
 * As funções de navegador (baixar, imprimir em PDF) ficam em apps/web/src/services/exportarRelatorio.ts.
 *
 * Exportação de resultados de teste em HTML autocontido e em PDF.
 *
 * Todo teste da plataforma descreve o resultado num `RelatorioExport` (modelo neutro) e
 * usa estas funções para baixar o HTML ou abrir a impressão em PDF. O HTML é um arquivo
 * único (CSS embutido, sem script, sem recurso externo), pronto para anexar a um laudo.
 *
 * SEGURANÇA: o conteúdo vem em parte do alvo testado (cabeçalhos, corpos, nomes de arquivo).
 * Tudo passa por `escaparHtml` antes de entrar no documento — nunca monte HTML cru aqui.
 */

export type SevRelatorio = 'critica' | 'alta' | 'media' | 'baixa' | 'info' | 'ok';

export interface ItemRelatorio {
  severidade?: SevRelatorio;
  titulo: string;
  detalhe?: string;
  recomendacao?: string;
  /** arquivo:linha, URL, parâmetro… */
  local?: string;
}

export interface SecaoRelatorio {
  titulo: string;
  texto?: string[];
  itens?: ItemRelatorio[];
  tabela?: { colunas: string[]; linhas: (string | number | null | undefined)[][] };
  /** bloco monoespaçado (trecho de código, cabeçalhos crus) */
  codigo?: string;
}

export interface RelatorioExport {
  titulo: string;
  subtitulo?: string;
  /** pares rótulo/valor do cabeçalho (alvo, data, escopo…) */
  meta?: [string, string][];
  resumo?: Partial<Record<'critica' | 'alta' | 'media' | 'baixa' | 'info', number>>;
  secoes: SecaoRelatorio[];
  confidencial?: boolean;
  rodape?: string;
}

const ROTULO: Record<SevRelatorio, string> = {
  critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa', info: 'Info', ok: 'OK',
};

export function escaparHtml(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
:root{--fg:#1b2333;--muted:#5b6578;--line:#dde2ea;--bg:#fff;--soft:#f5f7fa;
--critica:#7a0d1f;--alta:#c0392b;--media:#d68910;--baixa:#2e86c1;--info:#6c7a89;--ok:#1e8449}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);
font:14px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:960px;margin:0 auto;padding:32px 28px 48px}
header{border-bottom:3px solid var(--fg);padding-bottom:14px;margin-bottom:22px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px;padding-bottom:4px;border-bottom:1px solid var(--line)}
.sub{color:var(--muted);margin:0}.conf{display:inline-block;margin-top:8px;padding:2px 8px;border:1px solid var(--alta);
color:var(--alta);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
dl.meta{display:grid;grid-template-columns:max-content 1fr;gap:4px 16px;margin:16px 0 0}
dl.meta dt{color:var(--muted)}dl.meta dd{margin:0;word-break:break-word}
.resumo{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 0}
.kpi{flex:1 1 110px;border:1px solid var(--line);border-left-width:4px;padding:8px 12px;background:var(--soft)}
.kpi b{display:block;font-size:22px}.kpi span{color:var(--muted);font-size:12px}
.k-critica{border-left-color:var(--critica)}.k-alta{border-left-color:var(--alta)}.k-media{border-left-color:var(--media)}
.k-baixa{border-left-color:var(--baixa)}.k-info{border-left-color:var(--info)}
.item{border:1px solid var(--line);border-left:4px solid var(--info);padding:10px 12px;margin:0 0 10px;break-inside:avoid}
.item h3{font-size:14px;margin:0 0 4px}.item p{margin:4px 0}.item .loc{font-family:Consolas,monospace;font-size:12px;color:var(--muted)}
.item .rec{background:var(--soft);padding:6px 8px;margin-top:6px}
.s-critica{border-left-color:var(--critica)}.s-alta{border-left-color:var(--alta)}.s-media{border-left-color:var(--media)}
.s-baixa{border-left-color:var(--baixa)}.s-info{border-left-color:var(--info)}.s-ok{border-left-color:var(--ok)}
.tag{display:inline-block;font-size:11px;font-weight:700;color:#fff;padding:1px 7px;margin-right:6px;vertical-align:1px}
.t-critica{background:var(--critica)}.t-alta{background:var(--alta)}.t-media{background:var(--media)}
.t-baixa{background:var(--baixa)}.t-info{background:var(--info)}.t-ok{background:var(--ok)}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top;word-break:break-word}
th{background:var(--soft)}pre{background:var(--soft);border:1px solid var(--line);padding:10px;overflow:auto;
font:12px/1.4 Consolas,monospace;white-space:pre-wrap;word-break:break-word}
footer{margin-top:36px;padding-top:10px;border-top:1px solid var(--line);color:var(--muted);font-size:12px}
@page{size:A4;margin:16mm 14mm}
@media print{main{padding:0;max-width:none}h2{break-after:avoid}.item,.kpi{break-inside:avoid}}
`;

function secaoHtml(s: SecaoRelatorio): string {
  const partes: string[] = [`<h2>${escaparHtml(s.titulo)}</h2>`];
  for (const t of s.texto ?? []) partes.push(`<p>${escaparHtml(t)}</p>`);
  for (const it of s.itens ?? []) {
    const sev = it.severidade ?? 'info';
    partes.push(
      `<div class="item s-${sev}"><h3>${it.severidade ? `<span class="tag t-${sev}">${ROTULO[sev]}</span>` : ''}${escaparHtml(it.titulo)}</h3>`
      + (it.local ? `<div class="loc">${escaparHtml(it.local)}</div>` : '')
      + (it.detalhe ? `<p>${escaparHtml(it.detalhe)}</p>` : '')
      + (it.recomendacao ? `<p class="rec"><strong>Recomendação:</strong> ${escaparHtml(it.recomendacao)}</p>` : '')
      + '</div>',
    );
  }
  if (s.tabela && s.tabela.linhas.length) {
    partes.push(
      '<table><thead><tr>' + s.tabela.colunas.map((c) => `<th>${escaparHtml(c)}</th>`).join('') + '</tr></thead><tbody>'
      + s.tabela.linhas.map((l) => '<tr>' + l.map((c) => `<td>${escaparHtml(c ?? '—')}</td>`).join('') + '</tr>').join('')
      + '</tbody></table>',
    );
  }
  if (s.codigo) partes.push(`<pre>${escaparHtml(s.codigo)}</pre>`);
  return partes.join('\n');
}

/** Gera o documento HTML completo (puro, testável). */
export function gerarHtmlRelatorio(r: RelatorioExport, geradoEm = new Date()): string {
  const resumo = r.resumo
    ? '<div class="resumo">' + (['critica', 'alta', 'media', 'baixa', 'info'] as const)
      .filter((k) => r.resumo?.[k] !== undefined)
      .map((k) => `<div class="kpi k-${k}"><b>${escaparHtml(r.resumo?.[k] ?? 0)}</b><span>${ROTULO[k]}</span></div>`)
      .join('') + '</div>'
    : '';
  const meta = r.meta?.length
    ? '<dl class="meta">' + r.meta.map(([k, v]) => `<dt>${escaparHtml(k)}</dt><dd>${escaparHtml(v)}</dd>`).join('') + '</dl>'
    : '';
  const rodape = r.rodape ?? 'Gerado pela plataforma SegInfo. Uso restrito a alvos autorizados.';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escaparHtml(r.titulo)}</title><style>${CSS}</style></head>
<body><main>
<header><h1>${escaparHtml(r.titulo)}</h1>${r.subtitulo ? `<p class="sub">${escaparHtml(r.subtitulo)}</p>` : ''}
${r.confidencial ? '<span class="conf">Confidencial — uso interno restrito</span>' : ''}${meta}${resumo}</header>
${r.secoes.map(secaoHtml).join('\n')}
<footer>${escaparHtml(rodape)} · Gerado em ${escaparHtml(geradoEm.toLocaleString('pt-BR'))}</footer>
</main></body></html>`;
}

/** Nome de arquivo seguro a partir de um texto livre (URL, alvo…). */
export function nomeArquivoRelatorio(base: string, ext: string): string {
  const limpo = base.replace(/^https?:\/\//, '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 70) || 'relatorio';
  return `${limpo}.${ext}`;
}
