import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import type { AvaliacaoResultado } from '@seginfo/shared';
import { addAvaliacao, erroApi } from '@/services/agentes';

const RESULTADO_OPTS = [
  { label: 'Ok: atendeu ao critério', value: 'ok' },
  { label: 'Parcial', value: 'parcial' },
  { label: 'Falha', value: 'falha' },
];

/** Formulário curto para registrar o resultado de um caso de teste do agente. */
export function RegistrarCaso({ agenteId, onRegistrado }: { agenteId: string | null; onRegistrado?: (resumo: string) => void }) {
  const qc = useQueryClient();
  const [caso, setCaso] = useState('');
  const [criterio, setCriterio] = useState('');
  const [resultado, setResultado] = useState<AvaliacaoResultado>('ok');
  const [latencia, setLatencia] = useState<number | null>(null);
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function registrar() {
    if (!agenteId) return;
    if (!caso.trim()) { setErro('Descreva o que você pediu ao agente.'); return; }
    setSalvando(true); setErro('');
    try {
      await addAvaliacao(agenteId, {
        caso: caso.trim(), criterio, resultado, observacao,
        ...(latencia !== null ? { latenciaMs: Math.round(latencia) } : {}),
      });
      onRegistrado?.(caso.trim());
      setCaso(''); setCriterio(''); setObservacao(''); setLatencia(null); setResultado('ok');
      qc.invalidateQueries({ queryKey: ['agente-avaliacoes', agenteId] });
      qc.invalidateQueries({ queryKey: ['agentes'] });
    } catch (e) {
      setErro(erroApi(e, 'Falha ao registrar o teste.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="ag-form" onSubmit={(e) => { e.preventDefault(); registrar(); }} aria-label="Registrar um caso de teste">
      <InputTextarea rows={2} value={caso} onChange={(e) => setCaso(e.target.value)} maxLength={2000} className="ag-largo"
        placeholder="O que você pediu ao agente (entrada do teste) *" aria-label="Entrada do teste" aria-required="true" aria-invalid={!!erro && !caso.trim()} />
      <InputTextarea rows={2} value={criterio} onChange={(e) => setCriterio(e.target.value)} maxLength={2000} className="ag-largo"
        placeholder="Critério: como seria uma boa resposta?" aria-label="Critério" />
      <div className="ag-form__linha">
        <Dropdown value={resultado} options={RESULTADO_OPTS} onChange={(e) => setResultado(e.value)} aria-label="Resultado" />
        <InputNumber value={latencia} onValueChange={(e) => setLatencia(e.value ?? null)} suffix=" ms" min={0} max={600000}
          placeholder="Latência (opcional)" aria-label="Latência em milissegundos" />
        <InputText value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={2000} className="ag-cresce"
          placeholder="Observação (o que errou, o que ajustar)" aria-label="Observação" />
        <Button type="submit" label="Registrar" icon="pi pi-plus" loading={salvando} disabled={!agenteId} />
      </div>
      {erro && <Message severity="error" text={erro} className="ag-largo" />}
    </form>
  );
}
