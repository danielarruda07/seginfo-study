/**
 * Camada didática do Radar: explica cada tipo de evento em linguagem popular,
 * compara com o que aconteceria num ambiente real (não é "simulação", é "no mundo
 * real isso seria...") e descreve as fases do ataque para o organograma.
 *
 * Chaveado pela ação normalizada pelos coletores (ver inteligencia/regras.ts).
 * Conteúdo sem IPs, hosts, domínios ou credenciais — só o conceito.
 */

export type FaseAtaque = 'inicio' | 'ampliacao' | 'impacto';

export interface EtapaFluxo {
  fase: FaseAtaque;
  titulo: string;
  texto: string;
}

export interface DidaticaAtaque {
  /** Uma frase curta e simples para a coluna da tabela. */
  resumoPopular: string;
  /** Como o ataque funciona, para quem não é da área. */
  comoFunciona: string;
  /** Comparação com um ambiente real (empresa de verdade), para dar a dimensão do risco. */
  mundoReal: string;
  /** Organograma: como começa, como se amplia por dentro e qual o impacto. Vazio = sem fluxo. */
  fluxo: EtapaFluxo[];
}

const FASE_LABEL: Record<FaseAtaque, string> = {
  inicio: '1. Como começa',
  ampliacao: '2. Como se amplia por dentro',
  impacto: '3. Impacto',
};
export const faseLabel = (f: FaseAtaque) => FASE_LABEL[f];

