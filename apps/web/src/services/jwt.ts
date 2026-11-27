/**
 * Analisador de JWT OFFLINE — estrutural, sem rede e sem o segredo.
 *
 * Decodifica header e payload (base64url, SEM verificar a assinatura — não temos a chave)
 * e aponta fragilidades comuns. Não confirma que o token é aceito por um servidor; isso é
 * análise de higiene do próprio token que o operador colar.
 */

export type SevJwt = 'alta' | 'media' | 'baixa' | 'info';

export interface AchadoJwt {
  severidade: SevJwt;
  titulo: string;
  detalhe: string;
}

export interface AnaliseJwt {
  valido: boolean;
  erro?: string;
  header?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  achados: AchadoJwt[];
}

/** Decodifica um segmento base64url em texto UTF-8. */
function b64urlParaTexto(seg: string): string {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((seg.length + 3) % 4);
  const bin = atob(b64);
  // reconstrói UTF-8 a partir dos bytes
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

const CLAIMS_SENSIVEIS = /(pass(?:word|wd)?|senha|secret|ssn|cpf|credit|card|cvv|private)/i;

/** Analisa a higiene estrutural de um JWT. Pura (recebe o "agora" em segundos). */
export function analisarTokenJwt(token: string, agoraSeg = Math.floor(Date.now() / 1000)): AnaliseJwt {
  const t = token.trim().replace(/^Bearer\s+/i, '');
  const partes = t.split('.');
  if (partes.length !== 3) return { valido: false, erro: 'Não parece um JWT (esperado 3 partes separadas por ponto).', achados: [] };

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64urlParaTexto(partes[0]));
    payload = JSON.parse(b64urlParaTexto(partes[1]));
  } catch {
    return { valido: false, erro: 'Falha ao decodificar header/payload (base64url ou JSON inválido).', achados: [] };
  }

  const achados: AchadoJwt[] = [];
  const alg = String((header.alg ?? '') as string);

  if (/^none$/i.test(alg)) achados.push({ severidade: 'alta', titulo: 'Algoritmo "none"', detalhe: 'O token declara alg=none (sem assinatura). Se o servidor aceitar, qualquer um forja um token.' });
  else if (/^HS/i.test(alg)) achados.push({ severidade: 'media', titulo: `Algoritmo simétrico (${alg})`, detalhe: 'HS* usa um segredo compartilhado. Se o segredo for fraco, o token pode ser forjado (teste o segredo com wordlist, offline). Prefira RS/ES com chave assimétrica.' });
  else if (!alg) achados.push({ severidade: 'media', titulo: 'Sem algoritmo no header', detalhe: 'Header sem "alg"; comportamento depende da lib e pode abrir bypass.' });

  const exp = typeof payload.exp === 'number' ? payload.exp : undefined;
  const iat = typeof payload.iat === 'number' ? payload.iat : undefined;
  if (exp === undefined) achados.push({ severidade: 'media', titulo: 'Sem expiração (exp)', detalhe: 'Token sem claim exp não expira; se vazar, vale para sempre.' });
  else if (exp < agoraSeg) achados.push({ severidade: 'info', titulo: 'Token expirado', detalhe: `exp já passou (${new Date(exp * 1000).toISOString()}).` });
  if (exp !== undefined && iat !== undefined && exp - iat > 7 * 86400) achados.push({ severidade: 'baixa', titulo: 'Validade muito longa', detalhe: `O token vale ~${Math.round((exp - iat) / 86400)} dias. Janela longa aumenta o risco se vazar.` });

  for (const k of Object.keys(payload)) {
    if (CLAIMS_SENSIVEIS.test(k)) achados.push({ severidade: 'media', titulo: `Claim sensível no payload: "${k}"`, detalhe: 'O payload do JWT é apenas codificado (não cifrado) — qualquer um lê. Não coloque dado sensível nele.' });
  }

  const kid = header.kid;
  if (typeof kid === 'string' && /[./\\'"]|\.\.|select |union /i.test(kid)) achados.push({ severidade: 'baixa', titulo: 'kid com caracteres suspeitos', detalhe: 'O "kid" tem caracteres que lembram path/SQL — verifique se o servidor o usa para buscar a chave de forma segura (risco de injeção).' });

  if (achados.length === 0) achados.push({ severidade: 'info', titulo: 'Sem fragilidade estrutural óbvia', detalhe: 'A assinatura NÃO foi verificada (precisa da chave). Confirme a validação no servidor.' });

  return { valido: true, header, payload, achados };
}

/** Relatório exportável (HTML/PDF) da análise de um JWT. O token em si NÃO entra no relatório. */
export function relatorioDoJwt(a: AnaliseJwt): import('./exportarRelatorio').RelatorioExport {
  const sev = (s: SevJwt) => s;
  const conta = { alta: 0, media: 0, baixa: 0, info: 0 } as Record<SevJwt, number>;
  for (const x of a.achados) conta[x.severidade]++;
  return {
    titulo: 'Análise de JWT (offline)',
    subtitulo: 'Higiene estrutural do token — assinatura não verificada',
    confidencial: true,
    meta: [['Data', new Date().toLocaleString('pt-BR')], ['Algoritmo', String(a.header?.alg ?? '—')], ['Método', 'Decodificação local, sem rede e sem a chave']],
    resumo: conta,
    secoes: [
      { titulo: 'Achados', itens: a.achados.map((x) => ({ severidade: sev(x.severidade), titulo: x.titulo, detalhe: x.detalhe })) },
      { titulo: 'Header', codigo: JSON.stringify(a.header ?? {}, null, 2) },
      { titulo: 'Claims do payload (nomes)', texto: [Object.keys(a.payload ?? {}).join(', ') || '—'] },
    ],
  };
}
