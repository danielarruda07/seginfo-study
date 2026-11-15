import { Pill } from '@/components/InfraKit';
import type { ResultadoExposicao, ResultadoFonte, Tom } from '@/services/exposicao';
import type { Tone } from '@/theme/status';

const TOM: Record<Tom, Tone> = { alta: 'danger', media: 'warning', info: 'info', ok: 'ok' };

/** Destaques das fontes extras no card do alvo (até `max` itens, os mais graves primeiro). */
export function DestaquesExtras({ resultado, max = 4 }: { resultado?: ResultadoExposicao; max?: number }) {
  const peso: Record<Tom, number> = { alta: 0, media: 1, info: 2, ok: 3 };
  const todos = (resultado?.extras ?? []).flatMap((f) => f.destaques.map((d) => ({ ...d, fonte: f.nome })))
    .sort((a, b) => peso[a.tom ?? 'info'] - peso[b.tom ?? 'info']);
  if (!todos.length) return null;
  return (
    <ul className="ex-destaques" aria-label="Destaques das outras fontes">
      {todos.slice(0, max).map((d) => (
        <li key={`${d.fonte}:${d.rotulo}`} title={d.fonte}>
          <Pill label={`${d.rotulo}: ${d.valor}`} tone={TOM[d.tom ?? 'info']} />
        </li>
      ))}
    </ul>
  );
}

function Fonte({ f }: { f: ResultadoFonte }) {
  return (
    <section>
      <h3 className="iv-section-label">{f.nome}</h3>
      {f.observacao && <p className="in-muted-p">{f.observacao}</p>}
      {f.destaques.length > 0 && (
        <p className="ex-chips">{f.destaques.map((d) => <Pill key={d.rotulo} label={`${d.rotulo}: ${d.valor}`} tone={TOM[d.tom ?? 'info']} />)}</p>
      )}
      {f.secoes.map((s) => (
        <div key={s.titulo} className="ex-fonte-secao">
          <h4 className="ex-fonte-secao__titulo">{s.titulo}</h4>
          {s.itens.length === 0 ? <p className="in-muted-p">{s.vazio ?? 'Nada encontrado.'}</p> : (
            <ul className="ex-lista ex-lista--fonte">
              {s.itens.map((i, n) => (
                <li key={`${i.texto}:${n}`} data-tom={i.tom}>
                  {i.link ? <a href={i.link} target="_blank" rel="noreferrer noopener" className="ex-quebra">{i.texto}</a> : <span className="ex-quebra">{i.texto}</span>}
                  {i.detalhe && <span className="iv-muted"> · {i.detalhe}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

/** Seções das fontes extras na ficha do alvo, mais a lista das fontes desligadas por falta de chave. */
export function FontesExtras({ resultado }: { resultado: ResultadoExposicao }) {
  return (
    <>
      {(resultado.extras ?? []).map((f) => <Fonte key={f.fonte} f={f} />)}
      {!!resultado.desligadas?.length && (
        <section>
          <h3 className="iv-section-label">Fontes desligadas</h3>
          <p className="in-muted-p">Estas fontes são opcionais e precisam de uma chave no servidor (Coolify):</p>
          <ul className="ex-lista">
            {resultado.desligadas.map((d) => <li key={d.fonte}><strong>{d.nome}</strong>: falta {d.faltando.join(', ')}</li>)}
          </ul>
        </section>
      )}
    </>
  );
}
