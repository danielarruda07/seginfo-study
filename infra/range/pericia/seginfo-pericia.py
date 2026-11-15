#!/usr/bin/env python3
"""Laudo dos alvos reais do honeypot, gerado ANTES de cada reset (roda na VM do Wazuh).

Para cada alvo, pelo agente QEMU via API do Proxmox (nada é instalado no alvo):
  - arquivos criados/alterados desde o snapshot "limpo" (com SHA-256 e tipo ELF/PE/script);
  - persistência (cron, systemd, chaves SSH, perfis de shell, contas, serviços/tarefas no Windows);
  - processos iniciados depois do boot e conexões abertas;
  - amostras dos executáveis (copiadas para STATE/amostras/<sha256>.bin, modo 0400, nunca executadas).
Do Wazuh: as saídas bloqueadas pelo firewall (regra 100260) com origem no IP do alvo, na janela.
O laudo vai para o app em POST {INGEST_URL}/pericia e fica também em STATE/laudos/.

Variáveis (EnvironmentFile): PVE_URL, PVE_TOKEN_ID, PVE_TOKEN_SECRET, PVE_NODE, SNAPSHOT
(as mesmas do reset); INGEST_URL, CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, INGEST_TOKEN
(as do forwarder); PERICIA_ALVOS="vmid:linux|windows:sensor,..." (sensor = nome do alvo no Radar);
opcionais PERICIA_REGRA_SAIDA (100260), PERICIA_AMOSTRA_MAX_MB (8), DRY_RUN=true (não envia).
"""
import base64
import datetime as dt
import glob
import gzip
import hashlib
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

E = os.environ.get
STATE = os.environ.get('STATE_DIRECTORY', '/var/lib/seginfo-pericia')
NODE = E('PVE_NODE', '')
SNAP = E('SNAPSHOT', 'limpo')
REGRA_SAIDA = E('PERICIA_REGRA_SAIDA', '100260')
AMOSTRA_MAX = int(E('PERICIA_AMOSTRA_MAX_MB', '8')) * 1_048_576
DRY = E('DRY_RUN', '').lower() == 'true'
PVE = (E('PVE_URL') or '').rstrip('/') + '/api2/json/'
HDR = {'Authorization': f"PVEAPIToken={E('PVE_TOKEN_ID')}={E('PVE_TOKEN_SECRET')}"}
CTX = ssl._create_unverified_context()  # certificado autoassinado do Proxmox na rede interna


def log(*a):
    print(time.strftime('%Y-%m-%dT%H:%M:%S'), *a, flush=True)


