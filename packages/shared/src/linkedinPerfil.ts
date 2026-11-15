import { z } from 'zod';

/**
 * Perfil profissional, inspirações e perfil de voz do módulo LinkedIn.
 *
 * O perfil profissional é a fonte dos FATOS que a IA pode afirmar (certificações, cursos, trajetória,
 * projetos). Não há campo para o nome do empregador: a decisão é falar da experiência, não da empresa.
 */

const Texto = (max: number) => z.string().trim().max(max);

// ===================== Perfil profissional =====================

export const STATUS_CERTIFICACAO = ['obtida', 'em_andamento', 'planejada'] as const;
export type StatusCertificacao = (typeof STATUS_CERTIFICACAO)[number];
export const ROTULO_STATUS_CERTIFICACAO: Record<StatusCertificacao, string> = {
  obtida: 'Obtida',
  em_andamento: 'Em andamento',
  planejada: 'Planejada',
};

export const CertificacaoSchema = z.object({
  id: z.string().min(1).max(60),
  nome: Texto(160).min(1),
  emissor: Texto(120),
  status: z.enum(STATUS_CERTIFICACAO),
  /** AAAA-MM, ano ou texto livre (ex.: "prova em dezembro") */
  data: Texto(40),
  /** ID da credencial ou link de verificação */
  credencial: Texto(300),
});
export const CursoSchema = z.object({
  id: z.string().min(1).max(60),
  nome: Texto(160).min(1),
  instituicao: Texto(120),
  concluidoEm: Texto(40),
  cargaHoraria: Texto(40),
});
export const ExperienciaSchema = z.object({
  id: z.string().min(1).max(60),
  cargo: Texto(120).min(1),
  /** Setor ou porte, SEM o nome da empresa (ex.: "provedor de nuvem regional"). */
  contexto: Texto(160),
  periodo: Texto(60),
  resumo: Texto(1200),
  destaques: z.array(Texto(300)).max(10),
});
export const ProjetoPortfolioSchema = z.object({
  id: z.string().min(1).max(60),
  nome: Texto(160).min(1),
  descricao: Texto(1200),
  tecnologias: z.array(Texto(60)).max(20),
  url: Texto(300),
});
export const VagaAlvoSchema = z.object({
  id: z.string().min(1).max(60),
  titulo: Texto(160).min(1),
  nivel: Texto(60),
  requisitos: z.array(Texto(160)).max(40),
  observacao: Texto(1000),
});

export const PerfilProSchema = z.object({
  headline: Texto(220),
  sobre: Texto(2600),
  competencias: z.array(Texto(60)).max(60),
  certificacoes: z.array(CertificacaoSchema).max(40),
  cursos: z.array(CursoSchema).max(60),
  experiencias: z.array(ExperienciaSchema).max(20),
  projetos: z.array(ProjetoPortfolioSchema).max(30),
  vagasAlvo: z.array(VagaAlvoSchema).max(15),
});
export type PerfilPro = z.infer<typeof PerfilProSchema>;
export type Certificacao = z.infer<typeof CertificacaoSchema>;
export type Curso = z.infer<typeof CursoSchema>;
export type Experiencia = z.infer<typeof ExperienciaSchema>;
export type ProjetoPortfolio = z.infer<typeof ProjetoPortfolioSchema>;
export type VagaAlvo = z.infer<typeof VagaAlvoSchema>;

export const PERFIL_PRO_VAZIO: PerfilPro = {
  headline: '', sobre: '', competencias: [], certificacoes: [], cursos: [], experiencias: [], projetos: [], vagasAlvo: [],
};

export interface PerfilProRegistro { perfil: PerfilPro; importadoEm: string | null; atualizadoEm: string | null }

/**
 * O que a IA extrai do PDF do perfil (Perfil > Mais > Salvar como PDF). Sem ids e sem campos opcionais,
 * para a saída estruturada ficar simples. Quem recebe acrescenta os ids.
 */
