import { useMemo, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Sidebar } from 'primereact/sidebar';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Kpi, StatusStrip, Chip, Pill } from '@/components/InfraKit';
import {
  listMemorias, getMemoria, createMemoria, updateMemoria, deleteMemoria, restoreMemoria,
  buscarMemorias, capturarUrl, importarNotas,
  type Escopo, type MemoriaResumo, type TrechoEncontrado,
} from '@/services/cerebro';

const ROWS = 15;
const ESCOPO_OPTS = [
  { label: 'Pessoal', value: 'pessoal' },
  { label: 'Corporativo (fora do backup)', value: 'corporativo' },
];
const MAX_ARQUIVO = 200_000;

interface Rascunho {
  id?: string;
  titulo: string;
  conteudo: string;
  tagsTexto: string;
  escopo: Escopo;
  excluirEm: string | null;
  urlOrigem: string | null;
}

const fmtData = (iso: string) => iso.replace('T', ' ').slice(0, 16);
const parseTags = (t: string) => t.split(',').map((s) => s.trim()).filter(Boolean);
const erroDe = (e: unknown, padrao: string) =>
  (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? padrao;

export function Cerebro() {
  const qc = useQueryClient();
  const [consulta, setConsulta] = useState('');
  const [achados, setAchados] = useState<TrechoEncontrado[] | null>(null);
  const [buscando, setBuscando] = useState(false);

  const [escopo, setEscopo] = useState<Escopo | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [lixeira, setLixeira] = useState(false);
  const [page, setPage] = useState(0);

  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [url, setUrl] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ sev: 'success' | 'error' | 'info'; texto: string } | null>(null);

  const filtros = useMemo(() => ({ escopo, tag, lixeira, page, limit: ROWS }), [escopo, tag, lixeira, page]);
  const lista = useQuery({ queryKey: ['memorias', filtros], queryFn: () => listMemorias(filtros) });

  // qualquer mudança de filtro volta para a página 1
  const mudar = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };
  const refresh = () => qc.invalidateQueries({ queryKey: ['memorias'] });

  async function buscar() {
    if (!consulta.trim()) return;
    setBuscando(true); setMsg(null);
    try {
      setAchados(await buscarMemorias(consulta.trim()));
    } catch (e) {
      setMsg({ sev: 'error', texto: erroDe(e, 'Falha na busca.') });
    } finally {
      setBuscando(false);
    }
  }

  async function abrir(id: string) {
    try {
      const m = await getMemoria(id);
      setRascunho({
        id: m.id, titulo: m.titulo, conteudo: m.conteudo, tagsTexto: m.tags.join(', '),
        escopo: m.escopo, excluirEm: m.excluirEm, urlOrigem: m.urlOrigem,
      });
    } catch (e) {
      setMsg({ sev: 'error', texto: erroDe(e, 'Não foi possível abrir a memória.') });
    }
  }

  async function salvar() {
    if (!rascunho || !rascunho.titulo.trim()) return;
    const corpo = {
      titulo: rascunho.titulo.trim(), conteudo: rascunho.conteudo,
      tags: parseTags(rascunho.tagsTexto), escopo: rascunho.escopo,
    };
    try {
      if (rascunho.id) await updateMemoria(rascunho.id, corpo);
      else await createMemoria(corpo);
      setRascunho(null); setMsg({ sev: 'success', texto: 'Memória salva.' });
      refresh();
    } catch (e) {
      setMsg({ sev: 'error', texto: erroDe(e, 'Falha ao salvar.') });
    }
  }

  async function excluir() {
    if (!rascunho?.id) return;
    try {
      await deleteMemoria(rascunho.id);
      setRascunho(null);
      setMsg({ sev: 'info', texto: 'Movida para a lixeira. Some de vez em 7 dias; dá para resgatar até lá.' });
      refresh();
    } catch (e) {
      setMsg({ sev: 'error', texto: erroDe(e, 'Falha ao excluir.') });
    }
  }

  async function resgatar() {
    if (!rascunho?.id) return;
    try {
      await restoreMemoria(rascunho.id);
      setRascunho(null); setMsg({ sev: 'success', texto: 'Memória resgatada da lixeira.' });
      refresh();
    } catch (e) {
      setMsg({ sev: 'error', texto: erroDe(e, 'Falha ao resgatar.') });
    }
  }

  async function capturar() {
    if (!url.trim()) return;
    setOcupado(true); setMsg(null);
    try {
      const m = await capturarUrl(url.trim());
      setUrl(''); setMsg({ sev: 'success', texto: `Página guardada: ${m.titulo}` });
      refresh();
    } catch (e) {
      setMsg({ sev: 'error', texto: erroDe(e, 'Não consegui capturar essa URL.') });
    } finally {
      setOcupado(false);
    }
  }

  async function importar(ev: ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(ev.target.files ?? []);
    ev.target.value = ''; // permite escolher os mesmos arquivos de novo
    if (arquivos.length === 0) return;
    setOcupado(true); setMsg(null);
    try {
      const notas: { titulo: string; conteudo: string }[] = [];
      let ignorados = 0;
      for (const f of arquivos) {
        if (f.size > MAX_ARQUIVO) { ignorados++; continue; }
        notas.push({ titulo: f.name.replace(/\.(md|markdown|txt)$/i, '').slice(0, 200) || 'sem título', conteudo: await f.text() });
      }
      let importadas = 0;
      for (let i = 0; i < notas.length; i += 50) importadas += (await importarNotas(notas.slice(i, i + 50))).importadas;
      setMsg({
        sev: importadas > 0 ? 'success' : 'info',
        texto: `${importadas} nota(s) importada(s)${ignorados ? `; ${ignorados} ignorada(s) por passar de 200 KB` : ''}.`,
      });
      refresh();
    } catch (e) {
      setMsg({ sev: 'error', texto: erroDe(e, 'Falha ao importar.') });
    } finally {
      setOcupado(false);
    }
  }

  const activeFilters = [
    escopo && { key: 'e', label: `Escopo: ${escopo}`, onRemove: () => mudar(setEscopo)(undefined) },
    tag && { key: 't', label: `Tag: ${tag}`, onRemove: () => mudar(setTag)(undefined) },
  ].filter(Boolean) as { key: string; label: string; onRemove: () => void }[];

  const total = lista.data?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Segundo Cérebro"
        subtitle="Notas, páginas e documentos que você quer lembrar. A busca devolve os trechos certos, com a fonte."
        actions={
          <div className="iv-row iv-wrap">
            <Button label="Nova memória" icon="pi pi-plus" size="small"
              onClick={() => setRascunho({ titulo: '', conteudo: '', tagsTexto: '', escopo: 'pessoal', excluirEm: null, urlOrigem: null })} />
            <label className="p-button p-component p-button-outlined p-button-sm" style={{ cursor: 'pointer' }}>
              <span className="p-button-icon p-button-icon-left pi pi-upload" />
              <span className="p-button-label">Importar notas (.md / .txt)</span>
              <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" multiple hidden onChange={importar} />
            </label>
          </div>
        }
      />

      {lista.isError && (
        <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }}
          text="API ou banco indisponível. O Segundo Cérebro precisa do servidor (apps/api + PostgreSQL)." />
      )}
      {msg && <Message severity={msg.sev} style={{ width: '100%', marginBottom: '1rem' }} text={msg.texto} />}

      <StatusStrip tone="ok" icon="pi-database">
        {lixeira ? `${total} memória(s) na lixeira.` : `${total} memória(s) guardada(s).`}
        {' '}Material marcado como corporativo não entra no backup para o OneDrive.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label={lixeira ? 'Na lixeira' : 'Memórias'} value={total} />
        <Kpi label="Só pessoais" value="filtrar" active={escopo === 'pessoal'}
          onClick={() => mudar(setEscopo)(escopo === 'pessoal' ? undefined : 'pessoal')} />
        <Kpi label="Só corporativas" value="filtrar" active={escopo === 'corporativo'}
          onClick={() => mudar(setEscopo)(escopo === 'corporativo' ? undefined : 'corporativo')} />
        <Kpi label="Lixeira" value={lixeira ? 'aberta' : 'ver'} active={lixeira}
          onClick={() => mudar(setLixeira)(!lixeira)} />
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Buscar no cérebro</h4>
        <div className="iv-row" style={{ gap: '.6rem' }}>
          <span className="p-input-icon-left" style={{ flex: 1 }}>
            <i className="pi pi-search" />
            <InputText value={consulta} onChange={(e) => setConsulta(e.target.value)} style={{ width: '100%' }}
              placeholder="Ex.: como funciona o kerberoasting?" onKeyDown={(e) => e.key === 'Enter' && buscar()} />
          </span>
          <Button label="Buscar" icon={buscando ? 'pi pi-spinner pi-spin' : 'pi pi-search'} onClick={buscar} disabled={buscando} />
        </div>
        {achados && (
          <div className="iv-col iv-mt">
            {achados.length === 0 && <p className="iv-muted" style={{ margin: 0 }}>Nada encontrado para essa busca.</p>}
            {achados.map((a, i) => (
              <div key={`${a.memoriaId}-${i}`} className="iv-card" style={{ padding: '.7rem .9rem', cursor: 'pointer' }} onClick={() => abrir(a.memoriaId)}>
                <div className="iv-row" style={{ justifyContent: 'space-between' }}>
                  <strong>{a.titulo}</strong>
                  <div className="iv-row">
                    {a.escopo === 'corporativo' && <Pill label="corporativo" color="#f59e0b" />}
                    <span className="iv-muted" style={{ fontSize: '.75rem' }}>relevância {a.score}</span>
                  </div>
                </div>
                <p style={{ margin: '.4rem 0 0', whiteSpace: 'pre-wrap', fontSize: '.88rem' }}>{a.trecho}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Guardar uma página da web</h4>
        <div className="iv-row" style={{ gap: '.6rem' }}>
          <span className="p-input-icon-left" style={{ flex: 1 }}>
            <i className="pi pi-link" />
            <InputText value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: '100%' }}
              placeholder="https://..." onKeyDown={(e) => e.key === 'Enter' && capturar()} />
          </span>
          <Button label="Capturar" icon={ocupado ? 'pi pi-spinner pi-spin' : 'pi pi-download'} onClick={capturar} disabled={ocupado || !url.trim()} />
        </div>
        <p className="iv-muted" style={{ fontSize: '.78rem', marginBottom: 0 }}>
          O servidor busca a página (bloqueando endereços internos) e guarda o texto como dado. Conteúdo da web nunca é tratado como instrução.
        </p>
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <span className="p-input-icon-left">
            <i className="pi pi-tag" />
            <InputText placeholder="Filtrar por tag (Enter)" onKeyDown={(e) => {
              if (e.key === 'Enter') mudar(setTag)(e.currentTarget.value.trim().toLowerCase() || undefined);
            }} />
          </span>
          <Chip label="Pessoal" active={escopo === 'pessoal'} onClick={() => mudar(setEscopo)(escopo === 'pessoal' ? undefined : 'pessoal')} />
          <Chip label="Corporativo" active={escopo === 'corporativo'} onClick={() => mudar(setEscopo)(escopo === 'corporativo' ? undefined : 'corporativo')} />
        </div>
        <ActiveFiltersBar filters={activeFilters} />
        <DataTable
          value={lista.data?.items ?? []} lazy paginator first={page * ROWS} rows={ROWS} totalRecords={total}
          onPage={(e) => setPage(e.page ?? 0)} dataKey="id"
          emptyMessage={lixeira ? 'A lixeira está vazia.' : 'Nenhuma memória ainda. Crie uma, capture uma página ou importe notas.'}
          selectionMode="single" onSelectionChange={(e) => e.value && abrir((e.value as MemoriaResumo).id)}
        >
          <Column header="Memória" body={(m: MemoriaResumo) => (
            <div>
              <div style={{ fontWeight: 600 }}>{m.titulo}</div>
              <div className="iv-muted" style={{ fontSize: '.82rem' }}>{m.preview}</div>
              {m.tags.length > 0 && <div className="iv-row iv-wrap" style={{ marginTop: 4 }}>{m.tags.map((t) => <Pill key={t} label={`#${t}`} color="#64748b" />)}</div>}
            </div>
          )} />
          <Column header="Origem" style={{ width: 100 }} field="origem" />
          <Column header="Escopo" style={{ width: 130 }} body={(m: MemoriaResumo) => (
            <Pill label={m.escopo} color={m.escopo === 'corporativo' ? '#f59e0b' : '#16a34a'} />
          )} />
          <Column header={lixeira ? 'Some em' : 'Atualizada'} style={{ width: 150 }}
            body={(m: MemoriaResumo) => fmtData(lixeira && m.excluirEm ? m.excluirEm : m.atualizadoEm)} />
        </DataTable>
      </div>

      <Sidebar visible={!!rascunho} position="right" onHide={() => setRascunho(null)} style={{ width: 620 }}>
        {rascunho && (
          <div className="iv-col" style={{ gap: '.8rem' }}>
            <h2 style={{ margin: 0, color: 'var(--alvoar-navy)' }}>{rascunho.id ? 'Memória' : 'Nova memória'}</h2>
            {rascunho.excluirEm && (
              <Message severity="warn" style={{ width: '100%' }}
                text={`Na lixeira: será apagada de vez em ${fmtData(rascunho.excluirEm)}. Resgate para editar.`} />
            )}
            {rascunho.urlOrigem && (
              <a href={rascunho.urlOrigem} target="_blank" rel="noreferrer" style={{ fontSize: '.84rem', wordBreak: 'break-all' }}>{rascunho.urlOrigem}</a>
            )}
            <label className="iv-muted" style={{ fontSize: '.8rem' }}>Título</label>
            <InputText value={rascunho.titulo} disabled={!!rascunho.excluirEm} onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })} />
            <label className="iv-muted" style={{ fontSize: '.8rem' }}>Tags (separadas por vírgula)</label>
            <InputText value={rascunho.tagsTexto} disabled={!!rascunho.excluirEm} onChange={(e) => setRascunho({ ...rascunho, tagsTexto: e.target.value })} />
            <label className="iv-muted" style={{ fontSize: '.8rem' }}>Escopo</label>
            <Dropdown value={rascunho.escopo} options={ESCOPO_OPTS} disabled={!!rascunho.excluirEm}
              onChange={(e) => setRascunho({ ...rascunho, escopo: e.value })} style={{ width: '100%' }} />
            <label className="iv-muted" style={{ fontSize: '.8rem' }}>Conteúdo</label>
            <InputTextarea value={rascunho.conteudo} rows={16} disabled={!!rascunho.excluirEm}
              onChange={(e) => setRascunho({ ...rascunho, conteudo: e.target.value })} style={{ width: '100%' }} />
            <div className="iv-row iv-wrap iv-mt">
              {rascunho.excluirEm
                ? <Button label="Resgatar" icon="pi pi-undo" onClick={resgatar} />
                : <Button label="Salvar" icon="pi pi-save" onClick={salvar} disabled={!rascunho.titulo.trim()} />}
              {rascunho.id && !rascunho.excluirEm && (
                <Button label="Mover para a lixeira" icon="pi pi-trash" severity="danger" outlined onClick={excluir} />
              )}
              <Button label="Fechar" text onClick={() => setRascunho(null)} />
            </div>
          </div>
        )}
      </Sidebar>
    </div>
  );
}
