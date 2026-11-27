# Análise estática de repositório clonado (DevSecOps)

Ferramenta de **linha de comando** para rodar na sua máquina sobre um repositório que você
clonou — de cliente (autorizado) ou seu. Faz **só análise estática: lê os arquivos, nunca
instala dependências nem roda a suíte do repositório** (isso executaria código não confiável).

Quatro análises:

| Categoria | O que procura |
|---|---|
| **Segredos** | AWS keys, chaves privadas, tokens (GitHub/Slack/Google/Stripe), JWT, atribuições a `password/secret/token/...`, `.env` com valores |
| **Dependências** | inventário de `package.json`/`requirements.txt`; specifiers sem versão fixa, HTTP inseguro, scripts de `install` (supply-chain) |
| **Docker/IaC/CI** | Dockerfile (root, `:latest`, `ADD` remoto, `curl \| bash`, segredo em `ENV/ARG`), docker-compose (`privileged`, `network_mode: host`, segredo inline), workflows (`pull_request_target`, action sem SHA, injeção de `github.event`) |
| **Código** | `eval`/`new Function`, `exec`/`child_process` com concatenação, `shell=True`, `pickle.loads`, `yaml.load` inseguro, `os.system`, hash fraco, `innerHTML=` |

## Uso

Na raiz do SegInfo:

```bash
# pasta já clonada
scripts/reposcan.sh /caminho/do/repo-clonado

# clona raso de uma URL, analisa e apaga o temporário
scripts/reposcan.sh https://github.com/dono/repo

# saída JSON (para pipeline/relatório)
scripts/reposcan.sh /caminho/do/repo --json

# reprovar já a partir de "média" (padrão é "alta")
scripts/reposcan.sh /caminho/do/repo --fail-on media
```

No Windows (PowerShell), chame direto pelo tsx:

```powershell
node node_modules\tsx\dist\cli.mjs apps\api\src\reposcanCli.ts C:\caminho\do\repo
```

## Código de saída

- `0` — nada atingiu o limiar de `--fail-on` (padrão `alta`).
- `1` — reprovou (serve de gate: pare o pipeline/alerta).
- `2` — erro de uso (pasta inexistente, falha ao clonar).

## Limites e cuidados

- Os segredos são **redigidos** na saída (mostra só as pontas), mas trate o laudo como sensível.
- É heurística: pode haver **falso positivo** (confirme) e **falso negativo** (não substitui revisão).
- Pula `node_modules`, `.git`, `dist`, `build`, `vendor`, `__pycache__`, `.venv`, `target` e binários; ignora arquivos > 1 MB.
- Só autorizado: analise repositórios seus ou de cliente dentro do escopo contratado.
- Checagem de **CVE** de dependência (base OSV) é um próximo passo opcional — hoje o foco é inventário + specifiers arriscados, sem enviar nada para fora.
