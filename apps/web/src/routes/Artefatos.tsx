import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { StatusStrip, Pill } from '@/components/InfraKit';
import { useDebounce } from '@/hooks/useDebounce';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { importarHistorico, listarArtefatos, type Artefato } from '@/services/artefatos';
import { ArtefatoFicha } from './artefatos/ArtefatoFicha';

const TIPOS = [{ label: 'Arquivos', value: 'arquivo' }, { label: 'Comandos', value: 'comando' }, { label: 'Persistência', value: 'persistencia' }, { label: 'Processos', value: 'processo' }];
const CATEGORIAS = ['persistencia', 'transferencia', 'limpeza', 'mineracao', 'reconhecimento', 'execucao', 'carregamento', 'binario', 'outro'].map((value) => ({ label: value, value }));
export function Artefatos() {
  const client = useQueryClient(); const [busca, setBusca] = useState(''); const [alvo, setAlvo] = useState('');
  const [tipo, setTipo] = useState<string | undefined>(); const [categoria, setCategoria] = useState<string | undefined>();
  const [favorito, setFavorito] = useState(false); const [pagina, setPagina] = useState(0);
  const [importando, setImportando] = useState(false); const [progresso, setProgresso] = useState(''); const [erro, setErro] = useState('');
  const filtros = { q: useDebounce(busca, 300), alvo: useDebounce(alvo, 300), tipo, categoria, favorito: favorito ? 'true' as const : undefined, page: pagina, limit: 25 };
  const q = useQuery({ queryKey: ['artefatos', 'lista', filtros], queryFn: () => listarArtefatos(filtros) });
  const sel = useDrawerSelection(q.data?.items ?? []);
  const mudar = (fn: () => void) => { fn(); setPagina(0); };
  const importar = async () => {
    setImportando(true); setErro('');
    try { const n = await importarHistorico((n) => setProgresso(`${n} registros de origem processados…`)); setProgresso(`Importação concluída: ${n} registros processados. Reenvios são deduplicados.`); await client.invalidateQueries({ queryKey: ['artefatos'] }); }
    catch { setErro('Importação interrompida. Você pode repetir; o material já importado será preservado.'); }
    finally { setImportando(false); }
  };
  return <div>
    <PageHeader title="Biblioteca de artefatos" subtitle="Arquivos, comandos e trechos dos ataques preservados para análise e estudo."
      actions={<Button label="Importar histórico existente" icon="pi pi-database" loading={importando} onClick={() => void importar()} />} />
    <StatusStrip icon="pi-info-circle">Novos comandos e laudos alimentam esta biblioteca. Use “Importar histórico existente” para reunir os registros anteriores. Amostras chegam pelo coletor ou pelo botão de anexar na ficha do arquivo.</StatusStrip>
    {progresso && <p role="status">{progresso}</p>}{erro && <Message severity="error" text={erro} />}
    <div className="iv-card iv-mt"><div className="iv-toolbar">
      <SearchInput value={busca} onChange={(v) => mudar(() => setBusca(v))} placeholder="Buscar arquivo, comando, hash, conteúdo ou notas…" />
      <Dropdown value={tipo} options={TIPOS} showClear placeholder="Todos os tipos" aria-label="Tipo de artefato" onChange={(e) => mudar(() => setTipo(e.value ?? undefined))} />
      <Dropdown value={categoria} options={CATEGORIAS} showClear placeholder="Todas as categorias" aria-label="Categoria" onChange={(e) => mudar(() => setCategoria(e.value ?? undefined))} />
      <SearchInput value={alvo} onChange={(v) => mudar(() => setAlvo(v))} placeholder="Filtrar alvo…" />
      <Button label="Favoritos" icon="pi pi-star" outlined={!favorito} aria-pressed={favorito} onClick={() => mudar(() => setFavorito(!favorito))} />
      <span className="iv-toolbar__count">{q.data?.total ?? 0} artefatos</span>
    </div>
    <ActiveFiltersBar filters={[
      busca && { key: 'q', label: busca, onRemove: () => mudar(() => setBusca('')) },
      alvo && { key: 'alvo', label: `Alvo: ${alvo}`, onRemove: () => mudar(() => setAlvo('')) },
      tipo && { key: 'tipo', label: tipo, onRemove: () => mudar(() => setTipo(undefined)) },
      categoria && { key: 'categoria', label: categoria, onRemove: () => mudar(() => setCategoria(undefined)) },
      favorito && { key: 'favorito', label: 'Favoritos', onRemove: () => mudar(() => setFavorito(false)) },
    ]} />
    {q.isError && <Message severity="error" text="Não foi possível carregar a biblioteca." />}
    <DataTable value={q.data?.items ?? []} loading={q.isLoading} lazy paginator={(q.data?.total ?? 0) > 25} first={pagina * 25} rows={25}
      totalRecords={q.data?.total ?? 0} onPage={(e) => setPagina(e.page ?? 0)} dataKey="id" selectionMode="single"
      onRowClick={(e) => sel.open((e.data as Artefato).id)} emptyMessage="Nenhum artefato encontrado. Importe o histórico ou aguarde novos eventos.">
      <Column header="Tipo" body={(a: Artefato) => <Pill label={a.tipo} />} style={{ width: '8rem' }} />
      <Column header="Arquivo / comando" body={(a: Artefato) => <div style={{ maxWidth: '38rem', overflowWrap: 'anywhere' }}><strong>{a.nome}</strong><div className="iv-muted">{a.formato} · {a.sha256 ? `SHA-256 ${a.sha256.slice(0, 16)}…` : a.categoria}</div></div>} />
      <Column header="Resumo estático" body={(a: Artefato) => <span>{a.resumo.slice(0, 180)}</span>} />
      <Column header="Ocorrências" body={(a: Artefato) => a._count.ocorrencias} style={{ width: '8rem' }} />
    </DataTable></div>
    {sel.item && <DetailDrawer {...sel.nav} wide kind={{ icon: 'pi-folder-open', label: 'Artefato de ataque' }} title={sel.item.nome} ariaLabel="Detalhe do artefato" status={<Pill label={sel.item.tipo} />}>
      <ArtefatoFicha key={sel.item.id} id={sel.item.id} />
    </DetailDrawer>}
  </div>;
}