def iso(ts):
    return dt.datetime.fromtimestamp(ts, dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def pve(metodo, caminho, dados=None, timeout=60):
    corpo = urllib.parse.urlencode(dados, doseq=True).encode() if dados else None
    req = urllib.request.Request(PVE + caminho, method=metodo, headers=HDR, data=corpo)
    with urllib.request.urlopen(req, context=CTX, timeout=timeout) as r:
        return json.load(r)['data']


def guest_exec(vmid, comando, entrada=None, limite=300):
    """Roda um comando no alvo pelo agente QEMU e devolve (exitcode, stdout, stderr)."""
    dados = [('command', c) for c in comando]
    if entrada is not None:
        dados.append(('input-data', entrada))
    pid = pve('POST', f'nodes/{NODE}/qemu/{vmid}/agent/exec', dados)['pid']
    fim = time.time() + limite
    while time.time() < fim:
        st = pve('GET', f'nodes/{NODE}/qemu/{vmid}/agent/exec-status?pid={pid}')
        if st.get('exited'):
            if st.get('out-truncated'):
                raise RuntimeError('saída truncada pelo agente')
            return st.get('exitcode'), st.get('out-data', ''), st.get('err-data', '')
        time.sleep(2)
    raise TimeoutError('comando no alvo passou do tempo')


# ---------------------------------------------------------------- coleta dentro do Linux
COLETA_LINUX = r'''
import os, json, hashlib, pwd, stat
CORTE = __CORTE__
EXCL = ('/proc', '/sys', '/run', '/dev', '/snap', '/usr/share', '/var/cache', '/var/lib/apt', '/var/lib/dpkg',
        '/var/log/journal', '/var/lib/systemd', '/var/lib/snapd', '/var/lib/cloud', '/var/lib/ubuntu-advantage',
        '/var/lib/fwupd', '/var/lib/update-notifier', '/var/lib/landscape', '/var/lib/logrotate', '/var/lib/private',
        '/var/lib/command-not-found', '/var/lib/PackageKit', '/usr/lib/python3', '/var/lib/polkit-1', '/var/backups',
        '/var/lib/ubuntu-release-upgrader', '/var/log/sysstat', '/var/log/landscape')
EXTRA = ('/dev/shm', '/run/shm', '/run/user', '/tmp', '/var/tmp')
PERSIST = (('/etc/crontab', 'cron'), ('/etc/cron', 'cron'), ('/var/spool/cron', 'cron'), ('/etc/systemd/', 'systemd'),
           ('/lib/systemd/system/', 'systemd'), ('/usr/lib/systemd/system/', 'systemd'), ('/.config/systemd/', 'systemd'),
           ('/etc/init.d/', 'init'), ('/etc/rc.local', 'init'), ('authorized_keys', 'chave-ssh'), ('/etc/ld.so.preload', 'preload'),
           ('/etc/profile', 'perfil-shell'), ('/etc/bash.bashrc', 'perfil-shell'), ('/.bashrc', 'perfil-shell'),
           ('/.profile', 'perfil-shell'), ('/.bash_profile', 'perfil-shell'), ('/etc/passwd', 'contas'), ('/etc/group', 'contas'),
           ('/etc/shadow', 'contas'), ('/etc/sudoers', 'sudo'), ('/etc/pam.d/', 'pam'), ('/etc/udev/rules.d/', 'udev'),
           ('/etc/update-motd.d/', 'motd'), ('/etc/xdg/autostart/', 'autostart'))
dev_raiz = os.lstat('/').st_dev
vistos, arquivos = set(), []

def tipo_de(p, st):
    try:
        with open(p, 'rb') as f:
            m = f.read(4)
    except OSError:
        return 'outro'
    if m == b'\x7fELF':
        return 'elf'
    if m[:2] == b'MZ':
        return 'pe'
    if m[:2] == b'#!':
        return 'script'
    return 'outro'

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

def ver(p):
    if p in vistos:
        return
    vistos.add(p)
    try:
        st = os.lstat(p)
    except OSError:
        return
    if not stat.S_ISREG(st.st_mode) or max(st.st_mtime, st.st_ctime) < CORTE:
        return
    if p.startswith('/run/user/') and '/systemd/' in p:
        return
    t = tipo_de(p, st)
    exe = bool(st.st_mode & 0o111)
    a = {'caminho': p, 'tamanho': st.st_size, 'mtime': int(max(st.st_mtime, st.st_ctime)), 'tipo': t, 'executavel': exe}
    if st.st_size <= 200 * 1048576 and (exe or t != 'outro' or st.st_size <= 1048576):
        try:
            a['sha256'] = sha(p)
        except OSError:
            pass
    arquivos.append(a)

def andar(raiz, mesmo_fs):
    for d, subdirs, nomes in os.walk(raiz):
        manter = []
        for s in subdirs:
            c = os.path.join(d, s)
            if c in EXCL or os.path.islink(c):
                continue
            try:
                if mesmo_fs and os.lstat(c).st_dev != dev_raiz:
                    continue
            except OSError:
                continue
            manter.append(s)
        subdirs[:] = manter
        for n in nomes:
            ver(os.path.join(d, n))

andar('/', True)
for r in EXTRA:
    if os.path.isdir(r):
        andar(r, False)

persist, obs = [], []
try:
    pre = open('/etc/ld.so.preload').read().strip()
except OSError:
    pre = ''
if pre:
    obs.append('ATENCAO: /etc/ld.so.preload carrega ' + pre[:200] + ' em todo processo (rootkit de espaco de usuario). '
               'A biblioteca pode esconder arquivos, processos e conexoes inclusive desta coleta: o laudo pode estar incompleto.')
for a in arquivos:
    p = a['caminho']
    for marca, tipo in PERSIST:
        if marca in p:
            if p == '/etc/shadow':
                txt = '(conteudo omitido: arquivo de senhas)'
                obs.append('/etc/shadow alterado na janela: senha trocada ou conta criada')
            else:
                try:
                    with open(p, 'r', errors='replace') as f:
                        txt = f.read(4000)
                except OSError:
                    txt = '(ilegivel)'
                if tipo == 'chave-ssh':
                    linhas = []
                    for l in txt.splitlines():
                        partes = l.split()
                        if len(partes) >= 2:
                            linhas.append(' '.join([partes[0], partes[1][:12] + '...' + partes[1][-8:]] + partes[2:]))
                    txt = '\n'.join(linhas)
            persist.append({'tipo': tipo, 'onde': p, 'conteudo': txt[:2000]})
            break

btime = 0
for l in open('/proc/stat'):
    if l.startswith('btime'):
        btime = int(l.split()[1])
hz = os.sysconf('SC_CLK_TCK')
eu = {os.getpid(), os.getppid()}
procs, inode_proc = [], {}
for d in os.listdir('/proc'):
    if not d.isdigit():
        continue
    pid = int(d)
    try:
        for fd in os.listdir(f'/proc/{pid}/fd'):
            try:
                alvo = os.readlink(f'/proc/{pid}/fd/{fd}')
            except OSError:
                continue
            if alvo.startswith('socket:['):
                inode_proc[alvo[8:-1]] = pid
        cmd = open(f'/proc/{pid}/cmdline', 'rb').read().replace(b'\0', b' ').decode('utf-8', 'replace').strip()
        if not cmd or pid in eu or 'qemu-ga' in cmd:
            continue
        campos = open(f'/proc/{pid}/stat').read().rsplit(')', 1)[1].split()
        inicio = btime + int(campos[19]) / hz
        if inicio < btime + 300 or inicio < CORTE:
            continue
        uid = int([l for l in open(f'/proc/{pid}/status') if l.startswith('Uid:')][0].split()[1])
        try:
            usuario = pwd.getpwuid(uid).pw_name
        except KeyError:
            usuario = str(uid)
        procs.append({'pid': pid, 'usuario': usuario, 'inicio': str(int(inicio)), 'comando': cmd[:1000]})
    except (OSError, IndexError, ValueError):
        continue

ESTADO = {'01': 'ESTABLISHED', '02': 'SYN_SENT', '03': 'SYN_RECV', '04': 'FIN_WAIT1', '05': 'FIN_WAIT2', '06': 'TIME_WAIT',
          '07': 'CLOSE', '08': 'CLOSE_WAIT', '09': 'LAST_ACK', '0A': 'LISTEN', '0B': 'CLOSING'}

def ip4(h):
    return '.'.join(str(int(h[i:i + 2], 16)) for i in (6, 4, 2, 0))

conexoes = []
for arq, proto in (('/proc/net/tcp', 'tcp'), ('/proc/net/udp', 'udp')):
    try:
        linhas = open(arq).read().splitlines()[1:]
    except OSError:
        continue
    for l in linhas:
        c = l.split()
        rem, est, inode = c[2], c[3], c[9]
        rip, rport = rem.split(':')
        if rip == '00000000' or est == '0A':
            continue
        pid = inode_proc.get(inode)
        nome = None
        if pid:
            try:
                nome = f"{pid} " + open(f'/proc/{pid}/comm').read().strip()
            except OSError:
                nome = str(pid)
        conexoes.append({'local': ip4(c[1].split(':')[0]) + ':' + str(int(c[1].split(':')[1], 16)),
                         'remoto': f"{ip4(rip)}:{int(rport, 16)}/{proto}", 'estado': ESTADO.get(est, est), 'processo': nome})

print(json.dumps({'arquivos': arquivos, 'persistencia': persist, 'processos': procs[:200],
                  'conexoes': conexoes[:200], 'observacoes': obs, 'boot': btime}))
'''

# ---------------------------------------------------------------- coleta dentro do Windows
COLETA_WINDOWS = r'''
$ErrorActionPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.Encoding]::UTF8
$corte=[DateTimeOffset]::FromUnixTimeSeconds(__CORTE__).UtcDateTime
$boot=(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime()
$ign='\\Users\\(All Users|Default User|Default)\\|\\Application Data\\|\\Tasks\\Microsoft\\Windows\\(UpdateOrchestrator|WindowsUpdate|InstallService)\\|\\Windows\\Tasks\\SA\.DAT$|\\AppData\\Local\\(Microsoft|Packages|Temp\\(WinSAT|Diagnostics))\\|\\ProgramData\\(Microsoft\\(Windows Defender|Windows\\WER|Diagnosis|Network|Windows\\(DeliveryOptimization|AppRepository|Caches|wfp|Start Menu))|Packages|USOShared|USOPrivate|regid)|ntuser\.(dat|ini|pol)|UsrClass\.dat|\.etl$|\.evtx$|\\Windows\\Temp\\(MpCmdRun|.*\.tmp$)'
$ext='.exe','.dll','.scr','.ps1','.bat','.cmd','.vbs','.js','.jse','.hta','.msi','.com','.pif','.wsf','.sys','.lnk'
$lista=@()
foreach($r in 'C:\Users','C:\ProgramData','C:\Windows\Temp','C:\Windows\System32\Tasks','C:\Windows\Tasks','C:\PerfLogs','C:\inetpub'){
 $lista+=Get-ChildItem -LiteralPath $r -Recurse -Force -File | ?{($_.LastWriteTimeUtc -ge $corte -or $_.CreationTimeUtc -ge $corte) -and $_.FullName -notmatch $ign}}
$lista+=Get-ChildItem -LiteralPath 'C:\' -Force -File | ?{($_.LastWriteTimeUtc -ge $corte -or $_.CreationTimeUtc -ge $corte) -and $_.Name -notmatch '^(pagefile|swapfile|hiberfil)\.sys$|^BOOTSECT\.BAK$'}
$arq=@();$per=@();$obs=@()
foreach($f in ($lista|Sort-Object LastWriteTimeUtc -Descending|Select-Object -First 500)){
 $t='outro';try{$s=[IO.File]::OpenRead($f.FullName);$b=New-Object byte[] 2;[void]$s.Read($b,0,2);$s.Close();if($b[0]-eq 77 -and $b[1]-eq 90){$t='pe'}}catch{}
 $e=$f.Extension.ToLower();if($t -eq 'outro' -and @('.ps1','.bat','.cmd','.vbs','.js','.jse','.hta','.wsf') -contains $e){$t='script'}
 $x=$ext -contains $e;$h=$null
 if(($x -or $t -ne 'outro') -and $f.Length -le 209715200){$h=(Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLower()}
 $m=$f.LastWriteTimeUtc;if($f.CreationTimeUtc -gt $m){$m=$f.CreationTimeUtc}
 $arq+=[ordered]@{caminho=$f.FullName;tamanho=$f.Length;mtime=[int64]([DateTimeOffset]$m).ToUnixTimeSeconds();tipo=$t;executavel=$x;sha256=$h}
 if($f.FullName -like 'C:\Windows\System32\Tasks\*'){$per+=[ordered]@{tipo='tarefa';onde=$f.FullName;conteudo=((Get-Content -LiteralPath $f.FullName -Raw) -replace '\s+',' ')}}
 if($f.FullName -match 'Start Menu\\Programs\\Startup'){$per+=[ordered]@{tipo='inicializar';onde=$f.FullName;conteudo=''}}}
$ev=@(@{LogName='System';Id=7045;t='servico'},@{LogName='Security';Id=4698;t='tarefa'},@{LogName='Security';Id=4720;t='conta'},@{LogName='Security';Id=4732;t='grupo'},@{LogName='Security';Id=4724;t='senha'})
foreach($q in $ev){Get-WinEvent -FilterHashtable @{LogName=$q.LogName;Id=$q.Id;StartTime=$corte.ToLocalTime()} -MaxEvents 30|%{$per+=[ordered]@{tipo=$q.t;onde="$($q.LogName) $($q.Id) $($_.TimeCreated.ToUniversalTime().ToString('s'))Z";conteudo=($_.Message -replace '\s+',' ')}}}
Get-CimInstance -Namespace root/subscription -ClassName __EventConsumer|?{$_.Name -ne 'SCM Event Log Consumer'}|%{$per+=[ordered]@{tipo='wmi';onde=$_.__CLASS+' '+$_.Name;conteudo=(""+$_.CommandLineTemplate+$_.ScriptText)}}
foreach($k in 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run','HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'){
 $p=Get-ItemProperty -LiteralPath $k;if($p){$p.PSObject.Properties|?{$_.Name -notlike 'PS*'}|%{$per+=[ordered]@{tipo='run-key';onde="$k\$($_.Name)";conteudo=""+$_.Value}}}}
$lol='^(cmd|powershell|pwsh|rundll32|regsvr32|mshta|wscript|cscript|certutil|bitsadmin|curl|net|net1|sc|schtasks|reg|wmic|vssadmin|bcdedit)\.exe$'
$pr=@();$eu=$PID
Get-CimInstance Win32_Process|?{$_.CreationDate -and $_.CreationDate.ToUniversalTime() -ge $boot.AddMinutes(5) -and $_.CreationDate.ToUniversalTime() -ge $corte -and $_.ProcessId -ne $eu -and $_.ParentProcessId -ne $eu -and $_.Name -notmatch 'qemu-ga' -and (($_.ExecutablePath -notlike 'C:\Windows\*' -and $_.ExecutablePath -notlike 'C:\Program Files*\Windows Defender*' -and $_.ExecutablePath -notlike 'C:\ProgramData\Microsoft\Windows Defender*') -or $_.Name -match $lol)}|Select-Object -First 200|%{$pr+=[ordered]@{pid=[int]$_.ProcessId;inicio=$_.CreationDate.ToUniversalTime().ToString('s');comando=(""+$(if($_.CommandLine){$_.CommandLine}else{$_.Name}))}}
$cx=@();Get-NetTCPConnection -State Established,SynSent|?{$_.RemoteAddress -notmatch '^(127\.|::1|0\.0\.0\.0)'}|Select-Object -First 200|%{$n=(Get-Process -Id $_.OwningProcess).Name;$cx+=[ordered]@{local="$($_.LocalAddress):$($_.LocalPort)";remoto="$($_.RemoteAddress):$($_.RemotePort)/tcp";estado=""+$_.State;processo="$($_.OwningProcess) $n"}}
Get-LocalUser|?{$_.PasswordLastSet -and $_.PasswordLastSet.ToUniversalTime() -ge $corte}|%{$obs+="Senha da conta $($_.Name) definida/trocada na janela"}
[ordered]@{arquivos=$arq;persistencia=$per;processos=$pr;conexoes=$cx;observacoes=$obs;boot=[int64]([DateTimeOffset]$boot).ToUnixTimeSeconds()}|ConvertTo-Json -Depth 4 -Compress
'''


def coletar(vmid, sistema, corte):
    if sistema == 'linux':
        cod, out, err = guest_exec(vmid, ['python3', '-'], entrada=COLETA_LINUX.replace('__CORTE__', str(int(corte))))
    else:
        script = COLETA_WINDOWS.replace('__CORTE__', str(int(corte)))
        enc = base64.b64encode(script.encode('utf-16-le')).decode()
        cod, out, err = guest_exec(vmid, ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc])
    inicio = out.find('{')
    if inicio < 0:
        raise RuntimeError(f'coleta sem JSON (exit {cod}): {(err or out)[:300]}')
    return json.loads(out[inicio:])


