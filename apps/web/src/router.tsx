import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/routes/Dashboard';
import { Trilhas } from '@/routes/Trilhas';
import { Topicos } from '@/routes/Topicos';
import { Inventario } from '@/routes/Inventario';
import { Labs } from '@/routes/Labs';
import { Sessoes } from '@/routes/Sessoes';
import { Metas } from '@/routes/Metas';
import { Posts } from '@/routes/Posts';
import { Cofre } from '@/routes/Cofre';
import { Arsenal } from '@/routes/Arsenal';
import { Biblioteca } from '@/routes/Biblioteca';

const rootRoute = createRootRoute({ component: Layout });

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Dashboard });
const trilhasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/trilhas', component: Trilhas });
const trilhaTopicosRoute = createRoute({ getParentRoute: () => rootRoute, path: '/trilhas/$trilhaId', component: Topicos });
const topicosRoute = createRoute({ getParentRoute: () => rootRoute, path: '/topicos', component: Topicos });
const ambienteRoute = createRoute({ getParentRoute: () => rootRoute, path: '/ambiente', component: Inventario });
const labsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/labs', component: Labs });
const sessoesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sessoes', component: Sessoes });
const metasRoute = createRoute({ getParentRoute: () => rootRoute, path: '/metas', component: Metas });
const postsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/posts', component: Posts });
const cofreRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cofre', component: Cofre });
const arsenalRoute = createRoute({ getParentRoute: () => rootRoute, path: '/arsenal', component: Arsenal });
const bibliotecaRoute = createRoute({ getParentRoute: () => rootRoute, path: '/biblioteca', component: Biblioteca });

const routeTree = rootRoute.addChildren([
  indexRoute,
  trilhasRoute,
  trilhaTopicosRoute,
  topicosRoute,
  ambienteRoute,
  labsRoute,
  sessoesRoute,
  metasRoute,
  postsRoute,
  cofreRoute,
  arsenalRoute,
  bibliotecaRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
