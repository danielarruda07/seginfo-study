import {
  PERFIL_PRO_VAZIO, PerfilProSchema, PerfilVozIASchema, ROTULO_ASPECTO,
  type AspectoInspiracao, type InspiracaoLinkedin, type PerfilPro, type PerfilProRegistro, type VozLinkedin,
} from '@seginfo/shared';
import { prisma } from './db.js';

/**
 * Leitura do perfil profissional, das inspirações e da voz, e montagem do texto que vai para a IA.
 * Fica separado das rotas para o pipeline poder usar sem importar o módulo de rotas.
 */

export async function perfilDe(usuarioId: string): Promise<PerfilProRegistro> {
  const linha = await prisma.linkedinPerfilPro.findUnique({ where: { usuarioId } });
  if (!linha) return { perfil: PERFIL_PRO_VAZIO, importadoEm: null, atualizadoEm: null };
  const ok = PerfilProSchema.safeParse(linha.dados);
  return {
    perfil: ok.success ? ok.data : PERFIL_PRO_VAZIO,
    importadoEm: linha.importadoEm?.toISOString() ?? null,
    atualizadoEm: linha.atualizadoEm.toISOString(),
  };
}

const ASPECTOS = new Set<string>(Object.keys(ROTULO_ASPECTO));

export function inspiracaoParaDto(i: {
  id: string; tipo: string; autor: string; url: string; texto: string; motivo: string; aspectos: string[];
  observacaoVisual: string; frequencia: string; criadoEm: Date;
}): InspiracaoLinkedin {
  return {
    id: i.id, tipo: i.tipo === 'perfil' ? 'perfil' : 'post', autor: i.autor, url: i.url, texto: i.texto, motivo: i.motivo,
    aspectos: i.aspectos.filter((a): a is AspectoInspiracao => ASPECTOS.has(a)),
    observacaoVisual: i.observacaoVisual, frequencia: i.frequencia, criadoEm: i.criadoEm.toISOString(),
  };
}

export async function vozDe(usuarioId: string): Promise<VozLinkedin> {
  const linha = await prisma.linkedinVoz.findUnique({ where: { usuarioId } });
  const perfil = linha?.perfil ? PerfilVozIASchema.safeParse(linha.perfil) : null;
  return {
    perfil: perfil?.success ? perfil.data : null,
    ajustes: linha?.ajustes ?? '',
    geradoEm: linha?.geradoEm?.toISOString() ?? null,
    baseadoEm: { posts: linha?.baseadoEmPosts ?? 0, inspiracoes: linha?.baseadoEmInspiracoes ?? 0 },
    modelo: linha?.modelo ?? '',
  };
}

const juntar = (itens: string[]) => itens.filter((x) => x.trim()).join('; ');
const linhaCert = (c: PerfilPro['certificacoes'][number]) => `${c.nome}${c.emissor ? ` (${c.emissor}${c.data ? `, ${c.data}` : ''})` : c.data ? ` (${c.data})` : ''}`;

