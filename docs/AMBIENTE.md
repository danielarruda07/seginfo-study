# Meu Ambiente: endereços, credenciais e integrações

Este documento diz onde fica cada informação sensível do laboratório e como a tela **Meu Ambiente** (`/ambiente`) mostra isso. O repositório é público: endereços reais, tokens e senhas nunca entram aqui nem no código.

## Onde fica cada dado

| Dado | Onde fica | Quem vê | Como entra |
|---|---|---|---|
| Ativos (hosts, VMs, VLANs, serviços), endereços IP e funções | Meu Ambiente, salvo no navegador (localStorage) e incluído no backup | Só você, no navegador | Cadastro na tela ou botão "Importar arquivo" |
| Senhas e credenciais de acesso humano | Cofre (`/cofre`), cifrado no navegador com AES-GCM; a senha-mestra nunca é salva | Só você, com a senha-mestra | Cadastro no Cofre ou importação |
| Variáveis do laboratório (VLANs, portas do switch, IPs do range) | Range Vulnerável (`/range`), salvo no navegador | Só você, no navegador | Formulário de variáveis ou importação |
| Tokens e senhas que os agentes usam | Variáveis de ambiente do serviço `seginfo-api` no Coolify | Só o servidor; o navegador e o modelo de IA nunca recebem | Coolify → Environment Variables → Redeploy |

## Painel "Acessos e integrações"

Fica no topo de Meu Ambiente (`apps/web/src/routes/inventario/AcessosIntegracoes.tsx`). Mostra:

1. **Onde fica cada dado:** a tabela acima, com a situação atual (quantos ativos têm endereço, se o Cofre está criado e quantas credenciais tem quando destrancado, quantas variáveis do range estão preenchidas, quantas integrações estão prontas).
2. **Integrações do servidor:** para Proxmox, FortiGate, Catalyst 2960, Wazuh e Claude API, mostra endereço, identidade usada, tratamento do certificado, estado e as variáveis envolvidas.

Os dados das integrações vêm de `GET /api/integracoes` (`apps/api/src/integracoes.ts`). A rota nunca devolve segredo:

| Sistema | Identidade mostrada | O que nunca sai do servidor |
|---|---|---|
| Proxmox | o identificador do token (`usuario@realm!nome`) | o segredo do token e a CA |
| FortiGate | "token de API" | o token |
| Catalyst 2960 | usuário SSH e se usa senha ou chave | a senha e a chave privada |
| Wazuh | usuário da API | a senha e a CA |
| Claude API | "chave de API" e o modelo | a chave |

O teste `apps/api/src/integracoes.test.ts` confere que nenhum valor secreto aparece na resposta.

## Mudar uma integração

1. Coolify → recurso do SegInfo Study → **Environment Variables**.
2. Edite a variável pela engrenagem. Para segredo: **Literal**, **Runtime** ligado, **Buildtime** desligado.
3. **Redeploy**. O painel de Meu Ambiente e o indicador de integrações na barra superior refletem a mudança.

Variáveis de cada sistema: ver `docs/AGENTS.md` (seções Proxmox, FortiGate e Catalyst 2960), `docs/WAZUH.md` e `.env.example`.

## Sincronizar com o ambiente (botão)

O botão **Sincronizar com o ambiente**, no topo de Meu Ambiente, faz pelo servidor o que os scripts abaixo fazem nesta máquina, sem rodar nada local:

1. A API consulta, **só com leitura**, as integrações configuradas no Coolify (`GET /api/ambiente/descoberta`, código em `apps/api/src/descoberta.ts`):
   - **Proxmox:** nós, storages compartilhados, VMs e containers, com o IP visto pelo agente QEMU;
   - **FortiGate:** concessões DHCP, tabela ARP e detecção de dispositivos;
   - **switch:** tabela MAC, trunks e descrição das portas, só comandos `show`.
2. A tela mostra a prévia antes de gravar qualquer coisa:
   - quais fontes responderam;
   - o que é novo, o que muda (e em quais campos) e o que não foi visto desta vez.
3. **Aplicar** grava no inventário do navegador. Nada é apagado:
   - nome, endereço, tipo, estado e detalhes vêm da varredura;
   - função, criticidade, exposição e labs que você preencheu ficam como estão;
   - tags são somadas.

