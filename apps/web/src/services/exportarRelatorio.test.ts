import { describe, expect, it } from 'vitest';
import { escaparHtml, gerarHtmlRelatorio, nomeArquivoRelatorio, type RelatorioExport } from './exportarRelatorio';

const base: RelatorioExport = {
  titulo: 'Laudo de teste',
  subtitulo: 'https://api.exemplo.com',
  meta: [['Alvo', 'https://api.exemplo.com'], ['Escopo', 'externo']],
  resumo: { alta: 1, media: 2, baixa: 0, info: 3 },
  confidencial: true,
  secoes: [
    { titulo: 'Achados', itens: [{ severidade: 'alta', titulo: 'CORS reflete origem', detalhe: 'x', recomendacao: 'allowlist', local: '/api/v1' }] },
    { titulo: 'Cabeçalhos', tabela: { colunas: ['Nome', 'Valor'], linhas: [['HSTS', null]] } },
  ],
};

describe('exportarRelatorio', () => {
  it('escapa HTML', () => {
    expect(escaparHtml('<script>alert("x")</script>&\'')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;');
    expect(escaparHtml(null)).toBe('');
  });

  it('gera documento completo com título, meta, resumo, itens e tabela', () => {
    const html = gerarHtmlRelatorio(base, new Date('2026-11-27T10:00:00Z'));
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Laudo de teste</title>');
    expect(html).toContain('Confidencial');
    expect(html).toContain('<dt>Escopo</dt><dd>externo</dd>');
    expect(html).toContain('class="kpi k-alta"><b>1</b>');
    expect(html).toContain('<span class="tag t-alta">Alta</span>CORS reflete origem');
    expect(html).toContain('<strong>Recomendação:</strong> allowlist');
    expect(html).toContain('<td>—</td>'); // célula nula vira traço
    expect(html).not.toContain('<script');
  });

  it('conteúdo vindo do alvo nunca vira HTML ativo', () => {
    const malicioso: RelatorioExport = {
      titulo: '<img src=x onerror=alert(1)>',
      secoes: [{ titulo: 's', itens: [{ titulo: '"><script>x</script>', detalhe: '<iframe src=//mal>' }], codigo: '</pre><script>y</script>' }],
    };
    const html = gerarHtmlRelatorio(malicioso);
    expect(html).not.toMatch(/<script|<img|<iframe/i);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('nome de arquivo seguro', () => {
    expect(nomeArquivoRelatorio('https://api.exemplo.com/v1?a=b', 'html')).toBe('api.exemplo.com_v1_a_b.html');
    expect(nomeArquivoRelatorio('', 'pdf')).toBe('relatorio.pdf');
  });
});
