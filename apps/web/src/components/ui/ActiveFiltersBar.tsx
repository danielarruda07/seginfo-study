export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * "Filtrando: [chip ✕] [chip ✕] · Limpar tudo". Todo filtro (busca, dropdown, KPI, gráfico) vira chip.
 * Aceita entradas falsy para permitir `cond && { ... }` direto na lista.
 */
export function ActiveFiltersBar({ filters, onClearAll }: { filters: (ActiveFilter | false | undefined | null | '')[]; onClearAll?: () => void }) {
  const active = filters.filter((f): f is ActiveFilter => Boolean(f));
  if (active.length === 0) return null;
  const clearAll = onClearAll ?? (() => active.forEach((f) => f.onRemove()));
  return (
    <div className="iv-active-filters" aria-label="Filtros ativos">
      <span className="iv-active-filters__label">Filtrando:</span>
      {active.map((f) => (
        <button key={f.key} type="button" className="iv-chip" data-active onClick={f.onRemove} aria-label={`Remover filtro ${f.label}`}>
          {f.label} <i className="pi pi-times" aria-hidden="true" />
        </button>
      ))}
      {active.length > 1 && <>
        <span className="iv-muted" aria-hidden="true">·</span>
        <button type="button" className="iv-linkbtn" onClick={clearAll}>Limpar tudo</button>
      </>}
    </div>
  );
}
