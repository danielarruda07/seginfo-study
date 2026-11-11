import {
  DIARIO_PROJETO, FORMATOS_POST, normalizarUrlLinkedin,
  type CatalogoIA, type CategoriaDiario, type EntradaDiario, type Estrategia, type Metricas,
  type PostPublicado, type RascunhoIA,
} from '@seginfo/shared';
import type { PostIdea } from '@seginfo/shared';
import { http } from './http';
import { api } from './api';
import { listKeys, readRaw, removeKey, writeRaw } from './store';
import { listAtivos, listLabs, getProgressoLab } from './inventario';
import { listTopicos, listTrilhas, resumoGeral } from './catalog';
import { listSessoes } from './sessoes';

/**
 * Módulo LinkedIn como sistema de gestão do conhecimento (dados no PostgreSQL via API):
 * - CAPTURAR: posts publicados oficialmente (manual ou export do LinkedIn);
 * - ORGANIZAR: a IA (no servidor) liga cada post a pilares, temas, tópicos e trilhas
 *   e grava a nota no Segundo Cérebro;
 * - DESTILAR: aprendizados e ideias derivadas viram contexto reutilizável;
 * - EXPRESSAR: rascunhos novos nascem desse contexto + estudo + diário do projeto.
 */

export const FORMATOS = FORMATOS_POST;
export const normalizarUrl = normalizarUrlLinkedin;
export { isUrlLinkedin, ESTRATEGIA_PADRAO } from '@seginfo/shared';
export type { PostPublicado, Metricas, Estrategia, FormatoPost, AnalisePost, RascunhoIA } from '@seginfo/shared';

// ===================== API =====================

/** Rascunhos do Estúdio (tabela Post do servidor). */
export interface Rascunho { id: string; titulo: string; gancho: string; corpo: string; topicoId: string | null; publicado: boolean }
export const listRascunhos = () => api.getPosts() as Promise<Rascunho[]>;
export const criarRascunho = (b: { titulo: string; gancho: string; corpo: string; topicoId?: string }) => api.addPost(b) as Promise<Rascunho>;
export const editarRascunho = (id: string, b: Partial<Omit<Rascunho, 'id'>>) => api.patchPost(id, b) as Promise<Rascunho>;
export const removerRascunho = (id: string) => api.delPost(id);

type NovoPost = { url: string; publicadoEm: string; texto: string; formato?: string; metricas?: Metricas };

export const listPublicados = () => http.get<PostPublicado[]>('/linkedin/posts').then((r) => r.data);
export const criarPublicado = (b: NovoPost) => http.post<PostPublicado>('/linkedin/posts', b).then((r) => r.data);
export const editarPublicado = (id: string, b: Partial<NovoPost>) => http.patch<PostPublicado>(`/linkedin/posts/${id}`, b).then((r) => r.data);
export const removerPublicado = (id: string) => http.delete(`/linkedin/posts/${id}`).then((r) => r.data);
export const importarPublicados = (posts: (NovoPost & { origem?: string; analise?: unknown })[]) =>
  http.post<{ novos: number; duplicados: number }>('/linkedin/posts/importar', { posts }, { timeout: 60_000 }).then((r) => r.data);

// a análise roda no servidor e pode levar alguns segundos
export const organizarPost = (id: string) =>
  http.post<PostPublicado>(`/linkedin/posts/${id}/organizar`, { catalogo: catalogoParaIA() }, { timeout: 120_000 }).then((r) => r.data);
export const sincronizarCerebro = (id: string) =>
  http.post<{ memoriaId: string }>(`/linkedin/posts/${id}/cerebro`, { catalogo: catalogoParaIA() }).then((r) => r.data);

export const getEstrategia = () => http.get<Estrategia>('/linkedin/estrategia').then((r) => r.data);
export const saveEstrategia = (e: Estrategia) => http.put<Estrategia>('/linkedin/estrategia', e).then((r) => r.data);

export const listDiarioServidor = () => http.get<EntradaDiario[]>('/linkedin/diario').then((r) => r.data);
export const addDiario = (e: Omit<EntradaDiario, 'id'>) => http.post<EntradaDiario>('/linkedin/diario', e).then((r) => r.data);
export const removeDiario = (id: string) => http.delete(`/linkedin/diario/${id}`).then((r) => r.data);

export const statusIA = () => http.get<{ configurada: boolean; modelo: string }>('/ia/status').then((r) => r.data);

