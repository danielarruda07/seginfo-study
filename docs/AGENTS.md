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

### Aprovação das ações de escrita
Ferramenta de leitura roda direto. Ferramenta de escrita nunca roda direto:

1. O modelo pede a ferramenta. O servidor valida os parâmetros e monta um resumo em uma frase (por exemplo "Desligar À FORÇA (corte de energia): VM 101 no nó pm01"). O resumo vem dos parâmetros validados, não de texto do modelo.
2. O laço para. A execução fica `aguardando_aprovacao` e o pedido é gravado na coluna `pendencia`.
3. A tela mostra o resumo e os parâmetros, com Aprovar ou Negar para cada ação.
4. `POST /api/agentes/:id/execucoes/:execId/decidir` recebe a decisão. O servidor confere que ela cobre exatamente as ações pendentes, reivindica a execução de forma atômica (dois cliques não executam duas vezes) e executa os parâmetros que ele guardou.
5. Ação negada volta ao modelo como erro "o usuário negou"; o laço continua.

Cada passo de escrita registra a decisão e a hora. A pausa sobrevive a um reinício da API, porque o estado inteiro fica no banco. Em um mesmo turno, as leituras rodam na hora e as escritas esperam; os resultados voltam juntos ao modelo.

Teste do fluxo: `npm test --workspace apps/api` (`agenteRuntime.test.ts`, com banco, modelo e Proxmox simulados).

### Ferramentas executáveis
Só roda o que está no `REGISTRO` (`apps/api/src/agenteFerramentas.ts`) **e** foi ligado ao agente no editor. Um id do catálogo pode virar várias ferramentas.

| id do catálogo | nomes para o modelo | permissão |
|---|---|---|
| `busca-base` | `buscar_base` | leitura |
| `proxmox-leitura` | `proxmox_listar_nos`, `proxmox_listar_vms`, `proxmox_detalhar_vm`, `proxmox_listar_snapshots`, `proxmox_listar_armazenamento` | leitura |
| `proxmox-escrita` | `proxmox_ligar_vm`, `proxmox_desligar_vm`, `proxmox_reiniciar_vm`, `proxmox_criar_snapshot`, `proxmox_reverter_snapshot`, `proxmox_remover_snapshot` | escrita (com aprovação) |

As ferramentas de escrita só entram quando o item do projeto está marcado como escrita no editor.

Para criar uma ferramenta nova: acrescente uma entrada com `definir({...})` no `REGISTRO`, usando o mesmo `id` do catálogo em `apps/web/src/data/agentesFerramentas.ts`.

### Proxmox
Cliente em `apps/api/src/proxmox.ts`: `proxmoxGet` lê; `proxmoxAlterar` muda o ambiente, espera a tarefa do Proxmox terminar (até 90 s) e só é chamada pelas ferramentas de escrita. Variáveis no serviço `seginfo-api` do Coolify:

| Variável | Valor |
|---|---|
| `PROXMOX_URL` | `https://ENDERECO:8006` |
| `PROXMOX_TOKEN` (Secret) | `usuario@realm!nome=segredo` |
| `PROXMOX_CA_B64` | conteúdo de `/etc/pve/pve-root-ca.pem` em base64 (`base64 -w0 /etc/pve/pve-root-ca.pem`) |
| `PROXMOX_TLS_INSEGURO` | `true` desliga a verificação do certificado; alternativa à CA, só para laboratório |

Criar o token no Proxmox: Datacenter → Permissions → API Tokens → Add. Com "Privilege Separation" marcado, dê a permissão ao próprio token em Datacenter → Permissions → Add → API Token Permission (caminho `/`, role `PVEAuditor` para leitura ou `Administrator` para o que vier depois).

O container da API precisa alcançar o Proxmox na porta 8006. Enquanto faltar variável, o playground mostra as ferramentas em cinza e diz o que falta.

## Regras
- Agente só fica `ativo` sem erros em `revisarAgente()` (ex.: ferramenta de escrita exige aprovação humana). Validado no servidor (422).
- Só agentes `arquivados` podem ser excluídos. Agente arquivado não executa.
- Toda ferramenta de escrita passa pela tela de aprovação, sem exceção e independente do campo "exige aprovação" do projeto.
- Uma execução por vez por usuário.
- O pedido, as instruções do agente e os resultados das ferramentas são enviados à Anthropic. Decisão de 13/11/2026: no laboratório, isso inclui dados do ambiente quando as ferramentas de infraestrutura existirem.
- A temperatura do projeto não é enviada: o modelo atual não aceita esse parâmetro.
- Dados no PostgreSQL (tabelas `Agente`, `AgenteAvaliacao`, `AgenteExecucao`; migrations `20261112000000_agentes`, `20261113000000_agente_execucao` e `20261113010000_agente_execucao_pendencia`).

## Plano
1. **Playground com ferramentas de leitura** (feito).
2. **Ferramentas de leitura do Proxmox** (feito; falta configurar o token e testar contra o Proxmox real).
3. **Tela de aprovação e escrita no Proxmox** (feito: energia das VMs e snapshots; falta testar contra o Proxmox real. Criar, clonar e apagar VM ficam para depois).
4. FortiGate (API REST) e Catalyst 2960 (SSH): leitura, depois escrita com aprovação e backup da configuração antes de cada mudança.
5. Gatilhos por agenda e por evento, e avaliações automáticas.
6. Um agente chamando outro, servidor MCP próprio.

## Pendências
- Incluir `AgenteExecucao` no backup e restaurar agentes no `restore-backup.ts`.
- RAG com embeddings (pgvector).
