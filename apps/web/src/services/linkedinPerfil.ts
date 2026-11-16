import type {
  InspiracaoIn, InspiracaoLinkedin, LeituraPrint, PerfilImportado, PerfilPro, PerfilProRegistro, VagaImportada, VozLinkedin,
} from '@seginfo/shared';
import { http } from './http';
import { aguardarTarefa } from './linkedinPipeline';

/** Perfil profissional, inspirações e perfil de voz do LinkedIn (dados no servidor). */

export type { InspiracaoIn, InspiracaoLinkedin, PerfilImportado, PerfilPro, PerfilProRegistro, VagaImportada, VozLinkedin } from '@seginfo/shared';

const dados = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);
const iniciar = (nome: string, corpo: unknown, timeout = 20_000) =>
  dados(http.post<{ tarefaId: string }>(`/linkedin/tarefas/${nome}`, corpo, { timeout }));

/** Conteúdo do arquivo em base64, sem o prefixo "data:...". */
export function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
    leitor.onload = () => {
      const texto = String(leitor.result ?? '');
      resolve(texto.slice(texto.indexOf(',') + 1));
    };
    leitor.readAsDataURL(arquivo);
  });
}

// ----- perfil profissional -----
export const getPerfilPro = () => dados(http.get<PerfilProRegistro>('/linkedin/perfil-pro'));
export const salvarPerfilPro = (perfil: PerfilPro, importado = false) =>
  dados(http.put<PerfilProRegistro>('/linkedin/perfil-pro', { perfil, importado }));

/** Lê o PDF do perfil do LinkedIn com a IA. Não grava nada: devolve o que foi encontrado para revisão. */
export async function importarPdfDoPerfil(arquivo: File): Promise<PerfilImportado> {
  const pdfBase64 = await arquivoParaBase64(arquivo);
  const { tarefaId } = await iniciar('perfil-pdf', { pdfBase64 }, 90_000);
  return aguardarTarefa<PerfilImportado>(tarefaId);
}

export async function extrairVagaDoTexto(texto: string): Promise<VagaImportada> {
  const { tarefaId } = await iniciar('vaga', { texto });
  return aguardarTarefa<VagaImportada>(tarefaId);
}

// ----- inspirações -----
export const listInspiracoes = () => dados(http.get<InspiracaoLinkedin[]>('/linkedin/inspiracoes'));
export const criarInspiracao = (b: InspiracaoIn) => dados(http.post<InspiracaoLinkedin>('/linkedin/inspiracoes', b));
export const editarInspiracao = (id: string, b: Partial<InspiracaoIn>) => dados(http.patch<InspiracaoLinkedin>(`/linkedin/inspiracoes/${id}`, b));
export const removerInspiracao = (id: string) => dados(http.delete<{ ok: true }>(`/linkedin/inspiracoes/${id}`));

const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type TipoImagem = (typeof TIPOS_IMAGEM)[number];

/** A IA lê um print de post: autor, texto e visual. A imagem não fica guardada, só o que foi lido. */
export async function lerPrintDeInspiracao(arquivo: File): Promise<LeituraPrint> {
  const tipo = TIPOS_IMAGEM.find((t) => t === arquivo.type) as TipoImagem | undefined;
  if (!tipo) throw new Error('Use uma imagem JPG, PNG, WebP ou GIF.');
  const imagemBase64 = await arquivoParaBase64(arquivo);
  const { tarefaId } = await iniciar('imagem-inspiracao', { imagemBase64, tipo }, 60_000);
  return aguardarTarefa<LeituraPrint>(tarefaId);
}

// ----- voz -----
export const getVoz = () => dados(http.get<VozLinkedin>('/linkedin/voz'));
export const salvarAjustesVoz = (ajustes: string) => dados(http.put<VozLinkedin>('/linkedin/voz/ajustes', { ajustes }));
export async function gerarVoz(): Promise<VozLinkedin> {
  const { tarefaId } = await iniciar('voz', {});
  return aguardarTarefa<VozLinkedin>(tarefaId);
}
