import { useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { Message } from 'primereact/message';
import type { RascunhoLinkedin } from '@seginfo/shared';
import { EmptyState, StatusStrip } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { mensagemErro } from '@/services/linkedin';
import { AgendarDialog } from './AgendarDialog';
import { Calendario } from './Calendario';
import { useContaLinkedin, useIdeias, useOpcoesDeProjeto, useProjetos, usePublicados, useRascunhos, useStatusIA } from './dados';
import { colunasDoQuadro, falhados, fusoDoNavegador, instantesOcupados, itensDoCalendario, vencidos, type ItemCalendario } from './pipelineRegras';
import { AvisosPipeline, Quadro } from './PipelineQuadro';
import { Planejador } from './Planejador';
import { RascunhoDrawer } from './RascunhoDrawer';
import { RegistrarPublicacaoDialog } from './RegistrarPublicacaoDialog';

const MODOS = [{ value: 'quadro', label: 'Quadro', icon: 'pi pi-th-large' }, { value: 'calendario', label: 'Calendário', icon: 'pi pi-calendar' }];

/** Pipeline: do rascunho ao publicado, em quadro ou calendário, com lembretes e planejador. */
export function Pipeline({ onEditar, onNovo, onVerPublicados, onVerIdeias }: {
  onEditar: (rascunhoId: string) => void;
  onNovo: () => void;
  onVerPublicados: () => void;
  onVerIdeias: () => void;
}) {
  const invalidate = useInvalidate();
  const { data: todos = [], isLoading, error } = useRascunhos();
  const { data: projetos = [] } = useProjetos();
  const { data: publicados = [] } = usePublicados();
  const { data: ideias = [] } = useIdeias();
  const { data: conta } = useContaLinkedin();
  const { data: ia } = useStatusIA();

  const [modo, setModo] = useState<'quadro' | 'calendario'>('quadro');
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [agendar, setAgendar] = useState<RascunhoLinkedin | null>(null);
  const [registrar, setRegistrar] = useState<RascunhoLinkedin | null>(null);
  const [agora, setAgora] = useState(() => new Date());
  // o relógio anda sozinho: um lembrete vence sem precisar recarregar a página
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t); }, []);

  const opcoesProjeto = useOpcoesDeProjeto(projetos);
  const rascunhos = useMemo(() => (projetoId ? todos.filter((r) => r.projetoId === projetoId) : todos), [todos, projetoId]);
  const colunas = useMemo(() => colunasDoQuadro(rascunhos), [rascunhos]);
  const itensCal = useMemo(() => itensDoCalendario(
    rascunhos,
    projetoId ? publicados.filter((p) => p.projetoId === projetoId) : publicados,
    projetoId ? ideias.filter((i) => i.projetoId === projetoId) : ideias,
    fusoDoNavegador(),
  ), [rascunhos, publicados, ideias, projetoId]);
  const sel = useDrawerSelection(rascunhos);
  const naVez = useMemo(() => vencidos(todos, agora), [todos, agora]);
  const comFalha = useMemo(() => falhados(todos), [todos]);
  const emAndamento = todos.filter((r) => r.status !== 'publicado').length;
  const agendados = todos.filter((r) => r.status === 'agendado').length;

  const recarregar = () => invalidate('linkedin-rascunhos', 'linkedin-publicados', 'linkedin-ideias');

  function abrirDoCalendario(i: ItemCalendario) {
    if (i.rascunhoId) sel.open(i.rascunhoId);
    else if (i.postId) onVerPublicados();
    else onVerIdeias();
  }

  return (
    <div>
      <StatusStrip tone={naVez.length || comFalha.length ? 'warn' : 'ok'} icon="pi-send">
        {emAndamento} {emAndamento === 1 ? 'post em andamento' : 'posts em andamento'} · {agendados} com data marcada.
        {' '}Um post só é agendado ou publicado depois de aprovado por você.
      </StatusStrip>
      {error && <Message severity="error" text={mensagemErro(error)} className="ca-msg" />}

      <AvisosPipeline vencidos={naVez} falhados={comFalha} onAbrir={sel.open} onRegistrar={setRegistrar} />

      <div className="iv-card iv-mt">
        <div className="ca-toolbar">
          <div className="iv-row iv-wrap">
            <Button label="Novo post" icon="pi pi-plus" onClick={onNovo} />
            <SelectButton value={modo} options={MODOS} allowEmpty={false} onChange={(e) => setModo(e.value)} aria-label="Modo de visualização"
              itemTemplate={(o: { label: string; icon: string }) => <span><i className={o.icon} aria-hidden="true" /> {o.label}</span>} />
          </div>
          <Dropdown value={projetoId} options={opcoesProjeto} onChange={(e) => setProjetoId(e.value ?? null)} placeholder="Todos os projetos"
            showClear ariaLabel="Filtrar por projeto" style={{ minWidth: 220 }} emptyMessage="Nenhum projeto criado" />
        </div>
      </div>

      <div className="iv-mt">
        {isLoading && <p className="iv-muted" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando o pipeline…</p>}
        {!isLoading && todos.length === 0 && modo === 'quadro' && (
          <div className="iv-card"><EmptyState icon="pi-send" title="Nenhum post no pipeline"
            text="Escreva no Estúdio, parta de uma ideia do backlog ou peça uma pauta ao planejador abaixo."
            action={<Button label="Novo post" icon="pi pi-plus" onClick={onNovo} />} /></div>
        )}
        {!isLoading && todos.length > 0 && modo === 'quadro' && <Quadro colunas={colunas} projetos={projetos} isOpen={sel.isOpen} onOpen={sel.open} />}
        {modo === 'calendario' && <Calendario itens={itensCal} onAbrir={abrirDoCalendario} />}
      </div>

      <div className="iv-mt"><Planejador projetos={projetos} iaPronta={!!ia?.configurada} /></div>

      {sel.item && (
        <RascunhoDrawer rascunho={sel.item} nav={sel.nav} projetos={projetos} contaConectada={!!conta?.conectado}
          onEditar={() => { const id = sel.item!.id; sel.close(); onEditar(id); }}
          onAgendar={() => setAgendar(sel.item!)}
          onRegistrar={() => setRegistrar(sel.item!)}
          onVerPublicados={() => { sel.close(); onVerPublicados(); }}
          onMudou={recarregar} />
      )}
      {agendar && (
        <AgendarDialog key={agendar.id} rascunho={agendar} ocupados={instantesOcupados(todos, publicados, agendar.id)} contaConectada={!!conta?.conectado}
          onClose={() => setAgendar(null)} onAgendado={() => { setAgendar(null); recarregar(); }} />
      )}
      {registrar && (
        <RegistrarPublicacaoDialog key={registrar.id} rascunho={registrar}
          onClose={() => setRegistrar(null)} onRegistrado={() => { setRegistrar(null); recarregar(); }} />
      )}
    </div>
  );
}
