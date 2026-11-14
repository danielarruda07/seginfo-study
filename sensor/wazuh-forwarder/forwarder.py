#!/usr/bin/env python3
"""SegInfo Wazuh Forwarder - leva os alertas do Wazuh para o Radar (/api/ingest).

Roda na VM do Wazuh (que ja recebe Cowrie, Dionaea, FortiGate e Windows/Sysmon), assim o
honeypot continua SEM saida para a internet. So biblioteca padrao (Python 3.10+).

Le /var/ossec/logs/alerts/alerts.json (acompanha rotacao), converte cada alerta reconhecido
para o formato de /api/ingest e envia em lotes com o Service Token do Cloudflare Access e o
X-Ingest-Token. A posicao no arquivo so avanca depois que o lote foi aceito.

Configuracao por variaveis de ambiente (arquivo EnvironmentFile do systemd, modo 600):
  INGEST_URL                 https://.../api/ingest (obrigatorio)
  CF_ACCESS_CLIENT_ID        Service Token do Access (obrigatorio)
  CF_ACCESS_CLIENT_SECRET    (obrigatorio)
  INGEST_TOKEN               mesmo valor do servidor (obrigatorio)
  ALERTS_FILE                padrao /var/ossec/logs/alerts/alerts.json
  STATE_FILE                 padrao /var/lib/seginfo-forwarder/state.json
  IGNORAR_IPS                IPs/redes de origem a descartar (ex.: testes internos), separados por virgula
  INCLUIR_WINDOWS            true/false (padrao true): alertas de Windows/Sysmon com MITRE
  WINDOWS_NIVEL_MIN          nivel minimo da regra para Windows (padrao 6)
  FLUSH_S                    intervalo de envio em segundos (padrao 10)
  DRY_RUN                    true: so imprime os eventos convertidos, nao envia
  DESDE_INICIO               true: na primeira execucao le o alerts.json do dia desde o inicio

Senha tentada: enviada so para fontes de honeypot; o servidor so guarda com
RADAR_GUARDAR_SENHAS=true (do contrario descarta).
"""
import datetime as dt
import ipaddress
import json
import os
import re
import signal
import sys
import time
import urllib.error
import urllib.request

env = os.environ.get
CFG = {
    'url': env('INGEST_URL', ''),
    'cid': env('CF_ACCESS_CLIENT_ID', ''),
    'csec': env('CF_ACCESS_CLIENT_SECRET', ''),
    'token': env('INGEST_TOKEN', ''),
    'alerts': env('ALERTS_FILE', '/var/ossec/logs/alerts/alerts.json'),
    'state': env('STATE_FILE', '/var/lib/seginfo-forwarder/state.json'),
    'flush': float(env('FLUSH_S', '10')),
    'win': env('INCLUIR_WINDOWS', 'true') == 'true',
    'win_min': int(env('WINDOWS_NIVEL_MIN', '6')),
    'dry': env('DRY_RUN', 'false') == 'true',
    'desde_inicio': env('DESDE_INICIO', 'false') == 'true',
}
IGNORAR = [ipaddress.ip_network(x.strip(), strict=False) for x in env('IGNORAR_IPS', '').split(',') if x.strip()]
LOTE = 500
FILA_MAX = 20000


def log(*a):
    print(dt.datetime.now().isoformat(timespec='seconds'), *a, flush=True)


def clip(v, n):
    if v is None:
        return None
    s = v if isinstance(v, str) else str(v)
    return s[:n] if s else None


def ip_ok(v):
    try:
        ip = ipaddress.ip_address(str(v))
    except ValueError:
        return None
    if any(ip in rede for rede in IGNORAR):
        return None
    return str(ip)


def publico(ip):
    try:
        a = ipaddress.ip_address(ip)
        return not (a.is_private or a.is_loopback or a.is_link_local or a.is_reserved or a.is_multicast)
    except ValueError:
        return False