export const PerfilImportadoSchema = z.object({
  headline: z.string(),
  sobre: z.string(),
  competencias: z.array(z.string()),
  certificacoes: z.array(z.object({ nome: z.string(), emissor: z.string(), status: z.enum(STATUS_CERTIFICACAO), data: z.string(), credencial: z.string() })),
  cursos: z.array(z.object({ nome: z.string(), instituicao: z.string(), concluidoEm: z.string(), cargaHoraria: z.string() })),
  experiencias: z.array(z.object({ cargo: z.string(), contexto: z.string(), periodo: z.string(), resumo: z.string(), destaques: z.array(z.string()) })),
  projetos: z.array(z.object({ nome: z.string(), descricao: z.string(), tecnologias: z.array(z.string()), url: z.string() })),
});
export type PerfilImportado = z.infer<typeof PerfilImportadoSchema>;

/** Vaga lida de um texto colado (descrição da vaga). */
export const VagaImportadaSchema = z.object({
  titulo: z.string(),
  nivel: z.string(),
  requisitos: z.array(z.string()),
  observacao: z.string(),
});
export type VagaImportada = z.infer<typeof VagaImportadaSchema>;

const chave = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

/**
 * Junta um perfil importado ao atual SEM apagar nada: só entra o que ainda não existe (comparando o nome).
 * Headline e Sobre só preenchem quando estão vazios. Devolve também quantos itens entraram.
 */
export function mesclarPerfil(atual: PerfilPro, importado: PerfilImportado, novoId: () => string): { perfil: PerfilPro; novos: number } {
  let novos = 0;
  /** Acrescenta os candidatos cuja chave ainda não existe na lista. */
  function mesclar<E, C>(existentes: E[], candidatos: C[], chaveE: (e: E) => string, chaveC: (c: C) => string, criar: (c: C) => E): E[] {
    const vistos = new Set(existentes.map((e) => chave(chaveE(e))));
    const saida = [...existentes];
    for (const c of candidatos) {
      const k = chave(chaveC(c));
      if (!k || vistos.has(k)) continue;
      vistos.add(k);
      saida.push(criar(c));
      novos++;
    }
    return saida;
  }
  const competencias = mesclar<string, string>(atual.competencias, importado.competencias, (e) => e, (c) => c, (c) => c.trim());
  const perfil: PerfilPro = {
    ...atual,
    headline: atual.headline.trim() ? atual.headline : importado.headline,
    sobre: atual.sobre.trim() ? atual.sobre : importado.sobre,
    competencias,
    certificacoes: mesclar(atual.certificacoes, importado.certificacoes, (e) => e.nome, (c) => c.nome, (c) => ({ id: novoId(), ...c })),
    cursos: mesclar(atual.cursos, importado.cursos, (e) => e.nome, (c) => c.nome, (c) => ({ id: novoId(), ...c })),
    experiencias: mesclar(atual.experiencias, importado.experiencias, (e) => `${e.cargo} ${e.periodo}`, (c) => `${c.cargo} ${c.periodo}`, (c) => ({ id: novoId(), ...c })),
    projetos: mesclar(atual.projetos, importado.projetos, (e) => e.nome, (c) => c.nome, (c) => ({ id: novoId(), ...c })),
  };
  return { perfil, novos };
}

/** Todo o conteúdo importado como perfil novo (modo "substituir"), mantendo as vagas-alvo atuais. */
export function perfilDoImportado(importado: PerfilImportado, vagasAlvo: VagaAlvo[], novoId: () => string): PerfilPro {
  return {
    headline: importado.headline, sobre: importado.sobre, competencias: importado.competencias.filter((c) => c.trim()),
    certificacoes: importado.certificacoes.map((c) => ({ id: novoId(), ...c })),
    cursos: importado.cursos.map((c) => ({ id: novoId(), ...c })),
    experiencias: importado.experiencias.map((c) => ({ id: novoId(), ...c })),
    projetos: importado.projetos.map((c) => ({ id: novoId(), ...c })),
    vagasAlvo,
  };
}

