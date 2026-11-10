// SegInfo Sensor Shipper. Sem dependências (Node 22).
//
// Lê os logs JSON do Cowrie e do OpenCanary, recebe syslog UDP do FortiGate, normaliza
// tudo para o formato de /api/ingest e envia em lotes, com o Service Token do Cloudflare
// Access e o X-Ingest-Token. Eventos ficam em fila em memória se a API estiver fora.

import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { dirname } from 'node:path';
import dgram from 'node:dgram';
import net from 'node:net';

const env = (k, d) => process.env[k] ?? d;
const log = (...a) => console.log(new Date().toISOString(), ...a);

const CFG = {
  url: env('INGEST_URL', ''),
  clientId: env('CF_ACCESS_CLIENT_ID', ''),
  clientSecret: env('CF_ACCESS_CLIENT_SECRET', ''),
  token: env('INGEST_TOKEN', ''),
  sensor: env('SENSOR_NAME', 'sensor-01'),
  syslogAllow: env('SYSLOG_ALLOW', '').split(',').map((s) => s.trim()).filter(Boolean),
  cowrieLog: env('COWRIE_LOG', '/logs/cowrie/cowrie.json'),
  canaryLog: env('CANARY_LOG', '/logs/opencanary/opencanary.log'),
  stateFile: env('STATE_FILE', '/state/offsets.json'),
  flushMs: Number(env('FLUSH_MS', '5000')),
  maxQueue: 5000,
  allowHttp: env('ALLOW_HTTP', 'false') === 'true', // só para teste local
};

for (const [nome, valor] of [['INGEST_URL', CFG.url], ['CF_ACCESS_CLIENT_ID', CFG.clientId],
  ['CF_ACCESS_CLIENT_SECRET', CFG.clientSecret], ['INGEST_TOKEN', CFG.token]]) {
  if (!valor) { log(`erro: variável ${nome} não definida`); process.exit(1); }
}
if (!CFG.url.startsWith('https://') && !CFG.allowHttp) {
  log('erro: INGEST_URL precisa ser https:// (segredos trafegam no header)');
  process.exit(1);
}

// ---------- utilidades ----------
const clip = (s, n) => (s == null || s === '' ? undefined : String(s).slice(0, n));
const intOrUndef = (x) => {
  const n = Number(x);
  return Number.isInteger(n) && n >= 0 && n <= 65535 ? n : undefined;
};

function toIso(ts) {
  let t = ts;
  // OpenCanary: "2026-11-10 12:00:00.123456" (UTC, sem 'Z')
  if (typeof t === 'string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/.test(t)) t = t.replace(' ', 'T') + 'Z';
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) ||
      (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80');
}

// ---------- fila e envio ----------
const queue = [];
function enqueue(ev) {
  queue.push(ev);
  if (queue.length > CFG.maxQueue) queue.splice(0, queue.length - CFG.maxQueue); // descarta os mais antigos
}

async function post(eventos) {
  const res = await fetch(CFG.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Access-Client-Id': CFG.clientId,
      'CF-Access-Client-Secret': CFG.clientSecret,
      'X-Ingest-Token': CFG.token,
    },
    body: JSON.stringify({ eventos }),
    signal: AbortSignal.timeout(15_000),
  });
  return res.status;
}

// Um evento inválido derruba o lote inteiro (400). Divide ao meio para isolar e descartar só ele.
async function sendBatch(batch) {
  const status = await post(batch);
  if (status >= 200 && status < 300) return;
  if (status === 400) {
    if (batch.length === 1) {
      const e = batch[0];
      log(`descartado evento rejeitado (fonte=${e.fonte} acao=${e.acao} ip=${e.ipOrigem ?? '-'})`);
      return;
    }
    const mid = Math.ceil(batch.length / 2);
    await sendBatch(batch.slice(0, mid));
    await sendBatch(batch.slice(mid));
    return;
  }
  throw new Error(`HTTP ${status}`); // 401/403/5xx/rede: mantém na fila e tenta de novo
}

