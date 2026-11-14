import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { PassoExecucao } from '@seginfo/shared';
import { TextoMarkdown } from '@/components/ui/TextoMarkdown';
import { decidirExecucao, erroApi, type Execucao } from '@/services/agentes';
import { duracao, formatarJson, numero } from '../regras';
import { Codigo } from '../ficha/comum';

/** Por que o modelo parou naquela chamada, em português. */
const PARADA: Record<string, string> = {
  end_turn: 'terminou a resposta',
  tool_use: 'pediu uma ferramenta',
  max_tokens: 'cortado pelo limite de tokens',
  refusal: 'recusou o pedido',
};

/** Uma volta do laço: chamada ao modelo ou ferramenta executada pelo servidor. */
export function Passo({ p, n }: { p: PassoExecucao; n: number }) {
  if (p.tipo === 'ferramenta') {
    const titulo = p.decisao === 'negada' ? `Você negou ${p.nome}: nada foi executado`
      : p.decisao === 'aprovada' ? `Você aprovou e o servidor executou ${p.nome}` : `Servidor executou ${p.nome}`;
    return (
      <div className={`iv-card ag-passo-exec ${p.erro && p.decisao !== 'negada' ? 'tone-danger' : 'tone-muted'}`}>
        <div className="ag-passo-exec__topo">
          <strong><i className="pi pi-wrench" aria-hidden="true" /> {n}. {titulo}</strong>
          <span className="ag-passo-exec__meta">
            {p.decididoEm ? `decidido em ${new Date(p.decididoEm).toLocaleString('pt-BR')} · ` : ''}
            {p.erro && p.decisao !== 'negada' ? 'falhou · ' : ''}{duracao(p.ms)}
          </span>
        </div>
        <details>
          <summary>Parâmetros que o modelo enviou e o que voltou</summary>
          <div className="iv-col iv-mt">
            <Codigo texto={formatarJson(p.entrada)} rotulo="Parâmetros" />
            <Codigo texto={formatarJson(p.saida)} rotulo="Resultado" />
          </div>
        </details>
      </div>
    );
  }
  return (
    <div className="iv-card ag-passo-exec tone-info">
      <div className="ag-passo-exec__topo">
        <strong><i className="pi pi-microchip-ai" aria-hidden="true" /> {n}. Modelo {PARADA[p.parada] ?? p.parada}</strong>
        <span className="ag-passo-exec__meta">
          {numero(p.tokensEntrada)} tokens de entrada · {numero(p.tokensSaida)} de saída · {duracao(p.ms)}
        </span>
      </div>
      {p.raciocinio && (
        <details>
          <summary>Raciocínio (resumo)</summary>
          <p className="agd-texto agd-mudo iv-mt">{p.raciocinio}</p>
        </details>
      )}
      {p.texto && p.parada === 'tool_use' && <div className="iv-mt"><TextoMarkdown texto={p.texto} /></div>}
    </div>
  );
}

/** Tela de consentimento: mostra o que o servidor vai fazer e só segue com a sua decisão para cada ação. */
export function Aprovacao({ agenteId, e }: { agenteId: string; e: Execucao }) {
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
    <div className="iv-card ag-aprovacao" role="group" aria-label="Aprovação necessária">
      <strong className="ag-aprovacao__titulo"><i className="pi pi-shield" aria-hidden="true" /> Aprovação necessária</strong>
      <p className="ag-dica">
        O agente pediu {e.pendentes.length === 1 ? 'uma ação que altera' : `${e.pendentes.length} ações que alteram`} o ambiente. Nada foi executado ainda.
        O servidor só executa o que você aprovar aqui, com exatamente os parâmetros abaixo.
      </p>
      <div className="iv-col">
        {e.pendentes.map((p) => (
          <div key={p.id} className="iv-card ag-passo-exec tone-serious">
            <strong>{p.resumo}</strong>
            <details>
              <summary>Ferramenta {p.nome} e parâmetros</summary>
              <div className="iv-mt"><Codigo texto={formatarJson(p.entrada)} rotulo="Parâmetros" /></div>
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
      <div className="iv-row iv-wrap iv-mt ag-entre">
        <small className="ag-dica" aria-live="polite">
          {completo ? `${aprovadas} para executar, ${e.pendentes.length - aprovadas} para negar.` : 'Escolha Aprovar ou Negar em cada ação.'}
        </small>
        <Button label="Confirmar decisão" icon="pi pi-send" onClick={enviar} loading={enviando} disabled={!completo || enviando} />
      </div>
      {erro && <Message severity="error" text={erro} className="ag-largo iv-mt" />}
    </div>
  );
}
