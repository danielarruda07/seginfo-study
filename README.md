# SegInfo Study

Plataforma pessoal de estudos em Segurança da Informação: acompanha trilhas, tópicos,
labs, sessões e metas, organiza referências e notas, e oferece ferramentas para o
homelab. O Radar de Ataques recebe eventos de fontes autorizadas; o Segundo Cérebro
guarda notas pesquisáveis com trechos e fontes.

> Vai analisar ou alterar o projeto com uma IA? Comece por [AGENTS.md](AGENTS.md). O cyber range e o honeypot estão em [docs/RANGE.md](docs/RANGE.md).

## Executar localmente

Na raiz do projeto:

```powershell
npm install
npm run dev
```

O frontend abre em `http://localhost:5173`. A Biblioteca funciona localmente; os
módulos que usam o servidor precisam da API e de um PostgreSQL configurado.

```powershell
npm run dev:api
```

Consulte [docs/DEPLOY.md](docs/DEPLOY.md) para configuração de desenvolvimento e
produção, e [docs/PENDENCIAS.md](docs/PENDENCIAS.md) para operações ainda dependentes
do ambiente hospedado.

## Módulos

| Área | Uso |
| --- | --- |
| Painel, Trilhas e Tópicos | Progresso do estudo e conteúdo de referência |
| Sessões e Metas | Registro de tempo e objetivos |
| Labs e Meu Ambiente | Exercícios ligados ao homelab e inventário |
| Radar | Análise de eventos recebidos pela API |
| Matriz ATT&CK | Cobertura por técnica: estudada, praticada, detectada e vista no Radar; exporta para o ATT&CK Navigator |
| Ameaças (KEV) | Catálogo CISA KEV filtrado pelos produtos acompanhados (requer a API) |
| Biblioteca e Arsenal IA | Referências salvas, prompts, skills e artefatos |
| LinkedIn | Estúdio com checklist e rascunhos por IA; registro dos posts publicados (manual ou `Shares.csv`) organizados pela IA e enviados ao Segundo Cérebro; diário de construção do app (`packages/shared/src/diarioProjeto.ts`). Dados no PostgreSQL; IA (Claude) roda na API com `ANTHROPIC_API_KEY` (requer a API) |
| Segundo Cérebro | Notas, captura de URLs, lixeira e busca textual BM25 com fontes |
| Armazenamento | Backup cifrado do PostgreSQL para OneDrive |
| Cofre | Segredos cifrados no cliente com AES-GCM e PBKDF2 |

## Onde os dados ficam

O conteúdo de trilhas, tópicos e labs é mantido no código. Dados pessoais variam
conforme o módulo e o modo disponível: parte das telas ainda usa `localStorage`; as
telas migradas usam a API Fastify e PostgreSQL. Consulte
[docs/ARMAZENAMENTO.md](docs/ARMAZENAMENTO.md) para saber exatamente o que entra no
backup externo e o que ainda permanece apenas no navegador.

O Cofre cifra os segredos no navegador. O backup local inclui o inventário do
homelab em texto legível e o blob cifrado do Cofre; proteja o arquivo exportado como
dado sensível. O inventário inicial no código também contém detalhes reais do homelab;
mantenha este repositório privado ou remova/redija esses dados antes de publicar. O
backup externo cifra a exportação do banco com uma chave pública; a
chave privada de restauração deve permanecer fora do servidor e da conta que guarda
os backups.

## Estrutura

```text
apps/web          React + Vite
apps/api          Fastify + Prisma
packages/shared   tipos e schemas Zod
docs/             operação, arquitetura e decisões
sensor/           componentes do coletor do Radar
windows/          script de envio de eventos Windows
```

## Guias

- [Radar de Ataques](docs/RADAR.md): limites, autorização e configuração do coletor.
- [Armazenamento externo](docs/ARMAZENAMENTO.md): conexão OneDrive e restauração.
- [Deploy](docs/DEPLOY.md): configuração de ambientes.
- [Pendências](docs/PENDENCIAS.md): tarefas operacionais e próximos passos.
