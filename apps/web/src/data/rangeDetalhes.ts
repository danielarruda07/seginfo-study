import type { RangePrompt, RangeRecurso } from '@seginfo/shared';

/**
 * Detalhe de execução de cada etapa do checklist do Range: o que exatamente é criado
 * no ambiente (recursos) e a parte específica do prompt de IA (tarefa + pedidos rápidos).
 *
 * Os textos usam variáveis {{CHAVE}} definidas em data/rangeLab.ts; os valores reais
 * são preenchidos pelo usuário na aba "Meu lab" e nunca ficam no repositório.
 * Tudo aqui é planejamento/documentação — sem payload, implante ou malware.
 */

interface Detalhe {
  recursos: RangeRecurso[];
  prompt: RangePrompt;
}

const IF_RANGE = '{{PREFIXO}}-VLAN{{RANGE_VLAN}}';
const NIC_RANGE = 'placa virtio em {{PVE_BRIDGE}} com tag {{RANGE_VLAN}}';
const SNAP = 'Snapshot "limpo-AAAA-MM-DD"';

export const RANGE_DETALHES: Record<string, Detalhe> = {
  'range-ck-vlan': {
    recursos: [
      { tipo: 'vlan', nome: 'VLAN {{RANGE_VLAN}}, nome RANGE', onde: '{{SW_MODELO}}', detalhe: 'Criada no banco de VLANs do switch.' },
      { tipo: 'config', nome: 'Trunk com a VLAN {{RANGE_VLAN}} permitida', onde: '{{SW_MODELO}}, portas {{SW_PORTA_FGT}} e {{SW_PORTA_PVE}}', detalhe: 'Acrescentar à lista de VLANs permitidas (add), sem substituir as que já passam.' },
      { tipo: 'interface', nome: IF_RANGE, onde: 'FortiGate, sobre {{FGT_IF_TRUNK}}', detalhe: 'Sub-interface VLAN {{RANGE_VLAN}}, IP {{RANGE_GW}}, role LAN, allowaccess só ping (sem HTTPS/SSH de administração).' },
      { tipo: 'objeto', nome: '{{PREFIXO}}-NET', onde: 'FortiGate (firewall address)', detalhe: 'Sub-rede {{RANGE_REDE}}, associada à interface do range.' },
      { tipo: 'config', nome: 'Bridge {{PVE_BRIDGE}} VLAN-aware', onde: 'Proxmox, nó {{PVE_NO}}', detalhe: 'As VMs do range recebem a tag {{RANGE_VLAN}} na placa de rede.' },
      { tipo: 'documento', nome: 'Registro do segmento no Inventário', onde: 'SegInfo Study', detalhe: 'VLAN, faixa, gateway e portas usadas.' },
    ],
    prompt: {
      tarefa:
        'Criar o segmento do range de ponta a ponta: a VLAN {{RANGE_VLAN}} no switch, o trunk até o FortiGate e até o Proxmox, ' +
        'a sub-interface VLAN no FortiGate como gateway ({{RANGE_GW}}) e a entrega da tag para as VMs no Proxmox. ' +
        'A interface do range não pode dar acesso administrativo ao FortiGate. Diga também se vale usar DHCP do FortiGate ' +
        'com reservas ou IP fixo nas VMs.',
      pedidos: [
        'Confirme primeiro se a VLAN {{RANGE_VLAN}} já existe e como está o trunk hoje, para eu não derrubar as outras VLANs.',
        'Gere o trecho do /etc/network/interfaces do Proxmox para a bridge VLAN-aware.',
        'Inclua os comandos "show" e "get/diagnose" para conferir trunk, VLAN e interface depois.',
      ],
    },
  },

  'range-ck-fw-isolamento': {
    recursos: [
      { tipo: 'objeto', nome: '{{PREFIXO}}-PROTEGIDAS', onde: 'FortiGate (address group)', detalhe: 'Redes de {{VLANS_PROTEGIDAS}}.' },
      { tipo: 'policy', nome: '{{PREFIXO}}-DENY-INTERNAS', onde: 'FortiGate', detalhe: `Origem ${IF_RANGE}, destino todas as interfaces internas, ação deny, log de todas as sessões.` },
      { tipo: 'policy', nome: '{{PREFIXO}}-DENY-WAN', onde: 'FortiGate', detalhe: `Origem ${IF_RANGE}, destino {{FGT_IF_WAN}}, ação deny, log de todas as sessões.` },
      { tipo: 'policy', nome: '{{PREFIXO}}-LOCALIN-DENY', onde: 'FortiGate (local-in policy)', detalhe: 'Impede o range de falar com os serviços do próprio firewall (admin, DNS, etc.), exceto ping no gateway.' },
      { tipo: 'config', nome: 'Ordem das policies', onde: 'FortiGate', detalhe: 'As deny do range ficam acima de qualquer regra permissiva genérica.' },
    ],
    prompt: {
      tarefa:
        'Bloquear todo tráfego que sai do range para qualquer outra rede interna, para a internet e para a administração do ' +
        'próprio FortiGate. O deny implícito não registra log por padrão, então quero policies explícitas com log, ' +
        'posicionadas antes de qualquer allow genérico.',
      pedidos: [
        'Explique a ordem de avaliação das policies e como reposicionar com "move".',
        'Inclua os comandos de "diagnose debug flow" e "diagnose sniffer packet" para provar o bloqueio.',
        'Me diga como ver esses denies no log e no FortiView.',
      ],
    },
  },

  'range-ck-fw-kali': {
    recursos: [
      { tipo: 'objeto', nome: '{{PREFIXO}}-KALI', onde: 'FortiGate (firewall address)', detalhe: 'Host {{IP_KALI}}/32.' },
      { tipo: 'objeto', nome: '{{PREFIXO}}-ALVOS', onde: 'FortiGate (address group)', detalhe: 'Hosts {{IP_WIN}}, {{IP_LINUX}}, {{IP_META}}, {{IP_WEB}} e {{IP_VULHUB}}.' },
      { tipo: 'objeto', nome: '{{PREFIXO}}-SVC-ATAQUE', onde: 'FortiGate (service group)', detalhe: 'Só as portas dos exercícios (ex.: 21, 22, 23, 80, 443, 445, 3306, 3389, 5432).' },
      { tipo: 'interface', nome: '{{PREFIXO}}-ATK-VLAN{{KALI_VLAN}} (se separar o atacante)', onde: 'FortiGate + switch + Proxmox', detalhe: 'Segmento próprio da Kali, para o tráfego de ataque passar pelo firewall.' },
      { tipo: 'policy', nome: '{{PREFIXO}}-KALI-TO-ALVOS', onde: 'FortiGate', detalhe: 'Origem {{PREFIXO}}-KALI, destino {{PREFIXO}}-ALVOS, serviço {{PREFIXO}}-SVC-ATAQUE, accept, sem NAT, log de todas as sessões, acima das deny.' },
    ],
    prompt: {
      tarefa:
        'Liberar só o necessário para a Kali alcançar os alvos, com log para comparar depois com o que o Wazuh detectou. ' +
        'Atenção a um ponto de desenho: se a Kali estiver na mesma VLAN dos alvos, o tráfego é comutado na camada 2 e nunca ' +
        'passa pelo FortiGate, então a policy não teria efeito nem geraria log. Compare as opções (Kali em VLAN própria ' +
        '{{KALI_VLAN}}, firewall do Proxmox por VM, ou aceitar o tráfego livre dentro do segmento) e recomende uma para o ' +
        'meu ambiente antes de gerar os comandos.',
      pedidos: [
        'Se a recomendação for separar a Kali, gere tudo o que muda no switch, no FortiGate e no Proxmox.',
        'Sugira um perfil de IPS em modo monitor nessa policy, para eu ver as assinaturas disparadas.',
        'Monte a tabela alvo x portas liberadas para eu documentar.',
      ],
    },
  },

  'range-ck-fw-saida-temp': {
    recursos: [
      { tipo: 'objeto', nome: '{{PREFIXO}}-JANELA-DL', onde: 'FortiGate (schedule onetime)', detalhe: 'Janela curta, com início e fim definidos (ex.: 2 horas).' },
      { tipo: 'objeto', nome: '{{PREFIXO}}-DL-DESTINOS', onde: 'FortiGate (address group FQDN)', detalhe: 'Só os repositórios necessários (distribuição, registro de containers, projeto oficial da ferramenta).' },
      { tipo: 'policy', nome: '{{PREFIXO}}-DL-TEMP', onde: 'FortiGate', detalhe: `Origem um único host do range, destino {{PREFIXO}}-DL-DESTINOS via {{FGT_IF_WAN}}, serviços DNS/HTTP/HTTPS, NAT ligado, schedule {{PREFIXO}}-JANELA-DL, log de todas as sessões, desabilitada por padrão.` },
      { tipo: 'documento', nome: 'Registro da janela', onde: 'Notas desta etapa', detalhe: 'Quem, quando, para baixar o quê, e a confirmação de que foi fechada.' },
    ],
    prompt: {
      tarefa:
        'Criar uma liberação de internet pontual e controlada para baixar ferramentas/imagens: um único host de origem, ' +
        'destinos restritos, com prazo de validade e desabilitada por padrão. Preciso também resolver DNS durante a janela ' +
        'sem deixar DNS aberto fora dela.',
      pedidos: [
        'Gere os dois comandos de uma linha para habilitar e desabilitar a policy.',
        'Liste os FQDNs que preciso liberar para atualizar a Kali, baixar imagens de container e clonar repositórios.',
        'Mostre como confirmar no log que a policy parou de casar tráfego depois de fechada.',
      ],
    },
  },

  'range-ck-vm-kali': {
    recursos: [
      { tipo: 'vm', nome: 'range-kali', onde: 'Proxmox, nó {{PVE_NO}}, storage {{PVE_STORAGE}}', detalhe: `2 vCPU, 4 a 8 GB de RAM, disco de 60 GB, ${NIC_RANGE} (ou a VLAN do atacante), IP {{IP_KALI}}, gateway {{RANGE_GW}}.` },
      { tipo: 'aplicacao', nome: 'Metasploit, nmap, Burp Suite, BloodHound', onde: 'range-kali', detalhe: 'Pacotes da própria distribuição, atualizados durante a janela de download.' },
      { tipo: 'aplicacao', nome: 'Framework de C2 de código aberto (Sliver ou Mythic)', onde: 'range-kali', detalhe: 'Instalado a partir do repositório oficial do projeto.' },
      { tipo: 'credencial', nome: 'Usuário local exclusivo do range', onde: 'range-kali', detalhe: 'Guardado no Cofre com a marca "range".' },
      { tipo: 'config', nome: 'Pool e tag "range"', onde: 'Proxmox', detalhe: 'Pool RANGE agrupando todas as VMs do range, para snapshot e rollback em lote.' },
      { tipo: 'snapshot', nome: SNAP, onde: 'range-kali', detalhe: 'Tirado depois da instalação das ferramentas.' },
    ],
    prompt: {
      tarefa:
        'Provisionar a VM Kali no Proxmox pela linha de comando (imagem oficial pronta para QEMU ou instalação pela ISO, ' +
        'recomende a melhor), ligada ao segmento do range, com IP fixo, as ferramentas listadas e um snapshot limpo no final. ' +
        'O download depende da regra temporária de internet.',
      pedidos: [
        'Gere o "qm create" completo, com importação do disco e criação do pool RANGE.',
        'Liste o que instalar e a ordem, para caber em uma única janela de download.',
        'Inclua um endurecimento mínimo da própria Kali (SSH só por chave, sem serviços desnecessários).',
      ],
    },
  },

  'range-ck-vm-win-vitima': {
    recursos: [
      { tipo: 'vm', nome: 'range-win-vitima', onde: 'Proxmox, nó {{PVE_NO}}, storage {{PVE_STORAGE}}', detalhe: `Windows 10/11, 2 vCPU, 4 a 6 GB de RAM, disco de 64 GB, drivers VirtIO, ${NIC_RANGE}, IP {{IP_WIN}}.` },
      { tipo: 'aplicacao', nome: 'Sysmon com configuração base', onde: 'range-win-vitima', detalhe: 'Configuração SwiftOnSecurity ou Olaf Hartong.' },
      { tipo: 'aplicacao', nome: 'Agente Wazuh {{WAZUH_VERSAO}}', onde: 'range-win-vitima', detalhe: 'Registrado no manager {{WAZUH_MANAGER}}, no grupo de agentes "range".' },
      { tipo: 'objeto', nome: '{{PREFIXO}}-WAZUH-MGR', onde: 'FortiGate (firewall address)', detalhe: 'Host {{WAZUH_MANAGER}}/32.' },
      { tipo: 'policy', nome: '{{PREFIXO}}-TO-WAZUH', onde: 'FortiGate', detalhe: 'Única exceção permanente ao isolamento: origem {{PREFIXO}}-NET, destino {{PREFIXO}}-WAZUH-MGR, só 1514/tcp e 1515/tcp, com log, acima das deny.' },
      { tipo: 'config', nome: 'Auditoria avançada e log de PowerShell', onde: 'range-win-vitima', detalhe: 'Linha de comando nos eventos de processo e Script Block Logging.' },
      { tipo: 'credencial', nome: 'Conta local de teste', onde: 'range-win-vitima', detalhe: 'Sem conta Microsoft; senha exclusiva do range.' },
      { tipo: 'snapshot', nome: SNAP, onde: 'range-win-vitima', detalhe: 'Depois de o agente aparecer ativo no Wazuh.' },
    ],
    prompt: {
      tarefa:
        'Provisionar a VM Windows que será o alvo dos exercícios, com Sysmon e agente Wazuh enviando eventos. ' +
        'O agente precisa alcançar o manager, que fica fora do range: quero a exceção mínima no FortiGate (só as portas do ' +
        'agente, só para o IP do manager) e a avaliação do risco dessa exceção. A VM não deve ter outra saída.',
      pedidos: [
        'Gere o "qm create" para Windows 11 (UEFI, TPM virtual, VirtIO) e os passos da instalação.',
        'Gere o script PowerShell que instala o Sysmon e o agente Wazuh e habilita a auditoria.',
        'Mostre o trecho do agent.conf do grupo "range" para coletar o canal do Sysmon.',
      ],
    },
  },

  'range-ck-vm-linux-vitima': {
    recursos: [
      { tipo: 'vm', nome: 'range-linux-vitima', onde: 'Proxmox, nó {{PVE_NO}}, storage {{PVE_STORAGE}}', detalhe: `Debian ou Ubuntu Server, 1 vCPU, 2 GB de RAM, disco de 20 GB, ${NIC_RANGE}, IP {{IP_LINUX}}.` },
      { tipo: 'config', nome: 'SSH com senha habilitada', onde: 'range-linux-vitima', detalhe: 'Fraco de propósito e só dentro do range.' },
      { tipo: 'credencial', nome: 'Usuário de teste com senha fraca', onde: 'range-linux-vitima', detalhe: 'Nunca uma credencial real ou reaproveitada.' },
      { tipo: 'aplicacao', nome: 'auditd com regras base', onde: 'range-linux-vitima', detalhe: 'Execução de comandos, alteração de contas e de chaves SSH.' },
      { tipo: 'aplicacao', nome: 'Agente Wazuh {{WAZUH_VERSAO}}', onde: 'range-linux-vitima', detalhe: 'Grupo "range"; usa a mesma policy {{PREFIXO}}-TO-WAZUH.' },
      { tipo: 'aplicacao', nome: 'Fail2ban (segunda rodada)', onde: 'range-linux-vitima', detalhe: 'Instalado só depois da primeira medição, para comparar detecção com bloqueio.' },
      { tipo: 'snapshot', nome: SNAP, onde: 'range-linux-vitima', detalhe: 'Antes do Fail2ban, e outro depois.' },
    ],
    prompt: {
      tarefa:
        'Provisionar a VM Linux com SSH deliberadamente fraco, auditd e agente Wazuh, para eu medir o que é detectado numa ' +
        'tentativa de força bruta vinda da Kali e, numa segunda rodada, comparar com o Fail2ban ativo.',
      pedidos: [
        'Gere o cloud-init ou o script de pós-instalação que deixa a VM pronta.',
        'Liste as regras do Wazuh que devem disparar na força bruta de SSH e como conferir.',
        'Monte o roteiro do antes/depois do Fail2ban e o que anotar em cada rodada.',
      ],
    },
  },

  'range-ck-vm-alvos-classicos': {
    recursos: [
      { tipo: 'vm', nome: 'range-metasploitable', onde: 'Proxmox, nó {{PVE_NO}}', detalhe: `Disco importado da imagem oficial, 1 vCPU, 1 GB de RAM, ${NIC_RANGE}, IP {{IP_META}}.` },
      { tipo: 'vm', nome: 'range-web', onde: 'Proxmox, nó {{PVE_NO}}', detalhe: `Linux com Docker, 2 vCPU, 4 GB de RAM, disco de 30 GB, ${NIC_RANGE}, IP {{IP_WEB}}.` },
      { tipo: 'aplicacao', nome: 'DVWA e OWASP Juice Shop', onde: 'range-web (containers)', detalhe: 'Imagens oficiais dos projetos, cada uma em sua porta.' },
      { tipo: 'vm', nome: 'range-vulhub', onde: 'Proxmox, nó {{PVE_NO}}', detalhe: `Linux com Docker, 2 vCPU, 4 a 8 GB de RAM, disco de 60 GB, ${NIC_RANGE}, IP {{IP_VULHUB}}.` },
      { tipo: 'aplicacao', nome: 'Repositório Vulhub', onde: 'range-vulhub', detalhe: 'Um ambiente por exercício; documentar a porta de cada um.' },
      { tipo: 'snapshot', nome: SNAP, onde: 'Cada uma das três VMs', detalhe: 'Depois de baixar as imagens e fechar a janela de internet.' },
    ],
    prompt: {
      tarefa:
        'Provisionar os alvos clássicos de treino: Metasploitable (importando o disco no Proxmox), um host Docker com DVWA e ' +
        'Juice Shop e um host Docker com o Vulhub. Nenhum deles pode ter saída para a internet depois de pronto.',
      pedidos: [
        'Gere os comandos para converter e importar o disco do Metasploitable no Proxmox.',
        'Gere o docker-compose do host range-web com as duas aplicações.',
        'Sugira os três primeiros ambientes do Vulhub para um iniciante, com a porta de cada um.',
      ],
    },
  },

  'range-ck-vm-remnux': {
    recursos: [
      { tipo: 'vm', nome: 'range-remnux', onde: 'Proxmox, nó {{PVE_NO}}, storage {{PVE_STORAGE}}', detalhe: '2 vCPU, 4 GB de RAM, disco de 60 GB, sem placa de rede ou só na VLAN {{VLAN_QUARENTENA}}.' },
      { tipo: 'aplicacao', nome: 'REMnux, YARA e ferramentas de análise estática', onde: 'range-remnux', detalhe: 'Instalados antes de cortar a rede.' },
      { tipo: 'config', nome: 'Transferência de amostras sem rede', onde: 'Proxmox', detalhe: 'Disco virtual ou ISO anexado só para leitura, em vez de compartilhamento de rede.' },
      { tipo: 'snapshot', nome: SNAP, onde: 'range-remnux', detalhe: 'Restaurado depois de cada análise.' },
    ],
    prompt: {
      tarefa:
        'Provisionar a VM de análise de amostras e garantir que ela fique sem rota para a internet e para as outras VLANs. ' +
        'Preciso de um jeito seguro de levar para dentro dela os arquivos capturados pelo honeypot, sem usar a rede.',
      pedidos: [
        'Mostre como provar que a VM não tem nenhuma rota de saída.',
        'Descreva o fluxo de transferência por disco/ISO somente leitura, passo a passo.',
        'Liste os cuidados para eu não executar uma amostra por engano no meu desktop.',
      ],
    },
  },

  'range-ck-snapshots': {
    recursos: [
      { tipo: 'snapshot', nome: SNAP, onde: 'Todas as VMs do pool RANGE', detalhe: 'Um por VM, logo depois do provisionamento.' },
      { tipo: 'config', nome: 'Script de rollback em lote', onde: 'Proxmox, nó {{PVE_NO}}', detalhe: 'Restaura o snapshot limpo de todas as VMs do pool RANGE.' },
      { tipo: 'config', nome: 'Backup das VMs limpas', onde: 'Proxmox (vzdump)', detalhe: 'Cópia fora do storage das VMs, para o caso de perder os snapshots.' },
      { tipo: 'documento', nome: 'Checklist de reset pós-exercício', onde: 'SegInfo Study', detalhe: 'Ordem de restauração e conferência final.' },
    ],
    prompt: {
      tarefa:
        'Montar a rotina de snapshot e rollback do range: padrão de nomes, um script que restaura todas as VMs do pool RANGE ' +
        'para o estado limpo e a conferência de que nada "infectado" continua ligado.',
      pedidos: [
        'Gere o script bash com "qm listsnapshot" e "qm rollback" para o pool inteiro, com modo de simulação.',
        'Explique quando incluir a memória no snapshot e quanto espaço isso consome no meu storage.',
        'Monte o checklist de reset em formato de lista para eu colar no app.',
      ],
    },
  },

  'range-ck-credenciais': {
    recursos: [
      { tipo: 'credencial', nome: 'Conjunto de contas de teste do range', onde: 'Cada VM do range', detalhe: 'Uma por VM, sem repetir senha de nada fora do range.' },
      { tipo: 'documento', nome: 'Entradas marcadas como "range"', onde: 'Cofre do SegInfo Study', detalhe: 'Único lugar onde essas senhas ficam.' },
      { tipo: 'config', nome: 'Sem contas pessoais ou corporativas', onde: 'Todas as VMs', detalhe: 'Sem login Microsoft/Google, sem chaves SSH ou tokens reais.' },
    ],
    prompt: {
      tarefa:
        'Definir o esquema de credenciais do range (quais contas cada VM tem, qual é fraca de propósito e qual é só de ' +
        'administração) e a verificação de que nenhuma credencial real entrou no segmento. Não gere senhas na resposta.',
      pedidos: [
        'Monte a tabela VM x conta x finalidade, sem senhas.',
        'Liste os comandos para conferir, em Windows e Linux, se há conta online, chave ou token real na VM.',
      ],
    },
  },

  'range-ck-teste-contencao': {
    recursos: [
      { tipo: 'documento', nome: 'Matriz de testes de contenção', onde: 'Notas desta etapa', detalhe: 'Origem, destino, porta, resultado esperado e resultado obtido.' },
      { tipo: 'config', nome: 'Evidência nos logs', onde: 'FortiGate', detalhe: 'Denies das policies {{PREFIXO}}-DENY-INTERNAS e {{PREFIXO}}-DENY-WAN registrados para cada teste.' },
    ],
    prompt: {
      tarefa:
        'Provar, a partir da Kali ({{IP_KALI}}), que o range está contido: sem acesso a {{VLANS_PROTEGIDAS}}, sem internet ' +
        '(inclusive por DNS e ICMP) e sem acesso à administração do FortiGate. Quero a matriz de testes e a conferência no log ' +
        'de que cada tentativa foi negada.',
      pedidos: [
        'Gere a matriz como tabela em Markdown para eu preencher.',
        'Inclua testes de saída por DNS, por ICMP e por IPv6.',
        'Mostre o filtro de log do FortiGate para ver só os denies vindos do range.',
      ],
    },
  },

  'range-ck-span': {
    recursos: [
      { tipo: 'config', nome: 'monitor session 1', onde: '{{SW_MODELO}}', detalhe: 'Origem VLAN {{RANGE_VLAN}}, destino {{SW_PORTA_SENSOR}}.' },
      { tipo: 'config', nome: 'Bridge de captura sem IP', onde: 'Proxmox, placa {{PVE_NIC_SENSOR}}', detalhe: 'Entrega o tráfego espelhado à VM do sensor em modo promíscuo.' },
      { tipo: 'vm', nome: 'range-sensor', onde: 'Proxmox, nó {{PVE_NO}}', detalhe: '4 vCPU, 8 GB de RAM ou mais, disco de 100 GB ou mais, uma placa de gerência e uma de captura.' },
      { tipo: 'aplicacao', nome: 'Suricata e Zeek (ou Security Onion)', onde: 'range-sensor', detalhe: 'Escutando na placa de captura.' },
    ],
    prompt: {
      tarefa:
        'Dar visibilidade de rede aos exercícios com um sensor Suricata/Zeek. Atenção a um ponto de desenho: o tráfego entre ' +
        'duas VMs no mesmo host e na mesma bridge do Proxmox não chega ao switch físico, então o SPAN do switch não o enxerga. ' +
        'Avalie as opções (espelhamento na própria bridge do Proxmox, SPAN no switch, ou os dois) e recomende uma para o meu ' +
        'ambiente antes de gerar os comandos.',
      pedidos: [
        'Gere a configuração da monitor session e diga os limites desse recurso no meu switch.',
        'Gere o espelhamento de porta dentro do Proxmox para a VM do sensor.',
        'Diga como enviar os alertas do Suricata para o Wazuh sem abrir outra exceção no isolamento.',
      ],
    },
  },

  'range-ck-wazuh-regras': {
    recursos: [
      { tipo: 'config', nome: 'Grupo de agentes "range"', onde: 'Wazuh manager', detalhe: 'agent.conf coletando o canal operacional do Sysmon.' },
      { tipo: 'deteccao', nome: 'Regras locais para os eventos 1, 3, 11 e 13', onde: 'Wazuh manager (regras locais)', detalhe: 'IDs na faixa reservada a regras do usuário, com a técnica ATT&CK correspondente.' },
      { tipo: 'documento', nome: 'Tabela de cobertura', onde: 'Notas desta etapa', detalhe: 'Evento gerado, regra que disparou, nível do alerta.' },
    ],
    prompt: {
      tarefa:
        'Validar que os eventos-chave do Sysmon (1 processo, 3 conexão, 11 arquivo, 13 registro) chegam ao Wazuh e geram ' +
        'alerta. Quero um teste inofensivo para cada evento, onde conferir no painel e as regras locais para o que não aparecer.',
      pedidos: [
        'Gere um comando de teste inofensivo para cada um dos quatro eventos.',
        'Escreva as regras locais já com o mapeamento ATT&CK.',
        'Mostre como testar a regra com o wazuh-logtest antes de reiniciar o manager.',
      ],
    },
  },

  'range-ck-exercicio-c2': {
    recursos: [
      { tipo: 'snapshot', nome: 'Snapshot "pre-exercicio-AAAA-MM-DD"', onde: 'range-win-vitima e range-kali', detalhe: 'Ponto de retorno do exercício.' },
      { tipo: 'policy', nome: '{{PREFIXO}}-QUARENTENA-WIN', onde: 'FortiGate', detalhe: 'Desabilitada por padrão; nega todo tráfego de {{IP_WIN}}, usada na etapa de resposta.' },
      { tipo: 'deteccao', nome: 'Regra nova para a etapa que passou despercebida', onde: 'Wazuh manager', detalhe: 'Pelo menos uma por exercício.' },
      { tipo: 'documento', nome: 'Linha do tempo atacante x detecção', onde: 'SegInfo Study', detalhe: 'Técnica ATT&CK, horário da ação, horário do alerta, tempo até detectar.' },
      { tipo: 'documento', nome: 'Captura de memória e análise', onde: 'VM de análise', detalhe: 'Achados do Volatility 3 anexados ao relatório.' },
    ],
    prompt: {
      tarefa:
        'Planejar o exercício purple team "cavalo de troia controlado", todo dentro do range, usando um framework de C2 de ' +
        'código aberto mantido (Sliver ou Mythic), sem escrever implante próprio. Preciso do roteiro em fases, do que observar ' +
        'no Wazuh/Sysmon em cada técnica (T1204, T1547/T1053, T1082/T1087, T1003, T1071) e do procedimento de resposta: ' +
        'isolar a VM, capturar memória, analisar e restaurar.',
      pedidos: [
        'Para cada técnica, diga qual evento do Sysmon e qual regra do Wazuh deveriam disparar.',
        'Gere o modelo do relatório final em Markdown.',
        'Detalhe o procedimento de captura de memória pelo Proxmox e os primeiros plugins do Volatility 3 a rodar.',
      ],
    },
  },

  'range-ck-exercicio-atomic': {
    recursos: [
      { tipo: 'aplicacao', nome: 'Invoke-AtomicRedTeam e a pasta de atomics', onde: 'range-win-vitima', detalhe: 'Baixados na janela temporária de internet; snapshot novo depois.' },
      { tipo: 'aplicacao', nome: 'MITRE Caldera', onde: 'range-kali ou VM própria range-caldera', detalhe: 'Servidor acessível só dentro do range.' },
      { tipo: 'documento', nome: 'Planilha de cobertura', onde: 'Matriz ATT&CK do SegInfo Study', detalhe: 'Técnica executada, detectada ou não, regra ajustada, nova rodada.' },
    ],
    prompt: {
      tarefa:
        'Medir a cobertura de detecção com testes automatizados: Atomic Red Team técnica por técnica na VM Windows e depois ' +
        'uma operação encadeada no Caldera. Quero começar com um conjunto pequeno de técnicas e registrar quantas o Wazuh ' +
        'detectou antes e depois de ajustar as regras.',
      pedidos: [
        'Sugira as dez primeiras técnicas, das mais simples às mais ruidosas, com o comando de execução e o de limpeza.',
        'Mostre a instalação do Caldera e do agente só com tráfego dentro do range.',
        'Monte a planilha de cobertura em Markdown.',
      ],
    },
  },
};
