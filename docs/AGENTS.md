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

#### Modo autônomo (ações leves rodam direto)

No editor do agente, aba Supervisão, "Autonomia nas ações de escrita":

- **Aprovar toda ação de escrita** (padrão): tudo para na tela de aprovação.
- **Ações leves rodam direto; destrutivas pedem aprovação**: o servidor classifica cada chamada pelos parâmetros validados (`leve` em cada `definir({...})` de `agenteFerramentas.ts`). O modelo do Operador do Homelab já vem assim.

| Leve (roda direto no modo autônomo) | Destrutiva (sempre pede aprovação) |
|---|---|
| Ligar, reiniciar, desligar limpo, migrar, ajustar recursos (VM parada), criar snapshot, criar e clonar VM | Desligar à força, reverter e apagar snapshot, apagar VM, redimensionar em lote |
| Criar policy desativada no FortiGate | Criar policy já ativa, ativar ou desativar policy |
| Criar VLAN e acrescentar VLAN a trunk no switch | Configurar porta access, configurar SPAN |
| Reiniciar agentes Wazuh; criar host, item e template e vincular template no Zabbix | Reiniciar o manager Wazuh |
| Iniciar, reiniciar e fazer deploy no Coolify | Parar recurso no Coolify |
| — | Comando livre dentro de uma VM (`proxmox_executar_no_convidado`) |

Por que não liberar tudo: o Cloudflare Access controla quem entra no app, mas os alertas do Wazuh, os honeypots e o Radar trazem texto escrito por atacantes. A aprovação nas ações destrutivas é o que impede uma frase plantada num log de virar "apague a VM". Ações autônomas ficam na auditoria como `autonoma` e contam no teto diário de escritas; sem folga no teto, voltam a pedir aprovação.

Cada passo de escrita registra a decisão e a hora. A pausa sobrevive a um reinício da API, porque o estado inteiro fica no banco. Em um mesmo turno, as leituras rodam na hora e as escritas esperam; os resultados voltam juntos ao modelo.

Teste do fluxo: `npm test --workspace apps/api` (`agenteRuntime.test.ts`, com banco, modelo e Proxmox simulados).

### Ferramentas executáveis
Só roda o que está no `REGISTRO` (`apps/api/src/agenteFerramentas.ts`) **e** foi ligado ao agente no editor. Um id do catálogo pode virar várias ferramentas.

| id do catálogo | nomes para o modelo | permissão |
|---|---|---|
| `busca-base` | `buscar_base` | leitura |
| `proxmox-leitura` | `proxmox_listar_nos`, `proxmox_listar_vms`, `proxmox_detalhar_vm`, `proxmox_listar_snapshots`, `proxmox_listar_armazenamento`, `proxmox_listar_isos`, `proxmox_proximo_vmid`, `proxmox_info_convidado`, `proxmox_consultar_convidado` (consultas prontas dentro da VM) | leitura |
| `proxmox-escrita` | `proxmox_redimensionar_lote`, `proxmox_ajustar_recursos_vm`, `proxmox_migrar_vm`, `proxmox_ligar_vm`, `proxmox_desligar_vm`, `proxmox_reiniciar_vm`, `proxmox_criar_snapshot`, `proxmox_reverter_snapshot`, `proxmox_remover_snapshot`, `proxmox_criar_vm`, `proxmox_clonar_vm`, `proxmox_apagar_vm`, `proxmox_executar_no_convidado` | escrita (com aprovação) |
| `fortigate-leitura` | `fortigate_listar_interfaces`, `fortigate_listar_policies`, `fortigate_listar_enderecos`, `fortigate_contar_sessoes_negadas` | leitura |
| `fortigate-escrita` | `fortigate_criar_policy` (entra desativada por padrão), `fortigate_definir_status_policy` | escrita (com aprovação) |
| `catalyst-leitura` | `catalyst_mostrar_vlans`, `catalyst_mostrar_interfaces`, `catalyst_mostrar_trunk`, `catalyst_mostrar_span`, `catalyst_mostrar_running_config_interface` | leitura |
| `catalyst-escrita` | `catalyst_criar_vlan`, `catalyst_configurar_porta_access`, `catalyst_adicionar_vlan_ao_trunk` (nunca remove VLANs existentes), `catalyst_configurar_span` | escrita (com aprovação) |
| `wazuh-leitura` | `wazuh_listar_agentes`, `wazuh_status_manager`, `wazuh_buscar_alertas` (indexador) | leitura |
| `wazuh-escrita` | `wazuh_reiniciar_agentes`, `wazuh_reiniciar_manager` | escrita (com aprovação) |
| `zabbix-leitura` | `zabbix_listar_hosts`, `zabbix_listar_grupos`, `zabbix_listar_templates`, `zabbix_listar_problemas` | leitura |
| `zabbix-escrita` | `zabbix_criar_host`, `zabbix_criar_template`, `zabbix_criar_item`, `zabbix_vincular_template_host` | escrita (com aprovação) |
| `coolify-leitura` | `coolify_listar_recursos`, `coolify_listar_deploys` | leitura |
| `coolify-escrita` | `coolify_acao_recurso` (start, restart, stop), `coolify_deploy_aplicacao` | escrita (com aprovação) |
| `osint-passivo` | `osint_certificados` (crt.sh), `osint_exposicao_ip` (Shodan InternetDB; sem alvo usa o IP público do servidor), `osint_dns` (resolvedores públicos, análise de SPF, DMARC e CAA) | leitura, sem credencial |

