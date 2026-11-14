"""Gera /data/heralding.yml a partir do padrão do pacote: liga só os protocolos que não colidem com Cowrie/Dionaea."""
import os

import heralding
import yaml

base = yaml.safe_load(open(os.path.join(os.path.dirname(heralding.__file__), 'heralding.yml')))
QUERO = {'vnc': 5900, 'postgresql': 5432, 'smtp': 25, 'pop3': 110, 'imap': 143}
for nome, cfg in base.get('capabilities', {}).items():
    cfg['enabled'] = nome in QUERO
    if nome in QUERO:
        cfg['port'] = QUERO[nome]
log = base.setdefault('activity_logging', {})
arq = log.setdefault('file', {})
arq['enabled'] = True
for k in list(arq):
    if k.endswith('_file'):
        arq[k] = '/logs/' + os.path.basename(str(arq[k]))
for k in list(log):
    if k != 'file' and isinstance(log[k], dict):
        log[k]['enabled'] = False
if 'hash_cracker' in base:
    base['hash_cracker']['enabled'] = False
yaml.safe_dump(base, open('/data/heralding.yml', 'w'))
print('ligados:', [n for n, c in base['capabilities'].items() if c.get('enabled')], 'logs:', arq, flush=True)
