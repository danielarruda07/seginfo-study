"""Iscas de serviços que os bots adoram (Redis 6379, Elasticsearch 9200, API do Docker 2375).
Só registram o que o atacante manda e devolvem respostas mínimas e plausíveis; nada é executado.
Log JSON por linha em /logs/isca.json."""
import asyncio
import datetime
import json
import os
import uuid

LOG = '/logs/isca.json'
MAX = 16384


def gravar(ev):
    ev['timestamp'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with open(LOG, 'a', encoding='utf-8') as f:
        f.write(json.dumps(ev, ensure_ascii=False) + '\n')


def base(w, porta, servico):
    ip, p = w.get_extra_info('peername')[:2]
    return {'isca_servico': servico, 'src_ip': ip, 'src_port': p, 'dst_port': porta}


async def ler(r, n=MAX, t=30):
    try:
        return await asyncio.wait_for(r.read(n), t)
    except (asyncio.TimeoutError, ConnectionError):
        return b''


# ---------- Redis ----------
def resp_args(buf):
    """Extrai comandos RESP ou inline de um buffer."""
    cmds, linhas, i = [], buf.split(b'\r\n'), 0
    while i < len(linhas):
        lin = linhas[i]
        if lin.startswith(b'*') and lin[1:].isdigit():
            n, args, i = int(lin[1:]), [], i + 1
            for _ in range(n):
                if i + 1 < len(linhas):
                    args.append(linhas[i + 1].decode('utf-8', 'replace'))
                    i += 2
            cmds.append(args)
        elif lin.strip():
            cmds.append(lin.decode('utf-8', 'replace').split())
            i += 1
        else:
            i += 1
    return cmds


async def redis(r, w):
    ev = base(w, 6379, 'redis')
    todos = []
    for _ in range(20):
        dados = await ler(r)
        if not dados:
            break
        for c in resp_args(dados):
            if not c:
                continue
            todos.append(c[:6])
            cmd = c[0].upper()
            if cmd == 'AUTH':
                ev['usuario'] = c[1] if len(c) > 2 else 'default'
                ev['senha'] = c[-1]
                w.write(b'-WRONGPASS invalid username-password pair or user is disabled.\r\n')
            elif cmd == 'QUIT':
                w.write(b'+OK\r\n')
            else:
                w.write(b'-NOAUTH Authentication required.\r\n')
        await w.drain()
    ev['comandos'] = todos[:50]
    ev['acao'] = 'credencial' if 'senha' in ev else ('comando' if todos else 'conexao')
    gravar(ev)


# ---------- HTTP (Elasticsearch e Docker) ----------
def http_resp(codigo, corpo, tipo='application/json'):
    b = corpo.encode() if isinstance(corpo, str) else corpo
    cab = f'HTTP/1.1 {codigo}\r\nContent-Type: {tipo}\r\nContent-Length: {len(b)}\r\nConnection: close\r\n\r\n'
    return cab.encode() + b


ES_BANNER = json.dumps({"name": "es-node-01", "cluster_name": "logs-prod", "cluster_uuid": "b3pRk0vQSuG2m1e7x9Xw4A",
                        "version": {"number": "7.10.2", "build_flavor": "default", "lucene_version": "8.7.0"},
                        "tagline": "You Know, for Search"})
DOCKER_VER = json.dumps({"Version": "20.10.24", "ApiVersion": "1.41", "MinAPIVersion": "1.12", "Os": "linux",
                         "Arch": "amd64", "KernelVersion": "5.15.0-105-generic", "GoVersion": "go1.19.9"})


async def http(r, w, porta, servico):
    ev = base(w, porta, servico)
    dados = await ler(r)
    texto = dados.decode('utf-8', 'replace')
    partes = texto.split('\r\n', 1)[0].split(' ')
    metodo, caminho = (partes[0], partes[1]) if len(partes) >= 2 else ('', '')
    corpo = texto.split('\r\n\r\n', 1)[1][:4000] if '\r\n\r\n' in texto else ''
    ev.update({'metodo': metodo[:10], 'caminho': caminho[:500], 'corpo': corpo, 'user_agent': ''})
    for lin in texto.split('\r\n'):
        if lin.lower().startswith('user-agent:'):
            ev['user_agent'] = lin[11:].strip()[:200]
    ev['acao'] = 'requisicao'
    if servico == 'elasticsearch':
        resp = http_resp('200 OK', ES_BANNER if caminho in ('/', '') else '{"acknowledged":true}')
    elif '/containers/create' in caminho:
        ev['acao'] = 'container_create'
        resp = http_resp('201 Created', json.dumps({"Id": uuid.uuid4().hex * 2, "Warnings": []}))
    elif '/start' in caminho or '/exec' in caminho:
        ev['acao'] = 'container_exec'
        resp = http_resp('204 No Content', '')
    elif '/images/create' in caminho:
        ev['acao'] = 'image_pull'
        resp = http_resp('200 OK', '{"status":"Download complete"}')
    elif '_ping' in caminho:
        resp = http_resp('200 OK', 'OK', 'text/plain')
    elif '/version' in caminho or caminho in ('/', ''):
        resp = http_resp('200 OK', DOCKER_VER)
    else:
        resp = http_resp('200 OK', '[]')
    w.write(resp)
    await w.drain()
    gravar(ev)


def handler(fn, *a):
    async def h(r, w):
        try:
            await fn(r, w, *a)
        except Exception as e:  # nunca derrubar a isca
            try:
                gravar({'isca_servico': 'erro', 'erro': repr(e)[:200]})
            except Exception:
                pass
        finally:
            try:
                w.close()
            except Exception:
                pass
    return h


async def main():
    os.makedirs('/logs', exist_ok=True)
    s = [await asyncio.start_server(handler(redis), '0.0.0.0', 6379),
         await asyncio.start_server(handler(http, 9200, 'elasticsearch'), '0.0.0.0', 9200),
         await asyncio.start_server(handler(http, 2375, 'docker'), '0.0.0.0', 2375)]
    print('iscas no ar: 6379 9200 2375', flush=True)
    await asyncio.gather(*(x.serve_forever() for x in s))


asyncio.run(main())
