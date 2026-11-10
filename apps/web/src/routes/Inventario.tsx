import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Sidebar } from 'primereact/sidebar';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { AtivoSchema, type Ativo, type EstadoAtivo, type TipoAtivo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { SearchInput } from '@/components/ui/SearchInput';
import { DetailCard, DetailHeader, DetailLayout, DetailSection, TitleCell } from '@/components/ui/Detail';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { useFilter } from '@/hooks/useFilter';
import { listAtivos, resumoInventario, labsDoAtivo, saveAtivo, removeAtivo, inventarioSeedUpdate, incorporarNovidadesSeed } from '@/services/inventario';
import { DOMINIO_LAB, ESTADO_ATIVO_COLOR, TIPO_ATIVO_LABEL } from '@/theme/status';
import * as vault from '@/services/vault';

const ROWS = 10;
const TIPO_CHIPS: TipoAtivo[] = ['host', 'vm', 'container', 'storage', 'vlan', 'rede', 'switch', 'firewall_policy', 'servico'];
const TIPO_OPTS = Object.entries(TIPO_ATIVO_LABEL).map(([value, label]) => ({ value, label }));
const ESTADO_OPTS = ['ativo', 'atencao', 'critico', 'planejado', 'desativado'].map((value) => ({ value, label: value }));

export function Inventario() {
  const [page, setPage] = useState(0);
  const resetPage = () => setPage(0);
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const tipo = useFilter<TipoAtivo>(resetPage);
  const estado = useFilter<EstadoAtivo>(resetPage);
  const [sel, setSel] = useState<Ativo | null>(null);
  const [draft, setDraft] = useState<Ativo | null>(null);
  const [detalhesRaw, setDetalhesRaw] = useState('{}');
  const [formError, setFormError] = useState('');

  const filtros = useMemo(
    () => ({ search, tipo: tipo.value, estado: estado.value, page, rows: ROWS }),
    [search, tipo.value, estado.value, page],
  );
  const query = useQuery({ queryKey: ['ativos', filtros], queryFn: () => listAtivos(filtros) });
  const data = query.data;
  const resumoQuery = useQuery({ queryKey: ['resumo-inv'], queryFn: resumoInventario });
  const resumo = resumoQuery.data;
  const seedUpdate = inventarioSeedUpdate();

  function changeSearch(v: string) { setSearchRaw(v); resetPage(); }

  function criarAtivo() {
    setSel(null); setFormError(''); setDetalhesRaw('{}');
    setDraft({ id: '', ambiente: 'criecomia', tipo: 'servico', nome: '', endereco: '', funcao: '', estado: 'ativo', detalhes: {}, tags: [], labsRelacionados: [] });
  }
  function editarAtivo(ativo: Ativo) {
    setSel(null); setFormError(''); setDetalhesRaw(JSON.stringify(ativo.detalhes, null, 2)); setDraft({ ...ativo });
  }
  function salvarEdicao() {
    if (!draft) return;
    let detalhes: unknown;
    try { detalhes = JSON.parse(detalhesRaw); } catch { setFormError('Os detalhes precisam estar em formato JSON válido.'); return; }
    const parsed = AtivoSchema.safeParse({ ...draft, detalhes });
    if (!parsed.success) { setFormError('Confira os campos obrigatórios e o formato dos detalhes.'); return; }
    saveAtivo(parsed.data);
    setDraft(null);
    void query.refetch();
    void resumoQuery.refetch();
  }
  function excluirAtivo(ativo: Ativo) {
    if (!window.confirm(`Remover o ativo “${ativo.nome}” do inventário?`)) return;
    removeAtivo(ativo.id);
    setSel(null);
    void query.refetch();
    void resumoQuery.refetch();
  }

  return (
    <div>
      <PageHeader title="Meu Ambiente" subtitle="Inventário vivo do homelab CRIECOMIA (Proxmox, Coolify, storage, rede). Sem credenciais — essas ficam no Cofre."
        actions={<Button label="Novo ativo" icon="pi pi-plus" onClick={criarAtivo} />} />

      <Message severity="warn" style={{ width: '100%', marginTop: '1rem' }} text="O seed do projeto agora usa somente ativos fictícios. Dados já salvos por versões antigas permanecem no navegador para evitar apagá-los sem autorização; faça um backup privado e revise endereços, nomes e detalhes antes de publicar ou sincronizar o inventário." />

      <StatusStrip tone={resumo && resumo.criticos > 0 ? 'crit' : 'ok'} icon="pi-server">
        {resumo?.total ?? 0} ativos · <strong>{resumo?.criticos ?? 0}</strong> críticos, {resumo?.atencao ?? 0} em atenção.
      </StatusStrip>
      {seedUpdate.disponivel && <Message severity="info" style={{ width: '100%', marginTop: '1rem' }} content={<div className="iv-row iv-wrap" style={{ justifyContent: 'space-between', width: '100%' }}><span>Há {seedUpdate.quantidade} ativos novos no catálogo inicial. Eles serão adicionados sem alterar os seus ativos atuais.</span><Button label="Incorporar novidades" icon="pi pi-download" onClick={() => { const n = incorporarNovidadesSeed(); window.alert(`${n} ativos adicionados.`); void query.refetch(); void resumoQuery.refetch(); }} /></div>} />}

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

      <Sidebar visible={!!sel || !!draft} position="right" onHide={() => { setSel(null); setDraft(null); }} style={{ width: 520 }}>
        {draft ? (
          <DetailLayout>
            <DetailHeader title={draft.id ? 'Editar ativo' : 'Novo ativo'} />
            {formError && <Message severity="error" text={formError} />}
            <div className="iv-col iv-gap">
              <label className="iv-col">Nome<InputText value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} autoFocus /></label>
              <label className="iv-col">Tipo<Dropdown value={draft.tipo} options={TIPO_OPTS} onChange={(e) => setDraft({ ...draft, tipo: e.value })} /></label>
              <label className="iv-col">Endereço ou IP<InputText value={draft.endereco} onChange={(e) => setDraft({ ...draft, endereco: e.target.value })} /></label>
              <label className="iv-col">Função<InputText value={draft.funcao} onChange={(e) => setDraft({ ...draft, funcao: e.target.value })} /></label>
              <label className="iv-col">Estado<Dropdown value={draft.estado} options={ESTADO_OPTS} onChange={(e) => setDraft({ ...draft, estado: e.value })} /></label>
              <label className="iv-col">Tags (separadas por vírgula)<InputText value={draft.tags.join(', ')} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></label>
              <label className="iv-col">Detalhes adicionais (JSON)<InputTextarea value={detalhesRaw} rows={5} autoResize onChange={(e) => setDetalhesRaw(e.target.value)} /></label>
              <Message severity="warn" text="O inventário contém informações reais da rede do homelab. Não inclua senhas, tokens ou segredos." />
              <div className="iv-row"><Button label="Salvar ativo" icon="pi pi-save" onClick={salvarEdicao} /><Button label="Cancelar" text onClick={() => setDraft(null)} /></div>
            </div>
          </DetailLayout>
        ) : sel && <AtivoDetalhe ativo={sel} onEdit={() => editarAtivo(sel)} onRemove={() => excluirAtivo(sel)} temCredencial={vault.isUnlocked() && vault.listEntries().some((e) => e.ativoId === sel.id)} />}
      </Sidebar>
    </div>
  );
}

function AtivoDetalhe({ ativo, onEdit, onRemove, temCredencial }: { ativo: Ativo; onEdit: () => void; onRemove: () => void; temCredencial: boolean }) {
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
      {temCredencial && <Message severity="info" text="Há uma credencial relacionada no Cofre. O conteúdo não é exibido aqui." className="iv-mt" />}
      <div className="iv-row iv-wrap iv-mt">
        <Button label="Editar" icon="pi pi-pencil" outlined onClick={onEdit} />
        <Button label="Remover" icon="pi pi-trash" severity="danger" outlined onClick={onRemove} />
      </div>

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