let flushing = false;
async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const batch = queue.slice(0, 200);
      await sendBatch(batch);
      queue.splice(0, batch.length);
    }
  } catch (e) {
    log(`falha ao enviar (${queue.length} na fila, tenta de novo):`, e.message);
  } finally {
    flushing = false;
  }
}

// ---------- leitura incremental dos logs ----------
let offsets = {};
try { offsets = JSON.parse(readFileSync(CFG.stateFile, 'utf8')); } catch { /* primeira execução */ }
function saveOffsets() {
  try {
    mkdirSync(dirname(CFG.stateFile), { recursive: true });
    writeFileSync(CFG.stateFile, JSON.stringify(offsets));
  } catch (e) { log('não consegui salvar offsets:', e.message); }
}

async function tail(file, handler) {
  if (!existsSync(file)) return;
  const size = statSync(file).size;
  let off = offsets[file] ?? 0; // primeira vez: lê desde o início (o servidor deduplica)
  if (size < off) off = 0;      // arquivo rotacionado/truncado
  if (size === off) return;

  const fh = await open(file, 'r');
  try {
    const len = Math.min(size - off, 5 * 1024 * 1024); // no máximo 5 MB por ciclo
    const buf = Buffer.alloc(len);
    await fh.read(buf, 0, len, off);
    const lastNl = buf.lastIndexOf(0x0a);
    if (lastNl === -1) return; // linha ainda incompleta
    for (const line of buf.subarray(0, lastNl).toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      try { handler(JSON.parse(line)); } catch { /* linha que não é JSON: ignora */ }
    }
    offsets[file] = off + lastNl + 1;
    saveOffsets();
  } finally {
    await fh.close();
  }
}

// ---------- Cowrie (SSH/Telnet) ----------
const sessoesTelnet = new Map(); // session -> true se telnet (só session.connect traz o protocolo)
function fromCowrie(ev) {
  if (!net.isIP(ev.src_ip || '')) return;
  if (ev.eventid === 'cowrie.session.connect') {
    sessoesTelnet.set(ev.session, ev.protocol === 'telnet' || Number(ev.dst_port) === 2223);
    if (sessoesTelnet.size > 5000) sessoesTelnet.delete(sessoesTelnet.keys().next().value);
  }
  const telnet = sessoesTelnet.get(ev.session) === true;
  const base = {
    fonte: 'cowrie', ocorridoEm: toIso(ev.timestamp), ipOrigem: ev.src_ip,
    servico: telnet ? 'telnet' : 'ssh', portaDestino: telnet ? 23 : 22, protocolo: 'tcp', alvo: CFG.sensor,
  };
  switch (ev.eventid) {
    case 'cowrie.session.connect':
      enqueue({ ...base, acao: 'conexao' }); break;
    case 'cowrie.login.failed':
      enqueue({ ...base, acao: 'login_falha', usuarioTentado: clip(ev.username, 128), senhaTentada: clip(ev.password, 128) }); break;
    case 'cowrie.login.success':
      enqueue({ ...base, acao: 'login_ok', usuarioTentado: clip(ev.username, 128), senhaTentada: clip(ev.password, 128) }); break;
    case 'cowrie.command.input':
      enqueue({ ...base, acao: 'comando', detalhes: { comando: clip(ev.input, 500) } }); break;
    default: break;
  }
}

// ---------- OpenCanary (RDP/FTP/HTTP/MSSQL) ----------
const PORTA_SERVICO = { 21: 'ftp', 22: 'ssh', 23: 'telnet', 80: 'http', 443: 'https', 1433: 'mssql', 3306: 'mysql', 3389: 'rdp' };
function fromCanary(ev) {
  if (!net.isIP(ev.src_host || '')) return; // eventos internos do daemon não têm origem
  const porta = Number(ev.dst_port);
  const ld = ev.logdata ?? {};
  const usuario = ld.USERNAME ?? ld.username;
  const senha = ld.PASSWORD ?? ld.password;
  enqueue({
    fonte: 'opencanary', ocorridoEm: toIso(ev.utc_time ?? ev.local_time), ipOrigem: ev.src_host,
    portaDestino: intOrUndef(porta), protocolo: 'tcp', servico: PORTA_SERVICO[porta] ?? 'outro',
    acao: usuario ? 'login_falha' : 'conexao',
    usuarioTentado: clip(usuario, 128), senhaTentada: clip(senha, 128),
    alvo: CFG.sensor, detalhes: { logtype: ev.logtype },
  });
}

