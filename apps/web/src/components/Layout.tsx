import { Link, Outlet } from '@tanstack/react-router';

const NAV = [
  { to: '/', label: 'Painel', icon: 'pi-th-large', exact: true },
  { to: '/trilhas', label: 'Trilhas', icon: 'pi-sitemap' },
  { to: '/topicos', label: 'Tópicos', icon: 'pi-book' },
  { to: '/ambiente', label: 'Meu Ambiente', icon: 'pi-server' },
  { to: '/labs', label: 'Labs', icon: 'pi-desktop' },
  { to: '/radar', label: 'Radar', icon: 'pi-eye' },
  { to: '/sessoes', label: 'Sessões', icon: 'pi-clock' },
  { to: '/metas', label: 'Metas', icon: 'pi-flag' },
  { to: '/posts', label: 'LinkedIn', icon: 'pi-linkedin' },
  { to: '/arsenal', label: 'Arsenal IA', icon: 'pi-sparkles' },
  { to: '/biblioteca', label: 'Biblioteca', icon: 'pi-bookmark' },
  { to: '/cofre', label: 'Cofre', icon: 'pi-lock' },
];

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand"><i className="pi pi-shield" /> Seg<span>Info</span></div>
        <div className="app-brand__sub">Segundo cérebro · Daniel Arruda</div>
        <nav className="app-nav iv-col" style={{ gap: 2 }}>
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.exact }} activeProps={{ className: 'active' }}>
              <i className={`pi ${n.icon}`} /> {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
