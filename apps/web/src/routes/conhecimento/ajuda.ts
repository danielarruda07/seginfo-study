/**
 * Conteúdo da tela Ajuda: o que cada ferramenta faz, como usar, se usa IA e onde para.
 * Mantenha honesto — é o que o Daniel consulta antes de rodar um teste em cliente.
 * Toda ferramenta nova de teste deve ganhar uma entrada aqui (e um `relatorioDoX()` para exportar).
 */

/** Quanto de IA (modelo de linguagem) a ferramenta usa de fato. */
export type NivelIa = 'profunda' | 'apoio' | 'nenhuma';

export const ROTULO_IA: Record<NivelIa, { rotulo: string; explica: string }> = {
  profunda: { rotulo: 'IA profunda', explica: 'Um modelo Claude lê e raciocina sobre o alvo (código, contexto, lógica).' },
  apoio: { rotulo: 'IA de apoio', explica: 'A IA ajuda (resume, conversa, opera ferramentas), mas o teste em si não é feito por ela.' },
  nenhuma: { rotulo: 'Sem IA', explica: 'Motor determinístico: regras e checagens fixas. Rápido, repetível e barato, mas não entende lógica de negócio.' },
};

export type Frente = 'endpoint' | 'codigo' | 'deteccao' | 'metodo' | 'apoio';

export const FRENTES: { id: Frente; titulo: string; descricao: string }[] = [
  { id: 'endpoint', titulo: 'URLs, endpoints e APIs', descricao: 'Testar o comportamento do que está publicado (caixa-preta).' },
  { id: 'codigo', titulo: 'Repositórios e código-fonte', descricao: 'Ler o código clonado do cliente (caixa-branca).' },
  { id: 'deteccao', titulo: 'Detecção, resposta e inteligência', descricao: 'Ver ataques, investigar e priorizar o que corrigir.' },
  { id: 'metodo', titulo: 'Método e laboratório', descricao: 'Planejar o teste e validar técnicas com segurança.' },
  { id: 'apoio', titulo: 'Conhecimento, IA e sistema', descricao: 'Guardar o que funciona, agentes e cofre.' },
];

export interface Ferramenta {
  id: string;
  nome: string;
  frente: Frente;
  /** rota no app; ausente quando é só linha de comando */
  to?: string;
  comando?: string;
  ia: NivelIa;
  resumo: string;
  passos: string[];
  resultado: string;
  limites: string[];
  exporta: boolean;
}

