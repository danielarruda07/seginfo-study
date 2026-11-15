import { z } from 'zod';

/**
 * Arte dos posts (imagem única e carrossel em PDF). A IA projeta os slides (texto curto por slide);
 * o navegador desenha com template e, se você quiser, uma ilustração gerada por IA entra de fundo.
 */

/** Tamanhos aceitos pelo LinkedIn. Retrato 4:5 ocupa mais tela no celular e é o padrão. */
export const TAMANHOS_VISUAIS = {
  retrato: { largura: 1080, altura: 1350, rotulo: 'Retrato 4:5 (1080×1350)', proporcaoIA: '3:4' },
  quadrado: { largura: 1080, altura: 1080, rotulo: 'Quadrado 1:1 (1080×1080)', proporcaoIA: '1:1' },
  paisagem: { largura: 1200, altura: 627, rotulo: 'Paisagem 1,91:1 (1200×627)', proporcaoIA: '16:9' },
} as const;
export type TamanhoVisual = keyof typeof TAMANHOS_VISUAIS;
export const TAMANHO_VISUAL_PADRAO: TamanhoVisual = 'retrato';

export const PAPEIS_SLIDE = ['capa', 'conteudo', 'numero', 'lista', 'fecho'] as const;
export type PapelSlide = (typeof PAPEIS_SLIDE)[number];
export const ROTULO_PAPEL: Record<PapelSlide, string> = {
  capa: 'Capa', conteudo: 'Conteúdo', numero: 'Número em destaque', lista: 'Lista', fecho: 'Fecho',
};

export const SlideVisualSchema = z.object({
  papel: z.enum(PAPEIS_SLIDE),
  /** linha pequena acima do título (ex.: "LAB · HONEYPOT") */
  rotulo: z.string(),
  titulo: z.string(),
  texto: z.string(),
  itens: z.array(z.string()),
  /** número ou palavra grande, só no papel "numero" */
  destaque: z.string(),
  /** descrição, em inglês, de uma ilustração SEM texto para o fundo; vazio = sem ilustração */
  ilustracao: z.string(),
});
export type SlideVisual = z.infer<typeof SlideVisualSchema>;

export const PecaVisualIASchema = z.object({
  /** título do documento no LinkedIn (carrossel) */
  tituloDocumento: z.string(),
  textoAlternativo: z.string(),
  slides: z.array(SlideVisualSchema),
});
export type PecaVisual = z.infer<typeof PecaVisualIASchema>;

/** Folga acima do que cabe bem: o desenho reduz a fonte, mas texto enorme nunca fica legível. */
export const LIMITES_SLIDE = { rotulo: 48, titulo: 110, texto: 320, itens: 6, item: 120, destaque: 14, ilustracao: 500 } as const;

const corta = (s: string, max: number) => {
  const t = s.replace(/\s+\n/g, '\n').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
};

export function slideVazio(papel: PapelSlide = 'conteudo'): SlideVisual {
  return { papel, rotulo: '', titulo: '', texto: '', itens: [], destaque: '', ilustracao: '' };
}

export function normalizarSlide(s: SlideVisual): SlideVisual {
  return {
    papel: s.papel,
    rotulo: corta(s.rotulo, LIMITES_SLIDE.rotulo),
    titulo: corta(s.titulo, LIMITES_SLIDE.titulo),
    texto: corta(s.texto, LIMITES_SLIDE.texto),
    itens: s.itens.map((i) => corta(i, LIMITES_SLIDE.item)).filter(Boolean).slice(0, LIMITES_SLIDE.itens),
    destaque: corta(s.destaque, LIMITES_SLIDE.destaque),
    ilustracao: corta(s.ilustracao, LIMITES_SLIDE.ilustracao),
  };
}

/** Garante a quantidade de slides do formato (imagem: 1; carrossel: 3 a 10) e limita o tamanho dos textos. */
export function normalizarPeca(p: PecaVisual, tipo: 'imagem' | 'carrossel'): PecaVisual {
  const slides = p.slides.map(normalizarSlide).filter((s) => s.titulo || s.texto || s.itens.length || s.destaque);
  return {
    tituloDocumento: corta(p.tituloDocumento, 200),
    textoAlternativo: corta(p.textoAlternativo, 1000),
    slides: tipo === 'imagem' ? slides.slice(0, 1) : slides.slice(0, 10),
  };
}

// ===================== Ilustração por IA (Gemini) =====================

export const OPCOES_ILUSTRACAO = ['gemini-rapido', 'gemini-qualidade'] as const;
export type OpcaoIlustracao = (typeof OPCOES_ILUSTRACAO)[number];

export interface OpcaoIlustracaoInfo {
  id: OpcaoIlustracao;
  rotulo: string;
  dica: string;
  /** estimativa em dólares por imagem; confira no AI Studio, os preços mudam */
  custoEstimado: string;
}
export interface OpcoesImagem {
  configurado: boolean;
  opcoes: OpcaoIlustracaoInfo[];
  limiteDiario: number;
  usadasHoje: number;
}

export const IlustracaoInSchema = z.object({
  opcao: z.enum(OPCOES_ILUSTRACAO),
  prompt: z.string().trim().min(10).max(LIMITES_SLIDE.ilustracao),
  tamanho: z.enum(['retrato', 'quadrado', 'paisagem']),
  /** cor de destaque pedida no estilo da imagem */
  acento: z.string().trim().max(30).optional(),
});
export interface IlustracaoGerada { mime: string; base64: string }

export const PecaVisualInSchema = z.object({
  tipo: z.enum(['imagem', 'carrossel']),
  gancho: z.string().max(2_000),
  corpo: z.string().max(50_000),
  roteiro: z.string().max(10_000).optional(),
  direcao: z.string().max(5_000).optional(),
});
