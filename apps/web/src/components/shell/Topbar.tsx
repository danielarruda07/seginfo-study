import { Fragment } from 'react';
import { breadcrumb } from './nav';

export const OPEN_GLOBAL_SEARCH = 'seginfo:global-search';

interface TopbarProps {
  pathname: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/** Barra superior navy fixa: menu + marca + breadcrumb | busca + usuário. */
export function Topbar({ pathname, menuOpen, onToggleMenu }: TopbarProps) {
  const segs = breadcrumb(pathname);
  return (
    <header className="app-topbar">
      <button type="button" className="app-topbar__icon" onClick={onToggleMenu}
        aria-label={menuOpen ? 'Recolher menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="primary-navigation" title="Menu">
        <i className="pi pi-bars" aria-hidden="true" />
      </button>
      <span className="app-topbar__brand"><i className="pi pi-shield" aria-hidden="true" /> SegInfo</span>
      {segs.length > 0 && (
        <nav className="app-breadcrumb" aria-label="Você está em">
          {segs.map((s, i) => (
            <Fragment key={s}>
              {i > 0 && <i className="pi pi-angle-right" aria-hidden="true" />}
              <span aria-current={i === segs.length - 1 ? 'page' : undefined}>{s}</span>
            </Fragment>
          ))}
        </nav>
      )}
      <div className="app-topbar__right">
        <button type="button" className="app-topbar__search" onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH))}
          aria-label="Busca global (Ctrl+K)" title="Busca global (Ctrl+K)">
          <i className="pi pi-search" aria-hidden="true" /><span>Buscar</span><kbd>Ctrl K</kbd>
        </button>
        <div className="app-topbar__user">
          <i className="pi pi-user" aria-hidden="true" />
          <span><strong>DANIEL ARRUDA</strong><small>homelab</small></span>
        </div>
      </div>
    </header>
  );
}
