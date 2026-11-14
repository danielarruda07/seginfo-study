import type { Ativo } from '@seginfo/shared';

/**
 * Ativos reunidos das notas de infraestrutura do projeto. São importados somente
 * mediante ação do usuário e ficam marcados para conferência no equipamento.
 * Não incluir senhas, tokens nem credenciais neste arquivo.
 */
export const INVENTARIO_DOCUMENTADO: Ativo[] = [
  {
    id: 'doc-vm100-coolify', ambiente: 'criecomia', tipo: 'host', nome: 'VM100 · Coolify',
    endereco: '10.10.10.99', funcao: 'Host documentado do Coolify e dos serviços web/API da SegInfo, publicado pelo Cloudflare Tunnel.',
    estado: 'atencao', detalhes: { virtualizador: 'Proxmox', tunnel: 'criecomia', servicos: 'Coolify, web, seginfo-api' },
    tags: ['documentação', 'coolify', 'proxmox', 'revisar'], labsRelacionados: [], fonte: 'docs/DEPLOY.md · conferir endereço e função atuais',
  },
  {
    id: 'doc-cluster-proxmox', ambiente: 'criecomia', tipo: 'host', nome: 'Cluster Proxmox',
    endereco: '', funcao: 'Virtualização do homelab; documentação menciona revisão do quorum e limpeza de uma VM órfã.',
    estado: 'atencao', detalhes: { pendencias: 'Definir QDevice/tiebreaker; conferir VM 101 órfã', endereco: 'Endereço de gerenciamento não consta de forma verificável nas notas' },
    tags: ['documentação', 'proxmox', 'virtualização', 'revisar'], labsRelacionados: [], fonte: 'docs/PENDENCIAS.md · falta confirmar nós e endereços no Proxmox',
  },
  {
    id: 'doc-fortigate-fg-lab', ambiente: 'criecomia', tipo: 'firewall_policy', nome: 'FortiGate FG-LAB',
    endereco: '', funcao: 'Firewall de borda e segmentação do homelab; notas apontam revisão de policies e VLANs.',
    estado: 'atencao', detalhes: { pendencias: 'Revisar policy 50 e policies 24, 11, 19, 22 e 23; conferir escopo das VLANs 60/70', api: 'Integração ainda não documentada como habilitada' },
    tags: ['documentação', 'fortigate', 'firewall', 'revisar'], labsRelacionados: [], fonte: 'docs/PENDENCIAS.md · conferir configuração atual no firewall',
  },
  {
    id: 'doc-catalyst-2960', ambiente: 'criecomia', tipo: 'switch', nome: 'Cisco Catalyst 2960',
    endereco: '', funcao: 'Switch do homelab; documentação prevê VLANs, trunk e possível espelhamento SPAN.',
    estado: 'atencao', detalhes: { uso: 'Conectividade do lab e possível SPAN para sensor NSM', pendencias: 'Confirmar modelo exato, versão IOS, IP de gerência e mapeamento das portas' },
    tags: ['documentação', 'switch', 'catalyst', 'revisar'], labsRelacionados: [], fonte: 'docs/IDEIAS_LAB.md e docs/AGENTS.md · conferir no switch',
  },
  {
    id: 'doc-nas-nfs', ambiente: 'criecomia', tipo: 'storage', nome: 'NAS · NFS',
    endereco: '', funcao: 'Armazenamento em rede mencionado para o cluster Proxmox.',
    estado: 'atencao', detalhes: { pendencias: 'Revisar configuração de soft mount; IP, export e capacidade não constam de forma verificável nas notas' },
    tags: ['documentação', 'storage', 'nas', 'nfs', 'revisar'], labsRelacionados: [], fonte: 'docs/PENDENCIAS.md · confirmar IP, export e configuração no NAS',
  },
  {
    id: 'doc-linstor', ambiente: 'criecomia', tipo: 'storage', nome: 'LINSTOR · recurso a revisar',
    endereco: '', funcao: 'Recurso LINSTOR listado como candidato a limpeza; confirmar antes de qualquer remoção.',
    estado: 'atencao', detalhes: { recurso: 'pm-ef6857c4', acao: 'Validar dependências e estado antes de remover' },
    tags: ['documentação', 'linstor', 'storage', 'revisar'], labsRelacionados: [], fonte: 'docs/PENDENCIAS.md · não remover sem validar no cluster',
  },
  {
    id: 'doc-ct102-observabilidade', ambiente: 'criecomia', tipo: 'container', nome: 'CT102 · Observabilidade',
    endereco: '', funcao: 'Stack de observabilidade citada nas notas do homelab.',
    estado: 'atencao', detalhes: { pendencias: 'Trocar credenciais padrão mencionadas nas notas; instalar Zabbix Agent 2 nos hosts e revisar fontes do Grafana' },
    tags: ['documentação', 'observabilidade', 'zabbix', 'grafana', 'revisar'], labsRelacionados: [], fonte: 'docs/PENDENCIAS.md · confirmar serviços e endereços no host',
  },
  {
    id: 'doc-vip-rdp', ambiente: 'criecomia', tipo: 'firewall_policy', nome: 'VIP RDP · revisão prioritária',
    endereco: '10.10.10.100:1401', funcao: 'Regra de publicação RDP descrita nas notas como pendência para retirar da WAN.',
    estado: 'critico', detalhes: { pendencia: 'Confirmar se a publicação ainda existe; se existir, retirar da WAN e usar acesso protegido', referencia: 'rdp.criecom.ia.br / Cloudflare Access' },
    tags: ['documentação', 'rdp', 'vip', 'revisar-prioritário'], labsRelacionados: [], fonte: 'docs/PENDENCIAS.md e docs/RADAR.md · verificar imediatamente no FortiGate',
  },
  {
    id: 'doc-wan-sensor', ambiente: 'criecomia', tipo: 'rede', nome: 'Endereço WAN documentado · sensor',
    endereco: '', funcao: 'Endereço público do FortiGate e do sensor de honeypot. O valor real fica no Cofre/Meu Ambiente, nunca no repositório público.',
    estado: 'atencao', detalhes: { referencia: 'docs/RADAR.md', pendencia: 'Confirmar se este endereço continua atribuído e se os encaminhamentos estão limitados à VM sensor' },
    tags: ['documentação', 'wan', 'sensor', 'revisar'], labsRelacionados: [], fonte: 'docs/RADAR.md · confirmar no FortiGate/Cloudflare antes de usar',
  },
];
