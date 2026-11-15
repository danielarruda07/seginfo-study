import type { IlustracaoGerada, OpcaoIlustracao, OpcoesImagem, PecaVisual, TamanhoVisual } from '@seginfo/shared';
import { http } from './http';
import { aguardarTarefa } from './linkedinPipeline';

/** Arte dos posts: slides projetados pela IA e ilustração opcional (Gemini). O desenho em si é feito no navegador. */

const dados = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const getOpcoesImagem = () => dados(http.get<OpcoesImagem>('/linkedin/imagem/opcoes'));

export async function projetarPeca(p: { tipo: 'imagem' | 'carrossel'; gancho: string; corpo: string; roteiro?: string; direcao?: string }): Promise<PecaVisual> {
  const { tarefaId } = await dados(http.post<{ tarefaId: string }>('/linkedin/tarefas/peca-visual', p, { timeout: 20_000 }));
  return aguardarTarefa<PecaVisual>(tarefaId);
}

/** Uma ilustração por chamada, e cada uma custa. A tela só chama quando você clica. */
export async function gerarIlustracao(p: { opcao: OpcaoIlustracao; prompt: string; tamanho: TamanhoVisual; acento?: string }): Promise<IlustracaoGerada> {
  const { tarefaId } = await dados(http.post<{ tarefaId: string }>('/linkedin/tarefas/ilustracao', p, { timeout: 20_000 }));
  return aguardarTarefa<IlustracaoGerada>(tarefaId, 2_000, 150_000);
}
