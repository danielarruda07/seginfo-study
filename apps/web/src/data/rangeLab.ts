import type { RangeRecurso } from '@seginfo/shared';

/**
 * Variáveis do lab usadas para montar os prompts e a lista de recursos do Range.
 *
 * Os valores reais ficam só no navegador do usuário (ver services/range.ts). Aqui
 * ficam apenas rótulos, exemplos e padrões de PLANEJAMENTO (faixa sugerida do range,
 * nomes) — nunca modelo, versão ou endereço real do ambiente.
 */

export type GrupoLabVar = 'firewall' | 'switch' | 'proxmox' | 'rede' | 'enderecos' | 'wazuh';

export interface LabVarDef {
  chave: string;
  rotulo: string;
  grupo: GrupoLabVar;
  /** Texto de exemplo mostrado no campo vazio. */
  exemplo: string;
  /** Valor padrão de planejamento (quando faz sentido sugerir um). */
  padrao?: string;
  dica?: string;
}

export const GRUPO_LAB_VAR_LABEL: Record<GrupoLabVar, string> = {
  firewall: 'Firewall (FortiGate)',
  switch: 'Switch (Catalyst 2960)',
  proxmox: 'Virtualização (Proxmox)',
  rede: 'Rede do range',
  enderecos: 'Endereços planejados',
  wazuh: 'SIEM (Wazuh)',
};

export const GRUPOS_LAB_VAR: GrupoLabVar[] = ['firewall', 'switch', 'proxmox', 'rede', 'enderecos', 'wazuh'];

