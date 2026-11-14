import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Checkbox } from 'primereact/checkbox';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import type { Meta } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClickCard } from '@/components/ui/ClickCard';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Bar, EmptyState, Kpi, Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useFilter } from '@/hooks/useFilter';
import { addMeta, listMetas, removeMeta, toggleMeta } from '@/services/sessoes';
import { getTrilha, progressoPorTrilha } from '@/services/catalog';
import { todayISO } from '@/services/store';
import { progressTone } from '@/theme/status';
import { useInvalidarEstudo } from './estudo/dados';
import { MetaDrawer } from './estudo/MetaDrawer';
import { MetaCampos } from './estudo/MetaCampos';
import { contarMetas, estadoMeta, formatarData, listarMetas, type FiltroMeta } from './estudo/regras';
import '@/styles/telas/estudo.css';

const FILTRO_LABEL: Record<FiltroMeta, string> = { abertas: 'Abertas', atrasadas: 'Atrasadas', vence_logo: 'Vencem em 7 dias', concluidas: 'Concluídas' };
const semPaginacao = () => {};

export function Metas() {
  const invalidar = useInvalidarEstudo();
  const toast = useRef<Toast>(null);
  const { data } = useQuery({ queryKey: ['metas'], queryFn: () => ({ metas: listMetas(), progresso: progressoPorTrilha(), hoje: todayISO() }) });
  const filtro = useFilter<FiltroMeta>(semPaginacao);
  const [novaAberta, setNovaAberta] = useState(false);

  const hoje = data?.hoje ?? todayISO();
  const lista = useMemo(() => listarMetas(data?.metas ?? [], hoje, filtro.value), [data, hoje, filtro.value]);
  const sel = useDrawerSelection(lista);
  if (!data) return null;
  const c = contarMetas(data.metas, hoje);

  function alternar(m: Meta) { toggleMeta(m.id); invalidar(); }
  function excluir(m: Meta) {
    confirmDialog({
      header: 'Excluir meta?',
      message: `"${m.titulo}" será removida. Se ela só deixou de valer, prefira marcar como concluída para manter o histórico.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => { removeMeta(m.id); sel.close(); invalidar(); toast.current?.show({ severity: 'success', summary: 'Meta excluída', detail: m.titulo, life: 2500 }); },
    });
  }

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />
      <PageHeader title="Metas & Prazos" subtitle="Objetivos de estudo com data-alvo, ligados às trilhas."
        actions={<Button label="Nova meta" icon="pi pi-plus" onClick={() => setNovaAberta((v) => !v)} aria-expanded={novaAberta} />} />

      <div className="iv-kpis">
        <Kpi label="Abertas" icon="pi-flag" value={c.abertas} active={filtro.is('abertas')} onClick={() => filtro.toggle('abertas')} />
        <Kpi label="Atrasadas" icon="pi-exclamation-circle" tone="danger" value={c.atrasadas} active={filtro.is('atrasadas')} onClick={() => filtro.toggle('atrasadas')} />
        <Kpi label="Vencem em 7 dias" icon="pi-clock" tone="warning" value={c.vence_logo} active={filtro.is('vence_logo')} onClick={() => filtro.toggle('vence_logo')} />
        <Kpi label="Concluídas" icon="pi-check-circle" value={c.concluidas} active={filtro.is('concluidas')} onClick={() => filtro.toggle('concluidas')} />
      </div>

      {(novaAberta || data.metas.length === 0) && (
        <div className="iv-card iv-mt">
          <h2 className="iv-section-label">Nova meta</h2>
          <MetaCampos verbo="Adicionar meta" limparAoSalvar onCancel={data.metas.length ? () => setNovaAberta(false) : undefined}
            onSave={(r) => { addMeta({ titulo: r.titulo.trim(), prazo: r.prazo, trilhaId: r.trilhaId, concluida: false }); invalidar(); toast.current?.show({ severity: 'success', summary: 'Meta criada', detail: r.titulo, life: 2500 }); }} />
        </div>
      )}

      <ActiveFiltersBar filters={[filtro.value && { key: 'f', label: `Mostrando: ${FILTRO_LABEL[filtro.value]}`, onRemove: () => filtro.set() }]} />

      {data.metas.length === 0 ? (
        <EmptyState icon="pi-flag" title="Nenhuma meta ainda" text="Crie a primeira acima, de preferência ligada a uma trilha para acompanhar o progresso." />
      ) : lista.length === 0 ? (
        <EmptyState icon="pi-filter-slash" title={`Nenhuma meta em "${filtro.value ? FILTRO_LABEL[filtro.value] : ''}"`} action={<Button label="Ver todas" text onClick={() => filtro.set()} />} />
      ) : (
        <ul className="es-metas iv-mt">
          {lista.map((m) => {
            const e = estadoMeta(m, hoje);
            const trilha = m.trilhaId ? getTrilha(m.trilhaId) : undefined;
            const p = trilha ? data.progresso[trilha.id] : undefined;
            return (
              <ClickCard key={m.id} as="li" className="es-meta" tone={e.tone === 'danger' || e.tone === 'warning' ? e.tone : undefined}
                selected={sel.isOpen(m.id)} onOpen={() => sel.open(m.id)} label={`Abrir ficha da meta ${m.titulo}`}>
                <Checkbox inputId={`meta-${m.id}`} checked={m.concluida} onChange={() => alternar(m)} aria-label={m.concluida ? `Reabrir ${m.titulo}` : `Concluir ${m.titulo}`} />
                <div className="es-meta__body">
                  <span className="es-meta__title" data-done={m.concluida || undefined}>{m.titulo}</span>
                  <span className="es-meta__sub tabular">Prazo {formatarData(m.prazo)}{!m.concluida && ` · ${e.texto}`}{trilha && ` · ${trilha.titulo}`}</span>
                  {p && !m.concluida && <div className="es-progress es-progress--sm"><Bar pct={p.pct} tone={progressTone(p.pct)} /><span className="tabular">{p.concluidos}/{p.total}</span></div>}
                </div>
                <Pill label={e.label} tone={e.tone} icon={e.icon} />
              </ClickCard>
            );
          })}
        </ul>
      )}

      {sel.item && <MetaDrawer meta={sel.item} nav={sel.nav} onRemove={excluir} />}
    </div>
  );
}