def quando(alerta):
    """Timestamp do Wazuh ('2026-11-13T20:42:23.101-0300') -> ISO UTC com Z."""
    ts = alerta.get('timestamp', '')
    try:
        d = dt.datetime.strptime(ts, '%Y-%m-%dT%H:%M:%S.%f%z')
    except ValueError:
        d = dt.datetime.now(dt.timezone.utc)
    return d.astimezone(dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def mitre(regra):
    m = regra.get('mitre') or {}
    ids, nomes = m.get('id') or [], m.get('technique') or []
    return [{'id': i, 'nome': clip(nomes[k] if k < len(nomes) else i, 120)} for k, i in enumerate(ids)][:8]


def detalhes_base(alerta, regra):
    d = {'regra': regra.get('id'), 'nivel': regra.get('level'), 'descricao': clip(regra.get('description'), 200),
         'sensor': clip((alerta.get('agent') or {}).get('name'), 64)}
    t = mitre(regra)
    if t:
        d['mitre'] = t
    return d


def limpar(ev):
    ev = {k: v for k, v in ev.items() if v is not None}
    if 'detalhes' in ev:
        ev['detalhes'] = {k: v for k, v in ev['detalhes'].items() if v not in (None, '', [])}
        while len(json.dumps(ev['detalhes'])) > 4000 and 'descricao' in ev['detalhes']:
            ev['detalhes'].pop('descricao')
    return ev


PORTA_COWRIE = {'ssh': 22, 'telnet': 23}
COWRIE_ACAO = {
    'cowrie.session.connect': 'conexao',
    'cowrie.login.failed': 'login_falha',
    'cowrie.login.success': 'login_ok',
    'cowrie.command.input': 'comando',
    'cowrie.session.file_download': 'download',
    'cowrie.session.file_upload': 'download',
    # SSH usado como proxy (direct-tcpip): o bot testa se tem saída ou tenta esconder a origem (T1090)
    'cowrie.direct-tcpip.request': 'tunel',
}


def de_cowrie(a, regra, d):
    acao = COWRIE_ACAO.get(d.get('eventid'))
    ip = ip_ok(d.get('src_ip'))
    if not acao or not ip:
        return None
    proto = d.get('protocol') or ('telnet' if str(d.get('dst_port')) == '2223' else 'ssh')
    det = detalhes_base(a, regra)
    det['sessao'] = clip(d.get('session'), 32)
    if acao == 'comando':
        det['comando'] = clip(d.get('input'), 500)
    if acao == 'download':
        det['url'] = clip(d.get('url') or d.get('filename'), 300)
        det['sha256'] = clip(d.get('shasum'), 64)
    if acao == 'tunel':
        det['destino'] = clip(f"{d.get('dst_ip') or '?'}:{d.get('dst_port') or '?'}", 300)
    login = acao in ('login_falha', 'login_ok')
    return {'fonte': 'cowrie', 'ocorridoEm': quando(a), 'ipOrigem': ip, 'portaDestino': PORTA_COWRIE.get(proto),
            'protocolo': 'tcp', 'servico': proto, 'acao': acao,
            'usuarioTentado': clip(d.get('username'), 128) if login else None,
            'senhaTentada': clip(d.get('password'), 128) if login else None,
            'alvo': clip((a.get('agent') or {}).get('name'), 128), 'detalhes': det}


def porta(v):
    s = str(v) if v is not None else ''
    return int(s) if s.isdigit() and int(s) <= 65535 else None


def primeiro(v):
    if isinstance(v, list):
        return v[0] if v else None
    return v


def de_dionaea(a, regra, d):
    con = d.get('connection') or {}
    ip = ip_ok(d.get('src_ip'))
    if not ip or con.get('type') not in ('accept', None):
        return None
    cred = d.get('credentials') or {}
    usuario, senha = primeiro(cred.get('username')), primeiro(cred.get('password'))
    downloads = d.get('downloads')
    det = detalhes_base(a, regra)
    if downloads:
        acao = 'download'
        dl = primeiro(downloads) if isinstance(downloads, list) else downloads
        if isinstance(dl, dict):
            det['url'] = clip(primeiro(dl.get('url')), 300)
            det['md5'] = clip(primeiro(dl.get('md5_hash')), 32)
    elif usuario:
        acao = 'login_falha'
    else:
        acao = 'conexao'
    ftp = (d.get('ftp') or {}).get('commands') or {}
    if ftp.get('command'):
        det['comando'] = clip(' '.join(f"{c} {primeiro([x]) or ''}".strip() for c, x in zip(ftp.get('command', []), ftp.get('arguments', []))), 500)
    servico = clip((con.get('protocol') or '').removesuffix('d') or None, 32)
    return {'fonte': 'dionaea', 'ocorridoEm': quando(a), 'ipOrigem': ip, 'portaDestino': porta(d.get('dst_port')),
            'protocolo': clip(con.get('transport'), 16), 'servico': servico, 'acao': acao,
            'usuarioTentado': clip(usuario, 128), 'senhaTentada': clip(senha, 128),
            'alvo': clip((a.get('agent') or {}).get('name'), 128), 'detalhes': det}


def de_fortigate(a, regra, d):
    """So o que vem da internet: bloqueios, IPS e falhas de login administrativo."""
    ip = ip_ok(d.get('srcip'))
    if not ip or not publico(ip):
        return None
    grupos = set(regra.get('groups') or [])
    acao_fw = str(d.get('action', '')).lower()
    det = detalhes_base(a, regra)
    if 'authentication_failed' in grupos:
        acao = 'login_falha'
    elif d.get('subtype') == 'ips' or d.get('attack'):
        acao = 'outro'
        det['ips'] = clip(d.get('attack'), 200)
    elif acao_fw in ('deny', 'blocked', 'dropped', 'block'):
        acao = 'bloqueio'
    else:
        return None
    return {'fonte': 'fortigate', 'ocorridoEm': quando(a), 'ipOrigem': ip,
            'portaDestino': porta(d.get('dstport')),
            'protocolo': clip(d.get('proto'), 16), 'servico': clip(d.get('service'), 32), 'acao': acao,
            'usuarioTentado': clip(d.get('user'), 128) if acao == 'login_falha' else None,
            'alvo': clip(d.get('devname'), 128), 'detalhes': det}


def de_windows(a, regra, d):
    """Windows/Sysmon: so regras com MITRE e nivel minimo (ex.: ataques da Kali no range)."""
    if not CFG['win'] or int(regra.get('level', 0)) < CFG['win_min'] or not mitre(regra):
        return None
    win = d.get('win') or {}
    ed = win.get('eventdata') or {}
    sysd = win.get('system') or {}
    ip = ip_ok(ed.get('ipAddress') or ed.get('sourceIp') or ed.get('sourceAddress'))
    grupos = set(regra.get('groups') or [])
    if str(sysd.get('eventID')) == '4740':
        acao = 'lockout'
    elif 'authentication_failed' in grupos or 'authentication_failures' in grupos:
        acao = 'login_falha'
    elif 'authentication_success' in grupos:
        acao = 'login_ok'
    elif ed.get('commandLine'):
        acao = 'comando'
    else:
        acao = 'outro'
    if not ip and acao != 'lockout':
        ip = None
    det = detalhes_base(a, regra)
    det['evento'] = clip(sysd.get('eventID'), 10)
    if ed.get('commandLine'):
        det['comando'] = clip(ed.get('commandLine'), 500)
    ev = {'fonte': 'windows', 'ocorridoEm': quando(a), 'ipOrigem': ip,
          'portaDestino': porta(ed.get('destinationPort')),
          'servico': clip(sysd.get('channel', '').split('/')[0].split('-')[-1] or None, 32), 'acao': acao,
          'usuarioTentado': clip(ed.get('targetUserName'), 128) if acao in ('login_falha', 'login_ok', 'lockout') else None,
          'alvo': clip((a.get('agent') or {}).get('name'), 128), 'detalhes': det}
    if ev['ipOrigem'] is None and acao != 'lockout':
        return None  # a API exige IP fora de lockout
    return ev


def tentativas_heralding(v):
    """auth_attempts chega como lista ou como texto no formato repr do Python."""
    if isinstance(v, list):
        return [(x.get('username'), x.get('password')) for x in v if isinstance(x, dict)]
    if isinstance(v, str):
        us = re.findall(r"'username': '((?:[^'\\]|\\.)*)'", v)
        ps = re.findall(r"'password': '((?:[^'\\]|\\.)*)'", v)
        return list(zip(us, ps))
    return []


def de_heralding(a, regra, d):
    ip = ip_ok(d.get('source_ip'))
    if not ip:
        return None
    tent = tentativas_heralding(d.get('auth_attempts'))
    det = detalhes_base(a, regra)
    det['tentativas'] = porta(d.get('num_auth_attempts')) or len(tent)
    usuario, senha = tent[0] if tent else (None, None)
    return {'fonte': 'heralding', 'ocorridoEm': quando(a), 'ipOrigem': ip, 'portaDestino': porta(d.get('destination_port')),
            'protocolo': 'tcp', 'servico': clip(d.get('protocol'), 32), 'acao': 'login_falha' if tent else 'conexao',
            'usuarioTentado': clip(usuario, 128), 'senhaTentada': clip(senha, 128),
            'alvo': clip((a.get('agent') or {}).get('name'), 128), 'detalhes': det}


ISCA_ACAO = {'credencial': 'login_falha', 'container_create': 'comando', 'container_exec': 'comando',
             'image_pull': 'download', 'comando': 'comando'}


def de_isca(a, regra, d):
    ip = ip_ok(d.get('src_ip'))
    if not ip:
        return None
    acao = ISCA_ACAO.get(d.get('acao'), 'conexao')
    det = detalhes_base(a, regra)
    if d.get('caminho'):
        det['url'] = clip(f"{d.get('metodo', '')} {d.get('caminho')}".strip(), 300)
    if d.get('corpo'):
        det['comando'] = clip(d.get('corpo'), 500)
    elif d.get('comandos'):
        cmds = d.get('comandos')
        det['comando'] = clip(cmds if isinstance(cmds, str) else json.dumps(cmds, ensure_ascii=False), 500)
    if d.get('user_agent'):
        det['userAgent'] = clip(d.get('user_agent'), 200)
    login = acao == 'login_falha'
    return {'fonte': 'isca', 'ocorridoEm': quando(a), 'ipOrigem': ip, 'portaDestino': porta(d.get('dst_port')),
            'protocolo': 'tcp', 'servico': clip(d.get('isca_servico'), 32), 'acao': acao,
            'usuarioTentado': clip(d.get('usuario'), 128) if login else None,
            'senhaTentada': clip(d.get('senha'), 128) if login else None,
            'alvo': clip((a.get('agent') or {}).get('name'), 128), 'detalhes': det}


SERVICO_UDP = {53: 'dns', 123: 'ntp', 1900: 'ssdp', 11211: 'memcached'}


def de_reflexao(a, regra, d):
    """Pacote UDP que o firewall registrou e descartou. A origem e falsificada: e a VITIMA do ataque."""
    ip = ip_ok(d.get('srcip'))
    if not ip:
        return None
    p = porta(d.get('dstport'))
    det = detalhes_base(a, regra)
    det['vitimaFalsificada'] = True
    det['bytes'] = porta(d.get('rcvdbyte'))
    det['paisVitima'] = clip(d.get('srccountry'), 40)
    return {'fonte': 'fortigate', 'ocorridoEm': quando(a), 'ipOrigem': ip, 'portaDestino': p, 'protocolo': 'udp',
            'servico': SERVICO_UDP.get(p), 'acao': 'reflexao', 'alvo': clip(d.get('devname'), 128), 'detalhes': det}


def converter(alerta):
    regra = alerta.get('rule') or {}
    grupos = set(regra.get('groups') or [])
    d = alerta.get('data') or {}
    if 'cowrie' in grupos or str(d.get('eventid', '')).startswith('cowrie.'):
        ev = de_cowrie(alerta, regra, d)
    elif 'dionaea' in grupos:
        ev = de_dionaea(alerta, regra, d)
    elif 'heralding' in grupos:
        ev = de_heralding(alerta, regra, d)
    elif 'isca' in grupos:
        ev = de_isca(alerta, regra, d)
    elif 'reflexao' in grupos:
        ev = de_reflexao(alerta, regra, d)
    elif 'fortigate' in grupos:
        ev = de_fortigate(alerta, regra, d)
    elif 'windows' in grupos or 'sysmon' in grupos:
        ev = de_windows(alerta, regra, d)
    else:
        ev = None
    return limpar(ev) if ev else None


# ---------- estado e leitura ----------
def ler_estado():
    try:
        return json.load(open(CFG['state']))
    except (OSError, ValueError):
        return {}


def gravar_estado(st):
    os.makedirs(os.path.dirname(CFG['state']), exist_ok=True)
    tmp = CFG['state'] + '.tmp'
    json.dump(st, open(tmp, 'w'))
    os.replace(tmp, CFG['state'])


def enviar(eventos):
    if CFG['dry']:
        for e in eventos:
            print(json.dumps(e, ensure_ascii=False))
        return True
    corpo = json.dumps({'eventos': eventos}).encode()
    req = urllib.request.Request(CFG['url'], data=corpo, method='POST', headers={
        'Content-Type': 'application/json', 'CF-Access-Client-Id': CFG['cid'],
        'CF-Access-Client-Secret': CFG['csec'], 'X-Ingest-Token': CFG['token'],
        'User-Agent': 'seginfo-wazuh-forwarder/1'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.load(r)
            log(f"enviados {len(eventos)}, inseridos {resp.get('inseridos')}")
            return True
    except urllib.error.HTTPError as e:
        corpo = e.read()[:300].decode('utf-8', 'replace')
        log(f'erro http {e.code}: {corpo}')
        if e.code == 400:  # lote invalido: descarta para nao travar a fila
            log('lote descartado (payload invalido)')
            return True
        return False
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        log(f'erro de rede: {e}')
        return False


def main():
    if not CFG['dry']:
        faltando = [k for k, v in (('INGEST_URL', CFG['url']), ('CF_ACCESS_CLIENT_ID', CFG['cid']),
                                   ('CF_ACCESS_CLIENT_SECRET', CFG['csec']), ('INGEST_TOKEN', CFG['token'])) if not v]
        if faltando:
            log('erro: faltam variaveis', ', '.join(faltando))
            sys.exit(1)
        if not CFG['url'].startswith('https://'):
            log('erro: INGEST_URL precisa ser https://')
            sys.exit(1)
    parar = []
    signal.signal(signal.SIGTERM, lambda *_: parar.append(1))
    st = ler_estado()  # posicao CONFIRMADA (tudo antes dela foi aceito pela API)
    lido = st.get('pos', 0)  # posicao ja lida para a fila (pode estar a frente de st)
    fila, espera, ultimo_envio = [], 5, time.time()
    log('iniciado; arquivo', CFG['alerts'])
    while not parar:
        try:
            info = os.stat(CFG['alerts'])
        except OSError:
            time.sleep(5)
            continue
        if st.get('inode') != info.st_ino or lido > info.st_size:
            # arquivo novo/rotacionado: na primeira execucao comeca do fim (nao reenvia historico)
            st = {'inode': info.st_ino, 'pos': 0 if (st.get('inode') or CFG['desde_inicio']) else info.st_size}
            lido = st['pos']
        pos = lido
        if len(fila) < FILA_MAX and info.st_size > pos:
            with open(CFG['alerts'], 'rb') as f:
                f.seek(pos)
                for linha in f:
                    if not linha.endswith(b'\n'):
                        break
                    pos += len(linha)
                    try:
                        ev = converter(json.loads(linha.decode('utf-8', 'replace')))
                    except (ValueError, TypeError, AttributeError) as e:
                        log(f'alerta ignorado ({type(e).__name__})')
                        ev = None
                    if ev:
                        fila.append(ev)
                    if len(fila) >= FILA_MAX:
                        break
        lido = pos
        if fila and (len(fila) >= LOTE or time.time() - ultimo_envio >= CFG['flush']):
            ok = True
            while fila and ok:
                ok = enviar(fila[:LOTE])
                if ok:
                    del fila[:LOTE]
            ultimo_envio = time.time()
            if not ok:
                time.sleep(espera)
                espera = min(espera * 2, 300)
                continue
            espera = 5
        if not fila and st.get('pos') != lido:
            st = {'inode': st['inode'], 'pos': lido}
            gravar_estado(st)
        time.sleep(1 if not fila else 0.2)
    log('encerrado')


if __name__ == '__main__':
    main()
