import type { ReactNode } from 'react';

/** Blocos do painel de detalhe (Drawer/Sidebar) das telas de listagem. */

export function DetailLayout({ children }: { children: ReactNode }) {
  return <div className="iv-col" style={{ gap: '1rem' }}>{children}</div>;
}

/** Título do item + linha de pills. */
export function DetailHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <h2 className="iv-drawer__title">{title}</h2>
      {children && <div className="iv-row iv-wrap" style={{ marginTop: '.5rem' }}>{children}</div>}
    </div>
  );
}

/** Seção com rótulo em MAIÚSCULAS pequenas. */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="iv-section-label">{title}</h3>
      {children}
    </div>
  );
}

/** Card compacto: título + etiqueta à direita + descrição. */
export function DetailCard({ title, aside, description }: { title: ReactNode; aside?: ReactNode; description?: ReactNode }) {
  return (
    <div className="iv-card" style={{ padding: '.6rem .8rem' }}>
      <div className="iv-row" style={{ justifyContent: 'space-between' }}>
        <strong>{title}</strong>
        {aside}
      </div>
      {description && <div className="iv-muted" style={{ fontSize: '.8rem' }}>{description}</div>}
    </div>
  );
}

/** Título + subtítulo empilhados (coluna principal das tabelas). */
export function TitleCell({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {subtitle && <div className="iv-muted" style={{ fontSize: '.8rem' }}>{subtitle}</div>}
    </div>
  );
}

/** Lista de definição rótulo | valor da ficha lateral. Valor vazio vira "—". */
export function DetailFields({ items }: { items: [label: string, value: ReactNode][] }) {
  return (
    <dl className="iv-dl">
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v === '' || v === null || v === undefined ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  );
}
