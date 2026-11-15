import type {
  AcaoRefino, CanalPublicacao, IdeiaIn, IdeiaLinkedin, PostPublicado, ProjetoIn, ProjetoLinkedin, RascunhoIA,
  RascunhoLinkedin, RefinoIA, StatusContaLinkedin, SugestaoPauta, TarefaIA, VersaoRascunho,
} from '@seginfo/shared';
import { http } from './http';
import { contextoDoEstudo } from './linkedin';

/**
 * Pipeline do LinkedIn no servidor: projetos, backlog de ideias, ciclo de vida do rascunho
 * (aprovar, agendar, publicar), versões, tarefas de IA em segundo plano e conta do LinkedIn.
 * As regras puras (preflight, ritmo) vêm de @seginfo/shared; a tela só mostra, o servidor decide.
 */

export type {
  ProjetoLinkedin, IdeiaLinkedin, RascunhoLinkedin, VersaoRascunho, StatusContaLinkedin, SugestaoPauta,
} from '@seginfo/shared';

const dados = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

// ----- projetos -----
export const listProjetos = () => dados(http.get<ProjetoLinkedin[]>('/linkedin/projetos'));
export const criarProjeto = (b: ProjetoIn) => dados(http.post<ProjetoLinkedin>('/linkedin/projetos', b));
export const editarProjeto = (id: string, b: Partial<ProjetoIn>) => dados(http.patch<ProjetoLinkedin>(`/linkedin/projetos/${id}`, b));
/** Apaga o projeto; ideias, rascunhos, posts e marcos continuam, só perdem o vínculo. */
export const removerProjeto = (id: string) => dados(http.delete<{ ok: true }>(`/linkedin/projetos/${id}`));

// ----- ideias -----
export const listIdeias = () => dados(http.get<IdeiaLinkedin[]>('/linkedin/ideias'));
export const criarIdeia = (b: IdeiaIn) => dados(http.post<IdeiaLinkedin>('/linkedin/ideias', b));
export const editarIdeia = (id: string, b: Partial<IdeiaIn>) => dados(http.patch<IdeiaLinkedin>(`/linkedin/ideias/${id}`, b));
export const removerIdeia = (id: string) => dados(http.delete<{ ok: true }>(`/linkedin/ideias/${id}`));
/** Ideia a partir do Radar: números agregados dos últimos dias, sem IP nem alvo. */
export const ideiaDoRadar = (dias = 7) => dados(http.post<IdeiaLinkedin>('/linkedin/ideias/radar', { dias }, { timeout: 30_000 }));

// ----- rascunhos no pipeline -----
export interface RascunhoIn {
  titulo: string; gancho: string; corpo: string;
  direcaoVisual?: string; textoAlternativo?: string; roteiroSlides?: string;
  topicoId?: string | null; formato?: string; projetoId?: string | null; ideiaId?: string | null;
  /** rótulo da versão criada quando o texto muda (manual, ia:gerar, ia:encurtar...) */
  origemVersao?: string;
}
export const listRascunhosPipeline = () => dados(http.get<RascunhoLinkedin[]>('/posts'));
export const criarRascunhoPipeline = (b: RascunhoIn) => dados(http.post<RascunhoLinkedin>('/posts', b));
/** Mudar gancho ou corpo de um rascunho aprovado/agendado devolve-o para "rascunho" (a aprovação vale para um texto). */
export const editarRascunhoPipeline = (id: string, b: Partial<RascunhoIn>) => dados(http.patch<RascunhoLinkedin>(`/posts/${id}`, b));

const acao = (id: string, nome: string, corpo: unknown = {}, timeout = 15_000) =>
  dados(http.post<RascunhoLinkedin>(`/linkedin/rascunhos/${id}/${nome}`, corpo, { timeout }));

/** Aprovar: o servidor refaz o preflight. `riscosExtras` são os achados que só o navegador vê (ativos do inventário). */
export const aprovarRascunho = (id: string, riscosExtras: string[]) => acao(id, 'aprovar', { riscosExtras });
export const voltarParaRascunho = (id: string) => acao(id, 'voltar');
export const agendarRascunho = (id: string, b: { quando: string; canal: CanalPublicacao; forcar?: boolean }) => acao(id, 'agendar', b);
export const desagendarRascunho = (id: string) => acao(id, 'desagendar');
/** Publica agora pela API do LinkedIn (precisa da conta conectada). */
export const publicarRascunhoAgora = (id: string) => acao(id, 'publicar', {}, 60_000);
/** "Publiquei à mão": cria o registro em Publicados e fecha o rascunho. */
export const registrarPublicacao = (id: string, b: { url: string; publicadoEm: string }) =>
  dados(http.post<{ rascunho: RascunhoLinkedin; post: PostPublicado }>(`/linkedin/rascunhos/${id}/registrar`, b));

export const listVersoes = (id: string) => dados(http.get<VersaoRascunho[]>(`/linkedin/rascunhos/${id}/versoes`));
export const restaurarVersao = (id: string, versaoId: string) => acao(id, `versoes/${versaoId}/restaurar`);

// ----- tarefas de IA em segundo plano -----
const iniciar = (nome: string, corpo: unknown) => dados(http.post<{ tarefaId: string }>(`/linkedin/tarefas/${nome}`, corpo, { timeout: 20_000 }));
export const consultarTarefa = <T,>(id: string) => dados(http.get<TarefaIA<T>>(`/linkedin/tarefas/${id}`));

/** Espera a tarefa terminar consultando a cada 2 s (até 4 min). O túnel corta requisições longas; a consulta não. */
export async function aguardarTarefa<T>(id: string, aCada = 2_000, limite = 240_000): Promise<T> {
  const fim = Date.now() + limite;
  for (;;) {
    const t = await consultarTarefa<T>(id);
    if (t.status === 'pronta') return t.resultado as T;
    if (t.status === 'erro') throw Object.assign(new Error(t.erro ?? 'A IA falhou.'), { response: { data: { error: t.erro ?? 'A IA falhou.' } } });
    if (Date.now() > fim) throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    await new Promise((r) => setTimeout(r, aCada));
  }
}

export interface PedidoGerar { briefing: string; pilar?: string; formato: string; incluirDiario: boolean; notas: { titulo: string; trecho: string }[]; projetoId?: string | null }
export const gerarRascunhoIA = async (p: PedidoGerar) =>
  aguardarTarefa<RascunhoIA>((await iniciar('gerar', { ...p, estudo: contextoDoEstudo() })).tarefaId);

export const refinarTexto = async (p: { acao: AcaoRefino; instrucao?: string; gancho: string; corpo: string }) =>
  aguardarTarefa<RefinoIA>((await iniciar('refinar', p)).tarefaId);

/** Pauta sugerida para os próximos dias a partir de projetos ativos, pilares esquecidos, diário e backlog. */
export const planejarSemana = async (p: { inicio: string; dias: number }) =>
  aguardarTarefa<{ sugestoes: SugestaoPauta[] }>((await iniciar('planejar', { ...p, estudo: contextoDoEstudo() })).tarefaId);

// ----- conta do LinkedIn -----
export const statusContaLinkedin = () => dados(http.get<StatusContaLinkedin>('/linkedin/conta'));
export const urlConectarLinkedin = () => dados(http.get<{ url: string }>('/linkedin/conta/connect'));
export const desconectarLinkedin = () => dados(http.post<{ ok: true }>('/linkedin/conta/disconnect'));