As ferramentas de escrita só entram quando o item do projeto está marcado como escrita no editor.

Para criar uma ferramenta nova: acrescente uma entrada com `definir({...})` no `REGISTRO`, usando o mesmo `id` do catálogo em `apps/web/src/data/agentesFerramentas.ts`.

### Controle de custo
Dois tetos diários por usuário, somando todos os agentes, resetados à meia-noite (horário do servidor):

| Teto | Padrão | Variável |
|---|---|---|
| Execuções (pedidos) iniciadas por dia | 60 | `AGENTES_LIMITE_DIARIO_EXECUCOES` |
| Ações de escrita aprovadas ou autônomas por dia (inclui MCP) | 30 | `AGENTES_LIMITE_DIARIO_ESCRITAS` |
| Chamadas ao modelo por pedido | 24 | `AGENTES_LIMITE_VOLTAS` |
| Tokens de saída por pedido | 100 mil | `AGENTES_LIMITE_TOKENS_SAIDA` |

Continuar uma conversa (`continuarDe`) não conta como nova execução. Negar uma ação não conta como
aprovada. Ao atingir o teto, a rota responde 429 com uma mensagem explicando qual teto foi atingido.
`GET /api/agentes/runtime` devolve `custoHoje` (quanto já foi usado) e
`limites.execucoesPorDia`/`limites.escritasAprovadasPorDia`, e o Playground mostra isso antes do chat.

Isto é um limite de CUSTO, não de segurança de acesso: o controle de risco de uma ação que altera o
ambiente continua sendo a aprovação humana de cada ação, não este teto.

### Auditoria (sem SIEM ainda)
Hoje as ações dos agentes NÃO chegam ao Wazuh (não há SIEM central rodando). Até isso existir, a
visão de auditoria é a tela `/agents/auditoria` e o endpoint que a alimenta:

`GET /api/agentes/auditoria?agenteId=&somenteEscrita=&somenteErro=&desde=&limite=`

Devolve `{ total, acoes: AcaoAuditoria[] }`, mais recente primeiro:

```ts
interface AcaoAuditoria {
  execucaoId: string; agenteId: string; agenteNome: string; ferramenta: string;
  entrada: unknown;       // parâmetros validados que a ferramenta recebeu
  saida: string;          // o que voltou ao modelo
  erro: boolean;
  decisao: 'aprovada' | 'negada' | 'automatica'; // automatica = leitura, roda sem aprovação
  decididoEm: string | null; // ISO; null para leitura (não passa por decisão humana)
  ms: number;
}
```

