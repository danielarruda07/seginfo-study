/**
 * Extração de conteúdo de uma URL, server-side (resolve o CORS da Opção B).
 * Sem dependências: busca o HTML e reduz a título + descrição + texto limpo.
 *
 * Segurança (lição do próprio pentest do Daniel — F6 SSRF):
 * - só aceita http/https;
 * - bloqueia hosts privados/loopback/link-local/metadados de nuvem;
 * - limita tamanho e tempo da resposta.
 */

const PRIVATE_V4 = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
];

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '169.254.169.254') return true; // metadados de nuvem (AWS/GCP/Azure)
  if (PRIVATE_V4.some((re) => re.test(h))) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true; // IPv6 priv/loopback
  return false;
}

export interface ExtractResult {
  url: string;
  finalUrl: string;
  dominio: string;
  titulo: string;
  descricao: string;
  texto: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function pickMeta(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : '';
}

/** Reduz o HTML a texto legível: tira script/style/nav, mantém o corpo. */
function htmlToText(html: string): string {
  let h = html;
  h = h.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  h = h.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  h = h.replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  h = h.replace(/<header[\s\S]*?<\/header>/gi, ' ');
  h = h.replace(/<footer[\s\S]*?<\/footer>/gi, ' ');
  h = h.replace(/<!--[\s\S]*?-->/g, ' ');
  // quebras em blocos
  h = h.replace(/<\/(p|div|section|article|li|h[1-6]|br)>/gi, '\n');
  h = h.replace(/<[^>]+>/g, ' ');
  h = decodeEntities(h);
  h = h.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return h;
}

export async function extractUrl(rawUrl: string): Promise<ExtractResult> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('URL inválida.'), { statusCode: 400 });
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw Object.assign(new Error('Apenas http/https são permitidos.'), { statusCode: 400 });
  }
  if (isBlockedHost(u.hostname)) {
    throw Object.assign(new Error('Host bloqueado (privado/interno/metadados).'), { statusCode: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(u.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'SegInfoStudy/0.1 (+leitor de artigos pessoal)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  } catch (e) {
    throw Object.assign(new Error('Falha ao buscar a URL: ' + (e as Error).message), { statusCode: 502 });
  } finally {
    clearTimeout(timeout);
  }

  // revalida o host final após redirects (anti-SSRF via redirect)
  const finalUrl = new URL(res.url || u.toString());
  if (isBlockedHost(finalUrl.hostname)) {
    throw Object.assign(new Error('Redirecionou para host bloqueado.'), { statusCode: 403 });
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('xml')) {
    throw Object.assign(new Error(`Tipo de conteúdo não suportado: ${ct || 'desconhecido'}.`), { statusCode: 415 });
  }

  // limita a 2 MB
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 2 * 1024 * 1024) {
    throw Object.assign(new Error('Conteúdo muito grande (>2MB).'), { statusCode: 413 });
  }
  const html = new TextDecoder('utf-8').decode(buf);

  const titulo =
    pickMeta(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    pickMeta(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const descricao =
    pickMeta(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    pickMeta(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const texto = htmlToText(html).slice(0, 20_000); // o front resume isso

  return {
    url: rawUrl,
    finalUrl: finalUrl.toString(),
    dominio: finalUrl.hostname.replace(/^www\./, ''),
    titulo,
    descricao,
    texto,
  };
}
