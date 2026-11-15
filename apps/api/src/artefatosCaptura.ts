import type { Prisma } from '@prisma/client';
import { ambienteDoEvento, type PericiaIn, type AmbienteMonitorado } from '@seginfo/shared';
import { prisma } from './db.js';
import { analisarArtefato, hashArtefato } from './artefatosAnalise.js';

type Origem = { origem: string; referencia: string; alvo?: string | null; ip?: string | null; sessao?: string | null; quando: Date; contexto?: Prisma.InputJsonObject };
type Entrada = { tipo: string; nome: string; conteudo?: string; sha256?: string; formato?: string; caminho?: string };

async function preservar(usuarioId: string, entrada: Entrada, origem: Origem, indice: string) {
  const conteudo = entrada.conteudo ?? '';
  const chave = entrada.sha256 ? `sha256:${entrada.sha256}` : `${entrada.tipo}:${hashArtefato(conteudo || `${origem.referencia}:${entrada.nome}`)}`;
  const analise = analisarArtefato(conteudo, entrada.formato);
  const a = await prisma.artefatoAtaque.upsert({
    where: { usuarioId_chave: { usuarioId, chave } }, update: {},
    create: { usuarioId, chave, tipo: entrada.tipo, nome: entrada.nome.slice(0, 500), conteudo,
      sha256: entrada.sha256, formato: entrada.formato ?? 'texto', ...analise }, select: { id: true },
  });
  const ocorrencia = { ...origem, caminho: entrada.caminho, chave: `${origem.origem}:${origem.referencia}:${indice}` };
  await prisma.artefatoOcorrencia.upsert({
    where: { artefatoId_chave: { artefatoId: a.id, chave: ocorrencia.chave } },
    update: {}, create: { artefatoId: a.id, ...ocorrencia },
  });
}

export async function preservarPericia(usuarioId: string, referencia: string, d: PericiaIn) {
  const origem: Origem = { origem: 'laudo', referencia, alvo: d.alvo, quando: new Date(d.janelaFim),
    contexto: { janelaInicio: d.janelaInicio, janelaFim: d.janelaFim, sistema: d.sistema } };
  for (const [i, a] of d.arquivos.entries()) await preservar(usuarioId, { tipo: 'arquivo', nome: a.caminho, caminho: a.caminho, sha256: a.sha256, formato: a.tipo }, { ...origem, quando: new Date(a.modificadoEm ?? d.janelaFim), contexto: { ...origem.contexto, tamanho: a.tamanho } }, `arquivo:${i}`);
  for (const [i, p] of d.persistencia.entries()) await preservar(usuarioId, { tipo: 'persistencia', nome: p.onde, caminho: p.onde, conteudo: p.conteudo, formato: p.tipo }, origem, `persistencia:${i}`);
  for (const [i, p] of d.processos.entries()) await preservar(usuarioId, { tipo: 'processo', nome: `Linha de processo · ${hashArtefato(p.comando).slice(0, 12)}`, conteudo: p.comando }, { ...origem, contexto: { ...origem.contexto, pid: p.pid, usuario: p.usuario ?? null, inicio: p.inicio ?? null } }, `processo:${i}`);
}

export type EventoArquivo = { id?: string; dedupKey: string; usuarioId: string; fonte: string; ambiente?: string; alvo?: string | null; ocorridoEm: Date; ipOrigem?: string | null; acao: string; detalhes: unknown };
export async function preservarEventos(eventos: EventoArquivo[]) {
  for (const e of eventos) {
    if (ambienteDoEvento({ ...e, ambiente: e.ambiente as AmbienteMonitorado | undefined }) === 'producao') continue;
    const d = e.detalhes && typeof e.detalhes === 'object' ? e.detalhes as Record<string, unknown> : {};
    const origem: Origem = { origem: 'radar', referencia: e.dedupKey, alvo: e.alvo, ip: e.ipOrigem, quando: e.ocorridoEm,
      sessao: typeof d.sessao === 'string' ? d.sessao : null, contexto: { fonte: e.fonte, acao: e.acao, eventoId: e.id ?? null } };
    if (e.acao === 'comando' && typeof d.comando === 'string' && d.comando.trim()) await preservar(e.usuarioId, { tipo: 'comando', nome: `Comando · ${hashArtefato(d.comando).slice(0, 12)}`, conteudo: d.comando }, origem, 'comando');
    if (e.acao === 'download' && typeof d.sha256 === 'string' && /^[a-f0-9]{64}$/.test(d.sha256)) await preservar(e.usuarioId, { tipo: 'arquivo', nome: `Arquivo transferido · ${d.sha256.slice(0, 12)}`, sha256: d.sha256, formato: 'desconhecido' }, origem, 'arquivo');
  }
}
