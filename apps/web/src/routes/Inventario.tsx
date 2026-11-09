import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Sidebar } from 'primereact/sidebar';
import type { Ativo, EstadoAtivo, TipoAtivo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { DetailCard, DetailHeader, DetailLayout, DetailSection, TitleCell } from '@/components/ui/Detail';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { useFilter } from '@/hooks/useFilter';
import { listAtivos, resumoInventario, labsDoAtivo } from '@/services/inventario';
import { DOMINIO_LAB, ESTADO_ATIVO_COLOR, TIPO_ATIVO_LABEL } from '@/theme/status';

const ROWS = 10;
const TIPO_CHIPS: TipoAtivo[] = ['host', 'vm', 'container', 'storage', 'vlan', 'rede', 'switch', 'firewall_policy', 'servico'];

export function Inventario() {
  const [page, setPage] = useState(0);
  const resetPage = () => setPage(0);
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const tipo = useFilter<TipoAtivo>(resetPage);
  const estado = useFilter<EstadoAtivo>(resetPage);
  const [sel, setSel] = useState<Ativo | null>(null);

  const filtros = useMemo(
    () => ({ search, tipo: tipo.value, estado: estado.value, page, rows: ROWS }),
    [search, tipo.value, estado.value, page],
  );
  const { data } = useQuery({ queryKey: ['ativos', filtros], queryFn: () => listAtivos(filtros) });
  const resumo = useQuery({ queryKey: ['resumo-inv'], queryFn: resumoInventario }).data;

  function changeSearch(v: string) { setSearchRaw(v); resetPage(); }

  return (
    <div>
      <PageHeader title="Meu Ambiente" subtitle="Inventário vivo do homelab CRIECOMIA (Proxmox, Coolify, storage, rede). Sem credenciais — essas ficam no Cofre." />

      <StatusStrip tone={resumo && resumo.criticos > 0 ? 'crit' : 'ok'} icon="pi-server">
        {resumo?.total ?? 0} ativos · <strong>{resumo?.criticos ?? 0}</strong> críticos, {resumo?.atencao ?? 0} em atenção.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Ativos" value={resumo?.total ?? 0} hint="no homelab" />
        <Kpi label="Críticos" value={resumo?.criticos ?? 0} active={estado.is('critico')} onClick={() => estado.toggle('critico')} />
        <Kpi label="Em atenção" value={resumo?.atencao ?? 0} active={estado.is('atencao')} onClick={() => estado.toggle('atencao')} />
        <Kpi label="Planejados" value={resumo?.planejados ?? 0} active={estado.is('planejado')} onClick={() => estado.toggle('planejado')} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <SearchInput value={searchRaw} onChange={changeSearch} placeholder="Buscar ativo, IP, função, tag..." />
          {TIPO_CHIPS.map((t) => (
            <Chip key={t} label={TIPO_ATIVO_LABEL[t]} active={tipo.is(t)} onClick={() => tipo.toggle(t)} />
          ))}
        </div>

        <ActiveFiltersBar
          filters={[
            tipo.value && { key: 'tipo', label: `Tipo: ${TIPO_ATIVO_LABEL[tipo.value]}`, onRemove: () => tipo.set() },
            estado.value && { key: 'est', label: `Estado: ${estado.value}`, onRemove: () => estado.set() },
            search && { key: 'q', label: `Busca: "${search}"`, onRemove: () => changeSearch('') },
          ]}
        />

        <DataTable
          value={data?.items ?? []}
          lazy paginator first={page * ROWS} rows={ROWS} totalRecords={data?.total ?? 0}
          onPage={(e) => setPage(e.page ?? 0)}
          emptyMessage="Nenhum ativo para os filtros."
          selectionMode="single" onSelectionChange={(e) => setSel(e.value as Ativo)} dataKey="id"
        >
          <Column field="nome" header="Ativo" body={(r: Ativo) => <TitleCell title={r.nome} subtitle={r.funcao} />} />
          <Column field="endereco" header="Endereço" style={{ width: 180 }} />
          <Column field="tipo" header="Tipo" style={{ width: 130 }} body={(r: Ativo) => <Pill label={TIPO_ATIVO_LABEL[r.tipo]} />} />
          <Column field="estado" header="Estado" style={{ width: 120 }} body={(r: Ativo) => <Pill label={r.estado} color={ESTADO_ATIVO_COLOR[r.estado]} />} />
        </DataTable>
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 460 }}>
        {sel && <AtivoDetalhe ativo={sel} />}
      </Sidebar>
    </div>
  );
}

function AtivoDetalhe({ ativo }: { ativo: Ativo }) {
  const labs = labsDoAtivo(ativo.id);
  const detalhes = Object.entries(ativo.detalhes);
  return (
    <DetailLayout>
      <DetailHeader title={ativo.nome}>
        <Pill label={TIPO_ATIVO_LABEL[ativo.tipo]} />
        <Pill label={ativo.estado} color={ESTADO_ATIVO_COLOR[ativo.estado]} />
      </DetailHeader>
      <div><strong>Endereço:</strong> {ativo.endereco || '—'}</div>
      <div><strong>Função:</strong> {ativo.funcao}</div>

      {detalhes.length > 0 && (
        <DetailSection title="Detalhes">
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {detalhes.map(([k, v]) => <li key={k}><strong>{k}:</strong> {v}</li>)}
          </ul>
        </DetailSection>
      )}

      {ativo.tags.length > 0 && <div className="iv-row iv-wrap">{ativo.tags.map((t) => <Pill key={t} label={t} />)}</div>}

      {labs.length > 0 && (
        <DetailSection title="Labs que usam este ativo">
          <div className="iv-col">
            {labs.map((l) => (
              <DetailCard
                key={l.id}
                title={l.titulo}
                aside={<Pill label={l.dominio} color={DOMINIO_LAB[l.dominio].color} />}
                description={l.objetivo}
              />
            ))}
          </div>
        </DetailSection>
      )}
    </DetailLayout>
  );
}
