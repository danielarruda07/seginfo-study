import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { ConfirmDialog } from 'primereact/confirmdialog';
import type { Lab } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { EmptyState, Kpi } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useDebounce } from '@/hooks/useDebounce';
import { useInvalidate } from '@/hooks/useInvalidate';
import { listLabs, getProgressoLab, saveProgressoLab, type EstadoLab, type ProgressoLab } from '@/services/inventario';
import { addPost, listPosts } from '@/services/sessoes';
import { getModeSync } from '@/services/mode';
import { mensagemErro } from '@/services/linkedin';
import { criarIdeia } from '@/services/linkedinPipeline';
import { listPurpleExercises } from '@/services/exerciciosPurple';
import { DOMINIO_LAB } from '@/theme/status';
import { combina, labPedeAcao, resumoRedBlue } from './pratica/relacoes';
import { ESTADO_LAB_META } from './labs/estado';
import { LabCard } from './labs/LabCard';
import { LabDrawer } from './labs/LabDrawer';
import '@/styles/telas/pratica.css';

type Dominio = Lab['dominio'];
type FiltroEstado = EstadoLab | 'lacuna';
const DOMINIO_OPTS = (['blue', 'red', 'purple', 'infra'] as Dominio[]).map((value) => ({ value, label: DOMINIO_LAB[value].label }));
const FILTRO_LABEL: Record<FiltroEstado, string> = { ...Object.fromEntries(Object.entries(ESTADO_LAB_META).map(([k, v]) => [k, v.label])) as Record<EstadoLab, string>, lacuna: 'Com lacuna de detecção' };

