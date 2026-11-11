/**
 * Recorte curado do MITRE ATT&CK Enterprise usado na Matriz de cobertura.
 * Não é a matriz completa: são as técnicas que aparecem nos tópicos, labs e no Radar.
 * Referência: https://attack.mitre.org (IDs e nomes oficiais em inglês).
 */

export interface Tatica {
  id: string;
  nome: string;
}

export interface Tecnica {
  id: string;
  nome: string;
  tatica: string;
}

export const TATICAS: Tatica[] = [
  { id: 'TA0043', nome: 'Reconhecimento' },
  { id: 'TA0001', nome: 'Acesso inicial' },
  { id: 'TA0002', nome: 'Execução' },
  { id: 'TA0003', nome: 'Persistência' },
  { id: 'TA0004', nome: 'Escalação de privilégio' },
  { id: 'TA0005', nome: 'Evasão de defesa' },
  { id: 'TA0006', nome: 'Acesso a credenciais' },
  { id: 'TA0007', nome: 'Descoberta' },
  { id: 'TA0008', nome: 'Movimento lateral' },
  { id: 'TA0009', nome: 'Coleta' },
  { id: 'TA0011', nome: 'Comando e controle' },
  { id: 'TA0010', nome: 'Exfiltração' },
  { id: 'TA0040', nome: 'Impacto' },
];

export const TECNICAS: Tecnica[] = [
  // Reconhecimento
  { id: 'T1595', nome: 'Active Scanning', tatica: 'TA0043' },
  { id: 'T1592', nome: 'Gather Victim Host Information', tatica: 'TA0043' },
  { id: 'T1589', nome: 'Gather Victim Identity Information', tatica: 'TA0043' },
  { id: 'T1593', nome: 'Search Open Websites/Domains', tatica: 'TA0043' },
  // Acesso inicial
  { id: 'T1190', nome: 'Exploit Public-Facing Application', tatica: 'TA0001' },
  { id: 'T1133', nome: 'External Remote Services', tatica: 'TA0001' },
  { id: 'T1566', nome: 'Phishing', tatica: 'TA0001' },
  { id: 'T1078', nome: 'Valid Accounts', tatica: 'TA0001' },
  // Execução
  { id: 'T1059', nome: 'Command and Scripting Interpreter', tatica: 'TA0002' },
  { id: 'T1204', nome: 'User Execution', tatica: 'TA0002' },
  { id: 'T1047', nome: 'Windows Management Instrumentation', tatica: 'TA0002' },
  // Persistência
  { id: 'T1547', nome: 'Boot or Logon Autostart Execution', tatica: 'TA0003' },
  { id: 'T1053', nome: 'Scheduled Task/Job', tatica: 'TA0003' },
  { id: 'T1136', nome: 'Create Account', tatica: 'TA0003' },
  { id: 'T1543', nome: 'Create or Modify System Process', tatica: 'TA0003' },
  // Escalação de privilégio
  { id: 'T1068', nome: 'Exploitation for Privilege Escalation', tatica: 'TA0004' },
  { id: 'T1548', nome: 'Abuse Elevation Control Mechanism', tatica: 'TA0004' },
  { id: 'T1484', nome: 'Domain or Tenant Policy Modification', tatica: 'TA0004' },
  // Evasão de defesa
  { id: 'T1070', nome: 'Indicator Removal', tatica: 'TA0005' },
  { id: 'T1562', nome: 'Impair Defenses', tatica: 'TA0005' },
  { id: 'T1027', nome: 'Obfuscated Files or Information', tatica: 'TA0005' },
  // Acesso a credenciais
  { id: 'T1110', nome: 'Brute Force', tatica: 'TA0006' },
  { id: 'T1003', nome: 'OS Credential Dumping', tatica: 'TA0006' },
  { id: 'T1558', nome: 'Steal or Forge Kerberos Tickets', tatica: 'TA0006' },
  { id: 'T1552', nome: 'Unsecured Credentials', tatica: 'TA0006' },
  { id: 'T1557', nome: 'Adversary-in-the-Middle', tatica: 'TA0006' },
  // Descoberta
  { id: 'T1046', nome: 'Network Service Discovery', tatica: 'TA0007' },
  { id: 'T1087', nome: 'Account Discovery', tatica: 'TA0007' },
  { id: 'T1082', nome: 'System Information Discovery', tatica: 'TA0007' },
  { id: 'T1069', nome: 'Permission Groups Discovery', tatica: 'TA0007' },
  { id: 'T1018', nome: 'Remote System Discovery', tatica: 'TA0007' },
  // Movimento lateral
  { id: 'T1021', nome: 'Remote Services', tatica: 'TA0008' },
  { id: 'T1550', nome: 'Use Alternate Authentication Material', tatica: 'TA0008' },
  { id: 'T1210', nome: 'Exploitation of Remote Services', tatica: 'TA0008' },
  // Coleta
  { id: 'T1005', nome: 'Data from Local System', tatica: 'TA0009' },
  { id: 'T1039', nome: 'Data from Network Shared Drive', tatica: 'TA0009' },
  // Comando e controle
  { id: 'T1071', nome: 'Application Layer Protocol', tatica: 'TA0011' },
  { id: 'T1105', nome: 'Ingress Tool Transfer', tatica: 'TA0011' },
  { id: 'T1572', nome: 'Protocol Tunneling', tatica: 'TA0011' },
  // Exfiltração
  { id: 'T1041', nome: 'Exfiltration Over C2 Channel', tatica: 'TA0010' },
  { id: 'T1567', nome: 'Exfiltration Over Web Service', tatica: 'TA0010' },
  // Impacto
  { id: 'T1486', nome: 'Data Encrypted for Impact', tatica: 'TA0040' },
  { id: 'T1490', nome: 'Inhibit System Recovery', tatica: 'TA0040' },
  { id: 'T1496', nome: 'Resource Hijacking', tatica: 'TA0040' },
  { id: 'T1498', nome: 'Network Denial of Service', tatica: 'TA0040' },
];

export const getTecnica = (id: string) => TECNICAS.find((t) => t.id === id.toUpperCase().split('.')[0]);
