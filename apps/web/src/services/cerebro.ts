import { http } from './http';

export type Escopo = 'pessoal' | 'corporativo';

export interface MemoriaResumo {
  id: string;
  titulo: string;
  preview: string;
  tags: string[];
  origem: string;
  urlOrigem: string | null;
  escopo: Escopo;
  /** preenchido quando está na lixeira: data em que será apagada de vez */
  excluirEm: string | null;
  atualizadoEm: string;
}

export interface Memoria {
  id: string;
  titulo: string;
  conteudo: string;
  tags: string[];
  origem: string;
  urlOrigem: string | null;
  escopo: Escopo;
  excluirEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface TrechoEncontrado {
  memoriaId: string;
  titulo: string;
  tags: string[];
  escopo: Escopo;
  trecho: string;
  score: number;
}

export interface MemoriaCorpo {
  titulo: string;
  conteudo: string;
  tags: string[];
  escopo: Escopo;
}

export interface ListaFiltro {
  tag?: string;
  escopo?: Escopo;
  lixeira?: boolean;
  page: number;
  limit: number;
}

export const listMemorias = (f: ListaFiltro) =>
  http
    .get<{ total: number; items: MemoriaResumo[] }>('/memorias', {
      params: { ...f, lixeira: f.lixeira ? 'true' : undefined },
    })
    .then((r) => r.data);

export const getMemoria = (id: string) => http.get<Memoria>(`/memorias/${id}`).then((r) => r.data);
export const createMemoria = (b: MemoriaCorpo) => http.post<Memoria>('/memorias', b).then((r) => r.data);
export const updateMemoria = (id: string, b: Partial<MemoriaCorpo>) => http.patch(`/memorias/${id}`, b).then((r) => r.data);
export const deleteMemoria = (id: string) => http.delete(`/memorias/${id}`).then((r) => r.data);
export const restoreMemoria = (id: string) => http.post(`/memorias/${id}/resgatar`).then((r) => r.data);

export const buscarMemorias = (q: string) =>
  http.get<{ resultados: TrechoEncontrado[] }>('/memorias/busca', { params: { q } }).then((r) => r.data.resultados);

// a captura busca a página no servidor e pode passar do timeout padrão de 10 s
export const capturarUrl = (url: string) =>
  http.post<Memoria>('/memorias/capturar-url', { url }, { timeout: 30_000 }).then((r) => r.data);

export const importarNotas = (notas: { titulo: string; conteudo: string }[]) =>
  http.post<{ importadas: number }>('/memorias/importar', { notas }, { timeout: 60_000 }).then((r) => r.data);
