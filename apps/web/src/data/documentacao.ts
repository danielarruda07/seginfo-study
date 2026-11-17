/**
 * Documentação do ambiente de estudo (cyber range + honeypot), no nível de
 * MONTAGEM — rede, firewall, VLANs, VMs, switch, exposição e testes — não de código.
 *
 * REGRA (repositório é público): nada de IPs, hostnames, domínios, credenciais ou o
 * mapa exato que sirva de alvo. Fale por nome de segmento e por técnica, como em docs/RANGE.md.
 */

export interface DocBloco {
  id: string;
  titulo: string;
  icone: string;
  /** resumo curto que aparece no índice */
  resumo: string;
  paragrafos?: string[];
  itens?: string[];
  tabela?: { colunas: string[]; linhas: string[][] };
}

/** Um tipo de teste: como a superfície é aberta, como o ataque é feito e como é detectado. */
export interface DocTeste {
  id: string;
  codigo: string;        // técnica MITRE (ex.: T1046)
  titulo: string;
  tatica: string;        // fase da cadeia
  alvo: string;          // segmento/serviço atacado
  comoAbre: string;      // como a superfície fica exposta ao ataque
  comoAtaca: string;     // o que o atacante (ou o tráfego real) faz
  deteccao: string;      // regra Wazuh + o que gera o alerta
  resultado: string;     // o que foi observado no ambiente
}

export const DOC_OBJETIVO = [
  'Este ambiente inverte o caminho usual: primeiro a decisão de ficar exposto à internet de propósito, ' +
    'observar ataques reais com honeypots e iscas, e só depois reproduzir os mesmos ataques por dentro, com a ' +
    'Kali (red team), treinando a detecção no Wazuh (blue team). Tudo o que é visto alimenta o Radar e a Matriz ATT&CK do app.',
  'Esta página descreve a MONTAGEM do ambiente — rede, firewall, máquinas e exposição — e traz um índice de ' +
    'testes por tipo. Endereços reais, nomes e senhas ficam numa documentação privada, fora deste repositório.',
];

