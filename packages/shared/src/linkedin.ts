import { z } from 'zod';

/** Contratos do módulo LinkedIn, compartilhados entre web e api. */

export const FORMATOS_POST = ['texto', 'imagem', 'carrossel', 'video', 'artigo', 'enquete'] as const;
export type FormatoPost = (typeof FORMATOS_POST)[number];

export const MetricasSchema = z.object({
  impressoes: z.number().int().nonnegative().optional(),
  reacoes: z.number().int().nonnegative().optional(),
  comentarios: z.number().int().nonnegative().optional(),
  compartilhamentos: z.number().int().nonnegative().optional(),
  salvamentos: z.number().int().nonnegative().optional(),
  atualizadoEm: z.string().optional(),
});
export type Metricas = z.infer<typeof MetricasSchema>;

/** O que a IA devolve ao organizar um post (validado pelo schema na resposta da API). */
export const AnalisePostSchema = z.object({
  resumo: z.string(),
  pilar: z.string(),
  tipoGancho: z.string(),
  temas: z.array(z.string()),
  tags: z.array(z.string()),
  topicoIds: z.array(z.string()),
  trilhaIds: z.array(z.string()),
  aprendizados: z.array(z.string()),
  ideiasDerivadas: z.array(z.string()),
  pontosFortes: z.array(z.string()),
  melhorias: z.array(z.string()),
});
export type AnalisePost = z.infer<typeof AnalisePostSchema> & { analisadoEm: string; modelo: string };

export interface PostPublicado {
  id: string;
  url: string;
  publicadoEm: string;
  texto: string;
  formato: FormatoPost;
  metricas: Metricas;
  origem: 'manual' | 'importacao';
  analise: AnalisePost | null;
  memoriaId: string | null;
}

export const EstrategiaSchema = z.object({
  objetivo: z.string().trim().min(1).max(500),
  publico: z.string().trim().min(1).max(500),
  voz: z.string().trim().min(1).max(1000),
  pilares: z.array(z.string().trim().min(1).max(80)).min(1).max(6),
});
export type Estrategia = z.infer<typeof EstrategiaSchema>;

export const ESTRATEGIA_PADRAO: Estrategia = {
  objetivo: "Construir posicionamento para oportunidades em Segurança da Informação, mostrando como a experiência em infraestrutura, DevOps e virtualização se conecta à segurança operacional.",
  publico: "Recrutadores e lideranças de Segurança da Informação, times de infraestrutura e profissionais que conectam operação e segurança.",
  voz: "Primeira pessoa, direto e prático. Explico contexto, decisão, prática e aprendizado. Separo claramente experiência profissional, estudo e laboratório. Não invento métricas, anos, escopo ou resultados; quando faltar evidência, deixo um campo para confirmar.",
  pilares: [
    "Infraestrutura, DevOps e virtualização aplicados à segurança",
    "Labs e prática de Segurança da Informação",
    "Aprendizados de Blue Team e operações seguras",
    "Transição de carreira com evidências e próximos passos",
    "Construção da SegInfo Study e decisões técnicas",
  ],
};

/** Rascunho gerado pela IA. */
export const RascunhoIASchema = z.object({
  titulo: z.string(),
  gancho: z.string(),
  corpo: z.string(),
  hashtags: z.array(z.string()),
  porQueFunciona: z.string(),
  dadosParaConfirmar: z.array(z.string()),
  direcaoVisual: z.string(),
  textoAlternativo: z.string(),
  roteiroSlides: z.array(z.string()),
});
export type RascunhoIA = z.infer<typeof RascunhoIASchema>;

/** Catálogo enxuto que o front envia para a IA ligar posts ao estudo. */
export interface CatalogoIA {
  trilhas: { id: string; titulo: string }[];
  topicos: { id: string; titulo: string; trilhaId: string }[];
}

/** Normaliza a URL do post para detectar duplicados (sem query string, sem barra final, minúsculas). */
export function normalizarUrlLinkedin(url: string): string {
  return url.trim().replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
}

export function isUrlLinkedin(url: string): boolean {
  return /^https:\/\/(www\.)?linkedin\.com\//i.test(url.trim());
}
