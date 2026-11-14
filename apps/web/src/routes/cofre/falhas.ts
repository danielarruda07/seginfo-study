import { codigoErro, mensagemErro } from '@/services/cofre2fa';

/**
 * Gravação no cofre falhou. Só acontece no modo servidor (2FA ativo):
 * - sessão do segundo fator venceu → quem chama trava e volta para a etapa do código;
 * - conflito → o cofre mudou em outro aparelho/aba; nada foi salvo.
 */
export function explicarFalhaGravar(e: unknown): { expirou: boolean; texto: string } {
  const codigo = codigoErro(e);
  if (codigo === '2FA_NECESSARIO') return { expirou: true, texto: '' };
  return {
    expirou: false,
    texto: codigo === 'CONFLITO'
      ? 'Não salvei: o Cofre foi alterado em outro aparelho ou aba. Trave e abra de novo para carregar a versão mais nova.'
      : `Não salvei: ${mensagemErro(e)}`,
  };
}
