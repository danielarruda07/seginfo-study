import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import { diaLocal, type ProjetoLinkedin, type StatusProjeto } from '@seginfo/shared';
import { EmptyState, Pill, StatusStrip } from '@/components/InfraKit';
import { ClickCard } from '@/components/ui/ClickCard';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { useInvalidate } from '@/hooks/useInvalidate';
import { getEstrategia, mensagemErro } from '@/services/linkedin';
import { editarProjeto, removerProjeto } from '@/services/linkedinPipeline';
import { useIdeias, useProjetos, usePublicados, useRascunhos } from './dados';
import { STATUS_PROJETO_META, fusoDoNavegador, resumoDoProjeto } from './pipelineRegras';
import { ProjetoDrawer } from './ProjetoDrawer';
import { ProjetoForm } from './ProjetoForm';

type Aviso = { sev: 'success' | 'error'; text: string };
const ORDEM: Record<StatusProjeto, number> = { ativo: 0, pausado: 1, concluido: 2 };

/** Projetos (ou séries) de conteúdo: a forma de separar por assunto ideias, rascunhos, posts e marcos. */
export function Projetos({ onNovaIdeia }: { onNovaIdeia: (projetoId: string) => void }) {
  const invalidate = useInvalidate();
  const { data: projetos = [], isLoading, error } = useProjetos();
  const { data: ideias = [] } = useIdeias();
  const { data: rascunhos = [] } = useRascunhos();
  const { data: publicados = [] } = usePublicados();
  const { data: estrategia } = useQuery({ queryKey: ['linkedin-estrategia'], queryFn: getEstrategia });

  const [form, setForm] = useState<{ projeto: ProjetoLinkedin | null } | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const fuso = fusoDoNavegador();
  const hoje = diaLocal(new Date(), fuso);
  const ordenados = useMemo(() => [...projetos].sort((a, b) => ORDEM[a.status] - ORDEM[b.status] || a.nome.localeCompare(b.nome)), [projetos]);
  const resumos = useMemo(() => new Map(projetos.map((p) => [p.id, resumoDoProjeto(p, { ideias, rascunhos, publicados }, hoje, fuso)])),
    [projetos, ideias, rascunhos, publicados, hoje, fuso]);
  const sel = useDrawerSelection(ordenados);
  const ativos = projetos.filter((p) => p.status === 'ativo').length;
  const parados = [...resumos.values()].filter((r) => r.parado).length;
  const recarregar = () => invalidate('linkedin-projetos', 'linkedin-ideias', 'linkedin-rascunhos', 'linkedin-publicados', 'linkedin-diario');

  async function mudarStatus(p: ProjetoLinkedin, status: StatusProjeto) {
    setOcupado(true); setAviso(null);
    try { await editarProjeto(p.id, { status }); invalidate('linkedin-projetos'); }
    catch (e) { setAviso({ sev: 'error', text: mensagemErro(e) }); }
    finally { setOcupado(false); }
  }

  function excluir(p: ProjetoLinkedin) {
    confirmDialog({
      header: 'Excluir projeto',
      message: <span>Excluir o projeto <strong>{p.nome}</strong>?<br /><small className="iv-muted">Ideias, rascunhos, posts e marcos ligados a ele continuam existindo, só ficam sem projeto. Se a série acabou, prefira <em>Concluir</em>.</small></span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Excluir', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        try { await removerProjeto(p.id); sel.close(); recarregar(); }
        catch (e) { setAviso({ sev: 'error', text: mensagemErro(e) }); }
      },
    });
  }

  return (
    <div>
      <StatusStrip tone={parados ? 'warn' : 'ok'} icon="pi-folder">
        {ativos} {ativos === 1 ? 'projeto ativo' : 'projetos ativos'}.
        {parados > 0 && <> <strong>{parados}</strong> sem post há 14 dias ou mais.</>}
        {' '}Um projeto reúne tudo de um assunto: do que você quer falar até o que já publicou.
      </StatusStrip>
      {error && <Message severity="error" text={mensagemErro(error)} className="ca-msg" />}

      <div className="iv-card iv-mt">
        <div className="ca-toolbar">
          <Button label="Novo projeto" icon="pi pi-plus" onClick={() => setForm({ projeto: null })} />
          <span className="iv-muted ca-small">Exemplos: um lab em andamento, uma certificação, a construção de uma ferramenta.</span>
        </div>
        {aviso && <Message severity={aviso.sev} text={aviso.text} className="ca-msg" />}
      </div>

      <div className="lp-grade iv-mt">
        {isLoading && <p className="iv-muted" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando projetos…</p>}
        {!isLoading && projetos.length === 0 && (
          <div className="iv-card lp-grade__cheio"><EmptyState icon="pi-folder" title="Nenhum projeto ainda"
            text="Crie um para cada assunto em que você está trabalhando. Depois, ligue ideias e posts a ele para ver o que anda e o que parou."
            action={<Button label="Novo projeto" icon="pi pi-plus" onClick={() => setForm({ projeto: null })} />} /></div>
        )}
        {ordenados.map((p) => {
          const r = resumos.get(p.id)!;
          const meta = STATUS_PROJETO_META[p.status];
          return (
            <ClickCard key={p.id} onOpen={() => sel.open(p.id)} selected={sel.isOpen(p.id)} tone={r.parado ? 'serious' : p.status === 'ativo' ? undefined : 'muted'} label={`Abrir projeto ${p.nome}`}>
              <div className="ca-post__meta">
                <strong className="ca-flex1">{p.nome}</strong>
                <Pill label={meta.label} tone={meta.tone} />
              </div>
              {p.descricao && <p className="iv-muted ca-small ca-clamp-2 lp-cartao__gancho">{p.descricao}</p>}
              <dl className="lp-contagens">
                <div><dt>Ideias</dt><dd>{r.ideiasNovas}</dd></div>
                <div><dt>Em andamento</dt><dd>{r.emAndamento}</dd></div>
                <div><dt>Agendados</dt><dd>{r.agendados}</dd></div>
                <div><dt>Publicados</dt><dd>{r.publicados}</dd></div>
              </dl>
              <p className="ca-small ca-mb0">
                {r.parado && <i className="pi pi-clock lp-aviso" aria-hidden="true" />}{' '}
                {r.diasSemPost === null ? 'Ainda sem post' : r.diasSemPost === 0 ? 'Último post hoje' : `Último post há ${r.diasSemPost} ${r.diasSemPost === 1 ? 'dia' : 'dias'}`}
              </p>
            </ClickCard>
          );
        })}
      </div>

      {sel.item && (
        <ProjetoDrawer projeto={sel.item} nav={sel.nav} resumo={resumos.get(sel.item.id)!} ideias={ideias} rascunhos={rascunhos} publicados={publicados} ocupado={ocupado}
          onNovaIdeia={() => { const id = sel.item!.id; sel.close(); onNovaIdeia(id); }}
          onEditar={() => setForm({ projeto: sel.item! })}
          onStatus={(s) => mudarStatus(sel.item!, s)}
          onExcluir={() => excluir(sel.item!)} />
      )}
      {form && (
        <ProjetoForm key={form.projeto?.id ?? 'novo'} inicial={form.projeto} pilares={estrategia?.pilares ?? []}
          onClose={() => setForm(null)}
          onSalvo={(nome) => { setForm(null); invalidate('linkedin-projetos'); setAviso({ sev: 'success', text: `Projeto salvo: "${nome}".` }); }} />
      )}
    </div>
  );
}
