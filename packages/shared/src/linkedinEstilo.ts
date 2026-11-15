/**
 * Filtro anti-genérico: procura no texto os padrões que fazem um post soar escrito por IA ou por
 * "guru de LinkedIn". É heurístico e local (sem IA): serve para avisar e para orientar a reescrita,
 * nunca para bloquear. Roda na tela e no servidor com as mesmas regras.
 */

export interface AlertaEstilo {
  id: string;
  rotulo: string;
  dica: string;
  /** Trechos do texto que dispararam o alerta (no máximo 3) */
  trechos: string[];
}

const LETRA = '\\p{L}';

/** Expressões de abertura e de enchimento típicas de texto genérico. */
const FRASES_CLICHE = [
  'no mundo de hoje', 'no mundo atual', 'nos dias de hoje', 'nos dias atuais', 'no cenário atual', 'cenário cada vez mais',
  'em um mundo cada vez mais', 'é fundamental', 'é essencial', 'é crucial', 'é importante destacar', 'é importante ressaltar',
  'vale ressaltar', 'vale destacar', 'não podemos esquecer', 'sem sombra de dúvida', 'divisor de águas', 'game changer', 'game-changer',
  'mergulhar', 'mergulhe', 'desbloquear', 'desbloqueie', 'alavancar', 'alavanque', 'potencializar', 'potencialize', 'agregar valor',
  'sinergia', 'holístico', 'holística', 'robusto', 'robusta', 'panorama', 'navegar pelo', 'navegando pelo', 'fica a dica', 'sem mais delongas',
  'deixo aqui', 'você sabia que', 'já parou para pensar', 'o segredo é', 'a verdade é que', 'a realidade é que', 'em suma', 'em resumo',
  'neste post', 'neste artigo', 'ao final deste',
];

const ABERTURA_GENERICA = new RegExp(
  '^(?:hoje\\s+(?:eu\\s+)?(?:quero|vou|venho)|estou\\s+(?:muito\\s+)?(?:feliz|animad[oa]|empolgad[oa]|honrad[oa])|tenho\\s+o\\s+prazer|'
  + '[ée]\\s+com\\s+(?:grande\\s+)?(?:satisfa[çc][ãa]o|orgulho|alegria)|voc[êe]\\s+j[áa]\\s+(?:parou|pensou)|ser[áa]\\s+que\\b|vamos\\s+falar)',
  'iu',
);

const EXPRESSOES: { id: string; rotulo: string; dica: string; re: RegExp }[] = [
  {
    id: 'nao-e-x-e-y', rotulo: 'Contraste "não é X, é Y"',
    dica: 'Diga direto o que é. O contraste armado vira muleta de texto gerado.',
    re: new RegExp(`(?<![${LETRA}])n[ãa]o\\s+(?:é|foi|são|era|se\\s+trata\\s+de|se\\s+resume\\s+a)\\s+(?:apenas\\s+|só\\s+|somente\\s+|sobre\\s+)?[^.!?\\n]{2,80}?[,;:—–-]\\s*(?:é|foi|são|era|mas|e\\s+sim)\\s`, 'giu'),
  },
  {
    id: 'pergunta-retorica', rotulo: 'Pergunta retórica com resposta na sequência',
    dica: 'Troque "O resultado? ..." por uma frase afirmativa.',
    re: new RegExp(`(?:^|[\\n.!]\\s*)(?:o|a|os|as)\\s+(?:resultado|problema|segredo|verdade|motivo|erro|truque|detalhe|ponto|pior|melhor|impacto)[${LETRA}]*\\?`, 'giu'),
  },
  {
    id: 'revelacao', rotulo: 'Revelação encenada',
    dica: 'Vá ao ponto sem anunciar que ele vai chegar.',
    re: new RegExp(`(?:aqui\\s+est[áa]|e\\s+aqui\\s+vem|agora\\s+vem|e\\s+[ée]\\s+aqui\\s+que)\\s+(?:o|a)\\s+(?:ponto|parte|truque|segredo|melhor|detalhe|mais)|pulo\\s+do\\s+gato|(?<![${LETRA}])spoiler`, 'giu'),
  },
  {
    id: 'cta-artificial', rotulo: 'Pedido artificial de interação',
    dica: 'Faça uma pergunta específica ou termine na ideia. Evite pedir curtida, comentário ou compartilhamento.',
    re: /(?:curta|compartilhe|comente|marque|siga)\b[^.\n]{0,40}?(?:se\s+(?:você\s+)?concorda|se\s+gostou|para\s+mais|esse\s+post|este\s+post|abaixo)|deixe\s+(?:o\s+)?seu\s+coment[áa]rio|👇/giu,
  },
  {
    id: 'markdown', rotulo: 'Marcação que o LinkedIn não renderiza',
    dica: 'O LinkedIn mostra os asteriscos e o # literalmente. Escreva texto simples.',
    re: /\*\*[^*\n]{1,80}\*\*|^#{1,4}\s+\S/gmu,
  },
];

