import tls from 'node:tls';
import { buscar, diferencaDeConjunto, listaCurta, type FonteExposicao, type ItemFonte, type Mudanca, type ResultadoFonte } from './tipos.js';

/**
 * Saúde do site do próprio domínio: certificado TLS (validade e emissor), cabeçalhos de segurança da
 * página inicial e a nota do Mozilla Observatory. Só toca o domínio do usuário (uma conexão TLS e
 * um GET); o Observatory é opcional e pode falhar sem derrubar o resto.
 */

const DIA_MS = 86_400_000;

// ---------- TLS ----------

export interface InfoTls {
  emissor: string;
  assunto: string;
  validoAte: string | null;
  diasRestantes: number | null;
  protocolo: string | null;
  autorizado: boolean;
  erroCadeia: string | null;
  nomesAlternativos: string[];
}

const campoCert = (x: unknown) => {
  if (!x || typeof x !== 'object') return '';
  const o = x as Record<string, unknown>;
  return String(o.O ?? o.CN ?? '');
};

export function resumirTls(cert: Partial<tls.PeerCertificate> | null, extra: { protocolo: string | null; autorizado: boolean; erro: string | null }, agora = Date.now()): InfoTls {
  const validoAte = cert?.valid_to ? new Date(cert.valid_to) : null;
  const ok = validoAte && !Number.isNaN(validoAte.getTime());
  return {
    emissor: campoCert(cert?.issuer) || 'desconhecido',
    assunto: String((cert?.subject as Record<string, unknown> | undefined)?.CN ?? ''),
    validoAte: ok ? validoAte!.toISOString().slice(0, 10) : null,
    diasRestantes: ok ? Math.floor((validoAte!.getTime() - agora) / DIA_MS) : null,
    protocolo: extra.protocolo,
    autorizado: extra.autorizado,
    erroCadeia: extra.erro,
    nomesAlternativos: String(cert?.subjectaltname ?? '').split(',').map((s) => s.trim().replace(/^DNS:/, '')).filter(Boolean).slice(0, 20),
  };
}

export function faixaValidade(dias: number | null): 'vencido' | 'ate14' | 'ate30' | 'ok' | null {
  if (dias === null) return null;
  if (dias < 0) return 'vencido';
  if (dias <= 14) return 'ate14';
  if (dias <= 30) return 'ate30';
  return 'ok';
}

export function resultadoTls(dominio: string, t: InfoTls): ResultadoFonte {
  const faixa = faixaValidade(t.diasRestantes);
  const tom = faixa === 'vencido' || faixa === 'ate14' || !t.autorizado ? 'alta' : faixa === 'ate30' ? 'media' : 'ok';
  const alertas: string[] = [];
  if (faixa && faixa !== 'ok') alertas.push(faixa);
  if (!t.autorizado) alertas.push('cadeia-invalida');
  return {
    fonte: 'tls',
    nome: 'Certificado TLS',
    observacao: `Conexão TLS direta a ${dominio}:443. Com Cloudflare na frente, este é o certificado da borda da Cloudflare.`,
    destaques: [{ rotulo: 'TLS', valor: t.diasRestantes === null ? '?' : t.diasRestantes < 0 ? 'vencido' : `${t.diasRestantes} dias`, tom }],
    secoes: [{
      titulo: 'Certificado',
      itens: [
        { texto: `Emissor: ${t.emissor}` },
        { texto: `Válido até: ${t.validoAte ?? '?'}`, tom, detalhe: t.diasRestantes === null ? undefined : `${t.diasRestantes} dias restantes` },
        { texto: `Cadeia: ${t.autorizado ? 'confiável' : 'NÃO confiável'}`, tom: t.autorizado ? 'ok' : 'alta', detalhe: t.erroCadeia ?? undefined },
        { texto: `Protocolo: ${t.protocolo ?? '?'}`, tom: t.protocolo && /TLSv1(\.[01])?$/.test(t.protocolo) ? 'media' : 'ok' },
        ...(t.nomesAlternativos.length ? [{ texto: `Nomes no certificado: ${listaCurta(t.nomesAlternativos, 8)}` }] : []),
      ],
    }],
    conjuntos: { emissor: [t.emissor], alertas },
  };
}

