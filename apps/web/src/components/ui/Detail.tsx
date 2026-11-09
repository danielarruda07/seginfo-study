import type { ReactNode } from 'react';

/** Blocos do painel de detalhe (Drawer/Sidebar) das telas de listagem. */

export function DetailLayout({ children }: { children: ReactNode }) {
  return <div className="iv-col" style={{ gap: '1rem' }}>{children}</div>;
}

/** Título do item + linha de pills. */
export function DetailHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <h2 style={{ margin: 0, color: 'var(--alvoar-navy)' }}>{title}</h2>
      {children && <div className="iv-row iv-wrap iv-mt">{children}</div>}
    </div>
  );
}

/** Seção com subtítulo (h4). */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 style={{ marginBottom: '.4rem' }}>{title}</h4>
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
      {description && <div className="iv-muted" style={{ fontSize: '.84rem' }}>{description}</div>}
    </div>
  );
}

/** Título + subtítulo empilhados (coluna principal das tabelas). */
export function TitleCell({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {subtitle && <div className="iv-muted" style={{ fontSize: '.82rem' }}>{subtitle}</div>}
    </div>
  );
}
