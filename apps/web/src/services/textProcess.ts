/**
 * Processamento local de texto (sem IA, sem backend):
 * - resumo extrativo (frases mais relevantes por frequência de termos)
 * - extração de palavras-chave
 * - categorização automática por assunto de segurança
 *
 * É a base da Opção A. Quando o apps/api entrar, um resumo por IA pode substituir
 * `resumoExtrativo` sem mudar o resto do módulo.
 */

// Stopwords PT + EN (as mais comuns) para não poluir keywords/ranking.
const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas',
  'que', 'com', 'por', 'para', 'se', 'ao', 'aos', 'os', 'as', 'é', 'ser', 'como', 'mais', 'mas', 'ou', 'sua',
  'seu', 'suas', 'seus', 'isso', 'esse', 'essa', 'este', 'esta', 'foi', 'são', 'tem', 'ter', 'já', 'não', 'sim',
  'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is', 'are', 'was', 'be', 'by', 'with', 'as', 'at', 'an',
  'it', 'this', 'that', 'from', 'your', 'you', 'can', 'will', 'has', 'have', 'they', 'their', 'a', 'we', 'our',
]);

/** Regras de categorização por assunto. A primeira categoria com match vence (ordem importa). */
const CATEGORIAS: { id: string; label: string; termos: string[] }[] = [
  { id: 'siem', label: 'SIEM & SOC', termos: ['siem', 'soc', 'wazuh', 'splunk', 'sentinel', 'qradar', 'elastic', 'correlation', 'correlação', 'log'] },
  { id: 'red', label: 'Red Team / Pentest', termos: ['pentest', 'exploit', 'metasploit', 'nmap', 'red team', 'payload', 'privilege escalation', 'reverse shell', 'kali', 'gobuster', 'nuclei'] },
  { id: 'web', label: 'Segurança Web / AppSec', termos: ['owasp', 'xss', 'sqli', 'sql injection', 'burp', 'csrf', 'ssrf', 'web security', 'appsec', 'juice shop', 'portswigger'] },
  { id: 'osint', label: 'OSINT', termos: ['osint', 'shodan', 'maltego', 'theharvester', 'censys', 'recon', 'reconnaissance', 'footprint', 'spiderfoot'] },
  { id: 'vuln', label: 'Vulnerabilidades', termos: ['cve', 'cvss', 'nvd', 'kev', 'epss', 'vulnerability', 'vulnerabilidade', 'nessus', 'exploit-db', 'patch'] },
  { id: 'iam', label: 'IAM & AD', termos: ['active directory', 'kerberos', 'ldap', 'bloodhound', 'mfa', 'pam', 'zero trust', 'radius', 'ntlm', 'kerberoast'] },
  { id: 'firewall', label: 'Firewall & Rede', termos: ['firewall', 'fortigate', 'palo alto', 'vpn', 'ids', 'ips', 'ngfw', 'vlan', 'sonicwall', 'checkpoint'] },
  { id: 'cloud', label: 'Cloud Security', termos: ['aws', 'azure', 'gcp', 'cloud security', 's3', 'iam role', 'kubernetes', 'container', 'cspm'] },
  { id: 'blue', label: 'Blue Team / Defesa', termos: ['blue team', 'edr', 'hardening', 'cis benchmark', 'threat hunting', 'detection', 'defender', 'crowdstrike', 'mitre', 'att&ck'] },
  { id: 'grc', label: 'GRC & Compliance', termos: ['iso 27001', 'nist', 'lgpd', 'gdpr', 'compliance', 'governance', 'risk', 'policy', 'auditoria', 'framework'] },
];

export interface ProcessResult {
  resumo: string;
  palavrasChave: string[];
  categoria: string;
  categoriaLabel: string;
  tagsSugeridas: string[];
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);
}

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9áàâãéêíóôõúç\s-]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

/** Frequência de termos (bag of words), base do ranking de frases e keywords. */
function termFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return freq;
}

/** Resumo extrativo: ranqueia frases pela soma das frequências dos termos. */
export function resumoExtrativo(text: string, maxFrases = 3): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '';
  if (sentences.length <= maxFrases) return sentences.join(' ');

  const freq = termFrequency(tokenize(text));
  const scored = sentences.map((s, i) => {
    const tokens = tokenize(s);
    const score = tokens.reduce((acc, t) => acc + (freq.get(t) ?? 0), 0) / Math.max(1, tokens.length);
    return { s, i, score };
  });

  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, maxFrases);
  // mantém a ordem original de leitura
  return top.sort((a, b) => a.i - b.i).map((x) => x.s).join(' ');
}

/** Top N palavras-chave por frequência. */
export function extrairKeywords(text: string, n = 8): string[] {
  const freq = termFrequency(tokenize(text));
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

/** Categoriza por assunto: conta termos de cada categoria no texto normalizado. */
export function categorizar(text: string): { id: string; label: string } {
  const norm = normalize(text);
  let best = { id: 'geral', label: 'Geral', hits: 0 };
  for (const cat of CATEGORIAS) {
    let hits = 0;
    for (const termo of cat.termos) {
      const t = normalize(termo);
      // conta ocorrências do termo
      let idx = norm.indexOf(t);
      while (idx !== -1) { hits++; idx = norm.indexOf(t, idx + t.length); }
    }
    if (hits > best.hits) best = { id: cat.id, label: cat.label, hits };
  }
  return { id: best.id, label: best.label };
}

/** Pipeline completo: resumo + keywords + categoria + tags sugeridas. */
export function processar(text: string): ProcessResult {
  const resumo = resumoExtrativo(text);
  const palavrasChave = extrairKeywords(text);
  const cat = categorizar(text);
  // tags sugeridas: termos de categoria que aparecem no texto + top keywords curtas
  const norm = normalize(text);
  const catDef = CATEGORIAS.find((c) => c.id === cat.id);
  const tagsCat = (catDef?.termos ?? []).filter((t) => norm.includes(normalize(t))).slice(0, 4);
  const tagsSugeridas = Array.from(new Set([...tagsCat, ...palavrasChave.slice(0, 3)]));
  return { resumo, palavrasChave, categoria: cat.id, categoriaLabel: cat.label, tagsSugeridas };
}

export const CATEGORIA_LABELS: Record<string, string> = {
  geral: 'Geral',
  ...Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.label])),
};

/** Tenta extrair um título e domínio a partir da URL (sem buscar a página). */
export function metadadosDaUrl(url: string): { dominio: string; tituloProvavel: string } {
  try {
    const u = new URL(url);
    const dominio = u.hostname.replace(/^www\./, '');
    // último segmento do path vira um título provável legível
    const seg = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const tituloProvavel = decodeURIComponent(seg)
      .replace(/\.[a-z]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
    return { dominio, tituloProvavel: tituloProvavel || dominio };
  } catch {
    return { dominio: '', tituloProvavel: '' };
  }
}