Este formato é estável de propósito: outra IA ou agente (inclusive um agente deste próprio app)
pode consultar esta rota para decidir o que fazer com pendências (por exemplo "liste as ações de
escrita negadas na última semana" ou "alguma ferramenta falhou hoje?"), sem precisar entender o
formato interno de `AgenteExecucao.passos`. Quando houver SIEM, o destino natural é replicar estes
mesmos eventos para lá (syslog ou API do Wazuh) em vez de descontinuar este endpoint.

### Proxmox
Cliente em `apps/api/src/proxmox.ts`: `proxmoxGet` lê; `proxmoxAlterar` muda o ambiente, espera a tarefa do Proxmox terminar (até 90 s) e só é chamada pelas ferramentas de escrita. Erros do Proxmox passam por `proxmoxErro.ts`, que corta o rastro de pilha, extrai a última mensagem de erro do LINSTOR e acrescenta uma dica para casos conhecidos. Variáveis no serviço `seginfo-api` do Coolify:

| Variável | Valor |
|---|---|
| `PROXMOX_URL` | `https://ENDERECO:8006` |
| `PROXMOX_TOKEN` (Secret) | `usuario@realm!nome=segredo` |
| `PROXMOX_CA_B64` | conteúdo de `/etc/pve/pve-root-ca.pem` em base64 (`base64 -w0 /etc/pve/pve-root-ca.pem`) |
| `PROXMOX_TLS_INSEGURO` | `true` desliga a verificação do certificado; alternativa à CA, só para laboratório |

Criar o token no Proxmox: Datacenter → Permissions → API Tokens → Add. Com "Privilege Separation" marcado, dê a permissão ao próprio token em Datacenter → Permissions → Add → API Token Permission (caminho `/`, role `PVEAuditor` para leitura ou `Administrator` para o que vier depois).

O container da API precisa alcançar o Proxmox na porta 8006. Enquanto faltar variável, o playground mostra as ferramentas em cinza e diz o que falta.

#### Dentro das VMs (agente QEMU)

As ferramentas passam pelo Proxmox (`agent/exec`): não precisam de rede até a VM nem da senha dela, e o sistema (Linux ou Windows) é detectado sozinho. Exige o `qemu-guest-agent` instalado e ligado na VM (Options → QEMU Guest Agent) e, no token, `VM.Monitor` (até PVE 8) ou `VM.GuestAgent.*` (PVE 9).

- **`proxmox_info_convidado`**: sistema, hostname e IPs reais.
- **`proxmox_consultar_convidado`**: consultas prontas e só leitura (`servicos`, `falhas`, `processos`, `portas`, `disco`, `memoria`, `usuarios`, `logs`, `rede`, `agentes-seguranca`). O modelo escolhe o item; o comando é fixo no servidor.
- **`proxmox_executar_no_convidado`**: comando livre como root/SYSTEM (shell no Linux, PowerShell no Windows), até 300 s. Sempre pede aprovação, inclusive no modo autônomo. Saída cortada em 15 mil caracteres (fica o fim).

#### Criar, clonar e apagar VM

- **`proxmox_criar_vm`**: VM nova e desligada, com um disco, uma placa de rede (bridge e VLAN opcional) e, se informada, a ISO de instalação. Recebe a tag `criada-por-agente`. Os campos têm formato fechado (nome de bridge, de storage e o volid da ISO), então o modelo não consegue acrescentar outra opção à VM. Espera a tarefa por até 3 min.
- **`proxmox_clonar_vm`**: cópia completa dos discos por padrão; `completo=false` faz clone ligado, que só funciona a partir de um modelo. Aceita outro nó e outro storage de destino. Espera até 5 min; cópia maior que isso continua no Proxmox e a ferramenta avisa que está em andamento.
- **`proxmox_apagar_vm`**: apaga a VM ou o container com os discos (`purge`). Antes de apagar, o servidor confere com o estado atual do Proxmox, e recusa se qualquer item falhar:
  1. o VMID não está em `PROXMOX_VMS_PROTEGIDAS`;
  2. o nome atual é igual a `nomeConfirmacao`;
  3. a proteção do Proxmox (Options → Protection) está desligada;
  4. a VM está parada.
- Apoio, só leitura: `proxmox_proximo_vmid` (número livre) e `proxmox_listar_isos` (volids de um storage).

#### Ajustar recursos e migrar VM

- **`proxmox_ajustar_recursos_vm`**: atualiza memória e/ou cores de uma VM QEMU ou container LXC, mas recusa operar enquanto o alvo estiver ligado. O agente deve consultar configuração e capacidade dos nós antes; após a mudança, o alvo permanece desligado.
- **`proxmox_migrar_vm`**: migra uma VM QEMU para um nó online do cluster. Migração online exige VM ligada; offline exige VM parada. A ferramenta confere origem, estado, destino e proteção da VM. Compatibilidade de CPU, storage e rede continuam sendo pré-requisitos do cluster e precisam ser analisados antes da aprovação.
- **`proxmox_redimensionar_lote`**: recebe até 20 alvos e os valores atuais esperados, valida todos antes de agir, desliga limpo apenas os que estavam ligados, aplica somente reduções de memória/cores e restaura o estado ligado original. Se falhar, interrompe e tenta religar o que parou; o resultado informa alterações parciais e falhas de restauração. Uma única aprovação cobre exatamente os parâmetros e VMIDs mostrados no resumo e na entrada da ação.
- As ferramentas exigem aprovação humana e usam parâmetros fechados. O lote não migra VMs; para isso use `proxmox_migrar_vm` em uma etapa separada após validar capacidade, storage e rede.

| Variável | Valor |
|---|---|
| `PROXMOX_VMS_PROTEGIDAS` | VMIDs que nenhum agente pode apagar, separados por vírgula. Coloque aqui a VM que hospeda o próprio app (ex.: `100`). |

Permissões do token para criar e clonar: `VM.Allocate`, `VM.Clone`, `VM.Config.*`, `Datastore.AllocateSpace` e, para usar a bridge, `SDN.Use`. Sem elas, o Proxmox responde 403 e a ferramenta diz qual caminho faltou.

### FortiGate
Cliente em `apps/api/src/fortigate.ts`: `fortigateGet` lê `/api/v2/cmdb/...` e `/api/v2/monitor/...`;
`fortigateAlterar` (POST/PUT) muda a configuração e só é chamada pelas ferramentas de escrita.
Autenticação por API token no header `Authorization: Bearer`, nunca na URL. Variáveis no serviço
`seginfo-api` do Coolify:

| Variável | Valor |
|---|---|
| `FORTIGATE_URL` | `https://ENDERECO:PORTA` (porta de gerência, ex.: 443 ou a porta HTTPS admin configurada) |
| `FORTIGATE_TOKEN` (Secret) | token de um admin REST API (System → Administrators → Create New → REST API Admin) |
| `FORTIGATE_TLS_INSEGURO` | `true` desliga a verificação do certificado; use em laboratório se o certificado da interface de gerência for autoassinado |

Criar o admin REST API no FortiGate: System → Administrators → Create New → REST API Admin, escolher
um Administrator Profile (crie um dedicado, não use `super_admin`) e, se precisar, restringir por
"Trusted Hosts" ao IP do container da API. `fortigate_criar_policy` sempre cria a policy desativada
(`status: disable`) a menos que o modelo peça `ativarAgora: true` — mesmo assim, ativar passa pela
tela de aprovação como qualquer outra ação de escrita.

### Catalyst 2960
Cliente em `apps/api/src/catalyst.ts`: abre uma sessão SSH por chamada (sem pool), envia os comandos
IOS e lê a saída até o prompt voltar. Não há "modo CLI livre": cada ferramenta de escrita monta a
lista exata de comandos a partir dos parâmetros validados — o modelo nunca escreve o comando em si.
Variáveis no serviço `seginfo-api` do Coolify:

| Variável | Valor |
|---|---|
| `CATALYST_HOST` | IP ou hostname do switch |
| `CATALYST_PORT` | porta SSH (padrão 22) |
| `CATALYST_USER` | usuário SSH (local ou TACACS+) |
| `CATALYST_PASSWORD` (Secret) | senha SSH — ou use `CATALYST_PRIVATE_KEY_B64` em vez desta |
| `CATALYST_PRIVATE_KEY_B64` (Secret) | chave privada PEM em base64, alternativa à senha |

| `CATALYST_ENABLE_PASSWORD` (Secret) | senha de `enable`, se o usuário não entra direto em modo privilegiado |
| `CATALYST_HOST_KEY_SHA256` | impressão digital da chave SSH do switch. Com ela, o servidor recusa conversar com outro equipamento no mesmo IP. O "Testar conexão" mostra o valor |

Toda sessão manda `terminal length 0` antes dos comandos (sem `--More--`) e, com a senha de enable definida, entra em modo privilegiado sozinha.

O 2960 precisa de `ip ssh version 2`, um usuário com privilégio para `configure terminal` (ou
`enable` configurado separadamente — hoje o cliente não envia `enable`, pressupõe um usuário que já
entra em modo privilegiado) e `line vty ... login local` com SSH habilitado. IOS antigos só oferecem
troca de chave e cifras mais antigas (DH group14/group1 SHA1, AES-CBC, 3DES); o cliente já habilita
essas opções porque o `ssh2` não as liga por padrão.

### Wazuh
Cliente em `apps/api/src/wazuh.ts`, consultado pela tela `/wazuh` e por ferramentas dos agentes. O catálogo oferece consulta de status/agentes e reinício de agentes ou manager; edição de regras e arquivos de configuração ainda não está disponível. Variáveis e detalhes em [docs/WAZUH.md](WAZUH.md). Use uma identidade API dedicada com permissões apenas nos endpoints necessários.

Alertas: `wazuh_buscar_alertas` consulta o indexador (OpenSearch, porta 9200, índice `wazuh-alerts-*`), porque a API do manager não devolve alertas. Variáveis `WAZUH_INDEXER_URL`, `WAZUH_INDEXER_USERNAME`, `WAZUH_INDEXER_PASSWORD` (Secret) e `WAZUH_INDEXER_CA_B64` ou `WAZUH_INDEXER_TLS_INSEGURO=true`. Cliente em `apps/api/src/wazuhIndexador.ts`.

### Coolify
Cliente em `apps/api/src/coolify.ts`. `COOLIFY_URL` é o endereço do painel visto de dentro do container (ex.: `http://IP-DA-VM:8000`) e `COOLIFY_API_TOKEN` (Secret) um token de Keys & Tokens com permissão de deploy. Ações de ciclo de vida tentam POST e, em versões antigas da v4, repetem com GET. Reiniciar ou fazer deploy do próprio SegInfo Study derruba a API e interrompe a conversa.

### Zabbix
Cliente JSON-RPC em `apps/api/src/zabbix.ts`. Configure no serviço `seginfo-api` do Coolify:

| Variável | Uso |
|---|---|
| `ZABBIX_API_URL` | URL HTTPS completa do endpoint JSON-RPC (ex.: `https://zabbix.example/api_jsonrpc.php`) |
| `ZABBIX_API_TOKEN` (Secret) | Token de API de uma conta dedicada |
| `ZABBIX_CA_B64` | Opcional: CA PEM em Base64 para certificado privado |
| `ZABBIX_TLS_INSEGURO` | Opcional; `true` desliga validação TLS, somente em laboratório isolado |

O servidor precisa alcançar o frontend/API do Zabbix. O catálogo permite consultar hosts, grupos, templates e problemas; criar host e template em grupos existentes; criar itens simples de Zabbix agent/agent ativo; e vincular template a host. Criação de itens não aceita scripts, comandos remotos ou itens HTTP. Templates podem receber itens; triggers, discovery rules e ações ainda não estão implementados. A API JSON-RPC recebe somente métodos definidos no código.

Isto NÃO substitui a observação acima sobre auditoria dos agentes: as ações dos agentes de IA
continuam fora do Wazuh até existir um encaminhamento explícito delas para o manager.

## Guia de uso em cada tela

Toda tela de Agents tem, logo abaixo do título, a barra "Como usar". Ela abre uma ficha com: para que serve, passo a passo, capacidades, exemplos de pedido, o que já funciona no servidor (integrações e limites do dia), cuidados e "Melhorar com o tempo". O texto fica em `apps/web/src/routes/agents/guia/conteudo.ts`: ao mudar o que uma tela faz, atualize o guia dela. A ficha de cada ferramenta também mostra exemplos de pedido (`EXEMPLOS_FERRAMENTA`).

"Melhorar com o tempo" traz sugestões calculadas da auditoria e das avaliações, sem IA (`guia/aprendizado.ts`): ferramenta que falhou 3 vezes ou mais (com o último erro), ação negada 2 vezes ou mais (escreva a restrição), 3 ou mais ações leves aprovadas à mão (ligue o modo autônomo), agente que já rodou sem casos de teste, casos com falha, pendência grave na revisão e agentes com o mesmo nome. Para isso, `GET /api/agentes/runtime` informa o `nivel` de cada ferramenta e `GET /api/agentes` a `autonomia` de cada agente.

## Testar conexão

Em Meu Ambiente → Acessos e integrações, cada integração tem "Testar conexão" (`POST /api/integracoes/:id/testar`). O servidor faz uma consulta mínima e só leitura (versão do Proxmox e nós, status do FortiGate, `show version` no switch, versão do manager Wazuh, alertas das últimas 24 h, contagem de hosts no Zabbix, aplicações do Coolify) e mostra o erro real quando falha: rede, certificado ou credencial.

## MCP: as mesmas ferramentas no Claude Code, de qualquer computador

`POST /api/mcp` é um servidor MCP (Streamable HTTP, sem sessão) com todas as ferramentas do `REGISTRO`, menos a busca na base de um agente. Código em `apps/api/src/mcp.ts`.

- **Acesso, duas camadas:** uma aplicação do Cloudflare Access só para o caminho `/api/mcp`, com política *Service Auth* (`CF_ACCESS_MCP_AUD` e `CF_ACCESS_MCP_CLIENT_ID`, que pode ser o mesmo Service Token da ingestão), e `Authorization: Bearer MCP_TOKEN`. Sem as variáveis, a rota responde 503.
- **Escrita:** o Claude Code pede sua permissão antes de cada chamada não liberada, e as ferramentas destrutivas chegam marcadas com `destructiveHint`. Não coloque as destrutivas na lista de permitidas. `MCP_DESTRUTIVAS=bloquear` desliga as destrutivas pelo MCP.
- **Auditoria:** cada chamada vira uma execução do agente "Acesso MCP (Claude Code e outros clientes)", criado sozinho, e aparece em `/agents/auditoria`. Escritas contam no teto diário; chamadas MCP não contam no teto de execuções (não usam o modelo do servidor).

Configurar no Claude Code (em qualquer computador):

```
claude mcp add --transport http homelab https://<domínio do app>/api/mcp \
  --header "CF-Access-Client-Id: <client id do Service Token>" \
  --header "CF-Access-Client-Secret: <client secret>" \
  --header "Authorization: Bearer <MCP_TOKEN>"
```

Os acessos do `range.env` (fora do repositório) vão para o Coolify pelo script privado `sync_coolify_env.py` da pasta do range: por padrão ele só cria as variáveis que faltam, nunca imprime valores e gera o `MCP_TOKEN`.

## Regras
- Agente só fica `ativo` sem erros em `revisarAgente()` (ex.: ferramenta de escrita exige aprovação humana). Validado no servidor (422).
- Só agentes `arquivados` podem ser excluídos. Agente arquivado não executa.
- Toda ferramenta de escrita passa pela tela de aprovação, independente do campo "exige aprovação" do projeto. A única exceção são as ações leves com o agente em "leves-automaticas" (ver Modo autônomo); destrutivas nunca rodam sem aprovação no Playground.
- Uma execução por vez por usuário.
- O pedido, as instruções do agente e os resultados das ferramentas são enviados à Anthropic. No laboratório, isso inclui dados do ambiente quando as ferramentas de infraestrutura estão ligadas ao agente (Proxmox, FortiGate, Catalyst 2960, Wazuh e Zabbix).
- A temperatura do projeto não é enviada: o modelo atual não aceita esse parâmetro.
- Dados no PostgreSQL (tabelas `Agente`, `AgenteAvaliacao`, `AgenteExecucao`; migrations `20261112000000_agentes`, `20261113000000_agente_execucao` e `20261113010000_agente_execucao_pendencia`).
- Dependência nova: `ssh2` (cliente SSH do Catalyst), versão pinada em `apps/api/package.json`.

## Plano
1. **Playground com ferramentas de leitura** (feito).
2. **Ferramentas de leitura do Proxmox** (feito e testado contra o Proxmox real em 13/11/2026).
3. **Tela de aprovação e escrita no Proxmox** (feito: energia, recursos, migração, snapshots e ciclo de vida de VMs; falta validar as novas operações contra versões e permissões reais do cluster).
4. **FortiGate (API REST) e Catalyst 2960 (SSH)** (feito: leitura e escrita com aprovação; falta configurar as variáveis e testar contra os equipamentos reais. Backup automático da configuração antes de cada mudança de escrita ainda não existe — hoje a mitigação é: policy nova entra desativada, e "adicionar ao trunk" nunca remove VLANs).
5. **Wazuh e Zabbix no catálogo de agentes** (feito em parte: Wazuh consulta/reinício; Zabbix consulta, cria host/template/item e vincula template. Falta validar com versões e contas reais; edição de regras Wazuh, triggers/discovery do Zabbix e roteador da operadora seguem pendentes).
6. Gatilhos por agenda e por evento, e avaliações automáticas.
7. Servidor MCP próprio (feito: `/api/mcp`, v0.29.0). Um agente chamando outro segue pendente.
8. Roteador da operadora e NAS (só têm painel web, sem API estável) e o host Proxmox avulso fora do cluster: pendentes.

## Pendências
- Incluir `AgenteExecucao` no backup e restaurar agentes no `restore-backup.ts`.
- RAG com embeddings (pgvector).