/** Fatos do perfil profissional e vagas-alvo, para o bloco da jornada. Vazio se nada foi cadastrado. */
export async function contextoDoPerfil(usuarioId: string): Promise<string> {
  const { perfil: p } = await perfilDe(usuarioId);
  const temAlgo = p.headline || p.sobre || p.competencias.length || p.certificacoes.length || p.cursos.length
    || p.experiencias.length || p.projetos.length || p.vagasAlvo.length;
  if (!temAlgo) return '';
  const cert = (s: string) => p.certificacoes.filter((c) => c.status === s).map(linhaCert);
  const linhas = ['## Perfil profissional (fatos que eu mesmo cadastrei; não afirme nada além disto)'];
  if (p.headline) linhas.push(`Headline atual: ${p.headline}`);
  if (p.sobre) linhas.push(`Sobre (resumo atual): ${p.sobre.slice(0, 900)}`);
  if (cert('obtida').length) linhas.push(`Certificações obtidas: ${juntar(cert('obtida'))}`);
  if (cert('em_andamento').length) linhas.push(`Certificações em andamento (diga "estudando para"): ${juntar(cert('em_andamento'))}`);
  if (cert('planejada').length) linhas.push(`Certificações planejadas (nunca cite como feitas): ${juntar(cert('planejada'))}`);
  if (p.cursos.length) linhas.push(`Cursos: ${juntar(p.cursos.map((c) => `${c.nome}${c.instituicao ? ` (${c.instituicao})` : ''}`))}`);
  if (p.experiencias.length) {
    linhas.push('Experiência:', ...p.experiencias.map((e) =>
      `- ${e.cargo}${e.contexto ? `, ${e.contexto}` : ''}${e.periodo ? ` (${e.periodo})` : ''}${e.resumo ? `: ${e.resumo}` : ''}${e.destaques.length ? ` Destaques: ${juntar(e.destaques)}.` : ''}`));
  }
  if (p.projetos.length) {
    linhas.push('Projetos de portfólio:', ...p.projetos.map((x) => `- ${x.nome}${x.descricao ? `: ${x.descricao}` : ''}${x.tecnologias.length ? ` [${x.tecnologias.join(', ')}]` : ''}`));
  }
  if (p.competencias.length) linhas.push(`Competências: ${p.competencias.slice(0, 40).join(', ')}`);
  if (p.vagasAlvo.length) {
    linhas.push('## Vagas-alvo (para onde quero ir; ajuste ênfase e vocabulário, sem fingir experiência que não tenho)',
      ...p.vagasAlvo.map((v) => `- ${v.titulo}${v.nivel ? ` (${v.nivel})` : ''}: ${v.requisitos.slice(0, 20).join(', ')}${v.observacao ? `. ${v.observacao}` : ''}`));
  }
  return linhas.join('\n');
}

export const pontos = (m: unknown) => {
  const x = (m ?? {}) as Record<string, number | undefined>;
  return (x.reacoes ?? 0) + 2 * (x.comentarios ?? 0) + 3 * (x.compartilhamentos ?? 0) + 2 * (x.salvamentos ?? 0);
};

/**
 * Bloco de voz para o sistema: perfil aprendido, ajustes do autor e até 3 posts dele por inteiro
 * (os escolhidos pela IA; sem escolha, os mais engajados; sem métricas, os mais recentes).
 * Vazio quando não há perfil, ajustes nem posts.
 */
export async function contextoDeVoz(usuarioId: string): Promise<string> {
  const [voz, posts] = await Promise.all([
    vozDe(usuarioId),
    prisma.linkedinPost.findMany({ where: { usuarioId }, orderBy: { publicadoEm: 'desc' }, take: 200 }),
  ]);
  const escolhidos = voz.perfil?.exemplosIds.map((id) => posts.find((p) => p.id === id)).filter((p): p is (typeof posts)[number] => !!p) ?? [];
  const exemplos = escolhidos.length
    ? escolhidos
    : [...posts].sort((a, b) => pontos(b.metricas) - pontos(a.metricas) || b.publicadoEm.localeCompare(a.publicadoEm)).slice(0, 3);
  if (!voz.perfil && !voz.ajustes.trim() && !exemplos.length) return '';
  const v = voz.perfil;
  const linhas: string[] = [];
  if (voz.ajustes.trim()) linhas.push(`Regras minhas (prioridade máxima): ${voz.ajustes.trim()}`);
  if (v) {
    linhas.push(
      `Resumo: ${v.resumo}`,
      `Tom: ${v.tom.join('; ')}`,
      `Estrutura típica: ${v.estrutura}`,
      `Ganchos que uso: ${v.ganchosTipicos.join(' | ')}`,
      `Formatação: ${v.formatacao}`,
      `Tamanho: ${v.tamanhoTipico}`,
      `Fecho: ${v.fechamento}`,
      `Palavras e construções minhas: ${v.palavrasQueUso.join(', ')}`,
      `Evitar: ${v.palavrasEvitar.join(', ')}`,
      `Assuntos fortes: ${v.assuntosFortes.join('; ')}`,
      `Aproveitar do que admiro: ${v.adotarDasInspiracoes.join('; ')}`,
      `Não copiar das inspirações: ${v.naoCopiar.join('; ')}`,
      `Visual (para direção de arte): ${v.orientacaoVisual}`,
    );
  }
  if (exemplos.length) {
    linhas.push('Posts meus, por inteiro (imite o jeito de escrever; nunca copie frases):',
      ...exemplos.map((p) => `<exemplo data="${p.publicadoEm}">\n${p.texto.slice(0, 1_800)}\n</exemplo>`));
  }
  return linhas.join('\n');
}