export const FERRAMENTAS: Ferramenta[] = [
  {
    id: 'scanner', nome: 'Scanner de endpoints', frente: 'endpoint', to: '/scanner', ia: 'nenhuma', exporta: true,
    resumo: 'Testa uma URL de site ou API a partir do servidor do homelab: TLS, cabeçalhos de segurança, cookies, CORS, métodos HTTP, tecnologia, arquivos expostos (/.git, /.env, /actuator, swagger), OpenAPI e erro verboso.',
    passos: [
      'Abra Pentest de aplicação → Scanner de endpoints.',
      'Cole a URL (ou até 15, uma por linha, para o modo lote).',
      'Deixe "Testes ativos seguros" DESLIGADO na primeira passada; rode e leia os achados.',
      'Se o alvo não for de escrita/transação, ligue os testes ativos e rode de novo.',
      'Exporte em HTML ou PDF para anexar ao laudo.',
    ],
    resultado: 'Lista de achados por severidade, com evidência e recomendação; histórico fica no navegador.',
    limites: [
      'Só GET/HEAD/OPTIONS: não faz login, não navega fluxos, não testa lógica de negócio.',
      'Não substitui Burp/ZAP num teste manual — é a triagem rápida e o gate de CI.',
    ],
  },
  {
    id: 'ativos', nome: 'Testes ativos seguros (no Scanner)', frente: 'endpoint', to: '/scanner', ia: 'nenhuma', exporta: true,
    resumo: 'Uma requisição GET extra por teste, com marcador inofensivo: reflexo de entrada (XSS), open redirect, autorização não forçada, sinal de SQL injection (uma aspa) e canário de prompt injection.',
    passos: [
      'Marque a caixa "Testes ativos seguros" no Scanner.',
      'O teste de autorização manda sozinho um Bearer inválido de prova: se a rota responde 2xx igual, a autenticação pode não estar sendo exigida.',
      'Trate tudo que sair como "a confirmar": reproduza manualmente antes de pôr no laudo.',
    ],
    resultado: 'Indícios marcados como "a confirmar", com a requisição que gerou cada um.',
    limites: [
      'NUNCA em endpoint de transação/escrita de produção (pode criar registro). Use staging.',
      'Detecta sinais, não explora: não extrai dados nem confirma o impacto.',
    ],
  },
  {
    id: 'jwt', nome: 'Analisar JWT', frente: 'endpoint', to: '/scanner', ia: 'nenhuma', exporta: true,
    resumo: 'Cole um token na caixa do Scanner: decodifica no navegador, sem rede e sem a chave, e aponta alg none, HS forjável, falta de exp, validade longa, dado sensível no payload e kid suspeito.',
    passos: ['No Scanner, abra "Analisar JWT".', 'Cole o token de um usuário de teste.', 'Exporte o resultado se for para o laudo.'],
    resultado: 'Header e payload legíveis e a lista de fraquezas do token.',
    limites: ['Não verifica a assinatura nem tenta quebrar o segredo.'],
  },
  {
    id: 'gate', nome: 'Gate de CI (rota assinada)', frente: 'endpoint', comando: 'scripts/scan-ci.sh <url>', ia: 'nenhuma', exporta: false,
    resumo: 'O mesmo motor do Scanner chamado pela pipeline: assinatura HMAC + Service Token do Cloudflare. Responde 200 (passou) ou 422 (reprovou).',
    passos: ['Configure SCAN_CI_SECRET e o Service Token na CI.', 'Chame scripts/scan-ci.sh no passo de deploy.', 'Ajuste os limites de severidade para reprovar o build.'],
    resultado: 'Veredito de quality gate a cada deploy. Detalhes em docs/SCANNER_CI.md.',
    limites: ['Mesmos limites do Scanner (caixa-preta, sem login).'],
  },
  {
    id: 'exposicao', nome: 'Minha exposição', frente: 'endpoint', to: '/exposicao', ia: 'nenhuma', exporta: true,
    resumo: 'OSINT passivo de domínios, IPs e e-mails: subdomínios por certificados (crt.sh), portas e CVEs conhecidas (Shodan InternetDB), saúde dos sites e o que mudou desde a última olhada.',
    passos: ['Cadastre os domínios/IPs do escopo.', 'Abra cada alvo para ver subdomínios, portas e mudanças.', 'Use os subdomínios achados como lista de URLs para o Scanner.'],
    resultado: 'Mapa da superfície externa e alertas de mudança.',
    limites: ['Passivo: depende do que as fontes públicas já sabem. Não faz varredura de portas.'],
  },
  {
    id: 'revisao', nome: 'Revisão de código (IA)', frente: 'codigo', to: '/revisao-codigo', ia: 'profunda', exporta: true,
    resumo: 'Varredura profunda de um repositório com o plugin oficial claude-security, rodando num worker isolado (sandbox) na VM 100. O modelo lê o código e raciocina sobre autenticação, autorização, injeção, lógica de negócio e cadeias de ataque. Devolve achados com CWE, arquivo:linha e patches sugeridos.',
    passos: [
      'Abra Pentest de aplicação → Revisão de código (IA).',
      'Informe a URL do repositório (https ou ssh). Privado exige CODESCAN_GIT_TOKEN no worker.',
      'Escolha o modo: completo (repositório inteiro) ou só mudanças de uma branch.',
      'Escolha o esforço: baixo para o primeiro teste; alto para laudo de cliente.',
      'Acompanhe o status (fila → executando → concluída); a lista atualiza sozinha.',
      'Abra a varredura: achados, patches (.patch) e relatório MD; exporte HTML/PDF.',
    ],
    resultado: 'Achados priorizados com explicação, evidência no código e correção proposta.',
    limites: [
      'Custa tokens da API (workspace dedicado, com limite de gasto). Esforço alto pode levar horas.',
      'Achado de IA também pode ser falso positivo: valide os críticos antes do laudo.',
      'Lê o código, não executa a aplicação: falhas que só aparecem rodando (config de produção) pedem o Scanner/staging.',
    ],
  },
  {
    id: 'reposcan', nome: 'Reposcan (linha de comando)', frente: 'codigo', comando: 'scripts/reposcan.sh <pasta-ou-url> --html laudo.html', ia: 'nenhuma', exporta: true,
    resumo: 'Análise estática rápida no seu PC: segredos (AWS, tokens, chaves), dependências sem pin e supply-chain, Docker/IaC/CI inseguros, código perigoso (eval, shell=True, pickle) e padrões de SQLi, NoSQL, SSTI, command e prompt injection, JWT fraco.',
    passos: [
      'Clone o repositório do cliente (ou passe a URL: ele clona raso e apaga no fim).',
      'Rode scripts/reposcan.sh <alvo> --html laudo.html.',
      'Use --json --fail-on media para usar como gate na CI.',
    ],
    resultado: 'Lista de achados por categoria; código de saída 0 limpo, 1 reprovou, 2 erro.',
    limites: [
      'Heurística por padrões: acha 1 onde a revisão com IA acha dezenas (não entende authn/authz nem lógica).',
      'Ainda não cruza dependências com base de CVE (OSV é o próximo passo).',
      'Só lê: nunca instala dependência nem roda testes do repositório.',
    ],
  },
  {
    id: 'local', nome: 'Varredura local com o seu Claude Code', frente: 'codigo', comando: 'scripts\\varredura-local.ps1 -Repo C:\\temp\\<repositorio>', ia: 'profunda', exporta: true,
    resumo: 'A mesma varredura profunda do plugin claude-security, mas num repositório já clonado na sua máquina e usando a sua assinatura do Claude Code (não gasta a chave da API). O script cria uma cópia descartável sem push, abre o Claude Code nela com regras de negação e coleta o relatório.',
    passos: [
      'No PowerShell, na pasta do SegInfo: scripts\\varredura-local.ps1 -Repo C:\\temp\\<repo> (ou -Branch <branch> para revisar um PR).',
      'No Claude Code que abrir, cole um prompt de Pentest de aplicação → Prompts de pentest (comece pelo "Mapa da aplicação" e depois a varredura de esforço alto).',
      'Ao terminar, /exit: o script copia CLAUDE-SECURITY-* para %USERPROFILE%\\SegInfo-Confidencial\\varreduras e confere que o original não mudou.',
      'Em Revisão de código (IA) → Importar varredura local, escolha a pasta: achados, patches e export HTML/PDF como numa varredura do worker.',
    ],
    resultado: 'Relatório MD/SARIF/patches do plugin + análises dirigidas, importáveis no app.',
    limites: [
      'No Windows o plugin não tem sandbox: os agentes leem com o seu usuário. Só para código autorizado (empresa/cliente), nunca de origem desconhecida.',
      'Nada vai ao GitHub: a cópia não tem push e o plugin nunca commita. O relatório é confidencial e fica fora do OneDrive.',
      'Consome a cota da sua assinatura; esforço alto e superfície de ataque podem levar horas.',
    ],
  },
  {
    id: 'prompts', nome: 'Prompts de pentest', frente: 'codigo', to: '/prompts', ia: 'profunda', exporta: false,
    resumo: 'Prompts prontos que chamam as skills do plugin (varredura, superfície de ataque, modelo de ameaças, triagem, patches) e análises dirigidas de aplicação: mapa, autorização (IDOR/BOLA), fluxos de dinheiro, Web3, injeção, JWT e integrações.',
    passos: ['Abra Pentest de aplicação → Prompts de pentest.', 'Copie o prompt (as regras de só-leitura vão junto) e cole no Claude Code aberto pelo script.'],
    resultado: 'Análises em CLAUDE-SECURITY-ANALISES/, coletadas pelo script junto do relatório.',
    limites: ['Os prompts de aplicação não passam pela verificação por agentes do plugin: confirme os achados em staging.'],
  },
  {
    id: 'radar', nome: 'Radar', frente: 'deteccao', to: '/radar', ia: 'nenhuma', exporta: false,
    resumo: 'Eventos dos sensores e honeypots por origem, serviço e técnica MITRE, com linha do tempo e reputação (GreyNoise).',
    passos: ['Filtre por ambiente e técnica.', 'Abra um evento para ver o caminho do ataque.'],
    resultado: 'Quem está atacando, o quê e como.', limites: ['Evento recebido não é, sozinho, um ataque confirmado.'],
  },
  {
    id: 'wazuh', nome: 'Wazuh', frente: 'deteccao', to: '/wazuh', ia: 'nenhuma', exporta: false,
    resumo: 'Saúde do SIEM, agentes e alertas, incluindo as regras customizadas do range.', passos: ['Confira agentes desconectados e alertas altos.'],
    resultado: 'Estado da detecção.', limites: ['Mostra o que as regras pegam; sem regra, sem alerta.'],
  },
  {
    id: 'investigacoes', nome: 'Investigações', frente: 'deteccao', to: '/investigacoes', ia: 'nenhuma', exporta: false,
    resumo: 'Dossiês por janela de tempo: eventos, arquivos, persistência, processos e conexões.', passos: ['Abra um caso e siga a linha do tempo.'],
    resultado: 'Narrativa do incidente com evidências.', limites: ['Restrito ao ambiente controlado.'],
  },
  {
    id: 'laudos', nome: 'Laudos dos alvos', frente: 'deteccao', to: '/laudos', ia: 'nenhuma', exporta: true,
    resumo: 'Perícia do que os invasores deixaram nos alvos do honeypot antes de cada reset, com técnicas MITRE.', passos: ['Abra a ficha do alvo e exporte HTML/PDF.'],
    resultado: 'Laudo pericial exportável.', limites: ['Coleta do honeypot, não de cliente.'],
  },
  {
    id: 'artex', nome: 'Caça ao ARTEX', frente: 'deteccao', to: '/artex', ia: 'nenhuma', exporta: false,
    resumo: 'Como detectar e caçar ataques agênticos (ARTEX e afins), por camada, mapeado ao ATT&CK.', passos: ['Use as dicas de hunting no SIEM do cliente.'],
    resultado: 'Hipóteses de caça e sinais.', limites: ['Material defensivo: o framework ofensivo não é embutido.'],
  },
  {
    id: 'kev', nome: 'Ameaças (KEV)', frente: 'deteccao', to: '/ameacas', ia: 'nenhuma', exporta: false,
    resumo: 'Vulnerabilidades exploradas ativamente (CISA KEV) cruzadas com os produtos que você acompanha.', passos: ['Cadastre os produtos do cliente e priorize o que aparecer.'],
    resultado: 'Lista do que corrigir primeiro.', limites: ['Só o que está no catálogo KEV.'],
  },
  {
    id: 'attack', nome: 'Matriz ATT&CK', frente: 'deteccao', to: '/attack', ia: 'nenhuma', exporta: false,
    resumo: 'Táticas e técnicas com a cobertura de detecção do ambiente.', passos: ['Use para mapear achados do laudo a técnicas.'],
    resultado: 'Linguagem comum para o relatório.', limites: [],
  },
  {
    id: 'metodologia', nome: 'Metodologia de pentest', frente: 'metodo', to: '/metodologia', ia: 'nenhuma', exporta: false,
    resumo: 'Ciclo de 7 fases (PTES + OWASP WSTG) com checklist, ferramentas e cuidados de escopo.', passos: ['Siga fase a fase em cada contrato.'],
    resultado: 'Roteiro do teste do começo ao laudo.', limites: [],
  },
  {
    id: 'ferramentas', nome: 'Arsenal de ferramentas', frente: 'metodo', to: '/ferramentas', ia: 'nenhuma', exporta: false,
    resumo: 'Catálogo de ferramentas externas (Burp, ZAP, nuclei, sqlmap…) por fase e domínio.', passos: ['Filtre pela fase em que está.'],
    resultado: 'Qual ferramenta usar para cada etapa.', limites: ['É catálogo: as ferramentas rodam fora do app.'],
  },
  {
    id: 'range', nome: 'Range vulnerável e Labs', frente: 'metodo', to: '/range', ia: 'nenhuma', exporta: false,
    resumo: 'Alvos de laboratório isolados para validar uma técnica antes de usar no cliente.', passos: ['Reproduza o teste no range antes de ir a campo.'],
    resultado: 'Confiança de que o teste é seguro.', limites: [],
  },
  {
    id: 'agents', nome: 'Meus agentes', frente: 'apoio', to: '/agents', ia: 'apoio', exporta: false,
    resumo: 'Agentes Claude que conversam e operam ferramentas do homelab (Proxmox, FortiGate, switch, Wazuh) com aprovação e auditoria.', passos: ['Crie um agente, escolha as ferramentas e teste no Playground.'],
    resultado: 'Operação assistida e auditada.', limites: ['Hoje operam infraestrutura; não executam o Scanner nem testes de pentest.'],
  },
  {
    id: 'arsenal-ia', nome: 'Arsenal IA', frente: 'apoio', to: '/arsenal', ia: 'apoio', exporta: false,
    resumo: 'Sua biblioteca de prompts, skills e agentes de segurança que funcionaram.', passos: ['Guarde o prompt que deu bom resultado num teste.'],
    resultado: 'Repertório reutilizável.', limites: [],
  },
  {
    id: 'cerebro', nome: 'Segundo Cérebro e Biblioteca', frente: 'apoio', to: '/cerebro', ia: 'apoio', exporta: false,
    resumo: 'Notas e links com busca por trecho; os agentes consultam essas memórias.', passos: ['Salve aprendizados de cada teste.'],
    resultado: 'Base de conhecimento pessoal.', limites: ['Não guarde dado de cliente aqui.'],
  },
  {
    id: 'cofre', nome: 'Cofre', frente: 'apoio', to: '/cofre', ia: 'nenhuma', exporta: false,
    resumo: 'Senhas cifradas com AES-GCM no navegador; a senha-mestra nunca é salva.', passos: ['Guarde credenciais de teste do contrato.'],
    resultado: 'Credenciais protegidas.', limites: ['Esqueceu a senha-mestra, perdeu o cofre.'],
  },
];

