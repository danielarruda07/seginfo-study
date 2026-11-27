import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from 'primereact/button';
import { COMANDOS, COMO_USAR_POR_ROTA, FERRAMENTAS, type Comando } from '@/routes/conhecimento/ajuda';

function CopiarBotao({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button icon={ok ? 'pi pi-check' : 'pi pi-copy'} text rounded size="small" aria-label={`Copiar: ${rotulo}`}
      onClick={() => { void navigator.clipboard.writeText(texto).then(() => { setOk(true); window.setTimeout(() => setOk(false), 1500); }).catch(() => undefined); }} />
  );
}

/** Comandos prontos com botão de copiar (usado na Ajuda e no rodapé das ferramentas). */
export function BlocoComandos({ comandos }: { comandos: Comando[] }) {
  if (!comandos.length) return null;
  return (
    <div style={{ display: 'grid', gap: '0.5rem', margin: '0.4rem 0' }}>
      {comandos.map((c) => (
        <div key={c.rotulo}>
          <div className="iv-row" style={{ gap: '0.4rem', alignItems: 'center' }}>
            <span className="iv-muted" style={{ fontSize: '0.85rem' }}><strong>{c.shell}</strong> · {c.rotulo}</span>
            <CopiarBotao texto={c.codigo} rotulo={c.rotulo} />
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, padding: '0.5rem 0.6rem', borderRadius: 6, background: 'var(--surface-ground, rgba(127,127,127,.08))', fontSize: '0.82rem' }}>{c.codigo}</pre>
        </div>
      ))}
    </div>
  );
}

/** Seção "Como usar" no fim da página da ferramenta; o conteúdo vem de routes/conhecimento/ajuda.ts. */
export function ComoUsar({ rota }: { rota: string }) {
  const ids = COMO_USAR_POR_ROTA[rota] ?? [];
  const itens = ids.map((id) => FERRAMENTAS.find((f) => f.id === id)).filter((f): f is NonNullable<typeof f> => Boolean(f));
  if (!itens.length) return null;
  return (
    <section className="iv-card iv-mt" aria-labelledby={`como-usar-${rota}`} style={{ padding: '0.9rem 1rem' }}>
      <h2 id={`como-usar-${rota}`} className="iv-section-label" style={{ marginTop: 0 }}>
        <i className="pi pi-question-circle" aria-hidden="true" /> Como usar
      </h2>
      {itens.map((f) => (
        <details key={f.id} style={{ borderTop: '1px solid var(--surface-border, #ddd)', padding: '0.5rem 0' }}>
          <summary style={{ cursor: 'pointer' }}><strong>{f.nome}</strong></summary>
          <p style={{ margin: '0.4rem 0' }}>{f.resumo}</p>
          <ol style={{ margin: '0.25rem 0 0.4rem 1.2rem' }}>{f.passos.map((p) => <li key={p}>{p}</li>)}</ol>
          <BlocoComandos comandos={COMANDOS[f.id] ?? []} />
          {f.limites.length > 0 && (
            <ul className="iv-muted" style={{ margin: '0.25rem 0 0 1.2rem' }}>{f.limites.map((l) => <li key={l}>{l}</li>)}</ul>
          )}
        </details>
      ))}
      <p className="iv-muted" style={{ marginBottom: 0 }}>
        Guia completo com roteiros de teste: <Link to="/ajuda">Conhecimento → Ajuda e guia de uso</Link>.
      </p>
    </section>
  );
}