export const DOC_BLOCOS: DocBloco[] = [
  {
    id: 'rede',
    titulo: 'Rede e segmentação (VLANs)',
    icone: 'pi-sitemap',
    resumo: 'Cada papel do ambiente é uma VLAN isolada; toda passagem entre elas atravessa o firewall e vira log.',
    paragrafos: [
      'O ambiente é dividido em segmentos, e cada segmento é uma VLAN no switch e uma interface no firewall. ' +
        'Nenhum segmento conversa com outro sem passar pelo firewall, então toda comunicação entre papéis é registrada. ' +
        'Nenhum dos segmentos de ataque tem saída para a internet: malware que tente baixar a segunda etapa falha.',
    ],
    tabela: {
      colunas: ['Segmento', 'Conteúdo', 'Fala com', 'Sai para a internet'],
      linhas: [
        ['Alvos internos', 'Windows vítima (Sysmon + agente), vagas para Linux/web vulneráveis', 'Kali (retorno), Wazuh (eventos)', 'Não'],
        ['Atacante', 'Kali', 'Alvos internos', 'Não (janela curta só para atualizar)'],
        ['Exposto', 'Honeypots (SSH/Telnet, FTP, web, bancos, VNC…) e iscas de serviço', 'Wazuh (eventos), alvo real Linux (proxy)', 'Não'],
        ['Alvos reais', 'Linux real atrás do proxy; Windows Server real exposto (RDP, SMB)', 'Wazuh (só eventos)', 'Não'],
        ['Isca web', 'WordPress antigo, DVWA e Juice Shop num domínio próprio sem CDN', 'Wazuh (só eventos)', 'Não (janela curta p/ instalar e renovar certificado)'],
        ['Servidores', 'Wazuh (SIEM), Proxmox, app de estudo', '—', '—'],
      ],
    },
  },
  {
    id: 'switch',
    titulo: 'Configuração do switch',
    icone: 'pi-share-alt',
    resumo: 'Portas dos nós como tronco idêntico; as VLANs trafegam marcadas até o firewall.',
    paragrafos: [
      'As portas do switch que ligam os nós de virtualização são configuradas como tronco (trunk), todas iguais: ' +
        'mesma VLAN nativa de gerência e a mesma lista de VLANs permitidas (gerência + segmentos do range). ' +
        'Assim qualquer VM pode subir em qualquer nó e continuar na VLAN certa.',
      'O nó de virtualização só repassa a VLAN marcada; ele não tem endereço dentro dos segmentos de ataque. ' +
        'Quem roteia e filtra é o firewall — o isolamento nunca depende da máquina atacada.',
    ],
  },
  {
    id: 'firewall',
    titulo: 'Regras de firewall',
    icone: 'pi-shield',
    resumo: 'Bloqueio explícito com log em cada segmento; permissões pontuais acima; WAN fechada antes de abrir portas.',
    paragrafos: [
      'Cada segmento do range tem regras de bloqueio explícitas (com registro) para "rede interna" e para "internet"; ' +
        'as permissões são pontuais e ficam acima delas. O que não é liberado de propósito é negado e logado.',
    ],
    itens: [
      'Fechar a WAN antes de abrir qualquer porta: administração do firewall e serviços remotos antigos acessíveis pela WAN foram fechados; a DMZ do modem nunca é usada (exporia o firewall).',
      'Isolamento no firewall, não na VM: um invasor com root num alvo real não consegue desligar a regra que o prende.',
      'Entrada da exposição começou agendada (janela de 72 h por rodada); hoje fica aberta sem prazo por decisão do dono e fecha desativando as regras de entrada.',
      'IPS na regra de entrada da isca web em modo só registro: a assinatura fica no log e o ataque chega ao alvo, para poder ser observado.',
      'Saída de todos os segmentos expostos negada: a janela de saída abre só para instalar e para renovar certificado.',
    ],
  },
  {
    id: 'vms',
    titulo: 'Criação das VMs',
    icone: 'pi-server',
    resumo: 'Instalação sem console (cloud-init / autounattend), via API; snapshot "limpo" e reset periódico.',
    paragrafos: [
      'As máquinas são criadas e configuradas pela API do virtualizador, sem console: Linux por imagem de nuvem com ' +
        'semente de cloud-init; Windows por resposta automatizada e um script de primeiro logon (rede, RDP/NLA, SMB, ' +
        'auditoria, agente). Tudo gerado e enviado por API para ser repetível.',
      'Cada alvo tem um snapshot "limpo" que contém também as iscas. Os alvos reais voltam a esse snapshot de tempos ' +
        'em tempos (reset periódico): o ataque tem tempo de se desenrolar, e o que foi capturado já está no Wazuh. ' +
        'O script de reset descobre em qual nó cada VM está no cluster, então funciona mesmo depois de migração.',
      'O disco das VMs fica no armazenamento replicado; os backups, num destino separado. A VM da isca pode rodar em ' +
        'qualquer nó do cluster, exceto o que hospeda a produção.',
    ],
  },
  {
    id: 'exposicao',
    titulo: 'Formas de abertura para ataque',
    icone: 'pi-globe',
    resumo: 'IP público → modem → firewall (VIPs) → honeypots, iscas e alvos reais; reflexão UDP é só registrada.',
    paragrafos: [
      'A exposição vai da internet ao modem da operadora (IP público, port mapping), dele ao firewall (endereços ' +
        'virtuais por serviço) e daí a cada honeypot, isca ou alvo real. Cada porta aberta leva a um serviço diferente:',
    ],
    itens: [
      'SSH/Telnet → honeypot que valida a senha e repassa a sessão a um Linux real descartável (alta interação).',
      'FTP, web, bancos (MSSQL/MySQL), SIP, MQTT e afins → honeypot de serviços, que registra e responde o mínimo.',
      'VNC, PostgreSQL, SMTP, POP3, IMAP → honeypot de captura de credenciais.',
      'Redis, Elasticsearch, API do Docker → iscas próprias: falam o protocolo mínimo, registram a tentativa e nunca executam nada.',
      'RDP, SMB → Windows Server real exposto, com conta e arquivo isca.',
      'HTTP/HTTPS → isca web (WordPress vulnerável, DVWA, Juice Shop), cada um num subdomínio.',
      'UDP de reflexão (DNS, NTP, SSDP, memcached) → o firewall registra e descarta; nada responde, para o IP não virar refletor de DDoS.',
    ],
  },
  {
    id: 'kali',
    titulo: 'Kali: a estação atacante (red team)',
    icone: 'pi-bullseye',
    resumo: 'Workstation de ataque isolada na VLAN atacante, usada para reproduzir técnicas contra os alvos internos.',
    paragrafos: [
      'A Kali é a estação do atacante, numa VLAN própria que só alcança os alvos internos — nunca a internet (há ' +
        'apenas uma janela curta para atualizar os pacotes). O papel dela é reproduzir, por dentro e sob controle, os ' +
        'mesmos ataques que chegam de fora, para medir a detecção do Wazuh em cada técnica.',
      'Montagem da Kali: imagem oficial importada como VM, ligada só à VLAN atacante, IPv6 desligado e sem DNS externo, ' +
        'senha padrão trocada e usuário local. Ela não tem agente de monitoração (para poder agir como um atacante de verdade) ' +
        'e é acessada pelo console do virtualizador.',
      'A partir dela se reproduzem varredura de portas, força bruta, exploração das aplicações da isca e comandos pós-acesso ' +
        'nos alvos internos. As detecções geradas são registradas como exercícios Red × Blue na Matriz ATT&CK. ' +
        'Durante a validação, sondas controladas (varredura de portas, enumeração de usuários do WordPress e ataques web) ' +
        'confirmaram que as regras disparam de ponta a ponta.',
    ],
  },
  {
    id: 'blue',
    titulo: 'Detecção (blue team · Wazuh)',
    icone: 'pi-eye',
    resumo: 'Agentes, syslog do firewall e logs dos honeypots viram regras com técnica MITRE; o coletor leva tudo ao app.',
    paragrafos: [
      'O Wazuh recebe os agentes (Windows vítima, honeypot, Windows exposto), o syslog do firewall e os logs em JSON dos ' +
        'honeypots. Regras próprias associam cada evento a uma técnica MITRE. Um coletor leva os alertas ao app (Radar e ' +
        'Matriz ATT&CK) por um canal autenticado; os honeypots seguem sem saída, quem fala com o app é a VM do Wazuh.',
      'Algumas detecções não estão num evento isolado, só no padrão entre eventos — a varredura de portas, por exemplo, é ' +
        'uma regra de correlação. Iscas (honeytokens) cobrem o atacante que já entrou por outro caminho: qualquer uso dispara alerta de alta prioridade.',
    ],
  },
  {
    id: 'operacao',
    titulo: 'Como operar',
    icone: 'pi-sliders-h',
    resumo: 'Abrir/fechar a exposição, limpar alvos, ver ataques e investigar a fundo.',
    tabela: {
      colunas: ['Ação', 'Como'],
      linhas: [
        ['Encerrar a exposição', 'Desativar as regras de entrada no firewall'],
        ['Prorrogar', 'Mudar o fim do agendamento (ou deixar sem prazo)'],
        ['Limpar um alvo real agora', 'Rodar o serviço de reset (rollback do snapshot "limpo")'],
        ['Ver ataques', 'App → Radar e Matriz ATT&CK'],
        ['Isca tocada', 'Wazuh (regras de canário) → Radar; ver o alerta e desligar o que foi usado'],
        ['Investigar a fundo', 'Wazuh (alertas), logs dos honeypots e do firewall'],
      ],
    },
  },
  {
    id: 'dominio-ad',
    titulo: 'Domínio Active Directory (laboratório)',
    icone: 'pi-server',
    resumo: 'Um controlador de domínio de laboratório no segmento de alvos internos, com a vítima Windows ingressada, para treinar ataques de identidade.',
    paragrafos: [
      'Para exercitar ataques que só existem em redes com Active Directory, o laboratório ganhou um controlador de domínio (DC) próprio, instalado de forma não-interativa e colocado no mesmo segmento das vítimas internas. A vítima Windows foi ingressada nesse domínio, reproduzindo uma rede corporativa pequena.',
      'O DC recebe o mesmo agente de monitoração das demais máquinas e encaminha os eventos de segurança — inclusive os de Kerberos — para o SIEM. A auditoria de tickets de serviço é ligada de propósito, para que cada pedido de ticket vire evento e possa ser correlacionado.',
      'Uma conta de serviço com um SPN é criada como alvo didático, propositalmente configurada com cifra fraca (RC4): o perfil de conta legada que torna o Kerberoasting viável — e detectável.',
    ],
    itens: [
      'Controlador de domínio dedicado, no segmento de alvos internos (sem saída para a internet).',
      'Vítima Windows ingressada no domínio, com agente de monitoração e Sysmon.',
      'Agente no DC encaminhando o canal de Segurança (eventos de Kerberos) para o SIEM.',
      'Conta de serviço com SPN e cifra fraca, como alvo de Kerberoasting.',
      'Endereços, nomes e credenciais reais ficam na documentação privada, fora deste repositório.',
    ],
  },
];

