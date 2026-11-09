export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Aceita entradas falsy para permitir `cond && { ... }` direto na lista. */
export function ActiveFiltersBar({ filters }: { filters: (ActiveFilter | false | undefined | null | '')[] }) {
  const active = filters.filter((f): f is ActiveFilter => Boolean(f));
  if (active.length === 0) return null;
  return (
    <div className="iv-row iv-wrap iv-mt" style={{ marginBottom: '.75rem' }}>
      <span className="iv-muted" style={{ fontSize: '.8rem' }}>Filtros ativos:</span>
      {active.map((f) => (
        <span key={f.key} className="iv-chip" data-active onClick={f.onRemove} title="Remover filtro">
          {f.label} <i className="pi pi-times" style={{ fontSize: '.7rem' }} />
        </span>
      ))}
    </div>
  );
}
