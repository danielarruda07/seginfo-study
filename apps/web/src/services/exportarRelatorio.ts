/**
 * Exportação de resultados de teste no navegador: baixar HTML e imprimir em PDF.
 * O gerador puro (modelo, escape, HTML) vive em @seginfo/shared (relatorioHtml.ts) para ser
 * reaproveitado pelos CLIs; aqui só o que depende do DOM.
 */
import { gerarHtmlRelatorio, nomeArquivoRelatorio, type RelatorioExport } from '@seginfo/shared';

export {
  escaparHtml, gerarHtmlRelatorio, nomeArquivoRelatorio,
  type RelatorioExport, type SecaoRelatorio, type ItemRelatorio, type SevRelatorio,
} from '@seginfo/shared';

/** Baixa o relatório como arquivo .html. */
export function baixarHtml(r: RelatorioExport, nomeBase: string): void {
  const blob = new Blob([gerarHtmlRelatorio(r)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivoRelatorio(nomeBase, 'html');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

/**
 * Abre a caixa de impressão do navegador com o relatório — escolha "Salvar como PDF".
 * Usa um iframe oculto (não é bloqueado como pop-up) e o remove depois.
 */
export function imprimirPdf(r: RelatorioExport): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  iframe.srcdoc = gerarHtmlRelatorio(r);
  iframe.onload = () => {
    const w = iframe.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
    setTimeout(() => iframe.remove(), 60_000);
  };
  document.body.appendChild(iframe);
}
