import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { listAgentes, listTagsBase } from '@/services/agentes';
import { agentesDasTags, tagsNaBase } from './regras';

/**
 * Seção da ficha que liga as tags do item ao Segundo Cérebro e aos agentes:
 * quais agentes usam alguma dessas tags como base de conhecimento e quantas memórias
 * pessoais já existem com cada tag. Depende da API; offline mostra só uma dica.
 */
export function BaseDosAgentes({ tags, bloqueio, contexto }: {
  tags: readonly string[];
  /** motivo pelo qual este item nunca chega aos agentes (ex.: memória corporativa) */
  bloqueio?: string;
  /** frase curta antes da lista, explicando o vínculo para este tipo de item */
  contexto?: string;
}) {
  const agentes = useQuery({ queryKey: ['agentes'], queryFn: listAgentes, retry: false, staleTime: 60_000 });
  const base = useQuery({ queryKey: ['agentes-base-tags'], queryFn: listTagsBase, retry: false, staleTime: 60_000 });

  const usados = useMemo(() => agentesDasTags(agentes.data ?? [], tags), [agentes.data, tags]);
  const porTag = useMemo(() => tagsNaBase(tags, base.data ?? [], agentes.data ?? []), [tags, base.data, agentes.data]);

  if (bloqueio) return <p className="co-vazio"><i className="pi pi-lock" aria-hidden="true" /> {bloqueio}</p>;
  if (tags.length === 0) return <p className="co-vazio">Sem tags, nenhum agente consegue usar este item. Adicione tags para ligá-lo à base de um agente.</p>;
  if (agentes.isLoading || base.isLoading) return <p className="co-vazio">Consultando os agentes…</p>;
  if (agentes.isError || base.isError) return <p className="co-vazio">Ligue a API para ver quais agentes usam estas tags.</p>;

  return (
    <div className="iv-col co-gap-sm">
      {contexto && <p className="co-nota">{contexto}</p>}
      {usados.length === 0 ? (
        <p className="co-vazio">
          Nenhum agente usa estas tags na base. Escolha uma delas na base de um agente em{' '}
          <Link to="/agents/base">Agentes · Base de conhecimento</Link>.
        </p>
      ) : (
        <ul className="co-rel">
          {usados.map(({ agente, tags: casadas }) => (
            <li key={agente.id}>
              <Link to="/agents/agente/$agenteId" params={{ agenteId: agente.id }} className="co-rel__btn">
                <span className="co-rel__titulo"><i className="pi pi-sitemap" aria-hidden="true" /> {agente.nome}</span>
                <span className="co-rel__sub">usa {casadas.map((t) => `#${t}`).join(' ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="co-nota">
        No Segundo Cérebro (memórias pessoais):{' '}
        {porTag.map((t, i) => (
          <span key={t.tag}>{i > 0 && ' · '}#{t.tag} <strong>{t.memorias}</strong></span>
        ))}
      </p>
    </div>
  );
}
