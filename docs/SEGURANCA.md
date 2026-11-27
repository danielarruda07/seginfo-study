# Ferramentas de segurança / DevSecOps do SegInfo

Este documento reúne **tudo** que foi implantado a nível de segurança ofensiva/defensiva (v0.49 → v0.57),
para que serve cada parte, como usar e — principalmente — **onde fica a fronteira** (autorizado, não
destrutivo, auditável). Documentos específicos: [SCANNER_CI.md](SCANNER_CI.md), [REPOSCAN.md](REPOSCAN.md).

> **Regra de ouro (vale para tudo abaixo):** só use em alvos que você tem autorização por escrito para
> testar (seus sistemas ou os do cliente, dentro do escopo). O padrão é **ler/sinalizar, não explorar**.
> Nada de operação destrutiva, e nenhum dado do alvo é enviado para fora.

---

## Visão geral — três frentes

| Frente | Ferramenta | O que faz | Onde |
|---|---|---|---|
| **Testar endpoint/API ao vivo** | Scanner de endpoints | Higiene + sinais de vulnerabilidade de uma URL | App → Inteligência → Scanner |
| **Testar código/repositório** | Reposcan (CLI) | Análise estática de um repo clonado | Terminal: `scripts/reposcan.sh` |
| **Detectar ataque agêntico** | Caça ao ARTEX | Referência de detecção/hunting | App → Inteligência → Caça ao ARTEX |
| **Método e referência** | Metodologia de Pentest | Ciclo de 7 fases ligado ao ATT&CK | App → Prática → Metodologia |

---

## 1. Scanner de endpoints (ao vivo, no servidor)

Testa **uma URL de API/endpoint** (interno ou externo). Roda no servidor do homelab, atrás do Cloudflare
Access. **Não destrutivo:** só `GET`/`HEAD`/`OPTIONS`.

### 1a. Higiene (sempre)
- **TLS/certificado:** protocolo, emissor, validade, cadeia confiável.
- **Cabeçalhos de segurança:** HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Métodos HTTP** expostos (via `OPTIONS`), **cookies** (Secure/HttpOnly/SameSite), **CORS** (reflexo de origem, credenciais).
- **Tecnologia** (fingerprint pelos cabeçalhos), **rate-limit/Cache-Control** visíveis.
- **Exposições comuns:** `/.git`, `/.env`, `/actuator`, `/swagger.json`, `/server-status`…
- **Superfície da API:** lê a spec **OpenAPI/Swagger** e conta rotas e operações.
- **Erro verboso** no corpo (stack trace, SQL, caminho/IP interno).
- **Lote** de até 15 URLs; **export** do laudo em Markdown e JSON.

### 1b. Testes ativos benignos (opt-in — caixa "Testes ativos seguros")
Cada teste é **uma requisição GET a mais** com marcador inofensivo; os achados saem como **"a confirmar"**:
- **Reflexo de entrada** (candidato a XSS refletido).
- **Open redirect** (parâmetros comuns; olha o `Location` sem seguir).
- **Autorização não forçada** (compara resposta com e sem credencial de prova).
- **Sinal de SQL injection** (injeta **uma aspa simples** e procura erro de banco na resposta).
- **Canário de prompt injection** (instrução benigna; vê se o modelo de IA obedece).

> ⚠️ **Endpoints de transação/escrita de produção:** **não** rode os testes ativos neles (podem criar
> transação/corromper dado). Para esses, use a análise estática (Reposcan) + um ambiente de staging.

### 1c. Analisar JWT (offline)
Caixa na própria tela: cole um token e ela decodifica header/payload **no navegador, sem rede e sem a
chave** (não verifica a assinatura). Aponta: `alg: none`, HS simétrico (forjável se o segredo for fraco),
falta de `exp`, validade longa, claim sensível no payload, `kid` suspeito.

---

## 2. Gate de CI (rota assinada) — `POST /api/scan/ci`

O mesmo motor do Scanner, chamável pela **esteira/pipeline** sem navegador. Autenticação **HMAC-SHA256**
sobre o corpo (segredo `SCAN_CI_SECRET`), atrás de um **Service Token** do Cloudflare Access. Devolve
veredito de **quality gate**: HTTP `200` passou, `422` reprovou (limites de achados configuráveis). Script
pronto: `scripts/scan-ci.sh`. Detalhes: [SCANNER_CI.md](SCANNER_CI.md).

