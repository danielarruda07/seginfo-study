import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import type { PostPublicado } from '@seginfo/shared';
import { Kpi, StatusStrip, Chip, EmptyState } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import {
  getEstrategia, importarPublicados, juntarDiario, lerSharesCsv, listDiarioServidor, listPublicados, mensagemErro,
  organizarPost, removerPublicado, sincronizarCerebro, statusIA,
} from '@/services/linkedin';
import type { PedidoEstudio } from './Estudio';
import { PostCard } from './PostCard';
import { PostDrawer } from './PostDrawer';
import { PostForm, formularioDe, novoFormulario } from './PostForm';
import { resumoPublicados, type FormularioPost } from './regras';

/** Rascunho do Estúdio que acabou de ser publicado: pré-preenche o registro. */
export interface RascunhoParaPublicar { texto: string }

type Aviso = { sev: 'success' | 'info' | 'warn' | 'error'; text: string };

export function Publicados({ prefill, onPrefillConsumido, onUsarIdeia }: {
  prefill: RascunhoParaPublicar | null;
  onPrefillConsumido: () => void;
  onUsarIdeia: (p: PedidoEstudio) => void;
}) {
  const invalidate = useInvalidate();
  const { data: posts = [], error: erroLista, isLoading } = useQuery({ queryKey: ['linkedin-publicados'], queryFn: listPublicados });
  const { data: estrategia } = useQuery({ queryKey: ['linkedin-estrategia'], queryFn: getEstrategia });
  const { data: ia } = useQuery({ queryKey: ['ia-status'], queryFn: statusIA });
  const { data: diarioServidor = [] } = useQuery({ queryKey: ['linkedin-diario'], queryFn: listDiarioServidor });

  const [form, setForm] = useState<FormularioPost | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState<Record<string, string>>({});
  const [lote, setLote] = useState<string | null>(null);
  const [filtroPilar, setFiltroPilar] = useState<string | undefined>();

  useEffect(() => {
    if (!prefill) return;
    setForm(novoFormulario(prefill.texto));
    onPrefillConsumido();
  }, [prefill, onPrefillConsumido]);

  const refresh = () => invalidate('linkedin-publicados');
  const iaPronta = !!ia?.configurada;
  const r = useMemo(() => resumoPublicados(posts, estrategia?.pilares ?? []), [posts, estrategia]);
  const visiveis = useMemo(() => (filtroPilar ? posts.filter((p) => p.analise?.pilar === filtroPilar) : posts), [posts, filtroPilar]);
  const diario = useMemo(() => juntarDiario(diarioServidor), [diarioServidor]);
  const sel = useDrawerSelection(visiveis);

  function importar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const lido = lerSharesCsv(String(reader.result));
      if (lido.erro) return setAviso({ sev: 'error', text: lido.erro });
      if (!lido.posts.length) return setAviso({ sev: 'warn', text: 'Nenhum post com texto no arquivo.' });
      try {
        const res = await importarPublicados(lido.posts);
        setAviso({ sev: 'success', text: `${res.novos} posts importados, ${res.duplicados} já existiam${lido.ignorados ? `, ${lido.ignorados} sem texto ignorados (reposts/só imagem)` : ''}. Agora é só organizar com a IA.` });
        refresh();
      } catch (err) {
        setAviso({ sev: 'error', text: mensagemErro(err) });
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  async function comOcupado(post: PostPublicado, rotulo: string, acao: () => Promise<unknown>, ok: string) {
    setOcupado((o) => ({ ...o, [post.id]: rotulo }));
    setAviso(null);
    try { await acao(); setAviso({ sev: 'success', text: ok }); }
    catch (e) { setAviso({ sev: 'error', text: mensagemErro(e) }); }
    finally { setOcupado(({ [post.id]: _, ...resto }) => resto); refresh(); }
  }

  async function organizarPendentes() {
    const fila = [...r.pendentes];
    setAviso(null);
    let feitos = 0;
    for (const p of fila) {
      setLote(`Organizando ${feitos + 1} de ${fila.length}...`);
      try { await organizarPost(p.id); feitos++; refresh(); }
      catch (e) { setAviso({ sev: 'error', text: `Parou em ${feitos} de ${fila.length}: ${mensagemErro(e)}` }); break; }
    }
    setLote(null);
    if (feitos === fila.length) setAviso({ sev: 'success', text: `${feitos} posts organizados e guardados no Segundo Cérebro.` });
  }

  function excluir(post: PostPublicado) {
    confirmDialog({
      header: 'Remover post do registro',
      message: <span>Remover o post de <strong>{post.publicadoEm}</strong> do registro?<br /><small className="iv-muted">A nota no Segundo Cérebro continua lá. O post no LinkedIn não é afetado.</small></span>,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Remover', rejectLabel: 'Cancelar', acceptClassName: 'p-button-danger',
      accept: async () => {
        try { await removerPublicado(post.id); sel.close(); refresh(); }
        catch (e) { setAviso({ sev: 'error', text: mensagemErro(e) }); }
      },
    });
  }

  return (
    <div>
      <StatusStrip tone={r.pendentes.length ? 'warn' : 'ok'} icon="pi-linkedin">
        {posts.length} posts registrados · {r.analisados} organizados pela IA · {r.noCerebro} no Segundo Cérebro.
        {r.pendentes.length > 0 && <> <strong>{r.pendentes.length}</strong> aguardando organização.</>}
      </StatusStrip>
      {erroLista && <Message severity="error" text={mensagemErro(erroLista)} className="ca-msg" />}

      <div className="iv-kpis iv-mt">
        <Kpi label="Publicados" value={posts.length} />
        <Kpi label="Organizados" value={r.analisados} hint="analisados pela IA" />
        <Kpi label="No Segundo Cérebro" value={r.noCerebro} hint="notas pessoais" />
        <Kpi label="Engajamento médio" value={r.taxaMedia ? `${r.taxaMedia}%` : '—'} hint="interações ÷ impressões" />
      </div>

      <div className="iv-card iv-mt">
        <div className="ca-toolbar">
          <div className="iv-row iv-wrap">
            <Button label="Registrar post publicado" icon="pi pi-plus" onClick={() => setForm(novoFormulario())} />
            <label className="p-button p-component p-button-outlined ca-file">
              <span className="p-button-icon p-button-icon-left pi pi-upload" aria-hidden="true" />
              <span className="p-button-label">Importar Shares.csv</span>
              <input type="file" accept=".csv,text/csv" className="ca-file__input" onChange={importar} />
            </label>
          </div>
          <Button label={lote ?? `Organizar pendentes (${r.pendentes.length})`} icon="pi pi-sparkles" severity="help"
            disabled={!r.pendentes.length || !iaPronta || !!lote} loading={!!lote} onClick={organizarPendentes}
            tooltip={!iaPronta ? 'Defina ANTHROPIC_API_KEY na API (Coolify)' : 'A IA lê cada post, liga a pilares, tópicos e trilhas e guarda no Segundo Cérebro'}
            tooltipOptions={{ showOnDisabled: true }} />
        </div>
        <details className="ca-ajuda">
          <summary>Como importar todos os posts de uma vez</summary>
          LinkedIn → Configurações → Privacidade dos dados → <em>Obter uma cópia dos seus dados</em> → marque <em>Publicações (Shares)</em>.
          O arquivo chega por e-mail; use o <code>Shares.csv</code> de dentro do .zip. As métricas não vêm no export: atualize os posts que importam.
        </details>
        {aviso && <Message severity={aviso.sev} text={aviso.text} className="ca-msg" />}
        {ia && !iaPronta && posts.length > 0 && (
          <Message severity="warn" text="IA não configurada: defina o Secret ANTHROPIC_API_KEY na API no Coolify e faça redeploy." className="ca-msg" />
        )}
      </div>

      {r.analisados > 0 && (
        <div className="iv-card iv-mt">
          <h3 className="iv-section-label">Equilíbrio dos pilares · clique para filtrar</h3>
          <div className="iv-row iv-wrap">
            <Chip label={`Todos (${posts.length})`} active={!filtroPilar} onClick={() => setFiltroPilar(undefined)} />
            {r.porPilar.map(([p, n]) => <Chip key={p} label={`${p} (${n})`} active={filtroPilar === p} onClick={() => setFiltroPilar(filtroPilar === p ? undefined : p)} />)}
          </div>
          {r.esquecidos.length > 0 && (
            <p className="iv-muted ca-small ca-mb0"><i className="pi pi-lightbulb" aria-hidden="true" /> Pilar sem nenhum post: <strong>{r.esquecidos.join(', ')}</strong>. Um bom candidato para o próximo.</p>
          )}
        </div>
      )}

      <div className="ca-lista-cards iv-mt">
        {isLoading && <p className="iv-muted" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando posts…</p>}
        {!isLoading && posts.length === 0 && (
          <div className="iv-card"><EmptyState icon="pi-linkedin" title="Nenhum post registrado"
            text="Registre o primeiro ou importe o export do LinkedIn: cada post publicado vira contexto para os próximos."
            action={<Button label="Registrar post publicado" icon="pi pi-plus" onClick={() => setForm(novoFormulario())} />} /></div>
        )}
        {visiveis.map((p) => <PostCard key={p.id} post={p} ocupado={ocupado[p.id]} selected={sel.isOpen(p.id)} onOpen={() => sel.open(p.id)} />)}
      </div>

      {sel.item && (
        <PostDrawer post={sel.item} nav={sel.nav} diario={diario} ocupado={ocupado[sel.item.id]} iaPronta={iaPronta}
          onEditar={() => setForm(formularioDe(sel.item!))}
          onOrganizar={() => comOcupado(sel.item!, 'Analisando...', () => organizarPost(sel.item!.id), 'Post analisado e guardado no Segundo Cérebro.')}
          onReenviar={() => comOcupado(sel.item!, 'Enviando...', () => sincronizarCerebro(sel.item!.id), 'Nota atualizada no Segundo Cérebro.')}
          onExcluir={() => excluir(sel.item!)}
          onUsarIdeia={(ideia) => { sel.close(); onUsarIdeia({ briefing: ideia, pilar: sel.item!.analise?.pilar }); }} />
      )}

      {form && <PostForm key={form.id ?? 'novo'} inicial={form} posts={posts} onClose={() => setForm(null)} onSalvo={() => { setForm(null); refresh(); }} />}
    </div>
  );
}
