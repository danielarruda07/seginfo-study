import { Bar } from '@/components/InfraKit';

export interface TopItem { id: string; rotulo: string; extra?: string | null; total: number }

/** "Top N" com barras proporcionais ao maior valor. Com `onOpen`, cada linha abre a ficha. */
export function TopList({ titulo, itens, onOpen, selId, aviso }: {
  titulo: string;
  itens: TopItem[];
  onOpen?: (id: string) => void;
  selId?: string | null;
  aviso?: string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.total));
  return (
    <section className="iv-card in-top" aria-label={titulo}>
      <h3 className="iv-section-label">{titulo}</h3>
      {aviso && <p className="in-top__aviso"><i className="pi pi-lock" aria-hidden="true" /> {aviso}</p>}
      {itens.length === 0 && <p className="in-muted-p">Sem dados no período.</p>}
      <ul className="in-list">
        {itens.map((i) => {
          const conteudo = <>
            <span className="in-top__linha">
              <span className="mono in-top__rotulo">{i.rotulo}{i.extra ? <span className="iv-muted"> · {i.extra}</span> : null}</span>
              <strong className="tabular">{i.total}</strong>
            </span>
            <Bar pct={(i.total / max) * 100} />
          </>;
          return (
            <li key={i.id}>
              {onOpen
                ? <button type="button" className="in-top__item" data-sel={selId === i.id || undefined} onClick={() => onOpen(i.id)}
                    aria-haspopup="dialog" aria-label={`${i.rotulo}${i.extra ? ` (${i.extra})` : ''}: ${i.total} eventos. Abrir ficha.`}>{conteudo}</button>
                : <div className="in-top__item in-top__item--static">{conteudo}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
