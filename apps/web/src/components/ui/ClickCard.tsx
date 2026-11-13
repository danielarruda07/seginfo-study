import type { CSSProperties, ReactNode } from 'react';

/**
 * Cartão inteiro clicável que abre a ficha lateral (padrão "stretched button").
 * Um <button> invisível cobre o cartão: clique em qualquer ponto, Tab + Enter/Espaço no teclado,
 * e o leitor de tela anuncia `label`. Links e botões dentro do cartão continuam funcionando
 * por cima dele (ficam com z-index maior via CSS), então não aninhe interativos no `label`.
 */
export interface ClickCardProps {
  onOpen: () => void;
  /** texto do botão para leitor de tela, ex.: "Abrir detalhes de Kali Linux" */
  label: string;
  /** destaque de estado na borda esquerda (classe tone-*) */
  tone?: 'danger' | 'serious' | 'warning' | 'info' | 'ok' | 'muted';
  /** marca o cartão cuja ficha está aberta */
  selected?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: 'article' | 'div' | 'li';
  children: ReactNode;
}

export function ClickCard({ onOpen, label, tone, selected, className, style, as: Tag = 'article', children }: ClickCardProps) {
  const cls = ['iv-card', 'iv-card--click', tone ? `tone-${tone}` : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <Tag className={cls} style={style} data-alert={tone && tone !== 'muted' && tone !== 'ok' ? true : undefined} data-selected={selected || undefined}>
      <button type="button" className="iv-card__hit" onClick={onOpen} aria-label={label} aria-haspopup="dialog" />
      {children}
    </Tag>
  );
}