def baixar_amostra(vmid, sistema, caminho, sha):
    """Copia o executável para STATE/amostras/<sha>.bin (0400), conferindo o hash. Nunca executa."""
    destino = os.path.join(STATE, 'amostras', f'{sha}.bin')
    if os.path.exists(destino):
        return True
    pedaco, partes, pos = 1_048_576, [], 0
    while True:
        if sistema == 'linux':
            py = ("import sys,base64;f=open(sys.argv[1],'rb');f.seek(int(sys.argv[2]));"
                  "sys.stdout.write(base64.b64encode(f.read(int(sys.argv[3]))).decode())")
            cod, out, _ = guest_exec(vmid, ['python3', '-c', py, caminho, str(pos), str(pedaco)], limite=180)
        else:
            q = caminho.replace("'", "''")
            ps = (f"$f=[IO.File]::OpenRead('{q}');[void]$f.Seek({pos},0);$b=New-Object byte[] {pedaco};"
                  f"$n=$f.Read($b,0,{pedaco});$f.Close();[Convert]::ToBase64String($b,0,$n)")
            cod, out, _ = guest_exec(vmid, ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', ps], limite=180)
        if cod != 0:
            return False
        bloco = base64.b64decode(out.strip())
        partes.append(bloco)
        pos += len(bloco)
        if len(bloco) < pedaco or pos > AMOSTRA_MAX:
            break
    dados = b''.join(partes)
    if hashlib.sha256(dados).hexdigest() != sha:
        return False
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    tmp = destino + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(dados)
    os.chmod(tmp, 0o400)
    os.replace(tmp, destino)
    return True


def arquivos_de_alerta(inicio, fim):
    """alerts.json de hoje + arquivos diários do período (o Wazuh rotaciona à meia-noite)."""
    base = '/var/ossec/logs/alerts'
    nomes = [f'{base}/alerts.json']
    dia = dt.datetime.fromtimestamp(inicio).date()
    while dia <= dt.datetime.fromtimestamp(fim).date():
        mes = dia.strftime('%b')
        nomes += glob.glob(f'{base}/{dia.year}/{mes}/ossec-alerts-{dia.day:02d}.json*')
        dia += dt.timedelta(days=1)
    vistos, saida = set(), []
    for n in nomes:
        try:
            real = os.path.realpath(n)
            if real in vistos:
                continue
            vistos.add(real)
            saida.append(n)
        except OSError:
            pass
    return saida


def nao_e_saida(ip):
    """Broadcast e multicast (NetBIOS, mDNS, SSDP) são ruído do sistema, não tentativa de conexão."""
    try:
        p = [int(x) for x in str(ip).split('.')]
    except ValueError:
        return False
    return len(p) == 4 and (p[3] == 255 or 224 <= p[0] <= 239 or p[0] == 255)


def saidas_bloqueadas(ips, inicio, fim):
    agg = {}
    for n in arquivos_de_alerta(inicio, fim):
        abrir = gzip.open if n.endswith('.gz') else open
        try:
            fh = abrir(n, 'rt', errors='replace')
        except OSError:
            continue
        with fh:
            for linha in fh:
                if REGRA_SAIDA not in linha:
                    continue
                try:
                    a = json.loads(linha)
                except ValueError:
                    continue
                if (a.get('rule') or {}).get('id') != REGRA_SAIDA:
                    continue
                d = a.get('data') or {}
                if d.get('srcip') not in ips or nao_e_saida(d.get('dstip')):
                    continue
                try:
                    t = dt.datetime.strptime(a['timestamp'], '%Y-%m-%dT%H:%M:%S.%f%z').timestamp()
                except (KeyError, ValueError):
                    continue
                if not inicio <= t <= fim:
                    continue
                porta = d.get('dstport')
                chave = (d.get('dstip'), porta, (d.get('service') or '').lower())
                x = agg.setdefault(chave, [0, t, t])
                x[0] += 1
                x[1] = min(x[1], t)
                x[2] = max(x[2], t)
    saidas = []
    for (ip, porta, servico), (n, p, u) in sorted(agg.items(), key=lambda kv: -kv[1][0])[:500]:
        s = {'destino': str(ip)[:64], 'tentativas': n, 'primeira': iso(p), 'ultima': iso(u)}
        if str(porta).isdigit():
            s['porta'] = int(porta)
        if servico:
            s['protocolo'] = servico[:16]
        saidas.append(s)
    return saidas


def ips_do_alvo(vmid):
    ips = set()
    for i in pve('GET', f'nodes/{NODE}/qemu/{vmid}/agent/network-get-interfaces').get('result', []):
        for e in i.get('ip-addresses') or []:
            if e.get('ip-address-type') == 'ipv4' and not e['ip-address'].startswith('127.'):
                ips.add(e['ip-address'])
    return ips


def ler_estado():
    try:
        return json.load(open(os.path.join(STATE, 'estado.json')))
    except (OSError, ValueError):
        return {}


def gravar_estado(st):
    p = os.path.join(STATE, 'estado.json')
    with open(p + '.tmp', 'w') as f:
        json.dump(st, f)
    os.replace(p + '.tmp', p)


def enviar(laudo, rota='pericia'):
    url = (E('INGEST_URL') or '').rstrip('/') + '/' + rota
    req = urllib.request.Request(url, data=json.dumps(laudo).encode(), method='POST', headers={
        'Content-Type': 'application/json', 'CF-Access-Client-Id': E('CF_ACCESS_CLIENT_ID', ''),
        'CF-Access-Client-Secret': E('CF_ACCESS_CLIENT_SECRET', ''), 'X-Ingest-Token': E('INGEST_TOKEN', ''),
        'User-Agent': 'seginfo-pericia/1'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def enviar_amostras(laudo):
    """Somente arquivos já preservados pelo coletor; hash verificado, nunca executa."""
    for a in laudo.get('amostras', []):
        sha = a.get('sha256', '')
        if not a.get('guardada') or len(sha) != 64 or any(c not in '0123456789abcdef' for c in sha):
            continue
        caminho = os.path.join(STATE, 'amostras', sha + '.bin')
        with open(caminho, 'rb') as f:
            conteudo = f.read(8 * 1_048_576 + 1)
        if len(conteudo) > 8 * 1_048_576:
            log('amostra acima do limite da biblioteca:', sha)
            continue
        if hashlib.sha256(conteudo).hexdigest() != sha:
            raise ValueError('amostra local não confere com SHA-256')
        enviar({'sha256': sha, 'base64': base64.b64encode(conteudo).decode('ascii')}, 'amostra')


def importar_biblioteca():
    """Reenvia laudos e amostras já guardados, sem inspecionar ou resetar VMs."""
    falhas = 0
    for caminho in sorted(glob.glob(os.path.join(STATE, 'laudos', '*.json'))):
        try:
            with open(caminho) as f:
                laudo = json.load(f)
            if DRY:
                log('[dry-run] biblioteca:', os.path.basename(caminho))
                continue
            enviar(laudo)
            enviar_amostras(laudo)
            log('biblioteca:', os.path.basename(caminho), 'enviado')
        except Exception as e:
            log('biblioteca: falha', os.path.basename(caminho), type(e).__name__)
            falhas += 1
    return 1 if falhas else 0


def laudo_do_alvo(vmid, sistema, sensor, estado, agora):
    erros, obs = [], []
    snaps = {s['name']: s for s in pve('GET', f'nodes/{NODE}/qemu/{vmid}/snapshot')}
    corte = (snaps.get(SNAP) or {}).get('snaptime')
    cfg = pve('GET', f'nodes/{NODE}/qemu/{vmid}/status/current')
    nome = cfg.get('name') or f'vm{vmid}'
    boot = agora - int(cfg.get('uptime') or 0)
    # a janela começa no último laudo/reset; sem histórico, no boot (o reset reinicia a VM); no máximo 7 h
    inicio = max(float(estado.get(str(vmid), 0)) or boot, agora - 7 * 3600)
    if not corte:
        corte = boot
        erros.append(f'sem snapshot "{SNAP}": arquivos comparados a partir do boot')

    dados = {'arquivos': [], 'persistencia': [], 'processos': [], 'conexoes': [], 'observacoes': []}
    ips = set()
    if cfg.get('status') != 'running':
        erros.append(f"alvo {cfg.get('status')}: sem coleta interna")
    else:
        try:
            ips = ips_do_alvo(vmid)
        except Exception as e:  # noqa: BLE001
            erros.append(f'IPs do alvo: {type(e).__name__}')
        try:
            dados = coletar(vmid, sistema, corte)
        except Exception as e:  # noqa: BLE001
            erros.append(f'coleta interna: {type(e).__name__}: {str(e)[:200]}')

    arquivos, amostras = [], []
    for a in sorted(dados.get('arquivos') or [], key=lambda x: (not (x.get('executavel') or x.get('tipo') in ('elf', 'pe')), -x.get('mtime', 0)))[:500]:
        item = {'caminho': str(a['caminho'])[:500], 'tamanho': int(a.get('tamanho') or 0), 'tipo': a.get('tipo') or 'outro',
                'executavel': bool(a.get('executavel'))}
        if a.get('mtime'):
            item['modificadoEm'] = iso(a['mtime'])
        if a.get('sha256'):
            item['sha256'] = a['sha256']
        arquivos.append(item)
        perigoso = item['tipo'] in ('elf', 'pe', 'script') or item['executavel']
        if perigoso and item.get('sha256') and len(amostras) < 15 and not any(x['sha256'] == item['sha256'] for x in amostras):
            ok = False
            if item['tamanho'] <= AMOSTRA_MAX:
                try:
                    ok = baixar_amostra(vmid, sistema, item['caminho'], item['sha256'])
                except Exception as e:  # noqa: BLE001
                    erros.append(f"amostra {item['caminho'][:80]}: {type(e).__name__}")
            amostras.append({'sha256': item['sha256'], 'caminho': item['caminho'], 'tamanho': item['tamanho'], 'guardada': ok})

    saidas = []
    if ips:
        try:
            saidas = saidas_bloqueadas(ips, inicio, agora)
        except Exception as e:  # noqa: BLE001
            erros.append(f'saídas no Wazuh: {type(e).__name__}')
    else:
        obs.append('IP do alvo desconhecido: saídas bloqueadas não consultadas')

    def limpo(lista, chaves):
        return [{k: v for k, v in x.items() if k in chaves and v not in (None, '')} for x in (lista or [])]

    laudo = {
        'alvo': nome[:128], 'vmid': int(vmid), 'sistema': sistema, 'janelaInicio': iso(inicio), 'janelaFim': iso(agora),
        'arquivos': arquivos,
        'persistencia': [{'tipo': str(p.get('tipo'))[:40], 'onde': str(p.get('onde'))[:300], 'conteudo': str(p.get('conteudo') or '')[:2000]}
                         for p in (dados.get('persistencia') or [])][:200],
        'processos': [{**{k: v for k, v in p.items() if k in ('pid', 'usuario', 'comando') and v not in (None, '')},
                       **({'inicio': str(p['inicio'])[:40]} if p.get('inicio') else {})} for p in (dados.get('processos') or [])][:200],
        'conexoes': limpo(dados.get('conexoes'), ('local', 'remoto', 'estado', 'processo'))[:200],
        'saidas': saidas, 'amostras': amostras,
        'observacoes': [str(o)[:500] for o in (list(dados.get('observacoes') or []) + obs)][:50],
        'erros': [e[:500] for e in erros][:20],
    }
    if sensor:
        laudo['sensor'] = sensor[:128]
    for p in laudo['processos']:
        p['comando'] = str(p.get('comando', ''))[:1000]
        if 'usuario' in p:
            p['usuario'] = str(p['usuario'])[:64]
    return laudo


def main():
    alvos = []
    for item in (E('PERICIA_ALVOS') or '').split(','):
        partes = [p.strip() for p in item.split(':')]
        if len(partes) >= 2 and partes[0].isdigit() and partes[1] in ('linux', 'windows'):
            alvos.append((partes[0], partes[1], partes[2] if len(partes) > 2 else ''))
    if not alvos:
        log('PERICIA_ALVOS vazio; nada a fazer')
        return 0
    os.makedirs(os.path.join(STATE, 'laudos'), exist_ok=True)
    estado = ler_estado()
    falhas = 0
    for vmid, sistema, sensor in alvos:
        agora = time.time()
        try:
            laudo = laudo_do_alvo(vmid, sistema, sensor, estado, agora)
        except Exception as e:  # noqa: BLE001
            log(f'{vmid}: laudo falhou: {type(e).__name__}: {e}')
            falhas += 1
            continue
        local = os.path.join(STATE, 'laudos', f"{vmid}-{time.strftime('%Y%m%d-%H%M%S')}.json")
        with open(local, 'w') as f:
            json.dump(laudo, f, ensure_ascii=False)
        resumo = (f"{vmid}: {len(laudo['arquivos'])} arquivos, {len(laudo['persistencia'])} persistência, "
                  f"{len(laudo['processos'])} processos, {sum(s['tentativas'] for s in laudo['saidas'])} saídas bloqueadas, "
                  f"{sum(a['guardada'] for a in laudo['amostras'])} amostras, {len(laudo['erros'])} erros")
        if DRY:
            log('[dry-run]', resumo)
            continue
        try:
            r = enviar(laudo)
            log(resumo, '->', 'enviado' if r.get('ok') else r)
            estado[str(vmid)] = agora
            enviar_amostras(laudo)
        except urllib.error.HTTPError as e:
            log(f'{vmid}: envio recusado {e.code}: {e.read()[:200]!r}')
            falhas += 1
        except Exception as e:  # noqa: BLE001
            log(f'{vmid}: envio falhou: {type(e).__name__}: {e}')
            falhas += 1
    if not DRY:
        gravar_estado(estado)
    return 1 if falhas else 0


if __name__ == '__main__':
    sys.exit(importar_biblioteca() if '--biblioteca' in sys.argv else main())
