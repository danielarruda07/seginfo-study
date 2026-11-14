import type { Lab } from '@seginfo/shared';
import { ClickCard } from '@/components/ui/ClickCard';
import { Pill } from '@/components/InfraKit';
import type { ProgressoLab } from '@/services/inventario';
import { DominioPill } from '../pratica/Blocos';
import { NIVEL_LABEL, dataBR } from '../pratica/relacoes';
import { ESTADO_LAB_META } from './estado';

interface Props {
  lab: Lab;
  progresso: ProgressoLab;
  exercicios: number;
  lacuna: boolean;
  selected: boolean;
  onOpen: () => void;
}

/** Cartão do lab: estado, título, objetivo e um rodapé com o que a ficha detalha. */
export function LabCard({ lab, progresso, exercicios, lacuna, selected, onOpen }: Props) {
  const estado = ESTADO_LAB_META[progresso.status];
  return (
    <ClickCard className="pr-card" onOpen={onOpen} selected={selected} tone={lacuna ? 'warning' : undefined}
      label={`Abrir ficha do lab ${lab.titulo}`}>
      <div className="pr-card__top">
        <DominioPill dominio={lab.dominio} />
        <span className="iv-row iv-wrap">
          <Pill label={NIVEL_LABEL[lab.nivel]} />
          <Pill label={estado.label} tone={estado.tone} icon={estado.icon} />
        </span>
      </div>
      <h3 className="pr-card__title">{lab.titulo}</h3>
      <p className="pr-card__desc">{lab.objetivo}</p>
      <ul className="pr-card__meta" aria-label="Resumo do lab">
        <li><i className="pi pi-list" aria-hidden="true" />{lab.passos.length} passos</li>
        <li><i className="pi pi-server" aria-hidden="true" />{lab.ativosAlvo.length} {lab.ativosAlvo.length === 1 ? 'ativo' : 'ativos'}</li>
        {exercicios > 0 && <li><i className="pi pi-sync" aria-hidden="true" />{exercicios} Red × Blue</li>}
        {lacuna && <li className="pr-alerta"><i className="pi pi-exclamation-triangle" aria-hidden="true" />lacuna de detecção</li>}
        {progresso.concluidoEm && <li><i className="pi pi-check" aria-hidden="true" />{dataBR(progresso.concluidoEm)}</li>}
      </ul>
    </ClickCard>
  );
}
