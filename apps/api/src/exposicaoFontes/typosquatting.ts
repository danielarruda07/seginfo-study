import { Resolver } from 'node:dns/promises';
import { diferencaDeConjunto, listaCurta, type FonteExposicao, type ItemFonte, type ResultadoFonte } from './tipos.js';

/**
 * Domínios parecidos (typosquatting, no estilo do dnstwist): gera variações do nome do domínio e
 * consulta no DNS público quais já existem. Um parecido registrado, ainda mais com MX, é um
 * candidato a phishing contra você ou contra quem confia no seu nome. Só consulta DNS: nada toca o alvo.
 */

const MAX_CANDIDATOS = 300;
const CONCORRENCIA = 20;
const PRAZO_TOTAL_MS = 55_000;
const RESOLVEDORES = ['1.1.1.1', '8.8.8.8'];

export const TLDS = ['com', 'net', 'org', 'com.br', 'net.br', 'io', 'co', 'info', 'online', 'site', 'xyz', 'app'];
const PALAVRAS = ['login', 'secure', 'app', 'mail'];
const VOGAIS = 'aeiou';
const TECLADO = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
/** Homóglifos só em ASCII (o que cabe num rótulo DNS sem punycode). */
const HOMOGLIFOS: [string, string][] = [['m', 'rn'], ['rn', 'm'], ['l', '1'], ['1', 'l'], ['o', '0'], ['0', 'o'], ['i', 'l'], ['l', 'i'], ['i', '1'], ['w', 'vv'], ['vv', 'w'], ['d', 'cl'], ['cl', 'd'], ['g', 'q'], ['q', 'g'], ['e', '3'], ['a', '4'], ['s', '5']];

/** Separa "sub.exemplo.com.br" em rótulo registrável ("exemplo") e sufixo ("com.br"). Heurística sem lista pública. */
export function separarDominio(dominio: string): { rotulo: string; sufixo: string } {
  const partes = dominio.toLowerCase().split('.');
  const duplo = partes.length >= 3 && partes[partes.length - 2].length <= 3 && partes[partes.length - 1].length === 2;
  const nSufixo = duplo ? 2 : 1;
  return { rotulo: partes[partes.length - nSufixo - 1] ?? '', sufixo: partes.slice(-nSufixo).join('.') };
}

const vizinhas = (c: string): string[] => {
  for (let l = 0; l < TECLADO.length; l++) {
    const i = TECLADO[l].indexOf(c);
    if (i < 0) continue;
    const out = [TECLADO[l][i - 1], TECLADO[l][i + 1], TECLADO[l - 1]?.[i], TECLADO[l + 1]?.[i]];
    return out.filter((x): x is string => !!x);
  }
  return [];
};

const rotuloValido = (r: string) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(r) && !r.includes('--');

/** Variações do rótulo, por técnica, na ordem de prioridade (as mais prováveis primeiro). */
export function variacoesDoRotulo(r: string): Record<string, string[]> {
  const v: Record<string, Set<string>> = {
    homoglifo: new Set(), omissao: new Set(), hifen: new Set(), vogal: new Set(), transposicao: new Set(),
    repeticao: new Set(), palavra: new Set(), teclado: new Set(), insercao: new Set(),
  };
  for (const [de, para] of HOMOGLIFOS) {
    let i = r.indexOf(de);
    while (i >= 0) { v.homoglifo.add(r.slice(0, i) + para + r.slice(i + de.length)); i = r.indexOf(de, i + 1); }
  }
  for (let i = 0; i < r.length; i++) {
    const c = r[i];
    v.omissao.add(r.slice(0, i) + r.slice(i + 1));
    v.repeticao.add(r.slice(0, i) + c + r.slice(i));
    if (i > 0) v.hifen.add(`${r.slice(0, i)}-${r.slice(i)}`);
    if (i < r.length - 1) v.transposicao.add(r.slice(0, i) + r[i + 1] + c + r.slice(i + 2));
    if (VOGAIS.includes(c)) for (const o of VOGAIS) if (o !== c) v.vogal.add(r.slice(0, i) + o + r.slice(i + 1));
    for (const k of vizinhas(c)) {
      v.teclado.add(r.slice(0, i) + k + r.slice(i + 1));
      v.insercao.add(r.slice(0, i) + k + r.slice(i));
      v.insercao.add(r.slice(0, i + 1) + k + r.slice(i + 1));
    }
  }
  for (const p of PALAVRAS) { v.palavra.add(`${r}-${p}`); v.palavra.add(`${p}-${r}`); v.palavra.add(`${r}${p}`); }
  const out: Record<string, string[]> = {};
  for (const [k, s] of Object.entries(v)) out[k] = [...s].filter((x) => x !== r && rotuloValido(x));
  return out;
}

/** Candidatos completos (rótulo + sufixo), sem repetir, sem o original, limitados a `max`. */
export function gerarCandidatos(dominio: string, max = MAX_CANDIDATOS): string[] {
  const { rotulo, sufixo } = separarDominio(dominio);
  if (!rotulo) return [];
  const original = `${rotulo}.${sufixo}`;
  const vistos = new Set<string>([original, dominio.toLowerCase()]);
  const out: string[] = [];
  const por = (d: string) => { if (!vistos.has(d)) { vistos.add(d); out.push(d); } };
  for (const t of TLDS) por(`${rotulo}.${t}`);
  // intercala as técnicas para que o corte em `max` não deixe nenhuma de fora
  const listas = Object.values(variacoesDoRotulo(rotulo));
  for (let i = 0; out.length < max * 2 && listas.some((l) => i < l.length); i++) {
    for (const l of listas) if (i < l.length) por(`${l[i]}.${sufixo}`);
  }
  return out.slice(0, max);
}

