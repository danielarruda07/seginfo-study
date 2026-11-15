import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  bloqueiosDoPreflight, diaLocal, FUSO_PADRAO, normalizarUrlLinkedin, preflightLiberado, preflightPost, textoDoPost,
} from '@seginfo/shared';
import { prisma } from './db.js';
import { ErroLinkedin, publicarTexto } from './linkedinApi.js';

/**
 * Publicação pela API do LinkedIn e o agendador que a dispara na hora marcada.
 *
 * Publicar é ação externa e irreversível, então as regras são as do módulo Agents:
 * - só sai o que o dono APROVOU (status aprovado/agendado); editar o texto desfaz a aprovação;
 * - o preflight roda de novo aqui, no servidor, imediatamente antes de enviar;
 * - o rascunho é "reservado" (status publicando) numa única atualização condicional: dois
 *   disparos ao mesmo tempo, ou um reinício no meio, nunca publicam duas vezes;
 * - se a API reiniciar com um post em "publicando", ele vira "falhou" e NÃO é reenviado sozinho:
 *   não dá para saber se o LinkedIn recebeu.
 */

export const fusoDoLinkedin = () => process.env.LINKEDIN_FUSO || FUSO_PADRAO;

/** Sufixos de domínio que o preflight do servidor trata como "do ambiente" (LINKEDIN_DOMINIOS_BLOQUEADOS=a.b,c.d). */
export const dominiosBloqueados = () => (process.env.LINKEDIN_DOMINIOS_BLOQUEADOS ?? '').split(',').map((d) => d.trim()).filter(Boolean);

/** Preflight do servidor para um rascunho; devolve os bloqueios (vazio = liberado). */
export function bloqueiosDoServidor(post: { gancho: string; corpo: string }, riscosExtras: string[] = []): string[] {
  const itens = preflightPost(post, { dominiosExtras: dominiosBloqueados(), riscosExtras });
  return preflightLiberado(itens) ? [] : bloqueiosDoPreflight(itens);
}

const MAX_TENTATIVAS = 3;
const ESPERA_NOVA_TENTATIVA_MS = 10 * 60_000;

export class ErroPublicacao extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

/**
 * Publica um rascunho aprovado pela API. `agendado`: veio do agendador (erro passageiro
 * reagenda para daqui a 10 min, até 3 tentativas); senão veio do botão "Publicar agora".
 */
export async function publicarPelaApi(usuarioId: string, postId: string, agendado: boolean) {
  const antes = await prisma.post.findFirst({ where: { id: postId, usuarioId }, select: { status: true } });
  if (!antes) throw new ErroPublicacao(404, 'Rascunho não encontrado.');
  // reserva: só um disparo passa daqui
  const reserva = await prisma.post.updateMany({
    where: { id: postId, usuarioId, status: { in: agendado ? ['agendado'] : ['aprovado', 'agendado', 'falhou'] } },
    data: { status: 'publicando', tentativas: { increment: 1 } },
  });
  if (reserva.count !== 1) throw new ErroPublicacao(409, 'Este rascunho não está aprovado para publicação (ou já está sendo publicado).');

  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const falhar = async (msg: string, status = 422) => {
    await prisma.post.update({ where: { id: postId }, data: { status: 'falhou', ultimoErro: msg.slice(0, 500) } });
    return new ErroPublicacao(status, msg);
  };

  if (post.formato !== 'texto') throw await falhar('Pela API só sai post de texto por enquanto. Publique este formato à mão e registre o link.');
  const bloqueios = bloqueiosDoServidor(post);
  if (bloqueios.length) throw await falhar(`O texto não passou na verificação antes de publicar: ${bloqueios.join('; ')}.`);

  const texto = textoDoPost(post.gancho, post.corpo);
  try {
    const { urn, url } = await publicarTexto(usuarioId, texto);
    const agora = new Date();
    // o post JÁ saiu: daqui em diante nada pode devolver o rascunho para a fila
    let linkedinPostId: string | null = null;
    try {
      const registro = await prisma.linkedinPost.create({
        data: {
          usuarioId, url, urlNormalizada: normalizarUrlLinkedin(url), publicadoEm: diaLocal(agora, fusoDoLinkedin()),
          texto, formato: post.formato, origem: 'api', projetoId: post.projetoId, urn,
        },
      });
      linkedinPostId = registro.id;
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      linkedinPostId = (await prisma.linkedinPost.findFirst({ where: { usuarioId, urlNormalizada: normalizarUrlLinkedin(url) }, select: { id: true } }))?.id ?? null;
    }
    return await prisma.post.update({
      where: { id: postId },
      data: { status: 'publicado', publicado: true, publicadoEm: agora, linkedinPostId, ultimoErro: '', agendadoPara: post.agendadoPara },
    });
  } catch (e) {
    if (!(e instanceof ErroLinkedin)) {
      throw await falhar(`Falha inesperada ao publicar: ${(e as Error).message}. Confira no LinkedIn se o post saiu.`, 500);
    }
    if (e.transitorio && agendado && post.tentativas < MAX_TENTATIVAS) {
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'agendado', agendadoPara: new Date(Date.now() + ESPERA_NOVA_TENTATIVA_MS), ultimoErro: `${e.message} Nova tentativa em 10 minutos.` },
      });
      throw new ErroPublicacao(e.status, e.message);
    }
    if (e.transitorio && !agendado) {
      // botão "Publicar agora" com erro passageiro: volta ao estado de onde saiu, sem perder a aprovação
      await prisma.post.update({ where: { id: postId }, data: { status: antes.status, ultimoErro: e.message } });
      throw new ErroPublicacao(e.status, e.message);
    }
    throw await falhar(e.message, e.status);
  }
}

/** Um ciclo do agendador: publica o que venceu e está no canal "api". */
export async function cicloDoAgendador(log: FastifyInstance['log']): Promise<number> {
  const vencidos = await prisma.post.findMany({
    where: { status: 'agendado', canal: 'api', agendadoPara: { lte: new Date() } },
    select: { id: true, usuarioId: true },
    orderBy: { agendadoPara: 'asc' },
    take: 5,
  });
  let publicados = 0;
  for (const p of vencidos) {
    try {
      await publicarPelaApi(p.usuarioId, p.id, true);
      publicados++;
      log.info({ postId: p.id }, 'linkedin: post agendado publicado');
    } catch (e) {
      log.warn({ postId: p.id, err: (e as Error).message }, 'linkedin: falha ao publicar post agendado');
    }
  }
  return publicados;
}

/** Liga o agendador (um ciclo por minuto) e encerra o que ficou pela metade num reinício. */
export function iniciarAgendadorLinkedin(app: FastifyInstance) {
  if (!process.env.DATABASE_URL) return;
  void prisma.post
    .updateMany({
      where: { status: 'publicando' },
      data: { status: 'falhou', ultimoErro: 'A API reiniciou durante a publicação. Confira no LinkedIn se o post saiu: se saiu, use "Publiquei: registrar"; se não, reagende.' },
    })
    .catch((e: unknown) => app.log.warn({ err: (e as Error).message }, 'linkedin: falha ao encerrar publicações pela metade'));

  let rodando = false;
  const ciclo = async () => {
    if (rodando) return;
    rodando = true;
    try { await cicloDoAgendador(app.log); }
    catch (e) { app.log.warn({ err: (e as Error).message }, 'linkedin: ciclo do agendador falhou'); }
    finally { rodando = false; }
  };
  const intervalo = setInterval(ciclo, 60_000);
  intervalo.unref();
  app.addHook('onClose', async () => clearInterval(intervalo));
}
