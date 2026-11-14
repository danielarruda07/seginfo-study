import type { FerramentaCatalogo, Lab, RangeAlvo, RangeChecklistItem } from '@seginfo/shared';
import type { Tone } from '@/theme/status';

/**
 * Regras puras das telas de Prática (Labs, Range, Arsenal de Ferramentas), testadas em relacoes.test.ts.
 * Tudo aqui deriva de dados que o app já tem (catálogos em src/data e registros locais);
 * nada é inventado: as relações saem de ids em comum ou do nome da ferramenta citado no texto.
 */

// ---------- busca ----------

/** Minúsculas e sem acento, para busca tolerante ("varredura" acha "Varredura"). */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
}

/** Todos os termos da busca aparecem em algum dos campos. Busca vazia combina com tudo. */
export function combina(busca: string, ...campos: (string | undefined)[]): boolean {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return true;
  const alvo = normalizar(campos.filter(Boolean).join(' '));
  return termos.every((t) => alvo.includes(t));
}

// ---------- ferramenta citada em texto ----------

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Nomes pelos quais a ferramenta aparece em textos livres:
 * "Dirb / Dirsearch" → Dirb, Dirsearch · "Social-Engineer Toolkit (SET)" → …, SET ·
 * "Metasploit Framework" → Metasploit · "Volatility 3" → Volatility · "OWASP ZAP" → ZAP.
 */
export function apelidos(nome: string): string[] {
  const partes = nome.split('/').map((p) => p.trim()).filter(Boolean);
  const saida = new Set<string>();
  for (const parte of partes) {
    const sigla = parte.match(/\(([^)]+)\)/)?.[1]?.trim();
    const base = parte.replace(/\([^)]*\)/, '').trim();
    saida.add(base);
    if (sigla) saida.add(sigla);
    const curto = base.replace(/^OWASP\s+/i, '').replace(/\s+(Framework|Suite|Stack|\d+)$/i, '').trim();
    if (curto && curto !== base) saida.add(curto);
  }
  return [...saida].filter(Boolean);
}

function regexApelido(apelido: string): RegExp {
  // siglas curtas (SET, ZAP) só batem em maiúsculas, para não confundir com palavras comuns
  const flags = apelido.length < 4 ? 'u' : 'iu';
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapar(apelido)}(?![\\p{L}\\p{N}])`, flags);
}

/** A ferramenta é citada (por nome ou apelido, palavra inteira) em algum dos textos? */
export function citaFerramenta(f: Pick<FerramentaCatalogo, 'nome'>, textos: readonly string[]): boolean {
  const res = apelidos(f.nome).map(regexApelido);
  return textos.some((t) => res.some((re) => re.test(t)));
}

/** Ferramentas do catálogo citadas nos textos (ex.: passos de um lab, agentes de uma VM). */
export function ferramentasCitadas<F extends Pick<FerramentaCatalogo, 'nome'>>(textos: readonly string[], catalogo: readonly F[]): F[] {
  return catalogo.filter((f) => citaFerramenta(f, textos));
}

// ---------- relações ----------

const textosDoLab = (l: Lab) => [l.titulo, l.objetivo, l.resultadoEsperado, ...l.passos];

/** Ferramentas ligadas a um lab: mesmo tópico de estudo ou citadas nos passos. Sem repetição. */
export function ferramentasDoLab<F extends FerramentaCatalogo>(lab: Lab, catalogo: readonly F[]): F[] {
  return catalogo.filter((f) => (lab.topicoId && f.topicoId === lab.topicoId) || citaFerramenta(f, textosDoLab(lab)));
}

/** Labs em que a ferramenta entra: mesmo tópico de estudo ou citada no texto do lab. */
export function labsDaFerramenta(f: FerramentaCatalogo, labs: readonly Lab[]): Lab[] {
  return labs.filter((l) => (f.topicoId && l.topicoId === f.topicoId) || citaFerramenta(f, textosDoLab(l)));
}

/** Alvos do Range onde a ferramenta já está prevista (lista "ferramentas/agentes" do alvo). */
export function alvosComFerramenta(f: FerramentaCatalogo, alvos: readonly RangeAlvo[]): RangeAlvo[] {
  return alvos.filter((a) => citaFerramenta(f, a.ferramentas));
}

/** Alvos do Range ligados ao lab (campo labId do alvo). */
export function alvosDoLab(labId: string, alvos: readonly RangeAlvo[]): RangeAlvo[] {
  return alvos.filter((a) => a.labId === labId);
}

/** Exercícios Red × Blue que usaram o alvo do Range. */
export function exerciciosDoAlvo<E extends { rangeTargetIds: string[] }>(alvoId: string, exercicios: readonly E[]): E[] {
  return exercicios.filter((e) => e.rangeTargetIds.includes(alvoId));
}

// ---------- resumos e tons ----------

interface ExercicioResumo { status: string; detection: string; retestResult: string }

/** Números do registro Red × Blue (planejados não contam como execução). */
export function resumoRedBlue(exercicios: readonly ExercicioResumo[]) {
  const executados = exercicios.filter((e) => e.status !== 'planejado');
  return {
    total: exercicios.length,
    executados: executados.length,
    detectados: executados.filter((e) => e.detection === 'detectado').length,
    lacunas: executados.filter((e) => e.detection === 'parcial' || e.detection === 'nao_detectado').length,
    retestes: executados.filter((e) => e.retestResult === 'aprovado').length,
  };
}

/** Lab com lacuna de detecção ainda sem reteste aprovado pede ação. */
export function labPedeAcao(exercicios: readonly ExercicioResumo[]): boolean {
  return exercicios.some((e) => e.status !== 'planejado' && (e.detection === 'parcial' || e.detection === 'nao_detectado') && e.retestResult !== 'aprovado');
}

export const NIVEL_LABEL: Record<Lab['nivel'], string> = { basico: 'Básico', intermediario: 'Intermediário', avancado: 'Avançado' };

export const CRITICIDADE_META: Record<RangeChecklistItem['criticidade'], { label: string; tone?: Tone }> = {
  alta: { label: 'Criticidade alta', tone: 'serious' },
  media: { label: 'Criticidade média', tone: 'warning' },
  baixa: { label: 'Criticidade baixa' },
};

/** Etapa pendente de criticidade alta pede atenção; concluída fica neutra. */
export function toneEtapa(criticidade: RangeChecklistItem['criticidade'], concluida: boolean): Tone | undefined {
  if (concluida) return undefined;
  return criticidade === 'alta' ? 'warning' : undefined;
}

/** Percentual inteiro; 0 quando não há itens. */
export function pct(feitos: number, total: number): number {
  return total ? Math.round((feitos / total) * 100) : 0;
}

/** Barra de progresso: verde só quando completa; em andamento fica na cor padrão (cor só onde há ação). */
export function barraTone(p: number): 'ok' | undefined {
  return p >= 100 ? 'ok' : undefined;
}

/** Data ISO (aaaa-mm-dd) em pt-BR. */
export function dataBR(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-BR');
}
