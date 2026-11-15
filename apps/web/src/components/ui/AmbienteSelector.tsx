import { SelectButton } from 'primereact/selectbutton';
import { AMBIENTES } from '@/services/ambiente';
import type { AmbienteFiltro } from '@seginfo/shared';
export function AmbienteSelector({ value, onChange }: { value: AmbienteFiltro; onChange: (v: AmbienteFiltro) => void }) {
  return <div className="iv-card iv-mt"><div className="iv-row iv-wrap" style={{ gap: '.75rem' }}>
    <strong>Ambiente monitorado</strong>
    <SelectButton value={value} options={AMBIENTES} allowEmpty={false} aria-label="Ambiente monitorado" onChange={(e) => { if (e.value) onChange(e.value); }} />
  </div></div>;
}
