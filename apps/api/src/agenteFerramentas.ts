import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { AgenteConfig } from '@seginfo/shared';
import { buscarNaBase } from './memorias.js';
import { proxmoxAlterar, proxmoxFaltando, proxmoxGet } from './proxmox.js';

/**
 * Ferramentas que o servidor sabe executar para os agentes.
 *
 * Cada entrada liga um id do catálogo (apps/web/src/data/agentesFerramentas.ts) a uma ou mais
 * funções estreitas. O modelo só enxerga nome, descrição e esquema; credenciais e endereços
 * ficam aqui, no servidor. Para criar uma ferramenta nova, acrescente um `definir({...})`.
 */

export interface Contexto {
  usuarioId: string;
  config: AgenteConfig;
}

export interface FerramentaReal {
  /** id no catálogo; vários nomes podem compartilhar o mesmo id */
  id: string;
  /** nome que o modelo enxerga */
  nome: string;
  permissao: 'leitura' | 'escrita';
  /** é por este texto que o modelo decide quando chamar a ferramenta */
  descricao: string;
  esquema: Anthropic.Beta.BetaTool['input_schema'];
  /** variáveis de ambiente que ainda faltam para a ferramenta funcionar (nomes, não valores) */
  faltando?: () => string[];
  /**
   * Valida a entrada e devolve, em uma frase, o que a ferramenta vai fazer. É o texto da tela de
   * aprovação: vem dos parâmetros validados, não de algo que o modelo escreveu. Lança se a entrada for inválida.
   */
  resumir(entrada: unknown): string;
  rodar(ctx: Contexto, entrada: unknown): Promise<string>;
}

