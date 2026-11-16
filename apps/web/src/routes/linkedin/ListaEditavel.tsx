import { useEffect, useState } from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';

/** Campo de lista de textos (um por linha ou separados por vírgula). Mantém o que você digita enquanto edita. */
export function CampoLista({ value, onChange, separador, rotulo, placeholder, linhas = 2 }: {
  value: string[]; onChange: (v: string[]) => void; separador: 'linha' | 'virgula'; rotulo: string; placeholder?: string; linhas?: number;
}) {
  const juntar = (v: string[]) => v.join(separador === 'linha' ? '\n' : ', ');
  const analisar = (t: string) => t.split(separador === 'linha' ? /\n/ : /[,\n]/).map((x) => x.trim()).filter(Boolean);
  const [texto, setTexto] = useState(juntar(value));
  // se a lista mudar por fora (importação, restauração), o texto acompanha
  useEffect(() => {
    if (analisar(texto).join('\u0000') !== value.join('\u0000')) setTexto(juntar(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="ca-campo">
      <strong className="ca-small">{rotulo}</strong>
      <InputTextarea value={texto} rows={linhas} autoResize placeholder={placeholder}
        onChange={(e) => { setTexto(e.target.value); onChange(analisar(e.target.value)); }} />
    </label>
  );
}

export interface CampoDef {
  chave: string;
  rotulo: string;
  tipo?: 'texto' | 'area' | 'linhas' | 'virgulas' | 'opcoes';
  opcoes?: { label: string; value: string }[];
  placeholder?: string;
  /** ocupa a linha inteira */
  larga?: boolean;
}

/** Lista de itens com campos editáveis, botão de adicionar e de remover. */
export function ListaEditavel<T extends { id: string }>({ titulo, descricao, itens, campos, novo, onChange, max, rotuloItem, vazio, recolhivel = false }: {
  titulo: string; descricao?: string; itens: T[]; campos: CampoDef[]; novo: () => T; onChange: (itens: T[]) => void;
  max: number; rotuloItem: (i: T) => string; vazio: string; recolhivel?: boolean;
}) {
  const alterar = (id: string, chave: string, valor: unknown) =>
    onChange(itens.map((i) => (i.id === id ? ({ ...i, [chave]: valor } as T) : i)));
  const conteudo = (
    <>
      <div className="ca-toolbar">
        <h3 className="ca-h3">{titulo} <span className="iv-muted ca-small">({itens.length})</span></h3>
        <Button label="Adicionar" icon="pi pi-plus" size="small" outlined disabled={itens.length >= max} onClick={() => onChange([...itens, novo()])} />
      </div>
      {descricao && <p className="iv-muted ca-small ca-mb0">{descricao}</p>}
      {itens.length === 0 && <p className="iv-muted ca-small ca-mb0">{vazio}</p>}
      <ul className="pv-itens">
        {itens.map((item) => {
          const reg = item as unknown as Record<string, unknown>;
          return (
            <li key={item.id} className="pv-item">
              <div className="pv-item__cabeca">
                <strong className="ca-small">{rotuloItem(item) || 'Novo item'}</strong>
                <Button icon="pi pi-trash" text severity="secondary" size="small" aria-label={`Remover ${rotuloItem(item) || 'item'}`}
                  onClick={() => onChange(itens.filter((i) => i.id !== item.id))} />
              </div>
              <div className="pv-grade">
                {campos.map((c) => (
                  <div key={c.chave} className={c.larga ? 'pv-grade__larga' : undefined}>
                    {c.tipo === 'linhas' || c.tipo === 'virgulas' ? (
                      <CampoLista value={(reg[c.chave] as string[]) ?? []} separador={c.tipo === 'linhas' ? 'linha' : 'virgula'} rotulo={c.rotulo}
                        placeholder={c.placeholder} onChange={(v) => alterar(item.id, c.chave, v)} />
                    ) : (
                      <label className="ca-campo">
                        <strong className="ca-small">{c.rotulo}</strong>
                        {c.tipo === 'area' ? (
                          <InputTextarea value={String(reg[c.chave] ?? '')} rows={3} autoResize placeholder={c.placeholder}
                            onChange={(e) => alterar(item.id, c.chave, e.target.value)} />
                        ) : c.tipo === 'opcoes' ? (
                          <Dropdown value={reg[c.chave] as string} options={c.opcoes} onChange={(e) => alterar(item.id, c.chave, e.value)} />
                        ) : (
                          <InputText value={String(reg[c.chave] ?? '')} placeholder={c.placeholder}
                            onChange={(e) => alterar(item.id, c.chave, e.target.value)} />
                        )}
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );

  if (recolhivel) {
    return (
      <details className="iv-card pv-secao pv-lista-recolhivel">
        <summary className="pv-lista-recolhivel__resumo">
          <span>{titulo} <span className="iv-muted ca-small">({itens.length})</span></span>
          <i className="pi pi-chevron-down" aria-hidden="true" />
        </summary>
        <div className="pv-lista-recolhivel__conteudo">{conteudo}</div>
      </details>
    );
  }

  return (
    <section className="iv-card pv-secao">
      {conteudo}
    </section>
  );
}
