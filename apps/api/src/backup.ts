import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { prisma } from './db.js';
import { chavePublica, cifrarBackup } from './storage-crypto.js';
import { apagarItem, enviarBackup, listarBackups, obterAccessToken } from './onedrive.js';

/**
 * Backup completo do estado do usuário no banco -> gzip -> cifra híbrida (chave pública)
 * -> OneDrive. O formato do JSON é compatível com POST /api/import (exceto `ataques`).
 */

const PADRAO_NOME = /^seginfo-\d{8}-\d{6}\.sgb$/;

async function exportarDados(usuarioId: string) {
  const [usuario, progresso, sessoes, metas, posts, arsenal, biblioteca, cofre, ataques, memorias, linkedinPosts, diario, linkedinEstrategia, agentes, agenteAvaliacoes, agenteExecucoes, artefatosAtaque, artefatoOcorrencias, pericias, linkedinProjetos, linkedinIdeias, postVersoes, linkedinPerfilPro, linkedinInspiracoes, linkedinVoz, exposicaoAlvos, exposicaoVarreduras, linkedinProjetoMarcos, linkedinProjetoInformes, linkedinProjetoEventos] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, email: true } }),
    prisma.progresso.findMany({ where: { usuarioId } }),
    prisma.sessao.findMany({ where: { usuarioId } }),
    prisma.meta.findMany({ where: { usuarioId } }),
    prisma.post.findMany({ where: { usuarioId } }),
    prisma.arsenalItem.findMany({ where: { usuarioId } }),
    prisma.biblioItem.findMany({ where: { usuarioId } }),
    prisma.cofreBlob.findUnique({ where: { usuarioId } }), // já é ciphertext
    prisma.ataqueEvento.findMany({ where: { usuarioId }, orderBy: { ocorridoEm: 'asc' } }),
    // material corporativo NUNCA vai para o OneDrive pessoal
    prisma.memoria.findMany({ where: { usuarioId, escopo: { not: 'corporativo' } } }),
    prisma.linkedinPost.findMany({ where: { usuarioId } }),
    prisma.diarioEntrada.findMany({ where: { usuarioId } }),
    prisma.linkedinEstrategia.findUnique({ where: { usuarioId } }),
    prisma.agente.findMany({ where: { usuarioId } }),
    prisma.agenteAvaliacao.findMany({ where: { usuarioId } }),
    // trilha completa do que os agentes fizeram (passos, conversa, aprovações). buscar_base só
    // devolve notas pessoais, então nenhuma execução carrega material corporativo.
    prisma.agenteExecucao.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } }),
    prisma.artefatoAtaque.findMany({ where: { usuarioId } }),
    prisma.artefatoOcorrencia.findMany({ where: { artefato: { usuarioId } } }),
    prisma.pericia.findMany({ where: { usuarioId } }),
    // pipeline do LinkedIn. A conta (LinkedinConta) fica de fora de propósito: é credencial.
    prisma.linkedinProjeto.findMany({ where: { usuarioId } }),
    prisma.linkedinIdeia.findMany({ where: { usuarioId } }),
    prisma.postVersao.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } }),
    // perfil profissional, inspirações e voz do LinkedIn (sem empregador nem credencial)
    prisma.linkedinPerfilPro.findUnique({ where: { usuarioId } }),
    prisma.linkedinInspiracao.findMany({ where: { usuarioId } }),
    prisma.linkedinVoz.findUnique({ where: { usuarioId } }),
    // Minha exposição: alvos acompanhados e o histórico das varreduras (só dados públicos)
    prisma.exposicaoAlvo.findMany({ where: { usuarioId } }),
    prisma.exposicaoVarredura.findMany({ where: { usuarioId }, orderBy: { criadoEm: 'asc' } }),
    prisma.linkedinProjetoMarco.findMany({ where: { projeto: { usuarioId } } }),
    prisma.linkedinProjetoInforme.findMany({ where: { projeto: { usuarioId } } }),
    prisma.linkedinProjetoEvento.findMany({ where: { projeto: { usuarioId } } }),
  ]);
  if (!usuario) throw new Error('Usuário do backup não encontrado.');
  return {
    formato: 'seginfo-export',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    usuario,
    progresso, sessoes, metas, posts, arsenal, biblioteca, cofre, ataques, memorias,
    linkedinPosts, diario, linkedinEstrategia, agentes, agenteAvaliacoes, agenteExecucoes,
    artefatosAtaque, artefatoOcorrencias, pericias,
    linkedinProjetos, linkedinIdeias, postVersoes, linkedinPerfilPro, linkedinInspiracoes, linkedinVoz,
    exposicaoAlvos, exposicaoVarreduras,
    linkedinProjetoMarcos, linkedinProjetoInformes, linkedinProjetoEventos,
  };
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