export const DOC_TESTES: DocTeste[] = [
  {
    id: 'teste-scan',
    codigo: 'T1046',
    titulo: 'Varredura de portas',
    tatica: 'Descoberta / reconhecimento',
    alvo: 'Todas as portas expostas no firewall',
    comoAbre: 'Vários serviços publicados por endereços virtuais no firewall; as portas não mapeadas são negadas e registradas.',
    comoAtaca: 'Um mesmo IP toca muitas portas em pouco tempo (nmap, botnets de varredura).',
    deteccao: 'Regra de correlação no Wazuh: mesmo IP da internet em 8+ portas diferentes em 5 min (pelo log do firewall).',
    resultado: 'Scan externo real detectado (um IP em 8+ portas) e confirmado com varredura controlada na validação.',
  },
  {
    id: 'teste-ssh-brute',
    codigo: 'T1110',
    titulo: 'Força bruta de credenciais',
    tatica: 'Acesso a credenciais',
    alvo: 'Honeypot SSH/Telnet e Windows exposto',
    comoAbre: 'SSH/Telnet e RDP publicados; o honeypot aceita só senhas fracas comuns (aceitar qualquer senha denunciaria a isca).',
    comoAtaca: 'Tentativas contínuas de login com usuário/senha vindas da internet.',
    deteccao: 'Repetição de falhas de logon vira alerta; no Windows, logon falho mapeado como T1110.',
    resultado: 'Dezenas de milhares de tentativas por mês, de várias origens; honeypot isolado, sem bloqueio (observação proposital).',
  },
  {
    id: 'teste-cmd',
    codigo: 'T1059',
    titulo: 'Execução de comandos pós-acesso',
    tatica: 'Execução',
    alvo: 'Honeypot SSH de alta interação',
    comoAbre: 'Depois do login aceito, o honeypot repassa a sessão a um Linux real descartável e grava tudo.',
    comoAtaca: 'O atacante executa comandos de shell (baixar e rodar payloads, reconhecimento).',
    deteccao: 'Cada comando do honeypot vira um alerta com o comando registrado.',
    resultado: 'Comandos de download/execução capturados; nenhum atinge host de produção; reset periódico restaura o alvo.',
  },
  {
    id: 'teste-web',
    codigo: 'T1190',
    titulo: 'Exploração de aplicação web',
    tatica: 'Acesso inicial',
    alvo: 'Isca web (WordPress, DVWA, Juice Shop)',
    comoAbre: 'Domínio próprio apontando direto para o IP público (sem CDN), cada subdomínio para um app vulnerável; nginx grava toda requisição.',
    comoAtaca: 'SQL injection, path traversal, XSS e tentativas nos endpoints dos plugins vulneráveis.',
    deteccao: 'Regras próprias no log do nginx + ataque web com resposta 200; toda requisição não estática também vira alerta.',
    resultado: 'Ataques web reais da internet e sondas controladas na validação; isca isolada e com reset diário.',
  },
  {
    id: 'teste-webshell',
    codigo: 'T1505.003',
    titulo: 'Webshell (arquivo PHP plantado)',
    tatica: 'Persistência',
    alvo: 'Pasta do WordPress na isca web',
    comoAbre: 'Plugins com upload sem autenticação e escrita na pasta do site; FIM (monitor de integridade) vigia a pasta em tempo real.',
    comoAtaca: 'Gravar um .php novo (webshell) na área do site para manter acesso.',
    deteccao: 'FIM detecta PHP novo/alterado no site → alerta T1505.003 (entra sem IP: o monitor não sabe quem gravou).',
    resultado: 'Alteração de arquivo PHP detectada; evidência preservada no Wazuh antes do reset.',
  },
  {
    id: 'teste-wp-enum',
    codigo: 'T1589',
    titulo: 'Enumeração de usuários (WordPress)',
    tatica: 'Reconhecimento',
    alvo: 'Isca web (WordPress)',
    comoAbre: 'Endpoint de autor do WordPress exposto (dado enumerado é fictício, de propósito).',
    comoAtaca: 'Varredura de autores (?author=N) para descobrir nomes de login.',
    deteccao: 'Regra própria casa a varredura de autores → alerta T1589.',
    resultado: 'Enumeração real e confirmada com sondas controladas na validação.',
  },
  {
    id: 'teste-reflexao',
    codigo: 'T1498.002',
    titulo: 'Reflexão/amplificação UDP',
    tatica: 'Impacto (negação de serviço)',
    alvo: 'Portas UDP no firewall',
    comoAbre: 'As portas UDP de reflexão (DNS, NTP, SSDP, memcached) são encaminhadas e caem numa regra de bloqueio com log; nada responde.',
    comoAtaca: 'Pacotes com origem falsificada tentam usar o IP como refletor de DDoS contra terceiros.',
    deteccao: 'O firewall registra e descarta; o Wazuh marca T1498.002. Como a origem é falsa, o "IP de origem" logado é a vítima pretendida.',
    resultado: 'Tentativas de reflexão registradas sem nunca responder — o IP não vira arma.',
  },
  {
    id: 'teste-container',
    codigo: 'T1610',
    titulo: 'Deploy de container (API Docker exposta)',
    tatica: 'Execução / escalonamento',
    alvo: 'Isca da API do Docker',
    comoAbre: 'A porta da API do Docker é publicada e cai numa isca que fala o protocolo mínimo, sem executar nada.',
    comoAtaca: 'Criar/rodar container pela API exposta (abuso típico para minerar ou escapar).',
    deteccao: 'A isca registra create/exec/image pull → alerta T1610 (e T1204 na tentativa de trazer imagem).',
    resultado: 'Tentativas externas de subir container registradas; nenhum container real sobe.',
  },
  {
    id: 'teste-canario',
    codigo: 'T1552.001',
    titulo: 'Credencial isca (honeytoken)',
    tatica: 'Acesso a credenciais',
    alvo: 'Arquivo e conta isca no Windows Server real',
    comoAbre: 'Arquivo com credenciais falsas numa pasta compartilhada, com auditoria de leitura ligada só nessa pasta; conta isca sem privilégio.',
    comoAtaca: 'Um atacante que já entrou procura segredos e abre o arquivo isca ou tenta a conta isca.',
    deteccao: 'Qualquer leitura do arquivo (evento 4663) ou uso da conta dispara alerta de alta prioridade (T1552.001 / T1078).',
    resultado: 'Detecção de alta fidelidade: todo acesso ao canário é suspeito por definição.',
  },
  {
    id: 'teste-persistencia-win',
    codigo: 'T1543',
    titulo: 'Persistência por serviço (Windows)',
    tatica: 'Persistência',
    alvo: 'Windows vítima (Sysmon + agente)',
    comoAbre: 'Windows vítima isolado no segmento de alvos internos, com Sysmon e auditoria ligados.',
    comoAtaca: 'Criar um novo serviço no registro para rodar a cada boot (reproduzido pela Kali).',
    deteccao: 'Novo serviço no registro (via FIM/Sysmon) vira alerta T1543.',
    resultado: 'Serviço plantado detectado; removido no reset do snapshot "limpo".',
  },
  {
    id: 'teste-egress',
    codigo: 'T1071',
    titulo: 'Saída não autorizada (C2)',
    tatica: 'Comando e controle',
    alvo: 'Todos os segmentos de ataque',
    comoAbre: 'Nenhum segmento exposto tem saída para a internet; qualquer tentativa é negada e registrada.',
    comoAtaca: 'Um host comprometido tenta "ligar para casa" (resolver DNS, buscar a 2ª etapa do malware).',
    deteccao: 'O firewall nega a saída e registra; o Wazuh marca a tentativa (T1071).',
    resultado: 'Confirma o isolamento: nenhuma saída não autorizada completa — o malware não baixa a próxima etapa.',
  },
  {
    id: 'teste-kerberoasting',
    codigo: 'T1558.003',
    titulo: 'Kerberoasting',
    tatica: 'Acesso a credenciais',
    alvo: 'Conta de serviço com SPN no domínio',
    comoAbre: 'O domínio tem uma conta de serviço com SPN e cifra fraca (RC4); qualquer usuário autenticado pode pedir um ticket de serviço para esse SPN.',
    comoAtaca: 'A partir de um foothold na vítima, o atacante pede o ticket de serviço (TGS) do SPN. O ticket vem cifrado com a chave derivada da senha da conta, que pode ser quebrada offline, sem tocar na conta.',
    deteccao: 'Regra no Wazuh que casa o evento de pedido de ticket de serviço (4769) com cifra RC4 para um serviço que não é conta de máquina — a assinatura do Kerberoasting.',
    resultado: 'Pedido de ticket RC4 detectado (nível 12, T1558.003); o ticket saiu em RC4, confirmando a técnica.',
  },
  {
    id: 'teste-cred-dump',
    codigo: 'T1003.001',
    titulo: 'Dump de credenciais (LSASS)',
    tatica: 'Acesso a credenciais',
    alvo: 'Processo de segurança do Windows (LSASS) na vítima',
    comoAbre: 'Com privilégio de administrador local na vítima, a memória do processo que guarda as credenciais pode ser despejada em arquivo.',
    comoAtaca: 'Uma biblioteca nativa do Windows é usada para gerar um despejo da memória do LSASS, de onde se extraem hashes e segredos de sessão.',
    deteccao: 'Regra no Wazuh sobre o Sysmon (criação de processo): linha de comando que combina a técnica de despejo de memória com o LSASS.',
    resultado: 'Tentativa de dump detectada (nível 12, T1003.001); o arquivo gerado foi apagado logo após o teste.',
  },
  {
    id: 'teste-tarefa-agendada',
    codigo: 'T1053.005',
    titulo: 'Tarefa agendada (persistência)',
    tatica: 'Persistência / execução',
    alvo: 'Agendador de tarefas da vítima Windows',
    comoAbre: 'Com privilégio na vítima, é possível criar tarefas agendadas que rodam comandos de forma recorrente.',
    comoAtaca: 'O atacante cria uma tarefa agendada que executa um comando — mecanismo clássico de persistência e de execução programada.',
    deteccao: 'A auditoria de criação de tarefas foi ligada (evento 4698) e uma regra no Wazuh marca a criação da tarefa.',
    resultado: 'Criação de tarefa detectada (nível 10, T1053.005); a tarefa de teste foi removida.',
  },
  {
    id: 'teste-inibir-recuperacao',
    codigo: 'T1490',
    titulo: 'Inibir recuperação do sistema',
    tatica: 'Impacto',
    alvo: 'Cópias de sombra e recuperação da vítima',
    comoAbre: 'Com privilégio, comandos nativos do Windows apagam as cópias de sombra e desligam a recuperação automática.',
    comoAtaca: 'Precursor típico de ransomware: destruir backups locais e a recuperação antes de cifrar, para dificultar a volta ao estado anterior.',
    deteccao: 'Regra no Wazuh sobre o Sysmon: linhas de comando de exclusão de cópias de sombra e de desligamento da recuperação.',
    resultado: 'Comandos detectados (nível 13, T1490); a recuperação do sistema foi reativada após o teste.',
  },
  {
    id: 'teste-ransomware',
    codigo: 'T1486',
    titulo: 'Criptografia para impacto (ransomware)',
    tatica: 'Impacto',
    alvo: 'Pasta de arquivos-isca monitorada na vítima',
    comoAbre: 'Uma pasta com arquivos-isca descartáveis é monitorada em tempo real pelo FIM; nada real é tocado.',
    comoAtaca: 'Simulação de ransomware: os arquivos-isca são sobrescritos e ganham extensão de cifra, e uma nota de resgate é criada na pasta.',
    deteccao: 'O FIM do Wazuh reporta os arquivos novos; uma regra marca a extensão de cifra e a nota de resgate.',
    resultado: 'Criação dos arquivos cifrados e da nota detectada (nível 13, T1486); a pasta-isca foi removida.',
  },
  {
    id: 'teste-exfiltracao',
    codigo: 'T1041',
    titulo: 'Exfiltração de dados',
    tatica: 'Exfiltração',
    alvo: 'Saída de rede da vítima Windows',
    comoAbre: 'A vítima não tem saída livre para a internet; a tentativa de envio é registrada mesmo quando é bloqueada.',
    comoAtaca: 'O atacante coleta dados e tenta enviá-los para fora por requisição web (upload via POST).',
    deteccao: 'Regra no Wazuh sobre o Sysmon: linha de comando com padrões de upload web (envio de dados para fora).',
    resultado: 'Tentativa de envio detectada (nível 12, T1041); a saída foi barrada pelo isolamento do segmento.',
  },
  {
    id: 'teste-asrep',
    codigo: 'T1558.004',
    titulo: 'AS-REP Roasting',
    tatica: 'Acesso a credenciais',
    alvo: 'Conta sem pré-autenticação Kerberos no domínio',
    comoAbre: 'Uma conta marcada como "não exige pré-autenticação" permite que qualquer um peça seu material de autenticação (AS-REP), cuja parte cifrada é quebrável offline.',
    comoAtaca: 'O atacante pede o AS-REP da conta sem conhecer a senha e tenta quebrar a senha offline, sem tocar na conta.',
    deteccao: 'Regra no Wazuh: pedido de TGT (4768) com pré-autenticação tipo 0 para uma conta de usuário — a marca da conta roastável (contas normais usam tipo 2).',
    resultado: 'Pedido de TGT sem pré-autenticação detectado (nível 12, T1558.004).',
  },
  {
    id: 'teste-dcsync',
    codigo: 'T1003.006',
    titulo: 'DCSync (direitos de replicação)',
    tatica: 'Acesso a credenciais',
    alvo: 'Descritor de segurança do objeto de domínio',
    comoAbre: 'Conceder a uma conta comum os direitos de replicação de diretório cria um backdoor que, depois, permite extrair as senhas de todo o domínio — inclusive a chave que assina todos os tickets.',
    comoAtaca: 'O atacante concede a si os direitos de replicação (persistência) e depois os usa para pedir os segredos ao controlador de domínio, como se fosse outro DC.',
    deteccao: 'Regra no Wazuh: alteração do descritor de segurança do domínio (5136) incluindo os direitos de replicação — o ponto de detecção mais precoce e confiável.',
    resultado: 'Concessão dos direitos de replicação detectada (nível 13, T1003.006). O laboratório isolado bloqueia os binários de extração — bloqueio que é, ele mesmo, um controle. Os direitos foram removidos após o teste.',
  },
  {
    id: 'teste-lateral',
    codigo: 'T1021.002',
    titulo: 'Movimento lateral por serviço remoto',
    tatica: 'Movimento lateral',
    alvo: 'Gerenciador de serviços de outra máquina do domínio',
    comoAbre: 'Com uma credencial privilegiada, é possível criar e iniciar um serviço remotamente em outra máquina — execução de código à distância.',
    comoAtaca: 'O atacante cria, em outra máquina, um serviço cujo binário é um shell (ou um utilitário do próprio Windows) para rodar comandos no destino.',
    deteccao: 'Regra no Wazuh: instalação de serviço (7045) cujo binário é um shell / utilitário comum de ataque — a assinatura da execução remota por serviço.',
    resultado: 'Serviço remoto detectado no destino (nível 12, T1021.002); o serviço de teste foi removido.',
  },
  {
    id: 'teste-grupo-privilegiado',
    codigo: 'T1098',
    titulo: 'Adição a grupo privilegiado',
    tatica: 'Persistência / escalada',
    alvo: 'Grupos privilegiados do domínio',
    comoAbre: 'Quem controla uma conta com poder de administrar grupos pode adicionar qualquer conta a um grupo de alto privilégio.',
    comoAtaca: 'O atacante adiciona uma conta comum a um grupo privilegiado (por exemplo, os administradores do domínio) — escalada e persistência de uma vez.',
    deteccao: 'Regra no Wazuh: conta adicionada (4728/4732) a um grupo privilegiado conhecido.',
    resultado: 'Adição ao grupo privilegiado detectada (nível 12, T1098); a conta foi removida do grupo logo após o teste.',
  },
  {
    id: 'teste-wmi-exec',
    codigo: 'T1047',
    titulo: 'Execução remota via WMI',
    tatica: 'Execução',
    alvo: 'Serviço WMI da vítima Windows',
    comoAbre: 'O WMI (instrumentação de gerência do Windows) permite criar processos — localmente ou de outra máquina — por um canal administrativo legítimo.',
    comoAtaca: 'O atacante usa o WMI para iniciar um shell ou utilitário na vítima, sem copiar um executável próprio (vive-da-terra).',
    deteccao: 'Regra no Wazuh sobre o Sysmon (criação de processo): o host do provedor WMI aparece como pai de um shell/LOLBin ou de um PowerShell — a assinatura da execução por WMI.',
    resultado: 'Processo criado pelo WMI detectado (nível 12, T1047); confirmado também pela regra nativa de WMI→PowerShell.',
  },
  {
    id: 'teste-lolbin',
    codigo: 'T1218',
    titulo: 'Proxy de execução por binário confiável (LOLBin)',
    tatica: 'Evasão de defesa / execução',
    alvo: 'Binários assinados do Windows na vítima',
    comoAbre: 'Vários utilitários assinados da Microsoft (regsvr32, mshta, rundll32) sabem baixar e executar script — e, por serem confiáveis, passam despercebidos.',
    comoAtaca: 'O atacante usa esses binários para rodar script/scriptlet (ex.: regsvr32 "squiblydoo", mshta com .hta, rundll32 com javascript), mascarando a execução sob um processo legítimo.',
    deteccao: 'Regra no Wazuh sobre o Sysmon: um desses binários confiáveis com a linha de comando no padrão de proxy-execution (scrobj, /i:, javascript:, .hta, RunHTMLApplication).',
    resultado: 'Execução por LOLBin detectada (nível 12, T1218) para regsvr32 e mshta.',
  },
  {
    id: 'teste-wmi-persist',
    codigo: 'T1546.003',
    titulo: 'Persistência por assinatura de evento WMI',
    tatica: 'Persistência',
    alvo: 'Repositório de assinaturas WMI da vítima',
    comoAbre: 'O WMI permite registrar um "gatilho + ação" permanente: quando um evento acontece, um comando é executado — persistência que sobrevive a reinícios e não deixa arquivo óbvio.',
    comoAtaca: 'O atacante cria um filtro de evento, um consumidor de linha de comando e o vínculo entre eles, para rodar um comando automaticamente.',
    deteccao: 'Regra (nativa) no Wazuh sobre o Sysmon (eventos 19/20/21 de WMI): criação de um consumidor de evento WMI que executa binário de comando.',
    resultado: 'Criação do consumidor WMI detectada (nível 14, T1546.003); filtro, consumidor e vínculo foram removidos após o teste.',
  },
  {
    id: 'teste-run-key',
    codigo: 'T1547.001',
    titulo: 'Persistência por chave Run no registro',
    tatica: 'Persistência',
    alvo: 'Chaves de inicialização do registro da vítima',
    comoAbre: 'As chaves "Run" do registro executam um programa a cada logon — o mecanismo de autostart mais clássico.',
    comoAtaca: 'O atacante grava um valor apontando para seu executável nas chaves Run (da máquina e do usuário), para rodar a cada logon.',
    deteccao: 'Regra (nativa) no Wazuh sobre o Sysmon (alteração de registro, evento 13): valor escrito numa chave CurrentVersion\\Run por ferramenta de linha de comando.',
    resultado: 'Escrita na chave Run detectada (nível 6, T1547.001) na máquina e no usuário; os valores foram removidos após o teste.',
  },
];
