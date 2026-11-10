import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from 'primereact/sidebar';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { BiblioItem, EstadoLeitura } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import {
  listBiblio, resumoBiblio, salvarUrl, updateBiblio, removeBiblio, toggleFavoritoBiblio, reprocessar, buscarUrl,
} from '@/services/biblioteca';
import { processar, metadadosDaUrl, CATEGORIA_LABELS } from '@/services/textProcess';

const ESTADO_OPTS: { label: string; value: EstadoLeitura }[] = [
  { label: 'Para ler', value: 'para_ler' }, { label: 'Lendo', value: 'lendo' }, { label: 'Lido', value: 'lido' },
];
const ESTADO_LABEL: Record<EstadoLeitura, string> = { para_ler: 'Para ler', lendo: 'Lendo', lido: 'Lido' };
const ESTADO_COLOR: Record<EstadoLeitura, string> = { para_ler: '#f59e0b', lendo: '#0ea5e9', lido: '#16a34a' };

export function Biblioteca() {
  const qc = useQueryClient();
  const [searchRaw, setSearchRaw] = useState('');
  const search = useDebounce(searchRaw, 300);
  const [categoria, setCategoria] = useState<string | undefined>();
  const [estado, setEstado] = useState<EstadoLeitura | undefined>();
  const [favorito, setFavorito] = useState(false);
  const [sel, setSel] = useState<BiblioItem | null>(null);

  const filtros = useMemo(() => ({ search, categoria, estado, favorito: favorito || undefined }), [search, categoria, estado, favorito]);
  const { data } = useQuery({ queryKey: ['biblio', filtros], queryFn: () => listBiblio(filtros) });
  const resumo = useQuery({ queryKey: ['resumo-biblio'], queryFn: resumoBiblio }).data;

  function refresh() {
    qc.invalidateQueries({ queryKey: ['biblio'] });
    qc.invalidateQueries({ queryKey: ['resumo-biblio'] });
  }

  // categorias presentes para montar os chips dinamicamente
  const categoriasPresentes = Object.keys(resumo?.porCategoria ?? {});

  const activeFilters = [
    categoria && { key: 'c', label: `Assunto: ${CATEGORIA_LABELS[categoria] ?? categoria}`, onRemove: () => setCategoria(undefined) },
    estado && { key: 'e', label: `Estado: ${ESTADO_LABEL[estado]}`, onRemove: () => setEstado(undefined) },
    favorito && { key: 'f', label: 'Só favoritos', onRemove: () => setFavorito(false) },
    search && { key: 'q', label: `Busca: "${search}"`, onRemove: () => setSearchRaw('') },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  return (
    <div>
      <PageHeader
        title="Biblioteca de Conhecimento"
        subtitle="Cole uma URL interessante. A aplicação resume, categoriza por assunto e arquiva para você achar depois."
      />

      <AdicionarUrl onSaved={refresh} />

      <StatusStrip tone="ok" icon="pi-bookmark">
        {resumo?.total ?? 0} itens salvos · {resumo?.paraLer ?? 0} para ler, {resumo?.lidos ?? 0} lidos.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Total" value={resumo?.total ?? 0} />
        <Kpi label="Para ler" value={resumo?.paraLer ?? 0} active={estado === 'para_ler'} onClick={() => setEstado(estado === 'para_ler' ? undefined : 'para_ler')} />
        <Kpi label="Lidos" value={resumo?.lidos ?? 0} active={estado === 'lido'} onClick={() => setEstado(estado === 'lido' ? undefined : 'lido')} />
        <Kpi label="Favoritos" value={resumo?.favoritos ?? 0} active={favorito} onClick={() => setFavorito((v) => !v)} />
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText value={searchRaw} onChange={(e) => setSearchRaw(e.target.value)} placeholder="Buscar por título, resumo, tag..." />
          </span>
          <span className="iv-muted" style={{ fontSize: '.8rem' }}>Assunto:</span>
          {categoriasPresentes.map((c) => (
            <Chip key={c} label={`${CATEGORIA_LABELS[c] ?? c} (${resumo?.porCategoria[c]})`} active={categoria === c} onClick={() => setCategoria(categoria === c ? undefined : c)} />
          ))}
        </div>

        <ActiveFiltersBar filters={activeFilters} />

        {(data?.length ?? 0) === 0 && <p className="iv-muted">Nada salvo ainda. Cole uma URL acima para começar sua biblioteca.</p>}

        <div className="grid-cards">
          {(data ?? []).map((item) => (
            <article key={item.id} className="iv-card library-card">
              <div className="iv-row" style={{ justifyContent: 'space-between' }}>
                <Pill label={CATEGORIA_LABELS[item.categoria] ?? item.categoria} />
                <Button type="button" text rounded aria-label={item.favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  icon={`pi ${item.favorito ? 'pi-star-fill' : 'pi-star'}`} onClick={() => { toggleFavoritoBiblio(item.id); refresh(); }} />
              </div>
              <button type="button" className="card-open" onClick={() => setSel(item)}>
                <span className="card-title">{item.titulo || item.url}</span>
                <span className="card-domain iv-muted">{item.dominio}</span>
                <span className="card-summary iv-muted">{item.resumo || 'Sem resumo (nenhum texto colado).'}</span>
                <span className="iv-row iv-wrap iv-mt"><Pill label={ESTADO_LABEL[item.estado]} color={ESTADO_COLOR[item.estado]} /></span>
              </button>
            </article>
          ))}
        </div>
      </div>

      <Sidebar visible={!!sel} position="right" onHide={() => setSel(null)} style={{ width: 540 }}>
        {sel && <BiblioDetalhe item={sel} onChanged={() => { refresh(); const upd = listBiblio().find((i) => i.id === sel.id); setSel(upd ?? null); }} onClose={() => setSel(null)} />}
      </Sidebar>
    </div>
  );
}

function AdicionarUrl({ onSaved }: { onSaved: () => void }) {
  const [url, setUrl] = useState('');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof processar> | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aberto, setAberto] = useState(false);
  const [buscando, setBuscando] = useState(false);

  function validarUrl(u: string): boolean {
    try { new URL(u); return true; } catch { return false; }
  }

  async function buscarAutomatico() {
    setErro(''); setAviso('');
    if (!validarUrl(url)) return setErro('Informe uma URL válida (com http:// ou https://).');
    setBuscando(true);
    try {
      const r = await buscarUrl(url);
      const corpo = [r.descricao, r.texto].filter(Boolean).join('\n\n');
      setTexto(corpo);
      if (r.titulo) setTitulo(r.titulo);
      setPreview(processar(corpo));
      setAberto(true);
    } catch {
      setAviso('Não consegui buscar a página automaticamente (API offline ou site bloqueou). Cole o texto manualmente abaixo.');
      setAberto(true);
    } finally {
      setBuscando(false);
    }
  }

  function processarPreview() {
    setErro('');
    if (!validarUrl(url)) return setErro('Informe uma URL válida (com http:// ou https://).');
    if (!texto.trim()) {
      // sem texto: só metadados da URL
      setPreview(null);
      return;
    }
    setPreview(processar(texto));
  }

  function salvar() {
    setErro('');
    if (!validarUrl(url)) return setErro('Informe uma URL válida (com http:// ou https://).');
    salvarUrl({ url, titulo: titulo || undefined, texto });
    setUrl(''); setTitulo(''); setTexto(''); setPreview(null); setAberto(false); setAviso('');
    onSaved();
  }

  const meta = url && validarUrl(url) ? metadadosDaUrl(url) : null;

  return (
    <div className="iv-card">
      <div className="iv-row" style={{ gap: '.6rem' }}>
        <span className="p-input-icon-left" style={{ flex: 1 }}>
          <i className="pi pi-link" />
          <InputText value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Cole a URL aqui (ex: https://...)" style={{ width: '100%' }} onFocus={() => setAberto(true)} />
        </span>
        <Button label="Buscar" icon={buscando ? 'pi pi-spinner pi-spin' : 'pi pi-download'} onClick={buscarAutomatico} disabled={!url || buscando} tooltip="Busca a página automaticamente (precisa da API rodando)" />
        <Button label="Salvar" icon="pi pi-plus" onClick={salvar} disabled={!url} />
      </div>

      {aviso && <Message severity="warn" text={aviso} style={{ width: '100%', marginTop: '.75rem' }} />}

      {aberto && (
        <div className="iv-mt">
          {meta && <p className="iv-muted" style={{ fontSize: '.8rem', margin: '0 0 .5rem' }}>Domínio detectado: <strong>{meta.dominio}</strong> · Título provável: {meta.tituloProvavel}</p>}
          <label className="iv-muted" style={{ fontSize: '.8rem' }}>Título (opcional — preenchido pela busca automática)</label>
          <InputText value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do artigo/post" style={{ width: '100%', margin: '.4rem 0 .75rem' }} />
          <label className="iv-muted" style={{ fontSize: '.8rem' }}>
            Opcional, mas recomendado: cole o texto da página (ou o trecho interessante). A aplicação resume e categoriza automaticamente.
          </label>
          <InputTextarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} style={{ width: '100%', marginTop: '.4rem' }} placeholder="Cole aqui o conteúdo do artigo/post..." />
          <div className="iv-row iv-mt">
            <Button label="Processar prévia" icon="pi pi-sparkles" outlined size="small" onClick={processarPreview} disabled={!texto.trim()} />
            <Button label="Fechar" text size="small" onClick={() => setAberto(false)} />
          </div>

          {erro && <Message severity="error" text={erro} style={{ width: '100%', marginTop: '.75rem' }} />}

          {preview && (
            <div className="iv-card iv-mt" style={{ background: 'var(--surface-hover)' }}>
              <div className="iv-row iv-wrap"><Pill label={preview.categoriaLabel} /></div>
              <h5 style={{ margin: '.5rem 0 .25rem' }}>Resumo automático</h5>
              <p style={{ margin: 0, fontSize: '.88rem' }}>{preview.resumo}</p>
              <h5 style={{ margin: '.75rem 0 .25rem' }}>Tags sugeridas</h5>
              <div className="iv-row iv-wrap">{preview.tagsSugeridas.map((t) => <Pill key={t} label={`#${t}`} color="#64748b" />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BiblioDetalhe({ item, onChanged, onClose }: { item: BiblioItem; onChanged: () => void; onClose: () => void }) {
  const [nota, setNota] = useState(item.anotacoes);
  return (
    <div className="iv-col" style={{ gap: '1rem' }}>
      <div>
        <div className="iv-row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: 'var(--alvoar-navy)', fontSize: '1.2rem' }}>{item.titulo || item.url}</h2>
          <i className={`pi ${item.favorito ? 'pi-star-fill' : 'pi-star'}`} style={{ cursor: 'pointer', color: item.favorito ? '#f59e0b' : 'var(--text-color-secondary)' }} onClick={() => { toggleFavoritoBiblio(item.id); onChanged(); }} />
        </div>
        <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: '.84rem', wordBreak: 'break-all' }}>{item.url}</a>
      </div>

      <div className="iv-row iv-wrap">
        <Pill label={CATEGORIA_LABELS[item.categoria] ?? item.categoria} />
        <Pill label={ESTADO_LABEL[item.estado]} color={ESTADO_COLOR[item.estado]} />
        {item.dominio && <Pill label={item.dominio} color="#64748b" />}
      </div>

      <div>
        <label className="iv-muted" style={{ fontSize: '.8rem' }}>Estado de leitura</label>
        <Dropdown value={item.estado} options={ESTADO_OPTS} onChange={(e) => { updateBiblio(item.id, { estado: e.value }); onChanged(); }} style={{ width: '100%' }} />
      </div>

      {item.resumo && (
        <div>
          <h4 style={{ marginBottom: '.4rem' }}>Resumo</h4>
          <p style={{ margin: 0 }}>{item.resumo}</p>
        </div>
      )}

      {item.palavrasChave.length > 0 && (
        <div>
          <h4 style={{ marginBottom: '.4rem' }}>Palavras-chave</h4>
          <div className="iv-row iv-wrap">{item.palavrasChave.map((k) => <Pill key={k} label={k} />)}</div>
        </div>
      )}

      {item.tags.length > 0 && (
        <div className="iv-row iv-wrap">{item.tags.map((t) => <Pill key={t} label={`#${t}`} color="#64748b" />)}</div>
      )}

      <div>
        <h4 style={{ marginBottom: '.4rem' }}>Minhas anotações</h4>
        <InputTextarea value={nota} onChange={(e) => setNota(e.target.value)} rows={4} style={{ width: '100%' }} placeholder="Por que isso é interessante? O que aproveitar?" />
        <Button label="Salvar anotação" icon="pi pi-save" size="small" className="iv-mt" onClick={() => { updateBiblio(item.id, { anotacoes: nota }); onChanged(); }} />
      </div>

      <div className="iv-row" style={{ marginTop: '1rem' }}>
        {item.textoOriginal && <Button label="Reprocessar" icon="pi pi-refresh" outlined size="small" onClick={() => { reprocessar(item.id); onChanged(); }} tooltip="Refaz resumo/categoria a partir do texto salvo" />}
        <Button label="Excluir" icon="pi pi-trash" severity="danger" outlined size="small" onClick={() => { removeBiblio(item.id); onChanged(); onClose(); }} />
      </div>
    </div>
  );
}
