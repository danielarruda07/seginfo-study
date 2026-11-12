/** Menu lateral agrupado em seções + breadcrumb derivado da rota (regras puras). */

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  exact?: boolean;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Estudo',
    items: [
      { to: '/', label: 'Painel', icon: 'pi-th-large', exact: true },
      { to: '/trilhas', label: 'Trilhas', icon: 'pi-sitemap' },
      { to: '/topicos', label: 'Tópicos', icon: 'pi-book' },
      { to: '/sessoes', label: 'Sessões', icon: 'pi-clock' },
      { to: '/metas', label: 'Metas', icon: 'pi-flag' },
    ],
  },
  {
    title: 'Prática',
    items: [
      { to: '/ambiente', label: 'Meu Ambiente', icon: 'pi-server' },
      { to: '/labs', label: 'Labs', icon: 'pi-desktop' },
      { to: '/range', label: 'Range Vulnerável', icon: 'pi-bullseye' },
    ],
  },
  {
    title: 'Inteligência',
    items: [
      { to: '/radar', label: 'Radar', icon: 'pi-eye' },
      { to: '/attack', label: 'Matriz ATT&CK', icon: 'pi-table' },
      { to: '/ameacas', label: 'Ameaças (KEV)', icon: 'pi-exclamation-triangle' },
    ],
  },
  {
    title: 'Conhecimento',
    items: [
      { to: '/biblioteca', label: 'Biblioteca', icon: 'pi-bookmark' },
      { to: '/cerebro', label: 'Segundo Cérebro', icon: 'pi-database' },
      { to: '/arsenal', label: 'Arsenal IA', icon: 'pi-sparkles' },
    ],
  },
  {
    title: 'Agents',
    items: [
      { to: '/agents', label: 'Meus agentes', icon: 'pi-share-alt', exact: true },
      { to: '/agents/base', label: 'Base de conhecimento', icon: 'pi-folder-open' },
      { to: '/agents/ferramentas', label: 'Ferramentas e MCP', icon: 'pi-wrench' },
      { to: '/agents/avaliacoes', label: 'Avaliações', icon: 'pi-check-square' },
      { to: '/agents/aprender', label: 'Aprender', icon: 'pi-graduation-cap' },
    ],
  },
  {
    title: 'Carreira',
    items: [
      { to: '/posts', label: 'LinkedIn', icon: 'pi-linkedin' },
      { to: '/portfolio', label: 'Portfólio', icon: 'pi-id-card' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { to: '/armazenamento', label: 'Armazenamento', icon: 'pi-cloud' },
      { to: '/cofre', label: 'Cofre', icon: 'pi-lock' },
    ],
  },
];

/** Sub-rotas sem item próprio no menu: herdam o item pai e ganham um segmento extra. */
const EXTRA_SEGMENTS: { prefix: string; parent: string; label: string }[] = [
  { prefix: '/trilhas/', parent: '/trilhas', label: 'Tópicos da trilha' },
  { prefix: '/agents/agente/', parent: '/agents', label: 'Editor' },
];

function matches(item: NavItem, pathname: string): boolean {
  if (item.exact || item.to === '/') return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

/** Item ativo: o de rota mais longa que casa com o caminho. */
export function findActive(pathname: string): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (matches(item, pathname) && (!best || item.to.length > best.item.to.length)) best = { section, item };
    }
  }
  if (best) return best;
  const extra = EXTRA_SEGMENTS.find((e) => pathname.startsWith(e.prefix));
  if (!extra) return null;
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => i.to === extra.parent);
    if (item) return { section, item };
  }
  return null;
}

/** Segmentos do breadcrumb: Seção › Tela [› Subtela]. */
export function breadcrumb(pathname: string): string[] {
  const active = findActive(pathname);
  if (!active) return [];
  const segs = [active.section.title, active.item.label];
  const extra = EXTRA_SEGMENTS.find((e) => pathname.startsWith(e.prefix));
  if (extra && active.item.to === extra.parent) segs.push(extra.label);
  return segs;
}

/** Filtra o menu pela busca (rótulo ou título da seção), sem acento e sem caixa. */
export function filterNav(term: string): NavSection[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(term.trim());
  if (!q) return NAV_SECTIONS;
  return NAV_SECTIONS.map((s) =>
    norm(s.title).includes(q) ? s : { ...s, items: s.items.filter((i) => norm(i.label).includes(q)) },
  ).filter((s) => s.items.length > 0);
}

/**
 * Seções abertas no menu: as que a pessoa abriu antes + sempre a da tela atual.
 * `salvo` vem do localStorage (pode ser lixo); títulos que não existem mais são descartados.
 */
export function secoesAbertas(salvo: unknown, pathname: string): string[] {
  const validos = new Set(NAV_SECTIONS.map((s) => s.title));
  const lista = Array.isArray(salvo) ? salvo.filter((t): t is string => typeof t === 'string' && validos.has(t)) : [];
  const ativa = findActive(pathname)?.section.title;
  return ativa && !lista.includes(ativa) ? [...lista, ativa] : lista;
}
