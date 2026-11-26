import type { FerramentaCatalogo } from '@seginfo/shared';

/**
 * Arsenal de Ferramentas: cheat sheet de referência rápida por fase do workflow
 * ofensivo/defensivo (reconhecimento → scan → vuln → exploração → pós-exploração →
 * forense → monitoramento → defesa). Baseado num compilado de mercado de "50+
 * ferramentas de cibersegurança" (post educativo).
 *
 * Kali Linux não é uma fase/categoria própria aqui: ele é a distribuição que já
 * empacota a maioria destas ferramentas (ver `kali: true`). O ambiente VM do Kali
 * está modelado no Range Vulnerável (`range-vm-kali-atacante`), não duplicado aqui.
 */
export const FERRAMENTAS: FerramentaCatalogo[] = [
  // ===================== 1. Reconhecimento & OSINT =====================
  { id: 'fer-theharvester', nome: 'theHarvester', fase: 'reconhecimento', dominio: 'red', descricao: 'Coleta e-mails, subdomínios e pessoas a partir de fontes públicas.', url: 'https://github.com/laramies/theHarvester', kali: true, topicoId: 'osint-recon' },
  { id: 'fer-maltego', nome: 'Maltego', fase: 'reconhecimento', dominio: 'red', descricao: 'Mapeia relações e conexões entre entidades (pessoas, domínios, infra).', url: 'https://www.maltego.com', kali: true, topicoId: 'osint-recon' },
  { id: 'fer-spiderfoot', nome: 'SpiderFoot', fase: 'reconhecimento', dominio: 'red', descricao: 'Automatiza investigações OSINT com mais de 100 fontes de dados.', url: 'https://www.spiderfoot.net', kali: false, topicoId: 'osint-recon' },
  { id: 'fer-shodan', nome: 'Shodan', fase: 'reconhecimento', dominio: 'red', descricao: 'Motor de busca para descobrir dispositivos conectados à internet.', url: 'https://www.shodan.io', kali: false, topicoId: 'osint-recon' },
  { id: 'fer-censys', nome: 'Censys', fase: 'reconhecimento', dominio: 'red', descricao: 'Identifica e monitora ativos expostos na internet.', url: 'https://censys.io', kali: false, topicoId: 'osint-recon' },
  { id: 'fer-amass', nome: 'OWASP Amass', fase: 'reconhecimento', dominio: 'red', descricao: 'Enumeração de subdomínios e mapeamento de superfície de ataque (passivo e ativo).', url: 'https://github.com/owasp-amass/amass', kali: true, topicoId: 'osint-recon' },

  // ===================== 2. Varredura e descoberta de rede =====================
  { id: 'fer-nmap', nome: 'Nmap', fase: 'varredura', dominio: 'red', descricao: 'Escaneia redes e identifica hosts, portas e serviços.', url: 'https://nmap.org', kali: true, topicoId: 'red-nmap' },
  { id: 'fer-masscan', nome: 'Masscan', fase: 'varredura', dominio: 'red', descricao: 'Varredura de portas em altíssima velocidade, escala de internet.', url: 'https://github.com/robertdavidgraham/masscan', kali: true },
  { id: 'fer-angryip', nome: 'Angry IP Scanner', fase: 'varredura', dominio: 'red', descricao: 'Scanner de IP simples e rápido para descobrir endereços ativos.', url: 'https://angryip.org', kali: false },
  { id: 'fer-netdiscover', nome: 'Netdiscover', fase: 'varredura', dominio: 'red', descricao: 'Reconhecimento passivo/ativo de dispositivos em redes locais (ARP).', url: 'https://github.com/netdiscover-scanner/netdiscover', kali: true },
  { id: 'fer-bloodhound', nome: 'BloodHound', fase: 'varredura', dominio: 'red', descricao: 'Mapeia caminhos de privilégio e relações no Active Directory via teoria de grafos.', url: 'https://github.com/SpecterOps/BloodHound', kali: true },
  { id: 'fer-fing', nome: 'Fing', fase: 'varredura', dominio: 'infra', descricao: 'Escaneia e monitora dispositivos conectados à rede.', url: 'https://www.fing.com', kali: false },

  // ===================== 3. Avaliação de vulnerabilidade =====================
  { id: 'fer-nessus', nome: 'Nessus', fase: 'vulnerabilidade', dominio: 'blue', descricao: 'Scanner de vulnerabilidades de referência de mercado (Tenable).', url: 'https://www.tenable.com/products/nessus', kali: false, topicoId: 'vuln-scanners' },
  { id: 'fer-openvas', nome: 'OpenVAS', fase: 'vulnerabilidade', dominio: 'blue', descricao: 'Scanner de vulnerabilidades open source (Greenbone).', url: 'https://www.greenbone.net', kali: true, topicoId: 'vuln-scanners' },
  { id: 'fer-qualys', nome: 'Qualys', fase: 'vulnerabilidade', dominio: 'blue', descricao: 'Gestão de vulnerabilidades baseada em nuvem.', url: 'https://www.qualys.com', kali: false, topicoId: 'vuln-scanners' },
  { id: 'fer-nikto', nome: 'Nikto', fase: 'vulnerabilidade', dominio: 'blue', descricao: 'Identifica vulnerabilidades e más configurações em servidores web.', url: 'https://github.com/sullo/nikto', kali: true },
  { id: 'fer-wpscan', nome: 'WPScan', fase: 'vulnerabilidade', dominio: 'red', descricao: 'Auditoria de segurança de sites WordPress.', url: 'https://wpscan.com', kali: true },
  { id: 'fer-nuclei', nome: 'Nuclei', fase: 'vulnerabilidade', dominio: 'red', descricao: 'Scanner baseado em templates da comunidade para detecção rápida de vulnerabilidades e exposições.', url: 'https://github.com/projectdiscovery/nuclei', kali: true },

  // ===================== 4. Testes de aplicações web =====================
  { id: 'fer-burp', nome: 'Burp Suite', fase: 'web', dominio: 'red', descricao: 'Proxy de interceptação e teste de segurança de aplicações web.', url: 'https://portswigger.net/burp', kali: true, topicoId: 'web-burp' },
  { id: 'fer-zap', nome: 'OWASP ZAP', fase: 'web', dominio: 'red', descricao: 'Scanner open source de aplicações web em busca de fraquezas.', url: 'https://www.zaproxy.org', kali: true },
  { id: 'fer-sqlmap', nome: 'SQLmap', fase: 'web', dominio: 'red', descricao: 'Detecta e explora vulnerabilidades de injeção SQL.', url: 'https://sqlmap.org', kali: true },
  { id: 'fer-dirsearch', nome: 'Dirb / Dirsearch', fase: 'web', dominio: 'red', descricao: 'Descobre diretórios e arquivos ocultos em servidores web.', url: 'https://github.com/maurosoria/dirsearch', kali: true },
  { id: 'fer-ffuf', nome: 'Ffuf', fase: 'web', dominio: 'red', descricao: 'Fuzzer rápido de aplicações web e endpoints, escrito em Go.', url: 'https://github.com/ffuf/ffuf', kali: true },
  { id: 'fer-gobuster', nome: 'Gobuster', fase: 'web', dominio: 'red', descricao: 'Força bruta de diretórios, arquivos, subdomínios DNS e vhosts.', url: 'https://github.com/OJ/gobuster', kali: true },

  // ===================== 5. Estruturas de exploração =====================
  { id: 'fer-metasploit', nome: 'Metasploit Framework', fase: 'exploracao', dominio: 'red', descricao: 'Framework de exploração mais usado para validar vulnerabilidades.', url: 'https://www.metasploit.com', kali: true, topicoId: 'red-metasploit' },
  { id: 'fer-cobaltstrike', nome: 'Cobalt Strike', fase: 'exploracao', dominio: 'red', descricao: 'Plataforma comercial de emulação de adversário e pós-exploração.', url: 'https://www.cobaltstrike.com', kali: false },
  { id: 'fer-empire', nome: 'Empire', fase: 'exploracao', dominio: 'red', descricao: 'Framework de pós-exploração (PowerShell/Python) para testes autorizados.', url: 'https://github.com/BC-SECURITY/Empire', kali: false },
  { id: 'fer-beef', nome: 'BeEF', fase: 'exploracao', dominio: 'red', descricao: 'Browser Exploitation Framework — avalia a segurança de navegadores.', url: 'https://beefproject.com', kali: true },
  { id: 'fer-set', nome: 'Social-Engineer Toolkit (SET)', fase: 'exploracao', dominio: 'red', descricao: 'Simula ataques de engenharia social em testes autorizados.', url: 'https://github.com/trustedsec/social-engineer-toolkit', kali: true },
  { id: 'fer-impacket', nome: 'Impacket', fase: 'exploracao', dominio: 'red', descricao: 'Coleção Python de classes para protocolos de rede — execução remota, relay e ataques a AD/SMB.', url: 'https://github.com/fortra/impacket', kali: true },
  { id: 'fer-responder', nome: 'Responder', fase: 'exploracao', dominio: 'red', descricao: 'Envenenamento LLMNR/NBT-NS/mDNS para capturar credenciais em rede interna.', url: 'https://github.com/lgandx/Responder', kali: true },

  // ===================== 6. Teste de segurança de senha =====================
  { id: 'fer-johntheripper', nome: 'John the Ripper', fase: 'senha', dominio: 'red', descricao: 'Auditoria da força de senhas por quebra de hash.', url: 'https://www.openwall.com/john/', kali: true },
  { id: 'fer-hashcat', nome: 'Hashcat', fase: 'senha', dominio: 'red', descricao: 'Recuperação de senha por hash acelerada por GPU.', url: 'https://hashcat.net/hashcat/', kali: true },
  { id: 'fer-hydra', nome: 'Hydra', fase: 'senha', dominio: 'red', descricao: 'Quebra de login rápida contra múltiplos protocolos de autenticação.', url: 'https://github.com/vanhauser-thc/thc-hydra', kali: true },
  { id: 'fer-medusa', nome: 'Medusa', fase: 'senha', dominio: 'red', descricao: 'Brute-force de login paralelo contra vários serviços.', url: 'https://github.com/jmk-foofus/medusa', kali: true },
  { id: 'fer-crackmapexec', nome: 'CrackMapExec', fase: 'senha', dominio: 'red', descricao: 'Pós-exploração e avaliação de segurança de redes Windows.', url: 'https://github.com/Porchetta-Industries/CrackMapExec', kali: true },
  { id: 'fer-netexec', nome: 'NetExec (nxc)', fase: 'senha', dominio: 'red', descricao: 'Sucessor mantido do CrackMapExec: automação de pós-exploração e checagens em redes Windows/AD.', url: 'https://github.com/Pennyw0rth/NetExec', kali: true },
  { id: 'fer-mimikatz', nome: 'Mimikatz', fase: 'senha', dominio: 'red', descricao: 'Extração de credenciais do Windows (LSASS, tickets Kerberos) e ataques pass-the-hash/ticket.', url: 'https://github.com/gentilkiwi/mimikatz', kali: true },

  // ===================== 7. Segurança sem fio =====================
  { id: 'fer-aircrackng', nome: 'Aircrack-ng', fase: 'wireless', dominio: 'red', descricao: 'Suíte de auditoria de segurança Wi-Fi (captura e quebra WPA/WEP).', url: 'https://www.aircrack-ng.org', kali: true },
  { id: 'fer-kismet', nome: 'Kismet', fase: 'wireless', dominio: 'red', descricao: 'Monitor de redes sem fio e detector de dispositivos/IDS wireless.', url: 'https://www.kismetwireless.net', kali: true },
  { id: 'fer-reaver', nome: 'Reaver', fase: 'wireless', dominio: 'red', descricao: 'Avalia a segurança do WPS em redes Wi-Fi.', url: 'https://github.com/t6x/reaver-wps-fork-t6x', kali: true },
  { id: 'fer-bettercap', nome: 'Bettercap', fase: 'wireless', dominio: 'red', descricao: 'Teste de segurança de rede e wireless, ataques man-in-the-middle.', url: 'https://www.bettercap.org', kali: true },

  // ===================== 8. Perícia e resposta a incidentes =====================
  { id: 'fer-volatility', nome: 'Volatility 3', fase: 'forense', dominio: 'blue', descricao: 'Framework de forense de memória — investiga dumps de RAM.', url: 'https://github.com/volatilityfoundation/volatility3', kali: true, topicoId: 'ir-memoria' },
  { id: 'fer-autopsy', nome: 'Autopsy', fase: 'forense', dominio: 'blue', descricao: 'Plataforma de forense digital para examinar evidências.', url: 'https://www.autopsy.com', kali: true, topicoId: 'ir-disco' },
  { id: 'fer-wireshark', nome: 'Wireshark', fase: 'forense', dominio: 'blue', descricao: 'Analisador de protocolo e tráfego de rede, padrão de mercado.', url: 'https://www.wireshark.org', kali: true },
  { id: 'fer-ftkimager', nome: 'FTK Imager', fase: 'forense', dominio: 'blue', descricao: 'Cria e inspeciona imagens forenses de disco.', url: 'https://www.exterro.com/ftk-imager', kali: false, topicoId: 'ir-disco' },

  // ===================== 9. Análise de logs e monitoramento =====================
  { id: 'fer-splunk', nome: 'Splunk', fase: 'monitoramento', dominio: 'blue', descricao: 'Plataforma SIEM líder de mercado para análise de eventos de segurança.', url: 'https://www.splunk.com', kali: false, topicoId: 'siem-mercado' },
  { id: 'fer-elk', nome: 'ELK Stack', fase: 'monitoramento', dominio: 'blue', descricao: 'Elasticsearch + Logstash + Kibana — centraliza e busca logs.', url: 'https://www.elastic.co/elastic-stack', kali: false },
  { id: 'fer-wazuh-mon', nome: 'Wazuh', fase: 'monitoramento', dominio: 'blue', descricao: 'Plataforma open source de SIEM/XDR — monitora ameaças, integridade e conformidade.', url: 'https://wazuh.com', kali: false, topicoId: 'siem-mercado' },
  { id: 'fer-graylog', nome: 'Graylog', fase: 'monitoramento', dominio: 'blue', descricao: 'Gerenciamento e análise centralizada de dados de log.', url: 'https://graylog.org', kali: false },

  // ===================== 10. Operações de segurança defensiva =====================
  { id: 'fer-suricata', nome: 'Suricata', fase: 'defesa', dominio: 'blue', descricao: 'Motor de IDS/IPS e NSM — detecta ameaças de rede.', url: 'https://suricata.io', kali: false },
  { id: 'fer-snort', nome: 'Snort', fase: 'defesa', dominio: 'blue', descricao: 'Sistema de detecção de intrusão de rede, monitora tráfego suspeito.', url: 'https://www.snort.org', kali: false },
  { id: 'fer-ossec', nome: 'OSSEC', fase: 'defesa', dominio: 'blue', descricao: 'Detecção de intrusão baseada em host (HIDS).', url: 'https://www.ossec.net', kali: false },
  { id: 'fer-fail2ban', nome: 'Fail2Ban', fase: 'defesa', dominio: 'blue', descricao: 'Bloqueia automaticamente IPs com tentativas de login suspeitas.', url: 'https://github.com/fail2ban/fail2ban', kali: false },
];
