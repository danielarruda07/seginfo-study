import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { AvaliacaoResultado } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { Bar, Kpi, Pill, StatusStrip } from '@/components/InfraKit';
import { progressTone } from '@/theme/status';
import { addAvaliacao, deleteAvaliacao, erroApi, listAgentes, listAvaliacoes, type Avaliacao } from '@/services/agentes';

const RESULTADO_OPTS = [
  { label: 'Ok: atendeu ao critério', value: 'ok' },
  { label: 'Parcial', value: 'parcial' },
  { label: 'Falha', value: 'falha' },
];
const RESULTADO_COR: Record<AvaliacaoResultado, string> = { ok: '#16a34a', parcial: '#f59e0b', falha: '#ef4444' };

const TIPOS_DE_CASO = [
  ['Comum', 'O pedido típico, o que o agente existe para fazer.'],
  ['De borda', 'Entrada vazia, enorme, em outro idioma, com dados faltando.'],
  ['Fora de escopo', 'Pedido que o agente deve recusar ou redirecionar.'],
  ['Adversarial', 'Tentativa de prompt injection, de extrair o prompt ou de forçar uma ferramenta de escrita.'],
  ['Ferramenta com falha', 'A fonte de dados cai ou devolve lixo: o agente deve avisar, não inventar.'],
];

const fmtData = (iso: string) => iso.replace('T', ' ').slice(0, 16);

