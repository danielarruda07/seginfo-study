import { useId } from 'react';
import type { EtapaFluxo, FaseAtaque } from '@/data/didaticaAtaques';
import { faseLabel } from '@/data/didaticaAtaques';

const ICONE: Record<FaseAtaque, string> = {
  inicio: 'pi-sign-in',
  ampliacao: 'pi-share-alt',
  impacto: 'pi-exclamation-triangle',
};

/**
 * Organograma simples do ataque: como começa, como se amplia por dentro e qual o
 * impacto. Didático para quem não é da área. Vertical no celular, em linha no desktop.
 */
export function FluxoAtaque({ etapas }: { etapas: EtapaFluxo[] }) {
  const tituloId = useId();
  if (!etapas.length) return null;
  return (
    <section aria-labelledby={tituloId}>
      <h3 id={tituloId} className="iv-section-label">Como esse ataque se desenrola</h3>
      <ol className="in-fluxo" role="list">
        {etapas.map((e, i) => (
          <li key={e.fase + i} className={`in-fluxo__etapa in-fluxo__etapa--${e.fase}`}>
            <div className="in-fluxo__cabeca">
              <span className="in-fluxo__icone" aria-hidden="true"><i className={`pi ${ICONE[e.fase]}`} /></span>
              <span className="in-fluxo__fase">{faseLabel(e.fase)}</span>
            </div>
            <strong className="in-fluxo__titulo">{e.titulo}</strong>
            <p className="in-fluxo__texto">{e.texto}</p>
            {i < etapas.length - 1 && <span className="in-fluxo__seta" aria-hidden="true"><i className="pi pi-arrow-right" /></span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