export interface Roteiro {
  id: string;
  titulo: string;
  quando: string;
  passos: { texto: string; ferramenta?: string }[];
}

/** Como combinar as ferramentas num teste real de cliente. */
export const ROTEIROS: Roteiro[] = [
  {
    id: 'api', titulo: 'Pentest de URLs, endpoints e APIs', quando: 'O cliente passa URLs/IPs no escopo, sem código.',
    passos: [
      { texto: 'Confirme escopo e autorização por escrito; defina janela e o que é produção.', ferramenta: 'metodologia' },
      { texto: 'Descubra a superfície: subdomínios, portas e CVEs conhecidas dos domínios do escopo.', ferramenta: 'exposicao' },
      { texto: 'Rode o Scanner em lote em todas as URLs, sem testes ativos.', ferramenta: 'scanner' },
      { texto: 'Nos alvos que não são de transação, repita com os testes ativos seguros.', ferramenta: 'ativos' },
      { texto: 'Analise os JWT que a aplicação emite para um usuário de teste.', ferramenta: 'jwt' },
      { texto: 'Aprofunde manualmente (login, fluxos, autorização entre usuários) com Burp/ZAP.', ferramenta: 'ferramentas' },
      { texto: 'Cruze os produtos/versões achados com o KEV e exporte o laudo em HTML/PDF.', ferramenta: 'kev' },
    ],
  },
  {
    id: 'repo', titulo: 'Pentest de repositório (código-fonte)', quando: 'O cliente dá acesso ao repositório.',
    passos: [
      { texto: 'Rode o Reposcan primeiro: em segundos mostra segredos, CI/Docker inseguros e padrões óbvios.', ferramenta: 'reposcan' },
      { texto: 'Peça a Revisão de código (IA) com esforço alto — no worker (URL do GitHub) ou na sua máquina (repositório já clonado, sem gastar a API): é ela que acha authn/authz, lógica e cadeias.', ferramenta: 'revisao' },
      { texto: 'No repositório local, rode também os prompts de aplicação (autorização, dinheiro, Web3) e consolide o laudo.', ferramenta: 'prompts' },
      { texto: 'Valide os achados críticos lendo o trecho apontado (e, se possível, em staging).' },
      { texto: 'Junte os dois relatórios e os patches sugeridos no laudo; exporte HTML/PDF.', ferramenta: 'revisao' },
    ],
  },
  {
    id: 'app', titulo: 'Pentest de aplicação completa (código + ambiente)', quando: 'Você tem o repositório E a aplicação publicada.',
    passos: [
      { texto: 'Faça o roteiro de repositório: a IA aponta onde estão as falhas no código.', ferramenta: 'revisao' },
      { texto: 'Use os achados para mirar o Scanner nas rotas certas (as que a IA marcou).', ferramenta: 'scanner' },
      { texto: 'Confirme em staging o que o código sugere (ex.: rota admin sem autenticação).' },
      { texto: 'Coloque Reposcan e Scanner na CI do cliente como gate, para não regredir.', ferramenta: 'gate' },
    ],
  },
];

