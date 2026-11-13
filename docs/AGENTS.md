# Agents

Menu para projetar, executar e avaliar seus agentes de IA com base nos 8 pilares (propósito, instruções, modelo, ferramentas, memória, orquestração, interface, testes).

## Telas
- Meus agentes (`/agents`) e editor (`/agents/agente/:id`)
- Playground (`/agents/agente/:id/playground`): conversa com o agente e mostra cada passo do laço
- Base de conhecimento (`/agents/base`): usa tags do Segundo Cérebro (memórias pessoais, busca BM25). Memórias corporativas nunca entram.
- Ferramentas e MCP, Avaliações, Aprender (trilha "Agentes de IA")

## Como a execução funciona
O código está em `apps/api/src/agenteRuntime.ts`.

1. A tela envia o pedido (`POST /api/agentes/:id/executar`). A API cria uma linha em `AgenteExecucao` e responde na hora.
2. Em segundo plano, o laço chama o modelo com as instruções do projeto e as ferramentas ligadas.
3. Se o modelo pede uma ferramenta, o servidor valida os parâmetros, executa e devolve o resultado como dado. O laço volta ao passo 2.
4. O laço termina quando o modelo responde sem pedir ferramenta, ou num limite (8 chamadas ao modelo, 40 mil tokens de saída).
5. A tela consulta a execução a cada 1,2 s e mostra os passos gravados.

Cada pergunta é uma execução. Para continuar uma conversa, a tela envia `continuarDe` com o id da execução anterior.

### Ferramentas executáveis
Só roda o que está no `REGISTRO` do runtime **e** foi ligado ao agente no editor.

| id do catálogo | nome para o modelo | permissão |
|---|---|---|
| `busca-base` | `buscar_base` | leitura |

Para criar uma ferramenta nova: acrescente uma entrada com `definir({...})` no `REGISTRO`, usando o mesmo `id` do catálogo em `apps/web/src/data/agentesFerramentas.ts`.

## Regras
- Agente só fica `ativo` sem erros em `revisarAgente()` (ex.: ferramenta de escrita exige aprovação humana). Validado no servidor (422).
- Só agentes `arquivados` podem ser excluídos. Agente arquivado não executa.
- Ferramentas de escrita não são executadas até existir a tela de aprovação.
- Uma execução por vez por usuário.
- O pedido, as instruções do agente e os resultados das ferramentas são enviados à Anthropic. Decisão de 13/11/2026: no laboratório, isso inclui dados do ambiente quando as ferramentas de infraestrutura existirem.
- A temperatura do projeto não é enviada: o modelo atual não aceita esse parâmetro.
- Dados no PostgreSQL (tabelas `Agente`, `AgenteAvaliacao`, `AgenteExecucao`; migrations `20261112000000_agentes` e `20261113000000_agente_execucao`).

## Plano
1. **Playground com ferramentas de leitura** (feito).
2. Ferramentas de leitura do Proxmox (nós, VMs, storage, snapshots).
3. Tela de aprovação: o laço pausa numa ferramenta de escrita e só continua quando você aprova. Escrita no Proxmox.
4. FortiGate (API REST) e Catalyst 2960 (SSH): leitura, depois escrita com aprovação e backup da configuração antes de cada mudança.
5. Gatilhos por agenda e por evento, e avaliações automáticas.
6. Um agente chamando outro, servidor MCP próprio.

## Pendências
- Incluir `AgenteExecucao` no backup e restaurar agentes no `restore-backup.ts`.
- RAG com embeddings (pgvector).