---

## 3. Reposcan — análise estática de repositório (CLI)

Roda na **sua máquina** sobre um repositório clonado. **Só lê arquivos** — nunca instala dependências nem
roda a suíte do repo (isso executaria código não confiável). Detalhes: [REPOSCAN.md](REPOSCAN.md).

```bash
scripts/reposcan.sh /caminho/do/repo            # pasta já clonada
scripts/reposcan.sh https://github.com/dono/repo # clona raso, analisa e apaga
scripts/reposcan.sh <alvo> --json --fail-on media
```

Encontra:
- **Segredos:** AWS keys, chaves privadas, tokens (GitHub/Slack/Google/Stripe), JWT, `password/secret/token = "..."`, `.env` com valor.
- **Dependências:** inventário de `package.json`/`requirements.txt`; versão sem pin, HTTP inseguro, scripts de `install` (supply-chain).
- **Docker/IaC/CI:** root, `:latest`, `ADD` remoto, `curl|bash`, segredo em `ENV`; compose `privileged`/`host`; workflow `pull_request_target`, action sem SHA, injeção de `github.event`.
- **Código perigoso:** `eval`, `exec` concatenado, `shell=True`, `pickle.loads`, `yaml.load` inseguro, `os.system`, hash fraco.
- **Injeção:** SQLi (query concatenada, `cursor.execute` com f-string/`%`/`.format`), NoSQL (`find(req.body)`, `$where`), SSTI (`render_template_string`), command injection (PHP/Ruby/Java), prompt injection (entrada do usuário no prompt do LLM).
- **JWT (no código):** `alg: none`, `jwt.decode` sem verificar, `verify=False`, `ignoreExpiration`, segredo embutido.

Código de saída: `0` limpo · `1` reprovou (serve de gate) · `2` erro. Saída em texto ou JSON.

---

## 4. Caça ao ARTEX (defensivo)

Referência de **detecção e hunting** do framework ofensivo agêntico ARTEX, mapeada ao ATT&CK. O framework
**não** é embutido (é um agente ofensivo autônomo, risco de supply-chain). Traz sinais comportamentais por
camada (loop do agente, web, identidade, host, nuvem) com dica de caça, e marcadores (UAs/headers/IPs)
tratados como indício. App → Inteligência → Caça ao ARTEX.

---

## Posso varrer código / repositórios do GitHub em busca de vulnerabilidades?

**Sim, para repositórios** — com o Reposcan, análise **estática**:

```bash
scripts/reposcan.sh https://github.com/dono/repo --fail-on media
```

- **Público:** funciona direto (clone raso).
- **Privado:** funciona se o `git` da sua máquina estiver autenticado (SSH key ou token), porque o clone usa a sua credencial local.
- **O que ele acha:** segredos, configuração insegura (Docker/IaC/CI), dependências sem pin/supply-chain, e **padrões** de injeção (SQLi/NoSQL/SSTI/command/prompt) e de **JWT** fraco.

### O que ele **ainda não** faz (seja honesto no laudo ao cliente)
- **Não** cruza as dependências com uma base de CVE (ex.: "lodash 4.17.4 tem CVE-XXXX"). Hoje é inventário +
  specifiers arriscados. A checagem de CVE via **OSV** é o próximo passo (online, opt-in, pois enviaria os
  nomes dos pacotes para fora).
- É **heurística** (SAST leve): pode ter **falso positivo** (confirme) e **falso negativo** (não substitui
  revisão humana nem uma ferramenta dedicada como Semgrep/CodeQL/Trivy).
- Pula `node_modules`, `.git`, `dist`, binários e arquivos > 1 MB.
- **Não executa** o código nem roda testes do repo.

### E código "ao vivo" (endpoint)?
O Scanner testa **URLs/APIs publicadas**, não o código-fonte. Os dois se complementam: Reposcan olha o
**código**, Scanner olha o **comportamento do endpoint**.

> Em qualquer caso: só analise repositórios/alvos seus ou de cliente **dentro do escopo autorizado**.
