# Arquitetura atual

Monorepo npm com `apps/web`, `apps/api` e `packages/shared`.

## Frontend

- React 19, TypeScript e Vite.
- PrimeReact, PrimeFlex e PrimeIcons para a interface.
- TanStack Router para navegação e TanStack Query para consultas/cache.
- `localStorage` continua sendo a persistência principal de boa parte das telas de
  estudo. As chaves conhecidas são validadas com schemas Zod, e o formato local guarda
  uma versão. A tela Radar e o módulo Segundo Cérebro usam a API e o PostgreSQL.
- `services/migrate.ts` envia uma cópia dos dados locais para o servidor. É uma
  mesclagem manual, não sincronização bidirecional ou automática.

## API

- Fastify com autenticação baseada na identidade verificada pelo Cloudflare Access.
- Prisma 7 com PostgreSQL e adapter `pg`.
- As rotas de estado aplicam verificação de origem para operações de escrita em
  produção. Rotas de ingestão de máquina usam autenticação própria e ficam fora
  desse plugin.
- O módulo de backup cifra a exportação antes de enviá-la ao OneDrive. A chave
  privada de restauração não fica no servidor.

## Busca no Segundo Cérebro

A busca atual é lexical (BM25), executada pela API sobre memórias e devolve trechos
com a fonte. A captura de URLs usa extração server-side com proteção contra SSRF.
Não há geração de respostas por LLM, embeddings ou ingestão/sincronização contínua
do OneDrive nesta etapa.

## Shared

`packages/shared` mantém os tipos e schemas Zod usados pelo frontend. A API valida
seus payloads com Zod nas rotas; manter schemas compartilhados e modelos da API
alinhados é uma tarefa em evolução.

## Estrutura

```text
apps/web/src/routes/       telas da aplicação
apps/web/src/services/     persistência local e clientes da API
apps/api/src/              rotas, segurança, integrações e tarefas agendadas
apps/api/prisma/           schema e migrations
packages/shared/src/       tipos e schemas compartilhados
docs/                      decisões e guias operacionais
```

Consulte `docs/PENDENCIAS.md` antes de considerar o backup externo completo ou usar
uma exportação como procedimento de restauração integral.
