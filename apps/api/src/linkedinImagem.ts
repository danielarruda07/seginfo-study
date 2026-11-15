import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  IlustracaoInSchema, PecaVisualInSchema, TAMANHOS_VISUAIS, exposicaoNoTexto,
  type IlustracaoGerada, type OpcaoIlustracao, type OpcaoIlustracaoInfo, type OpcoesImagem, type TamanhoVisual,
} from '@seginfo/shared';
import type { AuthedRequest } from './auth.js';
import { desenharIlustracaoSvg, ErroIA, iaConfigurada, projetarPecaVisual } from './ia.js';
import { iniciarTarefa } from './linkedinPipeline.js';
import { contextoDeVoz } from './linkedinPerfilContexto.js';

/**
 * Arte dos posts: projeto dos slides (Claude) e ilustração opcional (Gemini API).
 * A ilustração é sempre um pedido explícito, por slide, com limite diário, porque cada imagem custa.
 * A chave vem de GEMINI_API_KEY (Secret no Coolify) e nunca chega ao navegador.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

interface DefOpcao extends Omit<OpcaoIlustracaoInfo, 'disponivel'> { env: string; padrao: string }
// IDs de modelo mudam com frequência: ficam em variável de ambiente, com um padrão razoável.
const DEFS: Record<OpcaoIlustracao, DefOpcao> = {
  'claude-svg': {
    id: 'claude-svg', rotulo: 'Claude SVG', env: '', padrao: '',
    dica: 'Ilustração geométrica (redes, circuitos, grades) desenhada em código pela Claude. Usa a sua chave da Claude; não precisa do Google.', custoEstimado: 'centavos por imagem (só tokens)',
  },
  'gemini-rapido': {
    id: 'gemini-rapido', rotulo: 'Gemini rápido', env: 'GEMINI_MODELO_RAPIDO', padrao: 'gemini-3.1-flash-image',
    dica: 'Mais barato e rápido. Serve para a maioria dos posts.', custoEstimado: 'cerca de US$ 0,04 por imagem',
  },
  'gemini-qualidade': {
    id: 'gemini-qualidade', rotulo: 'Gemini qualidade', env: 'GEMINI_MODELO_QUALIDADE', padrao: 'gemini-3-pro-image-preview',
    dica: 'Mais detalhe e melhor composição. Custa mais; use para capas importantes.', custoEstimado: 'cerca de US$ 0,13 por imagem',
  },
};

export const geminiConfigurado = () => Boolean(process.env.GEMINI_API_KEY);
const modeloDe = (o: OpcaoIlustracao) => (DEFS[o].env ? process.env[DEFS[o].env]?.trim() : '') || DEFS[o].padrao;
const ehGemini = (o: OpcaoIlustracao) => o !== 'claude-svg';
const disponivel = (o: OpcaoIlustracao) => (ehGemini(o) ? geminiConfigurado() : iaConfigurada());
export const limiteDiario = () => Math.max(1, Number(process.env.IMAGEM_LIMITE_DIARIO) || 30);

// contador diário em memória (reinicia com a API): é um freio de custo, não um controle de segurança
const usoDiario = new Map<string, { dia: string; n: number }>();
const hoje = () => new Date().toISOString().slice(0, 10);
export function usadasHoje(usuarioId: string): number {
  const u = usoDiario.get(usuarioId);
  return u && u.dia === hoje() ? u.n : 0;
}
function contabilizar(usuarioId: string) {
  usoDiario.set(usuarioId, { dia: hoje(), n: usadasHoje(usuarioId) + 1 });
}

export function opcoesDeImagem(usuarioId: string): OpcoesImagem {
  return {
    configurado: (Object.keys(DEFS) as OpcaoIlustracao[]).some(disponivel),
    opcoes: Object.values(DEFS).map(({ id, rotulo, dica, custoEstimado }) => ({ id, rotulo, dica, custoEstimado, disponivel: disponivel(id) })),
    limiteDiario: limiteDiario(),
    usadasHoje: usadasHoje(usuarioId),
  };
}

const ACENTOS: Record<string, string> = { ciano: 'teal and cyan', ambar: 'warm amber', violeta: 'soft violet' };

/** Texto enviado ao Gemini: estilo fixo (fundo escuro, sem texto na imagem) mais o tema do slide. */
export function promptDeIlustracao(tema: string, acento?: string): string {
  return `Editorial illustration for a LinkedIn post about information security and IT infrastructure. `
    + `Style: modern, minimal, abstract-technical, deep navy-black background, accents in ${ACENTOS[acento ?? ''] ?? 'teal and cyan'}, `
    + `soft glow, clean composition with calm empty space in the lower half for overlaid text. `
    + `Absolutely no text, no letters, no numbers, no logos, no brand marks, no real people or faces. Theme: ${tema}`;
}

interface PartesGemini { candidates?: { finishReason?: string; content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }[] } }[]; promptFeedback?: { blockReason?: string } }

