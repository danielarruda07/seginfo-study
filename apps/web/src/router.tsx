import { lazy } from 'react';
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from '@/components/Layout';

const Dashboard = lazy(async () => ({ default: (await import('@/routes/Dashboard')).Dashboard }));
const Trilhas = lazy(async () => ({ default: (await import('@/routes/Trilhas')).Trilhas }));
const Topicos = lazy(async () => ({ default: (await import('@/routes/Topicos')).Topicos }));
const Inventario = lazy(async () => ({ default: (await import('@/routes/Inventario')).Inventario }));
const Labs = lazy(async () => ({ default: (await import('@/routes/Labs')).Labs }));
const Range = lazy(async () => ({ default: (await import('@/routes/Range')).Range }));
const Ferramentas = lazy(async () => ({ default: (await import('@/routes/Ferramentas')).Ferramentas }));
const Sessoes = lazy(async () => ({ default: (await import('@/routes/Sessoes')).Sessoes }));
const Metas = lazy(async () => ({ default: (await import('@/routes/Metas')).Metas }));
const Posts = lazy(async () => ({ default: (await import('@/routes/Posts')).Posts }));
const Cofre = lazy(async () => ({ default: (await import('@/routes/Cofre')).Cofre }));
const Arsenal = lazy(async () => ({ default: (await import('@/routes/Arsenal')).Arsenal }));
const Biblioteca = lazy(async () => ({ default: (await import('@/routes/Biblioteca')).Biblioteca }));
const Radar = lazy(async () => ({ default: (await import('@/routes/Radar')).Radar }));
const Armazenamento = lazy(async () => ({ default: (await import('@/routes/Armazenamento')).Armazenamento }));
const Cerebro = lazy(async () => ({ default: (await import('@/routes/Cerebro')).Cerebro }));
const Attack = lazy(async () => ({ default: (await import('@/routes/Attack')).Attack }));
const Ameacas = lazy(async () => ({ default: (await import('@/routes/Ameacas')).Ameacas }));
const Portfolio = lazy(async () => ({ default: (await import('@/routes/Portfolio')).Portfolio }));

const AgentsHome = lazy(async () => ({ default: (await import('@/routes/agents/AgentsHome')).AgentsHome }));
const AgentEditor = lazy(async () => ({ default: (await import('@/routes/agents/AgentEditor')).AgentEditor }));
const AgentPlayground = lazy(async () => ({ default: (await import('@/routes/agents/AgentPlayground')).AgentPlayground }));
const AgentsBase = lazy(async () => ({ default: (await import('@/routes/agents/AgentsBase')).AgentsBase }));
const AgentsFerramentas = lazy(async () => ({ default: (await import('@/routes/agents/AgentsFerramentas')).AgentsFerramentas }));
const AgentsAvaliacoes = lazy(async () => ({ default: (await import('@/routes/agents/AgentsAvaliacoes')).AgentsAvaliacoes }));
const AgentsAprender = lazy(async () => ({ default: (await import('@/routes/agents/AgentsAprender')).AgentsAprender }));

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard });
const trilhasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/trilhas', component: Trilhas });
const trilhaTopicosRoute = createRoute({ getParentRoute: () => rootRoute, path: '/trilhas/$trilhaId', component: Topicos });
const topicosRoute = createRoute({ getParentRoute: () => rootRoute, path: '/topicos', component: Topicos });
const ambienteRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ambiente', component: Inventario });
const labsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/labs', component: Labs });
const rangeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/range', component: Range });
const ferramentasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ferramentas', component: Ferramentas });
const sessoesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sessoes', component: Sessoes });
const metasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/metas', component: Metas });
const postsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/posts', component: Posts });
const cofreRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cofre', component: Cofre });
const arsenalRoute = createRoute({ getParentRoute: () => rootRoute, path: '/arsenal', component: Arsenal });
const bibliotecaRoute = createRoute({ getParentRoute: () => rootRoute, path: '/biblioteca', component: Biblioteca });
const radarRoute = createRoute({ getParentRoute: () => rootRoute, path: '/radar', component: Radar });
const armazenamentoRoute = createRoute({ getParentRoute: () => rootRoute, path: '/armazenamento', component: Armazenamento });
const cerebroRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cerebro', component: Cerebro });
const attackRoute = createRoute({ getParentRoute: () => rootRoute, path: '/attack', component: Attack });
const ameacasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ameacas', component: Ameacas });
const portfolioRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio', component: Portfolio });

const agentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents', component: AgentsHome });
const agentEditorRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/agente/$agenteId', component: AgentEditor });
const agentPlaygroundRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/agente/$agenteId/playground', component: AgentPlayground });
const agentsBaseRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/base', component: AgentsBase });
const agentsFerramentasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/ferramentas', component: AgentsFerramentas });
const agentsAvaliacoesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/avaliacoes', component: AgentsAvaliacoes });
const agentsAprenderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/aprender', component: AgentsAprender });

const routeTree = rootRoute.addChildren([
  agentsRoute,
  agentEditorRoute,
  agentPlaygroundRoute,
  agentsBaseRoute,
  agentsFerramentasRoute,
  agentsAvaliacoesRoute,
  agentsAprenderRoute,
  indexRoute,
  trilhasRoute,
  trilhaTopicosRoute,
  topicosRoute,
  ambienteRoute,
  labsRoute,
  rangeRoute,
  ferramentasRoute,
  sessoesRoute,
  metasRoute,
  postsRoute,
  cofreRoute,
  arsenalRoute,
  bibliotecaRoute,
  radarRoute,
  armazenamentoRoute,
  cerebroRoute,
  portfolioRoute,
  attackRoute,
  ameacasRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
