import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from 'primereact/skeleton';
import { Pill } from '@/components/InfraKit';
import { listAgentesCompletos } from '@/services/agentes';
import type { Meta } from '../regras';

/** Peças pequenas repetidas nas fichas laterais da seção Agents. */

export const MetaPill = ({ m }: { m: Meta }) => <Pill label={m.rotulo} tone={m.tone} icon={m.icon} />;

/** Bloco de código legível nos dois temas (só variáveis). */
export function Codigo({ texto, rotulo }: { texto: string; rotulo: string }) {
  if (!texto.trim()) return <p className="agd-vazio">Vazio.</p>;
  return <pre className="agd-code" tabIndex={0} aria-label={rotulo}>{texto}</pre>;
}

export function Secao({ titulo, aside, children }: { titulo: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="agd-secao__topo">
        <h3 className="iv-section-label">{titulo}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export const Vazio = ({ children }: { children: ReactNode }) => <p className="agd-vazio">{children}</p>;

export function Linhas({ n = 3 }: { n?: number }) {
  return (
    <div className="iv-col" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: n }, (_, i) => <Skeleton key={i} height="1.1rem" width={`${90 - i * 12}%`} />)}
    </div>
  );
}

/** Projetos completos de todos os agentes; só busca quando uma ficha precisa (enabled). */
export const useAgentesCompletos = (enabled: boolean) =>
  useQuery({ queryKey: ['agentes-completos'], queryFn: listAgentesCompletos, enabled, staleTime: 60_000 });
