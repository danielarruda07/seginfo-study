import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { filterNav, findActive } from './nav';
import { RodapeVersao } from './RodapeVersao';

/** chave antiga: o menu lembrava as seções abertas; agora sempre começa recolhido */
const OPEN_KEY_ANTIGA = 'seginfo.menu.secoes';

interface SideNavProps {
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}

/**
 * Menu lateral navy. Seções sempre começam recolhidas e só abrem por clique (pedido do dono);
 * a seção da tela atual mostra um ponto. Buscar no menu abre tudo enquanto houver termo.
 * Recolhido (só ícones), o hover/foco mostra o menu inteiro por cima do conteúdo.
 */
export function SideNav({ pathname, collapsed, onNavigate }: SideNavProps) {
  const [term, setTerm] = useState('');
  const [abertas, setAbertas] = useState<string[]>([]);
  const sections = filterNav(term);
  const active = findActive(pathname);
  const buscando = term.trim() !== '';

  useEffect(() => { try { localStorage.removeItem(OPEN_KEY_ANTIGA); } catch { /* sem storage */ } }, []);

  function alternar(titulo: string) {
    setAbertas((a) => (a.includes(titulo) ? a.filter((t) => t !== titulo) : [...a, titulo]));
  }

  return (
    <aside className="app-sidebar" id="primary-navigation" data-collapsed={collapsed || undefined}>
      <div className="app-sidebar__search">
        <i className="pi pi-search" aria-hidden="true" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar no menu" aria-label="Buscar no menu" />
      </div>
      <nav className="app-nav" aria-label="Menu principal">
        {sections.map((s) => {
          const aberta = buscando || abertas.includes(s.title);
          const temAtivo = active?.section.title === s.title;
          const id = `nav-sec-${s.title.normalize('NFD').replace(/[^a-zA-Z]/g, '')}`;
          return (
            <div key={s.title} className="app-nav__section" data-open={aberta || undefined}>
              <button type="button" className="app-nav__title" aria-expanded={aberta} aria-controls={id} onClick={() => alternar(s.title)}
                data-has-active={temAtivo || undefined}>
                <span>{s.title}</span>
                {!aberta && temAtivo && <span className="app-nav__dot" aria-label="(tela atual)" />}
                <i className="pi pi-chevron-down app-nav__chevron" aria-hidden="true" />
              </button>
              <div id={id} className="app-nav__items">
                {s.items.map((n) => {
                  const isActive = n.to === active?.item.to;
                  return (
                    // O roteador marca como ativo todo link que é prefixo da rota (/agents em /agents/ferramentas).
                    // Quem decide o destaque é o findActive, então a marcação automática fica desligada.
                    <Link key={n.to} to={n.to} activeOptions={{ exact: true }} activeProps={{ className: '' }} className={isActive ? 'active' : undefined} aria-current={isActive ? 'page' : undefined}
                      title={collapsed ? n.label : undefined} onClick={onNavigate}>
                      <i className={`pi ${n.icon}`} aria-hidden="true" />
                      <span className="app-nav__label">{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
        {sections.length === 0 && <p className="app-nav__empty">Nada no menu com “{term}”.</p>}
      </nav>
      <RodapeVersao />
    </aside>
  );
}
