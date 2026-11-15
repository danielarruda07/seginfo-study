import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * OSINT passivo: o que a internet já sabe sobre um domínio ou IP, a partir de fontes públicas e
 * gratuitas, sem tocar no alvo. Nada aqui precisa de credencial.
 *
 * - crt.sh: logs públicos de Certificate Transparency (subdomínios vazados por certificados).
 * - Shodan InternetDB: portas, CPEs, tags e CVEs que o Shodan viu num IP (sem chave, sem varrer).
 * - DNS público (Cloudflare/Google): registros como o mundo vê, não como o DNS interno responde.
 *
 * Os hosts consultados são fixos; a entrada do modelo só vira caminho ou parâmetro já validado.
 */

const AGENTE_HTTP = 'seginfo-study-osint/1.0';
const RESOLVEDORES_PUBLICOS = ['1.1.1.1', '8.8.8.8'];

/** Normaliza e valida um nome de domínio público ("Exemplo.com." → "exemplo.com"). */
export function normalizarDominio(bruto: string): string | null {
  const d = bruto.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(d) ? d : null;
}

/** IPs que não fazem sentido consultar em fontes da internet (privados, loopback, link-local, CGNAT). */
export function ipNaoPublico(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    return x === '::' || x === '::1' || /^f[cd]/.test(x) || /^fe[89ab]/.test(x);
  }
  return true;
}

async function buscarJson(url: string, ms: number): Promise<{ status: number; dados: unknown }> {
  const r = await fetch(url, { headers: { 'User-Agent': AGENTE_HTTP, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  const texto = await r.text();
  let dados: unknown = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = null; }
  return { status: r.status, dados };
}

// ---------- crt.sh ----------

interface EntradaCrt { name_value?: string; common_name?: string; issuer_name?: string; not_before?: string; not_after?: string }

const emissor = (issuer = '') => /O=("?)([^,"]+)\1/.exec(issuer)?.[2]?.trim() ?? (issuer || 'desconhecido');

/** Resume a resposta do crt.sh: subdomínios com primeira/última emissão, emissores e certificados recentes. */
export function resumirCertificados(dominio: string, entradas: EntradaCrt[], limiteNomes = 200) {
  const nomes = new Map<string, { primeiro: string; ultimo: string; certificados: number; curinga: boolean }>();
  const emissores = new Map<string, number>();
  for (const e of entradas) {
    const data = (e.not_before ?? '').slice(0, 10);
    emissores.set(emissor(e.issuer_name), (emissores.get(emissor(e.issuer_name)) ?? 0) + 1);
    const vistos = new Set(`${e.name_value ?? ''}\n${e.common_name ?? ''}`.split(/\s+/).map((n) => n.trim().toLowerCase()).filter(Boolean));
    for (const bruto of vistos) {
      const curinga = bruto.startsWith('*.');
      const n = curinga ? bruto.slice(2) : bruto;
      if (n !== dominio && !n.endsWith(`.${dominio}`)) continue; // certificado com outros domínios (SAN)
      const atual = nomes.get(n);
      if (!atual) nomes.set(n, { primeiro: data, ultimo: data, certificados: 1, curinga });
      else {
        atual.certificados += 1;
        atual.curinga ||= curinga;
        if (data && (!atual.primeiro || data < atual.primeiro)) atual.primeiro = data;
        if (data > atual.ultimo) atual.ultimo = data;
      }
    }
  }
  const lista = [...nomes.entries()]
    .map(([nome, v]) => ({ nome, ...v }))
    .sort((a, b) => b.ultimo.localeCompare(a.ultimo) || a.nome.localeCompare(b.nome));
  const recentes = [...entradas]
    .sort((a, b) => (b.not_before ?? '').localeCompare(a.not_before ?? ''))
    .slice(0, 10)
    .map((e) => ({ emitidoEm: (e.not_before ?? '').slice(0, 10), validoAte: (e.not_after ?? '').slice(0, 10), nomes: (e.name_value ?? '').split(/\s+/).filter(Boolean).slice(0, 10), emissor: emissor(e.issuer_name) }));
  return {
    dominio,
    certificados: entradas.length,
    subdominios: lista.length,
    nomes: lista.slice(0, limiteNomes),
    nomesOmitidos: Math.max(0, lista.length - limiteNomes),
    emissores: [...emissores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, total]) => ({ nome, total })),
    recentes,
    observacao: 'Fonte: logs públicos de Certificate Transparency (crt.sh). Todo nome que já ganhou certificado público fica visível para qualquer pessoa, inclusive robôs que atacam nomes recém-publicados.',
  };
}

