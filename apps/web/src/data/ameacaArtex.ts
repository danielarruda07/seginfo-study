/**
 * ARTEX — framework ofensivo agêntico adotado por atacantes (ex.: Storm-3358).
 *
 * Este módulo é DEFENSIVO: descreve como DETECTAR e CAÇAR o uso do ARTEX contra
 * um alvo, mapeado à Matriz ATT&CK. Não contém e não embute o framework ofensivo.
 *
 * Consenso das fontes: caçar por COMPORTAMENTO, não por nome nem por IOC fixo —
 * os operadores trocam IP e User-Agent. Os marcadores abaixo servem para busca
 * retroativa, com cautela, nunca como blocklist viva.
 */

export type CamadaArtex = 'web' | 'identidade' | 'host' | 'nuvem' | 'comportamento';
export type ConfiancaArtex = 'alta' | 'media' | 'indicio';

export interface SinalArtex {
  id: string;
  titulo: string;
  camada: CamadaArtex;
  /** O que o ARTEX faz / como o rastro aparece. */
  descricao: string;
  /** Dica de caça: o que procurar e como. */
  comoCacar: string;
  /** Técnicas ATT&CK relacionadas (resolvem em data/attack.ts). */
  mitreIds: string[];
  confianca: ConfiancaArtex;
}

export interface MarcadorArtex {
  tipo: 'User-Agent' | 'Header' | 'Infra';
  valor: string;
  nota: string;
}

export const CAMADA_ARTEX: Record<CamadaArtex, { label: string; icone: string; tone: 'info' | 'ok' | 'warning' | 'serious' | 'muted' }> = {
  comportamento: { label: 'Comportamento (loop do agente)', icone: 'pi-sync', tone: 'serious' },
  web: { label: 'Web / aplicação', icone: 'pi-globe', tone: 'info' },
  identidade: { label: 'Identidade / login', icone: 'pi-id-card', tone: 'warning' },
  host: { label: 'Host / endpoint', icone: 'pi-server', tone: 'warning' },
  nuvem: { label: 'Nuvem', icone: 'pi-cloud', tone: 'info' },
};

export const CONFIANCA_ARTEX: Record<ConfiancaArtex, { label: string; tone: 'ok' | 'warning' | 'muted' }> = {
  alta: { label: 'Sinal forte', tone: 'ok' },
  media: { label: 'Sinal médio', tone: 'warning' },
  indicio: { label: 'Indício (confirmar)', tone: 'muted' },
};

export const ARTEX_RESUMO =
  'O ARTEX é um framework de pentest com IA (planner + workers) que trata cada ferramenta (nmap, nuclei, ' +
  'navegador) como um servidor MCP e roda o ciclo explorar → decidir → executar de forma autônoma. Foi ' +
  'publicado como código aberto e adaptado por atacantes (a Microsoft/FBI atribuem parte da infraestrutura ao ' +
  'Storm-3358). Como o agente age em velocidade de máquina, ele deixa uma assinatura volumétrica e sequencial ' +
  'em vários logs — é por aí que se caça, não pelo nome.';

