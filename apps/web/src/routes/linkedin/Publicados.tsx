import { useMemo, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Message } from 'primereact/message';
import { confirmDialog } from 'primereact/confirmdialog';
import type { PostPublicado } from '@seginfo/shared';
import { Kpi, StatusStrip, EmptyState } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import {
  editarPublicado, getEstrategia, importarPublicados, juntarDiario, lerSharesCsv, listDiarioServidor, mensagemErro,
  organizarPost, removerPublicado, sincronizarCerebro,
} from '@/services/linkedin';
import { useOpcoesDeProjeto, useProjetos, usePublicados, useStatusIA } from './dados';
import type { PedidoEstudio } from './Estudio';
import { nomeDoProjeto } from './pipelineRegras';
import { PostCard } from './PostCard';
import { PostDrawer } from './PostDrawer';
import { PostForm, formularioDe, novoFormulario } from './PostForm';
import { PublicadosResumo } from './PublicadosResumo';
import { resumoPublicados, type FormularioPost } from './regras';

type Aviso = { sev: 'success' | 'info' | 'warn' | 'error'; text: string };

export function Publicados({ onUsarIdeia }: { onUsarIdeia: (p: PedidoEstudio) => void }) {
  const invalidate = useInvalidate();
  const { data: posts = [], error: erroLista, isLoading } = usePublicados();
  const { data: projetos = [] } = useProjetos();
  const { data: estrategia } = useQuery({ queryKey: ['linkedin-estrategia'], queryFn: getEstrategia });
  const { data: ia } = useStatusIA();
  const { data: diarioServidor = [] } = useQuery({ queryKey: ['linkedin-diario'], queryFn: listDiarioServidor });
  const opcoesProjeto = useOpcoesDeProjeto(projetos);

  const [form, setForm] = useState<FormularioPost | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState<Record<string, string>>({});
  const [lote, setLote] = useState<string | null>(null);
  const [filtroPilar, setFiltroPilar] = useState<string | undefined>();
  const [filtroProjeto, setFiltroProjeto] = useState<string | null>(null);

  // organizar um post deposita ideias no backlog: as duas listas mudam
  const refresh = () => invalidate('linkedin-publicados', 'linkedin-ideias');
  const iaPronta = !!ia?.configurada;
  const r = useMemo(() => resumoPublicados(posts, estrategia?.pilares ?? []), [posts, estrategia]);
  const visiveis = useMemo(() => posts.filter((p) =>
    (!filtroPilar || p.analise?.pilar === filtroPilar) && (!filtroProjeto || p.projetoId === filtroProjeto)), [posts, filtroPilar, filtroProjeto]);
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
            <Dropdown value={filtroProjeto} options={opcoesProjeto} onChange={(e) => setFiltroProjeto(e.value ?? null)} placeholder="Todos os projetos"
              showClear ariaLabel="Filtrar por projeto" emptyMessage="Nenhum projeto criado" />
          </div>
          <Button label={lote ?? `Organizar pendentes (${r.pendentes.length})`} icon="pi pi-sparkles" severity="help"
            disabled={!r.pendentes.length || !iaPronta || !!lote} loading={!!lote} onClick={organizarPendentes}
            tooltip={!iaPronta ? 'Defina ANTHROPIC_API_KEY na API (Coolify)' : 'A IA lê cada post, liga a pilares, tópicos e trilhas, guarda no Segundo Cérebro e deposita ideias no backlog'}
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

      <PublicadosResumo posts={posts} projetos={projetos} resumo={r} filtroPilar={filtroPilar} onPilar={setFiltroPilar} />

      <div className="ca-lista-cards iv-mt">
        {isLoading && <p className="iv-muted" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando posts…</p>}
        {!isLoading && posts.length === 0 && (
          <div className="iv-card"><EmptyState icon="pi-linkedin" title="Nenhum post registrado"
            text="Registre o primeiro ou importe o export do LinkedIn: cada post publicado vira contexto para os próximos."
            action={<Button label="Registrar post publicado" icon="pi pi-plus" onClick={() => setForm(novoFormulario())} />} /></div>
        )}
        {!isLoading && posts.length > 0 && visiveis.length === 0 && <p className="iv-muted">Nenhum post com esses filtros.</p>}
        {visiveis.map((p) => <PostCard key={p.id} post={p} projeto={nomeDoProjeto(projetos, p.projetoId)} ocupado={ocupado[p.id]} selected={sel.isOpen(p.id)} onOpen={() => sel.open(p.id)} />)}
      </div>

      {sel.item && (
        <PostDrawer post={sel.item} nav={sel.nav} diario={diario} ocupado={ocupado[sel.item.id]} iaPronta={iaPronta} projetos={opcoesProjeto}
          onEditar={() => setForm(formularioDe(sel.item!))}
          onOrganizar={() => comOcupado(sel.item!, 'Analisando...', () => organizarPost(sel.item!.id), 'Post analisado, guardado no Segundo Cérebro e com as ideias no backlog.')}
          onReenviar={() => comOcupado(sel.item!, 'Enviando...', () => sincronizarCerebro(sel.item!.id), 'Nota atualizada no Segundo Cérebro.')}
          onProjeto={(projetoId) => comOcupado(sel.item!, 'Salvando...', () => editarPublicado(sel.item!.id, { projetoId }), projetoId ? 'Post ligado ao projeto.' : 'Post sem projeto.')}
          onExcluir={() => excluir(sel.item!)}
          onUsarIdeia={(ideia) => { const post = sel.item!; sel.close(); onUsarIdeia({ briefing: ideia, pilar: post.analise?.pilar, projetoId: post.projetoId }); }} />
      )}

      {form && <PostForm key={form.id ?? 'novo'} inicial={form} posts={posts} onClose={() => setForm(null)} onSalvo={() => { setForm(null); refresh(); }} />}
    </div>
  );
}
