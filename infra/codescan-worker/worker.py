#!/usr/bin/env python3
"""Worker da revisão de código do SegInfo (plugin oficial claude-security).

Pega pedidos na API do SegInfo, clona o repositório, roda o plugin num sandbox Linux
(sem rede além do modelo, escrita só em memória, credencial fora do sandbox) e devolve
SARIF, relatório e patches. Só biblioteca padrão do Python 3.10+.

Configuração por variáveis de ambiente (systemd: EnvironmentFile=/etc/seginfo-codescan/worker.env):
  SEGINFO_API               https://estudo.criecom.ia.br
  CODESCAN_WORKER_TOKEN     mesmo valor da variável na API (Coolify)
  CF_ACCESS_CLIENT_ID/SECRET  Service Token do Cloudflare Access (o mesmo do gate de CI)
  ANTHROPIC_API_KEY         chave de um workspace dedicado (exigência do plugin)
  PLUGIN_DIR                pasta do plugin, do root e só-leitura para este usuário
  CLAUDE_BIN                caminho do Claude Code (padrão: claude no PATH)
  CODESCAN_GIT_TOKEN        opcional: token para clonar repositórios privados por https
  CODESCAN_GIT_USER         usuário do token (padrão x-access-token, serve para GitHub)
  SANDBOX_ARGS              padrão "--sudo --memory 1024" (--sudo é obrigatório no Ubuntu 24.04+)
  MAX_HORAS                 limite por varredura (padrão 3)
  INTERVALO                 segundos entre consultas à fila (padrão 30)
  WORK_DIR                  onde clonar (padrão /var/lib/seginfo-codescan/work)
"""
from __future__ import annotations

import base64
import glob
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

API = os.environ.get("SEGINFO_API", "").rstrip("/")
TOKEN = os.environ.get("CODESCAN_WORKER_TOKEN", "")
CF_ID = os.environ.get("CF_ACCESS_CLIENT_ID", "")
CF_SECRET = os.environ.get("CF_ACCESS_CLIENT_SECRET", "")
PLUGIN_DIR = os.environ.get("PLUGIN_DIR", "/opt/seginfo-codescan/plugin")
CLAUDE_BIN = os.environ.get("CLAUDE_BIN", "claude")
SANDBOX_ARGS = os.environ.get("SANDBOX_ARGS", "--sudo --memory 1024").split()
MAX_HORAS = float(os.environ.get("MAX_HORAS", "3"))
INTERVALO = int(os.environ.get("INTERVALO", "30"))
WORK_DIR = os.environ.get("WORK_DIR", "/var/lib/seginfo-codescan/work")
WORKER_ID = socket.gethostname()

MAX_PATCHES = 60
MAX_PATCH = 200_000
MAX_MD = 2_000_000
MAX_SARIF = 20_000_000

PROMPTS = {
    "codebase": "/claude-security:claude-security scan this whole repository at {esforco} effort and suggest patches for the findings; I understand it may take a while and use a significant number of tokens. This is a non-interactive run: do not ask questions.",
    "changes": "/claude-security:claude-security scan my branch at {esforco} effort and suggest patches for the findings; I understand it may take a while and use a significant number of tokens. This is a non-interactive run: do not ask questions.",
    "attack-surface": "/claude-security:attack-surface-analysis of this whole repository; I understand it may take one to several hours and use a significant number of tokens. This is a non-interactive run: do not ask questions.",
}

_parar = False


def log(msg: str) -> None:
    print(f"[codescan] {msg}", flush=True)


def redigir(texto: str) -> str:
    """Tira chaves e tokens de qualquer texto que vá para a API ou para o log."""
    texto = re.sub(r"sk-ant-[A-Za-z0-9_-]{10,}", "sk-ant-***", texto)
    texto = re.sub(r"(gh[pousr]_|github_pat_)[A-Za-z0-9_]{10,}", r"\1***", texto)
    for segredo in (TOKEN, CF_SECRET, os.environ.get("ANTHROPIC_API_KEY", ""), os.environ.get("CODESCAN_GIT_TOKEN", "")):
        if segredo and len(segredo) >= 8:
            texto = texto.replace(segredo, "***")
    return texto


