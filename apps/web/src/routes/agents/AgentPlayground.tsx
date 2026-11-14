import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill, StatusStrip } from '@/components/InfraKit';
import { getAgente, getRuntime, executarAgente, listExecucoes, getExecucao, erroApi } from '@/services/agentes';
import { STATUS_EXEC, truncar } from './regras';
import { tempoRelativo } from './home/regras';
import { MetaPill } from './ficha/comum';
import { Turno } from './playground/Turno';
import '@/styles/telas/agents.css';

export function AgentPlayground() {
  const { agenteId } = useParams({ strict: false }) as { agenteId: string };
  const qc = useQueryClient();

  const agente = useQuery({ queryKey: ['agente', agenteId], queryFn: () => getAgente(agenteId) });
  const runtime = useQuery({ queryKey: ['agentes-runtime'], queryFn: getRuntime });
  const historico = useQuery({ queryKey: ['agente-execucoes', agenteId], queryFn: () => listExecucoes(agenteId) });

  /** ids das execuções da conversa aberta, em ordem; cada pergunta é uma execução */
  const { exec } = useSearch({ strict: false }) as { exec?: string };
  const [turnos, setTurnos] = useState<string[]>(() => (exec ? [exec] : []));
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

  const rt = runtime.data;
  const custoAlto = !!rt && rt.custoHoje.execucoes >= rt.limites.execucoesPorDia * 0.8;
  const aberto = turnos[0];

  return (
    <div>
      <PageHeader
        title={`Playground: ${agente.data?.nome ?? '…'}`}
        subtitle="Converse com o agente e veja cada volta do laço: o que o modelo decidiu, qual ferramenta pediu e o que o servidor devolveu."
        actions={<>
          <Button label="Nova conversa" icon="pi pi-plus" outlined onClick={() => { setTurnos([]); setErro(''); }} disabled={turnos.length === 0 || rodando} />
          <Link to="/agents/agente/$agenteId" params={{ agenteId }} className="ag-btn"><i className="pi pi-pencil" aria-hidden="true" /> Editar o projeto</Link>
          <Link to="/agents" className="ag-btn"><i className="pi pi-arrow-left" aria-hidden="true" /> Voltar</Link>
        </>}
      />

      {rt && !rt.configurada && (
        <Message severity="warn" className="ag-largo"
          text="IA não configurada: defina o Secret ANTHROPIC_API_KEY na API e faça redeploy para executar agentes." />
      )}

      {custoAlto && rt && (
        <StatusStrip tone="warn" icon="pi-wallet">
          Perto do teto diário: {rt.custoHoje.execucoes}/{rt.limites.execucoesPorDia} execuções e {rt.custoHoje.escritasAprovadas}/{rt.limites.escritasAprovadasPorDia} ações
          de escrita aprovadas hoje. Reinicia à meia-noite.
        </StatusStrip>
      )}

      <div className="iv-card iv-mt">
        <div className="ag-ferramentas-ativas">
          <span className="ag-rotulo">Modelo:</span>
          <Pill label={rt?.modelo ?? '…'} tone="muted" icon="pi-microchip-ai" />
          <span className="ag-rotulo">Ferramentas ativas:</span>
          {ativas.length === 0 && <span className="ag-rotulo">nenhuma (o agente só conversa)</span>}
          {ativas.map((r) => (
            <Pill key={r.nome} label={r.nome}
              tone={r.faltando.length > 0 ? 'serious' : r.permissao === 'escrita' ? 'info' : 'muted'}
              icon={r.faltando.length > 0 ? 'pi-exclamation-triangle' : r.permissao === 'escrita' ? 'pi-lock' : 'pi-eye'} />
          ))}
        </div>
        {ativas.some((r) => r.permissao === 'escrita') && (
          <p className="ag-nota-curta"><i className="pi pi-lock" aria-hidden="true" /> As ferramentas com cadeado alteram o ambiente: cada chamada para aqui e espera a sua aprovação.</p>
        )}
        {faltando.length > 0 && (
          <p className="ag-nota-curta ag-erro">
            <i className="pi pi-exclamation-triangle" aria-hidden="true" /> As ferramentas com alerta vão falhar: falta definir {faltando.join(' e ')} no serviço da API e fazer redeploy.
          </p>
        )}
        {semExecucao.length > 0 && (
          <p className="ag-nota-curta">Ligadas no projeto, mas ainda sem execução no servidor: {semExecucao.map((f) => f.nome).join('; ')}.</p>
        )}
        <p className="ag-nota-curta">
          O modelo nunca executa nada sozinho: pede uma ferramenta, o servidor valida os parâmetros, executa e devolve o resultado como dado.
          O laço para quando o modelo responde sem pedir ferramenta ou ao atingir {rt?.limites.voltas ?? 8} chamadas.
          {rt && !custoAlto && ` Hoje: ${rt.custoHoje.execucoes}/${rt.limites.execucoesPorDia} execuções.`}
        </p>
      </div>

      <div className="iv-col iv-mt ag-turnos">
        {turnos.map((id) => <Turno key={id} agenteId={agenteId} execId={id} />)}
      </div>

      <div className="iv-card iv-mt">
        <InputTextarea rows={3} className="ag-largo" value={texto} maxLength={8000} aria-label="Mensagem para o agente"
          placeholder={aguardando ? 'Decida a aprovação acima para continuar' : turnos.length === 0 ? 'Escreva o pedido para o agente' : 'Continue a conversa'}
          disabled={aguardando}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(); }} />
        <div className="iv-row iv-wrap iv-mt ag-entre">
          <small className="ag-dica">Ctrl+Enter envia. O texto e os resultados das ferramentas são enviados à Anthropic.</small>
          <Button label="Executar" icon="pi pi-play" onClick={enviar} loading={rodando && !aguardando} disabled={!texto.trim() || rodando || rt?.configurada === false} />
        </div>
        {erro && <Message severity="error" text={erro} className="ag-largo iv-mt" />}
      </div>

      <div className="iv-card iv-mt">
        <h3 className="ag-titulo-card">Execuções anteriores</h3>
        {historico.isLoading ? <p className="ag-dica">Carregando…</p>
          : (historico.data ?? []).length === 0 ? <p className="ag-dica">Nenhuma execução ainda.</p> : (
            <ul className="ag-historico iv-mt">
              {(historico.data ?? []).map((h) => (
                <li key={h.id}>
                  <button type="button" disabled={rodando} aria-current={aberto === h.id || undefined}
                    onClick={() => { setTurnos([h.id]); setErro(''); }} title={h.entrada}>
                    {truncar(h.entrada, 110) || '—'}
                  </button>
                  <span className="iv-row">
                    <MetaPill m={STATUS_EXEC[h.status]} />
                    <span className="ag-passo-exec__meta" title={new Date(h.criadoEm).toLocaleString('pt-BR')}>{tempoRelativo(h.criadoEm)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
