import { z } from 'zod';
import { FORMATOS_POST, type FormatoPost } from './linkedin';

/**
 * Pipeline do módulo LinkedIn: projetos, backlog de ideias, ciclo de vida do rascunho
 * (rascunho → aprovado → agendado → publicado), versões e agendamento.
 * Contratos e regras puras usados pelo web e pela api. As regras de liberação (preflight)
 * ficam aqui para o servidor aplicar as MESMAS que a tela mostra: nada é publicado só
 * porque o navegador disse que podia.
 */

// ===================== Projetos =====================

export const STATUS_PROJETO = ['ativo', 'pausado', 'concluido'] as const;
export type StatusProjeto = (typeof STATUS_PROJETO)[number];

export interface ProjetoLinkedin {
  id: string;
  nome: string;
  descricao: string;
  objetivo: string;
  pilar: string | null;
  status: StatusProjeto;
  criadoEm: string;
}

export const ProjetoInSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  descricao: z.string().trim().max(1_000).optional(),
  objetivo: z.string().trim().max(500).optional(),
  pilar: z.string().trim().max(80).nullable().optional(),
  status: z.enum(STATUS_PROJETO).optional(),
});
export type ProjetoIn = z.infer<typeof ProjetoInSchema>;

// ===================== Ideias (backlog) =====================

export const STATUS_IDEIA = ['nova', 'em_rascunho', 'descartada'] as const;
export type StatusIdeia = (typeof STATUS_IDEIA)[number];

/** De onde a ideia veio: digitada, análise de post publicado, lab, marco do diário, Radar ou planejador. */
export const ORIGENS_IDEIA = ['manual', 'analise', 'lab', 'marco', 'radar', 'planejador'] as const;
export type OrigemIdeia = (typeof ORIGENS_IDEIA)[number];

export interface IdeiaLinkedin {
  id: string;
  titulo: string;
  briefing: string;
  pilar: string | null;
  projetoId: string | null;
  formato: FormatoPost | null;
  origem: OrigemIdeia;
  /** id do post, lab ou marco que gerou a ideia */
  origemRef: string | null;
  status: StatusIdeia;
  /** YYYY-MM-DD sugerido pelo planejador (aparece no calendário) */
  sugeridaPara: string | null;
  criadoEm: string;
}

const DataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const IdeiaInSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  briefing: z.string().trim().max(3_000).optional(),
  pilar: z.string().trim().max(80).nullable().optional(),
  projetoId: z.string().max(100).nullable().optional(),
  formato: z.enum(FORMATOS_POST).nullable().optional(),
  origem: z.enum(ORIGENS_IDEIA).optional(),
  origemRef: z.string().max(100).nullable().optional(),
  sugeridaPara: DataISO.nullable().optional(),
  status: z.enum(STATUS_IDEIA).optional(),
});
export type IdeiaIn = z.infer<typeof IdeiaInSchema>;

// ===================== Rascunho no pipeline =====================

export const STATUS_RASCUNHO = ['rascunho', 'aprovado', 'agendado', 'publicando', 'publicado', 'falhou'] as const;
export type StatusRascunho = (typeof STATUS_RASCUNHO)[number];

/** `lembrete`: o app avisa e você publica à mão. `api`: o servidor publica pela API do LinkedIn. */
export const CANAIS_PUBLICACAO = ['lembrete', 'api'] as const;
export type CanalPublicacao = (typeof CANAIS_PUBLICACAO)[number];

export interface RascunhoLinkedin {
  id: string;
  titulo: string;
  gancho: string;
  corpo: string;
  direcaoVisual: string;
  textoAlternativo: string;
  roteiroSlides: string;
  topicoId: string | null;
  /** legado: espelha status === 'publicado' */
  publicado: boolean;
  status: StatusRascunho;
  formato: FormatoPost;
  projetoId: string | null;
  ideiaId: string | null;
  /** instante ISO (UTC) */
  agendadoPara: string | null;
  canal: CanalPublicacao;
  tentativas: number;
  ultimoErro: string;
  /** registro em "Publicados" que nasceu deste rascunho */
  linkedinPostId: string | null;
  aprovadoEm: string | null;
  publicadoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
  visibilidade: Visibilidade;
  /** arquivo anexado (só os dados descritivos; os bytes ficam no servidor) */
  midia: MidiaInfo | null;
}

// ===================== Visibilidade e mídia =====================

