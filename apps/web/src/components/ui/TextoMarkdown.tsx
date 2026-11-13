import type { ReactNode } from 'react';

/**
 * Renderiza o Markdown básico que os modelos de IA costumam devolver: títulos, listas,
 * negrito, itálico, código e blocos de código. Monta elementos React, nunca HTML cru,
 * então o texto do modelo não consegue injetar marcação na página.
 */

/** Negrito, itálico e código dentro de uma linha. */
function emLinha(texto: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*)/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push(texto.slice(ultimo, i));
    const t = m[0];
    if (t.startsWith('`')) partes.push(<code key={i}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('**')) partes.push(<strong key={i}>{t.slice(2, -2)}</strong>);
    else partes.push(<em key={i}>{t.slice(1, -1)}</em>);
    ultimo = i + t.length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/;
const NUMERADO = /^\s*\d+[.)]\s+/;
const TITULO = /^(#{1,4})\s+(.*)$/;
const TABELA = /^\s*\|.*\|\s*$/;
const SEPARADOR = /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/;
const celulas = (linha: string) => linha.trim().slice(1, -1).split('|').map((c) => c.trim());

export function TextoMarkdown({ texto }: { texto: string }) {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n');
  const blocos: ReactNode[] = [];
  let i = 0;

  while (i < linhas.length) {
    const linha = linhas[i];

    if (linha.trim() === '') { i++; continue; }

    if (linha.trimStart().startsWith('```')) {
      const codigo: string[] = [];
      i++;
      while (i < linhas.length && !linhas[i].trimStart().startsWith('```')) codigo.push(linhas[i++]);
      i++; // fecha o bloco
      blocos.push(
        <pre key={blocos.length} style={{ whiteSpace: 'pre-wrap', background: '#0d0c2b', color: '#e6e6f0', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, overflow: 'auto', margin: '.5rem 0' }}>
          {codigo.join('\n')}
        </pre>,
      );
      continue;
    }

    // tabela: linha de cabeçalho, linha separadora (|---|---|) e as linhas de dados
    if (TABELA.test(linha) && i + 1 < linhas.length && SEPARADOR.test(linhas[i + 1])) {
      const cabecalho = celulas(linha);
      const corpo: string[][] = [];
      i += 2;
      while (i < linhas.length && TABELA.test(linhas[i])) corpo.push(celulas(linhas[i++]));
      const borda = '1px solid var(--surface-300, #cbd5e1)';
      const celula = { border: borda, padding: '.3rem .6rem', textAlign: 'left' } as const;
      blocos.push(
        <div key={blocos.length} style={{ overflowX: 'auto', margin: '.5rem 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '.9rem' }}>
            <thead>
              <tr>{cabecalho.map((c, j) => <th key={j} style={{ ...celula, background: 'var(--surface-100, #f1f5f9)' }}>{emLinha(c)}</th>)}</tr>
            </thead>
            <tbody>
              {corpo.map((l, j) => <tr key={j}>{cabecalho.map((_, k) => <td key={k} style={celula}>{emLinha(l[k] ?? '')}</td>)}</tr>)}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const titulo = TITULO.exec(linha);
    if (titulo) {
      blocos.push(<p key={blocos.length} style={{ fontWeight: 700, fontSize: titulo[1].length <= 2 ? '1.05rem' : '1rem', margin: '.7rem 0 .3rem' }}>{emLinha(titulo[2])}</p>);
      i++;
      continue;
    }

    if (ITEM.test(linha)) {
      const numerada = NUMERADO.test(linha);
      const itens: string[] = [];
      while (i < linhas.length && ITEM.test(linhas[i]) && NUMERADO.test(linhas[i]) === numerada) {
        itens.push((ITEM.exec(linhas[i]) as RegExpExecArray)[1]);
        i++;
      }
      const filhos = itens.map((t, j) => <li key={j} style={{ marginBottom: '.2rem' }}>{emLinha(t)}</li>);
      const estilo = { margin: '.3rem 0', paddingLeft: '1.3rem' };
      blocos.push(numerada ? <ol key={blocos.length} style={estilo}>{filhos}</ol> : <ul key={blocos.length} style={estilo}>{filhos}</ul>);
      continue;
    }

    // parágrafo: linhas seguidas até uma linha vazia ou outro tipo de bloco
    const paragrafo: string[] = [];
    while (i < linhas.length && linhas[i].trim() !== '' && !ITEM.test(linhas[i]) && !TITULO.test(linhas[i]) && !linhas[i].trimStart().startsWith('```')
      && !(TABELA.test(linhas[i]) && i + 1 < linhas.length && SEPARADOR.test(linhas[i + 1]))) {
      paragrafo.push(linhas[i++]);
    }
    blocos.push(
      <p key={blocos.length} style={{ margin: '.4rem 0' }}>
        {paragrafo.flatMap((l, j) => (j === 0 ? emLinha(l) : [<br key={`br${j}`} />, ...emLinha(l)]))}
      </p>,
    );
  }

  return <div style={{ lineHeight: 1.55 }}>{blocos}</div>;
}
