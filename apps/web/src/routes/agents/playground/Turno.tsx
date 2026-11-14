import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Message } from 'primereact/message';
import { TextoMarkdown } from '@/components/ui/TextoMarkdown';
import { getExecucao, type Execucao } from '@/services/agentes';
import { STATUS_EXEC, duracao, numero } from '../regras';
import { MetaPill } from '../ficha/comum';
import { Aprovacao, Passo } from './Passos';

/** Uma pergunta e tudo o que o laço fez para respondê-la. */
export function Turno({ agenteId, execId }: { agenteId: string; execId: string }) {
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
  if (q.isError) return <Message severity="error" text="Não foi possível carregar esta execução." className="ag-largo" />;
  if (!e) return <div className="route-loading" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Carregando…</div>;

  return (
    <div className="iv-col">
      <div className="iv-card ag-voce">
        <small className="ag-dica">Você</small>
        <p>{e.entrada}</p>
      </div>

      {e.passos.map((p, i) => <Passo key={i} p={p} n={i + 1} />)}

      {e.status === 'rodando' && (
        <div className="ag-dica" role="status">
          <i className="pi pi-spin pi-spinner" aria-hidden="true" /> O laço está rodando no servidor…
        </div>
      )}

      {e.status === 'aguardando_aprovacao' && (
        <>
          {e.resposta && <div className="iv-card ag-passo-exec tone-muted"><TextoMarkdown texto={e.resposta} /></div>}
          <Aprovacao agenteId={agenteId} e={e} />
        </>
      )}

      {terminou && (
        <div className="iv-card">
          <div className="iv-row iv-wrap ag-entre">
            <small className="ag-dica">Resposta do agente</small>
            <div className="iv-row iv-wrap">
              <MetaPill m={STATUS_EXEC[e.status]} />
              <span className="ag-passo-exec__meta">
                {numero(e.tokensEntrada)} tokens de entrada · {numero(e.tokensSaida)} de saída · {duracao(e.duracaoMs)}
              </span>
            </div>
          </div>
          {e.resposta && <div className="iv-mt"><TextoMarkdown texto={e.resposta} /></div>}
          {e.erro && <p className={e.status === 'erro' ? 'ag-erro' : 'ag-nota-curta'}>{e.erro}</p>}
        </div>
      )}
    </div>
  );
}
