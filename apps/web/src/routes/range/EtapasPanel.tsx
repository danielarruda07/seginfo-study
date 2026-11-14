import { useMemo, useState, type ReactNode } from 'react';
import { SelectButton } from 'primereact/selectbutton';
import { Button } from 'primereact/button';
import type { RangeChecklistItem, RangeProgressoItem } from '@seginfo/shared';
import { ActiveFiltersBar } from '@/components/ui/ActiveFiltersBar';
import { Bar, Chip, EmptyState } from '@/components/InfraKit';
import { useDrawerSelection } from '@/hooks/useDrawerSelection';
import { GRUPO_CHECKLIST_LABEL } from '@/theme/status';
import type { LabVars } from '@/services/rangePrompt';
import { barraTone, pct } from '../pratica/relacoes';
import { FILTRO_FEITO_OPTS, type FiltroFeito, type Progresso } from './meta';
import { EtapaCard } from './EtapaCard';
import { EtapaDrawer } from './EtapaDrawer';

interface Props {
  itens: RangeChecklistItem[];
  progresso: Progresso;
  vars: LabVars;
  /** grupos oferecidos como filtro (vazio = sem filtro de grupo) */
  grupos?: RangeChecklistItem['grupo'][];
  /** aviso no topo (ex.: pré-requisito dos exercícios) */
  aviso?: ReactNode;
  rotulo: string;
  onSave: (id: string, p: RangeProgressoItem) => void;
  onAbrirLab: () => void;
}

const VAZIO: RangeProgressoItem = { concluido: false, notas: '' };

/** Lista de etapas do Range (preparação ou exercícios) com progresso, filtros e ficha lateral. */
export function EtapasPanel({ itens, progresso, vars, grupos = [], aviso, rotulo, onSave, onAbrirLab }: Props) {
  const [grupo, setGrupo] = useState<RangeChecklistItem['grupo'] | undefined>();
  const [feito, setFeito] = useState<FiltroFeito>('todas');
  const p = (id: string) => progresso[id] ?? VAZIO;
  const concluidas = itens.filter((i) => p(i.id).concluido).length;
  const porcento = pct(concluidas, itens.length);

  const lista = useMemo(() => itens.filter((i) => (!grupo || i.grupo === grupo) &&
    (feito === 'todas' || (feito === 'concluidas') === !!progresso[i.id]?.concluido)), [itens, grupo, feito, progresso]);
  const sel = useDrawerSelection(lista);
  const limpar = () => { setGrupo(undefined); setFeito('todas'); };

  return (
    <div>
      {aviso}
      <div className="pr-barra">
        <span className="tabular"><strong>{concluidas} de {itens.length}</strong> {rotulo} concluídas ({porcento}%)</span>
        <Bar pct={porcento} tone={barraTone(porcento)} />
      </div>

      <div className="iv-toolbar pr-toolbar iv-mt">
        {grupos.length > 0 && (
          <div className="iv-row iv-wrap" role="group" aria-label="Filtrar por grupo">
            <Chip label="Todos" active={!grupo} onClick={() => setGrupo(undefined)} />
            {grupos.map((g) => <Chip key={g} label={GRUPO_CHECKLIST_LABEL[g]} active={grupo === g} onClick={() => setGrupo(grupo === g ? undefined : g)} />)}
          </div>
        )}
        <SelectButton value={feito} options={FILTRO_FEITO_OPTS} onChange={(e) => e.value && setFeito(e.value)} allowEmpty={false} aria-label="Mostrar" />
        <span className="iv-toolbar__count">{lista.length} de {itens.length}</span>
      </div>
      <ActiveFiltersBar onClearAll={limpar} filters={[
        grupo && { key: 'grupo', label: GRUPO_CHECKLIST_LABEL[grupo], onRemove: () => setGrupo(undefined) },
        feito !== 'todas' && { key: 'feito', label: feito === 'pendentes' ? 'Pendentes' : 'Concluídas', onRemove: () => setFeito('todas') },
      ]} />

      {lista.length === 0 ? (
        <EmptyState icon={feito === 'pendentes' ? 'pi-check-circle' : 'pi-filter-slash'}
          title={feito === 'pendentes' ? `Nenhuma pendência: todas as ${rotulo} deste filtro estão concluídas` : 'Nada com estes filtros'}
          action={<Button label="Ver todas" text onClick={limpar} />} />
      ) : (
        <ul className="pr-list">
          {lista.map((item) => (
            <EtapaCard key={item.id} item={item} progresso={p(item.id)} selected={sel.isOpen(item.id)}
              onOpen={() => sel.open(item.id)} onToggle={(c) => onSave(item.id, { ...p(item.id), concluido: c })} />
          ))}
        </ul>
      )}

      {sel.item && (
        <EtapaDrawer item={sel.item} progresso={p(sel.item.id)} vars={vars} nav={sel.nav}
          onSave={(np) => onSave(sel.item!.id, np)} onAbrirLab={() => { sel.nav.onClose(); onAbrirLab(); }} />
      )}
    </div>
  );
}
