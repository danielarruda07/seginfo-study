<#
.SYNOPSIS
  Envia falhas de logon (evento 4625) e bloqueios de conta (4740, em DC) para o
  Radar de Ataques da SegInfo.

.DESCRIPTION
  AVISO DE AUTORIZAÇÃO: este script envia nomes de contas e IPs de origem para uma
  aplicação externa. Em servidores da EMPRESA, só use com autorização formal do gestor
  e da área de segurança. Sem isso, use apenas em servidores pessoais/homelab.

  Não envia senhas (o Windows não as registra). Os segredos ficam em um arquivo em
  C:\ProgramData\SegInfo com permissão só para SYSTEM e Administradores.

.EXAMPLE
  # Instala a tarefa agendada (pergunta os segredos sem exibi-los):
  .\Send-LogonFailures.ps1 -Install

.EXAMPLE
  .\Send-LogonFailures.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [switch]$Install,
  [switch]$Uninstall,
  [string]$ClientId,
  [string]$Url = 'https://estudo.criecom.ia.br/api/ingest',
  [int]$IntervalMinutes = 5
)

$ErrorActionPreference = 'Stop'
$Dir        = Join-Path $env:ProgramData 'SegInfo'
$ConfigPath = Join-Path $Dir 'ingest.json'
$StatePath  = Join-Path $Dir 'state.json'
$Installed  = Join-Path $Dir 'Send-LogonFailures.ps1'
$TaskName   = 'SegInfo - Falhas de Logon'

function Read-Secret([string]$Prompt) {
  $s = Read-Host -Prompt $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# ---------------- Desinstalar ----------------
if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  if (Test-Path $Dir) { Remove-Item -Recurse -Force $Dir }
  Write-Host 'Tarefa e configuração removidas.'
  return
}

# ---------------- Instalar ----------------
if ($Install) {
  if (-not $ClientId) { $ClientId = Read-Host -Prompt 'Client ID do Service Token (termina em .access)' }
  $clientSecret = Read-Secret 'Client Secret do Service Token'
  $ingestToken  = Read-Secret 'INGEST_TOKEN'
  if (-not ($ClientId -and $clientSecret -and $ingestToken)) { throw 'Client ID, Client Secret e INGEST_TOKEN são obrigatórios.' }
  if ($Url -notlike 'https://*') { throw 'A URL precisa ser https://.' }

  New-Item -ItemType Directory -Force -Path $Dir | Out-Null
  # só SYSTEM e Administradores (remove herança) ANTES de gravar os segredos
  & icacls.exe $Dir /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'BUILTIN\Administrators:(OI)(CI)F' | Out-Null

  @{ url = $Url; clientId = $ClientId; clientSecret = $clientSecret; ingestToken = $ingestToken } |
    ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8
  Copy-Item -Path $PSCommandPath -Destination $Installed -Force

  $action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Installed`" -IntervalMinutes $IntervalMinutes"
  $trigger   = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes)
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null

  Write-Host "Tarefa '$TaskName' criada (a cada $IntervalMinutes min). Para testar agora:"
  Write-Host "  Start-ScheduledTask '$TaskName'; Get-ScheduledTaskInfo '$TaskName'   # LastTaskResult = 0"
  return
}

# ---------------- Execução (tarefa agendada) ----------------
if (-not (Test-Path $ConfigPath)) { throw 'Configuração não encontrada. Rode com -Install.' }
$cfg = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# janela: desde a última execução (ou 2 intervalos atrás na primeira vez)
$since = (Get-Date).AddMinutes(-2 * $IntervalMinutes)
if (Test-Path $StatePath) {
  try {
    $txt = (Get-Content -Raw -Path $StatePath | ConvertFrom-Json).since
    $since = [datetime]::Parse($txt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToLocalTime()
  } catch { }
}

$isDC = ((Get-CimInstance Win32_ComputerSystem).DomainRole -ge 4)
$ids  = @(4625)
if ($isDC) { $ids += 4740 }

$events = Get-WinEvent -FilterHashtable @{ LogName = 'Security'; Id = $ids; StartTime = $since } -ErrorAction SilentlyContinue
if (-not $events) { return }

$out    = New-Object System.Collections.Generic.List[object]
$latest = $since.ToUniversalTime()

foreach ($e in $events) {
  $xml = [xml]$e.ToXml()
  $d = @{}
  foreach ($n in $xml.Event.EventData.Data) { $d[$n.Name] = $n.'#text' }

  $ts = $e.TimeCreated.ToUniversalTime()
  if ($ts -gt $latest) { $latest = $ts }
  $iso = $ts.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")

  if ($e.Id -eq 4625) {
    $ip   = $d['IpAddress']
    $user = $d['TargetUserName']
    if (-not $ip -or $ip -in @('-', '::1', '127.0.0.1')) { continue }
    if (-not $user -or $user -eq '-') { continue }
    $svc = switch ($d['LogonType']) { '10' { 'rdp' } '3' { 'rede' } default { 'logon' } }
    $out.Add(@{
      fonte = 'windows'; ocorridoEm = $iso; ipOrigem = $ip; servico = $svc; acao = 'login_falha'
      usuarioTentado = $user.Substring(0, [Math]::Min(128, $user.Length)); alvo = $env:COMPUTERNAME
      detalhes = @{ eventId = 4625; logonType = [string]$d['LogonType']; status = $d['Status']; subStatus = $d['SubStatus']; estacao = $d['WorkstationName'] }
    })
  }
  elseif ($e.Id -eq 4740) {
    # 4740 não traz IP; "TargetDomainName" é o computador de origem do bloqueio
    $out.Add(@{
      fonte = 'windows'; ocorridoEm = $iso; servico = 'ad'; acao = 'lockout'
      usuarioTentado = $d['TargetUserName']; alvo = $env:COMPUTERNAME
      detalhes = @{ eventId = 4740; computadorOrigem = $d['TargetDomainName'] }
    })
  }
}

$headers = @{
  'CF-Access-Client-Id'     = $cfg.clientId
  'CF-Access-Client-Secret' = $cfg.clientSecret
  'X-Ingest-Token'          = $cfg.ingestToken
}

for ($i = 0; $i -lt $out.Count; $i += 200) {
  $chunk = $out.GetRange($i, [Math]::Min(200, $out.Count - $i)).ToArray()
  $json  = ConvertTo-Json -InputObject @{ eventos = [object[]]$chunk } -Depth 6 -Compress
  try {
    Invoke-RestMethod -Method Post -Uri $cfg.url -Headers $headers -ContentType 'application/json; charset=utf-8' `
      -Body ([Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 30 | Out-Null
  } catch {
    $code = $null
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 400) { Write-Warning "Lote $i rejeitado (400); descartado para não travar a fila."; continue }
    throw   # 401/403/5xx/rede: não avança o estado, tenta de novo na próxima execução
  }
}

# o servidor deduplica, então repetir o último instante na próxima janela é seguro
@{ since = $latest.ToString('o') } | ConvertTo-Json | Set-Content -Path $StatePath -Encoding UTF8
