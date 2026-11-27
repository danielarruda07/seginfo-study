import type { ReactNode } from 'react';
import { Button } from 'primereact/button';
import { baixarHtml, imprimirPdf, type RelatorioExport } from '@/services/exportarRelatorio';

/**
 * Botões padrão de exportação de qualquer teste: HTML (arquivo autocontido) e PDF
 * (impressão do navegador → "Salvar como PDF"). `montar` só roda no clique, então o
 * relatório é montado com os dados do momento sem custo enquanto a tela está aberta.
 */
export function ExportarRelatorio({ montar, nome, children }: {
  montar: () => RelatorioExport;
  /** base do nome do arquivo (ex.: a URL testada) */
  nome: string;
  /** botões extras (Markdown, JSON…) */
  children?: ReactNode;
}) {
  return (
    <span className="iv-row" style={{ gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }} role="group" aria-label="Exportar resultado">
      <Button label="HTML" icon="pi pi-file-export" text size="small" onClick={() => baixarHtml(montar(), nome)} />
      <Button label="PDF" icon="pi pi-file-pdf" text size="small" onClick={() => imprimirPdf(montar())} />
      {children}
    </span>
  );
}
