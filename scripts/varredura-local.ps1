<#
.SYNOPSIS
  Varredura profunda (plugin claude-security) de um repositorio JA CLONADO na sua maquina,
  usando o SEU Claude Code (assinatura) em vez da chave da API.

.DESCRIPTION
  Garantias:
   - O clone original (ex.: C:\temp\repo) NAO e tocado: a varredura roda numa COPIA descartavel
     (git clone local, sem rede). O script confere HEAD e status do original antes e depois.
   - Nada vai ao GitHub: a copia tem o push desativado (pushurl invalido) e o "origin" dela e a pasta
     local, nao o GitHub. O plugin, por regra propria, nunca aplica, commita nem da push.
   - A sessao do Claude Code ignora configuracoes/hooks/CLAUDE.md do repositorio (--setting-sources user)
     e recebe regras de negacao: git push/remote, gh, curl/wget, instaladores de pacote, docker, web.
   - O relatorio (confidencial) vai para fora do OneDrive e de qualquer repositorio.
  Limite honesto: no Windows o plugin NAO tem sandbox; os agentes leem com o seu usuario. Use em
  codigo da sua empresa/cliente autorizado, nao em codigo de origem desconhecida.

.EXAMPLE
  scripts\varredura-local.ps1 -Repo C:\temp\criptobrokers
  scripts\varredura-local.ps1 -Repo C:\temp\criptobrokers -Branch feat/user-vault-sweep-fee-retry
#>
param(
  [Parameter(Mandatory = $true)][string]$Repo,
  [string]$Branch,
  [string]$Saida = (Join-Path $HOME 'SegInfo-Confidencial\varreduras'),
  [string]$Plugin = (Join-Path $HOME '.claude\plugins\marketplaces\claude-plugins-official\plugins\claude-security')
)
$ErrorActionPreference = 'Stop'

function Get-EstadoRepo([string]$p) {
  $head = (git -C $p rev-parse HEAD).Trim()
  $st = (git -C $p status --porcelain=v1 --untracked-files=no) -join "`n"
  return "$head|$st"
}

$Repo = (Resolve-Path $Repo).Path
if ((git -C $Repo rev-parse --is-inside-work-tree 2>$null) -ne 'true') { throw "Nao e um repositorio git: $Repo" }
if (-not (Test-Path (Join-Path $Plugin '.claude-plugin\plugin.json'))) {
  throw "Plugin claude-security nao encontrado em $Plugin. No Claude Code rode: /plugin marketplace update claude-plugins-official"
}
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { throw 'Comando claude nao encontrado no PATH.' }

$nome = Split-Path $Repo -Leaf
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$base = Join-Path $env:TEMP 'seginfo-varredura'
$copia = Join-Path $base "$nome-$ts"
$antes = Get-EstadoRepo $Repo

Write-Host "[1/4] Copia descartavel (git clone local, sem rede): $copia"
New-Item -ItemType Directory -Force $base | Out-Null
git clone --quiet --no-hardlinks -- "$Repo" "$copia"
if ($LASTEXITCODE -ne 0) { throw 'git clone local falhou.' }
if ($Branch) {
  git -C $copia checkout --quiet $Branch
  if ($LASTEXITCODE -ne 0) { throw "Branch $Branch nao existe no clone local (faca git fetch no original antes)." }
}
# push impossivel: o origin da copia e a pasta local e o pushurl aponta para lugar nenhum
git -C $copia remote set-url --push origin 'PUSH-DESATIVADO-PELA-SEGINFO'
git -C $copia config core.hooksPath NUL
git -C $copia config credential.helper ''

Write-Host '[2/4] Regras de negacao para a sessao do Claude Code'
$cfg = Join-Path $base "settings-$ts.json"
$negar = @(
  'Bash(git push:*)', 'Bash(git remote:*)', 'Bash(git config:*)', 'Bash(gh:*)',
  'Bash(curl:*)', 'Bash(wget:*)', 'Bash(ssh:*)', 'Bash(scp:*)',
  'Bash(npm:*)', 'Bash(npx:*)', 'Bash(pnpm:*)', 'Bash(yarn:*)', 'Bash(pip:*)', 'Bash(pip3:*)',
  'Bash(docker:*)', 'Bash(go run:*)', 'Bash(cargo:*)',
  'PowerShell(git push:*)', 'PowerShell(git remote:*)', 'PowerShell(gh:*)', 'PowerShell(Invoke-WebRequest:*)', 'PowerShell(Invoke-RestMethod:*)',
  'WebFetch', 'WebSearch'
)
@{ permissions = @{ deny = $negar } } | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 $cfg

Write-Host ''
Write-Host '[3/4] Abrindo o Claude Code na copia. Cole um prompt do menu "Prompts de pentest" do SegInfo, por exemplo:'
Write-Host '      /claude-security:claude-security scan this whole repository at high effort; I understand it may take a while and use a significant number of tokens' -ForegroundColor Cyan
Write-Host '      Quando terminar, saia com /exit para o script coletar o relatorio.'
Write-Host ''
Push-Location $copia
try {
  $env:CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1'
  claude --setting-sources user --settings "$cfg" --plugin-dir "$Plugin"
} finally {
  Remove-Item Env:\CLAUDE_CODE_DISABLE_CLAUDE_MDS -ErrorAction SilentlyContinue
  Pop-Location
}

Write-Host '[4/4] Coletando o relatorio'
$depois = Get-EstadoRepo $Repo
if ($antes -eq $depois) { Write-Host "  ok: o clone original nao mudou ($Repo)" -ForegroundColor Green }
else { Write-Warning "  O estado do clone original mudou durante a varredura (alguem trabalhou nele?). Confira: git -C $Repo status" }

$rels = Get-ChildItem $copia -Directory -Filter 'CLAUDE-SECURITY-*' -ErrorAction SilentlyContinue
if (-not $rels) {
  Write-Warning "Nenhum relatorio CLAUDE-SECURITY-* na copia. Ela foi MANTIDA para voce retomar: cd '$copia'; claude --resume"
  return
}
$destino = Join-Path $Saida "$nome-$ts"
New-Item -ItemType Directory -Force $destino | Out-Null
foreach ($r in $rels) { Copy-Item $r.FullName -Destination $destino -Recurse }
Remove-Item $cfg -Force -ErrorAction SilentlyContinue
Write-Host "  Relatorio copiado para: $destino" -ForegroundColor Green
Write-Host '  No SegInfo: Revisao de codigo (IA) -> Importar varredura local -> escolha a pasta CLAUDE-SECURITY-* acima.'

$resp = Read-Host "Apagar a copia descartavel $copia ? (S/n)"
if ($resp -ne 'n') { Remove-Item -Recurse -Force $copia; Write-Host '  Copia apagada.' }
