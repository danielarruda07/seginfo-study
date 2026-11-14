import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { SelectButton } from 'primereact/selectbutton';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import { Toast } from 'primereact/toast';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import type { Ativo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { EmptyState, Kpi, Pill } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { importarAtivos, listAtivos, removeAtivo, resumoInventario, saveAtivo } from '@/services/inventario';
import { idadeConfirmacao } from '@/lib/confirmacao';
import { todayISO } from '@/services/store';
import * as vault from '@/services/vault';
import { TIPO_ATIVO_LABEL } from '@/theme/status';
import { CRITICIDADE_META, ESCOPO_OPTS, ESTADO_META, TIPO_ICON, contarPorTipo, linhaClasse, noEscopo, ordenarAtivos } from './inventario/regras';
import { useInventarioFiltros } from './inventario/useInventarioFiltros';
import { AtivoForm } from './inventario/AtivoForm';
import { AtivoDrawer } from './inventario/AtivoDrawer';
import { TipoFiltro } from './inventario/TipoFiltro';
import { AcessosIntegracoes } from './inventario/AcessosIntegracoes';

const NOVO: Ativo = { id: '', ambiente: 'criecomia', tipo: 'servico', nome: '', endereco: '', funcao: '', estado: 'ativo', detalhes: {}, tags: [], labsRelacionados: [] };

export function Inventario() {
  const f = useInventarioFiltros();
  const invalidate = useInvalidate();
  const toast = useRef<Toast>(null);
  const menu = useRef<Menu>(null);
  const [menuAtivo, setMenuAtivo] = useState<Ativo | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState<Ativo | null>(null);

  const query = useQuery({ queryKey: ['ativos', f.search, f.tipo, f.estado], queryFn: () => listAtivos({ search: f.search, tipo: f.tipo, estado: f.estado, rows: 10_000 }) });
  const resumo = useQuery({ queryKey: ['resumo-inv'], queryFn: resumoInventario }).data;
  const todos = useQuery({ queryKey: ['ativos', 'todos'], queryFn: () => listAtivos({ rows: 10_000 }).items }).data ?? [];
  const lista = useMemo(() => ordenarAtivos((query.data?.items ?? []).filter((a) => noEscopo(a, f.escopo))), [query.data, f.escopo]);
  const porTipo = useMemo(() => contarPorTipo(todos.filter((a) => noEscopo(a, f.escopo))), [todos, f.escopo]);
  const selIndex = lista.findIndex((a) => a.id === selId);

  const atualizar = () => invalidate('ativos', 'resumo-inv');
  function salvar(a: Ativo) {
    saveAtivo(a);
    setForm(null);
    atualizar();
    toast.current?.show({ severity: 'success', summary: a.id ? 'Ativo atualizado' : 'Ativo cadastrado', detail: a.nome, life: 2500 });
  }
  function confirmarRemocao(a: Ativo) {
    confirmDialog({
      header: 'Remover ativo',
      message: <span>Remover <strong>{a.nome}</strong> do inventário? Os labs perdem o vínculo.<br /><small className="iv-muted">Prefira marcar como <strong>Desativado</strong> para manter o histórico.</small></span>,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Remover', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: () => { removeAtivo(a.id); setSelId(null); atualizar(); toast.current?.show({ severity: 'success', summary: 'Ativo removido', detail: a.nome, life: 2500 }); },
    });
  }
  function importarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    file.text().then((texto) => {
      const r = importarAtivos(texto);
      atualizar();
      toast.current?.show({ severity: 'success', summary: 'Arquivo importado', detail: `${r.novos} novo(s), ${r.atualizados} atualizado(s)`, life: 4000 });
    }).catch(() => {
      toast.current?.show({ severity: 'error', summary: 'Arquivo inválido', detail: 'Esperado um JSON com a lista de ativos.', life: 5000 });
    });
  }

  const menuItens = menuAtivo ? [
    { label: 'Ver detalhes', icon: 'pi pi-eye', command: () => setSelId(menuAtivo.id) },
    { label: 'Editar', icon: 'pi pi-pencil', command: () => setForm(menuAtivo) },
    { label: 'Confirmar hoje', icon: 'pi pi-check-circle', command: () => salvar({ ...menuAtivo, confirmadoEm: todayISO() }) },
    { label: 'Marcar como desativado', icon: 'pi pi-power-off', disabled: menuAtivo.estado === 'desativado', command: () => salvar({ ...menuAtivo, estado: 'desativado' }) },
    { separator: true },
    { label: 'Remover', icon: 'pi pi-trash', className: 'menu-danger', command: () => confirmarRemocao(menuAtivo) },
  ] : [];

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Menu model={menuItens} popup ref={menu} />

      <PageHeader title="Meu Ambiente" subtitle="Inventário do homelab: hosts, VMs, rede e serviços, e o mapa de onde ficam endereços e credenciais (as senhas ficam no Cofre)."
        actions={<>
          <label className="p-button p-component p-button-outlined" style={{ cursor: 'pointer' }}>
            <span className="p-button-icon p-button-icon-left pi pi-upload" />
            <span className="p-button-label">Importar arquivo</span>
            <input type="file" accept="application/json,.json" hidden onChange={importarArquivo} />
          </label>
          <Button label="Novo ativo" icon="pi pi-plus" onClick={() => setForm(NOVO)} />
        </>} />

      <AcessosIntegracoes ativosComEndereco={todos.filter((a) => (a.endereco ?? '').trim()).length} />

      <div className="iv-summary">
        <div className="iv-kpis">
          <Kpi label="Ativos" icon="pi-server" value={resumo?.total ?? 0} hint="no inventário" />
          <Kpi label="Críticos" icon="pi-times-circle" tone="danger" value={resumo?.criticos ?? 0} active={f.estado === 'critico'} onClick={() => f.toggleEstado('critico')} />
          <Kpi label="Em atenção" icon="pi-exclamation-triangle" tone="serious" value={resumo?.atencao ?? 0} active={f.estado === 'atencao'} onClick={() => f.toggleEstado('atencao')} />
          <Kpi label="Planejados" icon="pi-calendar" value={resumo?.planejados ?? 0} active={f.estado === 'planejado'} onClick={() => f.toggleEstado('planejado')} />
        </div>
        <TipoFiltro dados={porTipo} ativo={f.tipo} onSelect={f.setTipo} />
      </div>

      <div className="iv-card">
        <div className="iv-toolbar">
          <SearchInput value={f.busca} onChange={f.setBusca} placeholder="Buscar por nome, endereço, função ou tag" />
          <SelectButton value={f.escopo} options={ESCOPO_OPTS} onChange={(e) => e.value && f.setEscopo(e.value)} allowEmpty={false} aria-label="Escopo" />
          <span className="iv-toolbar__count">{lista.length} {lista.length === 1 ? 'ativo' : 'ativos'}</span>
        </div>
        <ActiveFiltersBar filters={f.chips} onClearAll={f.limpar} />

        <DataTable value={lista} dataKey="id" paginator={lista.length > 25} rows={25} loading={query.isLoading}
          selectionMode="single" selection={lista[selIndex] ?? null} onSelectionChange={(e) => setSelId((e.value as Ativo | null)?.id ?? null)}
          rowClassName={(a: Ativo) => linhaClasse(a)}
          emptyMessage={(query.data?.total ?? 0) === 0 && f.chips.every((c) => !c)
            ? <EmptyState icon="pi-server" title="Nenhum ativo cadastrado" text="Cadastre hosts, VMs e serviços do homelab para ligá-los aos labs."
                action={<Button label="Cadastrar o primeiro" icon="pi pi-plus" onClick={() => setForm(NOVO)} />} />
            : <EmptyState icon="pi-filter-slash" title="Nenhum ativo com estes filtros" action={<Button label="Limpar filtros" text onClick={f.limpar} />} />}>
          <Column header="Estado" style={{ width: 150 }} body={(a: Ativo) => {
            const e = ESTADO_META[a.estado];
            return <Pill label={e.label} tone={e.tone} icon={e.icon} />;
          }} />
          <Column header="Ativo" body={(a: Ativo) => (
            <div className="iv-maincell">
              <span className="iv-maincell__icon" title={TIPO_ATIVO_LABEL[a.tipo]}><i className={`pi ${TIPO_ICON[a.tipo]}`} aria-label={TIPO_ATIVO_LABEL[a.tipo]} /></span>
              <span><span className="iv-maincell__title">{a.nome}</span><br /><span className="iv-maincell__sub">{[TIPO_ATIVO_LABEL[a.tipo], a.funcao].filter(Boolean).join(' · ')}</span></span>
            </div>
          )} />
          <Column header="Endereço" className="iv-hide-sm" headerClassName="iv-hide-sm" body={(a: Ativo) => a.endereco ? <span className="mono">{a.endereco}</span> : <span className="iv-muted">—</span>} />
          <Column header="Criticidade" className="iv-hide-sm" headerClassName="iv-hide-sm" body={(a: Ativo) => a.criticidade
            ? <Pill label={CRITICIDADE_META[a.criticidade].label} tone={CRITICIDADE_META[a.criticidade].tone} />
            : <span className="iv-muted">—</span>} />
          <Column header="Exposição" className="iv-hide-sm" headerClassName="iv-hide-sm" body={(a: Ativo) => a.exposicao
            ? <Pill label={{ publica: 'Pública', interna: 'Interna', restrita: 'Restrita', isolada: 'Isolada' }[a.exposicao]} />
            : <span className="iv-muted">—</span>} />
          <Column header="Confirmado" className="iv-hide-sm" headerClassName="iv-hide-sm" body={(a: Ativo) => {
            const c = idadeConfirmacao(a.confirmadoEm);
            return <span className={c.rever ? 'iv-muted' : undefined} style={{ fontSize: '.82rem' }} title={a.fonte}>{c.rever && a.confirmadoEm ? `${c.texto} · rever` : c.texto}</span>;
          }} />
          <Column header="Tags" className="iv-hide-sm" headerClassName="iv-hide-sm" body={(a: Ativo) => (
            <span className="iv-row iv-wrap">{a.tags.slice(0, 2).map((t) => <Pill key={t} label={t} />)}{a.tags.length > 2 && <span className="iv-muted" style={{ fontSize: '.75rem' }}>+{a.tags.length - 2}</span>}</span>
          )} />
          <Column header="" style={{ width: 120 }} body={(a: Ativo) => (
            <div className="iv-actions">
              {a.estado === 'critico' && <Button label="Revisar" icon="pi pi-pencil" size="small" outlined onClick={(e) => { e.stopPropagation(); setForm(a); }} />}
              <Button icon="pi pi-ellipsis-v" text size="small" aria-label={`Ações de ${a.nome}`} tooltip="Ações"
                onClick={(e) => { e.stopPropagation(); setMenuAtivo(a); menu.current?.toggle(e); }} />
            </div>
          )} />
        </DataTable>
      </div>

      {selIndex >= 0 && !form && (
        <AtivoDrawer lista={lista} index={selIndex} onIndex={(i) => setSelId(lista[i]?.id ?? null)} onClose={() => setSelId(null)}
          temCredencial={vault.isUnlocked() && vault.listEntries().some((e) => e.ativoId === lista[selIndex].id)}
          onEdit={(a) => setForm(a)} onRemove={confirmarRemocao} />
      )}
      {form && <AtivoForm inicial={form} onCancel={() => setForm(null)} onSave={salvar} />}
    </div>
  );
}