/** PUBLIC: qualquer pessoa. CONNECTIONS: só as suas conexões (bom para o primeiro teste real). */
export const VISIBILIDADES = ['PUBLIC', 'CONNECTIONS'] as const;
export type Visibilidade = (typeof VISIBILIDADES)[number];
export const ROTULO_VISIBILIDADE: Record<Visibilidade, string> = { PUBLIC: 'Público', CONNECTIONS: 'Só conexões' };

export type TipoMidia = 'imagem' | 'documento';

export interface MidiaInfo {
  tipo: TipoMidia;
  mime: string;
  nome: string;
  /** título que o LinkedIn mostra no documento (PDF) */
  titulo: string;
  tamanho: number;
  sha256: string;
}

/** Tipos aceitos, o formato de post que cada um exige e o limite de tamanho (o proxy aceita até 25 MB). */
export const MIDIA_ACEITA: Record<string, { tipo: TipoMidia; formato: FormatoPost; max: number }> = {
  'image/png': { tipo: 'imagem', formato: 'imagem', max: 8 * 1024 * 1024 },
  'image/jpeg': { tipo: 'imagem', formato: 'imagem', max: 8 * 1024 * 1024 },
  'image/gif': { tipo: 'imagem', formato: 'imagem', max: 8 * 1024 * 1024 },
  'application/pdf': { tipo: 'documento', formato: 'carrossel', max: 20 * 1024 * 1024 },
};

