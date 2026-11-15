# Wazuh na SegInfo Study

## O que a aplicação mostra

A página **Inteligência → Wazuh** reúne duas fontes diferentes:

- **Manager e agentes:** consulta somente leitura à API REST do Wazuh para exibir versão, estado dos serviços e agentes cadastrados/ativos/desconectados.
- **Alertas encaminhados:** eventos que o forwarder já normalizou e enviou a `POST /api/ingest`. A tela filtra esse recorte salvo no banco por período, regra, agente e alvo. Ela não consulta `alerts.json` diretamente nem representa todos os eventos do SIEM.

O Radar continua sendo a visão de investigação dos eventos normalizados; a página Wazuh acrescenta a saúde do manager/agentes e um recorte focado nas regras Wazuh. O endpoint de alertas exige a sessão autenticada da aplicação e filtra pelo usuário dono dos eventos. Campos cujo nome sugere senha, token, segredo, cookie ou credencial são redigidos antes de serem enviados ao navegador.

## Configuração no Coolify

Defina estas variáveis no serviço `seginfo-api` e faça redeploy:

| Variável | Uso |
| --- | --- |
| `WAZUH_API_URL` | Endereço HTTPS do manager, por exemplo `https://10.10.10.20:55000` |
| `WAZUH_API_USERNAME` | Usuário dedicado da API com permissões somente leitura |
| `WAZUH_API_PASSWORD` | Senha desse usuário (Secret no Coolify) |
| `WAZUH_API_CA_B64` | Opcional: certificado/CA PEM codificado em Base64 quando não for confiado pelo sistema |
| `WAZUH_API_TLS_INSEGURO` | Opcional, padrão `false`; `true` desativa validação TLS e deve ficar restrito ao laboratório |

O contêiner da API precisa alcançar o manager pela rede privada na porta 55000/TCP. Não exponha essa porta à Internet. Prefira certificado válido ou instale a CA do manager no contêiner; use TLS inseguro apenas temporariamente em rede isolada.

Crie no Wazuh uma identidade dedicada, com acesso de leitura aos endpoints de informação do manager, estado dos serviços e agentes. Não use a senha do administrador do Wazuh. A API recebe as credenciais somente no servidor, obtém um token de sessão e faz consultas `GET`; o navegador nunca recebe a senha ou o token.

Se as variáveis estiverem ausentes, o painel ainda lista os alertas que já chegaram pelo forwarder e informa que a consulta direta não foi configurada. Erros de rede, TLS e autenticação aparecem como estado de integração, não como contagens zeradas.

## Fluxo existente de alertas

O forwarder no manager lê `/var/ossec/logs/alerts/alerts.json`, transforma fontes suportadas e envia lotes à API com Cloudflare Access Service Token e `X-Ingest-Token`. A API valida as credenciais, normaliza e deduplica os eventos no PostgreSQL. Esse pipeline é separado da consulta REST de saúde acima. A rota `/api/ingest/pericia` também recebe relatórios de perícia dos alvos antes do reset, exibidos em **Laudos dos alvos**.

Como a origem é `alerts.json`, a cobertura depende das regras e do limiar de alerta do Wazuh e do que o forwarder sabe normalizar. Para investigação completa ou busca de eventos abaixo desse limiar, use o Wazuh Indexer/Dashboard; esta página não substitui essas ferramentas.

## Fonte nova: prompt honeypot HTTP

O experimento opcional está descrito em [`docs/RANGE.md`](RANGE.md#prompt-honeypot-http-observar-automa%C3%A7%C3%A3o-que-l%C3%AA-a-p%C3%A1gina).
O agente do grupo `range-honeypot` lê seu JSONL, regras 100281-100290 alertam sinais selecionados e
o forwarder normaliza esses alertas como `prompt_honeypot` para o Radar. O coletor não encaminha
valores de formulário. Canário seguido, troca de User-Agent e padrão temporal são indicadores para
investigação, não prova de que o visitante é uma IA.
