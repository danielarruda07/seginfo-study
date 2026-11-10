import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Sidebar } from 'primereact/sidebar';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import type { Referencia, StatusEstudo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { DetailCard, DetailHeader, DetailLayout, DetailSection, TitleCell } from '@/components/ui/Detail';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { useFilter } from '@/hooks/useFilter';
import { useInvalidate } from '@/hooks/useInvalidate';
import {
  listTopicos,
  getTrilha,
  setStatus,
  getAnotacoes,
  setAnotacao,
  getRevisoes,
  agendarRevisao,
  resumoGeral,
  type TopicoComStatus,
} from '@/services/catalog';
import { REFERENCIA_LABEL, STATUS_ESTUDO_LABEL, STATUS_ESTUDO_OPTS, usageTone } from '@/theme/status';

const ROWS = 8;
const REF_CHIPS: Referencia[] = ['gartner_leader', 'owasp', 'nist', 'open_source'];

export function Topicos() {
  const params = useParams({ strict: false }) as { trilhaId?: string };
  const trilhaId = params.trilhaId;
  const trilha = trilhaId ? getTrilha(trilhaId) : undefined;
  const invalidate = useInvalidate();

  const [page, setPage] = useState(0);
  const resetPage = () => setPage(0);
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const status = useFilter<StatusEstudo>(resetPage);
  const referencia = useFilter<Referencia>(resetPage);
  const [selected, setSelected] = useState<TopicoComStatus | null>(null);

  const filtros = useMemo(
    () => ({ search, status: status.value, referencia: referencia.value, trilhaId, page, rows: ROWS }),
    [search, status.value, referencia.value, trilhaId, page],
  );

  const { data } = useQuery({ queryKey: ['topicos', filtros], queryFn: () => listTopicos(filtros) });
  const resumo = useQuery({ queryKey: ['resumo-topicos'], queryFn: resumoGeral }).data;

  function changeSearch(v: string) { setSearchRaw(v); resetPage(); }

  function updateStatus(topicoId: string, s: StatusEstudo) {
    setStatus(topicoId, s);
    invalidate('topicos', 'resumo-topicos', 'dashboard', 'trilhas');
    if (selected?.id === topicoId) setSelected({ ...selected, status: s });
  }

  const pct = resumo?.pct ?? 0;

  return (
    <div>
      <PageHeader
        title={trilha ? trilha.titulo : 'Todos os tópicos'}
        subtitle={trilha ? trilha.descricao : 'Catálogo completo de tópicos de Segurança da Informação.'}
      />

      <StatusStrip tone={usageTone(100 - pct)} icon="pi-book">
        {data?.total ?? 0} tópicos nesta visão. Progresso geral do catálogo: <strong>{pct}%</strong>.
      </StatusStrip>

      {/* faixa de KPIs clicáveis -> viram filtro de status */}
      <div className="iv-kpis iv-mt">
        <Kpi label="A estudar" value={resumo?.aEstudar ?? 0} active={status.is('a_estudar')} onClick={() => status.toggle('a_estudar')} />
        <Kpi label="Estudando" value={resumo?.estudando ?? 0} active={status.is('estudando')} onClick={() => status.toggle('estudando')} />
        <Kpi label="Concluídos" value={resumo?.concluidos ?? 0} active={status.is('concluido')} onClick={() => status.toggle('concluido')} />
        <Kpi label="Total" value={resumo?.total ?? 0} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <SearchInput value={searchRaw} onChange={changeSearch} placeholder="Buscar tópico, ferramenta, tag..." />
          <span className="iv-muted" style={{ fontSize: '.8rem' }}>Referência:</span>
          {REF_CHIPS.map((r) => (
            <Chip key={r} label={REFERENCIA_LABEL[r].label} active={referencia.is(r)} onClick={() => referencia.toggle(r)} />
          ))}
        </div>

        <ActiveFiltersBar
          filters={[
            status.value && { key: 'status', label: `Status: ${STATUS_ESTUDO_LABEL[status.value]}`, onRemove: () => status.set() },
            referencia.value && { key: 'ref', label: `Ref: ${REFERENCIA_LABEL[referencia.value]?.label}`, onRemove: () => referencia.set() },
            search && { key: 'q', label: `Busca: "${search}"`, onRemove: () => changeSearch('') },
          ]}
        />

        <DataTable
          value={data?.items ?? []}
          lazy
          paginator
          first={page * ROWS}
          rows={ROWS}
          totalRecords={data?.total ?? 0}
          onPage={(e) => setPage(e.page ?? 0)}
          emptyMessage="Nenhum tópico encontrado para os filtros."
          selectionMode="single"
          onSelectionChange={(e) => setSelected(e.value as TopicoComStatus)}
          dataKey="id"
        >
          <Column field="titulo" header="Tópico" body={(r: TopicoComStatus) => <TitleCell title={r.titulo} subtitle={r.resumo} />} />
          <Column field="nivel" header="Nível" style={{ width: 130 }} body={(r: TopicoComStatus) => <Pill label={r.nivel} />} />
          <Column header="Status" style={{ width: 160 }} body={(r: TopicoComStatus) => (
            <Dropdown
              value={r.status}
              options={STATUS_ESTUDO_OPTS}
              onChange={(e) => updateStatus(r.id, e.value)}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%' }}
            />
          )} />
        </DataTable>
      </div>

      <Sidebar visible={!!selected} position="right" onHide={() => setSelected(null)} style={{ width: 460 }}>
        {selected && <TopicoDetalhe key={selected.id} topico={selected} onStatus={(s) => updateStatus(selected.id, s)} />}
      </Sidebar>
    </div>
  );
}

function TopicoDetalhe({ topico, onStatus }: { topico: TopicoComStatus; onStatus: (s: StatusEstudo) => void }) {
  const [nota, setNota] = useState(() => getAnotacoes()[topico.id] ?? '');
  const [revisao, setRevisao] = useState(() => getRevisoes()[topico.id]);
  return (
    <DetailLayout>
      <DetailHeader title={topico.titulo}>
        <Pill label={topico.nivel} />
      </DetailHeader>
      <p>{topico.resumo}</p>

      <Dropdown value={topico.status} options={STATUS_ESTUDO_OPTS} onChange={(e) => onStatus(e.value)} style={{ width: '100%' }} />

      <DetailSection title="Conceitos-chave">
        <div className="iv-row iv-wrap">{topico.conceitosChave.map((c) => <Pill key={c} label={c} />)}</div>
      </DetailSection>

      {topico.ferramentas.length > 0 && (
        <DetailSection title="Ferramentas de referência">
          <div className="iv-col">
            {topico.ferramentas.map((f) => {
              const ref = REFERENCIA_LABEL[f.referencia];
              return (
                <DetailCard
                  key={f.nome}
                  title={f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.nome}</a> : f.nome}
                  aside={<Pill label={ref?.label} color={ref?.color} />}
                  description={f.descricao}
                />
              );
            })}
          </div>
        </DetailSection>
      )}

      {topico.recursos.length > 0 && (
        <DetailSection title="Recursos">
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {topico.recursos.map((r) => (
              <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.titulo}</a> <span className="iv-muted">({r.tipo})</span></li>
            ))}
          </ul>
        </DetailSection>
      )}

      <DetailSection title="Minhas anotações">
        <InputTextarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={5}
          style={{ width: '100%' }}
          placeholder="Anote insights, comandos, ganchos para posts no LinkedIn..."
        />
        <Button label="Salvar anotação" icon="pi pi-save" className="iv-mt" onClick={() => setAnotacao(topico.id, nota)} />
      </DetailSection>

      <DetailSection title="Revisão espaçada">
        {revisao && <p className="iv-muted">{revisao.revisarEm <= new Date().toISOString().slice(0, 10) ? 'Revisão recomendada hoje.' : `Próxima revisão: ${revisao.revisarEm}`}</p>}
        <p className="iv-muted">Os intervalos aumentam gradualmente (1, 3, 7, 14 e 30 dias) para ajudar a planejar retornos ao conteúdo.</p>
        <Button label="Estudei / agendar próxima revisão" icon="pi pi-calendar-plus" onClick={() => setRevisao(agendarRevisao(topico.id))} />
      </DetailSection>
    </DetailLayout>
  );
}
