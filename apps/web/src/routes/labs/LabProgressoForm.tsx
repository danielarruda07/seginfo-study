import { useState } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import type { EstadoLab, ProgressoLab } from '@/services/inventario';
import { ESTADO_LAB_OPTS } from './estado';

/** Campos de progresso do lab; salvam a cada alteração (ficam só neste navegador). */
export function LabProgressoForm({ progresso, onSave }: { progresso: ProgressoLab; onSave: (p: ProgressoLab) => void }) {
  // texto livre local: dividir a cada tecla impediria digitar a vírgula
  const [mitre, setMitre] = useState(progresso.mitre.join(', '));
  return (
    <div className="pr-form">
      <label>Status
        <Dropdown value={progresso.status} options={ESTADO_LAB_OPTS} onChange={(e) => onSave({ ...progresso, status: e.value as EstadoLab })} />
      </label>
      <label>O que você aprendeu
        <InputTextarea value={progresso.aprendizado} rows={4} autoResize
          onChange={(e) => onSave({ ...progresso, aprendizado: e.target.value })}
          placeholder="Resultados e próximos passos. Sem credenciais ou dados sensíveis." />
      </label>
      <label>Evidência não sensível (nota ou caminho local)
        <InputText value={progresso.evidencia} onChange={(e) => onSave({ ...progresso, evidencia: e.target.value })}
          placeholder="Ex.: relatório local lab-01.md" />
      </label>
      <label>Técnicas ATT&amp;CK extras (separadas por vírgula)
        <InputText value={mitre}
          onChange={(e) => { setMitre(e.target.value); onSave({ ...progresso, mitre: e.target.value.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) }); }}
          placeholder="Ex.: T1110, T1046" />
      </label>
      <small className="iv-muted">Salvo automaticamente neste navegador.</small>
    </div>
  );
}
