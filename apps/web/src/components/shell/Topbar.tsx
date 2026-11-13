import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { breadcrumb } from './nav';
import { getRuntime } from '@/services/agentes';

export const OPEN_GLOBAL_SEARCH = 'seginfo:global-search';

interface TopbarProps {
  pathname: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

/**
 * Painel de integrações: quantas ferramentas de infra (Proxmox/FortiGate/2960) o servidor já
 * sabe executar de verdade, vs. quantas ainda faltam variáveis de ambiente. Clicável, abre o
 * runtime dos agentes — é o lugar onde isso se resolve.
 */
function PainelIntegracoes() {
  const runtime = useQuery({ queryKey: ['agentes-runtime'], queryFn: getRuntime, staleTime: 60_000 });
  const ferramentas = runtime.data?.ferramentas ?? [];
  const infra = ferramentas.filter((f) => f.id.startsWith('proxmox') || f.id.startsWith('fortigate') || f.id.startsWith('catalyst'));
  if (infra.length === 0) return null;
  const prontas = infra.filter((f) => f.faltando.length === 0).length;
  const tudoOk = prontas === infra.length;
  return (
    <Link to="/agents/ferramentas" className="app-topbar__integrations" data-ok={tudoOk || undefined}
      title={tudoOk ? 'Todas as integrações de infraestrutura estão configuradas.' : 'Alguma integração de infraestrutura ainda precisa de configuração no servidor.'}>
      <i className={`pi ${tudoOk ? 'pi-check-circle' : 'pi-exclamation-triangle'}`} aria-hidden="true" />
      <span>{prontas}/{infra.length} integrações</span>
    </Link>
  );
}

/** Barra superior navy fixa: menu + marca + breadcrumb | integrações + busca + ambiente. */
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
        <PainelIntegracoes />
        <button type="button" className="app-topbar__search" onClick={() => window.dispatchEvent(new Event(OPEN_GLOBAL_SEARCH))}
          aria-label="Busca global (Ctrl+K)" title="Busca global (Ctrl+K)">
          <i className="pi pi-search" aria-hidden="true" /><span>Buscar</span><kbd>Ctrl K</kbd>
        </button>
        <div className="app-topbar__env" title="Ambiente de laboratório — não é produção">
          <i className="pi pi-sitemap" aria-hidden="true" />
          <span><strong>Laboratório</strong><small>homelab</small></span>
        </div>
      </div>
    </header>
  );
}
