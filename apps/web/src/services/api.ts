import { http } from './http';

/**
 * Cliente da API de estado (PostgreSQL via apps/api). Mantém as assinaturas
 * usadas pelas telas, agora assíncronas (react-query já lida com isso).
 *
 * Detecção de modo: se a API responder /health, usamos o servidor. Caso contrário,
 * o app pode continuar no modo local (localStorage) — ver `mode.ts`.
 */

export const api = {
  // progresso
  getProgresso: () => http.get('/progresso').then((r) => r.data),
  putProgresso: (body: { topicoId: string; status?: string; anotacoes?: string }) => http.put('/progresso', body).then((r) => r.data),
  // sessões
  getSessoes: () => http.get('/sessoes').then((r) => r.data),
  addSessao: (body: unknown) => http.post('/sessoes', body).then((r) => r.data),
  delSessao: (id: string) => http.delete(`/sessoes/${id}`).then((r) => r.data),
  // metas
  getMetas: () => http.get('/metas').then((r) => r.data),
  addMeta: (body: unknown) => http.post('/metas', body).then((r) => r.data),
  patchMeta: (id: string, body: unknown) => http.patch(`/metas/${id}`, body).then((r) => r.data),
  delMeta: (id: string) => http.delete(`/metas/${id}`).then((r) => r.data),
  // posts
  getPosts: () => http.get('/posts').then((r) => r.data),
  addPost: (body: unknown) => http.post('/posts', body).then((r) => r.data),
  patchPost: (id: string, body: unknown) => http.patch(`/posts/${id}`, body).then((r) => r.data),
  delPost: (id: string) => http.delete(`/posts/${id}`).then((r) => r.data),
  // arsenal
  getArsenal: () => http.get('/arsenal').then((r) => r.data),
  saveArsenal: (body: unknown) => http.post('/arsenal', body).then((r) => r.data),
  delArsenal: (id: string) => http.delete(`/arsenal/${id}`).then((r) => r.data),
  // biblioteca
  getBiblio: () => http.get('/biblioteca').then((r) => r.data),
  saveBiblio: (body: unknown) => http.post('/biblioteca', body).then((r) => r.data),
  patchBiblio: (id: string, body: unknown) => http.patch(`/biblioteca/${id}`, body).then((r) => r.data),
  delBiblio: (id: string) => http.delete(`/biblioteca/${id}`).then((r) => r.data),
  // cofre
  getCofre: () => http.get('/cofre').then((r) => r.data),
  putCofre: (body: unknown) => http.put('/cofre', body).then((r) => r.data),
  // import
  importData: (body: unknown) => http.post('/import', body).then((r) => r.data),
  health: () => http.get('/health', { baseURL: '/api' }).then((r) => r.data),
};