function trecho(texto: string, inicio: number, tamanho: number): string {
  const de = Math.max(0, inicio - 15);
  const ate = Math.min(texto.length, inicio + tamanho + 25);
  return `${de > 0 ? '…' : ''}${texto.slice(de, ate).replace(/\s+/g, ' ').trim()}${ate < texto.length ? '…' : ''}`;
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Frases em sequência com até 4 palavras ("Sem atalho. Sem mágica. Só prática."). */
function sequenciasCurtas(texto: string): string[] {
  const achados: string[] = [];
  for (const bloco of texto.split(/\n+/)) {
    const frases = bloco.split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean);
    let corrida: string[] = [];
    const fechar = () => { if (corrida.length >= 3) achados.push(corrida.join(' ')); corrida = []; };
    for (const f of frases) {
      if (f.split(/\s+/).length <= 4) corrida.push(f); else fechar();
    }
    fechar();
  }
  return achados;
}

/** Lista o que no texto soa genérico. Texto vazio ou curto demais não gera alertas. */
export function detectarGenerico(texto: string): AlertaEstilo[] {
  const t = texto.trim();
  if (t.length < 40) return [];
  const alertas: AlertaEstilo[] = [];

  const cliches: string[] = [];
  for (const f of FRASES_CLICHE) {
    const re = new RegExp(`(?<![${LETRA}])${escapar(f)}(?![${LETRA}])`, 'giu');
    for (const m of t.matchAll(re)) cliches.push(trecho(t, m.index ?? 0, m[0].length));
  }
  if (cliches.length) {
    alertas.push({ id: 'cliche', rotulo: 'Clichês e palavras de enchimento', dica: 'Troque por o que você fez, viu ou decidiu, em palavras suas.', trechos: cliches.slice(0, 3) });
  }

  const primeira = t.split('\n').find((l) => l.trim())?.trim() ?? '';
  if (ABERTURA_GENERICA.test(primeira)) {
    alertas.push({ id: 'abertura', rotulo: 'Abertura genérica', dica: 'Comece pela ideia, pelo número ou pelo detalhe concreto, não por anunciar que vai falar.', trechos: [primeira.slice(0, 90)] });
  }

  for (const e of EXPRESSOES) {
    const trechos = [...t.matchAll(e.re)].map((m) => trecho(t, m.index ?? 0, m[0].length));
    if (trechos.length) alertas.push({ id: e.id, rotulo: e.rotulo, dica: e.dica, trechos: trechos.slice(0, 3) });
  }

  const travessoes = [...t.matchAll(/—/g)];
  if (travessoes.length >= 2) {
    alertas.push({
      id: 'travessoes', rotulo: `Travessões em excesso (${travessoes.length})`,
      dica: 'Use ponto ou vírgula. Travessões em cadeia são marca registrada de texto gerado.',
      trechos: travessoes.slice(0, 3).map((m) => trecho(t, m.index ?? 0, 1)),
    });
  }

  const emojis = [...t.matchAll(/\p{Extended_Pictographic}/gu)];
  const linhasComEmoji = t.split('\n').filter((l) => /^\s*\p{Extended_Pictographic}/u.test(l)).length;
  if (emojis.length > 3 || linhasComEmoji >= 3) {
    alertas.push({
      id: 'emojis', rotulo: `Emojis demais (${emojis.length})`,
      dica: 'Um ou dois, quando ajudam. Emoji como marcador de cada linha lê como panfleto.',
      trechos: emojis.slice(0, 3).map((m) => trecho(t, m.index ?? 0, m[0].length)),
    });
  }

  const curtas = sequenciasCurtas(t);
  if (curtas.length) {
    alertas.push({ id: 'staccato', rotulo: 'Frases curtíssimas em sequência', dica: 'Junte as ideias em uma frase com verbo. Três golpes seguidos soam como slogan.', trechos: curtas.slice(0, 3).map((c) => c.slice(0, 90)) });
  }

  return alertas;
}

/** Texto curto que descreve os alertas, usado no pedido de reescrita à IA. */
export function alertasParaPedido(alertas: AlertaEstilo[]): string {
  return alertas.map((a) => `- ${a.rotulo}: ${a.dica}${a.trechos.length ? ` Exemplos no texto: ${a.trechos.map((x) => `"${x}"`).join('; ')}` : ''}`).join('\n');
}