/** Assinatura binária do arquivo: o tipo declarado pelo navegador não basta. */
export function mimeDoConteudo(b: Uint8Array): string | null {
  const ini = (bytes: number[]) => bytes.every((v, i) => b[i] === v);
  if (ini([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ini([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (ini([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (ini([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

/**
 * O que a API do LinkedIn consegue publicar sozinha para este rascunho. `null` = pode;
 * texto = o motivo (a tela mostra e o servidor recusa com a mesma frase).
 */
export function motivoSemApi(formato: FormatoPost, midia: Pick<MidiaInfo, 'tipo' | 'titulo'> | null): string | null {
  if (formato === 'texto') return midia ? 'Post de texto com arquivo anexado: remova o arquivo ou mude o formato para imagem ou carrossel.' : null;
  if (formato === 'imagem') return midia?.tipo === 'imagem' ? null : 'Anexe a imagem (PNG, JPG ou GIF, até 8 MB) antes de publicar pela API.';
  if (formato === 'carrossel') {
    if (midia?.tipo !== 'documento') return 'Anexe o PDF do carrossel (até 20 MB) antes de publicar pela API.';
    return midia.titulo.trim() ? null : 'Dê um título ao documento: o LinkedIn exige para PDF.';
  }
  return `Pela API ainda não sai post de ${formato}. Publique à mão e registre o link.`;
}

export interface VersaoRascunho {
  id: string;
  numero: number;
  gancho: string;
  corpo: string;
  /** manual | ia:gerar | ia:<ação de refino> | restaurar:<n> */
  origem: string;
  criadoEm: string;
}

export const LIMITE_POST = 3_000;

/** Texto como vai para o LinkedIn: gancho, linha em branco, corpo. */
export function textoDoPost(gancho: string, corpo: string): string {
  return `${gancho.trim()}\n\n${corpo.trim()}`.trim();
}

// ===================== Preflight: o que impede aprovar/agendar/publicar =====================

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
/** Prefixo de rede privada com pelo menos três octetos (não confunde com "versão 10.5"). */
const REDE_PRIVADA = /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\b/;
const DOMINIO_INTERNO = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:local|internal|corp|lan|intranet|home\.arpa)\b/i;
const TERMO_SENSIVEL = /\b(?:senha|password|token|secret|credencial|vulner[aá]vel|exposto|exploit)\b/i;
/** Campo deixado pela IA ou pelo modelo para preencher: [CONFIRMAR: x], [situação], [A]... */
const COLCHETE = /\[[^\]\n]{1,200}\]/g;

/** Endereços e domínios que identificam o ambiente. `dominiosExtras`: sufixos próprios (ex.: o domínio do lab). */
export function exposicaoNoTexto(texto: string, dominiosExtras: string[] = []): string[] {
  const achados: string[] = [];
  if (IPV4.test(texto) || REDE_PRIVADA.test(texto)) achados.push('endereço IP ou de rede');
  const lower = texto.toLowerCase();
  const extra = dominiosExtras.map((d) => d.trim().toLowerCase()).filter((d) => d.length > 3);
  if (DOMINIO_INTERNO.test(texto) || extra.some((d) => lower.includes(d))) achados.push('domínio do ambiente');
  return achados;
}

/** Termos que pedem uma segunda leitura (não bloqueiam: um post sobre honeypot fala de "exposto"). */
export function termosSensiveisNoTexto(texto: string): boolean {
  return TERMO_SENSIVEL.test(texto);
}

/** Campos entre colchetes ainda não preenchidos. */
export function pendenciasNoTexto(texto: string): string[] {
  return [...new Set(texto.match(COLCHETE) ?? [])];
}

export interface ItemPreflight {
  id: 'texto' | 'tamanho' | 'pendencias' | 'exposicao' | 'ativos' | 'sensivel';
  ok: boolean;
  /** true: enquanto não estiver ok, não aprova, não agenda e não publica */
  bloqueia: boolean;
  label: string;
  dica: string;
}

/**
 * Verificação antes de liberar um post. `riscosExtras` são achados que só o navegador
 * consegue ver (nomes de ativos do inventário, que vive no navegador).
 */
export function preflightPost(
  post: { gancho: string; corpo: string },
  opcoes: { dominiosExtras?: string[]; riscosExtras?: string[] } = {},
): ItemPreflight[] {
  const texto = textoDoPost(post.gancho, post.corpo);
  const pendencias = pendenciasNoTexto(texto);
  const exposicao = exposicaoNoTexto(texto, opcoes.dominiosExtras);
  const extras = opcoes.riscosExtras ?? [];
  return [
    { id: 'texto', bloqueia: true, ok: post.gancho.trim().length >= 10 && post.corpo.trim().length >= 40,
      label: 'Tem gancho e corpo', dica: 'Escreva a primeira linha e desenvolva a ideia antes de aprovar.' },
    { id: 'tamanho', bloqueia: true, ok: texto.length <= LIMITE_POST,
      label: `Cabe no limite (${texto.length}/${LIMITE_POST})`, dica: 'O LinkedIn corta acima de 3.000 caracteres. Encurte ou divida em dois posts.' },
    { id: 'pendencias', bloqueia: true, ok: pendencias.length === 0,
      label: pendencias.length ? `Campos para preencher (${pendencias.length})` : 'Nenhum campo para preencher',
      dica: `Substitua pelo dado real ou remova: ${pendencias.slice(0, 4).join(' ')}` },
    { id: 'exposicao', bloqueia: true, ok: exposicao.length === 0,
      label: exposicao.length ? `Expõe ${exposicao.join(' e ')}` : 'Sem endereço nem domínio do ambiente',
      dica: 'Conte a lição, não o mapa do ambiente: tire IPs, faixas de rede e domínios internos.' },
    { id: 'ativos', bloqueia: true, ok: extras.length === 0,
      label: extras.length ? `Cita ${extras.join(', ')}` : 'Não cita ativos do inventário',
      dica: 'Troque o nome do equipamento por uma descrição genérica (ex.: "o firewall do lab").' },
    { id: 'sensivel', bloqueia: false, ok: !termosSensiveisNoTexto(texto),
      label: 'Sem termos de segredo ou fragilidade', dica: 'Há palavras como "senha", "token" ou "exposto". Releia: fale do aprendizado, sem revelar uma fraqueza em aberto.' },
  ];
}

export const preflightLiberado = (itens: ItemPreflight[]): boolean => itens.every((i) => i.ok || !i.bloqueia);
export const bloqueiosDoPreflight = (itens: ItemPreflight[]): string[] => itens.filter((i) => !i.ok && i.bloqueia).map((i) => i.label);

// ===================== Agendamento =====================

export const FUSO_PADRAO = 'America/Fortaleza';

/** Data (YYYY-MM-DD) de um instante no fuso informado. */
export function diaLocal(instante: string | Date, fuso: string = FUSO_PADRAO): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Hora (0–23) de um instante no fuso informado. */
export function horaLocal(instante: string | Date, fuso: string = FUSO_PADRAO): number {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: fuso, hour: '2-digit', hourCycle: 'h23' }).format(d));
}

export interface AvaliacaoAgendamento {
  /** impede agendar */
  erro: string | null;
  /** impede agendar, a menos que o pedido venha com `forcar` */
  conflito: string | null;
  avisos: string[];
}

/**
 * Regras de ritmo do agendamento: precisa ser no futuro, um post por dia e, de preferência,
 * em horário em que alguém vai ver. `outros` são os instantes já ocupados (agendados ou publicados).
 */
export function avaliarAgendamento(quando: string, agora: Date, outros: string[], fuso: string = FUSO_PADRAO): AvaliacaoAgendamento {
  const alvo = new Date(quando);
  if (Number.isNaN(alvo.getTime())) return { erro: 'Data e hora inválidas.', conflito: null, avisos: [] };
  if (alvo.getTime() < agora.getTime() + 120_000) return { erro: 'Escolha um horário pelo menos 2 minutos à frente.', conflito: null, avisos: [] };
  if (alvo.getTime() > agora.getTime() + 180 * 86_400_000) return { erro: 'Agende para no máximo 6 meses à frente.', conflito: null, avisos: [] };
  const dia = diaLocal(alvo, fuso);
  const conflito = outros.some((o) => diaLocal(o, fuso) === dia)
    ? `Já existe um post para ${dia.split('-').reverse().join('/')}. Mais de um por dia divide a atenção de quem acompanha.`
    : null;
  const hora = horaLocal(alvo, fuso);
  const avisos = hora < 6 || hora >= 22 ? ['Horário fora de 6h–22h: pouca gente vê na primeira hora, que é quando o post ganha alcance.'] : [];
  return { erro: null, conflito, avisos };
}

export const MidiaTituloInSchema = z.object({ titulo: z.string().trim().max(200) });

export const AgendarInSchema = z.object({
  /** instante ISO com fuso (ex.: 2026-11-20T12:00:00.000Z) */
  quando: z.string().datetime({ offset: true }),
  canal: z.enum(CANAIS_PUBLICACAO),
  /** aceita mais de um post no mesmo dia */
  forcar: z.boolean().optional(),
});

export const RegistrarPublicacaoInSchema = z.object({
  url: z.string().trim().max(500),
  publicadoEm: DataISO,
});

// ===================== Refino com IA =====================

export const ACOES_REFINO = ['encurtar', 'concreto', 'ganchos', 'direto', 'carrossel', 'livre'] as const;
export type AcaoRefino = (typeof ACOES_REFINO)[number];

export const ROTULO_REFINO: Record<AcaoRefino, string> = {
  encurtar: 'Encurtar',
  concreto: 'Mais concreto',
  ganchos: '3 ganchos alternativos',
  direto: 'Tom mais direto',
  carrossel: 'Virar roteiro de carrossel',
  livre: 'Pedido livre',
};

export const RefinarInSchema = z.object({
  acao: z.enum(ACOES_REFINO),
  /** obrigatório quando a ação é `livre` */
  instrucao: z.string().trim().max(1_000).optional(),
  gancho: z.string().max(2_000),
  corpo: z.string().max(50_000),
});

/** Resposta da IA ao refinar. Em `ganchos`, o texto volta igual e as opções vêm em `alternativasGancho`. */
export const RefinoIASchema = z.object({
  gancho: z.string(),
  corpo: z.string(),
  oQueMudou: z.string(),
  alternativasGancho: z.array(z.string()),
  roteiroSlides: z.array(z.string()),
});
export type RefinoIA = z.infer<typeof RefinoIASchema>;

// ===================== Planejador da semana =====================

export const SugestaoPautaSchema = z.object({
  titulo: z.string(),
  briefing: z.string(),
  pilar: z.string(),
  /** id de um projeto existente, ou string vazia */
  projetoId: z.string(),
  formato: z.enum(FORMATOS_POST),
  /** YYYY-MM-DD */
  dia: z.string(),
  porque: z.string(),
});
export const PautaIASchema = z.object({ sugestoes: z.array(SugestaoPautaSchema) });
export type SugestaoPauta = z.infer<typeof SugestaoPautaSchema>;

// ===================== Tarefas de IA em segundo plano =====================

/** Geração, refino e planejamento rodam fora da requisição HTTP; a tela consulta o resultado. */
export interface TarefaIA<T = unknown> {
  id: string;
  status: 'rodando' | 'pronta' | 'erro';
  resultado: T | null;
  erro: string | null;
}

// ===================== Conta do LinkedIn =====================

export interface StatusContaLinkedin {
  /** variáveis do app do LinkedIn presentes no servidor */
  configurado: boolean;
  /** nomes (não valores) das variáveis que faltam */
  faltando: string[];
  conectado: boolean;
  nome: string | null;
  expiraEm: string | null;
  diasRestantes: number | null;
  ultimoErro: string | null;
}
