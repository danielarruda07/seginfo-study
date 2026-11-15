import { Prisma } from '@prisma/client';
import { diaLocal } from '@seginfo/shared';
import { prisma } from './db.js';

/**
 * Radar → ideia de post: transforma os eventos reais do honeypot em matéria-prima.
 * Só entram números AGREGADOS (totais, serviços, países, usuários tentados, ações).
 * Nunca entram IP de origem, alvo, porta de destino nem senha tentada: o post conta o
 * que a internet faz com um serviço exposto, não o mapa do ambiente.
 */

const ROTULO_ACAO: Record<string, string> = {
  login_falha: 'tentativas de login que falharam',
  login_ok: 'logins aceitos pela isca',
  lockout: 'bloqueios de conta',
  scan: 'varreduras',
  bloqueio: 'conexões bloqueadas no firewall',
  conexao: 'conexões',
  comando: 'comandos executados na isca',
  download: 'downloads tentados',
  reflexao: 'pacotes de reflexão UDP descartados',
};

export interface ResumoRadar {
  dias: number;
  total: number;
  origensDistintas: number;
  servicos: [string, number][];
  paises: [string, number][];
  usuarios: [string, number][];
  acoes: [string, number][];
}

const lista = (itens: [string, number][]) => itens.map(([nome, n]) => `${nome} (${n.toLocaleString('pt-BR')})`).join(', ');

/** Título e briefing da ideia a partir do resumo (função pura, testada). */
export function briefingDoRadar(r: ResumoRadar, ate: string): { titulo: string; briefing: string } {
  const titulo = `Radar: o que a internet fez com o meu honeypot em ${r.dias} dias (até ${ate.split('-').reverse().join('/')})`;
  const linhas = [
    `Post de Blue Team com dados reais do meu honeypot exposto de propósito, nos últimos ${r.dias} dias.`,
    `Números agregados: ${r.total.toLocaleString('pt-BR')} eventos vindos de ${r.origensDistintas.toLocaleString('pt-BR')} origens distintas.`,
  ];
  if (r.acoes.length) linhas.push(`O que tentaram: ${lista(r.acoes.map(([a, n]) => [ROTULO_ACAO[a] ?? a, n]))}.`);
  if (r.servicos.length) linhas.push(`Serviços mais procurados: ${lista(r.servicos)}.`);
  if (r.usuarios.length) linhas.push(`Usuários mais tentados: ${lista(r.usuarios)}.`);
  if (r.paises.length) linhas.push(`Países de origem (pelo endereço, que pode ser um intermediário): ${lista(r.paises)}.`);
  linhas.push(
    'Ângulo: o que esses números ensinam para quem opera infraestrutura (por exemplo: senha fraca cai em minutos, serviço exposto é achado em horas).',
    'Não cite endereço IP, nome de equipamento, faixa de rede nem como o ambiente é montado. [CONFIRMAR: conferir os números no Radar antes de publicar]',
  );
  return { titulo, briefing: linhas.join('\n') };
}

type Linha = { nome: string | null; total: bigint };

export async function resumoDoRadar(usuarioId: string, dias: number): Promise<ResumoRadar> {
  const desde = new Date(Date.now() - dias * 86_400_000);
  const where = Prisma.sql`"usuarioId" = ${usuarioId} AND "escopo" = 'internet' AND "ocorridoEm" >= ${desde}`;
  const top = (coluna: 'servico' | 'paisOrigem' | 'usuarioTentado' | 'acao', limite: number) =>
    prisma.$queryRaw<Linha[]>`
      SELECT ${Prisma.raw(`"${coluna}"`)} AS nome, count(*) AS total FROM "AtaqueEvento"
      WHERE ${where} AND ${Prisma.raw(`"${coluna}"`)} IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${limite}`;
  const [totais, servicos, paises, usuarios, acoes] = await Promise.all([
    prisma.$queryRaw<{ total: bigint; origens: bigint }[]>`
      SELECT count(*) AS total, count(DISTINCT "ipOrigem") AS origens FROM "AtaqueEvento" WHERE ${where}`,
    top('servico', 5), top('paisOrigem', 5), top('usuarioTentado', 5), top('acao', 6),
  ]);
  const pares = (ls: Linha[]): [string, number][] => ls.flatMap((l) => (l.nome ? [[l.nome.slice(0, 40), Number(l.total)] as [string, number]] : []));
  return {
    dias,
    total: Number(totais[0]?.total ?? 0),
    origensDistintas: Number(totais[0]?.origens ?? 0),
    servicos: pares(servicos), paises: pares(paises), usuarios: pares(usuarios), acoes: pares(acoes),
  };
}

export async function ideiaDoRadar(usuarioId: string, dias: number, fuso: string) {
  const resumo = await resumoDoRadar(usuarioId, dias);
  if (resumo.total === 0) return { erro: `O Radar não registrou eventos da internet nos últimos ${dias} dias.` };
  const hoje = diaLocal(new Date(), fuso);
  const { titulo, briefing } = briefingDoRadar(resumo, hoje);
  const origemRef = `${hoje}:${dias}`;
  const existente = await prisma.linkedinIdeia.findFirst({ where: { usuarioId, origem: 'radar', origemRef } });
  // mesma janela no mesmo dia: atualiza os números em vez de duplicar
  const ideia = existente
    ? await prisma.linkedinIdeia.update({ where: { id: existente.id }, data: { titulo, briefing } })
    : await prisma.linkedinIdeia.create({
      data: { usuarioId, titulo, briefing, origem: 'radar', origemRef },
    });
  return { ideia };
}
