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
const Wazuh = lazy(async () => ({ default: (await import('@/routes/Wazuh')).Wazuh }));
const Laudos = lazy(async () => ({ default: (await import('@/routes/Laudos')).Laudos }));
const Investigacoes = lazy(async () => ({ default: (await import('@/routes/Investigacoes')).Investigacoes }));
const Artefatos = lazy(async () => ({ default: (await import('@/routes/Artefatos')).Artefatos }));
const Armazenamento = lazy(async () => ({ default: (await import('@/routes/Armazenamento')).Armazenamento }));
const Cerebro = lazy(async () => ({ default: (await import('@/routes/Cerebro')).Cerebro }));
const Attack = lazy(async () => ({ default: (await import('@/routes/Attack')).Attack }));
const Ameacas = lazy(async () => ({ default: (await import('@/routes/Ameacas')).Ameacas }));
const Exposicao = lazy(async () => ({ default: (await import('@/routes/Exposicao')).Exposicao }));
const Portfolio = lazy(async () => ({ default: (await import('@/routes/Portfolio')).Portfolio }));
const Documentacao = lazy(async () => ({ default: (await import('@/routes/Documentacao')).Documentacao }));

const AgentsHome = lazy(async () => ({ default: (await import('@/routes/agents/AgentsHome')).AgentsHome }));
const AgentEditor = lazy(async () => ({ default: (await import('@/routes/agents/AgentEditor')).AgentEditor }));
const AgentPlayground = lazy(async () => ({ default: (await import('@/routes/agents/AgentPlayground')).AgentPlayground }));
const AgentsBase = lazy(async () => ({ default: (await import('@/routes/agents/AgentsBase')).AgentsBase }));
const AgentsFerramentas = lazy(async () => ({ default: (await import('@/routes/agents/AgentsFerramentas')).AgentsFerramentas }));
const AgentsAvaliacoes = lazy(async () => ({ default: (await import('@/routes/agents/AgentsAvaliacoes')).AgentsAvaliacoes }));
const AgentsAprender = lazy(async () => ({ default: (await import('@/routes/agents/AgentsAprender')).AgentsAprender }));
const AgentsAuditoria = lazy(async () => ({ default: (await import('@/routes/agents/AgentsAuditoria')).AgentsAuditoria }));

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
const wazuhRoute = createRoute({ getParentRoute: () => rootRoute, path: '/wazuh', component: Wazuh });
const laudosRoute = createRoute({ getParentRoute: () => rootRoute, path: '/laudos', component: Laudos });
const investigacoesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/investigacoes', component: Investigacoes });
const artefatosRoute = createRoute({ getParentRoute: () => rootRoute, path: '/artefatos', component: Artefatos });
const armazenamentoRoute = createRoute({ getParentRoute: () => rootRoute, path: '/armazenamento', component: Armazenamento });
const cerebroRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cerebro', component: Cerebro });
const attackRoute = createRoute({ getParentRoute: () => rootRoute, path: '/attack', component: Attack });
const ameacasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ameacas', component: Ameacas });
const exposicaoRoute = createRoute({ getParentRoute: () => rootRoute, path: '/exposicao', component: Exposicao });
const portfolioRoute = createRoute({ getParentRoute: () => rootRoute, path: '/portfolio', component: Portfolio });
const documentacaoRoute = createRoute({ getParentRoute: () => rootRoute, path: '/documentacao', component: Documentacao });

const agentsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents', component: AgentsHome });
const agentEditorRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/agente/$agenteId', component: AgentEditor });
const agentPlaygroundRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/agente/$agenteId/playground', component: AgentPlayground,
  // ?exec= abre uma execução específica (ex.: a que espera aprovação)
  validateSearch: (s: Record<string, unknown>): { exec?: string } => (typeof s.exec === 'string' ? { exec: s.exec } : {}),
});
const agentsBaseRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/base', component: AgentsBase });
const agentsFerramentasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/ferramentas', component: AgentsFerramentas });
const agentsAvaliacoesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/avaliacoes', component: AgentsAvaliacoes,
  // ?agente= já abre a tela com esse agente selecionado
  validateSearch: (s: Record<string, unknown>): { agente?: string } => (typeof s.agente === 'string' ? { agente: s.agente } : {}),
});
const agentsAprenderRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/aprender', component: AgentsAprender });
const agentsAuditoriaRoute = createRoute({ getParentRoute: () => rootRoute, path: '/agents/auditoria', component: AgentsAuditoria });

const routeTree = rootRoute.addChildren([
  agentsRoute,
  agentEditorRoute,
  agentPlaygroundRoute,
  agentsBaseRoute,
  agentsFerramentasRoute,
  agentsAvaliacoesRoute,
  agentsAprenderRoute,
  agentsAuditoriaRoute,
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
  wazuhRoute,
  laudosRoute,
  investigacoesRoute,
  artefatosRoute,
  armazenamentoRoute,
  cerebroRoute,
  portfolioRoute,
  attackRoute,
  ameacasRoute,
  exposicaoRoute,
  documentacaoRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