export async function osintCertificados(dominio: string, apenasValidos = false) {
  const url = `https://crt.sh/?q=${encodeURIComponent(`%.${dominio}`)}&output=json${apenasValidos ? '&exclude=expired' : ''}`;
  let resp: { status: number; dados: unknown };
  try {
    resp = await buscarJson(url, 45_000);
  } catch (e) {
    throw new Error(`crt.sh não respondeu (${(e as Error).name === 'TimeoutError' ? 'tempo esgotado' : (e as Error).message}). O serviço costuma ficar lento; tente de novo em alguns minutos.`);
  }
  if (resp.status !== 200) throw new Error(`crt.sh respondeu HTTP ${resp.status}. O serviço costuma ficar instável; tente de novo em alguns minutos.`);
  const entradas = Array.isArray(resp.dados) ? (resp.dados as EntradaCrt[]) : [];
  return resumirCertificados(dominio, entradas);
}

// ---------- Shodan InternetDB ----------

/** Descobre o IP público de saída do servidor (o IP de casa, quando o app roda no homelab). */
async function ipPublicoDoServidor(): Promise<string> {
  const { dados } = await buscarJson('https://api.ipify.org?format=json', 10_000);
  const ip = (dados as { ip?: unknown } | null)?.ip;
  if (typeof ip !== 'string' || !isIP(ip)) throw new Error('Não consegui descobrir o IP público do servidor.');
  return ip;
}

export function resumirInternetDb(ip: string, status: number, dados: unknown) {
  if (status === 404) {
    return { ip, encontrado: false, observacao: 'O Shodan não tem registro deste IP: nenhuma porta aberta foi vista nas varreduras recentes.' };
  }
  if (status !== 200 || !dados || typeof dados !== 'object') throw new Error(`Shodan InternetDB respondeu HTTP ${status}.`);
  const d = dados as { ports?: number[]; hostnames?: string[]; cpes?: string[]; tags?: string[]; vulns?: string[] };
  const vulns = d.vulns ?? [];
  return {
    ip,
    encontrado: true,
    portas: d.ports ?? [],
    hostnames: d.hostnames ?? [],
    softwares: d.cpes ?? [],
    tags: d.tags ?? [],
    vulnerabilidades: vulns.slice(0, 50),
    vulnerabilidadesOmitidas: Math.max(0, vulns.length - 50),
    observacao: 'Fonte: Shodan InternetDB (dados das varreduras do Shodan, atualizados por semana). Vulnerabilidades são inferidas pela versão do software, não confirmadas: trate como pista a verificar.',
  };
}

export async function osintExposicaoIp(alvo?: string) {
  let ips: string[];
  let origem: string;
  if (!alvo) {
    ips = [await ipPublicoDoServidor()];
    origem = 'IP público de saída do servidor (a sua conexão, se o app roda no homelab)';
  } else if (isIP(alvo)) {
    ips = [alvo];
    origem = 'IP informado';
  } else {
    const dominio = normalizarDominio(alvo);
    if (!dominio) throw new Error('Informe um IP público ou um domínio válido.');
    ips = (await resolverPublico().resolve4(dominio).catch(() => [] as string[])).slice(0, 5);
    if (ips.length === 0) throw new Error(`${dominio} não tem registro A no DNS público.`);
    origem = `registros A de ${dominio} no DNS público`;
  }
  const resultados = await Promise.all(ips.map(async (ip) => {
    if (ipNaoPublico(ip)) return { ip, encontrado: false, observacao: 'IP privado ou reservado: não aparece na internet.' };
    try {
      const { status, dados } = await buscarJson(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, 20_000);
      return resumirInternetDb(ip, status, dados);
    } catch (e) {
      return { ip, encontrado: false, erro: (e as Error).message };
    }
  }));
  return { origem, resultados };
}

// ---------- DNS público ----------

