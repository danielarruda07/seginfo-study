import { z } from 'zod';

/** Estado de estudo de um tópico. */
export const StatusEstudo = z.enum(['a_estudar', 'estudando', 'concluido']);
export type StatusEstudo = z.infer<typeof StatusEstudo>;

/** Nível de profundidade/dificuldade do tópico. */
export const Nivel = z.enum(['basico', 'intermediario', 'avancado']);
export type Nivel = z.infer<typeof Nivel>;

/** Selo de referência de mercado. */
export const Referencia = z.enum(['gartner_leader', 'owasp', 'nist', 'open_source', 'mercado']);
export type Referencia = z.infer<typeof Referencia>;

/** Recurso externo de estudo (curso, doc, vídeo). */
export const RecursoSchema = z.object({
  titulo: z.string(),
  url: z.string().url(),
  tipo: z.enum(['doc', 'video', 'curso', 'lab', 'artigo']),
});
export type Recurso = z.infer<typeof RecursoSchema>;

/** Ferramenta de referência dentro de um tópico. */
export const FerramentaSchema = z.object({
  nome: z.string(),
  descricao: z.string(),
  referencia: Referencia,
  url: z.string().url().optional(),
});
export type Ferramenta = z.infer<typeof FerramentaSchema>;

/** Tópico de estudo dentro de uma trilha. */
export const TopicoSchema = z.object({
  id: z.string(),
  trilhaId: z.string(),
  titulo: z.string(),
  nivel: Nivel,
  resumo: z.string(),
  conceitosChave: z.array(z.string()),
  ferramentas: z.array(FerramentaSchema),
  recursos: z.array(RecursoSchema),
  tags: z.array(z.string()).default([]),
  /** Técnicas MITRE ATT&CK cobertas pelo tópico (ex.: T1110). */
  mitre: z.array(z.string()).optional(),
});
export type Topico = z.infer<typeof TopicoSchema>;

/** Trilha de estudo (ex: Blue Team, Red Team, SIEM). */
export const TrilhaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  icone: z.string(),
  ordem: z.number(),
});
export type Trilha = z.infer<typeof TrilhaSchema>;

/** Progresso do usuário em um tópico (persistido localmente). */
export const ProgressoSchema = z.object({
  topicoId: z.string(),
  status: StatusEstudo,
  anotacoes: z.string().default(''),
  atualizadoEm: z.string(),
});
export type Progresso = z.infer<typeof ProgressoSchema>;

/** Sessão de estudo registrada pelo usuário. */
export const SessaoEstudoSchema = z.object({
  id: z.string(),
  data: z.string(),
  trilhaId: z.string().optional(),
  topicoId: z.string().optional(),
  labId: z.string().optional(),
  minutos: z.number().int().positive(),
  nota: z.string().default(''),
});
export type SessaoEstudo = z.infer<typeof SessaoEstudoSchema>;

/** Meta com prazo. */
export const MetaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  trilhaId: z.string().optional(),
  prazo: z.string(),
  concluida: z.boolean().default(false),
});
export type Meta = z.infer<typeof MetaSchema>;

/** Rascunho de post de LinkedIn ligado a um tópico/trilha. */
export const PostIdeaSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  gancho: z.string(),
  corpo: z.string(),
  topicoId: z.string().optional(),
  publicado: z.boolean().default(false),
});
export type PostIdea = z.infer<typeof PostIdeaSchema>;

// ===================== INVENTÁRIO DE AMBIENTE =====================

/** Ambiente ao qual um ativo pertence (só o homelab CRIECOMIA). */
export const Ambiente = z.enum(['criecomia']);
export type Ambiente = z.infer<typeof Ambiente>;

/** Categoria de ativo de infraestrutura. */
export const TipoAtivo = z.enum([
  'host', 'vm', 'container', 'vlan', 'firewall_policy', 'storage', 'servico', 'rede', 'switch', 'rota',
]);
export type TipoAtivo = z.infer<typeof TipoAtivo>;

/** Estado operacional do ativo. */
export const EstadoAtivo = z.enum(['ativo', 'atencao', 'critico', 'planejado', 'desativado']);
export type EstadoAtivo = z.infer<typeof EstadoAtivo>;

/** Ativo do inventário (host, VM, VLAN, policy, etc.). */
export const AtivoSchema = z.object({
  id: z.string(),
  ambiente: Ambiente,
  tipo: TipoAtivo,
  nome: z.string(),
  endereco: z.string().default(''),
  funcao: z.string().default(''),
  estado: EstadoAtivo.default('ativo'),
  detalhes: z.record(z.string(), z.string()).default({}),
  tags: z.array(z.string()).default([]),
  /** ids de labs que usam este ativo. */
  labsRelacionados: z.array(z.string()).default([]),
});
export type Ativo = z.infer<typeof AtivoSchema>;