function lerTls(dominio: string, ms = 10_000): Promise<InfoTls> {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ host: dominio, port: 443, servername: dominio, rejectUnauthorized: false, timeout: ms }, () => {
      const info = resumirTls(s.getPeerCertificate(), { protocolo: s.getProtocol(), autorizado: s.authorized, erro: s.authorizationError ? String(s.authorizationError) : null });
      s.end();
      resolve(info);
    });
    s.on('timeout', () => { s.destroy(); reject(new Error(`${dominio}:443 não respondeu em ${ms / 1000} s.`)); });
    s.on('error', (e) => reject(new Error(`TLS em ${dominio}:443: ${e.message}`)));
  });
}

export function compararTls(a: ResultadoFonte, b: ResultadoFonte): Mudanca[] {
  const rotulo: Record<string, string> = { vencido: 'venceu', ate14: 'vence em até 14 dias', ate30: 'vence em até 30 dias', 'cadeia-invalida': 'cadeia não é confiável' };
  const out: Mudanca[] = [];
  const antes = new Set(a.conjuntos.alertas ?? []);
  for (const x of b.conjuntos.alertas ?? []) {
    if (antes.has(x)) continue;
    out.push({ tipo: 'tls-alerta', severidade: x === 'ate30' ? 'media' : 'alta', texto: `Certificado TLS: ${rotulo[x] ?? x}.`, fonte: 'tls' });
  }
  out.push(...diferencaDeConjunto('tls', a, b, 'emissor',
    { tipo: 'tls-emissor', severidade: 'media', texto: (x) => `Emissor do certificado mudou para ${x.join(', ')}.` }, null));
  return out;
}

// ---------- cabeçalhos de segurança ----------

export const CABECALHOS = [
  { id: 'hsts', nome: 'Strict-Transport-Security', dica: 'força HTTPS no navegador' },
  { id: 'csp', nome: 'Content-Security-Policy', dica: 'limita de onde vêm scripts e conteúdos' },
  { id: 'xfo', nome: 'X-Frame-Options', dica: 'impede a página dentro de iframe (clickjacking); frame-ancestors na CSP também serve' },
  { id: 'xcto', nome: 'X-Content-Type-Options', dica: 'nosniff evita interpretar arquivo com o tipo errado' },
  { id: 'referrer', nome: 'Referrer-Policy', dica: 'controla o que vaza no Referer' },
  { id: 'permissions', nome: 'Permissions-Policy', dica: 'desliga câmera, microfone etc. que a página não usa' },
] as const;

export function avaliarCabecalhos(h: Record<string, string | undefined>) {
  const get = (n: string) => h[n.toLowerCase()];
  const csp = get('Content-Security-Policy') ?? '';
  return CABECALHOS.map((c) => {
    let valor = get(c.nome);
    if (c.id === 'xfo' && !valor && /frame-ancestors/i.test(csp)) valor = 'via CSP frame-ancestors';
    if (c.id === 'xcto' && valor && !/nosniff/i.test(valor)) valor = undefined;
    return { ...c, presente: !!valor, valor: valor ?? null };
  });
}

export function resultadoCabecalhos(dominio: string, status: number, urlFinal: string, h: Record<string, string | undefined>): ResultadoFonte {
  const av = avaliarCabecalhos(h);
  const faltam = av.filter((c) => !c.presente);
  const itens: ItemFonte[] = av.map((c) => ({
    texto: c.nome,
    tom: c.presente ? 'ok' : c.id === 'hsts' || c.id === 'csp' ? 'media' : 'info',
    detalhe: c.presente ? String(c.valor).slice(0, 120) : `falta: ${c.dica}`,
  }));
  return {
    fonte: 'cabecalhos',
    nome: 'Cabeçalhos de segurança',
    observacao: `GET em https://${dominio}/ (resposta ${status}${urlFinal !== `https://${dominio}/` ? `, depois de redirecionar para ${urlFinal}` : ''}). `
      + 'Com Cloudflare Access na frente, a resposta pode ser o login (302/403): os cabeçalhos ainda contam, porque é o que a internet recebe.',
    destaques: [{ rotulo: 'Cabeçalhos', valor: `${av.length - faltam.length}/${av.length}`, tom: faltam.some((c) => c.id === 'hsts' || c.id === 'csp') ? 'media' : faltam.length ? 'info' : 'ok' }],
    secoes: [{ titulo: 'Cabeçalhos', itens }],
    conjuntos: { faltando: faltam.map((c) => c.nome).sort() },
  };
}

