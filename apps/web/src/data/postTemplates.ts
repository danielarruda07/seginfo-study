/** Modelos de post para LinkedIn, conectando a vivência de infra do Daniel à segurança. */
export interface PostTemplate {
  id: string;
  titulo: string;
  gancho: string;
  corpo: string;
}

export const POST_TEMPLATES: PostTemplate[] = [
  {
    id: 'tpl-ponte',
    titulo: 'Infra → Segurança: a ponte',
    gancho: '15 anos de infraestrutura não são o começo da minha jornada em segurança. São a base dela.',
    corpo:
      'Quem administra Active Directory, firewall e backup já faz segurança todos os dias — só não chamava assim.\n\n' +
      'Gerir antivírus corporativo (Kaspersky) no TJ-CE era endpoint protection. Configurar SonicWall na Energy Telecom era segurança de perímetro. GPOs eram hardening. Certificados digitais de advogados e juízes eram PKI.\n\n' +
      'Agora estou formalizando esse conhecimento com método: MITRE ATT&CK, CIS Controls, NIST CSF.\n\n' +
      'Sua experiência de infra é um ativo. Reposicione.\n\n#segurancadainformacao #infraestrutura #cybersecurity',
  },
  {
    id: 'tpl-fortigate',
    titulo: 'FortiGate na prática',
    gancho: 'Firewall não é só "abrir e fechar porta". É política, inspeção e visibilidade.',
    corpo:
      'Estudando NGFW a fundo (Fortinet, líder do Gartner Magic Quadrant), três coisas que mudaram minha visão:\n\n' +
      '1. Application control > regra de porta. Bloquear porta 443 não bloqueia o que trafega nela.\n' +
      '2. SSL inspection é onde mora o risco real hoje.\n' +
      '3. IPS integrado transforma o firewall em sensor de detecção.\n\n' +
      'O que mais te surpreendeu quando saiu do "firewall tradicional"?\n\n#fortigate #ngfw #networksecurity',
  },
  {
    id: 'tpl-aprendizado',
    titulo: 'Aprendizado público (build in public)',
    gancho: 'Decidi documentar minha migração de carreira de Infra para Segurança. Em público.',
    corpo:
      'Comecei uma trilha estruturada: Fundamentos → Blue Team → Red Team → SIEM → Vulnerabilidades.\n\n' +
      'Essa semana foquei em [TÓPICO]. Principais aprendizados:\n' +
      '- [ponto 1]\n- [ponto 2]\n- [ponto 3]\n\n' +
      'Ferramenta estudada: [FERRAMENTA] (referência de mercado).\n\n' +
      'Compartilhar o processo me mantém consistente. Se você está na mesma jornada, bora trocar.\n\n#estudos #cybersecurity #carreira',
  },
  {
    id: 'tpl-ferramenta',
    titulo: 'Deep dive em ferramenta',
    gancho: 'Testei [FERRAMENTA] essa semana. Aqui está o que aprendi.',
    corpo:
      'Contexto: [por que essa ferramenta importa]\n\n' +
      'O que ela resolve: [problema]\n\n' +
      '3 aprendizados práticos:\n1. [...]\n2. [...]\n3. [...]\n\n' +
      'É referência de mercado na categoria [categoria].\n\nJá usou? Qual sua experiência?\n\n#cybersecurity #blueteam',
  },
];