export const LAB_VARS: LabVarDef[] = [
  // Firewall
  { chave: 'FGT_MODELO', rotulo: 'Modelo do FortiGate', grupo: 'firewall', exemplo: 'FortiGate 60F', dica: '`get system status`' },
  { chave: 'FGT_FORTIOS', rotulo: 'Versão do FortiOS', grupo: 'firewall', exemplo: '7.4.x', dica: 'A sintaxe da CLI muda entre versões.' },
  { chave: 'FGT_IF_TRUNK', rotulo: 'Interface do FortiGate ligada ao switch (trunk)', grupo: 'firewall', exemplo: 'internal1 ou lan' },
  { chave: 'FGT_IF_WAN', rotulo: 'Interface WAN do FortiGate', grupo: 'firewall', exemplo: 'wan1' },
  // Switch
  { chave: 'SW_MODELO', rotulo: 'Modelo do switch', grupo: 'switch', exemplo: 'Catalyst 2960', padrao: 'Catalyst 2960' },
  { chave: 'SW_IOS', rotulo: 'Versão do IOS', grupo: 'switch', exemplo: '15.0(2)SE', dica: '`show version`' },
  { chave: 'SW_PORTA_FGT', rotulo: 'Porta do switch ligada ao FortiGate', grupo: 'switch', exemplo: 'Gi0/1' },
  { chave: 'SW_PORTA_PVE', rotulo: 'Porta do switch ligada ao Proxmox', grupo: 'switch', exemplo: 'Gi0/2' },
  { chave: 'SW_PORTA_SENSOR', rotulo: 'Porta de destino do SPAN (sensor NSM)', grupo: 'switch', exemplo: 'Fa0/24' },
  // Proxmox
  { chave: 'PVE_VERSAO', rotulo: 'Versão do Proxmox VE', grupo: 'proxmox', exemplo: '8.x', dica: '`pveversion`' },
  { chave: 'PVE_NO', rotulo: 'Nó do Proxmox que hospeda o range', grupo: 'proxmox', exemplo: 'pve01' },
  { chave: 'PVE_BRIDGE', rotulo: 'Bridge das VMs (VLAN-aware)', grupo: 'proxmox', exemplo: 'vmbr0' },
  { chave: 'PVE_STORAGE', rotulo: 'Storage dos discos das VMs', grupo: 'proxmox', exemplo: 'local-lvm' },
  { chave: 'PVE_NIC_SENSOR', rotulo: 'Placa física do Proxmox que recebe o SPAN', grupo: 'proxmox', exemplo: 'enp3s0' },
  // Rede
  { chave: 'PREFIXO', rotulo: 'Prefixo de nomes (objetos, policies)', grupo: 'rede', exemplo: 'RANGE', padrao: 'RANGE' },
  { chave: 'RANGE_VLAN', rotulo: 'ID da VLAN do range', grupo: 'rede', exemplo: '80', padrao: '80' },
  { chave: 'RANGE_REDE', rotulo: 'Faixa de IP do range', grupo: 'rede', exemplo: '10.80.0.0/24', padrao: '10.80.0.0/24' },
  { chave: 'RANGE_GW', rotulo: 'Gateway do range (IP no FortiGate)', grupo: 'rede', exemplo: '10.80.0.1', padrao: '10.80.0.1' },
  { chave: 'KALI_VLAN', rotulo: 'VLAN do atacante (se separar a Kali dos alvos)', grupo: 'rede', exemplo: '81', dica: 'Só passa pelo firewall o tráfego entre VLANs diferentes.' },
  { chave: 'VLAN_QUARENTENA', rotulo: 'VLAN de quarentena (análise de malware)', grupo: 'rede', exemplo: '70', padrao: '70' },
  { chave: 'VLANS_PROTEGIDAS', rotulo: 'VLANs/redes que o range nunca pode alcançar', grupo: 'rede', exemplo: 'VLAN30 (produção), VLAN60 (serviços), gerência' },
  // Endereços
  { chave: 'IP_KALI', rotulo: 'IP da VM Kali', grupo: 'enderecos', exemplo: '10.80.0.10', padrao: '10.80.0.10' },
  { chave: 'IP_WIN', rotulo: 'IP da VM Windows vítima', grupo: 'enderecos', exemplo: '10.80.0.21', padrao: '10.80.0.21' },
  { chave: 'IP_LINUX', rotulo: 'IP da VM Linux vítima', grupo: 'enderecos', exemplo: '10.80.0.22', padrao: '10.80.0.22' },
  { chave: 'IP_META', rotulo: 'IP do Metasploitable', grupo: 'enderecos', exemplo: '10.80.0.31', padrao: '10.80.0.31' },
  { chave: 'IP_WEB', rotulo: 'IP do host DVWA/Juice Shop', grupo: 'enderecos', exemplo: '10.80.0.32', padrao: '10.80.0.32' },
  { chave: 'IP_VULHUB', rotulo: 'IP da VM Vulhub', grupo: 'enderecos', exemplo: '10.80.0.33', padrao: '10.80.0.33' },
  // Wazuh
  { chave: 'WAZUH_VERSAO', rotulo: 'Versão do Wazuh', grupo: 'wazuh', exemplo: '4.x' },
  { chave: 'WAZUH_MANAGER', rotulo: 'IP do Wazuh manager', grupo: 'wazuh', exemplo: 'IP do manager no homelab' },
];

export const TIPO_RECURSO_LABEL: Record<RangeRecurso['tipo'], string> = {
  vlan: 'VLAN',
  interface: 'Interface',
  objeto: 'Objeto',
  policy: 'Policy',
  vm: 'VM',
  aplicacao: 'Aplicação',
  config: 'Configuração',
  snapshot: 'Snapshot',
  credencial: 'Credencial',
  deteccao: 'Detecção',
  documento: 'Documento',
};

/** Pedidos rápidos que valem para qualquer etapa. */
export const PEDIDOS_GERAIS: string[] = [
  'Explique o porquê de cada comando, como se eu estivesse estudando para uma certificação.',
  'Antes de qualquer alteração, me dê os comandos para fazer backup da configuração atual.',
  'Não gere nada ainda: primeiro me faça as perguntas que faltam sobre o meu ambiente.',
  'Vou colar abaixo a configuração/saída atual; revise e aponte o que ajustar.',
  'Desenhe um diagrama em ASCII da topologia desta etapa.',
];
