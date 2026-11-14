/**
 * Versão do SegInfo Study, mostrada no rodapé do menu e devolvida por /api/health.
 *
 * REGRA: a cada publicação na main, aumente este número e registre a mudança em docs/VERSOES.md.
 *   - último número (0.7.1): correção ou ajuste pequeno;
 *   - número do meio (0.8.0): funcionalidade nova.
 * O front e a API leem daqui; se o rodapé mostrar versões diferentes, um dos dois não foi atualizado.
 */
export const VERSAO = '0.14.0';