Os identificadores são os mesmos dos scripts (`lab-<nó>`, `lab-stg-<storage>`, `lab-vm-<vmid>`, `lab-dev-…`), então a sincronização atualiza o que já foi importado por arquivo em vez de duplicar. Os dados reais só trafegam entre o servidor e o seu navegador; nada vai para o repositório.

O botão não traz interfaces, policies, VIPs, o próprio FortiGate nem o switch como ativo: esses mudam pouco e continuam vindo do `import-inventario.json`.

Com uma fonte em erro, a prévia não calcula os "não vistos" (tudo daquela fonte pareceria ter sumido). Um storage compartilhado que não está montado em algum nó aparece em atenção, com o nome do nó.

## Descoberta do ambiente real (scripts)

O inventário é preenchido a partir dos próprios equipamentos, só com leitura, por scripts que ficam **fora do repositório** (na pasta de trabalho do range nesta máquina, junto com o arquivo de acessos). O resultado é um arquivo JSON importado pelo botão **Importar arquivo** de Meu Ambiente; nenhum endereço real passa pelo GitHub.

| Arquivo gerado | Script | O que traz |
|---|---|---|
| `import-inventario.json` | `gerar_import.py` | FortiGate (modelo, interfaces e VLANs, policies, VIPs), nós e storages do Proxmox, VMs, switch |
| `import-rede.json` | `coletar_rede.py` e depois `gerar_import_rede.py` | O que a rede revela: servidores físicos, NAS, pontos de acesso, estações, celulares e outros dispositivos; VMs com hostname, sistema e porta do switch |

**Fontes da descoberta de rede:** concessões DHCP, tabela ARP e detecção de dispositivos do FortiGate; tabela MAC e descrição das portas do switch (só comandos `show`); configuração das VMs e IPs vistos pelo agente QEMU no Proxmox.

**Como cada dispositivo é classificado:** os dados são juntados pelo MAC. Placas com o mesmo prefixo de MAC viram um equipamento só (por exemplo a placa de gerência e a placa de rede de um servidor). A classificação usa o identificador do cliente DHCP (`MSFT` = Windows, `ubnt` = Ubiquiti, `android-dhcp`, `udhcp` = equipamento embarcado), o hostname e a família informada pelo FortiGate. MACs do próprio FortiGate e do switch são ignorados. Celulares com MAC aleatório mudam de endereço com o tempo, então podem aparecer duplicados em importações futuras.

**Atualizar:** rodar os scripts de novo e reimportar. A importação substitui cada ativo pelo mesmo identificador, então o que você editou à mão num ativo descoberto é sobrescrito; anotações próprias ficam melhores num ativo criado por você.

## Registro de incidentes

### 13/11/2026: snapshot recusado pelo armazenamento replicado

- **O que aconteceu:** no primeiro teste da tela de aprovação, o agente pediu um snapshot, a ação foi aprovada e o servidor enviou o pedido ao Proxmox. O Proxmox recusou com "Cannot take snapshot from non-UpToDate DRBD device".
- **Causa:** o disco da VM fica num armazenamento replicado entre os dois nós (LINSTOR/DRBD). Uma das réplicas não estava sincronizada, e o LINSTOR só cria snapshot com todas em dia. O próprio Proxmox desfez o snapshot parcial e retomou a escrita do disco; nada ficou pela metade.
- **O que mostrou sobre o app:** o fluxo de aprovação funcionou de ponta a ponta. A mensagem de erro chegava como um bloco longo com dezenas de eventos e o rastro de pilha. Agora `apps/api/src/proxmoxErro.ts` extrai a última mensagem de erro e acrescenta uma dica para casos conhecidos (réplica DRBD fora de sincronia, VM travada, snapshot com nome repetido, VM desligada, falta de espaço).
- **Lições:** testar ações de escrita numa VM descartável, nunca na VM que hospeda o próprio app; e uma réplica fora de sincronia é um problema de disponibilidade a resolver mesmo sem agente nenhum.
- **Pendente:** conferir o estado da réplica no nó (`linstor resource list -r <recurso>` e `drbdadm status <recurso>`) e repetir o teste numa VM de teste.