async function lerCabecalhos(dominio: string) {
  let url = `https://${dominio}/`;
  for (let i = 0; i <= 3; i++) {
    const r = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'seginfo-study-osint/1.0' }, signal: AbortSignal.timeout(15_000) });
    const destino = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && destino && i < 3) {
      const prox = new URL(destino, url);
      if (prox.protocol !== 'https:') return { status: r.status, url, headers: Object.fromEntries(r.headers) };
      url = prox.toString();
      continue;
    }
    return { status: r.status, url, headers: Object.fromEntries(r.headers) as Record<string, string> };
  }
  throw new Error('redirecionamentos demais');
}

// ---------- Mozilla Observatory ----------

export const ORDEM_NOTAS = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];

export function resultadoObservatory(dominio: string, json: unknown): ResultadoFonte {
  const d = (json ?? {}) as Record<string, unknown>;
  if (d.error || !d.grade) {
    return {
      fonte: 'observatory', nome: 'Mozilla Observatory',
      observacao: `O Observatory não deu nota${d.error ? ` (${String(d.error)})` : ''}.`,
      destaques: [], secoes: [], conjuntos: {},
    };
  }
  const nota = String(d.grade);
  const pos = ORDEM_NOTAS.indexOf(nota);
  return {
    fonte: 'observatory',
    nome: 'Mozilla Observatory',
    observacao: 'Nota da Mozilla para as boas práticas de segurança HTTP da página inicial.',
    destaques: [{ rotulo: 'Observatory', valor: nota, tom: pos >= 0 && pos <= 2 ? 'ok' : pos >= 0 && pos <= 8 ? 'media' : 'alta' }],
    secoes: [{
      titulo: 'Resultado',
      itens: [
        { texto: `Nota ${nota} · ${String(d.score ?? '?')} pontos`, link: `https://developer.mozilla.org/en-US/observatory/analyze?host=${encodeURIComponent(dominio)}` },
        { texto: `Testes: ${String(d.tests_passed ?? '?')} aprovados, ${String(d.tests_failed ?? '?')} reprovados`, tom: Number(d.tests_failed ?? 0) > 0 ? 'media' : 'ok' },
      ],
    }],
    conjuntos: { nota: [nota] },
  };
}

export function compararObservatory(a: ResultadoFonte, b: ResultadoFonte): Mudanca[] {
  const x = a.conjuntos.nota?.[0];
  const y = b.conjuntos.nota?.[0];
  if (!x || !y || x === y) return [];
  const pior = ORDEM_NOTAS.indexOf(y) > ORDEM_NOTAS.indexOf(x);
  return [{ tipo: pior ? 'observatory-piorou' : 'observatory-melhorou', severidade: pior ? 'media' : 'info', texto: `Nota do Mozilla Observatory foi de ${x} para ${y}.`, fonte: 'observatory' }];
}

export const fontes: FonteExposicao[] = [
  {
    id: 'tls',
    nome: 'Certificado TLS',
    aplicaA: ['dominio'],
    coletar: async (ctx) => resultadoTls(ctx.alvo.valor, await lerTls(ctx.alvo.valor)),
    comparar: compararTls,
  },
  {
    id: 'cabecalhos',
    nome: 'Cabeçalhos de segurança',
    aplicaA: ['dominio'],
    async coletar(ctx) {
      const r = await lerCabecalhos(ctx.alvo.valor);
      return resultadoCabecalhos(ctx.alvo.valor, r.status, r.url, r.headers);
    },
    comparar: (a, b) => diferencaDeConjunto('cabecalhos', a, b, 'faltando',
      { tipo: 'cabecalho-removido', severidade: 'media', texto: (x) => `Cabeçalho de segurança deixou de ser enviado: ${listaCurta(x)}.` },
      { tipo: 'cabecalho-adicionado', severidade: 'info', texto: (x) => `Cabeçalho de segurança passou a ser enviado: ${listaCurta(x)}.` }),
  },
  {
    id: 'observatory',
    nome: 'Mozilla Observatory',
    aplicaA: ['dominio'],
    async coletar(ctx) {
      try {
        const r = await buscar(`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(ctx.alvo.valor)}`, { method: 'POST', ms: 45_000 });
        return resultadoObservatory(ctx.alvo.valor, r.status === 200 ? r.json : { error: `HTTP ${r.status}` });
      } catch (e) {
        return resultadoObservatory(ctx.alvo.valor, { error: (e as Error).message });
      }
    },
    comparar: compararObservatory,
  },
];
