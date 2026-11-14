import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { revisarAgente } from '@seginfo/shared';
import { Bar, Pill } from '@/components/InfraKit';
import { progressTone } from '@/theme/status';
import { listAvaliacoes, listExecucoes, type Agente, type AgenteResumo } from '@/services/agentes';
import { TAXA_MINIMA, taxaOk, tempoRelativo } from '../home/regras';
import { RESULTADO_META, STATUS_EXEC, duracao, numero, resumoPilares, truncar } from '../regras';
import { Linhas, MetaPill, Secao, Vazio } from './comum';

/** Pendências da revisão (texto completo), graves primeiro. */
export function Revisao({ agente, carregando }: { agente?: Agente; carregando: boolean }) {
  if (carregando) return <Secao titulo="Pendências da revisão"><Linhas /></Secao>;
  if (!agente) return null;
  const lista = revisarAgente(agente.config).sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'erro' ? -1 : 1));
  return (
    <Secao titulo={`Pendências da revisão${lista.length ? ` (${lista.length})` : ''}`}>
      {lista.length === 0 ? <Vazio>Nenhuma pendência: limites, aprovação e auditoria em ordem.</Vazio> : (
        <ul className="agd-lista">
          {lista.map((r) => (
            <li key={r.codigo} className={`agd-item tone-${r.nivel === 'erro' ? 'danger' : 'warning'}`}>
              <i className={`pi ${r.nivel === 'erro' ? 'pi-exclamation-circle' : 'pi-info-circle'} agd-item__icone`} aria-hidden="true" />
              <span><strong className="agd-nivel">{r.nivel === 'erro' ? 'Grave' : 'Aviso'}:</strong> {r.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

/** Os 8 pilares numa linha cada + as ferramentas com permissão e aprovação. */
export function Pilares({ agente, carregando }: { agente?: Agente; carregando: boolean }) {
  if (carregando) return <Secao titulo="Os 8 pilares"><Linhas n={4} /></Secao>;
  if (!agente) return null;
  const c = agente.config;
  return (
    <Secao titulo="Os 8 pilares">
      <ol className="agd-lista agd-pilares">
        {resumoPilares(c).map((p) => (
          <li key={p.numero} className="agd-item" data-falta={!p.ok || undefined}>
            <i className={`pi ${p.ok ? 'pi-check-circle' : 'pi-exclamation-triangle'} agd-item__icone`} aria-hidden="true" />
            <span><strong>{p.numero}. {p.titulo}</strong>{!p.ok && <span className="agd-sr"> (incompleto)</span>} <span className="agd-mudo">· {p.texto}</span></span>
          </li>
        ))}
      </ol>
      {c.ferramentas.length > 0 && (
        <>
          <h4 className="agd-sub">Ferramentas ligadas</h4>
          <ul className="agd-lista">
            {c.ferramentas.map((f, i) => (
              <li key={`${f.id}-${i}`} className="agd-item">
                <i className={`pi ${f.permissao === 'escrita' ? 'pi-pencil' : 'pi-eye'} agd-item__icone`} aria-hidden="true" />
                <span className="agd-item__corpo">{f.nome}{f.observacao && <small className="agd-mudo"> · {truncar(f.observacao, 80)}</small>}</span>
                <span className="iv-row">
                  <Pill label={f.permissao === 'escrita' ? 'Escrita' : 'Leitura'} tone={f.permissao === 'escrita' ? 'info' : 'muted'} />
                  {f.permissao === 'escrita' && (f.exigeAprovacao
                    ? <Pill label="Com aprovação" tone="muted" icon="pi-lock" />
                    : <Pill label="Sem aprovação" tone="danger" icon="pi-exclamation-circle" />)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Secao>
  );
}

/** Últimas 5 execuções com link para reabrir no playground. */
export function Execucoes({ a }: { a: AgenteResumo }) {
  const q = useQuery({ queryKey: ['agente-execucoes', a.id], queryFn: () => listExecucoes(a.id) });
  const lista = (q.data ?? []).slice(0, 5);
  return (
    <Secao titulo="Últimas execuções" aside={(q.data?.length ?? 0) > 5 ? <span className="agd-mudo">{q.data?.length} no total</span> : undefined}>
      {q.isLoading ? <Linhas /> : q.isError ? <Vazio>Não foi possível carregar as execuções.</Vazio> : lista.length === 0 ? (
        <Vazio>Nunca rodou. Teste no playground antes de registrar casos.</Vazio>
      ) : (
        <ul className="agd-lista">
          {lista.map((e) => (
            <li key={e.id} className="agd-exec">
              <MetaPill m={STATUS_EXEC[e.status]} />
              <span className="agd-exec__texto" title={e.entrada}>{truncar(e.entrada, 90) || '—'}</span>
              <span className="agd-exec__meta tabular">
                {tempoRelativo(e.criadoEm)} · {numero(e.tokensEntrada + e.tokensSaida)} tokens · {duracao(e.duracaoMs)}
              </span>
              <Link to="/agents/agente/$agenteId/playground" params={{ agenteId: a.id }} search={{ exec: e.id }} className="agd-link">
                Abrir<span className="agd-sr"> esta execução no playground</span> <i className="pi pi-angle-right" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

/** Placar das avaliações + os casos que falharam por último. */
export function Avaliacoes({ a }: { a: AgenteResumo }) {
  const taxa = taxaOk(a);
  const q = useQuery({ queryKey: ['agente-avaliacoes', a.id], queryFn: () => listAvaliacoes(a.id), enabled: a.avaliacoes.total > 0 });
  const problemas = (q.data ?? []).filter((c) => c.resultado !== 'ok').slice(0, 3);
  return (
    <Secao titulo="Avaliações" aside={<Link to="/agents/avaliacoes" search={{ agente: a.id }} className="agd-link">Ver todas</Link>}>
      {taxa === null ? <Vazio>Nenhum caso de teste registrado. Sem avaliação não dá para saber se ele funciona.</Vazio> : (
        <>
          <p className="agd-placar tabular">
            <strong>{taxa}% ok</strong> em {a.avaliacoes.total} caso(s) · {a.avaliacoes.parcial} parcial · {a.avaliacoes.falha} falha
            {taxa < TAXA_MINIMA && <span className="agd-mudo"> · meta {TAXA_MINIMA}%</span>}
          </p>
          <Bar pct={taxa} tone={progressTone(taxa)} />
          {problemas.length > 0 && (
            <>
              <h4 className="agd-sub">Falharam por último</h4>
              <ul className="agd-lista">
                {problemas.map((c) => (
                  <li key={c.id} className="agd-item">
                    <MetaPill m={RESULTADO_META[c.resultado]} />
                    <span className="agd-item__corpo">{truncar(c.caso, 100)}{c.observacao && <small className="agd-mudo"> · {truncar(c.observacao, 80)}</small>}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Secao>
  );
}
