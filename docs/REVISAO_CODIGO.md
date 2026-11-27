# Revisão de código com IA (plugin oficial claude-security)

Tela: **Inteligência → Revisão de código (IA)** (`/revisao-codigo`).

É o nível acima do Reposcan. O Reposcan procura **padrões** (segredo, config, código perigoso).
Esta revisão usa o plugin oficial da Anthropic, que **lê o código e raciocina** sobre autenticação,
autorização, injeção e lógica de negócio, e devolve achados com CWE, severidade e patches sugeridos.
É o tipo de análise que acha "autorização fail-open" ou "rota sem middleware", algo que regex não acha.

## Como funciona

```
Você (tela)                 API do SegInfo                    Worker (VM 100, usuário seginfo-codescan)
  pede a varredura  ──►  grava o pedido (fila)
                                     ◄── pega o pedido (a cada 30 s) ──
                                                         clona o repo num diretório temporário
                                                         roda o plugin no SANDBOX do próprio plugin:
                                                           sem rede além do modelo, escrita só em memória,
                                                           a chave da API fica fora (relay)
                                     ◄── devolve SARIF + relatório + patches ──
                                                         apaga o clone
  vê os achados, baixa patches,
  exporta HTML/PDF
```

- **Modos:** repositório inteiro; só as mudanças de uma branch (bom para PR); superfície de ataque
  (auditoria em 3 estágios, de 1 a 2,5 h, a mais profunda e mais cara).
- **Esforço:** baixo, médio e alto. Quanto maior, mais profunda a análise e maior o custo.
- **Nada é aplicado sozinho.** Os patches são para revisar e aplicar um por PR (`git apply F1.patch`).
- Até 5 pedidos na fila por vez. Pedido preso em execução por mais de 4 h é marcado como erro.

## Segurança do desenho

- A URL do repositório só aceita `https://…` ou `git@host:…`. Transportes que executam comando
  (`ext::`, `fd::`), `file://`, caminhos locais e opções disfarçadas (`--upload-pack=…`) são recusados.
- O `git clone` roda sem submódulos, sem seguir redirecionamento e com protocolos restritos. Se houver
  token de git, ele não aparece na linha de comando nem fica gravado no `.git/config`.
- O Claude roda com `--setting-sources=user` e sem `CLAUDE.md`/memória: **não carrega hooks,
  settings, skills nem MCP do repositório analisado**. É o mesmo endurecimento da GitHub Action oficial.
- O sandbox oficial do plugin limita a rede ao modelo e a escrita à memória. A chave da API não entra nele.
- O worker roda com usuário próprio, **sem sudo**. Ele pode executar só o "keeper" do sandbox como
  root, que é o que o `--sudo` do plugin exige no Ubuntu 24.04+. A pasta do plugin é do root e
  só-leitura para o worker; se não fosse, o worker conseguiria virar root.
- systemd limita o worker a 4 GB de RAM e 2 CPUs, porque a VM também hospeda a produção.
- As rotas do worker (`/api/scan/ci/codigo/*`) exigem o Service Token do Cloudflare Access (o mesmo do
  gate de CI) e um token próprio (`CODESCAN_WORKER_TOKEN`). Sem o token, respondem 503 (fail-closed).

> O plugin trata o código analisado como confiável. O sandbox reduz o que um repositório hostil
> consegue fazer, mas ainda é a VM de produção: para repositório de cliente desconhecido, considere
> mover o worker para uma VM dedicada mais tarde (basta rodar o mesmo `install.sh` nela).

## Instalar o worker na VM 100

1. **Chave da API:** no Console da Anthropic, crie um **workspace só para isto** (o plugin exige) com
   **limite de gasto mensal**, e uma chave nele.
2. **Token do worker:** gere com `openssl rand -hex 32`. Coloque o mesmo valor:
   - no Coolify, serviço `seginfo-api`, variável `CODESCAN_WORKER_TOKEN` (depois, Redeploy);
   - no `worker.env` da VM (passo 4).
3. **Na VM 100**, como root, a partir de uma cópia do repositório:
   ```bash
   cd infra/codescan-worker && sudo bash install.sh
   ```
   O instalador cria o usuário, instala o Claude Code e o plugin (versão fixa), o sudoers estreito e o
   serviço, e roda o `--check` do sandbox.
4. Edite `/etc/seginfo-codescan/worker.env` com a chave, o token do worker e o Service Token do Access
   (`CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`, os mesmos do gate de CI). Para repositórios
   privados, preencha `CODESCAN_GIT_TOKEN` (GitHub: PAT fine-grained, só leitura de conteúdo).
5. Inicie e acompanhe:
   ```bash
   sudo systemctl restart seginfo-codescan
   sudo journalctl -u seginfo-codescan -f
   ```
6. Faça um pedido pequeno na tela (um repositório seu, esforço baixo) e confira no log.

### Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "resposta não-JSON … barrado pelo Cloudflare Access?" | Service Token errado no `worker.env` |
| Pedido fica "na fila" | worker parado (`systemctl status seginfo-codescan`) ou API sem `CODESCAN_WORKER_TOKEN` |
| Erro de cgroup no sandbox | use `SANDBOX_ARGS=--sudo --no-cgroup` no `worker.env` (o systemd já limita a memória) |
| "git clone falhou" | repositório privado sem `CODESCAN_GIT_TOKEN`, ou branch inexistente |
| HTTP 400 da API da Anthropic | a chave não é de um workspace dedicado |

### Atualizar o plugin

O `install.sh` fixa a versão do plugin (`PLUGIN_COMMIT`). Para atualizar, troque o commit **de
propósito**, leia o changelog do plugin e rode o instalador de novo.