export const ARTEX_SINAIS: SinalArtex[] = [
  {
    id: 'loop-agentico',
    titulo: 'Loop explorar → decidir → executar em velocidade de máquina',
    camada: 'comportamento',
    descricao: 'O mesmo ator percorre recon, exploração e exfiltração em minutos, encadeando estágios rápido demais para ser humano.',
    comoCacar: 'Correlacione, por IP/identidade, eventos de estágios diferentes (varredura → tentativa de exploit → acesso a credencial) dentro de uma janela curta (ex.: < 10 min). O encadeamento é o sinal, não cada evento isolado.',
    mitreIds: ['T1595', 'T1190', 'T1552'],
    confianca: 'alta',
  },
  {
    id: 'web-40x-burst',
    titulo: 'Rajada de respostas 40x de um único IP',
    camada: 'web',
    descricao: 'O worker varre caminhos e parâmetros muito rápido, gerando um pico de 401/403/404 de uma mesma origem.',
    comoCacar: 'Agrupe status 4xx por IP de origem em janelas de 1–5 min; alerte acima de um limite (ex.: > 100). Compare com a linha de base do endpoint.',
    mitreIds: ['T1595', 'T1190'],
    confianca: 'alta',
  },
  {
    id: 'web-injecao',
    titulo: 'Padrões de path traversal, LFI e command injection',
    camada: 'web',
    descricao: 'As sondas do agente incluem travessia de diretório, inclusão de arquivo e injeção de comando contra parâmetros.',
    comoCacar: 'Procure nos logs de acesso/WAF por sequências como "../", "/etc/passwd", "php://filter", ";id", "|whoami" nos parâmetros. Casado com o 40x-burst, sobe a confiança.',
    mitreIds: ['T1190', 'T1059'],
    confianca: 'media',
  },
  {
    id: 'id-spray',
    titulo: 'Rajada de login falho entre provedores de identidade',
    camada: 'identidade',
    descricao: 'Password spraying e tentativas automatizadas contra Okta, Entra ID, Cognito e afins.',
    comoCacar: 'Conte falhas de autenticação por origem cruzando MUITAS contas (spraying) em janela curta; some eventos dos vários IdPs. Observe também abuso de fluxos de recuperação de conta.',
    mitreIds: ['T1110', 'T1078'],
    confianca: 'alta',
  },
  {
    id: 'id-conta-nova',
    titulo: 'Conta nova seguida de sessões múltiplas',
    camada: 'identidade',
    descricao: 'Criação de conta (ou auto-cadastro, ex.: Cognito) seguida de logins de várias sessões em sequência.',
    comoCacar: 'Alerta para criação de conta seguida, em minutos, de sign-ins de múltiplas sessões/fingerprints. Revise anomalias de auto-cadastro.',
    mitreIds: ['T1136', 'T1078'],
    confianca: 'media',
  },
  {
    id: 'host-credenciais',
    titulo: 'Leitura rápida de arquivos sensíveis e de credenciais',
    camada: 'host',
    descricao: 'Pós-acesso, o agente lê /etc/shadow, .env, chaves privadas e arquivos de credencial de nuvem em rajada.',
    comoCacar: 'FIM/auditd no Wazuh: alerte acesso a /etc/shadow, **/.env, id_rsa, ~/.aws/credentials, ~/.config/gcloud em curto intervalo pelo mesmo processo/usuário.',
    mitreIds: ['T1552', 'T1005'],
    confianca: 'alta',
  },
  {
    id: 'host-exfil',
    titulo: 'Reverse shell e saída para webhook/file-sharing',
    camada: 'host',
    descricao: 'Execução de shell reverso e envio de dados para serviços de webhook ou compartilhamento de arquivos.',
    comoCacar: 'Monitore conexões de saída para domínios de webhook/transfer (webhook.site, pipedream, transfer.sh, requestbin) e shells saindo de processos de serviço web.',
    mitreIds: ['T1071', 'T1567'],
    confianca: 'media',
  },
  {
    id: 'nuvem-aws-probe',
    titulo: 'AWS: rajada de probing de permissão',
    camada: 'nuvem',
    descricao: 'Muitas respostas DryRunOperation/UnauthorizedOperation/AccessDenied do mesmo identity em segundos, mapeando o que pode fazer.',
    comoCacar: 'CloudTrail: conte errorCode UnauthorizedOperation/AccessDenied por principal por minuto; alerte acima de um limite. É mapeamento de permissão automatizado.',
    mitreIds: ['T1087', 'T1069'],
    confianca: 'alta',
  },
  {
    id: 'nuvem-azure-blob',
    titulo: 'Azure: PutBlob seguido de DeleteBlob em ~1s',
    camada: 'nuvem',
    descricao: 'Escrita e remoção do mesmo blob quase instantânea — teste automatizado de permissão de escrita em storage.',
    comoCacar: 'Logs de Storage: pares PutBlob→DeleteBlob no mesmo blob com diferença < ~2s pelo mesmo ator.',
    mitreIds: ['T1552'],
    confianca: 'media',
  },
];

export const ARTEX_MARCADORES: MarcadorArtex[] = [
  { tipo: 'User-Agent', valor: 'artex-enrich/1.0', nota: 'Observado por alguns fornecedores em intrusões reais; outra fonte diz que NÃO está no código público. Use com cautela.' },
  { tipo: 'User-Agent', valor: 'norma/0.4', nota: 'Citado em orientação de detecção; tratar como indício, não prova.' },
  { tipo: 'User-Agent', valor: 'ARTEX-worker/1.0', nota: 'Aparece em telas de demonstração; raro em ataque real — baixa confiança.' },
  { tipo: 'Header', valor: 'X-ARTX-KEY', nota: 'Header marcador reportado pela comunidade; pode sumir se o operador customizar.' },
  { tipo: 'Infra', valor: 'IPs de C2 do Storm-3358 (jul–nov/2026)', nota: 'Atribuídos por Microsoft/FBI. Vários pontuam limpo nos feeds (saídas de VPN/WARP/cloud). Use só para busca retroativa com janela de tempo, nunca como blocklist viva.' },
];

export const ARTEX_FONTES: { nome: string; url: string }[] = [
  { nome: 'Microsoft — What defenders need to know about ARTEX', url: 'https://www.microsoft.com/en-us/security/blog/2026/11/25/what-defenders-need-to-know-artex-agentic-ai-framework-threat-actors-abuse/' },
  { nome: 'Elastic Security Labs — Agentic offensive frameworks', url: 'https://www.elastic.co/security-labs/threat-command/agentic-offensive-frameworks-detection-artex' },
  { nome: 'ReversingLabs — Detection strategies for ARTEX and forks', url: 'https://www.reversinglabs.com/blog/threat-researchers-notebook-detection-strategies-for-artex-and-related-forks' },
  { nome: 'SOC Prime — Hunting agentic AI attack activity', url: 'https://socprime.com/blog/artex-detection-hunting-the-ai-pentest-framework-turned-attack-platform/' },
  { nome: 'Phoenix Security — ARTEX agentic offensive frameworks', url: 'https://phoenix.security/artex-agentic-offensive-frameworks-machine-speed-intrusions/' },
  { nome: 'ThreatDefence — Detection, IOCs and hunting', url: 'https://threatdefence.com/article/artex-agentic-attack-framework-detection-hunting' },
];

export const getSinalArtex = (id: string): SinalArtex | undefined => ARTEX_SINAIS.find((s) => s.id === id);