export interface PedidoRascunho {
  briefing: string;
  pilar?: string;
  formato: string;
  incluirDiario: boolean;
  notas: { titulo: string; trecho: string }[];
}
export const gerarRascunho = (p: PedidoRascunho) =>
  http.post<RascunhoIA>('/linkedin/rascunho', { ...p, estudo: contextoDoEstudo() }, { timeout: 180_000 }).then((r) => r.data);

/** Mensagem de erro legível a partir de uma resposta da API. */
export function mensagemErro(e: unknown): string {
  const r = (e as { response?: { status?: number; data?: { error?: string } } }).response;
  if (r?.data?.error) return r.data.error;
  if (r?.status === 401 || r?.status === 403) return 'Sessão do Cloudflare Access expirou. Recarregue a página.';
  if (!r) return 'Não foi possível falar com a API. Ela está no ar?';
  return e instanceof Error ? e.message : String(e);
}

// ===================== Migração do navegador para o servidor =====================

const CHAVES_LOCAIS = ['linkedin:publicados', 'linkedin:diario', 'linkedin:estrategia'] as const;
const FLAG_RASCUNHOS = 'linkedin:rascunhos-no-servidor';

/**
 * Antes do servidor, o módulo guardava dados no navegador. Envia o que existir para a API
 * uma única vez e guarda uma cópia renomeada (`linkedin-migrado:*`) por segurança.
 */
export async function migrarDadosLocais(): Promise<{ posts: number; marcos: number; estrategia: boolean; rascunhos: number } | null> {
  const existentes = new Set(listKeys());
  const rascunhosPendentes = existentes.has('posts') && !existentes.has(FLAG_RASCUNHOS);
  if (!CHAVES_LOCAIS.some((k) => existentes.has(k)) && !rascunhosPendentes) return null;
  const ler = <T,>(k: string): T | null => {
    const raw = readRaw(k);
    try { return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
  };
  const resultado = { posts: 0, marcos: 0, estrategia: false, rascunhos: 0 };

  // rascunhos do Estúdio: /api/import é idempotente pelo id (repetir não duplica)
  if (rascunhosPendentes) {
    const rascunhos = ler<PostIdea[]>('posts') ?? [];
    if (rascunhos.length) await api.importData({ posts: rascunhos });
    resultado.rascunhos = rascunhos.length;
    writeRaw(FLAG_RASCUNHOS, JSON.stringify(new Date().toISOString()));
  }

  const posts = ler<(PostPublicado & { cerebroId?: string })[]>('linkedin:publicados') ?? [];
  if (posts.length) {
    const r = await importarPublicados(posts.map((p) => ({
      url: p.url, publicadoEm: p.publicadoEm, texto: p.texto, formato: p.formato, metricas: p.metricas,
      origem: p.origem, ...(p.analise ? { analise: p.analise } : {}),
    })));
    resultado.posts = r.novos;
  }
  for (const e of ler<EntradaDiario[]>('linkedin:diario') ?? []) {
    await addDiario({ data: e.data, titulo: e.titulo, descricao: e.descricao, categoria: e.categoria, tags: e.tags });
    resultado.marcos++;
  }
  const estrategia = ler<Estrategia>('linkedin:estrategia');
  if (estrategia) { await saveEstrategia(estrategia); resultado.estrategia = true; }

  for (const k of CHAVES_LOCAIS) {
    const raw = readRaw(k);
    if (raw !== null) { writeRaw(k.replace('linkedin:', 'linkedin-migrado:'), raw); removeKey(k); }
  }
  return resultado;
}

// ===================== Importação do export oficial (Shares.csv) =====================

/** Parser de CSV (RFC 4180): aspas, "" escapado e quebras de linha dentro de campos. */
export function parseCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;
  // BOM fora e quebras de linha do Windows normalizadas (inclusive dentro de campos)
  const s = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) {
      if (c === '"' && s[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') {
      linha.push(campo); campo = '';
      if (linha.some((v) => v !== '')) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((v) => v !== '')) linhas.push(linha);
  return linhas;
}

export interface LeituraShares {
  posts: { url: string; publicadoEm: string; texto: string }[];
  ignorados: number;
  erro?: string;
}

/**
 * Lê o `Shares.csv` do arquivo "Obter uma cópia dos seus dados" do LinkedIn
 * (colunas Date, ShareLink, ShareCommentary...). Linhas sem texto (reposts, só mídia) são ignoradas.
 */
export function lerSharesCsv(texto: string): LeituraShares {
  const [cabecalho, ...linhas] = parseCsv(texto);
  if (!cabecalho) return { posts: [], ignorados: 0, erro: 'Arquivo vazio.' };
  const col = (nome: string) => cabecalho.findIndex((h) => h.trim().toLowerCase() === nome.toLowerCase());
  const iData = col('Date');
  const iLink = col('ShareLink');
  const iTexto = col('ShareCommentary');
  if (iData < 0 || iLink < 0 || iTexto < 0) {
    return { posts: [], ignorados: 0, erro: 'Não parece o Shares.csv do LinkedIn (faltam as colunas Date, ShareLink ou ShareCommentary).' };
  }
  const vistos = new Set<string>();
  const posts: LeituraShares['posts'] = [];
  let ignorados = 0;
  for (const l of linhas) {
    const url = (l[iLink] ?? '').trim();
    const textoPost = (l[iTexto] ?? '').trim();
    const data = (l[iData] ?? '').slice(0, 10);
    if (!url || !textoPost || !/^\d{4}-\d{2}-\d{2}$/.test(data)) { ignorados++; continue; }
    const chave = normalizarUrl(url);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    posts.push({ url, publicadoEm: data, texto: textoPost.slice(0, 10_000) });
  }
  return { posts, ignorados };
}

/** Engajamento = reações + 2×comentários + 3×compartilhamentos + 2×salvamentos (sinais mais fortes pesam mais). */
export function engajamento(m: Metricas): number {
  return (m.reacoes ?? 0) + 2 * (m.comentarios ?? 0) + 3 * (m.compartilhamentos ?? 0) + 2 * (m.salvamentos ?? 0);
}
/** Taxa de engajamento sobre impressões, em %. */
export function taxaEngajamento(m: Metricas): number | null {
  if (!m.impressoes) return null;
  const interacoes = (m.reacoes ?? 0) + (m.comentarios ?? 0) + (m.compartilhamentos ?? 0) + (m.salvamentos ?? 0);
  return Math.round((interacoes / m.impressoes) * 1000) / 10;
}

// ===================== Qualidade e segurança do texto =====================

/** Procura no texto o que pode expor o ambiente (IPs, domínios internos, ativos do inventário, segredos). */
export function riscosDePublicacao(texto: string): string[] {
  const riscos: string[] = [];
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b|\b(?:10|192\.168|172\.(?:1[6-9]|2\d|3[01]))\./i.test(texto)) {
    riscos.push('endereço IP ou de rede');
  }
  if (/\b(?:senha|password|token|secret|credencial|vulner[aá]vel|exposto|exploit)\b/i.test(texto)) {
    riscos.push('termo que pode revelar segredo ou fragilidade');
  }
  const ativos = listAtivos({ rows: 1_000 }).items;
  const lower = texto.toLowerCase();
  if (ativos.some((a) => [a.nome, a.endereco].some((v) => v && v.length > 3 && v !== '-' && lower.includes(v.toLowerCase())))) {
    riscos.push('nome ou endereço de ativo do homelab');
  }
  if (/\b[a-z0-9.-]+\.(?:local|internal|corp|lan|criecom\.ia\.br)\b/i.test(texto)) {
    riscos.push('domínio do ambiente');
  }
  return [...new Set(riscos)];
}

