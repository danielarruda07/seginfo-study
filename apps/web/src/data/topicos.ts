import type { Topico } from '@seginfo/shared';

/**
 * Catálogo de tópicos de estudo de Segurança da Informação.
 * Ferramentas marcadas por referência de mercado:
 *  - gartner_leader: líder no Gartner Magic Quadrant da categoria
 *  - owasp / nist: referência de órgão/framework oficial
 *  - open_source: líder open source da categoria
 *  - mercado: padrão de fato amplamente adotado
 */
export const TOPICOS: Topico[] = [
  // ===================== FUNDAMENTOS =====================
  {
    id: 'fund-cia',
    trilhaId: 'fundamentos',
    titulo: 'Tríade CIA e princípios de segurança',
    nivel: 'basico',
    resumo: 'Confidencialidade, Integridade e Disponibilidade — a base de toda decisão de segurança.',
    conceitosChave: ['Confidencialidade', 'Integridade', 'Disponibilidade', 'Não-repúdio', 'Autenticidade', 'Defesa em profundidade', 'Menor privilégio'],
    ferramentas: [],
    recursos: [
      { titulo: 'NIST — Glossário de termos (CIA)', url: 'https://csrc.nist.gov/glossary', tipo: 'doc' },
    ],
    tags: ['conceito', 'base'],
  },
  {
    id: 'fund-frameworks',
    trilhaId: 'fundamentos',
    titulo: 'Frameworks: NIST CSF, ISO 27001 e CIS Controls',
    nivel: 'intermediario',
    resumo: 'Os frameworks de referência mundial para estruturar um programa de segurança.',
    conceitosChave: ['NIST CSF 2.0 (Govern/Identify/Protect/Detect/Respond/Recover)', 'ISO/IEC 27001', 'CIS Critical Security Controls v8', 'Gestão de risco'],
    ferramentas: [
      { nome: 'NIST Cybersecurity Framework 2.0', descricao: 'Framework de referência mundial para gestão de risco cibernético.', referencia: 'nist', url: 'https://www.nist.gov/cyberframework' },
      { nome: 'CIS Controls v8', descricao: 'Conjunto priorizado de controles de defesa, referência prática de mercado.', referencia: 'mercado', url: 'https://www.cisecurity.org/controls' },
    ],
    recursos: [
      { titulo: 'NIST CSF 2.0', url: 'https://www.nist.gov/cyberframework', tipo: 'doc' },
      { titulo: 'CIS Controls', url: 'https://www.cisecurity.org/controls', tipo: 'doc' },
    ],
    tags: ['governanca', 'framework', 'iso27001'],
  },
  {
    id: 'fund-mitre',
    trilhaId: 'fundamentos',
    titulo: 'MITRE ATT&CK — táticas e técnicas de adversários',
    nivel: 'intermediario',
    resumo: 'Base de conhecimento de referência mundial sobre comportamento de adversários, usada por Blue e Red Team.',
    conceitosChave: ['Táticas x Técnicas', 'TTPs', 'ATT&CK Matrix (Enterprise)', 'Mapeamento de detecções', 'D3FEND'],
    ferramentas: [
      { nome: 'MITRE ATT&CK', descricao: 'Base de conhecimento de referência mundial sobre TTPs de adversários.', referencia: 'mercado', url: 'https://attack.mitre.org' },
    ],
    recursos: [
      { titulo: 'MITRE ATT&CK', url: 'https://attack.mitre.org', tipo: 'doc' },
    ],
    tags: ['mitre', 'ttp', 'base'],
  },

  // ===================== FIREWALL =====================
  {
    id: 'fw-ngfw',
    trilhaId: 'firewall',
    titulo: 'NGFW: líderes de mercado e conceitos',
    nivel: 'intermediario',
    resumo: 'Next-Generation Firewalls segundo o Gartner Magic Quadrant Network Firewalls.',
    conceitosChave: ['Inspeção de pacotes (DPI)', 'Application control', 'IPS/IDS integrado', 'SSL inspection', 'Zonas e políticas'],
    ferramentas: [
      { nome: 'Palo Alto Networks', descricao: 'Líder histórico do Gartner MQ de Network Firewalls.', referencia: 'gartner_leader', url: 'https://www.paloaltonetworks.com' },
      { nome: 'Fortinet FortiGate', descricao: 'Líder Gartner MQ; seu diferencial no headline — aprofundar aqui.', referencia: 'gartner_leader', url: 'https://www.fortinet.com' },
      { nome: 'Check Point', descricao: 'Líder Gartner MQ de Network Firewalls.', referencia: 'gartner_leader', url: 'https://www.checkpoint.com' },
      { nome: 'SonicWall', descricao: 'Fabricante de mercado; seu histórico na Energy Telecom.', referencia: 'mercado', url: 'https://www.sonicwall.com' },
    ],
    recursos: [
      { titulo: 'Fortinet Docs Library', url: 'https://docs.fortinet.com', tipo: 'doc' },
    ],
    tags: ['fortigate', 'firewall', 'ngfw', 'gartner'],
  },
  {
    id: 'fw-vpn',
    trilhaId: 'firewall',
    titulo: 'VPN, IPSec e acesso remoto seguro (ZTNA)',
    nivel: 'intermediario',
    resumo: 'Túneis site-to-site, SSL-VPN e a evolução para Zero Trust Network Access.',
    conceitosChave: ['IPSec (IKEv2)', 'SSL-VPN', 'Split tunneling', 'ZTNA vs VPN tradicional', 'SASE'],
    ferramentas: [
      { nome: 'FortiClient / FortiGate SSL-VPN', descricao: 'Acesso remoto no ecossistema Fortinet.', referencia: 'gartner_leader', url: 'https://www.fortinet.com' },
    ],
    recursos: [
      { titulo: 'Gartner — SASE', url: 'https://www.gartner.com/en/information-technology/glossary/secure-access-service-edge-sase', tipo: 'artigo' },
    ],
    tags: ['vpn', 'ztna', 'sase'],
  },

  // ===================== BLUE TEAM =====================
  {
    id: 'blue-edr',
    trilhaId: 'blueteam',
    titulo: 'EDR / Endpoint Protection — líderes de mercado',
    nivel: 'intermediario',
    resumo: 'Proteção de endpoint segundo o Gartner MQ de Endpoint Protection Platforms.',
    conceitosChave: ['EPP vs EDR vs XDR', 'Detecção comportamental', 'Resposta automatizada', 'Telemetria de endpoint'],
    ferramentas: [
      { nome: 'CrowdStrike Falcon', descricao: 'Líder do Gartner MQ de EPP.', referencia: 'gartner_leader', url: 'https://www.crowdstrike.com' },
      { nome: 'Microsoft Defender for Endpoint', descricao: 'Líder Gartner MQ de EPP, forte integração com Windows/AD.', referencia: 'gartner_leader', url: 'https://www.microsoft.com/security' },
      { nome: 'SentinelOne', descricao: 'Líder Gartner MQ de EPP.', referencia: 'gartner_leader', url: 'https://www.sentinelone.com' },
      { nome: 'Kaspersky', descricao: 'Fabricante de mercado; seu histórico de gestão de antivírus no TJ-CE.', referencia: 'mercado', url: 'https://www.kaspersky.com' },
    ],
    recursos: [],
    tags: ['edr', 'endpoint', 'kaspersky', 'gartner'],
  },
  {
    id: 'blue-hardening',
    trilhaId: 'blueteam',
    titulo: 'Hardening com CIS Benchmarks',
    nivel: 'intermediario',
    resumo: 'Configuração segura de sistemas seguindo os CIS Benchmarks (referência de mercado).',
    conceitosChave: ['CIS Benchmarks', 'Baseline de configuração', 'Superfície de ataque', 'GPO de segurança (Windows)'],
    ferramentas: [
      { nome: 'CIS-CAT', descricao: 'Ferramenta de avaliação de conformidade com CIS Benchmarks.', referencia: 'mercado', url: 'https://www.cisecurity.org/cybersecurity-tools/cis-cat-pro' },
    ],
    recursos: [
      { titulo: 'CIS Benchmarks', url: 'https://www.cisecurity.org/cis-benchmarks', tipo: 'doc' },
    ],
    tags: ['hardening', 'cis', 'windows', 'gpo'],
  },
  {
    id: 'blue-hunting',
    trilhaId: 'blueteam',
    titulo: 'Threat Hunting e análise de logs',
    nivel: 'avancado',
    resumo: 'Caça proativa a ameaças usando hipóteses baseadas em MITRE ATT&CK e telemetria.',
    conceitosChave: ['Hipóteses de caça', 'IOC vs IOA', 'Pirâmide da dor', 'Análise de logs', 'Sigma rules'],
    ferramentas: [
      { nome: 'Sigma', descricao: 'Formato aberto e padrão de mercado para regras de detecção portáveis.', referencia: 'open_source', url: 'https://github.com/SigmaHQ/sigma' },
    ],
    recursos: [],
    tags: ['threat-hunting', 'mitre', 'logs'],
  },

  // ===================== RED TEAM =====================
  {
    id: 'red-metodologia',
    trilhaId: 'redteam',
    titulo: 'Metodologia de pentest (recon → exploração)',
    nivel: 'intermediario',
    resumo: 'As fases do teste de intrusão: reconhecimento, enumeração, avaliação e exploração.',
    conceitosChave: ['Reconhecimento', 'Enumeração', 'Avaliação de vulnerabilidades', 'Exploração', 'Pós-exploração', 'PTES / OWASP WSTG'],
    ferramentas: [
      { nome: 'OWASP WSTG', descricao: 'Guia de testes de segurança web — referência OWASP.', referencia: 'owasp', url: 'https://owasp.org/www-project-web-security-testing-guide' },
    ],
    recursos: [
      { titulo: 'OWASP Web Security Testing Guide', url: 'https://owasp.org/www-project-web-security-testing-guide', tipo: 'doc' },
    ],
    tags: ['pentest', 'metodologia'],
  },
  {
    id: 'red-nmap',
    trilhaId: 'redteam',
    titulo: 'Nmap — enumeração de rede',
    nivel: 'basico',
    resumo: 'Scanner de rede padrão de fato para descoberta de hosts, portas e serviços.',
    conceitosChave: ['Host discovery', 'Port scan (-sS/-sT)', 'Service/version (-sV)', 'NSE scripts', 'OS fingerprint'],
    ferramentas: [
      { nome: 'Nmap', descricao: 'Scanner de rede, padrão de fato da indústria.', referencia: 'mercado', url: 'https://nmap.org' },
    ],
    recursos: [
      { titulo: 'Nmap Reference Guide', url: 'https://nmap.org/book/man.html', tipo: 'doc' },
    ],
    tags: ['nmap', 'enumeracao', 'rede'],
  },
  {
    id: 'red-metasploit',
    trilhaId: 'redteam',
    titulo: 'Metasploit Framework',
    nivel: 'intermediario',
    resumo: 'Framework de exploração padrão de mercado para validação de vulnerabilidades.',
    conceitosChave: ['msfconsole', 'Modules (exploit/payload/auxiliary)', 'Meterpreter', 'Listeners'],
    ferramentas: [
      { nome: 'Metasploit', descricao: 'Framework de exploração, padrão de mercado.', referencia: 'mercado', url: 'https://www.metasploit.com' },
    ],
    recursos: [
      { titulo: 'Metasploit Docs', url: 'https://docs.metasploit.com', tipo: 'doc' },
    ],
    tags: ['metasploit', 'exploracao'],
  },

  // ===================== WEB / APPSEC =====================
  {
    id: 'web-owasp-top10',
    trilhaId: 'web',
    titulo: 'OWASP Top 10',
    nivel: 'basico',
    resumo: 'Os 10 riscos mais críticos de aplicações web — referência mundial OWASP.',
    conceitosChave: ['Broken Access Control', 'Cryptographic Failures', 'Injection', 'Insecure Design', 'SSRF'],
    ferramentas: [
      { nome: 'OWASP Top 10', descricao: 'Lista de riscos de referência mundial em AppSec.', referencia: 'owasp', url: 'https://owasp.org/www-project-top-ten' },
    ],
    recursos: [
      { titulo: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten', tipo: 'doc' },
      { titulo: 'PortSwigger Web Security Academy', url: 'https://portswigger.net/web-security', tipo: 'curso' },
    ],
    tags: ['owasp', 'web', 'appsec'],
  },
  {
    id: 'web-burp',
    trilhaId: 'web',
    titulo: 'Burp Suite — proxy de interceptação',
    nivel: 'intermediario',
    resumo: 'Ferramenta de referência mundial para teste de segurança de aplicações web.',
    conceitosChave: ['Proxy/Intercept', 'Repeater', 'Intruder', 'Scanner (Pro)', 'Extensions'],
    ferramentas: [
      { nome: 'Burp Suite', descricao: 'Referência de mercado para pentest web (PortSwigger).', referencia: 'mercado', url: 'https://portswigger.net/burp' },
    ],
    recursos: [
      { titulo: 'PortSwigger Labs', url: 'https://portswigger.net/web-security/all-labs', tipo: 'lab' },
      { titulo: 'OWASP Juice Shop', url: 'https://owasp.org/www-project-juice-shop', tipo: 'lab' },
    ],
    tags: ['burp', 'web', 'proxy'],
  },
  {
    id: 'web-sast',
    trilhaId: 'web',
    titulo: 'SAST e segurança de dependências',
    nivel: 'avancado',
    resumo: 'Análise estática de código e de dependências (SCA) no pipeline.',
    conceitosChave: ['SAST vs DAST', 'SCA', 'Secrets scanning', 'Shift-left security'],
    ferramentas: [
      { nome: 'CodeQL', descricao: 'Análise estática da GitHub, referência de mercado.', referencia: 'mercado', url: 'https://codeql.github.com' },
      { nome: 'Semgrep', descricao: 'SAST open source amplamente adotado.', referencia: 'open_source', url: 'https://semgrep.dev' },
      { nome: 'OWASP Dependency-Check', descricao: 'SCA de referência OWASP.', referencia: 'owasp', url: 'https://owasp.org/www-project-dependency-check' },
    ],
    recursos: [
      { titulo: 'OWASP Secure Coding Practices', url: 'https://owasp.org/www-project-secure-coding-practices-quick-reference-guide', tipo: 'doc' },
    ],
    tags: ['sast', 'sca', 'appsec'],
  },

  // ===================== SIEM =====================
  {
    id: 'siem-mercado',
    trilhaId: 'siem',
    titulo: 'SIEM — líderes de mercado (Gartner MQ)',
    nivel: 'intermediario',
    resumo: 'Plataformas de SIEM segundo o Gartner Magic Quadrant de SIEM.',
    conceitosChave: ['Coleta/normalização de logs', 'Correlação', 'Casos de uso de detecção', 'SOAR', 'UEBA'],
    ferramentas: [
      { nome: 'Microsoft Sentinel', descricao: 'Líder do Gartner MQ de SIEM, cloud-native.', referencia: 'gartner_leader', url: 'https://azure.microsoft.com/products/microsoft-sentinel' },
      { nome: 'Splunk', descricao: 'Líder histórico do Gartner MQ de SIEM.', referencia: 'gartner_leader', url: 'https://www.splunk.com' },
      { nome: 'IBM QRadar', descricao: 'Líder do Gartner MQ de SIEM.', referencia: 'gartner_leader', url: 'https://www.ibm.com/qradar' },
      { nome: 'Wazuh', descricao: 'SIEM/XDR open source líder da categoria.', referencia: 'open_source', url: 'https://wazuh.com' },
    ],
    recursos: [],
    tags: ['siem', 'soc', 'gartner', 'wazuh'],
  },
  {
    id: 'siem-soc',
    trilhaId: 'siem',
    titulo: 'Operação de SOC e correlação de eventos',
    nivel: 'avancado',
    resumo: 'Como um SOC usa o SIEM: triagem, casos de uso, playbooks e níveis de analista.',
    conceitosChave: ['Tiers de SOC (L1/L2/L3)', 'Use cases', 'Playbooks SOAR', 'MTTD/MTTR', 'False positives'],
    ferramentas: [],
    recursos: [],
    tags: ['soc', 'siem', 'operacao'],
  },

  // ===================== VULNS =====================
  {
    id: 'vuln-cve-cvss',
    trilhaId: 'vulns',
    titulo: 'CVE, CVSS e priorização',
    nivel: 'basico',
    resumo: 'Identificação, pontuação e priorização de vulnerabilidades com fontes oficiais.',
    conceitosChave: ['CVE', 'CVSS v3.1/v4.0', 'EPSS', 'CISA KEV', 'Janela de remediação'],
    ferramentas: [
      { nome: 'NVD (NIST)', descricao: 'Base nacional de vulnerabilidades — fonte oficial NIST.', referencia: 'nist', url: 'https://nvd.nist.gov' },
      { nome: 'CISA KEV', descricao: 'Catálogo de vulnerabilidades exploradas conhecidas — fonte oficial CISA.', referencia: 'mercado', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },
    ],
    recursos: [
      { titulo: 'CVE.org', url: 'https://www.cve.org', tipo: 'doc' },
      { titulo: 'Exploit Database', url: 'https://www.exploit-db.com', tipo: 'artigo' },
    ],
    tags: ['cve', 'cvss', 'nvd', 'cisa'],
  },
  {
    id: 'vuln-scanners',
    trilhaId: 'vulns',
    titulo: 'Scanners de vulnerabilidade',
    nivel: 'intermediario',
    resumo: 'Ferramentas de varredura para gestão de exposição.',
    conceitosChave: ['Scan autenticado vs não-autenticado', 'Falsos positivos', 'Nuclei templates'],
    ferramentas: [
      { nome: 'Tenable Nessus', descricao: 'Scanner de referência de mercado (Tenable, líder em VM).', referencia: 'gartner_leader', url: 'https://www.tenable.com/products/nessus' },
      { nome: 'Nuclei', descricao: 'Scanner baseado em templates, padrão de mercado open source.', referencia: 'open_source', url: 'https://github.com/projectdiscovery/nuclei' },
      { nome: 'OpenVAS / Greenbone', descricao: 'Scanner open source consolidado.', referencia: 'open_source', url: 'https://www.greenbone.net' },
    ],
    recursos: [],
    tags: ['scanner', 'nessus', 'nuclei'],
  },

  // ===================== OSINT =====================
  {
    id: 'osint-recon',
    trilhaId: 'osint',
    titulo: 'OSINT — ferramentas de referência',
    nivel: 'intermediario',
    resumo: 'Coleta de inteligência em fontes abertas com as ferramentas mais usadas do mercado.',
    conceitosChave: ['Footprinting', 'Pivoting de dados', 'Validação de achados', 'Superfície externa'],
    ferramentas: [
      { nome: 'Shodan', descricao: 'Busca de dispositivos e serviços expostos na internet — referência de mercado.', referencia: 'mercado', url: 'https://www.shodan.io' },
      { nome: 'Maltego', descricao: 'Mapeamento de relações entre entidades — padrão de mercado em OSINT.', referencia: 'mercado', url: 'https://www.maltego.com' },
      { nome: 'theHarvester', descricao: 'Coleta de e-mails/subdomínios — padrão em recon.', referencia: 'open_source', url: 'https://github.com/laramies/theHarvester' },
      { nome: 'Censys', descricao: 'Inventário de ativos expostos na internet.', referencia: 'mercado', url: 'https://censys.io' },
      { nome: 'SpiderFoot', descricao: 'Automação de reconhecimento OSINT.', referencia: 'open_source', url: 'https://www.spiderfoot.net' },
      { nome: 'Have I Been Pwned', descricao: 'Verificação de vazamentos — referência mundial.', referencia: 'mercado', url: 'https://haveibeenpwned.com' },
      { nome: 'OSINT Framework', descricao: 'Catálogo de ferramentas por tipo de investigação.', referencia: 'open_source', url: 'https://osintframework.com' },
    ],
    recursos: [],
    tags: ['osint', 'recon', 'shodan', 'maltego'],
  },

  // ===================== IAM =====================
  {
    id: 'iam-ad',
    trilhaId: 'iam',
    titulo: 'Active Directory Security (seu forte de infra)',
    nivel: 'avancado',
    resumo: 'Ataques e defesas em AD — onde sua experiência de infra vira segurança ofensiva/defensiva.',
    conceitosChave: ['Kerberoasting', 'Pass-the-Hash', 'AS-REP roasting', 'Tiering de AD', 'LAPS', 'Delegações'],
    ferramentas: [
      { nome: 'BloodHound', descricao: 'Mapeamento de caminhos de ataque em AD — referência de mercado.', referencia: 'open_source', url: 'https://github.com/SpecterOps/BloodHound' },
    ],
    recursos: [
      { titulo: 'Microsoft — Securing Active Directory', url: 'https://learn.microsoft.com/windows-server/identity/ad-ds/plan/security-best-practices/best-practices-for-securing-active-directory', tipo: 'doc' },
    ],
    tags: ['ad', 'iam', 'kerberos'],
  },
  {
    id: 'iam-zerotrust',
    trilhaId: 'iam',
    titulo: 'MFA, PAM e Zero Trust',
    nivel: 'intermediario',
    resumo: 'Fortalecimento de identidade: múltiplos fatores, acesso privilegiado e modelo Zero Trust.',
    conceitosChave: ['MFA (FIDO2/TOTP)', 'PAM', 'Zero Trust (NIST SP 800-207)', 'RADIUS/EAP-TLS'],
    ferramentas: [],
    recursos: [
      { titulo: 'NIST SP 800-207 Zero Trust', url: 'https://csrc.nist.gov/pubs/sp/800/207/final', tipo: 'doc' },
    ],
    tags: ['mfa', 'pam', 'zerotrust', 'radius'],
  },

  // ===================== LABS =====================
  {
    id: 'labs-plataformas',
    trilhaId: 'labs',
    titulo: 'Plataformas de laboratório prático',
    nivel: 'basico',
    resumo: 'Onde praticar com mão na massa, de iniciante a avançado.',
    conceitosChave: ['Trilhas guiadas', 'Máquinas CTF', 'Wargames', 'Rooms'],
    ferramentas: [
      { nome: 'TryHackMe', descricao: 'Plataforma guiada, ideal para começar.', referencia: 'mercado', url: 'https://tryhackme.com' },
      { nome: 'Hack The Box', descricao: 'Laboratórios realistas, referência de mercado.', referencia: 'mercado', url: 'https://www.hackthebox.com' },
      { nome: 'OverTheWire', descricao: 'Wargames clássicos de Linux/rede.', referencia: 'open_source', url: 'https://overthewire.org' },
      { nome: 'CTFtime', descricao: 'Agenda e ranking de competições CTF.', referencia: 'open_source', url: 'https://ctftime.org' },
    ],
    recursos: [],
    tags: ['labs', 'ctf', 'pratica'],
  },

  // ===================== CERTIFICAÇÕES =====================
  {
    id: 'cert-roadmap',
    trilhaId: 'certs',
    titulo: 'Roadmap de certificações para migração',
    nivel: 'basico',
    resumo: 'Sequência recomendada aproveitando sua base (CompTIA, ITIL) rumo a segurança.',
    conceitosChave: ['CompTIA Security+', 'CompTIA CySA+', 'CEH', 'PNPT (prático)', 'CISSP (gestão)'],
    ferramentas: [
      { nome: 'CompTIA Security+', descricao: 'Porta de entrada reconhecida mundialmente; aproveita sua base CompTIA.', referencia: 'mercado', url: 'https://www.comptia.org/certifications/security' },
    ],
    recursos: [
      { titulo: 'ISC2 CISSP', url: 'https://www.isc2.org/certifications/cissp', tipo: 'doc' },
    ],
    tags: ['certificacao', 'carreira'],
  },
  ...([
    { id: 'cert-sy0701-1', titulo: 'Security+ SY0-701 — 1.0 Conceitos gerais de segurança', peso: 12, nivel: 'basico' as const, resumo: 'Controles, princípios fundamentais, gestão de mudanças e soluções criptográficas.' },
    { id: 'cert-sy0701-2', titulo: 'Security+ SY0-701 — 2.0 Ameaças, vulnerabilidades e mitigação', peso: 22, nivel: 'intermediario' as const, resumo: 'Atores, vetores, superfícies de ataque, indicadores maliciosos e mitigação.' },
    { id: 'cert-sy0701-3', titulo: 'Security+ SY0-701 — 3.0 Arquitetura de segurança', peso: 18, nivel: 'intermediario' as const, resumo: 'Modelos de arquitetura, infraestrutura, proteção de dados, resiliência e recuperação.' },
    { id: 'cert-sy0701-4', titulo: 'Security+ SY0-701 — 4.0 Operações de segurança', peso: 28, nivel: 'intermediario' as const, resumo: 'Hardening, ativos e vulnerabilidades, monitoramento, controles, IAM, automação e resposta a incidentes.' },
    { id: 'cert-sy0701-5', titulo: 'Security+ SY0-701 — 5.0 Gestão e supervisão de programas', peso: 20, nivel: 'intermediario' as const, resumo: 'Governança, risco, terceiros, conformidade, auditoria, avaliações e conscientização.' },
  ] satisfies { id: string; titulo: string; peso: number; nivel: 'basico' | 'intermediario'; resumo: string }[]).map((d) => ({
    id: d.id,
    trilhaId: 'certs',
    titulo: d.titulo,
    nivel: d.nivel,
    resumo: d.resumo,
    conceitosChave: [`Peso publicado: ${d.peso}%`, 'Mapeie tópicos e evidências de estudo deste domínio.'],
    ferramentas: [],
    recursos: [{ titulo: 'CompTIA Security+ SY0-701 — objetivos oficiais do exame', url: 'https://assets.ctfassets.net/82ripq7fjls2/6TYWUym0Nudqa8nGEnegjG/0f9b974d3b1837fe85ab8e6553f4d623/CompTIA-Security-Plus-SY0-701-Exam-Objectives.pdf', tipo: 'doc' as const }],
    tags: ['certificacao', 'security+', 'sy0-701', `peso-${d.peso}`],
  })),
  {
    id: 'osint-passive-active', trilhaId: 'osint', titulo: 'OSINT: coleta passiva, ativa e validação', nivel: 'intermediario',
    resumo: 'Diferencie fontes públicas consultadas sem interação e reconhecimento que gera tráfego; valide achados e respeite escopo e autorização.',
    conceitosChave: ['Escopo e autorização', 'Fontes primárias', 'Correlação e confiança', 'Registro de evidências', 'Minimização de dados'],
    ferramentas: [{ nome: 'OSINT Framework', descricao: 'Índice de fontes e ferramentas de investigação aberta.', referencia: 'open_source', url: 'https://osintframework.com' }],
    recursos: [], tags: ['osint', 'recon', 'privacidade'],
  },
  {
    id: 'labs-deteccao', trilhaId: 'labs', titulo: 'Laboratório de detecção e resposta com Wazuh', nivel: 'intermediario',
    resumo: 'Monte uma trilha controlada de coleta, regras, alertas e resposta em VMs isoladas, usando logs sintéticos ou do próprio lab.',
    conceitosChave: ['Agente e manager', 'Normalização de logs', 'Regras e alertas', 'MITRE ATT&CK', 'Contenção e evidência'],
    ferramentas: [{ nome: 'Wazuh', descricao: 'Plataforma open source de XDR e SIEM.', referencia: 'open_source', url: 'https://wazuh.com' }],
    recursos: [{ titulo: 'Wazuh documentation', url: 'https://documentation.wazuh.com/current/', tipo: 'doc' }], tags: ['labs', 'wazuh', 'blueteam', 'siem'],
  },
];