export const DIDATICA_ACAO: Record<string, DidaticaAtaque> = {
  login_falha: {
    resumoPopular: 'Alguém tentou adivinhar a senha e errou.',
    comoFunciona:
      'O atacante testa muitas combinações de usuário e senha, uma atrás da outra, torcendo para acertar. Uma falha isolada é comum; centenas vindas do mesmo endereço são um ataque de força bruta.',
    mundoReal:
      'Numa empresa de verdade, é como um ladrão testando milhares de senhas na fechadura da porta dos fundos. Se uma funcionar, ele entra sem arrombar nada — e, olhando só a porta, ninguém percebe.',
    fluxo: [
      { fase: 'inicio', titulo: 'Escolhe um alvo exposto', texto: 'Acha um serviço de acesso (login remoto) aberto e usa uma lista de senhas comuns ou vazadas.' },
      { fase: 'ampliacao', titulo: 'Acerta uma senha', texto: 'Com uma conta válida, entra e começa a procurar outras senhas, pastas e máquinas da rede.' },
      { fase: 'impacto', titulo: 'Acesso legítimo', texto: 'Passa a agir como um usuário normal — rouba dados ou prepara um bloqueio, sem precisar de malware.' },
    ],
  },
  lockout: {
    resumoPopular: 'Uma conta foi travada de tanto errarem a senha.',
    comoFunciona:
      'A proteção da conta bloqueia o acesso depois de muitas tentativas erradas seguidas. Costuma ser o rastro de uma força bruta — ou de alguém que esqueceu a própria senha.',
    mundoReal:
      'Numa empresa, é como um cofre que trava sozinho após várias combinações erradas. Protege, mas também pode atrapalhar o dono se o ataque for contínuo (negação de serviço por bloqueio).',
    fluxo: [
      { fase: 'inicio', titulo: 'Tentativas em excesso', texto: 'Muitos erros de senha na mesma conta, em pouco tempo.' },
      { fase: 'ampliacao', titulo: 'A conta trava', texto: 'A política de bloqueio protege a senha, mas pode deixar o usuário legítimo de fora.' },
      { fase: 'impacto', titulo: 'Sinal de ataque', texto: 'Serve de alerta: investigue a origem e veja se há força bruta em andamento.' },
    ],
  },
  login_ok: {
    resumoPopular: 'Alguém entrou com usuário e senha válidos.',
    comoFunciona:
      'Um login aceito significa que a senha estava certa. Em isca (honeypot) é de propósito e não dá acesso a nada real; fora dela, pode ser acesso indevido com credencial roubada ou adivinhada.',
    mundoReal:
      'Numa empresa, é alguém entrando pela porta da frente com um crachá válido — só que o crachá pode ter sido roubado. Acesso legítimo é o disfarce preferido do atacante: não dispara alarme.',
    fluxo: [
      { fase: 'inicio', titulo: 'Consegue uma credencial', texto: 'Obtém usuário e senha por vazamento, phishing ou força bruta.' },
      { fase: 'ampliacao', titulo: 'Move-se por dentro', texto: 'Entra como usuário comum e salta para contas e servidores com mais poder (movimento lateral).' },
      { fase: 'impacto', titulo: 'Age como funcionário', texto: 'Opera por dentro, imitando um usuário real, o que dificulta muito a detecção.' },
    ],
  },
  comando: {
    resumoPopular: 'Depois de entrar, o atacante rodou comandos.',
    comoFunciona:
      'Já dentro de uma máquina, o atacante digita comandos para explorar o sistema, baixar ferramentas, criar contas ou manter o acesso.',
    mundoReal:
      'É o intruso que já está dentro do prédio e começa a abrir gavetas, copiar chaves e mapear as salas. A invasão já aconteceu; agora ele está agindo.',
    fluxo: [
      { fase: 'inicio', titulo: 'Já tem um pé dentro', texto: 'Obteve acesso a uma máquina (por senha, falha ou isca).' },
      { fase: 'ampliacao', titulo: 'Explora e se fixa', texto: 'Mapeia a rede, baixa ferramentas e cria formas de voltar (persistência).' },
      { fase: 'impacto', titulo: 'Prepara o objetivo', texto: 'Reúne o necessário para roubar dados, minerar ou disparar ransomware.' },
    ],
  },
  download: {
    resumoPopular: 'O atacante baixou um arquivo (ferramenta ou malware).',
    comoFunciona:
      'A máquina invadida busca um programa de fora: malware, minerador de criptomoeda ou ferramenta de ataque. A URL de origem é um indicador valioso.',
    mundoReal:
      'Como um ladrão que, já dentro da casa, recebe pela janela as ferramentas para arrombar o cofre. O arquivo baixado é a "mala de ferramentas" do próximo passo.',
    fluxo: [
      { fase: 'inicio', titulo: 'Acesso obtido', texto: 'Já controla a máquina e precisa de mais capacidade.' },
      { fase: 'ampliacao', titulo: 'Traz a ferramenta', texto: 'Baixa o segundo estágio de um servidor externo e o executa.' },
      { fase: 'impacto', titulo: 'Capacidade nova', texto: 'Ganha poder para minerar, se espalhar ou cifrar arquivos.' },
    ],
  },
  tunel: {
    resumoPopular: 'Tentou usar o alvo como ponte para outro lugar.',
    comoFunciona:
      'O atacante transforma a máquina invadida em um "pulo" para alcançar outros destinos, escondendo a origem real da conexão (proxy, encaminhamento de porta).',
    mundoReal:
      'É como usar a sua casa de esconderijo para dar golpes na casa do vizinho: se a polícia rastrear, chega em você, não no criminoso. Seu ativo vira cúmplice involuntário.',
    fluxo: [
      { fase: 'inicio', titulo: 'Controla um ponto', texto: 'Tem acesso a uma máquina com saída de rede.' },
      { fase: 'ampliacao', titulo: 'Faz a ponte', texto: 'Encaminha o tráfego por ela para atacar outros alvos ou esconder-se.' },
      { fase: 'impacto', titulo: 'Origem mascarada', texto: 'Os ataques parecem vir do seu ativo, não do atacante.' },
    ],
  },
  reflexao: {
    resumoPopular: 'Usaram seu endereço para atacar outra vítima (DDoS).',
    comoFunciona:
      'O atacante envia pedidos com endereço de origem falsificado para o seu serviço responder à vítima real, multiplicando o volume de tráfego contra ela.',
    mundoReal:
      'É como alguém pedir mil pizzas em nome do vizinho: o vizinho (a vítima) é soterrado de entregas, e quem fez os pedidos parece ser você. O IP que aparece aqui é o da vítima, não do atacante.',
    fluxo: [
      { fase: 'inicio', titulo: 'Origem falsificada', texto: 'O atacante forja o endereço da vítima e mira serviços que respondem muito.' },
      { fase: 'ampliacao', titulo: 'Amplificação', texto: 'Cada pedido pequeno gera uma resposta grande, somando muitos refletores.' },
      { fase: 'impacto', titulo: 'Vítima derrubada', texto: 'A vítima recebe uma enxurrada de respostas e sai do ar. Garanta que nada seu responde.' },
    ],
  },
  scan: {
    resumoPopular: 'Alguém vasculhou quais portas e serviços estão abertos.',
    comoFunciona:
      'Reconhecimento: o atacante bate em muitas portas para ver o que responde, montando um mapa do que pode ser atacado depois.',
    mundoReal:
      'É o ladrão andando pela rua, testando maçanetas e olhando janelas antes de escolher a casa. Sozinho não causa dano, mas quase sempre antecede um ataque.',
    fluxo: [
      { fase: 'inicio', titulo: 'Mapeia o alvo', texto: 'Varre portas e serviços expostos à internet.' },
      { fase: 'ampliacao', titulo: 'Escolhe a brecha', texto: 'Mira o serviço mais frágil (versão antiga, senha fraca).' },
      { fase: 'impacto', titulo: 'Prepara o ataque', texto: 'Usa o mapa para a próxima etapa: força bruta ou exploração de falha.' },
    ],
  },
  bloqueio: {
    resumoPopular: 'O firewall barrou a conexão.',
    comoFunciona: 'A tentativa parou na porta: o firewall recusou e registrou. Nada entrou.',
    mundoReal: 'Como a portaria que recusou alguém sem autorização — fica registrado, mas sem consequência. Vale acompanhar volume e origem.',
    fluxo: [],
  },
  conexao: {
    resumoPopular: 'Uma conexão foi registrada, sem ação maliciosa clara.',
    comoFunciona: 'Alguém se conectou a um serviço, mas ainda sem um comportamento ofensivo identificado.',
    mundoReal: 'Como alguém que para na frente da loja e olha a vitrine: pode ser cliente, pode ser alguém estudando o lugar.',
    fluxo: [],
  },
  outro: {
    resumoPopular: 'Evento sem classificação específica.',
    comoFunciona: 'Evento registrado pelos coletores que ainda não se encaixa numa categoria conhecida.',
    mundoReal: 'Vale olhar o detalhe do evento para entender o contexto.',
    fluxo: [],
  },
};