/** Lab prático amarrado a ativos reais do ambiente. */
export const LabSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  objetivo: z.string(),
  dominio: z.enum(['blue', 'red', 'infra', 'purple']),
  nivel: z.enum(['basico', 'intermediario', 'avancado']),
  ativosAlvo: z.array(z.string()).default([]),
  passos: z.array(z.string()),
  resultadoEsperado: z.string(),
  topicoId: z.string().optional(),
  /** Técnicas MITRE ATT&CK praticadas ou detectadas no lab. */
  mitre: z.array(z.string()).optional(),
});
export type Lab = z.infer<typeof LabSchema>;

// ===================== RANGE VULNERÁVEL (cyber range controlado) =====================

/**
 * Alvo do range: uma VM, serviço ou segmento propositalmente exposto/vulnerável,
 * usado só dentro do segmento isolado do range (nunca em produção ou na internet).
 */
export const RangeAlvoSchema = z.object({
  id: z.string(),
  nome: z.string(),
  dominio: z.enum(['blue', 'red', 'infra', 'purple']),
  categoria: z.enum(['vm_vitima', 'vm_atacante', 'servico_exposto', 'rede', 'ferramenta_analise']),
  descricao: z.string(),
  /** Portas/serviços deliberadamente abertos neste alvo, ex.: ["3389/tcp RDP", "22/tcp SSH"]. */
  portas: z.array(z.string()).default([]),
  /** Ferramentas/agentes instalados (Sysmon, Wazuh, Sliver, REMnux etc.). */
  ferramentas: z.array(z.string()).default([]),
  vlan: z.string().optional(),
  mitre: z.array(z.string()).optional(),
  labId: z.string().optional(),
});
export type RangeAlvo = z.infer<typeof RangeAlvoSchema>;

/** Item do checklist operacional para montar/manter o range (uma atividade a executar e marcar). */
export const RangeChecklistItemSchema = z.object({
  id: z.string(),
  grupo: z.enum(['rede', 'vms', 'firewall', 'monitoramento', 'seguranca_operacional', 'exercicio']),
  titulo: z.string(),
  descricao: z.string(),
  /** Passos práticos e verificáveis (ex.: comando CLI do FortiGate, campo da VM no Proxmox). */
  passos: z.array(z.string()),
  dominio: z.enum(['blue', 'red', 'infra', 'purple']),
  criticidade: z.enum(['alta', 'media', 'baixa']).default('media'),
  referencia: z.string().optional(),
});
export type RangeChecklistItem = z.infer<typeof RangeChecklistItemSchema>;

/** Progresso local de um item de checklist do range. */
export const RangeProgressoItemSchema = z.object({
  concluido: z.boolean(),
  concluidoEm: z.string().optional(),
  notas: z.string().default(''),
});
export type RangeProgressoItem = z.infer<typeof RangeProgressoItemSchema>;

// ===================== COFRE (VAULT) =====================

/** Entrada de credencial — o campo `secret` SÓ existe decifrado em memória. */
export const VaultEntrySchema = z.object({
  id: z.string(),
  titulo: z.string(),
  usuario: z.string().default(''),
  url: z.string().default(''),
  ambiente: Ambiente.optional(),
  ativoId: z.string().optional(),
  notas: z.string().default(''),
  atualizadoEm: z.string(),
});
export type VaultEntry = z.infer<typeof VaultEntrySchema>;

/** Blob cifrado persistido em disco (AES-GCM). Nada legível sem a senha-mestra. */
export const VaultBlobSchema = z.object({
  versao: z.literal(1),
  salt: z.string(),       // base64 — para PBKDF2
  iv: z.string(),         // base64 — nonce do AES-GCM
  ciphertext: z.string(), // base64 — payload cifrado
});
export type VaultBlob = z.infer<typeof VaultBlobSchema>;

// ===================== ARSENAL DE IA (prompts / skills / agentes) =====================

/** Tipo de ativo de IA guardado no arsenal. */
export const TipoArsenal = z.enum(['prompt', 'skill', 'agente']);
export type TipoArsenal = z.infer<typeof TipoArsenal>;

/** Domínio de segurança ao qual o ativo de IA se aplica. */
export const DominioArsenal = z.enum(['red', 'blue', 'purple', 'appsec', 'osint', 'grc', 'geral']);
export type DominioArsenal = z.infer<typeof DominioArsenal>;

/** Artefato gerado por um item do arsenal (ex: o relatório de pentest em HTML). */
export const ArtefatoSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  tipo: z.enum(['relatorio', 'nota', 'saida', 'outro']),
  formato: z.enum(['html', 'md', 'txt', 'json']).default('md'),
  conteudo: z.string(),
  criadoEm: z.string(),
});
export type Artefato = z.infer<typeof ArtefatoSchema>;

/**
 * Item do arsenal: um prompt, uma skill ou um agente de segurança reutilizável.
 * É o "segundo cérebro" de automações de IA do Daniel.
 */
