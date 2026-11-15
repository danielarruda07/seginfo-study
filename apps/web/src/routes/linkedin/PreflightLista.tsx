import type { ItemPreflight } from '@seginfo/shared';

/**
 * Verificação antes de liberar o post. Item que bloqueia e não passou impede aprovar, agendar
 * e publicar; o servidor aplica as mesmas regras, então a tela só antecipa a resposta.
 */
export function PreflightLista({ itens }: { itens: ItemPreflight[] }) {
  return (
    <ul className="linkedin-checklist">
      {itens.map((i) => {
        const icone = i.ok ? 'pi-check-circle ca-ok' : i.bloqueia ? 'pi-ban lp-bloqueio' : 'pi-exclamation-triangle lp-aviso';
        return (
          <li key={i.id}>
            <i className={`pi ${icone}`} aria-hidden="true" />
            <span>
              <strong>{i.label}</strong>
              <span className="ca-sr">{i.ok ? ' (ok)' : i.bloqueia ? ' (bloqueia a aprovação)' : ' (atenção)'}</span>
              {!i.ok && <span className="iv-muted"> — {i.dica}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