let emAndamento = false;

export async function executarBackup(usuarioId: string) {
  if (emAndamento) throw new Error('Já existe um backup em andamento.');
  emAndamento = true;

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const nome = `seginfo-${stamp}.sgb`;
  let blob: Buffer = Buffer.alloc(0);

  try {
    const pub = chavePublica();
    const json = Buffer.from(JSON.stringify(await exportarDados(usuarioId)), 'utf8');
    blob = cifrarBackup(gzipSync(json), pub);
    const sha256 = createHash('sha256').update(blob).digest('hex');

    const token = await obterAccessToken(usuarioId);
    const up = await enviarBackup(token, nome, blob);

    const registro = await prisma.backupRegistro.create({
      data: { usuarioId, nomeArquivo: nome, tamanhoBytes: blob.length, sha256, status: 'ok', itemId: up.id },
    });
    await prisma.armazenamentoConta.update({
      where: { usuarioId },
      data: { ultimoBackupEm: new Date(), ultimoErro: null },
    });

    // retenção: falha aqui não invalida o backup que acabou de subir
    try { await aplicarRetencao(token); } catch (e) { console.warn('backup: retenção falhou:', mensagem(e)); }
    return registro;
  } catch (e) {
    const erro = mensagem(e);
    await prisma.backupRegistro.create({
      data: { usuarioId, nomeArquivo: nome, tamanhoBytes: blob.length, sha256: '', status: 'erro', erro },
    }).catch(() => undefined);
    await prisma.armazenamentoConta.updateMany({ where: { usuarioId }, data: { ultimoErro: erro } }).catch(() => undefined);
    throw new Error(erro);
  } finally {
    emAndamento = false;
  }
}

/** Mantém só os N backups mais recentes (BACKUP_RETENCAO, padrão 14, mínimo 3). */
async function aplicarRetencao(token: string) {
  const manter = Math.max(3, Number(process.env.BACKUP_RETENCAO ?? 14) || 14);
  const itens = (await listarBackups(token))
    .filter((i) => PADRAO_NOME.test(i.name)) // só apaga o que a própria app criou
    .sort((a, b) => b.name.localeCompare(a.name));
  for (const i of itens.slice(manter)) await apagarItem(token, i.id);
}

/** Backup automático: se a última cópia bem-sucedida tem 24 h ou mais, faz outra. */
export function iniciarBackupAutomatico(app: FastifyInstance) {
  if (process.env.BACKUP_AUTOMATICO !== 'true' || !process.env.DATABASE_URL) return;

  const verificar = async () => {
    try {
      for (const c of await prisma.armazenamentoConta.findMany()) {
        const horas = c.ultimoBackupEm ? (Date.now() - c.ultimoBackupEm.getTime()) / 3_600_000 : Infinity;
        if (horas >= 24) {
          await executarBackup(c.usuarioId);
          app.log.info('backup automático concluído');
        }
      }
    } catch (e) {
      app.log.warn({ err: mensagem(e) }, 'backup automático falhou (tenta de novo na próxima hora)');
    }
  };

  const intervalo = setInterval(verificar, 3_600_000);
  const inicial = setTimeout(verificar, 120_000);
  intervalo.unref();
  inicial.unref();
  app.addHook('onClose', async () => {
    clearInterval(intervalo);
    clearTimeout(inicial);
  });
}