def api(caminho: str, corpo: dict | None = None, timeout: int = 120):
    """POST JSON na API. Devolve o JSON, ou None em 204."""
    req = urllib.request.Request(
        API + caminho,
        data=json.dumps(corpo or {}).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "X-Worker-Token": TOKEN, "User-Agent": "seginfo-codescan-worker/1.0"},
    )
    if CF_ID and CF_SECRET:
        req.add_header("CF-Access-Client-Id", CF_ID)
        req.add_header("CF-Access-Client-Secret", CF_SECRET)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        if r.status == 204:
            return None
        tipo = r.headers.get("content-type", "")
        if "json" not in tipo:
            raise RuntimeError(f"resposta não-JSON ({r.status}, {tipo}) — barrado pelo Cloudflare Access?")
        return json.loads(r.read() or b"null")


def ambiente_git() -> dict:
    """Ambiente mínimo para o git, com o token (se houver) fora da linha de comando e fora do .git/config."""
    env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": os.environ.get("HOME", "/tmp"), "LANG": "C.UTF-8", "GIT_TERMINAL_PROMPT": "0"}
    cfg = [
        ("protocol.allow", "never"),          # nada de ext::, file:// etc.
        ("protocol.https.allow", "always"),
        ("protocol.ssh.allow", "always"),
        ("http.followRedirects", "false"),    # o token não vai para outro host
        ("core.hooksPath", "/dev/null"),
    ]
    token = os.environ.get("CODESCAN_GIT_TOKEN", "")
    if token:
        user = os.environ.get("CODESCAN_GIT_USER", "x-access-token")
        basic = base64.b64encode(f"{user}:{token}".encode()).decode()
        cfg.append(("http.extraHeader", f"Authorization: Basic {basic}"))
    env["GIT_CONFIG_COUNT"] = str(len(cfg))
    for i, (k, v) in enumerate(cfg):
        env[f"GIT_CONFIG_KEY_{i}"] = k
        env[f"GIT_CONFIG_VALUE_{i}"] = v
    return env


def clonar(job: dict, destino: str) -> str:
    args = ["git", "clone", "--no-tags", "--no-recurse-submodules"]
    if job["modo"] == "changes":
        args += ["--filter=blob:none"]  # histórico completo, conteúdo sob demanda (para comparar a branch)
    else:
        args += ["--depth", "1", "--single-branch"]
    if job.get("branch"):
        args += ["--branch", job["branch"]]
    args += ["--", job["repoUrl"], destino]
    r = subprocess.run(args, env=ambiente_git(), capture_output=True, text=True, timeout=900)
    if r.returncode != 0:
        raise RuntimeError(f"git clone falhou: {redigir(r.stderr.strip())[-1500:]}")
    commit = subprocess.run(["git", "-C", destino, "rev-parse", "HEAD"], capture_output=True, text=True, env=ambiente_git()).stdout.strip()
    return commit


def ambiente_claude(pasta_cfg: str) -> dict:
    """Ambiente da sessão: só o necessário. A chave fica com o relay do sandbox, fora da sessão."""
    env = {
        "PATH": f"{os.path.dirname(CLAUDE_BIN) or '/usr/local/bin'}:/usr/local/bin:/usr/bin:/bin",
        "HOME": os.environ.get("HOME", "/tmp"),
        "LANG": "C.UTF-8",
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
        # mesmo endurecimento da GitHub Action oficial do plugin
        "CLAUDE_CONFIG_DIR": pasta_cfg,
        "CLAUDE_CODE_DISABLE_CLAUDE_MDS": "1",
        "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1",
        "CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR": "1",
    }
    return env


def rodar_plugin(job: dict, repo: str, saida: str, pasta_cfg: str) -> subprocess.CompletedProcess:
    prompt = PROMPTS[job["modo"]].format(esforco=job["esforco"])
    claude = [CLAUDE_BIN, "-p", prompt, "--plugin-dir", PLUGIN_DIR, "--permission-mode", "auto", "--setting-sources=user"]
    cmd = [
        "/usr/bin/python3", "-IS", os.path.join(PLUGIN_DIR, "scripts", "sandbox.py"),
        *SANDBOX_ARGS, "--out", saida, "--minutes", str(int(MAX_HORAS * 60)), ".", "--", *claude,
    ]
    return subprocess.run(cmd, cwd=repo, env=ambiente_claude(pasta_cfg), capture_output=True, text=True, timeout=int(MAX_HORAS * 3600) + 600)


def ler(caminho: str, limite: int) -> str | None:
    try:
        if os.path.getsize(caminho) > limite:
            return None
        with open(caminho, encoding="utf-8", errors="replace") as f:
            return f.read()
    except OSError:
        return None


