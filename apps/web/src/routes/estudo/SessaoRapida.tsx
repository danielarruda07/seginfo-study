import { useId, useState } from 'react';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { addSessao } from '@/services/sessoes';
import { todayISO } from '@/services/store';
import { formatarMinutos } from './regras';
import { useInvalidarEstudo } from './dados';

/** Registro rápido de sessão já ligado à trilha/tópico da ficha aberta. */
export function SessaoRapida({ trilhaId, topicoId }: { trilhaId?: string; topicoId?: string }) {
  const id = useId();
  const invalidar = useInvalidarEstudo();
  const [data, setData] = useState(todayISO);
  const [minutos, setMinutos] = useState<number | null>(30);
  const [nota, setNota] = useState('');
  const [aviso, setAviso] = useState('');

  function registrar() {
    if (!minutos || minutos <= 0) { setAviso('Informe a duração em minutos.'); return; }
    addSessao({ data, minutos, trilhaId, topicoId, nota: nota.trim() });
    setAviso(`Sessão de ${formatarMinutos(minutos)} registrada.`);
    setNota('');
    invalidar();
  }

  return (
    <form className="es-quick" onSubmit={(e) => { e.preventDefault(); registrar(); }}>
      <label htmlFor={`${id}-data`}>Data<InputText id={`${id}-data`} type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label htmlFor={`${id}-min`}>Duração<InputNumber inputId={`${id}-min`} value={minutos} onValueChange={(e) => setMinutos(e.value ?? null)} suffix=" min" min={1} max={1440} /></label>
      <label htmlFor={`${id}-nota`} className="es-quick__nota">O que estudou<InputText id={`${id}-nota`} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: li a documentação e fiz o lab" /></label>
      <Button type="submit" label="Registrar sessão" icon="pi pi-plus" size="small" outlined />
      <small className="es-quick__aviso" role="status">{aviso}</small>
    </form>
  );
}
