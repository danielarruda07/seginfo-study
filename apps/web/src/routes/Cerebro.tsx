import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, Chip, Pill, StatusStrip, EmptyState } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { listMemorias, buscarMemorias, type Escopo, type MemoriaResumo, type TrechoEncontrado } from '@/services/cerebro';
import { listTagsBase } from '@/services/agentes';
import { ESCOPO_META, fmtData, origemMeta } from './conhecimento/regras';
import { useCerebroAcoes, erroDe } from './conhecimento/useCerebroAcoes';
import { MemoriaDrawer } from './conhecimento/MemoriaDrawer';
import { MemoriaForm } from './conhecimento/MemoriaForm';
import { BuscaCerebro, CapturaPagina } from './conhecimento/CerebroEntrada';
import '@/styles/telas/conhecimento.css';

const ROWS = 15;
const idDoTrecho = (t: TrechoEncontrado) => t.memoriaId;
const contar = (f: { escopo?: Escopo; lixeira?: boolean }) => listMemorias({ ...f, page: 0, limit: 1 }).then((r) => r.total);

export function Cerebro() {
  const toast = useRef<Toast>(null);
  const menu = useRef<Menu>(null);
  const [menuDe, setMenuDe] = useState<MemoriaResumo | null>(null);
  const [escopo, setEscopo] = useState<Escopo | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [lixeira, setLixeira] = useState(false);
  const [page, setPage] = useState(0);
  const [achados, setAchados] = useState<TrechoEncontrado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [avulso, setAvulso] = useState<string | null>(null);

  const filtros = useMemo(() => ({ escopo, tag, lixeira, page, limit: ROWS }), [escopo, tag, lixeira, page]);
  const lista = useQuery({ queryKey: ['memorias', filtros], queryFn: () => listMemorias(filtros), placeholderData: keepPreviousData });
  const total = useQuery({ queryKey: ['memorias', 'contagem', 'todas'], queryFn: () => contar({}) }).data;
  const corp = useQuery({ queryKey: ['memorias', 'contagem', 'corp'], queryFn: () => contar({ escopo: 'corporativo' }) }).data;
  const naLixeira = useQuery({ queryKey: ['memorias', 'contagem', 'lixeira'], queryFn: () => contar({ lixeira: true }) }).data;
  const tagsBase = useQuery({ queryKey: ['agentes-base-tags'], queryFn: listTagsBase, retry: false }).data ?? [];

  const itens = lista.data?.items ?? [];
  const unicos = useMemo(() => (achados ?? []).filter((a, i, l) => l.findIndex((b) => b.memoriaId === a.memoriaId) === i), [achados]);
  const selLista = useDrawerSelection(itens);
  const selBusca = useDrawerSelection(unicos, idDoTrecho);
  const acoes = useCerebroAcoes(toast, () => { selLista.close(); selBusca.close(); setAvulso(null); });

  // qualquer mudança de filtro volta para a página 1
  const mudar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };
  const toggleTag = (t: string) => mudar(setTag)(tag === t ? undefined : t);
  const limpar = () => { setEscopo(undefined); setTag(undefined); setLixeira(false); setPage(0); };

  function abrirDaLista(id: string) { selBusca.close(); setAvulso(null); selLista.open(id); }
  function abrirDaBusca(id: string) { selLista.close(); setAvulso(null); selBusca.open(id); }
  function abrirAvulso(id: string) {
    if (itens.some((m) => m.id === id)) return abrirDaLista(id);
    selLista.close(); selBusca.close(); setAvulso(id);
  }
  const aberto = selLista.item ? { id: selLista.item.id, nav: selLista.nav }
    : selBusca.item ? { id: selBusca.item.memoriaId, nav: selBusca.nav }
      : avulso ? { id: avulso, nav: { onClose: () => setAvulso(null) } } : null;

  async function buscar(q: string) {
    setBuscando(true);
    try { setAchados(await buscarMemorias(q)); } catch (e) { toast.current?.show({ severity: 'error', summary: 'Falha na busca', detail: erroDe(e, 'A API não respondeu.'), life: 5000 }); } finally { setBuscando(false); }
  }

  async function importar(ev: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(ev.target.files ?? []);
    ev.target.value = ''; // permite escolher os mesmos arquivos de novo
    await acoes.importar(arquivos);
  }

  const menuItens = menuDe ? [
    { label: 'Abrir ficha', icon: 'pi pi-eye', command: () => abrirDaLista(menuDe.id) },
    ...(menuDe.excluirEm ? [{ label: 'Resgatar da lixeira', icon: 'pi pi-undo', command: () => acoes.resgatar(menuDe) }] : [
      { label: 'Editar', icon: 'pi pi-pencil', command: () => acoes.editarPorId(menuDe.id) },
      { separator: true },
      { label: 'Mover para a lixeira', icon: 'pi pi-trash', className: 'menu-danger', command: () => acoes.lixeira(menuDe) },
    ]),
  ] : [];

  const activeFilters = [
    escopo && { key: 'e', label: `Escopo: ${ESCOPO_META[escopo].label}`, onRemove: () => mudar(setEscopo)(undefined) },
    tag && { key: 't', label: `Tag: #${tag}`, onRemove: () => mudar(setTag)(undefined) },
    lixeira && { key: 'l', label: 'Lixeira', onRemove: () => mudar(setLixeira)(false) },
  ];
  const n = lista.data?.total ?? 0;

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Menu model={menuItens} popup ref={menu} />
      <PageHeader title="Segundo Cérebro"
        subtitle="Notas, páginas e documentos que você quer lembrar. A busca devolve os trechos certos, com a fonte, e os agentes consultam as memórias pessoais das tags que têm na base."
        actions={<>
          <label className="p-button p-component p-button-outlined co-upload">
            <span className="p-button-icon p-button-icon-left pi pi-upload" aria-hidden="true" />
            <span className="p-button-label">Importar notas (.md / .txt)</span>
            <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden onChange={importar} />
          </label>
          <Button label="Nova memória" icon="pi pi-plus" onClick={acoes.nova} />
        </>} />

      {lista.isError && <StatusStrip tone="crit" icon="pi-exclamation-triangle">API ou banco indisponível: o Segundo Cérebro precisa do servidor (apps/api + PostgreSQL).</StatusStrip>}

      <div className="iv-kpis iv-mt">
        <Kpi label="Memórias" icon="pi-database" value={total ?? '—'} hint="guardadas" />
        <Kpi label="Pessoais" icon={ESCOPO_META.pessoal.icon} value={total !== undefined && corp !== undefined ? total - corp : '—'} hint="backup e agentes"
          active={escopo === 'pessoal'} onClick={() => mudar(setEscopo)(escopo === 'pessoal' ? undefined : 'pessoal')} />
        <Kpi label="Corporativas" icon={ESCOPO_META.corporativo.icon} value={corp ?? '—'} hint="fora do backup e dos agentes"
          active={escopo === 'corporativo'} onClick={() => mudar(setEscopo)(escopo === 'corporativo' ? undefined : 'corporativo')} />
        <Kpi label="Na lixeira" icon="pi-trash" value={naLixeira ?? '—'} hint="somem em 7 dias" active={lixeira} onClick={() => mudar(setLixeira)(!lixeira)} />
      </div>

      <div className="co-duo iv-mt">
        <BuscaCerebro achados={achados} buscando={buscando} onBuscar={buscar} onLimpar={() => { setAchados(null); selBusca.close(); }}
          onOpen={abrirDaBusca} abertoId={selBusca.item?.memoriaId} />
        <CapturaPagina ocupado={acoes.ocupado} onCapturar={acoes.capturar} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <span className="p-input-icon-left">
            <i className="pi pi-tag" aria-hidden="true" />
            <InputText placeholder="Outra tag (Enter)" aria-label="Filtrar por tag" onKeyDown={(e) => {
              if (e.key === 'Enter') { mudar(setTag)(e.currentTarget.value.trim().toLowerCase() || undefined); e.currentTarget.value = ''; }
            }} />
          </span>
          <span className="iv-toolbar__count">{n} {lixeira ? 'na lixeira' : n === 1 ? 'memória' : 'memórias'}</span>
        </div>
        {tagsBase.length > 0 && (
          <div className="co-chips" role="group" aria-label="Tags mais usadas">
            <span className="co-label">Tags:</span>
            {tagsBase.slice(0, 12).map((t) => <Chip key={t.tag} label={`#${t.tag} (${t.total})`} active={tag === t.tag} onClick={() => toggleTag(t.tag)} />)}
          </div>
        )}
        <ActiveFiltersBar filters={activeFilters} onClearAll={limpar} />
        <DataTable value={itens} lazy paginator={n > ROWS} first={page * ROWS} rows={ROWS} totalRecords={n} onPage={(e) => setPage(e.page ?? 0)}
          dataKey="id" loading={lista.isLoading} selectionMode="single" selection={selLista.item ?? null}
          onSelectionChange={(e) => { const m = e.value as MemoriaResumo | null; if (m) abrirDaLista(m.id); }}
          emptyMessage={lista.isError ? <EmptyState icon="pi-wifi" title="Sem conexão com a API" text="As memórias aparecem aqui quando o servidor responder." />
            : lixeira ? <EmptyState icon="pi-trash" title="A lixeira está vazia" />
            : activeFilters.some(Boolean) ? <EmptyState icon="pi-filter-slash" title="Nenhuma memória com estes filtros" action={<Button label="Limpar filtros" text onClick={limpar} />} />
              : <EmptyState icon="pi-database" title="Nenhuma memória ainda" text="Crie uma, capture uma página ou importe notas." action={<Button label="Nova memória" icon="pi pi-plus" onClick={acoes.nova} />} />}>
          <Column header="Memória" body={(m: MemoriaResumo) => {
            const o = origemMeta(m.origem);
            return (
              <div className="iv-maincell">
                <span className="iv-maincell__icon" title={o.label}><i className={`pi ${o.icon}`} aria-label={o.label} /></span>
                <span className="co-min0">
                  <span className="iv-maincell__title">{m.titulo}</span><br />
                  <span className="iv-maincell__sub co-clamp">{m.preview || 'Sem conteúdo.'}</span>
                  {m.tags.length > 0 && <span className="co-card__rodape">{m.tags.slice(0, 4).map((t) => <span key={t} className="co-tag">#{t}</span>)}{m.tags.length > 4 && <span className="co-tag">+{m.tags.length - 4}</span>}</span>}
                </span>
              </div>
            );
          }} />
          <Column header="Escopo" style={{ width: 140 }} body={(m: MemoriaResumo) => { const e = ESCOPO_META[m.escopo]; return <Pill label={e.label} tone={e.tone} icon={e.icon} />; }} />
          <Column header={lixeira ? 'Some em' : 'Atualizada'} style={{ width: 150 }} className="iv-hide-sm" headerClassName="iv-hide-sm"
            body={(m: MemoriaResumo) => <span className="co-nota">{fmtData(lixeira && m.excluirEm ? m.excluirEm : m.atualizadoEm)}</span>} />
          <Column header="" style={{ width: 56 }} body={(m: MemoriaResumo) => (
            <Button icon="pi pi-ellipsis-v" text size="small" aria-label={`Ações de ${m.titulo}`} tooltip="Ações"
              onClick={(e) => { e.stopPropagation(); setMenuDe(m); menu.current?.toggle(e); }} />
          )} />
        </DataTable>
      </div>

      {aberto && !acoes.form && (
        <MemoriaDrawer id={aberto.id} nav={aberto.nav} tagAtiva={tag} onTag={toggleTag} onOpen={abrirAvulso}
          onEdit={acoes.editar} onLixeira={acoes.lixeira} onResgatar={acoes.resgatar}
          onCopiado={() => toast.current?.show({ severity: 'success', summary: 'Conteúdo copiado', life: 2000 })} />
      )}
      {acoes.form && <MemoriaForm inicial={acoes.form} salvando={acoes.ocupado} onCancel={acoes.fecharForm} onSave={acoes.salvar} />}
    </div>
  );
}
