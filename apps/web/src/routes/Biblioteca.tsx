import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import type { BiblioItem, EstadoLeitura } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { ClickCard } from '@/components/ui/ClickCard';
import { Kpi, Chip, Pill, EmptyState } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { useInvalidate } from '@/hooks/useInvalidate';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { listBiblio, resumoBiblio, removeBiblio, toggleFavoritoBiblio } from '@/services/biblioteca';
import { createMemoria } from '@/services/cerebro';
import { CATEGORIA_LABELS } from '@/services/textProcess';
import { ESTADO_LEITURA_META, filtrarPorTag, memoriaDaLeitura } from './conhecimento/regras';
import { AdicionarUrl } from './conhecimento/AdicionarUrl';
import { BiblioDrawer } from './conhecimento/BiblioDrawer';
import '@/styles/telas/conhecimento.css';

export function Biblioteca() {
  const invalidate = useInvalidate();
  const toast = useRef<Toast>(null);
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [categoria, setCategoria] = useState<string | undefined>();
  const [estado, setEstado] = useState<EstadoLeitura | undefined>();
  const [favorito, setFavorito] = useState(false);
  const [tag, setTag] = useState<string | undefined>();
  const [guardando, setGuardando] = useState(false);

  const filtros = useMemo(() => ({ search, categoria, estado, favorito: favorito || undefined }), [search, categoria, estado, favorito]);
  const query = useQuery({ queryKey: ['biblio', filtros], queryFn: () => listBiblio(filtros) });
  const todos = useQuery({ queryKey: ['biblio', 'todos'], queryFn: () => listBiblio() }).data ?? [];
  const resumo = useQuery({ queryKey: ['resumo-biblio'], queryFn: resumoBiblio }).data;
  const lista = useMemo(() => filtrarPorTag(query.data ?? [], tag, (i) => i.tags), [query.data, tag]);
  const sel = useDrawerSelection(lista);

  const refresh = () => invalidate('biblio', 'resumo-biblio');
  const categorias = Object.entries(resumo?.porCategoria ?? {}).sort((a, b) => b[1] - a[1]);
  const lendo = (resumo?.total ?? 0) - (resumo?.paraLer ?? 0) - (resumo?.lidos ?? 0);
  const toggleEstado = (e: EstadoLeitura) => setEstado(estado === e ? undefined : e);

  function limpar() { setSearchRaw(''); setCategoria(undefined); setEstado(undefined); setFavorito(false); setTag(undefined); }
  function favoritar(i: BiblioItem) { toggleFavoritoBiblio(i.id); refresh(); }

  function confirmarExclusao(i: BiblioItem) {
    confirmDialog({
      header: 'Excluir da biblioteca',
      message: <span>Excluir <strong>{i.titulo || i.url}</strong>? Resumo e anotações somem junto.<br /><small className="iv-muted">Se só já leu, prefira marcar como <strong>Lido</strong>.</small></span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => { removeBiblio(i.id); sel.close(); refresh(); toast.current?.show({ severity: 'success', summary: 'Item excluído', detail: i.titulo, life: 2500 }); },
    });
  }

  async function guardarNoCerebro(i: BiblioItem) {
    setGuardando(true);
    try {
      await createMemoria({ titulo: (i.titulo || i.url).slice(0, 200), conteudo: memoriaDaLeitura(i), tags: i.tags, escopo: 'pessoal' });
      invalidate('memorias', 'agentes-base-tags');
      toast.current?.show({ severity: 'success', summary: 'Guardado no Segundo Cérebro', detail: `Memória pessoal com ${i.tags.length} tag(s).`, life: 3500 });
    } catch {
      toast.current?.show({ severity: 'error', summary: 'Não deu para guardar', detail: 'O Segundo Cérebro precisa da API ligada.', life: 5000 });
    } finally {
      setGuardando(false);
    }
  }

  const activeFilters = [
    categoria && { key: 'c', label: `Assunto: ${CATEGORIA_LABELS[categoria] ?? categoria}`, onRemove: () => setCategoria(undefined) },
    estado && { key: 'e', label: `Leitura: ${ESTADO_LEITURA_META[estado].label}`, onRemove: () => setEstado(undefined) },
    favorito && { key: 'f', label: 'Só favoritos', onRemove: () => setFavorito(false) },
    tag && { key: 't', label: `Tag: #${tag}`, onRemove: () => setTag(undefined) },
    search && { key: 'q', label: `Busca: "${search}"`, onRemove: () => setSearchRaw('') },
  ];
  const filtrando = activeFilters.some(Boolean);

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />
      <PageHeader title="Biblioteca de Conhecimento"
        subtitle="Cole uma URL interessante: a aplicação resume, separa por assunto e arquiva para você achar depois." />

      <AdicionarUrl onSaved={(t) => { refresh(); toast.current?.show({ severity: 'success', summary: 'Salvo na biblioteca', detail: t, life: 2500 }); }} />

      <div className="iv-kpis iv-mt">
        <Kpi label="Itens" icon="pi-bookmark" value={resumo?.total ?? 0} hint="na biblioteca" />
        <Kpi label="Para ler" icon="pi-inbox" value={resumo?.paraLer ?? 0} active={estado === 'para_ler'} onClick={() => toggleEstado('para_ler')} />
        <Kpi label="Lendo" icon="pi-book" value={lendo} active={estado === 'lendo'} onClick={() => toggleEstado('lendo')} />
        <Kpi label="Lidos" icon="pi-check" value={resumo?.lidos ?? 0} active={estado === 'lido'} onClick={() => toggleEstado('lido')} />
        <Kpi label="Favoritos" icon="pi-star" value={resumo?.favoritos ?? 0} active={favorito} onClick={() => setFavorito((v) => !v)} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <SearchInput value={searchRaw} onChange={setSearchRaw} placeholder="Buscar por título, resumo, endereço ou tag" />
          <span className="iv-toolbar__count">{lista.length} {lista.length === 1 ? 'item' : 'itens'}</span>
        </div>
        {categorias.length > 1 && (
          <div className="co-chips" role="group" aria-label="Filtrar por assunto">
            <span className="co-label">Assunto:</span>
            {categorias.map(([c, n]) => (
              <Chip key={c} label={`${CATEGORIA_LABELS[c] ?? c} (${n})`} active={categoria === c} onClick={() => setCategoria(categoria === c ? undefined : c)} />
            ))}
          </div>
        )}
        <ActiveFiltersBar filters={activeFilters} onClearAll={limpar} />

        {lista.length === 0 ? (
          (resumo?.total ?? 0) === 0
            ? <EmptyState icon="pi-bookmark" title="Biblioteca vazia" text="Cole uma URL na caixa acima para salvar a primeira leitura." />
            : <EmptyState icon="pi-filter-slash" title="Nada com estes filtros" action={filtrando ? <Button label="Limpar filtros" text onClick={limpar} /> : undefined} />
        ) : (
          <div className="grid-cards co-grid">
            {lista.map((item) => {
              const e = ESTADO_LEITURA_META[item.estado];
              return (
                <ClickCard key={item.id} onOpen={() => sel.open(item.id)} selected={sel.isOpen(item.id)} className="co-card"
                  label={`Abrir ficha de ${item.titulo || item.url}`}>
                  <div className="co-card__top">
                    <Pill label={CATEGORIA_LABELS[item.categoria] ?? item.categoria} />
                    <Button type="button" text rounded size="small" aria-pressed={item.favorito}
                      aria-label={item.favorito ? `Tirar ${item.titulo} dos favoritos` : `Favoritar ${item.titulo}`}
                      icon={`pi ${item.favorito ? 'pi-star-fill' : 'pi-star'}`} className={item.favorito ? 'co-fav' : undefined} onClick={() => favoritar(item)} />
                  </div>
                  <h3 className="co-card__titulo">{item.titulo || item.url}</h3>
                  {item.dominio && <span className="co-card__sub">{item.dominio}</span>}
                  <p className="co-card__resumo">{item.resumo || 'Sem resumo (nenhum texto colado).'}</p>
                  <div className="co-card__rodape">
                    <Pill label={e.label} tone={e.tone} icon={e.icon} />
                    {item.tags.slice(0, 2).map((t) => <span key={t} className="co-tag">#{t}</span>)}
                    {item.anotacoes.trim() && <i className="pi pi-pencil co-card__icone" title="Tem anotações" aria-label="Tem anotações" />}
                  </div>
                </ClickCard>
              );
            })}
          </div>
        )}
      </div>

      {sel.item && (
        <BiblioDrawer item={sel.item} nav={sel.nav} todos={todos} tagAtiva={tag}
          onTag={(t) => setTag(tag === t ? undefined : t)} onCategoria={setCategoria} onBusca={setSearchRaw}
          onOpen={(id) => { limpar(); sel.open(id); }} onChanged={refresh} onFavoritar={favoritar}
          onRemove={confirmarExclusao} onGuardarNoCerebro={guardarNoCerebro} guardando={guardando} />
      )}
    </div>
  );
}