function resolverPublico(): Resolver {
  const r = new Resolver({ timeout: 5_000, tries: 2 });
  r.setServers(RESOLVEDORES_PUBLICOS);
  return r;
}

const ouVazio = async <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => [] as T[]);

/** Lê SPF e DMARC dos TXT e aponta o que falta ou está fraco. */
export function analisarEmail(txt: string[], dmarcTxt: string[], temMx: boolean) {
  const spf = txt.filter((t) => /^v=spf1\b/i.test(t));
  const dmarc = dmarcTxt.find((t) => /^v=DMARC1\b/i.test(t)) ?? null;
  const politica = dmarc ? (/\bp=(\w+)/i.exec(dmarc)?.[1]?.toLowerCase() ?? null) : null;
  const avisos: string[] = [];
  if (spf.length === 0) avisos.push(temMx ? 'Recebe e-mail (MX) mas não publica SPF: qualquer servidor pode enviar em nome do domínio.' : 'Sem SPF. Se o domínio não envia e-mail, publique "v=spf1 -all" para impedir falsificação.');
  if (spf.length > 1) avisos.push('Mais de um registro SPF: o SPF inteiro passa a falhar (permerror).');
  if (spf.some((s) => /\+all\b/i.test(s))) avisos.push('SPF com "+all": autoriza qualquer servidor do mundo.');
  if (!dmarc) avisos.push('Sem DMARC (_dmarc): provedores não sabem o que fazer com e-mail falsificado.');
  else if (politica === 'none') avisos.push('DMARC com p=none: só monitora, não bloqueia falsificação.');
  return { spf: spf[0] ?? null, dmarc, politicaDmarc: politica, avisos };
}

export async function osintDns(dominio: string) {
  const r = resolverPublico();
  const [a, aaaa, cname, mx, ns, txtBruto, caa, dmarcBruto] = await Promise.all([
    ouVazio(r.resolve4(dominio)),
    ouVazio(r.resolve6(dominio)),
    ouVazio(r.resolveCname(dominio)),
    ouVazio(r.resolveMx(dominio)),
    ouVazio(r.resolveNs(dominio)),
    ouVazio(r.resolveTxt(dominio)),
    ouVazio(r.resolveCaa(dominio)),
    ouVazio(r.resolveTxt(`_dmarc.${dominio}`)),
  ]);
  const txt = txtBruto.map((partes) => partes.join(''));
  const dmarcTxt = dmarcBruto.map((partes) => partes.join(''));
  // MX nulo (RFC 7505): "0 ." declara que o domínio não recebe e-mail.
  const mxReais = mx.filter((m) => m.exchange && m.exchange !== '.');
  const email = analisarEmail(txt, dmarcTxt, mxReais.length > 0);
  const avisos = [...email.avisos];
  if (caa.length === 0 && (a.length > 0 || aaaa.length > 0)) avisos.push('Sem CAA: qualquer autoridade certificadora pode emitir certificado para este domínio.');
  const ipsPrivados = [...a, ...aaaa].filter(ipNaoPublico);
  if (ipsPrivados.length) avisos.push(`O DNS público revela IP interno (${ipsPrivados.join(', ')}): mapa da rede para quem está de fora.`);
  if (txt.some((t) => /verification|verify|site-verification/i.test(t))) avisos.push('TXT de verificação revelam serviços em uso (Google, Microsoft, etc.): informação útil para phishing direcionado.');
  const nada = [a, aaaa, cname, mx, ns, txt].every((x) => x.length === 0);
  return {
    dominio,
    existe: !nada,
    a, aaaa, cname,
    mx: mx.length > 0 && mxReais.length === 0 ? ['MX nulo: o domínio declara que não recebe e-mail'] : mxReais.sort((x, y) => x.priority - y.priority).map((m) => `${m.priority} ${m.exchange}`),
    ns, txt,
    caa: caa.map((c) => Object.entries(c).filter(([k]) => k !== 'critical').map(([k, v]) => `${k} ${v}`).join(' ')),
    email: { spf: email.spf, dmarc: email.dmarc, politicaDmarc: email.politicaDmarc },
    avisos,
    observacao: `Consultado nos resolvedores públicos ${RESOLVEDORES_PUBLICOS.join(' e ')}: é o que qualquer pessoa na internet vê.`,
  };
}
