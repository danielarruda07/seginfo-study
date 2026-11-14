import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import type { SessaoEstudo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, EmptyState } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { listSessoes, removeSessao } from '@/services/sessoes';
import { getTopico, getTrilha, trilhaOptions } from '@/services/catalog';
import { getLab } from '@/services/inventario';
import { todayISO } from '@/services/store';
import { useInvalidarEstudo } from './estudo/dados';
import { SessaoDrawer } from './estudo/SessaoDrawer';
import { NovaSessao } from './estudo/NovaSessao';
import { formatarData, formatarMinutos, ordenarSessoes, resumoSessoes, sessoesDaSemana } from './estudo/regras';
import '@/styles/telas/estudo.css';

export function Sessoes() {
  const invalidar = useInvalidarEstudo();
  const toast = useRef<Toast>(null);
  const menu = useRef<Menu>(null);
  const [menuSessao, setMenuSessao] = useState<SessaoEstudo | null>(null);
  const [trilhaFiltro, setTrilhaFiltro] = useState<string | undefined>();
  const { data } = useQuery({ queryKey: ['sessoes'], queryFn: () => ({ sessoes: ordenarSessoes(listSessoes()), hoje: todayISO() }) });

  const todas = useMemo(() => data?.sessoes ?? [], [data]);
  const lista = useMemo(() => todas.filter((s) => !trilhaFiltro || s.trilhaId === trilhaFiltro), [todas, trilhaFiltro]);
  const sel = useDrawerSelection(lista);
  const total = resumoSessoes(todas);
  const semana = resumoSessoes(sessoesDaSemana(todas, data?.hoje ?? todayISO()));

  function excluir(s: SessaoEstudo) {
    confirmDialog({
      header: 'Excluir sessão?',
      message: `A sessão de ${formatarData(s.data)} (${formatarMinutos(s.minutos)}) sai do histórico e das horas acumuladas.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => { removeSessao(s.id); sel.close(); invalidar(); toast.current?.show({ severity: 'success', summary: 'Sessão excluída', detail: formatarData(s.data), life: 2500 }); },
    });
  }

  const tituloSessao = (s: SessaoEstudo) => getTopico(s.topicoId ?? '')?.titulo ?? getLab(s.labId ?? '')?.titulo ?? getTrilha(s.trilhaId ?? '')?.titulo ?? 'Estudo livre';

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Menu popup ref={menu} model={[
        { label: 'Abrir ficha', icon: 'pi pi-eye', command: () => menuSessao && sel.open(menuSessao.id) },
        { label: 'Excluir', icon: 'pi pi-trash', className: 'menu-danger', command: () => menuSessao && excluir(menuSessao) },
      ]} />

      <PageHeader title="Registro de Sessões" subtitle="Log do que você estudou e por quanto tempo." />

      <div className="iv-kpis">
        <Kpi label="Horas totais" icon="pi-clock" value={(total.minutos / 60).toFixed(1)} hint={`${total.quantidade} ${total.quantidade === 1 ? 'sessão' : 'sessões'}`} />
        <Kpi label="Últimos 7 dias" icon="pi-calendar" value={(semana.minutos / 60).toFixed(1)} hint={`horas em ${semana.dias} ${semana.dias === 1 ? 'dia' : 'dias'}`} />
        <Kpi label="Média por sessão" value={total.quantidade ? formatarMinutos(Math.round(total.minutos / total.quantidade)) : '—'} />
        <Kpi label="Última sessão" value={total.ultima ? formatarData(total.ultima) : '—'} />
      </div>

      <NovaSessao onSaved={(s) => { invalidar(); toast.current?.show({ severity: 'success', summary: 'Sessão registrada', detail: `${formatarMinutos(s.minutos)} em ${formatarData(s.data)}`, life: 2500 }); }} />

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <Dropdown value={trilhaFiltro} options={trilhaOptions()} onChange={(e) => setTrilhaFiltro(e.value ?? undefined)} placeholder="Todas as trilhas" showClear aria-label="Filtrar por trilha" className="es-dd" />
          <span className="iv-toolbar__count">{lista.length} {lista.length === 1 ? 'sessão' : 'sessões'}</span>
        </div>
        <ActiveFiltersBar filters={[trilhaFiltro && { key: 'trilha', label: `Trilha: ${getTrilha(trilhaFiltro)?.titulo ?? ''}`, onRemove: () => setTrilhaFiltro(undefined) }]} />

        <DataTable value={lista} paginator={lista.length > 25} rows={25} dataKey="id" className="es-table-click"
          selectionMode="single" metaKeySelection={false} selection={sel.item ?? null}
          onSelectionChange={(e) => { const s = e.value as SessaoEstudo | null; if (s) sel.open(s.id); }}
          emptyMessage={trilhaFiltro
            ? <EmptyState icon="pi-filter-slash" title="Nenhuma sessão nesta trilha" action={<Button label="Limpar filtro" text onClick={() => setTrilhaFiltro(undefined)} />} />
            : <EmptyState icon="pi-clock" title="Nenhuma sessão registrada" text="Registre acima o que estudou hoje para acompanhar seu ritmo." />}>
          <Column header="Data" style={{ width: 120 }} body={(s: SessaoEstudo) => <span className="tabular">{formatarData(s.data)}</span>} />
          <Column header="Duração" style={{ width: 120 }} body={(s: SessaoEstudo) => <span className="tabular">{formatarMinutos(s.minutos)}</span>} />
          <Column header="Estudo" body={(s: SessaoEstudo) => {
            const sub = [getTopico(s.topicoId ?? '') ? getTrilha(s.trilhaId ?? '')?.titulo : undefined, s.topicoId && s.labId ? `Lab: ${getLab(s.labId)?.titulo ?? ''}` : undefined].filter(Boolean).join(' · ');
            return (
              <div className="iv-maincell"><span>
                <span className="iv-maincell__title">{tituloSessao(s)}</span>
                {sub && <><br /><span className="iv-maincell__sub">{sub}</span></>}
              </span></div>
            );
          }} />
          <Column header="Nota" className="iv-hide-sm" headerClassName="iv-hide-sm" body={(s: SessaoEstudo) => s.nota || <span className="iv-muted">—</span>} />
          <Column header="" style={{ width: 60 }} body={(s: SessaoEstudo) => (
            <Button icon="pi pi-ellipsis-v" text size="small" aria-label={`Ações da sessão de ${formatarData(s.data)}`} tooltip="Ações"
              onClick={(e) => { e.stopPropagation(); setMenuSessao(s); menu.current?.toggle(e); }} />
          )} />
        </DataTable>
      </div>

      {sel.item && <SessaoDrawer sessao={sel.item} nav={sel.nav} onRemove={excluir} />}
    </div>
  );
}
