import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import type { Referencia, StatusEstudo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { Kpi, Chip, Pill, EmptyState } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { useFilter } from '@/hooks/useFilter';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { listTopicos, getTrilha, setStatus, getRevisoes, progressoPorTrilha, resumoGeral, type TopicoComStatus } from '@/services/catalog';
import { todayISO } from '@/services/store';
import { REFERENCIA_LABEL, STATUS_ESTUDO_LABEL, STATUS_ESTUDO_OPTS } from '@/theme/status';
import { useInvalidarEstudo } from './estudo/dados';
import { TopicoDrawer } from './estudo/TopicoDrawer';
import { NIVEL_LABEL, revisaoPendente } from './estudo/regras';
import '@/styles/telas/estudo.css';

const ROWS = 10;
const REF_CHIPS: Referencia[] = ['gartner_leader', 'owasp', 'nist', 'open_source'];

export function Topicos() {
  const params = useParams({ strict: false }) as { trilhaId?: string };
  const trilhaId = params.trilhaId;
  const trilha = trilhaId ? getTrilha(trilhaId) : undefined;
  const invalidar = useInvalidarEstudo();

  const [page, setPage] = useState(0);
  const resetPage = () => setPage(0);
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const status = useFilter<StatusEstudo>(resetPage);
  const referencia = useFilter<Referencia>(resetPage);

  const filtros = useMemo(
    () => ({ search, status: status.value, referencia: referencia.value, trilhaId, page, rows: ROWS }),
    [search, status.value, referencia.value, trilhaId, page],
  );
  const { data } = useQuery({ queryKey: ['topicos', filtros], queryFn: () => ({ ...listTopicos(filtros), revisoes: getRevisoes(), hoje: todayISO() }) });
  // KPIs da visão atual: a trilha aberta ou o catálogo inteiro
  const resumo = useQuery({
    queryKey: ['resumo-topicos', trilhaId ?? '*'],
    queryFn: () => {
      if (!trilhaId) return resumoGeral();
      const p = progressoPorTrilha()[trilhaId] ?? { total: 0, concluidos: 0, estudando: 0, pct: 0 };
      return { ...p, aEstudar: p.total - p.concluidos - p.estudando };
    },
  }).data;

  const items = useMemo(() => data?.items ?? [], [data]);
  const sel = useDrawerSelection(items);
  const filtrando = !!(search || status.value || referencia.value);

  function changeSearch(v: string) { setSearchRaw(v); resetPage(); }
  function limpar() { changeSearch(''); status.set(); referencia.set(); }
  function updateStatus(topicoId: string, s: StatusEstudo) { setStatus(topicoId, s); invalidar(); }
  const revisar = (r: TopicoComStatus) => !!data && revisaoPendente(data.revisoes[r.id], data.hoje);

  return (
    <div>
      <PageHeader
        title={trilha ? trilha.titulo : 'Todos os tópicos'}
        subtitle={trilha ? trilha.descricao : 'Catálogo completo de tópicos de Segurança da Informação.'}
      />

      <div className="iv-kpis">
        <Kpi label="A estudar" icon="pi-circle" value={resumo?.aEstudar ?? 0} active={status.is('a_estudar')} onClick={() => status.toggle('a_estudar')} />
        <Kpi label="Estudando" icon="pi-play-circle" value={resumo?.estudando ?? 0} active={status.is('estudando')} onClick={() => status.toggle('estudando')} />
        <Kpi label="Concluídos" icon="pi-check-circle" value={resumo?.concluidos ?? 0} active={status.is('concluido')} onClick={() => status.toggle('concluido')} />
        <Kpi label={trilha ? 'Progresso da trilha' : 'Progresso geral'} value={`${resumo?.pct ?? 0}%`} hint={`${resumo?.total ?? 0} tópicos`} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <SearchInput value={searchRaw} onChange={changeSearch} placeholder="Buscar tópico, ferramenta, tag..." />
          <span className="es-toolbar-label" id="ref-label">Referência:</span>
          <span className="iv-row iv-wrap" role="group" aria-labelledby="ref-label">
            {REF_CHIPS.map((r) => <Chip key={r} label={REFERENCIA_LABEL[r].label} active={referencia.is(r)} onClick={() => referencia.toggle(r)} />)}
          </span>
          <span className="iv-toolbar__count">{data?.total ?? 0} {data?.total === 1 ? 'tópico' : 'tópicos'}</span>
        </div>

        <ActiveFiltersBar
          filters={[
            status.value && { key: 'status', label: `Status: ${STATUS_ESTUDO_LABEL[status.value]}`, onRemove: () => status.set() },
            referencia.value && { key: 'ref', label: `Referência: ${REFERENCIA_LABEL[referencia.value]?.label}`, onRemove: () => referencia.set() },
            search && { key: 'q', label: `Busca: "${search}"`, onRemove: () => changeSearch('') },
          ]}
        />

        <DataTable
          value={items}
          lazy
          paginator={(data?.total ?? 0) > ROWS}
          first={page * ROWS}
          rows={ROWS}
          totalRecords={data?.total ?? 0}
          onPage={(e) => setPage(e.page ?? 0)}
          dataKey="id"
          className="es-table-click"
          selectionMode="single"
          metaKeySelection={false}
          selection={sel.item ?? null}
          onSelectionChange={(e) => { const t = e.value as TopicoComStatus | null; if (t) sel.open(t.id); }}
          rowClassName={(r: TopicoComStatus) => (revisar(r) ? 'iv-row-alert tone-warning' : '')}
          emptyMessage={filtrando
            ? <EmptyState icon="pi-filter-slash" title="Nenhum tópico com estes filtros" action={<Button label="Limpar filtros" text onClick={limpar} />} />
            : <EmptyState icon="pi-book" title="Nenhum tópico nesta trilha" />}
        >
          <Column header="Status" style={{ width: 170 }} body={(r: TopicoComStatus) => (
            // o seletor muda o status sem abrir a ficha
            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <Dropdown value={r.status} options={STATUS_ESTUDO_OPTS} onChange={(e) => updateStatus(r.id, e.value)} aria-label={`Status de ${r.titulo}`} className="es-status-dd" />
            </div>
          )} />
          <Column header="Tópico" body={(r: TopicoComStatus) => (
            <div className="iv-maincell">
              <span>
                <span className="iv-maincell__title">{r.titulo}</span>
                {revisar(r) && <> <Pill label="Revisar hoje" tone="warning" icon="pi-history" /></>}
                <br />
                <span className="iv-maincell__sub">{trilha ? r.resumo : `${getTrilha(r.trilhaId)?.titulo ?? ''} · ${r.resumo}`}</span>
              </span>
            </div>
          )} />
          <Column header="Nível" className="iv-hide-sm" headerClassName="iv-hide-sm" style={{ width: 140 }} body={(r: TopicoComStatus) => <Pill label={NIVEL_LABEL[r.nivel]} />} />
          <Column header="Ferramentas" className="iv-hide-sm" headerClassName="iv-hide-sm" style={{ width: 120 }} body={(r: TopicoComStatus) => <span className="tabular">{r.ferramentas.length || '—'}</span>} />
        </DataTable>
      </div>

      {sel.item && <TopicoDrawer topico={sel.item} nav={sel.nav} naTrilha={!!trilhaId} />}
    </div>
  );
}
