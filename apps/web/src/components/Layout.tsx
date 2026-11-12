import { Suspense, useEffect, useState } from 'react';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { GlobalSearch } from './GlobalSearch';
import { Topbar } from './shell/Topbar';
import { SideNav } from './shell/SideNav';
import { ensureLocalSchemaVersion } from '@/services/localVersion';

const COLLAPSE_KEY = 'seginfo.menu.recolhido';
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
}

/** Casca do app: barra superior + menu lateral. Nenhuma tela cria a própria barra ou menu. */
export function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { ensureLocalSchemaVersion(); }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  function toggleMenu() {
    if (isMobile()) { setMobileOpen((v) => !v); return; }
    setCollapsed((v) => {
      try { localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1'); } catch { /* sem storage: só não lembra */ }
      return !v;
    });
  }

  return (
    <div className={`app-shell${mobileOpen ? ' app-shell--menu-open' : ''}${collapsed ? ' app-shell--collapsed' : ''}`}>
      <Topbar pathname={pathname} menuOpen={isMobile() ? mobileOpen : !collapsed} onToggleMenu={toggleMenu} />
      <SideNav pathname={pathname} collapsed={collapsed && !mobileOpen} onNavigate={() => setMobileOpen(false)} />
      {mobileOpen && <button type="button" className="nav-backdrop" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
      <main className="app-main">
        <GlobalSearch />
        <Suspense fallback={<div className="route-loading" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Abrindo tela…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
