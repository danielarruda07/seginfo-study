# SegInfo Study — Segundo Cérebro de Segurança da Informação

Plataforma de estudo individual + agregador do homelab CRIECOMIA (Proxmox, Coolify, storage, rede), para a migração de carreira **Infraestrutura → Segurança da Informação**
do Daniel Arruda.

## Como rodar

O projeto fica em `C:\Users\eu\OneDrive\KIRO\CONTROLE DE ESTUDO`.
**Entre na pasta antes de rodar o npm** (o caminho tem espaços, use aspas):

### Opção A — CMD (mais simples)
```cmd
cd "C:\Users\eu\OneDrive\KIRO\CONTROLE DE ESTUDO"
npm install
npm run dev
```

### Opção B — PowerShell
O PowerShell pode bloquear o `npm.ps1` com o erro
*"a execução de scripts foi desabilitada neste sistema"*. Destrave uma vez:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
cd "C:\Users\eu\OneDrive\KIRO\CONTROLE DE ESTUDO"
npm install
npm run dev
```

A aplicação abre em **http://localhost:5173**.

> Erro comum: `Could not read package.json ... C:\Users\eu\package.json`
> significa que o `npm` rodou na pasta errada. Faça o `cd` para a pasta do projeto primeiro.

## Estrutura (monorepo npm workspaces)

```
apps/web            # aplicação React 19 + Vite 6 + PrimeReact 10 (o que você roda)
packages/shared     # contratos (tipos + schemas Zod) compartilhados
docs/               # documentação da stack, tema, design system e padrões
```

## Módulos (9 telas)

| Tela | O que faz |
| --- | --- |
| Painel | Progresso geral, horas, metas, progresso por trilha |
| Trilhas | 11 áreas de SegInfo (Fundamentos, Firewall, Blue/Red, SIEM, OSINT, IAM...) |
| Tópicos | Catálogo com ferramentas marcadas por referência (Gartner/OWASP/NIST); filtros + anotações |
| Meu Ambiente | Inventário vivo do homelab CRIECOMIA (hosts Proxmox, VMs, containers, storage, VLANs, policies). Sem credenciais |
| Labs | 7 labs práticos Blue/Red/Purple amarrados aos seus ativos reais |
| Sessões | Registro de tempo de estudo |
| Metas | Objetivos com prazo |
| LinkedIn | Gerador de rascunhos de post conectando sua infra à segurança |
| Arsenal IA | Biblioteca de prompts, skills e agentes de segurança, com artefatos anexos |
| Biblioteca | Read-it-later: cola URL, resume e categoriza por assunto |
| Cofre | Credenciais cifradas com AES-GCM + PBKDF2 (senha-mestra nunca é salva) |

## Biblioteca de Conhecimento — dois modos

- **Manual (sempre funciona):** cola a URL + o texto da página. O resumo, as
  palavras-chave e a categoria por assunto são gerados localmente (sem IA, sem backend).
- **Automático (Opção B):** o botão "Buscar" chama o `apps/api` (Fastify), que busca
  a página server-side (resolve CORS) e devolve título/descrição/texto limpo. Com
  proteção anti-SSRF (bloqueia hosts privados/internos/metadados de nuvem).

Para habilitar o modo automático, rode a API em um terminal separado:

```cmd
cd "C:\Users\eu\OneDrive\KIRO\CONTROLE DE ESTUDO"
npm run dev:api
```

A API sobe em `http://localhost:3001` e o Vite já encaminha `/api` para ela.
Sem a API no ar, a Biblioteca continua funcionando no modo manual.

## Decisões de segurança

- **Cofre**: senhas cifradas com AES-GCM (Web Crypto API), chave derivada por PBKDF2
  (310k iterações). A senha-mestra vive só na memória da sessão. No disco fica apenas o
  ciphertext. Nenhuma senha em texto puro na aplicação.
- **Inventário**: guarda só topologia/IPs/funções/estado — nunca segredos.

## Persistência

MVP usa `localStorage` (roda 100% no front, sem banco). O `packages/shared` e o service
`http.ts` (axios com interceptors) já deixam o caminho pronto para migrar ao
`apps/api` (Fastify + Prisma + PostgreSQL) sem reescrever as telas.
