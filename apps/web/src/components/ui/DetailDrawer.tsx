import { useEffect, type ReactNode } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { Button } from 'primereact/button';

/**
 * Ficha lateral padrão (docs/UI_GUIDE.md, "Ficha lateral"): Voltar · tipo · "3 de 25" com ↑/↓;
 * selo de estado, título, subtítulo e ações; depois seções (`DetailSection`/`DetailFields`).
 *
 * Uso típico com `useDrawerSelection`:
 *   const sel = useDrawerSelection(lista);
 *   <ClickCard onOpen={() => sel.open(item.id)} label={`Abrir ${item.nome}`}>…</ClickCard>
 *   {sel.item && <DetailDrawer {...sel.nav} kind={{ icon: 'pi-book', label: 'Tópico' }} title={sel.item.nome} …>…</DetailDrawer>}
 */
export interface DetailDrawerProps {
  /** posição do item na lista filtrada; sem `total` a navegação ↑/↓ some */
  index?: number;
  total?: number;
  onIndex?: (i: number) => void;
  onClose: () => void;
  /** tipo do item, à esquerda do topo (ex.: { icon: 'pi-book', label: 'Tópico' }) */
  kind?: { icon: string; label: string };
  /** selo(s) de estado acima do título */
  status?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** botões principais (1 primário, demais outlined) */
  actions?: ReactNode;
  /** nome para leitores de tela, ex.: "Ficha de Kali Linux" */
  ariaLabel: string;
  /** largura maior para conteúdo denso (padrão 42rem) */
  wide?: boolean;
  children?: ReactNode;
}

export function DetailDrawer({ index = 0, total, onIndex, onClose, kind, status, title, subtitle, actions, ariaLabel, wide, children }: DetailDrawerProps) {
  const navegavel = !!onIndex && typeof total === 'number' && total > 1;

  useEffect(() => {
    if (!navegavel) return;
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (alvo.closest('input, textarea, select, [contenteditable], .p-dropdown, .p-inputtext')) return;
      if (e.key === 'ArrowDown' && index < (total as number) - 1) { e.preventDefault(); onIndex!(index + 1); }
      if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); onIndex!(index - 1); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navegavel, index, total, onIndex]);

  return (
    <Sidebar visible position="right" onHide={onClose} className={`iv-drawer${wide ? ' iv-drawer--wide' : ''}`} showCloseIcon={false} aria-label={ariaLabel}>
      <div className="iv-drawer__nav">
        <Button label="Voltar" icon="pi pi-arrow-left" text size="small" onClick={onClose} />
        {kind && <span className="iv-drawer__kind"><i className={`pi ${kind.icon}`} aria-hidden="true" />{kind.label}</span>}
        {navegavel ? (
          <span className="iv-row">
            <span className="iv-drawer__pos">{index + 1} de {total}</span>
            <Button icon="pi pi-chevron-up" text size="small" disabled={index === 0} onClick={() => onIndex!(index - 1)} aria-label="Item anterior" tooltip="Anterior (↑)" />
            <Button icon="pi pi-chevron-down" text size="small" disabled={index >= (total as number) - 1} onClick={() => onIndex!(index + 1)} aria-label="Próximo item" tooltip="Próximo (↓)" />
          </span>
        ) : <span />}
      </div>

      <div className="iv-drawer__head">
        {status && <span className="iv-row iv-wrap">{status}</span>}
        <h2 className="iv-drawer__title">{title}</h2>
        {subtitle && <p className="iv-drawer__sub">{subtitle}</p>}
        {actions && <div className="iv-drawer__actions">{actions}</div>}
      </div>

      {children}
    </Sidebar>
  );
}
