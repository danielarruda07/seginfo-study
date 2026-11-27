import type { PericiaIn } from '@seginfo/shared';
import { http } from './http';

export interface PericiaResumo {
  arquivos: number;
  executaveis: number;
  persistencia: number;
  processos: number;
  conexoes: number;
  saidasBloqueadas: number;
  destinos: number;
  amostras: number;
  erros: number;
}

export interface PericiaItem {
  id: string;
  alvo: string;
  vmid: number;
  sistema: 'linux' | 'windows';
  sensor: string | null;
  janelaInicio: string;
  janelaFim: string;
  resumo: PericiaResumo;
  criadoEm: string;
}

export interface Invasor {
  ip: string;
  pais: string | null;
  logins: number;
  falhas: number;
  reconhecimentos: number;
  comandos: number;
  arquivos: number;
  tuneis: number;
  bloqueios: number;
  reflexoes: number;
  primeira: string;
  ultima: string;
}

export interface PericiaEvento {
  id: string;
  quando: string;
  fonte: string;
  acao: string;
  ip: string | null;
  pais: string | null;
  servico: string | null;
  porta: number | null;
  comando: string | null;
  mitre: unknown[];
}

export type PericiaDetalhe = PericiaItem & { dados: PericiaIn; invasores: Invasor[]; linhaTempo: PericiaEvento[]; linhaTempoTruncada: boolean };

export const listarPericias = () => http.get<PericiaItem[]>('/pericia').then((r) => r.data);
export const getPericia = (id: string) => http.get<PericiaDetalhe>(`/pericia/${encodeURIComponent(id)}`).then((r) => r.data);
export const getPericiaTecnicas = () => http.get<{ id: string; laudos: number }[]>('/pericia/tecnicas').then((r) => r.data);

/** Relatório exportável (HTML/PDF) de um laudo de perícia de alvo do honeypot. */
export function relatorioDaPericia(p: PericiaDetalhe): import('./exportarRelatorio').RelatorioExport {
  const d = p.dados;
  const data = (s: string) => new Date(s).toLocaleString('pt-BR');
  const executaveis = d.arquivos.filter((a) => a.executavel || a.tipo === 'elf' || a.tipo === 'pe');
  const secoes: import('./exportarRelatorio').SecaoRelatorio[] = [];
  if (d.erros.length) secoes.push({ titulo: 'Avisos da coleta', texto: d.erros });
  secoes.push({ titulo: `Quem agiu nesta janela (${p.invasores.length})`, tabela: { colunas: ['IP', 'País', 'Logins', 'Falhas', 'Comandos', 'Arquivos', 'Túneis', 'Primeira', 'Última'],
    linhas: p.invasores.map((i) => [i.ip, i.pais, i.logins, i.falhas, i.comandos, i.arquivos, i.tuneis, data(i.primeira), data(i.ultima)]) } });
  if (executaveis.length) secoes.push({ titulo: `Executáveis gravados (${executaveis.length})`, itens: executaveis.map((a) => ({ severidade: 'alta' as const, titulo: a.caminho, detalhe: `${a.tipo} · ${a.tamanho} bytes${a.sha256 ? ` · sha256 ${a.sha256}` : ''}` })) });
  if (d.persistencia.length) secoes.push({ titulo: `Persistência (${d.persistencia.length})`, itens: d.persistencia.map((x) => ({ severidade: 'alta' as const, titulo: `${x.tipo} — ${x.onde}`, detalhe: x.conteudo })) });
  if (d.processos.length) secoes.push({ titulo: `Processos (${d.processos.length})`, tabela: { colunas: ['PID', 'Usuário', 'Início', 'Comando'], linhas: d.processos.map((x) => [x.pid, x.usuario, x.inicio, x.comando]) } });
  if (d.conexoes.length) secoes.push({ titulo: `Conexões (${d.conexoes.length})`, tabela: { colunas: ['Local', 'Remoto', 'Estado', 'Processo'], linhas: d.conexoes.map((x) => [x.local, x.remoto, x.estado, x.processo]) } });
  if (d.saidas.length) secoes.push({ titulo: `Saídas bloqueadas pelo firewall (${d.saidas.length})`, tabela: { colunas: ['Destino', 'Porta', 'Protocolo', 'Tentativas'],
    linhas: [...d.saidas].sort((a, b) => b.tentativas - a.tentativas).map((x) => [x.destino, x.porta, x.protocolo, x.tentativas]) } });
  const outros = d.arquivos.filter((a) => !executaveis.includes(a));
  if (outros.length) secoes.push({ titulo: `Outros arquivos alterados (${outros.length})`, tabela: { colunas: ['Caminho', 'Tipo', 'Tamanho', 'SHA-256'], linhas: outros.map((a) => [a.caminho, a.tipo, a.tamanho, a.sha256]) } });
  if (d.amostras.length) secoes.push({ titulo: 'Amostras preservadas', tabela: { colunas: ['SHA-256', 'Caminho', 'Tamanho', 'Guardada'], linhas: d.amostras.map((a) => [a.sha256, a.caminho, a.tamanho, a.guardada ? 'sim' : 'não']) } });
  if (d.observacoes.length) secoes.push({ titulo: 'Observações', texto: d.observacoes });
  if (p.linhaTempo.length) secoes.push({ titulo: `Linha do tempo${p.linhaTempoTruncada ? ' (truncada)' : ''}`, tabela: { colunas: ['Quando', 'Fonte', 'Ação', 'IP', 'Serviço', 'Comando'],
    linhas: p.linhaTempo.map((e) => [data(e.quando), e.fonte, e.acao, e.ip, e.servico, e.comando]) } });
  return {
    titulo: 'Laudo pericial do alvo',
    subtitulo: `${p.alvo} (${p.sistema === 'linux' ? 'Linux' : 'Windows'})`,
    confidencial: true,
    meta: [['Alvo', p.alvo], ['VM', String(p.vmid)], ['Janela', `${data(p.janelaInicio)} → ${data(p.janelaFim)}`], ['Sensor', p.sensor ?? '—']],
    resumo: { alta: executaveis.length + d.persistencia.length, media: d.saidas.length, info: d.conexoes.length },
    secoes,
  };
}
