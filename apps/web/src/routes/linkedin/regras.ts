import { isUrlLinkedin, normalizarUrlLinkedin, type CategoriaDiario, type EntradaDiario, type FormatoPost, type Metricas, type PostPublicado } from '@seginfo/shared';

/** Regras puras da tela LinkedIn (sem rede nem localStorage), testadas em regras.test.ts. */

export const METRICAS_CAMPOS = [
  ['impressoes', 'Impressões'], ['reacoes', 'Reações'], ['comentarios', 'Comentários'],
  ['compartilhamentos', 'Compartilhamentos'], ['salvamentos', 'Salvamentos'],
] as const;

/** Cor de identidade da categoria do diário, sempre por token (nunca hex). */
export const CATEGORIA_COR: Record<CategoriaDiario, string> = {
  funcionalidade: 'var(--tone-info)',
  seguranca: 'var(--tone-danger)',
  infra: 'var(--tone-muted)',
  decisao: 'var(--alvoar-navy)',
  aprendizado: 'var(--tone-ok)',
  plano: 'var(--tone-warning)',
};

/** Primeira linha não vazia do texto, cortada para caber num cartão. */
export function primeiraLinha(texto: string, max = 220): string {
  const linha = texto.split('\n').find((l) => l.trim())?.trim() ?? '';
  return linha.length > max ? `${linha.slice(0, max - 1)}…` : linha;
}

function taxa(m: Metricas): number | null {
  if (!m.impressoes) return null;
  const interacoes = (m.reacoes ?? 0) + (m.comentarios ?? 0) + (m.compartilhamentos ?? 0) + (m.salvamentos ?? 0);
  return Math.round((interacoes / m.impressoes) * 1000) / 10;
}

export interface ResumoPublicados {
  analisados: number;
  noCerebro: number;
  /** média das taxas de engajamento, com 1 casa, ou null sem impressões */
  taxaMedia: string | null;
  porPilar: [pilar: string, posts: number][];
  /** pilares sem post (só depois de 3 posts organizados, para não alarmar no começo) */
  esquecidos: string[];
  pendentes: PostPublicado[];
}

export function resumoPublicados(posts: PostPublicado[], pilares: string[]): ResumoPublicados {
  const analisados = posts.filter((p) => p.analise);
  const taxas = posts.map((p) => taxa(p.metricas)).filter((t): t is number => t !== null);
  const m = new Map<string, number>(pilares.map((p) => [p, 0]));
  for (const p of analisados) m.set(p.analise!.pilar, (m.get(p.analise!.pilar) ?? 0) + 1);
  const porPilar = [...m];
  return {
    analisados: analisados.length,
    noCerebro: posts.filter((p) => p.memoriaId).length,
    taxaMedia: taxas.length ? (taxas.reduce((a, b) => a + b, 0) / taxas.length).toFixed(1) : null,
    porPilar,
    esquecidos: analisados.length >= 3 ? porPilar.filter(([, n]) => n === 0).map(([p]) => p) : [],
    pendentes: posts.filter((p) => !p.analise),
  };
}

export interface FormularioPost {
  id?: string;
  url: string;
  publicadoEm: string;
  formato: FormatoPost;
  texto: string;
  metricas: Metricas;
}

/** Erro de validação do registro de post, ou null se está tudo certo. */
export function validarPost(form: FormularioPost, posts: PostPublicado[]): string | null {
  if (!isUrlLinkedin(form.url)) return 'Cole o link do post (começa com https://www.linkedin.com/...). Use "Copiar link da publicação" no menu do post.';
  if (form.texto.trim().length < 20) return 'Cole o texto do post: é dele que a IA tira a organização e o contexto.';
  const dup = posts.find((p) => p.id !== form.id && normalizarUrlLinkedin(p.url) === normalizarUrlLinkedin(form.url));
  return dup ? `Este post já está registrado (${dup.publicadoEm}).` : null;
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(ate.slice(0, 10)) - Date.parse(de.slice(0, 10))) / 86_400_000);
}

/** Dica sobre as métricas do post: sem números, ou números colhidos cedo demais. */
export function avisoMetricas(post: Pick<PostPublicado, 'publicadoEm' | 'metricas'>, hoje: string): string | null {
  const m = post.metricas;
  const vazio = METRICAS_CAMPOS.every(([k]) => m[k] === undefined);
  if (vazio) return diasEntre(post.publicadoEm, hoje) >= 3 ? 'Sem métricas: abra o post no LinkedIn e anote os números.' : null;
  if (m.atualizadoEm && diasEntre(post.publicadoEm, m.atualizadoEm) < 3 && diasEntre(post.publicadoEm, hoje) >= 7) {
    return 'Métricas anotadas logo depois de publicar; o alcance costuma crescer na primeira semana. Vale atualizar.';
  }
  return null;
}

/** O post fala da construção da SegInfo Study? Então o diário do projeto é o contexto dele. */
export function falaDoProjeto(post: Pick<PostPublicado, 'texto' | 'analise'>): boolean {
  return /seginfo/i.test(post.analise?.pilar ?? '') || /seginfo/i.test(post.texto);
}

/** Marcos do diário nos `dias` anteriores à data (inclusive), mais recentes primeiro. */
export function marcosAntesDe<T extends EntradaDiario>(entradas: T[], data: string, dias = 30, max = 5): T[] {
  return entradas
    .filter((e) => { const d = diasEntre(e.data, data); return d >= 0 && d <= dias; })
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, max);
}

/** Briefing para o Estúdio a partir de um marco do diário. */
export function briefingDoMarco(e: Pick<EntradaDiario, 'titulo' | 'descricao'>): string {
  return `Post sobre um marco da construção da SegInfo Study: "${e.titulo}". Contexto: ${e.descricao}`;
}

/** Tom do selo da nota do checklist (7 itens). */
export function tomChecklist(nota: number): 'ok' | 'warning' | 'danger' {
  return nota >= 6 ? 'ok' : nota >= 4 ? 'warning' : 'danger';
}
