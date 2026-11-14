import type { FerramentaCatalogo } from '@seginfo/shared';
import { ClickCard } from '@/components/ui/ClickCard';
import { Pill } from '@/components/InfraKit';
import { FASE_FERRAMENTA_LABEL } from '@/theme/status';
import { DominioPill } from '../pratica/Blocos';
import type { ResumoFerramenta } from './resumo';

interface Props {
  ferramenta: FerramentaCatalogo;
  resumo: ResumoFerramenta;
  selected: boolean;
  onOpen: () => void;
}

/** Cartão da ferramenta: domínio, nome, para que serve e um rodapé com o que a ficha detalha. */
export function FerramentaCard({ ferramenta: f, resumo, selected, onOpen }: Props) {
  return (
    <ClickCard className="pr-card" onOpen={onOpen} selected={selected} tone={resumo.pendencias > 0 ? 'warning' : undefined}
      label={`Abrir ficha da ferramenta ${f.nome}`}>
      <div className="pr-card__top">
        <DominioPill dominio={f.dominio} />
        {f.kali && <Pill label="Kali" icon="pi-desktop" />}
      </div>
      <h3 className="pr-card__title">{f.nome}</h3>
      <p className="pr-card__desc">{f.descricao}</p>
      <ul className="pr-card__meta" aria-label="Resumo da ferramenta">
        <li><i className="pi pi-sitemap" aria-hidden="true" />{FASE_FERRAMENTA_LABEL[f.fase]}</li>
        {resumo.labs > 0 && <li><i className="pi pi-play-circle" aria-hidden="true" />{resumo.labs} {resumo.labs === 1 ? 'lab' : 'labs'}</li>}
        {resumo.alvos > 0 && <li><i className="pi pi-shield" aria-hidden="true" />no Range</li>}
        {resumo.registros > 0 && <li><i className="pi pi-book" aria-hidden="true" />{resumo.registros} {resumo.registros === 1 ? 'registro' : 'registros'}</li>}
        {resumo.pendencias > 0 && <li className="pr-alerta"><i className="pi pi-exclamation-circle" aria-hidden="true" />{resumo.pendencias} {resumo.pendencias === 1 ? 'pendência' : 'pendências'}</li>}
      </ul>
    </ClickCard>
  );
}
