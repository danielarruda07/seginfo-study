import type { TipoAtivo } from '@seginfo/shared';
import { TIPO_ATIVO_LABEL } from '@/theme/status';
import { GRUPOS_TIPO, TIPO_ICON } from './regras';

interface Props {
  dados: { tipo: TipoAtivo; total: number; nomes: string[] }[];
  ativo?: TipoAtivo;
  onSelect: (tipo: TipoAtivo | undefined) => void;
}

/**
 * "Tipos de ativo": cartões agrupados por família, cada um com ícone, contagem e barra
 * proporcional. Clicar filtra a lista; clicar de novo (ou em "Todos") limpa.
 * Só aparecem tipos com ativos no escopo atual.
 */
export function TipoFiltro({ dados, ativo, onSelect }: Props) {
  const porTipo = new Map(dados.map((d) => [d.tipo, d]));
  const total = dados.reduce((s, d) => s + d.total, 0);
  const maior = Math.max(1, ...dados.map((d) => d.total));
  const grupos = GRUPOS_TIPO
    .map((g) => ({ ...g, itens: g.tipos.map((t) => porTipo.get(t)).filter((d): d is NonNullable<typeof d> => !!d).sort((a, b) => b.total - a.total) }))
    .filter((g) => g.itens.length > 0);

  return (
    <section className="iv-card tf" aria-labelledby="tf-titulo">
      <div className="tf__head">
        <h2 id="tf-titulo" className="iv-section-label" style={{ margin: 0 }}>Tipos de ativo</h2>
        <button type="button" className="tf-todos" aria-pressed={!ativo} onClick={() => onSelect(undefined)}>
          <i className="pi pi-th-large" aria-hidden="true" /> Todos <span className="tf-todos__n">{total}</span>
        </button>
      </div>

      {grupos.length === 0 ? (
        <p className="iv-muted" style={{ fontSize: '.875rem', margin: '.5rem 0 0' }}>Nenhum ativo neste escopo.</p>
      ) : (
        <div className="tf__grupos">
          {grupos.map((g) => (
            <div key={g.id} className={`tf-grupo tf-grupo--${g.id}`}>
              <div className="tf-grupo__titulo">
                <i className={`pi ${g.icon}`} aria-hidden="true" />
                <span>{g.label}</span>
                <span className="tf-grupo__n">{g.itens.reduce((s, d) => s + d.total, 0)}</span>
              </div>
              <div className="tf-grupo__itens">
                {g.itens.map((d) => {
                  const nomes = d.nomes.slice(0, 6).join('\n') + (d.nomes.length > 6 ? `\n+${d.nomes.length - 6}` : '');
                  return (
                    <button key={d.tipo} type="button" className="tf-tipo" aria-pressed={ativo === d.tipo}
                      data-esmaecido={!!ativo && ativo !== d.tipo || undefined}
                      title={nomes} onClick={() => onSelect(ativo === d.tipo ? undefined : d.tipo)}>
                      <span className="tf-tipo__icone"><i className={`pi ${TIPO_ICON[d.tipo]}`} aria-hidden="true" /></span>
                      <span className="tf-tipo__texto">
                        <span className="tf-tipo__nome">{TIPO_ATIVO_LABEL[d.tipo]}</span>
                        <span className="tf-tipo__barra" aria-hidden="true"><span style={{ width: `${(d.total / maior) * 100}%` }} /></span>
                      </span>
                      <span className="tf-tipo__n">{d.total}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