export interface Parecido { dominio: string; ips: string[]; mx: boolean; seu: boolean }

async function verificar(res: Resolver, d: string, proprios: Set<string>): Promise<Parecido | null> {
  const [ns, a] = await Promise.all([res.resolveNs(d).catch(() => [] as string[]), res.resolve4(d).catch(() => [] as string[])]);
  if (!ns.length && !a.length) return null;
  const mx = (await res.resolveMx(d).catch(() => [])).some((m) => m.exchange && m.exchange !== '.');
  return { dominio: d, ips: a.slice(0, 4), mx, seu: a.some((ip) => proprios.has(ip)) };
}

export async function resolverCandidatos(candidatos: string[], proprios: string[], res: Resolver, prazoMs = PRAZO_TOTAL_MS): Promise<{ achados: Parecido[]; consultados: number }> {
  const fim = Date.now() + prazoMs;
  const meus = new Set(proprios);
  const achados: Parecido[] = [];
  let i = 0;
  let consultados = 0;
  const trabalhador = async () => {
    while (i < candidatos.length && Date.now() < fim) {
      const d = candidatos[i++];
      try { const p = await verificar(res, d, meus); if (p) achados.push(p); } catch { /* candidato sem resposta: ignora */ }
      consultados++;
    }
  };
  await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));
  return { achados: achados.sort((x, y) => Number(y.mx) - Number(x.mx) || x.dominio.localeCompare(y.dominio)), consultados };
}

export function resultadoParecidos(dominio: string, achados: Parecido[], consultados: number, total: number): ResultadoFonte {
  const terceiros = achados.filter((p) => !p.seu);
  const proprios = achados.filter((p) => p.seu);
  const item = (p: Parecido): ItemFonte => ({
    texto: p.dominio,
    tom: p.seu ? 'ok' : p.mx ? 'alta' : 'media',
    detalhe: [p.ips.length ? `A ${p.ips.join(', ')}` : 'sem A (só NS)', p.mx ? 'recebe e-mail (MX)' : '', p.seu ? 'aponta para um IP seu' : ''].filter(Boolean).join(' · '),
  });
  return {
    fonte: 'typosquatting',
    nome: 'Domínios parecidos',
    observacao: `Variações de ${dominio} (letra trocada, faltando, repetida, homóglifos, outros TLDs) que já existem no DNS público. ` +
      `${consultados} de ${total} variações consultadas. Registrado não quer dizer malicioso: confira quem é o dono antes de agir.`,
    destaques: [
      { rotulo: 'Parecidos registrados', valor: terceiros.length, tom: terceiros.some((p) => p.mx) ? 'alta' : terceiros.length ? 'media' : 'ok' },
      ...(terceiros.some((p) => p.mx) ? [{ rotulo: 'Com e-mail (MX)', valor: terceiros.filter((p) => p.mx).length, tom: 'alta' as const }] : []),
    ],
    secoes: [
      { titulo: 'Registrados por terceiros (ou de dono desconhecido)', itens: terceiros.map(item), vazio: 'Nenhuma variação registrada.' },
      ...(proprios.length ? [{ titulo: 'Provavelmente seus (apontam para os seus IPs)', itens: proprios.map(item) }] : []),
    ],
    conjuntos: {
      registrados: terceiros.map((p) => p.dominio),
      comMx: terceiros.filter((p) => p.mx).map((p) => p.dominio),
      // só compara varreduras que consultaram todas as variações: um corte por prazo não vira "registro novo"
      completa: consultados >= total ? ['sim'] : [],
    },
  };
}

export const fontes: FonteExposicao[] = [{
  id: 'typosquatting',
  nome: 'Domínios parecidos',
  aplicaA: ['dominio'],
  async coletar(ctx) {
    const candidatos = gerarCandidatos(ctx.alvo.valor);
    if (!candidatos.length) return null;
    const res = new Resolver({ timeout: 2_000, tries: 1 });
    res.setServers(RESOLVEDORES);
    const { achados, consultados } = await resolverCandidatos(candidatos, ctx.base.ips, res);
    return resultadoParecidos(ctx.alvo.valor, achados, consultados, candidatos.length);
  },
  comparar: (a, b) => (!a.conjuntos.completa?.length || !b.conjuntos.completa?.length) ? [] : [
    ...diferencaDeConjunto('typosquatting', a, b, 'registrados',
      { tipo: 'parecido-registrado', severidade: 'alta', texto: (x) => `Domínio parecido com o seu foi registrado: ${listaCurta(x)}.` }, null),
    ...diferencaDeConjunto('typosquatting', a, b, 'comMx',
      { tipo: 'parecido-com-mx', severidade: 'media', texto: (x) => `Domínio parecido passou a receber e-mail (MX): ${listaCurta(x)}.` }, null),
  ],
}];