function definir<T extends z.ZodType>(f: Omit<FerramentaReal, 'rodar' | 'resumir'> & {
  entrada: T;
  /** nas ferramentas de escrita: a frase mostrada na tela de aprovação */
  resumo?: (entrada: z.infer<T>) => string;
  executar(ctx: Contexto, entrada: z.infer<T>): Promise<string>;
}): FerramentaReal {
  const { entrada, executar, resumo, ...resto } = f;
  // A entrada vem do modelo: é validada como qualquer dado externo antes de executar.
  const validar = (bruto: unknown): z.infer<T> => {
    const p = entrada.safeParse(bruto);
    if (!p.success) throw new Error('Entrada inválida: ' + p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    return p.data;
  };
  return {
    ...resto,
    resumir: (bruto) => {
      const e = validar(bruto);
      return resumo ? resumo(e) : resto.nome;
    },
    rodar: async (ctx, bruto) => executar(ctx, validar(bruto)),
  };
}

const semParametros = { type: 'object', properties: {}, additionalProperties: false } as const;

// ---------- Proxmox (leitura) ----------

// Os valores abaixo entram no caminho da URL: o formato é restrito para não permitir outro caminho.
const NomeDoNo = z.string().regex(/^[a-zA-Z0-9-]{1,63}$/, 'nome de nó inválido');
const Vm = z.object({
  no: NomeDoNo,
  tipo: z.enum(['qemu', 'lxc']),
  vmid: z.number().int().min(100).max(999_999_999),
});
const esquemaVm = {
  type: 'object',
  properties: {
    no: { type: 'string', description: 'Nome do nó do Proxmox onde a VM está (campo "no" de proxmox_listar_vms).' },
    tipo: { type: 'string', enum: ['qemu', 'lxc'], description: 'qemu para máquina virtual, lxc para container.' },
    vmid: { type: 'integer', description: 'ID numérico da VM ou do container.' },
  },
  required: ['no', 'tipo', 'vmid'],
  additionalProperties: false,
} as const;

const gb = (bytes: unknown) => (typeof bytes === 'number' ? Math.round((bytes / 1024 ** 3) * 10) / 10 : null);
const lista = (dados: unknown) => (Array.isArray(dados) ? (dados as Record<string, unknown>[]) : []);
const proxmox = { id: 'proxmox-leitura', permissao: 'leitura', faltando: proxmoxFaltando } as const;

const PROXMOX: FerramentaReal[] = [
  definir({
    ...proxmox,
    nome: 'proxmox_listar_nos',
    descricao: 'Lista os nós (hosts) do Proxmox com estado, CPU, memória e tempo ligado. Use para saber quais hosts existem e como estão.',
    esquema: semParametros,
    entrada: z.object({}),
    async executar() {
      const nos = lista(await proxmoxGet('/nodes'));
      return JSON.stringify(nos.map((n) => ({
        no: n.node, estado: n.status, cpus: n.maxcpu, usoCpu: typeof n.cpu === 'number' ? Math.round(n.cpu * 100) + '%' : null,
        memoriaGb: gb(n.maxmem), memoriaUsadaGb: gb(n.mem), ligadoHaSegundos: n.uptime,
      })));
    },
  }),
  definir({
    ...proxmox,
    nome: 'proxmox_listar_vms',
    descricao:
      'Lista todas as máquinas virtuais e containers do Proxmox, de todos os nós, com vmid, nome, nó, tipo, estado e recursos. ' +
      'Use primeiro, para descobrir o nó, o tipo e o vmid antes de pedir detalhes ou snapshots de uma VM.',
    esquema: semParametros,
    entrada: z.object({}),
    async executar() {
      const vms = lista(await proxmoxGet('/cluster/resources?type=vm'));
      return JSON.stringify(vms.map((v) => ({
        vmid: v.vmid, nome: v.name, no: v.node, tipo: v.type, estado: v.status, modelo: v.template === 1,
        cpus: v.maxcpu, memoriaGb: gb(v.maxmem), discoGb: gb(v.maxdisk), ligadaHaSegundos: v.uptime,
      })));
    },
  }),
  definir({
    ...proxmox,
    nome: 'proxmox_detalhar_vm',
    descricao:
      'Mostra a configuração completa de uma VM ou container (CPU, memória, discos, placas de rede com bridge e VLAN, ordem de boot) e o estado atual. ' +
      'Precisa do nó, do tipo e do vmid, que vêm de proxmox_listar_vms.',
    esquema: esquemaVm,
    entrada: Vm,
    async executar(_ctx, { no, tipo, vmid }) {
      const [config, atual] = await Promise.all([
        proxmoxGet(`/nodes/${no}/${tipo}/${vmid}/config`),
        proxmoxGet(`/nodes/${no}/${tipo}/${vmid}/status/current`),
      ]);
      const a = (atual ?? {}) as Record<string, unknown>;
      return JSON.stringify({
        configuracao: config,
        estado: { status: a.status, ligadaHaSegundos: a.uptime, usoCpu: a.cpu, memoriaUsadaGb: gb(a.mem), agenteConvidado: a.agent },
      });
    },
  }),
  definir({
    ...proxmox,
    nome: 'proxmox_listar_snapshots',
    descricao: 'Lista os snapshots de uma VM ou container, com nome, descrição, data e snapshot pai. Precisa do nó, do tipo e do vmid.',
    esquema: esquemaVm,
    entrada: Vm,
    async executar(_ctx, { no, tipo, vmid }) {
      const snaps = lista(await proxmoxGet(`/nodes/${no}/${tipo}/${vmid}/snapshot`));
      return JSON.stringify(snaps.filter((s) => s.name !== 'current').map((s) => ({
        nome: s.name, descricao: s.description, pai: s.parent, incluiMemoria: s.vmstate === 1,
        criadoEm: typeof s.snaptime === 'number' ? new Date(s.snaptime * 1000).toISOString() : null,
      })));
    },
  }),
  definir({
    ...proxmox,
    nome: 'proxmox_listar_armazenamento',
    descricao: 'Lista os armazenamentos (storages) do Proxmox por nó, com tipo, estado, espaço total e usado. Use para checar espaço livre.',
    esquema: semParametros,
    entrada: z.object({}),
    async executar() {
      const st = lista(await proxmoxGet('/cluster/resources?type=storage'));
      return JSON.stringify(st.map((s) => ({
        armazenamento: s.storage, no: s.node, tipo: s.plugintype, estado: s.status, conteudo: s.content,
        totalGb: gb(s.maxdisk), usadoGb: gb(s.disk),
      })));
    },
  }),
];

// ---------- Proxmox (escrita) ----------
// Nenhuma destas roda sem aprovação: o runtime pausa a execução e mostra o resumo na tela.

const proxmoxEscrita = { id: 'proxmox-escrita', permissao: 'escrita', faltando: proxmoxFaltando } as const;
const alvo = (v: z.infer<typeof Vm>) => `${v.tipo === 'qemu' ? 'VM' : 'container'} ${v.vmid} no nó ${v.no}`;
const NomeSnapshot = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{1,39}$/, 'use letras, números, "_" e "-", começando por letra (2 a 40 caracteres)');
const VmComSnapshot = Vm.extend({ nome: NomeSnapshot });
const esquemaSnapshot = {
  type: 'object',
  properties: { ...esquemaVm.properties, nome: { type: 'string', description: 'Nome do snapshot: letras, números, "_" e "-", começando por letra.' } },
  required: ['no', 'tipo', 'vmid', 'nome'],
  additionalProperties: false,
} as const;
const AVISO = 'Altera o ambiente: o usuário precisa aprovar na tela antes de executar.';

