# Agents

Menu para projetar seus agentes de IA com base nos 8 pilares (propósito, instruções, modelo, ferramentas, memória, orquestração, interface, testes). O módulo **não executa** agentes: projeta, avalia e gera a especificação em Markdown.

## Telas
- Meus agentes (`/agents`) e editor (`/agents/agente/:id`)
- Base de conhecimento (`/agents/base`): usa tags do Segundo Cérebro (memórias pessoais, busca BM25). Memórias corporativas nunca entram.
- Ferramentas e MCP, Avaliações, Aprender (trilha "Agentes de IA")

## Regras
- Agente só fica `ativo` sem erros em `revisarAgente()` (ex.: ferramenta de escrita exige aprovação humana). Validado no servidor (422).
- Só agentes `arquivados` podem ser excluídos.
- Dados no PostgreSQL (tabelas `Agente`, `AgenteAvaliacao`; migration `20261112000000_agentes`), incluídos no backup.

## Próximos passos
- Playground/execução usando `ia.ts` (exige `ANTHROPIC_API_KEY`; conteúdo sai para a Anthropic).
- Restaurar agentes no `restore-backup.ts`.
- RAG com embeddings (pgvector).