/** Chama o Gemini e devolve a primeira imagem da resposta. */
export async function gerarIlustracao(opcao: OpcaoIlustracao, tema: string, tamanho: TamanhoVisual, acento?: string): Promise<IlustracaoGerada> {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) throw new ErroIA(503, 'Ilustração por IA não configurada: defina o Secret GEMINI_API_KEY na API (Coolify) e faça redeploy.');
  const modelo = modeloDe(opcao);
  let res: Response;
  try {
    res = await fetch(`${BASE}/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: promptDeIlustracao(tema, acento) }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: TAMANHOS_VISUAIS[tamanho].proporcaoIA } },
      }),
      signal: AbortSignal.timeout(100_000),
    });
  } catch {
    throw new ErroIA(504, 'O Gemini não respondeu a tempo. Tente de novo; se repetir, use só o template.');
  }
  if (!res.ok) {
    const corpo = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } };
    const detalhe = (corpo.error?.message ?? '').slice(0, 160);
    if (res.status === 400 && /API key/i.test(detalhe)) throw new ErroIA(502, 'O Gemini recusou a chave (GEMINI_API_KEY inválida).');
    if (res.status === 404) throw new ErroIA(502, `O modelo "${modelo}" não existe mais para esta chave. Atualize ${DEFS[opcao].env} com um ID de modelo de imagem do AI Studio.`);
    if (res.status === 403) throw new ErroIA(502, 'O Gemini negou o acesso: a chave precisa de faturamento ativo (créditos do plano ou pré-pagamento) para gerar imagens.');
    if (res.status === 429) throw new ErroIA(429, 'Limite do Gemini atingido ou sem saldo. Confira o faturamento no AI Studio.');
    throw new ErroIA(502, `O Gemini recusou o pedido (${res.status}${detalhe ? `: ${detalhe}` : ''}).`);
  }
  const json = (await res.json().catch(() => ({}))) as PartesGemini;
  const partes = json.candidates?.[0]?.content?.parts ?? [];
  for (const p of partes) {
    const d = p.inlineData?.data ?? p.inline_data?.data;
    if (d) return { mime: p.inlineData?.mimeType ?? p.inline_data?.mime_type ?? 'image/png', base64: d };
  }
  const motivo = json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason;
  throw new ErroIA(422, `O Gemini não devolveu imagem${motivo ? ` (${motivo})` : ''}. Reescreva a descrição da ilustração e tente de novo.`);
}

const uid = (req: unknown) => (req as AuthedRequest).usuarioId;
const responder = (r: ReturnType<typeof iniciarTarefa>, reply: FastifyReply) => ('erro' in r ? reply.status(429).send({ error: r.erro }) : r);

export async function registerLinkedinImagemRoutes(app: FastifyInstance) {
  app.get('/api/linkedin/imagem/opcoes', async (req) => opcoesDeImagem(uid(req)));

  // slides do post (texto por slide), projetados pela IA
  app.post('/api/linkedin/tarefas/peca-visual', async (req, reply) => {
    const b = PecaVisualInSchema.safeParse(req.body);
    if (!b.success || b.data.gancho.trim().length + b.data.corpo.trim().length < 40) {
      return reply.status(400).send({ error: 'Escreva o texto do post antes de pedir a arte.' });
    }
    const u = uid(req);
    return responder(iniciarTarefa(u, async () => projetarPecaVisual({ ...b.data, voz: await contextoDeVoz(u) })), reply);
  });

  // uma ilustração por pedido, com limite diário
  app.post('/api/linkedin/tarefas/ilustracao', async (req, reply) => {
    const b = IlustracaoInSchema.safeParse(req.body);
    if (!b.success) return reply.status(400).send({ error: 'Descreva a ilustração (pelo menos 10 caracteres).' });
    if (!disponivel(b.data.opcao)) {
      return reply.status(503).send({ error: ehGemini(b.data.opcao)
        ? 'Este motor não está configurado: defina o Secret GEMINI_API_KEY na API (Coolify) ou use o Claude SVG.'
        : 'A IA não está configurada (ANTHROPIC_API_KEY).' });
    }
    if (exposicaoNoTexto(b.data.prompt).length) return reply.status(400).send({ error: 'A descrição cita endereço IP ou domínio do ambiente. Troque por uma descrição genérica.' });
    const u = uid(req);
    if (usadasHoje(u) >= limiteDiario()) return reply.status(429).send({ error: `Limite de ${limiteDiario()} ilustrações por dia atingido. Amanhã libera, ou ajuste IMAGEM_LIMITE_DIARIO.` });
    const tarefa = iniciarTarefa(u, async () => {
      contabilizar(u);
      if (!ehGemini(b.data.opcao)) {
        const svg = await desenharIlustracaoSvg(b.data.prompt, b.data.tamanho, b.data.acento);
        return { mime: 'image/svg+xml', base64: Buffer.from(svg, 'utf8').toString('base64') } satisfies IlustracaoGerada;
      }
      return gerarIlustracao(b.data.opcao, b.data.prompt, b.data.tamanho, b.data.acento);
    });
    return responder(tarefa, reply);
  });
}
