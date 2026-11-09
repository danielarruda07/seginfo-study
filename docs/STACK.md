# 1. Stack

Monorepo com npm workspaces: `apps/web` + `apps/api` + `packages/shared`.
A versão inicial (MVP) roda **100% no front** (`apps/web`) com persistência em
`localStorage`. O `apps/api` é a referência para a migração futura para banco real.

## Frontend — `apps/web`

| Lib | Versão | Para que serve |
| --- | --- | --- |
| react / react-dom | 19 | Biblioteca de UI, base de toda a aplicação |
| vite | 6 | Dev server + bundler, build rápido e HMR |
| typescript | 5.7 | Tipagem estática em todo o código |
| primereact | 10 | **Núcleo da UI**: DataTable, Drawer, Button, Dropdown, etc. |
| primeflex | 3 | Utilitários de layout (grid, flex, spacing) |
| primeicons | 7 | Conjunto de ícones usado pelo PrimeReact |
| @tanstack/react-query | 5 | Cache de dados assíncronos, estados de loading/erro, refetch |
| @tanstack/react-router | 1 | Roteamento code-based, type-safe |
| axios | 1 | Cliente HTTP com interceptors (base para o api futuro) |
| chart.js | 4 | Gráficos do dashboard (progresso, horas, distribuição) |
| react-chartjs-2 | 5 | Binding React para o chart.js |
| @xyflow/react | 12 | Diagramas de fluxo — **só onde usado** (mapas de ataque, kill chain) |
| leaflet | 1 | Mapas — **só onde usado** (geolocalização de ameaças) |
| @xterm/xterm | 5 | Terminal no browser — **só onde usado** (labs de comandos) |
| react-hook-form | 7 | Gerenciamento de formulários (metas, anotações) |
| zod | 4 | Validação de schema, compartilhado via `packages/shared` |

## Backend (referência) — `apps/api`

| Lib | Versão | Para que serve |
| --- | --- | --- |
| fastify | 5 | Framework HTTP de alto desempenho |
| @prisma/client / prisma | 7 | ORM e migrations para PostgreSQL |
| pg | 8 | Driver PostgreSQL |
| zod | 4 | Validação de payloads (mesmos schemas do shared) |
| pino | 9 | Logger estruturado |

## Shared — `packages/shared`

Tipos TypeScript e schemas Zod usados por `web` e `api` (ex: `Trilha`, `Topico`,
`SessaoEstudo`, `Meta`, `StatusEstudo`). Fonte única da verdade dos contratos.
