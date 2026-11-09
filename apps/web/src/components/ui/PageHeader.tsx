import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1 className="page-header__title">{title}</h1>
      {subtitle && <p className="page-header__sub">{subtitle}</p>}
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
