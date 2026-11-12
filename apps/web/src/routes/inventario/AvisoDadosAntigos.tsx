import { useState } from 'react';
import { Button } from 'primereact/button';
import { StatusStrip } from '@/components/InfraKit';

const KEY = 'seginfo.inventario.aviso-seed-lido';
const lido = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Aviso de privacidade sobre dados de versões antigas; some depois de "Entendi". */
export function AvisoDadosAntigos() {
  const [oculto, setOculto] = useState(lido);
  if (oculto) return null;
  function fechar() {
    try { localStorage.setItem(KEY, '1'); } catch { /* sem storage: volta na próxima visita */ }
    setOculto(true);
  }
  return (
    <StatusStrip tone="warn" icon="pi-exclamation-triangle">
      <span className="iv-row iv-wrap" style={{ justifyContent: 'space-between', width: '100%' }}>
        <span>Dados salvos por versões antigas continuam neste navegador. Revise endereços e nomes antes de publicar ou sincronizar.</span>
        <Button label="Entendi" text size="small" onClick={fechar} />
      </span>
    </StatusStrip>
  );
}