const PROXMOX_ESCRITA: FerramentaReal[] = [
  definir({
    ...proxmoxEscrita,
    nome: 'proxmox_ligar_vm',
    descricao: `Liga uma VM ou container que está parado. ${AVISO}`,
    esquema: esquemaVm,
    entrada: Vm,
    resumo: (v) => `Ligar: ${alvo(v)}`,
    executar: (_ctx, v) => proxmoxAlterar('POST', v.no, `/nodes/${v.no}/${v.tipo}/${v.vmid}/status/start`),
  }),
  definir({
    ...proxmoxEscrita,
    nome: 'proxmox_desligar_vm',
    descricao:
      'Desliga uma VM ou container. Por padrão pede o desligamento ao sistema operacional (limpo). Com forcar=true corta a energia na hora, ' +
      `o que pode corromper dados: use só se o desligamento limpo falhar. ${AVISO}`,
    esquema: {
      type: 'object',
      properties: { ...esquemaVm.properties, forcar: { type: 'boolean', description: 'true corta a energia sem avisar o sistema operacional.' } },
      required: ['no', 'tipo', 'vmid'],
      additionalProperties: false,
    },
    entrada: Vm.extend({ forcar: z.boolean().optional() }),
    resumo: (v) => (v.forcar ? `Desligar À FORÇA (corte de energia): ${alvo(v)}` : `Desligar (desligamento limpo pelo sistema operacional): ${alvo(v)}`),
    executar: (_ctx, v) => proxmoxAlterar('POST', v.no, `/nodes/${v.no}/${v.tipo}/${v.vmid}/status/${v.forcar ? 'stop' : 'shutdown'}`),
  }),
  definir({
    ...proxmoxEscrita,
    nome: 'proxmox_reiniciar_vm',
    descricao: `Reinicia uma VM ou container pelo sistema operacional. ${AVISO}`,
    esquema: esquemaVm,
    entrada: Vm,
    resumo: (v) => `Reiniciar: ${alvo(v)}`,
    executar: (_ctx, v) => proxmoxAlterar('POST', v.no, `/nodes/${v.no}/${v.tipo}/${v.vmid}/status/reboot`),
  }),
  definir({
    ...proxmoxEscrita,
    nome: 'proxmox_criar_snapshot',
    descricao:
      'Cria um snapshot de uma VM ou container: um ponto de retorno antes de uma mudança. Com incluirMemoria=true guarda também a memória ' +
      `(só VM, mais lento e ocupa mais espaço). ${AVISO}`,
    esquema: {
      type: 'object',
      properties: {
        ...esquemaSnapshot.properties,
        descricao: { type: 'string', description: 'Para que serve este snapshot.' },
        incluirMemoria: { type: 'boolean', description: 'true guarda também o estado da memória (só para tipo qemu).' },
      },
      required: ['no', 'tipo', 'vmid', 'nome'],
      additionalProperties: false,
    },
    entrada: VmComSnapshot.extend({ descricao: z.string().max(200).optional(), incluirMemoria: z.boolean().optional() }),
    resumo: (v) => `Criar o snapshot "${v.nome}"${v.incluirMemoria ? ' (com a memória)' : ''}: ${alvo(v)}`,
    executar: (_ctx, v) => proxmoxAlterar('POST', v.no, `/nodes/${v.no}/${v.tipo}/${v.vmid}/snapshot`, {
      snapname: v.nome,
      ...(v.descricao ? { description: v.descricao } : {}),
      ...(v.incluirMemoria && v.tipo === 'qemu' ? { vmstate: 1 } : {}),
    }),
  }),
  definir({
    ...proxmoxEscrita,
    nome: 'proxmox_reverter_snapshot',
    descricao:
      'Volta uma VM ou container ao estado de um snapshot. Tudo o que mudou depois do snapshot é PERDIDO. ' +
      `Confira o nome com proxmox_listar_snapshots antes. ${AVISO}`,
    esquema: esquemaSnapshot,
    entrada: VmComSnapshot,
    resumo: (v) => `Reverter para o snapshot "${v.nome}" (o que mudou depois dele será perdido): ${alvo(v)}`,
    executar: (_ctx, v) => proxmoxAlterar('POST', v.no, `/nodes/${v.no}/${v.tipo}/${v.vmid}/snapshot/${v.nome}/rollback`),
  }),
  definir({
    ...proxmoxEscrita,
    nome: 'proxmox_remover_snapshot',
    descricao: `Apaga um snapshot de uma VM ou container. Não dá para desfazer. ${AVISO}`,
    esquema: esquemaSnapshot,
    entrada: VmComSnapshot,
    resumo: (v) => `Apagar o snapshot "${v.nome}" (não dá para desfazer): ${alvo(v)}`,
    executar: (_ctx, v) => proxmoxAlterar('DELETE', v.no, `/nodes/${v.no}/${v.tipo}/${v.vmid}/snapshot/${v.nome}`),
  }),
];

