import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { SearchInput } from '@/components/ui/SearchInput';
import { ActiveFiltersBar, type ActiveFilter } from '@/components/ui/ActiveFiltersBar';
import { EmptyState, Pill } from '@/components/InfraKit';
import type { RadarEvento } from '@/services/radar';
import { ACAO_META, FONTE_LABEL, acaoMeta, formatarUtc } from '../regras';

export const ROWS = 15;
const FONTE_OPTS = Object.entries(FONTE_LABEL).map(([value, label]) => ({ label, value }));
const ACAO_OPTS = Object.entries(ACAO_META).map(([value, m]) => ({ label: m.label, value }));

export interface FiltrosUi {
  busca: string; setBusca: (v: string) => void;
  fonte?: string; setFonte: (v: string | undefined) => void;
  acao?: string; setAcao: (v: string | undefined) => void;
  pais?: string; setPais: (v: string | undefined) => void;
  paises: { nome: string; total: number }[];
  chips: ActiveFilter[];
  limpar: () => void;
}

function linhaClasse(e: RadarEvento, selId: string | null) {
  const tone = acaoMeta(e.acao).tone;
  const alerta = tone === 'danger' || tone === 'serious' ? `iv-row-alert tone-${tone}` : '';
  return `${alerta}${e.id === selId ? ' in-row-sel' : ''}`;
}

/** Tabela paginada (no servidor) de eventos do Radar; clique na linha abre a ficha. */
export function EventosTabela({ itens, total, loading, page, onPage, onOpen, selId, f }: {
  itens: RadarEvento[]; total: number; loading: boolean; page: number; onPage: (p: number) => void;
  onOpen: (id: string) => void; selId: string | null; f: FiltrosUi;
}) {
  return (
    <section className="iv-card iv-mt" aria-labelledby="radar-eventos-titulo">
      <h3 id="radar-eventos-titulo" className="iv-section-label">Eventos recentes</h3>
      <div className="iv-toolbar">
        <SearchInput value={f.busca} onChange={f.setBusca} placeholder="Buscar IP, serviço, usuário ou alvo" />
        <Dropdown value={f.acao} options={ACAO_OPTS} onChange={(e) => f.setAcao(e.value)} placeholder="Todas as ações" showClear aria-label="Filtrar por ação" />
        <Dropdown value={f.fonte} options={FONTE_OPTS} onChange={(e) => f.setFonte(e.value)} placeholder="Todas as fontes" showClear aria-label="Filtrar por fonte" />
        <Dropdown value={f.pais} options={f.paises.map((p) => ({ label: `${p.nome} (${p.total})`, value: p.nome }))} onChange={(e) => f.setPais(e.value)}
          placeholder="Todos os países" showClear aria-label="Filtrar por país" className="iv-hide-sm" />
        <span className="iv-toolbar__count">{total} {total === 1 ? 'evento' : 'eventos'}</span>
      </div>
      <ActiveFiltersBar filters={f.chips} onClearAll={f.limpar} />

      <DataTable value={itens} dataKey="id" lazy paginator={total > ROWS} first={page * ROWS} rows={ROWS} totalRecords={total}
        onPage={(e) => onPage(e.page ?? 0)} loading={loading} rowHover
        onRowClick={(e) => onOpen((e.data as RadarEvento).id)} rowClassName={(e: RadarEvento) => `in-row-click ${linhaClasse(e, selId)}`}
        emptyMessage={f.chips.length
          ? <EmptyState icon="pi-filter-slash" title="Nenhum evento com estes filtros" action={<Button label="Limpar filtros" text onClick={f.limpar} />} />
          : <EmptyState icon="pi-eye" title="Nenhum evento recebido" text="Quando os coletores enviarem eventos, eles aparecem aqui." />}>
        <Column header="Quando (UTC)" style={{ width: 160 }} body={(e: RadarEvento) => <span className="tabular">{formatarUtc(e.ocorridoEm)}</span>} />
        <Column header="Ação" body={(e: RadarEvento) => { const a = acaoMeta(e.acao); return <Pill label={a.label} tone={a.tone} icon={a.icon} />; }} />
        <Column header="Origem" body={(e: RadarEvento) => (
          <span><span className="mono">{e.ipOrigem ?? '—'}</span>{e.paisOrigem && <><br /><span className="iv-maincell__sub">{e.paisOrigem}</span></>}</span>
        )} />
        <Column header="Serviço" body={(e: RadarEvento) => (
          <span>{e.servico ?? (e.portaDestino ? `porta ${e.portaDestino}` : '—')}
            {(e.servico && e.portaDestino) || e.protocolo ? <><br /><span className="iv-maincell__sub">{[e.servico && e.portaDestino ? `porta ${e.portaDestino}` : null, e.protocolo].filter(Boolean).join(' · ')}</span></> : null}</span>
        )} />
        <Column header="Usuário tentado" className="iv-hide-sm" headerClassName="iv-hide-sm"
          body={(e: RadarEvento) => e.usuarioTentado ? <span className="mono">{e.usuarioTentado}</span> : <span className="iv-muted">—</span>} />
        <Column header="Fonte" className="iv-hide-sm" headerClassName="iv-hide-sm" body={(e: RadarEvento) => FONTE_LABEL[e.fonte]?.split(' (')[0] ?? e.fonte} />
      </DataTable>
    </section>
  );
}