const PADRAO: DidaticaAtaque = DIDATICA_ACAO.outro;

/**
 * Papel de cada ação no caminho de um ataque, para montar o organograma de um dossiê
 * inteiro (Investigações) a partir das ações que de fato apareceram na janela.
 */
const PAPEL_CAMINHO: Record<string, { fase: FaseAtaque; titulo: string; texto: string }> = {
  scan: { fase: 'inicio', titulo: 'Reconhecimento', texto: 'Mapeou portas e serviços para achar por onde entrar.' },
  login_falha: { fase: 'inicio', titulo: 'Tentativa de acesso', texto: 'Tentou adivinhar usuário e senha (força bruta).' },
  lockout: { fase: 'inicio', titulo: 'Conta travada', texto: 'O excesso de tentativas travou uma conta.' },
  login_ok: { fase: 'ampliacao', titulo: 'Entrou', texto: 'Conseguiu um acesso válido e passou a agir por dentro.' },
  comando: { fase: 'ampliacao', titulo: 'Agiu por dentro', texto: 'Executou comandos para explorar o sistema e se fixar.' },
  download: { fase: 'ampliacao', titulo: 'Trouxe ferramentas', texto: 'Baixou arquivos de fora (ferramenta ou malware).' },
  tunel: { fase: 'impacto', titulo: 'Usou como ponte', texto: 'Tentou usar o alvo para alcançar outros destinos.' },
  reflexao: { fase: 'impacto', titulo: 'Abuso para DDoS', texto: 'Tentou usar o alvo para atacar terceiros.' },
};
const ORDEM_CAMINHO = ['scan', 'login_falha', 'lockout', 'login_ok', 'comando', 'download', 'tunel', 'reflexao'];

/** Organograma do caminho do ataque, montado a partir das ações presentes num dossiê. */
export function caminhoDidatico(acoes: Iterable<string>): EtapaFluxo[] {
  const vistos = new Set(acoes);
  return ORDEM_CAMINHO
    .filter((a) => vistos.has(a) && PAPEL_CAMINHO[a])
    .map((a) => ({ fase: PAPEL_CAMINHO[a].fase, titulo: PAPEL_CAMINHO[a].titulo, texto: PAPEL_CAMINHO[a].texto }));
}

/** Didática do evento, com o ajuste de isca (login aceito em honeypot é esperado). */
export function didaticaDoEvento(acao: string, ehIsca: boolean): DidaticaAtaque {
  const base = DIDATICA_ACAO[acao] ?? PADRAO;
  if (acao === 'login_ok' && ehIsca) {
    return {
      ...base,
      resumoPopular: 'Login aceito numa isca — de propósito, para observar o atacante.',
      mundoReal:
        'A isca (honeypot) deixa entrar de propósito, numa sala falsa e descartável, para ver o que o atacante faz. Numa empresa de verdade, esse mesmo login seria um acesso indevido grave.',
    };
  }
  return base;
}
