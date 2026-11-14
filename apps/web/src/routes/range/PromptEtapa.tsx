import { useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { InputTextarea } from 'primereact/inputtextarea';
import type { RangeChecklistItem } from '@seginfo/shared';
import { getPromptEditado, savePromptEditado } from '@/services/range';
import { faltandoNoPrompt, montarPrompt, preencher, type LabVars } from '@/services/rangePrompt';
import { PEDIDOS_GERAIS } from '@/data/rangeLab';
import { copyToClipboard } from '@/lib/clipboard';

/** Prompt pronto da etapa: pedidos rápidos, pedido livre, edição à mão e cópia. */
export function PromptEtapa({ item, vars, onAbrirLab }: { item: RangeChecklistItem; vars: LabVars; onAbrirLab: () => void }) {
  const [marcados, setMarcados] = useState<string[]>([]);
  const [pedidoLivre, setPedidoLivre] = useState('');
  const [editado, setEditado] = useState<string | undefined>(() => getPromptEditado(item.id));
  const [copiado, setCopiado] = useState(false);

  const pedidos = [...(item.prompt?.pedidos ?? []), ...PEDIDOS_GERAIS];
  const gerado = useMemo(
    () => montarPrompt(item, vars, { pedidos: marcados.map((p) => preencher(p, vars)), pedidoLivre }),
    [item, vars, marcados, pedidoLivre],
  );
  const faltando = useMemo(() => faltandoNoPrompt(item, vars), [item, vars]);
  const texto = editado ?? gerado;

  const alternar = (pedido: string) => setMarcados((atual) => (atual.includes(pedido) ? atual.filter((p) => p !== pedido) : [...atual, pedido]));
  function editar(novo: string) {
    const valor = novo === gerado ? undefined : novo;
    savePromptEditado(item.id, valor);
    setEditado(valor);
  }
  function copiar() {
    copyToClipboard(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="pr-form">
      {faltando.length > 0 && (
        <div className="pr-destaque tone-warning">
          <i className="pi pi-exclamation-triangle" aria-hidden="true" />
          <span>
            Faltam {faltando.length} dados do seu lab neste prompt (aparecem como [PREENCHER]).{' '}
            <button type="button" className="iv-linkbtn" onClick={onAbrirLab}>Preencher em “Configurar meu ambiente”</button>
          </span>
        </div>
      )}

      {editado === undefined ? (
        <>
          <fieldset className="pr-pedidos">
            <legend>Acrescentar pedidos (opcional)</legend>
            {pedidos.map((p) => (
              <label key={p} className="pr-check">
                <Checkbox checked={marcados.includes(p)} onChange={() => alternar(p)} />
                <span>{preencher(p, vars)}</span>
              </label>
            ))}
          </fieldset>
          <label>Seu pedido (opcional)
            <InputTextarea value={pedidoLivre} rows={2} autoResize onChange={(e) => setPedidoLivre(e.target.value)}
              placeholder="Ex.: quero fazer tudo pela interface gráfica; ou: já criei a VLAN, falta só o trunk." />
          </label>
        </>
      ) : (
        <p className="pr-vazio">
          Você editou este prompt à mão; a versão editada fica salva neste navegador. Restaure o gerado para voltar a usar
          os pedidos rápidos e os dados do seu ambiente.
        </p>
      )}

      <label>Prompt (pode editar antes de copiar)
        <InputTextarea className="pr-prompt" value={texto} rows={16} onChange={(e) => editar(e.target.value)} />
      </label>
      <div className="iv-row iv-wrap">
        <Button label={copiado ? 'Copiado' : 'Copiar prompt'} icon={copiado ? 'pi pi-check' : 'pi pi-copy'} size="small" onClick={copiar} />
        {editado !== undefined && <Button label="Restaurar o gerado" icon="pi pi-refresh" size="small" outlined onClick={() => editar(gerado)} />}
        <span className="pr-status" role="status" aria-live="polite">{copiado ? 'Prompt copiado para a área de transferência.' : ''}</span>
      </div>
    </div>
  );
}