def coletar(saida: str) -> dict:
    """Lê a pasta CLAUDE-SECURITY-<ts> mais recente que o sandbox copiou para `saida`."""
    pastas = sorted((p for p in glob.glob(os.path.join(saida, "CLAUDE-SECURITY-*")) if os.path.isdir(p)), key=os.path.getmtime)
    if not pastas:
        raise RuntimeError("o plugin terminou sem gerar a pasta CLAUDE-SECURITY-*")
    pasta = pastas[-1]
    sarif = None
    caminho_sarif = os.path.join(pasta, "CLAUDE-SECURITY-RESULTS.sarif")
    bruto = ler(caminho_sarif, MAX_SARIF)
    if bruto:
        try:
            sarif = json.loads(bruto)
        except json.JSONDecodeError:
            sarif = None
    md = ler(os.path.join(pasta, "CLAUDE-SECURITY-RESULTS.md"), MAX_MD)
    patches = []
    for p in sorted(glob.glob(os.path.join(pasta, "**", "*.patch"), recursive=True))[:MAX_PATCHES]:
        conteudo = ler(p, MAX_PATCH)
        if conteudo is None:
            continue
        nota = ler(p[: -len(".patch")] + ".md", 50_000)
        nome = re.sub(r"[^\w.-]", "_", os.path.basename(p))
        patches.append({"nome": nome, "conteudo": conteudo, "nota": nota})
    if sarif is None and md is None:
        raise RuntimeError("a pasta de resultado não tem SARIF nem relatório")
    return {"sarif": sarif, "relatorioMd": md, "patches": patches}


def processar(job: dict) -> None:
    log(f"pedido {job['id']}: {job['modo']} @ {job['esforco']} em {job['repoUrl']}{' (' + job['branch'] + ')' if job.get('branch') else ''}")
    os.makedirs(WORK_DIR, mode=0o700, exist_ok=True)
    base = tempfile.mkdtemp(prefix="codescan-", dir=WORK_DIR)
    try:
        repo = os.path.join(base, "repo")
        saida = os.path.join(base, "saida")
        cfg = os.path.join(base, "claude-config")
        os.makedirs(saida, mode=0o700)
        os.makedirs(cfg, mode=0o700)
        commit = clonar(job, repo)
        r = rodar_plugin(job, repo, saida, cfg)
        try:
            resultado = coletar(saida)
        except RuntimeError as e:
            detalhe = redigir((r.stderr or r.stdout or "").strip())[-3000:]
            raise RuntimeError(f"{e} (saída {r.returncode}): {detalhe}") from None
        api(f"/api/scan/ci/codigo/{job['id']}/resultado", {"status": "concluido", "commit": commit or None, **resultado}, timeout=300)
        log(f"pedido {job['id']}: concluído ({len(resultado['patches'])} patch(es))")
    except Exception as e:  # noqa: BLE001 — qualquer falha vira erro do pedido, não derruba o worker
        msg = redigir(str(e))[:3900]
        log(f"pedido {job['id']}: erro — {msg}")
        try:
            api(f"/api/scan/ci/codigo/{job['id']}/resultado", {"status": "erro", "erro": msg})
        except Exception as e2:  # noqa: BLE001
            log(f"não consegui registrar o erro na API: {redigir(str(e2))}")
    finally:
        shutil.rmtree(base, ignore_errors=True)  # o clone nunca fica no disco


def checar_config() -> None:
    faltam = [n for n, v in (("SEGINFO_API", API), ("CODESCAN_WORKER_TOKEN", TOKEN), ("ANTHROPIC_API_KEY", os.environ.get("ANTHROPIC_API_KEY", ""))) if not v]
    if faltam:
        sys.exit(f"configuração incompleta: {', '.join(faltam)}")
    if os.geteuid() == 0:
        sys.exit("não rode o worker como root: use o usuário seginfo-codescan")
    if not os.path.isfile(os.path.join(PLUGIN_DIR, "scripts", "sandbox.py")):
        sys.exit(f"plugin não encontrado em {PLUGIN_DIR}")


def main() -> None:
    checar_config()

    def sair(*_):
        global _parar
        _parar = True

    signal.signal(signal.SIGTERM, sair)
    signal.signal(signal.SIGINT, sair)
    log(f"worker {WORKER_ID} no ar; consultando {API} a cada {INTERVALO}s")
    while not _parar:
        try:
            job = api("/api/scan/ci/codigo/claim", {"workerId": WORKER_ID})
        except (urllib.error.URLError, RuntimeError, TimeoutError) as e:
            log(f"fila indisponível: {redigir(str(e))}")
            job = None
        if job:
            processar(job)
            continue
        for _ in range(INTERVALO):
            if _parar:
                break
            time.sleep(1)
    log("worker encerrado")


if __name__ == "__main__":
    main()