export interface ItemChecklist {
  id: string;
  ok: boolean;
  label: string;
  dica: string;
}

const CTA_REGEX = /\?|comente|conta (?:aqui|nos coment)|me conta|qual (?:é|foi) a sua|e você/i;

/**
 * Checklist de boas práticas de LinkedIn (o que costuma separar um post lido de um ignorado).
 * Heurístico e local — não depende de IA.
 */
export function checklistPost(gancho: string, corpo: string): ItemChecklist[] {
  const texto = `${gancho}\n\n${corpo}`.trim();
  const paragrafos = corpo.split(/\n\s*\n/).filter((p) => p.trim());
  const hashtags = texto.match(/(^|\s)#[\p{L}\d_]+/gu) ?? [];
  const final = texto.slice(-250);
  return [
    { id: 'gancho', ok: gancho.trim().length >= 20 && gancho.trim().length <= 200, label: 'Gancho cabe antes do "ver mais"',
      dica: 'A primeira linha decide o clique. Entre 20 e 200 caracteres, com tensão, número ou contraste.' },
    { id: 'tamanho', ok: texto.length >= 600 && texto.length <= 2_200, label: `Tamanho (${texto.length} caracteres)`,
      dica: 'Entre ~600 e ~2.200 caracteres: profundidade sem cansar. O limite do LinkedIn é 3.000.' },
    { id: 'respiro', ok: paragrafos.length >= 3 && paragrafos.every((p) => p.length <= 320), label: 'Parágrafos curtos, texto com respiro',
      dica: 'Blocos de 1–3 linhas, separados por linha em branco. Ninguém lê parede de texto no celular.' },
    { id: 'concreto', ok: /\d/.test(corpo) || /aprendi|errei|descobri|na prática|resultado/i.test(corpo), label: 'Tem algo concreto (número, resultado ou aprendizado)',
      dica: 'Prova > opinião: "reduzi 3 regras any/any" convence mais que "segurança é importante".' },
    { id: 'cta', ok: CTA_REGEX.test(final), label: 'Termina convidando à conversa',
      dica: 'Feche com uma pergunta específica. Comentários são o sinal que mais distribui o post.' },
    { id: 'hashtags', ok: hashtags.length >= 3 && hashtags.length <= 5, label: `Hashtags (${hashtags.length})`,
      dica: 'De 3 a 5 hashtags relevantes no final. Mais que isso parece spam.' },
    { id: 'link', ok: !/https?:\/\//i.test(texto), label: 'Sem link externo no corpo',
      dica: 'Links no texto tendem a reduzir o alcance. Coloque no primeiro comentário.' },
  ];
}

// ===================== Diário do projeto =====================

export type EntradaDiarioComOrigem = EntradaDiario & { origem: 'projeto' | 'voce' };

/** Marcos do desenvolvimento (no código) + marcos que você criou (no banco), mais recentes primeiro. */
export function juntarDiario(doServidor: EntradaDiario[]): EntradaDiarioComOrigem[] {
  return [
    ...DIARIO_PROJETO.map((e) => ({ ...e, origem: 'projeto' as const })),
    ...doServidor.map((e) => ({ ...e, origem: 'voce' as const })),
  ].sort((a, b) => b.data.localeCompare(a.data));
}

export const CATEGORIA_DIARIO_LABEL: Record<CategoriaDiario, string> = {
  funcionalidade: 'Funcionalidade',
  seguranca: 'Segurança',
  infra: 'Infra',
  decisao: 'Decisão',
  aprendizado: 'Aprendizado',
  plano: 'Próximo passo',
};

/** Diário em Markdown — para guardar, revisar ou colar num rascunho longo. */
export function diarioEmMarkdown(entradas: EntradaDiario[]): string {
  const linhas = ['# Diário de construção — SegInfo Study', ''];
  for (const e of [...entradas].sort((a, b) => a.data.localeCompare(b.data))) {
    linhas.push(`## ${e.data} · ${e.titulo}`, `*${CATEGORIA_DIARIO_LABEL[e.categoria]}* — ${e.tags.map((t) => `#${t}`).join(' ')}`, '', e.descricao, '');
  }
  return linhas.join('\n');
}

// ===================== Contexto enviado à IA =====================

/** Catálogo enxuto (id + título) para a IA ligar posts a tópicos e trilhas existentes. */
export function catalogoParaIA(): CatalogoIA {
  return {
    trilhas: listTrilhas().map((t) => ({ id: t.id, titulo: t.titulo })),
    topicos: listTopicos({ rows: 10_000 }).items.map((t) => ({ id: t.id, titulo: t.titulo, trilhaId: t.trilhaId })),
  };
}

/**
 * Parte "estudo" do contexto (o progresso de estudo ainda vive no navegador). O servidor
 * junta estratégia, histórico de posts e diário. NUNCA inclui o inventário: notas de sessão
 * que citem IP, host ou segredo ficam de fora.
 */
export function contextoDoEstudo(): string {
  const resumo = resumoGeral();
  const topicos = listTopicos({ rows: 10_000 }).items;
  const concluidos = topicos.filter((t) => t.status === 'concluido').map((t) => t.titulo);
  const estudando = topicos.filter((t) => t.status === 'estudando').map((t) => t.titulo);
  const labsFeitos = listLabs().filter((l) => getProgressoLab(l.id).status === 'concluido').map((l) => l.titulo);
  const sessoes = listSessoes().slice(0, 10)
    .filter((s) => s.nota?.trim() && riscosDePublicacao(s.nota).length === 0)
    .map((s) => `${s.data}: ${s.nota}`);
  return `Progresso geral: ${resumo.pct}% (${resumo.concluidos}/${resumo.total} tópicos).\n` +
    `Concluídos: ${concluidos.slice(0, 25).join('; ') || 'nenhum ainda'}.\nEstudando agora: ${estudando.slice(0, 15).join('; ') || '—'}.\n` +
    `Labs concluídos: ${labsFeitos.join('; ') || 'nenhum ainda'}.` +
    (sessoes.length ? `\nNotas de sessões recentes:\n- ${sessoes.join('\n- ')}` : '');
}
