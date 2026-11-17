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
  GEOIP_CSV                  base pais por IP (DB-IP "IP to Country Lite", CSV ou CSV.gz); padrao
                             /var/lib/seginfo-forwarder/dbip-country-lite.csv.gz. Sem o arquivo, segue sem pais.

Senha tentada: enviada so para fontes de honeypot; o servidor so guarda com
RADAR_GUARDAR_SENHAS=true (do contrario descarta).
"""
import bisect
import datetime as dt
import gzip
import ipaddress
import json
import os
import re
import signal
import sys
import time
import urllib.error
import urllib.request
from array import array

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
    'geoip': env('GEOIP_CSV', '/var/lib/seginfo-forwarder/dbip-country-lite.csv.gz'),
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


class GeoIP:
    """Pais por IP a partir do CSV do DB-IP (inicio,fim,pais), em memoria e com busca binaria.

    IPv4 fica em array compacto (poucos MB); IPv6 em lista. Recarrega sozinho quando o arquivo muda
    (a base Lite sai todo mes). Sem arquivo, pais() devolve None e o evento segue sem pais.
    """

    def __init__(self, caminho):
        self.caminho, self.mtime, self.proxima = caminho, None, 0.0
        self.v4 = (array('L'), array('L'), [])
        self.v6 = ([], [], [])
        self.recarregar()

    def recarregar(self):
        self.proxima = time.time() + 3600
        try:
            mtime = os.stat(self.caminho).st_mtime
        except OSError:
            if self.mtime is None:
                log('geoip: base nao encontrada em', self.caminho, '- eventos seguem sem pais')
                self.mtime = 0
            return
        if mtime == self.mtime:
            return
        linhas = {4: [], 6: []}
        abrir = gzip.open if self.caminho.endswith('.gz') else open
        try:
            with abrir(self.caminho, 'rt', encoding='utf-8', newline='') as f:
                for linha in f:
                    partes = [p.strip().strip('"') for p in linha.split(',')]
                    if len(partes) < 3 or len(partes[2]) != 2 or partes[2] == 'ZZ':
                        continue
                    try:
                        ini, fim = ipaddress.ip_address(partes[0]), ipaddress.ip_address(partes[1])
                    except ValueError:
                        continue
                    linhas[ini.version].append((int(ini), int(fim), sys.intern(partes[2].upper())))
        except (OSError, EOFError, UnicodeDecodeError) as e:
            log(f'geoip: falha ao ler a base ({type(e).__name__}); mantendo a anterior')
            return
        for v in linhas.values():
            v.sort()
        l4, l6 = linhas[4], linhas[6]
        self.v4 = (array('L', (x[0] for x in l4)), array('L', (x[1] for x in l4)), [x[2] for x in l4])
        self.v6 = ([x[0] for x in l6], [x[1] for x in l6], [x[2] for x in l6])
        self.mtime = mtime
        log(f'geoip: {len(l4)} faixas IPv4 e {len(l6)} IPv6 carregadas')

    def pais(self, ip):
        if time.time() >= self.proxima:
            self.recarregar()
        try:
            a = ipaddress.ip_address(ip)
        except ValueError:
            return None
        ini, fim, cc = self.v4 if a.version == 4 else self.v6
        n = int(a)
        i = bisect.bisect_right(ini, n) - 1
        return cc[i] if i >= 0 and n <= fim[i] else None


GEO = None  # criado em main()


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
    elif 'varredura' in grupos:
        # regra 100331: o mesmo IP em muitas portas expostas do range em pouco tempo (T1046)
        acao = 'scan'
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


def sim(v):
    """Booleano do JSON da isca. O decodificador do Wazuh entrega true/false como texto ("true")."""
    return v is True or (isinstance(v, str) and v.strip().lower() == 'true')


def numero(v, tipo=float):
    """Número do JSON da isca, que no alerta do Wazuh também pode chegar como texto."""
    if isinstance(v, bool) or v is None:
        return None
    try:
        return tipo(v)
    except (TypeError, ValueError):
        return None


def nomes(v):
    """Lista de nomes de campos (nunca valores); o Wazuh mantém a lista ou entrega um texto só."""
    itens = v if isinstance(v, list) else [v] if isinstance(v, str) and v else []
    return [clip(k, 40) for k in itens[:12] if isinstance(k, str)]


def de_prompt_honeypot(a, regra, d):
    """Sinais HTTP do prompt-canary; valores de campos e corpo nunca são encaminhados."""
    ip = ip_ok(d.get('src_ip'))
    if not ip:
        return None
    tipo = clip(d.get('event_type'), 32) or 'request'
    acao = 'login_falha' if tipo == 'login_attempt' else 'scan'
    det = detalhes_base(a, regra)
    det.update({
        'evento': tipo,
        'caminho': clip(d.get('path'), 200),
        'metodo': clip(d.get('method'), 12),
        'session': clip(d.get('session_id'), 32),
        'classeUserAgent': clip(d.get('user_agent_class'), 32),
        'intervaloSegundos': numero(d.get('gap_seconds')),
        'metodosNaSessao': numero(d.get('method_count'), int),
        'chavesQuery': nomes(d.get('query_keys')),
        'camposFormulario': nomes(d.get('body_fields')),
        'canarioSeguido': sim(d.get('canary_followed')),
        'credencialIscaUsada': sim(d.get('canary_credential_used')),
        'trocaUserAgent': sim(d.get('ua_switch')),
        'metodoIncomum': sim(d.get('unusual_method')),
        'padraoPausaRajada': sim(d.get('sawtooth_candidate')),
        'sinais': [k for k in ('sqli', 'xss', 'ssti', 'cmd') if sim(d.get(f'probe_{k}'))],
        'classificacao': 'sinais comportamentais; não confirma uso de IA',
    })
    return {'fonte': 'prompt_honeypot', 'ocorridoEm': quando(a), 'ipOrigem': ip,
            'portaDestino': porta(d.get('dst_port')), 'protocolo': 'tcp', 'servico': 'http-prompt-canary',
            'acao': acao, 'alvo': clip((a.get('agent') or {}).get('name'), 128), 'detalhes': det}


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


# Isca web (WordPress/DVWA/Juice Shop atras de um nginx): o nginx grava o log no formato combinado mais
# "host=<vhost> scheme=<http|https>" no fim; o decoder web-accesslog do Wazuh entrega srcip, protocol (metodo),
# url e id (status). O resto sai do full_log.
WEB_LINHA = re.compile(r'"(?P<metodo>[A-Z]{3,10}) (?P<url>\S+)[^"]*" (?P<status>\d{3}) \S+ "[^"]*" "(?P<ua>[^"]*)"'
                       r'(?: host=(?P<host>\S+))?(?: scheme=(?P<scheme>https?))?')
WEB_GRUPOS_ATAQUE = {'attack', 'sql_injection', 'xss', 'web_attack', 'exploit_attempt', 'webshell'}
WEB_LOGIN = re.compile(r'/(wp-login\.php|xmlrpc\.php)|/login(\.php)?\b|/rest/user/login', re.I)


def servico_web(host):
    h = (host or '').lower()
    if h.startswith('dvwa.'):
        return 'dvwa'
    if h.startswith('shop.'):
        return 'juice-shop'
    return 'wordpress'


def de_web(a, regra, d):
    grupos = set(regra.get('groups') or [])
    det = detalhes_base(a, regra)
    fim = a.get('syscheck') or {}
    if fim.get('path'):
        # arquivo novo/alterado no site: webshell ou alteracao feita pelo invasor (o FIM nao tem IP)
        det['arquivo'] = clip(fim.get('path'), 500)
        det['alteracao'] = clip(fim.get('event'), 32)
        return {'fonte': 'isca', 'ocorridoEm': quando(a), 'acao': 'download', 'servico': 'wordpress',
                'alvo': clip((a.get('agent') or {}).get('name'), 128), 'detalhes': det}
    ip = ip_ok(d.get('srcip'))
    if not ip:
        return None
    m = WEB_LINHA.search(a.get('full_log') or '')
    metodo = (m.group('metodo') if m else None) or d.get('protocol') or ''
    url = (m.group('url') if m else None) or d.get('url') or ''
    det['url'] = clip(f'{metodo} {url}'.strip(), 300)
    if m and m.group('ua') not in (None, '', '-'):
        det['userAgent'] = clip(m.group('ua'), 200)
    status = (m.group('status') if m else None) or d.get('id')
    if status:
        det['status'] = clip(status, 3)
    https = bool(m and m.group('scheme') == 'https')
    if grupos & WEB_GRUPOS_ATAQUE:
        acao = 'comando'
    elif 'authentication_failed' in grupos or 'authentication_failures' in grupos or (
            metodo == 'POST' and WEB_LOGIN.search(url)):
        acao = 'login_falha'
    elif grupos & {'web_scan', 'recon', 'invalid_access'} or str(status).startswith('4'):
        acao = 'scan'
    else:
        acao = 'conexao'
    return {'fonte': 'isca', 'ocorridoEm': quando(a), 'ipOrigem': ip, 'portaDestino': 443 if https else 80,
            'protocolo': 'tcp', 'servico': servico_web(m.group('host') if m else None), 'acao': acao,
            'alvo': clip((a.get('agent') or {}).get('name'), 128), 'detalhes': det}


def ambiente_alerta(alerta):
    agent = alerta.get('agent') or {}
    labels = agent.get('labels') or {}
    if isinstance(labels, list):
        labels = {x.get('key'): x.get('value') for x in labels if isinstance(x, dict)}
    value = labels.get('environment') if isinstance(labels, dict) else None
    if value in ('production', 'producao'):
        return 'producao'
    if value in ('laboratory', 'laboratorio', 'lab', 'range'):
        return 'laboratorio'
    if str(agent.get('id')) == '000':
        return 'nao_classificado'
    name = str(agent.get('name', '')).lower()
    if name.startswith('prod-'):
        return 'producao'
    if name.startswith('range-') and name != 'range-wazuh':
        return 'laboratorio'
    return 'nao_classificado'


def de_producao(a, regra, d):
    """Metadados de alertas de produção; não exige MITRE nem inventa IP remoto."""
    if int(regra.get('level', 0)) < 3:
        return None
    win = d.get('win') or {}
    ed, system = win.get('eventdata') or {}, win.get('system') or {}
    event_id = str(system.get('eventID', ''))
    acao = {'4625': 'login_falha', '4624': 'login_ok', '1149': 'login_ok', '4740': 'lockout'}.get(event_id, 'outro')
    groups = set(regra.get('groups') or [])
    if acao == 'outro' and groups.intersection({'authentication_failed', 'authentication_failures'}):
        acao = 'login_falha'
    elif acao == 'outro' and 'authentication_success' in groups:
        acao = 'login_ok'
    remote = ed.get('ipAddress') or ed.get('sourceIp') or ed.get('sourceAddress') or d.get('srcip')
    try:
        ip = str(ipaddress.ip_address(str(remote)))
    except ValueError:
        ip = None
    det = detalhes_base(a, regra)
    det.update({'ambiente': 'producao', 'agentId': clip((a.get('agent') or {}).get('id'), 12),
                'evento': clip(event_id, 12), 'canal': clip(system.get('channel'), 128)})
    fim = a.get('syscheck') or {}
    if fim.get('path'):
        det['arquivo'] = clip(fim.get('path'), 500)
        det['alteracao'] = clip(fim.get('event'), 32)
    return {'fonte': 'wazuh', 'ambiente': 'producao', 'ocorridoEm': quando(a), 'ipOrigem': ip,
            'acao': acao, 'alvo': clip((a.get('agent') or {}).get('name'), 128),
            'usuarioTentado': clip(ed.get('targetUserName') or d.get('dstuser'), 128),
            'servico': clip(system.get('channel') or a.get('location'), 32), 'detalhes': det}


def converter(alerta):
    regra = alerta.get('rule') or {}
    grupos = set(regra.get('groups') or [])
    d = alerta.get('data') or {}
    if ambiente_alerta(alerta) == 'producao':
        ev = de_producao(alerta, regra, d)
    elif 'cowrie' in grupos or str(d.get('eventid', '')).startswith('cowrie.'):
        ev = de_cowrie(alerta, regra, d)
    elif 'dionaea' in grupos:
        ev = de_dionaea(alerta, regra, d)
    elif 'heralding' in grupos:
        ev = de_heralding(alerta, regra, d)
    elif 'isca_web' in grupos or 'accesslog' in grupos or (
            'syscheck' in grupos and str((alerta.get('agent') or {}).get('name', '')).startswith('range-isca-web')):
        ev = de_web(alerta, regra, d)
    elif 'isca' in grupos:
        ev = de_isca(alerta, regra, d)
    elif 'prompt_honeypot' in grupos:
        ev = de_prompt_honeypot(alerta, regra, d)
    elif 'reflexao' in grupos:
        ev = de_reflexao(alerta, regra, d)
    elif 'fortigate' in grupos:
        ev = de_fortigate(alerta, regra, d)
    elif 'windows' in grupos or 'sysmon' in grupos:
        ev = de_windows(alerta, regra, d)
    else:
        ev = None
    if ev and 'ambiente' not in ev:
        ambiente = ambiente_alerta(alerta)
        if ev.get('fonte') in ('cowrie', 'dionaea', 'opencanary', 'heralding', 'isca', 'prompt_honeypot') or 'reflexao' in grupos:
            ambiente = 'laboratorio'
        elif ev.get('fonte') == 'fortigate':
            ambiente = 'laboratorio' if (str(d.get('policyname', '')).upper().startswith('RANGE-')
                                         or 'varredura' in grupos) else 'nao_classificado'
        ev['ambiente'] = ambiente
    if ev and GEO and ev.get('ipOrigem') and publico(ev['ipOrigem']):
        ev['paisOrigem'] = GEO.pais(ev['ipOrigem'])
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
    """Envia o lote; se a API recusar o formato (400), divide ao meio ate isolar o evento ruim.

    So o evento invalido e descartado (com fonte, acao e horario no log); os validos entram.
    Devolve False em erro de rede/servidor, para o lote inteiro ser reenviado depois (a API
    deduplica o que ja tinha entrado).
    """
    if CFG['dry']:
        for e in eventos:
            print(json.dumps(e, ensure_ascii=False))
        return True
    r = postar(eventos)
    if r != 'invalido':
        return r == 'ok'
    if len(eventos) == 1:
        e = eventos[0]
        log(f"evento descartado (formato recusado): fonte={e.get('fonte')} acao={e.get('acao')} em={e.get('ocorridoEm')}")
        return True
    meio = len(eventos) // 2
    return enviar(eventos[:meio]) and enviar(eventos[meio:])


def postar(eventos):
    """Envia um lote. Devolve 'ok', 'invalido' (HTTP 400) ou 'erro' (rede, 401, 5xx: tentar de novo)."""
    corpo = json.dumps({'eventos': eventos}).encode()
    req = urllib.request.Request(CFG['url'], data=corpo, method='POST', headers={
        'Content-Type': 'application/json', 'CF-Access-Client-Id': CFG['cid'],
        'CF-Access-Client-Secret': CFG['csec'], 'X-Ingest-Token': CFG['token'],
        'User-Agent': 'seginfo-wazuh-forwarder/1'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.load(r)
            log(f"enviados {len(eventos)}, inseridos {resp.get('inseridos')}")
            return 'ok'
    except urllib.error.HTTPError as e:
        corpo = e.read()[:300].decode('utf-8', 'replace')
        log(f'erro http {e.code}: {corpo}')
        return 'invalido' if e.code == 400 else 'erro'
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        log(f'erro de rede: {e}')
        return 'erro'


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
    global GEO
    GEO = GeoIP(CFG['geoip']) if CFG['geoip'] else None
    parar = []
    signal.signal(signal.SIGTERM, lambda *_: parar.append(1))
    salvo = ler_estado()  # posicao CONFIRMADA (tudo antes dela foi aceito pela API)
    fh, ino, lido = None, None, 0  # arquivo aberto, seu inode e a posicao ja lida para a fila
    fila, espera, ultimo_envio = [], 5, time.time()
    log('iniciado; arquivo', CFG['alerts'])
    while not parar:
        if fh is None:
            try:
                fh = open(CFG['alerts'], 'rb')
            except OSError:
                time.sleep(5)
                continue
            info = os.fstat(fh.fileno())
            ino = info.st_ino
            if salvo.get('inode') == ino and salvo.get('pos', 0) <= info.st_size:
                lido = salvo.get('pos', 0)
            else:
                # arquivo novo/rotacionado comeca do inicio; na primeira execucao comeca do fim
                # (a nao ser com DESDE_INICIO), para nao reenviar o historico
                lido = 0 if (salvo.get('inode') or CFG['desde_inicio']) else info.st_size
            fh.seek(lido)
        if os.fstat(fh.fileno()).st_size < lido:  # truncado no lugar
            lido = 0
            fh.seek(0)
        no_fim = True
        while len(fila) < FILA_MAX:
            linha = fh.readline()
            if not linha:
                break
            if not linha.endswith(b'\n'):
                fh.seek(lido)  # linha ainda sendo escrita: le na proxima volta
                break
            lido += len(linha)
            try:
                ev = converter(json.loads(linha.decode('utf-8', 'replace')))
            except (ValueError, TypeError, AttributeError) as e:
                log(f'alerta ignorado ({type(e).__name__})')
                ev = None
            if ev:
                fila.append(ev)
        else:
            no_fim = False  # fila cheia: ainda pode haver linhas
        if no_fim:
            # O Wazuh rotaciona o alerts.json a meia-noite. So troca de arquivo depois de ler o
            # antigo ate o fim: o handle aberto continua valido depois do rename.
            try:
                trocou = os.stat(CFG['alerts']).st_ino != ino
            except OSError:
                trocou = False
            if trocou:
                log('arquivo rotacionado; abrindo o novo')
                fh.close()
                fh = None
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
        if not fila and fh is not None and (salvo.get('inode'), salvo.get('pos')) != (ino, lido):
            salvo = {'inode': ino, 'pos': lido}
            gravar_estado(salvo)
        time.sleep(1 if not fila else 0.2)
    if fh:
        fh.close()
    log('encerrado')


if __name__ == '__main__':
    main()