// ---------- FortiGate (syslog key=value) ----------
function parseKv(line) {
  const out = {};
  for (const m of line.matchAll(/(\w+)=("([^"]*)"|\S+)/g)) out[m[1]] = m[3] ?? m[2];
  return out;
}
function fortiTime(kv) {
  if (/^\d{19}$/.test(kv.eventtime || '')) return new Date(Number(BigInt(kv.eventtime) / 1_000_000n)).toISOString();
  return new Date().toISOString();
}
const PROTO = { 1: 'icmp', 6: 'tcp', 17: 'udp' };

function fromFortigate(line) {
  const kv = parseKv(line);
  if (!kv.type) return;
  const when = fortiTime(kv);
  const alvo = clip(kv.devname, 128);

  if (kv.type === 'traffic') {
    const ip = kv.srcip;
    if (!ip || !net.isIP(ip) || isPrivateIp(ip)) return;            // só origem pública
    if (!['deny', 'drop', 'dropped'].includes(kv.action)) return;    // só o que foi barrado
    enqueue({
      fonte: 'fortigate', ocorridoEm: when, ipOrigem: ip, portaDestino: intOrUndef(kv.dstport),
      protocolo: PROTO[kv.proto], servico: clip(kv.service, 32), acao: 'bloqueio', alvo,
      detalhes: { policyid: kv.policyid },
    });
  } else if (kv.type === 'utm' && kv.subtype === 'ips') {
    const ip = kv.srcip;
    if (!ip || !net.isIP(ip) || isPrivateIp(ip)) return;
    enqueue({
      fonte: 'fortigate', ocorridoEm: when, ipOrigem: ip, portaDestino: intOrUndef(kv.dstport),
      servico: clip(kv.service, 32), acao: 'outro', alvo,
      detalhes: { ips: clip(kv.attack, 200), severidade: kv.severity, acaoFw: kv.action },
    });
  } else if (kv.type === 'event' && /login/i.test(kv.logdesc || '') && /fail/i.test(kv.logdesc || '')) {
    const ip = kv.srcip || kv.remip;
    if (!ip || !net.isIP(ip)) return;
    enqueue({
      fonte: 'fortigate', ocorridoEm: when, ipOrigem: ip, servico: clip(kv.subtype, 32),
      acao: 'login_falha', usuarioTentado: clip(kv.user, 128), alvo, detalhes: { logdesc: clip(kv.logdesc, 100) },
    });
  }
}

// ---------- execução ----------
async function pollFiles() {
  try {
    await tail(CFG.cowrieLog, fromCowrie);
    await tail(CFG.canaryLog, fromCanary);
  } catch (e) {
    log('erro lendo logs:', e.message);
  }
}

if (CFG.syslogAllow.length > 0) {
  const sock = dgram.createSocket('udp4');
  sock.on('message', (msg, rinfo) => {
    if (!CFG.syslogAllow.includes(rinfo.address)) return; // só aceita do FortiGate
    for (const line of msg.toString('utf8').split('\n')) if (line.trim()) fromFortigate(line);
  });
  sock.on('error', (e) => log('erro no listener syslog:', e.message));
  sock.bind(5514, () => log(`syslog UDP 5514 (permitidos: ${CFG.syslogAllow.join(', ')})`));
} else {
  log('SYSLOG_ALLOW vazio: listener de syslog desligado');
}

setInterval(pollFiles, 2000);
setInterval(flush, CFG.flushMs);
pollFiles();
log(`shipper iniciado (sensor=${CFG.sensor}, destino=${new URL(CFG.url).host})`);

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => { await flush(); process.exit(0); });
}
