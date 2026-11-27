# Guia para IAs (Claude, Kiro, Codex, Copilot...)

Ponto de entrada para quem vai analisar ou alterar este projeto. Leia isto antes de abrir o código.

## O que é
SegInfo Study: plataforma pessoal de estudo em Segurança da Informação do Daniel Arruda (infra → infosec),
ligada a um homelab real (Proxmox, FortiGate, Catalyst, Coolify) e a um **cyber range** com honeypot exposto
à internet por decisão própria. Interface e documentação em **português**.

## Mapa da documentação
| Assunto | Onde |
|---|---|
| Visão geral e módulos | [README.md](README.md) |
| Stack, padrões de código e de UI | [docs/STACK.md](docs/STACK.md), [docs/PATTERNS.md](docs/PATTERNS.md), [docs/UI_GUIDE.md](docs/UI_GUIDE.md), [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), [docs/THEME.md](docs/THEME.md) |
| Deploy (GitHub → Coolify, Cloudflare Tunnel + Access) | [docs/DEPLOY.md](docs/DEPLOY.md) |
| Onde cada dado fica, backup | [docs/ARMAZENAMENTO.md](docs/ARMAZENAMENTO.md) |
| Cyber range, honeypot, Wazuh (arquitetura sem dados reais) | [docs/RANGE.md](docs/RANGE.md) e [infra/range/](infra/range/) |
| Radar de ataques e ingestão (`/api/ingest`) | [docs/RADAR.md](docs/RADAR.md), [sensor/](sensor/) |
| Ferramentas de segurança/DevSecOps (Scanner, gate de CI, Reposcan, Caça ao ARTEX) | [docs/SEGURANCA.md](docs/SEGURANCA.md), [docs/SCANNER_CI.md](docs/SCANNER_CI.md), [docs/REPOSCAN.md](docs/REPOSCAN.md), [docs/REVISAO_CODIGO.md](docs/REVISAO_CODIGO.md), [infra/codescan-worker/](infra/codescan-worker/) |
| Painel Wazuh (saúde do manager/agentes, alertas encaminhados) | [docs/WAZUH.md](docs/WAZUH.md) |
| Agents (agentes de IA com aprovação de escrita) | [docs/AGENTS.md](docs/AGENTS.md) |
| Inventário e ambiente | [docs/AMBIENTE.md](docs/AMBIENTE.md) |
| Ideias de labs, sugestões e pendências | [docs/IDEIAS_LAB.md](docs/IDEIAS_LAB.md), [docs/SUGESTOES.md](docs/SUGESTOES.md), [docs/PENDENCIAS.md](docs/PENDENCIAS.md) |
| Histórico de versões | [docs/VERSOES.md](docs/VERSOES.md) |
| Diário da construção (decisões e lições, base para posts) | [packages/shared/src/diarioProjeto.ts](packages/shared/src/diarioProjeto.ts) |

## Estrutura do código
- `apps/web`: React + Vite + PrimeReact (telas em `src/routes`, serviços HTTP em `src/services`).
- `apps/api`: Fastify + Prisma + PostgreSQL (`src/*.ts`, schema em `prisma/schema.prisma`).
- `packages/shared`: tipos e schemas zod usados pelos dois lados, `VERSAO`, diário do projeto.
- `sensor/`: coletores que alimentam o Radar (shipper do honeypot, `wazuh-forwarder`). `windows/`: scripts de coleta Windows.
- `infra/range/`: scripts e regras do range em versão genérica (variáveis no lugar de endereços).

## Comandos
```bash
npm ci                                   # dependências (workspaces)
npx prisma generate --schema apps/api/prisma/schema.prisma
npm run build                            # build do web (tsc -b && vite build): é o que o Coolify roda
(cd apps/api && npx vitest run && npx tsc --noEmit -p .)
(cd apps/web && npx vitest run)
npm run dev / npm run dev:api            # local; o web funciona sem API (modo localStorage)
```

## Regras do projeto
- **Sem dados reais no repositório:** nada de IPs, nomes de host, domínios internos ou credenciais do homelab
  (o diário tem teste que rejeita isso). Dados reais entram pelo app (botões "Importar arquivo") ou ficam fora do repo.
- **Servidor primeiro:** dados no PostgreSQL via `apps/api`; segredos (ex.: `ANTHROPIC_API_KEY`) só no servidor.
- **Publicação:** commit em branch `feat/*` e avanço da `main` (Coolify publica a `main` automaticamente).
  Toda publicação aumenta `VERSAO` em `packages/shared/src/versao.ts` e ganha linha em `docs/VERSOES.md`.
- **Diário:** mudança relevante ganha entrada em `packages/shared/src/diarioProjeto.ts`, escrita como texto público.
- Outras IAs editam o repositório em paralelo: confira `git status`/`git fetch` antes de mexer e não apague trabalho alheio.

## O que fica fora do repositório (privado)
O estado real do range (endereços, IDs de VMs, regras do firewall com números, scripts com credenciais via
arquivo `.env`) fica numa pasta local do PC do Daniel, com seu próprio `README.md`, `AGENTS.md` e histórico git
sem segredos. Peça a ele acesso a essa pasta quando a análise precisar do ambiente real.