export function Labs() {
  const { data, isLoading } = useQuery({ queryKey: ['labs'], queryFn: listLabs });
  const todos = data ?? [];
  const toast = useRef<Toast>(null);
  const invalidate = useInvalidate();
  const [dominio, setDominio] = useState<Dominio | undefined>();
  const [estado, setEstado] = useState<FiltroEstado | undefined>();
  const [busca, setBusca] = useState('');
  const search = useDebounce(busca);
  const [revExercicios, setRevExercicios] = useState(0);
  const [progresso, setProgresso] = useState<Record<string, ProgressoLab>>(() =>
    Object.fromEntries(listLabs().map((lab) => [lab.id, getProgressoLab(lab.id)])),
  );

  // revExercicios força reler o registro local depois de salvar/excluir na ficha
  const exercicios = useMemo(() => listPurpleExercises(), [revExercicios]);
  const redBlue = resumoRedBlue(exercicios);
  const porLab = useMemo(() => {
    const m = new Map<string, typeof exercicios>();
    for (const e of exercicios) m.set(e.labId, [...(m.get(e.labId) ?? []), e]);
    return m;
  }, [exercicios]);
  const statusDe = (id: string) => progresso[id]?.status ?? 'nao_iniciado';
  const conta = (s: EstadoLab) => todos.filter((l) => statusDe(l.id) === s).length;
  const comLacuna = todos.filter((l) => labPedeAcao(porLab.get(l.id) ?? [])).length;

  const labs = useMemo(() => todos.filter((l) =>
    (!dominio || l.dominio === dominio) &&
    (!estado || (estado === 'lacuna' ? labPedeAcao(porLab.get(l.id) ?? []) : statusDe(l.id) === estado)) &&
    combina(search, l.titulo, l.objetivo, ...(l.mitre ?? []))),
  [todos, dominio, estado, search, progresso, porLab]);
  const sel = useDrawerSelection(labs);

  const toggleEstado = (s: FiltroEstado) => setEstado((atual) => (atual === s ? undefined : s));
  const limpar = () => { setDominio(undefined); setEstado(undefined); setBusca(''); };
  const filtros = [
    estado && { key: 'estado', label: FILTRO_LABEL[estado], onRemove: () => setEstado(undefined) },
    dominio && { key: 'dominio', label: DOMINIO_LAB[dominio].label, onRemove: () => setDominio(undefined) },
    search && { key: 'busca', label: `“${search}”`, onRemove: () => setBusca('') },
  ];

  function salvar(labId: string, novo: ProgressoLab) {
    saveProgressoLab(labId, novo);
    setProgresso((atual) => ({ ...atual, [labId]: getProgressoLab(labId) }));
  }

  async function criarRascunho(lab: Lab) {
    const titulo = `Lab: ${lab.titulo}`;
    const aprendizado = getProgressoLab(lab.id).aprendizado;
    // com o servidor no ar, o lab vira uma IDEIA no backlog do LinkedIn (o texto nasce no Estúdio)
    if (getModeSync() === 'servidor') {
      const briefing = `Post sobre um lab que concluí: "${lab.titulo}".\nObjetivo: ${lab.objetivo}\nO que fiz: ${lab.passos.join('; ')}\nResultado esperado: ${lab.resultadoEsperado}\nAprendizado: ${aprendizado || '[CONFIRMAR: o que aprendi]'}`;
      try {
        await criarIdeia({ titulo: titulo.slice(0, 200), briefing: briefing.slice(0, 3_000), origem: 'lab', origemRef: lab.id });
        invalidate('linkedin-ideias');
        toast.current?.show({ severity: 'success', summary: 'Ideia de post criada', detail: `${titulo} (LinkedIn → Ideias)`, life: 4000 });
      } catch (e) {
        const status = (e as { response?: { status?: number } }).response?.status;
        if (status === 409) toast.current?.show({ severity: 'info', summary: 'Ideia já existe', detail: titulo, life: 3000 });
        else toast.current?.show({ severity: 'error', summary: 'Não consegui criar a ideia', detail: mensagemErro(e), life: 5000 });
      }
      return;
    }
    if (listPosts().some((p) => p.titulo === titulo)) {
      toast.current?.show({ severity: 'info', summary: 'Rascunho já existe', detail: titulo, life: 3000 });
      return;
    }
    addPost({ titulo, gancho: `Pratiquei: ${lab.titulo}`, corpo: `Objetivo: ${lab.objetivo}\n\nO que fiz:\n${lab.passos.map((x) => `• ${x}`).join('\n')}\n\nResultado esperado: ${lab.resultadoEsperado}\n\nAprendizados: ${aprendizado || '[Adicione seus aprendizados antes de publicar.]'}`, topicoId: lab.topicoId, publicado: false });
    invalidate('posts');
    toast.current?.show({ severity: 'success', summary: 'Rascunho criado no LinkedIn', detail: titulo, life: 3000 });
  }

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />
      <PageHeader title="Labs Práticos" subtitle="Exercícios de Blue e Red Team amarrados aos ativos reais do seu homelab. Abra um lab para ver passos, alvos, ferramentas e registrar o resultado." />

      <div className="iv-kpis iv-mt">
        <Kpi label="Em andamento" icon="pi-clock" value={conta('em_andamento')} active={estado === 'em_andamento'} onClick={() => toggleEstado('em_andamento')} />
        <Kpi label="Concluídos" icon="pi-check" value={conta('concluido')} hint={`de ${todos.length} labs`} active={estado === 'concluido'} onClick={() => toggleEstado('concluido')} />
        <Kpi label="Não iniciados" icon="pi-circle" value={conta('nao_iniciado')} active={estado === 'nao_iniciado'} onClick={() => toggleEstado('nao_iniciado')} />
        <Kpi label="Execuções Red × Blue" icon="pi-sync" value={redBlue.executados} hint={`${redBlue.detectados} detectadas · ${redBlue.retestes} retestes ok`} />
        <Kpi label="Lacunas de detecção" icon="pi-exclamation-triangle" tone="warning" value={comLacuna} hint="labs sem reteste aprovado"
          active={estado === 'lacuna'} onClick={() => toggleEstado('lacuna')} />
      </div>
      <p className="pr-nota">Exercícios medem controles testados; eventos reais continuam separados no Radar.</p>

      <div className="iv-toolbar pr-toolbar iv-mt">
        <SearchInput value={busca} onChange={setBusca} placeholder="Buscar lab, objetivo ou técnica (T1110)" />
        <Dropdown value={dominio} options={DOMINIO_OPTS} onChange={(e) => setDominio(e.value)} placeholder="Todos os domínios" showClear aria-label="Domínio" />
        <span className="iv-toolbar__count">{labs.length} {labs.length === 1 ? 'lab' : 'labs'}</span>
      </div>
      <ActiveFiltersBar filters={filtros} onClearAll={limpar} />

      {labs.length === 0 && !isLoading ? (
        <div className="iv-card"><EmptyState icon="pi-filter-slash" title="Nenhum lab com estes filtros" action={<Button label="Limpar filtros" text onClick={limpar} />} /></div>
      ) : (
        <div className="pr-grid">
          {labs.map((l) => (
            <LabCard key={l.id} lab={l} progresso={progresso[l.id] ?? getProgressoLab(l.id)} selected={sel.isOpen(l.id)}
              exercicios={porLab.get(l.id)?.length ?? 0} lacuna={labPedeAcao(porLab.get(l.id) ?? [])} onOpen={() => sel.open(l.id)} />
          ))}
        </div>
      )}

      {sel.item && (
        <LabDrawer lab={sel.item} progresso={progresso[sel.item.id] ?? getProgressoLab(sel.item.id)} nav={sel.nav}
          onSave={(p) => salvar(sel.item!.id, p)} onDraft={() => criarRascunho(sel.item!)}
          onExerciciosChange={() => setRevExercicios((n) => n + 1)} />
      )}
    </div>
  );
}
