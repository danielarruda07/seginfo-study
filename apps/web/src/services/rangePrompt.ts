import type { RangeChecklistItem } from '@seginfo/shared';
import { LAB_VARS, TIPO_RECURSO_LABEL } from '@/data/rangeLab';

/** Valores das variáveis do lab, por chave. */
export type LabVars = Record<string, string>;

const VAR_RE = /\{\{([A-Z0-9_]+)\}\}/g;
const DEFS = new Map(LAB_VARS.map((v) => [v.chave, v]));

/** Valor efetivo de uma variável: o que o usuário preencheu ou o padrão de planejamento. */
export function valorVar(chave: string, vars: LabVars): string {
  return (vars[chave] ?? '').trim() || DEFS.get(chave)?.padrao || '';
}

/** Troca {{CHAVE}} pelo valor; o que não foi preenchido vira um marcador visível. */
export function preencher(texto: string, vars: LabVars): string {
  return texto.replace(VAR_RE, (_, chave: string) => {
    const valor = valorVar(chave, vars);
    return valor || `[PREENCHER: ${DEFS.get(chave)?.rotulo ?? chave}]`;
  });
}

/** Chaves usadas num texto que ainda não têm valor. */
export function variaveisFaltando(texto: string, vars: LabVars): string[] {
  const faltando = new Set<string>();
  for (const m of texto.matchAll(VAR_RE)) {
    if (!valorVar(m[1]!, vars)) faltando.add(m[1]!);
  }
  return [...faltando];
}

const AMBIENTE = [
  '- Firewall: {{FGT_MODELO}}, FortiOS {{FGT_FORTIOS}}. Interface ligada ao switch (trunk): {{FGT_IF_TRUNK}}. Interface WAN: {{FGT_IF_WAN}}.',
  '- Switch: {{SW_MODELO}}, IOS {{SW_IOS}}. Porta para o FortiGate: {{SW_PORTA_FGT}}. Porta para o Proxmox: {{SW_PORTA_PVE}}. Porta de destino do SPAN: {{SW_PORTA_SENSOR}}.',
  '- Virtualização: Proxmox VE {{PVE_VERSAO}}, nó {{PVE_NO}}, bridge VLAN-aware {{PVE_BRIDGE}}, storage das VMs {{PVE_STORAGE}}, placa física do SPAN {{PVE_NIC_SENSOR}}.',
  '- Segmento do range: VLAN {{RANGE_VLAN}}, rede {{RANGE_REDE}}, gateway {{RANGE_GW}} (no FortiGate). VLAN do atacante, se separada: {{KALI_VLAN}}. VLAN de quarentena: {{VLAN_QUARENTENA}}.',
  '- Redes que o range NUNCA pode alcançar: {{VLANS_PROTEGIDAS}}.',
  '- Endereços planejados: Kali {{IP_KALI}}; Windows vítima {{IP_WIN}}; Linux vítima {{IP_LINUX}}; Metasploitable {{IP_META}}; DVWA/Juice Shop {{IP_WEB}}; Vulhub {{IP_VULHUB}}.',
  '- SIEM: Wazuh {{WAZUH_VERSAO}}, manager em {{WAZUH_MANAGER}}.',
  '- Convenção de nomes: prefixo "{{PREFIXO}}-" em objetos e policies do FortiGate; VMs com prefixo "range-".',
].join('\n');

const REGRAS = [
  '- O range nunca tem rota para produção/gerência e nunca tem saída direta para a internet por padrão.',
  '- Qualquer exceção é mínima (IP e porta específicos), registrada em log e documentada.',
  '- Só credenciais exclusivas do range; nenhuma conta pessoal ou corporativa.',
  '- Toda VM tem snapshot "limpo"; todo exercício termina com rollback.',
  '- A VM Kali é o único atacante. Tudo acontece somente dentro deste homelab, que é meu.',
].join('\n');

const FORMATO = [
  '1. Pré-requisitos: o que conferir no estado atual antes de mexer (comandos de leitura).',
  '2. Execução: comandos EXATOS, um bloco por equipamento, na ordem certa (CLI do FortiOS, Cisco IOS, qm/pvesh do Proxmox, bash/PowerShell). Use os nomes da lista de recursos.',
  '3. Caminho equivalente pela interface gráfica, quando existir.',
  '4. Validação: cada teste com o comando e o resultado esperado.',
  '5. Rollback: como desfazer cada alteração.',
  '6. Pegadinhas desta etapa no meu ambiente.',
  '7. Um resumo curto, sem senhas, para eu colar nas notas do checklist.',
].join('\n');

export interface OpcoesPrompt {
  /** Pedidos rápidos marcados pelo usuário. */
  pedidos?: string[];
  /** Pedido livre digitado pelo usuário. */
  pedidoLivre?: string;
}

/** Monta o prompt completo de uma etapa: espinha dorsal fixa + parte específica + pedidos. */
export function montarPrompt(item: RangeChecklistItem, vars: LabVars, opcoes: OpcoesPrompt = {}): string {
  const recursos = (item.recursos ?? []).map(
    (r) => `- [${TIPO_RECURSO_LABEL[r.tipo]}] ${r.nome} | onde: ${r.onde} | ${r.detalhe}`,
  );
  const extras = [...(opcoes.pedidos ?? []), (opcoes.pedidoLivre ?? '').trim()].filter(Boolean);

  const partes = [
    '# Papel',
    'Você é um engenheiro sênior de redes e segurança (FortiGate, Cisco IOS, Proxmox VE, Wazuh) me ajudando a montar um cyber range isolado no meu homelab de estudo. Responda em português do Brasil.',
    '',
    '# Meu ambiente',
    'Use somente estes dados. Não invente modelo, versão, interface ou endereço: se algo estiver marcado como [PREENCHER] ou faltar, pergunte antes de gerar comandos.',
    AMBIENTE,
    '',
    '# Regras do range (obrigatórias)',
    REGRAS,
    '',
    `# Etapa atual: ${item.titulo}`,
    item.descricao,
    '',
    '## O que eu quero',
    item.prompt?.tarefa ?? 'Me guie na execução desta etapa.',
  ];
  if (recursos.length) partes.push('', '## Recursos que esta etapa deve criar (use exatamente estes nomes)', ...recursos);
  partes.push('', '## Passos que já planejei', ...item.passos.map((p, i) => `${i + 1}. ${p}`));
  partes.push('', '## Formato da resposta', FORMATO);
  if (extras.length) partes.push('', '## Pedidos adicionais', ...extras.map((e) => `- ${e}`));

  return preencher(partes.join('\n'), vars);
}

/** Variáveis sem valor que o prompt desta etapa usa (inclui o bloco de ambiente). */
export function faltandoNoPrompt(item: RangeChecklistItem, vars: LabVars): string[] {
  const texto = [
    AMBIENTE,
    item.prompt?.tarefa ?? '',
    ...(item.prompt?.pedidos ?? []),
    ...(item.recursos ?? []).flatMap((r) => [r.nome, r.onde, r.detalhe]),
  ].join('\n');
  return variaveisFaltando(texto, vars);
}
