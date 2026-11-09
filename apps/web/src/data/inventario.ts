import type { Ativo } from '@seginfo/shared';

/**
 * Seed do inventário com o homelab do Daniel (CRIECOMIA: Proxmox, Coolify, storage, rede).
 * Editável na UI — este é o estado inicial. SEM credenciais (ficam no Cofre cifrado).
 */
export const INVENTARIO_SEED: Ativo[] = [
  // ===== CRIECOMIA — rede/borda =====
  { id: 'crie-wan', ambiente: 'criecomia', tipo: 'rede', nome: 'Internet MOBTELECOM', endereco: '138.122.82.214', funcao: 'IP público fixo (borda)', estado: 'ativo', tags: ['wan', 'publico'], labsRelacionados: ['lab-wan-attack-surface'], detalhes: { operadora: 'MOBTELECOM', borda: 'Huawei PPPoE 192.168.19.1' } },
  { id: 'crie-fg40f', ambiente: 'criecomia', tipo: 'firewall_policy', nome: 'FortiGate 40F (FG-LAB)', endereco: 'WAN via DHCP (IP volátil)', funcao: 'Gateway L3 de todas as VLANs + SD-WAN', estado: 'ativo', tags: ['fortigate', 'ngfw', 'sdwan'], labsRelacionados: ['lab-fw-hardening', 'lab-wan-attack-surface'], detalhes: { sdwan: 'virtual-wan-link (wan + lan3 4G)', gerencia: 'LAN-50 porta 1' } },
  { id: 'crie-mikrotik', ambiente: 'criecomia', tipo: 'rede', nome: 'MikroTik RB751U-2HnD', endereco: '-', funcao: 'Análise de tráfego (Traffic-Flow + SNMP → Zabbix)', estado: 'ativo', tags: ['mikrotik', 'netflow', 'snmp'], labsRelacionados: [], detalhes: {} },
  { id: 'crie-2960', ambiente: 'criecomia', tipo: 'switch', nome: 'Catalyst 2960 (SW-2960-FG)', endereco: '10.10.10.254', funcao: 'Trunk 802.1Q das VLANs; hardening aplicado', estado: 'atencao', tags: ['cisco', 'switch', 'hardening'], labsRelacionados: ['lab-switch-hardening'], detalhes: { hardening: 'BPDU guard, DTP off, ACL SSH', ssh: 'algoritmos legados', pendencias: 'VLAN19 órfã, Fa0/11' } },

  // ===== CRIECOMIA — VLANs =====
  { id: 'crie-vlan10', ambiente: 'criecomia', tipo: 'vlan', nome: 'VLAN10_SRV', endereco: '10.10.10.0/24', funcao: 'Servidores (Proxmox + VMs)', estado: 'ativo', tags: ['vlan', 'servidores'], labsRelacionados: [], detalhes: { gateway: '10.10.10.1', dhcp: 'a partir de .100', dns_pendencia: 'ainda 192.168.19.1' } },
  { id: 'crie-vlan20', ambiente: 'criecomia', tipo: 'vlan', nome: 'VLAN20_STORAGE', endereco: '10.10.20.0/24', funcao: 'Storage / NAS', estado: 'ativo', tags: ['vlan', 'storage'], labsRelacionados: [], detalhes: {} },
  { id: 'crie-vlan30', ambiente: 'criecomia', tipo: 'vlan', nome: 'VLAN30_USERS', endereco: '10.10.30.0/24', funcao: 'Usuários (origem de ataques simulados)', estado: 'ativo', tags: ['vlan', 'users'], labsRelacionados: ['lab-segmentacao-pivot'], detalhes: {} },
  { id: 'crie-vlan40', ambiente: 'criecomia', tipo: 'vlan', nome: 'VLAN40_WIFI', endereco: '10.10.40.0/24', funcao: 'Wi-Fi', estado: 'ativo', tags: ['vlan', 'wifi'], labsRelacionados: [], detalhes: {} },
  { id: 'crie-vlan60', ambiente: 'criecomia', tipo: 'vlan', nome: 'VLAN60_GUEST', endereco: '10.10.60.0/24', funcao: 'Convidados', estado: 'atencao', tags: ['vlan', 'guest'], labsRelacionados: ['lab-segmentacao-pivot'], detalhes: { risco: 'policies 50/51 dão acesso total — revisar' } },
  { id: 'crie-vlan70', ambiente: 'criecomia', tipo: 'vlan', nome: 'VLAN70_QUAR', endereco: '10.10.70.0/24', funcao: 'Quarentena (alvos vulneráveis de propósito)', estado: 'atencao', tags: ['vlan', 'quarentena', 'lab'], labsRelacionados: ['lab-dvwa', 'lab-segmentacao-pivot'], detalhes: { uso: 'hospedar apps vulneráveis p/ Red Team' } },

  // ===== CRIECOMIA — Proxmox =====
  { id: 'crie-pm01', ambiente: 'criecomia', tipo: 'host', nome: 'Proxmox pm01', endereco: '10.10.10.11', funcao: 'Nó Proxmox + controller LINSTOR', estado: 'ativo', tags: ['proxmox', 'linstor'], labsRelacionados: ['lab-soc-wazuh'], detalhes: { cpu: 'Xeon X3450 (36-bit, sem NUMA/hotplug)', ram: '~11,7 GB', nota: 'alocação estática + ballooning' } },
  { id: 'crie-pm02', ambiente: 'criecomia', tipo: 'host', nome: 'Proxmox pm02', endereco: '10.10.10.12', funcao: 'Nó Proxmox (hospeda VM100)', estado: 'ativo', tags: ['proxmox'], labsRelacionados: [], detalhes: { cpu: 'i5-8400', ram: '32 GB' } },
  { id: 'crie-linstor', ambiente: 'criecomia', tipo: 'storage', nome: 'LINSTOR/DRBD9 drbdstorage', endereco: 'controller 10.10.10.11', funcao: 'Storage replicado (rg_vm, pool_ssd240)', estado: 'atencao', tags: ['drbd', 'linstor', 'ha'], labsRelacionados: [], detalhes: { resource: 'pm-1d769311 (200G) UpToDate', risco: 'sem QDevice; histórico de split-brain pós-queda de energia' } },
  { id: 'crie-nas', ambiente: 'criecomia', tipo: 'storage', nome: 'NAS D-Link', endereco: '10.10.20.100', funcao: 'NFS (dlink-a / dlink-b)', estado: 'critico', tags: ['nas', 'nfs'], labsRelacionados: [], detalhes: { problema: 'falhas de leitura sob carga; NFS soft mount instável' } },

  // ===== CRIECOMIA — Workloads =====
  { id: 'crie-vm100', ambiente: 'criecomia', tipo: 'vm', nome: 'VM100 criecomia-coolify', endereco: '10.10.10.99', funcao: 'Coolify, Traefik, Gitea, app CRIECOMIA', estado: 'ativo', tags: ['coolify', 'docker', 'nextjs'], labsRelacionados: ['lab-dvwa', 'lab-wan-attack-surface'], detalhes: { so: 'Ubuntu 26.04.1', docker: 'Coolify 4.3.21 / Traefik v3.6', app: 'Next.js 16 / React 19 / Prisma 7' } },
  { id: 'crie-vm101', ambiente: 'criecomia', tipo: 'vm', nome: 'VM101 AD01', endereco: 'a definir', funcao: 'Windows Server 2016 → DC criecomia.local', estado: 'planejado', tags: ['ad', 'windows', 'dc'], labsRelacionados: ['lab-ad-attack'], detalhes: { pendencia: 'confirmar promoção a DC + DNS secundário' } },
  { id: 'crie-vm103', ambiente: 'criecomia', tipo: 'vm', nome: 'VM103 TEST-RADIUS-FS01', endereco: 'a definir', funcao: 'Lab de RADIUS / File Server', estado: 'planejado', tags: ['radius', 'lab'], labsRelacionados: [], detalhes: {} },
  { id: 'crie-ct102', ambiente: 'criecomia', tipo: 'container', nome: 'CT102 observability', endereco: '10.10.10.98', funcao: 'Prometheus, Grafana, Loki, Zabbix', estado: 'atencao', tags: ['observability', 'grafana', 'zabbix'], labsRelacionados: ['lab-soc-wazuh'], detalhes: { pendencia: 'trocar senhas changeme*; configurar datasources' } },

  // ===== CRIECOMIA — Exposição pública =====
  { id: 'crie-tunnel', ambiente: 'criecomia', tipo: 'servico', nome: 'Cloudflare Tunnel criecomia', endereco: 'criecom.ia.br', funcao: 'Publica web, coolify e RDP', estado: 'atencao', tags: ['cloudflare', 'tunnel', 'exposicao'], labsRelacionados: ['lab-wan-attack-surface'], detalhes: { rotas: 'criecom.ia.br, coolify.criecom.ia.br, rdp.criecom.ia.br', risco: 'rdp sem Cloudflare Access em uma das versões; revisar' } },
  { id: 'crie-vip-rdp', ambiente: 'criecomia', tipo: 'firewall_policy', nome: 'VIP RDP 10.10.10.100:1401', endereco: 'publicado na WAN (geo Brasil)', funcao: 'Acesso RDP externo', estado: 'critico', tags: ['rdp', 'vip', 'exposicao'], labsRelacionados: ['lab-wan-attack-surface', 'lab-fw-hardening'], detalhes: { risco: 'RDP exposto na internet — alvo clássico de brute force' } },
  { id: 'crie-wan50', ambiente: 'criecomia', tipo: 'firewall_policy', nome: 'Policy wan-50 (all/ALL)', endereco: 'WAN → lan', funcao: 'Política muito aberta', estado: 'critico', tags: ['firewall', 'policy', 'hardening'], labsRelacionados: ['lab-fw-hardening'], detalhes: { acao: 'candidata a substituição por policies escopadas' } },
];
