import type { ReactNode } from 'react';
import type { Meta, SessaoEstudo } from '@seginfo/shared';
import { Pill } from '@/components/InfraKit';
import { getTopico, getTrilha, type TopicoComStatus } from '@/services/catalog';
import { estadoMeta, formatarData, formatarMinutos, ordenarSessoes, STATUS_TOPICO } from './regras';

/** Lista compacta da ficha lateral (sem marcadores). */
export function MiniLista({ vazio, children }: { vazio: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className="es-empty-line">{vazio}</p>;
  return <ul className="es-mini">{children}</ul>;
}

/** Sessões mais recentes; `contexto` decide o que aparece como rótulo secundário. */
export function ListaSessoes({ sessoes, limite = 5, contexto }: { sessoes: SessaoEstudo[]; limite?: number; contexto: 'trilha' | 'topico' | 'nenhum' }) {
  const lista = ordenarSessoes(sessoes);
  return (
    <>
      <MiniLista vazio="Nenhuma sessão registrada ainda.">
        {lista.slice(0, limite).map((s) => {
          const ref = contexto === 'trilha' ? getTopico(s.topicoId ?? '')?.titulo : contexto === 'topico' ? undefined : (getTopico(s.topicoId ?? '')?.titulo ?? getTrilha(s.trilhaId ?? '')?.titulo);
          return (
            <li key={s.id} className="es-mini__item">
              <span className="es-mini__main">
                <span>{s.nota || ref || 'Sessão sem anotação'}</span>
                {s.nota && ref && <small>{ref}</small>}
              </span>
              <span className="es-mini__aside tabular">{formatarData(s.data)} · {formatarMinutos(s.minutos)}</span>
            </li>
          );
        })}
      </MiniLista>
      {lista.length > limite && <p className="es-empty-line">+ {lista.length - limite} sessões anteriores na tela Sessões.</p>}
    </>
  );
}

export function ListaMetas({ metas, hoje, onOpen }: { metas: Meta[]; hoje: string; onOpen?: (m: Meta) => void }) {
  return (
    <MiniLista vazio="Nenhuma meta ligada.">
      {metas.map((m) => {
        const e = estadoMeta(m, hoje);
        return (
          <li key={m.id} className="es-mini__item">
            <span className="es-mini__main">
              {onOpen ? <button type="button" className="es-linkbtn" onClick={() => onOpen(m)}>{m.titulo}</button> : <span>{m.titulo}</span>}
              <small className="tabular">Prazo {formatarData(m.prazo)} · {e.texto}</small>
            </span>
            <Pill label={e.label} tone={e.tone} icon={e.icon} />
          </li>
        );
      })}
    </MiniLista>
  );
}

export function ListaTopicos({ topicos, onOpen }: { topicos: TopicoComStatus[]; onOpen?: (t: TopicoComStatus) => void }) {
  return (
    <MiniLista vazio="Nenhum tópico cadastrado.">
      {topicos.map((t) => {
        const s = STATUS_TOPICO[t.status];
        return (
          <li key={t.id} className="es-mini__item">
            <span className="es-mini__main">
              {onOpen ? <button type="button" className="es-linkbtn" onClick={() => onOpen(t)}>{t.titulo}</button> : <span>{t.titulo}</span>}
            </span>
            <Pill label={s.label} tone={s.tone} icon={s.icon} />
          </li>
        );
      })}
    </MiniLista>
  );
}
