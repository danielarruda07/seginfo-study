import { useMemo } from 'react';
import type { PostPublicado, ProjetoLinkedin } from '@seginfo/shared';
import { Chip } from '@/components/InfraKit';
import { desempenhoPor, nomeDoProjeto, type DesempenhoGrupo } from './pipelineRegras';
import type { ResumoPublicados } from './regras';

function Ranking({ titulo, grupos }: { titulo: string; grupos: DesempenhoGrupo[] }) {
  const maior = grupos[0]?.taxaMedia || 1;
  return (
    <div>
      <h4 className="ca-h4">{titulo}</h4>
      <ul className="lp-ranking">
        {grupos.map((g) => (
          <li key={g.grupo}>
            <span className="lp-ranking__nome">{g.grupo} <span className="iv-muted">({g.posts} posts)</span></span>
            <span className="lp-ranking__barra" aria-hidden="true"><span style={{ width: `${Math.max(4, (g.taxaMedia / maior) * 100)}%` }} /></span>
            <strong className="tabular">{g.taxaMedia.toLocaleString('pt-BR')}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Resumo acima da lista de publicados: equilíbrio dos pilares (filtro) e o que rende mais. */
export function PublicadosResumo({ posts, projetos, resumo, filtroPilar, onPilar }: {
  posts: PostPublicado[]; projetos: ProjetoLinkedin[]; resumo: ResumoPublicados;
  filtroPilar?: string; onPilar: (pilar?: string) => void;
}) {
  const porFormato = useMemo(() => desempenhoPor(posts, (p) => p.formato), [posts]);
  const porProjeto = useMemo(() => desempenhoPor(posts, (p) => nomeDoProjeto(projetos, p.projetoId)), [posts, projetos]);
  return (
    <>
      {resumo.analisados > 0 && (
        <div className="iv-card iv-mt">
          <h3 className="iv-section-label">Equilíbrio dos pilares · clique para filtrar</h3>
          <div className="iv-row iv-wrap">
            <Chip label={`Todos (${posts.length})`} active={!filtroPilar} onClick={() => onPilar(undefined)} />
            {resumo.porPilar.map(([p, n]) => <Chip key={p} label={`${p} (${n})`} active={filtroPilar === p} onClick={() => onPilar(filtroPilar === p ? undefined : p)} />)}
          </div>
          {resumo.esquecidos.length > 0 && (
            <p className="iv-muted ca-small ca-mb0"><i className="pi pi-lightbulb" aria-hidden="true" /> Pilar sem nenhum post: <strong>{resumo.esquecidos.join(', ')}</strong>. Um bom candidato para o próximo.</p>
          )}
        </div>
      )}
      {(porFormato.length > 0 || porProjeto.length > 0) && (
        <div className="iv-card iv-mt">
          <h3 className="iv-section-label">O que rende mais · taxa média de engajamento</h3>
          <div className="linkedin-analise__grid">
            {porFormato.length > 0 && <Ranking titulo="Por formato" grupos={porFormato} />}
            {porProjeto.length > 0 && <Ranking titulo="Por projeto" grupos={porProjeto} />}
          </div>
          <p className="iv-muted ca-small ca-mb0">Só entram grupos com 2 ou mais posts com impressões anotadas. Com poucos posts é indício, não regra: mude uma variável por vez.</p>
        </div>
      )}
    </>
  );
}
