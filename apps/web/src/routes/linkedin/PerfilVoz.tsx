import { useState } from 'react';
import { SelectButton } from 'primereact/selectbutton';
import { Inspiracoes } from './Inspiracoes';
import { PerfilPro } from './PerfilPro';
import { VozAprendida } from './VozAprendida';

const SECOES = [
  { value: 'perfil', label: 'Perfil profissional' },
  { value: 'inspiracoes', label: 'Inspirações' },
  { value: 'voz', label: 'Minha voz' },
] as const;

/**
 * Aba "Perfil & Voz": os fatos sobre você (certificações, cursos, trajetória, vagas-alvo),
 * as referências que você admira e o estilo de escrita que a IA aprende com os dois.
 */
export function PerfilVoz() {
  const [secao, setSecao] = useState<(typeof SECOES)[number]['value']>('perfil');
  return (
    <div className="iv-col iv-gap">
      <SelectButton value={secao} options={[...SECOES]} allowEmpty={false} onChange={(e) => setSecao(e.value)} aria-label="Seção do perfil" />
      <div hidden={secao !== 'perfil'}><PerfilPro /></div>
      <div hidden={secao !== 'inspiracoes'}><Inspiracoes /></div>
      <div hidden={secao !== 'voz'}><VozAprendida /></div>
    </div>
  );
}
