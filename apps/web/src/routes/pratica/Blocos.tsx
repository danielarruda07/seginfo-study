import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { Lab } from '@seginfo/shared';
import { Pill } from '@/components/InfraKit';
import { DOMINIO_LAB } from '@/theme/status';
import '@/styles/telas/pratica.css';

/** Peças comuns às fichas das telas de Prática (Labs, Range, Arsenal). */

export function DominioPill({ dominio }: { dominio: Lab['dominio'] }) {
  return <Pill label={DOMINIO_LAB[dominio].label} color={DOMINIO_LAB[dominio].color} />;
}

/** Seção da ficha lateral: <section> ganha a linha divisória do .iv-drawer. */
export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="iv-section-label">{titulo}</h3>
      {children}
    </section>
  );
}

/** Lista de itens relacionados (nome + linha secundária + selo à direita) ou frase de vazio. */
export function ListaRelacionados<T>({ itens, vazio, chave, nome, sub, aside }: {
  itens: readonly T[];
  vazio: string;
  chave: (i: T) => string;
  nome: (i: T) => ReactNode;
  sub?: (i: T) => ReactNode;
  aside?: (i: T) => ReactNode;
}) {
  if (itens.length === 0) return <p className="pr-vazio">{vazio}</p>;
  return (
    <ul className="pr-rel">
      {itens.map((i) => (
        <li key={chave(i)}>
          <span className="pr-rel__nome"><span>{nome(i)}</span>{sub && <small>{sub(i)}</small>}</span>
          {aside?.(i)}
        </li>
      ))}
    </ul>
  );
}

/** Técnicas ATT&CK como links para a matriz. */
export function TecnicasAttack({ ids, vazio = 'Nenhuma técnica mapeada.' }: { ids: readonly string[]; vazio?: string }) {
  if (ids.length === 0) return <p className="pr-vazio">{vazio}</p>;
  return (
    <div className="pr-pills">
      {ids.map((t) => <Link key={t} to="/attack" className="iv-pill mono" title={`Ver ${t} na matriz ATT&CK`}>{t}</Link>)}
    </div>
  );
}
