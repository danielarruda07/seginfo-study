/** Tags clicáveis da ficha: cada uma filtra a lista da tela pela tag. */
export function TagLinks({ tags, onTag, ativa }: { tags: readonly string[]; onTag: (t: string) => void; ativa?: string }) {
  if (tags.length === 0) return <p className="co-vazio">Sem tags.</p>;
  return (
    <span className="iv-row iv-wrap">
      {tags.map((t) => (
        <button key={t} type="button" className="iv-chip" data-active={ativa === t || undefined} aria-pressed={ativa === t}
          onClick={() => onTag(t)} title={`Mostrar só itens com #${t}`}>
          #{t}
        </button>
      ))}
    </span>
  );
}

/** Lista curta de itens relacionados: botão abre a ficha do item, com as tags em comum. */
export function ListaRelacionados({ itens, onOpen, vazio }: {
  itens: { id: string; titulo: string; sub?: string; comuns: string[] }[];
  onOpen: (id: string) => void;
  vazio: string;
}) {
  if (itens.length === 0) return <p className="co-vazio">{vazio}</p>;
  return (
    <ul className="co-rel">
      {itens.map((r) => (
        <li key={r.id}>
          <button type="button" className="co-rel__btn" onClick={() => onOpen(r.id)}>
            <span className="co-rel__titulo">{r.titulo}</span>
            <span className="co-rel__sub">
              {[r.sub, r.comuns.length ? r.comuns.map((t) => `#${t}`).join(' ') : 'mesmo assunto'].filter(Boolean).join(' · ')}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
