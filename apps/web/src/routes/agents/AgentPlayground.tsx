import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { ExecucaoStatus, PassoExecucao } from '@seginfo/shared';
import { PageHeader } from '@/components/ui/PageHeader';
import { TextoMarkdown } from '@/components/ui/TextoMarkdown';
import { Pill, StatusStrip } from '@/components/InfraKit';
import {
  getAgente, getRuntime, executarAgente, listExecucoes, getExecucao, decidirExecucao, erroApi, type Execucao,
} from '@/services/agentes';

const STATUS_EXEC: Record<ExecucaoStatus, { rotulo: string; cor: string }> = {
  rodando: { rotulo: 'rodando', cor: '#3b82f6' },
  aguardando_aprovacao: { rotulo: 'aguardando aprovação', cor: '#d97706' },
  concluida: { rotulo: 'concluída', cor: '#16a34a' },
  limite: { rotulo: 'parou no limite', cor: '#f59e0b' },
  recusada: { rotulo: 'recusada', cor: '#f59e0b' },
  erro: { rotulo: 'erro', cor: '#ef4444' },
};

/** Por que o modelo parou naquela chamada, em português. */
const PARADA: Record<string, string> = {
  end_turn: 'terminou a resposta',
  tool_use: 'pediu uma ferramenta',
  max_tokens: 'cortado pelo limite de tokens',
  refusal: 'recusou o pedido',
};

const segundos = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const bloco = {
  whiteSpace: 'pre-wrap', background: '#0d0c2b', color: '#e6e6f0', padding: '10px 12px', borderRadius: 8,
  fontSize: 12.5, lineHeight: 1.5, maxHeight: 260, overflow: 'auto', margin: '.4rem 0 0',
} as const;