// ---------- registro ----------

export const REGISTRO: FerramentaReal[] = [
  definir({
    id: 'busca-base',
    nome: 'buscar_base',
    permissao: 'leitura',
    descricao:
      'Busca trechos nas notas pessoais do usuário (Segundo Cérebro), restrita às tags ligadas a este agente. ' +
      'Use antes de responder qualquer pergunta que dependa do que o usuário anotou. Devolve título, tags e trecho de cada nota encontrada.',
    esquema: {
      type: 'object',
      properties: { consulta: { type: 'string', description: 'Palavras-chave da busca, em português.' } },
      required: ['consulta'],
      additionalProperties: false,
    },
    entrada: z.object({ consulta: z.string().trim().min(1).max(200) }),
    async executar(ctx, { consulta }) {
      const tags = ctx.config.conhecimento.tags;
      if (tags.length === 0) return 'A base deste agente está vazia: nenhuma tag foi ligada a ele.';
      const achados = await buscarNaBase(ctx.usuarioId, consulta, tags);
      if (achados.length === 0) return 'Nenhuma nota encontrada para esta consulta.';
      return JSON.stringify(achados.map((a) => ({ titulo: a.titulo, tags: a.tags, trecho: a.trecho })));
    },
  }),
  ...PROXMOX,
  ...PROXMOX_ESCRITA,
];

/** Ferramentas reais ligadas a um id do catálogo. */
export const ferramentasDoId = (id: string): FerramentaReal[] => REGISTRO.filter((f) => f.id === id);
