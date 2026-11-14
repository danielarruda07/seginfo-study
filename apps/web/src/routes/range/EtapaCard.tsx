import { Checkbox } from 'primereact/checkbox';
import type { RangeChecklistItem, RangeProgressoItem } from '@seginfo/shared';
import { ClickCard } from '@/components/ui/ClickCard';
import { Pill } from '@/components/InfraKit';
import { DominioPill } from '../pratica/Blocos';
import { CRITICIDADE_META, dataBR, toneEtapa } from '../pratica/relacoes';

interface Props {
  item: RangeChecklistItem;
  progresso: RangeProgressoItem;
  selected: boolean;
  onOpen: () => void;
  onToggle: (concluido: boolean) => void;
}

/** Linha do checklist do Range: marca direto pela caixa; o resto do cartão abre a ficha com passos e prompt. */
export function EtapaCard({ item, progresso, selected, onOpen, onToggle }: Props) {
  const crit = CRITICIDADE_META[item.criticidade];
  const recursos = (item.recursos ?? []).length;
  return (
    <ClickCard as="li" className={progresso.concluido ? 'pr-etapa pr-etapa--feita' : 'pr-etapa'} onOpen={onOpen} selected={selected} tone={toneEtapa(item.criticidade, progresso.concluido)}
      label={`Abrir passos e prompt de ${item.titulo}`}>
      <Checkbox checked={progresso.concluido} onChange={(e) => onToggle(!!e.checked)} aria-label={`Marcar "${item.titulo}" como concluída`} />
      <div className="pr-etapa__texto">
        <strong>{item.titulo}</strong>
        <span className="pr-etapa__desc">{item.descricao}</span>
        <small>
          {item.passos.length} passos{recursos > 0 && ` · ${recursos} ${recursos === 1 ? 'recurso a criar' : 'recursos a criar'}`}{item.prompt && ' · prompt pronto para IA'}
          {progresso.concluidoEm && ` · concluída em ${dataBR(progresso.concluidoEm)}`}
        </small>
      </div>
      <div className="pr-etapa__selos">
        <DominioPill dominio={item.dominio} />
        {!progresso.concluido && <Pill label={crit.label} tone={crit.tone} />}
        {progresso.concluido && <Pill label="Concluída" tone="ok" icon="pi-check" />}
      </div>
    </ClickCard>
  );
}
