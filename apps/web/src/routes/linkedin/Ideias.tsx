import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import { STATUS_IDEIA, type IdeiaLinkedin, type StatusIdeia } from '@seginfo/shared';
import { Chip, EmptyState, Pill, StatusStrip } from '@/components/InfraKit';
import { ClickCard } from '@/components/ui/ClickCard';
import { SearchInput } from '@/components/ui/SearchInput';
import { useDebounce } from '@/hooks/useDebounce';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useInvalidate } from '@/hooks/useInvalidate';
import { getEstrategia, mensagemErro } from '@/services/linkedin';
import { editarIdeia, ideiaDoRadar, removerIdeia } from '@/services/linkedinPipeline';
import { useIdeias, useOpcoesDeProjeto, useProjetos } from './dados';
import type { PedidoEstudio } from './Estudio';
import { IdeiaDrawer } from './IdeiaDrawer';
import { IdeiaForm, ideiaParaForm, type IdeiaInicial } from './IdeiaForm';
import { ORIGEM_IDEIA_LABEL, STATUS_IDEIA_LABEL, filtrarIdeias, nomeDoProjeto } from './pipelineRegras';

type Aviso = { sev: 'success' | 'info' | 'error'; text: string };

/** Backlog de ideias: tudo o que pode virar post, venha de você, de uma análise, de um lab, do diário ou do Radar. */
export function Ideias({ onEscrever, novaNoProjeto, onNovaConsumida }: {
  onEscrever: (p: PedidoEstudio) => void;
  /** vindo da aba Projetos: abrir o formulário já com o projeto */
  novaNoProjeto: string | null;
  onNovaConsumida: () => void;
}) {
  const invalidate = useInvalidate();
  const { data: ideias = [], isLoading, error } = useIdeias();
  const { data: projetos = [] } = useProjetos();
  const { data: estrategia } = useQuery({ queryKey: ['linkedin-estrategia'], queryFn: getEstrategia });
  const opcoesProjeto = useOpcoesDeProjeto(projetos);

  const [status, setStatus] = useState<StatusIdeia>('nova');
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const termo = useDebounce(busca, 300);
  const [form, setForm] = useState<IdeiaInicial | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [radar, setRadar] = useState(false);

  // pedido da aba Projetos: abre o formulário já com o projeto escolhido
  useEffect(() => {
    if (!novaNoProjeto) return;
    setForm({ projetoId: novaNoProjeto });
    onNovaConsumida();
  }, [novaNoProjeto, onNovaConsumida]);

  const visiveis = useMemo(() => filtrarIdeias(ideias, { status, projetoId, busca: termo }), [ideias, status, projetoId, termo]);
  const sel = useDrawerSelection(visiveis);
  const conta = (s: StatusIdeia) => ideias.filter((i) => i.status === s).length;
  const recarregar = () => invalidate('linkedin-ideias');

  async function mudarStatus(i: IdeiaLinkedin, novo: 'nova' | 'descartada') {
    setOcupado(true); setAviso(null);
    try { await editarIdeia(i.id, { status: novo }); recarregar(); }
    catch (e) { setAviso({ sev: 'error', text: mensagemErro(e) }); }
    finally { setOcupado(false); }
  }

  function excluir(i: IdeiaLinkedin) {
    confirmDialog({
      header: 'Excluir ideia', message: <span>Excluir a ideia <strong>{i.titulo}</strong>? Se só não serve agora, prefira <em>Descartar</em>: ela sai da lista e pode voltar.</span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        try { await removerIdeia(i.id); sel.close(); recarregar(); }
        catch (e) { setAviso({ sev: 'error', text: mensagemErro(e) }); }
      },
    });
  }

  async function doRadar() {
    setRadar(true); setAviso(null);
    try {
      const i = await ideiaDoRadar(7);
      setStatus('nova'); recarregar();
      setAviso({ sev: 'success', text: `Ideia criada a partir do Radar: "${i.titulo}". Os números são agregados, sem endereço nem alvo.` });
    } catch (e) {
      setAviso({ sev: 'error', text: mensagemErro(e) });
    } finally {
      setRadar(false);
    }
  }

  const escrever = (i: IdeiaLinkedin) => onEscrever({
    briefing: i.briefing || i.titulo, pilar: i.pilar ?? undefined, projetoId: i.projetoId, formato: i.formato ?? undefined, ideiaId: i.id,
  });

  return (
    <div>
      <StatusStrip tone="ok" icon="pi-lightbulb">
        {conta('nova')} {conta('nova') === 1 ? 'ideia esperando' : 'ideias esperando'} para virar post. Análises de posts, labs concluídos, marcos do diário e o planejador depositam ideias aqui.
      </StatusStrip>
      {error && <Message severity="error" text={mensagemErro(error)} className="ca-msg" />}

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <SearchInput value={busca} onChange={setBusca} placeholder="Buscar ideia" />
          <Dropdown value={projetoId} options={opcoesProjeto} onChange={(e) => setProjetoId(e.value ?? null)} placeholder="Todos os projetos"
            showClear ariaLabel="Filtrar por projeto" emptyMessage="Nenhum projeto criado" />
          <Button label="Nova ideia" icon="pi pi-plus" onClick={() => setForm({ projetoId })} />
          <Button label={radar ? 'Lendo o Radar…' : 'Ideia do Radar (7 dias)'} icon="pi pi-shield" outlined loading={radar} onClick={doRadar}
            tooltip="Cria uma ideia com os números agregados dos ataques da semana" tooltipOptions={{ position: 'bottom' }} />
        </div>
        <div className="iv-row iv-wrap iv-mt" role="group" aria-label="Filtrar por situação">
          {STATUS_IDEIA.map((s) => <Chip key={s} label={`${STATUS_IDEIA_LABEL[s]} (${conta(s)})`} active={status === s} onClick={() => setStatus(s)} />)}
          <span className="iv-toolbar__count">{visiveis.length} {visiveis.length === 1 ? 'ideia' : 'ideias'}</span>
        </div>
        {aviso && <Message severity={aviso.sev} text={aviso.text} className="ca-msg" />}
      </div>

      <div className="lp-grade iv-mt">
        {isLoading && <p className="iv-muted" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando ideias…</p>}
        {!isLoading && visiveis.length === 0 && (
          <div className="iv-card lp-grade__cheio"><EmptyState icon="pi-lightbulb"
            title={ideias.length === 0 ? 'Nenhuma ideia anotada' : 'Nada com esses filtros'}
            text={ideias.length === 0 ? 'Anote a primeira, organize um post publicado com a IA ou peça uma pauta ao planejador no Pipeline.' : 'Mude a situação, o projeto ou a busca.'}
            action={ideias.length === 0 ? <Button label="Nova ideia" icon="pi pi-plus" onClick={() => setForm({})} /> : undefined} /></div>
        )}
        {visiveis.map((i) => {
          const projeto = nomeDoProjeto(projetos, i.projetoId);
          return (
            <ClickCard key={i.id} onOpen={() => sel.open(i.id)} selected={sel.isOpen(i.id)} label={`Abrir ideia ${i.titulo}`}>
              <strong className="ca-clamp-2">{i.titulo}</strong>
              {i.briefing && <p className="iv-muted ca-small ca-clamp-2 lp-cartao__gancho">{i.briefing}</p>}
              <div className="ca-post__meta">
                <Pill label={ORIGEM_IDEIA_LABEL[i.origem]} icon="pi-compass" />
                {projeto && <Pill label={projeto} icon="pi-folder" />}
                {i.pilar && <Pill label={i.pilar} tone="info" />}
                {i.sugeridaPara && <Pill label={i.sugeridaPara.split('-').reverse().slice(0, 2).join('/')} icon="pi-calendar" />}
              </div>
            </ClickCard>
          );
        })}
      </div>

      {sel.item && (
        <IdeiaDrawer ideia={sel.item} nav={sel.nav} projeto={nomeDoProjeto(projetos, sel.item.projetoId)} ocupado={ocupado}
          onEscrever={() => { const i = sel.item!; sel.close(); escrever(i); }}
          onEditar={() => setForm(ideiaParaForm(sel.item!))}
          onStatus={(s) => mudarStatus(sel.item!, s)}
          onExcluir={() => excluir(sel.item!)} />
      )}
      {form && (
        <IdeiaForm key={form.id ?? 'nova'} inicial={form} projetos={opcoesProjeto} pilares={estrategia?.pilares ?? []}
          onClose={() => setForm(null)}
          onSalva={(nome) => { setForm(null); recarregar(); setAviso({ sev: 'success', text: `Ideia guardada: "${nome}".` }); }} />
      )}
    </div>
  );
}
