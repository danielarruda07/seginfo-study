import axios from 'axios';

/**
 * Instância axios com interceptors centralizados.
 * No MVP os dados vêm do localStorage; esta instância fica pronta para
 * a migração futura ao apps/api (Fastify) sem mudar os services de domínio.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  // ponto de injeção de auth futura (Bearer token)
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (err) => {
    // tratamento de erro centralizado
    return Promise.reject(err);
  },
);
