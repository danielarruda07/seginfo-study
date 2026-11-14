import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ConfirmDialog } from 'primereact/confirmdialog';
import type { FaseFerramenta, FerramentaCatalogo } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { EmptyState, Kpi } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useDebounce } from '@/hooks/useDebounce';
import { DOMINIO_LAB, FASE_FERRAMENTA_LABEL, FASES_FERRAMENTA_ORDEM } from '@/theme/status';
import { listExperiencias, listFerramentas } from '@/services/ferramentas';
import { listLabs } from '@/services/inventario';
import { listRangeAlvos } from '@/services/range';
import { combina } from './pratica/relacoes';
import { FILTRO_USO_LABEL, passaFiltroUso, resumirFerramenta, type FiltroUso, type ResumoFerramenta } from './ferramentas/resumo';
import { FerramentaCard } from './ferramentas/FerramentaCard';
import { FerramentaDrawer } from './ferramentas/FerramentaDrawer';
import '@/styles/telas/pratica.css';

type Dominio = FerramentaCatalogo['dominio'];
const FASE_OPTS = FASES_FERRAMENTA_ORDEM.map((value) => ({ value, label: FASE_FERRAMENTA_LABEL[value] }));
const DOMINIO_OPTS = (['blue', 'red', 'purple', 'infra'] as Dominio[]).map((value) => ({ value, label: DOMINIO_LAB[value].label }));

export function Ferramentas() {
  const { data, isLoading } = useQuery({ queryKey: ['ferramentas'], queryFn: listFerramentas });
  const toast = useRef<Toast>(null);
  const [fase, setFase] = useState<FaseFerramenta | undefined>();
  const [dominio, setDominio] = useState<Dominio | undefined>();
  const [uso, setUso] = useState<FiltroUso | undefined>();
  const [busca, setBusca] = useState('');
  const search = useDebounce(busca);
  const [revisao, setRevisao] = useState(0);

  const todas = useMemo(() => data ?? [], [data]);
  // revisao força reler os registros locais depois de salvar/excluir na ficha
  const resumos = useMemo(() => {
    const labs = listLabs();
    const alvos = listRangeAlvos();
    const experiencias = todas.flatMap((f) => listExperiencias(f.id));
    return new Map<string, ResumoFerramenta>(todas.map((f) => [f.id, resumirFerramenta(f, experiencias, labs, alvos)]));
  }, [todas, revisao]);
  const resumoDe = (id: string) => resumos.get(id) ?? { registros: 0, pendencias: 0, labs: 0, alvos: 0 };
  const conta = (u: FiltroUso) => todas.filter((f) => passaFiltroUso(f, resumoDe(f.id), u)).length;

  const ferramentas = useMemo(() => todas.filter((f) =>
    (!fase || f.fase === fase) && (!dominio || f.dominio === dominio) && passaFiltroUso(f, resumos.get(f.id)!, uso) &&
    combina(search, f.nome, f.descricao, FASE_FERRAMENTA_LABEL[f.fase])), [todas, fase, dominio, uso, search, resumos]);
  const sel = useDrawerSelection(ferramentas);

  const toggleUso = (u: FiltroUso) => setUso((atual) => (atual === u ? undefined : u));
  const limpar = () => { setFase(undefined); setDominio(undefined); setUso(undefined); setBusca(''); };
  const filtros = [
    uso && { key: 'uso', label: FILTRO_USO_LABEL[uso], onRemove: () => setUso(undefined) },
    fase && { key: 'fase', label: FASE_FERRAMENTA_LABEL[fase], onRemove: () => setFase(undefined) },
    dominio && { key: 'dominio', label: DOMINIO_LAB[dominio].label, onRemove: () => setDominio(undefined) },
    search && { key: 'busca', label: `“${search}”`, onRemove: () => setBusca('') },
  ];

  function aoMudar(msg?: string) {
    setRevisao((n) => n + 1);
    if (msg) toast.current?.show({ severity: 'success', summary: msg, life: 2500 });
  }

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />
      <PageHeader title="Arsenal de Ferramentas"
        subtitle="Referência rápida das ferramentas de segurança por fase do workflow, do reconhecimento à defesa. Abra uma para ver onde praticar e anotar o que testou." />

      <div className="iv-kpis iv-mt">
        <Kpi label="Com registro seu" icon="pi-book" value={conta('registro')} hint={`de ${todas.length} ferramentas`} active={uso === 'registro'} onClick={() => toggleUso('registro')} />
        <Kpi label="Pendências abertas" icon="pi-exclamation-circle" tone="warning" value={conta('pendencia')} hint="ferramentas com algo a fazer" active={uso === 'pendencia'} onClick={() => toggleUso('pendencia')} />
        <Kpi label="Vêm no Kali" icon="pi-desktop" value={conta('kali')} hint="prontas na VM atacante" active={uso === 'kali'} onClick={() => toggleUso('kali')} />
        <Kpi label="Previstas no Range" icon="pi-shield" value={conta('range')} hint="instaladas em algum alvo" active={uso === 'range'} onClick={() => toggleUso('range')} />
      </div>

      <div className="iv-toolbar pr-toolbar iv-mt">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar ferramenta ou para que serve" />
        <Dropdown value={fase} options={FASE_OPTS} onChange={(e) => setFase(e.value)} placeholder="Todas as fases" showClear aria-label="Fase do workflow" />
        <Dropdown value={dominio} options={DOMINIO_OPTS} onChange={(e) => setDominio(e.value)} placeholder="Todos os domínios" showClear aria-label="Domínio" />
        <span className="iv-toolbar__count">{ferramentas.length} {ferramentas.length === 1 ? 'ferramenta' : 'ferramentas'}</span>
      </div>
      <ActiveFiltersBar filters={filtros} onClearAll={limpar} />

      {ferramentas.length === 0 && !isLoading ? (
        <div className="iv-card"><EmptyState icon="pi-filter-slash" title="Nenhuma ferramenta com estes filtros" action={<Button label="Limpar filtros" text onClick={limpar} />} /></div>
      ) : (
        <div className="pr-grid">
          {ferramentas.map((f) => (
            <FerramentaCard key={f.id} ferramenta={f} resumo={resumoDe(f.id)} selected={sel.isOpen(f.id)} onOpen={() => sel.open(f.id)} />
          ))}
        </div>
      )}

      {sel.item && <FerramentaDrawer ferramenta={sel.item} nav={sel.nav} onChanged={aoMudar} />}
    </div>
  );
}
