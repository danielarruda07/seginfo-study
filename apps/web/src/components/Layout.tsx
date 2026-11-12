import { Fragment, Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { GlobalSearch } from './GlobalSearch';
import { ensureLocalSchemaVersion } from '@/services/localVersion';

const NAV = [
  { to: '/', label: 'Painel', icon: 'pi-th-large', exact: true },
  { to: '/trilhas', label: 'Trilhas', icon: 'pi-sitemap' },
  { to: '/topicos', label: 'Tópicos', icon: 'pi-book' },
  { to: '/ambiente', label: 'Meu Ambiente', icon: 'pi-server' },
  { to: '/labs', label: 'Labs', icon: 'pi-desktop' },
  { to: '/range', label: 'Range Vulnerável', icon: 'pi-bullseye' },
  { to: '/radar', label: 'Radar', icon: 'pi-eye' },
  { to: '/attack', label: 'Matriz ATT&CK', icon: 'pi-table' },
  { to: '/ameacas', label: 'Ameaças (KEV)', icon: 'pi-exclamation-triangle' },
  { to: '/sessoes', label: 'Sessões', icon: 'pi-clock' },
  { to: '/metas', label: 'Metas', icon: 'pi-flag' },
  { to: '/posts', label: 'LinkedIn', icon: 'pi-linkedin' },
  { to: '/arsenal', label: 'Arsenal IA', icon: 'pi-sparkles' },
  { to: '/biblioteca', label: 'Biblioteca', icon: 'pi-bookmark' },
  { to: '/cerebro', label: 'Segundo Cérebro', icon: 'pi-database' },
  { to: '/portfolio', label: 'Portfólio', icon: 'pi-id-card' },
  { to: '/armazenamento', label: 'Armazenamento', icon: 'pi-cloud' },
  { to: '/cofre', label: 'Cofre', icon: 'pi-lock' },
];

const AGENTS_SUB = [
  { to: '/agents', label: 'Meus agentes' },
  { to: '/agents/base', label: 'Base de conhecimento' },
  { to: '/agents/ferramentas', label: 'Ferramentas e MCP' },
  { to: '/agents/avaliacoes', label: 'Avaliações' },
  { to: '/agents/aprender', label: 'Aprender' },
];

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const agentsAtivo = pathname.startsWith('/agents');
  const [agentsAberto, setAgentsAberto] = useState(agentsAtivo);
  useEffect(() => { if (agentsAtivo) setAgentsAberto(true); }, [agentsAtivo]);
  useEffect(() => { ensureLocalSchemaVersion(); }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const fecharComEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', fecharComEscape);
    return () => document.removeEventListener('keydown', fecharComEscape);
  }, [menuOpen]);
  return (
    <div className={`app-shell${menuOpen ? ' app-shell--menu-open' : ''}`}>
      <header className="mobile-header">
        <button type="button" className="mobile-menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(!menuOpen)}>
          <i className={`pi ${menuOpen ? 'pi-times' : 'pi-bars'}`} aria-hidden="true" />
        </button>
        <div className="app-brand"><i className="pi pi-shield" aria-hidden="true" /> Seg<span>Info</span></div>
        <span className="mobile-header__caption">CONTROLE DE ESTUDO</span>
      </header>
      <aside className="app-sidebar" id="primary-navigation">
        <div className="app-brand"><i className="pi pi-shield" /> Seg<span>Info</span></div>
        <div className="app-brand__sub">Segundo cérebro · Daniel Arruda</div>
        <nav className="app-nav iv-col" style={{ gap: 2 }}>
          {NAV.map((n) => (
            <Fragment key={n.to}>
              <Link to={n.to} activeOptions={{ exact: n.exact }} activeProps={{ className: 'active' }} onClick={() => setMenuOpen(false)}>
                <i className={`pi ${n.icon}`} aria-hidden="true" /> {n.label}
              </Link>
              {n.to === '/cerebro' && (
                <>
                  <button type="button" className={`app-nav__group${agentsAtivo ? ' app-nav__group--active' : ''}`}
                    aria-expanded={agentsAberto} aria-controls="agents-submenu" onClick={() => setAgentsAberto(!agentsAberto)}>
                    <i className="pi pi-share-alt" aria-hidden="true" /> Agents
                    <i className="pi pi-chevron-down app-nav__chevron" aria-hidden="true" />
                  </button>
                  {agentsAberto && (
                    <div className="app-nav__sub iv-col" id="agents-submenu">
                      {AGENTS_SUB.map((s) => (
                        <Link key={s.to} to={s.to} activeOptions={{ exact: true }} activeProps={{ className: 'active' }} onClick={() => setMenuOpen(false)}>
                          {s.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Fragment>
          ))}
        </nav>
      </aside>
      {menuOpen && <button type="button" className="nav-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />}
      <main className="app-main">
        <GlobalSearch />
        <Suspense fallback={<div className="route-loading" role="status"><i className="pi pi-spin pi-spinner" aria-hidden="true" /> Abrindo tela…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
