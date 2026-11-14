import type { ReactNode } from 'react';

/** Link para fonte oficial externa: abre em nova aba, sem repassar referer, e avisa o leitor de tela. */
export function ExtLink({ href, children, button }: { href: string; children: ReactNode; button?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener"
      className={button ? 'p-button p-component p-button-outlined in-extbtn' : 'in-ext'}>
      {children}
      <i className="pi pi-external-link" aria-hidden="true" />
      <span className="in-sr">(abre em nova aba)</span>
    </a>
  );
}

/** Lista simples de itens da ficha; mostra `vazio` quando não há nada. */
export function FichaLista({ vazio, children }: { vazio: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className="in-muted-p">{vazio}</p>;
  return <ul className="in-list">{children}</ul>;
}
