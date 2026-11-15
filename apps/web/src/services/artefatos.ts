import { http } from './http';

export interface Artefato {
  id: string; tipo: string; nome: string; sha256: string | null; formato: string; resumo: string; categoria: string;
  favorito: boolean; tags: string[]; criadoEm: string; _count: { ocorrencias: number };
}
export interface OcorrenciaArtefato {
  id: string; origem: string; referencia: string; alvo: string | null; ip: string | null; sessao: string | null;
  caminho: string | null; quando: string; contexto: Record<string, unknown>;
}
export interface ArtefatoDetalhe extends Artefato {
  conteudo: string; notas: string; temAmostra: boolean; ocorrencias: OcorrenciaArtefato[];
}
export interface FiltrosArtefato { q?: string; tipo?: string; categoria?: string; alvo?: string; favorito?: 'true'; page: number; limit: number }
export const listarArtefatos = (params: FiltrosArtefato) => http.get<{ total: number; items: Artefato[] }>('/artefatos', { params }).then((r) => r.data);
export const obterArtefato = (id: string) => http.get<ArtefatoDetalhe>(`/artefatos/${encodeURIComponent(id)}`).then((r) => r.data);
export const obterOcorrencias = (id: string, page: number) => http.get<OcorrenciaArtefato[]>(`/artefatos/${encodeURIComponent(id)}/ocorrencias`, { params: { page } }).then((r) => r.data);
export const salvarArtefato = (id: string, dados: { notas: string; tags: string[]; favorito: boolean }) => http.patch(`/artefatos/${encodeURIComponent(id)}`, dados);
export async function importarHistorico(onProgress: (n: number) => void) {
  let lidos = 0;
  for (const fonte of ['laudos', 'radar']) {
    let cursor: string | undefined;
    do {
      const { data } = await http.post<{ cursor: string | null; lidos: number }>('/artefatos/importar', { fonte, cursor }, { timeout: 110000 });
      lidos += data.lidos; onProgress(lidos); cursor = data.cursor ?? undefined;
    } while (cursor);
  }
  return lidos;
}
export async function anexarAmostra(id: string, arquivo: File, sha256: string) {
  if (arquivo.size > 8 * 1048576) throw new Error('O limite por arquivo é 8 MB.');
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.')); reader.readAsDataURL(arquivo);
  });
  await http.put(`/artefatos/${encodeURIComponent(id)}/amostra`, { sha256, base64 }, { timeout: 110000 });
}
export async function baixarAmostra(id: string, sha256: string) {
  const { data } = await http.get(`/artefatos/${encodeURIComponent(id)}/amostra`, { responseType: 'blob', timeout: 60000 });
  const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = `${sha256}.bin`; a.click(); URL.revokeObjectURL(url);
}