/** Busca sem acento e sem caixa em nome, resumo, passos e limites. */
export function filtrarFerramentas(termo: string, lista: Ferramenta[] = FERRAMENTAS): Ferramenta[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(termo.trim());
  if (!q) return lista;
  return lista.filter((f) => norm([f.nome, f.resumo, f.comando ?? '', ...f.passos, ...f.limites].join(' ')).includes(q));
}

// ---------- comandos prontos (aparecem na Ajuda e no "Como usar" do rodapé de cada ferramenta) ----------

export interface Comando { rotulo: string; codigo: string; shell: 'PowerShell' | 'Git Bash' | 'Claude Code' }

export const COMANDOS: Record<string, Comando[]> = {
  local: [
    {
      rotulo: 'Varrer um repositório já clonado (repositório inteiro)', shell: 'PowerShell',
      codigo: 'powershell -ExecutionPolicy Bypass -File "$HOME\\SegInfo-Confidencial\\varredura-local.ps1" -Repo C:\\temp\\criptobrokers',
    },
    {
      rotulo: 'Revisar só uma branch (PR)', shell: 'PowerShell',
      codigo: 'powershell -ExecutionPolicy Bypass -File "$HOME\\SegInfo-Confidencial\\varredura-local.ps1" -Repo C:\\temp\\criptobrokers -Branch feat/minha-branch',
    },
    {
      rotulo: 'Atualizar o clone antes de varrer (só baixa; não envia nada)', shell: 'PowerShell',
      codigo: 'git -C C:\\temp\\criptobrokers fetch --all --prune\ngit -C C:\\temp\\criptobrokers pull --ff-only',
    },
    {
      rotulo: 'Dentro do Claude Code que o script abrir: primeiro o mapa, depois a varredura', shell: 'Claude Code',
      codigo: '(cole o prompt "Mapa da aplicação" de Pentest de aplicação → Prompts de pentest)\n/claude-security:claude-security scan this whole repository at high effort; I understand it may take a while and use a significant number of tokens\n/exit',
    },
    {
      rotulo: 'Ver os relatórios coletados', shell: 'PowerShell',
      codigo: 'explorer "$HOME\\SegInfo-Confidencial\\varreduras"',
    },
    {
      rotulo: 'Retomar uma varredura que caiu (o script mantém a cópia e mostra o caminho)', shell: 'PowerShell',
      codigo: 'cd "$env:TEMP\\seginfo-varredura\\<repo>-<data>"\nclaude --resume\n# dentro: /claude-security:claude-security continue the scan',
    },
  ],
  revisao: [
    {
      rotulo: 'Repositório privado no GitHub: o worker usa um token só-leitura (Contents: Read-only) configurado na VM 100', shell: 'PowerShell',
      codigo: '# já configurado para EtherGlobalAssets/criptobrokers. Para outro repositório, inclua-o no mesmo token em\n# GitHub → Settings → Developer settings → Fine-grained tokens → (token) → Repository access',
    },
  ],
  reposcan: [
    {
      rotulo: 'Análise estática rápida de um repositório local (Git Bash, na pasta do SegInfo)', shell: 'Git Bash',
      codigo: 'scripts/reposcan.sh /c/temp/criptobrokers --html "$HOME/SegInfo-Confidencial/reposcan-criptobrokers.html"',
    },
    { rotulo: 'Como gate de CI (falha se houver achado médio ou pior)', shell: 'Git Bash', codigo: 'scripts/reposcan.sh . --json --fail-on media' },
  ],
  gate: [
    { rotulo: 'Chamar o Scanner na pipeline (precisa de SCAN_CI_SECRET e do Service Token)', shell: 'Git Bash', codigo: 'scripts/scan-ci.sh https://staging.exemplo.com/api/health' },
  ],
};

/** Ferramentas a mostrar no "Como usar" do rodapé de cada tela. */
export const COMO_USAR_POR_ROTA: Record<string, string[]> = {
  '/scanner': ['scanner', 'ativos', 'jwt', 'gate'],
  '/revisao-codigo': ['revisao', 'local', 'prompts', 'reposcan'],
  '/prompts': ['local', 'prompts'],
  '/exposicao': ['exposicao'],
  '/artex': ['artex'],
  '/metodologia': ['metodologia'],
  '/laudos': ['laudos'],
};
