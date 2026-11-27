import { useEffect, useRef, useState } from 'react';
import { MODULO_ESTUDO_ATIVO } from '@/config/modulos';
import { useNavigate } from '@tanstack/react-router';
import { OPEN_GLOBAL_SEARCH } from './shell/Topbar';

type SearchResult = { id: string; title: string; detail: string; action: () => void };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    const abrir = () => setOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener(OPEN_GLOBAL_SEARCH, abrir);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener(OPEN_GLOBAL_SEARCH, abrir); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root?.querySelector('input')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !root) return;
      const focusable = [...root.querySelectorAll<HTMLElement>('input,button,[href],[tabindex]:not([tabindex="-1"])')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.removeEventListener('keydown', trap); previousFocus.current?.focus(); };
  }, [open]);
  const q = query.trim().toLocaleLowerCase();
  useEffect(() => {
    let cancelled = false;
    setResults([]);
    if (!q) return () => { cancelled = true; };
    const timer = window.setTimeout(async () => {
      const [catalog, sessions, inventory, range, ferramentas] = await Promise.all([import('@/services/catalog'), import('@/services/sessoes'), import('@/services/inventario'), import('@/services/range'), import('@/services/ferramentas')]);
      if (cancelled) return;
      const topics = !MODULO_ESTUDO_ATIVO ? [] : catalog.listTopicos({ rows: 1000 }).items.filter((x) => `${x.titulo} ${x.resumo} ${x.tags.join(' ')}`.toLocaleLowerCase().includes(q)).slice(0, 8)
        .map((x) => ({ id: `t-${x.id}`, title: x.titulo, detail: 'Tópico', action: () => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: x.trilhaId } }) }));
      const trails = !MODULO_ESTUDO_ATIVO ? [] : catalog.listTrilhas().filter((x) => `${x.titulo} ${x.descricao}`.toLocaleLowerCase().includes(q)).slice(0, 5)
        .map((x) => ({ id: `r-${x.id}`, title: x.titulo, detail: 'Trilha', action: () => navigate({ to: '/trilhas/$trilhaId', params: { trilhaId: x.id } }) }));
      const goals = !MODULO_ESTUDO_ATIVO ? [] : sessions.listMetas().filter((x) => x.titulo.toLocaleLowerCase().includes(q)).slice(0, 5)
        .map((x) => ({ id: `m-${x.id}`, title: x.titulo, detail: 'Meta', action: () => navigate({ to: '/metas' }) }));
      const labs = inventory.listLabs().filter((x) => `${x.titulo} ${x.objetivo}`.toLocaleLowerCase().includes(q)).slice(0, 5)
        .map((x) => ({ id: `l-${x.id}`, title: x.titulo, detail: 'Lab', action: () => navigate({ to: '/labs' }) }));
      const rangeAlvos = range.listRangeAlvos().filter((x) => `${x.nome} ${x.descricao}`.toLocaleLowerCase().includes(q)).slice(0, 5)
        .map((x) => ({ id: `ra-${x.id}`, title: x.nome, detail: 'Range', action: () => navigate({ to: '/range' }) }));
      const rangeChecklist = range.listRangeChecklist().filter((x) => `${x.titulo} ${x.descricao}`.toLocaleLowerCase().includes(q)).slice(0, 5)
        .map((x) => ({ id: `rc-${x.id}`, title: x.titulo, detail: 'Range · checklist', action: () => navigate({ to: '/range' }) }));
      const ferramentasRes = ferramentas.listFerramentas().filter((x) => `${x.nome} ${x.descricao}`.toLocaleLowerCase().includes(q)).slice(0, 6)
        .map((x) => ({ id: `fe-${x.id}`, title: x.nome, detail: 'Ferramenta', action: () => navigate({ to: '/ferramentas' }) }));
      setResults([...topics, ...trails, ...goals, ...labs, ...rangeAlvos, ...rangeChecklist, ...ferramentasRes].slice(0, 16));
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [q, navigate]);
  return <>
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