export function AgentsAvaliacoes() {
  const qc = useQueryClient();
  const agentes = useQuery({ queryKey: ['agentes'], queryFn: listAgentes });
  const [agenteId, setAgenteId] = useState<string | null>(null);

  const lista = agentes.data ?? [];
  const atual = agenteId ?? lista.find((a) => a.status !== 'arquivado')?.id ?? null;
  const execucoes = useQuery({
    queryKey: ['agente-avaliacoes', atual], queryFn: () => listAvaliacoes(atual as string), enabled: !!atual,
  });

  const [caso, setCaso] = useState('');
  const [criterio, setCriterio] = useState('');
  const [resultado, setResultado] = useState<AvaliacaoResultado>('ok');
  const [latencia, setLatencia] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const itens = execucoes.data ?? [];
  const total = itens.length;
  const ok = itens.filter((i) => i.resultado === 'ok').length;
  const falhas = itens.filter((i) => i.resultado === 'falha').length;
  const pct = total ? Math.round((ok / total) * 100) : 0;
  const comLatencia = itens.filter((i) => i.latenciaMs !== null);
  const latMedia = comLatencia.length ? Math.round(comLatencia.reduce((s, i) => s + (i.latenciaMs ?? 0), 0) / comLatencia.length) : null;

  async function registrar() {
    if (!atual || !caso.trim()) return;
    setSalvando(true); setErro('');
    try {
      await addAvaliacao(atual, {
        caso: caso.trim(), criterio, resultado, observacao,
        ...(latencia !== null ? { latenciaMs: Math.round(latencia) } : {}),
      });
      setCaso(''); setCriterio(''); setObservacao(''); setLatencia(null); setResultado('ok');
      qc.invalidateQueries({ queryKey: ['agente-avaliacoes', atual] });
      qc.invalidateQueries({ queryKey: ['agentes'] });
    } catch (e) {
      setErro(erroApi(e, 'Falha ao registrar o teste.'));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    if (!atual) return;
    await deleteAvaliacao(atual, id);
    qc.invalidateQueries({ queryKey: ['agente-avaliacoes', atual] });
    qc.invalidateQueries({ queryKey: ['agentes'] });
  }

  return (
    <div>
      <PageHeader
        title="Testes e avaliações"
        subtitle="Rode o agente nos seus casos (onde você o executa) e registre o resultado aqui. Repita depois de cada mudança de prompt, modelo ou ferramenta."
      />

      {agentes.isError && (
        <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }} text="API ou banco indisponível. As avaliações ficam no servidor." />
      )}

      {lista.length === 0 && !agentes.isLoading ? (
        <StatusStrip tone="warn" icon="pi-info-circle">
          Você ainda não tem agentes. <Link to="/agents">Crie o primeiro</Link> para registrar avaliações.
        </StatusStrip>
      ) : (
        <>
          <div className="iv-card">
            <div className="iv-row iv-wrap" style={{ gap: '.6rem' }}>
              <Dropdown value={atual} options={lista.map((a) => ({ label: a.nome, value: a.id }))} onChange={(e) => setAgenteId(e.value)}
                placeholder="Escolha o agente" style={{ minWidth: 280 }} aria-label="Agente avaliado" />
              {atual && <Link to="/agents/agente/$agenteId" params={{ agenteId: atual }}>Abrir o projeto do agente</Link>}
            </div>
          </div>

          <div className="iv-kpis iv-mt">
            <Kpi label="Casos executados" value={total} />
            <Kpi label="Atendeu ao critério" value={total ? `${pct}%` : '—'} hint={`${ok} de ${total}`} />
            <Kpi label="Falhas" value={falhas} />
            <Kpi label="Latência média" value={latMedia !== null ? `${latMedia} ms` : '—'} hint={comLatencia.length ? `em ${comLatencia.length} caso(s)` : 'informe a latência'} />
          </div>
          {total > 0 && <div className="iv-mt"><Bar pct={pct} tone={progressTone(pct)} /></div>}

          <div className="iv-card iv-mt">
            <h4 style={{ margin: '0 0 .6rem' }}>Registrar um caso</h4>
            <div className="iv-col" style={{ gap: '.7rem' }}>
              <InputTextarea rows={2} value={caso} onChange={(e) => setCaso(e.target.value)} maxLength={2000} placeholder="O que você pediu ao agente (entrada do teste)" aria-label="Entrada do teste" style={{ width: '100%' }} />
              <InputTextarea rows={2} value={criterio} onChange={(e) => setCriterio(e.target.value)} maxLength={2000} placeholder="Critério: como seria uma boa resposta?" aria-label="Critério" style={{ width: '100%' }} />
              <div className="iv-row iv-wrap" style={{ gap: '.6rem' }}>
                <Dropdown value={resultado} options={RESULTADO_OPTS} onChange={(e) => setResultado(e.value)} aria-label="Resultado" />
                <InputNumber value={latencia} onValueChange={(e) => setLatencia(e.value ?? null)} suffix=" ms" min={0} max={600000} placeholder="Latência (opcional)" />
                <InputText value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={2000} placeholder="Observação (o que errou, o que ajustar)" style={{ flex: 1, minWidth: 220 }} aria-label="Observação" />
                <Button label="Registrar" icon="pi pi-plus" onClick={registrar} loading={salvando} disabled={!atual || !caso.trim()} />
              </div>
              {erro && <Message severity="error" text={erro} style={{ width: '100%' }} />}
            </div>
          </div>

          <div className="iv-card iv-mt">
            <h4 style={{ margin: '0 0 .6rem' }}>Histórico</h4>
            <DataTable value={itens} dataKey="id" paginator rows={10} emptyMessage="Nenhum caso registrado para este agente.">
              <Column header="Quando (UTC)" style={{ width: 150 }} body={(i: Avaliacao) => fmtData(i.criadoEm)} />
              <Column header="Caso" body={(i: Avaliacao) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{i.caso}</div>
                  {i.criterio && <div className="iv-muted" style={{ fontSize: '.8rem' }}>Critério: {i.criterio}</div>}
                  {i.observacao && <div className="iv-muted" style={{ fontSize: '.8rem' }}>{i.observacao}</div>}
                </div>
              )} />
              <Column header="Resultado" style={{ width: 120 }} body={(i: Avaliacao) => <Pill label={i.resultado} color={RESULTADO_COR[i.resultado]} />} />
              <Column header="Latência" style={{ width: 110 }} body={(i: Avaliacao) => (i.latenciaMs !== null ? `${i.latenciaMs} ms` : '—')} />
              <Column style={{ width: 70 }} body={(i: Avaliacao) => <Button icon="pi pi-trash" text severity="danger" aria-label="Remover caso" onClick={() => remover(i.id)} />} />
            </DataTable>
          </div>
        </>
      )}

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .5rem' }}>Que casos testar</h4>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {TIPOS_DE_CASO.map(([titulo, texto]) => <li key={titulo} style={{ marginBottom: '.25rem' }}><strong>{titulo}:</strong> {texto}</li>)}
        </ul>
        <p className="iv-muted" style={{ fontSize: '.82rem', marginBottom: 0 }}>
          Dica: comece com 20 casos que representem o uso real e acrescente um caso novo sempre que o agente errar.
        </p>
      </div>
    </div>
  );
}
