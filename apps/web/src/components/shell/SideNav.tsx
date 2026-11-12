import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { filterNav, findActive } from './nav';

interface SideNavProps {
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}

/** Menu lateral navy: busca no topo, seções em maiúsculas, item ativo branco com barra teal. */
export function SideNav({ pathname, collapsed, onNavigate }: SideNavProps) {
  const [term, setTerm] = useState('');
  const sections = filterNav(term);
  const activeTo = findActive(pathname)?.item.to;
  return (
    <aside className="app-sidebar" id="primary-navigation" data-collapsed={collapsed || undefined}>
      {!collapsed && (
        <div className="app-sidebar__search">
          <i className="pi pi-search" aria-hidden="true" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar no menu" aria-label="Buscar no menu" />
        </div>
      )}
      <nav className="app-nav" aria-label="Menu principal">
        {sections.map((s) => (
          <div key={s.title} className="app-nav__section">
            {!collapsed && <div className="app-nav__title">{s.title}</div>}
            {s.items.map((n) => (
              <Link key={n.to} to={n.to} className={n.to === activeTo ? 'active' : undefined}
                aria-current={n.to === activeTo ? 'page' : undefined}
                title={collapsed ? n.label : undefined} onClick={onNavigate}>
                <i className={`pi ${n.icon}`} aria-hidden="true" />
                {!collapsed && <span>{n.label}</span>}
              </Link>
            ))}
          </div>
        ))}
        {sections.length === 0 && <p className="app-nav__empty">Nada no menu com “{term}”.</p>}
      </nav>
    </aside>
  );
}