// ===================== Inspirações =====================

export const TIPOS_INSPIRACAO = ['post', 'perfil'] as const;
export const ASPECTOS_INSPIRACAO = ['texto', 'imagem', 'frequencia', 'assunto', 'carreira'] as const;
export type AspectoInspiracao = (typeof ASPECTOS_INSPIRACAO)[number];
export const ROTULO_ASPECTO: Record<AspectoInspiracao, string> = {
  texto: 'Texto e estilo',
  imagem: 'Imagem e visual',
  frequencia: 'Frequência',
  assunto: 'Assuntos',
  carreira: 'Carreira',
};

export const InspiracaoInSchema = z.object({
  tipo: z.enum(TIPOS_INSPIRACAO),
  /** Nome da pessoa que inspira */
  autor: Texto(120).min(1),
  url: Texto(500).optional(),
  /** Texto do post, ou para um perfil: headline, sobre e assuntos que a pessoa costuma abordar */
  texto: Texto(10_000).optional(),
  /** O que eu admiro (ou quero evitar) neste exemplo */
  motivo: Texto(1000).optional(),
  aspectos: z.array(z.enum(ASPECTOS_INSPIRACAO)).max(5).optional(),
  /** Como é a imagem ou o visual (pode vir da análise de um print) */
  observacaoVisual: Texto(1500).optional(),
  /** Ex.: "3 posts por semana" */
  frequencia: Texto(120).optional(),
});
export type InspiracaoIn = z.infer<typeof InspiracaoInSchema>;

export interface InspiracaoLinkedin {
  id: string;
  tipo: (typeof TIPOS_INSPIRACAO)[number];
  autor: string;
  url: string;
  texto: string;
  motivo: string;
  aspectos: AspectoInspiracao[];
  observacaoVisual: string;
  frequencia: string;
  criadoEm: string;
}

export const MAX_INSPIRACOES = 60;

/** Descrição de um print (post de inspiração) feita pela IA. */
export const AnaliseVisualSchema = z.object({ descricao: z.string() });

// ===================== Perfil de voz =====================

/** O que a IA aprende do estilo do autor e do que ele admira. */
export const PerfilVozIASchema = z.object({
  resumo: z.string(),
  tom: z.array(z.string()),
  estrutura: z.string(),
  ganchosTipicos: z.array(z.string()),
  formatacao: z.string(),
  tamanhoTipico: z.string(),
  fechamento: z.string(),
  palavrasQueUso: z.array(z.string()),
  palavrasEvitar: z.array(z.string()),
  assuntosFortes: z.array(z.string()),
  adotarDasInspiracoes: z.array(z.string()),
  naoCopiar: z.array(z.string()),
  cadenciaSugerida: z.string(),
  orientacaoVisual: z.string(),
  /** ids de posts do próprio autor que melhor representam o estilo (até 3) */
  exemplosIds: z.array(z.string()),
});
export type PerfilVozIA = z.infer<typeof PerfilVozIASchema>;

export interface VozLinkedin {
  perfil: PerfilVozIA | null;
  /** Regras minhas, em texto livre; valem mais que o perfil aprendido */
  ajustes: string;
  geradoEm: string | null;
  baseadoEm: { posts: number; inspiracoes: number };
  modelo: string;
}

export const VozAjustesInSchema = z.object({ ajustes: Texto(1500) });

/** Mínimo de material para a IA aprender uma voz: posts seus ou exemplos que você admira. */
export const MIN_POSTS_VOZ = 3;
export const MIN_INSPIRACOES_VOZ = 2;
export const podeGerarVoz = (posts: number, inspiracoes: number): boolean => posts >= MIN_POSTS_VOZ || inspiracoes >= MIN_INSPIRACOES_VOZ;