function Passo({ p, n }: { p: PassoExecucao; n: number }) {
  if (p.tipo === 'ferramenta') {
    return (
      <div className="iv-card" style={{ padding: '.7rem .9rem', borderLeft: `3px solid ${p.erro ? '#ef4444' : '#8b5cf6'}` }}>
        <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
          <strong>
            <i className="pi pi-wrench" aria-hidden="true" /> {n}.{' '}
            {p.decisao === 'negada' ? `Você negou ${p.nome}: nada foi executado` : p.decisao === 'aprovada' ? `Você aprovou e o servidor executou ${p.nome}` : `Servidor executou ${p.nome}`}
          </strong>
          <span className="iv-muted" style={{ fontSize: '.78rem' }}>
            {p.decididoEm ? `decidido em ${new Date(p.decididoEm).toLocaleString('pt-BR')} · ` : ''}
            {p.erro && p.decisao !== 'negada' ? 'falhou · ' : ''}{segundos(p.ms)}
          </span>
        </div>
        <details style={{ marginTop: '.4rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '.84rem' }}>Parâmetros que o modelo enviou e o que voltou</summary>
          <pre style={bloco}>{JSON.stringify(p.entrada, null, 2)}</pre>
          <pre style={bloco}>{p.saida}</pre>
        </details>
      </div>
    );
  }
  return (
    <div className="iv-card" style={{ padding: '.7rem .9rem', borderLeft: '3px solid #3b82f6' }}>
      <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
        <strong><i className="pi pi-microchip-ai" aria-hidden="true" /> {n}. Modelo {PARADA[p.parada] ?? p.parada}</strong>
        <span className="iv-muted" style={{ fontSize: '.78rem' }}>
          {p.tokensEntrada} tokens de entrada · {p.tokensSaida} de saída · {segundos(p.ms)}
        </span>
      </div>
      {p.raciocinio && (
        <details style={{ marginTop: '.4rem' }}>
          <summary style={{ cursor: 'pointer', fontSize: '.84rem' }}>Raciocínio (resumo)</summary>
          <p className="iv-muted" style={{ whiteSpace: 'pre-wrap', fontSize: '.84rem', margin: '.4rem 0 0' }}>{p.raciocinio}</p>
        </details>
      )}
      {p.texto && p.parada === 'tool_use' && <div style={{ fontSize: '.88rem', marginTop: '.4rem' }}><TextoMarkdown texto={p.texto} /></div>}
    </div>
  );
}

/** Tela de consentimento: mostra o que o servidor vai fazer e só segue com a sua decisão para cada ação. */
function Aprovacao({ agenteId, e }: { agenteId: string; e: Execucao }) {
  const qc = useQueryClient();
  const [escolhas, setEscolhas] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const completo = e.pendentes.every((p) => p.id in escolhas);
  const aprovadas = e.pendentes.filter((p) => escolhas[p.id]).length;

  async function enviar() {
    if (!completo || enviando) return;
    setEnviando(true); setErro('');
    try {
      await decidirExecucao(agenteId, e.id, e.pendentes.map((p) => ({ id: p.id, aprovar: escolhas[p.id] })));
    } catch (err) {
      setErro(erroApi(err, 'Falha ao enviar a decisão.'));
    } finally {
      // com sucesso ou com erro, a tela volta a refletir o que o servidor tem
      await qc.invalidateQueries({ queryKey: ['agente-execucao', agenteId, e.id] });
      setEnviando(false);
    }
  }

  return (
    <div className="iv-card" role="group" aria-label="Aprovação necessária" style={{ padding: '1rem', border: '2px solid #d97706' }}>
      <strong style={{ fontSize: '1.02rem' }}><i className="pi pi-shield" aria-hidden="true" /> Aprovação necessária</strong>
      <p className="iv-muted" style={{ fontSize: '.86rem', margin: '.3rem 0 .8rem' }}>
        O agente pediu {e.pendentes.length === 1 ? 'uma ação que altera' : `${e.pendentes.length} ações que alteram`} o ambiente. Nada foi executado ainda.
        O servidor só executa o que você aprovar aqui, com exatamente os parâmetros abaixo.
      </p>
      <div className="iv-col" style={{ gap: '.7rem' }}>
        {e.pendentes.map((p) => (
          <div key={p.id} className="iv-card" style={{ padding: '.7rem .9rem' }}>
            <div style={{ fontWeight: 600 }}>{p.resumo}</div>
            <details style={{ marginTop: '.3rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '.82rem' }}>Ferramenta {p.nome} e parâmetros</summary>
              <pre style={bloco}>{JSON.stringify(p.entrada, null, 2)}</pre>
            </details>
            <div className="iv-row iv-wrap iv-mt">
              <Button label="Aprovar" icon="pi pi-check" size="small" severity="success" outlined={escolhas[p.id] !== true}
                aria-pressed={escolhas[p.id] === true} onClick={() => setEscolhas((x) => ({ ...x, [p.id]: true }))} disabled={enviando} />
              <Button label="Negar" icon="pi pi-times" size="small" severity="danger" outlined={escolhas[p.id] !== false}
                aria-pressed={escolhas[p.id] === false} onClick={() => setEscolhas((x) => ({ ...x, [p.id]: false }))} disabled={enviando} />
            </div>
          </div>
        ))}
      </div>
      <div className="iv-row iv-wrap iv-mt" style={{ justifyContent: 'space-between' }}>
        <small className="iv-muted">
          {completo ? `${aprovadas} para executar, ${e.pendentes.length - aprovadas} para negar.` : 'Escolha Aprovar ou Negar em cada ação.'}
        </small>
        <Button label="Confirmar decisão" icon="pi pi-send" onClick={enviar} loading={enviando} disabled={!completo || enviando} />
      </div>
      {erro && <Message severity="error" text={erro} style={{ width: '100%', marginTop: '.75rem' }} />}
    </div>
  );
}

function Turno({ agenteId, execId }: { agenteId: string; execId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['agente-execucao', agenteId, execId],
    queryFn: () => getExecucao(agenteId, execId),
    // enquanto o laço roda no servidor, a tela busca os passos novos
    refetchInterval: (query) => ((query.state.data as Execucao | undefined)?.status === 'rodando' ? 1200 : false),
  });
  const e = q.data;
  // quando a execução termina, a lista de execuções anteriores deixa de mostrar "rodando"
  const terminou = !!e && e.status !== 'rodando' && e.status !== 'aguardando_aprovacao';
  useEffect(() => {
    if (terminou) qc.invalidateQueries({ queryKey: ['agente-execucoes', agenteId] });
  }, [terminou, agenteId, qc]);
  if (q.isError) return <Message severity="error" text="Não foi possível carregar esta execução." style={{ width: '100%' }} />;
  if (!e) return <div className="route-loading" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando…</div>;
  const st = STATUS_EXEC[e.status];

  return (
    <div className="iv-col" style={{ gap: '.6rem' }}>
      <div className="iv-card" style={{ padding: '.7rem .9rem', background: 'var(--surface-100, #f1f5f9)' }}>
        <small className="iv-muted">Você</small>
        <p style={{ whiteSpace: 'pre-wrap', margin: '.2rem 0 0' }}>{e.entrada}</p>
      </div>

      {e.passos.map((p, i) => <Passo key={i} p={p} n={i + 1} />)}

      {e.status === 'rodando' && (
        <div className="iv-muted" role="status" style={{ fontSize: '.88rem' }}>
          <i className="pi pi-spin pi-spinner" aria-hidden="true" /> O laço está rodando no servidor…
        </div>
      )}

      {e.status === 'aguardando_aprovacao' && (
        <>
          {e.resposta && <div className="iv-card" style={{ padding: '.7rem .9rem' }}><TextoMarkdown texto={e.resposta} /></div>}
          <Aprovacao agenteId={agenteId} e={e} />
        </>
      )}

      {terminou && (
        <div className="iv-card" style={{ padding: '.8rem 1rem' }}>
          <div className="iv-row iv-wrap" style={{ justifyContent: 'space-between' }}>
            <small className="iv-muted">Resposta do agente</small>
            <div className="iv-row iv-wrap">
              <Pill label={st.rotulo} color={st.cor} />
              <span className="iv-muted" style={{ fontSize: '.78rem' }}>
                {e.tokensEntrada} tokens de entrada · {e.tokensSaida} de saída · {segundos(e.duracaoMs)}
              </span>
            </div>
          </div>
          {e.resposta && <div style={{ marginTop: '.5rem' }}><TextoMarkdown texto={e.resposta} /></div>}
          {e.erro && <p style={{ color: e.status === 'erro' ? 'var(--iv-crit)' : undefined, fontSize: '.86rem', margin: '.5rem 0 0' }}>{e.erro}</p>}
        </div>
      )}
    </div>
  );
}

export function AgentPlayground() {
  const { agenteId } = useParams({ strict: false }) as { agenteId: string };
  const qc = useQueryClient();

  const agente = useQuery({ queryKey: ['agente', agenteId], queryFn: () => getAgente(agenteId) });
  const runtime = useQuery({ queryKey: ['agentes-runtime'], queryFn: getRuntime });
  const historico = useQuery({ queryKey: ['agente-execucoes', agenteId], queryFn: () => listExecucoes(agenteId) });

  /** ids das execuções da conversa aberta, em ordem; cada pergunta é uma execução */
  const [turnos, setTurnos] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const ultimoId = turnos[turnos.length - 1];
  const ultimo = useQuery({
    queryKey: ['agente-execucao', agenteId, ultimoId],
    queryFn: () => getExecucao(agenteId, ultimoId as string),
    enabled: !!ultimoId,
  });
  const aguardando = ultimo.data?.status === 'aguardando_aprovacao';
  const rodando = enviando || aguardando || (!!ultimoId && (!ultimo.data || ultimo.data.status === 'rodando'));

  async function enviar() {
    const mensagem = texto.trim();
    if (!mensagem || rodando) return;
    setEnviando(true); setErro('');
    try {
      const { id } = await executarAgente(agenteId, mensagem, ultimoId);
      setTurnos((t) => [...t, id]);
      setTexto('');
      qc.invalidateQueries({ queryKey: ['agente-execucoes', agenteId] });
    } catch (e) {
      setErro(erroApi(e, 'Falha ao iniciar a execução.'));
    } finally {
      setEnviando(false);
    }
  }

  if (agente.isError) {
    return (
      <div>
        <PageHeader title="Agente não encontrado" subtitle="Ele pode ter sido excluído, ou a API está indisponível." />
        <Link to="/agents">Voltar para Agents</Link>
      </div>
    );
  }

  const ligadas = agente.data?.config.ferramentas ?? [];
  // Um item do projeto (id do catálogo) pode virar várias ferramentas reais no servidor.
  const reais = runtime.data?.ferramentas ?? [];
  const ativas = reais.filter((r) => ligadas.some((f) => f.id === r.id && (r.permissao === 'leitura' || f.permissao === 'escrita')));
  const semExecucao = ligadas.filter((f) => !ativas.some((r) => r.id === f.id));
  const faltando = [...new Set(ativas.flatMap((r) => r.faltando))];

  return (
    <div>
      <PageHeader
        title={`Playground: ${agente.data?.nome ?? '…'}`}
        subtitle="Converse com o agente e veja cada volta do laço: o que o modelo decidiu, qual ferramenta pediu e o que o servidor devolveu."
        actions={
          <div className="iv-row iv-wrap">
            <Button label="Nova conversa" icon="pi pi-plus" outlined onClick={() => { setTurnos([]); setErro(''); }} disabled={turnos.length === 0 || rodando} />
            <Link to="/agents/agente/$agenteId" params={{ agenteId }}>Editar o projeto</Link>
            <Link to="/agents">Voltar</Link>
          </div>
        }
      />

      {runtime.data && !runtime.data.configurada && (
        <Message severity="warn" style={{ width: '100%', marginBottom: '1rem' }}
          text="IA não configurada: defina o Secret ANTHROPIC_API_KEY na API e faça redeploy para executar agentes." />
      )}

      <StatusStrip tone="ok" icon="pi-sync">
        O modelo nunca executa nada sozinho: ele pede uma ferramenta, o servidor valida os parâmetros, executa e devolve o resultado como dado.
        O laço para quando o modelo responde sem pedir ferramenta, ou ao atingir {runtime.data?.limites.voltas ?? 8} chamadas ao modelo.
      </StatusStrip>

      <div className="iv-card iv-mt">
        <div className="iv-row iv-wrap">
          <span className="iv-muted" style={{ fontSize: '.84rem' }}>Modelo:</span>
          <Pill label={runtime.data?.modelo ?? '…'} color="#64748b" />
          <span className="iv-muted" style={{ fontSize: '.84rem' }}>Ferramentas ativas:</span>
          {ativas.length === 0 && <span className="iv-muted" style={{ fontSize: '.84rem' }}>nenhuma (o agente só conversa)</span>}
          {ativas.map((r) => <Pill key={r.nome} label={r.nome} color={r.faltando.length > 0 ? '#94a3b8' : r.permissao === 'escrita' ? '#d97706' : '#8b5cf6'} />)}
        </div>
        {ativas.some((r) => r.permissao === 'escrita') && (
          <p className="iv-muted" style={{ fontSize: '.82rem', margin: '.5rem 0 0' }}>
            As ferramentas em laranja alteram o ambiente: cada chamada para aqui e espera a sua aprovação.
          </p>
        )}
        {faltando.length > 0 && (
          <p style={{ color: 'var(--iv-crit)', fontSize: '.82rem', margin: '.5rem 0 0' }}>
            As ferramentas em cinza vão falhar: falta definir {faltando.join(' e ')} no serviço da API (Coolify) e fazer redeploy.
          </p>
        )}
        {semExecucao.length > 0 && (
          <p className="iv-muted" style={{ fontSize: '.82rem', margin: '.5rem 0 0' }}>
            Ligadas no projeto, mas ainda sem execução no servidor: {semExecucao.map((f) => f.nome).join('; ')}.
          </p>
        )}
      </div>

      <div className="iv-col iv-mt" style={{ gap: '1.2rem' }}>
        {turnos.map((id) => <Turno key={id} agenteId={agenteId} execId={id} />)}
      </div>

      <div className="iv-card iv-mt">
        <InputTextarea rows={3} style={{ width: '100%' }} value={texto} maxLength={8000} aria-label="Mensagem para o agente"
          placeholder={aguardando ? 'Decida a aprovação acima para continuar' : turnos.length === 0 ? 'Escreva o pedido para o agente' : 'Continue a conversa'}
          disabled={aguardando}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }} />
        <div className="iv-row iv-wrap iv-mt" style={{ justifyContent: 'space-between' }}>
          <small className="iv-muted">Ctrl+Enter envia. O texto e os resultados das ferramentas são enviados à Anthropic.</small>
          <Button label="Executar" icon="pi pi-play" onClick={enviar} loading={rodando && !aguardando} disabled={!texto.trim() || rodando || runtime.data?.configurada === false} />
        </div>
        {erro && <Message severity="error" text={erro} style={{ width: '100%', marginTop: '.75rem' }} />}
      </div>

      <div className="iv-card iv-mt">
        <h4 style={{ margin: '0 0 .6rem' }}>Execuções anteriores</h4>
        {(historico.data ?? []).length === 0 && <p className="iv-muted" style={{ margin: 0 }}>Nenhuma execução ainda.</p>}
        <div className="iv-col" style={{ gap: '.4rem' }}>
          {(historico.data ?? []).map((h) => (
            <div key={h.id} className="iv-row iv-wrap" style={{ justifyContent: 'space-between', gap: '.6rem' }}>
              <button type="button" onClick={() => { if (!rodando) { setTurnos([h.id]); setErro(''); } }}
                style={{ background: 'none', border: 0, padding: 0, color: 'var(--primary-color)', cursor: rodando ? 'default' : 'pointer', textAlign: 'left', flex: 1, minWidth: 200 }}>
                {h.entrada.length > 110 ? `${h.entrada.slice(0, 110)}…` : h.entrada}
              </button>
              <div className="iv-row">
                <Pill label={STATUS_EXEC[h.status].rotulo} color={STATUS_EXEC[h.status].cor} />
                <span className="iv-muted" style={{ fontSize: '.78rem' }}>{new Date(h.criadoEm).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
