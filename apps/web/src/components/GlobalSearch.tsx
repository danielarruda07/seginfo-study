import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

type SearchResult = { id: string; title: string; detail: string; action: () => void };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    root?.querySelector('input')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !root) return;
      const focusable = [...root.querySelectorAll<HTMLElement>('input,button,[href],[tabindex]:not([tabindex="-1"])')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); triggerRef.current?.focus(); };
  }, [open]);
  const q = query.trim().toLocaleLowerCase();
  useEffect(() => {
    let cancelled = false;
    setResults([]);
    if (!q) return () => { cancelled = true; };
    const timer = window.setTimeout(async () => {
      const [catalog, sessions, inventory] = await Promise.all([import('@/services/catalog'), import('@/services/sessoes'), import('@/services/inventario')]);
      if (cancelled) return;
      const topics = catalog.listTopicos({ rows: 1000 }).items.filter((x) => `${x.titulo} ${x.resumo} ${x.tags.join(' ')}`.toLocaleLowerCase().includes(q)).slice(0, 8)
        .map((x) => ({ id: `t-${x.id}`, title: x.titulo, detail: 'Tópico', action: () => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: x.trilhaId } }) }));
      const trails = catalog.listTrilhas().filter((x) => `${x.titulo} ${x.descricao}`.toLocaleLowerCase().includes(q)).slice(0, 5)
        .map((x) => ({ id: `r-${x.id}`, title: x.titulo, detail: 'Trilha', action: () => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: x.id } }) }));
      const goals = sessions.listMetas().filter((x) => x.titulo.toLocaleLowerCase().includes(q)).slice(0, 5)
        .map((x) => ({ id: `m-${x.id}`, title: x.titulo, detail: 'Meta', action: () => navigate({ to: '/metas' }) }));
      const labs = inventory.listLabs().filter((x) => `${x.titulo} ${x.objetivo}`.toLocaleLowerCase().includes(q)).slice(0, 5)
        .map((x) => ({ id: `l-${x.id}`, title: x.titulo, detail: 'Lab', action: () => navigate({ to: '/labs' }) }));
      setResults([...topics, ...trails, ...goals, ...labs].slice(0, 16));
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [q, navigate]);
  return <>
    <button ref={triggerRef} className="global-search-trigger" type="button" onClick={() => setOpen(true)} aria-label="Busca global (Ctrl+K)">
      <i className="pi pi-search" aria-hidden="true"/><span>Buscar no SegInfo…</span><kbd>Ctrl K</kbd>
    </button>
    {open && <div className="global-search-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <section ref={dialogRef} className="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
      <h2 id="global-search-title">Busca global</h2>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tópicos, trilhas, metas e labs" aria-label="Buscar no aplicativo" />
      <div className="global-search-results" role="listbox" aria-label="Resultados da busca">
        {!q && <p className="iv-muted">Digite para buscar. Atalho: Ctrl+K (ou ⌘K).</p>}
        {q && results.length === 0 && <p className="iv-muted">Nenhum resultado encontrado.</p>}
        {results.map((item) => <button type="button" role="option" key={item.id} className="global-search-result" onClick={() => { item.action(); setOpen(false); setQuery(''); }}>
          <span>{item.title}</span><small>{item.detail}</small><i className="pi pi-arrow-up-right" aria-hidden="true"/>
        </button>)}
      </div>
      </section>
    </div>}
  </>;
}
