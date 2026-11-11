import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { useInvalidate } from '@/hooks/useInvalidate';
import { todayISO } from '@/services/store';
import { getTopico, getTrilha } from '@/services/catalog';
import {
  FORMATOS, criarPublicado, editarPublicado, engajamento, getEstrategia, importarPublicados, isUrlLinkedin,
  lerSharesCsv, listPublicados, mensagemErro, normalizarUrl, organizarPost, removerPublicado, sincronizarCerebro,
  statusIA, taxaEngajamento,
  type FormatoPost, type Metricas, type PostPublicado,
} from '@/services/linkedin';
import type { PedidoEstudio } from './Estudio';

/** Rascunho do Estúdio que acabou de ser publicado: pré-preenche o registro. */
export interface RascunhoParaPublicar { texto: string }

interface Formulario {
  id?: string;
  url: string;
  publicadoEm: string;
  formato: FormatoPost;
  texto: string;
  metricas: Metricas;
}

const novoFormulario = (texto = ''): Formulario => ({ url: '', publicadoEm: todayISO(), formato: 'texto', texto, metricas: {} });

type Aviso = { sev: 'success' | 'info' | 'warn' | 'error'; text: string };

export function Publicados({ prefill, onPrefillConsumido, onUsarIdeia }: {
  prefill: RascunhoParaPublicar | null;
  onPrefillConsumido: () => void;
  onUsarIdeia: (p: PedidoEstudio) => void;
}) {
  const invalidate = useInvalidate();
  const { data: posts = [], error: erroLista } = useQuery({ queryKey: ['linkedin-publicados'], queryFn: listPublicados });
  const { data: estrategia } = useQuery({ queryKey: ['linkedin-estrategia'], queryFn: getEstrategia });
  const { data: ia } = useQuery({ queryKey: ['ia-status'], queryFn: statusIA });

  const [form, setForm] = useState<Formulario | null>(null);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [ocupado, setOcupado] = useState<Record<string, string>>({});
  const [lote, setLote] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [filtroPilar, setFiltroPilar] = useState<string | undefined>();

  useEffect(() => {
    if (!prefill) return;
    setErroForm('');
    setForm(novoFormulario(prefill.texto));
    onPrefillConsumido();
  }, [prefill, onPrefillConsumido]);

  const refresh = () => invalidate('linkedin-publicados');
  const iaPronta = !!ia?.configurada;
  const pilares = estrategia?.pilares ?? [];

  // ---------- indicadores ----------
  const analisados = posts.filter((p) => p.analise);
  const noCerebro = posts.filter((p) => p.memoriaId).length;
  const taxas = posts.map((p) => taxaEngajamento(p.metricas)).filter((t): t is number => t !== null);
  const taxaMedia = taxas.length ? (taxas.reduce((a, b) => a + b, 0) / taxas.length).toFixed(1) : null;
  const porPilar = useMemo(() => {
    const m = new Map<string, number>(pilares.map((p) => [p, 0]));
    for (const p of analisados) m.set(p.analise!.pilar, (m.get(p.analise!.pilar) ?? 0) + 1);
    return [...m];
  }, [analisados, pilares]);
  const esquecidos = analisados.length >= 3 ? porPilar.filter(([, n]) => n === 0).map(([p]) => p) : [];
  const visiveis = filtroPilar ? posts.filter((p) => p.analise?.pilar === filtroPilar) : posts;
  const pendentes = posts.filter((p) => !p.analise);

  // ---------- registro ----------
  async function salvarForm() {
    if (!form) return;
    setErroForm('');
    if (!isUrlLinkedin(form.url)) return setErroForm('Cole o link do post (começa com https://www.linkedin.com/...). Use "Copiar link da publicação" no menu do post.');
    if (form.texto.trim().length < 20) return setErroForm('Cole o texto do post: é dele que a IA tira a organização e o contexto.');
    const duplicado = posts.find((p) => p.id !== form.id && normalizarUrl(p.url) === normalizarUrl(form.url));
    if (duplicado) return setErroForm(`Este post já está registrado (${duplicado.publicadoEm}).`);
    const corpo = { url: form.url.trim(), publicadoEm: form.publicadoEm, formato: form.formato, texto: form.texto.trim(), metricas: { ...form.metricas, atualizadoEm: todayISO() } };
    setSalvando(true);
    try {
      if (form.id) await editarPublicado(form.id, corpo);
      else await criarPublicado(corpo);
      setForm(null);
      refresh();
    } catch (e) {
      setErroForm(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

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
        const r = await importarPublicados(lido.posts);
        setAviso({ sev: 'success', text: `${r.novos} posts importados, ${r.duplicados} já existiam${lido.ignorados ? `, ${lido.ignorados} sem texto ignorados (reposts/só imagem)` : ''}. Agora é só organizar com a IA.` });
        refresh();
      } catch (err) {
        setAviso({ sev: 'error', text: mensagemErro(err) });
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // ---------- organizar (IA no servidor + Segundo Cérebro) ----------
  async function organizarUm(post: PostPublicado) {
    setOcupado((o) => ({ ...o, [post.id]: 'Analisando...' }));
    setAviso(null);
    try {
      await organizarPost(post.id);
      setAviso({ sev: 'success', text: 'Post analisado e guardado no Segundo Cérebro.' });
      setAberto(post.id);
    } catch (e) {
      setAviso({ sev: 'error', text: mensagemErro(e) });
    } finally {
      setOcupado(({ [post.id]: _, ...resto }) => resto);
      refresh();
    }
  }

  async function organizarPendentes() {
    const fila = [...pendentes];
    setAviso(null);
    let feitos = 0;
    for (const p of fila) {
      setLote(`Organizando ${feitos + 1} de ${fila.length}...`);
      try {
        await organizarPost(p.id);
        feitos++;
        refresh();
      } catch (e) {
        setAviso({ sev: 'error', text: `Parou em ${feitos} de ${fila.length}: ${mensagemErro(e)}` });
        break;
      }
    }
    setLote(null);
    if (feitos === fila.length) setAviso({ sev: 'success', text: `${feitos} posts organizados e guardados no Segundo Cérebro.` });
  }

  async function reenviar(post: PostPublicado) {
    setOcupado((o) => ({ ...o, [post.id]: 'Enviando...' }));
    try {
      await sincronizarCerebro(post.id);
      setAviso({ sev: 'success', text: 'Nota atualizada no Segundo Cérebro.' });
    } catch (e) {
      setAviso({ sev: 'error', text: mensagemErro(e) });
    } finally {
      setOcupado(({ [post.id]: _, ...resto }) => resto);
      refresh();
    }
  }

  async function excluir(post: PostPublicado) {
    if (!window.confirm('Remover este post do registro? (A nota no Segundo Cérebro continua lá.)')) return;
    try { await removerPublicado(post.id); refresh(); }
    catch (e) { setAviso({ sev: 'error', text: mensagemErro(e) }); }
  }

  return (
    <div>
      <StatusStrip tone={pendentes.length ? 'warn' : 'ok'} icon="pi-linkedin">
        {posts.length} posts registrados · {analisados.length} organizados pela IA · {noCerebro} no Segundo Cérebro.
        {pendentes.length > 0 && <> <strong>{pendentes.length}</strong> aguardando organização.</>}
      </StatusStrip>
      {erroLista && <Message severity="error" text={mensagemErro(erroLista)} style={{ width: '100%', marginTop: '.75rem' }} />}

      <div className="iv-kpis iv-mt">
        <Kpi label="Publicados" value={posts.length} />
        <Kpi label="Organizados" value={analisados.length} hint="analisados pela IA" />
        <Kpi label="No Segundo Cérebro" value={noCerebro} hint="notas pessoais" />
        <Kpi label="Engajamento médio" value={taxaMedia ? `${taxaMedia}%` : '—'} hint="interações ÷ impressões" />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
          <div className="iv-row iv-wrap">
            <Button label="Registrar post publicado" icon="pi pi-plus" onClick={() => { setErroForm(''); setForm(novoFormulario()); }} />
            <label className="p-button p-component p-button-outlined" style={{ cursor: 'pointer' }}>
              <span className="p-button-icon p-button-icon-left pi pi-upload" />
              <span className="p-button-label">Importar Shares.csv</span>
              <input type="file" accept=".csv,text/csv" hidden onChange={importar} />
            </label>
          </div>
          <Button label={lote ?? `Organizar pendentes (${pendentes.length})`} icon="pi pi-sparkles" severity="help"
            disabled={!pendentes.length || !iaPronta || !!lote} loading={!!lote} onClick={organizarPendentes}
            tooltip={!iaPronta ? 'Defina ANTHROPIC_API_KEY na API (Coolify)' : 'A IA lê cada post, liga a pilares, tópicos e trilhas e guarda no Segundo Cérebro'} />
        </div>
        <p className="iv-muted" style={{ fontSize: '.8rem', margin: '.6rem 0 0' }}>
          <i className="pi pi-info-circle" /> Para importar tudo de uma vez: LinkedIn → Configurações → Privacidade dos dados → <em>Obter uma cópia dos seus dados</em> → marque
          <em> Publicações (Shares)</em>. O arquivo chega por e-mail; use o <code>Shares.csv</code> de dentro do .zip. As métricas não vêm no export — atualize os posts que importam.
        </p>
        {aviso && <Message severity={aviso.sev} text={aviso.text} style={{ width: '100%', marginTop: '.75rem' }} />}
        {ia && !iaPronta && posts.length > 0 && (
          <Message severity="warn" text="IA não configurada: defina o Secret ANTHROPIC_API_KEY na API no Coolify e faça redeploy." style={{ width: '100%', marginTop: '.75rem' }} />
        )}
      </div>

      {analisados.length > 0 && (
        <div className="iv-card iv-mt">
          <h3 style={{ marginTop: 0 }}>Equilíbrio dos pilares</h3>
          <div className="iv-row iv-wrap">
            <Chip label={`Todos (${posts.length})`} active={!filtroPilar} onClick={() => setFiltroPilar(undefined)} />
            {porPilar.map(([p, n]) => <Chip key={p} label={`${p} (${n})`} active={filtroPilar === p} onClick={() => setFiltroPilar(filtroPilar === p ? undefined : p)} />)}
          </div>
          {esquecidos.length > 0 && (
            <p className="iv-muted" style={{ fontSize: '.85rem', marginBottom: 0 }}>
              <i className="pi pi-lightbulb" /> Pilar sem nenhum post: <strong>{esquecidos.join(', ')}</strong>. Um bom candidato para o próximo.
            </p>
          )}
        </div>
      )}

      <div className="iv-col iv-gap iv-mt">
        {posts.length === 0 && (
          <p className="iv-muted">Nenhum post registrado. Registre o primeiro ou importe o export do LinkedIn — cada post publicado vira contexto para os próximos.</p>
        )}
        {visiveis.map((p) => (
          <PostCard key={p.id} post={p} aberto={aberto === p.id} ocupado={ocupado[p.id]} iaPronta={iaPronta}
            onToggle={() => setAberto(aberto === p.id ? null : p.id)}
            onEditar={() => { setErroForm(''); setForm({ id: p.id, url: p.url, publicadoEm: p.publicadoEm, formato: p.formato, texto: p.texto, metricas: p.metricas }); }}
            onOrganizar={() => organizarUm(p)}
            onReenviar={() => reenviar(p)}
            onExcluir={() => excluir(p)}
            onUsarIdeia={(ideia) => onUsarIdeia({ briefing: ideia, pilar: p.analise?.pilar })}
          />
        ))}
      </div>

      <Dialog header={form?.id ? 'Editar post publicado' : 'Registrar post publicado'} visible={!!form} onHide={() => setForm(null)} style={{ width: 'min(680px, 95vw)' }}>
        {form && (
          <div className="iv-col iv-gap">
            <InputText value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.linkedin.com/posts/..." aria-label="Link do post" />
            <div className="iv-row iv-wrap iv-gap">
              <InputText type="date" value={form.publicadoEm} onChange={(e) => setForm({ ...form, publicadoEm: e.target.value })} aria-label="Data de publicação" />
              <Dropdown value={form.formato} options={[...FORMATOS]} onChange={(e) => setForm({ ...form, formato: e.value })} aria-label="Formato" />
            </div>
            <InputTextarea value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} rows={10} autoResize placeholder="Cole aqui o texto do post, como foi publicado." aria-label="Texto do post" />
            {form.id && <small className="iv-muted">Se mudar o texto, a organização feita pela IA é descartada e o post volta para "pendente".</small>}
            <div>
              <strong style={{ fontSize: '.9rem' }}>Métricas (opcional — atualize depois de alguns dias)</strong>
              <div className="linkedin-metricas iv-mt">
                {([['impressoes', 'Impressões'], ['reacoes', 'Reações'], ['comentarios', 'Comentários'], ['compartilhamentos', 'Compartilhamentos'], ['salvamentos', 'Salvamentos']] as const).map(([k, label]) => (
                  <label key={k} className="iv-col" style={{ gap: '.25rem', fontSize: '.8rem' }}>
                    {label}
                    <InputNumber value={form.metricas[k] ?? null} min={0} useGrouping onValueChange={(e) => setForm({ ...form, metricas: { ...form.metricas, [k]: e.value ?? undefined } })} inputStyle={{ width: '100%' }} />
                  </label>
                ))}
              </div>
            </div>
            {erroForm && <Message severity="error" text={erroForm} style={{ width: '100%' }} />}
            <div className="iv-row">
              <Button label="Salvar" icon="pi pi-save" loading={salvando} onClick={salvarForm} />
              <Button label="Cancelar" text onClick={() => setForm(null)} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function PostCard({ post: p, aberto, ocupado, iaPronta, onToggle, onEditar, onOrganizar, onReenviar, onExcluir, onUsarIdeia }: {
  post: PostPublicado; aberto: boolean; ocupado?: string; iaPronta: boolean;
  onToggle: () => void; onEditar: () => void; onOrganizar: () => void; onReenviar: () => void; onExcluir: () => void; onUsarIdeia: (ideia: string) => void;
}) {
  const a = p.analise;
  const m = p.metricas;
  const taxa = taxaEngajamento(m);
  const primeira = p.texto.split('\n').find((l) => l.trim()) ?? '';
  return (
    <article className="iv-card">
      <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between', gap: '.75rem' }}>
        <div className="iv-row iv-wrap" style={{ gap: '.4rem' }}>
          <span className="iv-muted" style={{ fontSize: '.82rem' }}>{p.publicadoEm}</span>
          <Pill label={p.formato} />
          {a ? <Pill label={a.pilar} color="#0ea5e9" /> : <Pill label="Não organizado" color="#94a3b8" />}
          {p.memoriaId && <Pill label="No cérebro" icon="pi-sitemap" color="#7c3aed" />}
        </div>
        <div className="iv-row">
          {ocupado && <span className="iv-muted" style={{ fontSize: '.82rem' }}><i className="pi pi-spin pi-spinner" /> {ocupado}</span>}
          <a href={p.url} target="_blank" rel="noreferrer" className="p-button p-button-text p-button-icon-only" title="Abrir no LinkedIn" aria-label="Abrir no LinkedIn"><i className="pi pi-external-link" /></a>
          <Button icon="pi pi-sparkles" text tooltip={a ? 'Reanalisar com IA' : 'Organizar com IA'} aria-label="Organizar com IA" disabled={!iaPronta || !!ocupado} onClick={onOrganizar} />
          {a && <Button icon="pi pi-sitemap" text tooltip="Atualizar a nota no Segundo Cérebro" aria-label="Atualizar no Segundo Cérebro" disabled={!!ocupado} onClick={onReenviar} />}
          <Button icon="pi pi-pencil" text tooltip="Editar texto e métricas" aria-label="Editar" onClick={onEditar} />
          <Button icon="pi pi-trash" text severity="danger" aria-label="Remover" onClick={onExcluir} />
        </div>
      </div>

      <p style={{ fontWeight: 600, margin: '.6rem 0 .25rem' }}>{a?.resumo ?? primeira.slice(0, 220)}</p>
      <div className="iv-row iv-wrap iv-muted" style={{ fontSize: '.82rem', gap: '1rem' }}>
        <span><i className="pi pi-eye" /> {m.impressoes ?? '—'}</span>
        <span><i className="pi pi-thumbs-up" /> {m.reacoes ?? '—'}</span>
        <span><i className="pi pi-comment" /> {m.comentarios ?? '—'}</span>
        <span><i className="pi pi-share-alt" /> {m.compartilhamentos ?? '—'}</span>
        {taxa !== null && <span>engajamento {taxa}%</span>}
        {engajamento(m) > 0 && <span>{engajamento(m)} pts</span>}
        <Button link label={aberto ? 'Fechar' : a ? 'Ver organização' : 'Ver texto'} onClick={onToggle} style={{ padding: 0, fontSize: '.82rem' }} />
      </div>

      {aberto && (
        <div className="linkedin-analise iv-mt">
          {a && (
            <>
              <div className="iv-row iv-wrap" style={{ gap: '.35rem' }}>
                <span className="iv-muted" style={{ fontSize: '.8rem' }}>Gancho: {a.tipoGancho} ·</span>
                {a.temas.map((t) => <Pill key={t} label={t} />)}
              </div>
              {(a.trilhaIds.length > 0 || a.topicoIds.length > 0) && (
                <div className="iv-row iv-wrap iv-mt" style={{ gap: '.35rem' }}>
                  <span className="iv-muted" style={{ fontSize: '.8rem' }}>No seu estudo:</span>
                  {a.trilhaIds.map((id) => <Pill key={id} label={getTrilha(id)?.titulo ?? id} icon="pi-sitemap" color="#0d9488" />)}
                  {a.topicoIds.map((id) => <Pill key={id} label={getTopico(id)?.titulo ?? id} icon="pi-book" color="#0d9488" />)}
                </div>
              )}
              <div className="linkedin-analise__grid iv-mt">
                <Bloco titulo="Aprendizados reutilizáveis" itens={a.aprendizados} />
                <Bloco titulo="Pontos fortes" itens={a.pontosFortes} />
                <Bloco titulo="Para melhorar" itens={a.melhorias} />
              </div>
              <h4 style={{ margin: '1rem 0 .4rem' }}>Ideias para os próximos posts</h4>
              <ul className="linkedin-ideias">
                {a.ideiasDerivadas.map((ideia) => (
                  <li key={ideia}>
                    <span>{ideia}</span>
                    <Button label="Escrever" icon="pi pi-arrow-right" iconPos="right" text size="small" onClick={() => onUsarIdeia(ideia)} />
                  </li>
                ))}
              </ul>
              <p className="iv-muted" style={{ fontSize: '.75rem' }}>Organizado em {a.analisadoEm.slice(0, 10)} por {a.modelo}.</p>
            </>
          )}
          <details open={!a}>
            <summary className="iv-muted" style={{ cursor: 'pointer', fontSize: '.85rem' }}>Texto publicado</summary>
            <p style={{ whiteSpace: 'pre-wrap', fontSize: '.9rem' }}>{p.texto}</p>
          </details>
        </div>
      )}
    </article>
  );
}

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div>
      <h4 style={{ margin: '0 0 .3rem' }}>{titulo}</h4>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.88rem' }}>{itens.map((x) => <li key={x}>{x}</li>)}</ul>
    </div>
  );
}
