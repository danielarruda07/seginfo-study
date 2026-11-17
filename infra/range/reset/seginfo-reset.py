#!/usr/bin/env python3
"""Volta os alvos reais do honeypot ao snapshot "limpo" (token minimo range-reset@pve).
Variaveis (EnvironmentFile, modo 600): PVE_URL, PVE_TOKEN_ID, PVE_TOKEN_SECRET, PVE_NODE, VMIDS, SNAPSHOT.
O no de cada VM e descoberto no cluster (a VM pode ter migrado); PVE_NODE so vale se a consulta falhar.
VMIDS pode vir da linha de comando (ex.: o timer diario da isca web passa "823")."""
import json, os, ssl, sys, time, urllib.parse, urllib.request
E = os.environ.get
URL, NODE, SNAP = E('PVE_URL').rstrip('/') + '/api2/json/', E('PVE_NODE', 'pm02'), E('SNAPSHOT', 'limpo')
HDR = {'Authorization': f"PVEAPIToken={E('PVE_TOKEN_ID')}={E('PVE_TOKEN_SECRET')}"}
CTX = ssl._create_unverified_context()

def call(m, p, d=None):
    req = urllib.request.Request(URL + p, method=m, headers=HDR, data=urllib.parse.urlencode(d).encode() if d else None)
    with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
        return json.load(r)['data']

def no_da_vm(vm):
    try:
        for r in call('GET', 'cluster/resources?type=vm'):
            if str(r.get('vmid')) == str(vm):
                return r['node']
    except Exception as e:
        print(f'{vm}: nao consegui consultar o cluster ({type(e).__name__}); usando {NODE}')
    return NODE

def esperar(upid, node):
    q = urllib.parse.quote(upid, safe='')
    for _ in range(120):
        st = call('GET', f'nodes/{node}/tasks/{q}/status')
        if st.get('status') == 'stopped':
            return st.get('exitstatus') == 'OK'
        time.sleep(5)
    return False

falhas = 0
vmids = sys.argv[1] if len(sys.argv) > 1 else E('VMIDS', '')
for vm in [v.strip() for v in vmids.split(',') if v.strip()]:
    try:
        NO = no_da_vm(vm)
        snaps = [s['name'] for s in call('GET', f'nodes/{NO}/qemu/{vm}/snapshot')]
        if SNAP not in snaps:
            print(f'{vm}: sem snapshot {SNAP}, pulando'); continue
        ok = esperar(call('POST', f'nodes/{NO}/qemu/{vm}/snapshot/{SNAP}/rollback'), NO)
        if call('GET', f'nodes/{NO}/qemu/{vm}/status/current')['status'] != 'running':
            ok = esperar(call('POST', f'nodes/{NO}/qemu/{vm}/status/start'), NO) and ok
        print(f'{vm} ({NO}): reset {"OK" if ok else "FALHOU"}'); falhas += 0 if ok else 1
    except Exception as e:
        print(f'{vm}: erro {type(e).__name__}: {e}'); falhas += 1
sys.exit(1 if falhas else 0)
