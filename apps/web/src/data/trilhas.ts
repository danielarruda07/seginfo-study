import type { Trilha } from '@seginfo/shared';

export const TRILHAS: Trilha[] = [
  { id: 'fundamentos', ordem: 1, icone: 'pi-shield', titulo: 'Fundamentos de SegInfo', descricao: 'CIA triad, gestão de risco, frameworks NIST/ISO/CIS, LGPD.' },
  { id: 'firewall', ordem: 2, icone: 'pi-lock', titulo: 'Firewall & Perímetro (NGFW)', descricao: 'FortiGate, Palo Alto, Check Point, SonicWall, VPN, IPS/IDS.' },
  { id: 'blueteam', ordem: 3, icone: 'pi-verified', titulo: 'Blue Team & Defesa', descricao: 'Hardening CIS, EDR, threat hunting, MITRE ATT&CK, log analysis.' },
  { id: 'redteam', ordem: 4, icone: 'pi-bolt', titulo: 'Red Team & Pentest', descricao: 'Metodologia, Nmap, Burp, Metasploit, Kali, exploração.' },
  { id: 'web', ordem: 5, icone: 'pi-globe', titulo: 'Segurança Web & AppSec', descricao: 'OWASP Top 10, WSTG, PortSwigger, SAST/DAST, Juice Shop.' },
  { id: 'siem', ordem: 6, icone: 'pi-chart-line', titulo: 'SIEM, SOC & Monitoramento', descricao: 'Sentinel, Splunk, QRadar, Elastic, Wazuh, correlação de eventos.' },
  { id: 'vulns', ordem: 7, icone: 'pi-exclamation-triangle', titulo: 'Gestão de Vulnerabilidades', descricao: 'CVE/CVSS, NVD, CISA KEV, Nessus, Exploit-DB, priorização.' },
  { id: 'osint', ordem: 8, icone: 'pi-search', titulo: 'OSINT & Reconhecimento', descricao: 'Shodan, Maltego, theHarvester, Censys, OSINT Framework.' },
  { id: 'iam', ordem: 9, icone: 'pi-users', titulo: 'IAM & AD Security', descricao: 'Active Directory hardening, MFA, PAM, RADIUS, Zero Trust.' },
  { id: 'labs', ordem: 10, icone: 'pi-desktop', titulo: 'Laboratórios Práticos', descricao: 'TryHackMe, Hack The Box, OverTheWire, CTFs.' },
  { id: 'ir', ordem: 12, icone: 'pi-wrench', titulo: 'Resposta a Incidentes & Forense', descricao: 'NIST 800-61, Event IDs, Sysmon, forense de memória e disco, Velociraptor.' },
  { id: 'malware', ordem: 13, icone: 'pi-microchip', titulo: 'Análise de Malware (defensiva)', descricao: 'Famílias de malware, análise estática, sandbox, YARA e IOCs.' },
  { id: 'purple', ordem: 14, icone: 'pi-sync', titulo: 'Purple Team & Detecção', descricao: 'Engenharia de detecção, Sigma, emulação com Atomic Red Team, deception, NSM.' },
  { id: 'certs', ordem: 11, icone: 'pi-briefcase', titulo: 'Certificações-Alvo', descricao: 'Security+, CEH, CYSA+, PNPT, CISSP — trilha por certificação.' },
];