export const ArsenalItemSchema = z.object({
  id: z.string(),
  tipo: TipoArsenal,
  nome: z.string(),
  slug: z.string().default(''),
  dominio: DominioArsenal.default('geral'),
  resumo: z.string().default(''),
  /** o conteúdo em si: texto do prompt, definição da skill, instruções do agente. */
  conteudo: z.string().default(''),
  /** quando/como usar — contexto de aplicação. */
  quandoUsar: z.string().default(''),
  /** ferramentas/pré-requisitos que o item espera (ex: Docker, nmap, ldapts). */
  requisitos: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  /** ids de artefatos produzidos por este item (ex: relatórios). */
  artefatos: z.array(ArtefatoSchema).default([]),
  favorito: z.boolean().default(false),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type ArsenalItem = z.infer<typeof ArsenalItemSchema>;

// ===================== BIBLIOTECA DE CONHECIMENTO (read-it-later) =====================

/** Estado de leitura de um item salvo. */
export const EstadoLeitura = z.enum(['para_ler', 'lendo', 'lido']);
export type EstadoLeitura = z.infer<typeof EstadoLeitura>;

/**
 * Item da biblioteca: uma URL salva com resumo e organização por assunto.
 * O resumo/keywords/categoria são preenchidos pelo processamento local (extrativo)
 * e podem ser ajustados pelo usuário. Futuro: enriquecido por IA via apps/api.
 */
export const BiblioItemSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  titulo: z.string().default(''),
  dominio: z.string().default(''),
  /** texto original colado pelo usuário (opcional) — base do resumo extrativo. */
  textoOriginal: z.string().default(''),
  resumo: z.string().default(''),
  palavrasChave: z.array(z.string()).default([]),
  /** categoria de assunto (ex: red, blue, siem, osint, appsec...). */
  categoria: z.string().default('geral'),
  tags: z.array(z.string()).default([]),
  estado: EstadoLeitura.default('para_ler'),
  favorito: z.boolean().default(false),
  anotacoes: z.string().default(''),
  /** vínculo opcional com um tópico de estudo. */
  topicoId: z.string().optional(),
  /** origem do resumo: 'local' (extrativo) ou 'ia' (futuro). */
  fonteResumo: z.enum(['local', 'ia']).default('local'),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type BiblioItem = z.infer<typeof BiblioItemSchema>;

// ===================== RADAR DE ATAQUES (auto-vulnerabilidade / honeypot) =====================

/** Origem do evento: de onde o coletor leu. */
export const AtaqueFonte = z.enum(['fortigate', 'windows', 'cowrie', 'opencanary', 'outro']);
export type AtaqueFonte = z.infer<typeof AtaqueFonte>;

/** O que o atacante fez. */
export const AtaqueAcao = z.enum([
  'login_falha', 'login_ok', 'lockout', 'scan', 'bloqueio', 'conexao', 'comando', 'outro',
]);
export type AtaqueAcao = z.infer<typeof AtaqueAcao>;

const IpSchema = z.union([z.ipv4(), z.ipv6()]);

/**
 * Evento enviado pelo coletor. NÃO existe campo de senha: por desenho, a plataforma
 * nunca armazena senhas tentadas (em honeypot elas podem ser credenciais reais vazadas).
 */
export const AtaqueEventoInSchema = z.object({
  fonte: AtaqueFonte,
  ocorridoEm: z.string().datetime({ offset: true }),
  /** Obrigatório, exceto em `lockout` (o evento 4740 do Windows não traz IP de origem). */
  ipOrigem: IpSchema.optional(),
  paisOrigem: z.string().length(2).optional(),
  portaDestino: z.number().int().min(0).max(65535).optional(),
  protocolo: z.string().max(16).optional(),
  servico: z.string().max(32).optional(),
  acao: AtaqueAcao,
  usuarioTentado: z.string().max(128).optional(),
  /**
   * Senha tentada. SÓ de honeypots (cowrie/opencanary) e SÓ se o servidor tiver
   * RADAR_GUARDAR_SENHAS=true; caso contrário a API descarta o campo sem armazenar.
   */
  senhaTentada: z.string().max(128).optional(),
  alvo: z.string().max(128).optional(),
  detalhes: z
    .record(z.string(), z.unknown())
    .refine((d) => JSON.stringify(d).length <= 4096, { message: 'detalhes excede 4KB' })
    .optional(),
}).refine((e) => e.acao === 'lockout' || e.ipOrigem !== undefined, {
  message: 'ipOrigem é obrigatório (exceto em lockout)',
  path: ['ipOrigem'],
});
export type AtaqueEventoIn = z.infer<typeof AtaqueEventoInSchema>;

/** Lote de eventos (limite de 500 por requisição). */
export const IngestBatchSchema = z.object({
  eventos: z.array(AtaqueEventoInSchema).min(1).max(500),
});
export type IngestBatch = z.infer<typeof IngestBatchSchema>;

// ===================== DIÁRIO DO PROJETO =====================
export * from './diarioProjeto';
export * from './linkedin';
export * from './agentes';
