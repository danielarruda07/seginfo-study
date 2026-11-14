import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClickCard } from '@/components/ui/ClickCard';
import { Kpi, StatusStrip, Pill } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { listAgentes, listTagsBase, buscarNaBaseDoAgente, erroApi, type TrechoBase } from '@/services/agentes';
import { TagFicha, TrechoFicha, type LinhaTag } from './ficha/BaseFichas';
import '@/styles/telas/agents.css';

export function AgentsBase() {
  const agentes = useQuery({ queryKey: ['agentes'], queryFn: listAgentes });
  const tags = useQuery({ queryKey: ['agentes-base-tags'], queryFn: listTagsBase });

  const [agenteId, setAgenteId] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState('');
  const [testada, setTestada] = useState('');
  const [achados, setAchados] = useState<(TrechoBase & { id: string })[] | null>(null);
  const [tagsDoAgente, setTagsDoAgente] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');

  const lista = useMemo(() => agentes.data ?? [], [agentes.data]);
  const linhas = useMemo<LinhaTag[]>(() => (tags.data ?? []).map((t) => ({
    ...t, id: t.tag, agentes: lista.filter((a) => a.baseTags.includes(t.tag)),
  })), [tags.data, lista]);
  const comBase = lista.filter((a) => a.baseTags.length > 0).length;
  const semUso = linhas.filter((l) => l.agentes.length === 0).length;

  const selTrecho = useDrawerSelection(achados ?? []);
  const selTag = useDrawerSelection(linhas);
  const abrirTrecho = (id: string) => { selTag.close(); selTrecho.open(id); };
  const abrirTag = (id: string) => { selTrecho.close(); selTag.open(id); };

  async function testar() {
    const id = agenteId;
    if (!id || !pergunta.trim()) return;
    setBuscando(true); setErro('');
    try {
      const r = await buscarNaBaseDoAgente(id, pergunta.trim());
      setAchados(r.resultados.map((x, i) => ({ ...x, id: `${x.memoriaId}#${i}` })));
      setTagsDoAgente(r.tags);
      setTestada(pergunta.trim());
    } catch (e) {
      setErro(erroApi(e, 'Falha ao testar a base.'));
    } finally {
      setBuscando(false);
    }
  }

  /** vindo da ficha da tag: escolhe o agente e leva o foco ao campo de pergunta */
  function testarAgente(id: string) {
    setAgenteId(id); selTag.close(); setAchados(null);
    requestAnimationFrame(() => document.getElementById('base-pergunta')?.focus());
  }

  const nomeAgente = lista.find((a) => a.id === agenteId)?.nome;

  return (
    <div>
      <PageHeader
        title="Base de conhecimento"
        subtitle="O que cada agente pode consultar. A base é feita das suas notas do Segundo Cérebro, escolhidas por tag."
        actions={<Link to="/cerebro" className="ag-btn"><i className="pi pi-external-link" aria-hidden="true" /> Segundo Cérebro</Link>}
      />

      {(agentes.isError || tags.isError) && (
        <Message severity="warn" className="ag-largo" text="API ou banco indisponível. A base de conhecimento usa o servidor (Segundo Cérebro e agentes)." />
      )}

      <StatusStrip tone="ok" icon="pi-database">
        Cada agente enxerga só as tags que você liga a ele. Notas corporativas nunca entram, e o conteúdo recuperado é tratado como dado, não como instrução.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Tags disponíveis" icon="pi-hashtag" value={tags.data?.length ?? '—'} hint={semUso ? `${semUso} sem nenhum agente` : undefined} />
        <Kpi label="Agentes com base" icon="pi-sparkles" value={comBase} hint={`de ${lista.length}`} />
        <Kpi label="Notas pessoais com tag" icon="pi-file" value={(tags.data ?? []).reduce((s, t) => s + t.total, 0)} hint="uma nota pode ter várias tags" />
      </div>

      <div className="iv-card iv-mt ag-bloco">
        <h3>Testar a recuperação</h3>
        <p className="ag-dica">Escolha um agente e faça uma pergunta. O resultado mostra exatamente os trechos que ele receberia como contexto; clique num trecho para lê-lo inteiro.</p>
        <form className="ag-form__linha" onSubmit={(e) => { e.preventDefault(); testar(); }}>
          <Dropdown value={agenteId} options={lista.map((a) => ({ label: a.nome, value: a.id }))} onChange={(e) => setAgenteId(e.value)}
            placeholder="Escolha o agente" className="ag-dropdown" aria-label="Agente" />
          <span className="p-input-icon-left ag-cresce">
            <i className="pi pi-search" aria-hidden="true" />
            <InputText id="base-pergunta" value={pergunta} onChange={(e) => setPergunta(e.target.value)} className="ag-largo" aria-label="Pergunta de teste" placeholder="Pergunta de teste" />
          </span>
          <Button type="submit" label="Buscar" icon="pi pi-search" loading={buscando} disabled={!agenteId || !pergunta.trim()} />
        </form>
        {erro && <Message severity="error" text={erro} className="ag-largo iv-mt" />}
        {achados && tagsDoAgente.length === 0 && (
          <Message severity="info" className="ag-largo iv-mt" text="Este agente não tem tags na base. Ligue tags na aba Memória do editor." />
        )}
        {achados && tagsDoAgente.length > 0 && (
          <div className="iv-mt">
            <div className="iv-row iv-wrap">
              <span className="ag-rotulo">Base do agente:</span>
              {tagsDoAgente.map((t) => <Pill key={t} label={`#${t}`} tone="muted" />)}
            </div>
            {achados.length === 0 ? <p className="ag-dica">Nada encontrado. Um agente bem projetado responderia "não encontrei" aqui.</p> : (
              <div className="ag-trechos">
                {achados.map((a) => (
                  <ClickCard key={a.id} onOpen={() => abrirTrecho(a.id)} label={`Ler o trecho de ${a.titulo}`} selected={selTrecho.isOpen(a.id)}>
                    <div className="ag-trecho__topo">
                      <strong>{a.titulo}</strong>
                      <span className="ag-dica tabular">relevância {a.score}</span>
                    </div>
                    <p className="ag-trecho__texto">{a.trecho}</p>
                  </ClickCard>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="iv-card iv-mt">
        <div className="iv-toolbar">
          <h3 className="ag-titulo-card">Tags e quem as usa</h3>
          <span className="iv-toolbar__count">{linhas.length} tag(s)</span>
        </div>
        <DataTable className="ag-tabela" value={linhas} dataKey="id" paginator={linhas.length > 25} rows={25} rowHover loading={tags.isLoading}
          onRowClick={(e) => abrirTag((e.data as LinhaTag).id)}
          rowClassName={(l: LinhaTag) => `${l.agentes.length === 0 ? 'iv-row-muted' : ''}${selTag.isOpen(l.id) ? ' ag-row-sel' : ''}`}
          emptyMessage="Nenhuma tag ainda. Crie notas com tags no Segundo Cérebro.">
          <Column header="Tag" body={(l: LinhaTag) => <span className="iv-maincell__title">#{l.tag}</span>} />
          <Column header="Notas" className="tabular" body={(l: LinhaTag) => l.total} style={{ width: '6rem' }} />
          <Column header="Agentes que usam" body={(l: LinhaTag) => (l.agentes.length ? l.agentes.map((a) => a.nome).join(', ') : <span className="ag-dica">nenhum</span>)} />
        </DataTable>
      </div>

      {selTrecho.item && <TrechoFicha t={selTrecho.item} agenteNome={nomeAgente} pergunta={testada} nav={selTrecho.nav} />}
      {selTag.item && <TagFicha l={selTag.item} nav={selTag.nav} onTestar={testarAgente} />}
    </div>
  );
}
