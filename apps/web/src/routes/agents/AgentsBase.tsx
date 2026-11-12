import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { Kpi, StatusStrip, Pill } from '@/components/InfraKit';
import { listAgentes, listTagsBase, buscarNaBaseDoAgente, erroApi, type TrechoBase } from '@/services/agentes';

export function AgentsBase() {
  const agentes = useQuery({ queryKey: ['agentes'], queryFn: listAgentes });
  const tags = useQuery({ queryKey: ['agentes-base-tags'], queryFn: listTagsBase });

  const [agenteId, setAgenteId] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState('');
  const [achados, setAchados] = useState<TrechoBase[] | null>(null);
  const [tagsDoAgente, setTagsDoAgente] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState('');

  const lista = agentes.data ?? [];
  const linhas = (tags.data ?? []).map((t) => ({
    ...t,
    agentes: lista.filter((a) => a.baseTags.includes(t.tag)).map((a) => a.nome),
  }));
  const comBase = lista.filter((a) => a.baseTags.length > 0).length;

  async function testar() {
    if (!agenteId || !pergunta.trim()) return;
    setBuscando(true); setErro('');
    try {
      const r = await buscarNaBaseDoAgente(agenteId, pergunta.trim());
      setAchados(r.resultados);
      setTagsDoAgente(r.tags);
    } catch (e) {
      setErro(erroApi(e, 'Falha ao testar a base.'));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Base de conhecimento"
        subtitle="O que cada agente pode consultar. A base é feita das suas notas do Segundo Cérebro, escolhidas por tag."
        actions={<Link to="/cerebro">Abrir o Segundo Cérebro</Link>}
      />

      {(agentes.isError || tags.isError) && (
        <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }}
          text="API ou banco indisponível. A base de conhecimento usa o servidor (Segundo Cérebro e agentes)." />
      )}

      <StatusStrip tone="ok" icon="pi-database">
        Cada agente enxerga só as tags que você liga a ele. Notas marcadas como corporativas nunca entram, e o conteúdo recuperado é sempre tratado como dado, não como instrução.
      </StatusStrip>

      <div className="iv-kpis iv-mt">
        <Kpi label="Tags disponíveis" value={tags.data?.length ?? 0} />
        <Kpi label="Agentes com base" value={comBase} hint={`de ${lista.length}`} />
        <Kpi label="Notas pessoais com tag" value={(tags.data ?? []).reduce((s, t) => s + t.total, 0)} hint="uma nota pode ter várias tags" />
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Testar a recuperação</h4>
        <p className="iv-muted" style={{ marginTop: 0, fontSize: '.86rem' }}>
          Escolha um agente e faça uma pergunta. O resultado mostra exatamente os trechos que ele receberia como contexto.
        </p>
        <div className="iv-row iv-wrap" style={{ gap: '.6rem' }}>
          <Dropdown value={agenteId} options={lista.map((a) => ({ label: a.nome, value: a.id }))} onChange={(e) => setAgenteId(e.value)}
            placeholder="Escolha o agente" style={{ minWidth: 260 }} aria-label="Agente" />
          <span className="p-input-icon-left" style={{ flex: 1, minWidth: 240 }}>
            <i className="pi pi-search" aria-hidden="true" />
            <InputText value={pergunta} onChange={(e) => setPergunta(e.target.value)} style={{ width: '100%' }} aria-label="Pergunta de teste"
              placeholder="Pergunta de teste" onKeyDown={(e) => e.key === 'Enter' && testar()} />
          </span>
          <Button label="Buscar" icon={buscando ? 'pi pi-spinner pi-spin' : 'pi pi-search'} onClick={testar} disabled={buscando || !agenteId || !pergunta.trim()} />
        </div>
        {erro && <Message severity="error" text={erro} style={{ width: '100%', marginTop: '.75rem' }} />}
        {achados && tagsDoAgente.length === 0 && (
          <Message severity="info" style={{ width: '100%', marginTop: '.75rem' }}
            text="Este agente não tem tags na base. Ligue tags na aba Memória do editor." />
        )}
        {achados && tagsDoAgente.length > 0 && (
          <div className="iv-col iv-mt">
            <div className="iv-row iv-wrap">
              <span className="iv-muted" style={{ fontSize: '.8rem' }}>Base do agente:</span>
              {tagsDoAgente.map((t) => <Pill key={t} label={`#${t}`} color="#64748b" />)}
            </div>
            {achados.length === 0 && <p className="iv-muted" style={{ margin: 0 }}>Nada encontrado. Um agente bem projetado responderia "não encontrei" aqui.</p>}
            {achados.map((a, i) => (
              <div key={`${a.memoriaId}-${i}`} className="iv-card" style={{ padding: '.7rem .9rem' }}>
                <div className="iv-row" style={{ justifyContent: 'space-between' }}>
                  <strong>{a.titulo}</strong>
                  <span className="iv-muted" style={{ fontSize: '.75rem' }}>relevância {a.score}</span>
                </div>
                <p style={{ margin: '.4rem 0 0', whiteSpace: 'pre-wrap', fontSize: '.88rem' }}>{a.trecho}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Tags e quem as usa</h4>
        <DataTable value={linhas} dataKey="tag" paginator rows={10} emptyMessage="Nenhuma tag ainda. Crie notas com tags no Segundo Cérebro.">
          <Column header="Tag" body={(l: (typeof linhas)[number]) => <Pill label={`#${l.tag}`} color="#64748b" />} />
          <Column header="Notas" field="total" style={{ width: 100 }} />
          <Column header="Agentes que usam" body={(l: (typeof linhas)[number]) => (l.agentes.length ? l.agentes.join(', ') : <span className="iv-muted">nenhum</span>)} />
        </DataTable>
      </div>
    </div>
  );
}
